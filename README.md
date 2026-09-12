# QAROMI ERP - PHẦN MỀM QUẢN LÝ BÁN HÀNG & ĐIỀU HÀNH DOANH NGHIỆP
### Đơn vị áp dụng: Xí Nghiệp Nước Hồng Gai - Công Ty Cổ Phần Nước Sạch Quảng Ninh (QUAWANCO)
### Thương hiệu sản phẩm: Nước uống tinh khiết & ion kiềm cao cấp QAROMI

---

## 📌 Giới Thiệu Tổng Quan

**QAROMI ERP** là hệ thống phần mềm quản trị bán hàng và điều hành doanh nghiệp (Back-Office / Mini ERP) được thiết kế đặc thù cho mô hình sản xuất, phân phối nước uống đóng bình/đóng chai và cung cấp dịch vụ gia tăng (DVGT) của **Xí nghiệp Nước Hồng Gai - QUAWANCO**.

Khác với các phần mềm bán lẻ POS thông thường, QAROMI ERP giải quyết trọn vẹn các bài toán nghiệp vụ phức tạp từ 3 hệ thống file Excel điều hành thực tế của đơn vị:
1. **Quản lý vòng quay nợ vỏ bình đa kho & đối soát công nợ vỏ:** Tách bạch 2 dòng vỏ bình: **Bình Vòi (VB T9)** và **Bình Úp (VB T8)**, theo dõi chặt chẽ lượng xuất bán, vỏ thu hồi và tiền cọc vỏ.
2. **Mạng lưới đa kho thực tế:** Quản lý xuất - nhập - tồn thời gian thực giữa 6 kho: *Kho Trạm Tăng Áp (sản xuất)*, *Kho Huế (cửa hàng/thị trường)*, *Kho Văn Phòng*, *Kho Xe Tải Điện (tồn trên xe giao hàng)*, *Kho Trạm Đá Trắng* và *Kho Vỏ Bình Rỗng*.
3. **Mạng lưới liên chi nhánh & vay mượn hàng:** Quản lý luân chuyển, mượn/trả vỏ và thành phẩm với các đơn vị bạn: *XN Cẩm Phả*, *XN Bãi Cháy*, *XN Uông Bí*, *XN Miền Đông*, *Tổng công ty QUAWANCO*.
4. **Tách biệt 2 luồng nhân sự:**
   - *Người Vận Động / Bán Hàng (Seller):* Hưởng hoa hồng theo doanh số nước bán, ghi nhận vào chỉ tiêu thi đua/KPI cá nhân.
   - *Người Vận Chuyển / Giao Hàng (Shipper):* Lái xe tải điện, xe máy trạm hưởng phí vận chuyển theo chuyến/định mức và chịu trách nhiệm thu hồi đủ 100% vỏ bình.
5. **Chỉ tiêu Dịch Vụ Gia Tăng (DVGT) & KPI CBCNV:** Theo dõi chỉ tiêu và tiến độ thực hiện vệ sinh bình nóng lạnh, súc rửa bể chứa/téc nước, vệ sinh hệ thống cấp nước của từng trạm và từng cán bộ công nhân viên.
6. **Bộ nhận diện thương hiệu:** Giao diện thiết kế chuẩn theo bảng màu từ Logo QAROMI chính thức: Xanh tím đậm (`#1B1B4B`), Tím than (`#2C2C6B`), Xanh dương hồ thủy (`#50ADDE`), Đỏ cờ thương hiệu (`#C62430`) và Vàng nhạt điểm nhấn (`#FFFBB2`).

---

## 🏗 Kiến Trúc Hệ Thống (Monorepo Standard)

Dự án áp dụng cấu trúc Monorepo tiêu chuẩn (tương đương chuẩn dự án `QuanLyKho`):

```
QLBanHang/
├── apps/
│   ├── api/                        # Backend REST API (Express 5 + TypeScript + SQLite)
│   │   ├── src/
│   │   │   ├── db.ts               # Kết nối SQLite 3 via better-sqlite3, auto-migration & seeding
│   │   │   ├── schema.sql          # Định nghĩa 25 bảng CSDL chuẩn BCNF
│   │   │   ├── seed.sql            # Dữ liệu gốc chuẩn hóa từ thực tế QUAWANCO
│   │   │   └── server.ts           # REST API endpoints (GET, POST, PUT, DELETE)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                        # Frontend Single-Page App (React 19 + Vite + Tailwind CSS)
│       ├── src/
│       │   ├── App.tsx             # Giao diện ERP chính, 9 phân hệ, CRUD & Editable Popups
│       │   ├── api.ts              # HTTP Client tương tác với Backend API
│       │   ├── types.ts            # Khai báo TypeScript types toàn bộ thực thể nghiệp vụ
│       │   └── index.css           # Cấu hình Tailwind v4 & màu thương hiệu QAROMI
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts          # Cổng 24925, cấu hình Proxy /api -> 4325
│
├── desktop/                        # Desktop Shell (Electron 43)
│   ├── main.cjs                    # Main process Electron tải giao diện và quản lý cửa sổ
│   └── preload.cjs                 # Bridge an toàn giữa Electron context và Web
│
├── docs/                           # Tài liệu chi tiết kỹ thuật và nghiệp vụ
│   ├── ARCHITECTURE.md             # Kiến trúc hệ thống, Monorepo & CSDL 25 bảng
│   ├── BUSINESS_REQUIREMENTS_AND_DESIGN.md # Chi tiết nghiệp vụ từ 3 file Excel
│   ├── API_REFERENCE.md            # Tài liệu tra cứu toàn bộ REST API
│   └── PROGRESS_AND_STATUS.md      # Báo cáo tiến độ và trạng thái hoàn thành
│
├── excel/                          # 3 file Excel nghiệp vụ mẫu của đơn vị
├── logo.png                        # Logo thương hiệu QAROMI
├── package.json                    # Monorepo root config (workspaces, scripts)
└── qaromi_erp.db                   # Cơ sở dữ liệu SQLite thời gian thực
```

---

## ⚡ Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu Cầu Môi Trường
- **Node.js:** v18.0 trở lên (khuyến nghị v20+ hoặc v22)
- **NPM:** v9.0 trở lên
- **Hệ điều hành:** Windows 10 / 11, Linux hoặc macOS

### 1. Cài đặt Dependencies
Từ thư mục gốc dự án:
```powershell
npm install
```

### 2. Khởi chạy Chế Độ Phát Triển (Dev Mode)
Chạy đồng thời cả Backend API và Frontend Web Vite thông qua `concurrently`:
```powershell
npm run dev
```
- **Backend API:** Khởi chạy tại `http://127.0.0.1:4325` (sử dụng `tsx watch`, tự động nạp schema/seed và reload khi sửa code).
- **Frontend Web:** Khởi chạy tại `http://localhost:24925` (hỗ trợ Hot Module Replacement - HMR).

### 3. Biên dịch Kiểm Tra Toàn Dự Án (Build)
```powershell
npm run build
```
Lệnh này sẽ chạy typecheck TypeScript cho cả `@qaromi/api` và `@qaromi/web`, sau đó xuất bản bản build tối ưu vào thư mục `apps/web/dist`.

### 4. Khởi chạy Ứng Dụng Desktop (Electron)
```powershell
npm run desktop:dev
```
Hệ thống sẽ build web và mở cửa sổ ứng dụng Desktop độc lập trên Windows.

---

## 💼 11 Phân Hệ Nghiệp Vụ Chính

1. **Tổng Quan (Executive Dashboard):** Doanh thu ngày/tháng, sản lượng tiêu thụ, cảnh báo kho cạn cấp bách, danh sách nợ vay mượn chi nhánh sắp đến hạn.
2. **Quản Lý Bán Hàng & Đơn Hàng:** Lập đơn bán nước, áp dụng chính sách tặng KM 10+1, xuất hóa đơn VAT điện tử, in phiếu giao hàng.
3. **Quản Lý Giao Hàng & Thu Tiền:** Điều phối đơn cho shipper / lái xe điện, bảng quyết toán tiền mặt và đối soát thu hồi vỏ bình.
4. **Quản Lý Khách Hàng:** Hồ sơ khách hàng, hạn mức công nợ tiền mặt, tra cứu lịch sử mua hàng.
5. **Sổ Nợ Vỏ Bình Khách Hàng:** Quản lý vòng quay mượn/trả và số dư nợ vỏ độc lập giữa **Bình Vòi** và **Bình Úp**.
6. **Quản Lý Sản Phẩm & Bảng Giá:** Danh mục nước RO, nước Ion Kiềm 19L, nước chai 350ml/500ml, quy cách đóng gói, giá chuẩn, tiền cọc vỏ.
7. **Quản Lý Kho Hàng & Tồn Kho:** Quản lý số lượng tồn thời gian thực tại 6 kho/trạm, tính toán tốc độ bán và số ngày bán an toàn còn lại.
8. **Điều Chuyển Kho Nội Bộ:** Phiếu điều chuyển hàng hóa giữa các kho trạm (Kho Tăng Áp ➔ Kho Huế ➔ Xe điện).
9. **Sổ Vay Mượn Liên Chi Nhánh:** Quản lý phiếu vay mượn hai chiều (Đi vay / Cho vay) với các chi nhánh Cẩm Phả, Bãi Cháy, Miền Đông...
10. **Quản Lý KPI & Chỉ Tiêu:** Theo dõi định mức tiêu thụ nước QAROMI và chỉ tiêu Dịch Vụ Gia Tăng (DVGT) của từng nhân viên và từng trạm.
11. **Quản Trị Nhân Viên & Phân Quyền:** Quản lý hồ sơ CBCNV, phân công trạm công tác, gán vai trò quyền hạn (Bán hàng, Shipper, Quản lý kho, Kế toán).

---

## 📑 Tài Liệu Tham Khảo Chi Tiết

- [Kiến Trúc Kỹ Thuật Hệ Thống (ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- [Đặc Tả Nghiệp Vụ Chi Tiết Từ File Excel (BUSINESS_REQUIREMENTS_AND_DESIGN.md)](docs/BUSINESS_REQUIREMENTS_AND_DESIGN.md)
- [Tài Liệu Tra Cứu API Endpoints (API_REFERENCE.md)](docs/API_REFERENCE.md)
- [Báo Cáo Tiến Độ & Hiện Trạng Phát Triển (PROGRESS_AND_STATUS.md)](docs/PROGRESS_AND_STATUS.md)
