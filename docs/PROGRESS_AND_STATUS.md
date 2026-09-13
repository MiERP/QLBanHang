# BÁO CÁO TIẾN ĐỘ & HIỆN TRẠNG PHÁT TRIỂN (PROGRESS & STATUS)
## Dự án: QAROMI ERP - Phần Mềm Quản Lý Bán Hàng & Điều Hành Doanh Nghiệp
**Cập nhật lúc:** 2026-09-12
**Trạng thái tổng thể:** HOÀN THIỆN — GIAO DIỆN LÀM LẠI, LUỒNG NGHIỆP VỤ KHÉP KÍN, DASHBOARD ĐẦY ĐỦ

---

## 1. Bảng Tổng Hợp Trạng Thái Các Phân Hệ

| # | Phân hệ | Xem | Thêm | Sửa | Xóa/Hủy | Trạng thái |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | Dashboard tổng quan + 12 biểu đồ | ✅ | N/A | N/A | N/A | **Hoàn thành** |
| 2 | Bán hàng & Đơn hàng | ✅ | ✅ | ✅ | ✅ (hoàn kho) | **Hoàn thành** |
| 3 | Giao hàng & Quyết toán ca | ✅ | ✅ | ✅ | N/A | **Hoàn thành** |
| 4 | Khách hàng & Sổ nợ vỏ | ✅ | ✅ | ✅ | ✅ | **Hoàn thành** |
| 5 | Sản phẩm & Bảng giá | ✅ | ✅ | ✅ | ✅ (ngừng bán) | **Hoàn thành** |
| 6 | Tồn kho & Nhật ký kho | ✅ | ✅ (điều chuyển) | ✅ (điều chỉnh) | N/A | **Hoàn thành** |
| 7 | Vay mượn liên chi nhánh | ✅ | ✅ | ✅ | ✅ (hoàn tác kho) | **Hoàn thành** |
| 8 | Chỉ tiêu KPI & DVGT | ✅ | ✅ | ✅ | ✅ | **Hoàn thành** |
| 9 | Dịch vụ gia tăng (DVGT) | ✅ | ✅ | ✅ | ✅ | **Hoàn thành** |
| 10 | Sổ quỹ Thu - Chi | ✅ | ✅ | ✅ | ✅ | **Hoàn thành** |
| 11 | Nhân sự & Phân quyền | ✅ | ✅ | ✅ | ✅ (thôi việc) | **Hoàn thành** |
| 12 | Danh mục hệ thống (7 danh mục) | ✅ | ✅ | ✅ | ✅ | **Hoàn thành** |

---

## 2. Các Mốc Phát Triển

### Giai đoạn 1–5 (bản đầu)
Nghiên cứu 3 file Excel → chuẩn hoá 25 bảng CSDL → dựng monorepo (`apps/api` + `apps/web` + `desktop`) → dựng giao diện 9 tab và tích hợp Desktop Shell.

### Giai đoạn 6 — Đại tu toàn diện (đợt cải tiến gần nhất)

**a) Giao diện (làm lại từ đầu)**
- Chuyển Tailwind từ CDN sang **Tailwind CSS v4 build thật** (`@tailwindcss/vite`) + `@theme` design token QAROMI.
- Xé nhỏ `App.tsx` từ **1 component 2.490 dòng** thành shell + **12 module** trong `features/`.
- Bổ sung **bộ component dùng chung** (`Button`, `Card`, `StatCard`, `Badge`, `Modal`, `DataTable`, `Field`, `Toast`, `ConfirmDialog`, `Tabs`, `EmptyState`, `Spinner`, `PageHeader`, `charts/*`).
- `DataTable` có **sắp xếp, tìm kiếm, phân trang, trạng thái rỗng/đang tải**.
- Loại bỏ **40 lời gọi `alert()`** và **5 `window.confirm`** → Toast + ConfirmDialog.
- Sidebar chia nhóm, responsive; thêm bộ chọn kỳ tháng dùng chung.

**b) Luồng nghiệp vụ backend (khép kín)**
- Tách `server.ts` (825 dòng) thành **12 router** + `lib/` (http, codes, stock).
- **Danh mục khai báo được qua UI:** thêm API + màn hình CRUD cho trạm, vai trò, nhóm hàng, kho, chi nhánh, nhóm khách hàng, quy đổi; sửa lỗi dropdown lệch ID.
- **Bán hàng:** kiểm tra đủ tồn, ghi nhật ký kho, ghi sổ quỹ, tạo phiếu điều phối, tính tiền phía server.
- **Hủy đơn:** hoàn kho + đảo nợ vỏ + xóa sổ quỹ/điều phối liên quan.
- **Sinh mã chứng từ** theo MAX (hết trùng mã sau khi xóa).
- **Luồng mới:** quyết toán ca giao hàng, vay mượn có di chuyển kho + quyết toán, DVGT tự ghi sổ quỹ, sổ quỹ thu/chi, nhật ký kho, KPI đặt chỉ tiêu + tính thực tế.

**c) Dashboard**
- 8 thẻ KPI **tính từ dữ liệu thật** (loại bỏ số liệu hardcode cũ).
- 12 biểu đồ Recharts: doanh thu theo ngày/kho/nhân viên bán, cơ cấu sản phẩm, cơ cấu thanh toán, tồn kho vs ngưỡng, nợ vỏ theo khách, tiến độ KPI, hiệu suất shipper, vay mượn chưa hoàn trả, biến động kho, dòng tiền thu-chi.
- Bảng cảnh báo tồn kho cấp bách và đơn hàng gần nhất.

**d) Hợp nhất CSDL & dọn tầng legacy**
- Chuẩn hoá về **một CSDL duy nhất** `qaromi_erp.db` tại thư mục gốc cho mọi chế độ chạy.
- Chuyển tầng cũ (`src/`, `preload.js`, `qaromi_erp.sqlite`, bản sao DB trong `apps/api`) vào `_legacy/`.

---

## 3. Kết Quả Kiểm Thử (QA)

| Hạng mục | Lệnh / Cách kiểm | Kết quả |
| :--- | :--- | :--- |
| Biên dịch API | `npm run build -w @qaromi/api` | ✅ 0 lỗi |
| Biên dịch Web | `npm run build -w @qaromi/web` | ✅ 0 lỗi |
| Build toàn dự án | `npm run build` | ✅ 0 lỗi |
| Chạy dev | `npm run dev` | ✅ API `:4325` + Web `:24925` (HMR) phản hồi 200 |
| Phục vụ SPA | `GET /` | ✅ trả `index.html` của bản build |
| Smoke test API | Script kiểm thử tự động | ✅ **24/24 PASS** |

**Phạm vi smoke test (24 điểm):** health, phục vụ SPA, CRUD danh mục (trạm/kho), DVGT tự ghi sổ quỹ, phiếu chi + tổng hợp quỹ, vay mượn trừ/hoàn kho + trạng thái quyết toán, điều chuyển kho (ghi 2 nhật ký), chặn bán vượt tồn, giao chỉ tiêu KPI + tính lại thực tế, cấu trúc dữ liệu dashboard.

**Kiểm thử thủ công đã xác nhận:** luồng bán hàng (trừ kho → ghi nhật ký + sổ quỹ + điều phối), hủy đơn (hoàn kho + xóa sổ quỹ/điều phối).

---

## 4. Kế Hoạch Nâng Cấp Tiếp Theo (Roadmap)

1. **Xuất báo cáo Excel nâng cao:** dùng `exceljs` (đã có sẵn dependency) để xuất bảng kê phí ship theo lái xe, bảng đối soát nợ vỏ hàng tháng, bảng KPI theo mẫu biểu gốc.
2. **Mẫu in phiếu giao & hóa đơn khổ nhỏ:** tối ưu CSS Print cho A4/A5 và hóa đơn nhiệt K80.
3. **Đóng gói bộ cài Windows:** dùng `electron-builder` để xuất `QaromiERP-Setup-x.y.z.exe`.
4. **Tối ưu kích thước bundle:** tách mã (code-splitting) cho Recharts để giảm bundle > 500 kB.
5. **Phân quyền theo vai trò ở backend:** hiện vai trò mới mang tính khai báo, server chưa kiểm tra `role_id` khi thao tác.
