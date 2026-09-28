import Database from 'better-sqlite3';
import { loanWarehouseId } from '../db.js';
import { orderCode, today } from './codes.js';
import { badRequest } from './http.js';
import { assertPhysicalOrderWarehouse, getOrder, paymentStatus, recalcTotals, shipperRequired, syncOrderCashLedger } from './orderStatus.js';

export interface RawItem {
  product_id: number;
  quantity: number;
  quantity_promo?: number;
  unit_price?: number;
  note?: string;
}

export interface ShipperInput {
  employee_id: number;
  allocated_fee: number;
}

const ORDER_TYPES = ['SALE', 'LEND_OUT', 'BORROW_IN', 'HIRED_LOAD'] as const;

// Chỉ tiêu mà đơn được tính vào: của Công ty hay của Xí nghiệp.
const TARGET_SCOPES = ['COMPANY', 'ENTERPRISE'] as const;

export function normalizeShippers(body: Record<string, unknown>, shippingFee: number): ShipperInput[] {
  const raw = Array.isArray(body.shippers) ? (body.shippers as Record<string, unknown>[]) : [];
  let shippers: ShipperInput[] = [];
  let unspecifiedIds = new Set<number>();
  if (raw.length) {
    shippers = raw.map((s) => {
      const employee_id = Number(s.employee_id);
      // 0 is the importer's marker for automatic allocation (and is also sent by the order form).
      const missing = s.allocated_fee === undefined || s.allocated_fee === null || s.allocated_fee === '' || s.allocated_fee === 0 || s.allocated_fee === '0';
      if (missing) unspecifiedIds.add(employee_id);
      return { employee_id, allocated_fee: missing ? 0 : Number(s.allocated_fee) };
    });
  } else if (body.shipper_employee_id) {
    const employee_id = Number(body.shipper_employee_id);
    shippers = [{ employee_id, allocated_fee: 0 }];
    unspecifiedIds = new Set([employee_id]);
  }
  if (!shippers.length) return shippers;
  if (!Number.isFinite(shippingFee) || shippingFee < 0) throw badRequest('Phí vận chuyển không hợp lệ');
  const seen = new Set<number>();
  for (const shipper of shippers) {
    if (!Number.isSafeInteger(shipper.employee_id) || shipper.employee_id <= 0 || seen.has(shipper.employee_id)) {
      throw badRequest('Nhân viên vận chuyển không hợp lệ hoặc bị lặp');
    }
    if (!Number.isSafeInteger(shipper.allocated_fee) || shipper.allocated_fee < 0) throw badRequest('Phí phân bổ không hợp lệ');
    seen.add(shipper.employee_id);
  }
  const unspecified = shippers.filter((s) => unspecifiedIds.has(s.employee_id));
  const specified = shippers.reduce((a, s) => a + s.allocated_fee, 0);
  if (specified > shippingFee + 0.5) throw badRequest('Tổng phí phân bổ vượt phí vận chuyển của đơn');
  if (unspecified.length) {
    const rest = Math.round(shippingFee - specified);
    const base = Math.floor(rest / unspecified.length);
    let rem = rest - base * unspecified.length;
    for (const s of shippers) {
      if (unspecifiedIds.has(s.employee_id)) {
        s.allocated_fee = base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
      }
    }
  }
  if (Math.abs(shippers.reduce((sum, s) => sum + s.allocated_fee, 0) - shippingFee) > 0.5) {
    throw badRequest('Tổng phí phân bổ phải bằng phí vận chuyển của đơn');
  }
  return shippers;
}

export function insertItems(db: Database.Database, orderId: number, items: RawItem[], orderType = 'SALE') {
  const stmt = db.prepare(
    `INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of items) {
    const product = db
      .prepare(`SELECT id, name, standard_price, deposit_fee, product_type FROM products WHERE id = ?`)
      .get(Number(item.product_id)) as
      | { id: number; name: string; standard_price: number; product_type: string }
      | undefined;
    if (!product) throw badRequest(`Không tìm thấy sản phẩm #${item.product_id}`);
    if (product.product_type === 'SERVICE') {
      throw badRequest(`"${product.name}" là dịch vụ — không thể lên đơn hàng, hãy tạo yêu cầu dịch vụ`);
    }
    const quantity = Number(item.quantity) || 0;
    const promo = Number(item.quantity_promo) || 0;
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw badRequest(`Số lượng của "${product.name}" phải là số nguyên lớn hơn 0`);
    if (!Number.isSafeInteger(promo) || promo < 0) throw badRequest(`Số lượng khuyến mãi của "${product.name}" không hợp lệ`);
    // Đơn bốc xếp: hàng của đơn vị thuê, chỉ ghi số lượng để tính phí và đối chiếu — không có giá trị hàng của mình.
    const unitPrice = orderType === 'HIRED_LOAD' ? 0 : item.unit_price !== undefined ? Number(item.unit_price) : product.standard_price;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest(`Đơn giá của "${product.name}" phải là số không âm`);
    stmt.run(orderId, product.id, quantity, promo, unitPrice, quantity * unitPrice, item.note ?? '');
  }
}

// Chỉ thay phân bổ phí GIAO HÀNG; phí đi nhận hàng hoàn (kind = 'RETURN') giữ nguyên.
export function replaceShippers(db: Database.Database, orderId: number, shippers: ShipperInput[]) {
  db.prepare(`DELETE FROM order_shippers WHERE order_id = ? AND COALESCE(kind, 'DELIVERY') = 'DELIVERY'`).run(orderId);
  const stmt = db.prepare(`INSERT INTO order_shippers (order_id, employee_id, allocated_fee) VALUES (?, ?, ?)`);
  for (const s of shippers) stmt.run(orderId, s.employee_id, s.allocated_fee);
}

export function resolveOrderType(body: Record<string, unknown>): (typeof ORDER_TYPES)[number] {
  const t = body.order_type;
  if (t === undefined || t === null || t === '') return 'SALE';
  if (!ORDER_TYPES.includes(t as never)) throw badRequest('Loại đơn hàng không hợp lệ');
  return t as (typeof ORDER_TYPES)[number];
}

export function resolveTargetScope(body: Record<string, unknown>): (typeof TARGET_SCOPES)[number] {
  const s = body.target_scope;
  if (s === undefined || s === null || s === '') return 'ENTERPRISE';
  if (!TARGET_SCOPES.includes(s as never)) throw badRequest('Nguồn chỉ tiêu không hợp lệ');
  return s as (typeof TARGET_SCOPES)[number];
}

export interface CreateOrderResult {
  success: true;
  orderId: number;
  orderCode: string;
  total: number;
  status: 'DRAFT';
}

// Tạo đơn ở trạng thái NHÁP — chưa tác động kho/doanh thu. Dùng chung cho API và nhập Excel.
export function createOrder(db: Database.Database, body: Record<string, unknown>): CreateOrderResult {
  const orderType = resolveOrderType(body);
  const targetScope = resolveTargetScope(body);
  const isBorrow = orderType === 'BORROW_IN';
  // Đơn bốc xếp: hàng của đơn vị thuê nên không dùng kho của mình (điểm lấy hàng là kho đối tác).
  const isHired = orderType === 'HIRED_LOAD';
  const partnerUnitId = body.partner_unit_id ? Number(body.partner_unit_id) : null;
  if (!body.customer_id) throw badRequest('Khách hàng là bắt buộc');
  if (orderType !== 'SALE' && !partnerUnitId) {
    throw badRequest('Đối tác liên kết là bắt buộc với đơn mượn / cho mượn / bốc xếp');
  }
  if (!isBorrow && !isHired && !body.warehouse_id) throw badRequest('Kho xuất hàng là bắt buộc');
  if (!isBorrow && !isHired) assertPhysicalOrderWarehouse(db, orderType, Number(body.warehouse_id));

  const orderDate = String(body.order_date || today());
  const items = Array.isArray(body.items) ? (body.items as RawItem[]) : [];
  const shippingFee = Number(body.shipping_fee) || 0;
  const feeHint = Math.max(shippingFee, Array.isArray(body.shippers)
    ? (body.shippers as Record<string, unknown>[]).reduce((sum, s) => sum + Math.max(0, Number(s.allocated_fee) || 0), 0)
    : 0);
  const shippers = normalizeShippers(body, feeHint);
  // Đơn miễn ship mới được để trống người giao; còn lại phải chọn ngay khi lưu đơn.
  if (shipperRequired(db, orderType) && !shippers.length) throw badRequest('Chọn nhân viên vận chuyển cho đơn hàng');

  return db.transaction(() => {
    const warehouseId = isBorrow || isHired ? loanWarehouseId() : Number(body.warehouse_id);
    const code = orderCode(db, orderDate);
    const insert = db
      .prepare(
        `INSERT INTO orders (
          order_code, customer_id, seller_employee_id, order_type, partner_unit_id, target_scope, shipper_employee_id, warehouse_id,
          order_date, delivery_date, order_status, payment_status, payment_method,
          is_vat_invoice, vat_rate, vat_number, company_name_vat, tax_code_vat, address_vat,
          personal_id_vat, budget_relation_code_vat,
          subtotal_amount, shipping_fee, discount_amount, deposit_amount, total_amount, paid_amount,
          shipping_receiver, shipping_phone, shipping_address, shipping_note, shipping_fee_id,
          returned_shells_voi, returned_shells_up, invoice_status, loan_due_date, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, 'NOT_INVOICED', ?, ?)`
      )
      .run(
        code,
        Number(body.customer_id),
        orderType === 'LEND_OUT' || isHired || !body.seller_employee_id ? null : Number(body.seller_employee_id),
        orderType,
        partnerUnitId,
        targetScope,
        shippers[0]?.employee_id ?? null,
        warehouseId,
        orderDate,
        body.delivery_date || orderDate,
        body.payment_status || 'UNPAID',
        body.payment_method || 'CASH',
        body.is_vat_invoice ? 1 : 0,
        Number(body.vat_rate) || 0,
        body.vat_number || null,
        body.company_name_vat || null,
        body.tax_code_vat || null,
        body.address_vat || null,
        body.personal_id_vat || null,
        body.budget_relation_code_vat || null,
        shippingFee,
        Number(body.discount_amount) || 0,
        body.shipping_receiver || null,
        body.shipping_phone || null,
        body.shipping_address || null,
        body.shipping_note || null,
        body.shipping_fee_id ? Number(body.shipping_fee_id) : null,
        Number(body.returned_shells_voi) || 0,
        Number(body.returned_shells_up) || 0,
        orderType !== 'SALE' && !isHired && body.loan_due_date ? String(body.loan_due_date) : null,
        body.note || ''
      );
    const orderId = Number(insert.lastInsertRowid);

    insertItems(db, orderId, items, orderType);
    replaceShippers(db, orderId, shippers);
    const totals = recalcTotals(db, orderId);
    // Phí vận chuyển lấy chuẩn từ tuyến → chia lại phần phí cho người giao theo đúng số phí đó.
    if (shippers.length) {
      const reallocated = normalizeShippers(body, totals.shippingFee);
      replaceShippers(db, orderId, reallocated);
      db.prepare('UPDATE orders SET shipper_employee_id = ? WHERE id = ?').run(reallocated[0]?.employee_id ?? null, orderId);
    }

    const requestedPaymentStatus = String(body.payment_status || 'UNPAID');
    const collectible = orderType === 'LEND_OUT' || isHired ? totals.shippingFee : totals.total;
    const paidAmount =
      requestedPaymentStatus === 'PAID' ? collectible : requestedPaymentStatus === 'UNPAID' ? 0 : Number(body.paid_amount) || 0;
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > collectible + 0.5) {
      throw badRequest('Số tiền đã thu vượt số phải thanh toán của đơn');
    }
    if (body.payment_method === 'DEBT' && paidAmount > 0) {
      throw badRequest('Đơn ghi nợ chưa có phiếu thu không được đánh dấu đã thanh toán');
    }
    db.prepare('UPDATE orders SET paid_amount = ?, payment_status = ? WHERE id = ?')
      .run(paidAmount, paymentStatus(paidAmount, collectible), orderId);
    if (paidAmount > 0) syncOrderCashLedger(db, getOrder(db, orderId)!, paidAmount, `Thu trước tiền đơn ${code}`);

    return { success: true as const, orderId, orderCode: code, total: totals.total, status: 'DRAFT' as const };
  })();
}
