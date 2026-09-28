import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db.js';
import { IMPORT_SPECS, isImportKind } from './importSpecs.js';
import { MASTER_DATA_CONFIGS } from '../routes/masterData.js';

type Row = Record<string, unknown>;

interface DescribeContext {
  req: Request;
  before: Row[];
  after: Row[];
  payload: unknown;
}

interface AuditSpec {
  method: 'POST' | 'PUT' | 'DELETE';
  /** Nhóm bắt đầu tiên (nếu có) là id bản ghi nằm trên đường dẫn. */
  path: RegExp;
  entity: string;
  action: string | ((req: Request) => string);
  table?: string;
  /** Ghi đè khi id không nằm trên đường dẫn (thao tác hàng loạt). */
  ids?: (req: Request) => number[];
  createdId?: (payload: unknown) => number | undefined;
  codeColumn?: string;
  describe?: (ctx: DescribeContext) => string;
}

const STATUS_ACTION: Record<string, string> = {
  DRAFT: 'Đưa về nháp',
  CHECKING: 'Kiểm tra hàng',
  CONFIRMED: 'Xác nhận',
  SHIPPING: 'Giao hàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Hủy',
};

const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));

const bodyIds = (req: Request): number[] => {
  const raw = (req.body as { ids?: unknown } | undefined)?.ids;
  return Array.isArray(raw) ? raw.map(Number).filter(Boolean) : [];
};

const idOf = (payload: unknown) => {
  const value = (payload as Row | undefined)?.id;
  return typeof value === 'number' ? value : undefined;
};

const orderIdOf = (payload: unknown) => {
  const value = (payload as Row | undefined)?.orderId;
  return typeof value === 'number' ? value : undefined;
};

const statusAction = (req: Request) => STATUS_ACTION[str((req.body as Row | undefined)?.status)] ?? 'Đổi trạng thái';

const entitySpecs: AuditSpec[] = [
  // --- Đơn hàng ---
  { method: 'POST', path: /^\/orders$/, entity: 'Đơn hàng', action: 'Tạo', table: 'orders', createdId: orderIdOf, codeColumn: 'order_code' },
  { method: 'POST', path: /^\/orders\/(\d+)\/status$/, entity: 'Đơn hàng', action: statusAction, table: 'orders', codeColumn: 'order_code' },
  { method: 'POST', path: /^\/orders\/(\d+)\/return$/, entity: 'Đơn hàng', action: 'Hàng hoàn', table: 'orders', codeColumn: 'order_code' },
  { method: 'PUT', path: /^\/orders\/(\d+)\/shippers$/, entity: 'Đơn hàng', action: 'Gán người giao', table: 'orders', codeColumn: 'order_code' },
  { method: 'PUT', path: /^\/orders\/(\d+)$/, entity: 'Đơn hàng', action: 'Sửa', table: 'orders', codeColumn: 'order_code' },
  {
    method: 'POST',
    path: /^\/orders\/bulk-status$/,
    entity: 'Đơn hàng',
    action: statusAction,
    table: 'orders',
    ids: bodyIds,
    codeColumn: 'order_code',
  },
  {
    method: 'POST',
    path: /^\/orders\/bulk-delete$/,
    entity: 'Đơn hàng',
    action: 'Xóa',
    table: 'orders',
    ids: bodyIds,
    codeColumn: 'order_code',
  },
  {
    method: 'POST',
    path: /^\/orders\/merge$/,
    entity: 'Đơn hàng',
    action: 'Gộp',
    table: 'orders',
    ids: bodyIds,
    createdId: orderIdOf,
    codeColumn: 'order_code',
    describe: ({ before, payload }) => `Gộp ${before.length} đơn thành ${str((payload as Row | undefined)?.orderCode)}`.trim(),
  },

  // --- Phiếu kho ---
  { method: 'POST', path: /^\/stock-tickets$/, entity: 'Phiếu kho', action: 'Tạo', table: 'stock_tickets', createdId: idOf, codeColumn: 'code' },
  { method: 'PUT', path: /^\/stock-tickets\/(\d+)$/, entity: 'Phiếu kho', action: 'Sửa', table: 'stock_tickets', codeColumn: 'code' },
  { method: 'POST', path: /^\/stock-tickets\/(\d+)\/status$/, entity: 'Phiếu kho', action: statusAction, table: 'stock_tickets', codeColumn: 'code' },
  { method: 'DELETE', path: /^\/stock-tickets\/(\d+)$/, entity: 'Phiếu kho', action: 'Xóa', table: 'stock_tickets', codeColumn: 'code' },
  {
    method: 'POST',
    path: /^\/stock-tickets\/stock-count$/,
    entity: 'Kiểm kê kho',
    action: 'Lập',
    describe: ({ payload }) => {
      const out = payload as Row | undefined;
      const tickets = Array.isArray(out?.tickets) ? (out?.tickets as unknown[]).map(str).filter(Boolean) : [];
      const parts = [`${Number(out?.surplus) || 0} mặt hàng thừa`, `${Number(out?.shortage) || 0} mặt hàng thiếu`];
      return `Lập kiểm kê kho: ${parts.join(', ')}${tickets.length ? ` (phiếu ${tickets.join(', ')})` : ''}`;
    },
  },

  // --- Khách hàng ---
  { method: 'POST', path: /^\/customers$/, entity: 'Khách hàng', action: 'Tạo', table: 'customers', createdId: idOf, codeColumn: 'code' },
  { method: 'PUT', path: /^\/customers\/(\d+)$/, entity: 'Khách hàng', action: 'Sửa', table: 'customers', codeColumn: 'code' },
  { method: 'DELETE', path: /^\/customers\/(\d+)$/, entity: 'Khách hàng', action: 'Xóa', table: 'customers', codeColumn: 'code' },
  { method: 'POST', path: /^\/customers\/(\d+)\/bottle-return$/, entity: 'Khách hàng', action: 'Thu hồi vỏ', table: 'customers', codeColumn: 'code' },

  // --- Sản phẩm ---
  { method: 'POST', path: /^\/products$/, entity: 'Sản phẩm', action: 'Tạo', table: 'products', createdId: idOf, codeColumn: 'code' },
  { method: 'PUT', path: /^\/products\/(\d+)$/, entity: 'Sản phẩm', action: 'Sửa', table: 'products', codeColumn: 'code' },
  { method: 'DELETE', path: /^\/products\/(\d+)$/, entity: 'Sản phẩm', action: 'Xóa', table: 'products', codeColumn: 'code' },

  // --- Nhân viên ---
  { method: 'POST', path: /^\/staff$/, entity: 'Nhân viên', action: 'Tạo', table: 'employees', createdId: idOf, codeColumn: 'code' },
  { method: 'PUT', path: /^\/staff\/(\d+)$/, entity: 'Nhân viên', action: 'Sửa', table: 'employees', codeColumn: 'code' },
  { method: 'DELETE', path: /^\/staff\/(\d+)$/, entity: 'Nhân viên', action: 'Xóa', table: 'employees', codeColumn: 'code' },

  // --- Chỉ tiêu ---
  { method: 'POST', path: /^\/targets$/, entity: 'Chỉ tiêu', action: 'Giao', table: 'targets', createdId: idOf },
  { method: 'PUT', path: /^\/targets\/(\d+)$/, entity: 'Chỉ tiêu', action: 'Sửa', table: 'targets' },

  // --- Hóa đơn ---
  { method: 'POST', path: /^\/invoices$/, entity: 'Hóa đơn', action: 'Xuất', table: 'invoices', createdId: idOf, codeColumn: 'invoice_code' },

  // --- Dòng tiền cọc ---
  {
    method: 'POST',
    path: /^\/deposits$/,
    entity: 'Phiếu cọc',
    action: (req) => (str((req.body as Row | undefined)?.transaction_type) === 'REFUND' ? 'Hoàn cọc' : 'Thu cọc'),
    table: 'deposit_transactions',
    createdId: idOf,
    codeColumn: 'transaction_code',
  },

  // --- Quyết toán mượn ---
  { method: 'POST', path: /^\/loans\/(\d+)\/settle$/, entity: 'Đơn mượn', action: 'Quyết toán', table: 'orders', codeColumn: 'order_code' },

  // --- Nhập Excel ---
  {
    method: 'POST',
    path: /^\/imports\/[^/]+$/,
    entity: 'Nhập Excel',
    action: 'Nhập',
    describe: ({ req, payload }) => {
      const kind = String(req.path.split('/')[2] ?? '');
      const title = isImportKind(kind) ? IMPORT_SPECS[kind].title : kind;
      const out = payload as Row | undefined;
      const imported = Number(out?.imported) || 0;
      const updated = Number(out?.updated) || 0;
      return `Nhập Excel ${title}: thêm mới ${imported}, cập nhật ${updated}`;
    },
  },
];

// Một quy tắc chung phủ toàn bộ danh mục hệ thống — lấy từ chính cấu hình CRUD, không chép tay.
const catalogSpecs: AuditSpec[] = MASTER_DATA_CONFIGS.flatMap((cfg) => [
  {
    method: 'POST' as const,
    path: new RegExp(`^${cfg.base}$`),
    entity: cfg.label,
    action: 'Tạo',
    table: cfg.table,
    createdId: idOf,
    codeColumn: 'code',
  },
  {
    method: 'PUT' as const,
    path: new RegExp(`^${cfg.base}/(\\d+)$`),
    entity: cfg.label,
    action: 'Sửa',
    table: cfg.table,
    codeColumn: 'code',
  },
  {
    method: 'DELETE' as const,
    path: new RegExp(`^${cfg.base}/(\\d+)$`),
    entity: cfg.label,
    action: 'Xóa',
    table: cfg.table,
    codeColumn: 'code',
  },
]);

const AUDIT_SPECS: AuditSpec[] = [...entitySpecs, ...catalogSpecs];

const MAX_JSON = 200_000;

function loadRows(table: string, ids: number[]): Row[] {
  if (!ids.length) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM ${table} WHERE id IN (${placeholders})`).all(...ids) as Row[];
}

function codesOf(spec: AuditSpec, rows: Row[]): string[] {
  const column = spec.codeColumn;
  if (!column) return [];
  return rows.map((row) => str(row[column])).filter(Boolean);
}

function defaultDescribe(spec: AuditSpec, action: string, rows: Row[]): string {
  const label = spec.entity.toLowerCase();
  if (!rows.length) return `${action} ${label}`;
  const codes = codesOf(spec, rows);
  if (rows.length === 1) return `${action} ${label}${codes[0] ? ` ${codes[0]}` : ''}`;
  return `${action} ${rows.length} ${label}${codes.length ? `: ${codes.join(', ')}` : ''}`;
}

function write(row: {
  action: string;
  entity: string;
  entityId: string | null;
  entityCode: string | null;
  description: string;
  method: string;
  path: string;
  before: Row[];
  after: Row[];
}) {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (actor, action, entity, entity_id, entity_code, description, method, path, before_json, after_json)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.action,
      row.entity,
      row.entityId,
      row.entityCode,
      row.description,
      row.method,
      row.path,
      row.before.length ? JSON.stringify(row.before) : null,
      row.after.length ? JSON.stringify(row.after) : null
    );
}

function record(spec: AuditSpec, req: Request, match: RegExpMatchArray, before: Row[], payload: unknown) {
  const fromPath = match[1] ? [Number(match[1])] : [];
  const targets = spec.ids ? spec.ids(req) : fromPath;
  const created = spec.createdId ? spec.createdId(payload) : undefined;
  const afterIds = [...new Set([...targets, ...(typeof created === 'number' ? [created] : [])])];
  const after = spec.table ? loadRows(spec.table, afterIds) : [];

  const action = typeof spec.action === 'function' ? spec.action(req) : spec.action;
  const rows = after.length ? after : before;
  const codes = codesOf(spec, rows);
  const description = spec.describe ? spec.describe({ req, before, after, payload }) : defaultDescribe(spec, action, rows);

  const beforeJson = before.length ? JSON.stringify(before) : null;
  const afterJson = after.length ? JSON.stringify(after) : null;

  write({
    action,
    entity: spec.entity,
    entityId: targets.length ? targets.join(',') : created !== undefined ? String(created) : null,
    entityCode: codes.length <= 3 ? codes.join(', ') || null : `${codes.length} bản ghi`,
    description,
    method: req.method,
    path: req.originalUrl || req.path,
    before: beforeJson && beforeJson.length <= MAX_JSON ? before : [],
    after: afterJson && afterJson.length <= MAX_JSON ? after : [],
  });
}

/**
 * Ghi nhật ký mọi thao tác ghi dữ liệu. Đặt TRƯỚC các router vì handler thành công không gọi `next()`.
 * Bọc `res.json` để biết kết quả, chụp bản ghi trước/sau. Lỗi nhật ký không được làm hỏng nghiệp vụ.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const spec = AUDIT_SPECS.find((item) => item.method === req.method && item.path.test(req.path));
  if (!spec) return next();

  const match = req.path.match(spec.path)!;
  const targets = spec.ids ? spec.ids(req) : match[1] ? [Number(match[1])] : [];
  const before = spec.table ? loadRows(spec.table, targets) : [];

  const originalJson = res.json.bind(res);
  res.json = (payload: unknown) => {
    try {
      if (res.statusCode < 400) record(spec, req, match, before, payload);
    } catch {
      // Nhật ký là phụ — không được chặn thao tác nghiệp vụ.
    }
    return originalJson(payload);
  };

  next();
}
