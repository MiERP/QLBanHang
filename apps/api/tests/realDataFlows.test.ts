import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import type { AddressInfo } from 'node:net';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../qaromi_erp.db');

test('current test database migrates and a paid sale return reconciles on a copy', { skip: !existsSync(sourcePath) }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qaromi-real-flow-'));
  const copyPath = join(directory, 'real-copy.db');
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(copyPath);
  } finally {
    source.close();
  }
  process.env.DB_PATH = copyPath;
  let db: Database.Database | undefined;
  try {
    const [{ getDb }, { applyOrderReturn, getOrder }, { reportsRouter }, { dashboardRouter }, { errorMiddleware }] = await Promise.all([
      import('../src/db.js'),
      import('../src/lib/orderStatus.js'),
      import('../src/routes/reports.js'),
      import('../src/routes/dashboard.js'),
      import('../src/lib/http.js'),
    ]);
    db = getDb();
    assert.ok((db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count > 0);
    assert.equal((db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check, 'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    const candidate = db.prepare(`SELECT o.id, o.order_date, oi.id AS item_id, oi.quantity, o.paid_amount, o.shipping_fee
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.order_type = 'SALE' AND o.order_status = 'COMPLETED' AND o.paid_amount > 0
        AND COALESCE(o.invoice_status, 'NOT_INVOICED') <> 'INVOICED' AND oi.quantity > 0
      ORDER BY o.id, oi.id LIMIT 1`).get() as
      { id: number; order_date: string; item_id: number; quantity: number; paid_amount: number; shipping_fee: number } | undefined;
    assert.ok(candidate, 'The test database must contain a completed paid sale');
    const order = getOrder(db, candidate.id)!;
    const returnLines = db.prepare('SELECT id AS order_item_id, quantity, quantity_promo FROM order_items WHERE order_id = ?').all(candidate.id) as
      { order_item_id: number; quantity: number; quantity_promo: number }[];
    const result = db.transaction(() => applyOrderReturn(db!, order, {
      returnDate: candidate.order_date, pickupType: 'CUSTOMER_BRING', collectors: [],
      lines: returnLines,
      shellsVoi: 0, shellsUp: 0, depositPaymentMethod: 'CASH',
      refundPaymentMethod: 'CASH', returnWarehouseId: null,
      note: 'Kiểm thử trên bản sao', createdBy: null,
    }))();
    assert.ok(result.returnedValue > 0);
    const financial = db.prepare(`SELECT o.paid_amount, o.total_amount, r.returned_amount, r.refund_amount,
      COALESCE((SELECT SUM(amount) FROM revenue_transactions WHERE order_id = o.id), 0) AS ledger
      FROM orders o JOIN order_returns r ON r.order_id = o.id WHERE o.id = ?`).get(candidate.id) as
      { paid_amount: number; total_amount: number; returned_amount: number; refund_amount: number; ledger: number };
    assert.equal(financial.paid_amount, candidate.paid_amount);
    assert.equal(getOrder(db, candidate.id)?.order_status, 'RETURNED');
    assert.equal(financial.ledger, financial.paid_amount - financial.refund_amount);
    assert.ok(financial.paid_amount - financial.refund_amount <= financial.total_amount - financial.returned_amount + 0.5);
    assert.equal((db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check, 'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    const app = express();
    app.use('/api', reportsRouter(), dashboardRouter());
    app.use(errorMiddleware);
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
      const period = `from=${candidate.order_date}&to=${candidate.order_date}`;
      for (const endpoint of [
        '/dashboard', `/reports/revenue?${period}`,
        `/reports/revenue-detail?${period}`,
        `/reports/revenue-borrowed?${period}`,
        `/reports/revenue-gross?${period}`,
        `/reports/cash-audit?${period}`,
      ]) {
        const response = await fetch(base + endpoint);
        assert.equal(response.status, 200, `${endpoint}: ${await response.text()}`);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
