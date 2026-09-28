# HỒ SƠ THIẾT KẾ: THUẾ GTGT & DOANH THU TRƯỚC THUẾ
## QAROMI ERP — Giá bán cố định, doanh thu trước thuế suy ngược
**Đơn vị:** Xí Nghiệp Nước Hồng Gai — QUAWANCO
**Căn cứ:** đối chiếu `excel/Nước thương mại.xlsx` (sheet `Báo cáo`), sheet `Đơn giá` trong `excel/ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa (1).xlsx`, bảng giá sản phẩm trong phần mềm
**Trạng thái:** DỰ THẢO CHỜ DUYỆT — chưa triển khai mã nguồn

---

## 1. Vấn đề

Báo cáo thương mại nộp Công ty dùng **đơn giá để tính doanh thu thấp hơn giá bán** trên đơn hàng. Cần làm rõ bản chất con số này và thiết kế cách phần mềm tính toán sao cho **khi thuế suất thay đổi không phải sửa mã nguồn**.

## 2. Kết quả nghiên cứu (bằng chứng số liệu)

Đối chiếu 6 SKU giữa file báo cáo và bảng giá phần mềm:

| Mặt hàng | Giá bán (đơn + sheet `Đơn giá`) | Đơn giá trong báo cáo | Giá bán ÷ 1,08 | Giá vốn trong phần mềm |
| :--- | ---: | ---: | ---: | ---: |
| Bình RO 19L | 48.000₫ | 44.444₫ | 44.444,44 | 18.000₫ |
| Bình ion kiềm 19L | 52.000₫ | 48.148₫ | 48.148,15 | 21.000₫ |
| Vỉ 350ml | 85.000₫ | 78.704₫ | 78.703,70 | 42.000₫ |
| Hộp 350ml | 93.000₫ | 86.111₫ | 86.111,11 | 50.000₫ |
| Vỉ 500ml | 98.000₫ | 90.741₫ | 90.740,74 | 48.000₫ |
| Hộp 500ml | 106.000₫ | 98.149₫ | 98.148,15 | 56.000₫ |

**Kết luận:** đơn giá trong báo cáo = **giá bán ÷ (1 + 8%)** — tức giá bán **chưa VAT 8%**, **không phải giá vốn** (giá vốn 18.000–56.000₫ không khớp bất kỳ dòng nào).

- Báo cáo trình bày: `DT = SL × đơn giá chưa VAT`; cột DT không gồm VAT.
- Sai lệch nhỏ: ô Hộp 500ml ghi 98.149₫ trong khi làm tròn chuẩn là 98.148₫ (lệch 1₫, khả năng gõ tay — phần mềm sẽ tính theo làm tròn chuẩn).
- Xác nhận phụ: sheet `Vận chuyển` (cùng file ĐIỀU PHỐI) dùng **5.000₫/đơn vị** — khớp cấu hình phí vận chuyển trong phần mềm.

## 3. Quyết định thiết kế (chốt với lãnh đạo)

| # | Vấn đề | Quyết định |
| :---: | :--- | :--- |
| 1 | Giá bán | **Cố định, đã gồm VAT** — dữ liệu gốc trên đơn, không bao giờ tính lại/sửa đổi |
| 2 | Doanh thu trước thuế | **Suy ngược từ giá bán**: `đơn giá chưa thuế = round(giá bán ÷ (1 + r))` |
| 3 | Tiền thuế | `thuế = thành tiền bán − doanh thu chưa thuế` (luôn khớp đúng tổng tiền bán) |
| 4 | Làm tròn | **Đến hàng đồng, ở bước đơn giá**, rồi mới nhân số lượng (khớp mẫu Excel) |
| 5 | Thuế suất | Là **dữ liệu có thời hiệu**, không hard-code; giao dịch **lưu lại thuế suất đã áp** |
| 6 | Thay đổi thuế sau này | Chỉ **thêm dòng hiệu lực mới** trong danh mục — không sửa mã nguồn, không sửa sản phẩm, không đụng đơn cũ |
| 7 | Dịch vụ (DVGT) | **Không có thuế**, và **không tính vào báo cáo doanh thu** |
| 8 | Phạm vi tính thuế | **Mọi đơn thu tiền đều tính doanh thu → đều tính thuế** (đơn bán + đơn đi mượn); đơn cho mượn / đơn hủy không tính |
| 9 | File xuất | **Excel khổ ngang (A4 landscape)**, đủ khối chữ ký như mẫu `Nước thương mại.xlsx` |

## 4. Mô hình dữ liệu đề xuất

### 4.1. Danh mục thuế suất — bảng mới `vat_rates`

| Cột | Ý nghĩa |
| :--- | :--- |
| `id`, `code` | Khoá, mã nhóm thuế |
| `name` | Tên nhóm thuế (VD: *Nước uống đóng bình/chai*) |
| `rate` | Thuế suất % |
| `effective_from`, `effective_to` | Hiệu lực từ ngày → đến ngày (`NULL` = còn hiệu lực) |
| `note` | Căn cứ / ghi chú |

Ví dụ dữ liệu (người dùng tự nhập theo quy định từng thời điểm):

| Mã | Nhóm thuế | Thuế suất | Hiệu lực từ | Đến |
| :--- | :--- | ---: | :--- | :--- |
| `VAT08` | Nước uống đóng bình/chai | 8% | 01/07/2025 | 31/12/2026 |
| `VAT10` | Nước uống đóng bình/chai | 10% | 01/01/2027 | — |

### 4.2. Sản phẩm

- Thêm `products.vat_rate_id` → trỏ vào nhóm thuế. **Không nhập số % trực tiếp vào sản phẩm** để khi luật đổi chỉ cần đổi danh mục.
- Mặc định cả 6 SKU nước dùng chung nhóm *Nước uống đóng bình/chai*.
- Sản phẩm loại **dịch vụ (`product_type = 'SERVICE'`) không gắn nhóm thuế** — dịch vụ không có VAT và không vào báo cáo doanh thu.

### 4.3. Đơn hàng (snapshot tại thời điểm lập đơn)

- `order_items.vat_rate` — thuế suất **đã áp** cho từng dòng (nguồn chính; đủ cho trường hợp bán lẫn hàng hóa và dịch vụ khác thuế suất).
- `orders.vat_amount` — tổng tiền thuế của đơn (tính lại mỗi khi lưu đơn).
- `orders.vat_rate` (đã có) — giữ để tương thích, ghi bằng thuế suất của đơn khi mọi dòng cùng mức.

### 4.4. Hóa đơn

- `invoices.vat_rate`, `invoices.tax_amount` đã có sẵn — lấy tổng thuế từ đơn.
- **Lưu ý phải sửa:** công thức hiện tại `tax = subtotal × r/100` đang hiểu giá **chưa** thuế (cộng VAT lên trên). Theo mô hình chốt (giá bán gồm VAT) phải đổi sang `tax = Σ (thành tiền bán − doanh thu chưa thuế)`.

### 4.5. Cấu hình chữ ký báo cáo

- Bảng mới `report_signers`: `template` (báo cáo áp dụng, VD `TRADE_REPORT`), `slot` (vị trí ký), `employee_id` (nhân sự ký, chọn từ danh sách nhân viên), `sort_order`.
- 3 vị trí mặc định cho Báo cáo thương mại: **LẬP BIỂU** · **BP. KINH DOANH** · **LÃNH ĐẠO ĐƠN VỊ**.
- Giao diện: **tab "Chữ ký báo cáo" trong Danh mục hệ thống** (cùng chỗ Trạm / Nhóm hàng / Kho / Nhóm KH / Quy đổi) — chọn người cho từng vị trí.
- Khi xuất Excel: tự điền tên theo cấu hình; vị trí nào chưa cấu hình thì để trống để ký tay sau khi in.

## 5. Công thức & quy tắc làm tròn

```
đơn giá chưa thuế  = round( giá bán ÷ (1 + r) )          ← làm tròn đến đồng
doanh thu chưa thuế = đơn giá chưa thuế × số lượng
tiền thuế           = thành tiền bán − doanh thu chưa thuế
```

Ví dụ (Vỉ 500ml, 98.000₫, r = 8%, SL = 133):

| Bước | Kết quả |
| :--- | ---: |
| Đơn giá chưa thuế | 90.740,74 → **90.741₫** |
| Doanh thu chưa thuế | **12.068.553₫** |
| Thành tiền bán | 13.034.000₫ |
| Tiền thuế | **965.447₫** |

> Làm tròn ở **bước đơn giá** (không làm tròn ở bước tổng) để khớp đúng cách lập báo cáo hiện nay.

## 6. Quy tắc áp thuế suất

1. Khi lập đơn: lấy thuế suất **hiệu lực tại `order_date`** của từng mặt hàng theo danh mục; ghi vào dòng hàng (snapshot).
2. Hiển thị thuế suất + tiền thuế trên đơn để người dùng kiểm tra; **cho phép sửa tay** trường hợp đặc biệt — sửa xong lưu lại vào đơn.
3. Hóa đơn lấy theo đơn; có thể sửa; lưu vào hóa đơn.
4. **Phạm vi áp dụng: mọi đơn thu tiền đều tính doanh thu và đều tính thuế** — tức đơn bán (`SALE`) và đơn đi mượn (`BORROW_IN`, hàng mượn về giao cho khách thu tiền).
5. **Không áp thuế**: đơn cho mượn (`LEND_OUT`), đơn đã hủy, và dịch vụ (không lên đơn hàng).

## 7. Khi thuế suất thay đổi (vận hành, không cần code)

1. Vào *Danh mục hệ thống → Thuế suất VAT* → thêm dòng mới: 10%, hiệu lực từ 01/01/2027 (đóng dòng 8% bằng `effective_to = 31/12/2026`).
2. Đơn lập từ 01/01/2027 tự lấy 10%: 48.000₫ → 43.636₫ + thuế 4.364₫.
3. Đơn cũ **giữ nguyên 8%** đã snapshot: 48.000₫ → 44.444₫ + thuế 3.556₫ → báo cáo hai kỳ không lệch nhau.

## 8. Báo cáo & xuất Excel

- **Tab Doanh thu:** thêm chế độ xem **"Doanh thu chưa VAT"** + cột **"Thuế GTGT"**, tính từ snapshot của từng đơn (mặc định vẫn xem theo giá bán).
- Vì số suy ngược từ snapshot nên **xem lại kỳ cũ luôn đúng**, không bị đổi khi thuế thay đổi.

### 8.1. Mẫu "Báo cáo thương mại" xuất ra file Excel

Bám theo đúng file `excel/Nước thương mại.xlsx` (sheet `Báo cáo`), **khổ A4 ngang**, vùng in `A1:O24`:

| Khối | Nội dung |
| :--- | :--- |
| Tiêu đề (dòng 1–2, gộp ô trái A:F — quốc hiệu H:O) | *CÔNG TY CP NƯỚC SẠCH QUẢNG NINH* / *XÍ NGHIỆP NƯỚC HỒNG GAI* và *CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM* / *Độc lập - Tự do - Hạnh phúc* |
| Tên báo cáo (dòng 4, gộp A:O) | *BÁO CÁO THƯƠNG MẠI NƯỚC ION KIỀM QAROMI* |
| Kỳ báo cáo (dòng 5, gộp A:O) | *Tháng MM/YYYY* |
| Dòng đơn giá chưa VAT | 6 mức giá suy ngược theo thuế suất hiệu lực của kỳ |
| Bảng số liệu | 6 nhóm hàng, mỗi nhóm gộp 2 tầng cột **SL / DT**, cột **Tổng cộng** cuối bảng; các dòng *I. Thực hiện tháng* (Tổng, XNN Hồng Gai) và *II. Lũy kế* (Tổng = lũy kế trước + thực hiện tháng, XNN Hồng Gai) |
| Khối chữ ký | 3 cột gộp: *LẬP BIỂU* (A:D) · *BP. KINH DOANH* (F:I) · *LÃNH ĐẠO ĐƠN VỊ* (L:O); **tên người ký lấy tự động theo cấu hình** (mục 4.5), chưa cấu hình thì để trống |

- Định dạng: khổ ngang, lề theo mẫu (trái 0,29" / phải 0,17" / trên 0,26" / dưới 0,75"), số phân cách nghìn, không hiển thị phần thập phân.
- Kỹ thuật đề xuất: route API sinh file bằng **`exceljs`** (đã có trong dự án) + nút **"Xuất Excel"** ở tab Doanh thu; nội dung khớp từng ô với mẫu, có thể in trực tiếp.
- Doanh thu trên báo cáo = **SL × đơn giá chưa VAT** (làm tròn đồng ở bước đơn giá), không phải giá bán trên đơn.

## 9. Dữ liệu cũ (migration một lần, idempotent)

- Với đơn chưa có snapshot (`vat_rate = 0`): gán thuế suất **hiệu lực tại `order_date`** (hiện tại là 8%) và tính `vat_amount`/từng dòng.
- Phạm vi: **chỉ đơn thu tiền** (`SALE`, `BORROW_IN`) và **chưa hủy**; bỏ qua đơn cho mượn và đơn đã hủy.
- Chạy trong `db.ts` như các migration hiện có; đơn đã có snapshot thì bỏ qua.

## 10. Phạm vi triển khai (khi được duyệt)

| Khu vực | Việc |
| :--- | :--- |
| `schema.sql`, `db.ts` | Bảng `vat_rates`; cột `products.vat_rate_id`, `order_items.vat_rate`, `orders.vat_amount`; seed nhóm thuế + migration đơn cũ |
| Danh mục hệ thống | Tab **Thuế suất VAT** — quản lý thuế suất theo thời hiệu |
| Danh mục hệ thống | Tab **Chữ ký báo cáo** — gán người cho *LẬP BIỂU · BP. KINH DOANH · LÃNH ĐẠO ĐƠN VỊ* |
| Sản phẩm | Chọn nhóm thuế (mặc định *Nước uống đóng bình/chai*; dịch vụ không gắn) |
| Đơn hàng | Snapshot thuế suất theo ngày đơn, hiển thị VAT, cho sửa tay |
| Hóa đơn | Sửa công thức tính thuế theo mô hình giá gồm VAT |
| Doanh thu | Chế độ xem "Chưa VAT" + cột thuế |
| Xuất Excel | Route sinh file báo cáo thương mại khổ ngang, đủ khối chữ ký, khớp mẫu |

## 11. Điểm mở cần chốt

1. Số **lũy kế** lấy từ đâu: cộng dồn từ đầu năm theo dữ liệu phần mềm, hay cho phép nhập số lũy kế trước kỳ (để khớp sổ đang chạy tay).

> Đã chốt: người ký lấy từ **tab cấu hình Chữ ký báo cáo** (mục 4.5) — không cần chọn tay mỗi lần xuất.
