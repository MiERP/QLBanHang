// Chuyển dữ liệu từ sổ vận hành "ĐIỀU PHỐI NƯỚC LỌC. T10.xlsx" sang tệp Excel đúng định dạng
// sao lưu của phần mềm QAROMI ERP (mỗi bảng một sheet, tiêu đề cột trùng tên cột CSDL) để nhập vào phần mềm.
//
// Cách chạy:
//   node excel/tools/migrate-t10-to-backup.mjs
//   node excel/tools/migrate-t10-to-backup.mjs "<sổ nguồn.xlsx>" "<bản sao lưu.xlsx>" "<tệp kết quả.xlsx>"
//
// QUAN TRỌNG: tham số thứ hai phải là bản sao lưu MỚI NHẤT xuất từ chính phần mềm
// (Cấu hình chung → Xuất toàn bộ dữ liệu). Tệp đó chứa đúng ID kho / sản phẩm / đối tác đang dùng.
// Dữ liệu nhập vào theo cơ chế THÊM/CẬP NHẬT theo id, KHÔNG xóa dòng cũ — nên hãy nhập vào CSDL đã
// "Khôi phục mặc định" để tránh lẫn khách/đơn của lần chạy trước.
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
function newestBackup() {
  const dir = resolve(ROOT, 'excel');
  const files = readdirSync(dir)
    .filter((f) => /^qaromi-backup-.*\.xlsx$/i.test(f) && !/nhap/i.test(f))
    .map((f) => ({ f, t: statSync(resolve(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return resolve(dir, files[0]?.f ?? 'qaromi-backup-2026-10-05.xlsx');
}
const SRC = resolve(process.argv[2] ?? resolve(ROOT, 'excel', 'ĐIỀU PHỐI NƯỚC LỌC. T10.xlsx'));
const TPL = resolve(process.argv[3] ?? newestBackup());
const OUT = resolve(process.argv[4] ?? resolve(ROOT, 'excel', 'qaromi-nhap-T10.xlsx'));
console.log('Sổ nguồn   :', SRC);
console.log('Bản sao lưu:', TPL);
console.log('Tệp kết quả:', OUT);

// ---------- tiện ích đọc ô ----------
function cellValue(v) {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    if ('error' in v) return ''; // ô lỗi công thức (#REF!...) coi như trống
    return '';
  }
  return v;
}
const text = (ws, r, c) => String(cellValue(ws.getRow(r).getCell(c).value) ?? '').replace(/\s+/g, ' ').trim();
const num = (ws, r, c) => {
  const v = cellValue(ws.getRow(r).getCell(c).value);
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[.\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
// Bỏ dấu để so khớp tên (Kho, nhân viên, sản phẩm, khách hàng).
const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Ngày dạng chuỗi "29/9/2026", "3/10/26", "1/10" hoặc "2//10/2026" → 'YYYY-MM-DD' (thiếu năm = 2026).
function parseDateString(s) {
  const m = /(\d{1,2})\D+(\d{1,2})(?:\D+(\d{2,4}))?/.exec(String(s ?? '').trim());
  if (!m) return '';
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : 2026;
  if (year < 100) year += 2000;
  if (!day || !month || month > 12 || day > 31) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
// Ô ngày: chuỗi → DD/MM; ô Date có numFmt "mm-dd-yy" bị lệch tháng/ngày nên phải hoán đổi
// (vd ô hiển thị 04-10 thực chất là ngày 4/10), các định dạng khác giữ nguyên.
function parseDateCell(cell) {
  const v = cell.value;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const mo = v.getUTCMonth() + 1;
    const d = v.getUTCDate();
    const fmt = String(cell.numFmt ?? '');
    if (/mm-[^a-z]*d/i.test(fmt) && mo !== 10) {
      return `${y}-${String(d).padStart(2, '0')}-${String(mo).padStart(2, '0')}`;
    }
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const inner = v && typeof v === 'object' && 'result' in v ? v.result : v;
  if (inner instanceof Date) {
    const y = inner.getUTCFullYear();
    const mo = inner.getUTCMonth() + 1;
    const d = inner.getUTCDate();
    const fmt = String(cell.numFmt ?? '');
    if (/mm-[^a-z]*d/i.test(fmt) && mo !== 10) return `${y}-${String(d).padStart(2, '0')}-${String(mo).padStart(2, '0')}`;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return parseDateString(cellValue(v));
}

// ---------- đọc sổ nguồn ----------
const src = new ExcelJS.Workbook();
await src.xlsx.readFile(SRC);
const sheet = (name) => src.getWorksheet(name);
const XUAT = sheet('XUẤT');
const CBCNV = sheet('CBCNV');
if (!XUAT) throw new Error('Không thấy sheet XUẤT trong sổ nguồn');

// ---------- đọc bản sao lưu làm khuôn ----------
const tpl = new ExcelJS.Workbook();
await tpl.xlsx.readFile(TPL);
const tplRows = (name) => {
  const ws = tpl.getWorksheet(name);
  const header = (ws.getRow(1).values || []).slice(1).map((h) => String(h ?? '').trim());
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.values || row.values.filter((v) => v !== undefined && v !== null && v !== '').length === 0) continue;
    const obj = {};
    header.forEach((h, i) => (obj[h] = cellValue(row.getCell(i + 1).value)));
    rows.push(obj);
  }
  return { ws, header, rows };
};
const warehouseSheet = tplRows('warehouses');
const productSheet = tplRows('products');
// Tên chai 350/500ml: giữ (Vỉ)/(Hộp) để phân biệt, bỏ phần "6 chai"/"24 chai".
const PRODUCT_NAME_FIX = {
  VI_350ML: 'Nước Chai QAROMI 350ml (Vỉ)',
  HOP_350ML: 'Nước Chai QAROMI 350ml (Hộp)',
  VI_500ML: 'Nước Chai QAROMI 500ml (Vỉ)',
  HOP_500ML: 'Nước Chai QAROMI 500ml (Hộp)',
};
for (const p of productSheet.rows) {
  const fixed = PRODUCT_NAME_FIX[String(p.code)];
  if (fixed) p.name = fixed;
}
const customerGroupSheet = tplRows('customer_groups');
const orgUnitSheet = tplRows('org_units');
const partnerSheet = tplRows('partner_units');
const importSourceSheet = tplRows('import_sources');

const warehouseByCode = new Map(warehouseSheet.rows.map((w) => [String(w.code), Number(w.id)]));
const productByCode = new Map(productSheet.rows.map((p) => [String(p.code), p]));
const W = (code) => warehouseByCode.get(code);
const whMuon = W('KHO_MUON');
const defaultGroupId = Number(customerGroupSheet.rows[0]?.id ?? 1);

// ---------- khách hàng: tách tên / SĐT / địa chỉ từ cột C ----------
const PHONE_RE = /(?:\+?84|0)(?:[\s.\-]?\d){8,10}/g;
// So khớp KHÔNG DẤU (ổn định trước mọi kiểu mã hóa NFC/NFD) để cắt tên khỏi câu yêu cầu.
const GREET_FOLD = new Set(['oi', 'e', 'a', 'da', 'nhe', 'cho', 'chi', 'anh', 'em', 'ship', 'gui', 'ban', 'nho', 'mua', 'co', 'c']);
const CUT_RE = /(?:\s(?:cho|dat|mua|ship|gui|bao|nho|lay|giao|dang|dki|oi)\s)|[0-9]|(?:\s(?:so nha|sn|ngo|duong|chung cu|khu|to|ben|hoi truong|cot|nha may|doi dien|canh|gan|quan)\s)|(?:truong\s)/;
// Tên tách ra toàn là từ chung (không phải khách) → coi là khách lẻ.
const JUNK_FOLD = new Set(['so', 'so nha', 'chuyen', 'chuyen sang', 'them', 'chieu', 'kh', 'nha', 'dat', 'mua', 'ship', 'gui', 'bao', 'lay', 'giao', 'ban', 'giup']);
const ADDR_FOLD_RE = /(so nha|\bsn\b|ngo|duong|phuong|chung cu|\bkhu\b|\bto\b|ben|hoi truong|\bcot\b|nha may|doi dien|\bcanh\b|\bgan\b|\bquan\b|\btruong\b)/;
// Bỏ dấu + giữ bảng ánh xạ ngược về vị trí ký tự gốc để cắt chuỗi đúng chỗ.
function foldMap(s) {
  let out = '';
  const map = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    let base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (ch === 'đ' || ch === 'Đ') base = 'd';
    base = base.toLowerCase();
    for (const c of base) {
      out += c;
      map.push(i);
    }
  }
  return { out, map };
}

function parseCustomerText(rawDesc) {
  let s = String(rawDesc ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  let phone = '';
  s = s.replace(PHONE_RE, (m) => {
    if (!phone) phone = m.replace(/[\s.\-]/g, '');
    return ' ';
  }).replace(/\s+/g, ' ').trim();

  const { out, map } = foldMap(s);
  let cut = s.length;
  const colon = s.search(/[:：]/);
  if (colon > 1 && colon <= 50) cut = colon;
  const mc = CUT_RE.exec(out);
  if (mc && mc.index > 0 && map[mc.index] !== undefined) cut = Math.min(cut, map[mc.index]);

  let name = s.slice(0, cut).split(/[,;:(.]/)[0].replace(/[+\-–,;:]\s*$/, '').replace(/\s+/g, ' ').trim();
  const words = name.split(' ').filter(Boolean);
  while (words.length && GREET_FOLD.has(fold(words[0]))) words.shift();
  name = words.join(' ').trim().replace(/[+\-–,;:]\s*$/, '').trim();
  if (name.length > 70) name = name.slice(0, 70).trim();
  if (!name || name.length < 2 || JUNK_FOLD.has(fold(name)) || /^[\d\s+\-–.]+$/.test(name) || /^\d/.test(name)) {
    name = 'Khách lẻ (chưa rõ tên)';
  }

  // Địa chỉ: đoạn có từ khóa địa chỉ (không dấu) và có chữ số.
  let address = '';
  const clauses = s.split(/[,;.]|(?:\s+-\s+)/).map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const clause of clauses) {
    if (ADDR_FOLD_RE.test(fold(clause)) && /\d/.test(clause)) {
      address = clause;
      break;
    }
  }
  if (address.length > 120) address = address.slice(0, 120).trim();
  return { name, phone, address };
}

const customers = [];
const customerByName = new Map();
const GENERIC_CUSTOMER = 'Khách lẻ (chưa rõ tên)';
function ensureCustomer(parsed) {
  const isGeneric = parsed.name === GENERIC_CUSTOMER;
  const key = fold(parsed.name);
  const existing = customerByName.get(key);
  if (existing) {
    // Khách lẻ gộp nhiều đơn khác nhau — không gán SĐT/địa chỉ của một đơn cho cả nhóm.
    if (!isGeneric) {
      if (!existing.phone && parsed.phone) existing.phone = parsed.phone;
      if (existing.address === 'Chưa rõ' && parsed.address) existing.address = parsed.address;
    }
    return existing.id;
  }
  const id = customers.length + 1;
  const row = {
    id,
    group_id: defaultGroupId,
    code: `KH${String(id).padStart(3, '0')}`,
    name: parsed.name,
    phone: isGeneric ? '' : parsed.phone || '',
    address: isGeneric ? 'Chưa rõ' : parsed.address || 'Chưa rõ',
    is_active: 1,
  };
  customers.push(row);
  customerByName.set(key, row);
  return id;
}

// ---------- nhân viên ----------
const employees = [];
const employeeByName = new Map();
const orgUnits = [];
const orgUnitByName = new Map();
for (const unit of orgUnitSheet.rows) orgUnitByName.set(fold(unit.name), Number(unit.id));
function orgUnitIdFor(name) {
  const key = fold(name);
  if (!key) return null;
  if (orgUnitByName.has(key)) return orgUnitByName.get(key);
  for (const [k, v] of orgUnitByName) if (k.includes(key) || key.includes(k)) return v;
  return null;
}
function addEmployee(name, position = '', orgUnitName = '') {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const key = fold(clean);
  if (employeeByName.has(key)) return employeeByName.get(key).id;
  const id = employees.length + 1;
  const row = {
    id,
    code: `NV${String(id).padStart(3, '0')}`,
    full_name: clean,
    position,
    org_unit_id: orgUnitName ? orgUnitIdFor(orgUnitName) : null,
    is_active: 1,
  };
  employees.push(row);
  employeeByName.set(key, row);
  return id;
}
function employeeIdForMentions(raw) {
  const list = String(raw ?? '')
    .split(/[,;+/]+/)
    .map((s) => s.replace(/\s+(lái xe|bảo vệ|chở hàng|thu tiền|BKS|PXD|PQT|PCN|PKH).*$/i, '').replace(/\s+/g, ' ').trim())
    .filter((x) => x && !/^(xí nghiệp|xe điện|công ty|trạm .*)$/i.test(x));
  const ids = [];
  for (const name of list) {
    const key = fold(name);
    let hit = employeeByName.get(key);
    if (!hit) {
      for (const [k, v] of employeeByName) {
        if (k === key || k.endsWith(` ${key}`) || key.endsWith(` ${k}`)) {
          hit = v;
          break;
        }
      }
    }
    ids.push(hit ? hit.id : addEmployee(name));
  }
  return ids.filter((x) => x != null);
}
if (CBCNV) {
  for (let r = 7; r <= CBCNV.rowCount; r++) {
    const name = text(CBCNV, r, 2);
    if (!name || /^cộng$|^kiểm tra$/i.test(name)) continue;
    addEmployee(name, text(CBCNV, r, 3), text(CBCNV, r, 4));
  }
}

// ---------- đối tác liên kết & nguồn nhập ----------
function findPartner(name) {
  const key = fold(name);
  if (!key) return null;
  for (const p of partnerSheet.rows) {
    const pk = fold(p.name);
    if (pk === key || pk.includes(key) || key.includes(pk)) return Number(p.id);
  }
  return null;
}
const newPartners = [];
function ensurePartner(name) {
  const found = findPartner(name);
  if (found) return found;
  const id = Math.max(0, ...partnerSheet.rows.map((p) => Number(p.id) || 0)) + 1;
  const row = { id, code: `DT-${String(id).padStart(3, '0')}`, name, is_active: 1, note: 'Bổ sung khi chuyển dữ liệu T10' };
  partnerSheet.rows.push(row);
  newPartners.push(name);
  return id;
}
let camPhaSourceId = importSourceSheet.rows.find((s) => fold(s.name).includes('cam pha'))?.id;
if (!camPhaSourceId) {
  const id = Math.max(0, ...importSourceSheet.rows.map((s) => Number(s.id) || 0)) + 1;
  importSourceSheet.rows.push({ id, code: 'SRC_CAM_PHA', name: 'Xí nghiệp nước Cẩm Phả', is_active: 1, note: 'Nhập hàng từ Cẩm Phả' });
  camPhaSourceId = id;
}

// ---------- ánh xạ Kho (cột E) ----------
function mapWarehouse(name) {
  const key = fold(name);
  if (!key) return { code: 'KHO_TANGAP', note: '(trống kho)' };
  if (/bai chay/.test(key)) return { code: 'KHO_MUON', borrow: 'Bãi Cháy', note: '' };
  if (/cam pha cho|xe cam pha/.test(key)) return { code: 'KHO_VP', note: '', viaCamPha: true };
  if (/hong gai|hue/.test(key)) return { code: 'KHO_HUE', note: '' };
  if (/ha lam/.test(key)) return { code: 'KHO_HALAM', note: '' };
  if (/van phong|\bvp\b/.test(key)) return { code: 'KHO_VP', note: '' };
  if (/xe dien|xe tai/.test(key)) return { code: 'KHO_XEDIEN', note: '' };
  if (/tang ap/.test(key)) return { code: 'KHO_TANGAP', note: '' };
  return { code: 'KHO_TANGAP', note: `không rõ kho "${name}"` };
}

// ---------- ánh xạ Sản phẩm ----------
function bottleVariant(desc) {
  const d = fold(desc);
  if (/chup|\bup\b|ngua/.test(d)) return 'UP';
  return 'VOI';
}
function resolveCode(code, desc) {
  if (code === 'KIEM') return bottleVariant(desc) === 'UP' ? 'KIEM_19L_UP' : 'KIEM_19L_VOI';
  if (code === 'RO') return bottleVariant(desc) === 'UP' ? 'RO_19L_UP' : 'RO_19L_VOI';
  return code;
}
function mapProductLabel(label, description) {
  const k = fold(label);
  const d = fold(description);
  const variant = /up|chup|ngua/.test(k) ? 'UP' : /voi/.test(k) ? 'VOI' : bottleVariant(description);
  if (/hop 350|350.*hop|thung 350/.test(k) || (/350/.test(k) && /hop|thung/.test(k))) return 'HOP_350ML';
  if (/hop 500|500.*hop|thung 500/.test(k) || (/500/.test(k) && /hop|thung/.test(k))) return 'HOP_500ML';
  if (/350/.test(k)) return 'VI_350ML';
  if (/500/.test(k)) return 'VI_500ML';
  if (/kiem|ion/.test(k)) return variant === 'UP' ? 'KIEM_19L_UP' : 'KIEM_19L_VOI';
  if (/binh ro|\bro\b|binh thuong|nuoc thuong/.test(k) || /binh ro/.test(d)) {
    return variant === 'UP' ? 'RO_19L_UP' : 'RO_19L_VOI';
  }
  return '';
}
function itemsFromDescription(description, rowProductLabel) {
  const found = [];
  const re = /(\d+)\s*(bình|vỉ|hộp|thùng)\s*(vòi|úp|chụp|ngửa)?/gi;
  let m;
  while ((m = re.exec(description)) !== null) {
    const qty = Number(m[1]);
    if (!qty) continue;
    const unit = fold(m[2]);
    const variant = m[3] ? fold(m[3]) : '';
    const family = fold(rowProductLabel + ' ' + description);
    let label;
    if (unit === 'binh') {
      const isKiem = /kiem|ion/.test(family);
      label = `${isKiem ? 'Bình kiềm' : 'Bình RO'}${variant && !/voi/.test(variant) ? ' úp' : ' vòi'}`;
    } else {
      const size = /350/.test(family) ? '350' : '500';
      label = `${unit === 'hop' || unit === 'thung' ? 'Hộp' : 'Vỉ'} ${size}ml`;
    }
    found.push({ label, qty });
  }
  return found;
}

// ---------- đơn hàng từ sheet XUẤT (dòng 6..90) ----------
const MAX_ROW = 90; // từ dòng 91 trở xuống là khối rời, bỏ qua theo yêu cầu
const QTY_COLS = [
  [16, 'VI_500ML'],
  [17, 'VI_350ML'],
  [18, 'HOP_500ML'],
  [19, 'HOP_350ML'],
  [20, 'KIEM'],
  [21, 'RO'],
];
const LEFT_COLS = [
  [6, '350'],
  [7, '500'],
  [8, 'Bình RO'],
  [9, 'Bình Kiềm'],
];
function qtyAndPromoRaw(value) {
  if (typeof value === 'number') return { qty: value, promo: 0 };
  const v = cellValue(value);
  if (typeof v === 'number') return { qty: v, promo: 0 };
  const m = /^(\d+)\s*(?:\+\s*(\d+))?$/.exec(String(v ?? '').replace(/\s/g, ''));
  if (!m) return { qty: 0, promo: 0 };
  return { qty: Number(m[1]), promo: Number(m[2] ?? 0) };
}

const groups = [];
let cur = null;
for (let r = 6; r <= MAX_ROW; r++) {
  const desc = text(XUAT, r, 3);
  const date = parseDateCell(XUAT.getRow(r).getCell(2));
  const prod = text(XUAT, r, 15);
  const anyQty = [16, 17, 18, 19, 20, 21, 22, 6, 7, 8, 9].some((c) => num(XUAT, r, c) > 0);
  if (!desc && !date && !prod && !anyQty) continue;
  const key = fold(desc);
  if (desc && (!cur || key !== cur.key)) {
    cur = { key, desc, startRow: r, rows: [], date: '' };
    groups.push(cur);
  }
  if (!cur) continue;
  cur.rows.push(r);
  if (!cur.date && date) cur.date = date;
}

const orders = [];
const orderItems = [];
const warnings = [];
const unmappedWarehouses = new Map();
const seqByDate = new Map();

function collectItems(rows, desc) {
  const items = [];
  let promo = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowPrice = num(XUAT, r, 24);
    let added = false;
    for (const [col, code] of QTY_COLS) {
      const { qty } = qtyAndPromoRaw(XUAT.getRow(r).getCell(col).value);
      if (qty > 0) {
        items.push({ code: resolveCode(code, desc), qty, rowPrice });
        added = true;
      }
    }
    promo += qtyAndPromoRaw(XUAT.getRow(r).getCell(22).value).promo || num(XUAT, r, 22);
    if (!added) {
      const left = LEFT_COLS.map(([c, label]) => ({ q: num(XUAT, r, c), label })).find((x) => x.q > 0);
      if (left) {
        const label = text(XUAT, r, 15) || left.label;
        const code = mapProductLabel(label, desc);
        items.push({ code: code || resolveCode(label, desc), qty: left.q, rowPrice });
      } else if (i === 0) {
        for (const f of itemsFromDescription(desc, text(XUAT, r, 15))) {
          const code = mapProductLabel(f.label, desc);
          if (code) items.push({ code, qty: f.qty, rowPrice });
        }
      }
    }
  }
  return { items, promo };
}

for (const g of groups) {
  if (!g.date) {
    warnings.push(`Dòng ${g.startRow}: thiếu ngày — bỏ qua`);
    continue;
  }
  const desc = g.desc;
  const scopeRaw = text(XUAT, g.startRow, 13);
  const scopeKey = fold(scopeRaw);
  const khoRaw = text(XUAT, g.startRow, 5);
  const resultRaw = text(XUAT, g.startRow, 12);
  const collectRaw = text(XUAT, g.startRow, 26);

  const parsed = parseCustomerText(desc);
  const customerId = ensureCustomer(parsed);

  const { items: rawItems, promo } = collectItems(g.rows, desc);
  const items = rawItems
    .map((it) => {
      const product = productByCode.get(it.code);
      if (!product) {
        warnings.push(`Dòng ${g.startRow}: không nhận ra sản phẩm "${it.code}"`);
        return null;
      }
      const unitPrice = it.rowPrice > 0 ? it.rowPrice : Number(product.standard_price) || 0;
      return { product_id: Number(product.id), quantity: it.qty, unit_price: unitPrice, total_price: it.qty * unitPrice };
    })
    .filter(Boolean);
  if (!items.length) {
    warnings.push(`Dòng ${g.startRow}: không có dòng hàng — bỏ qua ("${desc.slice(0, 40)}")`);
    continue;
  }

  const wh = mapWarehouse(khoRaw);
  if (wh.note) {
    warnings.push(`Dòng ${g.startRow}: ${wh.note}`);
    const label = khoRaw || '(trống)';
    unmappedWarehouses.set(label, (unmappedWarehouses.get(label) ?? 0) + 1);
  }

  // Loại đơn: kho Bãi Cháy = mượn đối tác; Chỉ tiêu ngoài Xí nghiệp/Công ty = cho mượn.
  let orderType = 'SALE';
  let targetScope = 'ENTERPRISE';
  let partnerId = null;
  if (wh.borrow) {
    orderType = 'BORROW_IN';
    partnerId = ensurePartner(wh.borrow);
  } else if (scopeKey.includes('cong ty')) {
    targetScope = 'COMPANY';
  } else if (!scopeKey.includes('xi nghiep') && scopeKey !== '' && !/cong ty/.test(scopeKey)) {
    orderType = 'LEND_OUT';
    partnerId = ensurePartner(scopeRaw);
  } else if (scopeKey === '') {
    warnings.push(`Dòng ${g.startRow}: trống Chỉ tiêu — coi là đơn bán của xí nghiệp`);
  }

  const sellerIds = orderType === 'LEND_OUT' ? [] : employeeIdForMentions(text(XUAT, g.startRow, 10));
  const shipperIds = employeeIdForMentions(text(XUAT, g.startRow, 27));
  const orderStatus = /hoan thanh/.test(fold(resultRaw)) ? 'COMPLETED' : 'SHIPPING';
  const paid = collectRaw !== '';
  const paymentMethod = /ck|chuyen khoan/.test(fold(collectRaw)) ? 'BANK_TRANSFER' : 'CASH';

  const subtotal = items.reduce((a, it) => a + it.total_price, 0);
  const shippingFee = num(XUAT, g.startRow, 29);
  const total = orderType === 'LEND_OUT' ? 0 : subtotal;
  const warehouseId = wh.code === 'KHO_MUON' ? whMuon : W(wh.code);
  const seq = (seqByDate.get(g.date) ?? 0) + 1;
  seqByDate.set(g.date, seq);
  const id = orders.length + 1;

  orders.push({
    id,
    order_code: `DH-${g.date.replace(/-/g, '')}-${String(seq).padStart(2, '0')}`,
    customer_id: customerId,
    seller_employee_id: sellerIds[0] ?? null,
    order_type: orderType,
    partner_unit_id: partnerId,
    target_scope: targetScope,
    shipper_employee_id: shipperIds[0] ?? null,
    warehouse_id: warehouseId,
    order_date: g.date,
    delivery_date: g.date,
    order_status: orderStatus,
    payment_status: paid ? 'PAID' : 'UNPAID',
    payment_method: paid ? paymentMethod : 'CASH',
    is_vat_invoice: 0,
    vat_rate: 0,
    subtotal_amount: subtotal,
    shipping_fee: shippingFee,
    discount_amount: 0,
    deposit_amount: 0,
    total_amount: total,
    paid_amount: paid ? total : 0,
    shipping_receiver: parsed.name,
    shipping_phone: parsed.phone || '',
    shipping_address: parsed.address || '',
    shipping_note: desc,
    note: `Nhập từ sổ ĐIỀU PHỐI NƯỚC LỌC T10 — dòng ${g.startRow}${wh.viaCamPha ? ' (xe Cẩm Phả chở: nhập kho Văn Phòng rồi xuất giao)' : ''}`,
  });

  items.forEach((it, index) => {
    orderItems.push({
      id: orderItems.length + 1,
      order_id: id,
      product_id: it.product_id,
      quantity: it.quantity,
      quantity_promo: index === 0 ? promo : 0,
      unit_price: it.unit_price,
      total_price: it.total_price,
    });
  });
}

console.log(`Đơn: ${orders.length} | Dòng hàng: ${orderItems.length} | Khách: ${customers.length} | Nhân viên: ${employees.length}`);
{
  const byType = {};
  for (const o of orders) byType[o.order_type] = (byType[o.order_type] ?? 0) + 1;
  const byStatus = {};
  for (const o of orders) byStatus[o.order_status] = (byStatus[o.order_status] ?? 0) + 1;
  console.log('  Loại đơn :', JSON.stringify(byType));
  console.log('  Trạng thái:', JSON.stringify(byStatus));
}

// ---------- Tồn kho đầu kỳ = tồn cuối ngày 28/9/2026 (sheet TỒN TỔNG) ----------
const TON = sheet('TỒN TỔNG');
const TON_COLS = [
  [4, 'RO_19L_VOI', 'RO'],
  [5, 'KIEM_19L_VOI', 'Kiềm'],
  [6, 'HOP_500ML', 'Hộp 500'],
  [7, 'VI_500ML', 'Vỉ 500'],
  [8, 'VI_350ML', 'Vỉ 350'],
];
function mapWarehouseName(name) {
  const key = fold(name);
  if (/hue/.test(key)) return 'KHO_HUE';
  if (/tang ap/.test(key)) return 'KHO_TANGAP';
  if (/van phong/.test(key)) return 'KHO_VP';
  if (/xe dien/.test(key)) return 'KHO_XEDIEN';
  if (/ha lam/.test(key)) return 'KHO_HALAM';
  return '';
}
const stockMovements = [];
const inventory = new Map(); // key: `${whId}-${productId}` → quantity
const inventoryLast = new Map(); // key → ngày phát sinh cuối (cho inventory_stock.last_updated)
let stockMovementId = 0;
const openingSummary = [];

if (TON) {
  for (let r = 3; r <= TON.rowCount; r++) {
    if (parseDateCell(TON.getRow(r).getCell(2)) !== '2026-09-28') continue;
    const whCode = mapWarehouseName(text(TON, r, 3));
    const whId = whCode ? W(whCode) : null;
    if (!whId) {
      if (text(TON, r, 3)) warnings.push(`Tồn TỒNG 28/9: không rõ kho "${text(TON, r, 3)}"`);
      continue;
    }
    for (const [col, code] of TON_COLS) {
      const qty = num(TON, r, col);
      if (!qty) continue;
      const product = productByCode.get(code);
      if (!product) continue;
      const pid = Number(product.id);
      const key = `${whId}-${pid}`;
      inventory.set(key, (inventory.get(key) ?? 0) + qty);
      inventoryLast.set(key, '2026-09-28');
      openingSummary.push(`${whCode} / ${product.name}: ${qty}`);
      stockMovements.push({
        id: ++stockMovementId,
        movement_type: 'IMPORT',
        target_warehouse_id: whId,
        product_id: pid,
        quantity: qty,
        quantity_promo: 0,
        reference_id: 'T10-OPEN',
        note: `Tồn đầu kỳ 28/9/2026 (tồn cuối sheet TỒN TỔNG) — ${whCode}`,
        created_at: '2026-09-28 00:00:00',
      });
    }
  }
}
console.log('Dòng tồn đầu kỳ 28/9:', openingSummary.length);

// ---------- Nhập / xuất theo các sheet kho, chỉ từ 29/9/2026 ----------
const STOCK_SHEETS = [
  ['TỒN KHO HUẾ', 'KHO_HUE'],
  ['TỒN KHO TĂNG ÁP', 'KHO_TANGAP'],
  ['tồn xe', 'KHO_XEDIEN'],
  ['Tồn kho VP', 'KHO_VP'],
  ['TỒN KHO HÀ LẦM', 'KHO_HALAM'],
];
const STOCK_PRODUCT = [
  [/binh ro|nuoc ro/, 'RO_19L_VOI'],
  [/binh kiem|binh ion|nuoc kiem/, 'KIEM_19L_VOI'],
  [/hop 500/, 'HOP_500ML'],
  [/vi 500/, 'VI_500ML'],
  [/vi 350/, 'VI_350ML'],
  [/hop 350/, 'HOP_350ML'],
];
const stockNote = [];
for (const [sheetName, whCode] of STOCK_SHEETS) {
  const ws = sheet(sheetName);
  if (!ws) {
    warnings.push(`Không thấy sheet tồn "${sheetName}"`);
    continue;
  }
  let blockRow = 0;
  let productRow = 0;
  for (let r = 1; r <= 4; r++) {
    const cells = [];
    for (let c = 1; c <= Math.min(ws.columnCount, 24); c++) cells.push(fold(text(ws, r, c)));
    if (cells.some((t) => t.includes('ton dau ky'))) blockRow = r;
    if (cells.filter((t) => /binh ro|binh kiem|hop |vi |500|350/.test(t)).length >= 2) productRow = productRow || r;
  }
  if (!blockRow || !productRow) {
    warnings.push(`Sheet "${sheetName}": không đọc được tiêu đề tồn kho`);
    continue;
  }
  const columns = [];
  let current = '';
  for (let c = 1; c <= Math.min(ws.columnCount, 24); c++) {
    const label = fold(text(ws, blockRow, c));
    if (label.includes('ton dau ky')) current = 'opening';
    else if (label === 'nhap') current = 'in';
    else if (label === 'xuat') current = 'out';
    else if (label.includes('ton cuoi')) current = 'closing';
    if (!current || current === 'closing' || current === 'opening') continue;
    const productLabel = text(ws, productRow, c);
    if (!productLabel) continue;
    const entry = STOCK_PRODUCT.find(([re]) => re.test(fold(productLabel)));
    if (!entry) continue;
    columns.push({ col: c, kind: current, code: entry[1] });
  }
  if (!columns.length) {
    warnings.push(`Sheet "${sheetName}": không nhận ra mặt hàng nào`);
    continue;
  }
  const whId = W(whCode);
  let rowsUsed = 0;
  for (let r = Math.max(blockRow, productRow) + 1; r <= ws.rowCount; r++) {
    const date = parseDateCell(ws.getRow(r).getCell(2));
    if (!date || date <= '2026-09-28') continue;
    rowsUsed++;
    for (const column of columns) {
      const product = productByCode.get(column.code);
      if (!product) continue;
      const pid = Number(product.id);
      const qty = num(ws, r, column.col);
      if (!qty) continue;
      const key = `${whId}-${pid}`;
      if (column.kind === 'in') {
        inventory.set(key, (inventory.get(key) ?? 0) + qty);
        inventoryLast.set(key, date);
        stockMovements.push({
          id: ++stockMovementId,
          movement_type: 'IMPORT',
          target_warehouse_id: whId,
          source_id: camPhaSourceId,
          product_id: pid,
          quantity: qty,
          quantity_promo: 0,
          reference_id: `T10-${date}`,
          note: `Nhập kho theo sổ T10 ngày ${date} — ${sheetName} (hàng Cẩm Phả chở về kho)`,
          created_at: `${date} 00:00:00`,
        });
      } else {
        inventory.set(key, (inventory.get(key) ?? 0) - qty);
        inventoryLast.set(key, date);
        stockMovements.push({
          id: ++stockMovementId,
          movement_type: 'EXPORT_ORDER',
          source_warehouse_id: whId,
          product_id: pid,
          quantity: qty,
          quantity_promo: 0,
          reference_id: `T10-${date}`,
          note: `Xuất kho theo sổ T10 ngày ${date} — ${sheetName}`,
          created_at: `${date} 00:00:00`,
        });
      }
    }
  }
  stockNote.push(`${sheetName} → ${whCode}: ${rowsUsed} ngày, ${columns.length} cột mặt hàng`);
}
console.log('Bút toán kho:', stockMovements.length);

const inventoryRows = [...inventory.entries()].map(([key, quantity], index) => {
  const [warehouse_id, product_id] = key.split('-').map(Number);
  return {
    id: index + 1,
    warehouse_id,
    product_id,
    quantity,
    min_stock_alert: 20,
    avg_daily_sales: 5,
    last_updated: inventoryLast.get(key) ?? '2026-09-28',
  };
});
console.log('Dòng tồn kho:', inventoryRows.length);
for (const n of stockNote) console.log('  ' + n);

// ---------- ghi ra tệp đúng định dạng sao lưu ----------
function fill(workbook, name, rows) {
  const ws = workbook.getWorksheet(name);
  if (!ws) return 0;
  const header = (ws.getRow(1).values || []).slice(1).map((h) => String(h ?? '').trim());
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  for (let r = ws.rowCount; r >= 2; r--) ws.spliceRows(r, 1);
  for (const row of rows) {
    ws.addRow(
      header.map((h) => {
        // Giữ ngày đã gán cho bút toán kho (để sổ kho/nhật ký đúng ngày 28/9 → 5/10);
        // các bảng khác không tự đặt created_at thì lấy thời điểm nhập.
        if (h === 'created_at') return row[h] ?? now;
        return row[h] ?? null;
      })
    );
  }
  return rows.length;
}
fill(tpl, 'customers', customers);
fill(tpl, 'employees', employees);
fill(tpl, 'products', productSheet.rows);
fill(tpl, 'orders', orders);
fill(tpl, 'order_items', orderItems);
fill(tpl, 'stock_movements', stockMovements);
fill(tpl, 'inventory_stock', inventoryRows);
fill(tpl, 'partner_units', partnerSheet.rows);
fill(tpl, 'import_sources', importSourceSheet.rows);

// ---------- sheet rà soát ----------
{
  const notes = [];
  notes.push(['TỔNG HỢP', '', '']);
  notes.push(['Số đơn hàng', String(orders.length), '']);
  {
    const byType = {};
    for (const o of orders) byType[o.order_type] = (byType[o.order_type] ?? 0) + 1;
    notes.push(['  Đơn bán (SALE)', String(byType.SALE ?? 0), '']);
    notes.push(['  Đơn cho mượn (LEND_OUT)', String(byType.LEND_OUT ?? 0), '']);
    notes.push(['  Đơn mượn đối tác (BORROW_IN)', String(byType.BORROW_IN ?? 0), '']);
    const byStatus = {};
    for (const o of orders) byStatus[o.order_status] = (byStatus[o.order_status] ?? 0) + 1;
    notes.push(['  Hoàn tất', String(byStatus.COMPLETED ?? 0), '']);
    notes.push(['  Đang giao', String(byStatus.SHIPPING ?? 0), '']);
  }
  notes.push(['Số khách hàng', String(customers.length), '']);
  notes.push(['Số nhân viên', String(employees.length), '']);
  notes.push(['Đối tác thêm mới', newPartners.join(', ') || '(không thêm)', '']);
  notes.push(['Nguồn nhập Cẩm Phả', String(camPhaSourceId), '']);
  notes.push(['', '', '']);
  notes.push(['TỒN ĐẦU KỲ 28/9/2026', '', '']);
  for (const line of openingSummary) notes.push(['', line, '']);
  notes.push(['', '', '']);
  notes.push(['KHO KHÔNG NHẬN RA (đã tạm xếp vào kho Tăng Áp)', '', '']);
  for (const [name, count] of [...unmappedWarehouses.entries()].sort((a, b) => b[1] - a[1])) {
    notes.push(['', name, `${count} dòng`]);
  }
  notes.push(['', '', '']);
  notes.push(['DÒNG CẦN KIỂM', '', '']);
  for (const w of warnings) notes.push(['', w, '']);
  notes.push(['', '', '']);
  notes.push(['LƯU Ý', '', '']);
  notes.push(['', 'Số của sheet "nhập từ CP" trùng với cột NHẬP trong các sheet kho từng ngày nên bút toán đã gộp ở đó (không cộng đôi).', '']);
  notes.push(['', 'Khối dòng từ 91 trở xuống trong sheet XUẤT bị bỏ qua theo yêu cầu.', '']);
  notes.push(['', 'Sổ quỹ / phiếu kho tự sinh không có trong tệp này — dùng định dạng "Mẫu nhập đơn hàng" nếu cần chạy đúng nghiệp vụ.', '']);
  notes.push(['', '', '']);
  notes.push(['DANH SÁCH KHÁCH ĐÃ TÁCH TỪ MÔ TẢ (sửa lại trong phần mềm nếu cần)', '', '']);
  for (const c of customers) notes.push([c.code, c.name, c.address === 'Chưa rõ' ? '' : c.address]);

  const ws = tpl.addWorksheet('CAN_XAC_NHAN');
  ws.addRow(['Mục', 'Chi tiết', 'Số lượng']);
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 100;
  ws.getColumn(3).width = 12;
  for (const n of notes) ws.addRow(n);
}

await tpl.xlsx.writeFile(OUT);
console.log('Đã ghi:', OUT);
console.log('Cảnh báo:', warnings.length);
for (const w of warnings.slice(0, 20)) console.log('  -', w);
