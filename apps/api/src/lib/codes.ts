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

export function dateKey(date?: string): string {
  const d = date ? new Date(date) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = safe.getFullYear();
  const m = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function today(date?: string): string {
  const d = date ? new Date(date) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')}`;
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
