export interface Product {
  id: number;
  category_id: number;
  code: string;
  barcode?: string;
  name: string;
  unit: string;
  product_type?: 'GOODS' | 'SERVICE';
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
  personal_id?: string;
  budget_relation_code?: string;
  bottle_debt_voi: number;
  bottle_debt_up: number;
  current_debt: number;
  max_debt_limit: number;
  /** Nợ đầu kỳ (current_debt) + phần chưa thu của các đơn đã hoàn thành — xem thêm màn Công nợ khách hàng. */
  order_debt?: number;
  total_debt?: number;
  group_name?: string;
  /** Số dư cọc vỏ đang giữ (đã thu − đã hoàn) và giá trị vỏ khách đang giữ theo phí cọc hiện hành. */
  deposit_balance?: number;
  shell_value?: number;
  shell_deposit_diff?: number;
}

export interface PartnerShellHolding {
  partner_unit_id: number;
  partner_unit_name: string;
  voi: number;
  up: number;
}

export interface ShellStockReport {
  stock: { voi: number; up: number; total: number };
  customer: { voi: number; up: number };
  partners: PartnerShellHolding[];
  totals: {
    stock_voi: number;
    stock_up: number;
    customer_voi: number;
    customer_up: number;
    partner_voi: number;
    partner_up: number;
    all_voi: number;
    all_up: number;
  };
}

export interface ShellMovement {
  id: number;
  movement_type: string;
  bottle_type: 'VOI' | 'UP';
  quantity: number;
  customer_id?: number | null;
  customer_name?: string | null;
  order_id?: number | null;
  order_code?: string | null;
  performed_by?: number | null;
  performed_by_name?: string | null;
  note?: string | null;
  created_at: string;
}

export interface ShellDeposit {
  id: number;
  bottle_type: 'VOI' | 'UP';
  deposit_fee: number;
  note?: string | null;
}

export interface ShellDepositReportRow {
  customer_id: number;
  code: string;
  name: string;
  debt_voi: number;
  debt_up: number;
  pending_voi: number;
  pending_up: number;
  shell_value: number;
  collected: number;
  refunded: number;
  balance: number;
  diff: number;
  collected_month: number;
  refunded_month: number;
  pending_deposit: number;
}

export interface ShellOrderRow {
  order_id: number;
  order_code: string;
  order_date: string;
  customer_id: number;
  customer_code: string;
  customer_name: string;
  voi: number;
  up: number;
  deposit: number;
  returned_voi: number;
  returned_up: number;
  debt_voi: number;
  debt_up: number;
}

export interface ShellCustomerRow {
  customer_id: number;
  code: string;
  name: string;
  debt_voi: number;
  debt_up: number;
  deposit_balance: number;
  period_voi: number;
  period_up: number;
  period_deposit: number;
  order_count: number;
}

export interface ShellOrdersReport {
  scope: 'all' | 'period';
  from: string;
  to: string;
  feeVoi: number;
  feeUp: number;
  rows: ShellOrderRow[];
  totals: { voi: number; up: number; deposit: number; returned_voi: number; returned_up: number };
  held: { debt_voi: number; debt_up: number; deposit_balance: number };
  customers: ShellCustomerRow[];
}

export interface ShellDepositReport {
  from: string;
  to: string;
  feeVoi: number;
  feeUp: number;
  rows: ShellDepositReportRow[];
  totals: {
    debt_voi: number;
    debt_up: number;
    pending_voi: number;
    pending_up: number;
    pending_deposit: number;
    shell_value: number;
    collected: number;
    refunded: number;
    balance: number;
    diff: number;
    collected_month: number;
    refunded_month: number;
    mismatch_count: number;
  };
}

export interface CustomerGroup {
  id: number;
  code: string;
  name: string;
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
  returned_quantity?: number;
  returned_promo?: number;
  returned_value?: number;
}

export interface OrderReturnInfo {
  id: number;
  return_date: string;
  ticket_id: number | null;
  ticket_code?: string | null;
  shells_voi: number;
  shells_up: number;
  deposit_refund: number;
  returned_amount: number;
  refund_amount: number;
  refund_payment_method?: 'CASH' | 'BANK_TRANSFER' | null;
  return_warehouse_id?: number | null;
  return_warehouse_name?: string | null;
  pickup_type: string;
  note: string | null;
}

export interface OrderShipper {
  id?: number;
  order_id?: number;
  employee_id: number;
  shipper_name?: string;
  allocated_fee: number;
}

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';

/** Chỉ tiêu đơn được tính vào: của Công ty hay của Xí nghiệp. */
export type TargetScope = 'COMPANY' | 'ENTERPRISE';

export interface Order {
  id: number;
  order_code: string;
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  seller_employee_id: number | null;
  seller_name?: string | null;
  order_type?: OrderType;
  partner_unit_id?: number | null;
  partner_unit_name?: string | null;
  support_station_id?: number | null;
  support_station_name?: string | null;
  target_scope?: TargetScope;
  loan_settled_at?: string | null;
  loan_settle_type?: 'RETURN_GOODS' | 'PAYMENT' | null;
  loan_due_date?: string | null;
  shipper_employee_id?: number;
  shipper_name?: string;
  warehouse_id: number;
  warehouse_name: string;
  order_date: string;
  delivery_date?: string;
  order_status: OrderStatus;
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payment_method: string;
  is_vat_invoice: number;
  vat_rate?: number;
  vat_number?: string;
  company_name_vat?: string;
  tax_code_vat?: string;
  address_vat?: string;
  personal_id_vat?: string;
  budget_relation_code_vat?: string;
  subtotal_amount: number;
  shipping_fee: number;
  discount_amount?: number;
  deposit_amount?: number;
  /** Số tiền cọc vỏ người dùng nhập tay; null/rỗng = tự tính theo số bình × phí cọc. */
  deposit_override?: number | null;
  total_amount: number;
  paid_amount: number;
  shipping_receiver?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_note?: string;
  shipping_fee_id?: number | null;
  returned_shells_voi?: number;
  returned_shells_up?: number;
  merged_into_id?: number | null;
  merged_into_code?: string | null;
  merged_from?: { id: number; order_code: string }[];
  invoice_status?: 'NOT_INVOICED' | 'INVOICED';
  note?: string;
  items?: OrderItem[];
  shippers?: OrderShipper[];
  return_collectors?: { id: number; employee_id: number; allocated_fee: number; employee_name?: string }[];
  return_info?: OrderReturnInfo | null;
  return_history?: OrderReturnInfo[];
  returned_value?: number;
  /** Số tiền còn phải thu sau khi trừ tiền đã thu và hoàn tiền. */
  outstanding_amount?: number;
}

export interface Invoice {
  id: number;
  invoice_code: string;
  invoice_symbol?: string;
  invoice_template?: string;
  order_id: number;
  order_code?: string;
  order_date?: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  invoice_date: string;
  invoice_type: 'VAT' | 'RETAIL';
  buyer_name?: string;
  tax_code?: string;
  address?: string;
  personal_id?: string;
  budget_relation_code?: string;
  vat_rate: number;
  tax_amount: number;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  issued_by?: number | null;
  issued_by_name?: string;
  note?: string;
}

// Dòng sản phẩm trong danh sách hóa đơn theo đơn.
export interface InvoiceOrderProduct {
  name: string;
  quantity: number;
}

// Một đơn hàng (đã hoàn tất) trong danh sách hóa đơn đã xuất / chưa xuất.
export interface InvoiceOrderRow {
  order_id: number;
  order_code: string;
  completed_date: string;
  customer_name: string;
  contact_person: string;
  phone: string;
  address: string;
  products: InvoiceOrderProduct[];
  total_quantity: number;
  total_amount: number;
}

export interface Employee {
  id: number;
  code: string;
  full_name: string;
  position?: string;
  phone?: string;
  home_address?: string;
  station_id?: number;
  station_name?: string;
  org_unit_id?: number | null;
  org_unit_name?: string;
  position_id?: number | null;
  position_name?: string;
  date_of_birth?: string;
  gender?: string;
  id_number?: string;
  join_date?: string;
  education?: string;
  commission_rate?: number;
  shipping_allowance?: number;
}

export interface OrgUnit {
  id: number;
  code: string;
  name: string;
  parent_id?: number | null;
  unit_type?: string;
  manager_employee_id?: number | null;
  manager_name?: string;
  parent_name?: string;
  sort_order?: number;
  is_active?: number;
}

export interface Position {
  id: number;
  code: string;
  name: string;
  note?: string;
  is_active?: number;
}

export interface PriceListEntry {
  id: number;
  product_id?: number | null;
  category_id?: number | null;
  customer_group_id?: number | null;
  unit_price: number;
  effective_date?: string;
  is_active?: number;
  note?: string;
  product_name?: string;
  category_name?: string;
  customer_group_name?: string;
}

export interface ShippingFee {
  id: number;
  code: string;
  name: string;
  fee_per_unit: number;
  is_active: number;
  note?: string;
}

export interface Promotion {
  id: number;
  code: string;
  name: string;
  product_id?: number | null;
  category_id?: number | null;
  buy_quantity: number;
  free_quantity: number;
  free_product_id?: number | null;
  start_date?: string;
  end_date?: string;
  is_active: number;
  note?: string;
  product_name?: string;
  category_name?: string;
  free_product_name?: string;
}

export interface StockTicketItem {
  id: number;
  ticket_id: number;
  product_id: number;
  product_name?: string;
  unit?: string;
  quantity: number;
  quantity_promo?: number;
  quality?: 'OK' | 'NG' | null;
  note?: string;
}

export interface StockTicket {
  id: number;
  code: string;
  ticket_type: 'IN' | 'OUT' | 'TRANSFER';
  ticket_date: string;
  warehouse_id: number;
  warehouse_name?: string;
  target_warehouse_id?: number | null;
  target_warehouse_name?: string | null;
  partner_unit_id?: number | null;
  partner_unit_name?: string | null;
  source_id?: number | null;
  source_name?: string | null;
  order_id?: number | null;
  order_code?: string | null;
  order_status?: string | null;
  customer_name?: string | null;
  reason: string;
  status: 'DRAFT' | 'CHECKING' | 'CONFIRMED';
  check_note?: string | null;
  vehicle?: string | null;
  in_charge_employee_id?: number | null;
  in_charge_name?: string | null;
  note?: string;
  created_by?: number | null;
  created_by_name?: string | null;
  auto: number;
  created_at: string;
  items?: StockTicketItem[];
}

export interface ImportSource {
  id: number;
  code: string;
  name: string;
  note?: string;
  is_active?: number;
}

export interface RevenueTransaction {
  id: number;
  transaction_code: string;
  transaction_type: string;
  order_id?: number;
  order_code?: string;
  customer_id?: number;
  customer_name?: string;
  amount: number;
  payment_method: string;
  collected_by?: number;
  collected_by_name?: string;
  transaction_date: string;
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

export interface PartnerUnit {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  is_active: number;
  note?: string;
}

export type OrderType = 'SALE' | 'LEND_OUT' | 'BORROW_IN' | 'HIRED_LOAD';

export interface LoanSettlement {
  id: number;
  settle_type: 'RETURN_GOODS' | 'PAYMENT';
  settle_date: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  ticket_id: number | null;
  ticket_code: string | null;
  settled_value: number;
  amount: number;
  note: string | null;
  items?: { product_id: number; product_name: string; quantity: number }[];
}

export interface LoanLine {
  product_id: number;
  product_name: string;
  unit: string | null;
  quantity: number;
  returned: number;
  remaining: number;
  unit_price: number;
}

export interface LoanRow {
  order_id: number;
  order_code: string;
  order_date: string;
  order_status: OrderStatus;
  subtotal_amount: number;
  shipping_fee: number;
  total_amount: number;
  loan_settled_at?: string | null;
  loan_settle_type?: 'RETURN_GOODS' | 'PAYMENT' | null;
  loan_status: 'PENDING' | 'OUTSTANDING' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';
  loan_direction: 'LEND_OUT' | 'BORROW_IN';
  loan_label?: string;
  loan_due_date?: string | null;
  overdue_days?: number;
  goods_value?: number;
  settled_value?: number;
  outstanding_value?: number;
  partner_unit_id?: number | null;
  partner_unit_code?: string | null;
  partner_unit_name?: string | null;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  seller_name?: string | null;
  shipper_name?: string | null;
  warehouse_name?: string;
  note?: string;
  items?: LoanLine[];
  settlements?: LoanSettlement[];
}

export interface DashboardData {
  from: string;
  to: string;
  label: string;
  kpis: {
    revenueToday: number;
    revenueYesterday: number;
    revenueMonth: number;
    revenueYear: number;
    debtToday: number;
    debtMonth: number;
    debtYear: number;
    warehouseCount: number;
    revenueReturnedMonth: number;
    revenueNetMonth: number;
    ordersMonth: number;
    bottlesMonth: number;
    bottlesVoi: number;
    bottlesUp: number;
    bottleDebtVoi: number;
    bottleDebtUp: number;
    totalDebt: number;
    alertCount: number;
  };
  revenueByDay: { date: string; revenue: number; orders: number }[];
  revenueByScope: { scope: 'COMPANY' | 'ENTERPRISE'; revenue: number }[];
  stockByWarehouse: {
    warehouse_id: number;
    code: string;
    name: string;
    items: { product_id: number; product_name: string; unit: string; quantity: number }[];
  }[];
  revenueByWarehouse: { name: string; revenue: number; bottles: number }[];
  productMix: { name: string; quantity: number; revenue: number }[];
  paymentStatus: { name: string; value: number }[];
  salesBySeller: { name: string; revenue: number }[];
  shipperPerformance: { name: string; trips: number; bottles: number; shipping_fee: number }[];
  bottleDebtByCustomer: { name: string; voi: number; up: number }[];
  stockLevels: { name: string; quantity: number; min_stock_alert: number }[];
  movementsSummary: { name: string; quantity: number }[];
  kpiByEmployee: { name: string; completion: number }[];
  cashFlow: { date: string; revenue: number; expense: number }[];
}

export interface RevenueDetailGroupRow {
  key: string | number;
  name: string;
  group_type?: string | null;
  parent_key?: number | null;
  orders: number;
  quantity: number;
  promo: number;
  revenue: number;
  returned: number;
  net: number;
  children?: RevenueDetailGroupRow[];
}

export interface RevenueDetailReport {
  from: string | null;
  to: string | null;
  group: string;
  label: string;
  rows: RevenueDetailGroupRow[];
  totals: { orders: number; quantity: number; promo: number; revenue: number; returned: number; net: number };
}

export interface RevenueBorrowedRow {
  id: number;
  order_code: string;
  order_date: string;
  order_status: string;
  subtotal_amount: number;
  paid_amount: number;
  payment_status: string;
  partner_unit_id: number | null;
  partner_name: string | null;
  partner_phone: string | null;
  warehouse_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  seller_name: string | null;
  loan_status: string;
  due_date: string | null;
  overdue_days: number;
  goods_value: number;
  settled_value: number;
  outstanding_value: number;
  items: { product_name: string; unit: string | null; quantity: number; quantity_promo: number; unit_price: number; total_price: number }[];
}

export interface RevenueBorrowedReport {
  from: string | null;
  to: string | null;
  rows: RevenueBorrowedRow[];
  byPartner: {
    name: string;
    partner_id: number | null;
    orders: number;
    quantity: number;
    revenue: number;
    settled_value: number;
    outstanding_value: number;
    loan_orders: number;
    overdue_orders: number;
  }[];
  totals: { orders: number; quantity: number; revenue: number; settled_value: number; outstanding_value: number; overdue_orders: number };
}

export interface RevenueGrossBlock {
  key: string;
  name: string;
  owner: string;
  orders: number;
  value: number;
  returned: number;
  net: number;
  byGroup: { name: string; orders: number; value: number }[];
}

export interface RevenueGrossReport {
  from: string | null;
  to: string | null;
  blocks: RevenueGrossBlock[];
  total: number;
  shippingCollected: number;
  serviceFee: { orders: number; value: number; collected: number };
  // Hàng cho đối tác mượn: công nợ phải thu, không phải doanh thu (chỉ giảm khi đối tác trả hàng).
  lent: {
    orders: number;
    value: number;
    returned: number;
    byGroup: { name: string; orders: number; value: number }[];
  };
}

export interface CustomerDebtOrderRow {
  order_id: number;
  order_code: string;
  order_date: string;
  order_status: string;
  order_type: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  payment_status: string;
  payment_method: string;
  invoice_status: string;
}

export interface CustomerDebtRow {
  customer_id: number;
  code: string;
  name: string;
  phone: string | null;
  max_debt_limit: number;
  opening_debt: number;
  order_debt: number;
  total_debt: number;
  orders: CustomerDebtOrderRow[];
}

// Công nợ phải thu của khách hàng — luỹ kế, chỉ gồm khách còn nợ.
export interface CustomerDebtReport {
  byCustomer: CustomerDebtRow[];
  totals: {
    customers: number;
    orders: number;
    opening_debt: number;
    order_debt: number;
    total_debt: number;
    over_limit_customers: number;
    over_limit_amount: number;
  };
}

export interface ExpenseOrderRow {
  order_id: number;
  order_code: string;
  order_date: string;
  order_status: string;
  customer_name: string;
  employee_name: string | null;
  unit_name: string | null;
  fee: number;
}

export interface ExpenseReport {
  totalShipping: number;
  orderCount: number;
  byEmployee: { name: string; trips: number; shipping_fee: number }[];
  byUnit: { name: string; trips: number; shipping_fee: number }[];
  byDay: { date: string; trips: number; shipping_fee: number }[];
  byMonth: { month: string; trips: number; shipping_fee: number }[];
  rows: ExpenseOrderRow[];
}

export interface VatRate {
  id: number;
  code: string;
  name: string;
  rate: number;
  effective_from?: string | null;
  effective_to?: string | null;
  note?: string | null;
}

export interface TradeReportItem {
  key: string;
  label: string;
  quantity: number;
  unit_price: number;
  net_unit_price: number;
  amount_gross: number;
  amount_net: number;
  tax_amount: number;
}

export interface TradeReportBlock {
  items: TradeReportItem[];
  totals: { quantity: number; amount_gross: number; amount_net: number; tax_amount: number };
}

/** Nguồn khách của đơn bán: xí nghiệp tự khai thác hay khách do Công ty đưa sang. */
export interface TradeReportSource {
  key: 'ENTERPRISE' | 'COMPANY';
  label: string;
  block: TradeReportBlock;
}

export interface TradeReport {
  from: string;
  to: string;
  label: string;
  vatRate: number;
  current: TradeReportBlock;
  cumulative: TradeReportBlock;
  sources: { current: TradeReportSource[]; cumulative: TradeReportSource[] };
}

export interface StockAuditRow {
  product_id: number;
  code: string;
  name: string;
  unit: string;
  opening: number;
  in_total: number;
  out_sale: number;
  out_promo: number;
  out_other: number;
  return_in: number;
  adjust: number;
  closing: number;
  stock_now: number;
  stock_at_to: number;
  diff: number;
}

export interface StockAuditReport {
  warehouse_id: number;
  from: string;
  to: string;
  rows: StockAuditRow[];
  totals: {
    opening: number;
    in_total: number;
    out_sale: number;
    out_promo: number;
    out_other: number;
    return_in: number;
    adjust: number;
    closing: number;
    stock_now: number;
    diff: number;
  };
}

// Đối chiếu vỏ bình: vỏ xí nghiệp đang giữ ↔ nợ vỏ khách ↔ sổ vỏ khách.
// Vỏ gắn với sản phẩm (loại Vòi / Úp), không gắn với kho.
export interface ShellAuditStockRow {
  bottle_type: 'VOI' | 'UP';
  opening: number;
  period_in: number;
  period_out: number;
  closing: number;
  stock_now: number;
  stock_at_to: number;
  diff: number;
}

export interface ShellAuditCustomerRow {
  customer_id: number;
  code: string;
  name: string;
  debt_voi: number;
  debt_up: number;
  ledger_voi: number;
  ledger_up: number;
  diff_voi: number;
  diff_up: number;
}

export interface ShellAuditOrderRow {
  order_id: number;
  order_code: string;
  order_date: string;
  order_type: string;
  order_status: string;
  debt_voi: number;
  debt_up: number;
  out_voi: number;
  out_up: number;
  diff_voi: number;
  diff_up: number;
}

export interface ShellAuditReport {
  from: string;
  to: string;
  stock_rows: ShellAuditStockRow[];
  customer_rows: ShellAuditCustomerRow[];
  order_rows: ShellAuditOrderRow[];
  partners: { partner_unit_id: number; partner_unit_name: string; voi: number; up: number }[];
  totals: {
    opening: number;
    period_in: number;
    period_out: number;
    closing: number;
    stock_now: number;
    diff: number;
    negative_types: number;
    customer_voi: number;
    customer_up: number;
    customer_diff: number;
    customer_mismatch: number;
    partner_total: number;
    order_mismatch: number;
  };
}

// Đối chiếu tiền: số đã thu trên đơn ↔ sổ quỹ (phiếu thu) ↔ cọc vỏ.
export interface CashAuditOrderRow {
  order_id: number;
  order_code: string;
  order_date: string;
  order_type: string;
  order_status: string;
  payment_method: string;
  payment_status: string;
  subtotal_amount: number;
  shipping_fee: number;
  deposit_amount: number;
  total_amount: number;
  paid_amount: number;
  customer_id: number;
  customer_code: string;
  customer_name: string;
  ledger_revenue: number;
  deposit_collect: number;
  deposit_refund: number;
  expected_revenue: number;
  revenue_diff: number;
  collectible: number;
  receivable: number;
  deposit_balance: number;
  deposit_diff: number;
  issues: string[];
}

export interface CashAuditCustomerRow {
  customer_id: number;
  code: string;
  name: string;
  orders: number;
  order_total: number;
  paid_total: number;
  ledger_total: number;
  receivable: number;
  deposit_balance: number;
  opening_debt: number;
  revenue_diff: number;
  total_debt: number;
}

export interface CashAuditPartnerRow {
  partner_unit_id: number;
  name: string;
  orders: number;
  fee_total: number;
  paid_total: number;
  receivable: number;
}

export interface CashAuditReport {
  from: string;
  to: string;
  customer_id: number;
  rows: CashAuditOrderRow[];
  customer_rows: CashAuditCustomerRow[];
  partner_rows: CashAuditPartnerRow[];
  totals: {
    orders: number;
    order_total: number;
    paid_total: number;
    ledger_total: number;
    revenue_diff: number;
    receivable: number;
    deposit_expected: number;
    deposit_collect: number;
    deposit_refund: number;
    mismatch_orders: number;
    issue_orders: number;
    issue_count: number;
  };
}

export interface DepositTransaction {
  id: number;
  transaction_code: string;
  transaction_type: 'COLLECT' | 'REFUND';
  customer_id?: number;
  order_id?: number;
  order_code?: string;
  customer_name?: string;
  amount: number;
  payment_method: string;
  handled_by?: number;
  handled_by_name?: string;
  transaction_date: string;
  note?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  severity: 'high' | 'medium';
  title: string;
  message: string;
  tab: string;
  target?: Record<string, unknown>;
  read: boolean;
}

export interface NotificationsResponse {
  count: number;
  items: AppNotification[];
}

export interface ServiceJob {
  id: number;
  code: string;
  service_date: string;
  customer_id?: number | null;
  customer_name?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  product_id?: number | null;
  product_name?: string | null;
  unit?: string | null;
  quantity?: number | null;
  amount: number;
  note?: string | null;
}

export interface PayrollItem {
  id: number;
  code: string;
  date: string;
  customer_name: string;
  note: string;
  amount: number;
}

export interface PayrollDetailRow {
  employee_id: number | null;
  name: string;
  unit_name: string | null;
  count: number;
  amount: number;
  items: PayrollItem[];
}

export interface PayrollReport {
  from: string;
  to: string;
  year: string;
  detail: PayrollDetailRow[];
  summary: {
    year: string;
    rows: { employee_id: number | null; name: string; unit_name: string | null; totals: number[]; total: number }[];
  };
}

export interface TargetBoardRow {
  scope_type: 'EMPLOYEE' | 'UNIT';
  employee_id?: number | null;
  org_unit_id?: number | null;
  name: string;
  org_unit_name?: string | null;
  target_id?: number | null;
  target_revenue: number;
  actual_revenue: number;
  completion_percentage: number;
  grade: string;
}

export interface TargetBoard {
  employees: TargetBoardRow[];
  units: TargetBoardRow[];
}

export interface AuditLog {
  id: number;
  occurred_at: string;
  actor?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  entity_code?: string | null;
  description: string;
  method: string;
  path: string;
}

export interface AuditLogResponse {
  rows: AuditLog[];
  entities: string[];
}

// Cấu hình hệ thống (khoá → giá trị). Danh mục khoá nằm ở apps/api/src/lib/appSettings.ts.
export type AppSettings = Record<string, string>;

// Kỳ báo cáo hiện tại đã phân giải ở backend (từ ngày → đến ngày).
export interface ReportPeriod {
  from: string;
  to: string;
  label: string;
  key: string;
}
