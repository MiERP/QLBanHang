import { Router } from 'express';
import { getDb } from '../db.js';
import { dvgtCode, revenueCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

function syncDvgtRevenue(db: ReturnType<typeof getDb>, id: number) {
  const request = db.prepare(`SELECT * FROM dvgt_requests WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!request) return;
  const isBillable =
    request.status === 'COMPLETED' && request.payment_status === 'PAID' && Number(request.revenue_amount) > 0;
  if (!isBillable) return;
  const existing = db.prepare(`SELECT id FROM revenue_transactions WHERE dvgt_id = ?`).get(id);
  if (existing) return;
  db.prepare(
    `INSERT INTO revenue_transactions
      (transaction_code, transaction_type, dvgt_id, amount, payment_method, collected_by, transaction_date, note)
     VALUES (?, 'DVGT_SERVICE', ?, ?, 'CASH', ?, ?, ?)`
  ).run(
    revenueCode(db, String(request.completed_date || today())),
    id,
    Number(request.revenue_amount),
    request.technician_employee_id ?? null,
    request.completed_date || today(),
    `Thu tiền dịch vụ ${request.request_code}`
  );
}

export function dvgtRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/dvgt',
    handle((req, res) => {
      const { status, month } = req.query as Record<string, string | undefined>;
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (status) {
        clauses.push('d.status = ?');
        params.push(status);
      }
      if (month) {
        clauses.push(`strftime('%Y-%m', COALESCE(d.completed_date, d.scheduled_date, d.created_at)) = ?`);
        params.push(month);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT d.*, p.name as service_name, p.unit,
                  se.full_name as seller_name, te.full_name as technician_name, s.name as station_name
           FROM dvgt_requests d
           LEFT JOIN products p ON d.service_product_id = p.id
           LEFT JOIN employees se ON d.seller_employee_id = se.id
           LEFT JOIN employees te ON d.technician_employee_id = te.id
           LEFT JOIN stations s ON d.station_id = s.id
           ${where}
           ORDER BY d.id DESC LIMIT 300`
        )
        .all(...params);
      res.json(rows);
    })
  );

  router.post(
    '/dvgt',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.customer_name || !body.phone || !body.address) {
        throw badRequest('Tên khách hàng, số điện thoại và địa chỉ là bắt buộc');
      }
      if (!body.service_product_id) throw badRequest('Dịch vụ là bắt buộc');
      const code = body.request_code || dvgtCode(db, body.scheduled_date || today());
      const id = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO dvgt_requests
              (request_code, customer_name, phone, address, service_product_id, seller_employee_id, technician_employee_id,
               station_id, scheduled_date, completed_date, status, revenue_amount, payment_status, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            code,
            body.customer_name,
            body.phone,
            body.address,
            Number(body.service_product_id),
            Number(body.seller_employee_id) || 1,
            body.technician_employee_id ? Number(body.technician_employee_id) : null,
            body.station_id ? Number(body.station_id) : null,
            body.scheduled_date || null,
            body.completed_date || null,
            body.status || 'REGISTERED',
            Number(body.revenue_amount) || 0,
            body.payment_status || 'UNPAID',
            body.note || ''
          );
        const newId = Number(result.lastInsertRowid);
        syncDvgtRevenue(db, newId);
        return newId;
      })();
      res.json({ success: true, id, code });
    })
  );

  router.put(
    '/dvgt/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'customer_name',
        'phone',
        'address',
        'service_product_id',
        'seller_employee_id',
        'technician_employee_id',
        'station_id',
        'scheduled_date',
        'completed_date',
        'status',
        'revenue_amount',
        'payment_status',
        'note',
      ];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (!sets.length) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);

      db.transaction(() => {
        const result = db.prepare(`UPDATE dvgt_requests SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy yêu cầu DVGT');
        syncDvgtRevenue(db, id);
      })();

      res.json({ success: true, id });
    })
  );

  router.delete(
    '/dvgt/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      db.transaction(() => {
        db.prepare(`DELETE FROM revenue_transactions WHERE dvgt_id = ?`).run(id);
        const result = db.prepare(`DELETE FROM dvgt_requests WHERE id = ?`).run(id);
        if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy yêu cầu DVGT');
      })();
      res.json({ success: true, id });
    })
  );

  return router;
}
