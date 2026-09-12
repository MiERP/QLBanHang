import type {
  BottleLedger,
  BranchLoan,
  Category,
  Customer,
  CustomerGroup,
  DashboardData,
  Dispatch,
  DvgtRequest,
  Employee,
  ExpenseTransaction,
  FinanceSummary,
  KpiEvaluation,
  KpiOverview,
  Order,
  PartnerBranch,
  Product,
  ProductConversion,
  RevenueTransaction,
  Role,
  Settlement,
  Station,
  StockItem,
  StockMovement,
  Warehouse,
} from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
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
    const message = (data as { error?: string } | null)?.error ?? `Lỗi hệ thống (${res.status})`;
    throw new ApiError(message, res.status);
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
export const stations = resource<Station>('/stations');
export const roles = resource<Role>('/roles');
export const categories = resource<Category>('/categories');
export const partnerBranches = resource<PartnerBranch>('/partner-branches');
export const customerGroups = resource<CustomerGroup>('/customer-groups');
export const productConversions = resource<ProductConversion>('/product-conversions');
export const customers = resource<Customer>('/customers');
export const staff = resource<Employee>('/staff');
export const branchLoans = resource<BranchLoan>('/branch-loans');
export const dvgt = resource<DvgtRequest>('/dvgt');

// Orders
export const fetchOrders = (params: { from?: string; to?: string; status?: string; limit?: number } = {}) =>
  request<Order[]>(`/orders${qs(params)}`);
export const createOrder = (data: Record<string, unknown>) => post<{ success: boolean; orderId: number; orderCode: string; total: number }>('/orders', data);
export const updateOrder = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/orders/${id}`, data);
export const deleteOrder = (id: number) => del<{ success: boolean }>(`/orders/${id}`);

// Inventory
export const fetchStock = (warehouseId?: number) => request<StockItem[]>(`/inventory/stock${qs({ warehouse_id: warehouseId })}`);
export const fetchAlerts = () => request<StockItem[]>('/inventory/alerts');
export const fetchMovements = (params: { product_id?: number; warehouse_id?: number; movement_type?: string; limit?: number } = {}) =>
  request<StockMovement[]>(`/inventory/movements${qs(params)}`);
export const transferStock = (data: Record<string, unknown>) => post<{ success: boolean }>('/inventory/transfer', data);
export const updateStock = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/inventory/stock/${id}`, data);

// Customers extra
export const fetchBottleLedgers = (customerId?: number) =>
  request<BottleLedger[]>(`/customers/bottle-ledgers${qs({ customer_id: customerId })}`);
export const returnBottles = (customerId: number, data: Record<string, unknown>) =>
  post<{ success: boolean; remaining_voi: number; remaining_up: number }>(`/customers/${customerId}/bottle-return`, data);

// Staff extra
export const fetchShipperSettlements = (month?: string) =>
  request<{ employee_id: number; full_name: string; station_name?: string; total_trips: number; total_shipping_fee: number; total_cash_collected: number }[]>(
    `/staff/shipping-settlements${qs({ month })}`
  );
export const fetchEmployeeBottleLedgers = (employeeId?: number) =>
  request<Record<string, unknown>[]>(`/staff/bottle-ledgers${qs({ employee_id: employeeId })}`);

// Branch loans extra
export const settleBranchLoan = (id: number, data: Record<string, unknown>) =>
  post<{ success: boolean }>(`/branch-loans/${id}/settle`, data);

// Delivery
export const fetchDispatches = (params: { status?: string; shipper_employee_id?: number; month?: string } = {}) =>
  request<Dispatch[]>(`/delivery/dispatches${qs(params)}`);
export const createDispatch = (data: Record<string, unknown>) => post<{ success: boolean; id: number; code: string }>('/delivery/dispatches', data);
export const updateDispatch = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/delivery/dispatches/${id}`, data);
export const fetchSettlements = (params: { month?: string; shipper_employee_id?: number } = {}) =>
  request<Settlement[]>(`/delivery/settlements${qs(params)}`);
export const createSettlement = (data: Record<string, unknown>) => post<{ success: boolean; id: number }>('/delivery/settlements', data);

// Finance
export const fetchRevenue = (params: { from?: string; to?: string; type?: string } = {}) =>
  request<RevenueTransaction[]>(`/finance/revenue${qs(params)}`);
export const createRevenue = (data: Record<string, unknown>) => post<{ success: boolean; id: number; code: string }>('/finance/revenue', data);
export const updateRevenue = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/finance/revenue/${id}`, data);
export const deleteRevenue = (id: number) => del<{ success: boolean }>(`/finance/revenue/${id}`);
export const fetchExpenses = (params: { from?: string; to?: string; category?: string } = {}) =>
  request<ExpenseTransaction[]>(`/finance/expenses${qs(params)}`);
export const createExpense = (data: Record<string, unknown>) => post<{ success: boolean; id: number; code: string }>('/finance/expenses', data);
export const updateExpense = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/finance/expenses/${id}`, data);
export const deleteExpense = (id: number) => del<{ success: boolean }>(`/finance/expenses/${id}`);
export const fetchFinanceSummary = (month?: string) => request<FinanceSummary>(`/finance/summary${qs({ month })}`);

// KPI
export const fetchKpiRecords = (month?: string) => request<KpiEvaluation[]>(`/kpi/records${qs({ month })}`);
export const fetchKpiOverview = (month?: string) => request<KpiOverview>(`/kpi/overview${qs({ month })}`);
export const createKpiRecord = (data: Record<string, unknown>) => post<{ success: boolean; id: number }>('/kpi/records', data);
export const updateKpiRecord = (id: number, data: Record<string, unknown>) => put<{ success: boolean }>(`/kpi/records/${id}`, data);
export const deleteKpiRecord = (id: number) => del<{ success: boolean }>(`/kpi/records/${id}`);
export const recomputeKpi = (month?: string) => post<{ success: boolean; updated: number }>('/kpi/recompute', { month });

// Dashboard
export const fetchDashboard = (month?: string) => request<DashboardData>(`/dashboard${qs({ month })}`);
