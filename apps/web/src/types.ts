export interface Product {
  id: number;
  category_id: number;
  code: string;
  name: string;
  unit: string;
  bottle_type: 'VOI' | 'UP' | 'NONE';
  standard_price: number;
  wholesale_price: number;
  cost_price: number;
  deposit_fee: number;
  has_shell_cycle: number;
  is_active: number;
  category_name?: string;
  category_type?: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  type: 'BOTTLE_WATER' | 'PACK_WATER' | 'SERVICE_DVGT';
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  manager_employee_id?: number;
  manager_name?: string;
  location?: string;
  is_active?: number;
}

export interface StockItem {
  id: number;
  warehouse_id: number;
  product_id: number;
  quantity: number;
  min_stock_alert: number;
  avg_daily_sales: number;
  warehouse_name: string;
  product_name: string;
  unit: string;
  bottle_type: string;
  standard_price: number;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  days_left: number;
}

export interface Customer {
  id: number;
  group_id?: number;
  code: string;
  name: string;
  phone?: string;
  address: string;
  tax_code?: string;
  contact_person?: string;
  bottle_debt_voi: number;
  bottle_debt_up: number;
  current_debt: number;
  max_debt_limit: number;
  group_name?: string;
  group_discount?: number;
}

export interface CustomerGroup {
  id: number;
  code: string;
  name: string;
  discount_percent: number;
}

export interface OrderItem {
  id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  quantity_promo?: number;
  unit_price: number;
  total_price: number;
  unit?: string;
  bottle_type?: string;
}

export interface Order {
  id: number;
  order_code: string;
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  seller_employee_id: number;
  seller_name: string;
  shipper_employee_id?: number;
  shipper_name?: string;
  warehouse_id: number;
  warehouse_name: string;
  order_date: string;
  delivery_date?: string;
  order_status: string;
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payment_method: string;
  is_vat_invoice: number;
  vat_rate?: number;
  vat_number?: string;
  company_name_vat?: string;
  tax_code_vat?: string;
  address_vat?: string;
  subtotal_amount: number;
  shipping_fee: number;
  discount_amount?: number;
  deposit_amount?: number;
  total_amount: number;
  paid_amount: number;
  note?: string;
  items?: OrderItem[];
}

export interface Employee {
  id: number;
  code: string;
  full_name: string;
  position: string;
  phone: string;
  station_id?: number;
  station_name?: string;
  role_id: number;
  role_name?: string;
  role_code?: string;
  commission_rate?: number;
  shipping_allowance?: number;
}

export interface Station {
  id: number;
  code: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export interface PartnerBranch {
  id: number;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  is_internal: number;
}

export interface ProductConversion {
  id: number;
  from_product_id: number;
  to_product_id: number;
  ratio: number;
  note?: string;
  from_product_name?: string;
  to_product_name?: string;
}

export interface BranchLoanItem {
  id?: number;
  product_id: number;
  product_name: string;
  unit?: string;
  quantity_loaned: number;
  quantity_returned: number;
}

export interface BranchLoan {
  id: number;
  loan_code: string;
  loan_direction: 'GIVE_LOAN' | 'TAKE_LOAN';
  partner_branch_id: number;
  partner_branch_name: string;
  warehouse_id: number;
  warehouse_name: string;
  carrier_employee_id?: number;
  carrier_name?: string;
  status: 'PENDING' | 'PARTIAL_RETURN' | 'SETTLED' | 'OVERDUE';
  loan_date: string;
  due_date: string;
  note?: string;
  items?: BranchLoanItem[];
}

export interface StockMovement {
  id: number;
  movement_type: string;
  source_warehouse_id?: number;
  source_warehouse_name?: string;
  target_warehouse_id?: number;
  target_warehouse_name?: string;
  product_id: number;
  product_name: string;
  unit?: string;
  quantity: number;
  quantity_promo?: number;
  reference_id?: string;
  performed_by_name?: string;
  note?: string;
  created_at: string;
}

export interface Dispatch {
  id: number;
  dispatch_code: string;
  order_id: number;
  order_code: string;
  order_date: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  delivery_date?: string;
  customer_name: string;
  customer_address: string;
  shipper_employee_id: number;
  shipper_name: string;
  warehouse_id: number;
  warehouse_name: string;
  shipping_fee: number;
  status: 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  note?: string;
}

export interface Settlement {
  id: number;
  dispatch_id: number;
  dispatch_code: string;
  order_code: string;
  shipper_name: string;
  cash_collected: number;
  shells_returned_voi: number;
  shells_returned_up: number;
  shells_lost: number;
  cash_turned_in: number;
  shipping_fee_paid: number;
  settled_at: string;
  note?: string;
}

export interface DvgtRequest {
  id: number;
  request_code: string;
  customer_name: string;
  phone: string;
  address: string;
  service_product_id: number;
  service_name?: string;
  unit?: string;
  seller_employee_id: number;
  seller_name?: string;
  technician_employee_id?: number;
  technician_name?: string;
  station_id?: number;
  station_name?: string;
  scheduled_date?: string;
  completed_date?: string;
  status: 'REGISTERED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  revenue_amount: number;
  payment_status: 'UNPAID' | 'PAID';
  note?: string;
}

export interface RevenueTransaction {
  id: number;
  transaction_code: string;
  transaction_type: string;
  order_id?: number;
  order_code?: string;
  dvgt_id?: number;
  customer_id?: number;
  customer_name?: string;
  amount: number;
  payment_method: string;
  collected_by?: number;
  collected_by_name?: string;
  transaction_date: string;
  note?: string;
}

export interface ExpenseTransaction {
  id: number;
  expense_code: string;
  category: string;
  amount: number;
  paid_to: string;
  paid_by?: number;
  paid_by_name?: string;
  station_id?: number;
  station_name?: string;
  payment_method: string;
  expense_date: string;
  note?: string;
}

export interface BottleLedger {
  id: number;
  customer_id: number;
  customer_name: string;
  order_id?: number;
  order_code?: string;
  transaction_date: string;
  borrowed_voi: number;
  borrowed_up: number;
  returned_voi: number;
  returned_up: number;
  remaining_balance_voi: number;
  remaining_balance_up: number;
  handler_name?: string;
  note?: string;
}

export interface KpiEvaluation {
  id: number;
  employee_id: number;
  employee_name: string;
  position: string;
  commission_rate?: number;
  station_name?: string;
  role_name?: string;
  target_water_revenue: number;
  actual_water_revenue: number;
  target_dvgt_revenue: number;
  actual_dvgt_revenue: number;
  target_bottle_delivery: number;
  actual_bottle_delivery: number;
  target_new_customers: number;
  actual_new_customers: number;
  completion_percentage: number;
  grade: string;
  bonus_amount: number;
  is_approved: number;
}

export interface KpiOverview {
  month: string;
  totalEmployees: number;
  avgCompletion: number;
  totalBonus: number;
  totalTargetWater: number;
  totalActualWater: number;
  totalTargetDvgt: number;
  totalActualDvgt: number;
  totalTargetBottles: number;
  totalActualBottles: number;
}

export interface DashboardData {
  month: string;
  kpis: {
    revenueToday: number;
    revenueYesterday: number;
    revenueMonth: number;
    ordersMonth: number;
    bottlesMonth: number;
    bottlesVoi: number;
    bottlesUp: number;
    bottleDebtVoi: number;
    bottleDebtUp: number;
    totalDebt: number;
    pendingLoans: number;
    overdueLoans: number;
    alertCount: number;
  };
  revenueByDay: { date: string; revenue: number; orders: number }[];
  revenueByWarehouse: { name: string; revenue: number; bottles: number }[];
  productMix: { name: string; quantity: number; revenue: number }[];
  paymentStatus: { name: string; value: number }[];
  salesBySeller: { name: string; revenue: number }[];
  shipperPerformance: { name: string; trips: number; bottles: number; shipping_fee: number }[];
  bottleDebtByCustomer: { name: string; voi: number; up: number }[];
  stockLevels: { name: string; quantity: number; min_stock_alert: number }[];
  branchLoanAging: { code: string; partner: string; direction: string; due_date: string; status: string; outstanding: number }[];
  movementsSummary: { name: string; quantity: number }[];
  kpiByEmployee: { name: string; completion: number }[];
  cashFlow: { date: string; revenue: number; expense: number }[];
}

export interface FinanceSummary {
  month: string;
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  byType: { label: string; value: number }[];
  byCategory: { label: string; value: number }[];
}
