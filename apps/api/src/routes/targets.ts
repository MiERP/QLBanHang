import { Router } from 'express';
import { getDb } from '../db.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { currentReportPeriod } from '../lib/reportPeriod.js';

function gradeFor(completion: number): string {
  if (completion >= 120) return 'A_PLUS';
  if (completion >= 100) return 'A';
  if (completion >= 85) return 'B';
  if (completion >= 70) return 'C';
  return 'D';
}

interface EmployeeRow {
  id: number;
  full_name: string;
  org_unit_id: number | null;
}
interface UnitRow {
  id: number;
  name: string;
  parent_id: number | null;
}

export function targetsRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/targets',
    handle((req, res) => {
      const cur = currentReportPeriod(db);
      const period = (req.query.period as string) || cur.key;
      const m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(period);
      const from = m ? m[1] : cur.from;
      const to = m ? m[2] : cur.to;
      const employees = db
        .prepare(
          `SELECT e.id, e.full_name, e.org_unit_id, ou.name as org_unit_name
           FROM employees e LEFT JOIN org_units ou ON e.org_unit_id = ou.id
           WHERE e.is_active = 1 ORDER BY e.id ASC`
        )
        .all() as (EmployeeRow & { org_unit_name: string | null })[];
      const units = db
        .prepare(`SELECT id, name, parent_id FROM org_units WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`)
        .all() as UnitRow[];
      const targets = db.prepare(`SELECT * FROM targets WHERE period = ?`).all(period) as Record<string, unknown>[];

      const actualByEmployee = new Map<number, number>();
      const rows = db
        .prepare(
          // KPI giữ nguyên giá trị đơn kể cả khi khách đã trả lại hàng: đơn đã hoàn thành nghĩa vụ giao hàng.
          `SELECT seller_employee_id as emp, COALESCE(SUM(subtotal_amount),0) as total
           FROM orders
           WHERE order_type IN ('SALE', 'BORROW_IN') AND order_status IN ('COMPLETED', 'RETURNED')
             AND invoice_status = 'INVOICED'
             AND order_date >= ? AND order_date <= ?
           GROUP BY seller_employee_id`
        )
        .all(from, to) as { emp: number; total: number }[];
      for (const r of rows) actualByEmployee.set(r.emp, r.total);

      const targetByEmployee = new Map<number, Record<string, unknown>>();
      const targetByUnit = new Map<number, Record<string, unknown>>();
      for (const t of targets) {
        if (t.scope_type === 'EMPLOYEE' && t.employee_id != null) targetByEmployee.set(Number(t.employee_id), t);
        else if (t.scope_type === 'UNIT' && t.org_unit_id != null) targetByUnit.set(Number(t.org_unit_id), t);
      }

      const descendants = (rootId: number): Set<number> => {
        const set = new Set<number>([rootId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const u of units) {
            if (u.parent_id != null && set.has(u.parent_id) && !set.has(u.id)) {
              set.add(u.id);
              changed = true;
            }
          }
        }
        return set;
      };

      const calc = (actual: number, target: number) => {
        const completion = target > 0 ? Number(((actual / target) * 100).toFixed(1)) : 0;
        return { actual_revenue: actual, completion_percentage: completion, grade: gradeFor(completion) };
      };

      const employeeRows = employees.map((e) => {
        const t = targetByEmployee.get(e.id);
        const target = t ? Number(t.target_revenue) || 0 : 0;
        const actual = actualByEmployee.get(e.id) ?? 0;
        return {
          scope_type: 'EMPLOYEE',
          employee_id: e.id,
          org_unit_id: e.org_unit_id,
          name: e.full_name,
          org_unit_name: e.org_unit_name,
          target_id: t ? Number(t.id) : null,
          target_revenue: target,
          ...calc(actual, target),
        };
      });

      const unitRows = units.map((u) => {
        const t = targetByUnit.get(u.id);
        const target = t ? Number(t.target_revenue) || 0 : 0;
        const set = descendants(u.id);
        let actual = 0;
        for (const e of employees) if (e.org_unit_id != null && set.has(e.org_unit_id)) actual += actualByEmployee.get(e.id) ?? 0;
        return {
          scope_type: 'UNIT',
          org_unit_id: u.id,
          employee_id: null,
          name: u.name,
          org_unit_name: null,
          target_id: t ? Number(t.id) : null,
          target_revenue: target,
          ...calc(actual, target),
        };
      });

      res.json({ employees: employeeRows, units: unitRows });
    })
  );

  router.post(
    '/targets',
    handle((req, res) => {
      const body = req.body ?? {};
      const period = body.period || currentReportPeriod(db).key;
      const scopeType = body.scope_type === 'UNIT' ? 'UNIT' : 'EMPLOYEE';
      if (scopeType === 'EMPLOYEE' && !body.employee_id) throw badRequest('Chọn nhân viên');
      if (scopeType === 'UNIT' && !body.org_unit_id) throw badRequest('Chọn đơn vị');
      const empId = scopeType === 'EMPLOYEE' ? Number(body.employee_id) : null;
      const unitId = scopeType === 'UNIT' ? Number(body.org_unit_id) : null;
      const scopeColumn = scopeType === 'EMPLOYEE' ? 'employee_id' : 'org_unit_id';
      const scopeValue = scopeType === 'EMPLOYEE' ? empId : unitId;
      const existing = db
        .prepare(`SELECT id FROM targets WHERE period = ? AND scope_type = ? AND ${scopeColumn} = ?`)
        .get(period, scopeType, scopeValue) as { id: number } | undefined;
      if (existing) {
        db.prepare(`UPDATE targets SET target_revenue = ?, note = ? WHERE id = ?`).run(
          Number(body.target_revenue) || 0,
          body.note || '',
          existing.id
        );
        return res.json({ success: true, id: existing.id });
      }
      const insert = db
        .prepare(
          `INSERT INTO targets (period, scope_type, employee_id, org_unit_id, target_revenue, note)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(period, scopeType, empId, unitId, Number(body.target_revenue) || 0, body.note || '');
      res.json({ success: true, id: Number(insert.lastInsertRowid) });
    })
  );

  router.put(
    '/targets/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const result = db
        .prepare(`UPDATE targets SET target_revenue = ?, note = ? WHERE id = ?`)
        .run(Number(body.target_revenue) || 0, body.note || '', id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy chỉ tiêu');
      res.json({ success: true, id });
    })
  );

  return router;
}
