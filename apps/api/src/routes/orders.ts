import { Router } from 'express';
import ExcelJS from 'exceljs';
import { getDb, loanWarehouseId } from '../db.js';
import { dispatchCode, orderCode, revenueCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { createOrder, insertItems, normalizeShippers, replaceShippers, type RawItem } from '../lib/orderCreate.js';
import { applyOrderPromotions } from '../lib/promotions.js';
import {
  applyOrderReturn,
  assertPhysicalOrderWarehouse,
  assertShipperSelected,
  changeStatus,
  clearPendingOrderTickets,
  deleteOrder,
  getOrder,
  hasDeliveryShipper,
  netPaidAmount,
  payableAmount,
  paymentStatus,
  prepareOrderTickets,
  recalcTotals,
  syncOrderCashLedger,
  validateForConfirm,
  type OrderStatus,
  type ReturnInput,
} from '../lib/orderStatus.js';

const STATUSES: OrderStatus[] = ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'RETURNED'];

const ORDER_TYPE_LABEL: Record<string, string> = {
  SALE: 'Đơn bán',
  LEND_OUT: 'Đơn cho mượn',
  BORROW_IN: 'Đơn mượn',
  HIRED_LOAD: 'Đơn bốc xếp',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã tạo đơn',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Hàng hoàn',
};

// Cột enum của đơn phải chặn giá trị lạ ngay tại API: cột thêm vào DB cũ bằng ALTER TABLE
// không mang theo ràng buộc CHECK như trong schema.sql.
const ENUM_COLUMNS: Record<string, { label: string; values: readonly string[] }> = {
  target_scope: { label: 'Chỉ tiêu', values: ['COMPANY', 'ENTERPRISE'] },
};

const ORDER_SELECT = `SELECT o.*,
                            c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                            s.full_name as seller_name,
                            sh.full_name as shipper_name,
                            w.name as warehouse_name,
                            pu.name as partner_unit_name,
                            ou.name as support_station_name,
                            mi.order_code as merged_into_code
                     FROM orders o
                     JOIN customers c ON o.customer_id = c.id
                     LEFT JOIN employees s ON o.seller_employee_id = s.id
                     LEFT JOIN employees sh ON o.shipper_employee_id = sh.id
                     LEFT JOIN partner_units pu ON o.partner_unit_id = pu.id
                     LEFT JOIN org_units ou ON o.support_station_id = ou.id
                     LEFT JOIN orders mi ON o.merged_into_id = mi.id
                     JOIN warehouses w ON o.warehouse_id = w.id`;

function attachOrderDetails(db: ReturnType<typeof getDb>, orders: Record<string, unknown>[]) {
  const getItems = db.prepare(
    `SELECT oi.*, p.name as product_name, p.unit, p.bottle_type
     FROM order_items oi JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`
  );
  const getShippers = db.prepare(
    `SELECT os.*, e.full_name as shipper_name
     FROM order_shippers os JOIN employees e ON os.employee_id = e.id
     WHERE os.order_id = ? AND COALESCE(os.kind, 'DELIVERY') = 'DELIVERY'`
  );
  const getReturnCollectors = db.prepare(
    `SELECT os.*, e.full_name as employee_name
     FROM order_shippers os JOIN employees e ON os.employee_id = e.id
     WHERE os.order_id = ? AND os.kind = 'RETURN'`
  );
  const getMergedFrom = db.prepare(
    `SELECT source_order_id as id, source_code as order_code FROM order_merge_sources WHERE target_order_id = ? ORDER BY id ASC`
  );
  const getReturnInfo = db.prepare(
    `SELECT r.*, t.code as ticket_code, t.warehouse_id as return_warehouse_id, w.name as return_warehouse_name,
            refund.payment_method as refund_payment_method FROM order_returns r
     LEFT JOIN stock_tickets t ON t.id = r.ticket_id
     LEFT JOIN warehouses w ON w.id = t.warehouse_id
     LEFT JOIN revenue_transactions refund ON refund.id = r.refund_transaction_id
     WHERE r.order_id = ? ORDER BY r.id ASC`
  );
  // Số lượng đã hoàn lấy từ chính phiếu hàng hoàn — một nguồn sự thật cho cả tồn kho, doanh thu và hiển thị.
  const getReturnedQty = db.prepare(
    `SELECT ti.order_item_id, ti.quantity, ti.quantity_promo
     FROM stock_ticket_items ti JOIN stock_tickets t ON t.id = ti.ticket_id
     WHERE t.order_id = ? AND t.reason = 'ORDER_RETURN' AND t.status = 'CONFIRMED'`
  );
  return orders.map((o) => {
    const returned = getReturnedQty.all(o.id as number) as { order_item_id: number; quantity: number; quantity_promo: number }[];
    const returnedByItem = new Map<number, { quantity: number; quantity_promo: number }>();
    for (const row of returned) {
      const id = Number(row.order_item_id);
      const old = returnedByItem.get(id) ?? { quantity: 0, quantity_promo: 0 };
      returnedByItem.set(id, { quantity: old.quantity + Number(row.quantity || 0), quantity_promo: old.quantity_promo + Number(row.quantity_promo || 0) });
    }
    let returnedValue = 0;
    const items = (getItems.all(o.id as number) as Record<string, unknown>[]).map((item) => {
      const row = returnedByItem.get(Number(item.id));
      const backQty = Number(row?.quantity) || 0;
      const lineValue = backQty * (Number(item.unit_price) || 0);
      returnedValue += lineValue;
      return {
        ...item,
        returned_quantity: backQty,
        returned_promo: Number(row?.quantity_promo) || 0,
        returned_value: lineValue,
      };
    });
    const returnHistory = getReturnInfo.all(o.id as number) as { returned_amount?: number; refund_amount?: number }[];
    const returnedAmount = returnHistory.reduce((sum, row) => sum + Number(row.returned_amount || 0), 0) || returnedValue;
    const refundedAmount = returnHistory.reduce((sum, row) => sum + Number(row.refund_amount || 0), 0);
    const freightOnly = o.order_type === 'LEND_OUT' || o.order_type === 'HIRED_LOAD';
    // Đơn cho mượn/bốc xếp đã có total_amount = phí ship (và bằng 0 khi bật miễn ship cho khách),
    // nên mọi loại đơn dùng chung một cách tính để không lệch với quy tắc miễn ship.
    const collectible = Math.max(0, (Number(o.total_amount) || 0) - returnedAmount);
    const outstandingAmount = Math.max(0, collectible - ((Number(o.paid_amount) || 0) - refundedAmount));
    return {
      ...o,
      items,
      shippers: getShippers.all(o.id as number),
      return_collectors: getReturnCollectors.all(o.id as number),
      merged_from: getMergedFrom.all(o.id as number),
      return_info: returnHistory.at(-1) ?? null,
      return_history: returnHistory,
      // Giá trị hàng hoàn theo giá BÁN (gộp): cộng lại giảm giá của đơn để màn "doanh thu của khách"
      // và "giảm doanh thu" trừ đúng phần đã bán (đơn hoàn toàn bộ có giảm giá → doanh thu còn 0).
      returned_value: returnedAmount + (Number(o.discount_amount) || 0),
      // Số còn phải thu = số phải thanh toán sau hoàn − tiền đã thu ròng; không bao giờ âm.
      outstanding_amount: outstandingAmount,
    };
  });
}

export function ordersRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/orders',
    handle((req, res) => {
      const { from, to, status, customer_id } = req.query as Record<string, string | undefined>;
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      let query = ORDER_SELECT;
      const params: unknown[] = [];
      const clauses: string[] = [];
      if (from) {
        clauses.push('o.order_date >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('o.order_date <= ?');
        params.push(to);
      }
      if (status) {
        clauses.push('o.order_status = ?');
        params.push(status);
      }
      if (customer_id) {
        clauses.push('o.customer_id = ?');
        params.push(customer_id);
      }
      if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
      query += ` ORDER BY o.id DESC LIMIT ${limit}`;

      const orders = db.prepare(query).all(...params) as Record<string, unknown>[];
      res.json(attachOrderDetails(db, orders));
    })
  );

  // Xuất Excel các đơn CHƯA HOÀN TẤT (Nháp / Đã tạo đơn / Đang giao) để điều phối công việc.
  router.get(
    '/orders/export-dispatch.xlsx',
    handle(async (_req, res) => {
      const orders = db
        .prepare(
          `SELECT o.id, o.order_date, o.order_type, o.order_status,
                  c.name as customer_name,
                  COALESCE(o.shipping_address, c.address, '') as address,
                  w.name as warehouse_name,
                  ou.name as support_station_name
           FROM orders o
           JOIN customers c ON o.customer_id = c.id
           LEFT JOIN warehouses w ON o.warehouse_id = w.id
           LEFT JOIN org_units ou ON o.support_station_id = ou.id
           WHERE o.order_status IN ('DRAFT', 'CONFIRMED', 'SHIPPING')
           ORDER BY o.order_date ASC, o.id ASC`
        )
        .all() as { id: number; order_date: string; order_type: string; order_status: string; customer_name: string; address: string; warehouse_name: string | null; support_station_name: string | null }[];

      const orderIds = orders.map((o) => o.id);
      const itemsByOrder = new Map<number, { name: string; quantity: number }[]>();
      const shippersByOrder = new Map<number, string[]>();
      if (orderIds.length) {
        const ph = orderIds.map(() => '?').join(',');
        const items = db
          .prepare(
            `SELECT oi.order_id, p.name, oi.quantity
             FROM order_items oi JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id IN (${ph}) ORDER BY oi.id ASC`
          )
          .all(...orderIds) as { order_id: number; name: string; quantity: number }[];
        for (const it of items) {
          const list = itemsByOrder.get(it.order_id) ?? [];
          list.push({ name: it.name, quantity: Number(it.quantity) || 0 });
          itemsByOrder.set(it.order_id, list);
        }
        const shippers = db
          .prepare(
            `SELECT os.order_id, e.full_name
             FROM order_shippers os JOIN employees e ON e.id = os.employee_id
             WHERE os.order_id IN (${ph}) AND COALESCE(os.kind, 'DELIVERY') = 'DELIVERY'
             ORDER BY os.id ASC`
          )
          .all(...orderIds) as { order_id: number; full_name: string }[];
        for (const s of shippers) {
          const list = shippersByOrder.get(s.order_id) ?? [];
          list.push(s.full_name);
          shippersByOrder.set(s.order_id, list);
        }
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Điều phối đơn');
      ws.columns = [
        { header: 'Ngày tạo đơn', width: 14 },
        { header: 'Tên khách hàng', width: 30 },
        { header: 'Địa chỉ', width: 36 },
        { header: 'Loại đơn', width: 16 },
        { header: 'Kho', width: 22 },
        { header: 'Sản phẩm bán', width: 42 },
        { header: 'Số lượng', width: 10 },
        { header: 'Người vận chuyển', width: 22 },
        { header: 'Trạm hỗ trợ', width: 20 },
        { header: 'Trạng thái đơn', width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const o of orders) {
        const products = itemsByOrder.get(o.id) ?? [];
        const productText = products.map((p) => `${p.name} × ${p.quantity}`).join('; ');
        const totalQty = products.reduce((a, p) => a + p.quantity, 0);
        ws.addRow([
          o.order_date,
          o.customer_name,
          o.address,
          ORDER_TYPE_LABEL[o.order_type] ?? o.order_type,
          o.warehouse_name ?? '',
          productText,
          totalQty,
          (shippersByOrder.get(o.id) ?? []).join(', '),
          o.support_station_name ?? '',
          ORDER_STATUS_LABEL[o.order_status] ?? o.order_status,
        ]);
      }

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="dieu-phoi-don-chua-hoan-tat.xlsx"');
      res.send(Buffer.from(buffer));
    })
  );

  // Lấy một đơn đầy đủ (kèm dòng hàng, shipper, đơn nguồn đã gộp) — dùng cho điều hướng từ màn khác.
  router.get(
    '/orders/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const rows = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).all(id) as Record<string, unknown>[];
      if (!rows.length) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      res.json(attachOrderDetails(db, rows)[0]);
    })
  );

  // Tạo đơn ở trạng thái NHÁP — chưa tác động kho/doanh thu.
  router.post(
    '/orders',
    handle((req, res) => {
      res.json(createOrder(db, req.body ?? {}));
    })
  );

  // Chuyển trạng thái một đơn.
  router.post(
    '/orders/:id/status',
    handle((req, res) => {
      const id = Number(req.params.id);
      const status = req.body?.status as OrderStatus;
      if (!STATUSES.includes(status)) throw badRequest('Trạng thái không hợp lệ');
      changeStatus(db, id, status);
      res.json({ success: true, id, status });
    })
  );

  // Chuyển trạng thái nhiều đơn.
  router.post(
    '/orders/bulk-status',
    handle((req, res) => {
      const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(Number).filter(Boolean) : [];
      const status = req.body?.status as OrderStatus;
      if (!ids.length) throw badRequest('Chưa chọn đơn hàng');
      if (!STATUSES.includes(status)) throw badRequest('Trạng thái không hợp lệ');
      const succeeded: number[] = [];
      const failed: { id: number; error: string }[] = [];
      for (const id of ids) {
        try {
          changeStatus(db, id, status);
          succeeded.push(id);
        } catch (e) {
          failed.push({ id, error: e instanceof Error ? e.message : 'Lỗi không xác định' });
        }
      }
      res.json({ success: true, status, succeeded, failed });
    })
  );

  // Xóa nhiều đơn chưa phát sinh sổ sách (tạo nhầm / còn Nháp).
  router.post(
    '/orders/bulk-delete',
    handle((req, res) => {
      const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(Number).filter(Boolean) : [];
      if (!ids.length) throw badRequest('Chưa chọn đơn hàng');
      const succeeded: number[] = [];
      const failed: { id: number; error: string }[] = [];
      for (const id of ids) {
        try {
          deleteOrder(db, id);
          succeeded.push(id);
        } catch (e) {
          failed.push({ id, error: e instanceof Error ? e.message : 'Lỗi không xác định' });
        }
      }
      res.json({ success: true, succeeded, failed });
    })
  );

  // Gộp các đơn chưa xuất kho; đơn đã xác nhận được thay bằng phiếu chờ của đơn gộp.
  router.post(
    '/orders/merge',
    handle((req, res) => {
      const body = req.body ?? {};
      const ids = [...new Set((Array.isArray(body.ids) ? (body.ids as unknown[]) : []).map(Number).filter(Boolean))];
      if (ids.length < 2) throw badRequest('Chọn ít nhất 2 đơn để gộp');

      const sources = ids.map((id) => {
        const o = getOrder(db, id);
        if (!o) throw new ApiError(404, `Không tìm thấy đơn #${id}`);
        return o;
      });
      for (const o of sources) {
        if (o.merged_into_id) throw badRequest(`Đơn ${o.order_code} đã được gộp vào đơn khác`);
        if (o.order_status !== 'DRAFT' && o.order_status !== 'CONFIRMED') {
          throw badRequest(`Đơn ${o.order_code} đã xuất kho — chỉ gộp được đơn ở trạng thái Nháp hoặc Đã tạo đơn`);
        }
      }
      const first = sources[0];
      const compatible = sources.every(
        (o) =>
          o.order_type === first.order_type &&
          o.customer_id === first.customer_id &&
          o.seller_employee_id === first.seller_employee_id &&
          o.target_scope === first.target_scope &&
          o.payment_method === first.payment_method &&
          o.shipping_fee_id === first.shipping_fee_id &&
          o.warehouse_id === first.warehouse_id &&
          (o.partner_unit_id ?? null) === (first.partner_unit_id ?? null) &&
          hasDeliveryShipper(db, o.id) === hasDeliveryShipper(db, first.id)
      );
      if (!compatible) throw badRequest('Các đơn gộp phải cùng khách, nhân viên bán, chỉ tiêu, cách thanh toán, tuyến phí, loại đơn, đối tác, kho xuất và trách nhiệm giao hàng');

      const customerId = first.customer_id;
      if (body.customer_id && Number(body.customer_id) !== customerId) throw badRequest('Không được đổi khách hàng khi gộp đơn');
      const placeholders = ids.map(() => '?').join(',');

      const result = db.transaction(() => {
        const rows = db
          .prepare(
            `SELECT oi.product_id, oi.quantity, oi.quantity_promo, oi.unit_price, p.category_id
             FROM order_items oi JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id IN (${placeholders})
             ORDER BY oi.id ASC`
          )
          .all(...ids) as { product_id: number; quantity: number; quantity_promo: number; unit_price: number; category_id: number }[];

        const merged = new Map<string, { product_id: number; category_id: number; quantity: number; quantity_promo: number; unit_price: number }>();
        for (const r of rows) {
          const key = `${r.product_id}:${r.unit_price}`;
          const cur = merged.get(key);
          if (cur) { cur.quantity += Number(r.quantity); cur.quantity_promo += Number(r.quantity_promo) || 0; }
          else
            merged.set(key, {
              product_id: r.product_id,
              category_id: r.category_id,
              quantity: Number(r.quantity),
              quantity_promo: Number(r.quantity_promo) || 0,
              unit_price: Number(r.unit_price),
            });
        }
        if (!merged.size) throw badRequest('Các đơn được chọn không có mặt hàng để gộp');

        const day = today();
        const created = sources.map((o) => o.order_date).sort()[0];
        const code = orderCode(db, day);
        const note = body.note || `Gộp từ đơn ${sources.map((o) => o.order_code).join(', ')}`;

        const insert = db
          .prepare(
            `INSERT INTO orders (
               order_code, customer_id, seller_employee_id, order_type, partner_unit_id, target_scope, shipper_employee_id, warehouse_id,
               order_date, delivery_date, order_status, payment_status, payment_method,
               subtotal_amount, shipping_fee, discount_amount, deposit_amount, total_amount, paid_amount,
               shipping_receiver, shipping_phone, shipping_address, shipping_note, shipping_fee_id,
               returned_shells_voi, returned_shells_up, invoice_status, note
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'UNPAID', ?, 0, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, 0, 0, 'NOT_INVOICED', ?)`
          )
          .run(
            code,
            customerId,
            first.seller_employee_id,
            first.order_type,
            first.partner_unit_id,
            String(first.target_scope ?? 'ENTERPRISE'),
            first.shipper_employee_id,
            first.warehouse_id,
            created,
            first.delivery_date || created,
            first.payment_method,
            first.shipping_fee,
            sources.reduce((sum, source) => sum + (Number(source.discount_amount) || 0), 0),
            body.shipping_receiver ?? first.shipping_receiver ?? null,
            body.shipping_phone ?? first.shipping_phone ?? null,
            body.shipping_address ?? first.shipping_address ?? null,
            body.shipping_note ?? first.shipping_note ?? null,
            first.shipping_fee_id,
            note
          );
        const orderId = Number(insert.lastInsertRowid);

        const itemStmt = db.prepare(
          `INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price, note)
           VALUES (?, ?, ?, ?, ?, ?, '')`
        );
        // Giữ giá đã chốt; số tặng được tính lại theo tổng số mua của đơn gộp.
        for (const m of merged.values()) {
          // Đơn bốc xếp không có giá trị hàng của mình.
          const unitPrice = first.order_type === 'HIRED_LOAD' ? 0 : m.unit_price;
          itemStmt.run(orderId, m.product_id, m.quantity, m.quantity_promo, unitPrice, m.quantity * unitPrice);
        }
        applyOrderPromotions(db, orderId, false);

        // Gộp danh sách người giao của mọi đơn nguồn rồi chia phí của đơn mới.
        const mergedShippers = db.prepare(`SELECT DISTINCT employee_id FROM order_shippers WHERE order_id IN (${placeholders}) AND COALESCE(kind, 'DELIVERY') = 'DELIVERY'`)
          .all(...ids) as { employee_id: number }[];
        replaceShippers(db, orderId, normalizeShippers({ shippers: mergedShippers }, 0));
        const mergedTotals = recalcTotals(db, orderId);
        replaceShippers(db, orderId, normalizeShippers({ shippers: mergedShippers }, mergedTotals.shippingFee));
        const mergedOrder = getOrder(db, orderId)!;
        const mergedPaid = sources.reduce((sum, source) => sum + (Number(source.paid_amount) || 0), 0);
        const collectible = payableAmount(db, mergedOrder);
        if (mergedPaid > collectible + 0.5) throw badRequest('Tiền đã thu của các đơn nguồn vượt số phải thu của đơn gộp');
        db.prepare('UPDATE orders SET paid_amount = ?, payment_status = ? WHERE id = ?')
          .run(mergedPaid, paymentStatus(mergedPaid, collectible), orderId);
        db.prepare(`UPDATE revenue_transactions SET order_id = ? WHERE order_id IN (${placeholders})`).run(orderId, ...ids);
        // DB cũ có thể có số đã thu nhưng thiếu phiếu thu ở trạng thái nháp.
        syncOrderCashLedger(db, mergedOrder, mergedPaid, `Thu tiền chuyển từ đơn gộp ${code}`);

        // Phiếu chờ của đơn nguồn hết hiệu lực khi gộp; không có bút toán kho cần đảo.
        for (const source of sources) clearPendingOrderTickets(db, source.id);

        const mergedStatus = sources.some((source) => source.order_status === 'CONFIRMED') ? 'CONFIRMED' : 'DRAFT';
        if (mergedStatus === 'CONFIRMED') {
          const confirmedOrder = getOrder(db, orderId)!;
          validateForConfirm(db, confirmedOrder);
          prepareOrderTickets(db, confirmedOrder);
          db.prepare("UPDATE orders SET order_status = 'CONFIRMED' WHERE id = ?").run(orderId);
        }

        // Lưu vết + khóa đơn nguồn.
        const logStmt = db.prepare(
          `INSERT INTO order_merge_sources (target_order_id, source_order_id, source_code, source_total) VALUES (?, ?, ?, ?)`
        );
        for (const o of sources) logStmt.run(orderId, o.id, o.order_code, Number(o.total_amount) || 0);
        db.prepare(`UPDATE orders SET merged_into_id = ?, order_status = 'CANCELLED' WHERE id IN (${placeholders})`).run(
          ...[orderId, ...ids]
        );

        return { success: true, orderId, orderCode: code, mergedFrom: sources.map((o) => o.order_code) };
      })();

      res.json(result);
    })
  );

  // Thu nợ của đơn đã hoàn thành: ghi phiếu thu vào sổ quỹ, cập nhật số đã thu và trạng thái thanh toán của đơn.
  // Thu được nhiều lần (thu một phần); đủ tiền thì đơn chuyển "Đã thanh toán".
  router.post(
    '/orders/:id/collect',
    handle((req, res) => {
      const id = Number(req.params.id);
      const order = getOrder(db, id);
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      if (order.order_status !== 'COMPLETED' && order.order_status !== 'RETURNED') {
        throw badRequest('Chỉ thu tiền được đơn đã hoàn tất');
      }
      const total = payableAmount(db, order);
      const paid = Number(order.paid_amount) || 0;
      const netPaid = netPaidAmount(db, order);
      const remaining = Math.max(0, total - netPaid);
      if (remaining <= 0.5) throw badRequest('Đơn này đã thu đủ tiền');

      const body = (req.body ?? {}) as Record<string, unknown>;
      const amount = Math.round(Number(body.amount) || 0);
      if (amount <= 0) throw badRequest('Nhập số tiền thu');
      if (amount > remaining + 0.5) throw badRequest(`Số tiền thu vượt số còn lại (${remaining})`);

      const paymentMethod = body.payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH';
      const transactionDate = String(body.transaction_date || today());
      const collectedBy = body.collected_by ? Number(body.collected_by) : order.seller_employee_id ?? order.shipper_employee_id ?? null;
      const note = String(body.note ?? '').trim() || `Thu nợ đơn ${order.order_code}`;
      const serviceFee = order.order_type === 'HIRED_LOAD' || order.order_type === 'LEND_OUT';

      const result = db.transaction(() => {
        db.prepare(
          `INSERT INTO revenue_transactions
            (transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(revenueCode(db, transactionDate), serviceFee ? 'OTHER' : 'DEBT_COLLECTION', id,
          serviceFee ? null : order.customer_id, amount, paymentMethod, collectedBy, transactionDate, note);
        const newPaid = paid + amount;
        const status = paymentStatus(netPaid + amount, total);
        db.prepare('UPDATE orders SET paid_amount = ?, payment_status = ? WHERE id = ?').run(newPaid, status, id);
        return { paid_amount: newPaid, payment_status: status, remaining: Math.max(0, total - netPaid - amount) };
      })();
      res.json({ success: true, orderId: id, ...result });
    })
  );

  // Sửa thông tin đầu đơn (đầy đủ khi Nháp/Đã tạo) + tính lại tổng tiền.
  router.put(
    '/orders/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const order = getOrder(db, id);
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      // Chỉ Nháp / Đã tạo đơn mới sửa được; đơn đã xuất kho đi giao thì khóa.
      if (order.order_status !== 'DRAFT' && order.order_status !== 'CONFIRMED') {
        throw badRequest('Chỉ sửa được đơn ở trạng thái Nháp hoặc Đã tạo đơn (đơn đã xuất kho/hoàn tất/hủy thì không).');
      }
      const allowed = [
        'customer_id',
        'seller_employee_id',
        'shipper_employee_id',
        'warehouse_id',
        'order_date',
        'delivery_date',
        'order_type',
        'partner_unit_id',
        'target_scope',
        'loan_due_date',
        'payment_status',
        'payment_method',
        'paid_amount',
        'shipping_fee',
        'shipping_fee_id',
        'discount_amount',
        'returned_shells_voi',
        'returned_shells_up',
        'is_vat_invoice',
        'vat_rate',
        'vat_number',
        'company_name_vat',
        'tax_code_vat',
        'address_vat',
        'personal_id_vat',
        'budget_relation_code_vat',
        'shipping_receiver',
        'shipping_phone',
        'shipping_address',
        'shipping_note',
        'support_station_id',
        'note',
      ];

      const result = db.transaction(() => {
        if (order.order_status === 'CONFIRMED') clearPendingOrderTickets(db, id);
        const sets: string[] = [];
        const values: unknown[] = [];
        for (const key of allowed) {
          if (body[key] === undefined) continue;
          const raw = body[key];
          const enumColumn = ENUM_COLUMNS[key];
          if (enumColumn && !enumColumn.values.includes(String(raw))) {
            throw badRequest(`${enumColumn.label} không hợp lệ`);
          }
          // SQLite chỉ bind được number/string/bigint/buffer/null → chuẩn hóa '' và boolean.
          const value = raw === '' ? null : typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
          sets.push(`${key} = ?`);
          values.push(value);
        }
        if (sets.length) {
          values.push(id);
          db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        }
        if (Array.isArray(body.items)) {
          db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
          insertItems(db, id, body.items as RawItem[], String(body.order_type ?? order.order_type));
        } else if (body.order_date !== undefined || body.order_type !== undefined) {
          applyOrderPromotions(db, id, false);
        }
        // Đơn mượn / đơn bốc xếp không dùng kho của mình → luôn trỏ về kho ảo của đối tác.
        const fresh = getOrder(db, id)!;
        if (fresh.order_type === 'BORROW_IN') {
          db.prepare('UPDATE orders SET warehouse_id = ? WHERE id = ?').run(
            loanWarehouseId(),
            id
          );
        } else if (fresh.order_type === 'HIRED_LOAD') {
          db.prepare('UPDATE orders SET warehouse_id = ?, loan_due_date = NULL WHERE id = ?').run(loanWarehouseId(), id);
          // Đơn bốc xếp chỉ có phí dịch vụ, nên bỏ giá hàng và giảm giá trước khi tính lại tổng.
          db.prepare('UPDATE order_items SET unit_price = 0, total_price = 0 WHERE order_id = ?').run(id);
          db.prepare('UPDATE orders SET discount_amount = 0 WHERE id = ?').run(id);
        }
        if (fresh.order_type === 'LEND_OUT' && order.order_type !== 'LEND_OUT') {
          db.prepare('UPDATE orders SET discount_amount = 0 WHERE id = ?').run(id);
        }
        assertPhysicalOrderWarehouse(db, fresh.order_type, getOrder(db, id)!.warehouse_id);
        // Đơn nháp có thể vượt tồn hiện tại; đơn xác nhận kiểm tồn khi xác nhận/sửa và khi giao.
        let totals = recalcTotals(db, id);
        const after = getOrder(db, id)!;
        // Phí vận chuyển chuẩn lấy từ tuyến → phân bổ lại cho người giao.
        if (after.order_type === 'BORROW_IN' && !Array.isArray(body.shippers) && order.order_type !== 'BORROW_IN') {
          replaceShippers(db, id, []);
          db.prepare('UPDATE orders SET shipper_employee_id = NULL WHERE id = ?').run(id);
        } else if (Array.isArray(body.shippers)) {
          const reallocated = normalizeShippers(body, totals.shippingFee);
          replaceShippers(db, id, reallocated);
          db.prepare('UPDATE orders SET shipper_employee_id = ? WHERE id = ?').run(reallocated[0]?.employee_id ?? null, id);
        }
        totals = recalcTotals(db, id);
        // Bắt buộc có người giao khi tắt cấu hình "đơn không có nhân viên vận chuyển là đơn miễn ship".
        assertShipperSelected(db, after.order_type, id);
        // Đổi trạng thái thanh toán thì tiền đã thu phải khớp lại (đơn cho mượn chỉ thu tiền vận chuyển).
        if (body.payment_status !== undefined && body.paid_amount === undefined) {
          const collectible = totals.total;
          const paid =
            body.payment_status === 'PAID'
              ? collectible
              : body.payment_status === 'UNPAID'
                ? 0
                : Number(after.paid_amount) || 0;
          db.prepare('UPDATE orders SET paid_amount = ? WHERE id = ?').run(paid, id);
        }
        const currentPaid = Number((getOrder(db, id)!).paid_amount);
        const collectible = totals.total;
        if (after.payment_method === 'DEBT' && currentPaid > 0) throw badRequest('Đơn ghi nợ chưa có phiếu thu không được đánh dấu đã thanh toán');
        if (!Number.isFinite(currentPaid) || currentPaid < 0 || currentPaid > collectible + 0.5) {
          throw badRequest('Số tiền đã thu vượt số phải thanh toán của đơn');
        }
        db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(paymentStatus(currentPaid, collectible), id);
        syncOrderCashLedger(db, getOrder(db, id)!, currentPaid, `Điều chỉnh tiền đã thu đơn ${after.order_code}`);
        if (order.order_status === 'CONFIRMED') {
          const updated = getOrder(db, id)!;
          validateForConfirm(db, updated);
          prepareOrderTickets(db, updated);
        }
        return totals;
      })();
      res.json({ success: true, id, ...result });
    })
  );

  // Hàng hoàn: đơn đã giao hoàn tất nay khách trả lại hàng.
  // Nhập kho hàng hoàn + giảm doanh thu + giảm nợ vỏ/hoàn cọc; KPI và lương giao hàng giữ nguyên.
  router.post(
    '/orders/:id/return',
    handle((req, res) => {
      const id = Number(req.params.id);
      const order = getOrder(db, id);
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      if (order.order_type !== 'SALE' && order.order_type !== 'BORROW_IN') {
        throw badRequest('Chỉ đơn bán / đơn mượn vào mới ghi nhận hàng hoàn');
      }
      if (order.order_status !== 'COMPLETED') {
        throw badRequest('Chỉ ghi nhận hàng hoàn cho đơn đã hoàn tất');
      }
      if (order.invoice_status === 'INVOICED') throw badRequest('Đơn đã xuất hóa đơn — không ghi nhận hàng hoàn');

      const body = req.body ?? {};
      const pickupType = body.pickup_type === 'STAFF_PICKUP' ? 'STAFF_PICKUP' : 'CUSTOMER_BRING';
      const collectors = Array.isArray(body.collectors)
        ? (body.collectors as Record<string, unknown>[])
            .map((c) => ({ employee_id: Number(c.employee_id) }))
            .filter((c) => c.employee_id)
        : [];
      if (pickupType === 'STAFF_PICKUP' && !collectors.length) {
        throw badRequest('Chọn nhân viên đi nhận hàng hoàn');
      }

      const input: ReturnInput = {
        returnDate: String(body.return_date || today()),
        pickupType,
        collectors,
        lines: Array.isArray(body.items)
          ? (body.items as Record<string, unknown>[]).map((line) => ({
              order_item_id: Number(line.order_item_id),
              quantity: Number(line.quantity) || 0,
              quantity_promo: Number(line.quantity_promo) || 0,
            }))
          : [],
        shellsVoi: Number(body.shells_voi) || 0,
        shellsUp: Number(body.shells_up) || 0,
        depositPaymentMethod: String(body.deposit_payment_method || 'CASH'),
        refundPaymentMethod: body.refund_payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
        returnWarehouseId: body.return_warehouse_id ? Number(body.return_warehouse_id) : null,
        note: String(body.note ?? '').trim(),
        createdBy: body.created_by ? Number(body.created_by) : null,
      };

      const result = db.transaction(() => {
        const applied = applyOrderReturn(db, getOrder(db, id)!, input);
        return applied;
      })();

      res.json({ success: true, orderId: id, ...result });
    })
  );

  // Gán / thay người giao cho đơn đã xuất kho — phí ship cần phân bổ cho nhân viên để tính phí vận chuyển.
  router.put(
    '/orders/:id/shippers',
    handle((req, res) => {
      const id = Number(req.params.id);
      const order = getOrder(db, id);
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      if (order.order_status === 'CANCELLED' || order.order_status === 'COMPLETED' || order.order_status === 'RETURNED') {
        throw badRequest('Đơn đã kết thúc, không thể sửa người giao và phân bổ phí.');
      }
      if (order.order_type === 'BORROW_IN') throw badRequest('Đơn mượn kho ảo không có phí vận chuyển.');

      const shippers = normalizeShippers(req.body ?? {}, order.shipping_fee);
      db.transaction(() => {
        const dispatches = db.prepare('SELECT id, shipper_employee_id, status FROM delivery_dispatches WHERE order_id = ?')
          .all(id) as { id: number; shipper_employee_id: number; status: string }[];
        const nextEmployees = new Set(shippers.map((s) => s.employee_id));
        for (const dispatch of dispatches) {
          if (!nextEmployees.has(dispatch.shipper_employee_id) && order.order_status === 'SHIPPING' && dispatch.status !== 'ASSIGNED') {
            throw badRequest('Không thể bỏ nhân viên vận chuyển của chuyến đã bắt đầu');
          }
        }
        replaceShippers(db, id, shippers);
        db.prepare('UPDATE orders SET shipper_employee_id = ? WHERE id = ?').run(shippers[0]?.employee_id ?? null, id);
        if (order.order_status === 'SHIPPING' || order.order_status === 'COMPLETED' || order.order_status === 'RETURNED') {
          const existing = new Map(dispatches.map((d) => [d.shipper_employee_id, d]));
          for (const shipper of shippers) {
            const dispatch = existing.get(shipper.employee_id);
            if (dispatch) {
              const completed = order.order_status === 'COMPLETED' || order.order_status === 'RETURNED';
              db.prepare(`UPDATE delivery_dispatches SET shipping_fee = ?,
                status = CASE WHEN ? = 1 AND status IN ('ASSIGNED', 'IN_TRANSIT') THEN 'DELIVERED' ELSE status END,
                completed_at = CASE WHEN ? = 1 AND status IN ('ASSIGNED', 'IN_TRANSIT') THEN CURRENT_TIMESTAMP ELSE completed_at END
                WHERE id = ?`).run(shipper.allocated_fee, completed ? 1 : 0, completed ? 1 : 0, dispatch.id);
            } else {
              const completed = order.order_status === 'COMPLETED' || order.order_status === 'RETURNED';
              db.prepare(`INSERT INTO delivery_dispatches
                (dispatch_code, order_id, shipper_employee_id, warehouse_id, shipping_fee, status, completed_at, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(dispatchCode(db, order.order_date), id, shipper.employee_id, order.warehouse_id,
                  shipper.allocated_fee, completed ? 'DELIVERED' : 'ASSIGNED', completed ? today() : null,
                  `Điều phối giao đơn ${order.order_code}`);
            }
          }
          for (const dispatch of dispatches) {
            if (!nextEmployees.has(dispatch.shipper_employee_id)) {
              db.prepare('DELETE FROM delivery_dispatches WHERE id = ?').run(dispatch.id);
            }
          }
        }
        assertShipperSelected(db, order.order_type, id);
      })();
      res.json({ success: true });
    })
  );

  return router;
}
