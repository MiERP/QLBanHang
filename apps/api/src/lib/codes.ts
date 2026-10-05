import Database from 'better-sqlite3';

interface NextCodeOptions {
  table: string;
  column: string;
  prefix: string;
  width?: number;
}

export function nextCode(db: Database.Database, { table, column, prefix, width = 3 }: NextCodeOptions): string {
  const rows = db.prepare(`SELECT ${column} AS code FROM ${table} WHERE ${column} LIKE ?`).all(`${prefix}%`) as { code: string }[];
  let max = 0;
  for (const row of rows) {
    const tail = row.code.slice(prefix.length);
    const digits = (tail.match(/\d+/g) || []).join('');
    const value = digits ? parseInt(digits.slice(-9), 10) : 0;
    if (!Number.isNaN(value)) max = Math.max(max, value);
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}

// Ngày/giờ nghiệp vụ luôn tính theo giờ Việt Nam (UTC+7), KHÔNG theo múi giờ của máy chủ:
// VPS thường chạy UTC nên từ 00:00 đến 07:00 giờ Việt Nam, ngày theo giờ máy vẫn là hôm trước —
// hóa đơn, phiếu thu và ngày đơn sẽ bị lùi một ngày.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function vnParts(date?: string): { year: number; month: number; day: number } {
  const raw = date ? new Date(date) : new Date();
  const d = Number.isNaN(raw.getTime()) ? new Date() : raw;
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  return { year: vn.getUTCFullYear(), month: vn.getUTCMonth() + 1, day: vn.getUTCDate() };
}

export function dateKey(date?: string): string {
  // Chuỗi ngày thuần đã là ngày nghiệp vụ, giữ nguyên (new Date('2026-09-30') hiểu là UTC nên dễ lệch).
  if (date && DATE_ONLY.test(date)) return date.replace(/-/g, '');
  const { year, month, day } = vnParts(date);
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

export function today(date?: string): string {
  if (date && DATE_ONLY.test(date)) return date;
  const { year, month, day } = vnParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Mốc thời gian nghiệp vụ 'YYYY-MM-DD HH:MM:SS' theo giờ Việt Nam — dùng làm created_at cho các
// bút toán kho/vỏ để nhật ký theo ngày và báo cáo đối soát cắt ngày đúng theo giờ Việt Nam.
export function nowStamp(date?: string): string {
  if (date && DATE_ONLY.test(date)) return `${date} 00:00:00`;
  const raw = date ? new Date(date) : new Date();
  const d = Number.isNaN(raw.getTime()) ? new Date() : raw;
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  const time = `${String(vn.getUTCHours()).padStart(2, '0')}:${String(vn.getUTCMinutes()).padStart(2, '0')}:${String(
    vn.getUTCSeconds()
  ).padStart(2, '0')}`;
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}-${String(vn.getUTCDate()).padStart(
    2,
    '0'
  )} ${time}`;
}

export const orderCode = (db: Database.Database, date?: string) =>
  nextCode(db, { table: 'orders', column: 'order_code', prefix: `DH-${dateKey(date)}-`, width: 2 });

export const dispatchCode = (db: Database.Database, date?: string) =>
  nextCode(db, { table: 'delivery_dispatches', column: 'dispatch_code', prefix: `DP-${dateKey(date)}-`, width: 2 });

export const revenueCode = (db: Database.Database, date?: string) =>
  nextCode(db, { table: 'revenue_transactions', column: 'transaction_code', prefix: `PT-${dateKey(date)}-`, width: 3 });

export const expenseCode = (db: Database.Database, date?: string) =>
  nextCode(db, { table: 'expense_transactions', column: 'expense_code', prefix: `PC-${dateKey(date)}-`, width: 3 });

export const customerCode = (db: Database.Database) =>
  nextCode(db, { table: 'customers', column: 'code', prefix: 'KH', width: 3 });

export const staffCode = (db: Database.Database) =>
  nextCode(db, { table: 'employees', column: 'code', prefix: 'NV', width: 3 });

export const productCode = (db: Database.Database) =>
  nextCode(db, { table: 'products', column: 'code', prefix: 'SP', width: 4 });
