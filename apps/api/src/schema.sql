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

-- 2. Phân quyền vai trò người dùng
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT
);

-- 3. Danh mục nhân viên CBCNV
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER REFERENCES stations(id),
    role_id INTEGER REFERENCES roles(id),
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    home_address TEXT,
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
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    bottle_type TEXT CHECK(bottle_type IN ('VOI', 'UP', 'NONE')) DEFAULT 'NONE',
    standard_price REAL NOT NULL,
    wholesale_price REAL NOT NULL,
    cost_price REAL DEFAULT 0.0,
    deposit_fee REAL DEFAULT 0.0,
    has_shell_cycle INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng quy cách quy đổi (Chai <-> Vỉ <-> Hộp/Thùng)
CREATE TABLE IF NOT EXISTS product_conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_product_id INTEGER REFERENCES products(id),
    to_product_id INTEGER REFERENCES products(id),
    ratio REAL NOT NULL,
    note TEXT
);

-- 7. Nhóm khách hàng
CREATE TABLE IF NOT EXISTS customer_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    discount_percent REAL DEFAULT 0.0
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
    type TEXT CHECK(type IN ('CENTRAL', 'STORE', 'VEHICLE', 'SHELL_STORAGE', 'STATION')) NOT NULL,
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
    movement_type TEXT CHECK(movement_type IN ('IMPORT', 'EXPORT_ORDER', 'TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_OUT', 'LOAN_IN', 'ADJUSTMENT')) NOT NULL,
    source_warehouse_id INTEGER REFERENCES warehouses(id),
    target_warehouse_id INTEGER REFERENCES warehouses(id),
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_promo INTEGER DEFAULT 0,
    reference_id TEXT,
    performed_by INTEGER REFERENCES employees(id),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Danh mục chi nhánh liên kết trong Tổng Công ty
CREATE TABLE IF NOT EXISTS partner_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_internal INTEGER DEFAULT 1
);

-- 13. Phiếu vay mượn hàng liên chi nhánh
CREATE TABLE IF NOT EXISTS branch_loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_code TEXT UNIQUE NOT NULL,
    loan_direction TEXT CHECK(loan_direction IN ('GIVE_LOAN', 'TAKE_LOAN')) NOT NULL,
    partner_branch_id INTEGER REFERENCES partner_branches(id) NOT NULL,
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    carrier_employee_id INTEGER REFERENCES employees(id),
    status TEXT CHECK(status IN ('PENDING', 'PARTIAL_RETURN', 'SETTLED', 'OVERDUE')) DEFAULT 'PENDING',
    loan_date DATE NOT NULL,
    due_date DATE NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Chi tiết sản phẩm vay mượn liên chi nhánh
CREATE TABLE IF NOT EXISTS branch_loan_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_loan_id INTEGER REFERENCES branch_loans(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity_loaned INTEGER NOT NULL,
    quantity_returned INTEGER DEFAULT 0
);

-- 15. Đối soát hoàn trả vay mượn liên chi nhánh
CREATE TABLE IF NOT EXISTS branch_loan_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_loan_id INTEGER REFERENCES branch_loans(id),
    return_type TEXT CHECK(return_type IN ('PRODUCT_RETURN', 'CASH_SETTLEMENT', 'DEBT_OFFSET')) NOT NULL,
    product_id INTEGER REFERENCES products(id),
    quantity_returned INTEGER,
    amount_settled REAL DEFAULT 0.0,
    settled_by INTEGER REFERENCES employees(id),
    settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

-- 16. Đơn bán hàng
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    seller_employee_id INTEGER REFERENCES employees(id) NOT NULL,
    shipper_employee_id INTEGER REFERENCES employees(id),
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    order_date DATE NOT NULL,
    delivery_date DATE,
    order_status TEXT CHECK(order_status IN ('DRAFT', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED')) DEFAULT 'DRAFT',
    payment_status TEXT CHECK(payment_status IN ('UNPAID', 'PARTIAL', 'PAID')) DEFAULT 'UNPAID',
    payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'DEBT')) DEFAULT 'CASH',
    is_vat_invoice INTEGER DEFAULT 0,
    vat_rate REAL DEFAULT 0.0,
    vat_number TEXT,
    company_name_vat TEXT,
    tax_code_vat TEXT,
    address_vat TEXT,
    subtotal_amount REAL NOT NULL,
    shipping_fee REAL DEFAULT 0.0,
    discount_amount REAL DEFAULT 0.0,
    deposit_amount REAL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0.0,
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

-- 19. Nghiệm thu quyết toán chuyến giao hàng
CREATE TABLE IF NOT EXISTS delivery_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id INTEGER REFERENCES delivery_dispatches(id) NOT NULL,
    shipper_employee_id INTEGER REFERENCES employees(id) NOT NULL,
    cash_collected REAL DEFAULT 0.0,
    shells_returned_voi INTEGER DEFAULT 0,
    shells_returned_up INTEGER DEFAULT 0,
    shells_lost INTEGER DEFAULT 0,
    cash_turned_in REAL DEFAULT 0.0,
    shipping_fee_paid REAL DEFAULT 0.0,
    settled_by INTEGER REFERENCES employees(id),
    settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

-- 21. Sổ theo dõi vỏ bình nhân viên / shipper tạm ứng
CREATE TABLE IF NOT EXISTS employee_bottle_ledgers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) NOT NULL,
    warehouse_id INTEGER REFERENCES warehouses(id) NOT NULL,
    transaction_date DATE NOT NULL,
    borrowed_voi INTEGER DEFAULT 0,
    borrowed_up INTEGER DEFAULT 0,
    returned_voi INTEGER DEFAULT 0,
    returned_up INTEGER DEFAULT 0,
    remaining_voi INTEGER NOT NULL,
    remaining_up INTEGER NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 22. Sổ đăng ký dịch vụ gia tăng (DVGT: Vệ sinh Bình NL, Bể Téc HTCN, Máy Giặt)
CREATE TABLE IF NOT EXISTS dvgt_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    service_product_id INTEGER REFERENCES products(id) NOT NULL,
    seller_employee_id INTEGER REFERENCES employees(id) NOT NULL,
    technician_employee_id INTEGER REFERENCES employees(id),
    station_id INTEGER REFERENCES stations(id),
    scheduled_date DATE,
    completed_date DATE,
    status TEXT CHECK(status IN ('REGISTERED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) DEFAULT 'REGISTERED',
    revenue_amount REAL DEFAULT 0.0,
    payment_status TEXT CHECK(payment_status IN ('UNPAID', 'PAID')) DEFAULT 'UNPAID',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 23. Sổ quỹ phiếu thu tiền
CREATE TABLE IF NOT EXISTS revenue_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_code TEXT UNIQUE NOT NULL,
    transaction_type TEXT CHECK(transaction_type IN ('WATER_SALE', 'BOTTLE_DEPOSIT', 'DEBT_COLLECTION', 'DVGT_SERVICE', 'BRANCH_OFFSET', 'OTHER')) NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    dvgt_id INTEGER REFERENCES dvgt_requests(id),
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

-- 25. Bảng đánh giá và quyết toán KPI hàng tháng của CBCNV
CREATE TABLE IF NOT EXISTS kpi_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) NOT NULL,
    evaluation_month TEXT NOT NULL,
    target_water_revenue REAL DEFAULT 0.0,
    actual_water_revenue REAL DEFAULT 0.0,
    target_dvgt_revenue REAL DEFAULT 0.0,
    actual_dvgt_revenue REAL DEFAULT 0.0,
    target_bottle_delivery INTEGER DEFAULT 0,
    actual_bottle_delivery INTEGER DEFAULT 0,
    target_new_customers INTEGER DEFAULT 0,
    actual_new_customers INTEGER DEFAULT 0,
    shell_recovery_rate REAL DEFAULT 100.0,
    completion_percentage REAL DEFAULT 0.0,
    grade TEXT CHECK(grade IN ('A_PLUS', 'A', 'B', 'C', 'D')) DEFAULT 'B',
    bonus_amount REAL DEFAULT 0.0,
    is_approved INTEGER DEFAULT 0,
    approved_by INTEGER REFERENCES employees(id),
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, evaluation_month)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipper ON orders(shipper_employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_bottle_customer ON customer_bottle_ledgers(customer_id);
CREATE INDEX IF NOT EXISTS idx_kpi_employee_month ON kpi_evaluations(employee_id, evaluation_month);
