import { Router } from 'express';
import { getDb } from '../db.js';
import { customerCode } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

export function customersRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/customers',
    handle((req, res) => {
      const search = req.query.search as string | undefined;
      let query = `SELECT c.*, g.name as group_name, g.discount_percent as group_discount
                   FROM customers c
                   LEFT JOIN customer_groups g ON c.group_id = g.id
                   WHERE c.is_active = 1`;
      const params: unknown[] = [];
      if (search) {
        query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.tax_code LIKE ? OR c.code LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      query += ` ORDER BY (c.bottle_debt_voi + c.bottle_debt_up) DESC, c.id ASC`;
      res.json(db.prepare(query).all(...params));
    })
  );

  router.post(
    '/customers',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.name || !body.address) {
        throw badRequest('Tên và địa chỉ khách hàng là bắt buộc');
      }
      const code = body.code || customerCode(db);
      const insert = db
        .prepare(
          `INSERT INTO customers
            (group_id, code, name, phone, address, tax_code, contact_person, max_debt_limit, current_debt, bottle_debt_voi, bottle_debt_up, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`
        )
        .run(
          body.group_id ? Number(body.group_id) : null,
          code,
          body.name,
          body.phone || '',
          body.address,
          body.tax_code || '',
          body.contact_person || '',
          Number(body.max_debt_limit) || 10000000,
          Number(body.bottle_debt_voi) || 0,
          Number(body.bottle_debt_up) || 0
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  router.put(
    '/customers/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'group_id',
        'name',
        'phone',
        'address',
        'tax_code',
        'contact_person',
        'max_debt_limit',
        'current_debt',
        'bottle_debt_voi',
        'bottle_debt_up',
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
      const result = db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy khách hàng');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/customers/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`UPDATE customers SET is_active = 0 WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy khách hàng');
      res.json({ success: true, id });
    })
  );

  router.get(
    '/customers/bottle-ledgers',
    handle((req, res) => {
      const cId = req.query.customer_id as string | undefined;
      let query = `SELECT l.*, c.name as customer_name, c.phone as customer_phone,
                          e.full_name as handler_name, o.order_code
                   FROM customer_bottle_ledgers l
                   JOIN customers c ON l.customer_id = c.id
                   LEFT JOIN employees e ON l.handled_by = e.id
                   LEFT JOIN orders o ON l.order_id = o.id`;
      const params: unknown[] = [];
      if (cId) {
        query += ` WHERE l.customer_id = ?`;
        params.push(cId);
      }
      query += ` ORDER BY l.id DESC LIMIT 200`;
      res.json(db.prepare(query).all(...params));
    })
  );

  router.post(
    '/customers/:id/bottle-return',
    handle((req, res) => {
      const customerId = Number(req.params.id);
      const body = req.body ?? {};
      const returnedVoi = Number(body.returned_voi) || 0;
      const returnedUp = Number(body.returned_up) || 0;
      if (returnedVoi <= 0 && returnedUp <= 0) {
        throw badRequest('Số lượng vỏ thu hồi phải lớn hơn 0');
      }
      const customer = db
        .prepare(`SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?`)
        .get(customerId) as { bottle_debt_voi: number; bottle_debt_up: number } | undefined;
      if (!customer) throw new ApiError(404, 'Không tìm thấy khách hàng');

      const newVoi = Math.max(0, customer.bottle_debt_voi - returnedVoi);
      const newUp = Math.max(0, customer.bottle_debt_up - returnedUp);

      db.transaction(() => {
        db.prepare(`UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?`).run(newVoi, newUp, customerId);
        db.prepare(
          `INSERT INTO customer_bottle_ledgers
            (customer_id, order_id, transaction_date, borrowed_voi, borrowed_up, returned_voi, returned_up,
             remaining_balance_voi, remaining_balance_up, handled_by, note)
           VALUES (?, NULL, DATE('now','localtime'), 0, 0, ?, ?, ?, ?, ?, ?)`
        ).run(
          customerId,
          returnedVoi,
          returnedUp,
          newVoi,
          newUp,
          body.handled_by ? Number(body.handled_by) : null,
          body.note || 'Thu hồi vỏ bình (không kèm đơn hàng)'
        );
      })();

      res.json({ success: true, remaining_voi: newVoi, remaining_up: newUp });
    })
  );

  return router;
}
