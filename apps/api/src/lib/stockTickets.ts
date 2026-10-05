import Database from 'better-sqlite3';
import { dateKey, nextCode } from './codes.js';
import { badRequest } from './http.js';
import { promotionQuantityFor } from './promotions.js';
import { applyStockDelta, getStockQuantity, recordMovement, type MovementType } from './stock.js';

export type TicketType = 'IN' | 'OUT' | 'TRANSFER';
export type TicketStatus = 'DRAFT' | 'CHECKING' | 'CONFIRMED';

// Nháp → Kiểm tra hàng → Xác nhận. Bút toán kho chỉ sinh khi XÁC NHẬN.
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  DRAFT: ['CHECKING', 'CONFIRMED'],
  CHECKING: ['CONFIRMED'],
  CONFIRMED: [],
};

export interface TicketItemInput {
  product_id: number;
  quantity: number;
  quantity_promo?: number;
  quality?: string | null;
  note?: string;
  /** Dòng hàng gốc của đơn — dùng cho phiếu hàng hoàn để lấy đúng giá đã bán. */
  orderItemId?: number | null;
}

export interface TicketHeaderInput {
  ticketType: TicketType;
  ticketDate: string;
  warehouseId: number;
  targetWarehouseId?: number | null;
  partnerUnitId?: number | null;
  sourceId?: number | null;
  orderId?: number | null;
  reason: string;
  checkNote?: string | null;
  vehicle?: string | null;
  inChargeEmployeeId?: number | null;
  note?: string;
  createdBy?: number | null;
  auto?: boolean;
  items: TicketItemInput[];
}

export interface CreateTicketInput extends TicketHeaderInput {
  /** 'CONFIRMED' = ghi sổ ngay (dùng cho phiếu tự sinh từ đơn hàng). */
  status?: TicketStatus;
  movementType?: MovementType;
}

// Loại nghiệp vụ → loại bút toán kho tương ứng.
const REASON_MOVEMENT: Record<string, MovementType> = {
  PARENT_RECEIVE: 'IMPORT',
  PARTNER_RETURN: 'LOAN_IN',
  ORDER_CANCEL: 'IMPORT',
  ORDER_RETURN: 'RETURN_IN',
  BORROW_IN: 'BORROW_IN',
  TRANSFER_IN: 'TRANSFER_IN',
  ADJUST_IN: 'ADJUSTMENT',
  OTHER_IN: 'IMPORT',
  ORDER_SALE: 'EXPORT_ORDER',
  LEND_OUT: 'LOAN_OUT',
  BORROW_DELIVER: 'EXPORT_ORDER',
  RETURN_BORROW: 'BORROW_OUT',
  TRANSFER_OUT: 'TRANSFER_OUT',
  ADJUST_OUT: 'ADJUSTMENT',
  WRITE_OFF: 'ADJUSTMENT',
  OTHER_OUT: 'EXPORT_ORDER',
};

// Phiếu gắn đơn mượn / đơn bán chỉ tạo qua quy trình đơn hoặc tất toán mượn để nợ hàng luôn khớp kho.
export const IN_REASONS = ['PARENT_RECEIVE', 'TRANSFER_IN', 'ADJUST_IN', 'OTHER_IN'];
export const OUT_REASONS = ['WRITE_OFF', 'ADJUST_OUT', 'OTHER_OUT'];

// Chỉ phiếu giao/nhận lập tay được hưởng khuyến mãi; phiếu điều chỉnh và phiếu tự sinh giữ nguyên số thực tế.
const PROMOTION_REASONS: Record<TicketType, string[]> = {
  IN: ['PARENT_RECEIVE', 'TRANSFER_IN', 'OTHER_IN'],
  OUT: ['OTHER_OUT'],
  TRANSFER: ['TRANSFER'],
};

export function assertTicketTransition(from: string, to: TicketStatus) {
  const allowed = TICKET_TRANSITIONS[from as TicketStatus] ?? [];
  if (!allowed.includes(to)) throw badRequest(`Không thể chuyển phiếu từ "${from}" sang "${to}"`);
}

function validItems(items: TicketItemInput[]) {
  const clean = (items ?? []).map((i) => ({
      product_id: Number(i.product_id),
      orderItemId: i.orderItemId ? Number(i.orderItemId) : null,
      quantity: Number(i.quantity) || 0,
      quantity_promo: Number(i.quantity_promo) || 0,
      quality: i.quality === 'OK' || i.quality === 'NG' ? i.quality : null,
      note: i.note ?? '',
    }));
  for (const item of clean) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 ||
        !Number.isSafeInteger(item.quantity_promo) || item.quantity_promo < 0) {
      throw badRequest('Số lượng hàng và khuyến mãi trên phiếu phải là số nguyên không âm');
    }
  }
  const nonempty = clean.filter((i) => i.product_id && (i.quantity > 0 || i.quantity_promo > 0));
  if (!nonempty.length) throw badRequest('Phiếu phải có ít nhất một mặt hàng với số lượng > 0');
  return nonempty;
}

function withManualTicketPromotions(db: Database.Database, items: ReturnType<typeof validItems>,
  ticketType: TicketType, reason: string, ticketDate: string, auto: boolean, orderId?: number | null) {
  if (auto || orderId) return items;
  if (!PROMOTION_REASONS[ticketType].includes(reason)) {
    if (items.some((item) => item.quantity_promo > 0)) {
      throw badRequest('Phiếu điều chỉnh, hủy hoặc hoàn trả không được có hàng khuyến mãi');
    }
    return items;
  }
  const byProduct = new Map<number, typeof items>();
  for (const item of items) {
    const group = byProduct.get(item.product_id) ?? [];
    group.push(item);
    byProduct.set(item.product_id, group);
  }
  const productQuery = db.prepare('SELECT name, category_id FROM products WHERE id = ?');
  for (const [productId, group] of byProduct) {
    const product = productQuery.get(productId) as { name: string; category_id: number | null } | undefined;
    if (!product) throw badRequest(`Không tìm thấy sản phẩm #${productId}`);
    const purchased = group.reduce((sum, item) => sum + item.quantity, 0);
    const entitled = promotionQuantityFor(db, productId, product.category_id, ticketDate, purchased);
    const requested = group.reduce((sum, item) => sum + item.quantity_promo, 0);
    if (requested > entitled) throw badRequest(`Số lượng khuyến mãi của "${product.name}" vượt điều kiện chương trình`);
    group.forEach((item, index) => { item.quantity_promo = index === 0 ? entitled : 0; });
  }
  return items;
}

function assertHeader(db: Database.Database, input: TicketHeaderInput) {
  if (!Number(input.warehouseId)) throw badRequest('Thiếu kho xuất/nhập');
  if (input.ticketType === 'TRANSFER') {
    if (!input.targetWarehouseId) throw badRequest('Thiếu kho nhận điều chuyển');
    if (Number(input.targetWarehouseId) === Number(input.warehouseId)) throw badRequest('Kho xuất và kho nhận phải khác nhau');
    // Hàng thật chỉ nằm ở kho thật: chuyển vào kho ảo (trung chuyển/mượn) hay nút "Khách hàng" sẽ đẩy
    // hàng sang nơi báo cáo đối soát không nhìn tới, gây lệch không thể tìm ra.
    const whType = db.prepare('SELECT type FROM warehouses WHERE id = ?');
    for (const id of [Number(input.warehouseId), Number(input.targetWarehouseId)]) {
      const wh = whType.get(id) as { type: string } | undefined;
      if (!wh) throw badRequest('Kho không tồn tại');
      if (!['CENTRAL', 'STORE', 'VEHICLE', 'STATION'].includes(wh.type)) {
        throw badRequest('Điều chuyển kho chỉ áp dụng cho kho chứa hàng thật (kho trung tâm, cửa hàng, xe, trạm)');
      }
    }
  }
}

interface TicketRow {
  id: number;
  code: string;
  ticket_type: TicketType;
  ticket_date: string;
  status: TicketStatus;
  warehouse_id: number;
  target_warehouse_id: number | null;
  order_id: number | null;
  reason: string;
  note: string | null;
  created_by: number | null;
  auto: number;
}

export function getTicket(db: Database.Database, id: number): TicketRow | undefined {
  return db.prepare('SELECT * FROM stock_tickets WHERE id = ?').get(id) as TicketRow | undefined;
}

function replaceItems(db: Database.Database, ticketId: number, items: TicketItemInput[]) {
  db.prepare('DELETE FROM stock_ticket_items WHERE ticket_id = ?').run(ticketId);
  const stmt = db.prepare(
    'INSERT INTO stock_ticket_items (ticket_id, product_id, order_item_id, quantity, quantity_promo, quality, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const it of items)
    stmt.run(ticketId, it.product_id, it.orderItemId ?? null, it.quantity, it.quantity_promo ?? 0, it.quality ?? null, it.note ?? '');
}

// Tạo phiếu. Mặc định là NHÁP (chưa sinh bút toán); status 'CONFIRMED' thì ghi sổ ngay.
export function createTicket(db: Database.Database, input: CreateTicketInput): { id: number; code: string } {
  const items = withManualTicketPromotions(db, validItems(input.items), input.ticketType,
    input.reason, input.ticketDate, !!input.auto, input.orderId);
  assertHeader(db, input);
  const status: TicketStatus = input.status ?? 'DRAFT';

  const prefix = input.ticketType === 'IN' ? 'PN' : input.ticketType === 'OUT' ? 'PX' : 'PDC';
  const code = nextCode(db, {
    table: 'stock_tickets',
    column: 'code',
    prefix: `${prefix}-${dateKey(input.ticketDate)}-`,
    width: 2,
  });

  const insert = db
    .prepare(
      `INSERT INTO stock_tickets
        (code, ticket_type, ticket_date, warehouse_id, target_warehouse_id, partner_unit_id, source_id, order_id, reason, status, check_note, vehicle, in_charge_employee_id, note, created_by, auto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      code,
      input.ticketType,
      input.ticketDate,
      Number(input.warehouseId),
      input.targetWarehouseId ? Number(input.targetWarehouseId) : null,
      input.partnerUnitId ? Number(input.partnerUnitId) : null,
      input.sourceId ? Number(input.sourceId) : null,
      input.orderId ? Number(input.orderId) : null,
      input.reason,
      'DRAFT',
      input.checkNote ?? null,
      input.vehicle ?? null,
      input.inChargeEmployeeId ? Number(input.inChargeEmployeeId) : null,
      input.note ?? '',
      input.createdBy ?? null,
      input.auto ? 1 : 0
    );
  const ticketId = Number(insert.lastInsertRowid);
  replaceItems(db, ticketId, items);

  if (status === 'CONFIRMED') {
    // Phiếu tự sinh từ đơn hàng: ghi sổ ngay (postTicket sẽ chuyển status sang CONFIRMED).
    postTicket(db, ticketId, input.movementType);
  } else if (status === 'CHECKING') {
    db.prepare(`UPDATE stock_tickets SET status = 'CHECKING' WHERE id = ?`).run(ticketId);
  }
  return { id: ticketId, code };
}

// Ghi sổ phiếu: kiểm tra tồn rồi cộng/trừ kho + ghi nhật ký bút toán.
export function postTicket(db: Database.Database, ticketId: number, movementTypeOverride?: MovementType): void {
  const ticket = getTicket(db, ticketId);
  if (!ticket) throw badRequest('Không tìm thấy phiếu kho');
  if (ticket.status === 'CONFIRMED') return;

  const items = db
    .prepare('SELECT product_id, quantity, quantity_promo FROM stock_ticket_items WHERE ticket_id = ?')
    .all(ticketId) as { product_id: number; quantity: number; quantity_promo: number }[];
  if (!items.length) throw badRequest('Phiếu phải có ít nhất một mặt hàng');

  // Số lượng xuất/nhập kho = hàng tính tiền + hàng khuyến mãi.
  const totalQty = (it: { quantity: number; quantity_promo: number }) => (Number(it.quantity) || 0) + (Number(it.quantity_promo) || 0);

  if (ticket.ticket_type !== 'IN') {
    for (const it of items) {
      const available = getStockQuantity(db, ticket.warehouse_id, it.product_id);
      if (available < totalQty(it)) {
        throw badRequest(
          `Kho xuất không đủ hàng cho sản phẩm #${it.product_id} (hiện có ${available}, cần ${totalQty(it)})`
        );
      }
    }
  }

  const movementType =
    movementTypeOverride ?? REASON_MOVEMENT[ticket.reason] ?? (ticket.ticket_type === 'IN' ? 'IMPORT' : 'EXPORT_ORDER');
  const referenceId = ticket.order_id ? String(ticket.order_id) : ticket.code;

  for (const it of items) {
    if (ticket.ticket_type === 'TRANSFER') {
      applyStockDelta(db, { warehouseId: ticket.warehouse_id, productId: it.product_id, delta: -totalQty(it) });
      recordMovement(db, {
        movementType: 'TRANSFER_OUT',
        productId: it.product_id,
        quantity: it.quantity,
        quantityPromo: it.quantity_promo,
        sourceWarehouseId: ticket.warehouse_id,
        targetWarehouseId: ticket.target_warehouse_id,
        referenceId: ticket.code,
        ticketId,
        performedBy: ticket.created_by,
        createdAt: ticket.ticket_date,
        note: ticket.note || 'Điều chuyển kho nội bộ',
      });
      applyStockDelta(db, {
        warehouseId: ticket.target_warehouse_id as number,
        productId: it.product_id,
        delta: totalQty(it),
        allowNegative: true,
      });
      recordMovement(db, {
        movementType: 'TRANSFER_IN',
        productId: it.product_id,
        quantity: it.quantity,
        quantityPromo: it.quantity_promo,
        sourceWarehouseId: ticket.warehouse_id,
        targetWarehouseId: ticket.target_warehouse_id,
        referenceId: ticket.code,
        ticketId,
        performedBy: ticket.created_by,
        createdAt: ticket.ticket_date,
        note: ticket.note || 'Điều chuyển kho nội bộ',
      });
      continue;
    }

    const isIn = ticket.ticket_type === 'IN';
    applyStockDelta(db, {
      warehouseId: ticket.warehouse_id,
      productId: it.product_id,
      delta: isIn ? totalQty(it) : -totalQty(it),
      allowNegative: isIn,
    });
    recordMovement(db, {
      movementType,
      productId: it.product_id,
      quantity: it.quantity,
      quantityPromo: it.quantity_promo,
      sourceWarehouseId: isIn ? null : ticket.warehouse_id,
      targetWarehouseId: isIn ? ticket.warehouse_id : null,
      referenceId,
      ticketId,
      performedBy: ticket.created_by,
        createdAt: ticket.ticket_date,
      note: ticket.note ?? '',
    });
  }

  db.prepare(`UPDATE stock_tickets SET status = 'CONFIRMED' WHERE id = ?`).run(ticketId);
}

// Sửa phiếu — chỉ khi CHƯA xác nhận (chưa sinh bút toán).
export function updateTicket(db: Database.Database, ticketId: number, input: TicketHeaderInput): void {
  const ticket = getTicket(db, ticketId);
  if (!ticket) throw badRequest('Không tìm thấy phiếu kho');
  if (ticket.status === 'CONFIRMED') throw badRequest('Phiếu đã xác nhận (đã cộng/trừ tồn kho) — không sửa được');
  // Phiếu sinh từ đơn hàng phải sửa qua chính đơn đó: sửa riêng phiếu làm số hàng xuất kho lệch khỏi
  // đơn, trong khi số vỏ, tiền cọc và số lượng hoàn vẫn tính theo đơn.
  if (ticket.order_id) {
    throw badRequest('Phiếu sinh từ đơn hàng — sửa ở đơn hàng để tồn kho và đơn luôn khớp nhau');
  }
  const items = withManualTicketPromotions(db, validItems(input.items), input.ticketType,
    input.reason, input.ticketDate, !!ticket.auto, ticket.order_id);
  assertHeader(db, input);
  db.prepare(
    `UPDATE stock_tickets SET ticket_date = ?, warehouse_id = ?, target_warehouse_id = ?, partner_unit_id = ?,
       source_id = ?, reason = ?, check_note = ?, vehicle = ?, in_charge_employee_id = ?, note = ? WHERE id = ?`
  ).run(
    input.ticketDate,
    Number(input.warehouseId),
    input.targetWarehouseId ? Number(input.targetWarehouseId) : null,
    input.partnerUnitId ? Number(input.partnerUnitId) : null,
    input.sourceId ? Number(input.sourceId) : null,
    input.reason,
    input.checkNote ?? null,
    input.vehicle ?? null,
    input.inChargeEmployeeId ? Number(input.inChargeEmployeeId) : null,
    input.note ?? '',
    ticketId
  );
  replaceItems(db, ticketId, items);
}

// Chuyển trạng thái phiếu. Vào CONFIRMED thì ghi sổ (sinh bút toán).
export function setTicketStatus(db: Database.Database, ticketId: number, status: TicketStatus): void {
  const ticket = getTicket(db, ticketId);
  if (!ticket) throw badRequest('Không tìm thấy phiếu kho');
  if (ticket.order_id) throw badRequest('Phiếu sinh từ đơn hàng chỉ được ghi sổ khi đơn chuyển sang Đang giao');
  assertTicketTransition(ticket.status, status);
  if (status === 'CONFIRMED') {
    postTicket(db, ticketId);
    return;
  }
  db.prepare('UPDATE stock_tickets SET status = ? WHERE id = ?').run(status, ticketId);
}

// Xóa phiếu. Chỉ xóa được phiếu CHƯA xác nhận (trừ khi force — dùng nội bộ khi đảo đơn hàng).
export function deleteTicket(db: Database.Database, ticketId: number, force = false) {
  const ticket = getTicket(db, ticketId);
  if (!ticket) throw badRequest('Không tìm thấy phiếu kho');
  if (!force) {
    // Phiếu do đơn hàng / đơn mượn sinh ra phải hoàn tác ở chính đơn đó (hủy đơn, quyết toán),
    // còn phiếu nhập/xuất nhập tay và phiếu kiểm kê thì cho xoá kèm hoàn/trừ lại tồn kho.
    if (ticket.order_id) {
      throw badRequest('Phiếu sinh từ đơn hàng — hãy hủy đơn hoặc quyết toán ở đơn để hoàn tác, không xoá trực tiếp');
    }
  }

  if (ticket.status === 'CONFIRMED') {
    // Hoàn tác đúng số đã ghi sổ: hàng bán + hàng khuyến mãi.
    const items = db
      .prepare('SELECT product_id, quantity, quantity_promo FROM stock_ticket_items WHERE ticket_id = ?')
      .all(ticketId) as { product_id: number; quantity: number; quantity_promo: number }[];
    for (const it of items) {
      const quantity = (Number(it.quantity) || 0) + (Number(it.quantity_promo) || 0);
      if (ticket.ticket_type === 'TRANSFER') {
        applyStockDelta(db, { warehouseId: ticket.warehouse_id, productId: it.product_id, delta: quantity, allowNegative: true });
        if (ticket.target_warehouse_id) {
          applyStockDelta(db, { warehouseId: ticket.target_warehouse_id, productId: it.product_id, delta: -quantity, allowNegative: true });
        }
      } else if (ticket.ticket_type === 'IN') {
        applyStockDelta(db, { warehouseId: ticket.warehouse_id, productId: it.product_id, delta: -quantity, allowNegative: true });
      } else {
        applyStockDelta(db, { warehouseId: ticket.warehouse_id, productId: it.product_id, delta: quantity, allowNegative: true });
      }
    }
    db.prepare('DELETE FROM stock_movements WHERE ticket_id = ?').run(ticketId);
  }

  db.prepare('DELETE FROM stock_ticket_items WHERE ticket_id = ?').run(ticketId);
  db.prepare('DELETE FROM stock_tickets WHERE id = ?').run(ticketId);
}

export function ticketsOfOrder(db: Database.Database, orderId: number): number[] {
  return (db.prepare('SELECT id FROM stock_tickets WHERE order_id = ?').all(orderId) as { id: number }[]).map((r) => r.id);
}
