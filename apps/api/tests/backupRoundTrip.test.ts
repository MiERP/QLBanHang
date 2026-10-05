import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import Database from 'better-sqlite3';

// CSDL dùng một lần: schema + dữ liệu mẫu + dữ liệu "khó" để kiểm tra xuất/nhập trung thực.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-roundtrip-'));
process.env.DB_PATH = join(testDir, 'roundtrip.db');
const seedDb = new Database(process.env.DB_PATH);
seedDb.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
seedDb.exec(readFileSync(new URL('../src/seed.sql', import.meta.url), 'utf8'));

// Giá trị dễ mất khi qua Excel: chuỗi rỗng, số 0, số âm, số thực, số lớn, chữ có dấu, xuống dòng, NULL.
seedDb.prepare(`INSERT INTO import_sources (code, name, note) VALUES ('SRC_ZERO', 'Nguồn 00203', '')`).run();
seedDb.prepare(`INSERT INTO import_sources (code, name, note) VALUES ('SRC_EMPTY', '', NULL)`).run();
seedDb.prepare(`INSERT INTO import_sources (code, name, note) VALUES ('SRC_UNI', 'Nhận hàng "đặc biệt" — 100%', 'Dòng 1\nDòng 2')`).run();
seedDb.prepare(`INSERT INTO vat_rates (code, name, rate, effective_from, effective_to, note) VALUES ('VAT0', 'Không chịu thuế', 0, '2026-01-01', NULL, '')`).run();
seedDb.prepare(`INSERT INTO vat_rates (code, name, rate, effective_from, effective_to, note) VALUES ('VAT_NEG', 'Kiểm tra số âm', -1.5, NULL, '2026-12-31', NULL)`).run();
seedDb.prepare(`INSERT INTO app_settings (key, value) VALUES ('test_empty', '')`).run();
seedDb.prepare(`INSERT INTO expense_transactions (expense_code, category, amount, paid_to, payment_method, expense_date, note) VALUES ('PC-0001', 'OTHER', 0, 'Nhà cung cấp 007', 'CASH', '2026-02-03', '')`).run();
seedDb.prepare(`INSERT INTO expense_transactions (expense_code, category, amount, paid_to, payment_method, expense_date, note) VALUES ('PC-0002', 'ELECTRICITY', 1234567.89, 'Điện lực', 'BANK_TRANSFER', '2026-02-28', 'Số 0 đầu: 0203.3826.789')`).run();
seedDb.prepare(`INSERT INTO audit_logs (action, entity, description, method, path, before_json, after_json) VALUES ('Sửa', 'Đơn hàng', 'Đổi 0 → 1', 'PUT', '/api/orders/1', '{"a":0,"b":null}', '{"a":1,"b":""}')`).run();
seedDb.prepare(`INSERT INTO price_list (product_id, customer_group_id, unit_price, effective_date, is_active) VALUES (1, 1, 0, '2026-03-01', 0)`).run();
seedDb.close();

const [{ getDb }, { systemRouter }, { errorMiddleware }] = await Promise.all([
  import('../src/db.js'),
  import('../src/routes/system.js'),
  import('../src/lib/http.js'),
]);
const db = getDb();
const app = express();
app.use(express.json());
app.use('/api', systemRouter());
app.use(errorMiddleware);
const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});

function allTables(): string[] {
  return (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[])
    .map((t) => t.name)
    .sort();
}

// Ảnh chụp toàn bộ CSDL: mỗi bảng là tập dòng đã sắp xếp (không phụ thuộc thứ tự vật lý).
function snapshot(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const table of allTables()) {
    out[table] = (db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[])
      .map((row) => JSON.stringify(row))
      .sort();
  }
  return out;
}

test('Xuất rồi nhập lại giữ nguyên dữ liệu của mọi bảng (round-trip)', async () => {
  const before = snapshot();
  assert.ok(before.orders.length > 0 && before.customers.length > 0, 'Có dữ liệu mẫu để kiểm tra');

  const exported = await fetch(`${base}/system/export.xlsx`);
  assert.equal(exported.status, 200);
  const buffer = Buffer.from(await exported.arrayBuffer());

  // Phá dữ liệu trước khi khôi phục để chắc chắn bản nhập thực sự ghi đè.
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
  db.prepare('DELETE FROM import_sources').run();
  db.pragma('foreign_keys = ON');
  assert.notDeepEqual(snapshot(), before, 'Dữ liệu đã bị thay đổi trước khi nhập lại');

  const imported = await fetch(`${base}/system/import`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: buffer,
  });
  const raw = await imported.text();
  assert.equal(imported.status, 200, raw);

  const after = snapshot();
  for (const table of allTables()) {
    assert.deepEqual(after[table], before[table], `Bảng ${table} phải giữ nguyên sau khi xuất/nhập`);
  }
});

test('Bản xuất có đủ sheet cho mọi bảng và không có bảng nào thiếu cột', async () => {
  const exported = Buffer.from(await (await fetch(`${base}/system/export.xlsx`)).arrayBuffer());
  const imported = await fetch(`${base}/system/import`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: exported,
  });
  const result = (await imported.json()) as { success: boolean; results: { table: string; rows: number; missing: string[] }[] };
  const tables = allTables();
  assert.equal(result.results.length, tables.length, 'Mọi bảng đều có sheet và được nhập');
  assert.deepEqual(result.results.map((r) => r.table).sort(), tables, 'Đúng danh sách bảng');
  const broken = result.results.filter((r) => r.missing.length);
  assert.deepEqual(broken, [], 'Không bảng nào thiếu cột so với CSDL');
});

test('Tệp không phải bản sao lưu thì bị từ chối thay vì báo thành công rỗng', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('BangKhac');
  ws.addRow(['cot_a', 'cot_b']);
  ws.addRow([1, 2]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const res = await fetch(`${base}/system/import`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: buffer,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json() as { error: string }).error, /không có bảng nào khớp/i);
});

test('Bản ghi tạo sau khi nhập nhận ID mới, không đè lên dữ liệu đã khôi phục', async () => {
  const maxCustomerId = (db.prepare('SELECT MAX(id) AS m FROM customers').get() as { m: number }).m;
  const maxOrderCode = (db.prepare('SELECT MAX(id) AS m FROM orders').get() as { m: number }).m;

  const customer = db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-TANG', 'Khách thêm sau', '')`).run();
  const order = db
    .prepare(
      `INSERT INTO orders (order_code, customer_id, seller_employee_id, order_type, warehouse_id, order_date, order_status, subtotal_amount, total_amount)
       VALUES ('DH-TANG', ?, 9, 'SALE', 1, '2026-10-05', 'DRAFT', 0, 0)`
    )
    .run(Number(customer.lastInsertRowid));

  assert.ok(Number(customer.lastInsertRowid) > maxCustomerId, 'Khách mới nhận id lớn hơn id lớn nhất đã nhập');
  assert.ok(Number(order.lastInsertRowid) > maxOrderCode, 'Đơn mới nhận id lớn hơn id lớn nhất đã nhập');
});

test('Nhập cùng một tệp nhiều lần không sinh dòng trùng', async () => {
  const before = snapshot();
  const exported = Buffer.from(await (await fetch(`${base}/system/export.xlsx`)).arrayBuffer());

  for (let lần = 1; lần <= 2; lần++) {
    const res = await fetch(`${base}/system/import`, {
      method: 'POST',
      headers: { 'Content-Type': XLSX_MIME },
      body: exported,
    });
    const result = (await res.json()) as { inserted: number };
    assert.equal(res.status, 200);
    assert.equal(result.inserted, 0, `Lần ${lần}: mọi dòng đều đã tồn tại nên không thêm mới dòng nào`);
  }

  assert.deepEqual(snapshot(), before, 'Số dòng của mọi bảng giữ nguyên sau khi nhập lặp lại');
});

test('Dòng không có ID thì được thêm mới với ID do hệ thống cấp', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const exported = Buffer.from(await (await fetch(`${base}/system/export.xlsx`)).arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(exported as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const sheet = wb.getWorksheet('customers')!;
  const header = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const codeCol = header.indexOf('code') + 1;
  const nameCol = header.indexOf('name') + 1;

  // Thêm 1 dòng mới: bỏ trống ID, đổi mã để không trùng mã đã có.
  const lastRow = sheet.rowCount + 1;
  sheet.getRow(lastRow).getCell(codeCol).value = 'KH-KHONG-ID';
  sheet.getRow(lastRow).getCell(nameCol).value = 'Khách không có ID';
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const maxId = (db.prepare('SELECT MAX(id) AS m FROM customers').get() as { m: number }).m;
  const res = await fetch(`${base}/system/import`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: buffer,
  });
  const result = (await res.json()) as { inserted: number; updated: number };
  assert.equal(res.status, 200);
  assert.ok(result.inserted >= 1, 'Dòng không có ID được thêm mới');

  const created = db.prepare(`SELECT id, name FROM customers WHERE code = 'KH-KHONG-ID'`).get() as { id: number; name: string };
  assert.ok(created, 'Khách mới được tạo');
  assert.ok(created.id > maxId, 'ID do hệ thống cấp, không đè lên bản ghi cũ');
  assert.equal(created.name, 'Khách không có ID');
});
