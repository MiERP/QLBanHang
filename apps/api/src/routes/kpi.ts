import { Router } from 'express';
import { getDb } from '../db.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

function gradeFor(completion: number): string {
  if (completion >= 120) return 'A_PLUS';
  if (completion >= 100) return 'A';
  if (completion >= 85) return 'B';
  if (completion >= 70) return 'C';
  return 'D';
}

export function kpiRouter(): Router {
  const router = Router();
  const db = getDb();

  const currentMonth = () => new Date().toISOString().slice(0, 7);

  router.get(
    '/kpi/records',
    handle((req, res) => {
      const month = (req.query.month as string) || currentMonth();
      const records = db
        .prepare(
          `SELECT k.*, e.full_name as employee_name, e.position, e.commission_rate,
                  r.name as role_name, s.name as station_name
           FROM kpi_evaluations k
           JOIN employees e ON k.employee_id = e.id
           LEFT JOIN roles r ON e.role_id = r.id
           LEFT JOIN stations s ON e.station_id = s.id
           WHERE k.evaluation_month = ?
           ORDER BY k.completion_percentage DESC`
        )
        .all(month);
      res.json(records);
    })
  );

  router.get(
    '/kpi/overview',
    handle((req, res) => {
      const month = (req.query.month as string) || currentMonth();
      const records = db
        .prepare(`SELECT * FROM kpi_evaluations WHERE evaluation_month = ?`)
        .all(month) as Record<string, number>[];
      const totalEmployees = records.length;
      const avgCompletion = totalEmployees
        ? Number((records.reduce((acc, r) => acc + Number(r.completion_percentage), 0) / totalEmployees).toFixed(1))
        : 0;
      const totalBonus = records.reduce((acc, r) => acc + Number(r.bonus_amount), 0);
      const totalTargetWater = records.reduce((acc, r) => acc + Number(r.target_water_revenue), 0);
      const totalActualWater = records.reduce((acc, r) => acc + Number(r.actual_water_revenue), 0);
      const totalTargetDvgt = records.reduce((acc, r) => acc + Number(r.target_dvgt_revenue), 0);
      const totalActualDvgt = records.reduce((acc, r) => acc + Number(r.actual_dvgt_revenue), 0);
      const totalTargetBottles = records.reduce((acc, r) => acc + Number(r.target_bottle_delivery), 0);
      const totalActualBottles = records.reduce((acc, r) => acc + Number(r.actual_bottle_delivery), 0);
      res.json({
        month,
        totalEmployees,
        avgCompletion,
        totalBonus,
        totalTargetWater,
        totalActualWater,
        totalTargetDvgt,
        totalActualDvgt,
        totalTargetBottles,
        totalActualBottles,
      });
    })
  );

  router.post(
    '/kpi/records',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.employee_id) throw badRequest('Nhân viên là bắt buộc');
      const month = body.evaluation_month || currentMonth();
      const existing = db
        .prepare(`SELECT id FROM kpi_evaluations WHERE employee_id = ? AND evaluation_month = ?`)
        .get(Number(body.employee_id), month);
      if (existing) throw badRequest('Đã tồn tại chỉ tiêu KPI cho nhân viên trong tháng này');

      const insert = db
        .prepare(
          `INSERT INTO kpi_evaluations
            (employee_id, evaluation_month, target_water_revenue, target_dvgt_revenue, target_bottle_delivery, target_new_customers)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          Number(body.employee_id),
          month,
          Number(body.target_water_revenue) || 0,
          Number(body.target_dvgt_revenue) || 0,
          Number(body.target_bottle_delivery) || 0,
          Number(body.target_new_customers) || 0
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid) });
    })
  );

  router.put(
    '/kpi/records/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'target_water_revenue',
        'target_dvgt_revenue',
        'target_bottle_delivery',
        'target_new_customers',
        'is_approved',
        'approved_by',
      ];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (body.is_approved !== undefined) {
        sets.push(`approved_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END`);
        values.push(body.is_approved ? 1 : 0);
      }
      if (!sets.length) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE kpi_evaluations SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy bản ghi KPI');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/kpi/records/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`DELETE FROM kpi_evaluations WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy bản ghi KPI');
      res.json({ success: true, id });
    })
  );

  router.post(
    '/kpi/recompute',
    handle((req, res) => {
      const month = (req.body?.month as string) || currentMonth();
      const records = db.prepare(`SELECT * FROM kpi_evaluations WHERE evaluation_month = ?`).all(month) as Record<
        string,
        number
      >[];

      const waterStmt = db.prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as orders
         FROM orders
         WHERE seller_employee_id = ? AND strftime('%Y-%m', order_date) = ? AND order_status != 'CANCELLED'`
      );
      const bottleStmt = db.prepare(
        `SELECT COALESCE(SUM(oi.quantity), 0) as total
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.shipper_employee_id = ? AND strftime('%Y-%m', o.order_date) = ? AND o.order_status != 'CANCELLED'`
      );
      const dvgtStmt = db.prepare(
        `SELECT COALESCE(SUM(revenue_amount), 0) as total
         FROM dvgt_requests
         WHERE seller_employee_id = ? AND status = 'COMPLETED' AND strftime('%Y-%m', COALESCE(completed_date, scheduled_date)) = ?`
      );
      const newCustomerStmt = db.prepare(
        `SELECT COUNT(*) as total FROM customers WHERE strftime('%Y-%m', created_at) = ?`
      );

      const update = db.prepare(
        `UPDATE kpi_evaluations
         SET actual_water_revenue = ?, actual_bottle_delivery = ?, actual_dvgt_revenue = ?,
             actual_new_customers = ?, completion_percentage = ?, grade = ?, bonus_amount = ?
         WHERE id = ?`
      );

      db.transaction(() => {
        for (const record of records) {
          const employeeId = Number(record.employee_id);
          const commission = db.prepare(`SELECT commission_rate FROM employees WHERE id = ?`).get(employeeId) as
            | { commission_rate: number }
            | undefined;
          const water = (waterStmt.get(employeeId, month) as { total: number }).total;
          const bottles = (bottleStmt.get(employeeId, month) as { total: number }).total;
          const dvgt = (dvgtStmt.get(employeeId, month) as { total: number }).total;
          const newCustomers = employeeId === 1 ? (newCustomerStmt.get(month) as { total: number }).total : 0;

          const ratios: number[] = [];
          if (Number(record.target_water_revenue) > 0) ratios.push(water / Number(record.target_water_revenue));
          if (Number(record.target_dvgt_revenue) > 0) ratios.push(dvgt / Number(record.target_dvgt_revenue));
          if (Number(record.target_bottle_delivery) > 0) ratios.push(bottles / Number(record.target_bottle_delivery));
          const completion = ratios.length ? Number(((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100).toFixed(1)) : 0;
          const grade = gradeFor(completion);
          const bonus = Math.round((commission?.commission_rate ?? 0) * water);

          update.run(water, bottles, dvgt, newCustomers, completion, grade, bonus, record.id);
        }
      })();

      res.json({ success: true, month, updated: records.length });
    })
  );

  return router;
}
