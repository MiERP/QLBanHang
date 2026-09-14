/**
 * QAROMI ERP — DEMO theo KIẾN TRÚC ODOO
 * Lõi kế thừa Odoo: location / stock.move (bút toán kép) / stock.picking (chứng từ) / stock.quant,
 * uom (quy đổi Vỉ–Hộp–Chai), pricelist, delivery.carrier + delivery.price.rule, CRM stage.
 * Phần tùy biến xí nghiệp: kênh doanh thu, nhiều người/lượt giao, sổ nợ vỏ, DVGT, KPI kế hoạch năm.
 *
 * Chạy:  node demo/server.cjs     →  http://127.0.0.1:4390
 */
const path = require('path');
const fs = require('fs');
const express = require(path.join(__dirname, '..', 'node_modules', 'express'));
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
const ExcelJS = require(path.join(__dirname, '..', 'node_modules', 'exceljs'));

const EXCEL_DIR = path.join(__dirname, '..', 'excel');
const DB_PATH = path.join(__dirname, 'qaromi_demo.db');
const PORT = Number(process.env.PORT || 4390);
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ══════════════════════════ helpers parse Excel ══════════════════════════ */
function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') { if (v.result !== undefined && v.result !== null) return toNum(v.result); return 0; }
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function toStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.text !== undefined) return v.text;
    if (v.result !== undefined && v.result !== null) return String(v.result);
    return '';
  }
  return String(v).trim();
}
function toDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}
const cell = (row, n) => row.getCell(n).value;
const readBook = async f => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(EXCEL_DIR, f)); return wb; };

/* ══════════════════════════ DANH MỤC CHUẨN (như master data Odoo) ══════════════════════════ */
// UoM: 1 Hộp = 4 Vỉ = 24 Chai (chỉ để ĐỔI ĐƠN VỊ, không dùng để suy giá)
const UOMS = [
  { id: 1, name: 'Chai', category: 'CHAI', factor: 1 },
  { id: 2, name: 'Vỉ', category: 'CHAI', factor: 6 },
  { id: 3, name: 'Hộp', category: 'CHAI', factor: 24 },
  { id: 4, name: 'Bình', category: 'BINH', factor: 1 },
];
const PRODUCTS = [
  { code: 'VI_500', name: 'Nước chai QAROMI 500ml — Vỉ 6 chai', uom: 2, price: 98000, tracks_shell: 0 },
  { code: 'VI_350', name: 'Nước chai QAROMI 350ml — Vỉ 6 chai', uom: 2, price: 85000, tracks_shell: 0 },
  { code: 'HOP_500', name: 'Nước chai QAROMI 500ml — Hộp 24 chai', uom: 3, price: 106000, tracks_shell: 0 },
  { code: 'HOP_350', name: 'Nước chai QAROMI 350ml — Hộp 24 chai', uom: 3, price: 93000, tracks_shell: 0 },
  { code: 'KIEM_19L', name: 'Nước ion kiềm QAROMI 19L', uom: 4, price: 52000, tracks_shell: 1 },
  { code: 'RO_19L', name: 'Nước tinh khiết RO QAROMI 19L', uom: 4, price: 48000, tracks_shell: 1 },
];
const LOCS = [
  { id: 1, code: 'TANGAP', name: 'Kho Tăng Áp', usage: 'internal' },
  { id: 2, code: 'HUE', name: 'Kho Huế', usage: 'internal' },
  { id: 3, code: 'LAILAN', name: 'Kho Lại Lan', usage: 'internal' },
  { id: 4, code: 'VP', name: 'Kho Văn Phòng', usage: 'internal' },
  { id: 5, code: 'DATRANG', name: 'Kho Đá Trắng', usage: 'internal' },
  { id: 6, code: 'XEDIEN', name: 'Xe tải điện (kho lưu động)', usage: 'transit' },
  { id: 100, code: 'NCC_CP', name: 'Nhà máy / XN Cẩm Phả', usage: 'supplier' },
  { id: 200, code: 'CUSTOMER', name: 'Khách hàng', usage: 'customer' },
  { id: 300, code: 'INVENTORY', name: 'Kiểm kê / hao hụt', usage: 'inventory' },
];
const QTY_COLS = { 16: 'VI_500', 17: 'VI_350', 18: 'HOP_500', 19: 'HOP_350', 20: 'KIEM_19L', 21: 'RO_19L' };
function detectProduct(label) {
  const s = toStr(label).toLowerCase();
  if (!s) return null;
  if (s.includes('kiềm') || s.includes('kiem') || s.includes('ion')) return 'KIEM_19L';
  if (s.includes('ro')) return 'RO_19L';
  if (s.includes('350')) return (s.includes('hộp') || s.includes('thùng') || s.includes('hop')) ? 'HOP_350' : 'VI_350';
  if (s.includes('500')) return (s.includes('hộp') || s.includes('thùng') || s.includes('hop')) ? 'HOP_500' : 'VI_500';
  if (s.includes('hộp') || s.includes('thùng')) return 'HOP_500';
  return null;
}
const CHANNELS = [
  { code: 'XN', name: 'Xí nghiệp', counts_for_kpi: 1 },
  { code: 'CTY', name: 'Công ty (đơn vị bạn)', counts_for_kpi: 0 },
  { code: 'BC', name: 'Bãi Cháy', counts_for_kpi: 0 },
  { code: 'MD', name: 'Miền Đông', counts_for_kpi: 0 },
  { code: 'DV', name: 'Diễn Vọng', counts_for_kpi: 0 },
  { code: 'QY', name: 'Quảng Yên', counts_for_kpi: 0 },
  { code: 'NB', name: 'Nội bộ công ty', counts_for_kpi: 0 },
];
function detectChannel(l) {
  const s = toStr(l).toLowerCase();
  if (s.includes('bãi cháy') || s.includes('bai chay')) return 'BC';
  if (s.includes('miền đông') || s.includes('mien dong')) return 'MD';
  if (s.includes('diễn vọng') || s.includes('dien vong')) return 'DV';
  if (s.includes('quảng yên') || s.includes('quang yen')) return 'QY';
  if (s.includes('nội bộ')) return 'NB';
  if (s.includes('công ty') || s.includes('cty')) return 'CTY';
  return 'XN';
}
function detectWh(l) {
  const s = toStr(l).toLowerCase();
  if (s.includes('hồng gai')) return 'VP';
  if (s.includes('tăng áp')) return 'TANGAP';
  if (s.includes('huế')) return 'HUE';
  if (s.includes('lại lan')) return 'LAILAN';
  if (s.includes('đá trắng')) return 'DATRANG';
  if (s.includes('xe')) return 'XEDIEN';
  if (s.includes('hà lầm')) return 'TANGAP';
  return 'VP';
}
const splitPeople = s => toStr(s).split(/[+,\n\/]|(?: và )/i).map(x => x.trim()).filter(x => x.length > 1);

/* ══════════════════════════ Đọc 3 file Excel ══════════════════════════ */
function parseOrders(ws) {
  const out = [];
  for (let r = 6; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const desc = toStr(cell(row, 3));
    const prodLabel = toStr(cell(row, 15));
    const hasQty = [16, 17, 18, 19, 20, 21].some(n => toNum(cell(row, n)) > 0);
    if (!desc && !prodLabel && !hasQty) continue;
    let code = detectProduct(prodLabel);
    const colFor = { VI_500: 16, VI_350: 17, HOP_500: 18, HOP_350: 19, KIEM_19L: 20, RO_19L: 21 };
    if (!code) { for (const n of [16, 17, 18, 19, 20, 21]) if (toNum(cell(row, n)) > 0) { code = QTY_COLS[n]; break; } }
    let qty = code ? toNum(cell(row, colFor[code])) : 0;
    if (!qty) qty = Math.max(0, ...[16, 17, 18, 19, 20, 21].map(n => toNum(cell(row, n))));
    const product = PRODUCTS.find(p => p.code === code) || PRODUCTS[0];
    const price = toNum(cell(row, 24)) || product.price;
    const carriers = splitPeople(cell(row, 27));
    let fee = toNum(cell(row, 28)); if (!fee && carriers.length) fee = Math.round(qty * 5000);
    out.push({
      date: toDate(cell(row, 2)) || '2026-09-07', description: desc || 'Lượt giao',
      work_type: toStr(cell(row, 4)) || 'Vận chuyển', warehouse: detectWh(cell(row, 5)),
      channel: detectChannel(cell(row, 13)), seller: toStr(cell(row, 14)),
      product: product.code, qty, promo_qty: toNum(cell(row, 22)), price, revenue: toNum(cell(row, 25)) || qty * price,
      performers: splitPeople(cell(row, 10)), support: toStr(cell(row, 11)), carriers, fee,
      result: toStr(cell(row, 12)) || 'Đã hoàn thành', collection_note: toStr(cell(row, 26)), note: toStr(cell(row, 29)),
    });
  }
  return out;
}
function parseStockByWh(ws, from) {
  const cols = { RO_19L: 4, KIEM_19L: 5, HOP_500: 6, VI_500: 7, VI_350: 8 };
  const out = [];
  for (let r = from; r <= ws.rowCount; r++) {
    const row = ws.getRow(r); const name = toStr(cell(row, 3)); if (!name) continue;
    const qty = {}; for (const [c, n] of Object.entries(cols)) { const v = toNum(cell(row, n)); if (v) qty[c] = v; }
    out.push({ warehouse_name: name, qty });
  }
  return out;
}
function parseShell(ws, period) {
  const out = [];
  for (let r = 6; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const subject = toStr(cell(row, 1)); const customer = toStr(cell(row, 2));
    if (!subject && !customer) continue;
    const rec = {
      period, subject, customer, phone: toStr(cell(row, 3)),
      opening_up: toNum(cell(row, 4)), opening_voi: toNum(cell(row, 5)),
      in_up: toNum(cell(row, 6)), in_voi: toNum(cell(row, 7)),
      returned_up: toNum(cell(row, 8)), returned_voi: toNum(cell(row, 9)),
      closing_up: toNum(cell(row, 10)), closing_voi: toNum(cell(row, 11)),
      xn_up: toNum(cell(row, 12)), xn_voi: toNum(cell(row, 13)),
      deposit: toNum(cell(row, 14)), note: toStr(cell(row, 15)),
    };
    if (!['opening_up','opening_voi','in_up','in_voi','returned_up','returned_voi','closing_up','closing_voi','xn_up','xn_voi','deposit'].some(k => rec[k] > 0) && !rec.note) continue;
    out.push(rec);
  }
  return out;
}
function parseShellHolders(ws) {
  const holders = new Map(); const balances = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r); const name = toStr(cell(row, 3)); if (!name) continue;
    const taken = toNum(cell(row, 4)), ret = toNum(cell(row, 5)), debt = toNum(cell(row, 7));
    if (name.startsWith('Tồn kho ')) { balances.push({ name: name.replace('Tồn kho ', ''), qty: taken || ret }); continue; }
    if (['Tổng cộng', 'Tổng nợ', 'Nợ cũ', 'Tổng'].includes(name)) continue;
    const cur = holders.get(name) || { name, taken: 0, returned: 0, debt: 0 };
    cur.taken += taken; cur.returned += ret; cur.debt += debt; holders.set(name, cur);
  }
  return { holders: [...holders.values()].filter(h => h.taken || h.returned || h.debt), balances };
}
function parseDvgt(ws, mode) {
  const out = [];
  const start = mode === 'thu' ? 1 : 4;
  for (let r = start; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const desc = toStr(cell(row, 2)); const referrer = toStr(cell(row, 3));
    if (!desc && !referrer) continue;
    const svc = mode === 'thu' ? (toStr(cell(row, 8)) || toStr(cell(row, 9))) : toStr(cell(row, 11));
    if (!svc && !desc) continue;
    out.push({
      date: toDate(cell(row, 1)), description: desc, referrer,
      state: toStr(cell(row, 4)), doc_status: mode === 'thu' ? toStr(cell(row, 5)) : toStr(cell(row, 7)),
      customer: mode === 'thu' ? toStr(cell(row, 6)) : (toStr(cell(row, 8)) || toStr(cell(row, 6))),
      phone: mode === 'thu' ? toStr(cell(row, 7)) : (toStr(cell(row, 10)) || toStr(cell(row, 9))),
      service: svc, scheduled: toStr(cell(row, mode === 'thu' ? 10 : 12)),
      revenue: toNum(cell(row, mode === 'thu' ? 11 : 13)),
    });
  }
  return out;
}
function parseKpi(ws) {
  const plan = { year: 2026, target: 1592834000, headcount: 202 };
  const employees = [];
  for (let r = 14; r <= ws.rowCount; r++) {
    const row = ws.getRow(r); const name = toStr(cell(row, 2)); if (!name) continue;
    const monthly = []; for (let c = 5; c <= 16; c++) monthly.push(toNum(cell(row, c)));
    employees.push({ name, position: toStr(cell(row, 3)), station: toStr(cell(row, 4)), monthly, total: toNum(cell(row, 17)) || monthly.reduce((a, b) => a + b, 0) });
  }
  return { plan, employees };
}

async function buildSeed() {
  const seed = { orders: [], quants: [], shells: [], holders: [], balances: [], dvgt: [], kpi: { plan: {}, employees: [] } };
  const wb3 = await readBook('ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa.xlsx');
  seed.orders = parseOrders(wb3.getWorksheet('XUẤT'));
  seed.quants = parseStockByWh(wb3.getWorksheet('TỒN TỔNG'), 3);
  const wb2 = await readBook('XNT T9.hương -Nhung.xlsx');
  seed.shells = [...parseShell(wb2.getWorksheet('VB T9'), 'T9'), ...parseShell(wb2.getWorksheet('VB T8'), 'T8')];
  const h = parseShellHolders(wb2.getWorksheet('Theo dõi vỏ bình'));
  seed.holders = h.holders; seed.balances = h.balances;
  const wb1 = await readBook('THEO DÕI CHỈ TIÊU DVGT CBCNV.xlsx');
  seed.dvgt = [...parseDvgt(wb1.getWorksheet('Thư'), 'thu'), ...parseDvgt(wb1.getWorksheet('ban cu Nhung'), 'old')];
  seed.kpi = parseKpi(wb1.getWorksheet('XN'));
  return seed;
}

/* ══════════════════════════ DB ══════════════════════════ */
function initDb(seed) {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE uom(id INTEGER PRIMARY KEY, name TEXT, category TEXT, factor REAL);
    CREATE TABLE product(code TEXT PRIMARY KEY, name TEXT, uom_id INT, price REAL, tracks_shell INT, type TEXT DEFAULT 'consu');
    CREATE TABLE location(id INTEGER PRIMARY KEY, code TEXT, name TEXT, usage TEXT);
    CREATE TABLE warehouse(code TEXT PRIMARY KEY, name TEXT, stock_location_id INT);
    CREATE TABLE route(id INTEGER PRIMARY KEY, name TEXT, rule TEXT);
    CREATE TABLE channel(code TEXT PRIMARY KEY, name TEXT, counts_for_kpi INT);
    CREATE TABLE partner(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, address TEXT, is_company INT DEFAULT 0, customer_rank INT DEFAULT 0, supplier_rank INT DEFAULT 0, is_branch INT DEFAULT 0);
    CREATE TABLE pricelist(id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE pricelist_item(id INTEGER PRIMARY KEY, pricelist_id INT, applied_on TEXT, product_code TEXT, min_qty REAL, compute_price TEXT, fixed_price REAL, percent REAL);
    CREATE TABLE carrier(id INTEGER PRIMARY KEY, name TEXT, delivery_type TEXT, product_code TEXT, margin REAL, fixed_margin REAL, free_over INT, amount REAL, note TEXT);
    CREATE TABLE carrier_rule(id INTEGER PRIMARY KEY, carrier_id INT, variable TEXT, operator TEXT, max_value REAL, base_price REAL, rate REAL, factor TEXT);
    CREATE TABLE crm_stage(id INTEGER PRIMARY KEY, name TEXT, sequence INT, is_won INT DEFAULT 0);
    CREATE TABLE crm_lead(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT DEFAULT 'opportunity', stage_id INT, probability REAL DEFAULT 10, expected_revenue REAL DEFAULT 0,
      partner_name TEXT, phone TEXT, address TEXT, source TEXT, referrer TEXT, service TEXT, scheduled TEXT, doc_status TEXT, note TEXT, active INT DEFAULT 1);
    CREATE TABLE sale_order(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, partner_id INT, channel_code TEXT, warehouse_code TEXT, pricelist_id INT,
      state TEXT DEFAULT 'draft', date TEXT, seller TEXT, carrier_id INT, collection_note TEXT, note TEXT, work_type TEXT,
      seller_note TEXT, amount_untaxed REAL DEFAULT 0, amount_total REAL DEFAULT 0, paid_amount REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sale_order_line(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INT, product_code TEXT, uom_id INT, qty REAL, promo_qty REAL DEFAULT 0,
      price_unit REAL, discount REAL DEFAULT 0, qty_delivered REAL DEFAULT 0, shell_type TEXT, note TEXT);
    CREATE TABLE stock_picking(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type_code TEXT, src_location_id INT, dest_location_id INT,
      partner_id INT, origin TEXT, state TEXT DEFAULT 'draft', scheduled_date TEXT, date_done TEXT, sale_id INT, carrier_id INT, carrier_price REAL DEFAULT 0, note TEXT);
    CREATE TABLE stock_move(id INTEGER PRIMARY KEY AUTOINCREMENT, picking_id INT, product_code TEXT, uom_id INT, qty REAL, promo_qty REAL DEFAULT 0,
      src_location_id INT, dest_location_id INT, state TEXT DEFAULT 'draft', sale_line_id INT, is_promo INT DEFAULT 0);
    CREATE TABLE stock_quant(id INTEGER PRIMARY KEY AUTOINCREMENT, product_code TEXT, location_id INT, quantity REAL DEFAULT 0, reserved REAL DEFAULT 0);
    CREATE TABLE delivery_worker(id INTEGER PRIMARY KEY AUTOINCREMENT, picking_id INT, role TEXT, employee TEXT, fee_share REAL DEFAULT 0);
    CREATE TABLE shell_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT, period TEXT, subject TEXT, customer TEXT, phone TEXT,
      opening_up REAL, opening_voi REAL, in_up REAL, in_voi REAL, returned_up REAL, returned_voi REAL,
      closing_up REAL, closing_voi REAL, xn_up REAL, xn_voi REAL, deposit REAL, note TEXT,
      last_in_date TEXT, last_return_date TEXT);
    CREATE TABLE shell_movement(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, subject TEXT, customer TEXT,
      kind TEXT, up REAL DEFAULT 0, voi REAL DEFAULT 0, note TEXT);
    CREATE TABLE shell_holder(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, taken REAL, returned REAL, debt REAL);
    CREATE TABLE shell_balance(id INTEGER PRIMARY KEY AUTOINCREMENT, warehouse_name TEXT, qty REAL);
    CREATE TABLE dvgt(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, customer TEXT, phone TEXT, service TEXT, referrer TEXT, channel TEXT,
      state TEXT, doc_status TEXT, scheduled TEXT, revenue REAL, description TEXT);
    CREATE TABLE kpi_plan(id INTEGER PRIMARY KEY AUTOINCREMENT, year INT, target REAL, headcount INT);
    CREATE TABLE kpi_employee(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, position TEXT, station TEXT, total REAL, monthly TEXT);
    CREATE TABLE activity(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT DEFAULT CURRENT_TIMESTAMP, kind TEXT, message TEXT);
  `);

  const I = (t, cols) => db.prepare(`INSERT INTO ${t}(${cols}) VALUES (${cols.split(',').map(() => '?').join(',')})`);
  for (const u of UOMS) I('uom', 'id,name,category,factor').run(u.id, u.name, u.category, u.factor);
  for (const p of PRODUCTS) I('product', 'code,name,uom_id,price,tracks_shell').run(p.code, p.name, p.uom, p.price, p.tracks_shell);
  for (const l of LOCS) I('location', 'id,code,name,usage').run(l.id, l.code, l.name, l.usage);
  const WHS = [['TANGAP', 'Kho Tăng Áp', 1], ['HUE', 'Kho Huế', 2], ['LAILAN', 'Kho Lại Lan', 3], ['VP', 'Kho Văn Phòng', 4], ['DATRANG', 'Kho Đá Trắng', 5], ['XEDIEN', 'Xe tải điện', 6]];
  for (const w of WHS) I('warehouse', 'code,name,stock_location_id').run(w[0], w[1], w[2]);
  I('route', 'id,name,rule').run(1, 'Nhận hàng (Cẩm Phả → kho)', 'pull: supplier → internal');
  I('route', 'id,name,rule').run(2, 'Giao hàng (kho → khách)', 'pull: internal → customer');
  I('route', 'id,name,rule').run(3, 'Bổ sung kho bán (Tăng Áp → Huế/Lại Lan)', 'pull: internal → internal');
  I('route', 'id,name,rule').run(4, 'Xuất lên xe tải điện', 'pull: internal → transit');
  for (const c of CHANNELS) I('channel', 'code,name,counts_for_kpi').run(c.code, c.name, c.counts_for_kpi);
  I('pricelist', 'id,name').run(1, 'Bảng giá QAROMI 09/2026');
  for (const p of PRODUCTS) I('pricelist_item', 'pricelist_id,applied_on,product_code,min_qty,compute_price,fixed_price,percent').run(1, 'product', p.code, 1, 'fixed', p.price, 0);
  I('pricelist_item', 'pricelist_id,applied_on,product_code,min_qty,compute_price,fixed_price,percent').run(1, 'product', 'VI_500', 50, 'percent', 0, 5);
  I('carrier', 'id,name,delivery_type,product_code,margin,fixed_margin,free_over,amount,note').run(1, 'Giao hàng tiêu chuẩn', 'base_on_rule', null, 0, 0, 0, 0, 'Phí 5.000đ/đơn vị theo số lượng');
  I('carrier_rule', 'carrier_id,variable,operator,max_value,base_price,rate,factor').run(1, 'quantity', '>=', 1, 0, 5000, 'quantity');
  I('carrier', 'id,name,delivery_type,product_code,margin,fixed_margin,free_over,amount,note').run(2, 'Xe tải điện (theo chuyến)', 'fixed', null, 0.1, 0, 0, 0, 'Giá cố định + phụ phí 10%');
  const STAGES = [['Mới', 1, 0], ['Đã liên hệ', 2, 0], ['Báo giá', 3, 0], ['Đã chốt (Thắng)', 4, 1], ['Thua', 5, 0]];
  for (const s of STAGES) I('crm_stage', 'name,sequence,is_won').run(s[0], s[1], s[2]);

  // partners từ đơn hàng + DVGT
  const partnerNames = new Set(['Khách lẻ', 'Công ty Công nghiệp Hóa chất mỏ Quảng Ninh', 'Văn Phòng Ủy ban nhân dân tỉnh Quảng Ninh']);
  const ord = I('sale_order', 'name,partner_id,channel_code,warehouse_code,pricelist_id,state,date,seller,carrier_id,collection_note,note,work_type,amount_untaxed,amount_total,paid_amount');
  const ordLine = I('sale_order_line', 'order_id,product_code,uom_id,qty,promo_qty,price_unit,discount,qty_delivered,shell_type');
  const pick = I('stock_picking', 'name,type_code,src_location_id,dest_location_id,partner_id,origin,state,scheduled_date,date_done,sale_id,carrier_id,carrier_price');
  const move = I('stock_move', 'picking_id,product_code,uom_id,qty,promo_qty,src_location_id,dest_location_id,state,sale_line_id');
  const worker = I('delivery_worker', 'picking_id,role,employee,fee_share');
  const locByCode = Object.fromEntries(LOCS.map(l => [l.code, l.id]));

  let pid = 0;
  const getPartner = (name) => {
    const n = (name || 'Khách lẻ').trim() || 'Khách lẻ';
    const found = db.prepare('SELECT * FROM partner WHERE name=?').get(n);
    if (found) return found.id;
    const id = I('partner', 'name,phone,address,is_company,customer_rank,supplier_rank,is_branch').run(n, '', '', 0, 1, 0, 0).lastInsertRowid;
    return id;
  };
  // nhà cung cấp Cẩm Phả
  I('partner', 'name,phone,address,is_company,customer_rank,supplier_rank,is_branch').run('XN Nước Cẩm Phả', '', 'Cẩm Phả', 1, 0, 1, 1);

  let seq = 1;
  for (const o of seed.orders) {
    const partnerId = getPartner(o.seller || o.description.slice(0, 40) || 'Khách lẻ');
    const name = 'SO' + String(seq).padStart(4, '0');
    // đơn ghi nợ/vay coi như chưa thu — để màn "công nợ" có dữ liệu thật để trình bày
    const paid = /vay/i.test(o.note || '') ? 0 : o.revenue;
    const oid = ord.run(name, partnerId, o.channel, o.warehouse, 1, 'done', o.date, o.seller, 1, o.collection_note, o.note, o.work_type, o.revenue, o.revenue, paid).lastInsertRowid;
    const uomId = (PRODUCTS.find(p => p.code === o.product) || {}).uom || 2;
    const lid = ordLine.run(oid, o.product, uomId, o.qty, o.promo_qty, o.price, 0, o.qty, null).lastInsertRowid;
    // chứng từ giao đã hoàn tất (lịch sử)
    const pidk = pick.run('WH/OUT/' + String(seq).padStart(4, '0'), 'outgoing', locByCode[o.warehouse] || 1, 200, partnerId, name, 'done', o.date, o.date, oid, 1, o.fee).lastInsertRowid;
    move.run(pidk, o.product, uomId, o.qty, o.promo_qty, locByCode[o.warehouse] || 1, 200, 'done', lid);
    const carriers = o.carriers.length ? o.carriers : ['(chưa gán)'];
    const share = Math.round((o.fee || 0) / carriers.length);
    for (const c of carriers) worker.run(pidk, 'CARRIER', c, share);
    for (const p of o.performers) worker.run(pidk, 'PERFORMER', p, 0);
    pid = partnerId; seq++;
  }
  // tồn kho hiện tại
  const quant = I('stock_quant', 'product_code,location_id,quantity,reserved');
  for (const rec of seed.quants) {
    const locId = locByCode[detectWh(rec.warehouse_name)] || 1;
    for (const [code, q] of Object.entries(rec.qty || {})) quant.run(code, locId, q, 0);
  }
  for (const s of seed.shells) I('shell_ledger', 'period,subject,customer,phone,opening_up,opening_voi,in_up,in_voi,returned_up,returned_voi,closing_up,closing_voi,xn_up,xn_voi,deposit,note')
    .run(s.period, s.subject, s.customer, s.phone, s.opening_up, s.opening_voi, s.in_up, s.in_voi, s.returned_up, s.returned_voi, s.closing_up, s.closing_voi, s.xn_up, s.xn_voi, s.deposit, s.note);
  // ngày phát sinh nợ vỏ theo kỳ (để màn hình trả lời "nợ từ khi nào")
  db.prepare("UPDATE shell_ledger SET last_in_date = CASE WHEN period='T9' THEN '2026-09-07' ELSE '2026-08-28' END WHERE (opening_up+opening_voi+in_up+in_voi) > 0 AND last_in_date IS NULL").run();
  db.prepare("UPDATE shell_ledger SET last_return_date = CASE WHEN period='T9' THEN '2026-09-12' ELSE '2026-08-30' END WHERE (returned_up+returned_voi) > 0 AND last_return_date IS NULL").run();
  for (const h of seed.holders) I('shell_holder', 'name,taken,returned,debt').run(h.name, h.taken, h.returned, h.debt);
  for (const b of seed.balances) I('shell_balance', 'warehouse_name,qty').run(b.name, b.qty);
  for (const d of seed.dvgt) I('dvgt', 'date,customer,phone,service,referrer,channel,state,doc_status,scheduled,revenue,description')
    .run(d.date, d.customer, d.phone, d.service, d.referrer, '', d.state, d.doc_status, d.scheduled, d.revenue, d.description);
  I('kpi_plan', 'year,target,headcount').run(seed.kpi.plan.year || 2026, seed.kpi.plan.target || 1592834000, seed.kpi.plan.headcount || 202);
  for (const e of seed.kpi.employees) I('kpi_employee', 'name,position,station,total,monthly').run(e.name, e.position, e.station, e.total, JSON.stringify(e.monthly));

  // CRM: cơ hội từ khách lớn + dịch vụ
  const lead = I('crm_lead', 'name,type,stage_id,probability,expected_revenue,partner_name,phone,source,referrer,service,scheduled,doc_status,note');
  const bigCustomers = ['Công ty Công nghiệp Hóa chất mỏ Quảng Ninh', 'Văn Phòng Ủy ban nhân dân tỉnh Quảng Ninh', 'Ngân hàng SHB- cột 8', 'Công ty Hanet', 'Công ty du lịch Luxury'];
  for (const c of bigCustomers) lead.run('Nhu cầu nước định kỳ — ' + c, 'opportunity', 3, 50, 5000000, c, '', 'Giới thiệu', '', '', '', 'Chưa có phiếu', '');
  for (const d of seed.dvgt.slice(0, 40)) {
    if (!d.customer && !d.description) continue;
    lead.run((d.service || 'Dịch vụ') + ' — ' + (d.customer || d.description).slice(0, 50), 'opportunity', /hoàn thành|r$|done/i.test(d.state || '') ? 4 : 2, /hoàn thành|r$|done/i.test(d.state || '') ? 100 : 30, d.revenue || 0, d.customer || '', d.phone || '', 'Vận động', d.referrer || '', d.service || '', d.scheduled || '', d.doc_status || '', d.description || '');
  }
  I('activity', 'kind,message').run('seed', `Nạp từ Excel: ${seed.orders.length} đơn bán, ${seed.dvgt.length} DVGT, ${seed.kpi.employees.length} CBCNV`);

  db._partner = getPartner;
  return db;
}

/* ══════════════════════════ NGHIỆP VỤ (theo Odoo) ══════════════════════════ */
function makeService(db) {
  const uomById = Object.fromEntries(UOMS.map(u => [u.id, u]));
  const prodBy = Object.fromEntries(PRODUCTS.map(p => [p.code, p]));
  const locById = Object.fromEntries(LOCS.map(l => [l.id, l]));

  const convert = (qty, fromId, toId) => {
    const f = uomById[fromId], t = uomById[toId];
    if (!f || !t || f.category !== t.category) return null;
    return qty * f.factor / t.factor;
  };
  const getQuant = (code, locId) => db.prepare('SELECT * FROM stock_quant WHERE product_code=? AND location_id=?').get(code, locId);
  const addQuant = (code, locId, delta) => {
    const cur = getQuant(code, locId);
    if (cur) db.prepare('UPDATE stock_quant SET quantity=quantity+? WHERE id=?').run(delta, cur.id);
    else db.prepare('INSERT INTO stock_quant(product_code,location_id,quantity,reserved) VALUES (?,?,?,0)').run(code, locId, delta);
  };

  return {
    convert, getQuant, addQuant, prodBy, uomById, locById,

    /** Xác nhận đơn bán: sinh chứng từ giao + bút toán kho (giống Odoo procurement) */
    confirmOrder(orderId) {
      const order = db.prepare('SELECT * FROM sale_order WHERE id=?').get(orderId);
      if (!order) throw new Error('Không tìm thấy đơn');
      if (order.state !== 'draft' && order.state !== 'sent') throw new Error('Chỉ xác nhận được báo giá');
      const lines = db.prepare('SELECT * FROM sale_order_line WHERE order_id=?').all(orderId);
      if (!lines.length) throw new Error('Đơn chưa có dòng hàng');
      const wh = db.prepare('SELECT * FROM warehouse WHERE code=?').get(order.warehouse_code) || db.prepare('SELECT * FROM warehouse LIMIT 1').get();
      const srcLoc = wh.stock_location_id;
      const destLoc = db.prepare("SELECT id FROM location WHERE usage='customer'").get().id;
      const code = 'WH/OUT/' + String(Date.now()).slice(-6);
      const pickId = db.prepare('INSERT INTO stock_picking(name,type_code,src_location_id,dest_location_id,partner_id,origin,state,scheduled_date,sale_id,carrier_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(code, 'outgoing', srcLoc, destLoc, order.partner_id, order.name, 'assigned', order.date, orderId, order.carrier_id, '').lastInsertRowid;
      for (const l of lines) {
        const need = (l.qty || 0) + (l.promo_qty || 0);
        const stock = getQuant(l.product_code, srcLoc);
        const avail = stock ? stock.quantity - stock.reserved : 0;
        const state = avail >= need ? 'assigned' : (avail > 0 ? 'partially_available' : 'confirmed');
        db.prepare('INSERT INTO stock_move(picking_id,product_code,uom_id,qty,promo_qty,src_location_id,dest_location_id,state,sale_line_id) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(pickId, l.product_code, l.uom_id, l.qty, l.promo_qty, srcLoc, destLoc, state, l.id);
        if (avail >= need && stock) db.prepare('UPDATE stock_quant SET reserved=reserved+? WHERE id=?').run(need, stock.id);
      }
      const anyWaiting = db.prepare("SELECT COUNT(*) n FROM stock_move WHERE picking_id=? AND state<>'assigned'").get(pickId).n > 0;
      db.prepare('UPDATE stock_picking SET state=? WHERE id=?').run(anyWaiting ? 'confirmed' : 'assigned', pickId);
      db.prepare("UPDATE sale_order SET state='sale' WHERE id=?").run(orderId);
      db.prepare('INSERT INTO activity(kind,message) VALUES (?,?)').run('confirm', `Xác nhận ${order.name} → sinh phiếu giao ${code}`);
      return { picking_id: pickId, picking_name: code };
    },

    /** Xác nhận phiếu kho: ghi bút toán kép vào quant (giống stock.move._action_done) */
    validatePicking(pickId, opts = {}) {
      const pk = db.prepare('SELECT * FROM stock_picking WHERE id=?').get(pickId);
      if (!pk) throw new Error('Không tìm thấy phiếu');
      if (pk.state === 'done') throw new Error('Phiếu đã hoàn tất');
      const moves = db.prepare('SELECT * FROM stock_move WHERE picking_id=?').all(pickId);
      if (!moves.length) throw new Error('Phiếu chưa có dòng hàng');
      let shortage = false;
      for (const mv of moves) {
        const need = (mv.qty || 0) + (mv.promo_qty || 0);
        const stock = getQuant(mv.product_code, mv.src_location_id);
        const avail = stock ? stock.quantity : 0;
        if (pk.type_code !== 'incoming' && avail < need) { shortage = true; continue; }
        addQuant(mv.product_code, mv.src_location_id, -need);
        addQuant(mv.product_code, mv.dest_location_id, need);
        if (stock) db.prepare('UPDATE stock_quant SET reserved=MAX(0,reserved-?) WHERE id=?').run(need, stock.id);
        db.prepare("UPDATE stock_move SET state='done' WHERE id=?").run(mv.id);
      }
      if (shortage && !opts.force) throw new Error('Không đủ tồn kho — hãy nhập thêm hoặc bỏ qua thiếu hàng');
      db.prepare("UPDATE stock_picking SET state='done', date_done=? WHERE id=?").run(new Date().toISOString().slice(0, 10), pickId);
      // cập nhật dòng bán + trạng thái đơn
      if (pk.sale_id) {
        const dk = new Date().toISOString().slice(0, 10);
        for (const mv of moves) if (mv.sale_line_id) db.prepare('UPDATE sale_order_line SET qty_delivered=qty_delivered+? WHERE id=?').run(mv.qty, mv.sale_line_id);
        const remain = db.prepare('SELECT COUNT(*) n FROM sale_order_line WHERE order_id=? AND qty_delivered < qty').get(pk.sale_id).n;
        db.prepare('UPDATE sale_order SET state=? WHERE id=?').run(remain ? 'sale' : 'done', pk.sale_id);
        // nợ vỏ (tùy biến xí nghiệp)
        const order = db.prepare('SELECT * FROM sale_order WHERE id=?').get(pk.sale_id);
        for (const mv of moves) {
          const p = prodBy[mv.product_code];
          if (p && p.tracks_shell && mv.qty > 0) {
            const partner = db.prepare('SELECT * FROM partner WHERE id=?').get(order.partner_id);
            const subject = order.seller || (partner ? partner.name : 'Khách lẻ');
            const typ = (db.prepare('SELECT shell_type FROM sale_order_line WHERE id=?').get(mv.sale_line_id) || {}).shell_type === 'UP' ? 'up' : 'voi';
            let row = db.prepare("SELECT * FROM shell_ledger WHERE period='HT' AND subject=?").get(subject);
            if (!row) {
              db.prepare("INSERT INTO shell_ledger(period,subject,customer,phone,opening_up,opening_voi,in_up,in_voi,returned_up,returned_voi,closing_up,closing_voi,xn_up,xn_voi,deposit,note) VALUES ('HT',?,?,'',0,0,0,0,0,0,0,0,0,0,0,'')")
                .run(subject, partner ? partner.name : '');
              row = db.prepare("SELECT * FROM shell_ledger WHERE period='HT' AND subject=?").get(subject);
            }
            const col = typ === 'up' ? 'in_up' : 'in_voi', cl = typ === 'up' ? 'closing_up' : 'closing_voi';
            db.prepare(`UPDATE shell_ledger SET ${col}=${col}+?, ${cl}=${cl}+?, last_in_date=? WHERE id=?`).run(mv.qty, mv.qty, dk, row.id);
            db.prepare('INSERT INTO shell_movement(date,subject,customer,kind,up,voi,note) VALUES (?,?,?,?,?,?,?)')
              .run(dk, subject, partner ? partner.name : '', 'GIAO', typ === 'up' ? mv.qty : 0, typ === 'voi' ? mv.qty : 0, 'Giao bình theo đơn ' + order.name);
          }
        }
      }
      db.prepare('INSERT INTO activity(kind,message) VALUES (?,?)').run('validate', `Hoàn tất phiếu ${pk.name} — tồn kho đã cập nhật`);
      return { ok: true };
    },

    /** Tính cước theo delivery.price.rule (như Odoo base_on_rule) */
    rateCarrier(carrierId, lines) {
      const c = db.prepare('SELECT * FROM carrier WHERE id=?').get(carrierId);
      if (!c) return { price: 0, detail: 'Không có phương thức' };
      if (c.delivery_type === 'fixed') return { price: Math.round(100000 * (1 + c.margin)), detail: 'Giá cố định + phụ phí' };
      let quantity = 0, total = 0;
      for (const l of lines) {
        const q = Number(l.qty) || 0;
        quantity += q;
        total += q * (Number(l.price_unit) || (prodBy[l.product_code] || {}).price || 0);
      }
      const dict = { quantity, price: total, weight: quantity };
      for (const r of db.prepare('SELECT * FROM carrier_rule WHERE carrier_id=? ORDER BY id').all(carrierId)) {
        const v = dict[r.variable] || 0;
        const test = (r.operator === '>=' ? v >= r.max_value : r.operator === '>' ? v > r.max_value : r.operator === '<=' ? v <= r.max_value : r.operator === '<' ? v < r.max_value : v === r.max_value);
        if (test) {
          const price = (r.base_price || 0) + (r.rate || 0) * (dict[r.factor] || 0);
          return { price: Math.round(price * (1 + (c.margin || 0)) + (c.fixed_margin || 0)), detail: `if ${r.variable} ${r.operator} ${r.max_value} → ${r.base_price} + ${r.rate} × ${r.factor}` };
        }
      }
      return { price: 0, detail: 'Không khớp điều kiện' };
    },
  };
}

/* ══════════════════════════ SERVER ══════════════════════════ */
(async () => {
  console.log('[QAROMI demo] Đang đọc 3 file Excel và dựng mô hình Odoo...');
  const t0 = Date.now();
  const seed = await buildSeed();
  const db = initDb(seed);
  const svc = makeService(db);
  console.log(`[QAROMI demo] Sẵn sàng sau ${Date.now() - t0}ms.`);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const i = req.url.indexOf('/api/'); if (i > 0) req.url = req.url.slice(i); next(); });
  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'qaromi-demo-odoo', time: new Date().toISOString() }));

  const prodName = c => (svc.prodBy[c] || {}).name || c;
  const rich = rows => rows.map(r => ({ ...r, product_name: prodName(r.product_code || r.product), unit: (svc.uomById[r.uom_id] || {}).name || '' }));

  /* ── Bán hàng ── */
  app.get('/api/orders', (req, res) => {
    const rows = db.prepare(`SELECT o.*, p.name partner_name, c.name channel_name, c.counts_for_kpi,
      (SELECT COUNT(*) FROM sale_order_line l WHERE l.order_id=o.id) line_count,
      (SELECT COUNT(*) FROM stock_picking k WHERE k.sale_id=o.id) picking_count
      FROM sale_order o LEFT JOIN partner p ON p.id=o.partner_id LEFT JOIN channel c ON c.code=o.channel_code
      ORDER BY o.date DESC, o.id DESC`).all();
    res.json(rows);
  });
  app.get('/api/orders/:id', (req, res) => {
    const o = db.prepare(`SELECT o.*, p.name partner_name, c.name channel_name, c.counts_for_kpi FROM sale_order o
      LEFT JOIN partner p ON p.id=o.partner_id LEFT JOIN channel c ON c.code=o.channel_code WHERE o.id=?`).get(req.params.id);
    if (!o) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    const lines = rich(db.prepare('SELECT * FROM sale_order_line WHERE order_id=?').all(o.id));
    const pickings = db.prepare('SELECT * FROM stock_picking WHERE sale_id=?').all(o.id);
    const moves = rich(db.prepare('SELECT m.* FROM stock_move m JOIN stock_picking k ON k.id=m.picking_id WHERE k.sale_id=?').all(o.id));
    const workers = db.prepare('SELECT * FROM delivery_worker WHERE picking_id IN (SELECT id FROM stock_picking WHERE sale_id=?)').all(o.id);
    res.json({ order: o, lines, pickings, moves, workers });
  });
  app.post('/api/orders', (req, res) => {
    const b = req.body || {};
    const lines = (b.lines || []).filter(l => l.product_code && Number(l.qty) > 0);
    if (!lines.length) return res.status(400).json({ error: 'Cần ít nhất một dòng hàng' });
    const partnerName = (b.partner_name || '').trim();
    let partnerId;
    if (b.partner_id) partnerId = Number(b.partner_id);
    else if (partnerName) {
      const f = db.prepare('SELECT id FROM partner WHERE name=?').get(partnerName);
      partnerId = f ? f.id : db.prepare('INSERT INTO partner(name,phone,address,is_company,customer_rank,supplier_rank,is_branch) VALUES (?,?,?,0,1,0,0)').run(partnerName, '', '').lastInsertRowid;
    } else partnerId = (db.prepare('SELECT id FROM partner WHERE supplier_rank=0 ORDER BY id LIMIT 1').get() || db.prepare('SELECT id FROM partner LIMIT 1').get()).id;
    const seq = (db.prepare('SELECT COUNT(*) n FROM sale_order').get().n + 1);
    const name = 'SO' + String(seq).padStart(4, '0');
    let total = 0;
    for (const l of lines) {
      const p = svc.prodBy[l.product_code] || PRODUCTS[0];
      const price = Number(l.price_unit) || p.price;
      l.price_unit = price; total += price * (Number(l.qty) || 0);
    }
    const id = db.prepare('INSERT INTO sale_order(name,partner_id,channel_code,warehouse_code,pricelist_id,state,date,seller,carrier_id,collection_note,note,work_type,amount_untaxed,amount_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(name, partnerId, b.channel_code || 'XN', b.warehouse_code || 'TANGAP', 1, 'draft', b.date || new Date().toISOString().slice(0, 10),
        b.seller || '', b.carrier_id ? Number(b.carrier_id) : 1, b.collection_note || '', b.note || '', b.work_type || 'Vận chuyển', total, total).lastInsertRowid;
    const ins = db.prepare('INSERT INTO sale_order_line(order_id,product_code,uom_id,qty,promo_qty,price_unit,discount,shell_type) VALUES (?,?,?,?,?,?,0,?)');
    for (const l of lines) ins.run(id, l.product_code, (svc.prodBy[l.product_code] || {}).uom || 2, Number(l.qty) || 0, Number(l.promo_qty) || 0, l.price_unit, l.shell_type || null);
    res.json({ ok: true, id, name });
  });
  app.post('/api/orders/:id/confirm', (req, res) => {
    try { res.json({ ok: true, ...svc.confirmOrder(req.params.id) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/orders/:id/cancel', (req, res) => {
    const pk = db.prepare("SELECT * FROM stock_picking WHERE sale_id=? AND state<>'done'").all(req.params.id);
    for (const k of pk) { db.prepare("UPDATE stock_move SET state='cancel' WHERE picking_id=?").run(k.id); db.prepare("UPDATE stock_picking SET state='cancel' WHERE id=?").run(k.id); }
    db.prepare("UPDATE sale_order SET state='cancel' WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  /* ── Kho ── */
  app.get('/api/pickings', (req, res) => {
    res.json(db.prepare(`SELECT k.*, l1.name src_name, l2.name dest_name, p.name partner_name,
      (SELECT COUNT(*) FROM stock_move m WHERE m.picking_id=k.id) move_count
      FROM stock_picking k LEFT JOIN location l1 ON l1.id=k.src_location_id LEFT JOIN location l2 ON l2.id=k.dest_location_id
      LEFT JOIN partner p ON p.id=k.partner_id ORDER BY k.id DESC LIMIT 300`).all());
  });
  app.get('/api/pickings/:id', (req, res) => {
    const k = db.prepare(`SELECT k.*, l1.name src_name, l2.name dest_name, p.name partner_name FROM stock_picking k
      LEFT JOIN location l1 ON l1.id=k.src_location_id LEFT JOIN location l2 ON l2.id=k.dest_location_id
      LEFT JOIN partner p ON p.id=k.partner_id WHERE k.id=?`).get(req.params.id);
    if (!k) return res.status(404).json({ error: 'Không tìm thấy phiếu' });
    const moves = rich(db.prepare('SELECT * FROM stock_move WHERE picking_id=?').all(k.id));
    const workers = db.prepare('SELECT * FROM delivery_worker WHERE picking_id=?').all(k.id);
    res.json({ picking: k, moves, workers });
  });
  app.post('/api/pickings', (req, res) => {
    const b = req.body || {};
    const locs = Object.fromEntries(LOCS.map(l => [l.code, l.id]));
    const lines = (b.lines || []).filter(l => l.product_code && Number(l.qty) > 0);
    if (!lines.length) return res.status(400).json({ error: 'Chưa có dòng hàng' });
    const kind = b.type_code || 'internal';
    const src = kind === 'incoming' ? (locs.NCC_CP || 100) : (locs[b.src_code] || locs.TANGAP);
    const dest = kind === 'incoming' ? (locs[b.dest_code] || locs.TANGAP) : kind === 'outgoing' ? 200 : (locs[b.dest_code] || locs.HUE);
    const prefix = kind === 'incoming' ? 'WH/IN/' : kind === 'outgoing' ? 'WH/OUT/' : 'WH/INT/';
    const name = prefix + String(Date.now()).slice(-6);
    const id = db.prepare('INSERT INTO stock_picking(name,type_code,src_location_id,dest_location_id,partner_id,origin,state,scheduled_date,note) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(name, kind, src, dest, b.partner_id ? Number(b.partner_id) : null, b.origin || '', 'assigned', b.date || new Date().toISOString().slice(0, 10), b.note || '').lastInsertRowid;
    for (const l of lines) db.prepare('INSERT INTO stock_move(picking_id,product_code,uom_id,qty,promo_qty,src_location_id,dest_location_id,state) VALUES (?,?,?,?,0,?,?,?)')
      .run(id, l.product_code, (svc.prodBy[l.product_code] || {}).uom || 2, Number(l.qty) || 0, src, dest, 'assigned');
    res.json({ ok: true, id, name });
  });
  app.post('/api/pickings/:id/validate', (req, res) => {
    try { res.json(svc.validatePicking(req.params.id, req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get('/api/moves', (req, res) => {
    res.json(rich(db.prepare(`SELECT m.*, l1.name src_name, l2.name dest_name, k.name picking_name, k.type_code
      FROM stock_move m LEFT JOIN location l1 ON l1.id=m.src_location_id LEFT JOIN location l2 ON l2.id=m.dest_location_id
      LEFT JOIN stock_picking k ON k.id=m.picking_id ORDER BY m.id DESC LIMIT 400`).all()));
  });
  app.get('/api/quants', (req, res) => {
    res.json(rich(db.prepare(`SELECT q.*, l.name location_name, l.usage FROM stock_quant q LEFT JOIN location l ON l.id=q.location_id
      WHERE q.quantity<>0 ORDER BY q.product_code, l.id`).all()));
  });

  /* ── Master data ── */
  app.get('/api/meta', (req, res) => res.json({
    products: db.prepare('SELECT * FROM product').all().map(p => ({ ...p, uom_name: svc.uomById[p.uom_id].name })),
    uoms: db.prepare('SELECT * FROM uom').all(),
    locations: db.prepare('SELECT * FROM location').all(),
    warehouses: db.prepare('SELECT * FROM warehouse').all(),
    routes: db.prepare('SELECT * FROM route').all(),
    channels: db.prepare('SELECT * FROM channel').all(),
    partners: db.prepare('SELECT * FROM partner ORDER BY name').all(),
    carriers: db.prepare('SELECT * FROM carrier').all(),
    pricelist: db.prepare('SELECT * FROM pricelist').get(),
    pricelist_items: db.prepare('SELECT * FROM pricelist_item').all(),
    stages: db.prepare('SELECT * FROM crm_stage ORDER BY sequence').all(),
    sellers: db.prepare("SELECT DISTINCT seller FROM sale_order WHERE seller<>'' ORDER BY seller").all().map(r => r.seller),
  }));
  app.get('/api/products', (req, res) => res.json({
    products: db.prepare('SELECT * FROM product').all().map(p => ({ ...p, uom_name: svc.uomById[p.uom_id].name })),
    uoms: db.prepare('SELECT * FROM uom').all(),
    items: db.prepare('SELECT * FROM pricelist_item').all(),
  }));

  /* ── CRM ── */
  app.get('/api/crm', (req, res) => res.json({
    stages: db.prepare('SELECT * FROM crm_stage ORDER BY sequence').all(),
    leads: db.prepare('SELECT * FROM crm_lead WHERE active=1 ORDER BY id DESC LIMIT 300').all(),
  }));
  app.post('/api/crm/leads', (req, res) => {
    const b = req.body || {};
    const id = db.prepare('INSERT INTO crm_lead(name,type,stage_id,probability,expected_revenue,partner_name,phone,address,source,referrer,service,scheduled,doc_status,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(b.name || 'Cơ hội mới', 'opportunity', b.stage_id || 1, 10, Number(b.expected_revenue) || 0, b.partner_name || '', b.phone || '', b.address || '', b.source || '', b.referrer || '', b.service || '', b.scheduled || '', b.doc_status || 'Chưa có phiếu', b.note || '').lastInsertRowid;
    res.json({ ok: true, id });
  });
  app.put('/api/crm/leads/:id', (req, res) => {
    const b = req.body || {};
    const stage = db.prepare('SELECT * FROM crm_stage WHERE id=?').get(b.stage_id);
    const prob = stage && stage.is_won ? 100 : (b.probability != null ? Number(b.probability) : 30);
    db.prepare('UPDATE crm_lead SET stage_id=?, probability=? WHERE id=?').run(b.stage_id || 1, prob, req.params.id);
    res.json({ ok: true, probability: prob });
  });
  app.post('/api/crm/leads/:id/quotation', (req, res) => {
    const lead = db.prepare('SELECT * FROM crm_lead WHERE id=?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Không tìm thấy cơ hội' });
    const seq = db.prepare('SELECT COUNT(*) n FROM sale_order').get().n + 1;
    const name = 'SO' + String(seq).padStart(4, '0');
    const id = db.prepare('INSERT INTO sale_order(name,partner_id,channel_code,warehouse_code,pricelist_id,state,date,seller,carrier_id,amount_untaxed,amount_total,note) VALUES (?,?,?,?,?,?,?,?,?,0,0,?)')
      .run(name, (db.prepare('SELECT id FROM partner LIMIT 1').get() || {}).id, 'XN', 'TANGAP', 1, 'draft', new Date().toISOString().slice(0, 10), '', 1, 'Tạo từ cơ hội: ' + lead.name).lastInsertRowid;
    db.prepare('INSERT INTO sale_order_line(order_id,product_code,uom_id,qty,promo_qty,price_unit,discount) VALUES (?,?,?,?,0,?,0)').run(id, 'VI_500', 2, 10, 98000);
    db.prepare('UPDATE crm_lead SET stage_id=3 WHERE id=?').run(lead.id);
    res.json({ ok: true, id, name });
  });

  /* ── Vận chuyển ── */
  app.get('/api/carriers', (req, res) => res.json({
    carriers: db.prepare('SELECT * FROM carrier').all(),
    rules: db.prepare('SELECT * FROM carrier_rule').all(),
    workers: db.prepare('SELECT * FROM delivery_worker WHERE picking_id>0').all(),
  }));
  app.post('/api/carriers/rate', (req, res) => {
    const { carrier_id, lines } = req.body || {};
    res.json(svc.rateCarrier(Number(carrier_id) || 1, lines || []));
  });

  /* ── Tùy biến: sổ vỏ ── */
  app.get('/api/shells', (req, res) => res.json(db.prepare('SELECT * FROM shell_ledger WHERE period=? ORDER BY id').all(req.query.period || 'T9')));
  app.post('/api/shells/return', (req, res) => {
    const { id, up = 0, voi = 0, to_xn = 0 } = req.body || {};
    const row = db.prepare('SELECT * FROM shell_ledger WHERE id=?').get(id);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
    const cu = Math.max(0, (row.closing_up || 0) - Number(up) - Number(to_xn));
    const cv = Math.max(0, (row.closing_voi || 0) - Number(voi) - Number(to_xn));
    db.prepare('UPDATE shell_ledger SET returned_up=?, returned_voi=?, xn_up=?, xn_voi=?, closing_up=?, closing_voi=?, last_return_date=? WHERE id=?')
      .run((row.returned_up || 0) + Number(up), (row.returned_voi || 0) + Number(voi), (row.xn_up || 0) + Number(to_xn), (row.xn_voi || 0) + Number(to_xn), cu, cv, new Date().toISOString().slice(0, 10), id);
    db.prepare('INSERT INTO shell_movement(date,subject,customer,kind,up,voi,note) VALUES (?,?,?,?,?,?,?)')
      .run(new Date().toISOString().slice(0, 10), row.subject, row.customer, 'TRA', Number(up) + Number(to_xn), Number(voi) + Number(to_xn), 'Thu hồi vỏ' + (Number(to_xn) ? ' (trả về XN)' : ''));
    res.json({ ok: true, closing_up: cu, closing_voi: cv });
  });
  app.get('/api/shells/holders', (req, res) => res.json(db.prepare('SELECT * FROM shell_holder ORDER BY debt DESC').all()));
  app.get('/api/shells/balances', (req, res) => res.json(db.prepare('SELECT * FROM shell_balance').all()));

  /* ── Tùy biến: DVGT ── */
  app.get('/api/dvgt', (req, res) => res.json(db.prepare('SELECT * FROM dvgt ORDER BY id DESC').all()));
  app.post('/api/dvgt', (req, res) => {
    const b = req.body || {};
    const id = db.prepare('INSERT INTO dvgt(date,customer,phone,service,referrer,channel,state,doc_status,scheduled,revenue,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(b.date || new Date().toISOString().slice(0, 10), b.customer || '', b.phone || '', b.service || '', b.referrer || '', b.channel || '', b.state || 'Mới', b.doc_status || 'Chưa có phiếu', b.scheduled || '', Number(b.revenue) || 0, b.description || '').lastInsertRowid;
    res.json({ ok: true, id });
  });
  app.put('/api/dvgt/:id', (req, res) => {
    const b = req.body || {};
    db.prepare('UPDATE dvgt SET state=?, doc_status=?, revenue=? WHERE id=?').run(b.state || 'Mới', b.doc_status || 'Chưa có phiếu', Number(b.revenue) || 0, req.params.id);
    res.json({ ok: true });
  });

  /* ── Tùy biến: KPI ── */
  app.get('/api/kpi', (req, res) => {
    const plan = db.prepare('SELECT * FROM kpi_plan ORDER BY id DESC LIMIT 1').get();
    const employees = db.prepare('SELECT * FROM kpi_employee ORDER BY total DESC').all().map(e => ({ ...e, monthly: JSON.parse(e.monthly || '[]') }));
    const byStation = db.prepare("SELECT station name, COALESCE(SUM(total),0) value, COUNT(*) n FROM kpi_employee WHERE station<>'' GROUP BY station ORDER BY value DESC").all();
    res.json({ plan, employees, byStation });
  });

  /* ── Tổng quan ── */
  app.get('/api/overview', (req, res) => {
    const g = (s) => db.prepare(s).get();
    const o = g('SELECT COALESCE(SUM(amount_total),0) v, COUNT(*) n FROM sale_order');
    const pickDone = g("SELECT COUNT(*) n FROM stock_picking WHERE type_code='outgoing' AND state='done'");
    const pickWait = g("SELECT COUNT(*) n FROM stock_picking WHERE state<>'done' AND state<>'cancel'");
    const fee = g('SELECT COALESCE(SUM(carrier_price),0) v FROM stock_picking');
    const shell = g('SELECT COALESCE(SUM(closing_up),0) up, COALESCE(SUM(closing_voi),0) voi FROM shell_ledger');
    const dvgt = g('SELECT COUNT(*) n, COALESCE(SUM(revenue),0) r FROM dvgt');
    const plan = g('SELECT * FROM kpi_plan ORDER BY id DESC LIMIT 1');
    const kpiSum = g('SELECT COALESCE(SUM(total),0) v FROM kpi_employee');
    res.json({
      revenue: o.v, orders: o.n, pickDone: pickDone.n, pickWait: pickWait.n, fee: fee.v,
      shell, dvgt, plan, kpiSum: kpiSum.v,
      byChannel: db.prepare(`SELECT c.name, COALESCE(SUM(o.amount_total),0) value, c.counts_for_kpi FROM channel c LEFT JOIN sale_order o ON o.channel_code=c.code GROUP BY c.code ORDER BY value DESC`).all(),
      byWarehouse: db.prepare(`SELECT l.name, COALESCE(SUM(q.quantity),0) value FROM location l LEFT JOIN stock_quant q ON q.location_id=l.id WHERE l.usage IN ('internal','transit') GROUP BY l.id ORDER BY value DESC`).all(),
      bySeller: db.prepare(`SELECT seller name, COALESCE(SUM(amount_total),0) value FROM sale_order WHERE seller<>'' GROUP BY seller ORDER BY value DESC LIMIT 8`).all(),
      byFee: db.prepare(`SELECT employee name, COALESCE(SUM(fee_share),0) value FROM delivery_worker WHERE role='CARRIER' GROUP BY employee ORDER BY value DESC LIMIT 8`).all(),
      recentOrders: db.prepare(`SELECT o.id,o.name,o.date,o.state,o.amount_total,p.name partner_name FROM sale_order o LEFT JOIN partner p ON p.id=o.partner_id ORDER BY o.id DESC LIMIT 8`).all(),
    });
  });
  app.get('/api/activity', (req, res) => res.json(db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 40').all()));

  /* ── Màn hình QUAN HỆ (góc nhìn quản lý) ── */
  app.get('/api/worklist', (req, res) => {
    const notDelivered = db.prepare(`SELECT o.id,o.name,o.date,o.amount_total,p.name partner_name,o.seller
      FROM sale_order o LEFT JOIN partner p ON p.id=o.partner_id WHERE o.state='sale' ORDER BY o.date LIMIT 50`).all();
    const pendingPick = db.prepare(`SELECT k.id,k.name,k.type_code,k.state,l1.name src,l2.name dest FROM stock_picking k
      LEFT JOIN location l1 ON l1.id=k.src_location_id LEFT JOIN location l2 ON l2.id=k.dest_location_id
      WHERE k.state NOT IN ('done','cancel') ORDER BY k.id DESC LIMIT 50`).all();
    const unpaid = db.prepare(`SELECT o.id,o.name,o.date,o.seller,o.amount_total,o.paid_amount,(o.amount_total-o.paid_amount) remain,p.name partner_name
      FROM sale_order o LEFT JOIN partner p ON p.id=o.partner_id WHERE o.amount_total-o.paid_amount > 0 ORDER BY remain DESC LIMIT 50`).all();
    const dvgtNoDoc = db.prepare(`SELECT COUNT(*) n FROM dvgt WHERE doc_status NOT LIKE '%đã có%' AND state NOT LIKE '%Hủy%'`).get().n;
    const lowStock = db.prepare(`SELECT q.product_code,l.name location_name,q.quantity FROM stock_quant q JOIN location l ON l.id=q.location_id
      WHERE l.usage IN ('internal','transit') AND q.quantity < 60 ORDER BY q.quantity LIMIT 30`).all();
    const shellOpen = db.prepare(`SELECT COUNT(*) n FROM shell_ledger WHERE (closing_up+closing_voi) > 0`).get().n;
    res.json({ notDelivered, pendingPick, unpaid, dvgtNoDoc, lowStock, shellOpen });
  });

  app.get('/api/cash', (req, res) => {
    const rows = db.prepare(`SELECT seller name, COUNT(*) orders, COALESCE(SUM(amount_total),0) revenue,
      COALESCE(SUM(paid_amount),0) collected, COALESCE(SUM(amount_total-paid_amount),0) outstanding
      FROM sale_order WHERE seller<>'' GROUP BY seller ORDER BY outstanding DESC, revenue DESC`).all();
    const total = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, collected: a.collected + r.collected, outstanding: a.outstanding + r.outstanding }), { revenue: 0, collected: 0, outstanding: 0 });
    res.json({ rows, total });
  });

  app.get('/api/customer-debts', (req, res) => {
    res.json(db.prepare(`SELECT p.id, p.name, COUNT(o.id) orders, COALESCE(SUM(o.amount_total),0) revenue,
      COALESCE(SUM(o.paid_amount),0) paid, COALESCE(SUM(o.amount_total-o.paid_amount),0) debt, MAX(o.date) last_order
      FROM partner p JOIN sale_order o ON o.partner_id=p.id GROUP BY p.id ORDER BY debt DESC LIMIT 100`).all());
  });

  app.get('/api/shells/movements', (req, res) => res.json(db.prepare('SELECT * FROM shell_movement ORDER BY id DESC LIMIT 100').all()));

  app.get('/api/relations', (req, res) => {
    res.json({
      channels: db.prepare(`SELECT c.name, c.counts_for_kpi, COALESCE(SUM(o.amount_total),0) revenue, COUNT(o.id) orders FROM channel c LEFT JOIN sale_order o ON o.channel_code=c.code GROUP BY c.code ORDER BY revenue DESC`).all(),
      sellers: db.prepare(`SELECT seller name, COUNT(*) orders, COALESCE(SUM(amount_total),0) revenue FROM sale_order WHERE seller<>'' GROUP BY seller ORDER BY revenue DESC LIMIT 10`).all(),
      customers: db.prepare(`SELECT p.name, COUNT(o.id) orders, COALESCE(SUM(o.amount_total),0) revenue FROM partner p JOIN sale_order o ON o.partner_id=p.id GROUP BY p.id ORDER BY revenue DESC LIMIT 10`).all(),
      shells: db.prepare(`SELECT subject name, (closing_up+closing_voi) debt FROM shell_ledger WHERE (closing_up+closing_voi)>0 ORDER BY debt DESC LIMIT 10`).all(),
      stock: db.prepare(`SELECT l.name, COALESCE(SUM(q.quantity),0) qty FROM location l LEFT JOIN stock_quant q ON q.location_id=l.id WHERE l.usage IN ('internal','transit') GROUP BY l.id ORDER BY qty DESC`).all(),
      workers: db.prepare(`SELECT employee name, COALESCE(SUM(fee_share),0) fee FROM delivery_worker WHERE role='CARRIER' GROUP BY employee ORDER BY fee DESC LIMIT 10`).all(),
      orderStates: db.prepare(`SELECT state, COUNT(*) n FROM sale_order GROUP BY state`).all(),
    });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy API: ' + req.originalUrl }));
  app.use(express.static(PUBLIC_DIR));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  app.listen(PORT, () => {
    console.log(`\n  QAROMI ERP DEMO (Odoo-style) đang chạy:  http://127.0.0.1:${PORT}`);
    console.log(`  Mở đúng địa chỉ này bằng Chrome/Edge (không mở qua preview của IDE).\n`);
  });
})().catch(e => { console.error('Lỗi khởi động demo:', e); process.exit(1); });
