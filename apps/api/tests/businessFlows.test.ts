import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';

const testDir = mkdtempSync(join(tmpdir(), 'qaromi-business-test-'));
process.env.DB_PATH = join(testDir, 'test.db');

const [{ getDb }, { ordersRouter }, { loansRouter }, { stockTicketsRouter }, { reportsRouter }, { dashboardRouter }, { customersRouter }, { invoicesRouter }, { errorMiddleware }, { ORDER_DEBT_EXPR }] =
  await Promise.all([
    import('../src/db.js'),
    import('../src/routes/orders.js'),
    import('../src/routes/loans.js'),
    import('../src/routes/stockTickets.js'),
    import('../src/routes/reports.js'),
    import('../src/routes/dashboard.js'),
    import('../src/routes/customers.js'),
    import('../src/routes/invoices.js'),
    import('../src/lib/http.js'),
    import('../src/lib/customerDebt.js'),
  ]);

const db = getDb();
const app = express();
app.use(express.json());
for (const router of [ordersRouter(), loansRouter(), stockTicketsRouter(), reportsRouter(), dashboardRouter(), customersRouter(), invoicesRouter()]) {
  app.use('/api', router);
}
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

function row<T = any>(sql: string, ...params: unknown[]): T {
  return db.prepare(sql).get(...params) as T;
}

const customerId = row<{ id: number }>("SELECT id FROM customers WHERE code = 'KH001'").id;
const sellerId = row<{ id: number }>("SELECT id FROM employees WHERE code = 'NV006'").id;
const shipperId = row<{ id: number }>("SELECT id FROM employees WHERE code = 'NV012'").id;
const productId = row<{ id: number }>("SELECT id FROM products WHERE code = 'VI_500ML'").id;
const warehouseId = row<{ id: number }>("SELECT id FROM warehouses WHERE code = 'KHO_TANGAP'").id;
const feeId = row<{ id: number }>('SELECT id FROM shipping_fees ORDER BY id LIMIT 1').id;
assert.equal(row<{ fee_per_unit: number }>('SELECT fee_per_unit FROM shipping_fees WHERE id = ?', feeId).fee_per_unit, 5000);
const partnerId = row<{ id: number }>('SELECT id FROM partner_units ORDER BY id LIMIT 1').id;

async function createOrder(overrides: Record<string, unknown> = {}): Promise<number> {
  const result = await api('POST', '/orders', {
    customer_id: customerId,
    seller_employee_id: sellerId,
    shipper_employee_id: shipperId,
    warehouse_id: warehouseId,
    shipping_fee_id: feeId,
    order_date: '2026-09-25',
    payment_status: 'UNPAID',
    items: [{ product_id: productId, quantity: 1 }],
    ...overrides,
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data.orderId;
}

async function withTwoPlusOne(run: () => Promise<void>): Promise<void> {
  const promo = db.prepare(`INSERT INTO promotions (code, name, product_id, buy_quantity, free_quantity, is_active)
                            VALUES (?, 'Test 2+1', ?, 2, 1, 1)`)
    .run(`KM-TEST-${Date.now()}-${Math.random()}`, productId);
  try { await run(); }
  finally { db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(promo.lastInsertRowid); }
}

async function completeOrder(id: number): Promise<void> {
  for (const status of ['CONFIRMED', 'SHIPPING', 'COMPLETED']) {
    const result = await api('POST', `/orders/${id}/status`, { status });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
}

async function invoiceOrder(id: number): Promise<void> {
  const result = await api('POST', '/invoices', { order_id: id });
  assert.equal(result.status, 200, JSON.stringify(result.data));
}

test('confirmed order has pending ticket without stock reservation; shipping posts it and cancellation clears it', async () => {
  const first = await createOrder();
  const before = row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity;
  assert.equal((await api('POST', `/orders/${first}/status`, { status: 'CONFIRMED' })).status, 200);
  const ticket = row<{ id: number; status: string }>("SELECT id, status FROM stock_tickets WHERE order_id = ? AND reason = 'ORDER_SALE'", first);
  assert.equal(ticket.status, 'DRAFT');
  assert.equal((await api('POST', `/stock-tickets/${ticket.id}/status`, { status: 'CONFIRMED' })).status, 400);
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before);
  assert.equal((await api('POST', `/orders/${first}/status`, { status: 'SHIPPING' })).status, 200);
  assert.equal(row<{ status: string }>('SELECT status FROM stock_tickets WHERE id = ?', ticket.id).status, 'CONFIRMED');
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before - 1);
  assert.equal((await api('POST', `/orders/${first}/status`, { status: 'CANCELLED' })).status, 200);
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before);
  const second = await createOrder();
  assert.equal((await api('POST', `/orders/${second}/status`, { status: 'CONFIRMED' })).status, 200);
  assert.equal((await api('POST', `/orders/${second}/status`, { status: 'CANCELLED' })).status, 200);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM stock_tickets WHERE order_id = ?', second).count, 0);
});

test('draft can record demand above stock, confirmation checks stock, shipping checks again', async () => {
  const available = row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity;
  const id = await createOrder({ items: [{ product_id: productId, quantity: available + 1 }] });
  assert.equal(row<{ order_status: string }>('SELECT order_status FROM orders WHERE id = ?', id).order_status, 'DRAFT');
  assert.equal((await api('POST', `/orders/${id}/status`, { status: 'CONFIRMED' })).status, 400);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM stock_tickets WHERE order_id = ?', id).count, 0);
});

test('merging confirmed orders replaces source pending tickets with a confirmed merged order', async () => {
  const a = await createOrder();
  const b = await createOrder();
  for (const id of [a, b]) assert.equal((await api('POST', `/orders/${id}/status`, { status: 'CONFIRMED' })).status, 200);
  const merge = await api('POST', '/orders/merge', { ids: [a, b] });
  assert.equal(merge.status, 200, JSON.stringify(merge.data));
  assert.equal(row<{ order_status: string }>('SELECT order_status FROM orders WHERE id = ?', merge.data.orderId).order_status, 'CONFIRMED');
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM stock_tickets WHERE order_id IN (?, ?)', a, b).count, 0);
  assert.equal(row<{ status: string }>("SELECT status FROM stock_tickets WHERE order_id = ? AND reason = 'ORDER_SALE'", merge.data.orderId).status, 'DRAFT');
});

test('borrowed orders with different delivery responsibility cannot be merged', async () => {
  const partner = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, shipper_employee_id: null, shippers: [] });
  const own = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, shippers: [{ employee_id: shipperId }] });
  const result = await api('POST', '/orders/merge', { ids: [partner, own] });
  assert.equal(result.status, 400);
});

test('borrowed order charges delivery only when enterprise staff delivers', async () => {
  const partnerDelivery = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, shipper_employee_id: null, shippers: [], shipping_fee_id: null });
  assert.equal(row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', partnerDelivery).shipping_fee, 0);
  const ownDelivery = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, shippers: [{ employee_id: shipperId }] });
  assert.equal(row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', ownDelivery).shipping_fee, 5000);
  assert.equal(row<{ allocated_fee: number }>('SELECT allocated_fee FROM order_shippers WHERE order_id = ?', ownDelivery).allocated_fee, 5000);
  await completeOrder(ownDelivery);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM delivery_dispatches WHERE order_id = ?', ownDelivery).count, 1);
  const failed = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, shippers: [{ employee_id: shipperId }] });
  assert.equal((await api('POST', `/orders/${failed}/status`, { status: 'CONFIRMED' })).status, 200);
  assert.equal((await api('POST', `/orders/${failed}/status`, { status: 'SHIPPING' })).status, 200);
  assert.equal((await api('POST', `/orders/${failed}/status`, { status: 'CANCELLED' })).status, 200);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM delivery_dispatches WHERE order_id = ?', failed).count, 0);
});

test('lending and hired loading collect only the delivery fee and show it as receivable', async () => {
  const initialAudit = await api('GET', '/reports/cash-audit?from=2026-09-25&to=2026-09-25');
  let outstanding = initialAudit.data.totals.receivable;
  for (const type of ['LEND_OUT', 'HIRED_LOAD']) {
    const id = await createOrder({ order_type: type, partner_unit_id: partnerId });
    await completeOrder(id);
    const audit = await api('GET', '/reports/cash-audit?from=2026-09-25&to=2026-09-25');
    assert.equal(audit.status, 200, JSON.stringify(audit.data));
    assert.equal(audit.data.totals.receivable, outstanding + 5000);
    assert.ok(audit.data.partner_rows.some((p: { partner_unit_id: number; receivable: number }) => p.partner_unit_id === partnerId && p.receivable >= 5000));
    assert.equal((await api('POST', `/orders/${id}/collect`, { amount: 5000 })).status, 200);
    assert.deepEqual(row<{ transaction_type: string; amount: number }>('SELECT transaction_type, amount FROM revenue_transactions WHERE order_id = ?', id), { transaction_type: 'OTHER', amount: 5000 });
    outstanding = (await api('GET', '/reports/cash-audit?from=2026-09-25&to=2026-09-25')).data.totals.receivable;
  }
});

test('editing a confirmed order replaces the pending ticket and shipping checks stock again', async () => {
  const before = row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity;
  const id = await createOrder();
  assert.equal((await api('POST', `/orders/${id}/status`, { status: 'CONFIRMED' })).status, 200);
  const oldTicket = row<{ id: number }>("SELECT id FROM stock_tickets WHERE order_id = ? AND reason = 'ORDER_SALE'", id).id;
  assert.equal((await api('PUT', `/orders/${id}`, { items: [{ product_id: productId, quantity: 2 }] })).status, 200);
  const replacement = row<{ id: number; quantity: number }>("SELECT t.id, ti.quantity FROM stock_tickets t JOIN stock_ticket_items ti ON ti.ticket_id = t.id WHERE t.order_id = ? AND t.reason = 'ORDER_SALE'", id);
  assert.notEqual(replacement.id, oldTicket);
  assert.equal(replacement.quantity, 2);
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before);

  const competing = await createOrder({ items: [{ product_id: productId, quantity: before }] });
  assert.equal((await api('POST', `/orders/${competing}/status`, { status: 'CONFIRMED' })).status, 200);
  assert.equal((await api('POST', `/orders/${competing}/status`, { status: 'SHIPPING' })).status, 200);
  assert.equal((await api('POST', `/orders/${id}/status`, { status: 'SHIPPING' })).status, 400);
  assert.equal(row<{ order_status: string }>('SELECT order_status FROM orders WHERE id = ?', id).order_status, 'CONFIRMED');
  assert.equal(row<{ status: string }>('SELECT status FROM stock_tickets WHERE id = ?', replacement.id).status, 'DRAFT');
  assert.equal((await api('POST', `/orders/${competing}/status`, { status: 'CANCELLED' })).status, 200);
  assert.equal((await api('POST', `/orders/${id}/status`, { status: 'CANCELLED' })).status, 200);
});

test('full return requires promotional units and cannot be repeated', async () => withTwoPlusOne(async () => {
  const id = await createOrder({ items: [{ product_id: productId, quantity: 2, quantity_promo: 1 }] });
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  assert.equal((await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 2, quantity_promo: 0 }] })).status, 400);
  const result = await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 2, quantity_promo: 1 }] });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(row<{ order_status: string }>('SELECT order_status FROM orders WHERE id = ?', id).order_status, 'RETURNED');
  assert.deepEqual(row<{ quantity: number; quantity_promo: number }>("SELECT ti.quantity, ti.quantity_promo FROM stock_ticket_items ti JOIN stock_tickets t ON t.id = ti.ticket_id WHERE t.order_id = ? AND t.reason = 'ORDER_RETURN'", id), { quantity: 2, quantity_promo: 1 });
  assert.equal((await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 2, quantity_promo: 1 }] })).status, 400);
}));

test('trade report defaults to consolidated sales and splits the source quota', async () => {
  const baseline = await api('GET', '/reports/trade-template?month=2026-09');
  const id = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, target_scope: 'COMPANY', shipper_employee_id: null, shippers: [], shipping_fee_id: null, payment_status: 'PAID' });
  await completeOrder(id);
  await invoiceOrder(id);
  const consolidated = await api('GET', '/reports/trade-template?month=2026-09');
  const saleOnly = await api('GET', '/reports/trade-template?month=2026-09&borrowed=0');
  assert.equal(consolidated.status, 200, JSON.stringify(consolidated.data));
  assert.equal(saleOnly.status, 200, JSON.stringify(saleOnly.data));
  assert.equal(consolidated.data.includeBorrowed, true);
  assert.equal(consolidated.data.current.totals.quantity - baseline.data.current.totals.quantity, 1);
  assert.ok(consolidated.data.current.totals.quantity > saleOnly.data.current.totals.quantity);
  const sources = consolidated.data.sources.current as { key: string; block: { totals: { quantity: number } } }[];
  assert.equal(sources.reduce((sum, s) => sum + s.block.totals.quantity, 0), consolidated.data.current.totals.quantity);
  assert.ok(sources.find((s) => s.key === 'COMPANY')!.block.totals.quantity >= 1);
});

test('rejects negative promotional quantities before they can reverse stock direction', async () => {
  const order = await api('POST', '/orders', {
    customer_id: customerId, seller_employee_id: sellerId, shipper_employee_id: shipperId,
    warehouse_id: warehouseId, shipping_fee_id: feeId, order_date: '2026-09-25',
    items: [{ product_id: productId, quantity: 1, quantity_promo: -5 }],
  });
  assert.equal(order.status, 400);
  const ticket = await api('POST', '/stock-tickets', {
    ticket_type: 'IN', ticket_date: '2026-09-25', warehouse_id: warehouseId, reason: 'OTHER_IN',
    items: [{ product_id: productId, quantity: 1, quantity_promo: -5 }],
  });
  assert.equal(ticket.status, 400);
});

test('rejects duplicate customer-return lines whose combined quantity exceeds delivery', async () => {
  const id = await createOrder();
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id);
  const before = row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity;
  const result = await api('POST', `/orders/${id}/return`, {
    return_date: '2026-09-25', pickup_type: 'CUSTOMER_BRING',
    items: [{ order_item_id: item.id, quantity: 1 }, { order_item_id: item.id, quantity: 1 }],
  });
  assert.equal(result.status, 400);
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before);
});

test('rejects duplicate loan-settlement lines whose combined quantity exceeds the loan', async () => {
  const id = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId, items: [{ product_id: productId, quantity: 2 }] });
  await completeOrder(id);
  const before = row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity;
  const result = await api('POST', `/loans/${id}/settle`, {
    settle_date: '2026-09-25', warehouse_id: warehouseId,
    items: [{ product_id: productId, quantity: 2 }, { product_id: productId, quantity: 2 }],
  });
  assert.equal(result.status, 400);
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before);
});

test('customer return keeps the original delivery fee, reduces debt, and refunds excess payment', async () => {
  const initialDebt = row<{ amount: number }>(`SELECT ${ORDER_DEBT_EXPR} AS amount FROM customers c WHERE c.id = ?`, customerId).amount;
  const unpaidId = await createOrder();
  await completeOrder(unpaidId);
  const unpaid = row<{ total_amount: number; shipping_fee: number }>('SELECT total_amount, shipping_fee FROM orders WHERE id = ?', unpaidId);
  const unpaidItem = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', unpaidId).id;
  const returned = await api('POST', `/orders/${unpaidId}/return`, {
    return_date: '2026-09-25', pickup_type: 'CUSTOMER_BRING',
    items: [{ order_item_id: unpaidItem, quantity: 1 }], refund_payment_method: 'CASH',
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  const debt = row<{ amount: number }>(`SELECT ${ORDER_DEBT_EXPR} AS amount FROM customers c WHERE c.id = ?`, customerId).amount;
  assert.equal(debt - initialDebt, unpaid.shipping_fee);
  const overcollection = await api('POST', `/orders/${unpaidId}/collect`, { amount: unpaid.total_amount });
  assert.equal(overcollection.status, 400);

  const paidId = await createOrder({ payment_status: 'PAID' });
  await completeOrder(paidId);
  const paid = row<{ subtotal_amount: number; shipping_fee: number }>('SELECT subtotal_amount, shipping_fee FROM orders WHERE id = ?', paidId);
  const paidItem = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', paidId).id;
  const refund = await api('POST', `/orders/${paidId}/return`, {
    return_date: '2026-09-25', pickup_type: 'CUSTOMER_BRING',
    items: [{ order_item_id: paidItem, quantity: 1 }], refund_payment_method: 'BANK_TRANSFER',
  });
  assert.equal(refund.status, 200, JSON.stringify(refund.data));
  assert.equal(refund.data.refundAmount, paid.subtotal_amount);
  assert.deepEqual(row<{ paid_amount: number; payment_status: string }>('SELECT paid_amount, payment_status FROM orders WHERE id = ?', paidId), {
    paid_amount: paid.subtotal_amount + paid.shipping_fee, payment_status: 'PAID',
  });
  const refundTx = row<{ transaction_type: string; amount: number; payment_method: string }>(
    'SELECT transaction_type, amount, payment_method FROM revenue_transactions WHERE order_id = ? AND amount < 0', paidId
  );
  assert.deepEqual(refundTx, { transaction_type: 'SALE_REFUND', amount: -paid.subtotal_amount, payment_method: 'BANK_TRANSFER' });
});

test('customer receivables show only the remaining unpaid balance after a return', async () => {
  const id = await createOrder({ payment_status: 'UNPAID', payment_method: 'DEBT' });
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const original = row<{ total_amount: number; shipping_fee: number }>('SELECT total_amount, shipping_fee FROM orders WHERE id = ?', id);
  const returned = await api('POST', `/orders/${id}/return`, {
    return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 1 }],
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  const receivables = await api('GET', '/customers/receivables');
  assert.equal(receivables.status, 200, JSON.stringify(receivables.data));
  const customer = receivables.data.byCustomer.find((entry: { customer_id: number }) => entry.customer_id === customerId);
  const order = customer?.orders.find((entry: { order_id: number }) => entry.order_id === id);
  assert.equal(order?.outstanding, original.shipping_fee);
});

test('partially paid sale refunds the excess after return and retains the delivery fee', async () => {
  const id = await createOrder();
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const sale = row<{ subtotal_amount: number; shipping_fee: number }>(
    'SELECT subtotal_amount, shipping_fee FROM orders WHERE id = ?', id);
  const firstPayment = await api('POST', `/orders/${id}/collect`, { amount: Math.floor(sale.subtotal_amount / 2) });
  assert.equal(firstPayment.status, 200, JSON.stringify(firstPayment.data));
  const returned = await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 1 }] });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  assert.equal(returned.data.refundAmount, Math.floor(sale.subtotal_amount / 2) - sale.shipping_fee);
  assert.equal(row<{ paid_amount: number }>('SELECT paid_amount FROM orders WHERE id = ?', id).paid_amount, Math.floor(sale.subtotal_amount / 2));
  const extra = await api('POST', `/orders/${id}/collect`, { amount: 1 });
  assert.equal(extra.status, 400);
});

test('merging compatible paid drafts preserves collected money and rejects cross-customer merges', async () => {
  const first = await createOrder({ payment_status: 'PAID' });
  const second = await createOrder({ payment_status: 'PAID' });
  const paid = row<{ amount: number }>('SELECT SUM(paid_amount) AS amount FROM orders WHERE id IN (?, ?)', first, second).amount;
  const merge = await api('POST', '/orders/merge', { ids: [first, second] });
  assert.equal(merge.status, 200, JSON.stringify(merge.data));
  const merged = row<{ paid_amount: number; payment_status: string; total_amount: number }>(
    'SELECT paid_amount, payment_status, total_amount FROM orders WHERE id = ?', merge.data.orderId
  );
  assert.equal(merged.paid_amount, paid);
  assert.equal(merged.payment_status, 'PAID');
  assert.equal(merged.total_amount, paid);

  const third = await createOrder();
  const fourth = await createOrder({ customer_id: 2 });
  const incompatible = await api('POST', '/orders/merge', { ids: [third, fourth] });
  assert.equal(incompatible.status, 400);
});

test('editing a paid draft recalculates payment status from the actual paid amount', async () => {
  const id = await createOrder({ payment_status: 'PAID' });
  const edit = await api('PUT', `/orders/${id}`, { items: [{ product_id: productId, quantity: 2 }] });
  assert.equal(edit.status, 200, JSON.stringify(edit.data));
  const order = row<{ paid_amount: number; total_amount: number; payment_status: string }>(
    'SELECT paid_amount, total_amount, payment_status FROM orders WHERE id = ?', id
  );
  assert.ok(order.paid_amount < order.total_amount);
  assert.equal(order.payment_status, 'PARTIAL');
});

test('collects hired and lending delivery fees without recording goods revenue', async () => {
  const id = await createOrder({ order_type: 'HIRED_LOAD', partner_unit_id: partnerId });
  await completeOrder(id);
  const fee = row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', id).shipping_fee;
  const result = await api('POST', `/orders/${id}/collect`, { amount: fee, payment_method: 'BANK_TRANSFER' });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.deepEqual(row<{ transaction_type: string; customer_id: number | null; amount: number }>(
    'SELECT transaction_type, customer_id, amount FROM revenue_transactions WHERE order_id = ?', id
  ), { transaction_type: 'OTHER', customer_id: null, amount: fee });
  const lendId = await createOrder({ order_type: 'LEND_OUT', partner_unit_id: partnerId });
  await completeOrder(lendId);
  assert.equal((await api('POST', `/orders/${lendId}/collect`, { amount: fee })).status, 200);
  assert.deepEqual(row<{ transaction_type: string; amount: number }>('SELECT transaction_type, amount FROM revenue_transactions WHERE order_id = ?', lendId), { transaction_type: 'OTHER', amount: fee });
});

test('borrowed sale return enters a physical warehouse while partner goods debt stays open', async () => {
  const id = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId });
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const before = row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity;
  const invalid = await api('POST', `/orders/${id}/return`, {
    return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 1 }], return_warehouse_id: row<{ warehouse_id: number }>('SELECT warehouse_id FROM orders WHERE id = ?', id).warehouse_id,
  });
  assert.equal(invalid.status, 400);
  const returned = await api('POST', `/orders/${id}/return`, {
    return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 1 }], return_warehouse_id: warehouseId,
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  assert.equal(row<{ quantity: number }>('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?', warehouseId, productId).quantity, before + 1);
  assert.equal(row<{ warehouse_id: number }>("SELECT warehouse_id FROM stock_tickets WHERE order_id = ? AND reason = 'ORDER_RETURN'", id).warehouse_id, warehouseId);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM loan_settlements WHERE order_id = ?', id).count, 0);
  const report = await api('GET', '/reports/revenue-gross?from=2026-09-25&to=2026-09-25');
  assert.equal(report.status, 200, JSON.stringify(report.data));
  const borrowed = report.data.blocks?.find((block: { key: string }) => block.key === 'borrowed');
  // Đơn đã hoàn trả nhưng chưa xuất HĐ không nằm trong doanh thu → không có hàng hoàn bị trừ.
  assert.equal(borrowed?.returned ?? 0, 0);
});

test('shipping allocation never exceeds fee and dispatch records follow reassignment', async () => {
  const id = await createOrder();
  for (const status of ['CONFIRMED', 'SHIPPING']) {
    const result = await api('POST', `/orders/${id}/status`, { status });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  const fee = row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', id).shipping_fee;
  const bad = await api('PUT', `/orders/${id}/shippers`, { shippers: [{ employee_id: shipperId, allocated_fee: fee + 1 }] });
  assert.equal(bad.status, 400);
  const otherShipper = row<{ id: number }>('SELECT id FROM employees WHERE id <> ? ORDER BY id LIMIT 1', shipperId).id;
  const updated = await api('PUT', `/orders/${id}/shippers`, { shippers: [{ employee_id: otherShipper, allocated_fee: fee }] });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal((await api('POST', `/orders/${id}/status`, { status: 'COMPLETED' })).status, 200);
  const dispatches = db.prepare('SELECT shipper_employee_id, shipping_fee, status FROM delivery_dispatches WHERE order_id = ?').all(id);
  assert.deepEqual(dispatches, [{ shipper_employee_id: otherShipper, shipping_fee: fee, status: 'DELIVERED' }]);
});

test('import-style zero allocations are distributed after the route fee is calculated', async () => {
  const id = await createOrder({ shipper_employee_id: null,
    shippers: [{ employee_id: shipperId, allocated_fee: 0 }], shipping_fee: 0 });
  const fee = row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', id).shipping_fee;
  assert.ok(fee > 0);
  assert.equal(row<{ allocated_fee: number }>('SELECT allocated_fee FROM order_shippers WHERE order_id = ?', id).allocated_fee, fee);
});

test('customer return requires all items once and changes original order to RETURNED', async () => {
  const id = await createOrder({ payment_status: 'PAID', items: [{ product_id: productId, quantity: 2 }] });
  await completeOrder(id);
  const original = row<{ paid_amount: number; total_amount: number }>('SELECT paid_amount, total_amount FROM orders WHERE id = ?', id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const partial = await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 1 }] });
  assert.equal(partial.status, 400);
  const first = await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 2 }] });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const second = await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 2 }] });
  assert.equal(second.status, 400);
  const refund = row<{ count: number; amount: number }>(
    "SELECT COUNT(*) AS count, SUM(amount) AS amount FROM revenue_transactions WHERE order_id = ? AND transaction_type = 'SALE_REFUND'", id
  );
  assert.equal(refund.count, 1);
  assert.equal(refund.amount, -first.data.returnedValue);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM order_returns WHERE order_id = ?', id).count, 1);
  assert.deepEqual(row<{ paid_amount: number; total_amount: number; order_status: string }>(
    'SELECT paid_amount, total_amount, order_status FROM orders WHERE id = ?', id),
    { ...original, order_status: 'RETURNED' });
  const tooMany = await api('POST', `/orders/${id}/return`, { items: [{ order_item_id: item, quantity: 1 }] });
  assert.equal(tooMany.status, 400);
});

test('borrowed customer return can be sent back to the partner as a separate stock out', async () => {
  const id = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId });
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const customerReturn = await api('POST', `/orders/${id}/return`, {
    return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 1 }], return_warehouse_id: warehouseId,
  });
  assert.equal(customerReturn.status, 200, JSON.stringify(customerReturn.data));
  const partnerReturn = await api('POST', `/loans/${id}/settle`, {
    warehouse_id: warehouseId, items: [{ product_id: productId, quantity: 1 }],
  });
  assert.equal(partnerReturn.status, 200, JSON.stringify(partnerReturn.data));
  assert.equal(partnerReturn.data.state.status, 'SETTLED');
});

test('loan debt begins at shipping and settles only when all paid and promo units return', async () => withTwoPlusOne(async () => {
  const id = await createOrder({ order_type: 'BORROW_IN', partner_unit_id: partnerId,
    items: [{ product_id: productId, quantity: 2, quantity_promo: 1 }] });
  const draft = await api('GET', '/loans');
  assert.equal(draft.data.find((loan: { order_id: number }) => loan.order_id === id).loan_status, 'PENDING');
  await completeOrder(id);
  const partial = await api('POST', `/loans/${id}/settle`, {
    warehouse_id: warehouseId, items: [{ product_id: productId, quantity: 2 }],
  });
  assert.equal(partial.status, 200, JSON.stringify(partial.data));
  assert.equal(partial.data.state.status, 'PARTIAL');
  assert.equal(partial.data.state.lines[0].remaining, 1);
  const final = await api('POST', `/loans/${id}/settle`, {
    warehouse_id: warehouseId, items: [{ product_id: productId, quantity: 1 }],
  });
  assert.equal(final.status, 200, JSON.stringify(final.data));
  assert.equal(final.data.state.status, 'SETTLED');
}));

test('shipping loan order with a partial partner return cannot be cancelled', async () => {
  const id = await createOrder({ order_type: 'LEND_OUT', partner_unit_id: partnerId,
    items: [{ product_id: productId, quantity: 2 }] });
  for (const status of ['CONFIRMED', 'SHIPPING']) {
    const result = await api('POST', `/orders/${id}/status`, { status });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  const returned = await api('POST', `/loans/${id}/settle`, { items: [{ product_id: productId, quantity: 1 }] });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));
  const cancelled = await api('POST', `/orders/${id}/status`, { status: 'CANCELLED' });
  assert.equal(cancelled.status, 400);
});

test('merged order allocates the full per-unit delivery fee', async () => {
  const first = await createOrder();
  const second = await createOrder();
  const merged = await api('POST', '/orders/merge', { ids: [first, second] });
  assert.equal(merged.status, 200, JSON.stringify(merged.data));
  const fee = row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', merged.data.orderId).shipping_fee;
  const allocated = row<{ fee: number }>('SELECT SUM(allocated_fee) AS fee FROM order_shippers WHERE order_id = ?', merged.data.orderId).fee;
  assert.equal(allocated, fee);
});

test('paid orders cannot be marked debt without a matching receipt', async () => {
  const invalid = await api('POST', '/orders', {
    customer_id: customerId, seller_employee_id: sellerId, warehouse_id: warehouseId,
    shipper_employee_id: shipperId, shipping_fee_id: feeId, order_date: '2026-09-25',
    payment_method: 'DEBT', payment_status: 'PAID', items: [{ product_id: productId, quantity: 1 }],
  });
  assert.equal(invalid.status, 400);
});

test('prepaid draft has an immediate cash receipt and cancellation refunds it', async () => {
  const id = await createOrder({ payment_status: 'PAID' });
  const before = row<{ paid_amount: number }>('SELECT paid_amount FROM orders WHERE id = ?', id).paid_amount;
  assert.equal(row<{ amount: number }>('SELECT COALESCE(SUM(amount), 0) AS amount FROM revenue_transactions WHERE order_id = ?', id).amount, before);
  const cancelled = await api('POST', `/orders/${id}/status`, { status: 'CANCELLED' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  assert.equal(row<{ amount: number }>('SELECT COALESCE(SUM(amount), 0) AS amount FROM revenue_transactions WHERE order_id = ?', id).amount, 0);
});

test('editing a prepaid draft records only the cash difference and completion does not duplicate it', async () => {
  const id = await createOrder({ payment_status: 'PAID' });
  const edited = await api('PUT', `/orders/${id}`, { items: [{ product_id: productId, quantity: 2 }], payment_status: 'PAID' });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  const paid = row<{ paid_amount: number }>('SELECT paid_amount FROM orders WHERE id = ?', id).paid_amount;
  assert.equal(row<{ amount: number }>('SELECT COALESCE(SUM(amount), 0) AS amount FROM revenue_transactions WHERE order_id = ?', id).amount, paid);
  await completeOrder(id);
  assert.equal(row<{ amount: number }>('SELECT COALESCE(SUM(amount), 0) AS amount FROM revenue_transactions WHERE order_id = ?', id).amount, paid);
});

test('completed order locks shipper allocation and route fee uses product units only', async () => {
  const id = await createOrder({ items: [{ product_id: productId, quantity: 2 }] });
  assert.equal(row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', id).shipping_fee, 10000);
  await completeOrder(id);
  const before = row<{ allocated_fee: number }>('SELECT SUM(allocated_fee) AS allocated_fee FROM order_shippers WHERE order_id = ?', id).allocated_fee;
  const edited = await api('PUT', `/orders/${id}/shippers`, { shippers: [{ employee_id: shipperId, allocated_fee: 0 }] });
  assert.equal(edited.status, 400);
  assert.equal(row<{ allocated_fee: number }>('SELECT SUM(allocated_fee) AS allocated_fee FROM order_shippers WHERE order_id = ?', id).allocated_fee, before);
});

test('delivery fee counts sold products but excludes promotional products', async () => withTwoPlusOne(async () => {
  const id = await createOrder({ items: [{ product_id: productId, quantity: 2, quantity_promo: 1 }] });
  assert.equal(row<{ shipping_fee: number }>('SELECT shipping_fee FROM orders WHERE id = ?', id).shipping_fee, 10000);
  assert.equal(row<{ allocated_fee: number }>('SELECT SUM(allocated_fee) AS allocated_fee FROM order_shippers WHERE order_id = ?', id).allocated_fee, 10000);
}));

test('loan settlement refuses money and tracks goods debt by product units', async () => {
  const id = await createOrder({ order_type: 'LEND_OUT', partner_unit_id: partnerId,
    items: [{ product_id: productId, quantity: 2, quantity_promo: 1 }] });
  const pending = await api('GET', '/loans');
  assert.equal(pending.data.find((r: { order_id: number }) => r.order_id === id).loan_status, 'PENDING');
  await completeOrder(id);
  assert.equal((await api('POST', `/loans/${id}/settle`, { amount: 30000 })).status, 400);
  const partial = await api('POST', `/loans/${id}/settle`, { items: [{ product_id: productId, quantity: 2 }] });
  assert.equal(partial.status, 200, JSON.stringify(partial.data));
  const loans = await api('GET', '/loans');
  const loan = loans.data.find((r: { order_id: number }) => r.order_id === id);
  assert.equal(loan.loan_status, 'PARTIAL');
  assert.equal(loan.remaining_units, 1);
  assert.equal(row<{ count: number }>('SELECT COUNT(*) AS count FROM revenue_transactions WHERE order_id = ?', id).count, 0);
});

test('manual stock tickets cannot impersonate a partner loan return', async () => {
  const incoming = await api('POST', '/stock-tickets', {
    ticket_type: 'IN', warehouse_id: warehouseId, reason: 'PARTNER_RETURN',
    items: [{ product_id: productId, quantity: 1 }],
  });
  const outgoing = await api('POST', '/stock-tickets', {
    ticket_type: 'OUT', warehouse_id: warehouseId, reason: 'RETURN_BORROW',
    items: [{ product_id: productId, quantity: 1 }],
  });
  assert.equal(incoming.status, 400);
  assert.equal(outgoing.status, 400);
});

test('return with order discount prorates the paid goods amount and cash audit reconciles', async () => {
  const id = await createOrder({ payment_status: 'PAID', discount_amount: 10000, items: [{ product_id: productId, quantity: 2 }] });
  await completeOrder(id);
  const item = row<{ id: number }>('SELECT id FROM order_items WHERE order_id = ?', id).id;
  const result = await api('POST', `/orders/${id}/return`, { return_date: '2026-09-25', items: [{ order_item_id: item, quantity: 2 }] });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const order = row<{ subtotal_amount: number; discount_amount: number; paid_amount: number; total_amount: number }>(
    'SELECT subtotal_amount, discount_amount, paid_amount, total_amount FROM orders WHERE id = ?', id
  );
  assert.equal(result.data.returnedValue, order.subtotal_amount - order.discount_amount);
  assert.equal(order.paid_amount, order.total_amount);
  const audit = await api('GET', '/reports/cash-audit?from=2026-09-25&to=2026-09-25');
  assert.equal(audit.status, 200, JSON.stringify(audit.data));
  assert.equal(audit.data.rows.some((r: { order_id: number }) => r.order_id === id), false);
  assert.equal(audit.data.totals.revenue_diff, 0);
});

test('dashboard and revenue views agree on returned goods across sale and borrowed sale', async () => {
  const range = '?from=2026-09-25&to=2026-09-25';
  const [dashboard, enterprise, detail, gross] = await Promise.all([
    api('GET', '/dashboard'),
    api('GET', `/reports/revenue${range}`),
    api('GET', `/reports/revenue-detail${range}`),
    api('GET', `/reports/revenue-gross${range}`),
  ]);
  for (const response of [dashboard, enterprise, detail, gross]) {
    assert.equal(response.status, 200, JSON.stringify(response.data));
  }
  const returnTotals = row<{ total: number; sale: number; borrowed: number }>(`SELECT
    COALESCE(SUM(r.returned_amount),0) AS total,
    COALESCE(SUM(CASE WHEN o.order_type='SALE' THEN r.returned_amount ELSE 0 END),0) AS sale,
    COALESCE(SUM(CASE WHEN o.order_type='BORROW_IN' THEN r.returned_amount ELSE 0 END),0) AS borrowed
    FROM order_returns r JOIN orders o ON o.id = r.order_id
    WHERE o.invoice_status = 'INVOICED'`);
  assert.equal(enterprise.data.summary.totalReturned, returnTotals.sale);
  const blocks = gross.data.blocks as { key: string; returned: number }[];
  assert.equal(blocks.find((b) => b.key === 'enterprise')?.returned, returnTotals.sale);
  assert.equal(blocks.find((b) => b.key === 'borrowed')?.returned, returnTotals.borrowed);
  assert.equal(detail.data.totals.returned, returnTotals.sale);
});
