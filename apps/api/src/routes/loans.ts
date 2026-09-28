import { Router } from 'express';
import Database from 'better-sqlite3';
import { getDb } from '../db.js';
import { today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { getOrder, type OrderRecord } from '../lib/orderStatus.js';
import { addPartnerShellMovement, recordShellMovement } from '../lib/shellStock.js';
import { createTicket } from '../lib/stockTickets.js';

export type LoanStatus = 'PENDING' | 'OUTSTANDING' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';

interface LoanLine {
  product_id: number;
  product_name: string;
  unit: string | null;
  quantity: number;
  returned: number;
  remaining: number;
  unit_price: number;
}

interface SettlementRow {
  id: number;
  settle_type: 'RETURN_GOODS' | 'PAYMENT';
  settle_date: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  ticket_id: number | null;
  ticket_code: string | null;
  settled_value: number;
  amount: number;
  note: string | null;
  items?: { product_id: number; product_name: string; quantity: number }[];
}

// Một nguồn sự thật cho trạng thái đơn mượn: số còn lại tính từ dòng hàng trừ số đã trả,
// còn nợ tính từ giá trị đơn trừ giá trị hàng đã trả lại — mượn hàng chỉ tất toán bằng hàng.
export function loanState(db: Database.Database, order: OrderRecord) {
  const lines = (
    db
      .prepare(
        `SELECT oi.product_id, p.name as product_name, p.unit,
                SUM(oi.quantity + COALESCE(oi.quantity_promo, 0)) as quantity,
                MAX(oi.unit_price) as unit_price
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?
         GROUP BY oi.product_id, p.name, p.unit
         ORDER BY oi.product_id`
      )
      .all(order.id) as { product_id: number; product_name: string; unit: string | null; quantity: number; unit_price: number }[]
  ).map((r) => ({ ...r, quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0, returned: 0, remaining: 0 })) as LoanLine[];

  const returnedByProduct = new Map<number, number>();
  const settlements = db
    .prepare(
      `SELECT ls.*, w.name as warehouse_name, t.code as ticket_code
       FROM loan_settlements ls
       LEFT JOIN warehouses w ON ls.warehouse_id = w.id
       LEFT JOIN stock_tickets t ON ls.ticket_id = t.id
       WHERE ls.order_id = ?
       ORDER BY ls.id ASC`
    )
    .all(order.id) as SettlementRow[];
  const settlementItems = db
    .prepare(
      `SELECT lsi.settlement_id, lsi.product_id, p.name as product_name, lsi.quantity
       FROM loan_settlement_items lsi
       JOIN products p ON lsi.product_id = p.id
       JOIN loan_settlements ls ON ls.id = lsi.settlement_id
       WHERE ls.order_id = ?
       ORDER BY lsi.id ASC`
    )
    .all(order.id) as { settlement_id: number; product_id: number; product_name: string; quantity: number }[];
  for (const item of settlementItems) {
    returnedByProduct.set(item.product_id, (returnedByProduct.get(item.product_id) ?? 0) + (Number(item.quantity) || 0));
  }
  for (const s of settlements) s.items = settlementItems.filter((i) => i.settlement_id === s.id);
  for (const line of lines) {
    line.returned = returnedByProduct.get(line.product_id) ?? 0;
    line.remaining = Math.max(0, line.quantity - line.returned);
  }

  const goodsValue = Number(order.subtotal_amount) || 0;
  const returnedValue = settlements
    .filter((s) => s.settle_type === 'RETURN_GOODS')
    .reduce((a, s) => a + (Number(s.settled_value) || 0), 0);
  const settledValue = returnedValue;
  const outstanding = lines.reduce((sum, line) => sum + line.remaining * line.unit_price, 0);

  let status: LoanStatus;
  if (order.order_status === 'CANCELLED') status = 'CANCELLED';
  else if (order.order_status === 'DRAFT' || order.order_status === 'CONFIRMED') status = 'PENDING';
  else if (lines.every((line) => line.remaining === 0)) status = 'SETTLED';
  else if (lines.some((line) => line.returned > 0)) status = 'PARTIAL';
  else status = 'OUTSTANDING';

  const dueDate = order.loan_due_date ?? null;
  const overdueDays =
    dueDate && status !== 'PENDING' && status !== 'SETTLED' && status !== 'CANCELLED'
      ? Math.max(0, Math.floor((Date.parse(today()) - Date.parse(dueDate)) / 86400000))
      : 0;

  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const returnedUnits = lines.reduce((sum, line) => sum + line.returned, 0);
  const remainingUnits = lines.reduce((sum, line) => sum + line.remaining, 0);
  return { lines, settlements, goodsValue, returnedValue, settledValue, outstanding,
    totalUnits, returnedUnits, remainingUnits, status, dueDate, overdueDays };
}

export function loansRouter(): Router {
  const router = Router();
  const db = getDb();

  // Danh sách mượn - trả: đơn cho mượn (đối tác nợ mình) và đơn mượn (mình nợ đối tác).
  router.get(
    '/loans',
    handle((req, res) => {
      const { month, direction } = req.query as Record<string, string | undefined>;
      const clauses: string[] = ["o.order_type IN ('LEND_OUT', 'BORROW_IN')"];
      const params: unknown[] = [];
      if (month) {
        clauses.push(`strftime('%Y-%m', o.order_date) = ?`);
        params.push(month);
      }
      if (direction === 'LEND_OUT' || direction === 'BORROW_IN') {
        clauses.push('o.order_type = ?');
        params.push(direction);
      }
      const rows = db
        .prepare(
          `SELECT o.id as order_id, o.order_code, o.order_date, o.order_status, o.order_type as loan_direction,
                  o.subtotal_amount, o.shipping_fee, o.total_amount, o.deposit_amount,
                  o.loan_settled_at, o.loan_settle_type, o.loan_due_date, o.note,
                  pu.id as partner_unit_id, pu.code as partner_unit_code, pu.name as partner_unit_name,
                  c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                  se.full_name as seller_name, sh.full_name as shipper_name, w.name as warehouse_name
           FROM orders o
           LEFT JOIN partner_units pu ON o.partner_unit_id = pu.id
           JOIN customers c ON o.customer_id = c.id
           LEFT JOIN employees se ON o.seller_employee_id = se.id
           LEFT JOIN employees sh ON o.shipper_employee_id = sh.id
           LEFT JOIN warehouses w ON o.warehouse_id = w.id
           WHERE ${clauses.join(' AND ')}
           ORDER BY o.id DESC LIMIT 500`
        )
        .all(...params) as Record<string, unknown>[];

      res.json(
        rows.map((row) => {
          const order = getOrder(db, Number(row.order_id))!;
          const state = loanState(db, order);
          return {
            ...row,
            loan_label: row.loan_direction === 'LEND_OUT' ? 'Mình cho mượn' : 'Mình đi mượn',
            loan_status: state.status,
            loan_due_date: state.dueDate,
            overdue_days: state.overdueDays,
            goods_value: state.goodsValue,
            settled_value: state.settledValue,
            outstanding_value: state.outstanding,
            total_units: state.totalUnits,
            returned_units: state.returnedUnits,
            remaining_units: state.remainingUnits,
            items: state.lines,
            settlements: state.settlements,
          };
        })
      );
    })
  );

  // Trả hàng của đơn mượn / cho mượn — làm được nhiều lần, mỗi lần trả một phần hàng.
  //  - LEND_OUT (mình cho mượn): đối tác trả hàng → NHẬP lại kho mình.
  //  - BORROW_IN (mình đi mượn): mình trả hàng cho đối tác → XUẤT kho mình.
  router.post(
    '/loans/:orderId/settle',
    handle((req, res) => {
      const orderId = Number(req.params.orderId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const order = getOrder(db, orderId);
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      if (order.order_type !== 'LEND_OUT' && order.order_type !== 'BORROW_IN') {
        throw badRequest('Đơn hàng không phải đơn mượn / cho mượn');
      }
      if (order.order_status === 'CANCELLED') throw badRequest('Đơn hàng đã hủy');
      // Hàng phải đã rời kho mới quyết toán được, nếu không sổ kho sẽ nhận hàng về trước khi hàng đi.
      if (order.order_status !== 'SHIPPING' && order.order_status !== 'COMPLETED' && order.order_status !== 'RETURNED') {
        throw badRequest('Chỉ quyết toán được đơn đã giao hàng (đang giao hoặc hoàn tất)');
      }

      const settleDate = String(body.settle_date || today());
      const note = String(body.note ?? '').trim();
      const isLend = order.order_type === 'LEND_OUT';

      const state = loanState(db, order);
      if (state.status === 'SETTLED') throw badRequest('Đơn mượn này đã trả hết hàng');

      const lineByProduct = new Map(state.lines.map((l) => [l.product_id, l]));
      const returnItems: { product_id: number; quantity: number; unit_price: number }[] = [];
      const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
      const requested = new Map<number, number>();
      for (const raw of rawItems) {
        const productId = Number(raw.product_id);
        const quantity = Number(raw.quantity) || 0;
        if (!Number.isSafeInteger(quantity) || quantity < 0) throw badRequest('Số lượng hàng trả phải là số nguyên không âm');
        if (!productId || quantity <= 0) continue;
        requested.set(productId, (requested.get(productId) ?? 0) + quantity);
      }
      for (const [productId, quantity] of requested) {
        const line = lineByProduct.get(productId);
        if (!line) throw badRequest(`Sản phẩm #${productId} không có trong đơn`);
        if (quantity > line.remaining) {
          throw badRequest(`${line.product_name}: trả ${quantity} vượt số còn lại (${line.remaining})`);
        }
        returnItems.push({ product_id: productId, quantity, unit_price: line.unit_price });
      }

      if (!returnItems.length) throw badRequest('Nhập số lượng hàng trả lại');

      // Trả hàng cho đối tác phải xuất từ kho vật lý của mình (đơn mượn dùng kho ảo làm điểm nhận hàng).
      let returnWarehouseId: number | null = null;
      if (!isLend) {
        const warehouseId = Number(body.warehouse_id);
        if (!warehouseId) throw badRequest('Chọn kho xuất hàng trả đối tác');
        const warehouse = db.prepare('SELECT type FROM warehouses WHERE id = ?').get(warehouseId) as { type: string } | undefined;
        if (!warehouse) throw new ApiError(404, 'Không tìm thấy kho xuất');
        if (warehouse.type === 'VIRTUAL' || warehouse.type === 'CUSTOMER') {
          throw badRequest('Kho trả hàng phải là kho vật lý chứa hàng');
        }
        returnWarehouseId = warehouseId;
      }

      const result = db.transaction(() => {
        const returnedValue = returnItems.reduce((a, i) => a + i.quantity * i.unit_price, 0);
        const ticket = createTicket(db, {
          ticketType: isLend ? 'IN' : 'OUT',
          ticketDate: settleDate,
          warehouseId: isLend ? order.warehouse_id : (returnWarehouseId as number),
          partnerUnitId: order.partner_unit_id,
          orderId: order.id,
          reason: isLend ? 'PARTNER_RETURN' : 'RETURN_BORROW',
          movementType: isLend ? 'LOAN_IN' : 'BORROW_OUT',
          note: isLend
            ? `Đối tác trả hàng theo đơn ${order.order_code}`
            : `Trả hàng mượn cho đối tác theo đơn ${order.order_code}`,
          auto: true,
          status: 'CONFIRMED',
          items: returnItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        });
        const settlement = db
          .prepare(
            `INSERT INTO loan_settlements (order_id, settle_type, settle_date, warehouse_id, ticket_id, settled_value, amount, note)
             VALUES (?, 'RETURN_GOODS', ?, ?, ?, ?, 0, ?)`
          )
          .run(order.id, settleDate, isLend ? order.warehouse_id : returnWarehouseId, ticket.id, returnedValue, note);
        const settlementId = Number(settlement.lastInsertRowid);
        const insertItem = db.prepare('INSERT INTO loan_settlement_items (settlement_id, product_id, quantity) VALUES (?, ?, ?)');
        for (const item of returnItems) insertItem.run(settlementId, item.product_id, item.quantity);

        // Vỏ đi kèm hàng đối tác trả về: nhập lại pool vỏ của xí nghiệp và trừ số vỏ đối tác đang giữ.
        if (isLend && order.partner_unit_id) {
          const shellsByType = new Map<string, number>();
          for (const item of returnItems) {
            const product = db.prepare('SELECT bottle_type FROM products WHERE id = ?').get(item.product_id) as
              | { bottle_type: string }
              | undefined;
            const bottleType = product?.bottle_type;
            if (bottleType !== 'VOI' && bottleType !== 'UP') continue;
            shellsByType.set(bottleType, (shellsByType.get(bottleType) ?? 0) + item.quantity);
          }
          for (const [bottleType, quantity] of shellsByType) {
            if (!quantity) continue;
            recordShellMovement(db, {
              movementType: 'RETURN',
              bottleType: bottleType as 'VOI' | 'UP',
              quantity,
              orderId: order.id,
              performedBy: order.shipper_employee_id ?? null,
              note: `Đối tác trả vỏ theo đơn ${order.order_code}`,
              movementDate: settleDate,
            });
            addPartnerShellMovement(db, {
              partnerUnitId: order.partner_unit_id,
              bottleType: bottleType as 'VOI' | 'UP',
              quantity: -quantity,
              orderId: order.id,
              note: `Đối tác trả vỏ theo đơn ${order.order_code}`,
            });
          }
        }

        // Trả đủ hàng thì chốt sổ đơn mượn.
        const after = loanState(db, order);
        if (after.status === 'SETTLED') {
          db.prepare(`UPDATE orders SET loan_settled_at = CURRENT_TIMESTAMP, loan_settle_type = 'RETURN_GOODS' WHERE id = ?`).run(order.id);
        }
        return { ticketCode: ticket.code, returnedValue, state: after };
      })();

      res.json({ success: true, orderId, ...result });
    })
  );

  return router;
}
