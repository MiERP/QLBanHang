import { Router } from 'express';
import { getDb } from '../db.js';
import { handle } from '../lib/http.js';

export function auditLogsRouter(): Router {
  const router = Router();
  const db = getDb();

  // Nhật ký chỉ để đọc — không có sửa/xóa để bản ghi còn giá trị truy vết.
  router.get(
    '/audit-logs',
    handle((req, res) => {
      const { from, to, entity } = req.query as Record<string, string | undefined>;
      const limit = Math.min(Number(req.query.limit) || 300, 1000);
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (from) {
        clauses.push('date(occurred_at) >= date(?)');
        params.push(from);
      }
      if (to) {
        clauses.push('date(occurred_at) <= date(?)');
        params.push(to);
      }
      if (entity) {
        clauses.push('entity = ?');
        params.push(entity);
      }

      let query =
        'SELECT id, occurred_at, actor, action, entity, entity_id, entity_code, description, method, path FROM audit_logs';
      if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
      query += ` ORDER BY id DESC LIMIT ${limit}`;

      const rows = db.prepare(query).all(...params);
      const entities = (db.prepare('SELECT DISTINCT entity FROM audit_logs ORDER BY entity ASC').all() as {
        entity: string;
      }[]).map((row) => row.entity);

      res.json({ rows, entities });
    })
  );

  return router;
}
