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
│   ├── preload.cjs                   # Bridge bảo mật
│   ├── build/icon.png                # Icon ứng dụng (biểu trưng QUAWACO)
│   └── scripts/prepare-runtime.mjs   # Copy node.exe kèm vào bộ cài
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

Bản **đã cài đặt** thì không ghi vào thư mục cài đặt: `desktop/main.cjs` đặt `DB_PATH` về `%APPDATA%\QAROMI ERP\qaromi_erp.db`, nên mỗi máy/mỗi đơn vị có CSDL riêng và cập nhật phần mềm không làm mất dữ liệu. CSDL mới được nạp sẵn schema + seed khi mở lần đầu.

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

### 5. Đóng gói bộ cài Windows
```powershell
npm run desktop:pack    # chỉ dựng bản chạy được ở release/win-unpacked (kiểm tra nhanh)
npm run desktop:build   # dựng đầy đủ: bộ cài NSIS + bản portable
```
- `release/QAROMI-ERP-Setup-1.0.0.exe` — bộ cài (chọn được thư mục cài, tạo shortcut Desktop/Start Menu)
- `release/QAROMI-ERP-1.0.0-portable.exe` — bản chạy trực tiếp, copy sang máy khác là chạy, không cần cài

Bộ cài mang theo `node.exe` ở `resources/runtime` để chạy API bằng tiến trình Node riêng (không chạy trong Electron), nên `better-sqlite3` giữ nguyên ABI của Node — vì vậy `electron-builder.yml` đặt `npmRebuild: false` và `asar: false` (node.exe không đọc được file trong asar). Icon lấy từ `desktop/build/icon.png` (biểu trưng QUAWACO) cho cả file .exe, bộ cài và cửa sổ ứng dụng.

Quy trình tự kiểm tra, không cần làm tay:
- `desktop:prepare` chạy `desktop/scripts/ensure-electron.mjs` (thiếu Electron runtime thì tự tải, thiếu devDependencies thì báo đúng lệnh `npm install --include=dev`) rồi copy `node.exe` vào `desktop/runtime`.
- Sau khi pack, hook `desktop/scripts/after-pack.cjs` **chặn build** nếu: gói bật asar, thiếu runtime/API/web/icon, lẫn dependency chỉ dùng lúc build (vite, typescript, tsx, electron...), có CSDL nằm trong thư mục cài, hoặc `better-sqlite3` không mở được bằng `node.exe` đi kèm (lệch ABI). Đây đều là lỗi nếu bỏ qua chỉ lộ ra khi mở app trên máy khác.

### 6. Kiểm thử & CI/CD

```powershell
npm ci --include=dev
npm test        # 76 test nghiệp vụ + bất biến dữ liệu (chạy trên CSDL tạm, không đụng CSDL thật)
npm run smoke   # khởi động bản build từ dist, gọi 27 endpoint + 4 tệp Excel + trang chủ SPA
npm run verify  # build + test + smoke — chạy đủ bộ trước khi phát hành
```

- **CI** (`.github/workflows/ci.yml`) chạy đúng chuỗi trên cho mọi push/pull request, kèm bước chặn file `.db` lọt vào repo.
- **Deploy VPS** (`.github/workflows/deploy.yml`) bấm tay trong tab Actions để SSH vào VPS và chạy `deploy/deploy.sh`.
- `deploy/deploy.sh` **sao lưu CSDL → pull → build → test → smoke → mới restart service**, nên bản lỗi không lên được production. Chi tiết xem [deploy/README.md](deploy/README.md).

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

### Vòng đời đơn hàng

Đơn hàng đi qua 4 trạng thái hoạt động (+ Hủy), chuyển tuần tự không nhảy cóc:

| Trạng thái | Thao tác vào | Hiệu ứng nghiệp vụ |
| :--- | :--- | :--- |
| **Nháp** | Bấm *Lưu nháp* ở màn Tạo đơn | Không |
| **Đã tạo đơn** | Bấm *Xác nhận đơn* | Không (kiểm tra đầy đủ thông tin) |
| **Đang giao** | Bấm *Giao hàng* | **Trừ kho** + tạo phiếu điều phối |
| **Hoàn tất** | Bấm *Hoàn tất đơn* | Ghi **doanh thu**, cọc vỏ, nợ vỏ — chốt **KPI**. Đây là **trạng thái cuối, không sửa/hủy**. |
| **Đã hủy** | Bấm *Hủy đơn* (từ *Nháp / Đã tạo đơn / Đang giao*) | Hoàn kho nếu đã xuất kho |

- Trong **danh sách đơn hàng**: tích chọn **một hoặc nhiều đơn** rồi dùng thanh hành động để *Xác nhận / Giao hàng / Hoàn tất / Hủy* hàng loạt; bấm vào một dòng để mở **chi tiết đơn**.
- **Chi tiết đơn** hiển thị **đầy đủ mọi trường** (giống hệt màn Tạo đơn — dùng chung một bộ component) và cho **sửa** (kể cả **dòng hàng**) khi đơn còn *Nháp* hoặc *Đã tạo đơn*; sau khi *Đang giao* thì chỉ xem/hủy.
- Chuyển trạng thái hoặc sửa đơn sẽ **tính lại tổng tiền** tự động. **Hoàn tất** là trạng thái cuối (không sửa, không hủy) — khi đó mới có thao tác **Xuất hóa đơn** (bấm tay, một lần duy nhất).

### Kho & trạng thái kho

- **Trạng thái kho suy ra trực tiếp từ trạng thái đơn hàng** (không lưu riêng):

| Trạng thái đơn | Trạng thái kho |
| :--- | :--- |
| Nháp / Đã tạo đơn | **Chưa xuất kho** |
| Đang giao / Hoàn tất | **Đã xuất kho** (bút toán đã ghi, tồn kho đã trừ) |
| Đã hủy | **Hủy** |

- **Danh sách Xuất kho** = danh sách **phiếu xuất** suy ra từ đơn: mọi đơn (bán / cho mượn / mượn) đều có mặt từ khi còn **Nháp**, hiển thị *Trạng thái đơn* + *Trạng thái kho*. Bút toán kho chỉ sinh khi đơn chuyển sang **Đang giao**.
- **Danh sách Nhập kho** = các **phiếu nhập** phát sinh từ **đơn mượn** (nhập hàng mượn của đối tác). Đơn mượn xuất hiện ở **cả hai** danh sách khi còn Nháp/Đã tạo.
- **Đơn mượn**: 2 bút toán — nhập từ kho đối tác vào **kho ảo**, rồi xuất từ kho ảo cho khách → kho vật lý **không đổi**.
- **Hủy đơn đã xuất kho** (khách không nhận): hệ thống ghi **bút toán nhập kho hoàn về đúng kho đã xuất** (`IMPORT` cho đơn bán, `LOAN_IN` cho đơn cho mượn); trạng thái kho chuyển **Hủy**. Đơn **Hoàn tất** không hủy được nên không phát sinh trường hợp này.
- Mỗi màn Nhập/Xuất kho có 2 tab: **Theo đơn hàng** (đơn nào đã/chưa xuất kho) và **Phiếu nhập/xuất kho** (danh sách phiếu + tạo phiếu). Bấm vào một phiếu để xem chi tiết mặt hàng, đơn hàng liên quan và trạng thái ghi sổ.

### Phiếu kho (nguồn sự thật của mọi bút toán)

Mọi lần thay đổi tồn kho đều đi qua **phiếu kho** (`stock_tickets` + `stock_ticket_items`), và mỗi bút toán `stock_movements` đều gắn `ticket_id`.

- **Phiếu tự sinh từ đơn hàng** (không sửa/xóa trực tiếp):
  - Đơn bán / cho mượn khi **Giao hàng** → 1 **phiếu xuất** (`ORDER_SALE` / `LEND_OUT`).
  - Đơn mượn khi **Giao hàng** → 1 **phiếu nhập** (`BORROW_IN`, kho ảo) + 1 **phiếu xuất** (`BORROW_DELIVER`, kho ảo).
  - **Hủy đơn đã xuất kho** → thêm 1 **phiếu nhập hoàn** (`ORDER_CANCEL`) về đúng kho đã xuất.
  - **Quyết toán mượn** → phiếu nhập (`PARTNER_RETURN`, đối tác trả hàng) hoặc phiếu xuất (`RETURN_BORROW`, mình trả hàng).
- **Phiếu thủ công** (tạo/xóa được): `PURCHASE` (nhập mua xưởng/NCC), `PARTNER_RETURN`, `BORROW_IN`, `ADJUST_IN`, `OTHER_IN`, `RETURN_BORROW`, `WRITE_OFF`, `ADJUST_OUT`, `OTHER_OUT`, và **`TRANSFER`** (điều chuyển kho nội bộ, chọn kho xuất → kho nhận).
- **Vòng đời phiếu thủ công**: **Nháp** → **Kiểm tra hàng** → **Xác nhận**. Tạo/sửa phiếu khi còn *Nháp* hoặc *Kiểm tra hàng* **(chưa sinh bút toán, tồn kho chưa đổi)**; chỉ khi bấm **Xác nhận** mới ghi bút toán cộng/trừ tồn kho và **phiếu bị khóa** (không sửa/xóa được nữa). Phiếu tự sinh từ đơn hàng luôn ở trạng thái *Đã xác nhận*.
- **Điều chuyển kho và điều chỉnh tồn** nay gộp vào phiếu (đã bỏ 2 API `/inventory/transfer` và `PUT /inventory/stock/:id`).
- Phiếu xuất **chặn nếu không đủ tồn**; mã phiếu `PN-…` / `PX-…` / `PDC-…` theo ngày.
- **Bước *Kiểm tra hàng* khác nhau theo chiều phiếu**:
  - **Phiếu nhập** → kiểm **chất lượng**: chọn *Đạt / Không đạt* cho từng mặt hàng + ô **Ghi chú kiểm hàng** (lưu ở `stock_ticket_items.quality` và `stock_tickets.check_note`).
  - **Phiếu xuất / điều chuyển** → kiểm **số lượng**: form hiện **tồn kho hiện có** của kho xuất theo từng mặt hàng, tô đỏ khi vượt tồn và **chặn lưu nếu xuất quá tồn**.
- Danh sách phiếu hiển thị rõ **Trạng thái phiếu** và cột **Tồn kho** (`Chưa ghi sổ` / `Đã ghi sổ tồn kho`) — chỉ phiếu *Đã ghi sổ* mới thực sự cộng/trừ tồn kho; mở chi tiết phiếu thấy danh sách mặt hàng (kèm chất lượng với phiếu nhập), đơn hàng + trạng thái đơn, đối tác/nguồn nhập.

### Mã tự sinh trong phần Kho

- **Danh mục kho** và **Nguồn nhập**: mã do hệ thống **tự sinh** (`KHO-001`, `NG-001`…) — **không hiển thị ở form lẫn bảng** (chỉ dùng nội bộ).
- **Phiếu kho** (`PN-…` / `PX-…` / `PDC-…`) cũng tự sinh; mã phiếu vẫn hiển thị vì là số chứng từ.

### Vỏ bình & tiền cọc khách đang giữ

- Mỗi vỏ giao cho khách theo đơn bán được ghi vào **nợ vỏ của khách** và đi kèm **tiền cọc đã thu** trong sổ cọc (`deposit_transactions`, phiếu `COC-…`). Tiền cọc là **khoản phải trả cho khách**, **không phải doanh thu**. Mức cọc theo loại vỏ khai ở **Danh mục hệ thống → Cọc vỏ bình**.
- **Tồn vỏ trong kho âm là bình thường**: số âm chính là số vỏ khách đang giữ ngoài thị trường, và **tiền cọc đang giữ là khoản đối ứng** cho số vỏ đó — nợ vỏ × mức cọc = số dư cọc, khớp đến đồng (không phải lỗi sổ sách).
- Khách trả vỏ thì ghi **thu hồi vỏ**: giảm nợ vỏ của khách, **hoàn cọc** và nhập vỏ về **Kho vỏ bình**.

### Tuyến vận chuyển, phương tiện, người phụ trách

- Mỗi phiếu kho hiển thị **Tuyến** dạng mũi tên **điểm đi → (trung chuyển) → điểm đến**, suy ra từ loại phiếu và lý do:
  - **Nhập từ Công ty Quawaco** → `Kho Công ty Quawaco → Kho Xí nghiệp (trung chuyển) → Kho A` (A là kho con của xí nghiệp). *Kho Xí nghiệp* là **kho ảo** (`KHO_XN`) có trong Danh mục kho, đóng vai trò **điểm điều phối** trên tuyến — **không phát sinh bút toán tồn kho** vì thực tế hàng được vận chuyển thẳng tới kho con.
  - **Xuất bán / cho mượn** → `Kho A → Khách: <tên khách>`; **trả hàng mượn** → `Kho A → <đối tác>`; **đối tác trả hàng** → `<đối tác> → Kho A`; **điều chuyển** → `Kho A → Kho B`; **xuất hủy** → `Kho A → Xuất hủy`.
- Phiếu có thêm **Phương tiện** (xe tải, xe điện…) và **Người phụ trách** (chọn từ danh sách nhân viên) — hiển thị ở form và chi tiết phiếu.

### Nhập hàng từ Công ty Quawaco (đầu vào duy nhất)

- Xí nghiệp **không mua hàng bên ngoài**; toàn bộ sản phẩm để bán là **do Công ty Quawaco cấp**. Đầu vào được ghi bằng **phiếu nhập kho** với lý do **“Nhận hàng từ Công ty Quawaco”** (`PARENT_RECEIVE`) và **Nguồn nhập = “Kho Công ty Quawaco”**.
- Bút toán như bình thường: phiếu nhập **tăng tồn kho**, sinh bút toán `IMPORT` vào kho đã chọn, đi theo vòng đời *Nháp → Kiểm tra hàng (chất lượng) → Xác nhận*.
- Vào **Kho → Nhập kho → Phiếu nhập kho → Tạo phiếu nhập**: chọn kho nhận, lý do *Nhận hàng từ Công ty Quawaco*, nguồn nhập, phương tiện, người phụ trách, nhập các dòng hàng (có thể ghi kết quả kiểm hàng), rồi **Xác nhận** để ghi sổ.

### Phân loại sản phẩm

- Mỗi sản phẩm có trường **Phân loại**: **Sản phẩm để bán** (`GOODS`) hoặc **Dịch vụ gia tăng** (`SERVICE`).
- **Hàng bán**: có tồn kho, được chọn trong phiếu kho và **lên đơn hàng**.
- **Dịch vụ**: **không có tồn kho** (ẩn khỏi màn Tồn kho và phiếu kho), **không thể lên đơn hàng** — API chặn kèm thông báo *"… là dịch vụ, hãy tạo yêu cầu dịch vụ"*; form sản phẩm cũng ẩn các trường vỏ bình/cọc vỏ/tồn kho ban đầu.
- Dữ liệu cũ được tự động phân loại theo nhóm hàng khi nâng cấp (`SERVICE_DVGT` → dịch vụ).

### Khuyến mãi

- Quy tắc **mua X tặng Y**, áp dụng theo **3 phạm vi**: **Tất cả sản phẩm** · **Nhóm sản phẩm** · **Sản phẩm cụ thể** (phạm vi "tất cả" để trống cả `product_id` lẫn `category_id`).
- Khuyến mãi được **tự tính lại theo số lượng của từng sản phẩm trên đơn** khi lập đơn và khi gộp đơn; có thể giới hạn theo ngày bắt đầu/kết thúc và bật/tắt.

### Gộp đơn hàng

- Nút **Gộp đơn** chỉ hiện khi chọn **từ 2 đơn trở lên**, tất cả đều **chưa xuất kho** (Nháp / Đã tạo đơn) và **chưa xuất hóa đơn**.
- Màn gộp cho phép **đổi khách hàng, người nhận, SĐT và địa chỉ giao**; hàng hóa được gộp theo sản phẩm.
- **Khuyến mãi được tính lại theo tổng số lượng gộp** (như đơn bình thường — gộp nhiều đơn nhỏ có thể đạt mức mua X tặng Y).
- Kết quả: tạo **1 đơn mới ở trạng thái Nháp**. Các đơn nguồn chuyển sang **Đã hủy** và được đánh dấu **“Đã gộp”** (không ảnh hưởng kho/doanh thu vì chưa xuất kho).
- **Lưu vết**: đơn gộp hiển thị *“Được gộp từ: DH-…, DH-…”*; đơn nguồn hiển thị *“đã được gộp vào đơn …”* (bảng `order_merge_sources`).

### Doanh thu — một định nghĩa duy nhất

- **Doanh thu = giá trị đơn hàng đã bán, tức các đơn ở trạng thái `COMPLETED` (Hoàn tất).** Đơn **Nháp / Đã tạo đơn / Đang giao / Đã hủy** đều **không** được tính.
- Chỉ tính đơn **của xí nghiệp mình** (`order_type IN ('SALE','BORROW_IN')`). Đơn **cho đối tác mượn** (`LEND_OUT`) không phát sinh doanh thu: hàng xuất từ kho mình giao cho khách của đối tác nên **đối tác nợ mình hàng** (công nợ phải thu, trả hàng hoặc trả tiền để tất toán), mình hưởng phần **tiền công vận chuyển** của đơn.
- **Giá trị doanh thu = tiền hàng (`subtotal_amount`)**, không gồm **phí vận chuyển** — phí vận chuyển là **tiền công trả cho nhân viên giao hàng** (xí nghiệp giữ lại, cuối tháng cộng vào lương) nên luôn hiển thị **thành mục riêng** (báo cáo có dòng *"Tiền công vận chuyển trả nhân viên giao hàng (không tính vào doanh thu)"*).
- **Nguồn khách của đơn bán (trường Chỉ tiêu)**: mỗi đơn bán có 2 nguồn khách — **Xí nghiệp** (khách do xí nghiệp tự khai thác, mặc định) và **Công ty** (khách do Công ty đưa sang). **Công ty không phải đối tác liên kết** mà là một thực thể ngang hàng với xí nghiệp: cả hai nguồn đều là **đơn bán của xí nghiệp**, doanh thu vẫn là **một đầu ra duy nhất của xí nghiệp**.
  - Ô chọn **Chỉ tiêu** nằm cạnh trường *Người giao* trong form đơn hàng (dùng chung cho tạo đơn và sửa đơn).
  - Báo cáo thương mại (`Báo cáo → Doanh thu → Doanh thu xí nghiệp`) in **2 hàng nguồn** (XNN Hồng Gai / Công ty) nằm dưới hàng **Tổng** ở cả khối *Thực hiện tháng* và *Lũy kế*; hàng **Tổng** vẫn là doanh thu của xí nghiệp — tách ra chỉ để nhìn rõ **nguồn khai thác**. Màn hình hiển thị đúng bảng nguồn khách đó phía trên bảng mặt hàng.
  - Tùy chọn *Cộng doanh thu đơn đi mượn hàng của đối tác* vẫn áp dụng cho cả hai nguồn.
- Định nghĩa này được dùng **thống nhất** ở: **Dashboard** (thẻ doanh thu hôm nay/hôm qua/tháng, biểu đồ theo ngày, theo kho, theo người bán, cơ cấu sản phẩm), **Báo cáo doanh thu** (`/reports/revenue`), **Chi tiết khách hàng** và **Chỉ tiêu KPI**.
- **Báo cáo doanh thu** có 2 mức xem trong cùng một màn (chọn ở **Xem theo**):
  - **Chi tiết từng đơn hàng** (mặc định): liệt kê **mọi đơn tạo doanh thu** trong kỳ — mã đơn, ngày, khách hàng, loại đơn, người bán, kho, **tiền hàng**, phí ship, giảm giá, tổng đơn, đã thu, trạng thái thanh toán, hóa đơn; **bấm vào dòng để mở thẳng đơn hàng**. Có dòng tổng hợp *số đơn + tổng tiền hàng* (luôn khớp "Tổng doanh thu" ở trên); tối đa **500 dòng** và cảnh báo khi vượt.
  - **Tổng hợp** theo *Nhân viên bán / Khách hàng / Sản phẩm / Ngày*.
- **Phân biệt với Sổ quỹ**: màn **Sổ quỹ Thu - Chi** là **dòng tiền thực thu/chi** (phiếu thu/phiếu chi), **không phải doanh thu** — một đơn Hoàn tất ghi nợ vẫn có doanh thu nhưng chưa có tiền thu.
- **Công nợ khách hàng** = **nợ đầu kỳ** của khách + **phần chưa thu của các đơn đã hoàn thành** (đơn bán / đơn mượn hàng về bán). Theo dõi và thu nợ ở **Tài chính → Công nợ khách hàng**: xổ từng khách ra các đơn còn thiếu, bấm **Thu tiền** để ghi **phiếu thu "Thu nợ"** (thu được nhiều lần; đủ tiền thì đơn chuyển *Đã thanh toán*). Số nợ cũng hiện ở danh sách Khách hàng, Chi tiết khách hàng và thẻ trên Bảng điều khiển.
- **Phí vận chuyển** (chi phí trả shipper) tính trên các đơn **đã rời kho** (`SHIPPING`, `COMPLETED`) — đơn còn Nháp chưa phát sinh chi phí này.
- **Hóa đơn**: **đơn hàng** có 5 trạng thái (Nháp → Đã tạo đơn → Đang giao → Hoàn tất; hoặc Đã hủy), **hóa đơn** chỉ có 2 trạng thái (**Chưa xuất** / **Đã xuất**) và **chỉ sinh từ đơn đã HOÀN TẤT**; việc chuyển *Chưa xuất → Đã xuất* là do **người dùng xác nhận thủ công**, không tự động.
- **Khóa sửa/hủy/gộp là do TRẠNG THÁI ĐƠN HÀNG, không do hóa đơn.** Đơn *Hoàn tất* là trạng thái cuối nên bị khóa, **dù đã xuất hóa đơn hay chưa** — hóa đơn không tham gia vào vòng đời đơn hàng.

### Quy tắc KPI & Đơn hàng cho mượn liên đơn vị

- **KPI**: giao chỉ tiêu doanh thu theo tháng cho nhân viên hoặc tổ/trạm. Thực hiện = cộng dồn **tiền hàng (`subtotal_amount`)** của các đơn **`COMPLETED` và thuộc xí nghiệp mình** do nhân viên đó bán. Đạt ≥ chỉ tiêu là đạt/vượt.
- **Loại đơn**: trên form tạo đơn có trường **Loại đơn** = *Đơn bán* / *Đơn cho mượn* / *Đơn mượn*. Chọn một trong hai loại mượn thì hiện thêm trường **Đối tác liên kết** (danh mục **Đối tác liên kết**).
  - *Đơn bán*: trừ kho mình, có doanh thu/KPI, có phí vận chuyển.
  - *Đơn cho mượn* (đối tác mượn hàng của mình): chọn **kho xuất vật lý** thật, trừ kho mình (`LOAN_OUT`), shipper mình vẫn được phí vận chuyển, **không** tính doanh thu/KPI. Khi đối tác trả hàng → nhập lại kho (`LOAN_IN`).
  - *Đơn mượn* (mình mượn hàng của đối tác để bán): trường **Kho xuất được ẩn** — hệ thống dùng **kho ảo "Kho mượn"** làm trung gian: ghi nhập hàng mượn (`BORROW_IN`) từ kho đối tác vào kho ảo rồi xuất bán (`EXPORT_ORDER`) từ kho ảo → kho vật lý của mình **không đổi** (net 0), **có** doanh thu/KPI, **không** có phí vận chuyển. Khi trả hàng cho đối tác → chọn **kho vật lý** để xuất (`BORROW_OUT`).
- **Quản lý mượn - trả** (menu *Kho*) là nơi duy nhất theo dõi mượn/cho mượn: liệt kê cả hai chiều với bộ lọc *Mình cho mượn / Mình đi mượn / Tất cả* và tab *Đang mượn / Đã trả / Đã hủy / Tất cả* kèm số hàng còn lại; nút **Ghi nhận trả hàng** ghi nhận hàng đối tác trả lại — **mượn hàng chỉ tất toán bằng hàng, không trả bằng tiền**.


---

## 📑 Tài Liệu Tham Khảo Chi Tiết

- [Kiến Trúc Kỹ Thuật Hệ Thống (ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- [Đặc Tả Nghiệp Vụ Chi Tiết Từ File Excel (BUSINESS_REQUIREMENTS_AND_DESIGN.md)](docs/BUSINESS_REQUIREMENTS_AND_DESIGN.md)
- [Tài Liệu Tra Cứu API Endpoints (API_REFERENCE.md)](docs/API_REFERENCE.md)
- [Báo Cáo Tiến Độ & Hiện Trạng (PROGRESS_AND_STATUS.md)](docs/PROGRESS_AND_STATUS.md)
