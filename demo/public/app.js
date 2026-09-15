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
