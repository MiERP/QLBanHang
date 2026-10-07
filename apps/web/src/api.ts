import type {
  AppSettings,
  AuditLogResponse,
  BottleLedger,
  CashAuditReport,
  Category,
  Customer,
  CustomerGroup,
  DashboardData,
  DepositTransaction,
  ExpenseReport,
  Employee,
  ImportSource,
  Invoice,
  InvoiceOrderRow,
  LoanRow,
  NotificationsResponse,
  Order,
  OrgUnit,
  PartnerUnit,
  PayrollReport,
  Position,
  PriceListEntry,
  Product,
  Promotion,
  ReportPeriod,
  CustomerDebtReport,
  RevenueBorrowedReport,
  RevenueDetailReport,
  RevenueGrossReport,
  RevenueTransaction,
  ServiceJob,
  ShellAuditReport,
  ShellDeposit,
  ShellDepositReport,
  ShellMovement,
  ShellOrdersReport,
  ShellStockReport,
  ShippingFee,
  StockItem,
  StockAuditReport,
  StockTicket,
  TargetBoard,
  TradeReport,
  VatRate,
  Warehouse,
} from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const payload = data as { error?: string; details?: unknown } | null;
    throw new ApiError(payload?.error ?? `Lỗi hệ thống (${res.status})`, res.status, payload?.details);
  }
  return data as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

interface Crud<T> {
  list: () => Promise<T[]>;
  create: (data: Record<string, unknown>) => Promise<{ success: boolean; id: number; code?: string }>;
  update: (id: number, data: Record<string, unknown>) => Promise<{ success: boolean }>;
  remove: (id: number) => Promise<{ success: boolean }>;
}

function resource<T>(base: string, listPath?: string): Crud<T> {
  return {
    list: () => request<T[]>(listPath ?? base),
    create: (data) => post(`${base}`, data),
    update: (id, data) => put(`${base}/${id}`, data),
    remove: (id) => del(`${base}/${id}`),
  };
}

export const products = resource<Product>('/products');
export const warehouses = resource<Warehouse>('/warehouses');
export const orgUnits = resource<OrgUnit>('/org-units');
export const positions = resource<Position>('/positions');
export const importSources = resource<ImportSource>('/import-sources');
export const categories = resource<Category>('/categories');
export const customerGroups = resource<CustomerGroup>('/customer-groups');
export const vatRates = resource<VatRate>('/vat-rates');
// Phí cọc vỏ bình theo loại vỏ (Vòi / Úp) — một nguồn duy nhất cho thu và hoàn cọc.
export const shellDeposits = resource<ShellDeposit>('/shell-deposits');
export const serviceJobs = resource<ServiceJob>('/service-jobs');
export const priceList = resource<PriceListEntry>('/price-list');
export const shippingFees = resource<ShippingFee>('/shipping-fees');
export const promotions = resource<Promotion>('/promotions');
export const partnerUnits = resource<PartnerUnit>('/partner-units');

// Cấu hình hệ thống (quy tắc nghiệp vụ bật/tắt) — khai báo ở apps/api/src/lib/appSettings.ts.
export const fetchSettings = () => request<AppSettings>('/settings');
export const updateSettings = (patch: AppSettings) =>
  put<{ success: boolean; settings: AppSettings }>('/settings', patch);

// Kỳ báo cáo hiện tại (từ ngày → đến ngày) — nguồn duy nhất để hiển thị nhãn kỳ ở mọi màn báo cáo.
export const fetchReportPeriod = () => request<ReportPeriod>('/report-period');

// Invoices
export const fetchInvoices = () => request<Invoice[]>('/invoices');
export const createInvoice = (data: Record<string, unknown>) =>
  post<{ success: boolean; id: number; invoiceCode: string }>('/invoices', data);
// Danh sách hóa đơn theo ĐƠN (đã xuất / chưa xuất).
export const fetchInvoiceOrders = (invoiceStatus: 'INVOICED' | 'NOT_INVOICED') =>
  request<InvoiceOrderRow[]>(`/invoices/orders${qs({ invoice_status: invoiceStatus })}`);
export const invoiceOrdersExportUrl = (invoiceStatus: 'INVOICED' | 'NOT_INVOICED') =>
  `${API_BASE}/invoices/orders.xlsx${qs({ invoice_status: invoiceStatus })}`;
export const customers = resource<Customer>('/customers');
export const staff = resource<Employee>('/staff');

// Orders
export const fetchOrders = (params: { from?: string; to?: string; status?: string; limit?: number; customer_id?: number } = {}) =>
  request<Order[]>(`/orders${qs(params)}`);
export const fetchOrder = (id: number) => request<Order>(`/orders/${id}`);
// Xuất Excel các đơn chưa hoàn tất để điều phối công việc.
export const dispatchExportUrl = () => `${API_BASE}/orders/export-dispatch.xlsx`;
export const createOrder = (data: Record<string, unknown>) => post<{ success: boolean; orderId: number; orderCode: string; total: number }>('/orders', data);
export const updateOrder = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/orders/${id}`, data);
export const updateOrderStatus = (id: number, status: string) =>
  post<{ success: boolean; id: number; status: string }>(`/orders/${id}/status`, { status });
// Thu nợ của đơn đã hoàn thành — sinh phiếu thu "Thu nợ", cập nhật trạng thái thanh toán của đơn.
export const collectOrderPayment = (id: number, data: Record<string, unknown>) =>
  post<{ success: boolean; orderId: number; paid_amount: number; payment_status: string; remaining: number }>(
    `/orders/${id}/collect`,
    data
  );
export const bulkUpdateOrderStatus = (ids: number[], status: string) =>
  post<{ success: boolean; status: string; succeeded: number[]; failed: { id: number; error: string }[] }>(
    '/orders/bulk-status',
    { ids, status }
  );
export const bulkDeleteOrders = (ids: number[]) =>
  post<{ success: boolean; succeeded: number[]; failed: { id: number; error: string }[] }>('/orders/bulk-delete', { ids });
export const updateOrderShippers = (id: number, shippers: { employee_id: number; allocated_fee: number }[]) =>
  put<{ success: boolean }>(`/orders/${id}/shippers`, { shippers });
export const mergeOrders = (ids: number[], data: Record<string, unknown>) =>
  post<{ success: boolean; orderId: number; orderCode: string; mergedFrom: string[] }>('/orders/merge', { ids, ...data });

// Inventory
export const fetchStock = (warehouseId?: number) => request<StockItem[]>(`/inventory/stock${qs({ warehouse_id: warehouseId })}`);
export const fetchAlerts = () => request<StockItem[]>('/inventory/alerts');

// Nhật ký tồn kho: tồn CUỐI mỗi ngày của từng kho × mặt hàng (mỗi ngày × kho một dòng).
export interface StockDailyRow {
  date: string;
  warehouse_id: number;
  product_id: number;
  quantity: number;
}
export const fetchStockDaily = (from: string, to: string) =>
  request<{ from: string; to: string; rows: StockDailyRow[] }>(`/inventory/stock-daily${qs({ from, to })}`);

// Bảng tổng hợp tồn kho (mỗi kho một dòng, mỗi mặt hàng một cột).
// Có from/to → xuất nhật ký theo ngày kèm cột NGÀY; không có → tồn hiện tại.
export const stockExportUrl = (params: { from?: string; to?: string } = {}) =>
  `${API_BASE}/inventory/stock.xlsx${qs(params)}`;
export const fetchNotifications = () => request<NotificationsResponse>('/notifications');
export const markNotificationRead = (id: string) =>
  request<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });

// Nhật ký hệ thống (chỉ đọc)
export const fetchAuditLogs = (params: { from?: string; to?: string; entity?: string; limit?: number } = {}) =>
  request<AuditLogResponse>(`/audit-logs${qs(params)}`);

// Phiếu kho (nhập / xuất / điều chuyển)
export const fetchStockTickets = (
  params: { direction?: string; order_id?: number; month?: string; warehouse_id?: number; from?: string; to?: string } = {}
) => request<StockTicket[]>(`/stock-tickets${qs(params)}`);
export const stockTicketsExportUrl = (params: { direction?: string; warehouse_id?: number; from?: string; to?: string; ids?: string } = {}) =>
  `${API_BASE}/stock-tickets/export.xlsx${qs(params)}`;
export const createStockTicket = (data: Record<string, unknown>) =>
  post<{ success: boolean; id: number; code: string }>('/stock-tickets', data);
export const updateStockTicket = (id: number, data: Record<string, unknown>) =>
  put<{ success: boolean }>(`/stock-tickets/${id}`, data);
export const setStockTicketStatus = (id: number, status: string) =>
  post<{ success: boolean; id: number; status: string }>(`/stock-tickets/${id}/status`, { status });
export const bulkSetStockTicketStatus = (ids: number[], status: string) =>
  post<{ success: boolean; status: string; succeeded: number[]; failed: { id: number; error: string }[] }>(
    '/stock-tickets/bulk-status',
    { ids, status }
  );
export const deleteStockTicket = (id: number) => del<{ success: boolean }>(`/stock-tickets/${id}`);

// Customers extra
export const fetchBottleLedgers = (customerId?: number) =>
  request<BottleLedger[]>(`/customers/bottle-ledgers${qs({ customer_id: customerId })}`);
export const returnBottles = (customerId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; remaining_voi: number; remaining_up: number; deposit_refund: number }>(
    `/customers/${customerId}/bottle-return`,
    data
  );

// Finance
export const fetchRevenue = (params: { from?: string; to?: string; type?: string; customer_id?: number } = {}) =>
  request<RevenueTransaction[]>(`/finance/revenue${qs(params)}`);

// Loans (đơn cho mượn liên đơn vị)
export const fetchLoans = (params: { from?: string; to?: string; direction?: string } = {}) => request<LoanRow[]>(`/loans${qs(params)}`);
// Công nợ phải thu của khách hàng (luỹ kế: nợ đầu kỳ + phần chưa thu của đơn đã hoàn thành).
export const fetchCustomerDebts = () => request<CustomerDebtReport>('/customers/receivables');
export const customerDebtExportUrl = () => `${API_BASE}/customers/receivables.xlsx`;
// Thu nợ đầu kỳ của khách (giảm nợ đầu kỳ, ghi phiếu thu "Thu nợ" vào sổ quỹ).
export const collectCustomerDebt = (customerId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; customerId: number; remaining: number }>(`/customers/${customerId}/collect-debt`, data);

export const settleLoan = (orderId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; orderId: number; ticketCode: string | null; returnedValue: number }>(
    `/loans/${orderId}/settle`,
    data
  );

// Hàng hoàn: ghi nhận khách trả lại hàng cho đơn đã hoàn tất (gọi lại = sửa số lượng hoàn).
export const returnOrder = (orderId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; orderId: number; ticketCode: string; returnedValue: number; depositRefund: number }>(
    `/orders/${orderId}/return`,
    data
  );

// Dashboard
export const fetchDashboard = () => request<DashboardData>('/dashboard');

// Reports
// Doanh thu xí nghiệp chi tiết (nhóm theo kho xuất hàng / đơn vị của nhân viên bán).
export const fetchRevenueDetailReport = (params: { from?: string; to?: string; group?: string } = {}) =>
  request<RevenueDetailReport>(`/reports/revenue-detail${qs(params)}`);
// Doanh thu đơn hàng đi mượn (mượn của đối tác nào, bán được bao nhiêu).
export const fetchRevenueBorrowedReport = (params: { from?: string; to?: string } = {}) =>
  request<RevenueBorrowedReport>(`/reports/revenue-borrowed${qs(params)}`);
// Doanh thu gộp (xí nghiệp + đi mượn + cấp cho Công ty/XN khác; tiền công bốc xếp tách riêng).
export const fetchRevenueGrossReport = (params: { from?: string; to?: string } = {}) =>
  request<RevenueGrossReport>(`/reports/revenue-gross${qs(params)}`);
export const revenueDetailExportUrl = (params: { from?: string; to?: string; group?: string } = {}) =>
  `${API_BASE}/reports/revenue-detail.xlsx${qs(params)}`;
export const revenueBorrowedExportUrl = (params: { from?: string; to?: string } = {}) =>
  `${API_BASE}/reports/revenue-borrowed.xlsx${qs(params)}`;
export const revenueGrossExportUrl = (params: { from?: string; to?: string } = {}) =>
  `${API_BASE}/reports/revenue-gross.xlsx${qs(params)}`;
export const fetchExpenseReport = (params: { from?: string; to?: string } = {}) =>
  request<ExpenseReport>(`/reports/expenses${qs(params)}`);
// borrowed = cộng thêm doanh thu đơn đi mượn hàng của đối tác.
export const fetchTradeReport = (borrowed = false) =>
  request<TradeReport>(`/reports/trade-template${qs({ borrowed: borrowed ? 1 : undefined })}`);
export const tradeReportExportUrl = (mode: 'net' | 'gross', borrowed = false) =>
  `${API_BASE}/reports/trade-template.xlsx${qs({ mode, borrowed: borrowed ? 1 : undefined })}`;
export const fetchStockAudit = (params: { warehouse_id: number; from?: string; to?: string }) =>
  request<StockAuditReport>(`/reports/stock-audit${qs(params)}`);
// Đối chiếu vỏ bình: vỏ xí nghiệp đang giữ ↔ nợ vỏ khách ↔ sổ vỏ khách (theo loại vỏ, không theo kho).
export const fetchShellAudit = (params: { from?: string; to?: string } = {}) =>
  request<ShellAuditReport>(`/reports/shell-audit${qs(params)}`);
// Đối chiếu tiền: số đã thu trên đơn ↔ sổ quỹ (phiếu thu) ↔ cọc vỏ.
export const fetchCashAudit = (params: { customer_id?: number; from?: string; to?: string } = {}) =>
  request<CashAuditReport>(`/reports/cash-audit${qs(params)}`);
// Đối chiếu vỏ bình & cọc vỏ: nợ vỏ khách đang giữ ↔ tiền cọc đang giữ.
export const fetchShellDepositReport = () =>
  request<ShellDepositReport>('/reports/shell-deposits');
export const fetchShellOrders = (params: { scope?: 'all' | 'period' } = {}) =>
  request<ShellOrdersReport>(`/reports/shell-orders${qs(params)}`);
export const shellDepositExportUrl = (mode?: 'debt') =>
  `${API_BASE}/reports/shell-deposits.xlsx${mode === 'debt' ? '?mode=debt' : ''}`;

// Sổ vỏ bình: vỏ xí nghiệp đang giữ (một pool theo loại vỏ) + vỏ khách/đối tác đang giữ.
export const fetchShellStock = () => request<ShellStockReport>('/shell-stock');
export const fetchShellMovements = (params: { from?: string; to?: string; movement_type?: string } = {}) =>
  request<ShellMovement[]>(`/shell-movements${qs(params)}`);
export const createShellMovement = (data: Record<string, unknown>) =>
  post<{ success: boolean; id: number }>('/shell-movements', data);
// Tất toán toàn bộ vỏ khách đang giữ (thu hồi + hoàn cọc), và ghi nhận vỏ mất / mua đứt (giữ cọc).
export const settleShells = (customerId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; shells_voi: number; shells_up: number; deposit_refund: number }>(
    `/customers/${customerId}/settle-shells`,
    data
  );
export const writeOffShells = (customerId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; newVoi: number; newUp: number }>(`/customers/${customerId}/shell-writeoff`, data);
export const submitStockCount = (data: Record<string, unknown>) =>
  post<{ success: boolean; tickets: string[]; surplus: number; shortage: number }>('/stock-tickets/stock-count', data);

// Bảng lương theo nhân viên (phí vận chuyển / dịch vụ gia tăng)
export const fetchShippingPayroll = () =>
  request<PayrollReport>('/reports/payroll-shipping');
export const shippingPayrollExportUrl = () => `${API_BASE}/reports/payroll-shipping.xlsx`;
export const fetchServicePayroll = () =>
  request<PayrollReport>('/reports/payroll-service');
export const servicePayrollExportUrl = () => `${API_BASE}/reports/payroll-service.xlsx`;

// Deposits (cọc vỏ)
export const fetchDeposits = (params: { customer_id?: number; type?: string; from?: string; to?: string } = {}) =>
  request<DepositTransaction[]>(`/deposits${qs(params)}`);
export const createDeposit = (data: Record<string, unknown>) =>
  post<{ success: boolean; id: number; code: string }>('/deposits', data);

// Targets (chỉ tiêu doanh thu)
export const fetchTargets = (period?: string) => request<TargetBoard>(`/targets${qs({ period })}`);
export const createTarget = (data: Record<string, unknown>) => post<{ success: boolean; id: number }>('/targets', data);
export const updateTarget = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/targets/${id}`, data);

// Nhập dữ liệu từ Excel
export type ImportKind =
  | 'categories'
  | 'customer-groups'
  | 'warehouses'
  | 'org-units'
  | 'staff'
  | 'products'
  | 'customers'
  | 'opening-stock'
  | 'orders';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  kind: ImportKind;
  imported: number;
  updated: number;
  message: string;
  tickets?: string[];
  orderCodes?: string[];
}

export type ImportMode = 'strict' | 'upsert';

export const importTemplateUrl = (kind: ImportKind) => `${API_BASE}/imports/templates/${kind}.xlsx`;

// --- Quản trị CSDL: sao lưu toàn bộ ra Excel / khôi phục lại / đưa về mặc định ---

export const backupExportUrl = () => `${API_BASE}/system/export.xlsx`;

export interface BackupImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  results: { table: string; inserted: number; updated: number; missing: string[] }[];
}

export async function importBackupExcel(file: File): Promise<BackupImportResult> {
  const res = await fetch(`${API_BASE}/system/import`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: file,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const payload = data as { error?: string; details?: unknown } | null;
    throw new ApiError(payload?.error ?? `Lỗi hệ thống (${res.status})`, res.status, payload?.details);
  }
  return data as BackupImportResult;
}

export const resetDatabase = () => request<{ success: boolean }>('/system/reset-database', { method: 'POST' });

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function uploadImportExcel(kind: ImportKind, file: File, mode: ImportMode = 'strict'): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/imports/${kind}${mode === 'upsert' ? '?mode=upsert' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': XLSX_MIME },
    body: file,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const payload = data as { error?: string; details?: unknown } | null;
    throw new ApiError(payload?.error ?? `Lỗi hệ thống (${res.status})`, res.status, payload?.details);
  }
  return data as ImportResult;
}
