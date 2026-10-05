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

-- 2. Employees
INSERT INTO employees (id, station_id, code, full_name, position, phone, commission_rate, shipping_allowance) VALUES
(1, 1, 'NV001', 'Trần Nam Trung', 'Giám Đốc Xí Nghiệp', '0912.888.999', 0.0, 0.0),
(2, 1, 'NV002', 'Đỗ Văn Cảnh', 'Phó Giám Đốc', '0913.222.333', 0.0, 0.0),
(3, 1, 'NV003', 'Phạm Quang Tâm', 'Phó Giám Đốc', '0915.666.777', 0.0, 0.0),
(4, 1, 'NV004', 'Vũ Thị Mai Huệ', 'Phó Giám Đốc', '0904.555.666', 0.0, 0.0),
(5, 1, 'NV005', 'Phạm Phương Dung', 'Trưởng BP Kinh Doanh', '0983.112.233', 0.03, 0.0),
(6, 1, 'NV006', 'Lại Thị Lan', 'NV Kinh Doanh', '0912.445.566', 0.03, 0.0),
(7, 1, 'NV007', 'Nguyễn Huyền Thư', 'NV Kinh Doanh', '0988.334.455', 0.03, 0.0),
(8, 1, 'NV008', 'Đoàn Thị Nhung', 'NV Kinh Doanh', '0977.112.244', 0.03, 0.0),
(9, 1, 'NV009', 'Lương Minh Hương', 'NV Kinh Doanh', '0904.332.211', 0.03, 0.0),
(10, 1, 'NV010', 'Phạm Tuyết Dung', 'NV Kinh Doanh', '0936.554.433', 0.03, 0.0),
(11, 1, 'NV011', 'Phan Hồng Hạnh', 'NV Kinh Doanh', '0982.776.655', 0.03, 0.0),
(12, 1, 'NV012', 'Nguyễn Thị Hồng Phương', 'Lái Xe Tải Điện', '0934.399.569', 0.0, 5000.0),
(13, 2, 'NV013', 'Đinh Thu Huế', 'Tổ Trưởng Tổ Thị Trường', '0963.913.555', 0.02, 5000.0),
(14, 2, 'NV014', 'Trần Trọng Khoa', 'Shipper Trạm Hồng Gai', '0904.099.383', 0.0, 5000.0),
(15, 5, 'NV015', 'Nguyễn Văn Hưng', 'Shipper Trạm Hà Lầm', '0915.196.225', 0.0, 5000.0),
(16, 4, 'NV016', 'Lê Thanh Xuân', 'Shipper Trạm Hà Tu', '0962.672.181', 0.0, 5000.0),
(17, 7, 'NV017', 'Nguyễn Thanh Xuyền', 'Shipper Trạm Đá Trắng', '0982.757.198', 0.0, 5000.0),
(18, 1, 'NV018', 'Bùi Hồng Nhung', 'Kế Toán Tài Chính', '0987.654.321', 0.0, 0.0),
(19, 1, 'NV019', 'Hoàng Văn Mạnh', 'Thủ Kho Tăng Áp', '0936.111.222', 0.0, 0.0),
(20, 1, 'NV020', 'Tô Việt Hiên', 'Kỹ Thuật Viên DVGT', '0984.004.100', 0.0, 0.0);

-- 4-7. Danh mục nền (nhóm hàng, sản phẩm, nhóm khách hàng) nằm ở catalog.sql: file đó được nạp
--      TRƯỚC file này, và còn được tự nạp lại khi CSDL mất danh mục. Dữ liệu mẫu bên dưới tham
--      chiếu đúng ID của danh mục nền nên hai file phải đi cùng nhau.

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

-- 9. Warehouses (5 kho vật lý mặc định của xí nghiệp + kho ảo trung chuyển)
INSERT INTO warehouses (id, code, name, type, manager_employee_id, location) VALUES
(1, 'KHO_TANGAP', 'Kho Trạm Tăng Áp (Trung Tâm Chiết Rót)', 'CENTRAL', 19, 'Trạm Tăng Áp, Hồng Gai'),
(2, 'KHO_HUE', 'Kho Huế (Tổ Thị Trường & Điểm Bán)', 'STORE', 13, 'Số 42 Cao Xanh, Hạ Long'),
(3, 'KHO_VP', 'Kho Văn Phòng Xí Nghiệp', 'CENTRAL', 8, 'Trụ Sở Xí Nghiệp Nước Hồng Gai'),
(4, 'KHO_XEDIEN', 'Kho Xe Tải Điện (Phương Lái Xe)', 'VEHICLE', 12, 'Xe Tải Điện Lưu Động 14D-0123'),
(5, 'KHO_HALAM', 'Kho Hà Lầm', 'STATION', 17, 'Hà Lầm, Hạ Long'),
(6, 'KHO_XN', 'Kho Xí nghiệp (trung chuyển)', 'VIRTUAL', NULL, 'Điểm điều phối nhập hàng từ Công ty');

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

-- 16. Sample Orders (Realistic data from sheet XUẤT)
INSERT INTO orders (id, order_code, customer_id, seller_employee_id, shipper_employee_id, warehouse_id, order_date, delivery_date, order_status, payment_status, payment_method, is_vat_invoice, subtotal_amount, shipping_fee, total_amount, paid_amount, note) VALUES
(1, 'DH-20260907-01', 1, 9, 12, 1, '2026-09-07', '2026-09-07', 'COMPLETED', 'PAID', 'BANK_TRANSFER', 1, 980000.0, 50000.0, 1030000.0, 1030000.0, 'Minh Hương bán: 10 + 1 vỉ 500ml cho Than Vinacomin'),
(2, 'DH-20260907-02', 3, 6, 12, 1, '2026-09-07', '2026-09-07', 'COMPLETED', 'PAID', 'BANK_TRANSFER', 1, 1144000.0, 50000.0, 1194000.0, 1194000.0, 'VP UBND Tỉnh: 22 bình Vòi + thu hồi 19 vỏ'),
(3, 'DH-20260907-03', 2, 7, 14, 1, '2026-09-07', '2026-09-07', 'COMPLETED', 'UNPAID', 'DEBT', 1, 6000000.0, 0.0, 6000000.0, 0.0, 'CN Hóa Chất Mỏ QN: 125 bình Vòi giao định kỳ'),
(4, 'DH-20260907-04', 5, 7, 13, 2, '2026-09-07', '2026-09-07', 'COMPLETED', 'PAID', 'CASH', 0, 432000.0, 20000.0, 452000.0, 452000.0, 'Hanet: 6 bình Úp + 3 bình Vòi RO');

INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price) VALUES
(1, 7, 10, 1, 98000.0, 980000.0), -- 10 + 1 vỉ 500ml
(2, 1, 22, 0, 52000.0, 1144000.0),
(3, 1, 125, 0, 48000.0, 6000000.0),
(4, 1, 3, 0, 48000.0, 144000.0),
(4, 2, 6, 0, 48000.0, 288000.0);

-- Đơn có yêu cầu hóa đơn VAT thì ghi thuế suất đang hiệu lực (8%) để hóa đơn tách được tiền trước thuế.
UPDATE orders SET vat_rate = 8 WHERE is_vat_invoice = 1;

-- Phiếu thu tương ứng cho các đơn đã thanh toán (để sổ quỹ khớp với số đã thu trên đơn).
INSERT INTO revenue_transactions (transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note) VALUES
('PT-20260907-001', 'WATER_SALE', 1, 1, 1030000.0, 'BANK_TRANSFER', 12, '2026-09-07', 'Thu tiền đơn DH-20260907-01'),
('PT-20260907-002', 'WATER_SALE', 2, 3, 1194000.0, 'BANK_TRANSFER', 12, '2026-09-07', 'Thu tiền đơn DH-20260907-02'),
('PT-20260907-003', 'WATER_SALE', 4, 5, 452000.0, 'CASH', 13, '2026-09-07', 'Thu tiền đơn DH-20260907-04');

-- 35. Đối tác liên kết (đơn vị bạn trong cùng công ty mẹ)
INSERT INTO partner_units (id, code, name, contact_person, phone, address, is_active, note) VALUES
(1, 'DT_CAM_PHA', 'Xí Nghiệp Nước Cẩm Phả', 'Anh Tuấn', '0203.3861.222', 'Cẩm Phả, Quảng Ninh', 1, 'Đơn vị bạn cùng công ty mẹ'),
(2, 'DT_BAI_CHAY', 'Xí Nghiệp Nước Bãi Cháy', 'Chị Hạnh', '0203.3846.555', 'Bãi Cháy, Hạ Long', 1, 'Đơn vị bạn cùng công ty mẹ');

-- 36. Hóa đơn cho các đơn đã hoàn tất và đã thu đủ tiền. Doanh thu chỉ tính đơn ĐÃ XUẤT HÓA ĐƠN,
--     nên thiếu bước này thì mọi báo cáo doanh thu của dữ liệu mẫu đều bằng 0.
INSERT INTO invoices
  (invoice_code, order_id, customer_id, invoice_date, invoice_type, buyer_name, tax_code, address,
   vat_rate, tax_amount, subtotal_amount, total_amount, issued_by, note)
SELECT 'HD-20260907-0' || o.id,
       o.id,
       o.customer_id,
       o.delivery_date,
       CASE WHEN o.is_vat_invoice = 1 THEN 'VAT' ELSE 'RETAIL' END,
       c.name,
       c.tax_code,
       c.address,
       o.vat_rate,
       -- Tiền thuế = tiền hàng theo giá bán (đã gồm VAT) - tiền hàng chưa thuế.
       CASE WHEN o.vat_rate > 0 THEN o.subtotal_amount - net.amount_net ELSE 0 END,
       -- Tiền hàng trước thuế: làm tròn đơn giá chưa thuế từng dòng rồi mới nhân số lượng.
       CASE WHEN o.vat_rate > 0 THEN net.amount_net ELSE o.subtotal_amount END,
       o.total_amount,
       o.seller_employee_id,
       'Hóa đơn cho đơn ' || o.order_code
FROM orders o
JOIN customers c ON c.id = o.customer_id
LEFT JOIN (
  SELECT oi.order_id, SUM(oi.quantity * ROUND(oi.unit_price / (1 + oo.vat_rate / 100.0))) AS amount_net
  FROM order_items oi JOIN orders oo ON oo.id = oi.order_id
  GROUP BY oi.order_id
) net ON net.order_id = o.id
WHERE o.order_status = 'COMPLETED' AND o.payment_status = 'PAID';

UPDATE orders SET invoice_status = 'INVOICED' WHERE id IN (SELECT order_id FROM invoices);

-- 37. Số dư vỏ đầu kỳ của khách: khách đang giữ vỏ từ trước nên xí nghiệp phải giữ
--     đúng số vỏ ÂM tương ứng (số âm = vỏ đang nằm ngoài thị trường) và đã thu tiền cọc của số vỏ đó.
--     Thiếu các nhóm dòng dưới đây thì báo cáo "Đối chiếu vỏ" và "Cọc vỏ" sẽ báo lệch ngay từ dữ liệu gốc.
--     Mức cọc lấy theo sản phẩm (danh mục Cọc vỏ bình được tạo sau bước seed).
INSERT INTO shell_stock (bottle_type, quantity) VALUES
('VOI', -(SELECT COALESCE(SUM(bottle_debt_voi), 0) FROM customers)),
('UP', -(SELECT COALESCE(SUM(bottle_debt_up), 0) FROM customers));

INSERT INTO shell_movements (movement_type, bottle_type, quantity, customer_id, note, created_at)
SELECT 'OUT', 'VOI', bottle_debt_voi, id, 'Vỏ Vòi khách đang giữ đầu kỳ', '2026-09-01 00:00:00'
FROM customers WHERE bottle_debt_voi <> 0;

INSERT INTO shell_movements (movement_type, bottle_type, quantity, customer_id, note, created_at)
SELECT 'OUT', 'UP', bottle_debt_up, id, 'Vỏ Úp khách đang giữ đầu kỳ', '2026-09-01 00:00:00'
FROM customers WHERE bottle_debt_up <> 0;

INSERT INTO customer_bottle_ledgers
  (customer_id, transaction_date, borrowed_voi, borrowed_up, deposit_amount, remaining_balance_voi, remaining_balance_up, note)
SELECT id,
       '2026-09-01',
       bottle_debt_voi,
       bottle_debt_up,
       bottle_debt_voi * (SELECT deposit_fee FROM products WHERE bottle_type = 'VOI' AND deposit_fee > 0 ORDER BY id LIMIT 1)
         + bottle_debt_up * (SELECT deposit_fee FROM products WHERE bottle_type = 'UP' AND deposit_fee > 0 ORDER BY id LIMIT 1),
       bottle_debt_voi,
       bottle_debt_up,
       'Số dư vỏ khách đang giữ đầu kỳ'
FROM customers WHERE bottle_debt_voi <> 0 OR bottle_debt_up <> 0;

INSERT INTO deposit_transactions (transaction_code, transaction_type, customer_id, amount, payment_method, transaction_date, note)
SELECT 'COC-DK-' || code,
       'COLLECT',
       id,
       bottle_debt_voi * (SELECT deposit_fee FROM products WHERE bottle_type = 'VOI' AND deposit_fee > 0 ORDER BY id LIMIT 1)
         + bottle_debt_up * (SELECT deposit_fee FROM products WHERE bottle_type = 'UP' AND deposit_fee > 0 ORDER BY id LIMIT 1),
       'CASH',
       '2026-09-01',
       'Tiền cọc vỏ khách đang giữ đầu kỳ'
FROM customers WHERE bottle_debt_voi <> 0 OR bottle_debt_up <> 0;

-- 38. Kỳ báo cáo mặc định của dữ liệu mẫu = đúng tháng phát sinh các đơn mẫu (tháng 9/2026),
--     để mở phần mềm lần đầu là thấy ngay số liệu thay vì bảng điều khiển trống.
--     Người dùng đổi lại kỳ của mình ở Danh mục hệ thống → Cấu hình chung → Kỳ báo cáo.
INSERT INTO app_settings (key, value) VALUES
('report_period_from', '2026-09-01'),
('report_period_to', '2026-09-30');

