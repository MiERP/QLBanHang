# QAROMI ERP - PHẦN MỀM QUẢN LÝ BÁN HÀNG & ĐIỀU HÀNH DOANH NGHIỆP

### Đơn vị áp dụng: Xí Nghiệp Nước Hồng Gai - Công Ty Cổ Phần Nước Sạch Quảng Ninh (QUAWANCO)
### Thương hiệu sản phẩm: Nước uống tinh khiết & ion kiềm cao cấp QAROMI

---

## 📌 Giới Thiệu Tổng Quan

**QAROMI ERP** là hệ thống quản trị bán hàng và điều hành (Back-Office / Mini ERP) thiết kế đặc thù cho mô hình sản xuất, phân phối nước uống đóng bình/đóng chai và cung cấp dịch vụ gia tăng (DVGT) của **Xí Nghiệp Nước Hồng Gai - QUAWANCO**.

Hệ thống giải quyết trọn vẹn các bài toán nghiệp vụ từ 3 hệ thống file Excel điều hành thực tế của đơn vị:

1. **Vòng quay nợ vỏ bình đa kho & đối soát công nợ vỏ:** tách bạch 2 dòng vỏ **Bình Vòi (VB T9)** và **Bình Úp (VB T8)**, theo dõi xuất bán, vỏ thu hồi và tiền cọc.
2. **Mạng lưới đa kho:** xuất - nhập - tồn thời gian thực giữa **6 kho**: *Trạm Tăng Áp*, *Kho Huế*, *Kho Văn Phòng*, *Xe Tải Điện*, *Trạm Đá Trắng*, *Kho Vỏ Bình Rỗng* + nhật ký kho đầy đủ.
3. **Liên chi nhánh & vay mượn:** phiếu vay mượn hai chiều (`GIVE_LOAN` / `TAKE_LOAN`) có di chuyển kho và quyết toán hoàn trả với Cẩm Phả, Bãi Cháy, Miền Đông, Móng Cái, Tổng công ty.
4. **Hai luồng nhân sự:** *Seller* (hoa hồng, tính KPI) và *Shipper* (phí vận chuyển, thu hồi 100% vỏ) — có luồng **điều phối giao hàng** và **quyết toán ca**.
5. **Chỉ tiêu DVGT & KPI:** đặt chỉ tiêu tháng, tự động tính thực tế từ đơn hàng/DVGT, xếp loại và tính thưởng.
6. **Sổ quỹ Thu - Chi:** phiếu thu (bán nước, cọc vỏ, thu nợ, DVGT) và phiếu chi (điện, xăng xe, nắp/màng co, lương...) kèm biểu đồ dòng tiền.
7. **Danh mục khai báo qua UI:** trạm, vai trò, nhóm hàng, kho, chi nhánh, nhóm khách hàng, quy cách quy đổi — không cần sửa trực tiếp cơ sở dữ liệu.

---

## 🏗 Kiến Trúc Hệ Thống (Monorepo Standard)

```
QLBanHang/
├── apps/
│   ├── api/                          # Backend REST API (Express 5 + TypeScript + SQLite)
│   │   ├── src/
│   │   │   ├── server.ts             # Bootstrap: CORS, mount routers, phục vụ SPA
│   │   │   ├── db.ts                 # Kết nối SQLite, auto-migration & auto-seed
│   │   │   ├── schema.sql            # 25 bảng CSDL
│   │   │   ├── seed.sql              # Dữ liệu gốc từ 3 file Excel
│   │   │   ├── lib/                  # http.ts (lỗi), codes.ts (sinh mã), stock.ts (nghiệp vụ kho)
│   │   │   └── routes/               # masterData, products, customers, staff, orders,
│   │   │                             #   inventory, branchLoans, delivery, dvgt, finance, kpi, dashboard
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # Frontend SPA (React 19 + Vite + Tailwind CSS + Recharts)
│       ├── src/
│       │   ├── App.tsx               # Shell: Sidebar + Topbar + điều hướng 12 phân hệ
│       │   ├── api.ts                # HTTP client có type + xử lý lỗi tập trung
│       │   ├── types.ts              # TypeScript types toàn bộ thực thể
│       │   ├── layout.ts             # Cấu hình điều hướng (12 tab, nhóm menu)
│       │   ├── index.css             # Tailwind v4 + design token QAROMI
│       │   ├── lib/                  # cn, format (tiền/ngày), hooks
│       │   ├── context/              # ReferenceContext (dữ liệu danh mục dùng chung)
│       │   ├── components/ui/        # Bộ component dùng chung + charts/
│       │   ├── components/layout/    # Sidebar, Topbar
│       │   └── features/             # 12 module: overview, sales, delivery, customers,
│       │                             #   products, warehouse, branchloans, kpi, dvgt,
│       │                             #   finance, staff, settings
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts            # Cổng 24925, proxy /api -> 4325, plugin Tailwind
│
├── desktop/                          # Desktop Shell (Electron 43)
│   ├── main.cjs                      # Fork API, chờ healthy rồi mở cửa sổ
│   └── preload.cjs                   # Bridge bảo mật
│
├── docs/                             # Tài liệu kỹ thuật & nghiệp vụ
├── excel/                            # 3 file Excel nghiệp vụ gốc của đơn vị
├── _legacy/                          # Tầng mã nguồn cũ (không tham gia build) - xem _legacy/README.md
├── logo.png                          # Logo thương hiệu QAROMI
├── package.json                      # Monorepo root (workspaces + scripts)
└── qaromi_erp.db                     # CSDL SQLite DUY NHẤT của hệ thống
```

### Công nghệ sử dụng

| Lớp | Công nghệ |
| :--- | :--- |
| Backend | Express 5, TypeScript, better-sqlite3 (SQLite WAL), chạy dev bằng `tsx watch` |
| Frontend | React 19, Vite 8, **Tailwind CSS v4 (build thật)**, **Recharts**, lucide-react |
| Desktop | Electron 43 (CommonJS) |
| CSDL | SQLite một tệp duy nhất, ràng buộc khóa ngoại `PRAGMA foreign_keys = ON` |

### Cơ sở dữ liệu

Hệ thống dùng **một tệp CSDL duy nhất** `qaromi_erp.db` tại thư mục gốc dự án.
Đường dẫn được `apps/api/src/db.ts` tự xác định theo thư mục gốc, nên mọi chế độ chạy (`npm run dev`, `npm start`, `npm run desktop:dev`) đều dùng chung một CSDL. Có thể ghi đè bằng biến môi trường `DB_PATH`.

---

## ⚡ Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu cầu môi trường
- **Node.js** v20 trở lên (khuyến nghị v22+), **npm** v10+
- Windows 10/11, Linux hoặc macOS

### 1. Cài đặt dependencies
```powershell
npm install --include=dev
```
> **Lưu ý:** nếu môi trường có biến `NODE_ENV=production`, npm sẽ bỏ qua devDependencies
> (vite, typescript, tsx, electron...) và build sẽ lỗi `'vite' is not recognized`.
> Khi đó luôn thêm cờ `--include=dev`.

### 2. Chạy chế độ phát triển
```powershell
npm run dev
```
- **Backend API:** `http://127.0.0.1:4325` (tự nạp schema/seed nếu CSDL trống)
- **Frontend Web:** `http://localhost:24925` (Hot Module Replacement)

### 3. Biên dịch kiểm tra toàn dự án
```powershell
npm run build
```
Chạy typecheck/build cho cả `@qaromi/api` (tsc) và `@qaromi/web` (tsc -b + vite build → `apps/web/dist`).

### 4. Chạy ứng dụng Desktop (Electron)
```powershell
npm run desktop:dev
```
Build web rồi mở cửa sổ Electron; tiến trình Electron tự fork API và phục vụ bản build.

---

## 💼 12 Phân Hệ Nghiệp Vụ

| # | Phân hệ | Chức năng |
| :---: | :--- | :--- |
| 1 | **Tổng quan (Dashboard)** | 8 thẻ KPI thật + 12 biểu đồ (doanh thu, sản lượng, cơ cấu, tồn kho, KPI, dòng tiền, nợ vỏ, vay mượn) |
| 2 | **Bán hàng & Đơn hàng** | Lập đơn nhiều dòng hàng, khuyến mại 10+1, hóa đơn VAT, hoàn kho khi hủy |
| 3 | **Giao hàng & Quyết toán** | Phiếu điều phối, trạng thái giao, quyết toán tiền mặt + đối soát vỏ |
| 4 | **Khách hàng & Nợ vỏ** | Hồ sơ khách hàng, hạn mức nợ, sổ nợ vỏ Vòi/Úp, thu hồi vỏ |
| 5 | **Sản phẩm & Bảng giá** | Danh mục nước RO/Kiềm/chai, giá bán, giá đại lý, tiền cọc, tồn khởi tạo |
| 6 | **Tồn kho & Nhật ký** | Tồn kho 6 kho, điều chuyển nội bộ, điều chỉnh tồn, nhật ký xuất-nhập |
| 7 | **Vay mượn liên chi nhánh** | Phiếu vay/cho vay, di chuyển kho, quyết toán hoàn trả |
| 8 | **Chỉ tiêu KPI** | Giao chỉ tiêu, tính thực tế từ đơn hàng/DVGT, xếp loại, thưởng, duyệt |
| 9 | **Dịch vụ gia tăng** | Đăng ký → phân công → hoàn thành → ghi sổ quỹ tự động |
| 10 | **Nhân sự & Phân quyền** | Hồ sơ CBCNV, trạm công tác, vai trò |
| 11 | **Sổ quỹ Thu - Chi** | Phiếu thu, phiếu chi, biểu đồ cơ cấu và dòng tiền |
| 12 | **Danh mục hệ thống** | Trạm, vai trò, nhóm hàng, kho, chi nhánh, nhóm khách hàng, quy đổi |

---

## 📑 Tài Liệu Tham Khảo Chi Tiết

- [Kiến Trúc Kỹ Thuật Hệ Thống (ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- [Đặc Tả Nghiệp Vụ Chi Tiết Từ File Excel (BUSINESS_REQUIREMENTS_AND_DESIGN.md)](docs/BUSINESS_REQUIREMENTS_AND_DESIGN.md)
- [Tài Liệu Tra Cứu API Endpoints (API_REFERENCE.md)](docs/API_REFERENCE.md)
- [Báo Cáo Tiến Độ & Hiện Trạng (PROGRESS_AND_STATUS.md)](docs/PROGRESS_AND_STATUS.md)
