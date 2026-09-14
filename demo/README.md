# QAROMI ERP — Bản DEMO (kiến trúc Odoo + tùy biến xí nghiệp)

Bản demo này **không phải bảng tính biết liên kết**. Nó chạy theo **mô hình nghiệp vụ của Odoo**:
chứng từ có trạng thái, bút toán kho kép, quy đổi đơn vị, bảng giá, bảng giá cước, phễu CRM —
và **tùy biến thêm** cho những nghiệp vụ mà Odoo không có sẵn (sổ vỏ, kênh doanh thu, nhiều người/lượt giao, DVGT, KPI kế hoạch năm).

Dữ liệu **nạp trực tiếp từ 3 file Excel vận hành thật** trong `excel/`.

---

## 1. Chạy demo

```powershell
npm run demo
```
Mở **http://127.0.0.1:4390** bằng Chrome/Edge (**Ctrl + F5** lần đầu).

Không cần cài thêm gì (dùng `express`, `better-sqlite3`, `exceljs` sẵn có trong dự án). Mỗi lần khởi động, demo đọc lại 3 file Excel và dựng lại dữ liệu sạch.

### Xử lý sự cố
| Hiện tượng | Cách khắc phục |
|---|---|
| "Không kết nối được API" | Mở đúng `http://127.0.0.1:4390` (không mở qua preview IDE). Kiểm tra `http://127.0.0.1:4390/api/health`. |
| `EADDRINUSE` | Đã có bản demo khác chiếm cổng 4390 → tắt trước, hoặc `set PORT=5000 && npm run demo`. |
| Mở chậm vài giây | Bình thường — đang đọc 3 file Excel để nạp dữ liệu. |

---

## 2. Kiến trúc: phần nào là Odoo, phần nào là tùy biến

| Nghiệp vụ | Cơ chế | Nguồn |
|---|---|---|
| Đa kho, tồn realtime | `stock.location` + `stock.quant` | **Odoo** |
| Mọi biến động kho | `stock.move` — **bút toán kép** Nguồn → Đích | **Odoo** |
| Phiếu nhập/xuất/chuyển | `stock.picking` + loại phiếu + trạng thái | **Odoo** |
| Kho lưu động trên xe tải điện | `stock.location` usage `transit` | **Odoo** |
| Bán theo Vỉ/Hộp/Chai | `uom` + nhóm + hệ số quy đổi | **Odoo** |
| Giá bán / giá đại lý | `pricelist` + `pricelist.item` | **Odoo** |
| Báo giá → Đơn bán → Giao hàng | `sale.order` sinh phiếu giao (procurement) | **Odoo** |
| SL đã giao / trạng thái đơn | computed từ phiếu kho | **Odoo** |
| Cước vận chuyển 5.000đ/đơn vị | `delivery.carrier` + `delivery.price.rule` | **Odoo** |
| Khách hàng / nhà cung cấp / chi nhánh | `res.partner` dùng chung | **Odoo** |
| Phễu cơ hội, giai đoạn | `crm.lead` + `crm.stage` | **Odoo** |
| **Kênh doanh thu** (XN/Công ty/Bãi Cháy) | cờ `counts_for_kpi` | **Tùy biến** |
| **Nhiều người / lượt giao** + chia phí | bảng `delivery_worker` | **Tùy biến** |
| **Sổ nợ vỏ theo kỳ** (Úp/Vòi, Trả XN, cọc) | `shell_ledger` | **Tùy biến** |
| **Tồn vỏ rỗng theo kho** | `shell_balance` | **Tùy biến** |
| **DVGT** đa kênh, người vận động, nộp phiếu | `dvgt` | **Tùy biến** |
| **KPI kế hoạch năm/người** | `kpi_plan` + `kpi_employee` | **Tùy biến** |

---

## 3. Các màn hình — tổ chức theo GÓC NHÌN NHÀ QUẢN LÝ

Menu được xếp theo **5 trụ quản lý** + nhóm **Quan hệ & kiểm soát**, không theo tên module kỹ thuật.

| Nhóm | Màn hình | Trả lời câu hỏi quản lý |
|---|---|---|
| **Điều hành** | Bảng điều khiển | Nhìn một màn hình: hôm nay thế nào |
| | Việc cần xử lý | Đơn chưa giao · tiền chưa thu · phiếu chờ · kho dưới ngưỡng |
| **Trụ SẢN PHẨM** | Danh mục & Bảng giá | Bán cái gì, giá bao nhiêu, quy cách, cọc vỏ |
| **Trụ NHÂN VIÊN** | Tiền theo nhân viên | Ai bán bao nhiêu, đã thu bao nhiêu, còn phải thu |
| | Phí vận chuyển theo người | Cước chia đều cho người cùng đi giao |
| | Doanh thu & Chỉ tiêu | % hoàn thành kế hoạch năm theo người/Trạm |
| **Trụ KHÁCH HÀNG** | Công nợ tiền | Khách nào còn nợ, nợ bao nhiêu, đơn gần nhất |
| | Sổ nợ vỏ bình | **Nợ khi nào, trả khi nào**, còn bao nhiêu Úp/Vòi |
| | Cơ hội & chăm sóc | Phễu cơ hội, ai phụ trách, ai vận động |
| **Trụ BÁN HÀNG** | Đơn bán / Báo giá | Chứng từ có trạng thái; Xác nhận → sinh phiếu giao |
| | Dịch vụ gia tăng | Ai vận động, kênh nào, đã nộp phiếu chưa |
| **Trụ KHO** | Phiếu kho · Tồn kho · Dòng dịch chuyển · Vị trí & Tuyến đường | Hàng ở đâu, ai làm, có khớp không |
| **Quan hệ & kiểm soát** | Bản đồ quan hệ | Nhìn thấy mối liên hệ giữa 5 trụ và số liệu thật |

> Điểm nhấn khi trình bày: **Quan hệ giữa các thành phần** — ví dụ *Nhân viên bán → thu tiền → hóa đơn* và *Khách mua → nợ bình → nợ khi nào → trả khi nào*.

---

## 4. Kịch bản trình bày (12–15 phút) — đi theo đúng luồng ERP

**Bước 1 — “Dữ liệu đã có sẵn” (1 phút).** Mở **Tổng quan**: *“Toàn bộ số liệu này lấy từ 3 file Excel của anh/chị, nhưng được tổ chức lại thành chứng từ.”*

**Bước 2 — Luồng bán hàng, phần cốt lõi (5 phút) ⭐**
1. Vào **Bán hàng → Đơn bán**, bấm **＋ Tạo báo giá**.
2. Chọn khách, kênh, kho; thêm 2 dòng: `Vỉ 500ml × 10 (KM 1)` và `Bình ion kiềm × 8`.
   - Chỉ vào cột **Quy đổi tồn kho**: đổi ĐVT sang *Hộp* sẽ thấy hệ thống tự quy về Vỉ — *“đây là quy đổi đơn vị của Odoo, giá vẫn theo từng mặt hàng”*.
   - Chỉ dòng **Cước vận chuyển**: *“tiền cước tự tính theo bảng giá, không nhập tay”*.
3. Bấm **Lưu báo giá** → mở đơn → chỉ ribbon **“Báo giá”**.
4. Bấm **✔ Xác nhận** → *“hệ thống sinh phiếu giao và các dòng dịch chuyển kho, giống Odoo”* → đơn chuyển **“Đơn bán”**.
5. Vào **Kho → Phiếu kho**, mở phiếu vừa sinh → bấm **✔ Xác nhận** → *“tồn kho vừa được ghi theo bút toán kép”*.
6. Quay lại **Tồn kho**: chỉ tồn Vỉ 500ml đã giảm 11 (10 bán + 1 KM).
7. Nếu bán **bình nước** → mở **Sổ nợ vỏ**: *“nợ vỏ tự sinh cho khách, tách Úp/Vòi”*.

**Bước 3 — Kho (3 phút).** Vào **Phiếu kho**:
- Tạo **phiếu nhập từ Cẩm Phả** → Xác nhận → tồn tăng.
- Tạo **chuyển kho nội bộ** Tăng Áp → Huế → Xác nhận → tồn chuyển.
- Mở **Dòng dịch chuyển**: *“mỗi dòng là một bút toán Nguồn → Đích — đây là cách Odoo quản kho.”*

**Bước 4 — CRM & Vận chuyển (2 phút).**
- **CRM → Phễu cơ hội**: kéo/đổi giai đoạn; bấm một cơ hội để chuyển bước; *“cơ hội chuyển thành báo giá được.”*
- **Vận chuyển**: chỉ bảng giá cước dạng quy tắc + phí chia theo người.

**Bước 5 — Phần tùy biến đặc thù (3 phút).**
- **Sổ nợ vỏ**: kỳ T9/T8, Úp/Vòi, Trả XN, đặt cọc, tồn vỏ rỗng — *“Odoo không có, mình viết thêm.”*
- **DVGT**: đa kênh, người vận động, trạng thái nộp phiếu.
- **KPI**: kế hoạch năm/người, % hoàn thành, theo Trạm — *“phần tùy biến riêng của xí nghiệp.”*

**Bước 6 — Chốt (1 phút).** *“Nền là Odoo (chuẩn, ổn định), phần đặc thù của mình thì tùy biến — nên sau này nâng cấp, mở rộng đều bám chuẩn.”*

---

## 5. Ghi chú kỹ thuật

- `demo/server.cjs` — đọc 3 file `.xlsx`, dựng CSDL SQLite `demo/qaromi_demo.db` (đã gitignore), cài đặt nghiệp vụ theo Odoo (`stock.move` kép, procurement từ đơn, `delivery.price.rule`, CRM stage) + phần tùy biến.
- `demo/public/` — giao diện HTML/CSS/JS thuần, **không cần build**.
- **Không đụng** `qaromi_erp.db` của ERP thật.
- Endpoint chẩn đoán: `/api/health`.
- Muốn dữ liệu sạch: tắt và chạy lại `npm run demo`.
