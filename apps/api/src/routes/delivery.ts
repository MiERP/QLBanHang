import { Router } from 'express';
import { getDb } from '../db.js';
import { dispatchCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

export function deliveryRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/delivery/dispatches',
    handle((req, res) => {
      const { status, shipper_employee_id, month } = req.query as Record<string, string | undefined>;
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (status) {
        clauses.push('d.status = ?');
        params.push(status);
      }
      if (shipper_employee_id) {
        clauses.push('d.shipper_employee_id = ?');
        params.push(shipper_employee_id);
      }
      if (month) {
        clauses.push(`strftime('%Y-%m', o.order_date) = ?`);
        params.push(month);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT d.*, o.order_code, o.order_date, o.total_amount, o.payment_status, o.payment_method, o.delivery_date,
                  c.name as customer_name, c.address as customer_address,
                  e.full_name as shipper_name, w.name as warehouse_name
           FROM delivery_dispatches d
           JOIN orders o ON d.order_id = o.id
           JOIN customers c ON o.customer_id = c.id
           JOIN employees e ON d.shipper_employee_id = e.id
           JOIN warehouses w ON d.warehouse_id = w.id
           ${where}
           ORDER BY d.id DESC LIMIT 300`
        )
        .all(...params);
      res.json(rows);
    })
  );

  router.post(
    '/delivery/dispatches',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.order_id || !body.shipper_employee_id) {
        throw badRequest('Đơn hàng và nhân viên giao hàng là bắt buộc');
      }
      const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(body.order_id)) as
        | { id: number; warehouse_id: number; shipping_fee: number; order_code: string }
        | undefined;
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');

      const existing = db.prepare(`SELECT id FROM delivery_dispatches WHERE order_id = ?`).get(order.id);
      if (existing) throw badRequest('Đơn hàng này đã có phiếu điều phối');

      const code = dispatchCode(db, today());
      const insert = db
        .prepare(
          `INSERT INTO delivery_dispatches
            (dispatch_code, order_id, shipper_employee_id, warehouse_id, shipping_fee, stair_carrying_allowance, status, note)
           VALUES (?, ?, ?, ?, ?, ?, 'ASSIGNED', ?)`
        )
        .run(
          code,
          order.id,
          Number(body.shipper_employee_id),
          Number(body.warehouse_id) || order.warehouse_id,
          Number(body.shipping_fee) || order.shipping_fee || 0,
          Number(body.stair_carrying_allowance) || 0,
          body.note || ''
        );
      db.prepare(`UPDATE orders SET shipper_employee_id = ?, order_status = 'DISPATCHED' WHERE id = ?`).run(
        Number(body.shipper_employee_id),
        order.id
      );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  router.put(
    '/delivery/dispatches/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of ['status', 'shipping_fee', 'stair_carrying_allowance', 'note', 'shipper_employee_id']) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (body.status === 'DELIVERED') {
        sets.push(`completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)`);
      }
      if (!sets.length) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE delivery_dispatches SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy phiếu điều phối');
      res.json({ success: true, id });
    })
  );

  router.get(
    '/delivery/settlements',
    handle((req, res) => {
      const { month, shipper_employee_id } = req.query as Record<string, string | undefined>;
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (shipper_employee_id) {
        clauses.push('s.shipper_employee_id = ?');
        params.push(shipper_employee_id);
      }
      if (month) {
        clauses.push(`strftime('%Y-%m', s.settled_at) = ?`);
        params.push(month);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT s.*, d.dispatch_code, o.order_code, e.full_name as shipper_name
           FROM delivery_settlements s
           JOIN delivery_dispatches d ON s.dispatch_id = d.id
           JOIN orders o ON d.order_id = o.id
           JOIN employees e ON s.shipper_employee_id = e.id
           ${where}
           ORDER BY s.id DESC LIMIT 300`
        )
        .all(...params);
      res.json(rows);
    })
  );

  router.post(
    '/delivery/settlements',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.dispatch_id) throw badRequest('Phiếu điều phối là bắt buộc');
      const dispatch = db.prepare(`SELECT * FROM delivery_dispatches WHERE id = ?`).get(Number(body.dispatch_id)) as
        | { id: number; shipper_employee_id: number }
        | undefined;
      if (!dispatch) throw new ApiError(404, 'Không tìm thấy phiếu điều phối');

      const insert = db.transaction(() => {
        const res = db
          .prepare(
            `INSERT INTO delivery_settlements
              (dispatch_id, shipper_employee_id, cash_collected, shells_returned_voi, shells_returned_up, shells_lost,
               cash_turned_in, shipping_fee_paid, settled_by, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            dispatch.id,
            Number(body.shipper_employee_id) || dispatch.shipper_employee_id,
            Number(body.cash_collected) || 0,
            Number(body.shells_returned_voi) || 0,
            Number(body.shells_returned_up) || 0,
            Number(body.shells_lost) || 0,
            Number(body.cash_turned_in) || 0,
            Number(body.shipping_fee_paid) || 0,
            body.settled_by ? Number(body.settled_by) : null,
            body.note || ''
          );
        db.prepare(`UPDATE delivery_dispatches SET status = 'DELIVERED', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE id = ?`).run(
          dispatch.id
        );
        return res;
      })();

      res.json({ success: true, id: Number(insert.lastInsertRowid) });
    })
  );

  return router;
}
