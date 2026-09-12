import { Router } from 'express';
import { getDb } from '../db.js';
import { staffCode } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

export function staffRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/staff',
    handle((_req, res) => {
      const staff = db
        .prepare(
          `SELECT e.*, s.name as station_name, r.name as role_name, r.code as role_code
           FROM employees e
           LEFT JOIN stations s ON e.station_id = s.id
           LEFT JOIN roles r ON e.role_id = r.id
           WHERE e.is_active = 1
           ORDER BY e.role_id ASC, e.id ASC`
        )
        .all();
      res.json(staff);
    })
  );

  router.post(
    '/staff',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.full_name) throw badRequest('Họ tên nhân viên là bắt buộc');
      const code = body.code || staffCode(db);
      const insert = db
        .prepare(
          `INSERT INTO employees
            (station_id, role_id, code, full_name, position, phone, home_address, commission_rate, shipping_allowance, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          body.station_id ? Number(body.station_id) : null,
          Number(body.role_id) || 3,
          code,
          body.full_name,
          body.position || 'Nhân viên',
          body.phone || '',
          body.home_address || '',
          Number(body.commission_rate) || 0,
          Number(body.shipping_allowance) || 5000
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  router.put(
    '/staff/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'station_id',
        'role_id',
        'full_name',
        'position',
        'phone',
        'home_address',
        'commission_rate',
        'shipping_allowance',
        'is_active',
      ];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (sets.length === 0) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy nhân viên');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/staff/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`UPDATE employees SET is_active = 0 WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy nhân viên');
      res.json({ success: true, id });
    })
  );

  router.get(
    '/staff/shipping-settlements',
    handle((req, res) => {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const settlements = db
        .prepare(
          `SELECT e.id as employee_id, e.full_name, s.name as station_name,
                  COUNT(o.id) as total_trips,
                  COALESCE(SUM(o.shipping_fee), 0) as total_shipping_fee,
                  COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' AND o.payment_method = 'CASH' THEN o.total_amount ELSE 0 END), 0) as total_cash_collected
           FROM employees e
           LEFT JOIN stations s ON e.station_id = s.id
           LEFT JOIN orders o ON o.shipper_employee_id = e.id AND strftime('%Y-%m', o.order_date) = ?
           WHERE e.role_id = 4 AND e.is_active = 1
           GROUP BY e.id
           ORDER BY e.id ASC`
        )
        .all(month);
      res.json(settlements);
    })
  );

  router.get(
    '/staff/bottle-ledgers',
    handle((req, res) => {
      const eId = req.query.employee_id as string | undefined;
      let query = `SELECT el.*, e.full_name as employee_name, w.name as warehouse_name
                   FROM employee_bottle_ledgers el
                   JOIN employees e ON el.employee_id = e.id
                   JOIN warehouses w ON el.warehouse_id = w.id`;
      const params: unknown[] = [];
      if (eId) {
        query += ` WHERE el.employee_id = ?`;
        params.push(eId);
      }
      query += ` ORDER BY el.id DESC LIMIT 200`;
      res.json(db.prepare(query).all(...params));
    })
  );

  return router;
}
