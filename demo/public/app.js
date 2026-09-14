/* QAROMI ERP DEMO — giao diện theo GÓC NHÌN NHÀ QUẢN LÝ */
const state = { meta: null, app: 'home', view: '', param: null };

const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const API_BASE = (() => { try { return new URL('api', document.baseURI).pathname.replace(/\/$/, ''); } catch (e) { return '/api'; } })();
const API_CANDIDATES = [API_BASE, '/api'].filter((v, i, a) => v && a.indexOf(v) === i);
async function api(path, opts) {
  const rel = path === '/api' ? '' : (path.startsWith('/api/') ? path.slice(4) : path);
  const retryable = !opts || !opts.method || opts.method === 'GET';
  let lastErr;
  for (let i = 0; i < API_CANDIDATES.length; i++) {
    const url = API_CANDIDATES[i] + rel;
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
      if (res.status === 404 && retryable && i < API_CANDIDATES.length - 1) { lastErr = new Error('404 tại ' + url); continue; }
      if (!res.ok) { let m = 'Lỗi ' + res.status; try { const j = await res.json(); if (j && j.error) m = j.error; } catch (e) {} throw new Error(m); }
      return await res.json();
    } catch (e) { lastErr = e; if (!retryable) break; }
  }
  throw lastErr || new Error('Không gọi được API');
}
let toastTimer;
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800); }
function modal(html) { document.getElementById('modal-box').innerHTML = html; document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ── Điều hướng ── */
const NAV = [
  { group: 'ĐIỀU HÀNH', items: [
    ['overview', 'Bảng điều khiển', '▦'],
    ['worklist', 'Việc cần xử lý', '⚑'],
  ] },
  { group: 'TRỤ SẢN PHẨM', items: [
    ['products', 'Danh mục & Bảng giá', '📦'],
  ] },
  { group: 'TRỤ NHÂN VIÊN', items: [
    ['cash', 'Tiền theo nhân viên', '💵'],
    ['delivery', 'Phí vận chuyển theo người', '🚚'],
    ['kpi', 'Doanh thu & Chỉ tiêu', '◎'],
  ] },
  { group: 'TRỤ KHÁCH HÀNG', items: [
    ['custdebt', 'Công nợ tiền', '📄'],
    ['shells', 'Sổ nợ vỏ bình', '◍'],
    ['crm', 'Cơ hội & chăm sóc', '🎯'],
  ] },
  { group: 'TRỤ BÁN HÀNG', items: [
    ['orders', 'Đơn bán / Báo giá', '🧾'],
    ['dvgt', 'Dịch vụ gia tăng', '✚'],
  ] },
  { group: 'TRỤ KHO', items: [
    ['pickings', 'Phiếu kho', '📋'],
    ['quants', 'Tồn kho', '🏬'],
    ['moves', 'Dòng dịch chuyển', '↔'],
    ['config', 'Vị trí & Tuyến đường', '⚙'],
  ] },
  { group: 'QUAN HỆ & KIỂM SOÁT', items: [
    ['relations', 'Bản đồ quan hệ', '🕸'],
  ] },
];
const TITLES = {
  overview: ['Bảng điều khiển', 'Nhìn một màn hình: hôm nay thế nào, ai đang giữ gì, việc gì cần làm'],
  worklist: ['Việc cần xử lý', 'Đơn chưa giao · tiền chưa thu · phiếu chờ · kho dưới ngưỡng · nợ vỏ'],
  products: ['Trụ Sản phẩm — Danh mục & Bảng giá', 'Bán cái gì, giá bao nhiêu, quy cách thế nào, cọc vỏ ra sao'],
  cash: ['Trụ Nhân viên — Tiền theo nhân viên', 'Ai bán bao nhiêu, đã thu bao nhiêu, còn phải thu bao nhiêu'],
  delivery: ['Trụ Nhân viên — Phí vận chuyển theo người', 'Cước tính theo bảng giá, chia đều cho người cùng đi giao'],
  kpi: ['Trụ Nhân viên — Doanh thu & Chỉ tiêu', 'Kế hoạch năm gắn từng người, % hoàn thành tự tính'],
  custdebt: ['Trụ Khách hàng — Công nợ tiền', 'Khách nào còn nợ, nợ bao nhiêu, đơn gần nhất khi nào'],
  shells: ['Trụ Khách hàng — Sổ nợ vỏ bình', 'Nợ từ khi nào, trả khi nào, còn bao nhiêu Úp/Vòi'],
  crm: ['Trụ Khách hàng — Cơ hội & chăm sóc', 'Phễu cơ hội, ai phụ trách, ai vận động'],
  orders: ['Trụ Bán hàng — Đơn bán / Báo giá', 'Chứng từ có trạng thái; Xác nhận → sinh phiếu giao'],
  dvgt: ['Trụ Bán hàng — Dịch vụ gia tăng', 'Ai vận động, kênh nào, đã nộp phiếu chưa'],
  pickings: ['Trụ Kho — Phiếu kho', 'Nhập / xuất / chuyển; Xác nhận mới ghi tồn'],
  quants: ['Trụ Kho — Tồn kho theo vị trí', 'Từng kho còn bao nhiêu, tổng bao nhiêu'],
  moves: ['Trụ Kho — Dòng dịch chuyển', 'Mọi biến động đều có đối ứng Nguồn → Đích'],
  config: ['Trụ Kho — Vị trí & Tuyến đường', 'Kho, trạm, xe, kho vỏ; tuyến đường; đơn vị tính'],
  relations: ['Quan hệ & Kiểm soát', 'Bản đồ quan hệ giữa 5 trụ — trả lời câu hỏi "giữa các thành phần với nhau thì sao?"'],
};
function renderNav() {
  document.getElementById('nav').innerHTML = NAV.map(g =>
    `<div class="nav-group">${g.group}</div>` +
    g.items.map(([id, label, ico]) => `<div class="nav-item ${state.view === id ? 'active' : ''}" data-view="${id}"><span class="nav-ico">${ico}</span><span>${label}</span></div>`).join('')
  ).join('');
}
function go(view, param) {
  state.view = view; state.param = param || null;
  location.hash = view + (param ? '/' + param : '');
  renderNav();
  const [t, s] = TITLES[view] || ['', ''];
  document.getElementById('page-title').textContent = t;
  document.getElementById('page-sub').textContent = s;
  render();
}
window.addEventListener('hashchange', () => { const [v, p] = location.hash.slice(1).split('/'); go(v || 'home', p); });
document.getElementById('nav').addEventListener('click', e => { const it = e.target.closest('[data-view]'); if (it) go(it.dataset.view); });

const chip = (s) => {
  const m = { draft: ['Báo giá', 'tag'], sent: ['Đã gửi', 'tag'], sale: ['Đơn bán', 'tag up'], done: ['Đã giao', 'tag xn'], cancel: ['Đã hủy', 'tag out'], assigned: ['Sẵn sàng', 'tag xn'], confirmed: ['Chờ hàng', 'tag out'], partially_available: ['Thiếu hàng', 'tag out'] };
  const [label, cls] = m[s] || [s, 'tag'];
  return `<span class="${cls}">${label}</span>`;
};

async function render() {
  const v = document.getElementById('view');
  try {
    if (state.view === 'home') v.innerHTML = await viewOverview();
    else if (state.view === 'overview') v.innerHTML = await viewOverview();
    else if (state.view === 'worklist') v.innerHTML = await viewWorklist();
    else if (state.view === 'cash') v.innerHTML = await viewCash();
    else if (state.view === 'custdebt') v.innerHTML = await viewCustDebt();
    else if (state.view === 'relations') v.innerHTML = await viewRelations();
    else if (state.view === 'orders') await viewOrders();
    else if (state.view === 'products') v.innerHTML = await viewProducts();
    else if (state.view === 'pickings') await viewPickings();
    else if (state.view === 'quants') v.innerHTML = await viewQuants();
    else if (state.view === 'moves') v.innerHTML = await viewMoves();
    else if (state.view === 'config') v.innerHTML = await viewConfig();
    else if (state.view === 'crm') await viewCrm();
    else if (state.view === 'delivery') v.innerHTML = await viewDelivery();
    else if (state.view === 'shells') await viewShells();
    else if (state.view === 'dvgt') await viewDvgt();
    else if (state.view === 'kpi') v.innerHTML = await viewKpi();
  } catch (e) { v.innerHTML = `<div class="banner">Lỗi: ${esc(e.message)}</div>`; }
}

/* ═══════ 0) HOME — app switcher ═══════ */
function viewHome() {
  const apps = [
    ['overview', 'Điều hành', '▦', 'Doanh thu, tồn kho, công việc đang chờ'],
    ['orders', 'Bán hàng', '🧾', 'Báo giá → Đơn bán → Giao hàng'],
    ['pickings', 'Kho', '📋', 'Phiếu nhập/xuất/chuyển, tồn kho'],
    ['crm', 'CRM', '🎯', 'Phễu cơ hội & chăm sóc khách hàng'],
    ['delivery', 'Vận chuyển', '🚚', 'Phương thức giao & bảng giá cước'],
    ['shells', 'Sổ vỏ bình', '◍', 'Tùy biến: nợ vỏ Úp/Vòi theo kỳ'],
    ['dvgt', 'Dịch vụ gia tăng', '✚', 'Tùy biến: đăng ký & nộp phiếu'],
    ['kpi', 'Chỉ tiêu KPI', '◎', 'Tùy biến: kế hoạch năm/người'],
  ];
  return `<div class="grid g4">${apps.map(([id, name, ico, desc]) => `
    <div class="card appcard" data-goto="${id}">
      <div class="appico">${ico}</div><h3>${name}</h3><div class="muted">${desc}</div>
    </div>`).join('')}</div>`;
}

/* ═══════ 1) OVERVIEW ═══════ */
async function viewOverview() {
  const d = await api('/api/overview');
  const bars = (title, arr, unit) => `<div class="card"><h3>${title}</h3><div class="bars">
    ${arr.filter(x => x.value > 0).slice(0, 8).map(x => { const max = Math.max(...arr.map(a => a.value), 1);
      return `<div class="bar-row"><div>${esc(x.name || '(trống)')}${x.counts_for_kpi === 0 ? ' <span class="tag out">ngoài XN</span>' : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, x.value / max * 100)}%"></div></div>
      <div class="bar-val">${fmt(x.value)}${unit || ''}</div></div>`; }).join('') || '<div class="muted">Chưa có</div>'}</div></div>`;
  const pct = d.plan && d.plan.target ? (d.kpiSum / d.plan.target * 100) : 0;
  return `
  <div class="grid g4" style="margin-bottom:16px">
    <div class="stat accent"><div class="label">Doanh thu (đơn bán)</div><div class="value">${fmt(d.revenue)} đ</div><div class="foot">${d.orders} đơn</div></div>
    <div class="stat"><div class="label">Phiếu giao đã xong</div><div class="value">${d.pickDone}</div><div class="foot">${d.pickWait} phiếu đang chờ xử lý</div></div>
    <div class="stat"><div class="label">Phí vận chuyển</div><div class="value">${fmt(d.fee)} đ</div><div class="foot">theo bảng giá cước</div></div>
    <div class="stat warn"><div class="label">Nợ vỏ đang giữ</div><div class="value">${fmt(d.shell.up + d.shell.voi)}</div><div class="foot">Úp ${fmt(d.shell.up)} · Vòi ${fmt(d.shell.voi)}</div></div>
  </div>
  <div class="grid g2" style="margin-bottom:16px">${bars('Doanh thu theo kênh', d.byChannel, ' đ')}${bars('Tồn kho theo vị trí', d.byWarehouse, '')}</div>
  <div class="grid g2" style="margin-bottom:16px">${bars('Doanh thu theo người bán', d.bySeller, ' đ')}${bars('Phí vận chuyển theo người', d.byFee, ' đ')}</div>
  <div class="card"><h3>Kế hoạch năm ${d.plan ? d.plan.year : ''}</h3>
    <div class="kv">Kế hoạch <b>${fmt(d.plan ? d.plan.target : 0)} đ</b> · ${d.plan ? d.plan.headcount : 0} CBCNV · bình quân/người <b>${fmt(d.plan && d.plan.headcount ? d.plan.target / d.plan.headcount : 0)} đ</b><br>
    Đã ghi nhận <b>${fmt(d.kpiSum)} đ</b> = <b>${pct.toFixed(1)}%</b> kế hoạch.</div>
    <div class="bar-track" style="margin-top:10px;height:16px"><div class="bar-fill" style="width:${Math.min(100, pct).toFixed(1)}%"></div></div></div>
  <div class="card" style="margin-top:16px"><h3>Đơn bán gần đây</h3><table class="mini-table">
    <thead><tr><th>Mã</th><th>Ngày</th><th>Đối tác</th><th>Trạng thái</th><th class="num">Giá trị</th></tr></thead>
    <tbody>${d.recentOrders.map(o => `<tr class="clickable" data-order="${o.id}"><td><b>${esc(o.name)}</b></td><td>${esc(o.date)}</td><td>${esc(o.partner_name || '')}</td><td>${chip(o.state)}</td><td class="num">${fmt(o.amount_total)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ═══════ 2) BÁN HÀNG ═══════ */
async function viewOrders() {
  const rows = await api('/api/orders');
  document.getElementById('view').innerHTML = `
  <div class="toolbar"><button class="btn-primary" id="btn-neworder">＋ Tạo báo giá</button>
    <input id="f-q" placeholder="Tìm mã đơn / đối tác…" style="max-width:280px" />
    <div class="spacer"></div><span class="pill">${rows.length} chứng từ</span></div>
  <div class="table-wrap"><table><thead><tr><th>Mã</th><th>Ngày</th><th>Đối tác</th><th>Kênh</th>
    <th class="num">Dòng</th><th>Giao hàng</th><th>Trạng thái</th><th class="num">Tổng</th><th>Người bán</th></tr></thead>
    <tbody>${rows.map(o => `<tr class="clickable" data-order="${o.id}">
      <td><b>${esc(o.name)}</b></td><td>${esc(o.date)}</td><td>${esc(o.partner_name || '')}</td>
      <td><span class="tag ${o.counts_for_kpi ? 'xn' : 'out'}">${esc(o.channel_name)}</span></td>
      <td class="num">${o.line_count}</td>
      <td>${o.picking_count ? `<span class="smart">${o.picking_count} phiếu</span>` : '<span class="muted">—</span>'}</td>
      <td>${chip(o.state)}</td><td class="num">${fmt(o.amount_total)}</td><td>${esc(o.seller)}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('btn-neworder').onclick = openNewOrder;
  document.getElementById('f-q').oninput = e => { const q = e.target.value.toLowerCase();
    document.querySelectorAll('tbody tr').forEach(tr => tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'); };
}

async function openOrderForm(id) {
  const d = await api('/api/orders/' + id);
  const o = d.order;
  const rib = { draft: ['Báo giá', '#64748b'], sent: ['Đã gửi', '#50adde'], sale: ['Đơn bán', '#2c2c6b'], done: ['Đã giao hàng', '#15803d'], cancel: ['Đã hủy', '#c62430'] }[o.state] || [o.state, '#64748b'];
  modal(`
    <div class="ribbon" style="background:${rib[1]}"><span>${esc(o.name)}</span><b>${rib[0]}</b></div>
    <div class="row4" style="margin-bottom:10px">
      <div class="field"><label>Khách hàng / đối tác</label><div class="ro">${esc(o.partner_name || '')}</div></div>
      <div class="field"><label>Kênh doanh thu</label><div class="ro">${esc(o.channel_name)} ${o.counts_for_kpi ? '<span class="tag xn">tính chỉ tiêu</span>' : '<span class="tag out">ngoài XN</span>'}</div></div>
      <div class="field"><label>Ngày</label><div class="ro">${esc(o.date)}</div></div>
      <div class="field"><label>Người bán</label><div class="ro">${esc(o.seller || '—')}</div></div>
    </div>
    <div class="grid g3" style="margin-bottom:12px">
      <div class="stat"><div class="label">Giao hàng</div><div class="value">${d.pickings.length}</div><div class="foot">phiếu</div></div>
      <div class="stat"><div class="label">Đã giao</div><div class="value">${d.lines.reduce((a, l) => a + (l.qty_delivered || 0), 0)}</div><div class="foot">/ ${d.lines.reduce((a, l) => a + l.qty, 0)} đơn vị</div></div>
      <div class="stat accent"><div class="label">Tổng tiền</div><div class="value">${fmt(o.amount_total)}</div><div class="foot">đ</div></div>
    </div>
    <div class="tabs"><span class="tab active">Dòng hàng</span><span class="tab">Thông tin khác</span></div>
    <table class="mini-table"><thead><tr><th>Sản phẩm</th><th>ĐVT</th><th class="num">SL</th><th class="num">KM</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th><th class="num">Đã giao</th></tr></thead>
    <tbody>${d.lines.map(l => `<tr><td>${esc(l.product_name)}</td><td>${esc(l.unit)}</td><td class="num">${fmt(l.qty)}</td>
      <td class="num">${l.promo_qty ? fmt(l.promo_qty) : ''}</td><td class="num">${fmt(l.price_unit)}</td>
      <td class="num">${fmt(l.qty * l.price_unit)}</td><td class="num">${fmt(l.qty_delivered)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="5">TỔNG</td><td class="num">${fmt(o.amount_total)}</td><td></td></tr></tbody></table>
    ${d.pickings.length ? `<h3 style="margin:14px 0 6px;font-size:13px">Phiếu giao</h3>
      <table class="mini-table"><thead><tr><th>Mã phiếu</th><th>Loại</th><th>Trạng thái</th><th class="num">Phí VC</th></tr></thead>
      <tbody>${d.pickings.map(k => `<tr><td>${esc(k.name)}</td><td>${k.type_code}</td><td>${chip(k.state)}</td><td class="num">${fmt(k.carrier_price)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${d.workers.length ? `<h3 style="margin:14px 0 6px;font-size:13px">Người tham gia lượt giao (tùy biến)</h3>
      <table class="mini-table"><thead><tr><th>Vai trò</th><th>Nhân viên</th><th class="num">Phần phí</th></tr></thead>
      <tbody>${d.workers.map(w => `<tr><td>${w.role === 'CARRIER' ? 'Người vận chuyển' : 'Người thực hiện'}</td><td>${esc(w.employee)}</td><td class="num">${w.fee_share ? fmt(w.fee_share) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
      ${(o.state === 'draft' || o.state === 'sent') ? `<button class="btn-cyan" id="btn-confirm">✔ Xác nhận (sinh phiếu giao)</button>` : ''}
      ${(o.state !== 'done' && o.state !== 'cancel') ? `<button id="btn-cancel">Hủy đơn</button>` : ''}
      <button onclick="closeModal()">Đóng</button>
    </div>`);
  const bc = document.getElementById('btn-confirm');
  if (bc) bc.onclick = async () => {
    try { const r = await api(`/api/orders/${id}/confirm`, { method: 'POST' }); toast('Đã xác nhận → sinh phiếu ' + r.picking_name); openOrderForm(id); render(); }
    catch (e) { toast(e.message); }
  };
  const bx = document.getElementById('btn-cancel');
  if (bx) bx.onclick = async () => { await api(`/api/orders/${id}/cancel`, { method: 'POST' }); toast('Đã hủy đơn'); closeModal(); render(); };
}

function openNewOrder() {
  const m = state.meta;
  modal(`
    <h2>Tạo báo giá</h2><p class="muted">Đây là chứng từ gốc; bấm Xác nhận sau khi lưu để sinh phiếu giao & bút toán kho.</p>
    <div class="row3">
      <div class="field"><label>Ngày</label><input type="date" id="o-date" value="${new Date().toISOString().slice(0, 10)}" /></div>
      <div class="field"><label>Khách hàng / đối tác</label><input id="o-partner" list="dl-partners" placeholder="Chọn hoặc gõ tên mới" /></div>
      <div class="field"><label>Kênh doanh thu</label><select id="o-channel">${m.channels.map(c => `<option value="${c.code}">${esc(c.name)}${c.counts_for_kpi ? '' : ' (ngoài XN)'}</option>`).join('')}</select></div>
    </div>
    <div class="row3">
      <div class="field"><label>Kho xuất</label><select id="o-wh">${m.warehouses.map(w => `<option value="${w.code}">${esc(w.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Người bán</label><input id="o-seller" list="dl-people" /></div>
      <div class="field"><label>Phương thức giao</label><select id="o-carrier">${m.carriers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
    </div>
    <datalist id="dl-partners">${m.partners.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
    <datalist id="dl-people">${m.sellers.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <h3 style="margin:12px 0 6px;font-size:13px">Dòng hàng (chọn ĐVT để thấy quy đổi về đơn vị tồn kho)</h3>
    <table class="mini-table" id="ol"><thead><tr><th style="width:34%">Sản phẩm</th><th>ĐVT</th><th class="num">SL</th><th class="num">KM</th><th class="num">Đơn giá</th><th>Quy đổi tồn kho</th><th></th></tr></thead><tbody></tbody></table>
    <button style="margin-top:8px" id="btn-line">＋ Thêm dòng</button>
    <div class="banner" style="background:#eef2f7;border-color:#dbe3ee;color:#334155" id="o-preview">Cước vận chuyển (theo bảng giá): <b>—</b></div>
    <div class="row2"><div class="field"><label>Thu tiền (ghi chú)</label><input id="o-collect" placeholder="CK/TM ngày…" /></div>
      <div class="field"><label>Ghi chú</label><input id="o-note" placeholder="vay công ty / giao gấp…" /></div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end"><button onclick="closeModal()">Hủy</button><button class="btn-primary" id="o-save">Lưu báo giá</button></div>`);
  const tbody = document.querySelector('#ol tbody');
  const uomOf = code => (m.products.find(p => p.code === code) || {}).uom_id;
  function addLine() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select class="l-prod">${m.products.map(p => `<option value="${p.code}">${esc(p.name)}</option>`).join('')}</select></td>
      <td><select class="l-uom">${m.uoms.filter(u => u.category === 'CHAI').map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></td>
      <td><input class="l-qty num" type="number" value="10" min="0" /></td>
      <td><input class="l-promo num" type="number" value="0" min="0" /></td>
      <td><input class="l-price num" type="number" /></td>
      <td class="l-conv muted">—</td><td><button class="l-del" style="padding:3px 8px">✕</button></td>`;
    tbody.appendChild(tr); bind(tr); recalc();
  }
  function bind(tr) {
    const upd = () => {
      const code = tr.querySelector('.l-prod').value;
      const p = m.products.find(x => x.code === code);
      tr.querySelector('.l-price').value = p.price;
      const uomSel = tr.querySelector('.l-uom');
      // chỉ cho chọn ĐVT cùng nhóm với ĐVT tồn kho của sản phẩm (giống domain Odoo)
      const pu = m.uoms.find(u => u.id === p.uom_id);
      uomSel.innerHTML = m.uoms.filter(u => u.category === pu.category).map(u => `<option value="${u.id}" ${u.id === p.uom_id ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
      recalc();
    };
    tr.querySelector('.l-prod').onchange = upd;
    tr.querySelector('.l-uom').onchange = recalc;
    tr.querySelector('.l-qty').oninput = recalc;
    tr.querySelector('.l-promo').oninput = recalc;
    tr.querySelector('.l-price').oninput = recalc;
    tr.querySelector('.l-del').onclick = () => { tr.remove(); recalc(); };
    upd();
  }
  async function recalc() {
    const lines = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const code = tr.querySelector('.l-prod').value;
      const p = m.products.find(x => x.code === code);
      const uomId = Number(tr.querySelector('.l-uom').value);
      const qty = Number(tr.querySelector('.l-qty').value) || 0;
      const u = m.uoms.find(x => x.id === uomId), pu = m.uoms.find(x => x.id === p.uom_id);
      const conv = (u && pu) ? qty * u.factor / pu.factor : qty;
      tr.querySelector('.l-conv').innerHTML = (uomId === p.uom_id) ? `<span class="muted">${fmt(qty)} ${pu.name}</span>` : `<b>${fmt(conv)} ${pu.name}</b>`;
      lines.push({ product_code: code, qty, price_unit: Number(tr.querySelector('.l-price').value) || p.price });
    });
    try { const r = await api('/api/carriers/rate', { method: 'POST', body: JSON.stringify({ carrier_id: Number(document.getElementById('o-carrier').value), lines }) });
      document.getElementById('o-preview').innerHTML = `Cước vận chuyển (theo bảng giá): <b>${fmt(r.price)} đ</b> <span class="muted">— ${esc(r.detail)}</span>`;
    } catch (e) {}
  }
  document.getElementById('btn-line').onclick = addLine;
  document.getElementById('o-carrier').onchange = recalc;
  addLine(); addLine();
  document.getElementById('o-save').onclick = async () => {
    const partnerName = document.getElementById('o-partner').value.trim();
    const lines = [...tbody.querySelectorAll('tr')].map(tr => ({
      product_code: tr.querySelector('.l-prod').value,
      uom_id: Number(tr.querySelector('.l-uom').value),
      qty: Number(tr.querySelector('.l-qty').value) || 0,
      promo_qty: Number(tr.querySelector('.l-promo').value) || 0,
      price_unit: Number(tr.querySelector('.l-price').value) || 0,
    })).filter(l => l.qty > 0);
    if (!lines.length) return toast('Cần ít nhất một dòng hàng');
    try {
      const r = await api('/api/orders', { method: 'POST', body: JSON.stringify({
        date: document.getElementById('o-date').value, partner_name: partnerName,
        channel_code: document.getElementById('o-channel').value, warehouse_code: document.getElementById('o-wh').value,
        seller: document.getElementById('o-seller').value, carrier_id: Number(document.getElementById('o-carrier').value),
        collection_note: document.getElementById('o-collect').value, note: document.getElementById('o-note').value, lines,
      }) });
      closeModal(); toast('Đã lưu ' + r.name); go('orders'); setTimeout(() => openOrderForm(r.id), 400);
    } catch (e) { toast(e.message); }
  };
}

/* ═══════ 3) KHO ═══════ */
async function viewPickings() {
  const rows = await api('/api/pickings');
  const label = t => t === 'incoming' ? 'Nhập kho' : t === 'outgoing' ? 'Xuất cho khách' : 'Chuyển nội bộ';
  document.getElementById('view').innerHTML = `
  <div class="toolbar"><button class="btn-primary" id="btn-nhpick">＋ Tạo phiếu nhập (từ Cẩm Phả)</button>
    <button id="btn-intpick">＋ Chuyển kho nội bộ</button><div class="spacer"></div>
    <span class="pill">${rows.filter(r => r.state !== 'done' && r.state !== 'cancel').length} phiếu chờ xử lý</span></div>
  <div class="table-wrap"><table><thead><tr><th>Mã phiếu</th><th>Loại</th><th>Nguồn → Đích</th><th>Đối tác</th>
    <th>Chứng từ gốc</th><th>Trạng thái</th><th class="num">Dòng</th><th>Ngày</th></tr></thead>
    <tbody>${rows.map(k => `<tr class="clickable" data-pick="${k.id}"><td><b>${esc(k.name)}</b></td><td>${label(k.type_code)}</td>
      <td>${esc(k.src_name)} → ${esc(k.dest_name)}</td><td>${esc(k.partner_name || '')}</td><td>${esc(k.origin || '')}</td>
      <td>${chip(k.state)}</td><td class="num">${k.move_count}</td><td>${esc(k.scheduled_date || '')}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('btn-nhpick').onclick = () => openNewPicking('incoming');
  document.getElementById('btn-intpick').onclick = () => openNewPicking('internal');
}

async function openPicking(id) {
  const d = await api('/api/pickings/' + id);
  const k = d.picking;
  const label = t => t === 'incoming' ? 'Nhập kho' : t === 'outgoing' ? 'Xuất cho khách' : 'Chuyển nội bộ';
  modal(`
    <div class="ribbon" style="background:${k.state === 'done' ? '#15803d' : '#2c2c6b'}"><span>${esc(k.name)}</span><b>${label(k.type_code)}</b></div>
    <div class="row3" style="margin-bottom:10px">
      <div class="field"><label>Nguồn</label><div class="ro">${esc(k.src_name)}</div></div>
      <div class="field"><label>Đích</label><div class="ro">${esc(k.dest_name)}</div></div>
      <div class="field"><label>Trạng thái</label><div class="ro">${chip(k.state)}</div></div>
    </div>
    ${k.origin ? `<div class="muted" style="margin-bottom:8px">Chứng từ gốc: <b>${esc(k.origin)}</b></div>` : ''}
    <table class="mini-table"><thead><tr><th>Sản phẩm</th><th>ĐVT</th><th class="num">SL</th><th class="num">KM</th><th>Nguồn → Đích</th><th>Trạng thái</th></tr></thead>
    <tbody>${d.moves.map(mv => `<tr><td>${esc(mv.product_name)}</td><td>${esc(mv.unit)}</td><td class="num">${fmt(mv.qty)}</td>
      <td class="num">${mv.promo_qty ? fmt(mv.promo_qty) : ''}</td><td>${esc(mv.src_name)} → ${esc(mv.dest_name)}</td><td>${chip(mv.state)}</td></tr>`).join('')}</tbody></table>
    ${d.workers.length ? `<h3 style="margin:14px 0 6px;font-size:13px">Người tham gia</h3><table class="mini-table">
      <thead><tr><th>Vai trò</th><th>Nhân viên</th><th class="num">Phần phí</th></tr></thead>
      <tbody>${d.workers.map(w => `<tr><td>${w.role}</td><td>${esc(w.employee)}</td><td class="num">${w.fee_share ? fmt(w.fee_share) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
      ${k.state !== 'done' && k.state !== 'cancel' ? `<button class="btn-cyan" id="btn-validate">✔ Xác nhận (ghi tồn kho)</button>` : ''}
      <button onclick="closeModal()">Đóng</button></div>`);
  const b = document.getElementById('btn-validate');
  if (b) b.onclick = async () => {
    try { await api(`/api/pickings/${id}/validate`, { method: 'POST', body: '{}' }); toast('Đã hoàn tất phiếu — tồn kho cập nhật'); openPicking(id); render(); }
    catch (e) { toast(e.message); }
  };
}

function openNewPicking(kind) {
  const m = state.meta;
  const locs = m.locations.filter(l => l.usage === 'internal');
  modal(`
    <h2>${kind === 'incoming' ? 'Phiếu nhập kho (từ Cẩm Phả)' : 'Chuyển kho nội bộ'}</h2>
    <div class="row2">
      ${kind === 'incoming'
        ? `<div class="field"><label>Nhập vào kho</label><select id="p-dest">${locs.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join('')}</select></div>`
        : `<div class="field"><label>Từ kho</label><select id="p-src">${locs.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join('')}</select></div>
           <div class="field"><label>Đến kho</label><select id="p-dest">${locs.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join('')}</select></div>`}
    </div>
    <table class="mini-table" id="pl"><thead><tr><th style="width:50%">Sản phẩm</th><th class="num">Số lượng</th><th></th></tr></thead><tbody></tbody></table>
    <button style="margin-top:8px" id="btn-pline">＋ Thêm dòng</button>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button onclick="closeModal()">Hủy</button><button class="btn-primary" id="p-save">Lưu phiếu</button></div>`);
  const tb = document.querySelector('#pl tbody');
  const add = () => { const tr = document.createElement('tr');
    tr.innerHTML = `<td><select class="p-prod">${m.products.map(p => `<option value="${p.code}">${esc(p.name)}</option>`).join('')}</select></td>
      <td><input class="p-qty num" type="number" value="20" min="0" /></td><td><button class="p-del" style="padding:3px 8px">✕</button></td>`;
    tb.appendChild(tr); tr.querySelector('.p-del').onclick = () => tr.remove(); };
  document.getElementById('btn-pline').onclick = add; add();
  document.getElementById('p-save').onclick = async () => {
    const lines = [...tb.querySelectorAll('tr')].map(tr => ({ product_code: tr.querySelector('.p-prod').value, qty: Number(tr.querySelector('.p-qty').value) || 0 })).filter(l => l.qty > 0);
    if (!lines.length) return toast('Chưa có dòng hàng');
    const body = { type_code: kind, lines };
    if (kind === 'incoming') body.dest_code = document.getElementById('p-dest').value;
    else { body.src_code = document.getElementById('p-src').value; body.dest_code = document.getElementById('p-dest').value; }
    try { const r = await api('/api/pickings', { method: 'POST', body: JSON.stringify(body) }); closeModal(); toast('Đã tạo ' + r.name); go('pickings'); setTimeout(() => openPicking(r.id), 400); }
    catch (e) { toast(e.message); }
  };
}

async function viewQuants() {
  const [q, m] = await Promise.all([api('/api/quants'), Promise.resolve(state.meta)]);
  const locs = m.locations.filter(l => l.usage === 'internal' || l.usage === 'transit');
  const codes = m.products.map(p => p.code);
  const byLoc = {}; q.forEach(r => { byLoc[r.location_id] = byLoc[r.location_id] || {}; byLoc[r.location_id][r.product_code] = r.quantity; });
  return `
  <p class="muted" style="margin-bottom:12px">Tồn được lưu theo <b>sản phẩm × vị trí kho</b>. Mọi phiếu kho khi Xác nhận đều cập nhật bảng này — không có chuyện tồn tự nhiên tăng/giảm.</p>
  <div class="table-wrap"><table><thead><tr><th>Vị trí kho</th>${codes.map(c => `<th class="num">${esc((m.products.find(p => p.code === c) || {}).name.split(' — ')[0])}</th>`).join('')}<th class="num">Cộng</th></tr></thead>
  <tbody>${locs.map(l => { const row = byLoc[l.id] || {}; const sum = Object.values(row).reduce((a, b) => a + b, 0);
    return `<tr><td><b>${esc(l.name)}</b> ${l.usage === 'transit' ? '<span class="tag">lưu động</span>' : ''}</td>
    ${codes.map(c => `<td class="num">${row[c] ? fmt(row[c]) : '·'}</td>`).join('')}<td class="num"><b>${fmt(sum)}</b></td></tr>`; }).join('')}</tbody></table></div>`;
}

async function viewMoves() {
  const rows = await api('/api/moves');
  return `
  <p class="muted" style="margin-bottom:12px">Mỗi dòng là <b>một bút toán kép</b> (Nguồn → Đích): mọi biến động kho đều có đối ứng, soi được ai làm, khi nào, từ đâu đến đâu.</p>
  <div class="table-wrap"><table><thead><tr><th>#</th><th>Sản phẩm</th><th class="num">SL</th><th class="num">KM</th>
    <th>Nguồn</th><th>Đích</th><th>Phiếu</th><th>Trạng thái</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r.id}</td><td>${esc(r.product_name)}</td><td class="num">${fmt(r.qty)}</td>
      <td class="num">${r.promo_qty ? fmt(r.promo_qty) : ''}</td><td>${esc(r.src_name)}</td><td>${esc(r.dest_name)}</td>
      <td>${esc(r.picking_name || '')}</td><td>${chip(r.state)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function viewConfig() {
  const m = state.meta;
  return `
  <div class="grid g2">
    <div class="card"><h3>Vị trí kho</h3><table class="mini-table">
      <thead><tr><th>Mã</th><th>Tên</th><th>Loại</th></tr></thead>
      <tbody>${m.locations.map(l => `<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td><span class="tag">${l.usage === 'internal' ? 'kho' : l.usage === 'transit' ? 'lưu động' : l.usage === 'supplier' ? 'nhà cung cấp' : l.usage === 'customer' ? 'khách hàng' : 'kiểm kê'}</span></td></tr>`).join('')}</tbody></table>
      <p class="muted" style="margin-top:8px">Xe tải điện là vị trí <b>lưu động</b>; Cẩm Phả là <b>nhà cung cấp</b>; khách hàng là <b>điểm đến</b> khi giao.</p></div>
    <div class="card"><h3>Tuyến đường luân chuyển</h3><table class="mini-table">
      <thead><tr><th>Tuyến</th><th>Quy tắc</th></tr></thead><tbody>${m.routes.map(r => `<tr><td>${esc(r.name)}</td><td class="muted">${esc(r.rule)}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Đơn vị tính &amp; quy đổi</h3><table class="mini-table">
    <thead><tr><th>Đơn vị</th><th>Nhóm</th><th class="num">Hệ số</th><th>Quy đổi</th></tr></thead>
    <tbody>${m.uoms.map(u => `<tr><td>${esc(u.name)}</td><td>${u.category === 'CHAI' ? 'Chai nhỏ' : 'Bình 19L'}</td><td class="num">${u.factor}</td>
      <td class="muted">${u.category === 'CHAI' ? (u.factor === 1 ? '1 Chai' : u.factor === 6 ? '= 6 Chai' : '= 4 Vỉ = 24 Chai') : '—'}</td></tr>`).join('')}</tbody></table>
    <p class="muted" style="margin-top:8px">Quy đổi chỉ để <b>đổi đơn vị số lượng</b>; giá bán theo từng mặt hàng, không suy từ quy đổi.</p></div>`;
}

/* ═══════ 4) SẢN PHẨM ═══════ */
async function viewProducts() {
  const [p, m] = await Promise.all([api('/api/products'), Promise.resolve(state.meta)]);
  return `
  <div class="card"><h3>Sản phẩm</h3><table class="mini-table">
    <thead><tr><th>Mã</th><th>Tên</th><th>ĐVT (tồn kho)</th><th class="num">Giá bán</th><th>Quản lý vỏ</th></tr></thead>
    <tbody>${p.products.map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td>${esc(x.uom_name)}</td>
      <td class="num">${fmt(x.price)}</td><td>${x.tracks_shell ? '<span class="tag up">Có (Vòi/Úp)</span>' : '<span class="tag">Không</span>'}</td></tr>`).join('')}</tbody></table></div>
  <div class="card" style="margin-top:16px"><h3>Bảng giá — ${esc(p.pricelist ? p.pricelist.name : '')}</h3><table class="mini-table">
    <thead><tr><th>Áp dụng cho</th><th>Điều kiện</th><th>Cách tính</th><th class="num">Giá / %</th></tr></thead>
    <tbody>${p.items.map(i => { const pr = p.products.find(x => x.code === i.product_code) || {};
      return `<tr><td>${esc(pr.name || i.applied_on)}</td><td>SL ≥ ${i.min_qty}</td>
      <td>${i.compute_price === 'fixed' ? 'Giá cố định' : 'Giảm giá %'}</td>
      <td class="num">${i.compute_price === 'fixed' ? fmt(i.fixed_price) : i.percent + '%'}</td></tr>`; }).join('')}</tbody></table>
    <p class="muted" style="margin-top:8px">Bảng giá tách khỏi sản phẩm, nhờ đó có giá bán lẻ và giá đại lý cho cùng mặt hàng.</p></div>`;
}

/* ═══════ 5) CRM ═══════ */
async function viewCrm() {
  const d = await api('/api/crm');
  const cols = d.stages.map(s => ({ ...s, leads: d.leads.filter(l => l.stage_id === s.id) }));
  document.getElementById('view').innerHTML = `
  <div class="toolbar"><button class="btn-primary" id="btn-lead">＋ Cơ hội mới</button>
    <div class="spacer"></div><span class="pill">${d.leads.length} cơ hội</span></div>
  <div class="kanban">${cols.map(c => `
    <div class="kcol"><div class="khead">${esc(c.name)} <span class="kcount">${c.leads.length}</span></div>
      ${c.leads.slice(0, 40).map(l => `<div class="kcard" data-lead="${l.id}" data-stage="${l.stage_id}">
        <div class="ktitle">${esc(l.name).slice(0, 80)}</div>
        <div class="muted">${esc(l.partner_name || l.referrer || '')}</div>
        <div class="kfoot"><span class="tag">${l.probability}%</span>${l.expected_revenue ? `<b>${fmt(l.expected_revenue)} đ</b>` : ''}</div>
      </div>`).join('')}
      ${c.leads.length > 40 ? `<div class="muted" style="padding:6px">+${c.leads.length - 40} nữa…</div>` : ''}
    </div>`).join('')}</div>`;
  document.getElementById('btn-lead').onclick = () => {
    modal(`<h2>Cơ hội mới</h2>
      <div class="row2"><div class="field"><label>Tiêu đề</label><input id="l-name" placeholder="VD: Nhu cầu nước cho nhà hàng…" /></div>
        <div class="field"><label>Khách hàng</label><input id="l-partner" list="dl-partners" /></div></div>
      <div class="row3"><div class="field"><label>Điện thoại</label><input id="l-phone" /></div>
        <div class="field"><label>Doanh thu dự kiến</label><input type="number" id="l-rev" value="0" /></div>
        <div class="field"><label>Nguồn</label><input id="l-source" placeholder="Giới thiệu / Vận động…" /></div></div>
      <datalist id="dl-partners">${state.meta.partners.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button onclick="closeModal()">Hủy</button><button class="btn-primary" id="l-save">Lưu</button></div>`);
    document.getElementById('l-save').onclick = async () => {
      await api('/api/crm/leads', { method: 'POST', body: JSON.stringify({ name: document.getElementById('l-name').value, partner_name: document.getElementById('l-partner').value, phone: document.getElementById('l-phone').value, expected_revenue: Number(document.getElementById('l-rev').value), source: document.getElementById('l-source').value }) });
      closeModal(); toast('Đã tạo cơ hội'); render();
    };
  };
  document.querySelectorAll('[data-lead]').forEach(el => el.onclick = async () => {
    const cur = Number(el.dataset.stage);
    const stages = d.stages;
    const idx = stages.findIndex(s => s.id === cur);
    const next = stages[Math.min(idx + 1, stages.length - 1)];
    await api('/api/crm/leads/' + el.dataset.lead, { method: 'PUT', body: JSON.stringify({ stage_id: next.id }) });
    toast('Đã chuyển sang: ' + next.name); render();
  });
}

/* ═══════ 6) VẬN CHUYỂN ═══════ */
async function viewDelivery() {
  const d = await api('/api/carriers');
  const byEmp = {}; d.workers.filter(w => w.role === 'CARRIER' && w.picking_id > 0).forEach(w => byEmp[w.employee] = (byEmp[w.employee] || 0) + (w.fee_share || 0));
  return `
  <div class="grid g2" style="margin-bottom:16px">
    <div class="card"><h3>Phương thức vận chuyển (delivery.carrier)</h3><table class="mini-table">
      <thead><tr><th>Tên</th><th>Loại tính giá</th><th>Phụ phí</th><th>Ghi chú</th></tr></thead>
      <tbody>${d.carriers.map(c => `<tr><td><b>${esc(c.name)}</b></td>
        <td>${c.delivery_type === 'fixed' ? 'Giá cố định' : 'Theo quy tắc (bảng giá)'}</td>
        <td>${c.margin ? (c.margin * 100) + '%' : '—'}</td><td class="muted">${esc(c.note || '')}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h3>Bảng giá cước (delivery.price.rule)</h3><table class="mini-table">
      <thead><tr><th>Phương thức</th><th>Điều kiện</th><th>Công thức</th></tr></thead>
      <tbody>${d.rules.map(r => `<tr><td>${esc((d.carriers.find(c => c.id === r.carrier_id) || {}).name)}</td>
        <td>${esc(r.variable)} ${esc(r.operator)} ${r.max_value}</td>
        <td class="muted">giá = ${r.base_price} + ${r.rate} × ${esc(r.factor)}</td></tr>`).join('')}</tbody></table>
      <p class="muted" style="margin-top:8px">Khi lập đơn, cước tự tính theo bảng giá này — không nhập tay.</p></div>
  </div>
  <div class="card"><h3>Phí vận chuyển theo người — chia đều cho người cùng đi giao</h3>
    <table class="mini-table"><thead><tr><th>Nhân viên</th><th class="num">Tổng phí</th></tr></thead>
    <tbody>${Object.entries(byEmp).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ═══════ 7) SỔ VỎ (tùy biến) ═══════ */
async function viewShells() {
  const period = viewShells._p || 'T9'; viewShells._p = period;
  const [rows, holders, balances, moves] = await Promise.all([api('/api/shells?period=' + period), api('/api/shells/holders'), api('/api/shells/balances'), api('/api/shells/movements')]);
  const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  document.getElementById('view').innerHTML = `
  <div class="toolbar"><b>Sổ vỏ kỳ:</b>
    <button class="${period === 'T9' ? 'btn-cyan' : ''}" data-p="T9">T9 (tháng 9)</button>
    <button class="${period === 'T8' ? 'btn-cyan' : ''}" data-p="T8">T8 (tháng 8)</button>
    <div class="spacer"></div><span class="pill">Nợ cuối kỳ: Úp ${fmt(sum('closing_up'))} · Vòi ${fmt(sum('closing_voi'))}</span></div>
  <div class="table-wrap" style="margin-bottom:16px"><table>
    <thead><tr><th rowspan="2">Người ghi nhận</th><th rowspan="2">Khách hàng</th>
      <th colspan="2" style="text-align:center">Nợ cũ</th><th colspan="2" style="text-align:center">Nhập</th><th colspan="2" style="text-align:center">Trả vỏ</th>
      <th colspan="2" style="text-align:center">Trả XN</th><th rowspan="2">Cọc</th><th colspan="2" style="text-align:center">Nợ mới</th>
      <th rowspan="2">Nợ từ ngày</th><th rowspan="2">Trả gần nhất</th><th rowspan="2">Ghi chú</th></tr>
    <tr><th class="num">Úp</th><th class="num">Vòi</th><th class="num">Úp</th><th class="num">Vòi</th><th class="num">Úp</th><th class="num">Vòi</th><th class="num">Úp</th><th class="num">Vòi</th><th class="num">Úp</th><th class="num">Vòi</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.subject)}</td><td style="white-space:normal">${esc(r.customer)}</td>
      <td class="num">${r.opening_up || ''}</td><td class="num">${r.opening_voi || ''}</td>
      <td class="num" style="color:#15803d">${r.in_up || ''}</td><td class="num" style="color:#15803d">${r.in_voi || ''}</td>
      <td class="num">${r.returned_up || ''}</td><td class="num">${r.returned_voi || ''}</td>
      <td class="num">${r.xn_up || ''}</td><td class="num">${r.xn_voi || ''}</td>
      <td class="num">${r.deposit ? fmt(r.deposit) : ''}</td><td class="num"><b>${r.closing_up || ''}</b></td><td class="num"><b>${r.closing_voi || ''}</b></td>
      <td>${esc(r.last_in_date || '')}</td><td>${esc(r.last_return_date || '')}</td>
      <td style="white-space:normal">${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>
  ${moves.length ? `<div class="card" style="margin-bottom:16px"><h3>Phát sinh nợ / trả vỏ gần đây — trả lời “nợ khi nào, trả khi nào”</h3>
    <table class="mini-table"><thead><tr><th>Ngày</th><th>Đối tượng</th><th>Khách hàng</th><th>Loại</th><th class="num">Úp</th><th class="num">Vòi</th><th>Ghi chú</th></tr></thead>
    <tbody>${moves.slice(0, 20).map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.subject)}</td><td>${esc(m.customer)}</td>
      <td>${m.kind === 'GIAO' ? '<span class="tag up">Giao bình</span>' : '<span class="tag xn">Thu hồi</span>'}</td>
      <td class="num">${m.up ? fmt(m.up) : ''}</td><td class="num">${m.voi ? fmt(m.voi) : ''}</td><td>${esc(m.note)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  <div class="grid g2">
    <div class="card"><h3>Đối tượng đang giữ vỏ (gồm nội bộ)</h3><div style="max-height:340px;overflow:auto"><table class="mini-table">
      <thead><tr><th>Người / đơn vị</th><th class="num">Lấy</th><th class="num">Trả</th><th class="num">Đang nợ</th><th></th></tr></thead>
      <tbody>${holders.map(h => `<tr><td>${esc(h.name)}</td><td class="num">${h.taken || ''}</td><td class="num">${h.returned || ''}</td>
        <td class="num"><b>${h.debt || ''}</b></td><td><button data-holder="${h.id}" style="padding:3px 8px">Thu vỏ</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Tồn vỏ rỗng theo kho</h3><table class="mini-table">
      <thead><tr><th>Kho vỏ</th><th class="num">Số lượng</th></tr></thead>
      <tbody>${balances.map(b => `<tr><td>${esc(b.warehouse_name)}</td><td class="num"><b>${fmt(b.qty)}</b></td></tr>`).join('')}</tbody></table>
      <p class="muted" style="margin-top:8px">Sổ vỏ là nghiệp vụ <b>đặc thù của xí nghiệp</b> — được thiết kế riêng.</p></div>
  </div>`;
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { viewShells._p = b.dataset.p; render(); });
  document.querySelectorAll('[data-holder]').forEach(b => b.onclick = () => openReturnShell(b.dataset.holder));
}
function openReturnShell(id) {
  modal(`<h2>Thu hồi vỏ</h2><p class="muted">Khách trả vỏ / trả về xí nghiệp.</p>
    <div class="row3"><div class="field"><label>Vỏ Úp trả</label><input type="number" id="r-up" value="0" /></div>
      <div class="field"><label>Vỏ Vòi trả</label><input type="number" id="r-voi" value="0" /></div>
      <div class="field"><label>Trả về XN</label><input type="number" id="r-xn" value="0" /></div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end"><button onclick="closeModal()">Hủy</button><button class="btn-primary" id="r-save">Xác nhận</button></div>`);
  document.getElementById('r-save').onclick = async () => {
    await api('/api/shells/return', { method: 'POST', body: JSON.stringify({ id, up: Number(document.getElementById('r-up').value), voi: Number(document.getElementById('r-voi').value), to_xn: Number(document.getElementById('r-xn').value) }) });
    closeModal(); toast('Đã cập nhật sổ vỏ'); render();
  };
}

/* ═══════ 8) DVGT (tùy biến) ═══════ */
async function viewDvgt() {
  const rows = await api('/api/dvgt');
  const done = rows.filter(r => /hoàn thành|r$|đã làm|done/i.test(r.state || ''));
  const hasDoc = rows.filter(r => /đã có/i.test(r.doc_status || ''));
  const revenue = rows.reduce((a, r) => a + (r.revenue || 0), 0);
  const st = r => { const s = (r.state || '').toLowerCase();
    if (/hủy|huỷ/.test(s)) return '<span class="tag out">Hủy</span>';
    if (/hoãn|chưa/.test(s)) return '<span class="tag">Hoãn</span>';
    if (/r$|hoàn thành|đã làm|done/.test(s)) return '<span class="tag xn">Hoàn thành</span>';
    return `<span class="tag">${esc(r.state || 'Mới')}</span>`; };
  document.getElementById('view').innerHTML = `
  <div class="toolbar"><button class="btn-primary" id="btn-dv">＋ Đăng ký dịch vụ</button>
    <input id="d-q" placeholder="Tìm khách / dịch vụ / người vận động…" style="max-width:300px" />
    <div class="spacer"></div><span class="pill">${rows.length} yêu cầu · ${done.length} hoàn thành · ${hasDoc.length} có phiếu</span></div>
  <div class="grid g3" style="margin-bottom:16px">
    <div class="stat"><div class="label">Tổng yêu cầu</div><div class="value">${rows.length}</div><div class="foot">đăng ký đa kênh</div></div>
    <div class="stat accent"><div class="label">Đã có phiếu</div><div class="value">${hasDoc.length}</div><div class="foot">còn lại chưa nộp</div></div>
    <div class="stat"><div class="label">Doanh thu dịch vụ</div><div class="value">${fmt(revenue)} đ</div><div class="foot">nhập khi hoàn thành</div></div></div>
  <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Khách hàng</th><th>Dịch vụ</th><th>Người vận động</th><th>Trạng thái</th><th>Nộp phiếu</th><th class="num">Doanh thu</th></tr></thead>
    <tbody>${rows.slice(0, 300).map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.customer)}</td><td>${esc(r.service)}</td>
      <td>${esc(r.referrer)}</td><td>${st(r)}</td><td>${esc(r.doc_status)}</td><td class="num">${r.revenue ? fmt(r.revenue) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('btn-dv').onclick = () => {
    modal(`<h2>Đăng ký dịch vụ gia tăng</h2>
      <div class="row3"><div class="field"><label>Ngày</label><input type="date" id="dv-date" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field"><label>Khách hàng</label><input id="dv-cust" /></div><div class="field"><label>Điện thoại</label><input id="dv-phone" /></div></div>
      <div class="row3"><div class="field"><label>Dịch vụ</label><select id="dv-svc"><option>Rửa bể</option><option>Rửa téc</option><option>Bể + téc</option><option>Máy giặt</option><option>Bình nóng lạnh</option><option>Thay hộp/van</option><option>Di chuyển đồng hồ</option></select></div>
        <div class="field"><label>Người vận động</label><input id="dv-ref" /></div>
        <div class="field"><label>Hình thức đăng ký</label><select id="dv-ch"><option>XN</option><option>CX</option><option>YK</option><option>CT</option><option>CTT</option><option>DV</option><option>HB</option><option>LĐ</option><option>KD</option><option>SCC</option></select></div></div>
      <div class="row3"><div class="field"><label>Trạng thái</label><select id="dv-st"><option>Mới</option><option>Hoàn thành</option><option>Hoãn</option><option>Hủy</option></select></div>
        <div class="field"><label>Nộp phiếu</label><select id="dv-doc"><option>Chưa có phiếu</option><option>Đã có phiếu</option></select></div>
        <div class="field"><label>Doanh thu</label><input type="number" id="dv-rev" value="0" /></div></div>
      <div class="field"><label>Mô tả</label><input id="dv-desc" /></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button onclick="closeModal()">Hủy</button><button class="btn-primary" id="dv-save">Lưu</button></div>`);
    document.getElementById('dv-save').onclick = async () => {
      await api('/api/dvgt', { method: 'POST', body: JSON.stringify({ date: document.getElementById('dv-date').value, customer: document.getElementById('dv-cust').value, phone: document.getElementById('dv-phone').value, service: document.getElementById('dv-svc').value, referrer: document.getElementById('dv-ref').value, channel: document.getElementById('dv-ch').value, state: document.getElementById('dv-st').value, doc_status: document.getElementById('dv-doc').value, revenue: Number(document.getElementById('dv-rev').value) || 0, description: document.getElementById('dv-desc').value }) });
      closeModal(); toast('Đã lưu dịch vụ'); render();
    };
  };
  document.getElementById('d-q').oninput = e => { const q = e.target.value.toLowerCase(); document.querySelectorAll('tbody tr').forEach(tr => tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'); };
}

/* ═══════ 9) KPI (tùy biến) ═══════ */
async function viewKpi() {
  const d = await api('/api/kpi');
  const plan = d.plan || { target: 0, headcount: 0, year: 2026 };
  const per = plan.headcount ? plan.target / plan.headcount : 0;
  const sumTotal = d.employees.reduce((a, e) => a + (e.total || 0), 0);
  const maxS = Math.max(...d.byStation.map(s => s.value), 1);
  return `
  <div class="grid g4" style="margin-bottom:16px">
    <div class="stat accent"><div class="label">Kế hoạch năm ${plan.year}</div><div class="value">${fmt(plan.target)} đ</div><div class="foot">toàn xí nghiệp</div></div>
    <div class="stat"><div class="label">CBCNV</div><div class="value">${plan.headcount}</div><div class="foot">được giao chỉ tiêu</div></div>
    <div class="stat"><div class="label">Bình quân / người</div><div class="value">${fmt(per)} đ</div><div class="foot">/tháng ~ ${fmt(per / 12)} đ</div></div>
    <div class="stat"><div class="label">Doanh thu ghi nhận</div><div class="value">${fmt(sumTotal)} đ</div><div class="foot">theo người bán + DVGT</div></div></div>
  <div class="grid g2" style="margin-bottom:16px">
    <div class="card"><h3>Doanh thu theo Trạm / Bộ phận</h3><div class="bars">${d.byStation.map(s => `
      <div class="bar-row"><div>${esc(s.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, s.value / maxS * 100)}%"></div></div>
      <div class="bar-val">${fmt(s.value)}</div></div>`).join('')}</div></div>
    <div class="card"><h3>Cách tính</h3><div class="kv">
      • Thực tế = doanh thu nước gán cho <b>người bán</b> + doanh thu <b>DVGT</b>.<br>
      • % hoàn thành = Thực tế ÷ (Kế hoạch năm ÷ 12).<br>
      • Mô hình kế hoạch năm/người là phần <b>thiết kế riêng cho xí nghiệp</b>.<br>
      • Báo cáo theo Trạm và BPKD, không dùng xếp loại A/B/C.</div></div></div>
  <div class="table-wrap"><table><thead><tr><th>#</th><th>CBCNV</th><th>Chức danh</th><th>Trạm</th><th class="num">Lũy kế</th><th class="num">% kế hoạch năm</th><th>Tiến độ</th></tr></thead>
    <tbody>${d.employees.slice(0, 120).map((e, i) => { const pct = plan.target ? e.total / plan.target * 100 : 0;
      return `<tr><td>${i + 1}</td><td><b>${esc(e.name)}</b></td><td>${esc(e.position)}</td><td>${esc(e.station)}</td>
      <td class="num">${fmt(e.total)}</td><td class="num">${pct.toFixed(2)}%</td>
      <td style="min-width:120px"><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, pct * 8)}%"></div></div></td></tr>`; }).join('')}</tbody></table></div>`;
}

/* ═══════ 10) VIỆC CẦN XỬ LÝ ═══════ */
async function viewWorklist() {
  const d = await api('/api/worklist');
  const box = (t, n, color, rows, head, body) => `
    <div class="card"><h3>${t} <span class="tag ${color}">${n}</span></h3>
      ${rows.length ? `<table class="mini-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${body(r)}</tr>`).join('')}</tbody></table>` : '<div class="muted">Không có — tốt.</div>'}
    </div>`;
  return `
  <div class="banner" style="background:#eef2f7;border-color:#dbe3ee;color:#334155">
    Đây là những việc <b>người quản lý cần xử lý ngay</b> — hệ thống tự tổng hợp từ mọi nghiệp vụ.</div>
  <div class="grid g2">
    ${box('Đơn đã xác nhận nhưng chưa giao xong', d.notDelivered.length, 'out', d.notDelivered,
      ['Mã đơn', 'Ngày', 'Đối tác', 'Người bán', 'Giá trị'],
      r => `<td><b>${esc(r.name)}</b></td><td>${esc(r.date)}</td><td>${esc(r.partner_name || '')}</td><td>${esc(r.seller || '')}</td><td class="num">${fmt(r.amount_total)}</td>`)}
    ${box('Phiếu kho chờ xác nhận', d.pendingPick.length, 'out', d.pendingPick,
      ['Phiếu', 'Loại', 'Nguồn → Đích', 'Trạng thái'],
      r => `<td><b>${esc(r.name)}</b></td><td>${r.type_code === 'incoming' ? 'Nhập' : r.type_code === 'outgoing' ? 'Xuất' : 'Chuyển'}</td><td>${esc(r.src)} → ${esc(r.dest)}</td><td>${chip(r.state)}</td>`)}
    ${box('Tiền chưa thu (còn phải thu)', d.unpaid.length, 'out', d.unpaid.slice(0, 15),
      ['Mã đơn', 'Ngày', 'Đối tác', 'Người bán', 'Còn lại'],
      r => `<td><b>${esc(r.name)}</b></td><td>${esc(r.date)}</td><td>${esc(r.partner_name || '')}</td><td>${esc(r.seller || '')}</td><td class="num"><b>${fmt(r.remain)}</b></td>`)}
    ${box('Kho dưới ngưỡng cần nhập', d.lowStock.length, 'xn', d.lowStock,
      ['Sản phẩm', 'Vị trí', 'Còn lại'],
      r => `<td>${esc(r.product_code)}</td><td>${esc(r.location_name)}</td><td class="num"><b>${fmt(r.quantity)}</b></td>`)}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Dịch vụ chưa nộp phiếu</h3>
      <div class="stat accent" style="border:none;padding:0"><div class="value">${d.dvgtNoDoc}</div>
      <div class="foot">yêu cầu dịch vụ chưa có phiếu — xem màn Dịch vụ gia tăng</div></div></div>
    <div class="card"><h3>Khách / nội bộ đang giữ vỏ</h3>
      <div class="stat warn" style="border:none;padding:0"><div class="value">${d.shellOpen}</div>
      <div class="foot">đối tượng còn nợ vỏ — xem Sổ nợ vỏ bình</div></div></div>
  </div>`;
}

/* ═══════ 11) TIỀN THEO NHÂN VIÊN ═══════ */
async function viewCash() {
  const d = await api('/api/cash');
  return `
  <div class="grid g3" style="margin-bottom:16px">
    <div class="stat"><div class="label">Doanh thu theo nhân viên</div><div class="value">${fmt(d.total.revenue)} đ</div><div class="foot">tổng bán ra</div></div>
    <div class="stat accent"><div class="label">Đã thu</div><div class="value">${fmt(d.total.collected)} đ</div><div class="foot">tiền đã về</div></div>
    <div class="stat warn"><div class="label">Còn phải thu</div><div class="value">${fmt(d.total.outstanding)} đ</div><div class="foot">đang treo</div></div>
  </div>
  <p class="muted" style="margin-bottom:10px">Trả lời câu hỏi quản lý: <b>ai bán bao nhiêu, đã thu bao nhiêu, còn treo bao nhiêu</b> — quan hệ giữa Nhân viên và Bán hàng/Thu tiền.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Nhân viên</th><th class="num">Số đơn</th><th class="num">Doanh thu</th><th class="num">Đã thu</th><th class="num">Còn phải thu</th><th style="width:180px">Tỷ lệ đã thu</th></tr></thead>
    <tbody>${d.rows.slice(0, 60).map(r => { const pct = r.revenue ? r.collected / r.revenue * 100 : 0;
      return `<tr><td><b>${esc(r.name)}</b></td><td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.revenue)}</td>
        <td class="num" style="color:#15803d">${fmt(r.collected)}</td>
        <td class="num" style="color:${r.outstanding ? '#c62430' : '#64748b'}">${r.outstanding ? fmt(r.outstanding) : '—'}</td>
        <td><div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(0)}%"></div></div></td></tr>`; }).join('')}
      <tr class="tot"><td>CỘNG</td><td></td><td class="num">${fmt(d.total.revenue)}</td><td class="num">${fmt(d.total.collected)}</td><td class="num">${fmt(d.total.outstanding)}</td><td></td></tr>
    </tbody></table></div>`;
}

/* ═══════ 12) CÔNG NỢ TIỀN THEO KHÁCH ═══════ */
async function viewCustDebt() {
  const rows = await api('/api/customer-debts');
  const totalDebt = rows.reduce((a, r) => a + r.debt, 0);
  return `
  <div class="grid g3" style="margin-bottom:16px">
    <div class="stat"><div class="label">Số khách có giao dịch</div><div class="value">${rows.length}</div><div class="foot">trong dữ liệu</div></div>
    <div class="stat warn"><div class="label">Tổng còn phải thu</div><div class="value">${fmt(totalDebt)} đ</div><div class="foot">công nợ tiền</div></div>
    <div class="stat"><div class="label">Khách đang nợ</div><div class="value">${rows.filter(r => r.debt > 0).length}</div><div class="foot">cần theo dõi</div></div>
  </div>
  <p class="muted" style="margin-bottom:10px">Quan hệ <b>Khách hàng ↔ Bán hàng</b>: khách nào còn nợ tiền, nợ bao nhiêu, giao dịch gần nhất khi nào.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Khách hàng</th><th class="num">Số đơn</th><th class="num">Tổng mua</th><th class="num">Đã trả</th><th class="num">Còn nợ</th><th>Đơn gần nhất</th></tr></thead>
    <tbody>${rows.filter(r => r.orders > 0).slice(0, 80).map(r => `<tr>
      <td><b>${esc(r.name)}</b></td><td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.revenue)}</td>
      <td class="num">${fmt(r.paid)}</td><td class="num" style="color:${r.debt ? '#c62430' : '#64748b'}">${r.debt ? fmt(r.debt) : '—'}</td>
      <td>${esc(r.last_order || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ═══════ 13) BẢN ĐỒ QUAN HỆ ═══════ */
async function viewRelations() {
  const d = await api('/api/relations');
  const bar = (arr, unit) => { const max = Math.max(...arr.map(a => a.revenue || a.qty || a.debt || a.fee || 0), 1);
    return arr.map(a => { const v = a.revenue || a.qty || a.debt || a.fee || 0;
      return `<div class="bar-row"><div>${esc(a.name || '(trống)')}${a.counts_for_kpi === 0 ? ' <span class="tag out">ngoài XN</span>' : ''}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, v / max * 100)}%"></div></div>
        <div class="bar-val">${fmt(v)}${unit || ''}</div></div>`; }).join(''); };
  return `
  <div class="banner" style="background:#eef2f7;border-color:#dbe3ee;color:#334155">
    Giá trị của ERP nằm ở chỗ quản lý được <b>quan hệ</b> giữa 5 trụ — không chỉ quản lý từng danh mục riêng lẻ.
    Dưới đây là số liệu thật cho từng mối quan hệ.</div>

  <div class="card" style="margin-bottom:16px">
    <h3>Sơ đồ quan hệ</h3>
    <div class="mapgrid">
      <div class="mnode s">SẢN PHẨM</div>
      <div class="mnode n">NHÂN VIÊN</div>
      <div class="mnode b">BÁN HÀNG</div>
      <div class="mnode k">KHÁCH HÀNG</div>
      <div class="mnode w">KHO</div>
    </div>
    <table class="mini-table" style="margin-top:12px">
      <thead><tr><th style="width:34%">Quan hệ</th><th>Nhà quản lý cần biết</th><th>Số liệu / nơi xem</th></tr></thead>
      <tbody>
        <tr><td><b>Nhân viên → Bán hàng</b></td><td>Ai bán bao nhiêu?</td><td>${d.sellers.length} nhân viên — xem “Tiền theo nhân viên”</td></tr>
        <tr><td><b>Nhân viên → Thu tiền</b></td><td>Ai thu, còn treo bao nhiêu?</td><td>Xem cột “Còn phải thu” ở màn Tiền theo nhân viên</td></tr>
        <tr><td><b>Nhân viên → Kho</b></td><td>Ai đang giữ vỏ?</td><td>${d.workers.length} người nhận phí vận chuyển</td></tr>
        <tr><td><b>Khách hàng → Bán hàng</b></td><td>Khách nào nợ tiền?</td><td>${d.customers.length} khách lớn — xem “Công nợ tiền”</td></tr>
        <tr><td><b>Khách hàng → Vỏ bình</b></td><td>Nợ bình khi nào, trả khi nào?</td><td>${d.shells.length} đối tượng còn nợ — xem “Sổ nợ vỏ bình”</td></tr>
        <tr><td><b>Sản phẩm → Kho</b></td><td>Mặt hàng tồn ở đâu?</td><td>${d.stock.length} vị trí — xem “Tồn kho”</td></tr>
        <tr><td><b>Bán hàng → Kênh</b></td><td>Kênh nào hiệu quả, kênh nào ngoài xí nghiệp?</td><td>${d.channels.length} kênh</td></tr>
      </tbody></table>
  </div>

  <div class="grid g2">
    <div class="card"><h3>Doanh thu theo kênh</h3><div class="bars">${bar(d.channels, ' đ')}</div></div>
    <div class="card"><h3>Doanh thu theo nhân viên</h3><div class="bars">${bar(d.sellers, ' đ')}</div></div>
    <div class="card"><h3>Doanh thu theo khách hàng</h3><div class="bars">${bar(d.customers, ' đ')}</div></div>
    <div class="card"><h3>Nợ vỏ theo đối tượng</h3><div class="bars">${bar(d.shells, '')}</div></div>
    <div class="card"><h3>Tồn kho theo vị trí</h3><div class="bars">${bar(d.stock, '')}</div></div>
    <div class="card"><h3>Phí vận chuyển theo người</h3><div class="bars">${bar(d.workers, ' đ')}</div></div>
  </div>`;
}

/* ── sự kiện chung ── */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]'); if (g) return go(g.dataset.goto);
  const o = e.target.closest('[data-order]'); if (o) return openOrderForm(o.dataset.order);
  const p = e.target.closest('[data-pick]'); if (p) return openPicking(p.dataset.pick);
});
(async () => {
  try {
    state.meta = await api('/api/meta');
    renderNav();
    const [v, prm] = (location.hash.slice(1) || 'overview').split('/');
    go(v, prm);
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="banner">Không kết nối được API: ${esc(e.message)}<br>
      Chắc chắn <b>npm run demo</b> đang chạy và mở đúng <b>http://127.0.0.1:4390</b> bằng Chrome/Edge.
      Kiểm tra: <b>http://127.0.0.1:4390/api/health</b>.</div>`;
  }
})();
