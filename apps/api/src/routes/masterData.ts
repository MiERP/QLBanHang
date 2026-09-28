import { Router } from 'express';
import Database from 'better-sqlite3';
import { getDb } from '../db.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { nextCode } from '../lib/codes.js';

type FieldType = 'string' | 'number' | 'boolean';

interface FieldDef {
  name: string;
  type?: FieldType;
}

export interface CrudConfig {
  base: string;
  /** Tên nghiệp vụ, dùng để mô tả trong nhật ký hệ thống. */
  label: string;
  table: string;
  fields: FieldDef[];
  required?: string[];
  softDelete?: boolean;
  listSql?: string;
  orderBy?: string;
  autoCode?: { column: string; prefix: string; width?: number };
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
      const body = { ...(req.body ?? {}) } as Record<string, unknown>;
      if (cfg.autoCode && !body[cfg.autoCode.column]) {
        body[cfg.autoCode.column] = nextCode(db, {
          table,
          column: cfg.autoCode.column,
          prefix: cfg.autoCode.prefix,
          width: cfg.autoCode.width,
        });
      }
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

export const MASTER_DATA_CONFIGS: CrudConfig[] = [
  {
    base: '/org-units',
    label: 'Đơn vị',
    table: 'org_units',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'parent_id', type: 'number' },
      { name: 'unit_type' },
      { name: 'manager_employee_id', type: 'number' },
      { name: 'sort_order', type: 'number' },
      { name: 'is_active', type: 'boolean' },
    ],
    required: ['name'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'DV-', width: 3 },
    listSql: `SELECT ou.*, e.full_name as manager_name, p.name as parent_name
              FROM org_units ou
              LEFT JOIN employees e ON ou.manager_employee_id = e.id
              LEFT JOIN org_units p ON ou.parent_id = p.id
              WHERE ou.is_active = 1
              ORDER BY ou.sort_order ASC, ou.id ASC`,
  },

  {
    base: '/import-sources',
    label: 'Nguồn nhập',
    table: 'import_sources',
    fields: [{ name: 'code' }, { name: 'name' }, { name: 'note' }, { name: 'is_active', type: 'boolean' }],
    required: ['name'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'NG-', width: 3 },
  },

  {
    base: '/positions',
    label: 'Chức vụ',
    table: 'positions',
    fields: [{ name: 'code' }, { name: 'name' }, { name: 'note' }, { name: 'is_active', type: 'boolean' }],
    required: ['name'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'CV-', width: 3 },
  },

  {
    base: '/partner-units',
    label: 'Đối tác liên kết',
    table: 'partner_units',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'contact_person' },
      { name: 'phone' },
      { name: 'address' },
      { name: 'is_active', type: 'boolean' },
      { name: 'note' },
    ],
    required: ['name'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'DT-', width: 3 },
  },

  {
    base: '/categories',
    label: 'Nhóm hàng',
    table: 'categories',
    fields: [{ name: 'code' }, { name: 'name' }, { name: 'type' }],
    required: ['code', 'name', 'type'],
  },

  {
    base: '/warehouses',
    label: 'Kho',
    table: 'warehouses',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'type' },
      { name: 'manager_employee_id', type: 'number' },
      { name: 'location' },
      { name: 'is_active', type: 'boolean' },
    ],
    required: ['name', 'type'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'KHO-', width: 3 },
    listSql: `SELECT w.*, e.full_name as manager_name FROM warehouses w LEFT JOIN employees e ON w.manager_employee_id = e.id ORDER BY w.id ASC`,
  },

  {
    base: '/customer-groups',
    label: 'Nhóm khách hàng',
    table: 'customer_groups',
    fields: [{ name: 'code' }, { name: 'name' }],
    required: ['code', 'name'],
  },

  {
    base: '/shell-deposits',
    label: 'Cọc vỏ bình',
    table: 'shell_deposits',
    fields: [{ name: 'bottle_type' }, { name: 'deposit_fee', type: 'number' }, { name: 'note' }],
    required: ['bottle_type'],
    orderBy: 'bottle_type ASC',
  },

  {
    base: '/vat-rates',
    label: 'Thuế suất VAT',
    table: 'vat_rates',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'rate', type: 'number' },
      { name: 'effective_from' },
      { name: 'effective_to' },
      { name: 'note' },
    ],
    required: ['code', 'name', 'rate'],
    orderBy: 'effective_from DESC, id DESC',
  },

  {
    base: '/service-jobs',
    label: 'Yêu cầu dịch vụ',
    table: 'service_jobs',
    fields: [
      { name: 'code' },
      { name: 'service_date' },
      { name: 'customer_id', type: 'number' },
      { name: 'employee_id', type: 'number' },
      { name: 'product_id', type: 'number' },
      { name: 'quantity', type: 'number' },
      { name: 'amount', type: 'number' },
      { name: 'note' },
    ],
    required: ['service_date', 'amount'],
    autoCode: { column: 'code', prefix: 'DV-', width: 3 },
    listSql: `SELECT sj.*, c.name as customer_name, e.full_name as employee_name, p.name as product_name, p.unit
              FROM service_jobs sj
              LEFT JOIN customers c ON sj.customer_id = c.id
              LEFT JOIN employees e ON sj.employee_id = e.id
              LEFT JOIN products p ON sj.product_id = p.id
              ORDER BY sj.service_date DESC, sj.id DESC`,
  },

  {
    base: '/price-list',
    label: 'Bảng giá',
    table: 'price_list',
    fields: [
      { name: 'product_id', type: 'number' },
      { name: 'category_id', type: 'number' },
      { name: 'customer_group_id', type: 'number' },
      { name: 'unit_price', type: 'number' },
      { name: 'effective_date' },
      { name: 'is_active', type: 'boolean' },
      { name: 'note' },
    ],
    required: ['unit_price'],
    softDelete: true,
    listSql: `SELECT pl.*, p.name as product_name, c.name as category_name, g.name as customer_group_name
              FROM price_list pl
              LEFT JOIN products p ON pl.product_id = p.id
              LEFT JOIN categories c ON pl.category_id = c.id
              LEFT JOIN customer_groups g ON pl.customer_group_id = g.id
              ORDER BY pl.id DESC`,
  },

  {
    base: '/shipping-fees',
    label: 'Tuyến phí vận chuyển',
    table: 'shipping_fees',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'fee_per_unit', type: 'number' },
      { name: 'is_active', type: 'boolean' },
      { name: 'note' },
    ],
    required: ['name'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'VC-', width: 3 },
  },

  {
    base: '/promotions',
    label: 'Khuyến mãi',
    table: 'promotions',
    fields: [
      { name: 'code' },
      { name: 'name' },
      { name: 'product_id', type: 'number' },
      { name: 'category_id', type: 'number' },
      { name: 'buy_quantity', type: 'number' },
      { name: 'free_quantity', type: 'number' },
      { name: 'free_product_id', type: 'number' },
      { name: 'start_date' },
      { name: 'end_date' },
      { name: 'is_active', type: 'boolean' },
      { name: 'note' },
    ],
    required: ['name', 'buy_quantity', 'free_quantity'],
    softDelete: true,
    autoCode: { column: 'code', prefix: 'KM-', width: 3 },
    listSql: `SELECT pr.*, p.name as product_name, c.name as category_name, fp.name as free_product_name
              FROM promotions pr
              LEFT JOIN products p ON pr.product_id = p.id
              LEFT JOIN categories c ON pr.category_id = c.id
              LEFT JOIN products fp ON pr.free_product_id = fp.id
              ORDER BY pr.id DESC`,
  },
];

export function masterDataRouter(): Router {
  const router = Router();
  const db = getDb();
  for (const cfg of MASTER_DATA_CONFIGS) registerCrud(router, db, cfg);
  return router;
}
