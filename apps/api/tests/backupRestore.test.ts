import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

// CSDL dùng một lần, nạp sẵn schema + dữ liệu mẫu như một bản cài mới — không dính tới CSDL thật.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-backup-'));
process.env.DB_PATH = join(testDir, 'backup.db');
const emptyDb = new Database(process.env.DB_PATH);
emptyDb.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
// Danh mục nền nạp trước vì dữ liệu mẫu tham chiếu ID của nhóm hàng / sản phẩm / nhóm khách hàng.
emptyDb.exec(readFileSync(new URL('../src/catalog.sql', import.meta.url), 'utf8'));
emptyDb.exec(readFileSync(new URL('../src/seed.sql', import.meta.url), 'utf8'));
emptyDb.close();

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

const count = (table: string, where = '') =>
  (db.prepare(`SELECT COUNT(*) AS c FROM "${table}" ${where}`).get() as { c: number }).c;
const codes = (table: string) =>
  (db.prepare(`SELECT code FROM "${table}" ORDER BY code`).all() as { code: string }[]).map((r) => r.code);

test('Xuất toàn bộ dữ liệu ra Excel', async () => {
  db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-1', 'Khách 1', 'Địa chỉ 1')`).run();
  db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-2', 'Khách 2', '')`).run();

  const res = await fetch(`${base}/system/export.xlsx`);
  assert.equal(res.status, 200);
  const buffer = Buffer.from(await res.arrayBuffer());

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  for (const table of ['customers', 'orders', 'products', 'app_settings', 'warehouses']) {
    assert.ok(wb.getWorksheet(table), `Có sheet ${table}`);
  }
  const sheet = wb.getWorksheet('customers')!;
  const header = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  assert.ok(header.includes('code') && header.includes('name'), 'Sheet có đủ cột');
  assert.equal(sheet.rowCount, count('customers') + 1, 'Header + toàn bộ khách hàng');
});

test('Khôi phục theo ID: dòng đã có thì cập nhật, dòng chưa có thì thêm mới, dòng ngoài tệp giữ nguyên', async () => {
  const exported = Buffer.from(await (await fetch(`${base}/system/export.xlsx`)).arrayBuffer());

  // Sau khi sao lưu: sửa KH-1, xoá KH-2, thêm KH-3 (không có trong tệp).
  db.prepare(`UPDATE customers SET name = 'KH-1 bị sửa', address = 'Sai địa chỉ' WHERE code = 'KH-1'`).run();
  db.prepare(`DELETE FROM customers WHERE code = 'KH-2'`).run();
  db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-3', 'Khách 3', '')`).run();

  const res = await fetch(`${base}/system/import`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: exported,
  });
  const raw = await res.text();
  assert.equal(res.status, 200, raw);
  const result = JSON.parse(raw) as { inserted: number; updated: number };
  assert.ok(result.updated > 0, 'Có dòng được cập nhật');
  assert.ok(result.inserted > 0, 'Có dòng được thêm lại');

  const kh1 = db.prepare(`SELECT name, address FROM customers WHERE code = 'KH-1'`).get() as { name: string; address: string };
  assert.equal(kh1.name, 'Khách 1', 'Dòng đã có ID được cập nhật lại theo tệp');
  assert.equal(kh1.address, 'Địa chỉ 1', 'Các cột khác cũng được cập nhật');
  assert.ok(codes('customers').includes('KH-2'), 'Dòng đã bị xoá được thêm lại từ tệp');
  assert.ok(codes('customers').includes('KH-3'), 'Dòng không có trong tệp vẫn được giữ nguyên');
  assert.ok(count('orders') > 0, 'Đơn hàng trong tệp sao lưu vẫn còn');
});

test('Xoá dữ liệu về mặc định: xoá nghiệp vụ, giữ danh mục nền, bật quy tắc vận chuyển', async () => {
  // Trước khi reset: có dữ liệu mẫu, dữ liệu vừa thao tác và danh mục nền.
  assert.ok(count('customers') > 0 && count('employees') > 0 && count('inventory_stock') > 0);
  const productsBefore = count('products');
  const categoriesBefore = count('categories');
  const warehousesBefore = count('warehouses');

  // Danh mục nền do người dùng tự thêm cũng phải được giữ.
  db.prepare(`INSERT INTO price_list (product_id, customer_group_id, unit_price, effective_date) VALUES (1, 1, 99000, '2026-09-01')`).run();
  db.prepare(
    `INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active) VALUES ('KM-GIU', 'Khuyến mãi giữ lại', 1, 5, 1, 1)`
  ).run();
  db.prepare(`UPDATE app_settings SET value = '2026-09-01' WHERE key = 'report_period_from'`).run();

  const res = await fetch(`${base}/system/reset-database`, { method: 'POST' });
  assert.equal(res.status, 200);

  // Dữ liệu nghiệp vụ (kể cả dữ liệu mẫu) đều sạch.
  for (const table of [
    'customers',
    'orders',
    'order_items',
    'employees',
    'inventory_stock',
    'stock_movements',
    'stock_tickets',
    'revenue_transactions',
    'deposit_transactions',
    'customer_bottle_ledgers',
    'invoices',
    'shell_stock',
    'shell_movements',
    'audit_logs',
    'targets',
  ]) {
    assert.equal(count(table), 0, `${table} phải trống`);
  }

  // Danh mục nền giữ nguyên — kể cả kho vật lý xí nghiệp đang dùng.
  assert.equal(count('products'), productsBefore, 'Sản phẩm giữ nguyên');
  assert.equal(count('categories'), categoriesBefore, 'Nhóm hàng giữ nguyên');
  assert.equal(count('warehouses'), warehousesBefore, 'Kho giữ nguyên (kể cả kho vật lý hiện tại)');
  assert.ok(count('warehouses', `WHERE code = 'KHO_TANGAP'`) > 0, 'Kho vật lý của xí nghiệp vẫn còn');
  // 5 kho vật lý mặc định luôn có, kể cả kho vừa bị xoá trước khi reset.
  for (const code of ['KHO_TANGAP', 'KHO_HUE', 'KHO_VP', 'KHO_XEDIEN', 'KHO_HALAM']) {
    assert.ok(count('warehouses', `WHERE code = '${code}'`) > 0, `Kho mặc định ${code} phải tồn tại sau reset`);
  }
  assert.equal(count('price_list'), 1, 'Bảng giá giữ nguyên');
  assert.equal(count('promotions'), 1, 'Khuyến mãi giữ nguyên');
  assert.ok(count('customer_groups') > 0, 'Nhóm khách hàng giữ nguyên');
  assert.ok(count('positions') > 0, 'Chức vụ giữ nguyên');
  assert.ok(count('shell_deposits') > 0, 'Mức cọc vỏ giữ nguyên');
  assert.ok(count('vat_rates') > 0, 'Thuế suất giữ nguyên');
  assert.ok(count('shipping_fees') > 0, 'Phí vận chuyển giữ nguyên');

  // Danh mục do phần mềm tự tạo vẫn đủ để dùng ngay.
  assert.ok(count('app_settings') > 0, 'Cấu hình chung còn nguyên');
  assert.ok(count('org_units') > 0, 'Đơn vị gốc');
  assert.ok(count('import_sources') > 0, 'Nguồn nhập mặc định');
  assert.ok(count('partner_units') > 0, 'Đối tác mặc định');

  // Cấu hình: kỳ báo cáo giữ nguyên, hai quy tắc vận chuyển được bật.
  assert.equal(
    (db.prepare(`SELECT value FROM app_settings WHERE key = 'report_period_from'`).get() as { value: string }).value,
    '2026-09-01',
    'Giá trị cấu hình được giữ lại'
  );
  for (const key of ['free_ship_without_shipper', 'free_ship_for_customer']) {
    assert.equal(
      (db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as { value: string }).value,
      '1',
      `${key} phải được bật`
    );
  }

  // Nhân viên đã xoá nên kho không còn trỏ vào trưởng kho cũ.
  assert.equal(count('warehouses', `WHERE manager_employee_id IS NOT NULL`), 0, 'Không còn tham chiếu trưởng kho cũ');

  // CSDL vẫn dùng được bình thường sau khi reset.
  db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-SAU', 'Khách sau reset', '')`).run();
  assert.equal(count('customers', `WHERE code = 'KH-SAU'`), 1);
});

test('Kho vật lý mặc định bị xoá thì được tạo lại khi reset', async () => {
  // Xoá một kho mặc định để chứng minh reset đảm bảo danh sách 5 kho luôn có.
  db.prepare(`DELETE FROM warehouses WHERE code = 'KHO_HALAM'`).run();
  assert.equal(count('warehouses', `WHERE code = 'KHO_HALAM'`), 0);

  const res = await fetch(`${base}/system/reset-database`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal(count('warehouses', `WHERE code = 'KHO_HALAM'`), 1, 'Kho Hà Lầm phải được tạo lại');
});

test('Danh mục nền bị mất thì được nạp lại (nhóm hàng, sản phẩm, nhóm khách hàng)', async () => {
  // Mô phỏng CSDL từng bị xoá bằng bản cũ chưa giữ danh mục: mất sạch danh mục nền.
  // Tắt kiểm tra khoá ngoại khi xoá vì bảng giá / khuyến mãi còn giữ tham chiếu tới sản phẩm.
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM categories').run();
  db.prepare('DELETE FROM customer_groups').run();
  db.pragma('foreign_keys = ON');
  assert.equal(count('categories'), 0);
  assert.equal(count('products'), 0);

  const res = await fetch(`${base}/system/reset-database`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.ok(count('categories') >= 3, 'Nhóm hàng mặc định phải được nạp lại');
  assert.ok(count('products') >= 11, 'Sản phẩm mặc định phải được nạp lại');
  assert.ok(count('customer_groups') >= 3, 'Nhóm khách hàng mặc định phải được nạp lại');
  assert.equal(
    count('products', `WHERE code = 'RO_19L_VOI' AND is_active = 1`),
    1,
    'Sản phẩm mặc định phải dùng được ngay'
  );
});

test('Nạp lại danh mục nền không ghi đè dữ liệu người dùng đã có', async () => {
  // Người dùng đổi tên một nhóm hàng rồi xoá sản phẩm → buộc phải nạp lại danh mục nền.
  db.prepare(`UPDATE categories SET name = 'Nhóm hàng tôi đổi tên' WHERE id = 1`).run();
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM products').run();
  db.pragma('foreign_keys = ON');

  const res = await fetch(`${base}/system/reset-database`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal(
    (db.prepare('SELECT name FROM categories WHERE id = 1').get() as { name: string }).name,
    'Nhóm hàng tôi đổi tên',
    'Nhóm hàng người dùng đổi tên phải được giữ nguyên'
  );
  assert.ok(count('products') >= 11, 'Sản phẩm mặc định phải được nạp lại');
});
