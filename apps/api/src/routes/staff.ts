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
          `SELECT e.*, s.name as station_name, ou.name as org_unit_name, p.name as position_name
           FROM employees e
           LEFT JOIN stations s ON e.station_id = s.id
           LEFT JOIN org_units ou ON e.org_unit_id = ou.id
           LEFT JOIN positions p ON e.position_id = p.id
           WHERE e.is_active = 1
           ORDER BY e.org_unit_id ASC, e.id ASC`
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
            (org_unit_id, position_id, code, full_name, position, phone, home_address,
             date_of_birth, gender, id_number, join_date, education, commission_rate, shipping_allowance, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          body.org_unit_id ? Number(body.org_unit_id) : null,
          body.position_id ? Number(body.position_id) : null,
          code,
          body.full_name,
          body.position || '',
          body.phone || '',
          body.home_address || '',
          body.date_of_birth || null,
          body.gender || null,
          body.id_number || null,
          body.join_date || null,
          body.education || null,
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
        'org_unit_id',
        'position_id',
        'full_name',
        'position',
        'phone',
        'home_address',
        'date_of_birth',
        'gender',
        'id_number',
        'join_date',
        'education',
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

  return router;
}
