import Database from 'better-sqlite3';
import { loanWarehouseId } from '../db.js';
import { freeShipForCustomer, freeShipWithoutShipper } from './appSettings.js';
import { dateKey, dispatchCode, nextCode, revenueCode } from './codes.js';
import { ApiError, badRequest } from './http.js';
import { createTicket, deleteTicket, postTicket, ticketsOfOrder } from './stockTickets.js';
import { getStockQuantity } from './stock.js';
import { refundShellDeposit, returnCustomerShells, shellDepositFees } from './shells.js';
import { addPartnerShellMovement, recordShellMovement, type BottleType } from './shellStock.js';

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';

// Chỉ chuyển tiến, không nhảy cóc. Đơn HOÀN TẤT là trạng thái cuối — không sửa, không hủy.
// Riêng đơn đã hoàn tất thì ghi nhận HÀNG HOÀN bằng chức năng riêng (POST /orders/:id/return)
// vì phải kèm số lượng hoàn từng dòng, ship hàng hoàn và vỏ/cọc — không đi qua đường chuyển trạng thái chung.
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  RETURNED: [],
};

export interface OrderRecord {
  id: number;
  order_code: string;
  order_type: 'SALE' | 'LEND_OUT' | 'BORROW_IN' | 'HIRED_LOAD';
  customer_id: number;
  seller_employee_id: number | null;
  shipper_employee_id: number | null;
  warehouse_id: number;
  order_date: string;
  order_status: string;
  payment_method: string;
  partner_unit_id: number | null;
  shipping_fee_id: number | null;
  shipping_fee: number;
  discount_amount: number;
  deposit_amount: number;
  subtotal_amount: number;
  total_amount: number;
  paid_amount: number;
  returned_shells_voi: number;
  returned_shells_up: number;
  loan_settled_at: string | null;
  loan_settle_type: string | null;
  loan_due_date: string | null;
  [key: string]: unknown;
}

export function getOrder(db: Database.Database, id: number): OrderRecord | undefined {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRecord | undefined;
}

// Số tiền khách còn phải trả của một đơn. Mọi loại đơn đều lấy theo total_amount vì chính
// recalcTotals đã quyết định đơn cho mượn/bốc xếp chỉ thu phí ship (và bằng 0 khi miễn ship);
// lấy riêng shipping_fee ở đây sẽ mâu thuẫn với quy tắc miễn ship và làm lệch sổ quỹ.
export function payableAmount(db: Database.Database, order: OrderRecord): number {
  const returned = db.prepare('SELECT COALESCE(SUM(returned_amount), 0) AS amount FROM order_returns WHERE order_id = ?')
    .get(order.id) as { amount: number } | undefined;
  return Math.max(0, (Number(order.total_amount) || 0) - (Number(returned?.amount) || 0));
}

export function netPaidAmount(db: Database.Database, order: OrderRecord): number {
  const row = db.prepare('SELECT COALESCE(SUM(refund_amount), 0) AS amount FROM order_returns WHERE order_id = ?')
    .get(order.id) as { amount: number };
  return (Number(order.paid_amount) || 0) - Number(row.amount || 0);
}

export function paymentStatus(paid: number, payable: number): 'PAID' | 'PARTIAL' | 'UNPAID' {
  return paid >= payable - 0.5 ? 'PAID' : paid > 0.5 ? 'PARTIAL' : 'UNPAID';
}

// paid_amount là tổng tiền đã nhận; sổ quỹ phải có cùng số tiền ngay khi người dùng ghi nhận thanh toán.
export function syncOrderCashLedger(db: Database.Database, order: OrderRecord, targetPaid: number, note: string) {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) AS amount FROM revenue_transactions WHERE order_id = ?')
    .get(order.id) as { amount: number };
  const difference = Math.round(targetPaid - Number(row.amount || 0));
  if (!difference) return;
  const isRefund = difference < 0;
  const transactionType = isRefund ? 'SALE_REFUND' : order.order_type === 'HIRED_LOAD' || order.order_type === 'LEND_OUT' ? 'OTHER' : 'WATER_SALE';
  const code = isRefund
    ? nextCode(db, { table: 'revenue_transactions', column: 'transaction_code', prefix: `HT-${dateKey(order.order_date)}-`, width: 3 })
    : revenueCode(db, order.order_date);
  db.prepare(`INSERT INTO revenue_transactions
    (transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(code, transactionType, order.id, order.order_type === 'HIRED_LOAD' || order.order_type === 'LEND_OUT' ? null : order.customer_id,
      difference, order.payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
      order.shipper_employee_id ?? order.seller_employee_id, order.order_date, note);
}

// Đơn đã có người giao hàng chưa — chỉ tính người giao hàng, không tính người đi nhận hàng hoàn.
export function hasDeliveryShipper(db: Database.Database, orderId: number): boolean {
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM order_shippers WHERE order_id = ? AND COALESCE(kind, 'DELIVERY') = 'DELIVERY'`)
    .get(orderId) as { count: number };
  return Number(row.count) > 0;
}

// Quy tắc chọn người giao: tắt cấu hình "đơn không có nhân viên vận chuyển là đơn miễn ship" thì đơn phải có người giao.
export function shipperRequired(db: Database.Database, orderType: string): boolean {
  return orderType !== 'BORROW_IN' && !freeShipWithoutShipper(db);
}

export function assertShipperSelected(db: Database.Database, orderType: string, orderId: number) {
  if (!shipperRequired(db, orderType)) return;
  if (!hasDeliveryShipper(db, orderId)) throw badRequest('Chọn nhân viên vận chuyển cho đơn hàng');
}

export function assertTransition(from: string, to: OrderStatus) {
  const allowed = TRANSITIONS[from as OrderStatus] ?? [];
  if (!allowed.includes(to)) throw badRequest(`Không thể chuyển đơn từ "${from}" sang "${to}"`);
}

export function assertPhysicalOrderWarehouse(db: Database.Database, orderType: string, warehouseId: number) {
  if (orderType !== 'SALE' && orderType !== 'LEND_OUT') return;
  const warehouse = db.prepare('SELECT type, is_active FROM warehouses WHERE id = ?')
    .get(warehouseId) as { type: string; is_active: number } | undefined;
  if (!warehouse || !warehouse.is_active || warehouse.type === 'VIRTUAL' || warehouse.type === 'CUSTOMER') {
    throw badRequest('Đơn bán / cho mượn phải xuất từ kho vật lý đang hoạt động');
  }
}

export function validateForConfirm(db: Database.Database, order: OrderRecord) {
  assertPhysicalOrderWarehouse(db, order.order_type, order.warehouse_id);
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM order_items WHERE order_id = ?').get(order.id) as { cnt: number }).cnt;
  if (!count) throw badRequest('Đơn hàng phải có ít nhất một mặt hàng');
  // Đơn cho mượn và đơn bốc xếp không gắn với nhân viên bán (không tính doanh thu bán hàng).
  const needsSeller = order.order_type !== 'LEND_OUT' && order.order_type !== 'HIRED_LOAD';
  if (needsSeller && !order.seller_employee_id) throw badRequest('Thiếu nhân viên bán hàng');
  if (order.order_type !== 'SALE' && !order.partner_unit_id) throw badRequest('Thiếu đối tác liên kết');
  if ((order.order_type !== 'BORROW_IN' || hasDeliveryShipper(db, order.id)) && !order.shipping_fee_id) throw badRequest('Thiếu tuyến phí vận chuyển');
  assertShipperSelected(db, order.order_type, order.id);
  if (order.order_type === 'SALE' || order.order_type === 'LEND_OUT') {
    const needed = new Map<number, number>();
    for (const item of itemRows(db, order.id)) {
      needed.set(item.product_id, (needed.get(item.product_id) ?? 0) + Number(item.quantity) + Number(item.quantity_promo || 0));
    }
    for (const [productId, quantity] of needed) {
      const available = getStockQuantity(db, order.warehouse_id, productId);
      if (available < quantity) {
        const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId) as { name: string } | undefined;
        throw badRequest(`${product?.name ?? `Sản phẩm #${productId}`} vượt tồn kho (hiện có ${available}, cần ${quantity})`);
      }
    }
  }
  assertShellReturnAvailable(db, order);
}

// Khách chỉ được trả số vỏ mình đang giữ: nợ vỏ hiện tại + số vỏ giao trong đơn này.
export function assertShellReturnAvailable(db: Database.Database, order: OrderRecord) {
  const returnedVoi = Number(order.returned_shells_voi) || 0;
  const returnedUp = Number(order.returned_shells_up) || 0;
  if (!returnedVoi && !returnedUp) return;
  const { borrowedVoi, borrowedUp } = bottleAmounts(itemRows(db, order.id));
  const customer = db.prepare('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?').get(order.customer_id) as
    | { bottle_debt_voi: number; bottle_debt_up: number }
    | undefined;
  const debtVoi = (Number(customer?.bottle_debt_voi) || 0) + borrowedVoi;
  const debtUp = (Number(customer?.bottle_debt_up) || 0) + borrowedUp;
  if (returnedVoi > debtVoi) {
    throw badRequest(`Khách chỉ đang giữ ${debtVoi} vỏ Vòi (kể cả số giao trong đơn) — không thể trả ${returnedVoi}`);
  }
  if (returnedUp > debtUp) {
    throw badRequest(`Khách chỉ đang giữ ${debtUp} vỏ Úp (kể cả số giao trong đơn) — không thể trả ${returnedUp}`);
  }
}

interface ItemRow {
  product_id: number;
  quantity: number;
  quantity_promo: number;
  bottle_type: string;
  deposit_fee: number;
}

function itemRows(db: Database.Database, orderId: number): ItemRow[] {
  return db
    .prepare(
      `SELECT oi.product_id, oi.quantity, oi.quantity_promo, p.bottle_type, p.deposit_fee
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    )
    .all(orderId) as ItemRow[];
}

// Số bình theo loại vỏ trên đơn (gồm cả hàng khuyến mãi). Phí cọc lấy từ danh mục "Cọc vỏ bình".
function bottleAmounts(items: ItemRow[]) {
  let borrowedVoi = 0;
  let borrowedUp = 0;
  for (const it of items) {
    const qty = Number(it.quantity) + Number(it.quantity_promo || 0);
    if (it.bottle_type === 'VOI') borrowedVoi += qty;
    if (it.bottle_type === 'UP') borrowedUp += qty;
  }
  return { borrowedVoi, borrowedUp };
}

// Phí vận chuyển theo tuyến: một nguồn duy nhất cho cả phí giao hàng và phí đi nhận hàng hoàn.
export function routeFeeFor(db: Database.Database, shippingFeeId: number | null | undefined, soldUnits: number): number {
  if (!shippingFeeId) return 0;
  const fee = db
    .prepare('SELECT fee_per_unit FROM shipping_fees WHERE id = ?')
    .get(shippingFeeId) as { fee_per_unit: number } | undefined;
  if (!fee) return 0;
  return (Number(fee.fee_per_unit) || 0) * soldUnits;
}

// Tính lại tiền hàng / phí ship / cọc / tổng tiền từ dòng hàng.
// Phí vận chuyển có MỘT nguồn duy nhất: tuyến đã chọn × số lượng sản phẩm bán.
// Hàng khuyến mãi vẫn xuất kho nhưng không làm tăng phí vận chuyển.
export function recalcTotals(db: Database.Database, orderId: number) {
  const row = db
    .prepare(
      `SELECT order_type, shipping_fee, shipping_fee_id, discount_amount, returned_shells_voi, returned_shells_up
       FROM orders WHERE id = ?`
    )
    .get(orderId) as {
    order_type: string;
    shipping_fee: number;
    shipping_fee_id: number | null;
    discount_amount: number;
    returned_shells_voi: number;
    returned_shells_up: number;
  };
  const subtotal = Number(
    (db.prepare('SELECT COALESCE(SUM(total_price),0) as s FROM order_items WHERE order_id = ?').get(orderId) as {
      s: number;
    }).s
  );
  const soldUnits = Number(
    (db.prepare('SELECT COALESCE(SUM(quantity),0) as q FROM order_items WHERE order_id = ?').get(orderId) as { q: number }).q
  );
  const shippingFee = !hasDeliveryShipper(db, orderId)
    ? 0
    : row.shipping_fee_id
      ? routeFeeFor(db, row.shipping_fee_id, soldUnits)
      : Number(row.shipping_fee) || 0;
  const discount = Number(row.discount_amount) || 0;
  if (!Number.isFinite(Number(row.discount_amount)) || discount < 0 ||
      (row.order_type === 'SALE' || row.order_type === 'BORROW_IN' ? discount > subtotal : discount !== 0)) {
    throw badRequest('Giảm giá phải từ 0 đến tiền hàng; đơn cho mượn và bốc xếp không giảm giá hàng');
  }
  const { borrowedVoi, borrowedUp } = bottleAmounts(itemRows(db, orderId));
  const { feeVoi, feeUp } = shellDepositFees(db);
  // Thu cọc theo số vỏ thực giao; phần vỏ khách trả dư được hoàn tiền ở bước hoàn tất đơn.
  const netVoi = borrowedVoi - (Number(row.returned_shells_voi) || 0);
  const netUp = borrowedUp - (Number(row.returned_shells_up) || 0);
  const deposit = Math.max(0, netVoi) * feeVoi + Math.max(0, netUp) * feeUp;
  // Miễn ship cho khách (cấu hình chung): khách chỉ trả tiền hàng, phí ship vẫn lưu (shipping_fee) để tính công giao hàng.
  const goodsTotal = row.order_type === 'LEND_OUT' || row.order_type === 'HIRED_LOAD' ? 0 : subtotal - discount;
  const total = goodsTotal + (freeShipForCustomer(db) ? 0 : shippingFee);
  db.prepare(
    `UPDATE orders SET subtotal_amount = ?, shipping_fee = ?, deposit_amount = ?, total_amount = ? WHERE id = ?`
  ).run(subtotal, shippingFee, deposit, total, orderId);
  return { subtotal, shippingFee, deposit, total };
}

export function clearPendingOrderTickets(db: Database.Database, orderId: number) {
  const tickets = db.prepare(`SELECT id, status FROM stock_tickets WHERE order_id = ? AND reason IN ('BORROW_IN', 'BORROW_DELIVER', 'LEND_OUT', 'ORDER_SALE')`)
    .all(orderId) as { id: number; status: string }[];
  for (const ticket of tickets) {
    if (ticket.status === 'CONFIRMED') throw badRequest('Phiếu xuất đã ghi sổ, không thể sửa hoặc gộp đơn');
    deleteTicket(db, ticket.id, true);
  }
}

// Xác nhận chỉ tạo phiếu chờ; không ghi sổ và không giữ tồn.
export function prepareOrderTickets(db: Database.Database, order: OrderRecord) {
  const existing = db.prepare(`SELECT COUNT(*) AS count FROM stock_tickets WHERE order_id = ? AND reason IN ('BORROW_IN', 'BORROW_DELIVER', 'LEND_OUT', 'ORDER_SALE')`)
    .get(order.id) as { count: number };
  if (existing.count) return;
  // Tách hàng bán / hàng khuyến mãi xuống phiếu kho để sổ kho đối soát được KM dùng cho đơn nào.
  const items = itemRows(db, order.id).map((it) => ({
    product_id: it.product_id,
    quantity: Number(it.quantity),
    quantity_promo: Number(it.quantity_promo || 0),
  }));
  const by = order.shipper_employee_id ?? order.seller_employee_id ?? null;

  if (order.order_type === 'BORROW_IN') {
    // Hàng mượn của đối tác: nhập vào kho ảo rồi xuất thẳng cho khách → kho vật lý không đổi.
    const virtualId = loanWarehouseId();
    createTicket(db, {
      ticketType: 'IN',
      ticketDate: order.order_date,
      warehouseId: virtualId,
      partnerUnitId: order.partner_unit_id,
      orderId: order.id,
      reason: 'BORROW_IN',
      movementType: 'BORROW_IN',
      note: `Nhập hàng mượn đối tác theo đơn ${order.order_code}`,
      createdBy: by,
      auto: true,
      items,
    });
    createTicket(db, {
      ticketType: 'OUT',
      ticketDate: order.order_date,
      warehouseId: virtualId,
      orderId: order.id,
      reason: 'BORROW_DELIVER',
      movementType: 'EXPORT_ORDER',
      note: `Xuất hàng mượn cho khách theo đơn ${order.order_code}`,
      createdBy: by,
      auto: true,
      items,
    });
  } else if (order.order_type !== 'HIRED_LOAD') {
    // Đơn bốc xếp: hàng của đơn vị thuê, không có bút toán kho nào của mình.
    const isLend = order.order_type === 'LEND_OUT';
    createTicket(db, {
      ticketType: 'OUT',
      ticketDate: order.order_date,
      warehouseId: order.warehouse_id,
      orderId: order.id,
      partnerUnitId: isLend ? order.partner_unit_id : null,
      reason: isLend ? 'LEND_OUT' : 'ORDER_SALE',
      movementType: isLend ? 'LOAN_OUT' : 'EXPORT_ORDER',
      note: isLend ? `Xuất cho mượn theo đơn ${order.order_code}` : `Xuất bán theo đơn ${order.order_code}`,
      createdBy: by,
      auto: true,
      items,
    });
  }
}

// --- Hiệu ứng kho khi GIAO HÀNG: kiểm tồn và ghi sổ phiếu chờ ---
export function applyShippingEffects(db: Database.Database, order: OrderRecord) {
  prepareOrderTickets(db, order); // tương thích đơn xác nhận trước khi có phiếu chờ
  const tickets = db.prepare(`SELECT id, reason FROM stock_tickets WHERE order_id = ? AND reason IN ('BORROW_IN', 'BORROW_DELIVER', 'LEND_OUT', 'ORDER_SALE') ORDER BY CASE WHEN reason = 'BORROW_IN' THEN 0 ELSE 1 END, id`)
    .all(order.id) as { id: number; reason: string }[];
  for (const ticket of tickets) postTicket(db, ticket.id);
  const by = order.shipper_employee_id ?? order.seller_employee_id ?? null;

  // Vỏ bình đi kèm hàng rời kho (đơn mượn vào / bốc xếp thì vỏ không phải của mình).
  if (order.order_type === 'SALE' || order.order_type === 'LEND_OUT') {
    const { borrowedVoi, borrowedUp } = bottleAmounts(itemRows(db, order.id));
    const shells: [BottleType, number][] = [
      ['VOI', borrowedVoi],
      ['UP', borrowedUp],
    ];
    for (const [bottleType, quantity] of shells) {
      if (!quantity) continue;
      recordShellMovement(db, {
        movementType: 'OUT',
        bottleType,
        quantity,
        orderId: order.id,
        performedBy: by,
        note:
          order.order_type === 'LEND_OUT'
            ? `Xuất vỏ cho đối tác mượn theo đơn ${order.order_code}`
            : `Xuất vỏ theo đơn ${order.order_code}`,
        movementDate: order.order_date,
      });
      // Đơn cho mượn: vỏ do đối tác đang giữ, theo dõi riêng để đòi lại.
      if (order.order_type === 'LEND_OUT' && order.partner_unit_id) {
        addPartnerShellMovement(db, {
          partnerUnitId: order.partner_unit_id,
          bottleType,
          quantity,
          orderId: order.id,
          note: `Đối tác nhận vỏ theo đơn cho mượn ${order.order_code}`,
        });
      }
    }
  }

  {
    const shippers = db.prepare("SELECT employee_id, allocated_fee FROM order_shippers WHERE order_id = ? AND COALESCE(kind, 'DELIVERY') = 'DELIVERY'").all(order.id) as {
      employee_id: number;
      allocated_fee: number;
    }[];
    const ins = db.prepare(
      `INSERT INTO delivery_dispatches
        (dispatch_code, order_id, shipper_employee_id, warehouse_id, shipping_fee, stair_carrying_allowance, status, note)
       VALUES (?, ?, ?, ?, ?, 0, 'ASSIGNED', ?)`
    );
    for (const s of shippers) {
      ins.run(dispatchCode(db, order.order_date), order.id, s.employee_id, order.warehouse_id, s.allocated_fee, `Điều phối giao đơn ${order.order_code}`);
    }
  }
}

export function reverseShippingEffects(db: Database.Database, order: OrderRecord) {
  // Đơn mượn: chỉ chạm kho ảo (net 0) → xóa các phiếu tự sinh của đơn.
  if (order.order_type === 'BORROW_IN') {
    for (const ticketId of ticketsOfOrder(db, order.id)) deleteTicket(db, ticketId, true);
    db.prepare('DELETE FROM delivery_dispatches WHERE order_id = ?').run(order.id);
    return;
  }
  // Đơn cho mượn đã được đối tác trả hàng thì kho đã nhập lại → không hoàn lần nữa.
  const alreadyReturned = order.loan_settled_at && order.loan_settle_type === 'RETURN_GOODS';
  if (!alreadyReturned && order.order_type !== 'HIRED_LOAD') {
    const isLend = order.order_type === 'LEND_OUT';
    createTicket(db, {
      ticketType: 'IN',
      ticketDate: order.order_date,
      warehouseId: order.warehouse_id,
      orderId: order.id,
      partnerUnitId: isLend ? order.partner_unit_id : null,
      reason: 'ORDER_CANCEL',
      movementType: isLend ? 'LOAN_IN' : 'IMPORT',
      note: `Hoàn kho do hủy đơn ${order.order_code}`,
      auto: true,
      status: 'CONFIRMED',
      items: itemRows(db, order.id).map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        quantity_promo: Number(it.quantity_promo || 0),
      })),
    });
  }
  // Vỏ quay lại kho cùng hàng hoàn về (đơn cho mượn: trừ luôn số vỏ đối tác đang giữ).
  if (order.order_type === 'SALE' || order.order_type === 'LEND_OUT') {
    const { borrowedVoi, borrowedUp } = bottleAmounts(itemRows(db, order.id));
    for (const [bottleType, quantity] of [
      ['VOI', borrowedVoi],
      ['UP', borrowedUp],
    ] as [BottleType, number][]) {
      if (!quantity) continue;
      recordShellMovement(db, {
        movementType: 'IN',
        bottleType,
        quantity,
        orderId: order.id,
        note: `Nhập lại vỏ do hủy đơn ${order.order_code}`,
        movementDate: order.order_date,
      });
      if (order.order_type === 'LEND_OUT' && order.partner_unit_id) {
        addPartnerShellMovement(db, {
          partnerUnitId: order.partner_unit_id,
          bottleType,
          quantity: -quantity,
          orderId: order.id,
          note: `Thu hồi vỏ do hủy đơn ${order.order_code}`,
        });
      }
    }
  }

  db.prepare('DELETE FROM delivery_dispatches WHERE order_id = ?').run(order.id);
}

// --- Hiệu ứng tài chính khi HOÀN TẤT ---

// Tiền công bốc xếp thu được, khớp với phiếu thu đã ghi ở trạng thái trước.
function postShippingRevenue(db: Database.Database, order: OrderRecord, label: string) {
  const collected = Math.min(Number(order.paid_amount) || 0, Number(order.shipping_fee) || 0);
  if (collected <= 0 || order.payment_method === 'DEBT') return;
  syncOrderCashLedger(db, order, collected, `${label} theo đơn ${order.order_code}`);
}

export function applyCompletionEffects(db: Database.Database, order: OrderRecord) {
  db.prepare(`UPDATE delivery_dispatches SET status = 'DELIVERED', completed_at = CURRENT_TIMESTAMP
    WHERE order_id = ? AND status IN ('ASSIGNED', 'IN_TRANSIT')`).run(order.id);
  // Chốt cuối: khách chỉ được trả số vỏ mình đang giữ (đã chặn ở bước xác nhận, kiểm lại trước khi ghi sổ).
  assertShellReturnAvailable(db, order);
  if (order.order_type === 'LEND_OUT') {
    postShippingRevenue(db, order, 'Thu phí giao đơn cho mượn');
    return;
  }
  // Đơn bốc xếp: hàng của đơn vị thuê → chỉ ghi tiền công bốc xếp/chuyên chở thu được.
  if (order.order_type === 'HIRED_LOAD') {
    postShippingRevenue(db, order, 'Thu tiền công bốc xếp');
    return;
  }

  const paid = Number(order.paid_amount) || 0;
  if (paid > 0 && order.payment_method !== 'DEBT') {
    syncOrderCashLedger(db, order, paid, `Thu tiền đơn ${order.order_code}`);
  }

  const deposit = Number(order.deposit_amount) || 0;
  if (deposit > 0) {
    db.prepare(
      `INSERT INTO deposit_transactions
        (transaction_code, transaction_type, customer_id, order_id, amount, payment_method, handled_by, transaction_date, note)
       VALUES (?, 'COLLECT', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nextCode(db, { table: 'deposit_transactions', column: 'transaction_code', prefix: `COC-${dateKey(order.order_date)}-`, width: 2 }),
      order.customer_id,
      order.id,
      deposit,
      order.payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
      order.shipper_employee_id ?? order.seller_employee_id,
      order.order_date,
      `Thu cọc vỏ theo đơn ${order.order_code}`
    );
  }

  const { borrowedVoi, borrowedUp } = bottleAmounts(itemRows(db, order.id));
  const returnedVoi = Number(order.returned_shells_voi) || 0;
  const returnedUp = Number(order.returned_shells_up) || 0;
  const { feeVoi, feeUp } = shellDepositFees(db);
  const customer = db.prepare('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?').get(order.customer_id) as
    | { bottle_debt_voi: number; bottle_debt_up: number }
    | undefined;
  const debtVoi = Number(customer?.bottle_debt_voi) || 0;
  const debtUp = Number(customer?.bottle_debt_up) || 0;
  // Vỏ khách trả vượt số giao (đổi loại vỏ hoặc trả vỏ của đơn cũ): chỉ hoàn cọc cho phần vỏ thực sự
  // đang nằm trong nợ vỏ của khách; phần trả vượt sổ không hoàn và được ghi rõ trong sổ vỏ.
  const excessVoi = Math.max(0, returnedVoi - borrowedVoi);
  const excessUp = Math.max(0, returnedUp - borrowedUp);
  const refundableVoi = Math.min(excessVoi, debtVoi);
  const refundableUp = Math.min(excessUp, debtUp);
  const excessRefund = refundableVoi * feeVoi + refundableUp * feeUp;
  const overBook = excessVoi - refundableVoi + (excessUp - refundableUp);
  if (excessRefund > 0) {
    refundShellDeposit(db, {
      customerId: order.customer_id,
      amount: excessRefund,
      date: order.order_date,
      orderId: order.id,
      note: `Hoàn cọc vỏ khách trả dư theo đơn ${order.order_code}`,
      handledBy: order.shipper_employee_id ?? order.seller_employee_id ?? null,
      paymentMethod: order.payment_method,
    });
  }

  if (borrowedVoi || borrowedUp || returnedVoi || returnedUp) {
    const newVoi = Math.max(0, debtVoi + borrowedVoi - returnedVoi);
    const newUp = Math.max(0, debtUp + borrowedUp - returnedUp);
    db.prepare('UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?').run(newVoi, newUp, order.customer_id);
    db.prepare(
      `INSERT INTO customer_bottle_ledgers
        (customer_id, order_id, transaction_date, borrowed_voi, borrowed_up, returned_voi, returned_up,
         remaining_balance_voi, remaining_balance_up, deposit_amount, refund_deposit_amount, handled_by, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      order.customer_id,
      order.id,
      order.order_date,
      borrowedVoi,
      borrowedUp,
      returnedVoi,
      returnedUp,
      newVoi,
      newUp,
      Number(order.deposit_amount) || 0,
      excessRefund,
      order.shipper_employee_id ?? order.seller_employee_id,
      `Giao hàng và đối soát vỏ bình theo đơn ${order.order_code}${overBook > 0 ? ` (vỏ trả vượt sổ: ${overBook} bình không hoàn cọc)` : ''}`
    );

    // Vỏ khách trả ngay khi giao hàng phải nhập lại pool vỏ của xí nghiệp và ghi sổ vỏ.
    // Thiếu bút toán này thì nợ vỏ của khách đã giảm mà số vỏ xí nghiệp đang giữ vẫn thiếu vĩnh viễn.
    const shellNote = `Thu hồi vỏ khi giao hàng theo đơn ${order.order_code}`;
    const handledBy = order.shipper_employee_id ?? order.seller_employee_id ?? null;
    if (returnedVoi) {
      recordShellMovement(db, {
        movementType: 'RETURN',
        bottleType: 'VOI',
        quantity: returnedVoi,
        customerId: order.customer_id,
        orderId: order.id,
        performedBy: handledBy,
        note: shellNote,
        movementDate: order.order_date,
      });
    }
    if (returnedUp) {
      recordShellMovement(db, {
        movementType: 'RETURN',
        bottleType: 'UP',
        quantity: returnedUp,
        customerId: order.customer_id,
        orderId: order.id,
        performedBy: handledBy,
        note: shellNote,
        movementDate: order.order_date,
      });
    }
  }
}

// --- HÀNG HOÀN: khách trả lại hàng của đơn đã hoàn tất ---
// Bản chất giống hủy đơn (đẩy hàng về kho + ghi bút toán) nhưng KHÁC ở chỗ:
// đơn vẫn được tính đủ doanh thu gộp và KPI/lương của nhân viên, chỉ trừ đi phần hàng hoàn.

export interface ReturnLineInput {
  order_item_id: number;
  quantity: number;
  quantity_promo: number;
}

export interface ReturnInput {
  returnDate: string;
  /** CUSTOMER_BRING = khách mang đến kho (miễn ship); STAFF_PICKUP = nhân viên đến lấy (tính ship như giao hàng). */
  pickupType: 'CUSTOMER_BRING' | 'STAFF_PICKUP';
  collectors: { employee_id: number }[];
  lines: ReturnLineInput[];
  shellsVoi: number;
  shellsUp: number;
  depositPaymentMethod: string;
  refundPaymentMethod: 'CASH' | 'BANK_TRANSFER';
  returnWarehouseId: number | null;
  note: string;
  createdBy: number | null;
}

export interface OrderReturnRow {
  id: number;
  order_id: number;
  return_date: string;
  ticket_id: number | null;
  shells_voi: number;
  shells_up: number;
  deposit_refund: number;
  returned_amount: number;
  refund_amount: number;
  refund_transaction_id: number | null;
  deposit_transaction_id: number | null;
  bottle_ledger_id: number | null;
  pickup_type: string;
  note: string | null;
}

/**
 * Ghi nhận hàng hoàn cho một đơn đã hoàn tất: nhập kho hàng hoàn, giảm doanh thu (suy ra từ phiếu hoàn),
 * giảm nợ vỏ + hoàn cọc, và phí đi nhận hàng hoàn nếu nhân viên đi lấy. Không đụng KPI/lương giao hàng.
 */
export function applyOrderReturn(db: Database.Database, order: OrderRecord, input: ReturnInput) {
  if (order.order_status !== 'COMPLETED') throw badRequest('Chỉ hoàn toàn bộ đơn đã hoàn tất một lần');
  if ((db.prepare('SELECT COUNT(*) AS count FROM order_returns WHERE order_id = ?').get(order.id) as { count: number }).count) {
    throw badRequest('Đơn đã hoàn hàng, không thể hoàn lần nữa');
  }
  const items = db
    .prepare('SELECT id, product_id, quantity, quantity_promo, unit_price FROM order_items WHERE order_id = ? ORDER BY id')
    .all(order.id) as { id: number; product_id: number; quantity: number; quantity_promo: number; unit_price: number }[];
  const byId = new Map(items.map((i) => [i.id, i]));

  const requested = new Map<number, { quantity: number; promo: number }>();
  for (const line of input.lines) {
    const id = Number(line.order_item_id);
    if (!byId.has(id)) throw badRequest(`Dòng hàng #${line.order_item_id} không thuộc đơn ${order.order_code}`);
    const quantity = Number(line.quantity) || 0;
    const promo = Number(line.quantity_promo) || 0;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(promo) || promo < 0) {
      throw badRequest('Số lượng hàng hoàn phải là số nguyên không âm');
    }
    const previous = requested.get(id) ?? { quantity: 0, promo: 0 };
    requested.set(id, { quantity: previous.quantity + quantity, promo: previous.promo + promo });
  }
  const lines = [...requested.entries()]
    .map(([id, returned]) => {
      const item = byId.get(id)!;
      const { quantity, promo } = returned;
      if (quantity !== item.quantity || promo !== (Number(item.quantity_promo) || 0)) {
        throw badRequest('Phải hoàn toàn bộ hàng bán và hàng khuyến mãi của từng dòng');
      }
      return { item, quantity, promo };
    })
    .filter((line) => line.quantity > 0 || line.promo > 0);
  if (lines.length !== items.length) throw badRequest('Phải hoàn toàn bộ các dòng của đơn trong một lần');

  // Doanh thu giảm đúng bằng số lượng hoàn × giá đã bán; hàng khuyến mãi trả lại chỉ nhập kho, không giảm doanh thu.
  const grossGoods = Number(order.subtotal_amount) || 0;
  const netGoods = Math.max(0, grossGoods - (Number(order.discount_amount) || 0));
  const totalReturnedValue = netGoods;
  const returnedValue = netGoods;
  // Phí đi nhận hàng hoàn chỉ tính theo số sản phẩm bán, không tính hàng khuyến mãi.
  const soldUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

  let returnWarehouseId = order.warehouse_id;
  if (order.order_type === 'BORROW_IN') {
    const warehouse = db.prepare('SELECT id FROM warehouses WHERE id = ? AND type NOT IN (\'VIRTUAL\', \'CUSTOMER\') AND is_active = 1')
      .get(input.returnWarehouseId) as { id: number } | undefined;
    if (!warehouse) throw badRequest('Chọn kho thực nhận hàng khách trả của đơn mượn');
    returnWarehouseId = warehouse.id;
  }

  const ticket = createTicket(db, {
    ticketType: 'IN',
    ticketDate: input.returnDate,
    warehouseId: returnWarehouseId,
    orderId: order.id,
    reason: 'ORDER_RETURN',
    movementType: 'RETURN_IN',
    note: `Hàng hoàn theo đơn ${order.order_code}`,
    auto: true,
    status: 'CONFIRMED',
    items: lines.map((line) => ({
      product_id: line.item.product_id,
      orderItemId: line.item.id,
      quantity: line.quantity,
      quantity_promo: line.promo,
    })),
  });

  // Vỏ thu hồi: dùng chung cơ chế thu hồi vỏ (giảm nợ vỏ + ghi sổ vỏ + hoàn cọc theo đúng loại vỏ).
  const shellsVoi = Math.max(0, Math.floor(Number(input.shellsVoi) || 0));
  const shellsUp = Math.max(0, Math.floor(Number(input.shellsUp) || 0));
  const shellReturn =
    shellsVoi || shellsUp
      ? returnCustomerShells(db, {
          customerId: order.customer_id,
          shellsVoi,
          shellsUp,
          date: input.returnDate,
          orderId: order.id,
          note: `Thu hồi vỏ hàng hoàn theo đơn ${order.order_code}`,
          handledBy: input.createdBy ?? order.shipper_employee_id ?? null,
          paymentMethod: input.depositPaymentMethod,
        })
      : null;
  const bottleLedgerId = shellReturn?.ledgerId ?? null;
  const depositTransactionId = shellReturn?.depositTransactionId ?? null;
  const depositRefund = shellReturn?.refundAmount ?? 0;

  // Phí giao ban đầu vẫn phải thu. Phần tiền hàng đã thu vượt số phải trả sau hoàn hàng được hoàn ngay.
  const payable = Math.max(0, (Number(order.total_amount) || 0) - totalReturnedValue);
  const previousRefunds = db.prepare('SELECT COALESCE(SUM(refund_amount), 0) AS amount FROM order_returns WHERE order_id = ?')
    .get(order.id) as { amount: number };
  const refundAmount = Math.max(0, Math.round((Number(order.paid_amount) || 0) - Number(previousRefunds.amount || 0) - payable));
  let refundTransactionId: number | null = null;
  if (refundAmount > 0) {
    const code = nextCode(db, { table: 'revenue_transactions', column: 'transaction_code', prefix: `HT-${dateKey(input.returnDate)}-`, width: 3 });
    const result = db.prepare(
      `INSERT INTO revenue_transactions
        (transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note)
       VALUES (?, 'SALE_REFUND', ?, ?, ?, ?, ?, ?, ?)`
    ).run(code, order.id, order.customer_id, -refundAmount, input.refundPaymentMethod, input.createdBy, input.returnDate,
      `Hoàn tiền hàng trả theo đơn ${order.order_code}`);
    refundTransactionId = Number(result.lastInsertRowid);
  }
  const netPaid = (Number(order.paid_amount) || 0) - Number(previousRefunds.amount || 0) - refundAmount;
  db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?')
    .run(paymentStatus(netPaid, payable), order.id);

  // Nhân viên đến lấy hàng hoàn thì được tính phí y như một chuyến giao hàng (chia đều cho người đi nhận).
  if (input.pickupType === 'STAFF_PICKUP' && input.collectors.length) {
    const fee = routeFeeFor(db, order.shipping_fee_id, soldUnits);
    const base = Math.floor(fee / input.collectors.length);
    const remainder = fee - base * input.collectors.length;
    const insert = db.prepare(
      `INSERT INTO order_shippers (order_id, employee_id, allocated_fee, kind, note) VALUES (?, ?, ?, 'RETURN', ?)`
    );
    input.collectors.forEach((collector, index) => {
      insert.run(order.id, Number(collector.employee_id), base + (index < remainder ? 1 : 0), `Đi nhận hàng hoàn đơn ${order.order_code}`);
    });
  }

  const record = db
    .prepare(
      `INSERT INTO order_returns
        (order_id, return_date, ticket_id, shells_voi, shells_up, deposit_refund, returned_amount, refund_amount, refund_transaction_id, deposit_transaction_id, bottle_ledger_id, pickup_type, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      order.id,
      input.returnDate,
      ticket.id,
      shellsVoi,
      shellsUp,
      depositRefund,
      returnedValue,
      refundAmount,
      refundTransactionId,
      depositTransactionId,
      bottleLedgerId,
      input.pickupType,
      input.note
    );

  db.prepare("UPDATE orders SET order_status = 'RETURNED' WHERE id = ?").run(order.id);

  return {
    returnId: Number(record.lastInsertRowid),
    ticketCode: ticket.code,
    returnedValue,
    refundAmount,
    depositRefund,
    shellsVoi,
    shellsUp,
    soldUnits,
  };
}

// Chạy hiệu ứng tương ứng khi vào trạng thái mới.
export function applyStatusEffects(db: Database.Database, order: OrderRecord, to: OrderStatus) {
  if (to === 'CONFIRMED') prepareOrderTickets(db, order);
  else if (to === 'SHIPPING') applyShippingEffects(db, order);
  else if (to === 'COMPLETED') applyCompletionEffects(db, order);
}

// Hủy đơn: chỉ đơn đã xuất kho (SHIPPING) mới cần hoàn kho. Đơn Hoàn tất là trạng thái cuối.
export function cancelOrder(db: Database.Database, order: OrderRecord) {
  if ((order.order_type === 'LEND_OUT' || order.order_type === 'BORROW_IN') &&
      (db.prepare('SELECT COUNT(*) AS count FROM loan_settlements WHERE order_id = ?').get(order.id) as { count: number }).count) {
    throw badRequest('Đơn mượn đã có phiếu trả hàng; không thể hủy đơn và hoàn kho lần nữa');
  }
  if (order.order_status === 'SHIPPING') reverseShippingEffects(db, order);
  if (order.order_status === 'CONFIRMED') clearPendingOrderTickets(db, order.id);
  syncOrderCashLedger(db, order, 0, `Hoàn tiền do hủy đơn ${order.order_code}`);
  db.prepare("UPDATE orders SET paid_amount = 0, payment_status = 'UNPAID' WHERE id = ?").run(order.id);
  db.prepare(`UPDATE orders SET order_status = 'CANCELLED' WHERE id = ?`).run(order.id);
}

// Xóa đơn chỉ hợp lệ khi đơn chưa để lại dấu vết nào trong sổ sách.
export function assertOrderDeletable(db: Database.Database, order: OrderRecord) {
  // Đơn đã rời kho thì cấm xóa thẳng — sổ kho/doanh thu đã ghi, chỉ có thể hủy (và hoàn tất là trạng thái cuối).
  if (order.order_status === 'SHIPPING') {
    throw badRequest(`Đơn ${order.order_code} đang giao — không xóa được. Khách không nhận thì dùng "Hủy đơn" để hoàn kho.`);
  }
  if (order.order_status === 'COMPLETED') {
    throw badRequest(`Đơn ${order.order_code} đã hoàn tất — trạng thái cuối, không xóa được.`);
  }
  if (order.order_status === 'RETURNED') {
    throw badRequest(`Đơn ${order.order_code} đã ghi nhận hàng hoàn — trạng thái cuối, không xóa được.`);
  }

  const row = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM stock_tickets WHERE order_id = ?) AS tickets,
              (SELECT COUNT(*) FROM revenue_transactions WHERE order_id = ?) AS revenue,
              (SELECT COUNT(*) FROM deposit_transactions WHERE order_id = ?) AS deposits,
              (SELECT COUNT(*) FROM customer_bottle_ledgers WHERE order_id = ?) AS bottles,
              (SELECT COUNT(*) FROM invoices WHERE order_id = ?) AS invoices`
    )
    .get(order.id, order.id, order.id, order.id, order.id) as {
    tickets: number;
    revenue: number;
    deposits: number;
    bottles: number;
    invoices: number;
  };
  if (row.tickets || row.revenue || row.deposits || row.bottles || row.invoices) {
    throw badRequest(`Đơn ${order.order_code} đã phát sinh bút toán kho / doanh thu / cọc / hóa đơn — không xóa được, hãy dùng "Hủy đơn".`);
  }
  if (order.merged_into_id) throw badRequest(`Đơn ${order.order_code} đã được gộp vào đơn khác — không xóa được.`);
  const merged = db.prepare('SELECT COUNT(*) AS c FROM order_merge_sources WHERE target_order_id = ?').get(order.id) as {
    c: number;
  };
  if (merged.c) throw badRequest(`Đơn ${order.order_code} là đơn gộp của ${merged.c} đơn khác — không xóa được.`);
}

// Xóa hẳn đơn chưa phát sinh sổ sách. Dòng hàng / người giao tự xóa theo (ON DELETE CASCADE).
export function deleteOrder(db: Database.Database, id: number) {
  const order = getOrder(db, id);
  if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
  assertOrderDeletable(db, order);
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

// Chuyển trạng thái một đơn — dùng chung cho đơn lẻ, hàng loạt và nhập Excel.
export function changeStatus(db: Database.Database, id: number, to: OrderStatus) {
  const order = getOrder(db, id);
  if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
  if (to === 'RETURNED') {
    throw badRequest('Dùng chức năng "Hàng hoàn" trên đơn để ghi nhận số lượng hàng hoàn');
  }
  if (order.order_status === 'CANCELLED' && to === 'CANCELLED') return;
  assertTransition(order.order_status, to);

  db.transaction(() => {
    if (to === 'CONFIRMED') validateForConfirm(db, order);
    if (to === 'CANCELLED') {
      cancelOrder(db, order);
      return;
    }
    applyStatusEffects(db, order, to);
    db.prepare('UPDATE orders SET order_status = ? WHERE id = ?').run(to, id);
  })();
}
