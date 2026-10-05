import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import Database from 'better-sqlite3';

// Rà soát toàn luồng: mỗi test khoá lại một lỗi có thể làm sai số dữ liệu.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-sweep-'));
process.env.DB_PATH = join(testDir, 'sweep.db');
const emptyDb = new Database(process.env.DB_PATH);
emptyDb.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
emptyDb.close();

const [
  { getDb },
  { ordersRouter },
  { stockTicketsRouter },
  { settingsRouter },
  { inventoryRouter },
  { reportsRouter },
  { invoicesRouter },
  { customersRouter },
  { applyStockDelta, recordMovement },
  { dateKey, nowStamp, today },
  { errorMiddleware },
] = await Promise.all([
  import('../src/db.js'),
  import('../src/routes/orders.js'),
  import('../src/routes/stockTickets.js'),
  import('../src/routes/settings.js'),
  import('../src/routes/inventory.js'),
  import('../src/routes/reports.js'),
  import('../src/routes/invoices.js'),
  import('../src/routes/customers.js'),
  import('../src/lib/stock.js'),
  import('../src/lib/codes.js'),
  import('../src/lib/http.js'),
]);
const db = getDb();
const app = express();
app.use(express.json());
for (const router of [ordersRouter(), stockTicketsRouter(), settingsRouter(), inventoryRouter(), reportsRouter(), invoicesRouter(), customersRouter()]) app.use('/api', router);
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

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

function one<T = any>(sql: string, ...params: unknown[]): T {
  return db.prepare(sql).get(...params) as T;
}

const TODAY = today();
const YESTERDAY = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

let sequence = 0;
function fixture(stock = 100) {
  const tag = `SWP${++sequence}`;
  const employee = Number(db.prepare('INSERT INTO employees (code, full_name) VALUES (?, ?)').run(`${tag}-E`, `${tag} Seller`).lastInsertRowid);
  const shipper = Number(db.prepare('INSERT INTO employees (code, full_name) VALUES (?, ?)').run(`${tag}-D`, `${tag} Driver`).lastInsertRowid);
  const customer = Number(db.prepare('INSERT INTO customers (code, name, address) VALUES (?, ?, ?)').run(`${tag}-C`, `${tag} Customer`, 'Test').lastInsertRowid);
  const partner = Number(db.prepare('INSERT INTO partner_units (code, name) VALUES (?, ?)').run(`${tag}-P`, `${tag} Partner`).lastInsertRowid);
  const warehouse = Number(db.prepare("INSERT INTO warehouses (code, name, type) VALUES (?, ?, 'STORE')").run(`${tag}-W1`, `${tag} Kho 1`).lastInsertRowid);
  const warehouse2 = Number(db.prepare("INSERT INTO warehouses (code, name, type) VALUES (?, ?, 'STORE')").run(`${tag}-W2`, `${tag} Kho 2`).lastInsertRowid);
  const product = Number(
    db
      .prepare(
        `INSERT INTO products (code, name, unit, bottle_type, standard_price, wholesale_price, deposit_fee, product_type)
         VALUES (?, ?, 'Bình', 'VOI', 48000, 43000, 50000, 'GOODS')`
      )
      .run(`${tag}-G`, `${tag} Nước bình`)
      .lastInsertRowid
  );
  const fee = Number(db.prepare('INSERT INTO shipping_fees (code, name, fee_per_unit) VALUES (?, ?, ?)').run(`${tag}-F`, `${tag} Tuyến`, 5000).lastInsertRowid);
  if (stock) {
    applyStockDelta(db, { warehouseId: warehouse, productId: product, delta: stock });
    recordMovement(db, {
      movementType: 'IMPORT',
      productId: product,
      quantity: stock,
      targetWarehouseId: warehouse,
      createdAt: YESTERDAY,
      note: 'Tồn đầu kỳ',
    });
  }
  async function order(overrides: Record<string, unknown> = {}) {
    const response = await api('POST', '/orders', {
      customer_id: customer,
      seller_employee_id: employee,
      shipper_employee_id: shipper,
      warehouse_id: warehouse,
      shipping_fee_id: fee,
      order_date: TODAY,
      items: [{ product_id: product, quantity: 2 }],
      ...overrides,
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return Number(response.data.orderId);
  }
  async function to(id: number, status: string, expected = 200) {
    const response = await api('POST', `/orders/${id}/status`, { status });
    assert.equal(response.status, expected, JSON.stringify(response.data));
  }
  return {
    tag, customer, employee, shipper, partner, warehouse, warehouse2, product, fee, order, to,
    stock: (warehouseId = warehouse) =>
      one<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, product)?.quantity ?? 0,
  };
}

// Phiếu kho tạo ra luôn là NHÁP; phải xác nhận mới ghi sổ (đúng luồng giao diện đang dùng).
async function confirmTicket(id: number) {
  const res = await api('POST', `/stock-tickets/${id}/status`, { status: 'CONFIRMED' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

test('Ngày nghiệp vụ tính theo giờ Việt Nam, không theo giờ máy chủ', () => {
  // 18:00 UTC ngày 30/09 là 01:00 ngày 01/10 giờ Việt Nam — máy chủ chạy UTC sẽ lùi mất một ngày.
  assert.equal(today('2026-09-30T18:00:00Z'), '2026-10-01');
  assert.equal(dateKey('2026-09-30T18:00:00Z'), '20261001');
  assert.equal(nowStamp('2026-09-30T18:00:00Z'), '2026-10-01 01:00:00');
  // Chuỗi ngày thuần đã là ngày nghiệp vụ thì giữ nguyên.
  assert.equal(today('2026-09-30'), '2026-09-30');
  assert.equal(dateKey('2026-09-30'), '20260930');
  assert.equal(nowStamp('2026-09-30'), '2026-09-30 00:00:00');
});

test('Vỏ khách trả khi giao hàng được nhập lại pool vỏ và ghi sổ vỏ', async () => {
  const f = fixture(10);
  const id = await f.order({ items: [{ product_id: f.product, quantity: 10 }], returned_shells_voi: 4 });
  await f.to(id, 'CONFIRMED');
  await f.to(id, 'SHIPPING');
  // Xuất 10 vỏ cho khách: pool âm 10 (vỏ đang nằm ngoài thị trường).
  assert.equal(one<{ quantity: number }>('SELECT quantity FROM shell_stock WHERE bottle_type = ?', 'VOI').quantity, -10);
  await f.to(id, 'COMPLETED');
  // Khách trả 4 vỏ ngay khi nhận hàng → pool phải còn -6, thiếu bút toán này pool sẽ mãi là -10.
  assert.equal(one<{ quantity: number }>('SELECT quantity FROM shell_stock WHERE bottle_type = ?', 'VOI').quantity, -6);
  assert.equal(
    one<{ quantity: number }>(
      `SELECT quantity FROM shell_movements WHERE movement_type = 'RETURN' AND bottle_type = 'VOI' AND order_id = ?`,
      id
    ).quantity,
    4
  );
  assert.equal(one<{ bottle_debt_voi: number }>('SELECT bottle_debt_voi FROM customers WHERE id = ?', f.customer).bottle_debt_voi, 6);
});

test('Đơn cho mượn khi bật miễn ship cho khách: không phải thu đồng nào và không ghi nhận đã thu', async () => {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES ('free_ship_for_customer', '1')
              ON CONFLICT(key) DO UPDATE SET value = '1'`).run();
  try {
    const f = fixture(10);
    const id = await f.order({
      order_type: 'LEND_OUT',
      partner_unit_id: f.partner,
      payment_status: 'PAID',
      items: [{ product_id: f.product, quantity: 2 }],
    });
    const order = one<{ total_amount: number; paid_amount: number }>('SELECT total_amount, paid_amount FROM orders WHERE id = ?', id);
    assert.equal(order.total_amount, 0, 'Miễn ship cho khách thì đơn cho mượn không phải thu gì');
    assert.equal(order.paid_amount, 0, 'Không được ghi nhận đã thu phí ship khi khách được miễn ship');
    await f.to(id, 'CONFIRMED');
    await f.to(id, 'SHIPPING');
    await f.to(id, 'COMPLETED');
    const collect = await api('POST', `/orders/${id}/collect`, { amount: 5000, payment_method: 'CASH' });
    assert.equal(collect.status, 400, 'Đơn không còn gì phải thu thì không thu thêm được');
  } finally {
    db.prepare(`UPDATE app_settings SET value = '0' WHERE key = 'free_ship_for_customer'`).run();
  }
});

test('Phiếu chuyển kho không bị đếm trùng trong nhật ký tồn theo ngày', async () => {
  const f = fixture(100);
  // Hôm qua kho 1 có 100, kho 2 chưa có gì.
  const before = await api('GET', `/inventory/stock-daily?from=${YESTERDAY}&to=${YESTERDAY}`);
  assert.equal(before.status, 200, JSON.stringify(before.data));
  const at = (rows: { warehouse_id: number; product_id: number; quantity: number }[], warehouse: number) =>
    rows.find((r) => r.warehouse_id === warehouse && r.product_id === f.product)?.quantity ?? 0;
  assert.equal(at(before.data.rows, f.warehouse), 100);
  assert.equal(at(before.data.rows, f.warehouse2), 0);

  // Hôm nay chuyển 10 từ kho 1 sang kho 2.
  const transfer = await api('POST', '/stock-tickets', {
    ticket_type: 'TRANSFER',
    ticket_date: TODAY,
    warehouse_id: f.warehouse,
    target_warehouse_id: f.warehouse2,
    reason: 'TRANSFER',
    items: [{ product_id: f.product, quantity: 10 }],
  });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.data));
  await confirmTicket(Number(transfer.data.id));
  assert.equal(f.stock(), 90);
  assert.equal(f.stock(f.warehouse2), 10);

  // Nhật ký của ngày hôm qua phải vẫn là 100 / 0, không được cộng dồn hai chặng thành 110 / -20.
  const after = await api('GET', `/inventory/stock-daily?from=${YESTERDAY}&to=${YESTERDAY}`);
  assert.equal(at(after.data.rows, f.warehouse), 100);
  assert.equal(at(after.data.rows, f.warehouse2), 0);
});

test('Đối soát kho theo từng kho không báo lệch ảo vì phiếu chuyển kho', async () => {
  const f = fixture(50);
  const transfer = await api('POST', '/stock-tickets', {
    ticket_type: 'TRANSFER',
    ticket_date: TODAY,
    warehouse_id: f.warehouse,
    target_warehouse_id: f.warehouse2,
    reason: 'TRANSFER',
    items: [{ product_id: f.product, quantity: 20 }],
  });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.data));
  await confirmTicket(Number(transfer.data.id));
  const audit = await api('GET', `/reports/stock-audit?warehouse_id=${f.warehouse}&from=${YESTERDAY}&to=${TODAY}`);
  assert.equal(audit.status, 200, JSON.stringify(audit.data));
  const row = (audit.data.rows as { product_id: number; diff: number }[]).find((r) => r.product_id === f.product);
  assert.ok(row, 'Phải có dòng đối soát của sản phẩm');
  assert.equal(row!.diff, 0, 'Kho xuất phải khớp sổ sách, không lệch theo số hàng đã chuyển đi');
});

test('Phiếu sinh từ đơn hàng không sửa trực tiếp được', async () => {
  const f = fixture(10);
  const id = await f.order({});
  await f.to(id, 'CONFIRMED');
  const ticket = one<{ id: number }>('SELECT id FROM stock_tickets WHERE order_id = ?', id);
  assert.ok(ticket?.id, 'Đơn đã xác nhận phải sinh phiếu xuất chờ');
  const updated = await api('PUT', `/stock-tickets/${ticket.id}`, {
    ticket_type: 'OUT',
    ticket_date: TODAY,
    warehouse_id: f.warehouse,
    reason: 'ORDER_SALE',
    items: [{ product_id: f.product, quantity: 1 }],
  });
  assert.equal(updated.status, 400, 'Sửa riêng phiếu sẽ làm tồn kho lệch khỏi đơn');
});

test('Kho ảo không được dùng làm kho nhận hàng điều chuyển', async () => {
  const f = fixture(10);
  const virtual = one<{ id: number }>(`SELECT id FROM warehouses WHERE type NOT IN ('CENTRAL','STORE','VEHICLE','STATION') LIMIT 1`);
  const res = await api('POST', '/stock-tickets', {
    ticket_type: 'TRANSFER',
    ticket_date: TODAY,
    warehouse_id: f.warehouse,
    target_warehouse_id: virtual.id,
    reason: 'TRANSFER',
    items: [{ product_id: f.product, quantity: 1 }],
    status: 'CONFIRMED',
  });
  assert.equal(res.status, 400);
});

test('Kỳ báo cáo sai định dạng hoặc đảo ngược bị từ chối khi lưu', async () => {
  const wrongFormat = await api('PUT', '/settings', { report_period_from: '30/09/2026', report_period_to: '2026-09-30' });
  assert.equal(wrongFormat.status, 400);
  const inverted = await api('PUT', '/settings', { report_period_from: '2026-10-01', report_period_to: '2026-09-30' });
  assert.equal(inverted.status, 400);
  const impossible = await api('PUT', '/settings', { report_period_from: '2026-02-30', report_period_to: '2026-03-30' });
  assert.equal(impossible.status, 400);
  const ok = await api('PUT', '/settings', { report_period_from: '2026-09-01', report_period_to: '2026-09-30' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
});

test('Hóa đơn đơn có giảm giá: trước thuế + thuế đúng bằng tiền hàng sau giảm giá', async () => {
  const f = fixture(10);
  const id = await f.order({
    items: [{ product_id: f.product, quantity: 2, unit_price: 48000 }],
    discount_amount: 10000,
    is_vat_invoice: 1,
    vat_rate: 8,
    payment_status: 'PAID',
  });
  await f.to(id, 'CONFIRMED');
  await f.to(id, 'SHIPPING');
  await f.to(id, 'COMPLETED');
  const order = one<{ subtotal_amount: number; discount_amount: number; total_amount: number }>(
    'SELECT subtotal_amount, discount_amount, total_amount FROM orders WHERE id = ?',
    id
  );
  const issued = await api('POST', '/invoices', { order_id: id });
  assert.equal(issued.status, 200, JSON.stringify(issued.data));
  const invoice = one<{ subtotal_amount: number; tax_amount: number; total_amount: number; vat_rate: number }>(
    'SELECT subtotal_amount, tax_amount, total_amount, vat_rate FROM invoices WHERE order_id = ?',
    id
  );
  const goodsAfterDiscount = order.subtotal_amount - order.discount_amount;
  assert.equal(invoice.vat_rate, 8);
  assert.equal(invoice.subtotal_amount + invoice.tax_amount, goodsAfterDiscount, 'Trước thuế + thuế phải bằng tiền hàng thực thu');
  assert.equal(invoice.total_amount, order.total_amount);
  // Thuế = phần VAT nằm trong số tiền hàng thực thu (sai số ≤ 1đ do làm tròn), không phải 8% của tiền hàng trước giảm giá.
  const vatInside = goodsAfterDiscount - goodsAfterDiscount / 1.08;
  assert.ok(
    Math.abs(invoice.tax_amount - vatInside) <= 1,
    `Thuế ${invoice.tax_amount} phải xấp xỉ VAT của ${goodsAfterDiscount} là ${Math.round(vatInside)}`
  );
  assert.ok(invoice.tax_amount < Math.round((order.subtotal_amount * 8) / 100), 'Không được tính thuế trên phần đã giảm giá');
});

test('Khai/sửa nợ vỏ của khách luôn khớp pool vỏ và sổ vỏ khách', async () => {
  const shellStock = () => one<{ quantity: number }>('SELECT quantity FROM shell_stock WHERE bottle_type = ?', 'VOI')?.quantity ?? 0;
  const before = shellStock();
  // Tạo khách khai sẵn 5 vỏ Vòi.
  const created = await api('POST', '/customers', {
    name: 'Khách nợ vỏ', address: 'Hạ Long', bottle_debt_voi: 5,
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const id = Number(created.data.id);
  assert.equal(shellStock(), before - 5, 'Tạo khách nợ 5 vỏ phải xuất 5 vỏ ra khỏi pool');
  assert.equal(
    one<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_bottle_ledgers WHERE customer_id = ? AND remaining_balance_voi = 5`, id).c,
    1,
    'Phải có dòng sổ vỏ khớp số dư 5'
  );

  // Tăng nợ 5 → 8.
  const up = await api('PUT', `/customers/${id}`, { bottle_debt_voi: 8 });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  assert.equal(shellStock(), before - 8, 'Tăng nợ thêm 3 phải xuất thêm 3 vỏ');

  // Giảm nợ 8 → 3.
  const down = await api('PUT', `/customers/${id}`, { bottle_debt_voi: 3 });
  assert.equal(down.status, 200, JSON.stringify(down.data));
  assert.equal(shellStock(), before - 3, 'Giảm nợ 5 phải thu hồi 5 vỏ về pool');
  assert.equal(
    one<{ remaining_balance_voi: number }>(
      'SELECT remaining_balance_voi FROM customer_bottle_ledgers WHERE customer_id = ? ORDER BY id DESC LIMIT 1', id
    ).remaining_balance_voi,
    3,
    'Dòng sổ mới nhất phải khớp số dư mới'
  );
});
