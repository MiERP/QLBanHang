/**
 * ============================================================================
 * QAROMI ERP — HỆ THỐNG ĐIỀU HÀNH DOANH NGHIỆP THƯƠNG MẠI
 * Phiên bản sản phẩm thương mại chuẩn Odoo / MiERP
 * ============================================================================
 */

const state = {
  view: 'overview',
  products: [],
  meta: null,
  selectedCommercialMonth: '08/2026',
  employeeFilter: { q: '', station: 'all', position: 'all' },
  customerFilter: { q: '', type: 'all', debtOnly: false, shellOnly: false },
  orderInvoiceFilter: 'all',
  revenueTab: 'by_product',
  shellTab: 'transactions'
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

// ══════════════════════════ 6 ĐẦU MỐI MENU CHUẨN SẢN PHẨM ══════════════════════════ //
const MENU = [
  {
    group: 'TỔNG QUAN',
    items: [
      { id: 'overview', name: 'Bảng điều khiển', icon: '📊' },
      { id: 'worklist', name: 'Việc cần xử lý', icon: '🔔' },
    ]
  },
  {
    group: 'QUẢN LÝ BÁN HÀNG',
    items: [
      { id: 'orders', name: 'Đơn bán hàng & Báo giá', icon: '🧾' },
      { id: 'customers', name: 'Khách hàng & Đối tác', icon: '🏢' },
      { id: 'cash', name: 'Doanh thu & Thu tiền COD', icon: '💰' },
      { id: 'products', name: 'Sản phẩm & Bảng giá', icon: '📦' },
      { id: 'delivery', name: 'Chi phí vận chuyển', icon: '🚚' },
      { id: 'dvgt', name: 'Dịch vụ gia tăng DVGT', icon: '🔧' },
    ]
  },
  {
    group: 'QUẢN LÝ NHÂN VIÊN',
    items: [
      { id: 'employees', name: 'Danh sách nhân viên', icon: '👥' },
      { id: 'kpi', name: 'KPI theo nhân viên', icon: '🎯' },
      { id: 'kpi_station', name: 'KPI theo trạm / tổ', icon: '🏢' },
      { id: 'guards', name: 'Lịch trực bốc xếp', icon: '🛡️' },
    ]
  },
  {
    group: 'QUẢN LÝ KHO BÃI',
    items: [
      { id: 'quants', name: 'Tồn kho theo vị trí', icon: '🏬' },
      { id: 'pickings', name: 'Phiếu kho (Nhập/Xuất)', icon: '📋' },
      { id: 'moves', name: 'Dòng dịch chuyển kho', icon: '🔄' },
      { id: 'shells', name: 'Sổ nợ vỏ bình & Cọc', icon: '🧴' },
      { id: 'interbranch', name: 'Tiếp ứng & Vay kho', icon: '🚛' },
    ]
  },
  {
    group: 'BÁO CÁO',
    items: [
      { id: 'commercial', name: 'Báo cáo thương mại QAROMI', icon: '📑' },
      { id: 'report_debt', name: 'Công nợ khách hàng', icon: '💳' },
      { id: 'report_shells', name: 'Báo cáo nợ vỏ bình', icon: '🧴' },
      { id: 'audit', name: 'Đối soát & Kiểm kê', icon: '⚠️' },
    ]
  },
  {
    group: 'CẤU HÌNH HỆ THỐNG',
    items: [
      { id: 'config', name: 'Cấu hình Master Data', icon: '⚙️' },
      { id: 'blueprint', name: 'Kiến trúc hệ thống', icon: '🏛️' },
    ]
  }
];

const TITLES = {
  overview: ['Tổng quan', 'Bảng điều khiển'],
  worklist: ['Tổng quan', 'Việc cần xử lý'],
  orders: ['Quản lý bán hàng', 'Đơn bán hàng & Báo giá'],
  customers: ['Quản lý bán hàng', 'Danh bạ Khách hàng & Đối tác (360°)'],
  cash: ['Quản lý bán hàng', 'Doanh thu & Thu tiền COD'],
  products: ['Quản lý bán hàng', 'Sản phẩm & Bảng giá'],
  delivery: ['Quản lý bán hàng', 'Chi phí vận chuyển'],
  dvgt: ['Quản lý bán hàng', 'Dịch vụ gia tăng DVGT'],
  employees: ['Quản lý nhân viên', 'Danh sách nhân viên (202 CBCNV)'],
  kpi: ['Quản lý nhân viên', 'KPI cá nhân'],
  kpi_station: ['Quản lý nhân viên', 'KPI theo trạm / tổ'],
  guards: ['Quản lý nhân viên', 'Lịch trực bốc xếp'],
  quants: ['Quản lý kho bãi', 'Tồn kho theo vị trí'],
  pickings: ['Quản lý kho bãi', 'Phiếu kho (Nhập / Xuất)'],
  moves: ['Quản lý kho bãi', 'Dòng dịch chuyển kho'],
  shells: ['Quản lý kho bãi', 'Sổ nợ vỏ bình & Tiền cọc'],
  interbranch: ['Quản lý kho bãi', 'Tiếp ứng & Vay kho'],
  commercial: ['Báo cáo', 'Báo cáo thương mại nước ion kiềm QAROMI'],
  report_debt: ['Báo cáo', 'Báo cáo công nợ khách hàng'],
  report_shells: ['Báo cáo', 'Báo cáo tổng hợp nợ vỏ bình'],
  audit: ['Báo cáo', 'Báo cáo đối soát & Kiểm kê'],
  config: ['Cấu hình', 'Cấu hình Master Data & Danh mục'],
  blueprint: ['Cấu hình', 'Kiến trúc giải pháp hệ thống'],
};

function renderNav() {
  const container = document.getElementById('nav');
  if (!container) return;
  let html = '';

  for (const group of MENU) {
    html += `<div class="nav-group-title">${group.group}</div>`;
    for (const item of group.items) {
      const active = state.view === item.id ? 'active' : '';
      html += `
        <div class="nav-item ${active}" data-view="${item.id}">
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

  const [parentName, pageTitle] = TITLES[viewId] || ['QAROMI', viewId];
  const titleEl = document.getElementById('page-title');
  const breadcrumbTitleEl = document.getElementById('breadcrumb-title');
  const breadcrumbsEl = document.getElementById('top-breadcrumbs');

  if (titleEl) titleEl.textContent = pageTitle;
  if (breadcrumbsEl) {
    breadcrumbsEl.innerHTML = `
      <span class="breadcrumb-item">QAROMI</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item">${esc(parentName)}</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">${esc(pageTitle)}</span>
    `;
  }
  renderView();
}

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

  const btnOrder = document.getElementById('btn-quick-order');
  if (btnOrder) btnOrder.addEventListener('click', () => openCreateOrderModal());

  const btnDvgt = document.getElementById('btn-quick-dvgt');
  if (btnDvgt) btnDvgt.addEventListener('click', () => openCreateDvgtModal());
}

function renderBadge(status) {
  const m = {
    draft: ['Dự thảo', 'badge-draft'],
    sale: ['Đã duyệt', 'badge-sale'],
    done: ['Hoàn thành', 'badge-done'],
    confirmed: ['Sẵn sàng', 'badge-purple'],
    assigned: ['Đang xử lý', 'badge-warning'],
    completed: ['Đã có phiếu', 'badge-done'],
    cancelled: ['Đã hủy', 'badge-danger'],
  };
  const [txt, cls] = m[status] || [status, 'badge-draft'];
  return `<span class="badge ${cls}">${txt}</span>`;
}

function renderDocStatusbar(currentStatus) {
  const steps = [
    { key: 'draft', label: '1. Dự thảo' },
    { key: 'sale', label: '2. Đơn bán' },
    { key: 'delivery', label: '3. Xuất kho' },
    { key: 'done', label: '4. Hoàn tất' },
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

// ══════════════════════════ VIEW DISPATCHER ══════════════════════════ //
async function renderView() {
  const container = document.getElementById('view-container');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Đang tải...</div>`;

  try {
    switch (state.view) {
      // 1. TỔNG QUAN
      case 'overview': await renderOverview(container); break;
      case 'worklist': await renderWorklist(container); break;

      // 2. BÁN HÀNG
      case 'orders': await renderOrders(container); break;
      case 'customers': await renderCustomers(container); break;
      case 'cash': await renderCash(container); break;
      case 'products': await renderProducts(container); break;
      case 'delivery': await renderDelivery(container); break;
      case 'dvgt': await renderDvgt(container); break;

      // 3. NHÂN SỰ
      case 'employees': await renderEmployees(container); break;
      case 'kpi': await renderKpi(container); break;
      case 'kpi_station': await renderKpiStation(container); break;
      case 'guards': await renderGuards(container); break;

      // 4. KHO BÃI
      case 'quants': await renderQuants(container); break;
      case 'pickings': await renderPickings(container); break;
      case 'moves': await renderMoves(container); break;
      case 'shells': await renderShells(container); break;
      case 'interbranch': await renderInterbranch(container); break;

      // 5. BÁO CÁO
      case 'commercial': await renderCommercial(container); break;
      case 'report_debt': await renderReportDebt(container); break;
      case 'report_shells': await renderReportShells(container); break;
      case 'audit': await renderAudit(container); break;

      // 6. CẤU HÌNH
      case 'config': await renderConfig(container); break;
      case 'blueprint': await renderBlueprint(container); break;

      default: await renderOverview(container); break;
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:20px; color:#dc2626;">Lỗi tải dữ liệu: ${err.message}</div>`;
  }
}

// ══════════════════════════ 1. BẢNG ĐIỀU KHIỂN (CLEAN PRODUCT DASHBOARD) ══════════════════════════ //
async function renderOverview(el) {
  const data = await api('/api/overview');
  const m = data.metrics;
  const orders = await api('/api/orders');
  const recentOrders = orders.slice(0, 8);

  el.innerHTML = `
    <!-- 4 Clean Metric Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:24px;">
      <div class="metric-card">
        <div class="metric-label">Doanh thu tháng 9/2026</div>
        <div class="metric-value text-primary">${fmt(m.total_revenue)} <span style="font-size:14px; font-weight:normal;">đ</span></div>
        <div class="metric-trend text-success">↑ 77 đơn hàng đã hoàn tất</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Sản lượng tiêu thụ</div>
        <div class="metric-value">${fmt(m.delivered_bottles)} <span style="font-size:14px; font-weight:normal; color:#64748b;">bình & vỉ</span></div>
        <div class="metric-trend">2.724 bình lũy kế xuất kho</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Công nợ phải thu</div>
        <div class="metric-value text-danger">${fmt(m.pending_debt)} <span style="font-size:14px; font-weight:normal;">đ</span></div>
        <div class="metric-trend text-danger">38 khách hàng còn nợ đọng</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Nợ vỏ bình tại khách</div>
        <div class="metric-value text-warning">${fmt(m.pending_shells)} <span style="font-size:14px; font-weight:normal; color:#64748b;">vỏ</span></div>
        <div class="metric-trend">1.420 vỏ Úp · 422 vỏ Vòi</div>
      </div>
    </div>

    <!-- Main Grid: Recent Orders & Stock Overview -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px;">
      <!-- Left: Recent Sales Orders -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">🧾 Đơn Bán Hàng Gần Đây</span>
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('orders')">Xem tất cả đơn ➔</button>
        </div>
        <div class="card-box-body">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th>Người bán</th>
                  <th class="text-right">Tổng tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${recentOrders.map(o => `
                  <tr>
                    <td class="font-bold text-primary">${esc(o.name)}</td>
                    <td style="font-size:12px; color:#64748b;">${esc(o.date)}</td>
                    <td class="font-bold" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(o.partner_name)}</td>
                    <td style="font-size:12px;">${esc(o.seller)}</td>
                    <td class="text-right font-bold">${fmt(o.amount_total)} đ</td>
                    <td>${renderBadge(o.state)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right: Stock & Action Summary -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Stock Balance Card -->
        <div class="card-box">
          <div class="card-box-header">
            <span class="card-box-title">🏬 Tồn Kho Theo Điểm</span>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('quants')">Chi tiết ➔</button>
          </div>
          <div class="card-box-body" style="padding:14px 16px;">
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
              <span style="font-weight:600;">Kho Tăng Áp:</span>
              <span class="font-bold text-primary">548 bình/vỉ</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
              <span style="font-weight:600;">Kho Huế:</span>
              <span class="font-bold text-primary">426 bình/vỉ</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
              <span style="font-weight:600;">Xe tải điện (Lưu động):</span>
              <span class="font-bold text-success">330 bình/vỉ</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0;">
              <span style="font-weight:600;">Kho Văn Phòng:</span>
              <span class="font-bold">498 bình/vỉ</span>
            </div>
          </div>
        </div>

        <!-- Quick Access Card -->
        <div class="card-box">
          <div class="card-box-header">
            <span class="card-box-title">⚡ Thao Tác Nhanh</span>
          </div>
          <div class="card-box-body" style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="openCreateOrderModal()">＋ Lập báo giá đơn hàng</button>
            <button class="btn btn-secondary" style="width:100%; justify-content:center;" onclick="openCreateDvgtModal()">＋ Đăng ký ca dịch vụ DVGT</button>
            <button class="btn btn-secondary" style="width:100%; justify-content:center;" onclick="navigateTo('commercial')">📑 Xem Báo cáo thương mại QAROMI</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════ 2. VIỆC CẦN XỬ LÝ ══════════════════════════ //
async function renderWorklist(el) {
  const data = await api('/api/worklist');

  el.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-label">Đơn hàng chờ giao</div>
        <div class="metric-value text-primary">${data.pendingOrders.length}</div>
        <div class="metric-trend">Cần điều xe tải điện nạp kho</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Đơn hàng chưa thu tiền</div>
        <div class="metric-value text-danger">${data.unpaidOrders.length}</div>
        <div class="metric-trend text-danger">Theo dõi lái xe nộp COD</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Phiếu kho chờ xuất</div>
        <div class="metric-value text-warning">${data.confirmedPickings.length}</div>
        <div class="metric-trend">Thủ kho xác nhận xuất hàng</div>
      </div>
    </div>

    <div class="card-box" style="margin-bottom:20px;">
      <div class="card-box-header">
        <span class="card-box-title">🧾 Đơn Bán Chờ Giao Hàng (${data.pendingOrders.length})</span>
      </div>
      <div class="card-box-body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Ngày</th>
                <th>Khách hàng</th>
                <th>Người bán</th>
                <th class="text-right">Tổng tiền</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${data.pendingOrders.map(o => `
                <tr>
                  <td class="font-bold text-primary">${esc(o.name)}</td>
                  <td>${esc(o.date)}</td>
                  <td class="font-bold">${esc(o.partner_name)}</td>
                  <td>${esc(o.seller)}</td>
                  <td class="text-right font-bold">${fmt(o.amount_total)} đ</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="confirmOrder(${o.id})">Xác nhận & Điều xe</button>
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

// ══════════════════════════ 3. BÁO CÁO THƯƠNG MẠI (CLEAN COMMERCIAL REPORT) ══════════════════════════ //
async function renderCommercial(el) {
  const currentMonth = state.selectedCommercialMonth || '08/2026';
  const data = await api('/api/reports/commercial?month=' + encodeURIComponent(currentMonth));
  const m = data.meta;
  const s = data.summary;
  const items = data.items;

  el.innerHTML = `
    <!-- Clean Toolbar -->
    <div class="report-toolbar">
      <div style="display:flex; align-items:center; gap:12px;">
        <label style="font-size:12px; font-weight:700; color:#1e293b;">📅 Kỳ báo cáo:</label>
        <select id="commercial-month-select" class="role-select" style="background:#f8fafc; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; font-weight:700;">
          <option value="08/2026" ${m.selectedMonth === '08/2026' ? 'selected' : ''}>Tháng 08/2026</option>
          <option value="09/2026" ${m.selectedMonth === '09/2026' ? 'selected' : ''}>Tháng 09/2026</option>
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

      <div class="report-currency">Đơn vị tính: VNĐ (Đơn giá chưa bao gồm thuế GTGT 8%)</div>

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
      window.open('/api/reports/commercial?month=' + encodeURIComponent(currentMonth), '_blank');
    });
  }
}

// ══════════════════════════ 4. CẤU HÌNH MASTER DATA ══════════════════════════ //
async function renderConfig(el) {
  const cfg = await api('/api/config');

  el.innerHTML = `
    <div class="card-box" style="margin-bottom:20px;">
      <div class="card-box-header">
        <span class="card-box-title">⚙️ Cấu Hình Master Data & Thiết Lập Hệ Thống</span>
      </div>
      <div class="card-box-body">
        <div class="config-nav-tabs">
          <button class="config-nav-tab active" data-tab="uom">📏 1. Đơn vị tính</button>
          <button class="config-nav-tab" data-tab="positions">👔 2. Chức danh / Chức vụ</button>
          <button class="config-nav-tab" data-tab="stations">🏢 3. Đơn vị / Trạm</button>
          <button class="config-nav-tab" data-tab="locations">📍 4. Địa điểm kho & Kênh bán</button>
        </div>

        <!-- Tab 1: UoMs -->
        <div class="config-panel active" id="tab-uom">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã ĐVT</th>
                  <th>Tên đơn vị tính</th>
                  <th>Nhóm danh mục</th>
                  <th class="text-right">Hệ số quy đổi</th>
                  <th>Quy cách</th>
                </tr>
              </thead>
              <tbody>
                ${cfg.uoms.map(u => `
                  <tr>
                    <td class="font-bold font-mono text-primary">${esc(u.code)}</td>
                    <td class="font-bold">${esc(u.name)}</td>
                    <td><span class="badge badge-draft">${esc(u.category)}</span></td>
                    <td class="text-right font-bold">${u.factor}</td>
                    <td>${esc(u.note)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Positions -->
        <div class="config-panel" id="tab-positions">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Chức danh / Chức vụ</th>
                  <th class="text-right">Số nhân sự</th>
                  <th>Nhiệm vụ chính</th>
                </tr>
              </thead>
              <tbody>
                ${cfg.positions.map(p => `
                  <tr>
                    <td class="font-bold">${esc(p.name || 'Khác')}</td>
                    <td class="text-right font-bold text-primary">${p.headcount} người</td>
                    <td>${esc(p.description)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 3: Stations -->
        <div class="config-panel" id="tab-stations">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Trạm / Tổ công tác</th>
                  <th class="text-right">Quân số</th>
                  <th class="text-right">Doanh số đạt được</th>
                  <th class="text-right">Chỉ tiêu năm</th>
                  <th class="text-right">Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                ${cfg.stations.map(s => `
                  <tr>
                    <td class="font-bold text-primary">${esc(s.name)}</td>
                    <td class="text-right font-bold">${s.headcount} CBCNV</td>
                    <td class="text-right font-bold text-success">${fmt(s.current_revenue)} đ</td>
                    <td class="text-right">${fmt(s.target_revenue)} đ</td>
                    <td class="text-right font-bold ${s.progress_percent >= 30 ? 'text-success' : 'text-primary'}">${s.progress_percent}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 4: Locations & Channels -->
        <div class="config-panel" id="tab-locations">
          <div style="font-weight:700; margin-bottom:8px;">1. Địa điểm kho bãi (Stock Locations):</div>
          <div class="table-responsive" style="margin-bottom:20px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã kho</th>
                  <th>Tên địa điểm kho</th>
                  <th>Phân loại</th>
                  <th>Địa chỉ</th>
                  <th>Phụ trách</th>
                </tr>
              </thead>
              <tbody>
                ${cfg.locations.map(l => `
                  <tr>
                    <td class="font-bold font-mono">${esc(l.code)}</td>
                    <td class="font-bold">${esc(l.name)}</td>
                    <td><span class="badge badge-sale">${esc(l.usage)}</span></td>
                    <td>${esc(l.address)}</td>
                    <td>${esc(l.manager)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="font-weight:700; margin-bottom:8px;">2. Kênh phân phối doanh thu (Channels):</div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã kênh</th>
                  <th>Tên kênh tiêu thụ</th>
                  <th>Tính vào KPI thi đua?</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${cfg.channels.map(c => `
                  <tr>
                    <td class="font-bold font-mono">${esc(c.code)}</td>
                    <td class="font-bold">${esc(c.name)}</td>
                    <td>${c.counts_for_kpi ? '<span class="badge badge-done">✓ Có tính KPI</span>' : '<span class="badge badge-draft">Không tính KPI</span>'}</td>
                    <td>${esc(c.desc)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  el.querySelectorAll('.config-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.config-nav-tab').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = el.querySelector('#tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ══════════════════════════ 5. DANH SÁCH NHÂN VIÊN ══════════════════════════ //
async function renderEmployees(el) {
  const query = state.employeeFilter.q || '';
  const st = state.employeeFilter.station || 'all';
  const pos = state.employeeFilter.position || 'all';

  let url = '/api/employees?';
  if (query) url += 'q=' + encodeURIComponent(query) + '&';
  if (st !== 'all') url += 'station=' + encodeURIComponent(st) + '&';
  if (pos !== 'all') url += 'position=' + encodeURIComponent(pos) + '&';

  const data = await api(url);
  const cfg = await api('/api/config');

  el.innerHTML = `
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-label">Tổng số CBCNV</div>
        <div class="metric-value">${data.total} <span style="font-size:14px; font-weight:normal;">người</span></div>
        <div class="metric-trend">202 nhân sự toàn đơn vị</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Chỉ tiêu kế hoạch năm</div>
        <div class="metric-value text-primary">${fmt(data.target_annual)} <span style="font-size:13px;">đ</span></div>
        <div class="metric-trend">7.885.316 đ/người</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Tổng doanh số đạt được</div>
        <div class="metric-value text-success">${fmt(data.total_revenue)} <span style="font-size:13px;">đ</span></div>
        <div class="metric-trend text-success">Cộng dồn tự động</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Kết quả lọc</div>
        <div class="metric-value">${data.filtered_count} <span style="font-size:14px; font-weight:normal;">CBCNV</span></div>
        <div class="metric-trend">Hiển thị trên bảng</div>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="filter-search-bar">
      <div class="search-input-wrap">
        <span class="search-input-icon">🔍</span>
        <input type="text" id="emp-search-input" placeholder="Tìm kiếm theo tên nhân viên, chức vụ, trạm..." value="${esc(query)}" />
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="font-size:12px; font-weight:700; color:#475569;">Trạm:</label>
        <select id="emp-station-filter" class="role-select" style="background:#f8fafc; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px;">
          <option value="all">-- Tất cả trạm --</option>
          ${cfg.stations.map(s => `
            <option value="${esc(s.name)}" ${st === s.name ? 'selected' : ''}>${esc(s.name)} (${s.headcount})</option>
          `).join('')}
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="font-size:12px; font-weight:700; color:#475569;">Chức vụ:</label>
        <select id="emp-pos-filter" class="role-select" style="background:#f8fafc; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; max-width:180px;">
          <option value="all">-- Tất cả chức vụ --</option>
          ${cfg.positions.map(p => `
            <option value="${esc(p.name)}" ${pos === p.name ? 'selected' : ''}>${esc(p.name || 'Khác')} (${p.headcount})</option>
          `).join('')}
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" id="emp-reset-btn">↺ Đặt lại</button>
    </div>

    <!-- Table -->
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">Danh Bạ Nhân Sự & Chỉ Tiêu Thi Đua</span>
      </div>
      <div class="card-box-body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:40px;">STT</th>
                <th>Họ và tên</th>
                <th>Chức vụ</th>
                <th>Trạm / Tổ</th>
                <th class="text-right">Doanh số</th>
                <th class="text-right">% Kế hoạch</th>
                <th>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              ${data.employees.map((e, idx) => {
                const target = 7885316.83;
                const pct = Math.round((e.total / target) * 100);
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="font-bold text-primary">${esc(e.name)}</td>
                    <td><span class="badge badge-draft">${esc(e.position || 'Chưa cập nhật')}</span></td>
                    <td>${esc(e.station)}</td>
                    <td class="text-right font-bold">${fmt(e.total)} đ</td>
                    <td class="text-right font-bold ${pct >= 100 ? 'text-success' : (pct >= 50 ? 'text-primary' : 'text-warning')}">${pct}%</td>
                    <td>${pct >= 100 ? '<span class="badge badge-done">Vượt chỉ tiêu</span>' : (pct >= 50 ? '<span class="badge badge-sale">Đạt tiến độ</span>' : '<span class="badge badge-draft">Đang thi đua</span>')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let timer;
  const inp = el.querySelector('#emp-search-input');
  if (inp) {
    inp.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.employeeFilter.q = e.target.value.trim();
        renderEmployees(el);
      }, 300);
    });
  }

  const sFilter = el.querySelector('#emp-station-filter');
  if (sFilter) {
    sFilter.addEventListener('change', e => {
      state.employeeFilter.station = e.target.value;
      renderEmployees(el);
    });
  }

  const pFilter = el.querySelector('#emp-pos-filter');
  if (pFilter) {
    pFilter.addEventListener('change', e => {
      state.employeeFilter.position = e.target.value;
      renderEmployees(el);
    });
  }

  const rBtn = el.querySelector('#emp-reset-btn');
  if (rBtn) {
    rBtn.addEventListener('click', () => {
      state.employeeFilter = { q: '', station: 'all', position: 'all' };
      renderEmployees(el);
    });
  }
}

// ══════════════════════════ 6. KPI THEO TRẠM ══════════════════════════ //
async function renderKpiStation(el) {
  const data = await api('/api/kpi');

  el.innerHTML = `
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">Tiến Độ Kế Hoạch Năm Theo Trạm / Tổ</span>
        <span class="badge badge-sale">Kế hoạch năm: 1.592.834.000 đ</span>
      </div>
      <div class="card-box-body">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:18px;">
          ${data.byStation.map(s => {
            const target = s.headcount * 7885316.83;
            const pct = Math.min(100, Math.round((s.total_revenue / target) * 100));
            return `
              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:18px; box-shadow:var(--shadow-sm);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                  <div>
                    <div style="font-size:15px; font-weight:800; color:#1e293b;">${esc(s.station)}</div>
                    <div style="font-size:11px; color:#64748b;">Quân số: <b>${s.headcount}</b> người</div>
                  </div>
                  <span class="badge ${pct >= 30 ? 'badge-done' : 'badge-draft'}">${pct}% KH</span>
                </div>
                <div style="font-size:20px; font-weight:800; color:#2563eb; margin:6px 0;">${fmt(s.total_revenue)} đ</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Chỉ tiêu giao: ${fmt(target)} đ</div>
                <div style="background:#f1f5f9; border-radius:6px; height:8px; overflow:hidden;">
                  <div style="background:linear-gradient(90deg, #3b82f6, #10b981); height:100%; width:${pct}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════ 7. CÔNG NỢ KHÁCH HÀNG ══════════════════════════ //
async function renderReportDebt(el) {
  const data = await api('/api/reports/debt');
  const sum = data.summary;

  el.innerHTML = `
    <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-label">Tổng nợ phải thu</div>
        <div class="metric-value text-danger">${fmt(sum.total_debt)} <span style="font-size:14px;">đ</span></div>
        <div class="metric-trend text-danger">Chưa thanh toán</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Số khách hàng còn nợ</div>
        <div class="metric-value font-bold">${sum.total_debtors} <span style="font-size:14px; font-weight:normal;">khách</span></div>
        <div class="metric-trend">Bao gồm cơ quan & đại lý</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Chính sách thu nợ</div>
        <div class="metric-value text-primary">COD & Chuyển khoản</div>
        <div class="metric-trend">Tự động trừ khi thu tiền</div>
      </div>
    </div>

    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">Danh Sách Công Nợ Khách Hàng</span>
      </div>
      <div class="card-box-body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Khách hàng / Cơ quan</th>
                <th>Phân loại</th>
                <th>Địa chỉ nhận hàng</th>
                <th class="text-right">Số đơn</th>
                <th class="text-right">Tổng mua</th>
                <th class="text-right">Đã thanh toán</th>
                <th class="text-right">Còn nợ</th>
                <th>Ngày đặt gần nhất</th>
              </tr>
            </thead>
            <tbody>
              ${data.customers.map(c => `
                <tr>
                  <td class="font-bold">${esc(c.customer_name)}</td>
                  <td><span class="badge ${c.customer_type.includes('Cơ quan') ? 'badge-purple' : 'badge-draft'}">${esc(c.customer_type)}</span></td>
                  <td style="font-size:11px; max-width:280px;">${esc(c.address || c.phone || 'Chưa cập nhật')}</td>
                  <td class="text-right font-bold">${c.order_count}</td>
                  <td class="text-right">${fmt(c.total_purchased)} đ</td>
                  <td class="text-right text-success font-bold">${fmt(c.total_paid)} đ</td>
                  <td class="text-right text-danger font-bold">${fmt(c.debt_amount)} đ</td>
                  <td><span class="badge badge-draft">${esc(c.last_order_date)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════ 8. BÁO CÁO NỢ VỎ BÌNH ══════════════════════════ //
async function renderReportShells(el) {
  const data = await api('/api/shells');
  const sum = data.summary;

  el.innerHTML = `
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-label">Tổng nợ vỏ cuối kỳ</div>
        <div class="metric-value text-danger">${fmt(sum.clo_up + sum.clo_voi)} <span style="font-size:13px;">vỏ</span></div>
        <div class="metric-trend text-danger">${fmt(sum.clo_up)} vỏ Úp · ${fmt(sum.clo_voi)} vỏ Vòi</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Vỏ xuất mới trong kỳ</div>
        <div class="metric-value text-primary">${fmt(sum.in_up + sum.in_voi)} <span style="font-size:13px;">vỏ</span></div>
        <div class="metric-trend text-primary">Tự sinh từ phiếu xuất kho</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Vỏ rỗng đã thu hồi</div>
        <div class="metric-value text-success">${fmt(sum.ret_up + sum.ret_voi)} <span style="font-size:13px;">vỏ</span></div>
        <div class="metric-trend text-success">${fmt(sum.ret_up)} vỏ Úp · ${fmt(sum.ret_voi)} vỏ Vòi</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Quỹ cọc vỏ khách lẻ</div>
        <div class="metric-value font-bold">${fmt(sum.total_deposit)} <span style="font-size:13px;">đ</span></div>
        <div class="metric-trend">50.000 đ/vỏ</div>
      </div>
    </div>

    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">Bảng Cân Đối Vỏ Bình Đa Điểm</span>
      </div>
      <div class="card-box-body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Khách hàng / Đại lý</th>
                <th class="text-right">Đầu kỳ Úp</th>
                <th class="text-right">Đầu kỳ Vòi</th>
                <th class="text-right text-primary">Xuất Úp</th>
                <th class="text-right text-primary">Xuất Vòi</th>
                <th class="text-right text-success">Đã trả Úp</th>
                <th class="text-right text-success">Đã trả Vòi</th>
                <th class="text-right text-danger font-bold">Cuối kỳ Úp</th>
                <th class="text-right text-danger font-bold">Cuối kỳ Vòi</th>
                <th class="text-right">Tiền cọc</th>
              </tr>
            </thead>
            <tbody>
              ${data.ledgers.map(l => `
                <tr>
                  <td class="font-bold">${esc(l.customer)}</td>
                  <td class="text-right">${l.opening_up}</td>
                  <td class="text-right">${l.opening_voi}</td>
                  <td class="text-right text-primary">${l.in_up}</td>
                  <td class="text-right text-primary">${l.in_voi}</td>
                  <td class="text-right text-success font-bold">${l.returned_up}</td>
                  <td class="text-right text-success font-bold">${l.returned_voi}</td>
                  <td class="text-right text-danger font-bold">${l.closing_up}</td>
                  <td class="text-right text-danger font-bold">${l.closing_voi}</td>
                  <td class="text-right">${fmt(l.deposit)} đ</td>
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


// ══════════════════════════ KHÁCH HÀNG & ĐỐI TÁC (360° CUSTOMER MANAGEMENT) ══════════════════════════ //
async function renderCustomers(el) {
  const f = state.customerFilter || { q: '', type: 'all', debtOnly: false, shellOnly: false };
  const query = new URLSearchParams({
    q: f.q || '',
    type: f.type || 'all',
    debt_only: f.debtOnly ? 'true' : 'false',
    shell_only: f.shellOnly ? 'true' : 'false'
  }).toString();

  const data = await api('/api/customers?' + query);
  const s = data.summary;

  const typeLabels = [
    { id: 'all', label: 'Tất cả đối tác' },
    { id: 'Cơ quan / HCSN', label: 'Cơ quan / HCSN' },
    { id: 'Doanh nghiệp', label: 'Doanh nghiệp' },
    { id: 'Nhà hàng / Khách sạn', label: 'Nhà hàng / KS' },
    { id: 'Đại lý / Điểm phân phối', label: 'Đại lý / Điểm PP' },
    { id: 'Hộ gia đình / Cá nhân', label: 'Hộ gia đình / Cá nhân' },
  ];

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
      <div>
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">Danh bạ Khách hàng & Đối tác</h2>
        <div style="font-size:13px; color:#64748b;">Hồ sơ 360° khách hàng: Đơn mua nước, Sổ nợ vỏ bình, Công nợ và Lịch sử dịch vụ DVGT</div>
      </div>
      <div>
        <button class="btn btn-primary" onclick="openNewCustomerModal()">＋ Thêm khách hàng mới</button>
      </div>
    </div>

    <!-- 4 Clean Product Stat Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỔNG ĐỐI TÁC / KHÁCH HÀNG</span>
          <span class="metric-icon">👥</span>
        </div>
        <div class="metric-value">${fmt(s.total_customers)}</div>
        <div class="metric-sub">Hợp nhất từ Đơn hàng, Sổ vỏ & DVGT</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">CƠ QUAN & DOANH NGHIỆP</span>
          <span class="metric-icon">🏢</span>
        </div>
        <div class="metric-value">${fmt(s.corporate_count)}</div>
        <div class="metric-sub">Sở ban ngành, Than, Ngân hàng, KS</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">KHÁCH CÒN NỢ TIỀN NƯỚC</span>
          <span class="metric-icon">💳</span>
        </div>
        <div class="metric-value text-danger">${fmt(s.debtor_count)}</div>
        <div class="metric-sub">Tổng nợ: <b class="text-danger">${fmt(s.total_debt)} đ</b></div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">KHÁCH ĐANG NỢ VỎ BÌNH</span>
          <span class="metric-icon">🧴</span>
        </div>
        <div class="metric-value" style="color:#d97706;">${fmt(s.shell_holders_count)}</div>
        <div class="metric-sub">Đang giữ: <b>${fmt(s.total_shells)} vỏ</b> • Cọc: ${fmt(s.total_deposit)} đ</div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="card-box" style="margin-bottom:16px; padding:12px 16px;">
      <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <input type="text" id="cust-search-input" class="form-control" style="width:260px; height:34px;" 
                 placeholder="🔍 Tìm theo tên, SĐT, địa chỉ..." value="${esc(f.q)}" />
          <div style="display:flex; gap:4px;">
            ${typeLabels.map(t => `
              <button class="btn btn-sm ${f.type === t.id ? 'btn-primary' : 'btn-secondary'}" 
                      onclick="window.filterCustomerType('${t.id}')">${t.label}</button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; gap:14px; align-items:center; font-size:13px; color:#475569;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;">
            <input type="checkbox" ${f.debtOnly ? 'checked' : ''} onchange="window.toggleCustomerDebtOnly(this.checked)">
            <span>Chỉ khách có nợ tiền</span>
          </label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;">
            <input type="checkbox" ${f.shellOnly ? 'checked' : ''} onchange="window.toggleCustomerShellOnly(this.checked)">
            <span>Chỉ khách nợ vỏ</span>
          </label>
          <span style="color:#cbd5e1;">|</span>
          <span>Hiển thị: <b>${data.filtered_count}</b> / ${s.total_customers} khách</span>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card-box">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:70px;">Mã KH</th>
              <th>Tên Khách hàng / Đơn vị</th>
              <th style="width:140px;">Phân loại</th>
              <th>Liên hệ & Địa chỉ</th>
              <th class="text-center" style="width:90px;">Đơn mua</th>
              <th class="text-right" style="width:110px;">Doanh số</th>
              <th class="text-right" style="width:110px;">Nợ tiền hàng</th>
              <th class="text-center" style="width:120px;">Nợ vỏ (Úp/Vòi)</th>
              <th class="text-right" style="width:100px;">Tiền cọc</th>
              <th class="text-center" style="width:100px;">Hồ sơ 360°</th>
            </tr>
          </thead>
          <tbody>
            ${data.customers.length === 0 ? `
              <tr><td colspan="10" style="text-align:center; padding:32px; color:#94a3b8;">Không tìm thấy khách hàng nào theo bộ lọc hiện tại</td></tr>
            ` : data.customers.map(c => {
              const typeBadgeMap = {
                'Cơ quan / HCSN': 'badge-purple',
                'Doanh nghiệp': 'badge-primary',
                'Nhà hàng / Khách sạn': 'badge-warning',
                'Đại lý / Điểm phân phối': 'badge-done',
                'Hộ gia đình / Cá nhân': 'badge-draft'
              };
              const badgeClass = typeBadgeMap[c.customer_type] || 'badge-draft';
              const hasDebt = c.debt_amount > 0;
              const hasShells = (c.shell_up > 0 || c.shell_voi > 0);

              return `
                <tr>
                  <td class="text-muted" style="font-family:monospace; font-size:12px;">#KH${String(c.id).padStart(3, '0')}</td>
                  <td>
                    <div class="font-bold" style="color:#0f172a; cursor:pointer;" onclick="window.openCustomer360Modal(${c.id})">${esc(c.name)}</div>
                    ${c.notes ? `<div style="font-size:11px; color:#64748b;">${esc(c.notes)}</div>` : ''}
                  </td>
                  <td><span class="badge ${badgeClass}">${esc(c.customer_type)}</span></td>
                  <td>
                    ${c.phone ? `<div style="font-size:12px; font-weight:600; color:#1e293b;">📞 ${esc(c.phone)}</div>` : ''}
                    <div style="font-size:12px; color:#64748b; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(c.address)}">${esc(c.address || '—')}</div>
                  </td>
                  <td class="text-center">
                    <span class="badge ${c.order_count > 0 ? 'badge-done' : 'badge-draft'}">${c.order_count} đơn</span>
                  </td>
                  <td class="text-right font-semibold">${c.total_spent > 0 ? fmt(c.total_spent) + ' đ' : '—'}</td>
                  <td class="text-right">
                    ${hasDebt ? `<span class="font-bold text-danger">${fmt(c.debt_amount)} đ</span>` : `<span class="text-muted">—</span>`}
                  </td>
                  <td class="text-center">
                    ${hasShells ? `
                      <span class="badge badge-warning" title="Úp: ${c.shell_up} | Vòi: ${c.shell_voi}">
                        ${c.shell_up} úp / ${c.shell_voi} vòi
                      </span>
                    ` : '<span class="text-muted">—</span>'}
                  </td>
                  <td class="text-right">
                    ${c.shell_deposit > 0 ? `<span class="font-semibold" style="color:#059669;">${fmt(c.shell_deposit)} đ</span>` : '<span class="text-muted">—</span>'}
                  </td>
                  <td class="text-center">
                    <button class="btn btn-secondary btn-sm" onclick="window.openCustomer360Modal(${c.id})">🔍 Xem 360°</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Search input handler with debounce
  const sInput = document.getElementById('cust-search-input');
  if (sInput) {
    let timer;
    sInput.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.customerFilter.q = e.target.value.trim();
        renderCustomers(el);
      }, 300);
    });
  }
}

window.filterCustomerType = function(type) {
  state.customerFilter.type = type;
  renderCustomers(document.getElementById('view-container'));
};

window.toggleCustomerDebtOnly = function(val) {
  state.customerFilter.debtOnly = val;
  renderCustomers(document.getElementById('view-container'));
};

window.toggleCustomerShellOnly = function(val) {
  state.customerFilter.shellOnly = val;
  renderCustomers(document.getElementById('view-container'));
};

window.openCustomer360Modal = async function(id) {
  try {
    const data = await api('/api/customers/' + id);
    const p = data.partner;
    const fin = data.financial_summary;
    const orders = data.orders || [];
    const shells = data.shells || [];
    const dvgt = data.dvgt || [];

    const html = `
      <div style="width:820px; max-width:92vw;">
        <!-- Modal Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <h3 style="margin:0; font-size:18px; font-weight:700; color:#0f172a;">${esc(p.name)}</h3>
              <span class="badge badge-purple">${esc(p.customer_type)}</span>
              <span class="badge badge-draft">#KH${String(p.id).padStart(3, '0')}</span>
            </div>
            <div style="font-size:12px; color:#64748b; display:flex; gap:16px;">
              ${p.phone ? `<span>📞 <b>${esc(p.phone)}</b></span>` : ''}
              <span>📍 ${esc(p.address || 'Chưa cập nhật địa chỉ')}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="closeModal()">✕ Đóng</button>
        </div>

        <!-- 4 Quick Financial Cards -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:18px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px;">
            <div style="font-size:11px; color:#64748b; font-weight:600;">DOANH SỐ MUA</div>
            <div style="font-size:16px; font-weight:700; color:#0f172a;">${fmt(fin.total_spent)} đ</div>
            <div style="font-size:11px; color:#64748b;">${orders.length} đơn hàng</div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 12px;">
            <div style="font-size:11px; color:#991b1b; font-weight:600;">NỢ TIỀN NƯỚC</div>
            <div style="font-size:16px; font-weight:700; color:#dc2626;">${fmt(fin.debt_amount)} đ</div>
            <div style="font-size:11px; color:#991b1b;">Đã trả: ${fmt(fin.total_paid)} đ</div>
          </div>
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px;">
            <div style="font-size:11px; color:#92400e; font-weight:600;">NỢ VỎ BÌNH 19L</div>
            <div style="font-size:16px; font-weight:700; color:#b45309;">${fin.shell_up + fin.shell_voi} vỏ</div>
            <div style="font-size:11px; color:#92400e;">${fin.shell_up} úp • ${fin.shell_voi} vòi</div>
          </div>
          <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:10px 12px;">
            <div style="font-size:11px; color:#065f46; font-weight:600;">TIỀN CỌC VỎ</div>
            <div style="font-size:16px; font-weight:700; color:#059669;">${fmt(fin.shell_deposit)} đ</div>
            <div style="font-size:11px; color:#065f46;">Đang lưu quỹ XN</div>
          </div>
        </div>

        <!-- 3 Tabs Navigation -->
        <div style="display:flex; gap:6px; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
          <button class="btn btn-sm btn-primary" id="cust-tab-btn-orders" onclick="window.switchCust360Tab('orders')">📦 Đơn bán hàng (${orders.length})</button>
          <button class="btn btn-sm btn-secondary" id="cust-tab-btn-shells" onclick="window.switchCust360Tab('shells')">🧴 Sổ nợ vỏ bình (${shells.length})</button>
          <button class="btn btn-sm btn-secondary" id="cust-tab-btn-dvgt" onclick="window.switchCust360Tab('dvgt')">🔧 Dịch vụ DVGT (${dvgt.length})</button>
        </div>

        <!-- Tab 1: Orders -->
        <div id="cust-tab-orders" style="max-height:280px; overflow-y:auto;">
          ${orders.length === 0 ? '<div style="text-align:center; padding:24px; color:#94a3b8;">Chưa có đơn hàng nào</div>' : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày</th>
                  <th>Kênh bán</th>
                  <th>Người bán</th>
                  <th class="text-right">Tổng tiền</th>
                  <th class="text-right">Đã thu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${orders.map(o => `
                  <tr>
                    <td class="font-bold text-primary">${esc(o.name)}</td>
                    <td style="font-size:12px;">${esc(o.date)}</td>
                    <td>${esc(o.channel_name || o.channel_code)}</td>
                    <td style="font-size:12px;">${esc(o.seller)}</td>
                    <td class="text-right font-bold">${fmt(o.amount_total)} đ</td>
                    <td class="text-right font-semibold" style="color:#059669;">${fmt(o.paid_amount)} đ</td>
                    <td>${renderBadge(o.state)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Tab 2: Shells -->
        <div id="cust-tab-shells" style="display:none; max-height:280px; overflow-y:auto;">
          ${shells.length === 0 ? '<div style="text-align:center; padding:24px; color:#94a3b8;">Không có ghi nhận mượn nợ vỏ bình</div>' : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Kỳ đối soát</th>
                  <th>Người theo dõi / NV</th>
                  <th class="text-center">Tồn Úp</th>
                  <th class="text-center">Tồn Vòi</th>
                  <th class="text-center">Xuất/Trả Úp</th>
                  <th class="text-center">Xuất/Trả Vòi</th>
                  <th class="text-right">Tiền cọc</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${shells.map(s => `
                  <tr>
                    <td class="font-bold">${esc(s.period)}</td>
                    <td style="font-size:12px;">${esc(s.subject)}</td>
                    <td class="text-center font-bold text-warning">${s.closing_up}</td>
                    <td class="text-center font-bold text-warning">${s.closing_voi}</td>
                    <td class="text-center" style="font-size:12px;">+${s.in_up} / -${s.returned_up}</td>
                    <td class="text-center" style="font-size:12px;">+${s.in_voi} / -${s.returned_voi}</td>
                    <td class="text-right font-semibold">${fmt(s.deposit)} đ</td>
                    <td style="font-size:12px; color:#64748b;">${esc(s.note || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Tab 3: DVGT -->
        <div id="cust-tab-dvgt" style="display:none; max-height:280px; overflow-y:auto;">
          ${dvgt.length === 0 ? '<div style="text-align:center; padding:24px; color:#94a3b8;">Khách hàng chưa sử dụng dịch vụ kỹ thuật DVGT</div>' : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Dịch vụ yêu cầu</th>
                  <th>Mã ĐH nước</th>
                  <th>Người giới thiệu</th>
                  <th class="text-right">Doanh thu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${dvgt.map(d => `
                  <tr>
                    <td style="font-size:12px;">${esc(d.date)}</td>
                    <td class="font-bold">${esc(d.service)}</td>
                    <td>${d.water_meter_code ? `<span class="badge badge-purple">${esc(d.water_meter_code)}</span>` : '—'}</td>
                    <td style="font-size:12px;">${esc(d.referrer)}</td>
                    <td class="text-right font-bold">${fmt(d.revenue)} đ</td>
                    <td>${renderBadge(d.state)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

    openModal(html);
  } catch (err) {
    showToast('Lỗi tải hồ sơ khách hàng: ' + err.message);
  }
};

window.switchCust360Tab = function(tabId) {
  const tabs = ['orders', 'shells', 'dvgt'];
  for (const t of tabs) {
    const el = document.getElementById('cust-tab-' + t);
    const btn = document.getElementById('cust-tab-btn-' + t);
    if (el) el.style.display = (t === tabId ? 'block' : 'none');
    if (btn) {
      if (t === tabId) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    }
  }
};

window.openNewCustomerModal = function() {
  const html = `
    <div style="width:520px; max-width:92vw;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
        <h3 style="margin:0; font-size:17px; font-weight:700; color:#0f172a;">＋ Thêm Khách Hàng / Đối Tác Mới</h3>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">✕</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Tên khách hàng / Tên cơ quan *</label>
          <input type="text" id="new-cust-name" class="form-control" placeholder="Ví dụ: Công ty Cổ phần Nước đá, Nhà hàng Thủy Tạ..." required />
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Phân loại đối tác</label>
          <select id="new-cust-type" class="form-control">
            <option value="Cơ quan / HCSN">Cơ quan / Hành chính sự nghiệp</option>
            <option value="Doanh nghiệp">Doanh nghiệp / Công ty</option>
            <option value="Nhà hàng / Khách sạn">Nhà hàng / Khách sạn / Karaoke</option>
            <option value="Đại lý / Điểm phân phối">Đại lý / Điểm phân phối / Chung cư</option>
            <option value="Hộ gia đình / Cá nhân" selected>Hộ gia đình / Khách hàng cá nhân</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Số điện thoại</label>
            <input type="text" id="new-cust-phone" class="form-control" placeholder="0988..." />
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Mã ĐH nước (nếu có)</label>
            <input type="text" id="new-cust-meter" class="form-control" placeholder="HG09xxxx" />
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Địa chỉ giao hàng / Khu vực</label>
          <input type="text" id="new-cust-address" class="form-control" placeholder="Số nhà, đường phố, phường (Cao Xanh, Bãi Cháy...)" />
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Ghi chú giao dịch</label>
          <textarea id="new-cust-notes" class="form-control" rows="2" placeholder="Ghi chú về thói quen đặt hàng, vỏ bình, khung giờ giao..."></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button class="btn btn-primary" onclick="window.submitNewCustomer()">Lưu khách hàng</button>
        </div>
      </div>
    </div>
  `;
  openModal(html);
};

window.submitNewCustomer = async function() {
  const name = document.getElementById('new-cust-name').value.trim();
  const customer_type = document.getElementById('new-cust-type').value;
  const phone = document.getElementById('new-cust-phone').value.trim();
  const address = document.getElementById('new-cust-address').value.trim();
  const notes = document.getElementById('new-cust-notes').value.trim();

  if (!name) {
    alert('Vui lòng nhập tên khách hàng / cơ quan!');
    return;
  }

  try {
    const res = await api('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ name, customer_type, phone, address, notes })
    });
    closeModal();
    showToast('Đã thêm khách hàng thành công: ' + name);
    if (state.view === 'customers') {
      renderCustomers(document.getElementById('view-container'));
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
};


// 4. Sales Orders View
async function renderOrders(el) {
  const orders = await api('/api/orders');
  const invFilter = state.orderInvoiceFilter || 'all';

  const invoicedCount = orders.filter(o => o.invoice_status === 'invoiced').length;
  const toInvoiceCount = orders.filter(o => o.invoice_status !== 'invoiced').length;
  const totalInvoicedRev = orders.filter(o => o.invoice_status === 'invoiced').reduce((s, o) => s + (o.amount_total || 0), 0);
  const totalToInvoiceRev = orders.filter(o => o.invoice_status !== 'invoiced').reduce((s, o) => s + (o.amount_total || 0), 0);

  const filteredOrders = orders.filter(o => {
    if (invFilter === 'invoiced') return o.invoice_status === 'invoiced';
    if (invFilter === 'to_invoice') return o.invoice_status !== 'invoiced';
    return true;
  });

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
      <div>
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">🧾 Đơn Bán Hàng & Hóa Đơn Điện Tử</h2>
        <div style="font-size:13px; color:#64748b;">Quản lý quy trình: Báo giá ➔ Đơn bán ➔ Xuất kho ➔ Xuất hóa đơn điện tử (E-Invoice)</div>
      </div>
      <div>
        <button class="btn btn-primary" onclick="openCreateOrderModal()">＋ Tạo báo giá mới</button>
      </div>
    </div>

    <!-- 4 Invoice & Revenue KPI Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỔNG SỐ ĐƠN BÁN</span>
          <span class="metric-icon">🧾</span>
        </div>
        <div class="metric-value">${orders.length} đơn</div>
        <div class="metric-sub">Kỳ tháng 09/2026</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">ĐÃ XUẤT HÓA ĐƠN</span>
          <span class="metric-icon">📄</span>
        </div>
        <div class="metric-value" style="color:#059669;">${invoicedCount} đơn</div>
        <div class="metric-sub">Doanh số: <b style="color:#059669;">${fmt(totalInvoicedRev)} đ</b></div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">CHƯA XUẤT HÓA ĐƠN</span>
          <span class="metric-icon">⏳</span>
        </div>
        <div class="metric-value text-warning">${toInvoiceCount} đơn</div>
        <div class="metric-sub">Cần xuất HĐ: <b class="text-warning">${fmt(totalToInvoiceRev)} đ</b></div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỶ LỆ XUẤT HÓA ĐƠN</span>
          <span class="metric-icon">📊</span>
        </div>
        <div class="metric-value text-primary">${orders.length > 0 ? ((invoicedCount / orders.length) * 100).toFixed(1) : 0}%</div>
        <div class="metric-sub">Chuẩn kế toán thuế QUAWACO</div>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div class="card-box" style="margin-bottom:16px; padding:12px 16px;">
      <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <input type="text" id="order-search" class="form-control" style="width:260px; height:34px;" 
                 placeholder="🔍 Tìm theo mã đơn, khách, người bán..." oninput="filterOrdersTable()">
          <select id="order-channel-filter" class="form-control" style="width:160px; height:34px;" onchange="filterOrdersTable()">
            <option value="">Tất cả kênh bán</option>
            <option value="XN">Xí nghiệp (Tính KPI)</option>
            <option value="CTY">Công ty</option>
            <option value="BC">Bãi Cháy</option>
            <option value="MD">Miền Đông</option>
          </select>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn-sm ${invFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                  onclick="window.filterOrderInvoice('all')">Tất cả (${orders.length})</button>
          <button class="btn btn-sm ${invFilter === 'invoiced' ? 'btn-primary' : 'btn-secondary'}" 
                  onclick="window.filterOrderInvoice('invoiced')">Đã xuất HĐ (${invoicedCount})</button>
          <button class="btn btn-sm ${invFilter === 'to_invoice' ? 'btn-primary' : 'btn-secondary'}" 
                  onclick="window.filterOrderInvoice('to_invoice')">Chưa xuất HĐ (${toInvoiceCount})</button>
        </div>
      </div>
    </div>

    <!-- Orders Data Table -->
    <div class="card-box">
      <div class="table-responsive">
        <table class="data-table" id="orders-table">
          <thead>
            <tr>
              <th style="width:110px;">Mã đơn</th>
              <th style="width:85px;">Ngày</th>
              <th>Khách hàng</th>
              <th style="width:100px;">Kênh bán</th>
              <th>Người bán</th>
              <th class="text-right" style="width:110px;">Doanh thu</th>
              <th class="text-center" style="width:100px;">Đơn hàng</th>
              <th style="width:150px;">Hóa đơn điện tử</th>
              <th class="text-center" style="width:80px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map(o => `
              <tr class="order-row" data-search="${(o.name + ' ' + o.customer_name + ' ' + o.seller).toLowerCase()}" data-channel="${o.channel_code}">
                <td class="font-bold text-primary">${esc(o.name)}</td>
                <td style="font-size:12px; color:#64748b;">${esc(o.date)}</td>
                <td class="font-semibold">${esc(o.customer_name)}</td>
                <td><span class="badge ${o.channel_code === 'XN' ? 'badge-sale' : 'badge-draft'}">${esc(o.channel_name)}</span></td>
                <td style="font-size:12px;">${esc(o.seller)}</td>
                <td class="text-right font-bold">${fmt(o.amount_total)} đ</td>
                <td class="text-center">${renderBadge(o.state)}</td>
                <td>
                  ${o.invoice_status === 'invoiced' ? `
                    <div>
                      <span class="badge badge-done" style="font-family:monospace;">📄 ${esc(o.invoice_number)}</span>
                      <div style="font-size:11px; color:#64748b; margin-top:2px;">Ngày: ${esc(o.invoice_date || o.date)}</div>
                    </div>
                  ` : `
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span class="badge badge-warning">Chờ xuất</span>
                      <button class="btn btn-primary btn-sm" style="padding:2px 6px; font-size:11px;" 
                              onclick="window.issueOrderInvoice(${o.id}, '${esc(o.name)}')">Xuất HĐ</button>
                    </div>
                  `}
                </td>
                <td class="text-center">
                  <button class="btn btn-secondary btn-sm" onclick="openOrderDetailModal(${o.id})">Chi tiết</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.filterOrderInvoice = function(status) {
  state.orderInvoiceFilter = status;
  renderOrders(document.getElementById('view-container'));
};

window.issueOrderInvoice = async function(id, name) {
  if (!confirm('Bạn có chắc chắn muốn xuất Hóa đơn điện tử cho đơn hàng ' + name + '?')) return;
  try {
    const res = await api('/api/orders/' + id + '/invoice', { method: 'POST' });
    showToast(res.message);
    renderOrders(document.getElementById('view-container'));
  } catch (err) {
    alert('Lỗi xuất hóa đơn: ' + err.message);
  }
};

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
  const currentTab = state.shellTab || 'transactions';
  const txData = await api('/api/shells/transactions');
  const sumData = await api('/api/shells');
  const s = txData.summary || { total_borrowed_up: 192, total_borrowed_voi: 68, total_returned_up: 119, total_returned_voi: 44, total_remaining_up: 73, total_remaining_voi: 24, total_deposit: 2300000 };

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
      <div>
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">🧴 Quản Lý Vật Tư Vỏ Bình 19L (Mượn - Trả)</h2>
        <div style="font-size:13px; color:#64748b;">Theo dõi chi tiết luân chuyển tài sản: Ngày mượn, Số mượn, Ngày trả, Số trả, Nợ vỏ và Tiền ký cọc</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-sm ${currentTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="window.switchShellTab('transactions')">📋 Nhật ký chi tiết Mượn - Trả</button>
        <button class="btn btn-sm ${currentTab === 'summary' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="window.switchShellTab('summary')">📊 Sổ nợ vỏ tổng hợp (T8 & T9)</button>
      </div>
    </div>

    <!-- 4 Shell Metric Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỔNG XUẤT CHO MƯỢN</span>
          <span class="metric-icon">📤</span>
        </div>
        <div class="metric-value font-bold">${s.total_borrowed_up + s.total_borrowed_voi} vỏ</div>
        <div class="metric-sub">Úp: <b>${s.total_borrowed_up}</b> | Vòi: <b>${s.total_borrowed_voi}</b></div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">ĐÃ THU HỒI TRẢ VỎ</span>
          <span class="metric-icon">📥</span>
        </div>
        <div class="metric-value font-bold text-success">${s.total_returned_up + s.total_returned_voi} vỏ</div>
        <div class="metric-sub">Đã trả: <b>${s.total_returned_up}</b> úp | <b>${s.total_returned_voi}</b> vòi</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">KHÁCH CÒN NỢ VỎ</span>
          <span class="metric-icon">⏳</span>
        </div>
        <div class="metric-value font-bold text-danger">${s.total_remaining_up + s.total_remaining_voi} vỏ</div>
        <div class="metric-sub">Còn nợ: <b class="text-danger">${s.total_remaining_up}</b> úp • <b class="text-danger">${s.total_remaining_voi}</b> vòi</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TIỀN CỌC VỎ ĐANG GIỮ</span>
          <span class="metric-icon">💰</span>
        </div>
        <div class="metric-value font-bold" style="color:#059669;">${fmt(s.total_deposit)} đ</div>
        <div class="metric-sub">Đang lưu giữ tại quỹ xí nghiệp</div>
      </div>
    </div>

    ${currentTab === 'transactions' ? `
      <!-- TAB 1: DETAILED TRANSACTIONS TABLE (Ngày mượn, Số mượn, Ngày trả, Số trả) -->
      <div class="card-box">
        <div class="card-box-header">
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="card-box-title">📋 Nhật ký chi tiết giao nhận vỏ bình theo giao dịch</span>
            <span class="badge badge-sale">${txData.transactions ? txData.transactions.length : 15} phiếu</span>
          </div>
          <span style="font-size:12px; color:#64748b;">Quy định: Tiền cọc 50.000đ/vỏ cho khách lẻ và đại lý</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:110px;">Mã phiếu</th>
                  <th>Khách hàng / Đơn vị mượn</th>
                  <th style="width:90px;">Ngày mượn</th>
                  <th class="text-center" style="width:100px;">Số mượn (Úp/Vòi)</th>
                  <th style="width:90px;">Ngày trả</th>
                  <th class="text-center" style="width:100px;">Số đã trả (Úp/Vòi)</th>
                  <th class="text-center font-bold text-danger" style="width:100px;">Còn nợ</th>
                  <th class="text-right" style="width:90px;">Tiền cọc</th>
                  <th class="text-center" style="width:100px;">Trạng thái</th>
                  <th class="text-center" style="width:100px;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${(txData.transactions || []).map(t => {
                  const statusMap = {
                    borrowed: ['Đang mượn', 'badge-warning'],
                    partially_returned: ['Trả 1 phần', 'badge-purple'],
                    returned: ['Đã trả đủ', 'badge-done']
                  };
                  const [stLabel, stBadge] = statusMap[t.status] || [t.status, 'badge-draft'];
                  const isOwed = (t.remaining_up > 0 || t.remaining_voi > 0);

                  return `
                    <tr>
                      <td class="font-bold text-primary font-mono">${esc(t.code)}</td>
                      <td>
                        <div class="font-semibold">${esc(t.customer_name)}</div>
                        ${t.note ? `<div style="font-size:11px; color:#64748b;">${esc(t.note)}</div>` : ''}
                      </td>
                      <td style="font-size:12px;">${esc(t.borrow_date)}</td>
                      <td class="text-center font-semibold">${t.borrow_up} úp / ${t.borrow_voi} vòi</td>
                      <td style="font-size:12px;">${t.return_date ? esc(t.return_date) : '<span class="text-muted">Chưa trả</span>'}</td>
                      <td class="text-center text-success font-semibold">${t.return_up} úp / ${t.return_voi} vòi</td>
                      <td class="text-center font-bold ${isOwed ? 'text-danger' : 'text-muted'}">
                        ${isOwed ? `${t.remaining_up} úp / ${t.remaining_voi} vòi` : '0'}
                      </td>
                      <td class="text-right">${t.deposit > 0 ? fmt(t.deposit) + ' đ' : '—'}</td>
                      <td class="text-center"><span class="badge ${stBadge}">${stLabel}</span></td>
                      <td class="text-center">
                        ${isOwed ? `
                          <button class="btn btn-primary btn-sm" style="padding:2px 8px; font-size:11px;"
                                  onclick="window.openReturnShellTxModal(${t.id}, '${esc(t.customer_name)}', ${t.remaining_up}, ${t.remaining_voi}, ${t.deposit})">
                            ✍️ Trả vỏ
                          </button>
                        ` : `
                          <span class="text-muted" style="font-size:11px;">Hoàn tất</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ` : `
      <!-- TAB 2: SUMMARY TABLE -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">📊 Sổ theo dõi nợ vỏ bình theo khách hàng (Kỳ Tháng 9/2026)</span>
          <span class="badge badge-draft">${sumData.ledgers ? sumData.ledgers.length : 0} khách hàng</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Người theo dõi</th>
                  <th>Khách hàng nợ vỏ</th>
                  <th class="text-center">Nợ đầu kỳ</th>
                  <th class="text-center">Giao trong kỳ</th>
                  <th class="text-center">Đã trả</th>
                  <th class="text-center font-bold text-danger">Còn nợ cuối kỳ</th>
                  <th class="text-right">Tiền cọc</th>
                </tr>
              </thead>
              <tbody>
                ${(sumData.ledgers || []).slice(0, 30).map(l => `
                  <tr>
                    <td>${esc(l.subject)}</td>
                    <td class="font-semibold">${esc(l.customer)}</td>
                    <td class="text-center text-muted">${l.opening_up || 0} úp / ${l.opening_voi || 0} vòi</td>
                    <td class="text-center text-primary font-semibold">+${(l.in_up || 0) + (l.in_voi || 0)}</td>
                    <td class="text-center text-success font-semibold">-${(l.returned_up || 0) + (l.returned_voi || 0)}</td>
                    <td class="text-center font-bold text-danger">${l.closing_up || 0} úp / ${l.closing_voi || 0} vòi</td>
                    <td class="text-right">${l.deposit ? fmt(l.deposit) + ' đ' : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `}
  `;
}

window.switchShellTab = function(tab) {
  state.shellTab = tab;
  renderShells(document.getElementById('view-container'));
};

window.openReturnShellTxModal = function(id, cust, remUp, remVoi, dep) {
  const today = new Date().toISOString().slice(0, 10);
  const html = `
    <div style="width:480px; max-width:92vw;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
        <h3 style="margin:0; font-size:16px; font-weight:700; color:#0f172a;">✍️ Ghi Nhận Thu Hồi Trả Vỏ Bình</h3>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">✕</button>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; margin-bottom:14px; font-size:13px;">
        <div>Khách hàng: <b>${esc(cust)}</b></div>
        <div style="color:#b45309; margin-top:2px;">Đang nợ: <b>${remUp} bình úp</b> • <b>${remVoi} bình vòi</b> | Tiền cọc: <b>${fmt(dep)} đ</b></div>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Ngày thu hồi vỏ</label>
          <input type="date" id="ret-date" class="form-control" value="${today}" />
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Số bình Úp trả (tối đa ${remUp})</label>
            <input type="number" id="ret-up" class="form-control" value="${remUp}" min="0" max="${remUp}" />
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Số bình Vòi trả (tối đa ${remVoi})</label>
            <input type="number" id="ret-voi" class="form-control" value="${remVoi}" min="0" max="${remVoi}" />
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Hoàn tiền cọc trả khách (nếu có)</label>
          <input type="number" id="ret-dep" class="form-control" value="${dep}" min="0" max="${dep}" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button class="btn btn-primary" onclick="window.submitReturnShellTx(${id})">Xác nhận trả vỏ</button>
        </div>
      </div>
    </div>
  `;
  openModal(html);
};

window.submitReturnShellTx = async function(id) {
  const return_date = document.getElementById('ret-date').value;
  const return_up = Number(document.getElementById('ret-up').value) || 0;
  const return_voi = Number(document.getElementById('ret-voi').value) || 0;
  const refund_deposit = Number(document.getElementById('ret-dep').value) || 0;

  try {
    const res = await api('/api/shells/transactions/return', {
      method: 'POST',
      body: JSON.stringify({ id, return_date, return_up, return_voi, refund_deposit })
    });
    closeModal();
    showToast(res.message);
    renderShells(document.getElementById('view-container'));
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
};

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
  const s = data.summary || { total_trips: data.trips ? data.trips.length : 0, total_carrier_fee: 4055000, total_active_workers: data.workers ? data.workers.length : 0 };

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
      <div>
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">🚚 Chi Phí Vận Chuyển & Thù Lao Giao Nhận</h2>
        <div style="font-size:13px; color:#64748b;">Tự động phân bổ thù lao: Cước vận chuyển mỗi đơn hàng được <b>chia đều</b> cho các nhân sự cùng thực hiện chuyến xe</div>
      </div>
    </div>

    <!-- Formula Clarification Banner -->
    <div class="formula-banner">
      <span style="font-size:18px;">⚡</span>
      <div>
        <b>Quy tắc phân bổ thù lao vận chuyển xí nghiệp:</b> Chi phí vận chuyển của 1 đơn hàng được <b>chia đều</b> theo số người cùng đi giao.<br>
        <i>Ví dụ minh họa thực tế:</i> 1 đơn có chi phí vận chuyển là <b>50.000 đ</b>, có <b>2 người</b> vận chuyển thì mỗi người nhận đúng <b>25.000 đ</b>.
      </div>
    </div>

    <!-- 3 Stat Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỔNG SỐ CHUYẾN GIAO HÀNG</span>
          <span class="metric-icon">🚚</span>
        </div>
        <div class="metric-value font-bold">${s.total_trips} chuyến</div>
        <div class="metric-sub">Xe tải điện xí nghiệp và xe máy</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỔNG THÙ LAO PHÂN BỔ</span>
          <span class="metric-icon">💰</span>
        </div>
        <div class="metric-value font-bold text-success">${fmt(s.total_carrier_fee)} đ</div>
        <div class="metric-sub">Xí nghiệp chi trả theo định mức</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">NHÂN SỰ THAM GIA GIAO NHẬN</span>
          <span class="metric-icon">👥</span>
        </div>
        <div class="metric-value font-bold text-primary">${s.total_active_workers} người</div>
        <div class="metric-sub">Phương, Huế, Hưng, Khoa, Tuấn...</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
      <!-- Worker Summary Table -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">👥 Tổng thù lao cả tháng theo nhân viên</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nhân viên giao nhận</th>
                <th class="text-center">Số chuyến</th>
                <th class="text-right">Tổng thù lao</th>
              </tr>
            </thead>
            <tbody>
              ${(data.workers || []).map(w => `
                <tr>
                  <td class="font-semibold">${esc(w.employee)}</td>
                  <td class="text-center">${w.total_trips} chuyến</td>
                  <td class="text-right font-bold text-success">${fmt(w.total_fee)} đ</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Trips Table with Formula Breakdown -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">📋 Lịch sử chuyến giao & Minh bạch chia đều thù lao</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Phiếu giao / Đơn</th>
                  <th>Khách hàng & Ngày</th>
                  <th class="text-right">Tổng cước</th>
                  <th class="text-center">Số người</th>
                  <th>Công thức chia đều</th>
                  <th>Chi tiết thù lao nhận</th>
                </tr>
              </thead>
              <tbody>
                ${(data.trips || []).map(t => `
                  <tr>
                    <td>
                      <div class="font-bold text-primary">${esc(t.picking_name)}</div>
                      <div style="font-size:11px; color:#64748b;">${esc(t.order_name || '')}</div>
                    </td>
                    <td>
                      <div class="font-semibold" style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(t.customer_name || t.delivery_note || 'Khách hàng')}</div>
                      <div style="font-size:11px; color:#64748b;">${esc(t.scheduled_date)}</div>
                    </td>
                    <td class="text-right font-bold">${fmt(t.carrier_fee)} đ</td>
                    <td class="text-center font-bold">${t.worker_count} người</td>
                    <td>
                      <span class="badge badge-purple" style="font-size:11.5px; font-weight:600;">
                        ${fmt(t.carrier_fee)} đ ÷ ${t.worker_count} = ${fmt(t.fee_per_worker)} đ/người
                      </span>
                    </td>
                    <td>
                      <div style="font-size:12px; font-weight:600; color:#1d4ed8;">
                        ${esc(t.worker_details || t.worker_names || '—')}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderCash(el) {
  const currentTab = state.revenueTab || 'by_product';
  const cashData = await api('/api/cash');
  const prodData = await api('/api/revenue/by-product');
  const s = prodData.summary || { total_revenue_vat: 91125000, total_revenue_untaxed: 84374987, total_vat_8: 6750013, total_invoiced: 75890000, total_to_invoice: 15235000, invoiced_rate: 83.3 };

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
      <div>
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">💰 Quản Lý Doanh Thu & Thu Tiền COD</h2>
        <div style="font-size:13px; color:#64748b;">Báo cáo phân tích doanh thu đa chiều: Theo sản phẩm, Đơn hàng, Hóa đơn điện tử và Nhân viên bán</div>
      </div>
      <!-- Tab Selector -->
      <div style="display:flex; gap:6px;">
        <button class="btn btn-sm ${currentTab === 'by_product' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="window.switchRevenueTab('by_product')">📦 Doanh thu theo Sản phẩm</button>
        <button class="btn btn-sm ${currentTab === 'by_order' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="window.switchRevenueTab('by_order')">🧾 Doanh thu theo Đơn hàng & Thu tiền</button>
      </div>
    </div>

    <!-- 4 Revenue & Tax Stat Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">TỔNG DOANH THU (GỒM VAT 8%)</span>
          <span class="metric-icon">💰</span>
        </div>
        <div class="metric-value font-bold" style="color:#0f172a;">${fmt(s.total_revenue_vat)} đ</div>
        <div class="metric-sub">Tổng tiền khách hàng thanh toán</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">DOANH THU CHƯA THUẾ</span>
          <span class="metric-icon">📊</span>
        </div>
        <div class="metric-value font-bold" style="color:#1d4ed8;">${fmt(s.total_revenue_untaxed)} đ</div>
        <div class="metric-sub">Giá trị tính doanh số thuần nội bộ</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">THUẾ GTGT 8% (VAT)</span>
          <span class="metric-icon">🏛️</span>
        </div>
        <div class="metric-value font-bold text-warning">${fmt(s.total_vat_8)} đ</div>
        <div class="metric-sub">Thuế giá trị gia tăng theo quy định</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">DOANH THU ĐÃ XUẤT HÓA ĐƠN</span>
          <span class="metric-icon">📄</span>
        </div>
        <div class="metric-value font-bold" style="color:#059669;">${fmt(s.total_invoiced)} đ</div>
        <div class="metric-sub">Đạt <b>${s.invoiced_rate}%</b> • Còn lại: ${fmt(s.total_to_invoice)} đ</div>
      </div>
    </div>

    ${currentTab === 'by_product' ? `
      <!-- TAB 1: REVENUE BY PRODUCT -->
      <div class="card-box">
        <div class="card-box-header">
          <span class="card-box-title">📦 Bảng phân tích doanh thu chi tiết theo từng sản phẩm</span>
          <span class="badge badge-sale">Áp dụng thuế suất VAT 8%</span>
        </div>
        <div class="card-box-body" style="padding:0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:80px;">Mã SP</th>
                  <th>Tên sản phẩm & Quy cách</th>
                  <th style="width:60px;">ĐVT</th>
                  <th class="text-right" style="width:90px;">Đơn giá gốc</th>
                  <th class="text-right" style="width:90px;">Đơn giá VAT</th>
                  <th class="text-center" style="width:90px;">Số lượng bán</th>
                  <th class="text-right" style="width:120px;">Doanh thu chưa VAT</th>
                  <th class="text-right" style="width:100px;">Thuế VAT 8%</th>
                  <th class="text-right font-bold" style="width:130px;">Tổng doanh thu</th>
                  <th style="width:130px;">Tỷ trọng (%)</th>
                </tr>
              </thead>
              <tbody>
                ${(prodData.products || []).filter(p => p.total_qty > 0 || p.revenue_vat > 0).map(p => `
                  <tr>
                    <td class="font-bold text-primary font-mono">${esc(p.code)}</td>
                    <td>
                      <div class="font-semibold">${esc(p.name)}</div>
                      <div style="font-size:11px; color:#64748b;">Đã xuất HĐ: ${fmt(p.invoiced_revenue)} đ | Chưa xuất: ${fmt(p.to_invoice_revenue)} đ</div>
                    </td>
                    <td><span class="badge badge-draft">${esc(p.uom_name)}</span></td>
                    <td class="text-right">${fmt(p.price_untaxed)} đ</td>
                    <td class="text-right font-semibold">${fmt(p.price_vat)} đ</td>
                    <td class="text-center font-bold">
                      ${p.total_qty}
                      ${p.total_promo > 0 ? `<span style="font-size:11px; color:#16a34a;">(+${p.total_promo} KM)</span>` : ''}
                    </td>
                    <td class="text-right">${fmt(p.revenue_untaxed)} đ</td>
                    <td class="text-right text-warning font-semibold">${fmt(p.vat_8_amount)} đ</td>
                    <td class="text-right font-bold" style="color:#0f172a;">${fmt(p.revenue_vat)} đ</td>
                    <td>
                      <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width:${p.share_percent}%;"></div>
                      </div>
                      <span class="font-bold" style="font-size:12px;">${p.share_percent}%</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background:#f8fafc; font-weight:700;">
                  <td colspan="5" class="text-right">TỔNG CỘNG:</td>
                  <td class="text-center font-bold">${(prodData.products || []).reduce((s, p) => s + p.total_qty, 0)}</td>
                  <td class="text-right text-primary">${fmt(s.total_revenue_untaxed)} đ</td>
                  <td class="text-right text-warning">${fmt(s.total_vat_8)} đ</td>
                  <td class="text-right font-bold" style="color:#0f172a; font-size:14px;">${fmt(s.total_revenue_vat)} đ</td>
                  <td>100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    ` : `
      <!-- TAB 2: REVENUE BY SELLER & CUSTOMER -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="card-box">
          <div class="card-box-header"><span class="card-box-title">💵 Doanh thu & Nộp quỹ theo nhân viên bán</span></div>
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
                ${(cashData.bySeller || []).map(b => `
                  <tr>
                    <td class="font-semibold">${esc(b.seller)}</td>
                    <td class="text-right font-bold">${fmt(b.total_sales)} đ</td>
                    <td class="text-right text-success">${fmt(b.total_collected)} đ</td>
                    <td class="text-right font-bold ${b.remaining_debt > 0 ? 'text-danger' : 'text-muted'}">${fmt(b.remaining_debt)} đ</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card-box">
          <div class="card-box-header"><span class="card-box-title">📄 Theo dõi thu tiền công nợ khách hàng</span></div>
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
                ${(cashData.byCustomer || []).slice(0, 15).map(c => `
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
    `}
  `;
}

window.switchRevenueTab = function(tab) {
  state.revenueTab = tab;
  renderCash(document.getElementById('view-container'));
};

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
  navigateTo(hash && TITLES[hash] ? hash : 'overview');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
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



// ══════════════════════════ 13. INTERBRANCH TRANSFERS & LOANS VIEW ══════════════════════════ //
async function renderInterbranch(el) {
  const data = await api('/api/interbranch');
  const replenishments = (data.transfers || []).filter(t => t.type === 'replenish');
  const loans = (data.transfers || []).filter(t => t.type !== 'replenish');

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
      <div>
        <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">🚛 Tiếp Ứng Sản Xuất & Mượn Vay Nội Bộ</h2>
        <div style="font-size:13px; color:#64748b;">Nhà máy Cẩm Phả tiếp ứng kho Tăng Áp/Huế và sổ theo dõi mượn vay hàng & vỏ đơn vị bạn</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-sm btn-primary" id="tab-btn-cp" onclick="window.switchIbTab('cp')">🏭 Nhập từ Cẩm Phả (${replenishments.length})</button>
        <button class="btn btn-sm btn-secondary" id="tab-btn-loans" onclick="window.switchIbTab('loans')">🔄 Vay mượn đơn vị bạn (${loans.length})</button>
      </div>
    </div>

    <!-- Tab 1: Replenishment -->
    <div id="ib-tab-cp" class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">🏭 Lịch nhập hàng tiếp ứng từ Nhà máy Nước Cẩm Phả</span>
        <span class="badge badge-sale">Nguồn cung chính xí nghiệp</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ngày nhập</th>
              <th>Nguồn cung cấp</th>
              <th>Kho tiếp nhận</th>
              <th>Mặt hàng</th>
              <th class="text-right">Số lượng</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${replenishments.map(r => `
              <tr>
                <td class="font-bold">${esc(r.date)}</td>
                <td><span class="badge badge-draft">${esc(r.src_location)}</span></td>
                <td><span class="badge badge-purple">${esc(r.dest_location)}</span></td>
                <td class="font-semibold">${esc(r.product_name || r.product_code)}</td>
                <td class="text-right font-bold text-primary" style="font-size:14px;">${fmt(r.qty)}</td>
                <td><span class="badge badge-done">Đã nhập kho</span></td>
                <td style="font-size:12px; color:#64748b;">${esc(r.note)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: Loans & Borrowings -->
    <div id="ib-tab-loans" class="card-box" style="display:none;">
      <div class="card-box-header">
        <span class="card-box-title">📋 Nhật ký Vay Mượn Hàng & Vỏ giữa các Chi Nhánh QUAWACO</span>
        <span class="badge badge-warning">Cần hoàn trả đúng hạn</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ngày phát sinh</th>
              <th>Loại giao dịch</th>
              <th>Đơn vị xuất</th>
              <th>Đơn vị nhận</th>
              <th>Mặt hàng / Vỏ</th>
              <th class="text-right">Số lượng</th>
              <th>Tình trạng</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${loans.map(l => `
              <tr>
                <td>${esc(l.date)}</td>
                <td><span class="badge badge-purple">${esc(l.type)}</span></td>
                <td class="font-semibold">${esc(l.src_location)}</td>
                <td class="font-semibold">${esc(l.dest_location)}</td>
                <td>${esc(l.product_name || l.product_code)}</td>
                <td class="text-right font-bold">${fmt(l.qty)}</td>
                <td><span class="badge badge-warning">${esc(l.status)}</span></td>
                <td style="font-size:12px; color:#64748b;">${esc(l.note)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.switchIbTab = function(tab) {
  document.getElementById('ib-tab-cp').style.display = (tab === 'cp' ? 'block' : 'none');
  document.getElementById('ib-tab-loans').style.display = (tab === 'loans' ? 'block' : 'none');
  document.getElementById('tab-btn-cp').className = 'btn btn-sm ' + (tab === 'cp' ? 'btn-primary' : 'btn-secondary');
  document.getElementById('tab-btn-loans').className = 'btn btn-sm ' + (tab === 'loans' ? 'btn-primary' : 'btn-secondary');
};

// ══════════════════════════ 14. GUARDS ROSTER VIEW ══════════════════════════ //
async function renderGuards(el) {
  const data = await api('/api/guards');
  el.innerHTML = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">🛡️ Phân Công Ca Trực & Hỗ Trợ Bốc Xếp</h2>
      <div style="font-size:13px; color:#64748b;">Lịch trực bốc xếp của Tổ Bảo Vệ theo ngày: Định mức phụ cấp 80.000đ/ca</div>
    </div>

    <!-- Guard Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom:20px;">
      ${(data.summary || []).map(g => `
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">${esc(g.guard_name)}</span>
            <span class="metric-icon">🛡️</span>
          </div>
          <div class="metric-value font-bold">${g.shift_count} ca</div>
          <div class="metric-sub">Phụ cấp: <b class="text-success">${fmt(g.total_allowance)} đ</b></div>
        </div>
      `).join('')}
    </div>

    <!-- Shifts Table -->
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">📋 Nhật ký 23 ca trực bốc xếp Tháng 9</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Thứ</th>
              <th>Nhân sự bảo vệ trực</th>
              <th>Nhiệm vụ</th>
              <th class="text-right">Phụ cấp</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${(data.shifts || []).map(s => `
              <tr>
                <td class="font-bold">Ngày ${s.day_num} / 9</td>
                <td><span class="badge badge-draft">Thứ ${esc(s.weekday)}</span></td>
                <td class="font-semibold text-primary">${esc(s.guard_name)}</td>
                <td>${esc(s.duty_type)}</td>
                <td class="text-right font-bold text-success">${fmt(s.allowance)} đ</td>
                <td style="font-size:12px; color:#64748b;">${esc(s.note)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ══════════════════════════ 15. AUDIT & RISK ANALYSIS VIEW ══════════════════════════ //
async function renderAudit(el) {
  const data = await api('/api/audit');
  el.innerHTML = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">⚠️ Báo Cáo Đối Soát & Kiểm Kê Rủi Ro Dữ Liệu</h2>
      <div style="font-size:13px; color:#64748b;">Phát hiện và chứng minh 12 lỗi gãy công thức #REF! cùng 7 rủi ro vận hành trên file Excel cũ</div>
    </div>

    <!-- 7 Operational Risks Findings -->
    <div class="card-box" style="margin-bottom:20px;">
      <div class="card-box-header">
        <span class="card-box-title">🔍 7 Điểm Rủi Ro Vận Hành Phát Hiện Từ Bảng Tính & Giải Pháp ERP</span>
        <span class="badge badge-purple">Khắc phục 100% trên ERP</span>
      </div>
      <div class="card-box-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mảng nghiệp vụ</th>
              <th>Vị trí Excel</th>
              <th>Vấn đề thực tế</th>
              <th>Mức độ</th>
              <th>Giải pháp phần mềm QAROMI ERP</th>
            </tr>
          </thead>
          <tbody>
            ${(data.findings || []).map(f => `
              <tr>
                <td class="font-semibold">${esc(f.category)}</td>
                <td><span class="badge badge-draft">${esc(f.sheet_name)} (${esc(f.cell_address)})</span></td>
                <td style="font-size:12px; color:#334155;">${esc(f.detail)}</td>
                <td>
                  <span class="badge ${f.risk_level === 'CRITICAL' ? 'badge-danger' : (f.risk_level === 'HIGH' ? 'badge-warning' : 'badge-draft')}">
                    ${esc(f.risk_level)}
                  </span>
                </td>
                <td style="font-size:12px; color:#1e40af; font-weight:500;">${esc(f.erp_solution)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ══════════════════════════ 16. BLUEPRINT & ARCHITECTURE VIEW ══════════════════════════ //
async function renderBlueprint(el) {
  const bp = await api('/api/blueprint');
  el.innerHTML = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">🏛️ Kiến Trúc Hệ Thống & Giải Pháp Kỹ Thuật</h2>
      <div style="font-size:13px; color:#64748b;">Thiết kế luồng dữ liệu khép kín, phân quyền người dùng và lộ trình triển khai chuyển đổi số QUAWACO</div>
    </div>

    <!-- 4 Layers Architecture Cards -->
    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">TẦNG 1: GIAO DIỆN (UI)</span><span class="metric-icon">🖥️</span></div>
        <div style="font-size:13px; font-weight:600; margin:6px 0;">Web App + Mobile PWA</div>
        <div class="metric-sub">Tối ưu cho máy tính văn phòng, điện thoại nhân viên đi thị trường và xe tải điện.</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">TẦNG 2: NGHIỆP VỤ (CORE)</span><span class="metric-icon">⚙️</span></div>
        <div style="font-size:13px; font-weight:600; margin:6px 0;">Odoo / MiERP Engine</div>
        <div class="metric-sub">Module Bán hàng, Kho đa điểm, FSM Dịch vụ gia tăng, Quản lý tài sản vỏ bình.</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">TẦNG 3: TÍCH HỢP (API)</span><span class="metric-icon">🔌</span></div>
        <div style="font-size:13px; font-weight:600; margin:6px 0;">Hóa Đơn & Mạng Nước</div>
        <div class="metric-sub">Kết nối máy chủ Hóa đơn điện tử VNPT/Viettel và danh bạ đồng hồ nước sinh hoạt.</div>
      </div>
      <div class="metric-card">
        <div class="metric-header"><span class="metric-title">TẦNG 4: CSDL (DATABASE)</span><span class="metric-icon">🗄️</span></div>
        <div style="font-size:13px; font-weight:600; margin:6px 0;">PostgreSQL Enterprise</div>
        <div class="metric-sub">Ràng buộc toàn vẹn khóa ngoại, sao lưu tự động hàng ngày, triệt tiêu gãy công thức #REF!.</div>
      </div>
    </div>

    <!-- End to End Data Flow -->
    <div class="card-box">
      <div class="card-box-header">
        <span class="card-box-title">🔄 Chu Trình Dữ Liệu Khép Kín (End-to-End Business Flow)</span>
      </div>
      <div class="card-box-body">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div style="font-weight:700; color:#1d4ed8; margin-bottom:4px;">1. Báo Giá & Đơn Hàng</div>
            <div style="font-size:12px; color:#475569;">Tổ Tiếp thị ghi nhận đơn, kiểm tra hạn mức vỏ bình và giá theo kênh (XN, CTY, BC, MD).</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div style="font-weight:700; color:#1d4ed8; margin-bottom:4px;">2. Xuất Kho & Phân Xe</div>
            <div style="font-size:12px; color:#475569;">Bút toán kép trừ tồn kho (Kho Tăng Áp, Kho Huế) và xuất cho xe tải điện nạp kho di động.</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div style="font-weight:700; color:#1d4ed8; margin-bottom:4px;">3. Giao Hàng & Chia Cước</div>
            <div style="font-size:12px; color:#475569;">Cước vận chuyển 50.000đ được tự động chia đều cho 2 người (25.000đ/người) vào bảng lương.</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div style="font-weight:700; color:#1d4ed8; margin-bottom:4px;">4. Thu Nợ & Sổ Vỏ Bình</div>
            <div style="font-size:12px; color:#475569;">Thu tiền COD nộp quỹ xí nghiệp và tự động cập nhật sổ nợ vỏ bình úp/vòi theo khách hàng.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
