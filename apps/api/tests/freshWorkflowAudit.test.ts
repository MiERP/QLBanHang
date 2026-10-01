import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import Database from 'better-sqlite3';

// Every entity used below is created here. The database is disposable and never
// points at the application database or relies on its seeded products or orders.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-fresh-flow-'));
process.env.DB_PATH = join(testDir, 'audit.db');
const emptyDb = new Database(process.env.DB_PATH);
emptyDb.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
emptyDb.close();

const [{ getDb }, { ordersRouter }, { loansRouter }, { stockTicketsRouter }, { reportsRouter }, { masterDataRouter }, { dashboardRouter }, { errorMiddleware }] =
  await Promise.all([
    import('../src/db.js'),
    import('../src/routes/orders.js'),
    import('../src/routes/loans.js'),
    import('../src/routes/stockTickets.js'),
    import('../src/routes/reports.js'),
    import('../src/routes/masterData.js'),
    import('../src/routes/dashboard.js'),
    import('../src/lib/http.js'),
  ]);
const db = getDb();
const app = express();
app.use(express.json());
for (const router of [ordersRouter(), loansRouter(), stockTicketsRouter(), reportsRouter(), masterDataRouter(), dashboardRouter()]) app.use('/api', router);
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

let sequence = 0;
function fixture(initialStock = 0) {
  const tag = `AUD${++sequence}`;
  const employee = Number(db.prepare('INSERT INTO employees (code, full_name) VALUES (?, ?)').run(`${tag}-E`, `${tag} Seller`).lastInsertRowid);
  const shipper = Number(db.prepare('INSERT INTO employees (code, full_name) VALUES (?, ?)').run(`${tag}-D`, `${tag} Driver`).lastInsertRowid);
  const customer = Number(db.prepare('INSERT INTO customers (code, name, address) VALUES (?, ?, ?)').run(`${tag}-C`, `${tag} Customer`, 'Test address').lastInsertRowid);
  const partner = Number(db.prepare('INSERT INTO partner_units (code, name) VALUES (?, ?)').run(`${tag}-P`, `${tag} Partner`).lastInsertRowid);
  const warehouse = Number(db.prepare("INSERT INTO warehouses (code, name, type) VALUES (?, ?, 'STORE')").run(`${tag}-W`, `${tag} Warehouse`).lastInsertRowid);
  const product = Number(db.prepare('INSERT INTO products (code, name, unit, standard_price, wholesale_price) VALUES (?, ?, ?, ?, ?)').run(`${tag}-G`, `${tag} Goods`, 'unit', 20000, 20000).lastInsertRowid);
  const fee = Number(db.prepare('INSERT INTO shipping_fees (code, name, fee_per_unit) VALUES (?, ?, ?)').run(`${tag}-F`, `${tag} Fee`, 5000).lastInsertRowid);
  if (initialStock) db.prepare('INSERT INTO inventory_stock (warehouse_id, product_id, quantity) VALUES (?, ?, ?)').run(warehouse, product, initialStock);
  const stock = () => one<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouse, product)?.quantity ?? 0;
  async function order(overrides: Record<string, unknown> = {}) {
    const response = await api('POST', '/orders', {
      customer_id: customer, seller_employee_id: employee, shipper_employee_id: shipper,
      warehouse_id: warehouse, shipping_fee_id: fee, order_date: '2027-03-02',
      items: [{ product_id: product, quantity: 2 }], ...overrides,
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return Number(response.data.orderId);
  }
  return { customer, employee, shipper, partner, warehouse, product, fee, stock, order };
}

async function status(id: number, to: string, expected = 200) {
  const response = await api('POST', `/orders/${id}/status`, { status: to });
  assert.equal(response.status, expected, JSON.stringify(response.data));
}

async function finish(id: number) {
  for (const to of ['CONFIRMED', 'SHIPPING', 'COMPLETED']) await status(id, to);
}

test('fresh sale: pending ticket, competing stock, cancellation, full return and promotion', async () => {
  const f = fixture(3);
  db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active)
              VALUES (?, ?, ?, 2, 1, 1)`).run(`KM-AUD-${f.product}`, 'Mua 2 tặng 1', f.product);
  const id = await f.order({ items: [{ product_id: f.product, quantity: 2, quantity_promo: 1 }] });
  db.prepare('UPDATE promotions SET is_active = 0 WHERE product_id = ?').run(f.product);
  assert.equal(f.stock(), 3);
  await status(id, 'CONFIRMED');
  assert.deepEqual(one<{ status: string; quantity: number; quantity_promo: number }>(
    `SELECT t.status, ti.quantity, ti.quantity_promo FROM stock_tickets t JOIN stock_ticket_items ti ON ti.ticket_id = t.id WHERE t.order_id = ?`, id),
    { status: 'DRAFT', quantity: 2, quantity_promo: 1 });
  assert.equal(f.stock(), 3);
  const competing = await f.order({ items: [{ product_id: f.product, quantity: 3 }] });
  await status(competing, 'CONFIRMED');
  await status(competing, 'SHIPPING');
  assert.equal(f.stock(), 0);
  await status(id, 'SHIPPING', 400);
  assert.equal(one<{ order_status: string }>('SELECT order_status FROM orders WHERE id = ?', id).order_status, 'CONFIRMED');
  await status(competing, 'CANCELLED');
  assert.equal(f.stock(), 3);
  await status(id, 'SHIPPING');
  assert.equal(f.stock(), 0);
  await status(id, 'COMPLETED');
  const item = one<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const partial = await api('POST', `/orders/${id}/return`, { items: [{ order_item_id: item, quantity: 2, quantity_promo: 0 }] });
  assert.equal(partial.status, 400);
  const returned = await api('POST', `/orders/${id}/return`, {
    return_date: '2027-03-02', items: [{ order_item_id: item, quantity: 2, quantity_promo: 1 }],
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  assert.equal(f.stock(), 3);
  assert.equal(one<{ order_status: string }>('SELECT order_status FROM orders WHERE id = ?', id).order_status, 'RETURNED');
  assert.equal((await api('POST', `/orders/${id}/return`, { items: [{ order_item_id: item, quantity: 2, quantity_promo: 1 }] })).status, 400);
});

test('same-product 10+1 promotion requires the purchase threshold and posts 11 units', async () => {
  const f = fixture(22);
  const freeProduct = fixture().product;
  const rejectedRule = await api('POST', '/promotions', {
    name: 'Tặng sản phẩm khác', product_id: f.product, buy_quantity: 10, free_quantity: 1,
    free_product_id: freeProduct, is_active: 1,
  });
  assert.equal(rejectedRule.status, 400);
  db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, start_date, is_active)
              VALUES (?, ?, ?, 10, 1, '2027-03-01', 1)`).run(`KM-AUD-${f.product}`, 'Mua 10 tặng 1', f.product);

  const tooFew = await api('POST', '/orders', {
    customer_id: f.customer, seller_employee_id: f.employee, shipper_employee_id: f.shipper,
    warehouse_id: f.warehouse, shipping_fee_id: f.fee, order_date: '2027-03-02',
    items: [{ product_id: f.product, quantity: 9, quantity_promo: 1 }],
  });
  assert.equal(tooFew.status, 400);

  const id = await f.order({ items: [{ product_id: f.product, quantity: 10 }] });
  assert.deepEqual(one<{ quantity: number; quantity_promo: number; total_price: number }>(
    'SELECT quantity, quantity_promo, total_price FROM order_items WHERE order_id = ?', id),
    { quantity: 10, quantity_promo: 1, total_price: 200000 });
  assert.deepEqual(one<{ subtotal_amount: number; shipping_fee: number }>(
    'SELECT subtotal_amount, shipping_fee FROM orders WHERE id = ?', id),
    { subtotal_amount: 200000, shipping_fee: 50000 });
  const detail = await api('GET', `/orders/${id}`);
  assert.equal(detail.status, 200, JSON.stringify(detail.data));
  assert.equal(detail.data.outstanding_amount, detail.data.total_amount, 'Còn nợ phải bằng tổng phải thu khi chưa thanh toán');
  await status(id, 'CONFIRMED');
  await status(id, 'SHIPPING');
  assert.equal(f.stock(), 11);

  const dated = await f.order({ order_date: '2027-02-28', items: [{ product_id: f.product, quantity: 10 }] });
  assert.equal(one<{ quantity_promo: number }>('SELECT quantity_promo FROM order_items WHERE order_id = ?', dated).quantity_promo, 0);
  const movedDate = await api('PUT', `/orders/${dated}`, { order_date: '2027-03-02' });
  assert.equal(movedDate.status, 200, JSON.stringify(movedDate.data));
  assert.equal(one<{ quantity_promo: number }>('SELECT quantity_promo FROM order_items WHERE order_id = ?', dated).quantity_promo, 1);

  const split = await f.order({ items: [
    { product_id: f.product, quantity: 5 }, { product_id: f.product, quantity: 5 },
  ] });
  assert.deepEqual(db.prepare('SELECT quantity_promo FROM order_items WHERE order_id = ? ORDER BY id')
    .all(split).map((line) => (line as { quantity_promo: number }).quantity_promo), [1, 0]);
  const mixed = await f.order({ items: [
    { product_id: f.product, quantity: 5 }, { product_id: freeProduct, quantity: 5 },
  ] });
  assert.deepEqual(db.prepare('SELECT quantity_promo FROM order_items WHERE order_id = ? ORDER BY id')
    .all(mixed).map((line) => (line as { quantity_promo: number }).quantity_promo), [0, 0]);
});

test('merging two five-unit sales recalculates one same-product gift', async () => {
  const f = fixture(11);
  db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active)
              VALUES (?, ?, ?, 10, 1, 1)`).run(`KM-AUD-${f.product}`, 'Mua 10 tặng 1', f.product);
  const a = await f.order({ items: [{ product_id: f.product, quantity: 5 }] });
  const b = await f.order({ items: [{ product_id: f.product, quantity: 5 }] });
  const merged = await api('POST', '/orders/merge', { ids: [a, b] });
  assert.equal(merged.status, 200, JSON.stringify(merged.data));
  assert.deepEqual(one<{ quantity: number; quantity_promo: number }>(
    'SELECT quantity, quantity_promo FROM order_items WHERE order_id = ?', merged.data.orderId),
    { quantity: 10, quantity_promo: 1 });
});

test('manual receipt and transfer apply 10+1 to the same product on both warehouse sides', async () => {
  const f = fixture();
  const destination = fixture().warehouse;
  db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active)
              VALUES (?, ?, ?, 10, 1, 1)`).run(`KM-AUD-${f.product}`, 'Mua 10 tặng 1', f.product);
  const receipt = await api('POST', '/stock-tickets', {
    ticket_type: 'IN', ticket_date: '2027-03-02', warehouse_id: f.warehouse, reason: 'PARENT_RECEIVE',
    items: [{ product_id: f.product, quantity: 100 }],
  });
  assert.equal(receipt.status, 200, JSON.stringify(receipt.data));
  assert.deepEqual(one<{ quantity: number; quantity_promo: number }>(
    'SELECT quantity, quantity_promo FROM stock_ticket_items WHERE ticket_id = ?', receipt.data.id),
    { quantity: 100, quantity_promo: 10 });
  assert.equal(f.stock(), 0);
  assert.equal((await api('POST', `/stock-tickets/${receipt.data.id}/status`, { status: 'CONFIRMED' })).status, 200);
  assert.equal(f.stock(), 110);

  const transfer = await api('POST', '/stock-tickets', {
    ticket_type: 'TRANSFER', ticket_date: '2027-03-02', warehouse_id: f.warehouse,
    target_warehouse_id: destination, reason: 'TRANSFER',
    items: [{ product_id: f.product, quantity: 50 }],
  });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.data));
  assert.deepEqual(one<{ quantity: number; quantity_promo: number }>(
    'SELECT quantity, quantity_promo FROM stock_ticket_items WHERE ticket_id = ?', transfer.data.id),
    { quantity: 50, quantity_promo: 5 });
  assert.equal((await api('POST', `/stock-tickets/${transfer.data.id}/status`, { status: 'CONFIRMED' })).status, 200);
  assert.equal(f.stock(), 55);
  assert.equal(one<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', destination, f.product).quantity, 55);

  const issued = await api('POST', '/stock-tickets', {
    ticket_type: 'OUT', ticket_date: '2027-03-02', warehouse_id: destination, reason: 'OTHER_OUT',
    items: [{ product_id: f.product, quantity: 10 }],
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.data));
  assert.equal(one<{ quantity_promo: number }>('SELECT quantity_promo FROM stock_ticket_items WHERE ticket_id = ?', issued.data.id).quantity_promo, 1);
  assert.equal((await api('POST', `/stock-tickets/${issued.data.id}/status`, { status: 'CONFIRMED' })).status, 200);
  assert.equal(one<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', destination, f.product).quantity, 44);
});

test('stock adjustments do not invent promotional goods', async () => {
  const f = fixture();
  db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active)
              VALUES (?, ?, ?, 10, 1, 1)`).run(`KM-AUD-${f.product}`, 'Mua 10 tặng 1', f.product);
  const adjustment = await api('POST', '/stock-tickets', {
    ticket_type: 'IN', ticket_date: '2027-03-02', warehouse_id: f.warehouse, reason: 'ADJUST_IN',
    items: [{ product_id: f.product, quantity: 100 }],
  });
  assert.equal(adjustment.status, 200, JSON.stringify(adjustment.data));
  assert.equal(one<{ quantity_promo: number }>('SELECT quantity_promo FROM stock_ticket_items WHERE ticket_id = ?', adjustment.data.id).quantity_promo, 0);
  const invalid = await api('POST', '/stock-tickets', {
    ticket_type: 'IN', ticket_date: '2027-03-02', warehouse_id: f.warehouse, reason: 'ADJUST_IN',
    items: [{ product_id: f.product, quantity: 100, quantity_promo: 10 }],
  });
  assert.equal(invalid.status, 400);
});

test('editing a delivery ticket recalculates its gift and rejects gifts above entitlement', async () => {
  const f = fixture();
  db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active)
              VALUES (?, ?, ?, 10, 1, 1)`).run(`KM-AUD-${f.product}`, 'Mua 10 tặng 1', f.product);
  const base = {
    ticket_type: 'IN', ticket_date: '2027-03-02', warehouse_id: f.warehouse, reason: 'OTHER_IN',
  };
  const invalid = await api('POST', '/stock-tickets', {
    ...base, items: [{ product_id: f.product, quantity: 10, quantity_promo: 2 }],
  });
  assert.equal(invalid.status, 400);
  const created = await api('POST', '/stock-tickets', {
    ...base, items: [{ product_id: f.product, quantity: 10 }],
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const updated = await api('PUT', `/stock-tickets/${created.data.id}`, {
    ...base, items: [{ product_id: f.product, quantity: 20, quantity_promo: 1 }],
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.deepEqual(one<{ quantity: number; quantity_promo: number }>(
    'SELECT quantity, quantity_promo FROM stock_ticket_items WHERE ticket_id = ?', created.data.id),
    { quantity: 20, quantity_promo: 2 });
});

test('dashboard reports period revenue and unpaid debt, scope split, and every physical warehouse', async () => {
  const f = fixture(7);
  const second = fixture();
  const service = fixture();
  const serviceCategory = Number(db.prepare("INSERT INTO categories (code, name, type) VALUES (?, ?, 'SERVICE_DVGT')")
    .run(`DB-AUD-C-${service.product}`, 'Dịch vụ').lastInsertRowid);
  db.prepare('UPDATE products SET category_id = ? WHERE id = ?').run(serviceCategory, service.product);
  const insert = db.prepare(`INSERT INTO orders
    (order_code, customer_id, seller_employee_id, warehouse_id, order_date, order_status,
     order_type, target_scope, subtotal_amount, total_amount, paid_amount)
    VALUES (?, ?, ?, ?, ?, 'COMPLETED', 'SALE', ?, ?, ?, ?)`);
  const make = (code: string, date: string, scope: string, revenue: number, total: number, paid: number) =>
    insert.run(code, f.customer, f.employee, f.warehouse, date, scope, revenue, total, paid);
  make(`DB-AUD-${f.product}-1`, '2041-03-02', 'COMPANY', 100, 120, 20);
  make(`DB-AUD-${f.product}-2`, '2041-03-03', 'ENTERPRISE', 30, 30, 30);
  make(`DB-AUD-${f.product}-3`, '2041-01-15', 'ENTERPRISE', 50, 50, 10);
  const currentDay = new Date();
  const today = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
  make(`DB-AUD-${f.product}-4`, today, 'COMPANY', 25, 25, 0);

  const response = await api('GET', '/dashboard?month=2041-03');
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.kpis.revenueToday, 25);
  assert.equal(response.data.kpis.debtToday, 25);
  assert.equal(response.data.kpis.revenueMonth, 130);
  assert.equal(response.data.kpis.debtMonth, 100);
  assert.equal(response.data.kpis.revenueYear, 180);
  assert.equal(response.data.kpis.debtYear, 140);
  assert.deepEqual(response.data.revenueByScope, [
    { scope: 'COMPANY', revenue: 100 }, { scope: 'ENTERPRISE', revenue: 30 },
  ]);
  const warehouse = response.data.stockByWarehouse.find((w: { warehouse_id: number }) => w.warehouse_id === f.warehouse);
  assert.equal(warehouse.items.find((i: { product_id: number }) => i.product_id === f.product).quantity, 7);
  assert.equal(warehouse.items.find((i: { product_id: number }) => i.product_id === second.product).quantity, 0);
  assert.ok(!warehouse.items.some((i: { product_id: number }) => i.product_id === service.product));
  assert.ok(response.data.stockByWarehouse.some((w: { warehouse_id: number }) => w.warehouse_id === second.warehouse));
  assert.equal((await api('GET', '/dashboard?month=2041-13')).status, 400);
});

test('fresh borrowed sale: no own stock out, customer return to physical warehouse, then goods repayment', async () => {
  const f = fixture();
  const id = await f.order({ order_type: 'BORROW_IN', partner_unit_id: f.partner, shipper_employee_id: null, shippers: [], shipping_fee_id: null });
  await finish(id);
  assert.equal(f.stock(), 0);
  assert.equal(one<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', id).shipping_fee, 0);
  const before = await api('GET', '/loans');
  assert.equal(before.status, 200);
  const item = one<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const returned = await api('POST', `/orders/${id}/return`, {
    return_date: '2027-03-02', return_warehouse_id: f.warehouse,
    items: [{ order_item_id: item, quantity: 2 }],
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  assert.equal(f.stock(), 2);
  const settled = await api('POST', `/loans/${id}/settle`, {
    settle_date: '2027-03-02', warehouse_id: f.warehouse,
    items: [{ product_id: f.product, quantity: 2 }],
  });
  assert.equal(settled.status, 200, JSON.stringify(settled.data));
  assert.equal(settled.data.state.status, 'SETTLED');
  assert.equal(f.stock(), 0);
});

test('fresh lend and hired load: goods debt versus fee, without sales revenue or hired stock', async () => {
  const f = fixture(4);
  const lend = await f.order({ order_type: 'LEND_OUT', partner_unit_id: f.partner });
  await finish(lend);
  assert.equal(f.stock(), 2);
  assert.deepEqual(one<{ subtotal_amount: number; shipping_fee: number; total_amount: number }>(
    'SELECT subtotal_amount, shipping_fee, total_amount FROM orders WHERE id = ?', lend),
    { subtotal_amount: 40000, shipping_fee: 10000, total_amount: 10000 });
  const payFee = await api('POST', `/orders/${lend}/collect`, { amount: 10000 });
  assert.equal(payFee.status, 200, JSON.stringify(payFee.data));
  const settle = await api('POST', `/loans/${lend}/settle`, { settle_date: '2027-03-02', items: [{ product_id: f.product, quantity: 2 }] });
  assert.equal(settle.status, 200, JSON.stringify(settle.data));
  assert.equal(f.stock(), 4);
  const hired = await f.order({ order_type: 'HIRED_LOAD', partner_unit_id: f.partner });
  await finish(hired);
  assert.equal(f.stock(), 4);
  assert.deepEqual(one<{ subtotal_amount: number; shipping_fee: number; total_amount: number }>(
    'SELECT subtotal_amount, shipping_fee, total_amount FROM orders WHERE id = ?', hired),
    { subtotal_amount: 0, shipping_fee: 10000, total_amount: 10000 });
  assert.equal(one<{ count: number }>('SELECT COUNT(*) AS count FROM stock_tickets WHERE order_id = ?', hired).count, 0);
});

test('fresh confirmed merge: source tickets removed, merged pending ticket posts once', async () => {
  const f = fixture(4);
  const a = await f.order();
  const b = await f.order();
  await status(a, 'CONFIRMED');
  await status(b, 'CONFIRMED');
  const merged = await api('POST', '/orders/merge', { ids: [a, b] });
  assert.equal(merged.status, 200, JSON.stringify(merged.data));
  const id = merged.data.orderId;
  assert.equal(f.stock(), 4);
  assert.equal(one<{ count: number }>('SELECT COUNT(*) AS count FROM stock_tickets WHERE order_id IN (?, ?)', a, b).count, 0);
  assert.equal(one<{ status: string }>('SELECT status FROM stock_tickets WHERE order_id = ?', id).status, 'DRAFT');
  await status(id, 'SHIPPING');
  assert.equal(f.stock(), 0);
  await status(id, 'COMPLETED');
  assert.equal(one<{ count: number }>('SELECT COUNT(*) AS count FROM stock_movements WHERE reference_id = ? AND movement_type = ?', String(id), 'EXPORT_ORDER').count, 1);
});

test('fresh source scopes: revenue is consolidated and split by source', async () => {
  const f = fixture(2);
  const company = await f.order({ order_date: '2027-04-02', target_scope: 'COMPANY', order_type: 'BORROW_IN', partner_unit_id: f.partner, shipper_employee_id: null, shippers: [], shipping_fee_id: null });
  const enterprise = await f.order({ order_date: '2027-04-02', target_scope: 'ENTERPRISE' });
  await finish(company);
  await finish(enterprise);
  const report = await api('GET', '/reports/trade-template?month=2027-04');
  assert.equal(report.status, 200, JSON.stringify(report.data));
  assert.equal(report.data.current.totals.quantity, 4);
  assert.equal(report.data.current.totals.amount_gross, 80000);
  assert.equal(report.data.sources.current.reduce((sum: number, source: any) => sum + source.block.totals.quantity, 0), 4);
  assert.equal(report.data.sources.current.find((source: any) => source.key === 'COMPANY').block.totals.quantity, 2);
  assert.equal(report.data.sources.current.find((source: any) => source.key === 'ENTERPRISE').block.totals.quantity, 2);
  assert.equal(report.data.sources.current.reduce((sum: number, source: any) => sum + source.block.totals.amount_gross, 0), 80000);
});

test('fresh delivery fee follows staff assignment, and cancelling a prepaid trip refunds it', async () => {
  const f = fixture(2);
  const sale = await f.order({ payment_status: 'PAID' });
  const original = one<{ total_amount: number; shipping_fee: number; paid_amount: number }>(
    'SELECT total_amount, shipping_fee, paid_amount FROM orders WHERE id = ?', sale);
  assert.deepEqual(original, { total_amount: 50000, shipping_fee: 10000, paid_amount: 50000 });
  assert.equal(one<{ allocated_fee: number }>('SELECT allocated_fee FROM order_shippers WHERE order_id = ?', sale).allocated_fee, 10000);
  assert.equal(one<{ amount: number }>('SELECT SUM(amount) AS amount FROM revenue_transactions WHERE order_id = ?', sale).amount, 50000);
  await status(sale, 'CONFIRMED');
  await status(sale, 'SHIPPING');
  assert.equal(f.stock(), 0);
  await status(sale, 'CANCELLED');
  assert.equal(f.stock(), 2);
  assert.equal(one<{ amount: number }>('SELECT SUM(amount) AS amount FROM revenue_transactions WHERE order_id = ?', sale).amount, 0);
  assert.equal(one<{ count: number }>('SELECT COUNT(*) AS count FROM delivery_dispatches WHERE order_id = ?', sale).count, 0);

  const borrowed = await f.order({ order_type: 'BORROW_IN', partner_unit_id: f.partner });
  await finish(borrowed);
  assert.equal(one<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', borrowed).shipping_fee, 10000);
  assert.equal(one<{ allocated_fee: number }>('SELECT allocated_fee FROM order_shippers WHERE order_id = ?', borrowed).allocated_fee, 10000);
});

test('invalid prices and discounts cannot create negative or inflated sales', async () => {
  const f = fixture(3);
  const negativePrice = await api('POST', '/orders', {
    customer_id: f.customer, seller_employee_id: f.employee, shipper_employee_id: f.shipper,
    warehouse_id: f.warehouse, shipping_fee_id: f.fee, order_date: '2027-05-02',
    items: [{ product_id: f.product, quantity: 1, unit_price: -1000 }],
  });
  assert.equal(negativePrice.status, 400);
  const negativeDiscount = await api('POST', '/orders', {
    customer_id: f.customer, seller_employee_id: f.employee, shipper_employee_id: f.shipper,
    warehouse_id: f.warehouse, shipping_fee_id: f.fee, order_date: '2027-05-02',
    discount_amount: -10000, items: [{ product_id: f.product, quantity: 1 }],
  });
  assert.equal(negativeDiscount.status, 400);
  const excessiveDiscount = await api('POST', '/orders', {
    customer_id: f.customer, seller_employee_id: f.employee, shipper_employee_id: f.shipper,
    warehouse_id: f.warehouse, shipping_fee_id: f.fee, order_date: '2027-05-02',
    discount_amount: 100000, items: [{ product_id: f.product, quantity: 1 }],
  });
  assert.equal(excessiveDiscount.status, 400);
  const valid = await f.order();
  const invalidEdit = await api('PUT', `/orders/${valid}`, { discount_amount: 100000 });
  assert.equal(invalidEdit.status, 400);
  assert.equal(one<{ discount_amount: number }>('SELECT discount_amount FROM orders WHERE id = ?', valid).discount_amount, 0);
  const discountedSale = await f.order({ discount_amount: 5000 });
  const changedType = await api('PUT', `/orders/${discountedSale}`, { order_type: 'LEND_OUT', partner_unit_id: f.partner });
  assert.equal(changedType.status, 200, JSON.stringify(changedType.data));
  assert.deepEqual(one<{ discount_amount: number; total_amount: number }>(
    'SELECT discount_amount, total_amount FROM orders WHERE id = ?', discountedSale),
    { discount_amount: 0, total_amount: 10000 });
});

test('unknown order type or source scope cannot silently become another business flow', async () => {
  const f = fixture();
  const baseOrder = {
    customer_id: f.customer, seller_employee_id: f.employee, shipper_employee_id: f.shipper,
    warehouse_id: f.warehouse, shipping_fee_id: f.fee, order_date: '2027-06-02',
    items: [{ product_id: f.product, quantity: 1 }],
  };
  assert.equal((await api('POST', '/orders', { ...baseOrder, order_type: 'BORROW' })).status, 400);
  assert.equal((await api('POST', '/orders', { ...baseOrder, target_scope: 'BRANCH' })).status, 400);
});

test('own-stock orders cannot use a virtual warehouse, including after editing the order type', async () => {
  const f = fixture();
  const virtualWarehouse = one<{ id: number }>("SELECT id FROM warehouses WHERE type = 'VIRTUAL' LIMIT 1").id;
  const baseOrder = {
    customer_id: f.customer, seller_employee_id: f.employee, shipper_employee_id: f.shipper,
    warehouse_id: virtualWarehouse, shipping_fee_id: f.fee, order_date: '2027-07-02',
    items: [{ product_id: f.product, quantity: 1 }],
  };
  assert.equal((await api('POST', '/orders', baseOrder)).status, 400);
  assert.equal((await api('POST', '/orders', { ...baseOrder, order_type: 'LEND_OUT', partner_unit_id: f.partner })).status, 400);
  const hired = await f.order({ order_type: 'HIRED_LOAD', partner_unit_id: f.partner });
  assert.equal((await api('PUT', `/orders/${hired}`, { order_type: 'SALE' })).status, 400);
  assert.equal(one<{ order_type: string }>('SELECT order_type FROM orders WHERE id = ?', hired).order_type, 'HIRED_LOAD');
});
