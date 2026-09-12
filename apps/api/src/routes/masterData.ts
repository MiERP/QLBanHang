import { Router } from 'express';
import Database from 'better-sqlite3';
import { getDb } from '../db.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

type FieldType = 'string' | 'number' | 'boolean';

interface FieldDef {
  name: string;
  type?: FieldType;
}

interface CrudConfig {
  base: string;
  table: string;
  fields: FieldDef[];
  required?: string[];
  softDelete?: boolean;
  listSql?: string;
  orderBy?: string;
}

function coerce(value: unknown, type: FieldType): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'number') return Number(value);
  if (type === 'boolean') return value ? 1 : 0;
  return String(value);
}

function registerCrud(router: Router, db: Database.Database, cfg: CrudConfig) {
  const { base, table, fields, required = [], softDelete } = cfg;
  const orderBy = cfg.orderBy ?? 'id ASC';

  router.get(
    base,
    handle((_req, res) => {
      const sql = cfg.listSql ?? `SELECT * FROM ${table} ORDER BY ${orderBy}`;
      res.json(db.prepare(sql).all());
    })
  );

  router.post(
    base,
    handle((req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      for (const key of required) {
        if (body[key] === undefined || body[key] === null || body[key] === '') {
          throw badRequest(`Trường "${key}" là bắt buộc`);
        }
      }
      const cols: string[] = [];
      const placeholders: string[] = [];
      const values: unknown[] = [];
      for (const field of fields) {
        if (body[field.name] === undefined) continue;
        cols.push(field.name);
        placeholders.push('?');
        values.push(coerce(body[field.name], field.type ?? 'string'));
      }
      if (cols.length === 0) throw badRequest('Không có dữ liệu để tạo');
      const result = db
        .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`)
        .run(...values);
      res.json({ success: true, id: Number(result.lastInsertRowid) });
    })
  );

  router.put(
    `${base}/:id`,
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const field of fields) {
        if (body[field.name] === undefined) continue;
        sets.push(`${field.name} = ?`);
        values.push(coerce(body[field.name], field.type ?? 'string'));
      }
      if (sets.length === 0) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy bản ghi');
      res.json({ success: true, id });
    })
  );

  router.delete(
    `${base}/:id`,
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = softDelete
        ? db.prepare(`UPDATE ${table} SET is_active = 0 WHERE id = ?`).run(id)
        : db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy bản ghi');
      res.json({ success: true, id });
    })
  );
}

export function masterDataRouter(): Router {
  const router = Router();
  const db = getDb();

  registerCrud(router, db, {
    base: '/stations',
    table: 'stations',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'address' },
      { name: 'phone' },
    ],
    required: ['code', 'name'],
  });

  registerCrud(router, db, {
    base: '/roles',
    table: 'roles',
    fields: [{ name: 'code' }, { name: 'name' }, { name: 'description' }],
    required: ['code', 'name'],
  });

  registerCrud(router, db, {
    base: '/categories',
    table: 'categories',
    fields: [{ name: 'code' }, { name: 'name' }, { name: 'type' }],
    required: ['code', 'name', 'type'],
  });

  registerCrud(router, db, {
    base: '/warehouses',
    table: 'warehouses',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'type' },
      { name: 'manager_employee_id', type: 'number' },
      { name: 'location' },
      { name: 'is_active', type: 'boolean' },
    ],
    required: ['code', 'name', 'type'],
    softDelete: true,
    listSql: `SELECT w.*, e.full_name as manager_name FROM warehouses w LEFT JOIN employees e ON w.manager_employee_id = e.id ORDER BY w.id ASC`,
  });

  registerCrud(router, db, {
    base: '/partner-branches',
    table: 'partner_branches',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'phone' },
      { name: 'address' },
      { name: 'is_internal', type: 'boolean' },
    ],
    required: ['code', 'name'],
  });

  registerCrud(router, db, {
    base: '/customer-groups',
    table: 'customer_groups',
    fields: [{ name: 'code' }, { name: 'name' }, { name: 'discount_percent', type: 'number' }],
    required: ['code', 'name'],
  });

  registerCrud(router, db, {
    base: '/product-conversions',
    table: 'product_conversions',
    fields: [
      { name: 'from_product_id', type: 'number' },
      { name: 'to_product_id', type: 'number' },
      { name: 'ratio', type: 'number' },
      { name: 'note' },
    ],
    required: ['from_product_id', 'to_product_id', 'ratio'],
    listSql: `SELECT pc.*, f.name as from_product_name, t.name as to_product_name
              FROM product_conversions pc
              LEFT JOIN products f ON pc.from_product_id = f.id
              LEFT JOIN products t ON pc.to_product_id = t.id
              ORDER BY pc.id ASC`,
  });

  return router;
}
