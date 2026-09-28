import { Router } from 'express';
import { getDb } from '../db.js';
import { handle } from '../lib/http.js';

export function financeRouter(): Router {
  const router = Router();
  const db = getDb();

  // Sổ thu (chỉ đọc): phiếu thu phát sinh tự động từ đơn hàng / cọc vỏ, không nhập tay.
  router.get(
    '/finance/revenue',
    handle((req, res) => {
      const { from, to, type, customer_id } = req.query as Record<string, string | undefined>;
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (from) {
        clauses.push('r.transaction_date >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('r.transaction_date <= ?');
        params.push(to);
      }
      if (type) {
        clauses.push('r.transaction_type = ?');
        params.push(type);
      }
      if (customer_id) {
        clauses.push('r.customer_id = ?');
        params.push(customer_id);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      res.json(
        db
          .prepare(
            `SELECT r.*, c.name as customer_name, e.full_name as collected_by_name, o.order_code
             FROM revenue_transactions r
             LEFT JOIN customers c ON r.customer_id = c.id
             LEFT JOIN employees e ON r.collected_by = e.id
             LEFT JOIN orders o ON r.order_id = o.id
             ${where}
             ORDER BY r.id DESC LIMIT 500`
          )
          .all(...params)
      );
    })
  );

  return router;
}
