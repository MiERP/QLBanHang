/**
 * Chuyển dữ liệu từ sheet XUẤT (ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa (2).xlsx) — GIAI ĐOẠN 1:
 *   kiểm tra backup → xoá dữ liệu phát sinh → tạo danh mục còn thiếu → khai tồn kho đầu kỳ
 *
 *   npx tsx migrate-xuat.ts --dry   (chỉ in, không ghi)
 *   npx tsx migrate-xuat.ts         (thực thi)
 *
 * Giai đoạn 2 (nhập đơn) nằm ở migrate-xuat-orders.ts
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createTicket } from './apps/api/src/lib/stockTickets.js';

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'qaromi_erp.db');
const DRY = process.argv.includes('--dry');
const db = new Database(DB_PATH);

// ---------- 0. Chốt an toàn ----------
const backups = fs.readdirSync(ROOT).filter((f) => /^qaromi_erp\.backup-.*\.db$/.test(f));
const fresh = backups.filter((f) => Date.now() - fs.statSync(path.join(ROOT, f)).mtimeMs < 60 * 60 * 1000);
console.log('DB           :', DB_PATH);
console.log('Backup <60ph :', fresh.length ? fresh.join(', ') : '(KHÔNG CÓ)');
if (!fresh.length && !DRY) {
  console.error('\n*** DỪNG: chưa có backup mới trong 60 phút. ***');
  process.exit(1);
}

// ---------- 1. Danh mục ----------
const whByName = new Map(
  (db.prepare('SELECT id, name FROM warehouses').all() as { id: number; name: string }[]).map((w) => [w.name, w.id])
);
const prodByName = new Map(
  (db.prepare('SELECT id, name FROM products').all() as { id: number; name: string }[]).map((p) => [p.name, p.id])
);
const whId = (n: string) => {
  const id = whByName.get(n);
  if (!id) throw new Error('Không thấy kho: ' + n);
  return id;
};
const prodId = (n: string) => {
  const id = prodByName.get(n);
  if (!id) throw new Error('Không thấy sản phẩm: ' + n);
  return id;
};

// Tồn cuối 18/9 theo TỒN TỔNG!D33:H37 (đã truy công thức; bộ tính kiểm chứng 565/565 ô)
const CLOSING: Record<string, Record<string, number>> = {
  'Kho Huế': { 'Bình RO (bình vòi)': 3, 'Bình kiềm (bình vòi)': 9, 'Hộp 500ml': 0, 'Vỉ 500ml': 106, 'Vỉ 350ml': 25 },
  'Kho Tăng Áp': { 'Bình RO (bình vòi)': 0, 'Bình kiềm (bình vòi)': 0, 'Hộp 500ml': 0, 'Vỉ 500ml': 191, 'Vỉ 350ml': 26 },
  'Kho Văn Phòng': { 'Bình RO (bình vòi)': 0, 'Bình kiềm (bình vòi)': 0, 'Hộp 500ml': 0, 'Vỉ 500ml': 18, 'Vỉ 350ml': 0 },
  'Kho Xe Điện': { 'Bình RO (bình vòi)': 0, 'Bình kiềm (bình vòi)': 0, 'Hộp 500ml': 0, 'Vỉ 500ml': 0, 'Vỉ 350ml': 0 },
  'Kho Hà Lầm': { 'Bình RO (bình vòi)': 0, 'Bình kiềm (bình vòi)': 0, 'Hộp 500ml': 0, 'Vỉ 500ml': 17, 'Vỉ 350ml': 30 },
};

// ---------- 2. Đọc kết quả chuyển đổi ----------
const dryPath = path.join(ROOT, '.migrate', 'dryrun.json');
if (!fs.existsSync(dryPath)) throw new Error('Thiếu ' + dryPath);
const dry = JSON.parse(fs.readFileSync(dryPath, 'utf8')) as {
  kept: { r: number; type: string; whName: string | null; cols: string; custText: string; partnerName: string | null }[];
};

const LABEL_TO_PROD: Record<string, string> = {
  'Vỉ 500ml': 'Vỉ 500ml',
  'Vỉ 350ml': 'Vỉ 350ml',
  'Hộp 500ml': 'Hộp 500ml',
  'Hộp 350ml': 'Hộp 350ml',
  'Bình kiềm': 'Bình kiềm (bình vòi)',
  'Bình RO': 'Bình RO (bình vòi)',
};

const sold = new Map<string, number>();
let saleOrders = 0;
let promoUnits = 0;
for (const k of dry.kept) {
  if (k.type !== 'SALE') continue;
  saleOrders++;
  const wh = whId(k.whName as string);
  let isFirst = true;
  for (const part of k.cols.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [label, qtyS] = part.split('=');
    const pid = prodId(LABEL_TO_PROD[label.trim()]);
    const key = `${wh}:${pid}`;
    // KM là số lượng CỘNG THÊM (sheet ghi Bình RO=10 + KM=1 => cột "Cộng" = 11) nên phải tính vào lượng xuất kho.
    const promo = isFirst ? Number(k.km) || 0 : 0;
    isFirst = false;
    promoUnits += promo;
    sold.set(key, (sold.get(key) || 0) + (Number(qtyS) || 0) + promo);
  }
}
console.log('Lượng bán (gồm KM cộng thêm):', promoUnits, 'đơn vị KM');

const opening = new Map<string, { wh: number; pid: number; qty: number }>();
for (const [whN, prods] of Object.entries(CLOSING))
  for (const [prodN, closeQty] of Object.entries(prods)) {
    const wh = whId(whN);
    const pid = prodId(prodN);
    const key = `${wh}:${pid}`;
    const qty = closeQty + (sold.get(key) || 0);
    if (qty > 0) opening.set(key, { wh, pid, qty });
  }
for (const [key, q] of sold) {
  if (opening.has(key)) continue;
  const [wh, pid] = key.split(':').map(Number);
  opening.set(key, { wh, pid, qty: q });
}

// ---------- 3. Danh mục còn thiếu (tính trực tiếp từ DB) ----------
const PARTNERS_TO_ADD = ['Diễn Vọng', 'Đông Triều'];
const existingCustomers = new Set(
  (db.prepare('SELECT name FROM customers').all() as { name: string }[]).map((c) => String(c.name).trim())
);
const customersToAdd = [
  ...new Set(dry.kept.map((k) => String(k.custText ?? '').trim()).filter((t) => t && !existingCustomers.has(t))),
];

console.log('\n=== KHAI TỒN ĐẦU KỲ (tồn đầu = tồn cuối 18/9 + đã bán 8–18/9) ===');
const whName = Object.fromEntries([...whByName.entries()].map(([n, i]) => [i, n]));
const prodName = Object.fromEntries([...prodByName.entries()].map(([n, i]) => [i, n]));
for (const { wh, pid, qty } of [...opening.values()].sort((a, b) => a.wh - b.wh || a.pid - b.pid))
  console.log(
    `  ${whName[wh].padEnd(16)} ${prodName[pid].padEnd(22)} ${String(qty).padStart(5)}  (cuối kỳ ${CLOSING[whName[wh]]?.[prodName[pid]] ?? 0} + bán ${sold.get(`${wh}:${pid}`) || 0})`
  );
console.log(`  → ${opening.size} dòng tồn đầu · ${saleOrders} đơn bán sẽ trừ kho`);
console.log('\n=== DANH MỤC SẼ TẠO ===');
console.log('  Đối tác :', PARTNERS_TO_ADD.join(', '));
console.log('  Khách hàng mới:', customersToAdd.length);

if (DRY) {
  console.log('\n[--dry] Không ghi gì.');
  db.close();
  process.exit(0);
}

// ---------- 4. Thực thi ----------
const WIPE = [
  'order_merge_sources', 'order_returns', 'loan_settlement_items', 'loan_settlements',
  'stock_ticket_items', 'stock_tickets', 'stock_movements', 'inventory_stock',
  'customer_bottle_ledgers', 'shell_movements', 'partner_shell_movements', 'shell_stock',
  'deposit_transactions', 'revenue_transactions', 'expense_transactions', 'invoices',
  'delivery_dispatches', 'order_shippers', 'order_items', 'orders',
  'audit_logs', 'notification_reads',
];

const result = db.transaction(() => {
  const wiped: Record<string, number> = {};
  for (const t of WIPE) wiped[t] = db.prepare(`DELETE FROM ${t}`).run().changes;
  db.prepare('UPDATE customers SET bottle_debt_voi = 0, bottle_debt_up = 0').run();

  // 4a. Đối tác còn thiếu
  const nextPartner = () => {
    const rows = db.prepare(`SELECT code FROM partner_units WHERE code LIKE 'DT-%'`).all() as { code: string }[];
    let max = 0;
    for (const r of rows) {
      const n = parseInt(String(r.code).replace(/\D/g, ''), 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
    return `DT-${String(max + 1).padStart(3, '0')}`;
  };
  const addedPartners: string[] = [];
  for (const name of PARTNERS_TO_ADD) {
    const exists = db.prepare('SELECT id FROM partner_units WHERE name = ?').get(name);
    if (exists) continue;
    db.prepare('INSERT INTO partner_units (code, name, note) VALUES (?, ?, ?)').run(
      nextPartner(),
      name,
      'Bổ sung khi chuyển dữ liệu từ sheet XUẤT'
    );
    addedPartners.push(name);
  }

  // 4b. Khách hàng mới (lấy nguyên text cột C làm tên, giống dữ liệu hiện có)
  const nextCustomerCode = () => {
    const rows = db.prepare(`SELECT code FROM customers WHERE code LIKE 'KH%'`).all() as { code: string }[];
    let max = 0;
    for (const r of rows) {
      const n = parseInt(String(r.code).replace(/\D/g, ''), 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
    return `KH${String(max + 1).padStart(3, '0')}`;
  };
  let addedCustomers = 0;
  for (const name of customersToAdd) {
    if (db.prepare('SELECT id FROM customers WHERE name = ?').get(name)) continue;
    db.prepare('INSERT INTO customers (code, name, address, is_active) VALUES (?, ?, ?, 1)').run(
      nextCustomerCode(),
      name,
      ''
    );
    addedCustomers++;
  }

  // 4c. Khai tồn đầu kỳ qua đúng nghiệp vụ phiếu kho (createTicket + postTicket)
  const byWarehouse = new Map<number, { pid: number; qty: number }[]>();
  for (const { wh, pid, qty } of opening.values()) {
    const list = byWarehouse.get(wh) ?? [];
    list.push({ pid, qty });
    byWarehouse.set(wh, list);
  }
  let tickets = 0;
  const codes: string[] = [];
  for (const [wh, items] of byWarehouse) {
    const t = createTicket(db, {
      ticketType: 'IN',
      ticketDate: '2026-09-08',
      warehouseId: wh,
      reason: 'ADJUST_IN',
      movementType: 'ADJUSTMENT',
      note: 'Tồn kho đầu kỳ khai theo sheet TỒN TỔNG ngày 18/9 (chuyển từ ĐIỀU PHỐI NƯỚC LỌC)',
      auto: true,
      status: 'CONFIRMED',
      items: items.map((i) => ({ product_id: i.pid, quantity: i.qty })),
    });
    codes.push(t.code);
    tickets++;
  }
  return { wiped, addedPartners, addedCustomers, tickets, codes };
})();

console.log('\n=== ĐÃ XOÁ ===');
for (const [t, n] of Object.entries(result.wiped)) if (n) console.log(`  ${t.padEnd(26)} ${n}`);
console.log('\n=== ĐÃ TẠO ===');
console.log('  đối tác :', result.addedPartners.join(', ') || '(không thêm)');
console.log('  khách   :', result.addedCustomers);
console.log('  phiếu kho đầu kỳ:', result.tickets, result.codes.join(', '));

// ---------- 5. Kiểm tra chốt ----------
console.log('\n=== KIỂM TRA SAU KHI KHAI ===');
const bad: string[] = [];
for (const { wh, pid, qty } of opening.values()) {
  const cur = db.prepare('SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?').get(wh, pid) as
    | { quantity: number }
    | undefined;
  if (Number(cur?.quantity) !== qty) bad.push(`${whName[wh]}/${prodName[pid]}: khai ${qty} nhưng tồn ${cur?.quantity}`);
}
console.log(bad.length ? '*** SAI: ' + bad.join(' | ') : 'Tồn kho khớp đúng số vừa khai.');
console.log('  stock_movements :', (db.prepare('SELECT COUNT(*) c FROM stock_movements').get() as { c: number }).c, '(khác 0 để seedMovementsIfEmpty không tự bịa)');
console.log('  orders          :', (db.prepare('SELECT COUNT(*) c FROM orders').get() as { c: number }).c);
console.log('  customers       :', (db.prepare('SELECT COUNT(*) c FROM customers').get() as { c: number }).c);
console.log('  partner_units   :', (db.prepare('SELECT COUNT(*) c FROM partner_units').get() as { c: number }).c);
db.close();
console.log('\nGIAI ĐOẠN 1 XONG.');
