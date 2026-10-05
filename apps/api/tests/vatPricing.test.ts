import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';

const testDir = mkdtempSync(join(tmpdir(), 'qaromi-vat-'));
process.env.DB_PATH = join(testDir, 'vat.db');

const [{ getDb, resetDatabase }, { invoicesRouter }, { reportsRouter }, { errorMiddleware }] = await Promise.all([
  import('../src/db.js'),
  import('../src/routes/invoices.js'),
  import('../src/routes/reports.js'),
  import('../src/lib/http.js'),
]);
const db = getDb();

const app = express();
app.use(express.json());
app.use('/api', invoicesRouter());
app.use('/api', reportsRouter());
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

const vatRate = () => Number((db.prepare(`SELECT rate FROM vat_rates ORDER BY effective_from DESC LIMIT 1`).get() as { rate: number }).rate);

test('Giá trước thuế của mọi sản phẩm = giá bán ÷ (1 + thuế suất), không phải giá vốn', () => {
  const rate = vatRate();
  assert.ok(rate > 0, 'Phải có thuế suất đang hiệu lực');
  const products = db.prepare(`SELECT code, standard_price, cost_price, product_type FROM products`).all() as {
    code: string;
    standard_price: number;
    cost_price: number;
    product_type: string;
  }[];
  assert.ok(products.length > 0);
  for (const p of products) {
    const expected = Math.round(p.standard_price / (1 + rate / 100));
    assert.equal(p.cost_price, expected, `${p.code}: giá trước thuế phải là ${expected} (giá bán ${p.standard_price}, thuế ${rate}%)`);
    // Chênh lệch đúng bằng thuế GTGT, không được lệch kiểu giá vốn.
    assert.equal(p.standard_price - p.cost_price, p.standard_price - expected);
  }
});

// Tạo một đơn đã hoàn tất + thu đủ tiền để thử hóa đơn, trả về id đơn.
function makeCompletedOrder(opts: { unitPrice: number; qty: number; vat: boolean; warrantyRate?: number }): number {
  const product = db.prepare(`SELECT id FROM products WHERE product_type = 'GOODS' ORDER BY id LIMIT 1`).get() as { id: number };
  const customer = db.prepare(`SELECT id FROM customers LIMIT 1`).get() as { id: number };
  const warehouse = db.prepare(`SELECT id FROM warehouses WHERE code = 'KHO_TANGAP'`).get() as { id: number };
  const employee = db.prepare(`SELECT id FROM employees LIMIT 1`).get() as { id: number };
  const gross = opts.unitPrice * opts.qty;
  const orderId = Number(
    db
      .prepare(
        `INSERT INTO orders (order_code, customer_id, seller_employee_id, shipper_employee_id, warehouse_id,
                             order_date, delivery_date, order_status, payment_status, payment_method,
                             is_vat_invoice, vat_rate, subtotal_amount, shipping_fee, discount_amount,
                             total_amount, paid_amount, invoice_status)
         VALUES (?, ?, ?, ?, ?, '2026-09-10', '2026-09-10', 'COMPLETED', 'PAID', 'CASH', ?, ?, ?, 0, 0, ?, ?, 'NOT_INVOICED')`
      )
      .run(
        `DH-VAT-${opts.vat ? 'C' : 'K'}-${gross}-${opts.qty}`,
        customer.id,
        employee.id,
        employee.id,
        warehouse.id,
        opts.vat ? 1 : 0,
        opts.vat ? (opts.warrantyRate ?? vatRate()) : 0,
        gross,
        gross,
        gross
      ).lastInsertRowid
  );
  db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price) VALUES (?, ?, ?, 0, ?, ?)`).run(
    orderId,
    product.id,
    opts.qty,
    opts.unitPrice,
    gross
  );
  return orderId;
}

const issueInvoice = async (orderId: number) => {
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  assert.equal(res.status, 200, `Xuất hóa đơn thất bại: ${await res.text()}`);
  return db.prepare(`SELECT vat_rate, subtotal_amount, tax_amount, total_amount FROM invoices WHERE order_id = ?`).get(orderId) as {
    vat_rate: number;
    subtotal_amount: number;
    tax_amount: number;
    total_amount: number;
  };
};

test('Hóa đơn VAT: tiền trước thuế + tiền thuế đúng bằng tiền hàng, thuế tính trên giá trước thuế', async () => {
  const rate = vatRate();
  const unitPrice = 48000;
  const qty = 2;
  const invoice = await issueInvoice(makeCompletedOrder({ unitPrice, qty, vat: true }));
  const netUnit = Math.round(unitPrice / (1 + rate / 100));

  assert.equal(invoice.vat_rate, rate);
  assert.equal(invoice.subtotal_amount, netUnit * qty, 'Tiền hàng trước thuế = đơn giá chưa thuế × số lượng');
  assert.equal(invoice.tax_amount, unitPrice * qty - netUnit * qty, 'Tiền thuế = tiền hàng - tiền trước thuế');
  assert.equal(invoice.subtotal_amount + invoice.tax_amount, unitPrice * qty, 'Trước thuế + thuế phải bằng tiền hàng');
  assert.equal(invoice.total_amount, unitPrice * qty, 'Tổng thanh toán giữ nguyên theo đơn');
  // Thuế không được vượt quá 8% của tiền hàng (lỗi cũ: lấy tiền hàng × 8%).
  assert.ok(invoice.tax_amount < (unitPrice * qty * rate) / 100, 'Thuế phải nhỏ hơn thuế suất × tiền hàng (giá bán đã gồm VAT)');
});

test('Hóa đơn không VAT: không tách thuế, tiền trước thuế bằng tiền hàng', async () => {
  const invoice = await issueInvoice(makeCompletedOrder({ unitPrice: 48000, qty: 3, vat: false }));
  assert.equal(invoice.vat_rate, 0);
  assert.equal(invoice.tax_amount, 0);
  assert.equal(invoice.subtotal_amount, 144000);
  assert.equal(invoice.total_amount, 144000);
});

test('Tiền trước thuế trên hóa đơn dùng đúng công thức của báo cáo thương mại (làm tròn từng đơn giá)', async () => {
  const rate = vatRate();
  const vatInvoices = db
    .prepare(`SELECT id, order_id, subtotal_amount, tax_amount FROM invoices WHERE vat_rate > 0`)
    .all() as { id: number; order_id: number; subtotal_amount: number; tax_amount: number }[];
  assert.ok(vatInvoices.length > 0, 'Phải có hóa đơn VAT để đối chiếu');
  const netOfOrder = db.prepare(
    `SELECT COALESCE(SUM(quantity * ROUND(unit_price / (1 + ? / 100.0))), 0) AS net FROM order_items WHERE order_id = ?`
  );
  for (const invoice of vatInvoices) {
    const expected = Number((netOfOrder.get(rate, invoice.order_id) as { net: number }).net);
    assert.equal(invoice.subtotal_amount, expected, `Hóa đơn ${invoice.id}: tiền trước thuế phải theo công thức của báo cáo`);
  }

  const trade = (await (await fetch(`${base}/reports/trade-template`)).json()) as {
    vatRate: number;
    current: { totals: { amount_gross: number; amount_net: number; tax_amount: number } };
  };
  assert.equal(trade.vatRate, rate);
  const t = trade.current.totals;
  assert.equal(t.amount_net + t.tax_amount, t.amount_gross, 'Báo cáo: trước thuế + thuế phải bằng sau thuế');
  assert.equal(t.tax_amount, t.amount_gross - t.amount_net);
});

test('CSDL cũ còn giữ giá vốn trong cột giá trước thuế thì được sửa, giá người dùng nhập vẫn giữ', () => {
  const rate = vatRate();
  const legacy = db.prepare(`SELECT id, standard_price FROM products WHERE code = 'RO_19L_VOI'`).get() as { id: number; standard_price: number };
  const custom = db.prepare(`SELECT id FROM products WHERE code = 'VI_350ML'`).get() as { id: number };
  db.prepare(`UPDATE products SET cost_price = 18000 WHERE id = ?`).run(legacy.id); // giá vốn của seed cũ
  db.prepare(`UPDATE products SET cost_price = 70000 WHERE id = ?`).run(custom.id); // giá người dùng tự nhập

  resetDatabase(); // chạy lại các migration như khi khởi động phần mềm

  assert.equal(
    (db.prepare(`SELECT cost_price FROM products WHERE id = ?`).get(legacy.id) as { cost_price: number }).cost_price,
    Math.round(legacy.standard_price / (1 + rate / 100)),
    'Giá vốn cũ của seed phải được thay bằng giá trước thuế'
  );
  assert.equal(
    (db.prepare(`SELECT cost_price FROM products WHERE id = ?`).get(custom.id) as { cost_price: number }).cost_price,
    70000,
    'Giá người dùng tự nhập không bị ghi đè'
  );
});
