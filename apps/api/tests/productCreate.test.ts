import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import Database from 'better-sqlite3';

// CSDL trống (chỉ schema): đúng tình huống sau khi "Xóa toàn bộ dữ liệu" — chưa khai nhóm hàng, kho nào.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-product-'));
process.env.DB_PATH = join(testDir, 'product.db');
const emptyDb = new Database(process.env.DB_PATH);
emptyDb.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
emptyDb.close();

const [{ getDb }, { productsRouter }, { errorMiddleware }] = await Promise.all([
  import('../src/db.js'),
  import('../src/routes/products.js'),
  import('../src/lib/http.js'),
]);
const db = getDb();
const app = express();
app.use(express.json());
app.use('/api', productsRouter());
app.use(errorMiddleware);
const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});

const create = async (body: Record<string, unknown>) => {
  const res = await fetch(`${base}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { error?: string; id?: number } };
};

test('Chưa khai nhóm hàng: báo rõ thiếu nhóm hàng thay vì lỗi khoá ngoại khó hiểu', async () => {
  const missing = await create({ name: 'Nước test', standard_price: 10000, unit: 'Bình', category_id: '' });
  assert.equal(missing.status, 400);
  assert.match(missing.body.error ?? '', /chọn nhóm hàng/i);

  const unknown = await create({ name: 'Nước test', standard_price: 10000, unit: 'Bình', category_id: 999 });
  assert.equal(unknown.status, 400);
  assert.match(unknown.body.error ?? '', /không còn tồn tại/i);
});

test('Tồn kho ban đầu với kho không tồn tại: báo rõ kho thay vì lỗi khoá ngoại', async () => {
  const categoryId = Number(
    db.prepare(`INSERT INTO categories (code, name, type) VALUES ('CAT_A', 'Nhóm A', 'BOTTLE_WATER')`).run().lastInsertRowid
  );
  const res = await create({
    name: 'Nước bình',
    standard_price: 20000,
    unit: 'Bình',
    category_id: categoryId,
    initial_stock: 5,
    warehouse_id: 999,
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error ?? '', /chọn kho nhập hàng/i);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c, 0, 'Không tạo sản phẩm khi kho sai');
});

test('Nhóm hàng + kho hợp lệ: tạo được sản phẩm và ghi tồn kho ban đầu', async () => {
  const categoryId = (db.prepare(`SELECT id FROM categories WHERE code = 'CAT_A'`).get() as { id: number }).id;
  const warehouseId = Number(
    db.prepare(`INSERT INTO warehouses (code, name, type) VALUES ('KHO_A', 'Kho A', 'STORE')`).run().lastInsertRowid
  );
  const res = await create({
    name: 'Nước bình',
    standard_price: 20000,
    unit: 'Bình',
    category_id: categoryId,
    initial_stock: 5,
    warehouse_id: warehouseId,
  });
  assert.equal(res.status, 200);
  assert.equal(
    (db.prepare('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, res.body.id) as
      | { quantity: number }
      | undefined)?.quantity,
    5
  );
});

test('Đổi sang nhóm hàng không tồn tại cũng bị chặn khi cập nhật', async () => {
  const product = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: number };
  const res = await fetch(`${base}/products/${product.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: 999 }),
  });
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, /không còn tồn tại/i);
});
