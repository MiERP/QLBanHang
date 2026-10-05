import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

// CSDL dùng một lần: schema + dữ liệu mẫu (có bút toán kho ngày 01/09 và 07/09).
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-stock-asof-'));
process.env.DB_PATH = join(testDir, 'asof.db');
const seedDb = new Database(process.env.DB_PATH);
seedDb.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
// Danh mục nền nạp trước vì dữ liệu mẫu tham chiếu ID của nhóm hàng / sản phẩm / nhóm khách hàng.
seedDb.exec(readFileSync(new URL('../src/catalog.sql', import.meta.url), 'utf8'));
seedDb.exec(readFileSync(new URL('../src/seed.sql', import.meta.url), 'utf8'));
seedDb.close();

const [{ getDb }, { inventoryRouter }, { errorMiddleware }] = await Promise.all([
  import('../src/db.js'),
  import('../src/routes/inventory.js'),
  import('../src/lib/http.js'),
]);
const db = getDb();
const app = express();
app.use(express.json());
app.use('/api', inventoryRouter());
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

interface Row {
  warehouse_id: number;
  product_id: number;
  quantity: number;
}
const get = async (query: string): Promise<Row[]> => (await (await fetch(`${base}/inventory/stock${query}`)).json()) as Row[];
const cell = (rows: Row[], warehouseId: number, productId: number) =>
  rows.find((r) => r.warehouse_id === warehouseId && r.product_id === productId)?.quantity;
const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T;
const liveQuantity = (w: number, p: number) =>
  one<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', w, p)?.quantity ?? 0;
// Xuất kho ghi sau mốc → trước mốc đó hàng còn trong kho.
const exportedAfter = (w: number, p: number, date: string) =>
  one<{ q: number }>(
    `SELECT COALESCE(SUM(quantity + COALESCE(quantity_promo, 0)), 0) AS q FROM stock_movements
     WHERE source_warehouse_id = ? AND product_id = ? AND date(created_at) > ?`,
    w,
    p,
    date
  ).q;
// Nhập kho ghi sau mốc → trước mốc đó hàng chưa về kho.
const importedAfter = (w: number, p: number, date: string) =>
  one<{ q: number }>(
    `SELECT COALESCE(SUM(quantity + COALESCE(quantity_promo, 0)), 0) AS q FROM stock_movements
     WHERE target_warehouse_id = ? AND product_id = ? AND date(created_at) > ?`,
    w,
    p,
    date
  ).q;
const expectedAsOf = (w: number, p: number, date: string) => liveQuantity(w, p) + exportedAfter(w, p, date) - importedAfter(w, p, date);

test('Tồn hiện tại không truyền tham số: mọi dòng trả về đúng số hệ thống đang giữ', async () => {
  const rows = await get('');
  assert.equal(cell(rows, 1, 1), liveQuantity(1, 1));
  assert.equal(cell(rows, 2, 1), liveQuantity(2, 1));
});

test('Nhật ký chặn ngày sai định dạng và khoảng thiếu một đầu', async () => {
  assert.equal((await daily('?from=06-09-2026&to=2026-09-07')).status, 400, 'Ngày sai định dạng');
  assert.equal((await daily('?from=2026-09-05')).status, 400, 'Thiếu ngày kết thúc');
  assert.match((await daily('?from=2026-09-05&to=2026-09-07')).body.from, /^\d{4}-\d{2}-\d{2}$/);
});

test('Xuất Excel không tham số = bản chụp tồn hiện tại (không có cột NGÀY)', async () => {
  const res = await fetch(`${base}/inventory/stock.xlsx`);
  assert.equal(res.status, 200);
  const buffer = Buffer.from(await res.arrayBuffer());
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const header = (wb.worksheets[0].getRow(5).values as unknown[]).slice(1).map((v) => String(v ?? ''));
  assert.ok(!header.includes('NGÀY'), 'Bản chụp hiện tại không có cột NGÀY');
  assert.ok((wb.worksheets[0].model.merges ?? []).includes('A5:A6'), 'Có ô gộp tiêu đề');
});

interface DailyRow {
  date: string;
  warehouse_id: number;
  product_id: number;
  quantity: number;
}
const daily = async (query: string) => {
  const res = await fetch(`${base}/inventory/stock-daily${query}`);
  return { status: res.status, body: (await res.json()) as { from: string; to: string; rows: DailyRow[] } };
};

test('Nhật ký tồn cuối từng ngày: ngày cuối khớp tồn hiện tại, ngày trước đó cộng lại hàng đã bán', async () => {
  const { status, body } = await daily('?from=2026-09-05&to=2026-09-07');
  assert.equal(status, 200);
  const dates = [...new Set(body.rows.map((r) => r.date))].sort();
  assert.deepEqual(dates, ['2026-09-05', '2026-09-06', '2026-09-07'], 'Đủ mọi ngày trong khoảng, kể cả ngày không phát sinh');

  const cellOf = (date: string, w: number, p: number) =>
    body.rows.find((r) => r.date === date && r.warehouse_id === w && r.product_id === p)?.quantity;
  const dayCount = new Set(body.rows.filter((r) => r.date === dates[0]).map((r) => r.warehouse_id)).size;

  assert.equal(cellOf('2026-09-07', 1, 1), liveQuantity(1, 1), 'Ngày cuối cùng = tồn hiện tại');
  assert.equal(cellOf('2026-09-06', 1, 1), liveQuantity(1, 1) + exportedAfter(1, 1, '2026-09-06'), 'Ngày trước đó cộng lại hàng xuất ngày 07');
  assert.equal(cellOf('2026-09-05', 1, 1), cellOf('2026-09-06', 1, 1), 'Ngày không phát sinh thì giữ nguyên');
  assert.ok((cellOf('2026-09-06', 1, 1) ?? 0) > (cellOf('2026-09-07', 1, 1) ?? 0), 'Bán hàng làm tồn cuối ngày giảm');
  const keys = body.rows.map((r) => `${r.date}|${r.warehouse_id}|${r.product_id}`);
  assert.equal(new Set(keys).size, keys.length, 'Mỗi ngày × kho × mặt hàng chỉ có một dòng');
  assert.ok(dayCount > 0);
});

test('Nhật ký chặn khoảng ngày sai và khoảng quá dài', async () => {
  assert.equal((await daily('?from=2026-09-07&to=2026-09-05')).status, 400, 'Từ ngày sau đến ngày phải bị chặn');
  assert.equal((await daily('?from=2020-01-01&to=2026-09-05')).status, 400, 'Khoảng quá dài phải bị chặn');
});

test('Xuất Excel nhật ký theo ngày có cột NGÀY gộp ô', async () => {
  const res = await fetch(`${base}/inventory/stock.xlsx?from=2026-09-05&to=2026-09-07`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') ?? '', /ton-kho-2026-09-05_2026-09-07\.xlsx/);
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  const header = (ws.getRow(5).values as unknown[]).slice(1).map((v) => String(v ?? ''));
  assert.ok(header.includes('NGÀY'), 'Có tiêu đề cột NGÀY');
  const merges = (ws.model.merges ?? []) as string[];
  // 5 kho × 3 ngày → mỗi khối ngày gộp 5 dòng: B7:B11, B12:B16, B17:B21.
  for (const range of ['B7:B11', 'B12:B16', 'B17:B21']) {
    assert.ok(merges.includes(range), `Ô NGÀY phải gộp theo khối ngày (${range})`);
  }
  const visibleDates = new Set(
    Array.from({ length: Math.max(0, ws.rowCount - 6) }, (_, i) => ws.getCell(`B${i + 7}`).value).filter(
      (v) => typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v)
    )
  );
  assert.deepEqual([...visibleDates].sort(), ['05/09/2026', '06/09/2026', '07/09/2026'], 'Ghi đủ 3 ngày');
});
