/**
 * GIAI ĐOẠN 2: nhập đơn hàng từ kết quả chuyển đổi sheet XUẤT (ĐIỀU PHỐI NƯỚC LỌC) vào phần mềm.
 * Chạy: npx tsx migrate-xuat-orders.ts --dry   (chỉ đo, không ghi)
 *       npx tsx migrate-xuat-orders.ts         (thực thi)
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createOrder } from './apps/api/src/lib/orderCreate.js';
import { changeStatus } from './apps/api/src/lib/orderStatus.js';
import { getDb } from './apps/api/src/db.js';

// Khởi tạo CSDL NGAY từ đầu: getDb() chạy các migration chuẩn hoá dữ liệu (vd backfillCompanySourceShells
// tự thêm phiếu thu cọc cho đơn thiếu sổ). Nếu để nó chạy giữa chừng trong lúc nhập đơn thì nó sẽ ghi
// thêm bút toán cho đơn vừa tạo — lúc đó đơn còn là Nháp. Chạy trước khi có đơn nào nên không đụng gì.
getDb();

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DRY = process.argv.includes('--dry');
// Dùng CHÍNH kết nối của app: tránh hai kết nối cùng ghi vào một file (createOrder gọi loanWarehouseId()
// chạy trên kết nối của app, nếu ta mở kết nối riêng thì hai bên chồng khoá lên nhau).
const db = getDb();

const strip = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Bỏ danh xưng / chức danh / ghi chú trong tên người để so khớp
const TITLE = /\b(chi|anh|co|chu|em|ong|ba|to|bks|pcn|pqt|pxd|ptm|scc|dvctt|ky thuat|truong|nhan vien|nv)\b/g;
const personKey = (s: unknown) =>
  strip(s)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,;:/\\-]/g, ' ')
    .replace(TITLE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface Emp {
  id: number;
  code: string;
  full_name: string;
}
const employees = db.prepare('SELECT id, code, full_name FROM employees WHERE is_active = 1').all() as Emp[];
// khớp CHÍNH XÁC giữ nguyên dấu + giữ ngoặc (phân biệt "Thu Hiên"/"Thu Hiền", "Thu (A)"/"Thu (B)")
const natKey = (s: unknown) =>
  String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,;:/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const empByNat = new Map<string, Emp[]>();
const empByLoose = new Map<string, Emp[]>();
for (const e of employees) {
  const push = (m: Map<string, Emp[]>, k: string) => {
    if (!k) return;
    const l = m.get(k) ?? [];
    l.push(e);
    m.set(k, l);
  };
  push(empByNat, natKey(e.full_name));
  push(empByLoose, personKey(e.full_name));
}
const missingPeople = new Map<string, number>();

/** Khớp duy nhất thì dùng; mơ hồ (0 hoặc >1) trả null và ghi nhận. */
const resolvePerson = (raw: string): Emp | null => {
  const nat = natKey(raw);
  const loose = personKey(raw);
  if (!nat && !loose) return null;
  const n = empByNat.get(nat);
  if (n && n.length === 1) return n[0];
  const l = empByLoose.get(loose);
  if (l && l.length === 1) return l[0];
  if ((n && n.length > 1) || (l && l.length > 1)) {
    missingPeople.set(raw, (missingPeople.get(raw) || 0) + 1);
    return null;
  }
  const cand = employees.filter((e) => {
    const k = personKey(e.full_name);
    return k === loose || k.startsWith(loose + ' ') || k.endsWith(' ' + loose) || k.includes(' ' + loose + ' ');
  });
  if (cand.length === 1) return cand[0];
  missingPeople.set(raw, (missingPeople.get(raw) || 0) + 1);
  return null;
};

const customers = db.prepare('SELECT id, name FROM customers').all() as { id: number; name: string }[];
const custByName = new Map(customers.map((c) => [String(c.name).trim(), c.id]));
const whByName = new Map(
  (db.prepare('SELECT id, name FROM warehouses').all() as { id: number; name: string }[]).map((w) => [w.name, w.id])
);
const partnerByName = new Map(
  (db.prepare('SELECT id, name FROM partner_units').all() as { id: number; name: string }[]).map((p) => [p.name, p.id])
);
const prodByName = new Map(
  (db.prepare('SELECT id, name FROM products').all() as { id: number; name: string }[]).map((p) => [p.name, p.id])
);
const fee = db.prepare('SELECT id, fee_per_unit, fee_per_trip, min_fee FROM shipping_fees ORDER BY id LIMIT 1').get() as
  | { id: number; fee_per_unit: number; fee_per_trip: number; min_fee: number }
  | undefined;
if (!fee) throw new Error('Không có tuyến phí vận chuyển nào — đơn bán cần tuyến phí để xác nhận.');

const LABEL_TO_PROD: Record<string, string> = {
  'Vỉ 500ml': 'Vỉ 500ml',
  'Vỉ 350ml': 'Vỉ 350ml',
  'Hộp 500ml': 'Hộp 500ml',
  'Hộp 350ml': 'Hộp 350ml',
  'Bình kiềm': 'Bình kiềm (bình vòi)',
  'Bình RO': 'Bình RO (bình vòi)',
};

const dry = JSON.parse(fs.readFileSync(path.join(ROOT, '.migrate', 'dryrun.json'), 'utf8')) as {
  kept: {
    r: number;
    iso: string;
    type: string;
    scope: string;
    whName: string | null;
    partnerName: string | null;
    sellerName: string;
    shipText: string;
    shipFee: number;
    revenue: number;
    km: number;
    cols: string;
    custText: string;
  }[];
};

// ---------- Dựng kế hoạch ----------
interface Plan {
  row: number;
  iso: string;
  type: string;
  scope: string;
  customerId: number;
  warehouseId: number | null;
  partnerId: number | null;
  sellerId: number | null;
  shipperIds: number[];
  shipFee: number;
  routeFee: number;
  items: { product_id: number; quantity: number; quantity_promo: number }[];
  expectedRevenue: number;
}
const plans: Plan[] = [];
const problems: string[] = [];
const inherited: { row: number; from: number; customer: string }[] = [];
let lastFilledCustText = '';
let lastFilledRow = 0;

for (const k of dry.kept) {
  // Cột C trống = dòng hàng tiếp theo của đơn trên (sheet dùng ô gộp / để trống).
  // Lấy theo khách của dòng có tên gần nhất phía trên và ghi lại để đối chiếu.
  let custText = String(k.custText).trim();
  if (!custText) {
    if (!lastFilledCustText) {
      problems.push(`dòng ${k.r}: trống tên khách và không có dòng nào phía trên để lấy theo`);
      continue;
    }
    custText = lastFilledCustText;
    inherited.push({ row: k.r, from: lastFilledRow, customer: custText });
  } else {
    lastFilledCustText = custText;
    lastFilledRow = k.r;
  }
  const customerId = custByName.get(custText);
  if (!customerId) {
    problems.push(`dòng ${k.r}: không thấy khách "${String(k.custText).slice(0, 40)}"`);
    continue;
  }
  const warehouseId = k.whName ? (whByName.get(k.whName) ?? null) : null;
  if (k.type === 'SALE' && !warehouseId) {
    problems.push(`dòng ${k.r}: không thấy kho ${k.whName}`);
    continue;
  }
  const partnerId = k.partnerName ? (partnerByName.get(k.partnerName) ?? null) : null;
  if (k.type === 'BORROW_IN' && !partnerId) {
    problems.push(`dòng ${k.r}: không thấy đối tác ${k.partnerName}`);
    continue;
  }
  const sellerId = resolvePerson(k.sellerName)?.id ?? null;
  const shipperIds = [...new Set(k.shipText.split(/[+,;]/).map((x) => x.trim()).filter(Boolean).map((x) => resolvePerson(x)?.id ?? null))]
    .filter((x): x is number => x !== null);

  const parts = k.cols.split(',').map((s) => s.trim()).filter(Boolean);
  const items = parts.map((p, i) => {
    const [label, qtyS] = p.split('=');
    const pid = prodByName.get(LABEL_TO_PROD[label.trim()]);
    if (!pid) throw new Error('Không thấy sản phẩm cho nhãn ' + label);
    return {
      product_id: pid,
      quantity: Number(qtyS) || 0,
      // KM là số lượng cộng thêm, gán vào dòng hàng đầu tiên
      quantity_promo: i === 0 ? Number(k.km) || 0 : 0,
    };
  });
  const units = items.reduce((a, x) => a + x.quantity, 0);
  const routeFee = Math.max((fee.fee_per_trip || 0) + (fee.fee_per_unit || 0) * units, fee.min_fee || 0);

  plans.push({
    row: k.r,
    iso: k.iso,
    type: k.type,
    scope: k.scope,
    customerId,
    warehouseId,
    partnerId,
    sellerId,
    shipperIds,
    shipFee: k.shipFee,
    routeFee,
    items,
    expectedRevenue: k.revenue,
  });
}

// ---------- Báo cáo trước khi nhập ----------
const byType: Record<string, number> = {};
const byScope: Record<string, number> = {};
for (const p of plans) {
  byType[p.type] = (byType[p.type] || 0) + 1;
  byScope[p.scope] = (byScope[p.scope] || 0) + 1;
}
const needSeller = plans.filter((p) => p.type === 'SALE');
const noSeller = needSeller.filter((p) => !p.sellerId);
const noShipper = plans.filter((p) => !p.shipperIds.length);
const feeDiff = plans.filter((p) => p.type === 'SALE' && Math.abs(p.routeFee - p.shipFee) > 1);
const borrowFee = plans.filter((p) => p.type === 'BORROW_IN').reduce((a, p) => a + p.shipFee, 0);

console.log('=== KẾ HOẠCH NHẬP ĐƠN ===');
console.log('Số đơn            :', plans.length, JSON.stringify(byType));
console.log('Chỉ tiêu          :', JSON.stringify(byScope));
console.log('Doanh thu dự kiến :', plans.reduce((a, p) => a + p.expectedRevenue, 0).toLocaleString('vi-VN'));
console.log('\nĐơn SALE thiếu nhân viên bán:', noSeller.length, '/', needSeller.length);
if (noSeller.length) {
  const names = [...new Set(noSeller.map((p) => dry.kept.find((k) => k.r === p.row)?.sellerName ?? ''))];
  console.log('  tên chưa gán:', JSON.stringify(names.slice(0, 30)));
}
console.log('Đơn thiếu người vận chuyển  :', noShipper.length);
console.log('\nDòng trống tên khách — lấy theo dòng trên:', inherited.length);
for (const h of inherited) console.log(`   dòng ${h.row} ← dòng ${h.from}: "${h.customer.slice(0, 60)}"`);
console.log('Phí vận chuyển theo tuyến khác phí trên sheet:', feeDiff.length, 'dòng');
if (feeDiff.length) for (const d of feeDiff.slice(0, 8)) console.log(`   dòng ${d.row}: sheet ${d.shipFee} vs tuyến ${d.routeFee}`);
console.log('Phí vận chuyển đơn đi vay không ghi được (app đặt 0):', borrowFee.toLocaleString('vi-VN'));
console.log('Vấn đề chặn nhập:', problems.length);
for (const p of problems.slice(0, 10)) console.log('  ' + p);

if (DRY) {
  console.log('\n[--dry] Không ghi gì.');
  db.close();
  process.exit(0);
}

// ---------- Thực thi ----------
const chain = ['CONFIRMED', 'SHIPPING', 'COMPLETED'] as const;
let ok = 0;
let draft = 0;
const failures: { row: number; error: string }[] = [];
const draftRows: number[] = [];
for (const p of plans) {
  // Đơn không xác định được nhân viên bán: hệ thống bắt buộc phải có mới xác nhận được (đơn bán VÀ
  // đơn đi vay đều cần; chỉ đơn cho mượn / bốc xếp là không) -> nhập ở dạng NHÁP để giữ dữ liệu.
  const asDraft = !p.sellerId && p.type !== 'HIRED_LOAD';
  try {
    const created = createOrder(db, {
      customer_id: p.customerId,
      order_type: p.type,
      target_scope: p.scope,
      partner_unit_id: p.partnerId,
      warehouse_id: p.warehouseId,
      seller_employee_id: p.sellerId,
      shipper_employee_id: p.shipperIds[0] ?? null,
      shippers: p.shipperIds.map((id) => ({ employee_id: id, allocated_fee: 0 })),
      order_date: p.iso,
      delivery_date: p.iso,
      payment_status: 'PAID',
      payment_method: 'CASH',
      shipping_fee: p.shipFee,
      shipping_fee_id: p.type === 'SALE' ? fee.id : null,
      note: 'Nhập từ sheet XUẤT — ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa (2).xlsx (dòng ' + p.row + ')' + (asDraft ? ' [chưa gán được nhân viên bán]' : ''),
      items: p.items,
    });
    if (asDraft) {
      draft++;
      draftRows.push(p.row);
    } else {
      for (const step of chain) changeStatus(db, created.orderId, step);
      ok++;
    }
  } catch (e) {
    failures.push({ row: p.row, error: e instanceof Error ? e.message : String(e) });
  }
}
console.log('\n=== KẾT QUẢ ===');
console.log('Nhập hoàn tất :', ok);
console.log('Nhập dạng Nháp:', draft, draftRows.length ? '(dòng ' + draftRows.join(', ') + ')' : '');
console.log('Lỗi           :', failures.length);
for (const f of failures.slice(0, 25)) console.log(`  dòng ${f.row}: ${f.error}`);
console.log('\norders       :', (db.prepare('SELECT COUNT(*) c FROM orders').get() as { c: number }).c);
console.log('doanh thu ghi:', (db.prepare('SELECT COALESCE(SUM(amount),0) s FROM revenue_transactions').get() as { s: number }).s.toLocaleString('vi-VN'));
console.log('bút toán kho :', (db.prepare('SELECT COUNT(*) c FROM stock_movements').get() as { c: number }).c);
db.close();
