# KẾ HOẠCH & HỒ SƠ THIẾT KẾ KIẾN TRÚC TOÀN DIỆN
## PHẦN MỀM QUẢN LÝ BÁN HÀNG & ĐIỀU HÀNH DOANH NGHIỆP (QAROMI ERP)
### Áp dụng cho: XÍ NGHIỆP NƯỚC HỒNG GAI - CÔNG TY CỔ PHẦN NƯỚC SẠCH QUẢNG NINH (QUAWANCO)
- **Thương hiệu kinh doanh:** Nước uống tinh khiết & ion kiềm cao cấp **QAROMI** (Bình 19L & Chai 350ml/500ml) & Dịch vụ gia tăng (DVGT)
- **Kiến trúc nền tảng:** TypeScript Monorepo Standard (`apps/api` Express 5 + SQLite, `apps/web` React 19 + Vite + Tailwind, `desktop` Electron 43)
- **Thời gian cập nhật:** 2026-09-12T23:45:00+07:00
- **Trạng thái thực thi:** **100% CÁC PHÂN HỆ CỐT LÕI ĐÃ HOÀN THÀNH & ĐƯỢC KIỂM THỬ**

---

## 1. Cơ Sở Thực Tiễn & Nghiệp Vụ Cốt Lõi (Từ 3 File Excel Đơn Vị)

Hệ thống được thiết kế và xây dựng dựa trên việc giải mã trực tiếp 3 hệ thống bảng tính Excel đang vận hành thực tế tại Xí nghiệp Nước Hồng Gai:

1. **File `ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa.xlsx`:**
   - Điều phối đơn hàng xuất bán theo ngày.
   - Bảng kê phân công xe/shipper (Phương xe điện, Khoa, Hưng, Xuân...).
   - Tính toán chi phí vận chuyển bốc xếp giao hàng.
   - Chính sách khuyến mại **10 + 1**: Mua 10 bình tặng 1 vỉ / 10 bình tặng 1 bình (trừ kho nhưng 0₫ doanh thu).
   - Xuất hóa đơn VAT điện tử cho cơ quan, trường học, bệnh viện, doanh nghiệp.

2. **File `XNT T9.hương -Nhung.xlsx`:**
   - Cân đối Xuất - Nhập - Tồn đa kho giữa **6 kho bãi**:
     1. *Kho Trạm Tăng Áp (kho xưởng sản xuất chính)*
     2. *Kho Huế (kho cửa hàng tổ thị trường)*
     3. *Kho Văn Phòng (khối văn phòng và khách vãng lai)*
     4. *Kho Xe Tải Điện (tồn lưu động trên thùng xe)*
     5. *Kho Trạm Đá Trắng*
     6. *Kho Vỏ Bình Rỗng*
   - **Sổ theo dõi nợ vỏ bình khách hàng:** Tách biệt độc lập thành 2 cột:
     - **Vỏ Bình Vòi (VB T9)**
     - **Vỏ Bình Úp (VB T8)**
   - **Sổ theo dõi vay mượn hàng liên chi nhánh:** Vay mượn chéo hai chiều (Đi vay / Cho vay) với Cẩm Phả, Bãi Cháy, Uông Bí, Miền Đông, TCT.

3. **File `THEO DÕI CHỈ TIÊU DVGT CBCNV.xlsx`:**
   - Tách bạch 2 luồng nhân sự:
     - *Người Vận Động / Bán Hàng (Seller):* Hưởng hoa hồng, tính doanh số vào chỉ tiêu thi đua/KPI cá nhân.
     - *Người Vận Chuyển / Giao Nhận (Shipper):* Hưởng phí vận chuyển, có trách nhiệm thu đủ tiền và 100% vỏ bình rỗng.
   - Quản lý các chỉ tiêu **Dịch Vụ Gia Tăng (DVGT)**: Vệ sinh bảo dưỡng bình nóng lạnh, súc rửa bể chứa ngầm/téc nước, vệ sinh máy giặt...
   - Quyết toán tỷ lệ hoàn thành KPI hàng tháng của từng CBCNV và từng Trạm cấp nước.

---

## 2. Kiến Trúc Kỹ Thuật Hệ Thống (Monorepo Standard)

Tuân thủ nghiêm ngặt chuẩn kiến trúc Monorepo tiêu chuẩn doanh nghiệp (đồng bộ cấu trúc với dự án `QuanLyKho`):

```
QLBanHang/
├── apps/
│   ├── api/                     # Backend REST API (Express 5, TypeScript, better-sqlite3)
│   │   ├── src/
│   │   │   ├── db.ts            # Quản lý SQLite WAL mode, Auto-migration & Auto-seeding
│   │   │   ├── schema.sql       # CSDL 25 bảng chuẩn BCNF với Foreign Keys & Indexes
│   │   │   ├── seed.sql         # Bộ dữ liệu thực tế QUAWANCO
│   │   │   └── server.ts        # REST API Controllers (GET, POST, PUT, DELETE)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                     # Frontend Single-Page App (React 19, Vite, Tailwind CSS)
│       ├── src/
│       │   ├── App.tsx          # Giao diện chính 9 phân hệ, 6 Creation Modals, 6 Edit Modals
│       │   ├── api.ts           # HTTP API client
│       │   ├── types.ts         # TypeScript types toàn bộ hệ thống
│       │   └── index.css        # Tailwind theme & màu thương hiệu logo QAROMI
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts       # Cổng 24925, Proxy /api sang 4325
│
├── desktop/                     # Desktop Shell (Electron v43)
│   ├── main.cjs                 # Main process điều khiển cửa sổ ứng dụng Windows
│   └── preload.cjs              # Bridge bảo mật giữa NodeJS và Renderer
│
├── docs/                        # Thư viện tài liệu kỹ thuật hoàn chỉnh
│   ├── ARCHITECTURE.md          # Chi tiết kiến trúc Monorepo & CSDL
│   ├── BUSINESS_REQUIREMENTS_AND_DESIGN.md # Đặc tả nghiệp vụ từ 3 file Excel
│   ├── API_REFERENCE.md         # Danh mục REST API endpoints chi tiết
│   └── PROGRESS_AND_STATUS.md   # Báo cáo tiến độ và nghiệm thu
│
├── excel/                       # 3 file Excel gốc của đơn vị
├── logo.png                     # Logo thương hiệu gốc
├── README.md                    # Hướng dẫn tổng quan và khởi chạy nhanh
└── qaromi_erp.db                # Cơ sở dữ liệu SQLite thời gian thực
```

---

## 3. Thiết Kế Cơ Sở Dữ Liệu SQLite (25 Bảng Nghiệp Vụ)

Toàn bộ CSDL được thiết kế với ràng buộc toàn vẹn dữ liệu ở mức cao nhất:
- Ràng buộc khóa ngoại: `PRAGMA foreign_keys = ON;`
- Bảng kê 25 bảng:
  1. `stations`: 7 trạm cấp nước trực thuộc.
  2. `roles`: Phân quyền (Giám đốc, Kế toán, Thủ kho, Kinh doanh, Shipper).
  3. `employees`: Hồ sơ CBCNV, định mức hoa hồng doanh số, phụ cấp giao hàng.
  4. `categories`: Phân nhóm mặt hàng (Bình 19L, Nước chai, Dịch vụ gia tăng).
  5. `products`: Chi tiết mặt hàng (Bình RO Vòi/Úp, Bình Kiềm Vòi/Úp, Chai 350ml/500ml, DVGT).
  6. `product_conversions`: Quy đổi quy cách (Chai - Vỉ - Thùng).
  7. `customer_groups`: Nhóm khách hàng (Cơ quan, Đại lý, Hộ gia đình, Trường học).
  8. `customers`: Hồ sơ khách hàng, mã số thuế, hạn mức nợ tiền mặt, địa chỉ giao nước.
  9. `warehouses`: 6 kho bãi thực tế (Tăng Áp, Huế, Văn Phòng, Xe Tải Điện, Đá Trắng, Kho Vỏ).
  10. `inventory_stock`: Bảng tồn kho thời gian thực theo từng kho và từng sản phẩm.
  11. `stock_movements`: Nhật ký nhập - xuất - luân chuyển giữa các kho nội bộ.
  12. `orders`: Đơn bán hàng, trạng thái thanh toán, thông tin xuất hóa đơn VAT.
  13. `order_items`: Chi tiết dòng hàng, số lượng mua, số lượng KM 10+1, đơn giá.
  14. `delivery_dispatches`: Lệnh điều phối xe/shipper, tiền công vận chuyển.
  15. `delivery_settlements`: Bảng nghiệm thu quyết toán ca giao hàng (tiền nộp quỹ + vỏ bình thu hồi).
  16. `customer_bottle_ledgers`: **Sổ nợ vỏ bình khách hàng (2 cột riêng: Bình Vòi & Bình Úp)**.
  17. `employee_bottle_ledgers`: Sổ quản lý vỏ bình Shipper tạm ứng trên xe chưa nộp về xí nghiệp.
  18. `partner_branches`: Đơn vị chi nhánh bạn liên kết (Cẩm Phả, Bãi Cháy, Uông Bí, Miền Đông, TCT).
  19. `branch_loans`: Phiếu vay mượn hàng liên chi nhánh (Đi vay vs Cho bạn vay).
  20. `branch_loan_items`: Chi tiết sản phẩm và số lượng vay mượn.
  21. `branch_loan_settlements`: Quyết toán trả hàng mượn hoặc bù trừ công nợ.
  22. `dvgt_requests`: Sổ đăng ký Dịch vụ gia tăng (Bình NL, Súc rửa bể téc, di chuyển công tơ).
  23. `revenue_transactions`: Sổ quỹ thu tiền (Thu tiền nước, cọc vỏ, thu nợ, thu tiền DVGT).
  24. `expense_transactions`: Sổ quỹ chi phí vận hành (Điện sản xuất, xăng xe, nắp, màng co...).
  25. `kpi_evaluations`: Bảng theo dõi và quyết toán KPI hàng tháng của CBCNV.

---

## 4. Thiết Kế Giao Diện & Tương Tác Người Dùng (UI/UX)

### 4.1. Bảng Màu Thương Hiệu (Brand Palette)
Trích xuất chuẩn xác từ logo `logo.png`:
- **Header & Sidebar:** Xanh tím đậm `#1B1B4B` kết hợp Tím than `#2C2C6B`.
- **Thành phần tương tác & Accent:** Xanh dương hồ thủy `#50ADDE`.
- **Cảnh báo & Nút Xóa/Hủy:** Đỏ cờ thương hiệu `#C62430`.
- **Điểm xuyết & Huy hiệu:** Vàng nhạt điểm nhấn `#FFFBB2`.

### 4.2. Hệ Thống 9 Phân Hệ Giao Diện
- Tab 1: **Tổng quan (Dashboard):** Chỉ số KPI, doanh thu, biểu đồ tiêu thụ, cảnh báo kho cạn, nợ vay mượn.
- Tab 2: **Quản lý đơn hàng (Sales):** Bộ lọc đơn, bảng kê mặt hàng, tiền ship, hóa đơn VAT.
- Tab 3: **Quản lý giao hàng (Delivery):** Điều phối đơn, quyết toán tiền mặt và đối soát thu hồi vỏ của từng shipper.
- Tab 4: **Quản lý khách hàng & Sổ nợ vỏ (Customers):** Danh sách khách hàng và Sổ nợ vỏ (Vòi vs Úp).
- Tab 5: **Quản lý sản phẩm & Bảng giá (Products):** Bảng giá chuẩn, tiền cọc vỏ, tồn kho phân bổ tại 6 kho.
- Tab 6: **Quản lý kho & Vay mượn (Warehouse):** Tồn kho đa trạm, cảnh báo cạn và Sổ vay mượn chi nhánh.
- Tab 7: **Quản lý KPI & DVGT (KPI):** Định mức tiêu thụ nước và chỉ tiêu dịch vụ gia tăng.
- Tab 8: **Quản lý nhân viên (Staff):** Hồ sơ nhân sự, phân quyền vai trò.
- Tab 9: **Cấu hình hệ thống (Settings):** Cấu hình trạm, đơn vị liên kết, mẫu biểu.

### 4.3. Đột Phá: Chuyển Đổi Hoàn Toàn Sang Modal Hai Chiều (Interactive View & Edit Modals)
Khắc phục triệt để hạn chế "popup chỉ xem không sửa được":
- Mỗi Modal (Đơn hàng, Khách hàng, Sản phẩm, Nhân viên, Tồn kho, Phiếu mượn) đều có nút **"Chỉnh Sửa"** (`Edit`) ngay trên thanh tiêu đề.
- Cho phép sửa trực tiếp tại chỗ (trạng thái đơn, số dư nợ vỏ, giá bán, chức danh, số tồn kho...).
- Có nút **"Lưu Cập Nhật"** (`PUT`) gửi request đồng bộ tức thì về SQLite.
- Có nút **"Hủy / Xóa"** (`DELETE`) có xác nhận an toàn.

---

## 5. Kết Quả Nghiệm Thu & Kiểm Thử
- **Biên dịch mã nguồn (Build Test):** Cả `@qaromi/api` và `@qaromi/web` biên dịch thành công 100% với **0 lỗi** (`npm run build`).
- **Kiểm thử tự động các phương thức API:** Toàn bộ các API `GET`, `POST`, `PUT`, `DELETE` đều được kiểm thử thành công qua script tự động.
- **Môi trường chạy đồng thời (Dev Concurrent):** Backend API (cổng 4325) và Frontend Vite HMR (cổng 24925) hoạt động ổn định và mượt mà.
