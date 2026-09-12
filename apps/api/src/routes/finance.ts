import { Router } from 'express';
import { getDb } from '../db.js';
import { expenseCode, revenueCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

export function financeRouter(): Router {
  const router = Router();
  const db = getDb();

  const rangeClause = (from?: string, to?: string, column = 'transaction_date') => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (from) {
      clauses.push(`${column} >= ?`);
      params.push(from);
    }
    if (to) {
      clauses.push(`${column} <= ?`);
      params.push(to);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  };

  // --- Revenue ---
  router.get(
    '/finance/revenue',
    handle((req, res) => {
      const { from, to, type } = req.query as Record<string, string | undefined>;
      const { where, params } = rangeClause(from, to);
      let query = `SELECT r.*, c.name as customer_name, e.full_name as collected_by_name, o.order_code
                   FROM revenue_transactions r
                   LEFT JOIN customers c ON r.customer_id = c.id
                   LEFT JOIN employees e ON r.collected_by = e.id
                   LEFT JOIN orders o ON r.order_id = o.id`;
      const clauses: string[] = [];
      if (where) clauses.push(where.replace(/^WHERE /, ''));
      if (type) {
        clauses.push('r.transaction_type = ?');
        params.push(type);
      }
      if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
      query += ` ORDER BY r.id DESC LIMIT 500`;
      res.json(db.prepare(query).all(...params));
    })
  );

  router.post(
    '/finance/revenue',
    handle((req, res) => {
      const body = req.body ?? {};
      const amount = Number(body.amount);
      if (!amount || amount <= 0) throw badRequest('Số tiền thu phải lớn hơn 0');
      const date = body.transaction_date || today();
      const code = body.transaction_code || revenueCode(db, date);
      const insert = db
        .prepare(
          `INSERT INTO revenue_transactions
            (transaction_code, transaction_type, order_id, dvgt_id, customer_id, amount, payment_method, collected_by, transaction_date, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          code,
          body.transaction_type || 'OTHER',
          body.order_id ? Number(body.order_id) : null,
          body.dvgt_id ? Number(body.dvgt_id) : null,
          body.customer_id ? Number(body.customer_id) : null,
          amount,
          body.payment_method || 'CASH',
          body.collected_by ? Number(body.collected_by) : null,
          date,
          body.note || ''
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  router.put(
    '/finance/revenue/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = ['transaction_type', 'customer_id', 'amount', 'payment_method', 'collected_by', 'transaction_date', 'note'];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (!sets.length) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE revenue_transactions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy phiếu thu');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/finance/revenue/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`DELETE FROM revenue_transactions WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy phiếu thu');
      res.json({ success: true, id });
    })
  );

  // --- Expenses ---
  router.get(
    '/finance/expenses',
    handle((req, res) => {
      const { from, to, category } = req.query as Record<string, string | undefined>;
      const { where, params } = rangeClause(from, to, 'expense_date');
      let query = `SELECT x.*, e.full_name as paid_by_name, s.name as station_name
                   FROM expense_transactions x
                   LEFT JOIN employees e ON x.paid_by = e.id
                   LEFT JOIN stations s ON x.station_id = s.id`;
      const clauses: string[] = [];
      if (where) clauses.push(where.replace(/^WHERE /, ''));
      if (category) {
        clauses.push('x.category = ?');
        params.push(category);
      }
      if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
      query += ` ORDER BY x.id DESC LIMIT 500`;
      res.json(db.prepare(query).all(...params));
    })
  );

  router.post(
    '/finance/expenses',
    handle((req, res) => {
      const body = req.body ?? {};
      const amount = Number(body.amount);
      if (!amount || amount <= 0) throw badRequest('Số tiền chi phải lớn hơn 0');
      if (!body.paid_to) throw badRequest('Đơn vị/nhà cung cấp nhận chi là bắt buộc');
      const date = body.expense_date || today();
      const code = body.expense_code || expenseCode(db, date);
      const insert = db
        .prepare(
          `INSERT INTO expense_transactions
            (expense_code, category, amount, paid_to, paid_by, station_id, payment_method, expense_date, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          code,
          body.category || 'OTHER',
          amount,
          body.paid_to,
          body.paid_by ? Number(body.paid_by) : null,
          body.station_id ? Number(body.station_id) : null,
          body.payment_method || 'CASH',
          date,
          body.note || ''
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  router.put(
    '/finance/expenses/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = ['category', 'amount', 'paid_to', 'paid_by', 'station_id', 'payment_method', 'expense_date', 'note'];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (!sets.length) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE expense_transactions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy phiếu chi');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/finance/expenses/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`DELETE FROM expense_transactions WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy phiếu chi');
      res.json({ success: true, id });
    })
  );

  // --- Cash summary ---
  router.get(
    '/finance/summary',
    handle((req, res) => {
      const { month } = req.query as Record<string, string | undefined>;
      const key = month || new Date().toISOString().slice(0, 7);
      const revenue = db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM revenue_transactions WHERE strftime('%Y-%m', transaction_date) = ?`
        )
        .get(key) as { total: number };
      const expense = db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM expense_transactions WHERE strftime('%Y-%m', expense_date) = ?`
        )
        .get(key) as { total: number };
      const byType = db
        .prepare(
          `SELECT transaction_type as label, COALESCE(SUM(amount),0) as value
           FROM revenue_transactions WHERE strftime('%Y-%m', transaction_date) = ?
           GROUP BY transaction_type ORDER BY value DESC`
        )
        .all(key);
      const byCategory = db
        .prepare(
          `SELECT category as label, COALESCE(SUM(amount),0) as value
           FROM expense_transactions WHERE strftime('%Y-%m', expense_date) = ?
           GROUP BY category ORDER BY value DESC`
        )
        .all(key);
      res.json({
        month: key,
        totalRevenue: revenue.total,
        totalExpense: expense.total,
        profit: revenue.total - expense.total,
        byType,
        byCategory,
      });
    })
  );

  return router;
}
