import { Router } from 'express';
import { getDb } from '../db.js';
import { dateKey, nextCode, today } from '../lib/codes.js';
import { badRequest, handle } from '../lib/http.js';

export function depositsRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/deposits',
    handle((req, res) => {
      const { customer_id, type, from, to } = req.query as Record<string, string | undefined>;
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (customer_id) {
        clauses.push('d.customer_id = ?');
        params.push(customer_id);
      }
      if (type) {
        clauses.push('d.transaction_type = ?');
        params.push(type);
      }
      if (from) {
        clauses.push('d.transaction_date >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('d.transaction_date <= ?');
        params.push(to);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT d.*, c.name as customer_name, e.full_name as handled_by_name, o.order_code
           FROM deposit_transactions d
           LEFT JOIN customers c ON d.customer_id = c.id
           LEFT JOIN employees e ON d.handled_by = e.id
           LEFT JOIN orders o ON d.order_id = o.id
           ${where}
           ORDER BY d.id DESC LIMIT 500`
        )
        .all(...params);
      res.json(rows);
    })
  );

  router.post(
    '/deposits',
    handle((req, res) => {
      const body = req.body ?? {};
      const amount = Number(body.amount);
      if (!amount || amount <= 0) throw badRequest('Số tiền phải lớn hơn 0');
      const type = body.transaction_type === 'REFUND' ? 'REFUND' : 'COLLECT';
      const date = body.transaction_date || today();
      const code = nextCode(db, {
        table: 'deposit_transactions',
        column: 'transaction_code',
        prefix: `COC-${dateKey(date)}-`,
        width: 2,
      });
      const insert = db
        .prepare(
          `INSERT INTO deposit_transactions
            (transaction_code, transaction_type, customer_id, order_id, amount, payment_method, handled_by, transaction_date, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          code,
          type,
          body.customer_id ? Number(body.customer_id) : null,
          body.order_id ? Number(body.order_id) : null,
          amount,
          body.payment_method || 'CASH',
          body.handled_by ? Number(body.handled_by) : null,
          date,
          body.note || ''
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  return router;
}
