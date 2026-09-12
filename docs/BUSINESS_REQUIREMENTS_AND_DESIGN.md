# ĐẶC TẢ NGHIỆP VỤ & THIẾT KẾ CHI TIẾT (BUSINESS SPECS & DESIGN)
## Căn cứ nghiên cứu từ 3 File Excel Thực Tế của Xí Nghiệp Nước Hồng Gai
**Dự án:** QAROMI ERP - Phần Mềm Quản Lý Bán Hàng & Điều Hành Doanh Nghiệp  
**Thương hiệu:** Nước uống tinh khiết & ion kiềm cao cấp QAROMI

---

## 1. Nguồn Gốc & Hiện Trạng Nghiệp Vụ

Trước khi phát triển phần mềm, toàn bộ hoạt động điều hành sản xuất, kinh doanh và phân phối của **Xí nghiệp Nước Hồng Gai (QUAWANCO)** được quản lý thông qua 3 file bảng tính Excel chính:

1. **File 1:** `ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa.xlsx`
   - Quản lý nhật ký xuất bán nước hàng ngày.
   - Phân bổ đơn hàng cho các Shipper / lái xe điện (Phương lái xe điện, Khoa trạm Hồng Gai, Hưng trạm Hà Lầm, Xuân trạm Hà Tu...).
   - Tính toán tiền cước vận chuyển bốc xếp (đơn giá ~5.000₫/bình hoặc tính theo chuyến).
   - Theo dõi xuất hóa đơn VAT điện tử cho các cơ quan, trường học, bệnh viện, doanh nghiệp trên địa bàn Hạ Long.

2. **File 2:** `XNT T9.hương -Nhung.xlsx` (Xuất - Nhập - Tồn & Sổ Vỏ Bình)
   - Theo dõi cân đối Xuất - Nhập - Tồn tại 6 kho khác nhau.
   - **Sổ theo dõi nợ vỏ bình khách hàng:** Phân tách rõ rệt 2 loại vỏ:
     - **Vỏ Bình Vòi (VB T9):** Dùng cho bình có vòi mở nước trực tiếp.
     - **Vỏ Bình Úp (VB T8):** Dùng cho cây nước nóng lạnh (cổ bình úp không vòi).
   - Theo dõi công nợ vỏ giữa xí nghiệp với các đơn vị khách hàng lớn (Công ty Than Hóa chất Mỏ, UBND Tỉnh, Ngân hàng SHB, Hanet, Luxury...).
   - **Sổ theo dõi vay mượn liên chi nhánh:** Quản lý hàng và vỏ luân chuyển với Xí nghiệp Cẩm Phả, Bãi Cháy, Miền Đông, Móng Cái, Văn phòng Tổng công ty.

3. **File 3:** `THEO DÕI CHỈ TIÊU DVGT CBCNV.xlsx` (Dịch Vụ Gia Tăng & KPI)
   - Theo dõi định mức thi đua sản lượng tiêu thụ nước uống QAROMI của từng CBCNV.
   - Theo dõi chỉ tiêu và doanh thu **Dịch Vụ Gia Tăng (DVGT)**:
     - Vệ sinh bảo dưỡng bình nóng lạnh (Bình NL).
     - Vệ sinh hệ thống cấp nước / súc rửa bể chứa ngầm, téc nước inox (VS HTCN).
     - Vệ sinh máy giặt, thay thế cụm đồng hồ đo nước.
   - Tính toán tỷ lệ hoàn thành KPI tháng/quý của các Trạm (Hồng Gai, Cao Xanh, Hà Tu, Hà Lầm, Đá Trắng) và từng cá nhân.

---

## 2. Chuẩn Hóa Danh Mục Mặt Hàng & Chính Sách Giá QAROMI

Dựa trên dữ liệu thực tế, hệ thống đã chuẩn hóa danh mục sản phẩm chính thức:

| STT | Mã Mặt Hàng | Tên Sản Phẩm | Quy Cách Đóng Gói | Giá Bán Chuẩn | Tiền Cọc Vỏ | Cơ Chế Quản Lý Vỏ |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | `RO_19L_VOI` | Nước tinh khiết RO QAROMI (Vòi) | Bình 19 Lít | **48.000₫** | 50.000₫ | Quản lý vòng quay nợ vỏ (Vỏ Vòi) |
| 2 | `RO_19L_UP` | Nước tinh khiết RO QAROMI (Úp) | Bình 19 Lít | **48.000₫** | 50.000₫ | Quản lý vòng quay nợ vỏ (Vỏ Úp) |
| 3 | `KIEM_19L_VOI`| Nước ion kiềm QAROMI (Vòi) | Bình 19 Lít | **52.000₫** | 50.000₫ | Quản lý vòng quay nợ vỏ (Vỏ Vòi) |
| 4 | `KIEM_19L_UP` | Nước ion kiềm QAROMI (Úp) | Bình 19 Lít | **52.000₫** | 50.000₫ | Quản lý vòng quay nợ vỏ (Vỏ Úp) |
| 5 | `VI_350ML` | Nước chai QAROMI 350ml | Vỉ 6 chai (màng co) | **85.000₫** | 0₫ | Bán đứt không cọc vỏ |
| 6 | `HOP_350ML` | Nước chai QAROMI 350ml | Hộp/Thùng 24 chai (4 vỉ) | **93.000₫** | 0₫ | Bán đứt không cọc vỏ |
| 7 | `VI_500ML` | Nước chai QAROMI 500ml | Vỉ 6 chai (màng co) | **98.000₫** | 0₫ | Bán đứt không cọc vỏ |
| 8 | `HOP_500ML` | Nước chai QAROMI 500ml | Hộp/Thùng 24 chai (4 vỉ) | **106.000₫** | 0₫ | Bán đứt không cọc vỏ |
| 9 | `DVGT_BINH_NL`| DV Vệ sinh bảo dưỡng bình nóng lạnh | Lần / Chiếc | **150.000₫** | 0₫ | Dịch vụ gia tăng tính KPI |
| 10 | `DVGT_VS_TEC` | DV Súc rửa bể chứa nước, téc nước | Lần / Bể | **250.000₫** | 0₫ | Dịch vụ gia tăng tính KPI |

> **Chính Sách Khuyến Mại (10 + 1 / KM):**
> Trong các đợt phát động thị trường, đơn vị thường xuyên áp dụng chính sách mua 10 bình tặng 1 vỉ hoặc mua 10 vỉ tặng 1 vỉ (`10+1`).
> - Số lượng hàng tặng (`quantity_promo`) được **trừ trực tiếp vào tồn kho thực tế** tại kho xuất.
> - Số lượng này **không tính tiền doanh thu** (đơn giá = 0₫), đảm bảo số liệu kế toán và thủ kho khớp 100%.

---

## 3. Mạng Lưới 6 Kho Hàng Thực Tế

Khác với các phần mềm bán hàng đơn kho, xí nghiệp vận hành 6 kho bãi với chức năng riêng biệt:
1. **Kho Tăng Áp (Kho Trạm Tăng Áp):**
   - Kho trung tâm đặt tại xưởng sản xuất, tiếp nhận nước lọc qua hệ thống RO và dây chuyền chiết rót tự động.
   - Lưu trữ số lượng lớn bình 19L thành phẩm chờ phân phối.
2. **Kho Huế (Kho Tổ Thị Trường / Cửa Hàng):**
   - Đặt tại khu vực trung tâm buôn bán sầm uất, do nhân sự phụ trách thị trường quản lý.
   - Tiếp nhận bình nước từ Kho Tăng Áp để xuất bán lẻ và bán đại lý nhanh.
3. **Kho Văn Phòng (Kho VP):**
   - Đặt tại trụ sở cơ quan Xí nghiệp Nước Hồng Gai.
   - Phục vụ cấp nước nội bộ cho các phòng ban, tiếp khách và khách vãng lai mua trực tiếp.
4. **Kho Xe Tải Điện (Tồn Trên Xe):**
   - Kho di động trực tiếp trên thùng xe tải điện do lái xe Phương phụ trách.
   - Mỗi đầu ca, lái xe bốc 50-100 bình từ Kho Tăng Áp lên xe; cuối ca đối soát số bình đã giao, số tiền thu về và số bình còn tồn trên sàn xe.
5. **Kho Trạm Đá Trắng:**
   - Trạm trung chuyển cấp nước cho khu vực Đá Trắng, Hà Khánh.
6. **Kho Vỏ Bình Rỗng:**
   - Điểm tập kết vỏ bình thu hồi từ khách hàng về (phân loại riêng vỏ vòi và vỏ úp).
   - Kiểm định chất lượng vỏ, súc rửa áp lực trước khi đưa vào dây chuyền chiết rót lại.

---

## 4. Quản Lý Vòng Quay & Sổ Nợ Vỏ Bình Khách Hàng

### 4.1. Bản Chất Nghiệp Vụ
Vỏ bình 19L là tài sản luân chuyển có giá trị cao của xí nghiệp (giá trị vỏ mới ~50.000₫/vỏ). Khách hàng khi đổi nước phải trả lại đúng số lượng vỏ bình rỗng tương ứng. Trường hợp khách chưa có vỏ trả hoặc lấy thêm bình thì xí nghiệp phải ghi nhận vào **Sổ nợ vỏ**.

### 4.2. Công Thức Tính Sổ Nợ Vỏ Chuẩn Hóa
$$	ext{Nợ Vỏ Kỳ Này} = 	ext{Nợ Vỏ Kỳ Trước} + 	ext{Số Vỏ Xuất Giao Mới} - 	ext{Số Vỏ Khách Trả Lại}$$

### 4.3. Quy Tắc Tách Bạch Vỏ Vòi (VB T9) và Vỏ Úp (VB T8)
Hệ thống không được gộp chung số lượng vỏ vì:
- Vỏ bình vòi chỉ lắp được vòi xả gạt tay, khách hàng dùng gia đình/văn phòng không có cây nước nóng lạnh.
- Vỏ bình úp có nắp chuyên dụng dùng cắm vào cọc máy làm nóng lạnh.
- Hai loại bình này không thể dùng thay thế cho nhau tại cơ sở khách hàng.
$ightarrow$ Do đó, trong CSDL, Form lập đơn, Bảng chi tiết khách hàng và Sổ nợ vỏ đều có **2 cột độc lập**:
- `bottle_debt_voi` (Nợ vỏ vòi - VB T9)
- `bottle_debt_up` (Nợ vỏ úp - VB T8)

---

## 5. Mạng Lưới Luân Chuyển & Vay Mượn Liên Chi Nhánh

Thực tế đơn vị thường xuyên phát sinh nghiệp vụ vay mượn hàng hóa, vỏ bình với các chi nhánh trong cùng Tổng công ty QUAWANCO:
- **Xí nghiệp Nước Cẩm Phả:** Thường nhập bổ sung bình nước thành phẩm hoặc vỏ bình.
- **Xí nghiệp Nước Bãi Cháy:** Vay mượn chéo khi một bên quá tải đơn hàng du lịch/khách sạn.
- **Xí nghiệp Nước Miền Đông / Móng Cái / Uông Bí:** Vay vỏ phục vụ các hợp đồng công trường lớn.
- **Văn phòng Tổng Công Ty:** Điều chuyển và tiếp nhận chỉ tiêu.

Phần mềm hỗ trợ quản lý phiếu vay mượn hai chiều:
- `TAKE_LOAN`: Xí nghiệp Hồng Gai đi vay của đơn vị bạn.
- `GIVE_LOAN`: Xí nghiệp Hồng Gai cho đơn vị bạn mượn hàng.
- Theo dõi chặt chẽ ngày mượn, hạn phải trả, người vận chuyển và cảnh báo các phiếu quá hạn hoàn trả.

---

## 6. Phân Biệt Hai Luồng Nhân Sự: Seller vs Shipper

| Tiêu Chí | Người Vận Động / Bán Hàng (Seller) | Người Vận Chuyển / Giao Nhận (Shipper) |
| :--- | :--- | :--- |
| **Đối tượng** | Cán bộ nhân viên các phòng ban, các Trạm cấp nước (Lan, Thư, Hương, Dung, Xuân, Huyền...) | Đội ngũ lái xe tải điện (Phương), nhân viên trạm phụ trách xe máy (Khoa, Hưng, Xuân...) |
| **Quyền lợi** | Hưởng hoa hồng theo doanh số bán nước; Doanh số được cộng dồn vào **Chỉ tiêu KPI cá nhân/Trạm**. | Hưởng **Phí vận chuyển bốc xếp** (mặc định 5.000₫/bình hoặc theo chuyến đường dài). |
| **Trách nhiệm** | Tìm kiếm khách hàng, mở đại lý, chăm sóc quan hệ khách hàng. | Vận chuyển an toàn, thu tiền mặt nộp về thủ quỹ và **thu hồi đủ 100% vỏ bình rỗng** nộp về kho. |

---

## 7. Dịch Vụ Gia Tăng (DVGT) & Đánh Giá KPI Hàng Tháng

Ngoài bán nước đóng bình, toàn thể CBCNV Xí nghiệp Nước Hồng Gai còn được giao chỉ tiêu phát triển các dịch vụ tiện ích cho khách hàng dùng nước sạch:
1. **Dịch vụ vệ sinh bảo dưỡng bình nóng lạnh:** Súc rửa cặn canxi, thay thanh magie, kiểm tra rò điện.
2. **Dịch vụ súc rửa bể ngầm & téc nước:** Bơm xả cặn, tẩy rửa khử khuẩn bể chứa gia đình và cơ quan.
3. **Dịch vụ kỹ thuật cấp nước:** Kiểm tra rò rỉ đường ống, di dời hộp công tơ nước.

Hệ thống cung cấp phân hệ **Quản lý KPI**:
- Thiết lập chỉ tiêu đầu tháng cho từng Trạm và từng nhân viên.
- Tự động tổng hợp số lượng bình nước QAROMI bán được và số lượt DVGT thực hiện thành công trong tháng.
- Tính toán tỷ lệ hoàn thành (`% Hoàn thành = Thực tế / Kế hoạch * 100`).
- Xếp loại thi đua (Xuất sắc, Tốt, Đạt, Cần cố gắng) làm căn cứ chi trả lương năng suất.

---

## 8. Chuẩn Màu Sắc Thương Hiệu QAROMI (Brand Guidelines)

Giao diện được thiết kế chuẩn xác theo mã màu trích xuất từ file logo chính thức `D:\PROJECT\Agentic-AI\QLBanHang\logo.png`:

- **Màu Xanh Tím Đậm (Midnight Navy - `#1B1B4B`):** Dùng cho thanh Menu bên trái (Sidebar), Header bảng điều khiển và Header các Modal. Tạo cảm giác vững chãi, uy tín của doanh nghiệp nhà nước cấp nước sạch.
- **Màu Tím Than Hoàng Gia (Royal Indigo - `#2C2C6B`):** Dùng cho các thẻ thống kê chính, nút hành động chính (Primary Action Button), tiêu đề phân mục.
- **Màu Xanh Dương Hồ Thủy (Cyan Water - `#50ADDE`):** Màu của dòng nước tinh khiết QAROMI. Dùng cho đường viền nhấn, link điều hướng, icon nổi bật và trạng thái Active.
- **Màu Đỏ Cờ Thương Hiệu (Crimson Red - `#C62430`):** Màu ngôi sao/ngọn lửa trong logo QAROMI. Dùng cho cảnh báo tồn kho cấp bách, thông báo nợ quá hạn và nút Hủy/Xóa.
- **Màu Vàng Nhạt Điểm Xuyết (Soft Amber - `#FFFBB2`):** Màu ánh sáng trong logo. Dùng làm màu nền nhấn cho các huy hiệu VIP, cảnh báo cần chú ý.
