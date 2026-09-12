-- DỮ LIỆU MẪU BAN ĐẦU - QAROMI ERP
-- XÍ NGHIỆP NƯỚC HỒNG GAI (QUAWANCO)

-- 1. Stations
INSERT INTO stations (id, code, name, address, phone) VALUES
(1, 'TR_VANPHONG', 'Khối Văn Phòng Xí Nghiệp', 'Hồng Gai, Hạ Long, Quảng Ninh', '0203.3825.111'),
(2, 'TR_HONGGAI', 'Trạm Nước Hồng Gai', 'Phường Hồng Gai, Hạ Long', '0203.3825.222'),
(3, 'TR_HALONG', 'Trạm Nước Hạ Long', 'Phường Hồng Hải, Hạ Long', '0203.3825.333'),
(4, 'TR_HATU', 'Trạm Nước Hà Tu', 'Phường Hà Tu, Hạ Long', '0203.3825.444'),
(5, 'TR_HALAM', 'Trạm Nước Hà Lầm', 'Phường Hà Lầm, Hạ Long', '0203.3825.555'),
(6, 'TR_CAOXANH', 'Trạm Nước Cao Xanh', 'Phường Cao Xanh, Hạ Long', '0203.3825.666'),
(7, 'TR_DATRANG', 'Trạm Nước Đá Trắng', 'Khu vực Đá Trắng, Hạ Long', '0203.3825.777');

-- 2. Roles
INSERT INTO roles (id, code, name, description) VALUES
(1, 'DIRECTOR', 'Ban Giám Đốc', 'Điều hành toàn diện xí nghiệp'),
(2, 'MANAGER', 'Trưởng Bộ Phận', 'Quản lý kinh doanh và điều phối'),
(3, 'SELLER', 'Nhân Viên Bán Hàng', 'Chốt đơn, tính doanh số, hoa hồng'),
(4, 'SHIPPER', 'Nhân Viên Giao Vận', 'Giao nước, thu tiền, thu hồi vỏ, tính phí ship'),
(5, 'ACCOUNTANT', 'Kế Toán', 'Thu chi quỹ, xuất hóa đơn VAT'),
(6, 'WAREHOUSE', 'Thủ Kho', 'Quản lý xuất nhập tồn đa kho và vỏ'),
(7, 'TECHNICIAN', 'Kỹ Thuật Viên DVGT', 'Thi công bảo dưỡng bình nóng lạnh, bể nước');

-- 3. Employees
INSERT INTO employees (id, station_id, role_id, code, full_name, position, phone, commission_rate, shipping_allowance) VALUES
(1, 1, 1, 'NV001', 'Trần Nam Trung', 'Giám Đốc Xí Nghiệp', '0912.888.999', 0.0, 0.0),
(2, 1, 1, 'NV002', 'Đỗ Văn Cảnh', 'Phó Giám Đốc', '0913.222.333', 0.0, 0.0),
(3, 1, 1, 'NV003', 'Phạm Quang Tâm', 'Phó Giám Đốc', '0915.666.777', 0.0, 0.0),
(4, 1, 1, 'NV004', 'Vũ Thị Mai Huệ', 'Phó Giám Đốc', '0904.555.666', 0.0, 0.0),
(5, 1, 2, 'NV005', 'Phạm Phương Dung', 'Trưởng BP Kinh Doanh', '0983.112.233', 0.03, 0.0),
(6, 1, 3, 'NV006', 'Lại Thị Lan', 'NV Kinh Doanh', '0912.445.566', 0.03, 0.0),
(7, 1, 3, 'NV007', 'Nguyễn Huyền Thư', 'NV Kinh Doanh', '0988.334.455', 0.03, 0.0),
(8, 1, 3, 'NV008', 'Đoàn Thị Nhung', 'NV Kinh Doanh', '0977.112.244', 0.03, 0.0),
(9, 1, 3, 'NV009', 'Lương Minh Hương', 'NV Kinh Doanh', '0904.332.211', 0.03, 0.0),
(10, 1, 3, 'NV010', 'Phạm Tuyết Dung', 'NV Kinh Doanh', '0936.554.433', 0.03, 0.0),
(11, 1, 3, 'NV011', 'Phan Hồng Hạnh', 'NV Kinh Doanh', '0982.776.655', 0.03, 0.0),
(12, 1, 4, 'NV012', 'Nguyễn Thị Hồng Phương', 'Lái Xe Tải Điện', '0934.399.569', 0.0, 5000.0),
(13, 2, 4, 'NV013', 'Đinh Thu Huế', 'Tổ Trưởng Tổ Thị Trường', '0963.913.555', 0.02, 5000.0),
(14, 2, 4, 'NV014', 'Trần Trọng Khoa', 'Shipper Trạm Hồng Gai', '0904.099.383', 0.0, 5000.0),
(15, 5, 4, 'NV015', 'Nguyễn Văn Hưng', 'Shipper Trạm Hà Lầm', '0915.196.225', 0.0, 5000.0),
(16, 4, 4, 'NV016', 'Lê Thanh Xuân', 'Shipper Trạm Hà Tu', '0962.672.181', 0.0, 5000.0),
(17, 7, 4, 'NV017', 'Nguyễn Thanh Xuyền', 'Shipper Trạm Đá Trắng', '0982.757.198', 0.0, 5000.0),
(18, 1, 5, 'NV018', 'Bùi Hồng Nhung', 'Kế Toán Tài Chính', '0987.654.321', 0.0, 0.0),
(19, 1, 6, 'NV019', 'Hoàng Văn Mạnh', 'Thủ Kho Tăng Áp', '0936.111.222', 0.0, 0.0),
(20, 1, 7, 'NV020', 'Tô Việt Hiên', 'Kỹ Thuật Viên DVGT', '0984.004.100', 0.0, 0.0);

-- 4. Categories
INSERT INTO categories (id, code, name, type) VALUES
(1, 'CAT_BOTTLE_19L', 'Nước Đóng Bình 19L (Vòng quay cọc vỏ)', 'BOTTLE_WATER'),
(2, 'CAT_PACK_BOTTLES', 'Nước Đóng Chai Nhỏ (Vỉ & Hộp)', 'PACK_WATER'),
(3, 'CAT_DVGT', 'Dịch Vụ Gia Tăng (Bình NL, Bể Téc)', 'SERVICE_DVGT');

-- 5. Products
INSERT INTO products (id, category_id, code, name, unit, bottle_type, standard_price, wholesale_price, cost_price, deposit_fee, has_shell_cycle) VALUES
(1, 1, 'RO_19L_VOI', 'Nước Tinh Khiết RO QAROMI 19L (Bình Vòi)', 'Bình', 'VOI', 48000.0, 43000.0, 18000.0, 50000.0, 1),
(2, 1, 'RO_19L_UP', 'Nước Tinh Khiết RO QAROMI 19L (Bình Úp)', 'Bình', 'UP', 48000.0, 43000.0, 18000.0, 50000.0, 1),
(3, 1, 'KIEM_19L_VOI', 'Nước Ion Kiềm QAROMI 19L (Bình Vòi)', 'Bình', 'VOI', 52000.0, 47000.0, 21000.0, 50000.0, 1),
(4, 1, 'KIEM_19L_UP', 'Nước Ion Kiềm QAROMI 19L (Bình Úp)', 'Bình', 'UP', 52000.0, 47000.0, 21000.0, 50000.0, 1),
(5, 2, 'VI_350ML', 'Nước Chai QAROMI 350ml (Vỉ 6 chai)', 'Vỉ', 'NONE', 85000.0, 78000.0, 42000.0, 0.0, 0),
(6, 2, 'HOP_350ML', 'Nước Chai QAROMI 350ml (Hộp 24 chai)', 'Hộp', 'NONE', 93000.0, 85000.0, 50000.0, 0.0, 0),
(7, 2, 'VI_500ML', 'Nước Chai QAROMI 500ml (Vỉ 6 chai)', 'Vỉ', 'NONE', 98000.0, 90000.0, 48000.0, 0.0, 0),
(8, 2, 'HOP_500ML', 'Nước Chai QAROMI 500ml (Hộp 24 chai)', 'Hộp', 'NONE', 106000.0, 98000.0, 56000.0, 0.0, 0),
(9, 3, 'DV_BINH_NL', 'Vệ Sinh & Bảo Dưỡng Bình Nóng Lạnh', 'Bình', 'NONE', 230000.0, 230000.0, 60000.0, 0.0, 0),
(10, 3, 'DV_BE_TEC', 'Súc Rửa & Vệ Sinh Bể Ngầm / Téc Nước HTCN', 'Hệ thống', 'NONE', 350000.0, 350000.0, 90000.0, 0.0, 0),
(11, 3, 'DV_MAY_GIAT', 'Bảo Dưỡng & Vệ Sinh Máy Giặt', 'Máy', 'NONE', 250000.0, 250000.0, 70000.0, 0.0, 0);

-- 6. Product conversions (1 Hộp = 4 Vỉ)
INSERT INTO product_conversions (id, from_product_id, to_product_id, ratio, note) VALUES
(1, 6, 5, 4.0, '1 Hộp 350ml tương đương 4 Vỉ 350ml'),
(2, 8, 7, 4.0, '1 Hộp 500ml tương đương 4 Vỉ 500ml');

-- 7. Customer groups
INSERT INTO customer_groups (id, code, name, discount_percent) VALUES
(1, 'GRP_CORP', 'Doanh Nghiệp / Cơ Quan', 5.0),
(2, 'GRP_AGENCY', 'Đại Lý / Cửa Hàng Phân Phối', 10.0),
(3, 'GRP_RETAIL', 'Hộ Gia Đình / Khách Lẻ', 0.0);

-- 8. Customers
INSERT INTO customers (id, group_id, code, name, tax_code, phone, address, contact_person, max_debt_limit, current_debt, bottle_debt_voi, bottle_debt_up) VALUES
(1, 1, 'KH001', 'Công Ty CP Kinh Doanh Than Miền Bắc Vinacomin', '5700100200', '0203.3826.789', 'Phường Hồng Gai, TP Hạ Long', 'Anh Dũng', 25000000.0, 4800000.0, 24, 0),
(2, 1, 'KH002', 'Công Ty CN Hóa Chất Mỏ Quảng Ninh', '5700200300', '0203.3827.123', 'Cụm Công Nghiệp Hà Khánh, Hạ Long', 'Chị Yến', 50000000.0, 12500000.0, 125, 0),
(3, 1, 'KH003', 'Văn Phòng Ủy Ban Nhân Dân Tỉnh Quảng Ninh', '5700300400', '0203.3835.555', 'Nguyễn Văn Cừ, Cột 8, Hạ Long', 'Chị Nga', 30000000.0, 0.0, 38, 9),
(4, 1, 'KH004', 'Ngân Hàng SHB - Chi Nhánh Cột 8', '0100234567', '0203.3636.888', 'Đường Nguyễn Văn Cừ, Cột 8, Hạ Long', 'Chị Hoa', 15000000.0, 2100000.0, 0, 16),
(5, 1, 'KH005', 'Công Ty Hanet Electronics Hạ Long', '5700400500', '0912.898.989', 'Khu Đô Thị MonBay, Hạ Long', 'Anh Hùng', 10000000.0, 960000.0, 3, 6),
(6, 1, 'KH006', 'Công Ty TNHH Du Lịch Luxury Hạ Long', '5700500600', '0983.456.789', 'Bãi Cháy, TP Hạ Long', 'Chị Thu', 15000000.0, 0.0, 0, 11),
(7, 3, 'KH007', 'Karaoke Diamond Hạ Long', '', '0912.345.678', 'Cao Xanh, Hạ Long', 'Chế Dung', 5000000.0, 980000.0, 4, 0),
(8, 3, 'KH008', 'Chung Cư Cẩm Bình', '', '0936.789.012', 'Cẩm Phả, Quảng Ninh', 'Chị Thủy', 5000000.0, 0.0, 0, 1);

-- 9. Warehouses
INSERT INTO warehouses (id, code, name, type, manager_employee_id, location) VALUES
(1, 'KHO_TANGAP', 'Kho Trạm Tăng Áp (Trung Tâm Chiết Rót)', 'CENTRAL', 19, 'Trạm Tăng Áp, Hồng Gai'),
(2, 'KHO_HUE', 'Kho Huế (Tổ Thị Trường & Điểm Bán)', 'STORE', 13, 'Số 42 Cao Xanh, Hạ Long'),
(3, 'KHO_VP', 'Kho Văn Phòng Xí Nghiệp', 'CENTRAL', 8, 'Trụ Sở Xí Nghiệp Nước Hồng Gai'),
(4, 'KHO_XEDIEN', 'Kho Xe Tải Điện (Phương Lái Xe)', 'VEHICLE', 12, 'Xe Tải Điện Lưu Động 14D-0123'),
(5, 'KHO_DATRANG', 'Kho Trạm Đá Trắng', 'STATION', 17, 'Trạm Nước Đá Trắng, Hạ Long'),
(6, 'KHO_VO', 'Kho Vỏ Bình Rỗng (Chờ Súc Rửa)', 'SHELL_STORAGE', 19, 'Sân bãi Kho Tăng Áp');

-- 10. Initial Inventory
INSERT INTO inventory_stock (warehouse_id, product_id, quantity, min_stock_alert, avg_daily_sales) VALUES
(1, 1, 120, 30, 25.0), -- Kho Tăng Áp - RO Vòi
(1, 2, 95, 25, 20.0),  -- Kho Tăng Áp - RO Úp
(1, 3, 85, 20, 15.0),  -- Kho Tăng Áp - Kiềm Vòi
(1, 4, 70, 20, 12.0),  -- Kho Tăng Áp - Kiềm Úp
(1, 5, 150, 40, 30.0), -- Kho Tăng Áp - Vỉ 350ml
(1, 7, 280, 50, 45.0), -- Kho Tăng Áp - Vỉ 500ml
(2, 1, 35, 15, 10.0),  -- Kho Huế - RO Vòi
(2, 2, 20, 10, 8.0),   -- Kho Huế - RO Úp
(2, 3, 18, 10, 6.0),   -- Kho Huế - Kiềm Vòi
(2, 4, 15, 10, 5.0),   -- Kho Huế - Kiềm Úp
(2, 5, 45, 15, 12.0),  -- Kho Huế - Vỉ 350ml
(2, 7, 65, 20, 18.0),  -- Kho Huế - Vỉ 500ml
(3, 1, 10, 10, 3.0),   -- Kho VP - RO Vòi
(3, 3, 8, 5, 2.0),     -- Kho VP - Kiềm Vòi
(3, 7, 47, 15, 8.0),   -- Kho VP - Vỉ 500ml
(4, 1, 25, 10, 15.0),  -- Xe điện - RO Vòi
(4, 3, 15, 10, 10.0),  -- Xe điện - Kiềm Vòi
(4, 7, 30, 10, 20.0);  -- Xe điện - Vỉ 500ml

-- 12. Partner branches
INSERT INTO partner_branches (id, code, name, phone, address, is_internal) VALUES
(1, 'CN_QUAWANCO', 'Văn Phòng Tổng Công Ty QUAWACO', '0203.3835.123', 'Hạ Long, Quảng Ninh', 1),
(2, 'CN_CAMPHA', 'Chi Nhánh Nước Cẩm Phả (CP)', '0203.3862.456', 'TP Cẩm Phả, Quảng Ninh', 1),
(3, 'CN_BAICHAY', 'Chi Nhánh Nước Bãi Cháy (BC)', '0203.3846.789', 'Khu Du Lịch Bãi Cháy, Hạ Long', 1),
(4, 'CN_MIENDONG', 'Chi Nhánh Nước Miền Đông (MĐ)', '0203.3791.111', 'Huyện Tiên Yên, Quảng Ninh', 1),
(5, 'CN_MONGCAI', 'Chi Nhánh Nước Móng Cái (MC)', '0203.3881.222', 'TP Móng Cái, Quảng Ninh', 1);

-- 13. Sample Branch Loans (from Excel: "8/9 VAY KHO CÔNG TY 22 VỈ 500ML")
INSERT INTO branch_loans (id, loan_code, loan_direction, partner_branch_id, warehouse_id, carrier_employee_id, status, loan_date, due_date, note) VALUES
(1, 'VM2026-001', 'TAKE_LOAN', 1, 4, 12, 'PENDING', '2026-09-08', '2026-09-15', '8/9 VAY KHO CÔNG TY 22 VỈ 500ML – ĐƠN PHƯƠNG LÁI XE'),
(2, 'VM2026-002', 'GIVE_LOAN', 4, 1, 15, 'PENDING', '2026-09-07', '2026-09-14', 'Đơn bốc Miền Đông: 10+1 bình úp đến công trường Lideco Bãi Muối');

INSERT INTO branch_loan_items (branch_loan_id, product_id, quantity_loaned, quantity_returned) VALUES
(1, 7, 22, 0),
(2, 2, 11, 0);

-- 16. Sample Orders (Realistic data from sheet XUẤT)
INSERT INTO orders (id, order_code, customer_id, seller_employee_id, shipper_employee_id, warehouse_id, order_date, delivery_date, order_status, payment_status, payment_method, is_vat_invoice, subtotal_amount, shipping_fee, total_amount, paid_amount, note) VALUES
(1, 'DH-20260907-01', 1, 9, 12, 1, '2026-09-07', '2026-09-07', 'COMPLETED', 'PAID', 'BANK_TRANSFER', 1, 980000.0, 50000.0, 1030000.0, 1030000.0, 'Minh Hương bán: 10 + 1 vỉ 500ml cho Than Vinacomin'),
(2, 'DH-20260907-02', 3, 6, 12, 1, '2026-09-07', '2026-09-07', 'COMPLETED', 'PAID', 'BANK_TRANSFER', 1, 1144000.0, 50000.0, 1194000.0, 1194000.0, 'VP UBND Tỉnh: 22 bình Vòi + thu hồi 19 vỏ'),
(3, 'DH-20260907-03', 2, 7, 14, 1, '2026-09-07', '2026-09-07', 'COMPLETED', 'UNPAID', 'DEBT', 1, 6000000.0, 0.0, 6000000.0, 0.0, 'CN Hóa Chất Mỏ QN: 125 bình Vòi giao định kỳ'),
(4, 'DH-20260907-04', 5, 7, 13, 2, '2026-09-07', '2026-09-07', 'COMPLETED', 'PAID', 'CASH', 0, 468000.0, 20000.0, 488000.0, 488000.0, 'Hanet: 6 bình Úp + 3 bình Vòi RO');

INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price) VALUES
(1, 7, 10, 1, 98000.0, 980000.0), -- 10 + 1 vỉ 500ml
(2, 1, 22, 0, 52000.0, 1144000.0),
(3, 1, 125, 0, 48000.0, 6000000.0),
(4, 1, 3, 0, 48000.0, 144000.0),
(4, 2, 6, 0, 48000.0, 288000.0);

-- 22. Sample DVGT Request
INSERT INTO dvgt_requests (id, request_code, customer_name, phone, address, service_product_id, seller_employee_id, technician_employee_id, station_id, scheduled_date, completed_date, status, revenue_amount, payment_status, note) VALUES
(1, 'DV-20260901', 'Đỗ Thị Kim Chung', '0366.304.382', 'T28K3 Cao Xanh', 9, 6, 20, 6, '2026-09-05', '2026-09-05', 'COMPLETED', 233702.0, 'PAID', 'Vệ sinh 1 bình nóng lạnh + thay thanh magie'),
(2, 'DV-20260902', 'Trần Minh Dương', '0902.044.535', 'KĐT Cao Xanh, Hà Khánh', 9, 7, 20, 6, '2026-09-07', '2026-09-07', 'COMPLETED', 509034.0, 'PAID', 'Bảo dưỡng 2 bình nóng lạnh');

-- 25. Sample KPI Evaluations (Month 2026-09)
INSERT INTO kpi_evaluations (employee_id, evaluation_month, target_water_revenue, actual_water_revenue, target_dvgt_revenue, actual_dvgt_revenue, target_bottle_delivery, actual_bottle_delivery, target_new_customers, actual_new_customers, shell_recovery_rate, completion_percentage, grade, bonus_amount, is_approved) VALUES
(6, '2026-09', 120000000.0, 85400000.0, 5000000.0, 3262792.0, 0, 0, 15, 12, 100.0, 71.2, 'A', 1500000.0, 0),
(7, '2026-09', 100000000.0, 68500000.0, 5000000.0, 3904904.0, 0, 0, 10, 8, 100.0, 69.1, 'B', 800000.0, 0),
(12, '2026-09', 0.0, 0.0, 0.0, 0.0, 1500, 1120, 0, 0, 100.0, 74.6, 'A_PLUS', 1200000.0, 0),
(14, '2026-09', 0.0, 0.0, 0.0, 0.0, 1000, 720, 0, 0, 99.2, 72.0, 'A', 900000.0, 0);
