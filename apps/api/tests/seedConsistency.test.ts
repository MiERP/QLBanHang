import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

// Dữ liệu mẫu phải tự nhất quán: nếu lệch thì mọi báo cáo đối chiếu đều báo sai ngay từ đầu.
const testDir = mkdtempSync(join(tmpdir(), 'qaromi-seed-'));
process.env.DB_PATH = join(testDir, 'seed.db');
const seeded = new Database(process.env.DB_PATH);
seeded.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
// Danh mục nền nạp trước vì dữ liệu mẫu tham chiếu ID của nhóm hàng / sản phẩm / nhóm khách hàng.
seeded.exec(readFileSync(new URL('../src/catalog.sql', import.meta.url), 'utf8'));
seeded.exec(readFileSync(new URL('../src/seed.sql', import.meta.url), 'utf8'));
seeded.close();

const { getDb } = await import('../src/db.js');
const db = getDb();

after(() => {
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});

const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T;

test('Sản phẩm thuộc nhóm Dịch Vụ Gia Tăng được đánh dấu là dịch vụ, không lọt vào tồn kho', () => {
  const wrong = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM products p JOIN categories c ON c.id = p.category_id
     WHERE c.type = 'SERVICE_DVGT' AND p.product_type <> 'SERVICE'`
  ).c;
  assert.equal(wrong, 0, 'Mọi sản phẩm nhóm dịch vụ phải có product_type = SERVICE');

  const serviceInStock = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM inventory_stock s JOIN products p ON p.id = s.product_id
     WHERE p.product_type = 'SERVICE' AND s.quantity <> 0`
  ).c;
  assert.equal(serviceInStock, 0, 'Dịch vụ không được có tồn kho');
});

test('Số vỏ xí nghiệp đang giữ khớp với số vỏ khách đang giữ', () => {
  const stock = one<{ voi: number; up: number }>(
    `SELECT COALESCE(SUM(CASE WHEN bottle_type = 'VOI' THEN quantity END), 0) AS voi,
            COALESCE(SUM(CASE WHEN bottle_type = 'UP' THEN quantity END), 0) AS up
     FROM shell_stock`
  );
  const debt = one<{ voi: number; up: number }>(
    `SELECT COALESCE(SUM(bottle_debt_voi), 0) AS voi, COALESCE(SUM(bottle_debt_up), 0) AS up FROM customers`
  );
  assert.equal(stock.voi, -debt.voi, 'Vỏ Vòi: tồn của xí nghiệp phải là số âm của vỏ khách đang giữ');
  assert.equal(stock.up, -debt.up, 'Vỏ Úp: tồn của xí nghiệp phải là số âm của vỏ khách đang giữ');

  const movementNet = one<{ voi: number; up: number }>(
    `SELECT COALESCE(SUM(CASE WHEN bottle_type = 'VOI' THEN CASE WHEN movement_type IN ('IN','RETURN','ADJUST_IN') THEN quantity ELSE -quantity END END), 0) AS voi,
            COALESCE(SUM(CASE WHEN bottle_type = 'UP' THEN CASE WHEN movement_type IN ('IN','RETURN','ADJUST_IN') THEN quantity ELSE -quantity END END), 0) AS up
     FROM shell_movements`
  );
  assert.equal(movementNet.voi, stock.voi, 'Sổ vỏ Vòi phải khớp số vỏ đang giữ');
  assert.equal(movementNet.up, stock.up, 'Sổ vỏ Úp phải khớp số vỏ đang giữ');
});

test('Mỗi khách có nợ vỏ đều có sổ vỏ khách và tiền cọc tương ứng', () => {
  const missingLedger = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM customers c
     WHERE (c.bottle_debt_voi <> 0 OR c.bottle_debt_up <> 0)
       AND NOT EXISTS (
         SELECT 1 FROM customer_bottle_ledgers l
         WHERE l.customer_id = c.id
           AND l.remaining_balance_voi = c.bottle_debt_voi
           AND l.remaining_balance_up = c.bottle_debt_up
       )`
  ).c;
  assert.equal(missingLedger, 0, 'Thiếu dòng sổ vỏ khớp số dư của khách');

  const feeVoi = one<{ fee: number }>(
    `SELECT deposit_fee AS fee FROM products WHERE bottle_type = 'VOI' AND deposit_fee > 0 ORDER BY id LIMIT 1`
  ).fee;
  const feeUp = one<{ fee: number }>(
    `SELECT deposit_fee AS fee FROM products WHERE bottle_type = 'UP' AND deposit_fee > 0 ORDER BY id LIMIT 1`
  ).fee;

  const mismatch = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM (
       SELECT c.id,
              c.bottle_debt_voi * ? + c.bottle_debt_up * ? AS expected,
              COALESCE((SELECT SUM(CASE WHEN d.transaction_type = 'COLLECT' THEN d.amount ELSE -d.amount END)
                        FROM deposit_transactions d WHERE d.customer_id = c.id), 0) AS held
       FROM customers c WHERE c.bottle_debt_voi <> 0 OR c.bottle_debt_up <> 0
     ) WHERE ABS(expected - held) > 0.5`,
    feeVoi,
    feeUp
  ).c;
  assert.equal(mismatch, 0, 'Tiền cọc đang giữ phải bằng nợ vỏ × mức cọc');
});

test('Đơn đã thu đủ tiền đều có phiếu thu khớp số tiền', () => {
  const mismatch = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM (
       SELECT o.id, o.paid_amount,
              COALESCE(SUM(CASE WHEN r.transaction_type = 'SALE_REFUND' THEN -r.amount ELSE r.amount END), 0) AS receipt_net
       FROM orders o LEFT JOIN revenue_transactions r ON r.order_id = o.id
       WHERE o.order_status IN ('COMPLETED', 'RETURNED')
       GROUP BY o.id
     ) WHERE ABS(paid_amount - receipt_net) > 0.5`
  ).c;
  assert.equal(mismatch, 0, 'Số đã thu trên đơn phải khớp tổng phiếu thu');
});

test('Mã chứng từ không trùng và khoá ngoại toàn vẹn', () => {
  const duplicates = one<{ c: number }>(
    `SELECT (SELECT COUNT(*) FROM (SELECT id FROM orders GROUP BY order_code HAVING COUNT(*) > 1))
          + (SELECT COUNT(*) FROM (SELECT id FROM products GROUP BY code HAVING COUNT(*) > 1))
          + (SELECT COUNT(*) FROM (SELECT id FROM customers GROUP BY code HAVING COUNT(*) > 1))
          + (SELECT COUNT(*) FROM (SELECT id FROM revenue_transactions GROUP BY transaction_code HAVING COUNT(*) > 1))
          + (SELECT COUNT(*) FROM (SELECT id FROM deposit_transactions GROUP BY transaction_code HAVING COUNT(*) > 1))
          + (SELECT COUNT(*) FROM (SELECT id FROM invoices GROUP BY invoice_code HAVING COUNT(*) > 1)) AS c`
  ).c;
  assert.equal(duplicates, 0, 'Không mã nào được trùng');

  const broken = db.prepare('PRAGMA foreign_key_check').all();
  assert.deepEqual(broken, [], 'Không có khoá ngoại hỏng');
});

test('Sổ bút toán kho khớp với bảng tồn kho từng kho × mặt hàng', () => {
  const mismatches = db
    .prepare(
      `SELECT w.name AS warehouse, p.name AS product, s.quantity AS stock, COALESCE(m.net, 0) AS ledger
       FROM inventory_stock s
       JOIN warehouses w ON w.id = s.warehouse_id
       JOIN products p ON p.id = s.product_id
       LEFT JOIN (
         SELECT warehouse_id, product_id, SUM(delta) AS net FROM (
           SELECT target_warehouse_id AS warehouse_id, product_id, quantity + COALESCE(quantity_promo, 0) AS delta
             FROM stock_movements WHERE target_warehouse_id IS NOT NULL
           UNION ALL
           SELECT source_warehouse_id, product_id, -(quantity + COALESCE(quantity_promo, 0))
             FROM stock_movements WHERE source_warehouse_id IS NOT NULL
         ) GROUP BY warehouse_id, product_id
       ) m ON m.warehouse_id = s.warehouse_id AND m.product_id = s.product_id
       WHERE ABS(s.quantity - COALESCE(m.net, 0)) > 0.001`
    )
    .all() as { warehouse: string; product: string; stock: number; ledger: number }[];
  assert.deepEqual(mismatches, [], 'Tồn kho phải khớp tổng bút toán nhập/xuất');
});

test('Có đơn đã xuất hóa đơn để doanh thu dữ liệu mẫu không bằng 0', () => {
  const invoiced = one<{ c: number }>(`SELECT COUNT(*) AS c FROM orders WHERE invoice_status = 'INVOICED'`).c;
  assert.ok(invoiced > 0, 'Dữ liệu mẫu phải có ít nhất một đơn đã xuất hóa đơn');

  const badInvoice = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM orders o
     WHERE o.invoice_status = 'INVOICED'
       AND (o.order_status <> 'COMPLETED' OR o.payment_status <> 'PAID')`
  ).c;
  assert.equal(badInvoice, 0, 'Chỉ đơn đã hoàn tất và thu đủ tiền mới được xuất hóa đơn');

  const orphanInvoice = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM invoices i JOIN orders o ON o.id = i.order_id
     WHERE o.invoice_status <> 'INVOICED' OR ABS(i.total_amount - o.total_amount) > 0.5`
  ).c;
  assert.equal(orphanInvoice, 0, 'Mỗi hóa đơn phải gắn với đơn đã đánh dấu xuất và khớp số tiền');

  const revenue = one<{ total: number }>(
    `SELECT COALESCE(SUM(subtotal_amount), 0) AS total FROM orders
     WHERE invoice_status = 'INVOICED' AND order_status = 'COMPLETED' AND order_type IN ('SALE', 'BORROW_IN')`
  ).total;
  assert.ok(revenue > 0, `Doanh thu dữ liệu mẫu phải lớn hơn 0 (đang là ${revenue})`);

  // Kỳ báo cáo mặc định phải bao trùm các đơn mẫu, nếu không bảng điều khiển mở lần đầu sẽ trống.
  const period = one<{ from: string; to: string }>(
    `SELECT (SELECT value FROM app_settings WHERE key = 'report_period_from') AS "from",
            (SELECT value FROM app_settings WHERE key = 'report_period_to') AS "to"`
  );
  assert.ok(period.from && period.to, 'Dữ liệu mẫu phải đặt kỳ báo cáo mặc định');

  const outside = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM orders
     WHERE order_status = 'COMPLETED' AND invoice_status = 'INVOICED' AND (order_date < ? OR order_date > ?)`,
    period.from,
    period.to
  ).c;
  assert.equal(outside, 0, 'Mọi đơn mẫu đã xuất hóa đơn phải nằm trong kỳ báo cáo mặc định');
});
