> ⚠️ **TÀI LIỆU LỊCH SỬ (đã lỗi thời một phần).** Bản mô tả này ghi lại hiện trạng ở giai đoạn
> 9 phân hệ, trước đợt đại tu giao diện & luồng nghiệp vụ. Hiện trạng mới nhất (12 phân hệ,
> Tailwind v4 build, biểu đồ Recharts, danh mục CRUD, một CSDL duy nhất) xem tại
> [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`API_REFERENCE.md`](./API_REFERENCE.md) và
> [`PROGRESS_AND_STATUS.md`](./PROGRESS_AND_STATUS.md).

# BÁO CÁO TỔNG KẾT TOÀN DIỆN VỀ THIẾT KẾ & HIỆN TRẠNG PHẦN MỀM QAROMI ERP
### Đơn vị áp dụng: Xí Nghiệp Nước Hồng Gai - Công Ty Cổ Phần Nước Sạch Quảng Ninh (QUAWANCO)
### Sản phẩm: Nước tinh khiết & ion kiềm cao cấp QAROMI & Dịch vụ gia tăng (DVGT)

---

## 📌 1. Mục Đích & Hệ Thống Tài Liệu Markdown Đã Được Cập Nhật

Để phục vụ công tác bàn giao, tiếp nhận kỹ thuật và tra cứu sau này nhằm hiểu rõ **phần mềm này được thiết kế thế nào** và **đang làm được tới đâu**, toàn bộ hệ thống tài liệu Markdown (`.md`) đã được biên soạn và cập nhật chi tiết ngay trong thư mục mã nguồn của dự án:

| Đường dẫn tệp tin | Nội dung & Mục đích tra cứu | Đối tượng tham khảo |
| :--- | :--- | :--- |
| [`README.md`](file:///D:/PROJECT/Agentic-AI/QLBanHang/README.md) | **Tổng quan dự án:** Giới thiệu bối cảnh xí nghiệp, kiến trúc monorepo, hướng dẫn cài đặt, chạy dev, build và khởi chạy desktop. | Kỹ sư mới, Quản trị viên hệ thống |
| [`docs/ARCHITECTURE.md`](file:///D:/PROJECT/Agentic-AI/QLBanHang/docs/ARCHITECTURE.md) | **Kiến trúc kỹ thuật chuyên sâu:** Mô hình Monorepo, cấu trúc Backend Express 5 + SQLite, Frontend React 19 + Tailwind, Desktop Electron 43, sơ đồ ERD 25 bảng và nguyên tắc bảo mật. | Lập trình viên Backend / Frontend / DevOps |
| [`docs/BUSINESS_REQUIREMENTS_AND_DESIGN.md`](file:///D:/PROJECT/Agentic-AI/QLBanHang/docs/BUSINESS_REQUIREMENTS_AND_DESIGN.md) | **Đặc tả nghiệp vụ từ 3 file Excel:** Giải mã toàn bộ công thức, danh mục giá, cơ cấu khuyến mại 10+1, mạng lưới 6 kho, sổ nợ vỏ bình (Vòi vs Úp), vay mượn chi nhánh, phân luồng Seller/Shipper và chỉ tiêu DVGT. | Chuyên viên phân tích nghiệp vụ (BA), Kế toán, Lãnh đạo xí nghiệp |
| [`docs/API_REFERENCE.md`](file:///D:/PROJECT/Agentic-AI/QLBanHang/docs/API_REFERENCE.md) | **Sổ tay tra cứu REST API:** Chi tiết toàn bộ endpoints (`GET`, `POST`, `PUT`, `DELETE`), URL, cấu trúc Request Body, Response mẫu cho tất cả các phân hệ. | Lập trình viên tích hợp hệ thống, QA/QC |
| [`docs/PROGRESS_AND_STATUS.md`](file:///D:/PROJECT/Agentic-AI/QLBanHang/docs/PROGRESS_AND_STATUS.md) | **Báo cáo tiến độ & Hiện trạng:** Bảng tổng hợp các phân hệ, tỷ lệ hoàn thành (100%), kết quả kiểm thử và lộ trình nâng cấp (Roadmap). | Quản lý dự án (PM), Ban Giám đốc |
| [`implementation_plan.md`](file:///C:/Users/Admin/.gemini/antigravity/brain/2de7b416-acc9-4714-86c4-eed47f6752ad/implementation_plan.md) | **Hồ sơ kế hoạch & Thiết kế gốc:** Ghi lại toàn bộ quá trình lập kế hoạch và chuyển đổi kiến trúc từ đầu đến nay. | Đội ngũ phát triển AI & Kiến trúc sư phần mềm |

---

## 🏗 2. Phần Mềm Này Được Thiết Kế Thế Nào? (Architecture Summary)

### 2.1. Cấu Trúc Monorepo Chuẩn Hóa Doanh Nghiệp
Dự án được cấu trúc theo mô hình **Monorepo** (đồng bộ tiêu chuẩn với dự án `QuanLyKho`):
- `apps/api`: Backend REST API xây dựng bằng **Express 5 + TypeScript**, kết nối cơ sở dữ liệu SQLite 3 thông qua thư viện `better-sqlite3` ở chế độ WAL (Write-Ahead Logging) siêu tốc độ. Tự động khởi tạo schema (`schema.sql`) và nạp dữ liệu mẫu (`seed.sql`) nếu cơ sở dữ liệu chưa tồn tại.
- `apps/web`: Frontend Single-Page Application (SPA) xây dựng bằng **React 19 + TypeScript + Vite + Tailwind CSS**. Sử dụng bộ icon hiện đại `lucide-react`. Giao diện tối ưu theo chuẩn Responsive và màu thương hiệu QAROMI.
- `desktop`: Desktop Shell đóng gói bằng **Electron v43**, cho phép chạy phần mềm như một ứng dụng Windows độc lập (Offline) hoặc kết nối mạng LAN nội bộ.

### 2.2. Cơ Sở Dữ Liệu 25 Bảng Nghiệp Vụ Chuẩn BCNF
CSDL `qaromi_erp.db` được thiết kế chặt chẽ với các khóa chính, khóa ngoại (`PRAGMA foreign_keys = ON;`) và chỉ mục tối ưu:
- **Nhân sự & Phân quyền:** `stations`, `roles`, `employees`.
- **Hàng hóa & Giá:** `categories`, `products`, `product_conversions`.
- **Khách hàng:** `customer_groups`, `customers`.
- **Kho bãi:** `warehouses` (6 kho), `inventory_stock`, `stock_movements`.
- **Bán hàng & Giao vận:** `orders`, `order_items` (có cột KM tặng `10+1`), `delivery_dispatches`, `delivery_settlements`.
- **Sổ nợ vỏ bình:** `customer_bottle_ledgers` (tách riêng 2 cột: **Vỏ Bình Vòi VB T9** & **Vỏ Bình Úp VB T8**), `employee_bottle_ledgers`.
- **Liên chi nhánh:** `partner_branches`, `branch_loans`, `branch_loan_items`, `branch_loan_settlements`.
- **Dịch vụ gia tăng & Quỹ:** `dvgt_requests`, `revenue_transactions`, `expense_transactions`, `kpi_evaluations`.

### 2.3. Bộ Nhận Diện Thương Hiệu QAROMI
Bố cục màu sắc được xây dựng theo đúng các mã màu trích xuất từ file logo chính thức [`logo.png`](file:///D:/PROJECT/Agentic-AI/QLBanHang/logo.png):
- **#1B1B4B** (Xanh tím đậm): Thanh điều hướng Sidebar, Header các Modal.
- **#2C2C6B** (Tím than hoàng gia): Thẻ thống kê chính, nút hành động chính.
- **#50ADDE** (Xanh dương hồ thủy): Màu nước tinh khiết QAROMI, đường viền nhấn, link điều hướng, icon nổi bật.
- **#C62430** (Đỏ cờ thương hiệu): Cảnh báo tồn kho cạn, nợ quá hạn, nút Hủy/Xóa.
- **#FFFBB2** (Vàng nhạt ánh sáng): Huy hiệu VIP, thông báo cần lưu ý.

---

## 🚀 3. Phần Mềm Đang Làm Được Tới Đâu? (Current Implementation Status)

Hiện tại, **100% các phân hệ nghiệp vụ cốt lõi đã hoàn thành trọn vẹn cả 4 thao tác CRUD (Tạo mới, Xem, Chỉnh sửa, Xóa)**:

### 3.1. Bảng Tổng Hợp Trạng Thái Các Phân Hệ

| Phân hệ nghiệp vụ | Xem Dữ Liệu (Read) | Thêm Mới (Create) | Chỉnh Sửa (Update) | Xóa/Hủy (Delete) | Trạng Thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Tổng quan (Dashboard)** | ✅ Đầy đủ | N/A | N/A | N/A | **Hoàn thành 100%** |
| **2. Quản lý bán hàng & Đơn hàng** | ✅ Đầy đủ | ✅ Modal lập đơn | ✅ Modal sửa đơn | ✅ Hủy đơn (`DELETE`) | **Hoàn thành 100%** |
| **3. Quản lý giao hàng & Shipper** | ✅ Đầy đủ | ✅ Phân xe tự động | ✅ Đổi shipper | ✅ Thu hồi đơn | **Hoàn thành 100%** |
| **4. Quản lý khách hàng** | ✅ Đầy đủ | ✅ Modal thêm KH | ✅ Sửa thông tin | ✅ Xóa KH | **Hoàn thành 100%** |
| **5. Sổ nợ vỏ bình (Vòi vs Úp)** | ✅ Đầy đủ | ✅ Tự động ghi nợ | ✅ **Sửa nợ trực tiếp** | ✅ Bù trừ nợ | **Hoàn thành 100%** |
| **6. Quản lý sản phẩm & Bảng giá** | ✅ Đầy đủ | ✅ Modal thêm SP | ✅ **Sửa giá & tên** | ✅ Ngừng bán/Xóa | **Hoàn thành 100%** |
| **7. Tồn kho đa trạm (6 Kho)** | ✅ Đầy đủ | ✅ Tồn đầu kỳ | ✅ **Sửa tồn thực tế** | N/A | **Hoàn thành 100%** |
| **8. Điều chuyển kho nội bộ** | ✅ Đầy đủ | ✅ Phiếu chuyển kho| ✅ Tự cộng trừ kho | N/A | **Hoàn thành 100%** |
| **9. Vay mượn liên chi nhánh** | ✅ Đầy đủ | ✅ Lập phiếu mượn | ✅ Gia hạn/Đổi trạng thái | ✅ Xóa phiếu | **Hoàn thành 100%** |
| **10. Chỉ tiêu KPI & DVGT CBCNV**| ✅ Đầy đủ | ✅ Giao chỉ tiêu | ✅ Cập nhật tiến độ | N/A | **Hoàn thành 100%** |
| **11. Nhân sự & Phân quyền** | ✅ Đầy đủ | ✅ Thêm CBCNV | ✅ **Sửa vai trò/trạm**| ✅ Cho thôi việc | **Hoàn thành 100%** |

### 3.2. Cải Tiến Đột Phá Đã Được Nghiệm Thu:
1. **Khắc phục hoàn toàn vấn đề "không thêm mới được":** Đã bổ sung đầy đủ các Modal form thêm mới trực quan cho Đơn hàng, Khách hàng, Sản phẩm, Nhân sự, Chuyển kho và Vay mượn chi nhánh.
2. **Khắc phục hoàn toàn vấn đề "popup chỉ xem không sửa được":** Tích hợp nút **"Chỉnh Sửa"** ngay trên Header của tất cả các Modal chi tiết, cho phép chuyển đổi tức thì giữa chế độ xem thông tin và form chỉnh sửa tại chỗ, có nút **"Lưu Cập Nhật"** (`PUT`) và **"Hủy / Xóa"** (`DELETE`) đồng bộ ngay lập tức vào cơ sở dữ liệu.
3. **Chất lượng mã nguồn (Zero Errors):** Lệnh `npm run build` đã biên dịch thành công 100% cho cả Backend và Frontend không có bất kỳ lỗi TypeScript hay cảnh báo nào.

---

## 🛠 4. Hướng Dẫn Vận Hành & Khởi Chạy Nhanh

1. **Khởi động chế độ phát triển (Dev Mode):**
   ```powershell
   cd D:\PROJECT\Agentic-AI\QLBanHang
   npm run dev
   ```
   - Giao diện người dùng: `http://localhost:24925`
   - API Backend: `http://127.0.0.1:4325`
2. **Kiểm tra biên dịch sản phẩm (Build Check):**
   ```powershell
   npm run build
   ```
3. **Mở ứng dụng Desktop (Electron):**
   ```powershell
   npm run desktop:dev
   ```
