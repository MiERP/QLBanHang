-- ====================================================================
-- QAROMI ERP - HỆ THỐNG QUẢN LÝ BÁN HÀNG & ĐIỀU HÀNH DOANH NGHIỆP
-- Đơn vị: Xí Nghiệp Nước Hồng Gai - Công Ty CP Nước Sạch Quảng Ninh (QUAWANCO)
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. Trạm cấp nước trực thuộc
CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Danh mục nhân viên CBCNV
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER REFERENCES stations(id),
    org_unit_id INTEGER REFERENCES org_units(id),
    position_id INTEGER REFERENCES positions(id),
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    home_address TEXT,
    date_of_birth DATE,
    gender TEXT,
    id_number TEXT,
    join_date DATE,
    education TEXT,
    commission_rate REAL DEFAULT 0.0,
    shipping_allowance REAL DEFAULT 5000.0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Danh mục nhóm sản phẩm & dịch vụ
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('BOTTLE_WATER', 'PACK_WATER', 'SERVICE_DVGT')) NOT NULL
);

-- 5. Danh mục sản phẩm & dịch vụ
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id),
    code TEXT UNIQUE NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    product_type TEXT CHECK(product_type IN ('GOODS', 'SERVICE')) DEFAULT 'GOODS',
    bottle_type TEXT CHECK(bottle_type IN ('VOI', 'UP', 'NONE')) DEFAULT 'NONE',
    standard_price REAL NOT NULL,
    wholesale_price REAL NOT NULL,
    cost_price REAL DEFAULT 0.0,
    deposit_fee REAL DEFAULT 0.0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Nhóm khách hàng
CREATE TABLE IF NOT EXISTS customer_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

-- 8. Danh mục khách hàng
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER REFERENCES customer_groups(id),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tax_code TEXT,
    phone TEXT,
    address TEXT NOT NULL,
    contact_person TEXT,
    personal_id TEXT,
    budget_relation_code TEXT,
    max_debt_limit REAL DEFAULT 10000000.0,
    current_debt REAL DEFAULT 0.0,
    bottle_debt_voi INTEGER DEFAULT 0,
    bottle_debt_up INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Danh mục đa kho hàng
CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('CENTRAL', 'STORE', 'VEHICLE', 'STATION', 'VIRTUAL', 'CUSTOMER')) NOT NULL,
    manager_employee_id INTEGER REFERENCES employees(id),
    location TEXT,
    is_active INTEGER DEFAULT 1
);

-- 10. Tồn kho thời gian thực
CREATE TABLE IF NOT EXISTS inventory_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 20,
    avg_daily_sales REAL DEFAULT 5.0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id)
);

-- 11. Nhật ký biến động xuất - nhập - luân chuyển kho
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type TEXT CHECK(movement_type IN ('IMPORT', 'EXPORT_ORDER', 'TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_OUT', 'LOAN_IN', 'BORROW_IN', 'BORROW_OUT', 'RETURN_IN', 'ADJUSTMENT')) NOT NULL,
    source_warehouse_id INTEGER REFERENCES warehouses(id),
    target_warehouse_id INTEGER REFERENCES warehouses(id),
    source_id INTEGER REFERENCES import_sources(id),
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_promo INTEGER DEFAULT 0,
    reference_id TEXT,
    ticket_id INTEGER,
    performed_by INTEGER REFERENCES employees(id),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Đơn bán hàng
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    seller_employee_id INTEGER REFERENCES employees(id),
    order_type TEXT CHECK(order_type IN ('SALE', 'LEND_OUT', 'BORROW_IN', 'HIRED_LOAD')) DEFAULT 'SALE',
    partner_unit_id INTEGER,
    target_scope TEXT CHECK(target_scope IN ('COMPANY', 'ENTERPRISE')) DEFAULT 'ENTERPRISE',
    shipper_employee_id INTEGER REFERENCES employees(id),
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    order_date DATE NOT NULL,
    delivery_date DATE,
    order_status TEXT CHECK(order_status IN ('DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'RETURNED')) DEFAULT 'DRAFT',
    payment_status TEXT CHECK(payment_status IN ('UNPAID', 'PARTIAL', 'PAID')) DEFAULT 'UNPAID',
    payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'DEBT')) DEFAULT 'CASH',
    is_vat_invoice INTEGER DEFAULT 0,
    vat_rate REAL DEFAULT 0.0,
    vat_number TEXT,
    company_name_vat TEXT,
    tax_code_vat TEXT,
    address_vat TEXT,
    personal_id_vat TEXT,
    budget_relation_code_vat TEXT,
    subtotal_amount REAL NOT NULL,
    shipping_fee REAL DEFAULT 0.0,
    discount_amount REAL DEFAULT 0.0,
    deposit_amount REAL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0.0,
    shipping_receiver TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_note TEXT,
    shipping_fee_id INTEGER,
    returned_shells_voi INTEGER DEFAULT 0,
    returned_shells_up INTEGER DEFAULT 0,
    merged_into_id INTEGER,
    invoice_status TEXT CHECK(invoice_status IN ('NOT_INVOICED', 'INVOICED')) DEFAULT 'NOT_INVOICED',
    loan_settled_at DATETIME,
    loan_settle_type TEXT CHECK(loan_settle_type IN ('RETURN_GOODS', 'PAYMENT')),
    loan_due_date DATE,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Chi tiết sản phẩm đơn hàng
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_promo INTEGER DEFAULT 0,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    note TEXT
);

CREATE TRIGGER IF NOT EXISTS order_items_positive_insert BEFORE INSERT ON order_items
WHEN typeof(NEW.quantity) <> 'integer' OR NEW.quantity <= 0
  OR NEW.quantity_promo IS NULL OR typeof(NEW.quantity_promo) <> 'integer' OR NEW.quantity_promo < 0
BEGIN SELECT RAISE(ABORT, 'Số lượng đơn hàng không hợp lệ'); END;
CREATE TRIGGER IF NOT EXISTS order_items_positive_update BEFORE UPDATE ON order_items
WHEN typeof(NEW.quantity) <> 'integer' OR NEW.quantity <= 0
  OR NEW.quantity_promo IS NULL OR typeof(NEW.quantity_promo) <> 'integer' OR NEW.quantity_promo < 0
BEGIN SELECT RAISE(ABORT, 'Số lượng đơn hàng không hợp lệ'); END;

-- 17b. Người giao hàng trên từng đơn (nhiều shipper / đơn, chia phí vận chuyển)
CREATE TABLE IF NOT EXISTS order_shippers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) NOT NULL,
    allocated_fee REAL DEFAULT 0.0,
    kind TEXT DEFAULT 'DELIVERY',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. Bảng giao nhận điều phối vận chuyển
CREATE TABLE IF NOT EXISTS delivery_dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_code TEXT UNIQUE NOT NULL,
    order_id INTEGER REFERENCES orders(id) NOT NULL,
    shipper_employee_id INTEGER REFERENCES employees(id) NOT NULL,
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    shipping_fee REAL NOT NULL,
    stair_carrying_allowance REAL DEFAULT 0.0,
    status TEXT CHECK(status IN ('ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED')) DEFAULT 'ASSIGNED',
    dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    note TEXT
);

-- 20. Sổ theo dõi mượn / trả vỏ bình khách hàng (VB T9 / VB T8)
CREATE TABLE IF NOT EXISTS customer_bottle_ledgers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    transaction_date DATE NOT NULL,
    borrowed_voi INTEGER DEFAULT 0,
    borrowed_up INTEGER DEFAULT 0,
    returned_voi INTEGER DEFAULT 0,
    returned_up INTEGER DEFAULT 0,
    deposit_amount REAL DEFAULT 0.0,
    refund_deposit_amount REAL DEFAULT 0.0,
    remaining_balance_voi INTEGER NOT NULL,
    remaining_balance_up INTEGER NOT NULL,
    handled_by INTEGER REFERENCES employees(id),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 23. Sổ quỹ phiếu thu tiền
CREATE TABLE IF NOT EXISTS revenue_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_code TEXT UNIQUE NOT NULL,
    transaction_type TEXT CHECK(transaction_type IN ('WATER_SALE', 'BOTTLE_DEPOSIT', 'DEBT_COLLECTION', 'DVGT_SERVICE', 'BRANCH_OFFSET', 'OTHER', 'SALE_REFUND')) NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    customer_id INTEGER REFERENCES customers(id),
    amount REAL NOT NULL,
    payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')) NOT NULL,
    collected_by INTEGER REFERENCES employees(id),
    transaction_date DATE NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 24. Sổ quỹ phiếu chi chi phí hoạt động
CREATE TABLE IF NOT EXISTS expense_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_code TEXT UNIQUE NOT NULL,
    category TEXT CHECK(category IN ('ELECTRICITY', 'GASOLINE', 'CAPS_LABELS', 'MAINTENANCE', 'SALARY_COMMISSION', 'VEHICLE_REPAIR', 'RENTAL', 'OTHER')) NOT NULL,
    amount REAL NOT NULL,
    paid_to TEXT NOT NULL,
    paid_by INTEGER REFERENCES employees(id),
    station_id INTEGER REFERENCES stations(id),
    payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')) NOT NULL,
    expense_date DATE NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 26. Bảng giá theo sản phẩm / nhóm sản phẩm × nhóm khách hàng
CREATE TABLE IF NOT EXISTS price_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id),
    category_id INTEGER REFERENCES categories(id),
    customer_group_id INTEGER REFERENCES customer_groups(id),
    unit_price REAL NOT NULL,
    effective_date DATE,
    is_active INTEGER DEFAULT 1,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 27. Phí vận chuyển theo tuyến / khu vực giao
CREATE TABLE IF NOT EXISTS shipping_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    fee_per_trip REAL DEFAULT 0.0,
    fee_per_unit REAL DEFAULT 5000.0,
    min_fee REAL DEFAULT 0.0,
    is_active INTEGER DEFAULT 1,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 28. Chương trình khuyến mãi mua X tặng Y
CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    category_id INTEGER REFERENCES categories(id),
    buy_quantity INTEGER NOT NULL,
    free_quantity INTEGER NOT NULL,
    free_product_id INTEGER REFERENCES products(id),
    start_date DATE,
    end_date DATE,
    is_active INTEGER DEFAULT 1,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 29. Hóa đơn phát hành (1 đơn hàng = tối đa 1 hóa đơn)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_code TEXT UNIQUE NOT NULL,
    invoice_symbol TEXT,
    invoice_template TEXT,
    order_id INTEGER UNIQUE REFERENCES orders(id),
    customer_id INTEGER REFERENCES customers(id),
    invoice_date DATE NOT NULL,
    invoice_type TEXT CHECK(invoice_type IN ('VAT', 'RETAIL')) DEFAULT 'VAT',
    buyer_name TEXT,
    tax_code TEXT,
    address TEXT,
    personal_id TEXT,
    budget_relation_code TEXT,
    vat_rate REAL DEFAULT 0.0,
    tax_amount REAL DEFAULT 0.0,
    subtotal_amount REAL NOT NULL,
    discount_amount REAL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    issued_by INTEGER REFERENCES employees(id),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 30. Dòng tiền cọc vỏ bình (thu cọc / hoàn cọc)
CREATE TABLE IF NOT EXISTS deposit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_code TEXT UNIQUE NOT NULL,
    transaction_type TEXT CHECK(transaction_type IN ('COLLECT', 'REFUND')) NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    order_id INTEGER REFERENCES orders(id),
    amount REAL NOT NULL,
    payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')) DEFAULT 'CASH',
    handled_by INTEGER REFERENCES employees(id),
    transaction_date DATE NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 31. Đơn vị tổ chức (cây phân cấp do người dùng định nghĩa)
CREATE TABLE IF NOT EXISTS org_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES org_units(id),
    unit_type TEXT,
    manager_employee_id INTEGER REFERENCES employees(id),
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 32. Chức vụ (chức danh tổ chức)
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 34. Danh mục nguồn nhập kho
CREATE TABLE IF NOT EXISTS import_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 35. Danh mục đối tác liên kết (đơn vị bạn trong cùng công ty mẹ)
CREATE TABLE IF NOT EXISTS partner_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    is_active INTEGER DEFAULT 1,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 33. Chỉ tiêu doanh thu (áp cho nhân viên hoặc đơn vị)
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    scope_type TEXT CHECK(scope_type IN ('EMPLOYEE', 'UNIT')) NOT NULL,
    employee_id INTEGER REFERENCES employees(id),
    org_unit_id INTEGER REFERENCES org_units(id),
    target_revenue REAL DEFAULT 0.0,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 37. Phiếu nhập / xuất / điều chuyển kho (nguồn sự thật của mọi bút toán kho)
CREATE TABLE IF NOT EXISTS stock_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    ticket_type TEXT CHECK(ticket_type IN ('IN', 'OUT', 'TRANSFER')) NOT NULL,
    ticket_date DATE NOT NULL,
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    target_warehouse_id INTEGER REFERENCES warehouses(id),
    partner_unit_id INTEGER REFERENCES partner_units(id),
    source_id INTEGER REFERENCES import_sources(id),
    order_id INTEGER REFERENCES orders(id),
    reason TEXT NOT NULL,
    status TEXT CHECK(status IN ('DRAFT', 'CHECKING', 'CONFIRMED')) DEFAULT 'DRAFT',
    check_note TEXT,
    vehicle TEXT,
    in_charge_employee_id INTEGER REFERENCES employees(id),
    note TEXT,
    created_by INTEGER REFERENCES employees(id),
    auto INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_ticket_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES stock_tickets(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    order_item_id INTEGER REFERENCES order_items(id),
    quantity INTEGER NOT NULL,
    quantity_promo INTEGER DEFAULT 0,
    quality TEXT CHECK(quality IN ('OK', 'NG')),
    note TEXT
);

CREATE TRIGGER IF NOT EXISTS stock_ticket_items_positive_insert BEFORE INSERT ON stock_ticket_items
WHEN typeof(NEW.quantity) <> 'integer' OR NEW.quantity < 0
  OR NEW.quantity_promo IS NULL OR typeof(NEW.quantity_promo) <> 'integer' OR NEW.quantity_promo < 0
  OR NEW.quantity + NEW.quantity_promo <= 0
BEGIN SELECT RAISE(ABORT, 'Số lượng phiếu kho không hợp lệ'); END;
CREATE TRIGGER IF NOT EXISTS stock_ticket_items_positive_update BEFORE UPDATE ON stock_ticket_items
WHEN typeof(NEW.quantity) <> 'integer' OR NEW.quantity < 0
  OR NEW.quantity_promo IS NULL OR typeof(NEW.quantity_promo) <> 'integer' OR NEW.quantity_promo < 0
  OR NEW.quantity + NEW.quantity_promo <= 0
BEGIN SELECT RAISE(ABORT, 'Số lượng phiếu kho không hợp lệ'); END;

CREATE INDEX IF NOT EXISTS idx_stock_tickets_order ON stock_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_ticket_items_ticket ON stock_ticket_items(ticket_id);

-- 36. Lưu vết gộp đơn: đơn gộp được tạo từ những đơn nào
CREATE TABLE IF NOT EXISTS order_merge_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_order_id INTEGER REFERENCES orders(id) NOT NULL,
    source_order_id INTEGER REFERENCES orders(id) NOT NULL,
    source_code TEXT NOT NULL,
    source_total REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 37. Danh mục thuế suất GTGT theo thời hiệu (dữ liệu, không hard-code).
-- Giá bán đã gồm VAT → doanh thu trước thuế suy ngược: đơn giá / (1 + rate%).
CREATE TABLE IF NOT EXISTS vat_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    effective_from DATE,
    effective_to DATE,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 38. Phiếu dịch vụ gia tăng (bình nóng lạnh, bể téc, máy giặt...) — cơ sở tính lương theo nhân viên.
CREATE TABLE IF NOT EXISTS service_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    service_date DATE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    employee_id INTEGER REFERENCES employees(id),
    product_id INTEGER REFERENCES products(id),
    quantity REAL DEFAULT 1,
    amount REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 39. Đánh dấu đã xem thông báo/cảnh báo ở chuông (chấm màu tắt, số trên chuông giảm).
-- Khi cảnh báo hết (không còn trong danh sách), dòng tương ứng được dọn để lần sau lại báo mới.
CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id TEXT PRIMARY KEY,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 40. Nhật ký hệ thống: mọi thao tác ghi dữ liệu đều để lại một dòng, kèm bản ghi trước/sau.
-- actor để trống vì phần mềm chưa có đăng nhập; khi có tài khoản chỉ cần điền vào cột này.
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    entity_code TEXT,
    description TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);

-- 41. Quyết toán đơn mượn/cho mượn theo từng lần (trả hàng, trả tiền) — một đơn có thể nhiều lần.
CREATE TABLE IF NOT EXISTS loan_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    settle_type TEXT CHECK(settle_type IN ('RETURN_GOODS', 'PAYMENT')) NOT NULL,
    settle_date DATE NOT NULL,
    warehouse_id INTEGER REFERENCES warehouses(id),
    ticket_id INTEGER,
    settled_value REAL DEFAULT 0.0,
    amount REAL DEFAULT 0.0,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_settlement_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_id INTEGER REFERENCES loan_settlements(id) ON DELETE CASCADE NOT NULL,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loan_settlements_order ON loan_settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_loan_settlement_items_settlement ON loan_settlement_items(settlement_id);

-- 42. Ghi nhận hàng hoàn của khách: đơn chuyển sang trạng thái Hàng hoàn kèm số lượng hoàn,
-- vỏ thu hồi và tiền hoàn cọc. Giữ id các bút toán đã sinh để hoàn tác khi sửa lại số lượng hoàn.
CREATE TABLE IF NOT EXISTS order_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    return_date DATE NOT NULL,
    ticket_id INTEGER,
    shells_voi INTEGER DEFAULT 0,
    shells_up INTEGER DEFAULT 0,
    deposit_refund REAL DEFAULT 0.0,
    returned_amount REAL NOT NULL DEFAULT 0,
    refund_amount REAL NOT NULL DEFAULT 0,
    refund_transaction_id INTEGER,
    deposit_transaction_id INTEGER,
    bottle_ledger_id INTEGER,
    pickup_type TEXT DEFAULT 'CUSTOMER_BRING',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_returns_order ON order_returns(order_id);

-- 43. Phí cọc vỏ bình theo LOẠI VỎ (Vòi / Úp) — một nguồn duy nhất cho cả thu cọc lẫn hoàn cọc.
-- Một vỏ bình chỉ có một mức cọc, không phụ thuộc sản phẩm nước đóng trong bình đó.
CREATE TABLE IF NOT EXISTS shell_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bottle_type TEXT UNIQUE NOT NULL,
    deposit_fee REAL DEFAULT 0.0,
    note TEXT
);

-- 44. Vỏ bình xí nghiệp đang giữ — MỘT pool theo loại vỏ, KHÔNG gắn với kho.
-- Vỏ gắn với sản phẩm (products.bottle_type): bán bình nước là cho khách mượn luôn vỏ, khách trả lại
-- khi không dùng nữa. Vỏ vì vậy chỉ có hai nơi: khách đang giữ (customers.bottle_debt_*) hoặc xí nghiệp.
CREATE TABLE IF NOT EXISTS shell_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bottle_type TEXT UNIQUE NOT NULL,
    quantity INTEGER DEFAULT 0
);

-- 45. Sổ vỏ: mọi lần vỏ vào/ra đều để lại một dòng (kể cả bút toán tự sinh từ đơn hàng).
CREATE TABLE IF NOT EXISTS shell_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type TEXT NOT NULL,
    bottle_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    order_id INTEGER REFERENCES orders(id),
    ticket_id INTEGER,
    performed_by INTEGER REFERENCES employees(id),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 46. Sổ vỏ với đối tác liên kết: dương = đối tác nhận vỏ của mình, âm = đối tác trả lại.
CREATE TABLE IF NOT EXISTS partner_shell_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_unit_id INTEGER REFERENCES partner_units(id) NOT NULL,
    bottle_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 47. Cấu hình hệ thống dạng khoá = giá trị: các quy tắc nghiệp vụ bật/tắt được (xem Danh mục hệ thống).
-- Danh mục khoá, mặc định và giải thích nằm ở apps/api/src/lib/appSettings.ts — bảng chỉ giữ giá trị đang dùng.
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shell_movements_type ON shell_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_partner_shell_movements_partner ON partner_shell_movements(partner_unit_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipper ON orders(shipper_employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_bottle_customer ON customer_bottle_ledgers(customer_id);
