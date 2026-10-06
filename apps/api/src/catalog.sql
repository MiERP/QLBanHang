-- Danh mục nền mặc định của xí nghiệp: nhóm hàng, sản phẩm, nhóm khách hàng.
--
-- File này tách khỏi seed.sql vì đây là DỮ LIỆU MẶC ĐỊNH, không phải dữ liệu mẫu:
--   * CSDL mới: nạp cùng lúc với seed.sql (danh mục trước, dữ liệu mẫu sau).
--   * CSDL đã dùng: nếu bảng danh mục bị trống (ví dụ CSDL từng bị xoá bằng bản cũ chưa giữ
--     danh mục), phần mềm tự nạp lại để danh mục nền luôn có — giống như 5 kho vật lý mặc định,
--     chức vụ, thuế suất, cọc vỏ, nguồn nhập, đối tác...
--
-- Dùng INSERT OR IGNORE nên chạy lại nhiều lần vẫn an toàn: bản ghi người dùng đã có (trùng ID
-- hoặc trùng mã) luôn được giữ nguyên, chỉ bổ sung những dòng còn thiếu.

-- Nhóm hàng
INSERT OR IGNORE INTO categories (id, code, name, type) VALUES
(1, 'CAT_BOTTLE_19L', 'Nước Đóng Bình 19L (Vòng quay cọc vỏ)', 'BOTTLE_WATER'),
(2, 'CAT_PACK_BOTTLES', 'Nước Đóng Chai Nhỏ (Vỉ & Hộp)', 'PACK_WATER'),
(3, 'CAT_DVGT', 'Dịch Vụ Gia Tăng (Bình NL, Bể Téc)', 'SERVICE_DVGT');

-- Sản phẩm
-- cost_price là GIÁ TRƯỚC THUẾ (giá bán đã gồm VAT 8% → trước thuế = giá bán ÷ 1,08, làm tròn đến đồng),
-- không phải giá vốn. Đây là giá trị phần mềm dùng để suy tiền hàng chưa thuế và lập hóa đơn.
INSERT OR IGNORE INTO products (id, category_id, code, name, unit, bottle_type, standard_price, wholesale_price, cost_price, deposit_fee) VALUES
(1, 1, 'RO_19L_VOI', 'Nước Tinh Khiết RO QAROMI 19L (Bình Vòi)', 'Bình', 'VOI', 48000.0, 43000.0, 44444.0, 50000.0),
(2, 1, 'RO_19L_UP', 'Nước Tinh Khiết RO QAROMI 19L (Bình Úp)', 'Bình', 'UP', 48000.0, 43000.0, 44444.0, 50000.0),
(3, 1, 'KIEM_19L_VOI', 'Nước Ion Kiềm QAROMI 19L (Bình Vòi)', 'Bình', 'VOI', 52000.0, 47000.0, 48148.0, 50000.0),
(4, 1, 'KIEM_19L_UP', 'Nước Ion Kiềm QAROMI 19L (Bình Úp)', 'Bình', 'UP', 52000.0, 47000.0, 48148.0, 50000.0),
(5, 2, 'VI_350ML', 'Nước Chai QAROMI 350ml (Vỉ)', 'Vỉ', 'NONE', 85000.0, 78000.0, 78704.0, 0.0),
(6, 2, 'HOP_350ML', 'Nước Chai QAROMI 350ml (Hộp)', 'Hộp', 'NONE', 93000.0, 85000.0, 86111.0, 0.0),
(7, 2, 'VI_500ML', 'Nước Chai QAROMI 500ml (Vỉ)', 'Vỉ', 'NONE', 98000.0, 90000.0, 90741.0, 0.0),
(8, 2, 'HOP_500ML', 'Nước Chai QAROMI 500ml (Hộp)', 'Hộp', 'NONE', 106000.0, 98000.0, 98148.0, 0.0),
(9, 3, 'DV_BINH_NL', 'Vệ Sinh & Bảo Dưỡng Bình Nóng Lạnh', 'Bình', 'NONE', 230000.0, 230000.0, 212963.0, 0.0),
(10, 3, 'DV_BE_TEC', 'Súc Rửa & Vệ Sinh Bể Ngầm / Téc Nước HTCN', 'Hệ thống', 'NONE', 350000.0, 350000.0, 324074.0, 0.0),
(11, 3, 'DV_MAY_GIAT', 'Bảo Dưỡng & Vệ Sinh Máy Giặt', 'Máy', 'NONE', 250000.0, 250000.0, 231481.0, 0.0);

-- Sản phẩm thuộc nhóm Dịch Vụ Gia Tăng là DỊCH VỤ: không có tồn kho, không lên đơn hàng.
UPDATE products SET product_type = 'SERVICE'
WHERE category_id IN (SELECT id FROM categories WHERE type = 'SERVICE_DVGT');

-- Nhóm khách hàng
INSERT OR IGNORE INTO customer_groups (id, code, name) VALUES
(1, 'GRP_CORP', 'Doanh Nghiệp / Cơ Quan'),
(2, 'GRP_AGENCY', 'Đại Lý / Cửa Hàng Phân Phối'),
(3, 'GRP_RETAIL', 'Hộ Gia Đình / Khách Lẻ');
