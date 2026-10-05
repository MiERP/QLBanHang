import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

// CSDL đã tồn tại (có bảng) nhưng trống dữ liệu = trạng thái sau nút "Xóa toàn bộ dữ liệu".
// Mở lại phần mềm KHÔNG được nạp lại dữ liệu mẫu, nếu không dữ liệu mẫu sẽ sống dậy sau mỗi lần khởi động.
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

test('CSDL trống sẵn có: không nạp lại dữ liệu mẫu khi mở phần mềm', () => {
  for (const table of ['products', 'customers', 'orders', 'order_items', 'inventory_stock', 'stock_movements']) {
    assert.equal(count(table), 0, `${table} phải giữ nguyên trống`);
  }
});

test('CSDL trống sẵn có: vẫn được nạp danh mục nền để dùng được ngay', () => {
  assert.ok(count('app_settings') > 0, 'Cấu hình chung có mặt');
  assert.ok(count('positions') > 0, 'Chức vụ mặc định');
  assert.ok(count('org_units') > 0, 'Đơn vị gốc');
  assert.ok(count('import_sources') > 0, 'Nguồn nhập mặc định');
  assert.ok(count('shipping_fees') > 0, 'Phí vận chuyển mặc định');
  assert.equal(count('warehouses'), 3, 'Chỉ có 3 kho ảo hệ thống');
});

test('Sau khi xóa sạch rồi mở lại, CSDL vẫn dùng được bình thường', () => {
  db.prepare(`INSERT INTO customers (code, name, address) VALUES ('KH-MOI', 'Khách mới', '')`).run();
  assert.equal(count('customers'), 1);
});
