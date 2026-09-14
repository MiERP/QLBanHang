/**
 * ============================================================================
 * QAROMI ERP — FRONTEND APPLICATION JAVASCRIPT (v5 - MiERP Architecture)
 * Tương tác đầy đủ theo 3 Trụ Nâng Cấp:
 * 1. Chu Trình Vận Hành Mô Phỏng (Live Simulation Wizard)
 * 2. Trải nghiệm ERP chuẩn MiERP: App Switcher, Role Selector, Document Statusbar
 * 3. Bản Đồ Kiến Trúc Giải Pháp & Từ Điển Dữ Liệu (Blueprint & Data Dictionary)
 * ============================================================================
 */

const state = {
  view: 'overview',
  appFilter: 'all',
  role: 'all',
  products: [],
  meta: null,
  simState: null
};

// Utilities
const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) {
      let msg = 'Lỗi ' + res.status;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    return await res.json();
  } catch (err) {
    showToast(err.message);
    throw err;
  }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

const backdrop = document.getElementById('modal-backdrop');
if (backdrop) {
  backdrop.addEventListener('click', e => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
}

// ══════════════════════════ MENU DEFINITION & APP MAPPING ══════════════════════════ //
const MENU = [
  {
    group: 'CHU TRÌNH & ĐIỀU HÀNH',
    app: 'all',
    items: [
      { id: 'simulation', name: '⚡ Chu trình mô phỏng', icon: '▶', highlight: true },
      { id: 'overview', name: 'Bảng điều khiển', icon: '📊' },
      { id: 'worklist', name: 'Việc cần xử lý ngay', icon: '⚡' },
    ]
  },
  {
    group: 'PHÂN HỆ BÁN HÀNG & PHÂN PHỐI',
    app: 'sales',
    items: [
      { id: 'commercial', name: '📑 Báo cáo thương mại QAROMI', icon: '📑', highlight: true },
      { id: 'orders', name: 'Đơn bán & Báo giá (SO)', icon: '🧾' },
      { id: 'products', name: 'Danh mục & Bảng giá', icon: '📦' },
      { id: 'cash', name: 'Tiền thu & Công nợ', icon: '💰' },
    ]
  },
  {
    group: 'PHÂN HỆ KHO VẬN & ĐỘI XE',
    app: 'stock',
    items: [
      { id: 'pickings', name: 'Lệnh kho kép (Nhập/Xuất)', icon: '📋' },
      { id: 'quants', name: 'Tồn kho theo vị trí', icon: '🏬' },
      { id: 'moves', name: 'Dòng dịch chuyển kho', icon: '🔄' },
      { id: 'interbranch', name: 'Tiếp ứng CP & Vay mượn', icon: '🚛' },
      { id: 'delivery', name: 'Phí vận chuyển theo người', icon: '🚚' },
    ]
  },
  {
    group: 'PHÂN HỆ SỔ NỢ VỎ BÌNH',
    app: 'shell',
    items: [
      { id: 'shells', name: 'Sổ nợ vỏ bình đa kỳ', icon: '🧴' },
    ]
  },
  {
    group: 'PHÂN HỆ DỊCH VỤ GIA TĂNG (DVGT)',
    app: 'fsm',
    items: [
      { id: 'dvgt', name: 'DVGT & Kỹ thuật mạng nước', icon: '🔧' },
    ]
  },
  {
    group: 'PHÂN HỆ NHÂN SỰ & THI ĐUA',
    app: 'kpi',
    items: [
      { id: 'kpi', name: 'Thi đua Kế hoạch năm', icon: '🎯' },
      { id: 'guards', name: 'Trực bảo vệ & Bốc xếp', icon: '🛡️' },
    ]
  },
  {
    group: 'KIẾN TRÚC & GIẢI PHÁP ERP',
    app: 'blueprint',
    items: [
      { id: 'blueprint', name: '🏛️ Kiến trúc & Giải pháp', icon: '📐', highlight: true },
      { id: 'audit', name: 'Kiểm toán Excel & Lỗi #REF!', icon: '⚠️' },
      { id: 'relations', name: 'Bản đồ kiến trúc 5 trụ', icon: '🕸️' },
    ]
  }
];

const TITLES = {
  simulation: ['⚡ Mô Phỏng Chu Trình Vận Hành Mẫu (Live Simulation)', 'Trải nghiệm trực quan quy trình khép kín: Báo giá ➔ Xuất kho ➔ Giao hàng & Vỏ ➔ Tự động cập nhật 4 sổ sách'],
  blueprint: ['🏛️ Kiến Trúc Tổng Thể Hệ Thống QAROMI ERP (MiERP Pattern)', 'Sơ đồ luồng dữ liệu tương tác · 6 Phân hệ nghiệp vụ · Từ điển dữ liệu Data Dictionary'],
  overview: ['Bảng Điều Khiển Điều Hành', 'Tổng hợp toàn diện doanh số, kho hàng, nợ vỏ và việc cần xử lý hôm nay'],
  worklist: ['Việc Cần Xử Lý Ngay', 'Cảnh báo đơn chờ giao · tiền chưa thu · phiếu chờ xác nhận · kho dưới ngưỡng'],
  products: ['Danh Mục Sản Phẩm & Bảng Giá', 'Quy cách nước tinh khiết RO, Kiềm 19L, chai đóng vỉ/hộp và quy định cọc vỏ'],
  commercial: ['Báo Cáo Thương Mại Nước Ion Kiềm QAROMI', 'Biểu mẫu tiêu thụ nước thương mại gửi Công ty mẹ QUAWACO · Bóc tách từ file Nước thương mại.xlsx · Giá chưa thuế VAT 8% & Lũy kế YTD'],
  orders: ['Quản Lý Đơn Bán Hàng (SO)', 'Báo giá ➔ Xác nhận đơn ➔ Tự sinh phiếu kho ➔ Áp dụng khuyến mãi 10+1'],
  dvgt: ['Dịch Vụ Gia Tăng & Kỹ Thuật Tuyến Mạng Nước Sạch', 'Mã đồng hồ QUAWACO (HG095791) · Vật tư thay thế BNL (Thanh Magie) · Hẹn giờ Time-slot'],
  pickings: ['Quản Lý Phiếu Kho (Stock Pickings)', 'Nhập từ Cẩm Phả · Xuất giao khách · Điều chuyển xe tải điện · Bút toán kép'],
  quants: ['Tồn Kho Thời Gian Thực Theo Vị Trí', 'Kho Tăng Áp, Kho Huế, Kho Văn Phòng, Xe tải điện (chống tồn âm)'],
  moves: ['Dòng Dịch Chuyển Kho (Double-entry Move)', 'Mọi biến động đều có đối ứng Nguồn ➔ Đích theo chuẩn Odoo/MiERP'],
  interbranch: ['Tiếp Ứng Nhà Máy Cẩm Phả & Vay Mượn Kho Nội Bộ', 'Nhập tiếp ứng từ Cẩm Phả về Kho Huế/Tăng Áp · Sổ vay mượn hàng/vỏ với Đơn vị bạn (BC, QY, CP)'],
  shells: ['Sổ Nợ Vỏ Bình & Tiền Cọc (Returnable Asset)', 'Nợ cũ + Lấy mới - Trả vỏ = Còn nợ (tách bình Úp/Vòi, quản lý tiền cọc 50k)'],
  delivery: ['Phí Vận Chuyển Theo Người (Delivery Share)', 'Cước chuẩn 5.000đ/bình tự động chia đều cho nhóm người cùng đi giao'],
  guards: ['Lịch Trực Tổ Bảo Vệ & Phụ Cấp Bốc Xếp', 'Lịch trực bốc xếp nước theo ngày cho 7 bảo vệ (Hoàng, Vượng, Hằng, Thùy, Thơm, Huy, Thu...)'],
  cash: ['Tiền Thu Theo Nhân Viên & Công Nợ', 'Theo dõi tiền mặt COD shipper đang giữ và nợ đọng cơ quan, đại lý'],
  kpi: ['Chỉ Tiêu & Thi Đua Kế Hoạch Năm 2026', 'Tiến độ hoàn thành kế hoạch 1.59 tỷ VNĐ của gần 200 CBCNV theo từng tháng'],
  audit: ['Báo Cáo Kiểm Toán Rủi Ro Excel & Bằng Chứng Chuyển Đổi Số', 'Phát hiện 12 ô tính lỗi #REF! tại Sheet TỒN · Rủi ro thất thoát vật tư và giải pháp ERP thay thế'],
  relations: ['Bản Đồ Quan Hệ 5 Trụ Kiến Trúc', 'Mối liên kết khép kín giữa Khách hàng ➔ Đơn bán ➔ Phiếu kho ➔ Vỏ bình ➔ Dòng tiền ➔ KPI'],
};

// ══════════════════════════ NAVIGATION & APP SWITCHER ══════════════════════════ //
function renderNav() {
  const container = document.getElementById('nav');
  if (!container) return;
  let html = '';

  for (const group of MENU) {
    if (state.appFilter !== 'all' && group.app !== 'all' && group.app !== state.appFilter) {
      continue;
    }
    html += `<div class="nav-group-title">${group.group}</div>`;
    for (const item of group.items) {
      const active = state.view === item.id ? 'active' : '';
      const style = item.highlight ? 'style="color:#60a5fa; font-weight:700;"' : '';
      html += `
        <div class="nav-item ${active}" data-view="${item.id}" ${style}>
          <span class="nav-icon">${item.icon}</span>
          <span>${item.name}</span>
        </div>
      `;
    }
  }
  container.innerHTML = html;
}

function navigateTo(viewId) {
  state.view = viewId;
  location.hash = viewId;
  renderNav();
  const [title, sub] = TITLES[viewId] || [viewId, ''];
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-sub');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  renderView();
}

// ══════════════════════════ ROLE PERSPECTIVE ══════════════════════════ //
const ROLES_INFO = {
  all: null,
  dispatch: {
    avatar: '👤',
    title: 'Bàn làm việc: Điều Phối Viên Bán Hàng & DVGT (Nhung / Quang)',
    desc: 'Theo dõi 7 đơn chờ duyệt · 4 ca DVGT hẹn hôm nay · Phân bổ chuyến xe tải điện & nhân lực bốc xếp.',
    actions: [
      { label: '🧾 Đơn chờ xử lý', view: 'orders' },
      { label: '🔧 Lịch hẹn DVGT', view: 'dvgt' },
      { label: '⚡ Chạy chu trình mẫu', view: 'simulation' }
    ]
  },
  driver: {
    avatar: '🚚',
    title: 'Bàn làm việc: Lái Xe Giao Hàng & Thu Nợ Vỏ (Phương)',
    desc: 'Kho lưu động xe tải điện · Nhận cước 5.000đ/bình (chia cùng bảo vệ) · Quyết toán vỏ rỗng & tiền mặt COD cuối ngày.',
    actions: [
      { label: '🚚 Chuyến xe & Thù lao', view: 'delivery' },
      { label: '🧴 Sổ thu hồi vỏ rỗng', view: 'shells' },
      { label: '💰 Tiền mặt cần nộp', view: 'cash' }
    ]
  },
  stock: {
    avatar: '🏭',
    title: 'Bàn làm việc: Thủ Kho Tăng Áp & Kho Huế',
    desc: 'Kiểm soát mức tồn an toàn 6 vị trí kho · Bút toán kép Nguồn ➔ Đích chống tồn âm · Tiếp ứng từ Cẩm Phả.',
    actions: [
      { label: '🏬 Tồn kho các điểm', view: 'quants' },
      { label: '📋 Phiếu kho chờ xuất', view: 'pickings' },
      { label: '🚛 Tiếp ứng Cẩm Phả', view: 'interbranch' }
    ]
  },
  technician: {
    avatar: '🔧',
    title: 'Bàn làm việc: Kỹ Thuật Viên DVGT & Tuyến Mạng Nước Sạch',
    desc: 'Tiếp nhận ca hẹn theo Time-slot · Khách hàng theo mã ĐH QUAWACO · Vật tư linh kiện (thanh Magie, phao, zoăng).',
    actions: [
      { label: '🔧 Ca DVGT cần làm', view: 'dvgt' },
      { label: '📦 Phụ tùng trong kho', view: 'quants' },
      { label: '🎯 Thi đua cá nhân', view: 'kpi' }
    ]
  },
  director: {
    avatar: '👑',
    title: 'Bàn làm việc: Ban Giám Đốc Xí Nghiệp Nước Hòn Gai',
    desc: 'Giám sát mục tiêu 1.592.834.000 đ của 202 CBCNV · Doanh thu theo Kênh Xí nghiệp / Đơn vị bạn · Báo cáo kiểm toán.',
    actions: [
      { label: '📊 Bảng điều khiển toàn diện', view: 'overview' },
      { label: '🎯 Tiến độ chỉ tiêu 2026', view: 'kpi' },
      { label: '🏛️ Kiến trúc giải pháp', view: 'blueprint' }
    ]
  }
};

function renderRoleBanner() {
  const banner = document.getElementById('role-banner');
  if (!banner) return;
  const info = ROLES_INFO[state.role];
  if (!info) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div class="role-banner-content">
      <div class="role-avatar">${info.avatar}</div>
      <div>
        <div class="role-info-title">${esc(info.title)}</div>
        <div class="role-info-desc">${esc(info.desc)}</div>
      </div>
    </div>
    <div class="role-actions">
      ${info.actions.map(a => `
        <button class="role-action-btn" data-view="${a.view}">${esc(a.label)}</button>
      `).join('')}
    </div>
  `;

  banner.querySelectorAll('.role-action-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });
}

// ══════════════════════════ EVENT LISTENERS SETUP ══════════════════════════ //
function setupGlobalEvents() {
  window.addEventListener('hashchange', () => {
    const hash = location.hash.slice(1);
    if (hash && TITLES[hash]) navigateTo(hash);
  });

  const navEl = document.getElementById('nav');
  if (navEl) {
    navEl.addEventListener('click', e => {
      const item = e.target.closest('[data-view]');
      if (item) navigateTo(item.dataset.view);
    });
  }

  // App Switcher Grid
  const appGrid = document.getElementById('app-switcher-grid');
  if (appGrid) {
    appGrid.addEventListener('click', e => {
      const chip = e.target.closest('[data-app]');
      if (!chip) return;
      appGrid.querySelectorAll('.app-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.appFilter = chip.dataset.app;
      renderNav();

      // Quick jump if current view doesn't match app
      if (state.appFilter === 'sales' && !['orders', 'products', 'cash'].includes(state.view)) navigateTo('orders');
      else if (state.appFilter === 'stock' && !['pickings', 'quants', 'moves', 'interbranch', 'delivery'].includes(state.view)) navigateTo('quants');
      else if (state.appFilter === 'shell') navigateTo('shells');
      else if (state.appFilter === 'fsm') navigateTo('dvgt');
      else if (state.appFilter === 'kpi' && !['kpi', 'guards', 'cash'].includes(state.view)) navigateTo('kpi');
      else if (state.appFilter === 'blueprint' && !['blueprint', 'audit', 'relations'].includes(state.view)) navigateTo('blueprint');
    });
  }

  // Role Selector
  const roleSelect = document.getElementById('role-select');
  if (roleSelect) {
    roleSelect.addEventListener('change', e => {
      state.role = e.target.value;
      renderRoleBanner();
    });
  }

  // Simulation CTA Buttons
  const topSimBtn = document.getElementById('top-sim-btn');
  if (topSimBtn) topSimBtn.addEventListener('click', () => navigateTo('simulation'));

  const sideSimBtn = document.getElementById('sidebar-sim-btn');
  if (sideSimBtn) sideSimBtn.addEventListener('click', () => navigateTo('simulation'));

  const btnOrder = document.getElementById('btn-quick-order');
  if (btnOrder) btnOrder.addEventListener('click', () => openCreateOrderModal());

  const btnDvgt = document.getElementById('btn-quick-dvgt');
  if (btnDvgt) btnDvgt.addEventListener('click', () => openCreateDvgtModal());
}

// ══════════════════════════ BADGE & STATUSBAR HELPERS ══════════════════════════ //
function renderBadge(status) {
  const m = {
    draft: ['Dự thảo / Báo giá', 'badge-draft'],
    sale: ['Đã duyệt đơn', 'badge-sale'],
    done: ['Hoàn thành', 'badge-done'],
    confirmed: ['Sẵn sàng xuất', 'badge-purple'],
    assigned: ['Đang thực hiện', 'badge-warning'],
    completed: ['Đã có phiếu', 'badge-done'],
    cancelled: ['Đã hủy', 'badge-danger'],
  };
  const [txt, cls] = m[status] || [status, 'badge-draft'];
  return `<span class="badge ${cls}">${txt}</span>`;
}

function renderDocStatusbar(currentStatus) {
  const steps = [
    { key: 'draft', label: '1. Báo giá (Draft)' },
    { key: 'sale', label: '2. Đơn bán (Sale)' },
    { key: 'delivery', label: '3. Xuất kho (Delivery)' },
    { key: 'done', label: '4. Hoàn tất (Done)' },
  ];

  let currentIndex = 0;
  if (currentStatus === 'sale') currentIndex = 1;
  else if (currentStatus === 'delivery' || currentStatus === 'confirmed') currentIndex = 2;
  else if (currentStatus === 'done') currentIndex = 3;

  return `
    <div class="doc-statusbar">
      ${steps.map((s, idx) => {
        let cls = '';
        if (idx === currentIndex) cls = 'active';
        else if (idx < currentIndex) cls = 'passed';
        return `<span class="doc-status-step ${cls}">${s.label}</span>`;
      }).join('')}
    </div>
  `;
}

// ══════════════════════════ RENDER VIEWS DISPATCHER ══════════════════════════ //
async function renderView() {
  const container = document.getElementById('view-container');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Đang tải dữ liệu...</div>`;

  try {
    switch (state.view) {
      case 'simulation': await renderSimulation(container); break;
      case 'blueprint': await renderBlueprint(container); break;
      case 'commercial': await renderCommercial(container); break;
      case 'overview': await renderOverview(container); break;
      case 'worklist': await renderWorklist(container); break;
      case 'products': await renderProducts(container); break;
      case 'orders': await renderOrders(container); break;
      case 'dvgt': await renderDvgt(container); break;
      case 'pickings': await renderPickings(container); break;
      case 'quants': await renderQuants(container); break;
      case 'moves': await renderMoves(container); break;
      case 'shells': await renderShells(container); break;
      case 'delivery': await renderDelivery(container); break;
      case 'cash': await renderCash(container); break;
      case 'kpi': await renderKpi(container); break;
      case 'interbranch': await renderInterbranch(container); break;
      case 'guards': await renderGuards(container); break;
      case 'audit': await renderAudit(container); break;
      case 'relations': await renderRelations(container); break;
      default: await renderOverview(container); break;
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:20px; color:#dc2626;">Lỗi tải màn hình: ${err.message}</div>`;
  }
}

// ══════════════════════════ 1. LIVE SIMULATION WIZARD ══════════════════════════ //
async function renderSimulation(el) {
  const sim = await api('/api/simulation/state');
  state.simState = sim;

  // Also query live data for inspection panels if simulation has started
  let simOrder = null;
  let simPicking = null;
  let simShell = null;
  let simKpi = null;

  if (sim.step >= 1) {
    try {
      const orders = await api('/api/orders');
      simOrder = orders.find(o => o.name === 'SO/2026/09/SIM-01');
    } catch (e) {}
  }
  if (sim.step >= 2) {
    try {
      const pickings = await api('/api/pickings');
      simPicking = pickings.find(p => p.name === 'WH/OUT/SIM-01');
    } catch (e) {}
  }
  if (sim.step >= 3) {
    try {
      const shells = await api('/api/shells');
      simShell = shells.ledgers.find(l => l.customer.includes('Tuấn Anh'));
      const kpis = await api('/api/kpi');
      simKpi = kpis.employees.find(e => e.name.includes('Lương Minh Hương'));
    } catch (e) {}
  }

  el.innerHTML = `
    <!-- Hero Banner -->
    <div class="sim-hero-banner">
      <div>
        <div class="sim-hero-title">⚡ CHU TRÌNH VẬN HÀNH MÔ PHỎNG THỰC TẾ (END-TO-END WORKFLOW)</div>
        <div class="sim-hero-subtitle">
          Khám phá cách QAROMI ERP tự động hóa chu trình khép kín thay thế toàn bộ bảng tính Excel rời rạc:
          Từ lúc Tiếp thị nhận đơn ➔ Điều phối xe nạp kho ➔ Giao hàng & thu vỏ ➔ Tự động cập nhật đồng thời 4 Sổ sách.
        </div>
      </div>
      <div>
        <button class="btn btn-secondary btn-sm" id="btn-sim-reset" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.25);">
          ↺ Đặt lại từ đầu (Reset)
        </button>
      </div>
    </div>

    <!-- Stepper 4 Steps -->
    <div class="sim-stepper-grid">
      <!-- Step 1 -->
      <div class="sim-step-card ${sim.step === 0 ? 'active' : (sim.step >= 1 ? 'completed' : '')}">
        <div class="sim-step-header">
          <div class="sim-step-number">${sim.step >= 1 ? '✓' : '1'}</div>
          <span class="sim-step-badge ${sim.step >= 1 ? 'badge-done' : (sim.step === 0 ? 'badge-primary' : 'badge-draft')}">
            ${sim.step >= 1 ? 'Đã hoàn tất' : (sim.step === 0 ? 'Chờ kích hoạt' : 'Đã xong')}
          </span>
        </div>
        <div class="sim-step-title">Bước 1: Tiếp nhận Đơn & KM</div>
        <div class="sim-step-desc">
          Tổ Tiếp thị nhận đơn Nhà hàng Tuấn Anh: 20 bình Kiềm 19L + 2 bình KM (10+1) = 1.040.000đ. Hệ thống sinh báo giá SO/2026/09/SIM-01.
        </div>
        <div>
          ${sim.step === 0 ? `
            <button class="sim-step-btn btn-run" data-step="1">▶ 1. Tạo Báo Giá Đơn Hàng</button>
          ` : `
            <button class="sim-step-btn btn-done">✓ Đã sinh báo giá</button>
          `}
        </div>
      </div>

      <!-- Step 2 -->
      <div class="sim-step-card ${sim.step === 1 ? 'active' : (sim.step >= 2 ? 'completed' : '')}">
        <div class="sim-step-header">
          <div class="sim-step-number">${sim.step >= 2 ? '✓' : '2'}</div>
          <span class="sim-step-badge ${sim.step >= 2 ? 'badge-done' : (sim.step === 1 ? 'badge-primary' : 'badge-draft')}">
            ${sim.step >= 2 ? 'Đã hoàn tất' : (sim.step === 1 ? 'Chờ kích hoạt' : 'Chưa đến')}
          </span>
        </div>
        <div class="sim-step-title">Bước 2: Lệnh Điều Xe & Kho</div>
        <div class="sim-step-desc">
          Xác nhận đơn: Tự sinh phiếu xuất WH/OUT/SIM-01 (Kho Tăng Áp ➔ Xe tải điện). Tự động phân bổ cước 110.000đ (55k tài xế Phương + 55k bảo vệ Hoàng bốc xếp).
        </div>
        <div>
          ${sim.step === 1 ? `
            <button class="sim-step-btn btn-run" data-step="2">▶ 2. Xác Nhận & Điều Xe</button>
          ` : (sim.step >= 2 ? `
            <button class="sim-step-btn btn-done">✓ Đã xuất nạp xe điện</button>
          ` : `
            <button class="sim-step-btn btn-disabled">Chờ Bước 1</button>
          `)}
        </div>
      </div>

      <!-- Step 3 -->
      <div class="sim-step-card ${sim.step === 2 ? 'active' : (sim.step >= 3 ? 'completed' : '')}">
        <div class="sim-step-header">
          <div class="sim-step-number">${sim.step >= 3 ? '✓' : '3'}</div>
          <span class="sim-step-badge ${sim.step >= 3 ? 'badge-done' : (sim.step === 2 ? 'badge-primary' : 'badge-draft')}">
            ${sim.step >= 3 ? 'Đã hoàn tất' : (sim.step === 2 ? 'Chờ kích hoạt' : 'Chưa đến')}
          </span>
        </div>
        <div class="sim-step-title">Bước 3: Giao Hàng & Thu Vỏ</div>
        <div class="sim-step-desc">
          Xe điện giao 22 bình tại Bến Đoan. Thu hồi 20 vỏ úp rỗng mang về (khách nợ 2 vỏ). Thu đủ 1.040.000đ tiền mặt COD nộp về thủ quỹ.
        </div>
        <div>
          ${sim.step === 2 ? `
            <button class="sim-step-btn btn-run" data-step="3">▶ 3. Giao Hàng & Thu Vỏ</button>
          ` : (sim.step >= 3 ? `
            <button class="sim-step-btn btn-done">✓ Giao hàng thành công</button>
          ` : `
            <button class="sim-step-btn btn-disabled">Chờ Bước 2</button>
          `)}
        </div>
      </div>

      <!-- Step 4 -->
      <div class="sim-step-card ${sim.step === 3 ? 'active' : (sim.step >= 4 ? 'completed' : '')}">
        <div class="sim-step-header">
          <div class="sim-step-number">${sim.step >= 4 ? '✓' : '4'}</div>
          <span class="sim-step-badge ${sim.step >= 4 ? 'badge-done' : (sim.step === 3 ? 'badge-primary' : 'badge-draft')}">
            ${sim.step >= 4 ? 'Đã hoàn tất' : (sim.step === 3 ? 'Chờ kích hoạt' : 'Chưa đến')}
          </span>
        </div>
        <div class="sim-step-title">Bước 4: Bút Toán Tự Động 4 Sổ</div>
        <div class="sim-step-desc">
          Tất cả 4 phòng ban: Kho (giảm tồn) · Vỏ bình (ghi nợ 2 vỏ) · Quỹ tiền (đã thu) · Thi đua KPI (+1.040.000đ cho chị Hương) được cập nhật đồng thời!
        </div>
        <div>
          ${sim.step === 3 ? `
            <button class="sim-step-btn btn-run" data-step="4" style="background:#16a34a;">★ Hoàn Tất Chu Trình</button>
          ` : (sim.step >= 4 ? `
            <button class="sim-step-btn btn-done">★ Toàn bộ 4 sổ đã khớp</button>
          ` : `
            <button class="sim-step-btn btn-disabled">Chờ Bước 3</button>
          `)}
        </div>
      </div>
    </div>

    <!-- Live Multi-Ledger Database Inspection Panel -->
    <div class="card-box" style="margin-bottom:20px;">
      <div class="card-box-header">
        <span class="card-box-title">🔍 Bảng Kiểm Chứng Trực Tiếp 4 Sổ Sách (Live Multi-Ledger Inspection)</span>
        <span class="badge badge-sale">Dữ liệu biến động tức thì trên SQLite Database</span>
      </div>
      <div class="card-box-body">
        <div class="sim-ledger-grid">
          <!-- Ledger 1: Bán hàng -->
          <div class="ledger-card">
            <div class="ledger-card-header">
              <span class="ledger-card-title">🧾 1. Sổ Bán Hàng & Đơn Hàng</span>
              ${simOrder ? renderBadge(simOrder.state) : '<span class="badge badge-draft">Chưa phát sinh</span>'}
            </div>
            ${simOrder ? `
              <div class="ledger-row"><span class="ledger-row-label">Mã đơn:</span><span class="ledger-row-val font-bold text-primary">${simOrder.name}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Khách hàng:</span><span class="ledger-row-val">${esc(simOrder.partner_name)}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Người bán (KPI):</span><span class="ledger-row-val">${esc(simOrder.seller)}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Quy cách & KM:</span><span class="ledger-row-val">20 bình + 2 bình tặng (10+1)</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Tổng thanh toán:</span><span class="ledger-row-val text-success font-bold">${fmt(simOrder.amount_total)} đ</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Tiền mặt đã thu:</span><span class="ledger-row-val font-bold ${simOrder.paid_amount > 0 ? 'text-success' : 'text-danger'}">${fmt(simOrder.paid_amount)} đ</span></div>
            ` : `
              <div style="color:#94a3b8; font-size:12px; padding:20px 0; text-align:center;">Chưa chạy Bước 1. Bấm "Tạo Báo Giá Đơn Hàng" để xem dữ liệu.</div>
            `}
          </div>

          <!-- Ledger 2: Kho vận & Đội xe -->
          <div class="ledger-card">
            <div class="ledger-card-header">
              <span class="ledger-card-title">📦 2. Sổ Kho Kép & Đội Xe</span>
              ${simPicking ? renderBadge(simPicking.state) : '<span class="badge badge-draft">Chưa phát sinh</span>'}
            </div>
            ${simPicking ? `
              <div class="ledger-row"><span class="ledger-row-label">Mã lệnh kho:</span><span class="ledger-row-val font-bold">${simPicking.name}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Nguồn ➔ Đích:</span><span class="ledger-row-val font-bold">${esc(simPicking.src_name)} ➔ ${esc(simPicking.dest_name)}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Tổng cước 5.000đ/bình:</span><span class="ledger-row-val font-bold text-primary">${fmt(simPicking.carrier_fee)} đ</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Phân bổ Lái xe (Phương):</span><span class="ledger-row-val text-success font-bold">55.000 đ</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Phân bổ Bảo vệ (Hoàng):</span><span class="ledger-row-val text-success font-bold">55.000 đ</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Trạng thái tồn xe điện:</span><span class="ledger-row-val ${sim.step >= 3 ? 'text-success font-bold' : 'text-primary'}">${sim.step >= 3 ? 'Đã xuất kho khách (-22 bình)' : 'Đang nạp trên xe (+22 bình)'}</span></div>
            ` : `
              <div style="color:#94a3b8; font-size:12px; padding:20px 0; text-align:center;">Chưa chạy Bước 2. Bấm "Xác Nhận & Điều Xe" để xem lệnh kho.</div>
            `}
          </div>

          <!-- Ledger 3: Vỏ bình -->
          <div class="ledger-card">
            <div class="ledger-card-header">
              <span class="ledger-card-title">🧴 3. Sổ Nợ Vỏ Bình Đa Kỳ</span>
              ${simShell ? '<span class="badge badge-done">Đã đối trừ</span>' : '<span class="badge badge-draft">Chưa phát sinh</span>'}
            </div>
            ${simShell ? `
              <div class="ledger-row"><span class="ledger-row-label">Khách hàng giữ vỏ:</span><span class="ledger-row-val font-bold">${esc(simShell.customer)}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Số vỏ giao mới:</span><span class="ledger-row-val font-bold text-primary">${simShell.in_up} vỏ bình Úp</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Số vỏ rỗng đã thu hồi:</span><span class="ledger-row-val font-bold text-success">${simShell.returned_up} vỏ bình Úp</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Số nợ tồn lại cuối kỳ:</span><span class="ledger-row-val font-bold text-danger">${simShell.closing_up} vỏ bình Úp</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Công thức tự động:</span><span class="ledger-row-val">Cuối kỳ (2) = 0 + 22 - 20</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Ghi chú vận hành:</span><span class="ledger-row-val">${esc(simShell.note)}</span></div>
            ` : `
              <div style="color:#94a3b8; font-size:12px; padding:20px 0; text-align:center;">Chưa chạy Bước 3. Bấm "Giao Hàng & Thu Vỏ" để xem sổ nợ vỏ.</div>
            `}
          </div>

          <!-- Ledger 4: Quỹ tiền & Thi đua KPI -->
          <div class="ledger-card">
            <div class="ledger-card-header">
              <span class="ledger-card-title">🎯 4. Quỹ Tiền COD & Thi Đua KPI 2026</span>
              ${sim.step >= 3 ? '<span class="badge badge-done">Đã ghi nhận</span>' : '<span class="badge badge-draft">Chưa phát sinh</span>'}
            </div>
            ${sim.step >= 3 ? `
              <div class="ledger-row"><span class="ledger-row-label">Tiền mặt COD thu được:</span><span class="ledger-row-val font-bold text-success">1.040.000 đ (Lái xe nộp)</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Nhân sự thụ hưởng KPI:</span><span class="ledger-row-val font-bold">${simKpi ? esc(simKpi.name) : 'Lương Minh Hương'}</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Đơn vị công tác:</span><span class="ledger-row-val">Tổ Tiếp thị — Xí nghiệp Nước Hòn Gai</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Doanh số ghi nhận mới:</span><span class="ledger-row-val font-bold text-success">+ 1.040.000 đ</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Tổng lũy kế hiện tại:</span><span class="ledger-row-val font-bold text-primary">${simKpi ? fmt(simKpi.total) : '24.168.000'} đ</span></div>
              <div class="ledger-row"><span class="ledger-row-label">Đánh giá thi đua:</span><span class="ledger-row-val text-success font-bold">Vượt 306% chỉ tiêu năm!</span></div>
            ` : `
              <div style="color:#94a3b8; font-size:12px; padding:20px 0; text-align:center;">Chưa giao hàng. Sau Bước 3 hệ thống sẽ ghi nhận tiền COD và cộng dồn KPI thi đua.</div>
            `}
          </div>
        </div>
      </div>
    </div>

    <!-- Simulation Timeline / History -->
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">📜 Nhật Ký Chu Trình Vận Hành (Execution Log)</span>
        <span style="font-size:12px; color:#64748b;">Ghi nhận ${sim.history.length} sự kiện thực thi</span>
      </div>
      <div class="card-box-body">
        ${sim.history.length === 0 ? `
          <div style="color:#94a3b8; font-size:12px; text-align:center; padding:20px 0;">
            Chưa có thao tác nào. Bấm <b>"▶ 1. Tạo Báo Giá Đơn Hàng"</b> ở góc trên bên trái để bắt đầu mô phỏng trực quan!
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${sim.history.map(h => `
              <div style="display:flex; gap:14px; align-items:flex-start; padding:10px 14px; background:#f8fafc; border-radius:8px; border-left:3px solid #2563eb;">
                <span class="badge badge-sale" style="margin-top:2px;">${esc(h.time)}</span>
                <div>
                  <div style="font-size:13px; font-weight:700; color:#1e293b;">Bước ${h.step}: ${esc(h.title)}</div>
                  <div style="font-size:12px; color:#64748b; margin-top:2px;">${esc(h.detail)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Bind Buttons
  el.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target_step = Number(btn.dataset.step);
      btn.disabled = true;
      btn.textContent = 'Đang thực thi...';
      try {
        await api('/api/simulation/step', {
          method: 'POST',
          body: JSON.stringify({ target_step })
        });
        showToast('Đã thực hiện thành công Bước ' + target_step + '!');
        renderSimulation(el);
      } catch (e) {
        btn.disabled = false;
      }
    });
  });

  const btnReset = el.querySelector('#btn-sim-reset');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc muốn đặt lại toàn bộ trạng thái chu trình mô phỏng về ban đầu?')) return;
      await api('/api/simulation/reset', { method: 'POST' });
      showToast('Đã reset chu trình mô phỏng thành công!');
      renderSimulation(el);
    });
  }
}

// ══════════════════════════ 2. SOLUTION BLUEPRINT VIEW ══════════════════════════ //
async function renderBlueprint(el) {
  const bp = await api('/api/blueprint');

  el.innerHTML = `
    <!-- Hero Banner -->
    <div class="sim-hero-banner" style="background: linear-gradient(135deg, #312e81, #1e1b4b);">
      <div>
        <div class="sim-hero-title">🏛️ ${esc(bp.title)}</div>
        <div class="sim-hero-subtitle">${esc(bp.description)}</div>
      </div>
      <div>
        <button class="btn btn-simulation btn-sm" id="bp-btn-run-sim">
          ⚡ Chạy thử chu trình ngay
        </button>
      </div>
    </div>

    <!-- Interactive Data Flow Diagram -->
    <div class="bp-flow-wrap">
      <div class="bp-flow-title">1. Sơ Đồ Luồng Dữ Liệu Khép Kín (End-to-End Data Flow Diagram)</div>
      <div class="bp-flow-sub">Mô hình liên kết các chứng từ và dữ liệu giữa các bộ phận, loại bỏ hoàn toàn việc gõ tay nhập lại dữ liệu</div>
      <div class="bp-nodes-container">
        <div class="bp-node">
          <div class="bp-node-icon">👥</div>
          <div class="bp-node-title">1. Khách Hàng / Tiếp Thị</div>
          <div class="bp-node-desc">Đại lý, cơ quan, CBCNV vận động</div>
        </div>
        <div class="bp-arrow">➔</div>
        <div class="bp-node" style="border-color:#3b82f6; background:#eff6ff;">
          <div class="bp-node-icon">🧾</div>
          <div class="bp-node-title">2. Đơn Bán (SO)</div>
          <div class="bp-node-desc">Báo giá, KM 10+1, Kênh XN/CTY</div>
        </div>
        <div class="bp-arrow">➔</div>
        <div class="bp-node" style="border-color:#8b5cf6; background:#f5f3ff;">
          <div class="bp-node-icon">📋</div>
          <div class="bp-node-title">3. Lệnh Kho Kép</div>
          <div class="bp-node-desc">Kho Tăng Áp ➔ Xe tải điện</div>
        </div>
        <div class="bp-arrow">➔</div>
        <div class="bp-node" style="border-color:#f59e0b; background:#fffbeb;">
          <div class="bp-node-icon">🚚</div>
          <div class="bp-node-title">4. Đội Xe & Bảo Vệ</div>
          <div class="bp-node-desc">Chia cước 5k/bình tài xế + phụ xe</div>
        </div>
        <div class="bp-arrow">➔</div>
        <div class="bp-node" style="border-color:#10b981; background:#f0fdf4;">
          <div class="bp-node-icon">🧴</div>
          <div class="bp-node-title">5. Giao Hàng & Thu Vỏ</div>
          <div class="bp-node-desc">Giao nước, thu vỏ rỗng mang về</div>
        </div>
        <div class="bp-arrow">➔</div>
        <div class="bp-node" style="border-color:#ec4899; background:#fdf2f8;">
          <div class="bp-node-icon">📊</div>
          <div class="bp-node-title">6. Hạch Toán 4 Sổ</div>
          <div class="bp-node-desc">Sổ Kho · Sổ Vỏ · Sổ Quỹ · Sổ KPI</div>
        </div>
      </div>
    </div>

    <!-- 6 Architecture Modules -->
    <div style="font-size:16px; font-weight:700; color:#1e293b; margin-bottom:12px;">
      2. Danh Mục 6 Phân Hệ Nghiệp Vụ Chuẩn Hóa (MiERP Modular Architecture)
    </div>
    <div class="bp-modules-grid">
      ${bp.modules.map(m => `
        <div class="bp-module-card">
          <div class="bp-module-title">${esc(m.name)}</div>
          <div class="bp-module-ref">${esc(m.mierp_ref)}</div>
          <div class="bp-module-desc">${esc(m.purpose)}</div>
          <div style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:4px;">Thực thể dữ liệu (Entities):</div>
          <div class="bp-module-tags">
            ${m.entities.map(e => `<span class="bp-tag font-bold">${esc(e)}</span>`).join('')}
          </div>
          <div style="font-size:11px; color:#64748b; margin-top:10px;">
            <b>Đối tượng sử dụng:</b> ${m.target_users.join(', ')}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Interactive Data Dictionary -->
    <div class="card-box" style="margin-bottom:24px;">
      <div class="card-box-header">
        <span class="card-box-title">3. Từ Điển Dữ Liệu Chi Tiết (Data Dictionary & Excel Field Mapping)</span>
        <span class="badge badge-purple">Nguồn gốc chuẩn hóa từ 3 bảng tính Excel vận hành</span>
      </div>
      <div class="card-box-body">
        <div style="font-size:12px; color:#64748b; margin-bottom:16px;">
          Bảng từ điển định nghĩa toàn bộ trường dữ liệu cốt lõi, quy cách lưu trữ, ràng buộc nghiệp vụ và đối chiếu với nguồn dữ liệu cũ trên Excel:
        </div>
        ${bp.data_dictionary.map(dict => `
          <div style="margin-bottom:24px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
            <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-weight:700; color:#1e293b; font-size:13px;">Bảng ${esc(dict.entity)}: ${esc(dict.title)}</span>
              </div>
              <span class="badge badge-sale">Nguồn: ${esc(dict.excel_source)}</span>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Tên trường (Field)</th>
                    <th>Kiểu dữ liệu</th>
                    <th>Ràng buộc</th>
                    <th>Ý nghĩa nghiệp vụ & Giải pháp ERP</th>
                  </tr>
                </thead>
                <tbody>
                  ${dict.fields.map(f => `
                    <tr>
                      <td class="font-bold font-mono text-primary">${esc(f.name)}</td>
                      <td><span class="badge badge-draft">${esc(f.type)}</span></td>
                      <td>${f.req.includes('Bắt buộc') ? '<span class="badge badge-danger">Bắt buộc</span>' : '<span class="badge badge-purple">' + esc(f.req) + '</span>'}</td>
                      <td>${esc(f.desc)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Comparative Table: Excel vs QAROMI ERP -->
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">4. So Sánh Bài Toán Vận Hành: Excel Cũ vs QAROMI ERP Hiện Đại</span>
        <span class="badge badge-done">Khắc phục 100% rủi ro đã kiểm toán</span>
      </div>
      <div class="card-box-body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Vấn đề nghiệp vụ trên Excel cũ</th>
                <th>Hậu quả vận hành thực tế</th>
                <th>Giải pháp kiến trúc trong QAROMI ERP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold text-danger">12 ô công thức #REF! tại Sheet TỒN</td>
                <td>Số tồn kho biến dạng, mất cân đối số liệu kho Huế và Tăng Áp</td>
                <td class="text-success font-bold">Cơ sở dữ liệu quan hệ chuẩn, khóa ngoại Foreign Key, không bao giờ bị đứt gãy công thức</td>
              </tr>
              <tr>
                <td class="font-bold text-danger">Xe tải điện bị tồn âm (xuất trước khi nạp)</td>
                <td>Không biết trên xe đang chở bao nhiêu bình nước, rủi ro thất thoát</td>
                <td class="text-success font-bold">Mô hình Kho lưu động (Transit Location) với phiếu xuất kho kép Nguồn ➔ Đích bắt buộc</td>
              </tr>
              <tr>
                <td class="font-bold text-danger">Sổ nợ vỏ bình âm do gộp chung Úp & Vòi</td>
                <td>Khách trả vỏ vòi nhưng trừ vào vỏ úp, kế toán và đại lý tranh cãi</td>
                <td class="text-success font-bold">Tách bạch 2 dòng tài sản riêng biệt (Úp / Vòi) và quản lý chặt quỹ ký cược cọc vỏ 50.000đ</td>
              </tr>
              <tr>
                <td class="font-bold text-danger">Phân bổ cước 5k và trực bảo vệ ghi sổ tay</td>
                <td>Cuối tháng kế toán mất nhiều ngày đối soát chuyến giao và chia tiền</td>
                <td class="text-success font-bold">Tự động tính cước 5.000đ/bình và chia đều cho lái xe + bảo vệ ngay trên lệnh điều xe</td>
              </tr>
              <tr>
                <td class="font-bold text-danger">Chỉ tiêu thi đua 1.59 tỷ cộng dồn thủ công</td>
                <td>Không có động lực thi đua tức thời, số liệu báo cáo chậm trễ nhiều ngày</td>
                <td class="text-success font-bold">Cộng dồn doanh số thời gian thực vào bảng thi đua 202 CBCNV ngay khi đơn hàng hoàn thành</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const btnRun = el.querySelector('#bp-btn-run-sim');
  if (btnRun) btnRun.addEventListener('click', () => navigateTo('simulation'));
}

// 1. Overview View
async function renderOverview(el) {
  const data = await api('/api/overview');
  const m = data.metrics;

  document.getElementById('top-kpi-bar').style.width = `${Math.min(100, m.kpi_progress)}%`;

  el.innerHTML = `
    <!-- High Priority Audit Alert Banner -->
    <div class="audit-alert-banner">
      <div class="audit-alert-left">
        <span class="audit-alert-icon">🚨</span>
        <div>
          <div class="audit-alert-title">
            CẢNH BÁO KIỂM TOÁN DỮ LIỆU EXCEL GỐC
            <span class="ref-badge">${m.excel_ref_errors || 12} Ô TÍNH HỎNG #REF!</span>
          </div>
          <div class="audit-alert-desc">
            Phát hiện công thức hỏng <code>=SUMIFS(XUẤT!$W:$W,...,TỒN!#REF!)</code> tại Sheet <b>TỒN</b> trong file Excel khách hàng. QAROMI ERP đã khắc phục 100% tính toàn vẹn dữ liệu bằng CSDL quan hệ!
          </div>
        </div>
      </div>
      <button class="audit-alert-btn" onclick="navigateTo('audit')">Xem Chi Tiết Kiểm Toán ➔</button>
    </div>

    <!-- Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card highlight">
        <div class="metric-header">
          <span class="metric-title">Doanh số Tháng 9</span>
          <span class="metric-icon">💵</span>
        </div>
        <div class="metric-value">${fmt(m.total_revenue)} đ</div>
        <div class="metric-sub">${m.total_orders} đơn giao · Thu: ${fmt(m.total_paid)}đ</div>
      </div>

      <div class="metric-card warning">
        <div class="metric-header">
          <span class="metric-title">Nợ vỏ bình thị trường</span>
          <span class="metric-icon">🧴</span>
        </div>
        <div class="metric-value">${fmt(m.debt_up + m.debt_voi)} bình</div>
        <div class="metric-sub">Úp: ${fmt(m.debt_up)} | Vòi: ${fmt(m.debt_voi)} (Cọc: ${fmt(m.total_deposit)}đ)</div>
      </div>

      <div class="metric-card success">
        <div class="metric-header">
          <span class="metric-title">Tiến độ Kế hoạch năm</span>
          <span class="metric-icon">🎯</span>
        </div>
        <div class="metric-value">${m.kpi_progress}%</div>
        <div class="metric-sub">Đạt: ${fmt(m.kpi_achieved)} / ${fmt(m.kpi_target)} đ</div>
      </div>

      <div class="metric-card purple">
        <div class="metric-header">
          <span class="metric-title">DVGT & Vật tư phụ tùng</span>
          <span class="metric-icon">🔧</span>
        </div>
        <div class="metric-value">${m.dvgt_completed} ca xong</div>
        <div class="metric-sub">Vật tư: ${fmt(m.dvgt_parts_fee)}đ | Công: ${fmt(m.dvgt_labor_fee)}đ</div>
      </div>
    </div>

    <!-- Second Operational Metrics Row -->
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px; margin-bottom:24px;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">Nguồn Tiếp Ứng Cẩm Phả</div>
          <div style="font-size:20px; font-weight:700; color:#0f172a; margin:3px 0;">${fmt(m.interbranch_replenished || 180)} vỉ</div>
          <div style="font-size:11.5px; color:#2563eb; cursor:pointer;" onclick="navigateTo('interbranch')">Xem điều chuyển liên chi nhánh ➔</div>
        </div>
        <span style="font-size:28px;">🚛</span>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">Vay Mượn Hàng/Vỏ Nội Bộ</div>
          <div style="font-size:20px; font-weight:700; color:#d97706; margin:3px 0;">${fmt(m.interbranch_loaned || 92)} đơn vị</div>
          <div style="font-size:11.5px; color:#d97706; cursor:pointer;" onclick="navigateTo('interbranch')">Đối soát đơn vị bạn (BC, QY, CP) ➔</div>
        </div>
        <span style="font-size:28px;">🔄</span>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase;">Trực Bảo Vệ Bốc Xếp</div>
          <div style="font-size:20px; font-weight:700; color:#16a34a; margin:3px 0;">${m.guard_shifts || 23} ca trực</div>
          <div style="font-size:11.5px; color:#16a34a; cursor:pointer;" onclick="navigateTo('guards')">Thù lao: ${fmt(m.guard_allowance || 1840000)}đ ➔</div>
        </div>
        <span style="font-size:28px;">🛡️</span>
      </div>
    </div>

    <!-- Main Content Row -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px;">
      <!-- Stock status -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">🏬 Tồn kho thời gian thực tại các điểm</span>
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('quants')">Chi tiết kho ➔</button>
        </div>
        <div class="card-box-body" style="padding:0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Vị trí kho</th>
                  <th>Mặt hàng</th>
                  <th class="text-right">Tồn hiện tại</th>
                </tr>
              </thead>
              <tbody>
                ${data.stocks.slice(0, 10).map(s => `
                  <tr>
                    <td class="font-semibold">${esc(s.warehouse)}</td>
                    <td>${esc(s.name)}</td>
                    <td class="text-right font-bold ${s.quantity < 20 ? 'text-danger' : 'text-primary'}">${fmt(s.quantity)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Quick Shortcuts -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">⚡ Thao tác nhanh</span>
        </div>
        <div class="card-box-body" style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary" style="justify-content:center;" onclick="openCreateOrderModal()">＋ Lập Báo Giá / Đơn Mới</button>
          <button class="btn btn-secondary" style="justify-content:center;" onclick="openCreateDvgtModal()">＋ Đăng Ký Ca DVGT / Thay Hộp ĐH</button>
          <button class="btn btn-secondary" style="justify-content:center;" onclick="navigateTo('interbranch')">🚛 Tiếp Ứng Cẩm Phả & Vay Kho</button>
          <button class="btn btn-secondary" style="justify-content:center;" onclick="navigateTo('guards')">🛡️ Lịch Trực Tổ Bảo Vệ</button>
          <button class="btn btn-secondary" style="justify-content:center;" onclick="navigateTo('audit')">⚠️ Kiểm Toán Lỗi Excel (#REF!)</button>
        </div>
      </div>
    </div>
  `;
}

// 2. Worklist View
async function renderWorklist(el) {
  const data = await api('/api/worklist');
  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">⚡ Đơn hàng cần xử lý giao (${data.pendingOrders.length})</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Ngày</th>
              <th>Khách hàng</th>
              <th>Kênh</th>
              <th>Người bán</th>
              <th class="text-right">Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Tác vụ</th>
            </tr>
          </thead>
          <tbody>
            ${data.pendingOrders.map(o => `
              <tr>
                <td class="font-bold text-primary">${esc(o.name)}</td>
                <td>${esc(o.date)}</td>
                <td class="font-semibold">${esc(o.customer_name)}</td>
                <td><span class="badge ${o.channel_code === 'XN' ? 'badge-sale' : 'badge-draft'}">${esc(o.channel_name)}</span></td>
                <td>${esc(o.seller)}</td>
                <td class="text-right font-bold">${fmt(o.amount_total)} đ</td>
                <td>${renderBadge(o.state)}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openOrderDetailModal(${o.id})">Xem đơn</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">💰 Tiền chưa thu (${data.uncollectedCash.length})</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Người bán</th>
                <th class="text-right">Còn phải thu</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${data.uncollectedCash.map(c => `
                <tr>
                  <td class="font-semibold">${esc(c.customer_name)}</td>
                  <td>${esc(c.seller)}</td>
                  <td class="text-right font-bold text-danger">${fmt(c.debt_amount)} đ</td>
                  <td class="text-muted" style="font-size:11px;">${esc(c.collection_note || 'Chưa thanh toán')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">⚠️ Cảnh báo hàng dưới ngưỡng tồn</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mặt hàng</th>
                <th>Kho</th>
                <th class="text-right">Tồn hiện tại</th>
                <th>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              ${data.lowStocks.map(s => `
                <tr>
                  <td class="font-semibold">${esc(s.name)}</td>
                  <td>${esc(s.warehouse)}</td>
                  <td class="text-right font-bold text-danger">${fmt(s.quantity)}</td>
                  <td><span class="badge badge-danger">Cần bổ sung ngay</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 3. Products View
async function renderProducts(el) {
  const data = await api('/api/products');
  state.products = data.products;

  el.innerHTML = `
    <div class="pattern-callout">
      <span class="badge-pattern">Odoo UoM & Packaging</span>
      <div>
        <b>Quy đổi đơn vị tính & Quản lý vòng đời vỏ bình:</b> Mặt hàng nước bình (RO, Kiềm 19L) được gắn cờ theo dõi vỏ bình (tracks_shell = 1) và tiền ký cược cọc vỏ chuẩn 50.000đ/bình. Nước đóng chai áp dụng hệ số quy đổi 1 Hộp = 4 Vỉ = 24 Chai.
      </div>
    </div>

    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">📦 Danh mục sản phẩm & Bảng giá áp dụng (09/2026)</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã hàng</th>
              <th>Tên sản phẩm</th>
              <th>ĐVT</th>
              <th class="text-right">Giá bán niêm yết</th>
              <th class="text-center">Theo dõi vỏ bình</th>
              <th class="text-right">Tiền cọc vỏ</th>
            </tr>
          </thead>
          <tbody>
            ${data.products.map(p => `
              <tr>
                <td class="font-bold text-primary">${esc(p.code)}</td>
                <td class="font-semibold">${esc(p.name)}</td>
                <td><span class="badge badge-draft">${esc(p.uom_name)}</span></td>
                <td class="text-right font-bold">${fmt(p.price)} đ</td>
                <td class="text-center">${p.tracks_shell ? '<span class="badge badge-sale">Có (Úp / Vòi)</span>' : '<span class="badge badge-draft">Không</span>'}</td>
                <td class="text-right">${p.tracks_shell ? fmt(p.deposit_fee) + ' đ' : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 4. Sales Orders View
async function renderOrders(el) {
  const orders = await api('/api/orders');

  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="card-box-title">🧾 Danh sách đơn bán hàng & Báo giá</span>
          <span class="badge badge-draft">${orders.length} đơn</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openCreateOrderModal()">＋ Tạo báo giá mới</button>
      </div>
      <div class="card-box-body">
        <div class="filter-bar">
          <input type="text" id="order-search" class="search-input" placeholder="🔍 Tìm theo mã đơn, khách hàng, người bán..." oninput="filterOrdersTable()">
          <select id="order-channel-filter" class="select-input" onchange="filterOrdersTable()">
            <option value="">Tất cả kênh</option>
            <option value="XN">Xí nghiệp (Tính KPI)</option>
            <option value="CTY">Công ty</option>
            <option value="BC">Bãi Cháy</option>
            <option value="MD">Miền Đông</option>
          </select>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="orders-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Ngày</th>
                <th>Khách hàng</th>
                <th>Kênh</th>
                <th>Kho xuất</th>
                <th>Người bán (CBCNV)</th>
                <th class="text-right">Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr class="order-row" data-search="${(o.name + ' ' + o.customer_name + ' ' + o.seller).toLowerCase()}" data-channel="${o.channel_code}">
                  <td class="font-bold text-primary">${esc(o.name)}</td>
                  <td>${esc(o.date)}</td>
                  <td class="font-semibold">${esc(o.customer_name)}</td>
                  <td><span class="badge ${o.channel_code === 'XN' ? 'badge-sale' : 'badge-draft'}">${esc(o.channel_name)}</span></td>
                  <td>${esc(o.warehouse_name)}</td>
                  <td>${esc(o.seller)}</td>
                  <td class="text-right font-bold">${fmt(o.amount_total)} đ</td>
                  <td>${renderBadge(o.state)}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="openOrderDetailModal(${o.id})">Chi tiết</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.filterOrdersTable = function() {
  const q = document.getElementById('order-search').value.toLowerCase();
  const ch = document.getElementById('order-channel-filter').value;
  const rows = document.querySelectorAll('.order-row');
  rows.forEach(r => {
    const matchesQ = !q || r.dataset.search.includes(q);
    const matchesCh = !ch || r.dataset.channel === ch;
    r.style.display = (matchesQ && matchesCh) ? '' : 'none';
  });
};

// Open Order Detail Modal
window.openOrderDetailModal = async function(id) {
  const { order, lines, pickings } = await api(`/api/orders/${id}`);
  
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">Chi tiết đơn hàng ${esc(order.name)}</div>
        <div style="font-size:12px; color:#64748b;">Khách hàng: <b>${esc(order.customer_name)}</b> — Ngày: ${esc(order.date)}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px; font-size:12px; background:#f8fafc; padding:12px; border-radius:8px;">
        <div><b>Kênh doanh thu:</b> ${esc(order.channel_name)}</div>
        <div><b>Kho xuất hàng:</b> ${esc(order.warehouse_name)}</div>
        <div><b>Người bán (CBCNV):</b> ${esc(order.seller)}</div>
        <div><b>Trạng thái:</b> ${renderBadge(order.state)}</div>
        <div><b>Ghi chú thu tiền:</b> ${esc(order.collection_note || 'Chưa có')}</div>
        <div><b>Tổng tiền đơn:</b> <span class="font-bold text-primary" style="font-size:14px;">${fmt(order.amount_total)} đ</span></div>
      </div>

      <div style="font-weight:700; margin-bottom:8px; font-size:13px;">Chi tiết sản phẩm đặt mua:</div>
      <table class="data-table" style="margin-bottom:16px;">
        <thead>
          <tr>
            <th>Mặt hàng</th>
            <th class="text-center">Số lượng</th>
            <th class="text-center">Tặng (10+1)</th>
            <th class="text-right">Đơn giá</th>
            <th class="text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map(l => `
            <tr>
              <td>${esc(l.product_name)}</td>
              <td class="text-center font-bold">${fmt(l.qty)} ${esc(l.uom_name)}</td>
              <td class="text-center text-success font-bold">${l.promo_qty ? '+' + fmt(l.promo_qty) : '0'}</td>
              <td class="text-right">${fmt(l.price_unit)} đ</td>
              <td class="text-right font-bold">${fmt(l.amount_total)} đ</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="font-weight:700; margin-bottom:8px; font-size:13px;">Phiếu giao hàng liên kết (Stock Picking):</div>
      ${pickings.length ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã phiếu kho</th>
              <th>Nguồn ➔ Đích</th>
              <th>Cước giao</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${pickings.map(p => `
              <tr>
                <td class="font-bold text-primary">${esc(p.name)}</td>
                <td>${esc(p.src_name)} ➔ ${esc(p.dest_name)}</td>
                <td>${fmt(p.carrier_fee)} đ</td>
                <td>${renderBadge(p.state)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="color:#64748b; font-size:12px;">Chưa sinh phiếu kho (đang ở trạng thái Báo giá).</div>'}
    </div>
    <div class="modal-footer">
      ${order.state === 'draft' ? `
        <button class="btn btn-primary" onclick="confirmOrder(${order.id})">✔ Xác nhận đơn (Sinh phiếu kho)</button>
      ` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
    </div>
  `);
};

window.confirmOrder = async function(id) {
  const res = await api(`/api/orders/${id}/confirm`, { method: 'POST' });
  showToast(`Đã xác nhận đơn! Tự động sinh phiếu giao: ${res.picking_name}`);
  closeModal();
  renderView();
};

// Open Create Order Modal
window.openCreateOrderModal = async function() {
  if (!state.products.length) {
    const data = await api('/api/products');
    state.products = data.products;
  }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">＋ Tạo Báo Giá / Đơn Bán Hàng Mới</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tên khách hàng *</label>
          <input type="text" id="new-ord-customer" class="form-control" placeholder="Ví dụ: Công ty Hanet, Nhà hàng Minh Tuấn..." required>
        </div>
        <div class="form-group">
          <label class="form-label">Số điện thoại</label>
          <input type="text" id="new-ord-phone" class="form-control" placeholder="09xxxxxxx">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Kênh doanh thu</label>
          <select id="new-ord-channel" class="form-control">
            <option value="XN">Xí nghiệp (Tính KPI thi đua)</option>
            <option value="CTY">Công ty mẹ QUAWACO</option>
            <option value="BC">Trạm Bãi Cháy</option>
            <option value="MD">Miền Đông</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Kho xuất hàng</label>
          <select id="new-ord-warehouse" class="form-control">
            <option value="TANGAP">Kho Tăng Áp</option>
            <option value="HUE">Kho Huế</option>
            <option value="VP">Kho Văn Phòng</option>
            <option value="XEDIEN">Xe tải điện (Kho di động)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Người bán (Cán bộ công nhân viên vận động)</label>
        <input type="text" id="new-ord-seller" class="form-control" placeholder="Ví dụ: Lương Minh Hương, Đinh Thu Huế, Bùi Hà Thu...">
      </div>

      <div style="font-weight:700; margin: 16px 0 8px; font-size:13px;">Chọn mặt hàng & Số lượng:</div>
      <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px;">
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Sản phẩm</label>
            <select id="new-ord-prod" class="form-control">
              ${state.products.map(p => `
                <option value="${p.code}">${p.name} — ${fmt(p.price)}đ</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Số lượng</label>
            <input type="number" id="new-ord-qty" class="form-control" value="10" min="1">
          </div>
        </div>
        <div style="font-size:11px; color:#16a34a;">
          🎁 <b>Chính sách 10+1:</b> Mua từ 10 đơn vị tự động được tặng 1 sản phẩm khuyến mãi miễn phí!
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Ghi chú thanh toán</label>
        <input type="text" id="new-ord-note" class="form-control" placeholder="Ví dụ: Thu tiền luôn, CK11/9...">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="submitNewOrder()">Lưu Báo Giá</button>
    </div>
  `);
};

window.submitNewOrder = async function() {
  const customer = document.getElementById('new-ord-customer').value.trim();
  const phone = document.getElementById('new-ord-phone').value.trim();
  const channel = document.getElementById('new-ord-channel').value;
  const warehouse = document.getElementById('new-ord-warehouse').value;
  const seller = document.getElementById('new-ord-seller').value.trim();
  const prodCode = document.getElementById('new-ord-prod').value;
  const qty = Number(document.getElementById('new-ord-qty').value) || 1;
  const note = document.getElementById('new-ord-note').value.trim();

  if (!customer) {
    alert('Vui lòng nhập tên khách hàng');
    return;
  }

  const payload = {
    customer_name: customer,
    phone,
    channel_code: channel,
    warehouse_code: warehouse,
    seller: seller || 'Xí nghiệp',
    lines: [{ product_code: prodCode, qty }],
    collection_note: note,
  };

  const res = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  showToast(`Đã tạo báo giá ${res.name} thành công!`);
  closeModal();
  navigateTo('orders');
};

// 5. Bottle Shells View (Sổ Vỏ)
async function renderShells(el) {
  const data = await api('/api/shells');
  const s = data.summary;

  el.innerHTML = `
    <div class="pattern-callout">
      <span class="badge-pattern">Returnable Asset Management</span>
      <div>
        <b>Quản lý Vỏ bình theo Chuẩn MiERP:</b> Vỏ bình Úp và Vòi được theo dõi như tài sản luân chuyển. Công thức quản lý chặt chẽ: <code>Nợ cũ + Lấy mới - Trả vỏ = Còn nợ</code>, gắn liền tiền ký cọc 50.000đ/vỏ để bảo vệ tài sản doanh nghiệp.
      </div>
    </div>

    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="metric-card warning">
        <div class="metric-header"><span class="metric-title">Tổng Nợ Vỏ Cuối Kỳ</span></div>
        <div class="metric-value">${fmt(s.clo_up + s.clo_voi)} vỏ</div>
        <div class="metric-sub">Úp: ${fmt(s.clo_up)} | Vòi: ${fmt(s.clo_voi)}</div>
      </div>
      <div class="metric-card success">
        <div class="metric-header"><span class="metric-title">Vỏ đã thu hồi trong kỳ</span></div>
        <div class="metric-value">${fmt(s.ret_up + s.ret_voi)} vỏ</div>
        <div class="metric-sub">Úp: ${fmt(s.ret_up)} | Vòi: ${fmt(s.ret_voi)}</div>
      </div>
      <div class="metric-card highlight">
        <div class="metric-header"><span class="metric-title">Vỏ giao đi cùng nước</span></div>
        <div class="metric-value">${fmt(s.in_up + s.in_voi)} vỏ</div>
        <div class="metric-sub">Úp: ${fmt(s.in_up)} | Vòi: ${fmt(s.in_voi)}</div>
      </div>
      <div class="metric-card purple">
        <div class="metric-header"><span class="metric-title">Tiền cọc vỏ đang giữ</span></div>
        <div class="metric-value">${fmt(s.total_deposit)} đ</div>
        <div class="metric-sub">Bảo lãnh ký cược tài sản</div>
      </div>
    </div>

    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">🧴 Sổ theo dõi nợ vỏ bình khách hàng (Kỳ Tháng 9/2026)</span>
        <span class="badge badge-draft">${data.ledgers.length} khách nợ</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Người theo dõi</th>
                <th>Khách hàng nợ vỏ</th>
                <th class="text-center">Nợ cũ (Úp/Vòi)</th>
                <th class="text-center">Lấy mới</th>
                <th class="text-center">Đã trả</th>
                <th class="text-center font-bold text-danger">Còn nợ (Úp/Vòi)</th>
                <th class="text-right">Tiền cọc</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${data.ledgers.slice(0, 35).map(l => `
                <tr>
                  <td>${esc(l.subject)}</td>
                  <td class="font-semibold">${esc(l.customer)}</td>
                  <td class="text-center text-muted">${l.opening_up || 0} / ${l.opening_voi || 0}</td>
                  <td class="text-center text-primary">+${(l.in_up || 0) + (l.in_voi || 0)}</td>
                  <td class="text-center text-success">-${(l.returned_up || 0) + (l.returned_voi || 0)}</td>
                  <td class="text-center font-bold text-danger">${l.closing_up || 0} Úp / ${l.closing_voi || 0} Vòi</td>
                  <td class="text-right">${l.deposit ? fmt(l.deposit) + 'đ' : '—'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="openReturnShellModal(${l.id}, '${esc(l.customer)}', ${l.closing_up}, ${l.closing_voi})">
                      Thu vỏ
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.openReturnShellModal = function(id, customer, curUp, curVoi) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Thu hồi vỏ bình — ${esc(customer)}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:14px; font-size:12px; color:#64748b;">
        Khách hàng hiện đang nợ: <b>${curUp} vỏ Úp</b> và <b>${curVoi} vỏ Vòi</b>.
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Số vỏ Úp thu về</label>
          <input type="number" id="ret-up-qty" class="form-control" value="${Math.min(1, curUp)}" min="0" max="${curUp}">
        </div>
        <div class="form-group">
          <label class="form-label">Số vỏ Vòi thu về</label>
          <input type="number" id="ret-voi-qty" class="form-control" value="${Math.min(1, curVoi)}" min="0" max="${curVoi}">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-success" onclick="submitReturnShell(${id})">Xác nhận thu hồi vỏ</button>
    </div>
  `);
};

window.submitReturnShell = async function(id) {
  const up = Number(document.getElementById('ret-up-qty').value) || 0;
  const voi = Number(document.getElementById('ret-voi-qty').value) || 0;
  const res = await api('/api/shells/return', {
    method: 'POST',
    body: JSON.stringify({ id, ret_up: up, ret_voi: voi }),
  });
  showToast(res.message);
  closeModal();
  renderShells(document.getElementById('view-container'));
};

// 6. Pickings View (Phiếu Kho)
async function renderPickings(el) {
  const pickings = await api('/api/pickings');
  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">📋 Danh sách phiếu kho (Nhập / Xuất / Chuyển nội bộ)</span>
        <span class="badge badge-draft">${pickings.length} phiếu</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Loại phiếu</th>
              <th>Nguồn ➔ Đích</th>
              <th>Chứng từ gốc</th>
              <th>Ngày lên lịch</th>
              <th>Cước vận chuyển</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${pickings.slice(0, 30).map(p => `
              <tr>
                <td class="font-bold text-primary">${esc(p.name)}</td>
                <td><span class="badge ${p.type_code === 'outgoing' ? 'badge-sale' : 'badge-purple'}">${p.type_code === 'outgoing' ? 'Xuất giao' : 'Điều chuyển'}</span></td>
                <td>${esc(p.src_name)} ➔ ${esc(p.dest_name)}</td>
                <td>${esc(p.origin || '—')}</td>
                <td>${esc(p.scheduled_date)}</td>
                <td>${fmt(p.carrier_fee)} đ</td>
                <td>${renderBadge(p.state)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="openPickingDetailModal(${p.id})">Chi tiết</button>
                  ${p.state !== 'done' ? `<button class="btn btn-success btn-sm" onclick="confirmPicking(${p.id})">✔ Xác nhận</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openPickingDetailModal = async function(id) {
  const { picking, moves, workers } = await api(`/api/pickings/${id}`);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Phiếu kho ${esc(picking.name)}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:#f8fafc; padding:12px; border-radius:8px; font-size:12px; margin-bottom:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div><b>Nguồn:</b> ${esc(picking.src_name)}</div>
        <div><b>Đích:</b> ${esc(picking.dest_name)}</div>
        <div><b>Trạng thái:</b> ${renderBadge(picking.state)}</div>
        <div><b>Cước phí:</b> ${fmt(picking.carrier_fee)} đ</div>
      </div>

      <div style="font-weight:700; margin-bottom:8px;">Dòng dịch chuyển mặt hàng (Bút toán kép):</div>
      <table class="data-table" style="margin-bottom:14px;">
        <thead>
          <tr>
            <th>Mặt hàng</th>
            <th class="text-right">Số lượng</th>
            <th class="text-right">Hàng tặng (KM)</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${moves.map(m => `
            <tr>
              <td>${esc(m.product_name)}</td>
              <td class="text-right font-bold">${fmt(m.qty)}</td>
              <td class="text-right text-success font-bold">${m.promo_qty ? '+' + fmt(m.promo_qty) : '0'}</td>
              <td>${renderBadge(m.state)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="font-weight:700; margin-bottom:8px;">Nhân viên giao hàng nhận thù lao (5.000đ/bình):</div>
      ${workers.length ? `
        <div style="font-size:12px; color:#1e293b;">
          ${workers.map(w => `• <b>${esc(w.employee)}</b> được chia: <span class="text-success font-bold">${fmt(w.fee_share)} đ</span>`).join('<br>')}
        </div>
      ` : '<div style="font-size:12px; color:#64748b;">Chưa phân công người đi giao.</div>'}
    </div>
    <div class="modal-footer">
      ${picking.state !== 'done' ? `
        <button class="btn btn-success" onclick="confirmPicking(${picking.id})">✔ Xác nhận xuất kho ngay</button>
      ` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
    </div>
  `);
};

window.confirmPicking = async function(id) {
  await api(`/api/pickings/${id}/confirm`, { method: 'POST' });
  showToast('Phiếu kho đã được xác nhận! Tồn kho và sổ vỏ đã được cập nhật.');
  closeModal();
  renderView();
};

// 7. Stock Quants View
async function renderQuants(el) {
  const quants = await api('/api/quants');
  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">🏬 Tồn kho thời gian thực theo từng vị trí</span>
        <span class="badge badge-sale">Trực tiếp thời gian thực</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Địa điểm kho</th>
              <th>Mã vị trí</th>
              <th>Sản phẩm</th>
              <th>ĐVT</th>
              <th class="text-right">Số lượng tồn</th>
              <th>Đánh giá an toàn</th>
            </tr>
          </thead>
          <tbody>
            ${quants.map(q => `
              <tr>
                <td class="font-bold">${esc(q.location_name)}</td>
                <td><code>${esc(q.location_code)}</code></td>
                <td>${esc(q.product_name)}</td>
                <td><span class="badge badge-draft">${esc(q.uom_name)}</span></td>
                <td class="text-right font-bold ${q.quantity < 20 ? 'text-danger' : 'text-success'}" style="font-size:14px;">${fmt(q.quantity)}</td>
                <td>${q.quantity < 20 ? '<span class="badge badge-danger">Thiếu hàng</span>' : '<span class="badge badge-done">An toàn</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 8. Moves View
async function renderMoves(el) {
  const moves = await api('/api/moves');
  el.innerHTML = `
    <div class="pattern-callout">
      <span class="badge-pattern">Double-Entry Stock</span>
      <div>
        <b>Nguyên lý Bút toán kép:</b> Không có hàng hóa nào tự nhiên sinh ra hay mất đi. Mọi dịch chuyển đều ghi rõ <code>Vị trí Nguồn ➔ Vị trí Đích</code>, đảm bảo tính toàn vẹn và kiểm toán 100%.
      </div>
    </div>
    <div class="card-box">
      <div class="card-box-header"><span class="card-box-title">🔄 Lịch sử các dòng dịch chuyển kho</span></div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Phiếu kho</th>
              <th>Mặt hàng</th>
              <th>Vị trí Nguồn</th>
              <th>Vị trí Đích</th>
              <th class="text-right">Số lượng</th>
              <th>Loại dịch chuyển</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${moves.slice(0, 50).map(m => `
              <tr>
                <td class="font-bold text-primary">${esc(m.picking_name || 'Stock Move')}</td>
                <td>${esc(m.product_name)}</td>
                <td>${esc(m.src_name)}</td>
                <td>${esc(m.dest_name)}</td>
                <td class="text-right font-bold">${fmt(m.qty)}</td>
                <td>${m.is_promo ? '<span class="badge badge-warning">Khuyến mãi</span>' : '<span class="badge badge-draft">Thương mại</span>'}</td>
                <td>${renderBadge(m.state)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 9. Delivery View
async function renderDelivery(el) {
  const data = await api('/api/delivery');
  el.innerHTML = `
    <div class="pattern-callout">
      <span class="badge-pattern">Thù lao bốc xếp 5.000đ/bình</span>
      <div>
        <b>Giải quyết Sheet Vận chuyển của Excel:</b> Mỗi đơn hàng được tự động tính cước 5.000đ/bình. Khi có nhiều người cùng đi giao (Phương, Huế, Hưng, Khoa...), hệ thống tự chia đều thù lao cho từng cá nhân và tổng hợp chuyển sang bảng lương.
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
      <div class="card-box">
        <div class="card-box-header"><span class="card-box-title">🚚 Tổng thù lao theo nhân viên</span></div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nhân viên giao nhận</th>
                <th class="text-center">Số chuyến</th>
                <th class="text-right">Tiền thù lao</th>
              </tr>
            </thead>
            <tbody>
              ${data.workers.map(w => `
                <tr>
                  <td class="font-semibold">${esc(w.employee)}</td>
                  <td class="text-center">${w.total_trips}</td>
                  <td class="text-right font-bold text-success">${fmt(w.total_fee)} đ</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-box">
        <div class="card-box-header"><span class="card-box-title">📋 Lịch sử chuyến giao & Phân chia cước</span></div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Phiếu giao</th>
                <th>Ngày</th>
                <th class="text-right">Tổng cước</th>
                <th>Nhân sự chia tiền cước</th>
              </tr>
            </thead>
            <tbody>
              ${data.trips.map(t => `
                <tr>
                  <td class="font-bold text-primary">${esc(t.picking_name)}</td>
                  <td>${esc(t.scheduled_date)}</td>
                  <td class="text-right font-bold">${fmt(t.carrier_fee)} đ</td>
                  <td style="font-size:12px;">${esc(t.shared_workers || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 10. Cash & Customer Debt View
async function renderCash(el) {
  const data = await api('/api/cash');
  el.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
      <div class="card-box">
        <div class="card-box-header"><span class="card-box-title">💵 Tiền theo nhân viên bán hàng</span></div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Người bán</th>
                <th class="text-right">Doanh số</th>
                <th class="text-right">Đã nộp quỹ</th>
                <th class="text-right">Còn nợ đọng</th>
              </tr>
            </thead>
            <tbody>
              ${data.bySeller.map(s => `
                <tr>
                  <td class="font-semibold">${esc(s.seller)}</td>
                  <td class="text-right font-bold">${fmt(s.total_sales)} đ</td>
                  <td class="text-right text-success">${fmt(s.total_collected)} đ</td>
                  <td class="text-right font-bold ${s.remaining_debt > 0 ? 'text-danger' : 'text-muted'}">${fmt(s.remaining_debt)} đ</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-box">
        <div class="card-box-header"><span class="card-box-title">📄 Công nợ tiền khách hàng</span></div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th class="text-right">Tổng mua</th>
                <th class="text-right">Đã trả</th>
                <th class="text-right">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              ${data.byCustomer.map(c => `
                <tr>
                  <td class="font-semibold">${esc(c.customer_name)}</td>
                  <td class="text-right">${fmt(c.total_bought)} đ</td>
                  <td class="text-right text-success">${fmt(c.total_paid)} đ</td>
                  <td class="text-right font-bold text-danger">${fmt(c.debt_balance)} đ</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 11. DVGT View
async function renderDvgt(el) {
  const data = await api('/api/dvgt');
  el.innerHTML = `
    <div class="pattern-callout">
      <span class="badge-pattern">Field Service & Technical Water Service</span>
      <div>
        <b>Chuẩn hóa Dịch vụ gia tăng (DVGT) & Kỹ thuật mạng nước QUAWACO:</b>
        Tích hợp <b>Mã danh bạ đồng hồ nước (HG095791...)</b> · <b>Khung giờ hẹn khách (Time-slots)</b> · <b>Vật tư phụ tùng thay thế (Thanh Magie, phao, zoăng, hộp đồng hồ)</b>.
      </div>
    </div>

    <!-- Summary metrics -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
      ${data.summary.slice(0, 4).map(s => `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="font-size:11.5px; color:#64748b; font-weight:600;">${esc(s.service)}</div>
          <div style="font-size:18px; font-weight:700; color:#1e293b; margin:4px 0;">${fmt(s.total_revenue)} đ</div>
          <div style="font-size:11px; color:#7c3aed;">${s.count} ca thực hiện (Vật tư: ${fmt(s.total_parts)}đ)</div>
        </div>
      `).join('')}
    </div>

    <div class="card-box">
      <div class="card-box-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="card-box-title">🔧 Sổ Quản Lý DVGT & Kỹ Thuật Hiện Trường</span>
          <span class="badge badge-draft">${data.list.length} yêu cầu</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openCreateDvgtModal()">＋ Đăng ký ca dịch vụ & vật tư</button>
      </div>
      <div class="card-box-body" style="padding:0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Mã ĐH QUAWACO</th>
                <th>Khách hàng & SĐT</th>
                <th>Dịch vụ yêu cầu</th>
                <th>Vật tư thay thế</th>
                <th>Khung giờ hẹn</th>
                <th>Người vận động</th>
                <th class="text-right">Tiền vật tư</th>
                <th class="text-right">Tổng thu</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${data.list.slice(0, 50).map(d => `
                <tr>
                  <td>${esc(d.date)}</td>
                  <td>
                    ${d.water_meter_code ? `<span class="meter-pill">QUAWACO ${esc(d.water_meter_code)}</span>` : '<span style="color:#94a3b8; font-size:11px;">—</span>'}
                  </td>
                  <td>
                    <div class="font-semibold">${esc(d.customer)}</div>
                    <div style="font-size:11px; color:#64748b;">${esc(d.phone || 'Chưa có SĐT')}</div>
                  </td>
                  <td><span class="badge badge-purple">${esc(d.service || 'DV Kỹ thuật')}</span></td>
                  <td>
                    ${d.parts_used ? `<span class="parts-pill">🔩 ${esc(d.parts_used)}</span>` : '<span style="color:#94a3b8; font-size:11px;">Không có</span>'}
                  </td>
                  <td>
                    <span class="timeslot-pill">⏰ ${esc(d.time_slot || 'Giờ hành chính')}</span>
                  </td>
                  <td>${esc(d.referrer || 'Xí nghiệp')}</td>
                  <td class="text-right font-semibold ${d.parts_fee > 0 ? 'text-warning' : 'text-muted'}">${fmt(d.parts_fee)} đ</td>
                  <td class="text-right font-bold text-primary">${fmt(d.revenue)} đ</td>
                  <td>${d.doc_status && d.doc_status.includes('đã') ? '<span class="badge badge-done">Đã có phiếu</span>' : (d.doc_status && d.doc_status.includes('Hủy') ? '<span class="badge badge-danger">Đã hủy</span>' : '<span class="badge badge-warning">Đang xử lý</span>')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.openCreateDvgtModal = function() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">＋ Đăng Ký Ca DVGT & Kỹ Thuật Tuyến Mạng</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="flex:2;">
          <label class="form-label">Tên khách hàng *</label>
          <input type="text" id="dvgt-customer" class="form-control" placeholder="Ví dụ: Đỗ Đức Việt, Trần Thị Thu Hiền..." required>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Số điện thoại</label>
          <input type="text" id="dvgt-phone" class="form-control" placeholder="09xxxxxxx">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Mã đồng hồ nước QUAWACO (Nếu có)</label>
          <input type="text" id="dvgt-meter" class="form-control" placeholder="Ví dụ: HG095791, HG094774...">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Khung giờ hẹn khách (Time-slot)</label>
          <select id="dvgt-timeslot" class="form-control">
            <option value="Trưa (11:00 - 13:00)">Trưa (11:00 - 13:00) — Tranh thủ nghỉ trưa</option>
            <option value="Đầu chiều (13:30 - 15:30)">Đầu chiều (13:30 - 15:30)</option>
            <option value="Tối (17:00 - 20:00)">Tối (17:00 - 20:00) — Sau giờ tan sở</option>
            <option value="Sáng (08:00 - 11:30)">Sáng (08:00 - 11:30)</option>
            <option value="Cuối tuần (T7 - CN)">Cuối tuần (Thứ 7 - Chủ Nhật)</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Loại dịch vụ chính</label>
          <select id="dvgt-service" class="form-control" onchange="updateDvgtParts()">
            <option value="Bảo dưỡng bình nóng lạnh (BNL)">Bảo dưỡng bình nóng lạnh (BNL)</option>
            <option value="Súc rửa bể ngầm / Téc nước inox">Súc rửa bể ngầm / Téc nước inox</option>
            <option value="Vệ sinh máy giặt lồng ngang">Vệ sinh máy giặt lồng ngang</option>
            <option value="Vệ sinh máy giặt lồng đứng">Vệ sinh máy giặt lồng đứng</option>
            <option value="Thay hộp bảo vệ đồng hồ nước">Thay hộp bảo vệ đồng hồ nước</option>
            <option value="Kẹp chì niêm phong / Chuyển công tơ">Kẹp chì niêm phong / Chuyển công tơ</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Vật tư phụ tùng kèm theo</label>
          <select id="dvgt-parts" class="form-control">
            <option value="" data-fee="0">Không thay phụ tùng (Chỉ tiền công)</option>
            <option value="1 Thanh Magie chống ăn mòn BNL" data-fee="133702">1 Thanh Magie chống ăn mòn (+133.702đ)</option>
            <option value="2 Thanh Magie chống ăn mòn BNL" data-fee="193531">Bộ 2 Thanh Magie BNL (+193.531đ)</option>
            <option value="Hộp bảo vệ composite D15 + kẹp chì" data-fee="95000">Hộp bảo vệ đồng hồ composite D15 (+95.000đ)</option>
            <option value="Phao điện thông minh chống tràn & zoăng" data-fee="120000">Phao điện thông minh chống tràn (+120.000đ)</option>
            <option value="Gói hóa chất súc lồng giặt diệt khuẩn" data-fee="45000">Dung dịch súc lồng giặt diệt khuẩn (+45.000đ)</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Người vận động (CBCNV)</label>
          <input type="text" id="dvgt-referrer" class="form-control" placeholder="Ví dụ: Đoàn Dương - KDĐH, Bùi Hồng Nhung - KTTC...">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Kỹ thuật viên tiếp nhận</label>
          <input type="text" id="dvgt-worker" class="form-control" placeholder="Tổ SCC / Kỹ thuật mạng lưới">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Địa chỉ nhà & Yêu cầu cụ thể</label>
        <textarea id="dvgt-desc" class="form-control" rows="2" placeholder="Tổ 29 khu 2 phường Cao Xanh, Hồng Gai..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="submitNewDvgt()">Lưu Phiếu Dịch Vụ</button>
    </div>
  `);
};

window.submitNewDvgt = async function() {
  const customer = document.getElementById('dvgt-customer').value.trim();
  const phone = document.getElementById('dvgt-phone').value.trim();
  const service = document.getElementById('dvgt-service').value;
  const referrer = document.getElementById('dvgt-referrer').value.trim();
  const meter = document.getElementById('dvgt-meter').value.trim();
  const timeSlot = document.getElementById('dvgt-timeslot').value;
  const partsSel = document.getElementById('dvgt-parts');
  const partsUsed = partsSel.value;
  const partsFee = Number(partsSel.options[partsSel.selectedIndex]?.dataset.fee || 0);
  const description = document.getElementById('dvgt-desc').value.trim();

  if (!customer) {
    alert('Vui lòng nhập tên khách hàng');
    return;
  }

  await api('/api/dvgt', {
    method: 'POST',
    body: JSON.stringify({
      customer,
      phone,
      service,
      referrer,
      water_meter_code: meter,
      time_slot: timeSlot,
      parts_used: partsUsed,
      parts_fee: partsFee,
      labor_fee: 150000,
      description
    }),
  });

  showToast('Đã tiếp nhận yêu cầu DVGT & phụ tùng thành công!');
  closeModal();
  navigateTo('dvgt');
};

// 12. KPI View
async function renderKpi(el) {
  const data = await api('/api/kpi');
  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">🎯 Kế hoạch năm 2026: 1.592.834.000 đ (${data.plan.headcount} CBCNV)</span>
        <span class="badge badge-sale">Kế hoạch bình quân: 7.885.316 đ/người</span>
      </div>
      <div class="card-box-body">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
          ${data.byStation.map(s => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
              <div style="font-size:11px; color:#64748b; text-transform:uppercase;">${esc(s.station)}</div>
              <div style="font-size:18px; font-weight:700; color:#1e293b; margin:4px 0;">${fmt(s.total_revenue)} đ</div>
              <div style="font-size:11px; color:#16a34a;">${s.headcount} nhân sự</div>
            </div>
          `).join('')}
        </div>

        <div style="font-weight:700; margin-bottom:12px;">Bảng xếp hạng thi đua cá nhân:</div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Chức danh</th>
                <th>Tổ / Trạm</th>
                <th class="text-right">Doanh số đạt được</th>
                <th class="text-right">% Hoàn thành</th>
                <th>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              ${data.employees.slice(0, 40).map(e => `
                <tr>
                  <td class="font-bold">${esc(e.name)}</td>
                  <td>${esc(e.position)}</td>
                  <td>${esc(e.station)}</td>
                  <td class="text-right font-bold text-primary">${fmt(e.total)} đ</td>
                  <td class="text-right font-bold ${e.completion_rate >= 100 ? 'text-success' : (e.completion_rate >= 50 ? 'text-primary' : 'text-warning')}">
                    ${Math.round(e.completion_rate)}%
                  </td>
                  <td>${e.completion_rate >= 100 ? '<span class="badge badge-done">Vượt chỉ tiêu</span>' : '<span class="badge badge-draft">Đang thực hiện</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 13. Relations Architecture View
async function renderRelations(el) {
  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">🕸️ Bản đồ kiến trúc quan hệ 5 Trụ (MiERP Pattern)</span>
      </div>
      <div class="card-box-body">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; font-size:13px; line-height:1.8; margin-bottom:20px;">
          <h4 style="color:#2563eb; margin-bottom:10px;">🌟 Cách giải quyết trực tiếp bài toán của xí nghiệp bằng kiến trúc MiERP:</h4>
          <ul>
            <li><b>Trụ Khách hàng ➔ Bán hàng:</b> Đơn hàng có chu trình rõ ràng (Báo giá ➔ Đơn bán ➔ Đã giao). Tự động phân tách Kênh Xí nghiệp (tính KPI) và Kênh Công ty/Bãi Cháy (không tính KPI).</li>
            <li><b>Trụ Bán hàng ➔ Kho vận:</b> Xác nhận đơn hàng tự động sinh Phiếu kho (Procurement Rule). Dòng dịch chuyển kho tuân theo nguyên lý <b>Bút toán kép (Nguồn ➔ Đích)</b> giúp triệt tiêu hoàn toàn lỗi âm kho trên xe điện.</li>
            <li><b>Trụ Kho vận ➔ Sổ nợ vỏ bình:</b> Khi giao nước bình 19L, hệ thống tự động đối trừ vỏ thu hồi hoặc ghi tăng nợ vỏ bình (Úp/Vòi) và quản lý tiền ký cược cọc vỏ 50.000đ/bình.</li>
            <li><b>Trụ Kho vận ➔ Nhân viên & Tiền lương:</b> Cước vận chuyển chuẩn 5.000đ/bình được tự động chia đều cho nhóm tài xế/phụ xe cùng thực hiện chuyến giao xe điện.</li>
            <li><b>Trụ Bán hàng & DVGT ➔ KPI thi đua:</b> Mọi đơn hàng và ca DVGT hoàn thành đều tự động cộng dồn doanh số vào bảng theo dõi kế hoạch năm của nhân viên vận động.</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Init
function initApp() {
  setupGlobalEvents();
  const hash = location.hash.slice(1);
  renderNav();
  renderRoleBanner();
  navigateTo(hash && TITLES[hash] ? hash : 'overview');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


// ══════════════════════════ 18. COMMERCIAL SALES REPORT VIEW ══════════════════════════ //
async function renderCommercial(el) {
  const currentMonth = state.selectedCommercialMonth || '08/2026';
  const data = await api('/api/reports/commercial?month=' + encodeURIComponent(currentMonth));
  const m = data.meta;
  const s = data.summary;
  const items = data.items;

  el.innerHTML = `
    <!-- Toolbar with Month Selector & Export / Print Actions -->
    <div class="report-toolbar">
      <div style="display:flex; align-items:center; gap:12px;">
        <label style="font-size:12px; font-weight:700; color:#1e293b;">📅 Chọn kỳ báo cáo:</label>
        <select id="commercial-month-select" class="role-select" style="background:#f8fafc; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; font-weight:700;">
          <option value="08/2026" ${m.selectedMonth === '08/2026' ? 'selected' : ''}>Tháng 08/2026 (Số liệu gốc từ file Excel Nước thương mại)</option>
          <option value="09/2026" ${m.selectedMonth === '09/2026' ? 'selected' : ''}>Tháng 09/2026 (Tự động tổng hợp thời gian thực từ ERP)</option>
        </select>
        <span class="badge badge-sale">${m.period}</span>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-secondary btn-sm" id="btn-print-commercial" style="display:flex; align-items:center; gap:6px;">
          <span>🖨️</span>
          <span>In Biểu Mẫu / PDF</span>
        </button>
        <button class="btn btn-primary btn-sm" id="btn-export-commercial" style="display:flex; align-items:center; gap:6px;">
          <span>📥</span>
          <span>Xuất Dữ Liệu Excel</span>
        </button>
      </div>
    </div>

    <!-- Explanatory Value Banner -->
    <div class="card-box" style="margin-bottom:20px; background:#eff6ff; border-color:#93c5fd;">
      <div class="card-box-body" style="padding:14px 18px; font-size:12px; line-height:1.6; color:#1e3a8a;">
        <div style="font-weight:700; font-size:13px; margin-bottom:4px;">💡 Ý Nghĩa Nghiệp Vụ & Giải Pháp ERP Cho Biểu Mẫu "Nước thương mại.xlsx":</div>
        <ul style="margin-left:18px;">
          <li><b>Bóc tách từ file mới:</b> Bạn vừa bổ sung file <code>excel/Nước thương mại.xlsx</code> — đây là biểu mẫu chính thức nộp lên Ban Giám Đốc Công ty mẹ <b>QUAWACO</b>.</li>
          <li><b>Đơn giá chưa thuế VAT (Tax-exclusive):</b> Biểu mẫu quy định dùng giá trước thuế VAT 8% (VD: Kiềm 19L giá 52.000đ ➔ chưa thuế là <b>48.148đ</b>; Vỉ 500ml giá 98.000đ ➔ chưa thuế là <b>90.741đ</b>).</li>
          <li><b>Tự động hóa 100%:</b> Trong Excel, cán bộ phải gõ tay từng con số và tự nhân thủ công. Với QAROMI ERP, hệ thống tự động tổng hợp từ toàn bộ đơn bán trong kỳ và tự động cộng dồn lũy kế năm tài chính (YTD) đạt <b>${fmt(s.ytd_rev)} đ</b>!</li>
        </ul>
      </div>
    </div>

    <!-- Official Administrative Printable Document -->
    <div class="report-paper" id="printable-report">
      <!-- Document Header -->
      <div class="report-header-grid">
        <div class="report-header-left">
          <div class="company-name">${esc(m.company)}</div>
          <div class="unit-name">${esc(m.branch)}</div>
        </div>
        <div class="report-header-right">
          <div class="republic">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
        </div>
      </div>

      <!-- Title Block -->
      <div class="report-title-block">
        <div class="report-main-title">${esc(m.title)}</div>
        <div class="report-sub-title">${esc(m.period)}</div>
      </div>

      <div class="report-currency">Đơn vị tính: VNĐ</div>

      <!-- 15-Column Data Table Matching Excel Exactly -->
      <table class="report-table">
        <thead>
          <tr>
            <th rowspan="3" style="width:130px;">Đơn vị</th>
            <th colspan="2">Vỉ 24 chai 350ml</th>
            <th colspan="2">Hộp 24 chai 350ml</th>
            <th colspan="2">Vỉ 24 chai 500ml</th>
            <th colspan="2">Hộp 24 chai 500ml</th>
            <th colspan="2">Bình 5 gal ion kiềm</th>
            <th colspan="2">Bình 5 gal tinh khiết</th>
            <th colspan="2" style="background:#e2e8f0;">Tổng cộng</th>
          </tr>
          <tr>
            <th colspan="2" style="font-size:10px; color:#475569;">${fmt(items[0].price_untaxed)} đ</th>
            <th colspan="2" style="font-size:10px; color:#475569;">${fmt(items[1].price_untaxed)} đ</th>
            <th colspan="2" style="font-size:10px; color:#475569;">${fmt(items[2].price_untaxed)} đ</th>
            <th colspan="2" style="font-size:10px; color:#475569;">${fmt(items[3].price_untaxed)} đ</th>
            <th colspan="2" style="font-size:10px; color:#475569;">${fmt(items[4].price_untaxed)} đ</th>
            <th colspan="2" style="font-size:10px; color:#475569;">${fmt(items[5].price_untaxed)} đ</th>
            <th colspan="2" style="background:#e2e8f0;"></th>
          </tr>
          <tr>
            <th>SL</th><th>DT</th>
            <th>SL</th><th>DT</th>
            <th>SL</th><th>DT</th>
            <th>SL</th><th>DT</th>
            <th>SL</th><th>DT</th>
            <th>SL</th><th>DT</th>
            <th style="background:#e2e8f0;">SL</th><th style="background:#e2e8f0;">DT</th>
          </tr>
        </thead>
        <tbody>
          <!-- I. Thực hiện tháng -->
          <tr class="row-header-group">
            <td colspan="15">I. Thực hiện tháng</td>
          </tr>
          <tr class="row-total">
            <td>Tổng</td>
            ${items.map(it => `
              <td class="text-right font-bold">${fmt(it.month_qty)}</td>
              <td class="text-right font-bold">${fmt(it.month_rev)}</td>
            `).join('')}
            <td class="text-right font-bold text-primary" style="background:#e2e8f0;">${fmt(s.month_qty)}</td>
            <td class="text-right font-bold text-primary" style="background:#e2e8f0;">${fmt(s.month_rev)}</td>
          </tr>
          <tr>
            <td>XNN Hồng Gai</td>
            ${items.map(it => `
              <td class="text-right">${fmt(it.month_qty)}</td>
              <td class="text-right">${fmt(it.month_rev)}</td>
            `).join('')}
            <td class="text-right font-bold" style="background:#f8fafc;">${fmt(s.month_qty)}</td>
            <td class="text-right font-bold" style="background:#f8fafc;">${fmt(s.month_rev)}</td>
          </tr>

          <!-- II. Lũy kế -->
          <tr class="row-header-group">
            <td colspan="15">II. Lũy kế năm tài chính (YTD)</td>
          </tr>
          <tr class="row-total" style="background:#eff6ff;">
            <td style="color:#1e3a8a;">Tổng lũy kế</td>
            ${items.map(it => `
              <td class="text-right font-bold" style="color:#1e3a8a;">${fmt(it.ytd_qty)}</td>
              <td class="text-right font-bold" style="color:#1e3a8a;">${fmt(it.ytd_rev)}</td>
            `).join('')}
            <td class="text-right font-bold text-success" style="background:#dbeafe; font-size:12px;">${fmt(s.ytd_qty)}</td>
            <td class="text-right font-bold text-success" style="background:#dbeafe; font-size:12px;">${fmt(s.ytd_rev)}</td>
          </tr>
          <tr>
            <td>XNN Hồng Gai</td>
            ${items.map(it => `
              <td class="text-right">${fmt(it.ytd_qty)}</td>
              <td class="text-right">${fmt(it.ytd_rev)}</td>
            `).join('')}
            <td class="text-right font-bold" style="background:#f8fafc;">${fmt(s.ytd_qty)}</td>
            <td class="text-right font-bold" style="background:#f8fafc;">${fmt(s.ytd_rev)}</td>
          </tr>
        </tbody>
      </table>

      <!-- 3 Administrative Signature Blocks -->
      <div class="report-sign-grid">
        <div>
          <div class="report-sign-title">${esc(m.signatories.creator.title)}</div>
          <div class="report-sign-name">${esc(m.signatories.creator.name)}</div>
        </div>
        <div>
          <div class="report-sign-title">${esc(m.signatories.business.title)}</div>
          <div class="report-sign-name">${esc(m.signatories.business.name)}</div>
        </div>
        <div>
          <div class="report-sign-title">${esc(m.signatories.leader.title)}</div>
          <div class="report-sign-name">${esc(m.signatories.leader.name)}</div>
        </div>
      </div>
    </div>
  `;

  // Event handlers
  const monthSelect = el.querySelector('#commercial-month-select');
  if (monthSelect) {
    monthSelect.addEventListener('change', e => {
      state.selectedCommercialMonth = e.target.value;
      renderCommercial(el);
    });
  }

  const btnPrint = el.querySelector('#btn-print-commercial');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
  }

  const btnExport = el.querySelector('#btn-export-commercial');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      showToast('Đang kết xuất dữ liệu báo cáo...');
      window.open('/api/reports/commercial?month=' + encodeURIComponent(currentMonth), '_blank');
    });
  }
}
