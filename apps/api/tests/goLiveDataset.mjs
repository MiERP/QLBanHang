// Rebuild a disposable go-live test database through the same HTTP routes used by the UI.
// Usage: node apps/api/tests/goLiveDataset.mjs <new-absolute-db-path>
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import Database from 'better-sqlite3';

const requestedPath = process.argv[2];
if (!requestedPath || !isAbsolute(requestedPath)) {
  throw new Error('Provide an absolute path for a new test database.');
}
const dbPath = resolve(requestedPath);
if (existsSync(dbPath)) throw new Error(`Refusing to overwrite an existing database: ${dbPath}`);

const date = '2026-10-01';
const period = '2026-10';
process.env.DB_PATH = dbPath;
const fresh = new Database(dbPath);
fresh.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
fresh.close();

const dist = (name) => import(pathToFileURL(join(process.cwd(), 'apps/api/dist', name)).href);
const [
  { getDb }, { masterDataRouter }, { productsRouter }, { staffRouter },
  { customersRouter }, { targetsRouter }, { stockTicketsRouter },
  { ordersRouter }, { loansRouter }, { dashboardRouter }, { errorMiddleware },
] = await Promise.all([
  'db.js', 'routes/masterData.js', 'routes/products.js', 'routes/staff.js',
  'routes/customers.js', 'routes/targets.js', 'routes/stockTickets.js',
  'routes/orders.js', 'routes/loans.js', 'routes/dashboard.js', 'lib/http.js',
].map(dist));

const db = getDb();
const app = express();
app.use(express.json());
for (const router of [masterDataRouter(), productsRouter(), staffRouter(), customersRouter(),
  targetsRouter(), stockTicketsRouter(), ordersRouter(), loansRouter(), dashboardRouter()]) {
  app.use('/api', router);
}
app.use(errorMiddleware);
const server = await new Promise((done) => {
  const listener = app.listen(0, '127.0.0.1', () => done(listener));
});
const base = `http://127.0.0.1:${server.address().port}/api`;
const sqlOne = (query, ...params) => db.prepare(query).get(...params);
const sqlAll = (query, ...params) => db.prepare(query).all(...params);
const trace = [];

async function request(method, path, body, expectedStatus = 200) {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
const post = (path, body, expectedStatus) => request('POST', path, body, expectedStatus);
const get = (path) => request('GET', path);
const count = (table) => sqlOne(`SELECT COUNT(*) AS n FROM ${table}`).n;
const stock = (warehouse, product) => sqlOne(
  'SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouse, product,
)?.quantity ?? 0;

async function ticket(body, expectedGift) {
  const created = await post('/stock-tickets', { ticket_date: date, ...body });
  const lines = sqlAll('SELECT quantity, quantity_promo FROM stock_ticket_items WHERE ticket_id = ? ORDER BY id', created.id);
  assert.equal(lines[0].quantity_promo, expectedGift);
  assert.equal(sqlOne('SELECT status FROM stock_tickets WHERE id = ?', created.id).status, 'DRAFT');
  await post(`/stock-tickets/${created.id}/status`, { status: 'CHECKING' });
  await post(`/stock-tickets/${created.id}/status`, { status: 'CONFIRMED' });
  return { id: created.id, code: created.code, items: lines };
}

async function order({ type, scope, product, quantity, warehouse, customer, seller, shipper,
  partner, fee, payment, requestedGift = 0 }) {
  const beforeStock = stock(warehouse, product);
  const created = await post('/orders', {
    customer_id: customer,
    seller_employee_id: seller,
    shipper_employee_id: shipper,
    warehouse_id: warehouse,
    shipping_fee_id: fee,
    partner_unit_id: type === 'SALE' ? undefined : partner,
    order_type: type,
    target_scope: scope,
    order_date: date,
    payment_method: payment === 'PAID' ? 'CASH' : 'DEBT',
    payment_status: payment,
    items: [{ product_id: product, quantity, quantity_promo: requestedGift,
      unit_price: product === ids.voi ? 20000 : 15000 }],
  });
  const id = created.orderId;
  assert.equal(stock(warehouse, product), beforeStock, 'Draft changed physical stock');
  await post(`/orders/${id}/status`, { status: 'CONFIRMED' });
  assert.equal(stock(warehouse, product), beforeStock, 'Confirmation changed physical stock');
  const pending = sqlAll('SELECT status FROM stock_tickets WHERE order_id = ?', id);
  assert.ok(pending.length > 0);
  assert.ok(pending.every((row) => row.status === 'DRAFT'));
  await post(`/orders/${id}/status`, { status: 'SHIPPING' });
  assert.ok(sqlAll('SELECT status FROM stock_tickets WHERE order_id = ?', id)
    .every((row) => row.status === 'CONFIRMED'));
  await post(`/orders/${id}/status`, { status: 'COMPLETED' });
  const header = sqlOne('SELECT * FROM orders WHERE id = ?', id);
  const line = sqlOne('SELECT * FROM order_items WHERE order_id = ?', id);
  assert.equal(header.order_status, 'COMPLETED');
  assert.equal(header.payment_status, payment);
  return { id, code: header.order_code, type, scope, product, quantity,
    gift: line.quantity_promo, goods: header.subtotal_amount,
    shipping: header.shipping_fee, payable: header.total_amount, paid: header.paid_amount };
}

const ids = {};
try {
  for (const table of ['customers', 'employees', 'products', 'price_list', 'promotions',
    'targets', 'stock_tickets', 'orders']) assert.equal(count(table), 0, `Not empty: ${table}`);
  trace.push('01: New database has no business records');

  ids.enterprise = (await post('/org-units', { name: 'Xí nghiệp kiểm thử', unit_type: 'Xí nghiệp' })).id;
  ids.station = (await post('/org-units', {
    name: 'Trạm A kiểm thử', unit_type: 'Trạm', parent_id: ids.enterprise,
  })).id;
  ids.central = (await post('/warehouses', { name: 'Kho xí nghiệp kiểm thử', type: 'CENTRAL' })).id;
  ids.warehouseA = (await post('/warehouses', { name: 'Kho A kiểm thử', type: 'STATION' })).id;
  ids.source = (await post('/import-sources', { name: 'Nguồn hàng kiểm thử' })).id;
  ids.category = (await post('/categories', {
    code: 'GL-CAT', name: 'Bình nước kiểm thử', type: 'BOTTLE_WATER',
  })).id;
  ids.group = (await post('/customer-groups', { code: 'GL-GRP', name: 'Nhóm khách kiểm thử' })).id;
  ids.seller = (await post('/staff', { full_name: 'Nhân viên bán kiểm thử', org_unit_id: ids.station })).id;
  ids.shipper = (await post('/staff', { full_name: 'Nhân viên giao kiểm thử', org_unit_id: ids.station })).id;
  ids.partner = (await post('/partner-units', { name: 'Đối tác kiểm thử' })).id;
  ids.voi = (await post('/products', {
    name: 'Bình vòi kiểm thử', category_id: ids.category, unit: 'Bình',
    bottle_type: 'VOI', standard_price: 23000,
  })).id;
  ids.up = (await post('/products', {
    name: 'Bình úp kiểm thử', category_id: ids.category, unit: 'Bình',
    bottle_type: 'UP', standard_price: 18000,
  })).id;
  ids.priceVoi = (await post('/price-list', {
    product_id: ids.voi, customer_group_id: ids.group, unit_price: 20000, effective_date: date,
  })).id;
  ids.priceUp = (await post('/price-list', {
    product_id: ids.up, customer_group_id: ids.group, unit_price: 15000, effective_date: date,
  })).id;
  ids.fee = (await post('/shipping-fees', { name: 'Tuyến kiểm thử', fee_per_unit: 1000 })).id;
  ids.promotion = (await post('/promotions', {
    name: 'Mua 10 bình vòi tặng 1 cùng loại', product_id: ids.voi,
    buy_quantity: 10, free_quantity: 1, start_date: date, is_active: 1,
  })).id;
  assert.equal((await post('/promotions', {
    name: 'Không hợp lệ: tặng bình khác', product_id: ids.voi, free_product_id: ids.up,
    buy_quantity: 10, free_quantity: 1,
  }, 400)).error.length > 0, true);
  await post('/targets', {
    period, scope_type: 'EMPLOYEE', employee_id: ids.seller, target_revenue: 500000,
  });
  await post('/targets', {
    period, scope_type: 'UNIT', org_unit_id: ids.station, target_revenue: 500000,
  });
  assert.equal(count('price_list'), 2);
  assert.equal(count('targets'), 2);
  trace.push('02: Products, warehouses, prices, route fee, same-product promotion, staff, station and KPI created');

  const receiptVoi = await ticket({ ticket_type: 'IN', warehouse_id: ids.central,
    source_id: ids.source, reason: 'PARENT_RECEIVE', items: [{ product_id: ids.voi, quantity: 100 }] }, 10);
  const receiptUp = await ticket({ ticket_type: 'IN', warehouse_id: ids.central,
    source_id: ids.source, reason: 'PARENT_RECEIVE', items: [{ product_id: ids.up, quantity: 60 }] }, 0);
  assert.equal(stock(ids.central, ids.voi), 110);
  assert.equal(stock(ids.central, ids.up), 60);
  const transferVoi = await ticket({ ticket_type: 'TRANSFER', warehouse_id: ids.central,
    target_warehouse_id: ids.warehouseA, reason: 'TRANSFER',
    items: [{ product_id: ids.voi, quantity: 50 }] }, 5);
  const transferUp = await ticket({ ticket_type: 'TRANSFER', warehouse_id: ids.central,
    target_warehouse_id: ids.warehouseA, reason: 'TRANSFER',
    items: [{ product_id: ids.up, quantity: 20 }] }, 0);
  assert.deepEqual([
    stock(ids.central, ids.voi), stock(ids.warehouseA, ids.voi),
    stock(ids.central, ids.up), stock(ids.warehouseA, ids.up),
  ], [55, 55, 40, 20]);
  await post('/stock-tickets', { ticket_type: 'IN', warehouse_id: ids.central,
    ticket_date: date, reason: 'ADJUST_IN', items: [{ product_id: ids.voi, quantity: 100,
      quantity_promo: 10 }] }, 400);
  trace.push('03: Receipt 100+10 and transfer 50+5 post exactly once; adjustment cannot invent gifts');

  ids.customer = (await post('/customers', {
    name: 'Khách hàng mới kiểm thử', address: 'Địa chỉ kiểm thử', group_id: ids.group,
  })).id;
  assert.equal(count('customers'), 1);
  const invalidGift = await post('/orders', { customer_id: ids.customer,
    seller_employee_id: ids.seller, shipper_employee_id: ids.shipper,
    warehouse_id: ids.warehouseA, shipping_fee_id: ids.fee, order_date: date,
    items: [{ product_id: ids.voi, quantity: 9, quantity_promo: 1 }] }, 400);
  assert.ok(invalidGift.error);
  assert.equal(count('orders'), 0);
  trace.push('04: A new customer is created; a 9+1 order is rejected without a draft');

  const orders = [];
  orders.push(await order({ type: 'SALE', scope: 'COMPANY', product: ids.up, quantity: 2,
    warehouse: ids.warehouseA, customer: ids.customer, seller: ids.seller,
    shipper: ids.shipper, fee: ids.fee, payment: 'UNPAID' }));
  assert.equal(orders.at(-1).gift, 0);
  assert.equal(orders.at(-1).payable, 32000);
  assert.equal(stock(ids.warehouseA, ids.up), 18);
  trace.push('05: Company sale without gift records 30,000 goods, 2,000 freight and 32,000 debt');

  orders.push(await order({ type: 'SALE', scope: 'ENTERPRISE', product: ids.voi, quantity: 10,
    warehouse: ids.warehouseA, customer: ids.customer, seller: ids.seller,
    shipper: ids.shipper, fee: ids.fee, payment: 'PAID' }));
  assert.equal(orders.at(-1).gift, 1);
  assert.equal(orders.at(-1).payable, 210000);
  assert.equal(stock(ids.warehouseA, ids.voi), 44);
  trace.push('06: Enterprise sale 10+1 charges only 10 units and ships 11');

  orders.push(await order({ type: 'BORROW_IN', scope: 'COMPANY', product: ids.up, quantity: 2,
    warehouse: ids.warehouseA, customer: ids.customer, seller: ids.seller,
    shipper: ids.shipper, partner: ids.partner, fee: ids.fee, payment: 'UNPAID' }));
  assert.equal(orders.at(-1).gift, 0);
  assert.equal(orders.at(-1).payable, 32000);
  assert.equal(stock(ids.warehouseA, ids.up), 18);
  trace.push('07: Company borrowed sale creates partner goods debt and customer debt without own-stock out');

  orders.push(await order({ type: 'BORROW_IN', scope: 'ENTERPRISE', product: ids.voi, quantity: 10,
    warehouse: ids.warehouseA, customer: ids.customer, seller: ids.seller,
    shipper: ids.shipper, partner: ids.partner, fee: ids.fee, payment: 'PAID' }));
  assert.equal(orders.at(-1).gift, 1);
  assert.equal(orders.at(-1).payable, 210000);
  assert.equal(stock(ids.warehouseA, ids.voi), 44);
  trace.push('08: Enterprise borrowed sale 10+1 delivers 11 and preserves own physical stock');

  orders.push(await order({ type: 'LEND_OUT', scope: 'COMPANY', product: ids.voi, quantity: 10,
    warehouse: ids.warehouseA, customer: ids.customer, seller: ids.seller,
    shipper: ids.shipper, partner: ids.partner, fee: ids.fee, payment: 'UNPAID' }));
  assert.equal(orders.at(-1).gift, 0, 'Lending is not a sale promotion');
  assert.equal(orders.at(-1).payable, 10000, 'Lending must charge freight only');
  assert.equal(stock(ids.warehouseA, ids.voi), 34);
  assert.equal(orders.reduce((sum, row) => sum + row.shipping, 0), 34000);
  trace.push('09: Lending 10 units creates partner receivable, no free unit and no goods revenue');

  const customer = sqlOne('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?', ids.customer);
  assert.deepEqual(customer, { bottle_debt_voi: 22, bottle_debt_up: 4 });
  const dashboard = await get(`/dashboard?month=${period}`);
  assert.equal(dashboard.kpis.revenueMonth, 460000);
  assert.equal(dashboard.kpis.debtMonth, 64000);
  assert.equal(dashboard.kpis.bottleDebtVoi, 22);
  assert.equal(dashboard.kpis.bottleDebtUp, 4);
  assert.deepEqual(dashboard.revenueByScope, [
    { scope: 'COMPANY', revenue: 60000 }, { scope: 'ENTERPRISE', revenue: 400000 },
  ]);
  const targetRows = await get(`/targets?period=${period}`);
  const employeeKpi = targetRows.employees.find((row) => row.employee_id === ids.seller);
  const stationKpi = targetRows.units.find((row) => row.org_unit_id === ids.station);
  assert.equal(employeeKpi.actual_revenue, 460000);
  assert.equal(stationKpi.actual_revenue, 460000);
  assert.equal(employeeKpi.completion_percentage, 92);
  assert.equal(stationKpi.completion_percentage, 92);
  const cash = sqlAll('SELECT order_id, transaction_type, amount FROM revenue_transactions ORDER BY id');
  assert.equal(cash.length, 2);
  assert.equal(cash.reduce((sum, row) => sum + row.amount, 0), 422000);
  const loans = await get(`/loans?month=${period}`);
  assert.equal(loans.length, 3);
  assert.deepEqual(loans.map((row) => row.remaining_units).sort((a, b) => a - b), [2, 10, 11]);
  assert.equal(loans.find((row) => row.order_id === orders[2].id).remaining_units, 2);
  assert.equal(loans.find((row) => row.order_id === orders[3].id).remaining_units, 11);
  assert.equal(loans.find((row) => row.order_id === orders[4].id).remaining_units, 10);
  assert.equal(sqlOne('SELECT COUNT(*) AS n FROM stock_tickets WHERE status <> ?', 'CONFIRMED').n, 0);
  assert.equal(sqlAll('PRAGMA foreign_key_check').length, 0);
  assert.equal(sqlOne('PRAGMA integrity_check').integrity_check, 'ok');
  assert.equal(sqlOne('SELECT COUNT(*) AS n FROM inventory_stock WHERE quantity < 0').n, 0);
  assert.equal(count('orders'), 5);
  trace.push('10: Cash, debt, bottle ledgers, partner loans, stock, KPI and dashboard reconcile');

  console.log(JSON.stringify({ result: 'PASS', dbPath, date, ids,
    stock: { centralVoi: stock(ids.central, ids.voi), warehouseAVoi: stock(ids.warehouseA, ids.voi),
      centralUp: stock(ids.central, ids.up), warehouseAUp: stock(ids.warehouseA, ids.up) },
    tickets: [receiptVoi, receiptUp, transferVoi, transferUp],
    orders, customerBottleDebt: customer,
    revenue: dashboard.kpis.revenueMonth, debt: dashboard.kpis.debtMonth,
    revenueByScope: dashboard.revenueByScope, employeeKpi, stationKpi,
    cashCollected: 422000, loanRemainingUnits: loans.map((row) => ({
      orderId: row.order_id, direction: row.loan_direction, units: row.remaining_units,
    })), trace }, null, 2));
} finally {
  await new Promise((done) => server.close(done));
  db.close();
}
