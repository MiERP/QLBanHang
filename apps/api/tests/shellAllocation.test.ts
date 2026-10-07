import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

// Kiểm tra cơ chế trả vỏ ở mức khách hàng: chia số vỏ trả về từng đơn còn nợ, TRỪ TỪ ĐƠN
// NỢ ÍT ĐẾN ĐƠN NỢ NHIỀU; phần không gắn được đơn nào thì ghi dòng không kèm đơn.
const dir = mkdtempSync(join(tmpdir(), 'qaromi-shell-alloc-'));
process.env.DB_PATH = join(dir, 'test.db');

const { getDb } = await import('../src/db.js');
const { returnCustomerShells, returnCustomerShellsAllocated } = await import('../src/lib/shells.js');
const db = getDb();

after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const makeCustomer = (code: string) =>
  Number(db.prepare('INSERT INTO customers (code, name, address) VALUES (?, ?, ?)').run(code, code, 'HN').lastInsertRowid);

const makeOrder = (customerId: number, code: string, items: { product: number; qty: number }[]) => {
  const oid = Number(
    db
      .prepare(
        `INSERT INTO orders (order_code, customer_id, order_type, order_status, order_date, subtotal_amount, total_amount)
         VALUES (?, ?, 'SALE', 'COMPLETED', '2026-10-06', 0, 0)`
      )
      .run(code, customerId).lastInsertRowid
  );
  for (const it of items) {
    db.prepare(
      'INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price) VALUES (?, ?, ?, 0, 0, 0)'
    ).run(oid, it.product, it.qty);
  }
  return oid;
};

const setDebt = (customerId: number, voi: number, up: number) =>
  db.prepare('UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?').run(voi, up, customerId);

const debtOf = (customerId: number) =>
  db.prepare('SELECT bottle_debt_voi AS voi, bottle_debt_up AS up FROM customers WHERE id = ?').get(customerId) as { voi: number; up: number };

const returnedOf = (orderId: number) =>
  db
    .prepare('SELECT COALESCE(SUM(returned_voi),0) AS voi, COALESCE(SUM(returned_up),0) AS up FROM customer_bottle_ledgers WHERE order_id = ?')
    .get(orderId) as { voi: number; up: number };

const refundsOf = (customerId: number) =>
  db
    .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM deposit_transactions WHERE customer_id = ? AND transaction_type = 'REFUND'")
    .get(customerId) as { n: number; total: number };

test('trả vỏ mức khách chia từ đơn nợ ít đến đơn nợ nhiều, mỗi đơn một dòng sổ', () => {
  const cust = makeCustomer('TST001');
  const o1 = makeOrder(cust, 'TST-O1', [{ product: 1, qty: 3 }]);
  const o2 = makeOrder(cust, 'TST-O2', [{ product: 1, qty: 5 }]);
  const o3 = makeOrder(cust, 'TST-O3', [{ product: 1, qty: 11 }]);
  setDebt(cust, 19, 0);

  const res = returnCustomerShellsAllocated(db, {
    customerId: cust,
    shellsVoi: 4,
    shellsUp: 0,
    date: '2026-10-06',
    note: 'Test chia theo đơn',
    refundDeposit: true,
    paymentMethod: 'CASH',
    handledBy: null,
  });

  // Đơn nợ 3 trả hết trước, sang đơn nợ 5 trả 1.
  assert.deepEqual(
    res.allocations.map((a) => [a.orderId, a.voi, a.up]),
    [
      [o1, 3, 0],
      [o2, 1, 0],
    ]
  );
  assert.deepEqual(debtOf(cust), { voi: 15, up: 0 });
  assert.deepEqual(returnedOf(o1), { voi: 3, up: 0 });
  assert.deepEqual(returnedOf(o2), { voi: 1, up: 0 });
  assert.deepEqual(returnedOf(o3), { voi: 0, up: 0 });
  // Mỗi phần chia một phiếu hoàn cọc: 3×50.000 + 1×50.000.
  assert.deepEqual(refundsOf(cust), { n: 2, total: 200000 });
  assert.equal(res.refundAmount, 200000);
  assert.equal((db.prepare('PRAGMA foreign_key_check').all() as unknown[]).length, 0);
});

test('tất toán trả hết: chia đủ mọi đơn còn nợ', () => {
  const cust = makeCustomer('TST002');
  const o1 = makeOrder(cust, 'TST-O4', [{ product: 1, qty: 2 }]);
  const o2 = makeOrder(cust, 'TST-O5', [{ product: 1, qty: 8 }]);
  setDebt(cust, 10, 0);

  const res = returnCustomerShellsAllocated(db, {
    customerId: cust,
    shellsVoi: 10,
    shellsUp: 0,
    date: '2026-10-06',
    note: 'Tất toán',
    refundDeposit: true,
    paymentMethod: 'CASH',
    handledBy: null,
  });
  assert.deepEqual(
    res.allocations.map((a) => [a.orderId, a.voi]),
    [
      [o1, 2],
      [o2, 8],
    ]
  );
  assert.deepEqual(debtOf(cust), { voi: 0, up: 0 });
  assert.equal(refundsOf(cust).total, 500000);
});

test('nợ không gắn được đơn nào (nợ đầu kỳ) ghi thành dòng không kèm đơn', () => {
  const cust = makeCustomer('TST003');
  const o1 = makeOrder(cust, 'TST-O6', [{ product: 1, qty: 2 }]);
  setDebt(cust, 5, 0); // 3 vỏ ngoài đơn (nợ đầu kỳ)

  const res = returnCustomerShellsAllocated(db, {
    customerId: cust,
    shellsVoi: 5,
    shellsUp: 0,
    date: '2026-10-06',
    note: 'Test nợ đầu kỳ',
    refundDeposit: true,
    paymentMethod: 'CASH',
    handledBy: null,
  });
  assert.deepEqual(
    res.allocations.map((a) => [a.orderId, a.voi]),
    [
      [o1, 2],
      [null, 3],
    ]
  );
  assert.deepEqual(debtOf(cust), { voi: 0, up: 0 });
  const orphan = db
    .prepare('SELECT COUNT(*) AS n FROM customer_bottle_ledgers WHERE customer_id = ? AND order_id IS NULL AND returned_voi = 3')
    .get(cust) as { n: number };
  assert.equal(orphan.n, 1);
});

test('không hoàn cọc: vẫn giảm nợ vỏ nhưng không sinh phiếu hoàn', () => {
  const cust = makeCustomer('TST004');
  makeOrder(cust, 'TST-O7', [{ product: 1, qty: 4 }]);
  setDebt(cust, 4, 0);

  const res = returnCustomerShellsAllocated(db, {
    customerId: cust,
    shellsVoi: 4,
    shellsUp: 0,
    date: '2026-10-06',
    note: 'Không hoàn cọc',
    refundDeposit: false,
    paymentMethod: 'CASH',
    handledBy: null,
  });
  assert.deepEqual(debtOf(cust), { voi: 0, up: 0 });
  assert.equal(res.refundAmount, 0);
  assert.deepEqual(refundsOf(cust), { n: 0, total: 0 });
});

test('trả quá số đang giữ thì bị từ chối, dữ liệu giữ nguyên', () => {
  const cust = makeCustomer('TST005');
  makeOrder(cust, 'TST-O8', [{ product: 1, qty: 2 }]);
  setDebt(cust, 2, 0);

  assert.throws(() =>
    returnCustomerShellsAllocated(db, {
      customerId: cust,
      shellsVoi: 3,
      shellsUp: 0,
      date: '2026-10-06',
      note: 'Quá nợ',
      refundDeposit: true,
      paymentMethod: 'CASH',
      handledBy: null,
    })
  );
  assert.deepEqual(debtOf(cust), { voi: 2, up: 0 });
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM customer_bottle_ledgers WHERE customer_id = ?').get(cust) as { n: number }).n, 0);
});

test('trả vỏ kèm đơn cụ thể vẫn ghi thẳng vào đơn đó', () => {
  const cust = makeCustomer('TST006');
  const o1 = makeOrder(cust, 'TST-O9', [{ product: 1, qty: 2 }]);
  const o2 = makeOrder(cust, 'TST-O10', [{ product: 1, qty: 6 }]);
  setDebt(cust, 8, 0);

  const res = returnCustomerShells(db, {
    customerId: cust,
    shellsVoi: 2,
    shellsUp: 0,
    orderId: o2,
    date: '2026-10-06',
    note: 'Trả theo đơn',
    refundDeposit: true,
    paymentMethod: 'CASH',
    handledBy: null,
  });
  assert.equal(res.newVoi, 6);
  assert.deepEqual(returnedOf(o1), { voi: 0, up: 0 });
  assert.deepEqual(returnedOf(o2), { voi: 2, up: 0 });
});
