# HỒ SƠ THIẾT KẾ: ĐỒNG BỘ PHẦN MỀM VỚI THỰC TẾ VẬN HÀNH
## QAROMI ERP — Phiên bản 3.0 (Reality Alignment)
**Đơn vị:** Xí Nghiệp Nước Hồng Gai — QUAWANCO
**Căn cứ:** giải mã 3 file Excel vận hành thực tế (`excel/`) — 22 sheet, đọc cả công thức
**Trạng thái:** DỰ THẢO CHỜ DUYỆT — chưa triển khai mã nguồn

---

## 1. Quyết định đã chốt

| # | Vấn đề | Quyết định |
| :---: | :--- | :--- |
| 1 | Mô hình nhập liệu | **Lai:** lõi dữ liệu chuẩn hoá + lớp **nhập nhanh kiểu bảng tính** và **khách nhanh** cho khách lẻ |
| 2 | Sản phẩm & giá | **6 SKU nước**; bỏ tách Vòi/Úp khỏi mặt hàng (Vòi/Úp chỉ là thuộc tính vỏ khi giao); giữ quy đổi **vật lý** 1 Hộp = 4 Vỉ = 24 chai nhưng **không dùng để suy giá** |
| 3 | Bảng giá chuẩn | Lấy sheet **`Đơn giá`** làm nguồn chân lý |
| 4 | "Thùng" vs "Hộp" | Là **một quy cách** (6 SKU, không tách) |
| 5 | KPI | **Doanh thu theo tháng so với kế hoạch NĂM/người**; báo cáo theo Trạm/Phòng; bỏ xếp loại A/B/C và thưởng tự chế |
| 6 | Kênh doanh thu | **Có**, là trường **bắt buộc** trên mọi lượt bán |
| 7 | Doanh thu DVGT | **Nhập tự do** khi hoàn thành (đã gồm VAT), không cần bảng giá dịch vụ cố định |
| 8 | Nhân sự | **Nhập đủ ~202 CBCNV** để giao chỉ tiêu và báo cáo |

### Bảng giá chuẩn (6 SKU)

| Mã | Mặt hàng | Quy cách | ĐVT | Giá bán |
| :--- | :--- | :--- | :--- | ---: |
| `VI_500` | Vỉ 500ml | 6 chai | Vỉ | 98.000₫ |
| `VI_350` | Vỉ 350ml | 6 chai | Vỉ | 85.000₫ |
| `HOP_500` | Hộp/Thùng 500ml | 24 chai (4 vỉ) | Hộp | 106.000₫ |
| `HOP_350` | Hộp/Thùng 350ml | 24 chai (4 vỉ) | Hộp | 93.000₫ |
| `KIEM_19L` | Bình ion kiềm 19L | 19 lít | Bình | 52.000₫ |
| `RO_19L` | Bình RO 19L | 19 lít | Bình | 48.000₫ |

> ✅ **Đã xác nhận:** Hộp/Thùng = **24 chai (4 vỉ)**; 106.000₫ / 93.000₫ là **giá bán theo hộp**, giữ nguyên theo sheet `Đơn giá`.
> **Lưu ý thiết kế:** quy đổi **vật lý** 1 Hộp = 4 Vỉ = 24 chai là đúng, nhưng **giá Hộp không suy ra từ giá Vỉ**
> (106.000₫ ≠ 4 × 98.000₫) → chỉ dùng quy đổi để **đổi đơn vị số lượng**, không dùng để tính giá.

---

## 1.1. Quy tắc nghiệp vụ đã làm rõ

### Phạm vi quản lý và kênh
- Phần mềm **chỉ quản lý phần thuộc Xí nghiệp**.
- **"Công ty" và các đơn vị bạn** (Bãi Cháy, Miền Đông, Diễn Vọng, Quảng Yên, Cẩm Phả, Móng Cái…) được hiểu là **đơn vị đang vay mượn/nhận hàng từ xí nghiệp**. Phần liên quan đến các đơn vị này **không thuộc phạm vi quản lý doanh thu** của phần mềm.
- Do đó mỗi kênh cần cờ **`counts_for_kpi`**:
  - `Xí nghiệp` → **có** tính vào chỉ tiêu bán hàng.
  - Đơn vị bạn → **không** tính vào chỉ tiêu bán hàng của xí nghiệp; ghi nhận như **phiếu cho vay / gửi bán** gắn với chi nhánh tương ứng.

### Phân bổ doanh thu và công vận chuyển
- **Doanh thu bán hàng** gán cho người ở cột **Chỉ tiêu CBCNV** (người bán), và **chỉ tính** khi kênh thuộc xí nghiệp.
- **Công vận chuyển** tính cho **người thực hiện / người vận chuyển**, **chia đều** cho mọi người có tên trong ô (ví dụ "Phương + Huế" chia đôi), **không phụ thuộc kênh** — miễn người đó thuộc xí nghiệp.
- Kho **Lại Lan** là **kho chính thức, có tồn riêng**.

---

## 2. Đối chiếu thực tế ↔ phần mềm (phát hiện chính)

### 2.1. Hiểu sai cần sửa
1. **"VB T9" / "VB T8" là sổ vỏ theo KỲ** (tháng 9 / tháng 8), không phải "T9 = Vòi, T8 = Úp". Cả hai sheet đều có đồng thời cột **Úp** và **Vòi**, kèm dòng **"Báo cáo chuẩn"** để đối chiếu chênh lệch. Tài liệu cũ mô tả sai nguồn gốc (việc tách Vòi/Úp vẫn đúng, nhưng lý do và cách gọi sai).
2. **Giá Hộp không suy từ giá Vỉ**: Vỉ 500ml = 98.000₫ nhưng Hộp 500ml (24 chai = 4 vỉ) = 106.000₫, không phải ~392.000₫. Quy đổi vật lý 1 Hộp = 4 Vỉ là **đúng**, nhưng **không được dùng để tính giá**.
3. **Vòi/Úp không phải mặt hàng**: thực tế chỉ bán "Bình RO" và "Bình ion kiềm"; Vòi/Úp được ghi ở sổ vỏ khi giao.
4. Bảng giá nhúng trong sheet `CBCNV` bị **đảo nhãn Hộp 350 ↔ Hộp 500** (lỗi tiêu đề, không ảnh hưởng số tiền).

### 2.2. Khái niệm thực tế phần mềm còn thiếu
5. **Kênh/Đơn vị hưởng doanh thu** (cột `Chỉ tiêu`): Xí nghiệp, Công ty, Bãi Cháy, Miền Đông, Diễn Vọng, Quảng Yên, nội bộ công ty, Cẩm Phả… Đây là trục báo cáo quan trọng nhất.
6. **Ba vai trò người trên một lượt giao**: Người thực hiện, Hỗ trợ (trạm QL), Người vận chuyển — thường **ghép nhiều người trong một ô** ("Phương + Huế", "Tùng + Huế + Huy").
7. **Loại công việc**: `Vận chuyển` / `Bốc xếp` và cột `Kết quả` (đã hoàn thành / hoàn thành / trống).
8. **Phí vận chuyển 5.000₫/đơn vị**, tổng hợp theo người theo tháng.
9. **Thanh toán là ghi chú tự do**: "CK11/9", "TM11/9", "công ty thu tiền", "Bãi Cháy tự thu".
10. **Vay mượn chi nhánh ghi bằng ghi chú ngay trên dòng bán** ("CÔNG TY VAY", "BÃI CHÁY VAY", "vay công ty") — không phải phiếu riêng.
11. **Sổ vỏ theo kỳ** có: Nợ cũ → Nhập → Trả vỏ → Nợ mới, tách Úp/Vòi, thêm **Trả XN**, **ĐẶT CỌC**, và **người nợ vỏ gồm cả nhân viên nội bộ**.
12. **Tồn vỏ rỗng theo kho** ("Tồn kho Cao Xanh 15, Hồng Hải 10, VPXN 7").
13. **Kho "Lại Lan"** — kho đặt tại nhà nhân viên.
14. **Nhập hàng từ Cẩm Phả** (sheet `nhập từ CP`) vào Kho Tăng Áp và Kho Huế.
15. **Lịch trực bảo vệ theo tháng** và **thứ tự điều phối tổ** (Tiếp thị → Dịch vụ → Bảo vệ → Trạm QL).
16. **KPI thật**: kế hoạch năm 1.592.834.000₫ chia cho ~202 CBCNV (~7.885.317₫/người/tháng), theo dõi doanh thu tháng và **% hoàn thành kế hoạch năm**; báo cáo theo Trạm và theo BPKD. Không có xếp loại/thưởng.
17. **DVGT thật có 5 loại**: Bể, Téc, Bể+téc, Máy giặt, Bình nóng lạnh — kèm *người vận động*, *hình thức đăng ký* (XN/SCC/CT/KD/HB/DV…), *trạng thái nộp phiếu* (đã có phiếu / Hủy), ngày hẹn, "khách book".
18. **Cơ cấu tổ chức thật** gồm Phòng (KT, KD, TC, QT, Đảng…), Tổ (Dịch vụ, Bảo vệ, Tiếp thị) và Trạm — không chỉ 7 trạm.

---

## 3. Thiết kế dữ liệu đề xuất

### 3.1. Bảng mới
| Bảng | Mục đích | Trường chính |
| :--- | :--- | :--- |
| `revenue_channels` | Kênh/đơn vị hưởng doanh thu | `code`, `name`, `kind` (`ENTERPRISE`/`PARTNER`/`INTERNAL`), `counts_for_kpi`, `partner_branch_id` |
| `departments` | Cơ cấu tổ chức | `code`, `name`, `type` (`PHONG`/`TO`/`TRAM`/`VP`), `parent_id` |
| `service_types` | Loại dịch vụ gia tăng | `code`, `name`, `default_price`, `is_active` |
| `shell_balances` | Tồn vỏ rỗng theo kho | `warehouse_id`, `bottle_type` (`VOI`/`UP`), `quantity` |
| `bottle_ledger_lines` | Sổ vỏ theo kỳ | `period` (YYYY-MM), `subject_type` (`CUSTOMER`/`EMPLOYEE`/`INTERNAL`), `subject_id`, `opening_*`, `in_*`, `returned_*`, `returned_to_enterprise_*`, `closing_*`, `deposit_amount` |
| `delivery_lines` | Lượt giao / bốc xếp | `order_id`, `work_type`, `result`, `shipping_fee`, `note` |
| `delivery_line_workers` | Nhiều người trên một lượt | `delivery_line_id`, `role` (`PERFORMER`/`CARRIER`), `employee_id`, `fee_share` (chia đều công vận chuyển) |
| `shift_schedules` | Lịch trực | `department_id`, `duty_date`, `shift`, `employee_id`, `note` |
| `dispatch_priorities` | Thứ tự điều phối tổ | `department_id`, `priority_order` |
| `kpi_plans` | Kế hoạch doanh thu | `employee_id`, `year`, `month` (NULL = kế hoạch năm), `target_revenue` |

### 3.2. Bảng sửa đổi
| Bảng | Thay đổi |
| :--- | :--- |
| `products` | Rút về 6 SKU nước + dịch vụ; bỏ `bottle_type` như yếu tố phân biệt SKU, thay bằng `tracks_shell` (có quản lý vỏ hay không) |
| `product_conversions` | Giữ quy đổi **vật lý** (1 Hộp = 4 Vỉ = 24 chai) — **chỉ để đổi đơn vị số lượng, không dùng để suy giá** |
| `orders` | Thêm `revenue_channel_id` (**bắt buộc**), `is_quick_customer`, `customer_name`/`customer_phone`/`customer_address` (chụp nhanh cho khách lẻ), `collection_note` |
| `order_items` | Thêm `bottle_type` (`VOI`/`UP`, chọn khi giao, nullable) |
| `employees` | Thêm `department_id` (giữ `station_id` để tương thích khi chuyển đổi) |
| `customers` | Thêm `is_quick` (khách lẻ, mã tiền tố `KHL`) |
| `stock_movements` | Thêm `partner_branch_id` (phục vụ nhập hàng từ Cẩm Phả) |
| `dvgt_requests` | Dùng `service_types`; thêm `referrer_employee_id` (người vận động), `registration_channel`, `doc_status` (`NO_DOC`/`HAS_DOC`/`CANCELLED`) |
| `kpi_evaluations` | Chuyển thành **thực tế theo tháng so với `kpi_plans`**; bỏ `grade`, `bonus_amount` (hoặc đưa vào cấu hình) |

---

## 4. Thiết kế nghiệp vụ & luồng

### 4.1. Bán hàng (nhập nhanh)
1. Chọn **Kênh doanh thu** (bắt buộc) → chọn kho → ngày.
2. Khách: chọn từ danh mục **hoặc** tạo **khách nhanh** (tên/SĐT/địa chỉ tại chỗ, tự sinh mã).
3. Nhập dòng hàng trên **lưới kiểu bảng tính** (Tab/Enter, thêm dòng liên tục): 6 SKU, số lượng, số lượng KM (10+1), đơn giá tự điền theo bảng giá.
4. Với dòng có `tracks_shell`: chọn **Vòi / Úp** cho số vỏ giao.
5. Khai **lượt giao**: loại công việc (Vận chuyển/Bốc xếp), người thực hiện, người hỗ trợ, người vận chuyển — **cho phép nhiều người mỗi vai trò**; phí ship mặc định 5.000₫/đơn vị.
6. Ghi nhận thanh toán: trạng thái chuẩn + **ghi chú thu** (TM/CK/công ty thu/chi nhánh tự thu).
7. Nếu kênh **không phải Xí nghiệp** (đơn vị bạn) → ghi nhận là **cho vay / gửi bán**, **không tính vào chỉ tiêu bán hàng**, và **tự tạo phiếu vay mượn** gắn chi nhánh; **công vận chuyển vẫn tính** cho nhân viên xí nghiệp tham gia.

### 4.2. Sổ vỏ theo kỳ
- Mỗi kỳ tháng, mỗi đối tượng (khách hàng / nhân viên / nội bộ) có một dòng: `Nợ đầu kỳ → Nhập → Trả vỏ → Nợ cuối kỳ`, tách **Úp/Vòi**, kèm **Trả XN** và **ĐẶT CỌC**.
- Báo cáo **đối chiếu**: số liệu hệ thống vs "báo cáo chuẩn" thủ công, hiển thị **chênh lệch** để kiểm soát.
- Cho phép ghi **nợ vỏ nội bộ nhân viên** (vỏ tạm giữ trên xe/trên người).

### 4.3. KPI
- Khai `kpi_plans` kế hoạch **năm** cho từng nhân viên (nhập tổng kế hoạch và phân bổ, hoặc nhập từng người).
- Thực tế mỗi tháng = doanh thu dòng hàng gán theo nhân viên + doanh thu DVGT.
- Báo cáo: theo nhân viên (`doanh thu tháng`, `% kế hoạch năm`), theo **Trạm/Phòng**, theo **BPKD**.

### 4.4. Kho
- Tồn theo ngày × kho × SKU, có cột **thành tiền** (báo cáo kiểu XNT).
- **Tồn vỏ rỗng theo kho**; **phiếu nhập từ Cẩm Phả** (Kho Tăng Áp, Kho Huế); thêm kho **Lại Lan**.

### 4.5. Điều phối & nhân sự
- **Lịch trực bảo vệ** theo tháng và **thứ tự điều phối tổ**.
- Danh mục Phòng/Tổ/Trạm; hồ sơ ~202 CBCNV gắn phòng ban và chức danh.

---

## 5. Màn hình & báo cáo cần bổ sung

| Màn hình | Nội dung chính |
| :--- | :--- |
| Bán hàng (lưới nhanh) | Nhập nhiều dòng, khách nhanh, kênh bắt buộc, chọn vỏ, nhiều người/lượt |
| Giao hàng & phí vận chuyển | Danh sách lượt giao, tổng hợp phí ship theo người/tháng |
| Sổ vỏ theo kỳ | Bảng kỳ tháng, đối chiếu chuẩn/thực tế/chênh lệch, cọc, trả XN, nợ nội bộ |
| KPI doanh thu | Kế hoạch năm/người, % hoàn thành tháng, báo cáo theo Trạm/Phòng/BPKD |
| DVGT | 5 loại dịch vụ, kênh đăng ký, người vận động, trạng thái nộp phiếu |
| Kho (XNT ngày) | Tồn đầu/nhập/xuất/tồn cuối × kho × SKU, thành tiền |
| Tồn vỏ rỗng | Tồn theo kho × Vòi/Úp |
| Điều phối | Lịch trực bảo vệ, thứ tự điều phối tổ |
| Danh mục | Kênh doanh thu, Phòng/Tổ/Trạm, Loại dịch vụ, Kho (thêm Lại Lan) |

---

## 6. Chuyển đổi dữ liệu (Migration)

1. **Sản phẩm**: gộp `RO_19L_VOI` + `RO_19L_UP` → `RO_19L`; `KIEM_19L_VOI` + `KIEM_19L_UP` → `KIEM_19L`; giữ `VI_350/VI_500/HOP_350/HOP_500`; **xoá quy đổi 4:1**.
2. **Nhân sự**: import ~202 CBCNV từ sheet `XN`/`DATA` (họ tên, chức danh, tổ/trạm) và ánh xạ vào `departments`.
3. **Kênh**: tạo danh mục kênh; gán mặc định `XN` cho đơn cũ.
4. **Sổ vỏ**: số dư `bottle_debt_voi/up` hiện có → `opening_*` của kỳ gần nhất.
5. **Kho**: bổ sung kho Lại Lan; khởi tạo `shell_balances` từ số liệu tồn vỏ rỗng.
6. **Đối chiếu**: so sánh tổng doanh thu/tồn kho/số dư vỏ giữa hệ thống sau chuyển đổi và file Excel gốc theo từng tháng đã có dữ liệu.

---

## 7. Lộ trình triển khai (7 chặng)

| Chặng | Nội dung | Kết quả nghiệm thu |
| :---: | :--- | :--- |
| **1** | Danh mục & giá nền: 6 SKU, bảng giá `Đơn giá`, kênh doanh thu, phòng ban/tổ, loại dịch vụ, kho + Lại Lan | Danh mục khai báo được qua UI; bảng giá đúng |
| **2** | Bán hàng nhập nhanh: lưới bảng tính, khách nhanh, kênh bắt buộc, KM 10+1, chọn vỏ | Lập đơn nhiều dòng nhanh; tồn kho và doanh thu cập nhật đúng |
| **3** | Lượt giao & phí vận chuyển: nhiều người/vai trò, bốc xếp/vận chuyển, 5.000₫/đơn vị, tổng hợp tháng | Bảng phí ship theo người/tháng khớp file |
| **4** | Sổ vỏ theo kỳ: nợ đầu/nhập/trả/nợ cuối, tách Vòi/Úp, Trả XN, đặt cọc, nợ nội bộ, đối chiếu chênh lệch | Báo cáo đối chiếu hiển thị đúng chênh lệch |
| **5** | KPI doanh thu: kế hoạch năm/người, thực tế tháng, % hoàn thành, báo cáo Trạm/Phòng/BPKD | Bảng KPI khớp sheet `XN`/`BPKD` |
| **6** | DVGT, kho nâng cao, điều phối: 5 loại dịch vụ + kênh đăng ký; XNT ngày có thành tiền; tồn vỏ rỗng; nhập từ CP; lịch trực + thứ tự điều phối | Các báo cáo nghiệp vụ chạy đúng |
| **7** | Migration & đối chiếu: import 202 CBCNV, gộp SKU, gán kênh, chuyển số dư vỏ, đối chiếu với Excel | Số liệu khớp file gốc; bàn giao |

---

## 8. Điểm đã làm rõ & còn lại

### Đã làm rõ
- **"Xí nghiệp" vs "Công ty"**: xí nghiệp là phạm vi quản lý; "công ty" và các đơn vị bạn là bên **vay mượn / nhận hàng**, không thuộc phạm vi doanh thu → dùng cờ `counts_for_kpi`.
- **Phân bổ người**: doanh thu gán theo người bán (cột Chỉ tiêu CBCNV); **công vận chuyển chia đều** cho người thực hiện, **không phụ thuộc kênh**.
- **Kho Lại Lan**: kho chính thức, có tồn riêng.
- **DVGT**: doanh thu nhập tự do khi hoàn thành.
- **Nhân sự**: nhập đủ ~202 CBCNV.

### Đã xác nhận thêm
- **Hộp/Thùng = 24 chai (4 vỉ)**; giữ giá theo sheet `Đơn giá`.
- **"Nội bộ công ty"** = tiêu thụ **nội bộ xí nghiệp**, **thuộc phạm vi quản lý** (kênh `INTERNAL`, theo dõi tách riêng).
- **DVGT**: doanh thu nhập tự do, **không tách VAT**.

### Còn lại (không chặn triển khai)
1. **"Nội bộ công ty" có tính vào chỉ tiêu cá nhân hay không** — mặc định tách riêng khỏi doanh thu bán ra ngoài, xác nhận khi làm chặng 5.
2. **Khối lượng chuyển đổi lớn** (gộp SKU + 202 nhân sự + số dư vỏ) — cần backup và đối chiếu từng bước.
