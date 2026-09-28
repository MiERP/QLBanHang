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

const [{ getDb }, { ordersRouter }, { loansRouter }, { stockTicketsRouter }, { reportsRouter }, { errorMiddleware }] =
  await Promise.all([
    import('../src/db.js'),
    import('../src/routes/orders.js'),
    import('../src/routes/loans.js'),
    import('../src/routes/stockTickets.js'),
    import('../src/routes/reports.js'),
    import('../src/lib/http.js'),
  ]);
const db = getDb();
const app = express();
app.use(express.json());
for (const router of [ordersRouter(), loansRouter(), stockTicketsRouter(), reportsRouter()]) app.use('/api', router);
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
  const id = await f.order({ items: [{ product_id: f.product, quantity: 2, quantity_promo: 1 }] });
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
