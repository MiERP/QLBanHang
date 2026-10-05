import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

// CSDL mới tinh (chỉ schema, chưa có dòng nào) — ví dụ bản cài trên máy mới khi tệp CSDL đã tồn tại
// nhưng rỗng. Mở lại phần mềm KHÔNG được tự nạp dữ liệu mẫu, nếu không dữ liệu mẫu sẽ sống dậy sau mỗi lần khởi động.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-empty-'));
process.env.DB_PATH = join(testDir, 'empty.db');
const schemaOnly = new Database(process.env.DB_PATH);
schemaOnly.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
schemaOnly.close();

const { getDb } = await import('../src/db.js');
const db = getDb();

after(() => {
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});

const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c;

test('CSDL trống sẵn có: chỉ nạp danh mục nền, KHÔNG nạp dữ liệu mẫu khi mở phần mềm', () => {
  // Dữ liệu mẫu (khách hàng, đơn hàng, tồn kho, nhân viên, bút toán...) không được sống dậy sau mỗi lần khởi động.
  for (const table of ['customers', 'orders', 'order_items', 'inventory_stock', 'stock_movements', 'employees', 'invoices']) {
    assert.equal(count(table), 0, `${table} phải giữ nguyên trống`);
  }
  // Danh mục nền thì luôn có để dùng được ngay.
  assert.ok(count('categories') > 0, 'Nhóm hàng mặc định');
  assert.ok(count('products') > 0, 'Sản phẩm mặc định');
  assert.ok(count('customer_groups') > 0, 'Nhóm khách hàng mặc định');
});

test('CSDL trống sẵn có: vẫn được nạp danh mục nền để dùng được ngay', () => {
  assert.ok(count('app_settings') > 0, 'Cấu hình chung có mặt');
  assert.ok(count('positions') > 0, 'Chức vụ mặc định');
  assert.ok(count('org_units') > 0, 'Đơn vị gốc');
  assert.ok(count('import_sources') > 0, 'Nguồn nhập mặc định');
  assert.ok(count('shipping_fees') > 0, 'Phí vận chuyển mặc định');
  assert.equal(count('warehouses'), 8, '3 kho ảo hệ thống + 5 kho vật lý mặc định');
  for (const code of ['KHO_TANGAP', 'KHO_HUE', 'KHO_VP', 'KHO_XEDIEN', 'KHO_HALAM']) {
    assert.ok(
      (db.prepare('SELECT COUNT(*) AS c FROM warehouses WHERE code = ?').get(code) as { c: number }).c > 0,
      `Kho mặc định ${code} phải có`
    );
  }
});

test('Sau khi xóa sạch rồi mở lại, CSDL vẫn dùng được bình thường', () => {
  db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-MOI', 'Khách mới', '')`).run();
  assert.equal(count('customers'), 1);
});
