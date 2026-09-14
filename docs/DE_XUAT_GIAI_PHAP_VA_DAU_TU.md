# HỒ SƠ GIẢI PHÁP & ĐỀ XUẤT ĐẦU TƯ
## Chuyển đổi số công tác quản lý & vận hành — Xí Nghiệp Nước Hồng Gai (QUAWANCO)

**Kính gửi:** Ban Giám đốc Xí Nghiệp Nước Hồng Gai
**Nội dung:** Giải pháp phần mềm quản lý bán hàng & điều hành — chuyển toàn bộ công việc đang làm trên 3 file Excel sang một hệ thống thống nhất.

---

## PHẦN A. THỰC TRẠNG HÔM NAY

Hiện xí nghiệp đang vận hành toàn bộ hoạt động trên **3 file Excel**, mỗi file do một đầu mối phụ trách:

| File | Dùng để làm gì | Ai dùng |
|---|---|---|
| **ĐIỀU PHỐI NƯỚC LỌC** | Nhật ký bán hàng hằng ngày, phân công giao hàng, tính phí vận chuyển, theo dõi chỉ tiêu từng người | Tổ thị trường, điều phối |
| **XNT (Xuất–Nhập–Tồn)** | Cân đối 6 kho, theo dõi nợ vỏ bình của khách và nội bộ | Thủ kho, kế toán |
| **THEO DÕI CHỈ TIÊU DVGT** | Đăng ký dịch vụ (bể, téc, máy giặt, bình nóng lạnh), theo dõi chỉ tiêu KPI | Tổ dịch vụ, ban KD |

### Những hệ quả đang gặp phải

1. **Một việc phải nhập nhiều lần.** Bán một đơn → gõ ở sheet `XUẤT`, rồi gõ lại vào sổ kho, rồi gõ tay vào sổ vỏ. Ba nơi, ba lần nhập, dễ lệch nhau.
2. **Công thức ngày càng phức tạp, dễ sai.** Doanh số từng người phải dùng `SUMIFS` sang file khác; thêm/ xoá một dòng là công thức lệch; không ai kiểm tra được vì "máy tính ra thế".
3. **Chỉ người tạo file mới hiểu file.** Đúng nghĩa đen: sheet `XUẤT` có 29 cột, sheet kho có 12 cột nhập + 12 cột xuất, cột "Chỉ tiêu" lúc ghi `XN` lúc ghi `Xí nghiệp`. Nghỉ phép một người là một mảng công việc bị đình trệ.
4. **Số liệu phân tán, không nhìn thấy toàn cảnh.** Muốn biết "hôm nay lãi bao nhiêu, kho nào sắp hết, ai còn nợ vỏ" phải mở nhiều file, nhiều sheet và tự cộng.
5. **Không truy vết được.** Sửa một ô là mất dấu vết cũ. Khi có tranh chấp (nợ vỏ, phí vận chuyển, tiền thu), không có căn cứ để đối chiếu.
6. **Rủi ro mất dữ liệu.** File Excel nằm rải rác trên máy cá nhân; hỏng máy/ virus/ nghỉ việc là mất hoặc thất lạc dữ liệu — dữ liệu của xí nghiệp nằm trong tay cá nhân.

> **Tóm lại:** Excel rất tốt để *bắt đầu*, nhưng khi quy mô đã gần **200 CBCNV**, **hàng trăm lượt giao mỗi tháng**, **hàng trăm yêu cầu dịch vụ**, thì Excel trở thành **điểm nghẽn và rủi ro**, chứ không còn là công cụ quản trị.

---

## PHẦN B. TRIẾT LÝ GIẢI PHÁP

Chúng tôi **không bán một phần mềm cứng**, cũng **không bê nguyên một hệ thống nước ngoài về bắt xí nghiệp làm theo**. Giải pháp được xây dựng theo 4 nguyên tắc:

1. **Đi từ chính công việc thật của xí nghiệp.** Mọi con số, mọi quy tắc đều lấy từ 3 file Excel đang dùng — kể cả những "quy tắc ngầm" như mua 10 tặng 1, chia đều phí cho người cùng đi giao, hay "Công ty" là đơn vị đi vay chứ không tính doanh thu xí nghiệp.
2. **Học cách tổ chức của hệ thống quản trị chuẩn (như Odoo) nhưng áp vào đúng nghiệp vụ của mình.** Nghĩa là: dùng cách làm đã được kiểm chứng (chứng từ có trạng thái, mọi biến động kho đều có "bút toán" đối ứng, quy đổi đơn vị, bảng giá…) — nhưng phần đặc thù (sổ vỏ, kênh doanh thu, KPI kế hoạch năm) thì làm riêng cho xí nghiệp.
3. **Không làm xáo trộn thói quen.** Người dùng vẫn gặp màn hình quen thuộc kiểu bảng tính, nhập nhanh bằng Tab/Enter — nhưng phía sau mọi thứ đã tự động liên kết.
4. **Mỗi vấn đề phải có giải pháp đo đếm được.** Không nói "giúp quản lý tốt hơn" chung chung, mà chỉ rõ: nhanh hơn ở bước nào, đúng hơn ở chỗ nào, tiết kiệm gì.

---

## PHẦN C. GIẢI PHÁP CHO TỪNG NHÓM VẤN ĐỀ

### C1. Nhóm vấn đề về QUẢN LÝ & ĐIỀU HÀNH

| # | Vấn đề hiện tại | Hệ quả | Giải pháp trong phần mềm | Lợi ích |
|---|---|---|---|---|
| 1 | Lãnh đạo muốn biết tình hình phải gọi hỏi, chờ tổng hợp | Quyết định chậm, phụ thuộc người tổng hợp | **Bảng điều khiển** hiện doanh thu, sản lượng, tồn kho, nợ vỏ, việc đang chờ xử lý — cập nhật tức thì | Nắm tình hình trong 1 màn hình, mọi lúc |
| 2 | Báo cáo phải tổng hợp tay từ nhiều sheet | Có sai sót, mất thời gian, số liệu "mỗi người một kiểu" | Mọi báo cáo tự sinh từ dữ liệu gốc, cùng một nguồn số | Báo cáo ngay khi cần, số liệu thống nhất |
| 3 | Không biết ai làm gì, việc nào đang chờ | Dễ sót đơn, chậm giao | Chứng từ có **trạng thái** (Báo giá → Đơn bán → Đã giao), danh sách "việc đang chờ" | Không sót việc, rõ trách nhiệm |
| 4 | Sửa số liệu không để lại dấu vết | Không giải trình được khi cần | Mọi thao tác sinh **nhật ký**; dữ liệu cũ giữ nguyên lịch sử | Truy vết được, minh bạch |
| 5 | Phân quyền chỉ ở "miệng", ai cũng sửa được file | Rủi ro cố ý/ vô ý sửa sai | Phân quyền theo vai trò: trạm trưởng, thủ kho, kế toán, điều phối… | Kiểm soát truy cập, trách nhiệm rõ |

### C2. Nhóm vấn đề về BÁN HÀNG & ĐIỀU PHỐI HẰNG NGÀY (nhiều vấn đề nhất)

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 6 | Mỗi dòng phải tự gõ đơn giá, tự nhân thành tiền | Nhập lâu; tính sai đơn giá | Chọn mặt hàng → **giá tự điền**, thành tiền tự tính | Nhập nhanh hơn, không tính sai |
| 7 | Khuyến mại 10+1 ghi tay, tự trừ kho | Ghi thiếu số KM → kho lệch; hoặc tính tiền cả hàng tặng | Có ô **SL** và ô **KM** riêng: hàng tặng vẫn trừ kho nhưng **không tính tiền** | Kho khớp, khách thấy rõ hàng tặng |
| 8 | Phí vận chuyển 5.000đ/đơn vị nhập tay từng dòng | Mất thời gian, dễ nhập thiếu/thừa | **Tự tính theo bảng giá cước**, không nhập tay | Đúng phí, không cãi nhau cuối tháng |
| 9 | Một lượt đi giao có nhiều người ("Phương + Huế") ghi chung 1 ô | Không biết chia phí cho ai, chia bao nhiêu | Ghi rõ **nhiều người**, hệ thống **chia đều** phần phí | Công bằng, rõ ràng, tự tổng hợp theo tháng |
| 10 | Doanh thu gán cho ai phải tự nhớ | Cộng sai doanh số, KPI lệch | Chọn **người bán** ngay trên đơn → doanh thu tự cộng đúng người | KPI chính xác, không tranh chấp |
| 11 | Kênh "Xí nghiệp" và "Công ty/Bãi Cháy/Miền Đông" lẫn lộn | Đơn đi vay bị tính vào chỉ tiêu xí nghiệp → KPI sai | Chọn **kênh doanh thu**; kênh ngoài xí nghiệp **tự động không tính chỉ tiêu** | Báo cáo đúng bản chất, không thổi phồng |
| 12 | Thanh toán ghi bằng ghi chú tự do ("CK11/9", "công ty thu tiền") | Khó đối chiếu tiền, khó biết ai đã thu | Có trạng thái thanh toán chuẩn **và** vẫn giữ ô ghi chú tự do | Đối chiếu tiền nhanh, không mất thông tin cũ |
| 13 | Vay mượn chi nhánh ghi bằng ghi chú trên dòng bán | Không thành phiếu, không biết còn nợ hay đã trả | Ghi nhận thành **phiếu vay/cho vay** riêng, có hạn trả, theo dõi quá hạn | Kiểm soát được công nợ liên chi nhánh |
| 14 | Tên khách/ sản phẩm gõ tự do, "Thùng" lẫn "Hộp" | Trùng khách, báo cáo lệch | Danh mục chuẩn + cho phép **tạo nhanh khách mới** ngay khi lập đơn | Dữ liệu sạch, vẫn nhập nhanh |
| 15 | Không biết hôm nay ai đi giao, theo thứ tự nào | Điều phối chồng chéo, thủ công | Có **lịch trực** và **thứ tự ưu tiên điều phối** ngay trên phần mềm | Điều phối rõ ràng, không quên lượt |

### C3. Nhóm vấn đề về KHO & XUẤT–NHẬP–TỒN

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 16 | Mỗi kho một sheet, muốn xem tổng phải tự cộng | Không nắm được tồn toàn hệ thống | **Một sổ kho chung**, xem được từng kho và tổng | Nắm tồn mọi lúc |
| 17 | Nhập/xuất ghi rời rạc, không có chứng từ | Không biết vì sao tồn lệch | Mọi biến động đều qua **phiếu nhập / phiếu xuất / phiếu chuyển**, có trạng thái | Truy được nguyên nhân mọi thay đổi tồn |
| 18 | Số tồn trên giấy và thực tế lệch, không đối chiếu | Thất thoát âm thầm | Có nghiệp vụ **kiểm kê/điều chỉnh** và báo cáo đối chiếu | Phát hiện thất thoát sớm |
| 19 | Kho trên xe tải điện không ai quản chắc | Hàng lên/xuống xe không kiểm soát | Xe được coi là **kho lưu động**: xuất lên xe, cuối ca đối soát | Không mất hàng trên xe |
| 20 | Không biết kho nào sắp hết để nhập kịp | Đứt hàng, mất đơn | Cảnh báo **tồn dưới ngưỡng** theo từng mặt hàng | Chủ động nhập hàng |
| 21 | Nhập từ Cẩm Phả gõ vào sổ riêng | Không vào sổ kho chính | Có **phiếu nhập từ Cẩm Phả** vào thẳng kho | Sổ sách liền mạch |
| 22 | "Thùng/Hộp/Vỉ/Chai" quy đổi bằng đầu | Nhập 2 hộp nhưng kho ghi 2 vỉ → sai | Hệ thống **quy đổi đơn vị tự động** (1 Hộp = 4 Vỉ = 24 Chai) | Nhập theo đơn vị nào cũng đúng |

### C4. Nhóm vấn đề về VỎ BÌNH & CÔNG NỢ VỎ (đặc thù, quan trọng nhất về tài sản)

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 23 | Nợ vỏ ghi trong 2 sheet riêng, không liên kết với đơn bán | Giao bình xong không ai cập nhật nợ vỏ | Giao bình → **nợ vỏ tự sinh** cho khách | Không bỏ sót nợ vỏ |
| 24 | Vỏ **Úp** và vỏ **Vòi** lẫn nhau | Đòi sai loại vỏ, khách không trả được | Tách riêng **2 cột độc lập** xuyên suốt | Đúng loại vỏ, khách dễ trả |
| 25 | Người giữ vỏ gồm cả **nhân viên nội bộ** nhưng ghi chung với khách | Không biết ai đang giữ, khó thu hồi | Sổ vỏ phân loại **Khách hàng / Nhân viên / Nội bộ** | Thu hồi đúng người |
| 26 | Không biết **tồn vỏ rỗng** ở từng kho bao nhiêu | Vỏ nằm rải rác, không quay vòng được | Màn hình **tồn vỏ rỗng theo kho** | Quay vòng vỏ nhanh, giảm mua vỏ mới |
| 27 | Cuối kỳ phải tự đối chiếu với "báo cáo chuẩn" | Chênh lệch không biết do đâu | Báo cáo **đối chiếu hệ thống vs số kiểm đếm**, hiện chênh lệch | Kiểm soát sai lệch, quy trách nhiệm |
| 28 | Vỏ coi như "không quản lý được" dù mỗi vỏ ~50.000đ | Thất thoát lớn theo thời gian | Toàn bộ vòng đời vỏ được ghi nhận (xuất – thu – cọc – trả XN) | Bảo vệ tài sản, giảm thất thoát |
| 29 | Tiền **đặt cọc vỏ** ghi rải rác | Khó hoàn cọc, dễ nhầm | Có trường đặt cọc/hoàn cọc trong sổ vỏ | Quản lý cọc minh bạch |

### C5. Nhóm vấn đề về NHÂN SỰ, PHÍ VẬN CHUYỂN & LƯƠNG

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 30 | Phí vận chuyển của từng người cộng tay cuối tháng | Sai sót, chậm trả | **Tự tổng hợp theo người/tháng** | Trả đúng, đúng kỳ |
| 31 | Hoa hồng/KPI tính tay từ nhiều sheet | Nhân viên không tin con số | Doanh thu tự cộng theo người, minh bạch | Nhân viên thấy rõ, giảm thắc mắc |
| 32 | ~200 CBCNV quản lý bằng danh sách Excel | Khó tra cứu, khó phân nhóm | Hồ sơ nhân sự theo **Phòng / Tổ / Trạm**, chức danh | Quản lý nhân sự khoa học |
| 33 | Không biết ai thuộc trạm nào khi điều phối | Gọi nhầm người | Gắn nhân viên với trạm/tổ ngay trong hồ sơ | Điều phối nhanh, đúng người |

### C6. Nhóm vấn đề về DỊCH VỤ GIA TĂNG (DVGT)

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 34 | Đăng ký dịch vụ ghi rải rác nhiều nơi, chữ viết tắt | Thất lạc yêu cầu, chậm phục vụ | **Một sổ đăng ký DVGT** tập trung | Không bỏ sót khách |
| 35 | Không rõ ai **vận động** ra khách | Không ghi nhận công người mang khách về | Có trường **người vận động** | Ghi nhận đúng công, khuyến khích phát triển |
| 36 | Không biết khách đến từ đâu (XN/SCC/CT/KD…) | Không biết kênh nào hiệu quả | Ghi **hình thức/kênh đăng ký** | Biết kênh nào mang lại khách |
| 37 | Trạng thái nộp phiếu viết tự do ("R", "đã có phiếu"…) | Không kiểm soát được chứng từ | Trạng thái chuẩn: **Chưa có phiếu / Đã có phiếu / Huỷ / Chuyển kỳ** | Kiểm soát chứng từ, chốt sổ dễ |
| 38 | Một lần làm gồm nhiều dịch vụ (1 bể + 1 téc) | Không rõ tính mấy chỉ tiêu | Cho ghi **nhiều dịch vụ trong một lần** | Tính đúng chỉ tiêu |
| 39 | Khách huỷ/hoãn viết lý do không thống nhất | Không phân tích được vì sao mất khách | Ghi trạng thái + **lý do huỷ/hoãn** | Hiểu nguyên nhân, cải thiện |
| 40 | Doanh thu dịch vụ ghi rải rác | Không tổng hợp được | Doanh thu DVGT vào thẳng sổ doanh thu | Nắm được hiệu quả dịch vụ |

### C7. Nhóm vấn đề về CHỈ TIÊU KPI & THI ĐUA

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 41 | Chỉ tiêu tính bằng `SUMIFS` giữa nhiều sheet | Thêm dòng là công thức lệch; không ai dám sửa | Chỉ tiêu **tự tính từ dữ liệu đơn hàng + dịch vụ** | Không còn công thức sai |
| 42 | Kế hoạch năm chia cho ~200 người phải tính tay | Chậm, dễ sai | Khai **kế hoạch năm**, hệ thống tính bình quân và % hoàn thành từng người | Chốt chỉ tiêu nhanh |
| 43 | Báo cáo theo trạm/phòng phải gom tay | Mất thời gian | Báo cáo **theo Trạm / Phòng / BP Kinh doanh** tự động | Họp thi đua có số liệu ngay |
| 44 | Không theo dõi được tiến độ cả năm | Chỉ biết khi đã muộn | Biểu đồ **% hoàn thành kế hoạch năm** theo từng người/trạm | Điều chỉnh kịp thời |

### C8. Nhóm vấn đề về TÀI CHÍNH & DÒNG TIỀN

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 45 | Thu (bán nước, cọc vỏ, thu nợ, dịch vụ) ghi rải rác | Không biết tổng thu, tiền đang ở đâu | **Sổ quỹ thu** theo loại thu | Kiểm soát dòng tiền |
| 46 | Chi (điện, xăng, nắp/màng co, lương…) ghi rải rác | Không biết chi vào đâu nhiều | **Sổ quỹ chi** theo loại chi | Kiểm soát chi phí |
| 47 | Không biết lãi/lỗ theo kỳ | Quyết định dựa cảm tính | Biểu đồ **thu – chi – chênh lệch** theo kỳ | Nhìn được hiệu quả kinh doanh |
| 48 | Công nợ tiền của khách không theo dõi chặt | Thất thu | Hạn mức nợ + sổ thu nợ | Hạn chế nợ xấu |

### C9. Nhóm vấn đề về DỮ LIỆU & BÁO CÁO

| # | Vấn đề hiện tại | Hệ quả | Giải pháp | Lợi ích |
|---|---|---|---|---|
| 49 | Xuất báo cáo phải copy tay sang file khác | Chậm, sai | **Xuất Excel** đúng mẫu biểu đang dùng | Nộp báo cáo nhanh |
| 50 | In phiếu giao/ hoá đơn phải tạo file riêng | Mất thời gian | **In phiếu giao, hoá đơn** theo mẫu | Giao hàng chuyên nghiệp |
| 51 | Dữ liệu nằm trong file cá nhân | Mất khi nghỉ việc/ hỏng máy | Dữ liệu tập trung **thuộc về xí nghiệp** | An toàn dữ liệu |

---

## PHẦN D. NHỮNG VẤN ĐỀ NHỎ NHẤT CŨNG ĐƯỢC XỬ LÝ

Để Quý xí nghiệp thấy giải pháp đi sâu tới đâu, dưới đây là những chi tiết rất nhỏ đã được tính đến:

- **"Thùng" và "Hộp" viết lẫn lộn** trong các sheet → phần mềm chỉ có **một quy cách chuẩn**, không còn nhầm.
- **Cột "Chỉ tiêu" khi ghi `XN` khi ghi `Xí nghiệp`** → phần mềm chọn từ danh sách, không gõ tự do.
- **Một ô chứa nhiều tên người** → tách thành nhiều người, chia phí rõ ràng.
- **Ghi chú thanh toán "CK11/9"** → vẫn giữ nguyên văn, nhưng tách thêm trạng thái chuẩn để đối chiếu.
- **Ghi chú "CÔNG TY VAY", "BÃI CHÁY VAY"** nằm lẫn trong dòng bán → tách thành phiếu vay mượn.
- **Khách lẻ không có hồ sơ** ("Kh lẻ", "KH đến mua trực tiếp") → tạo nhanh ngay khi lập đơn, không bắt buộc lập hồ sơ trước.
- **Đơn vị tính nhỏ nhất** (bán lẻ từng chai) → có quy đổi Chai để bán lẻ mà kho vẫn theo Vỉ/Hộp.
- **Ô trống xen kẽ trong các sheet kho** → hệ thống chỉ ghi khi có phát sinh, không còn ô trống rối mắt.
- **Các dòng công thức kéo dài vô tận xuống dưới** → không còn; dữ liệu sạch.
- **Đối chiếu "Báo cáo chuẩn" và "Thực tế" của sổ vỏ** → tự hiện chênh lệch.
- **Tồn vỏ rỗng ở Cao Xanh / Hồng Hải / VPXN** → gom về một màn hình theo kho.
- **Lịch trực tổ bảo vệ theo ngày/thứ** → quản lý trên phần mềm, có ghi chú nghỉ phép.
- **Thứ tự điều phối tổ** (Tiếp thị → Dịch vụ → Bảo vệ → Trạm) → lưu thành cấu hình, không phải nhớ.
- **Nhập từ Cẩm Phả theo ngày** → vào thẳng sổ kho theo từng ngày.

---

## PHẦN E. DỰ ĐOÁN VẤN ĐỀ KHI ĐƯA HỆ THỐNG VÀO VẬN HÀNH & CÁCH XỬ LÝ

Chúng tôi **nói trước** những khó khăn sẽ gặp để Quý xí nghiệp chủ động — và mỗi khó khăn đều đã có phương án.

| Tình huống có thể xảy ra | Rủi ro | Cách xử lý |
|---|---|---|
| **Cán bộ lớn tuổi, ngại dùng máy tính** | Không dùng, quay lại Excel | Giao diện giữ kiểu **bảng tính quen thuộc**, nhập nhanh Tab/Enter; đào tạo tại chỗ; có tài liệu 1 trang; giai đoạn đầu chạy **song song** với Excel |
| **Lúc đầu nhập chậm hơn Excel** | Sốt ruột, muốn bỏ | Bố trí lưới nhập nhanh, phím tắt, mẫu quen; **tầm 1–2 tuần** là nhanh hơn Excel vì đã tự tính, tự cộng |
| **Sợ mất điện / mất mạng** | Không nhập được | Phần mềm chạy **tại máy xí nghiệp (offline)**, không phụ thuộc internet; có bản desktop |
| **Sợ mất dữ liệu** | Dữ liệu mất, không khôi phục | **Sao lưu tự động** định kỳ + hướng dẫn sao lưu thủ công; dữ liệu tập trung một chỗ |
| **Dữ liệu cũ lộn xộn, sợ nhập sai** | Số liệu sai từ đầu | Chuyển đổi có **đối chiếu song song** 1 kỳ; chạy đối chiếu tổng doanh thu – tồn kho – nợ vỏ với file Excel gốc trước khi chốt |
| **Nhân viên lo bị "siết" hơn** | Phản ứng, không hợp tác | Truyền thông rõ: mục tiêu là **giảm việc tay, minh bạch, tính đúng công**; không dùng để phạt; chính nhân viên được lợi (phí ship, KPI rõ ràng) |
| **Sợ lộ số liệu ra ngoài** | Mất bí mật kinh doanh | Hệ thống chạy **nội bộ xí nghiệp**, không bắt buộc dùng cloud |
| **Người phụ trách nghỉ việc** | Mất "bí quyết file Excel" | Quy trình nằm trong phần mềm, ai đúng vai là làm được; dữ liệu thuộc xí nghiệp |
| **Phát sinh yêu cầu mới khi đang dùng** | Phải chờ lâu | Giải pháp **tùy biến được**, thêm danh mục/nghiệp vụ không phải làm lại từ đầu |
| **Nhập trùng khách hàng / trùng đơn** | Dữ liệu rác | Cảnh báo trùng theo tên/SĐT; có công cụ gộp |
| **Nhập sai khuyến mại 10+1** | Kho lệch | Ràng buộc số KM hợp lệ, kiểm tra khi lưu |
| **Cuối kỳ đối chiếu vỏ lệch do nhập nhầm kỳ** | Không biết lỗi ở đâu | Sổ vỏ tách theo **kỳ**, có đối chiếu và nhật ký thao tác |
| **Dữ liệu lớn dần theo năm** | Chậm | Nền tảng cơ sở dữ liệu + đánh chỉ mục, đủ nhanh ở quy mô xí nghiệp nhiều năm |
| **Một số nghiệp vụ chưa chắc chắn** | Làm sai quy trình | Triển khai theo **từng chặng có nghiệm thu**; chưa rõ thì tạm dùng quy tắc hiện hành |

---

## PHẦN F. GIÁ TRỊ & LỢI ÍCH ĐẦU TƯ

### Lợi ích định lượng (đo được)

| Chỉ tiêu | Trước (Excel) | Sau (phần mềm) |
|---|---|---|
| Nhập một lượt giao | Gõ 3 nơi (đơn, kho, vỏ) | **Gõ 1 lần**, kho và vỏ tự cập nhật |
| Tính doanh thu/người | `SUMIFS` thủ công, dễ sai | **Tự động 100%** |
| Tính phí vận chuyển tháng | Cộng tay từng người | **Tự tổng hợp** |
| Đối chiếu nợ vỏ cuối kỳ | Mở 2 sheet đối chiếu tay | **Tự đối chiếu, hiện chênh lệch** |
| Báo cáo cho lãnh đạo | Chờ tổng hợp | **Có ngay** |
| Tìm 1 đơn cũ | Dò trong file | Tra trong vài giây |
| Rủi ro mất dữ liệu | Cao (file cá nhân) | **Thấp** (dữ liệu tập trung + sao lưu) |

> Với quy mô chỉ tính riêng tháng mẫu: **~77 lượt giao**, **~449 yêu cầu dịch vụ**, **~200 CBCNV**, mỗi thao tác tiết kiệm vài phút là đã tiết kiệm hàng chục giờ công mỗi tháng — chưa kể giảm sai sót và thất thoát vỏ.

### Lợi ích định tính (quan trọng không kém)

- **Kiểm soát tài sản:** vỏ bình (~50.000đ/vỏ) không còn "thả trôi".
- **Minh bạch:** ai làm gì, ai thu tiền, ai giữ vỏ — đều có sổ.
- **Không phụ thuộc cá nhân:** quy trình nằm ở hệ thống, không ở trí nhớ một người.
- **Ra quyết định nhanh:** lãnh đạo nhìn số liệu thật, không qua khâu tổng hợp.
- **Hình ảnh chuyên nghiệp:** phiếu giao, hoá đơn, báo cáo in ra đàng hoàng.

---

## PHẦN G. LỘ TRÌNH TRIỂN KHAI (CÓ NGHIỆM THU TỪNG CHẶNG)

| Chặng | Nội dung | Kết quả bàn giao |
|:---:|---|---|
| 1 | Danh mục & giá nền: mặt hàng, bảng giá, kênh doanh thu, phòng/tổ/trạm, kho | Khai báo xong, đúng bảng giá đang dùng |
| 2 | Bán hàng & điều phối: nhập nhanh, KM 10+1, nhiều người/lượt, phí tự tính | Lập đơn nhanh; kho & doanh thu cập nhật đúng |
| 3 | Kho: phiếu nhập/xuất/chuyển, tồn theo vị trí, quy đổi đơn vị | Sổ kho chạy đúng, đối chiếu được |
| 4 | Sổ vỏ theo kỳ, tồn vỏ rỗng, thu hồi vỏ | Báo cáo đối chiếu vỏ hiện chênh lệch |
| 5 | KPI kế hoạch năm theo CBCNV/Trạm | Bảng KPI khớp số liệu |
| 6 | DVGT, CRM, tài chính, báo cáo | Các báo cáo nghiệp vụ chạy đúng |
| 7 | Chuyển dữ liệu & đối chiếu với Excel gốc, đào tạo, bàn giao | Số liệu khớp; nhân viên dùng được |

Mỗi chặng **nghiệm thu xong mới sang chặng sau** — Quý xí nghiệp luôn kiểm soát được tiến độ và chất lượng.

---

## PHẦN H. ĐỀ XUẤT ĐẦU TƯ

Để Quý xí nghiệp cân đối, đề xuất các nội dung cần thống nhất:

1. **Phạm vi:** phần mềm chạy nội bộ (không phụ thuộc internet), gồm các phân hệ theo Phần C; hỗ trợ xuất Excel và in ấn.
2. **Hình thức:** _[ ] Mua đứt sử dụng lâu dài_ — _[ ] Thuê theo năm_ — _[ ] Kết hợp_ (điền theo thoả thuận).
3. **Bảo trì & hỗ trợ:** thời gian bảo hành, cam kết hỗ trợ, cập nhật khi có yêu cầu phát sinh.
4. **Đào tạo:** đào tạo theo vai trò (trạm, thủ kho, kế toán, điều phối, lãnh đạo).
5. **Chi phí:** _[điền báo giá theo phạm vi thống nhất]_.
6. **Tiến độ:** theo lộ trình 7 chặng; nghiệm thu từng chặng.

*(Mục chi phí & hình thức để trống cho Quý xí nghiệp và đơn vị thống nhất cụ thể.)*

---

## PHẦN I. VÌ SAO NÊN CHỌN GIẢI PHÁP NÀY

1. **Bám sát thực tế của xí nghiệp** — làm từ chính 3 file Excel đang dùng, không phải sản phẩm đóng hộp phải uốn theo.
2. **Chuẩn về cách làm** — kế thừa cách tổ chức của hệ thống quản trị chuẩn (chứng từ, trạng thái, bút toán kho, quy đổi đơn vị, bảng giá), nên **ổn định và dễ mở rộng**, không phải "phần mềm tự phát".
3. **Có phần riêng cho xí nghiệp** — sổ vỏ, kênh doanh thu, nhiều người/lượt giao, KPI kế hoạch năm — những thứ không phần mềm chung nào có.
4. **Không làm đảo lộn thói quen** — nhập liệu như bảng tính, nhưng mọi thứ tự liên kết.
5. **Triển khai có kiểm soát** — từng chặng, có nghiệm thu, có đối chiếu với số liệu cũ.
6. **Đội ngũ hiểu nghiệp vụ** — đã đọc và giải mã toàn bộ 3 file Excel, kể cả công thức và những "quy tắc ngầm".

> **Kết luận:** Chuyển từ 3 file Excel sang một hệ thống thống nhất không chỉ là "đổi công cụ", mà là **giảm rủi ro, giảm thất thoát, tăng tốc và minh bạch hoá** toàn bộ hoạt động — với chi phí thấp hơn nhiều so với tổn thất do sai sót và thất thoát hiện nay.

Trân trọng kính trình Ban Giám đốc xem xét và cho ý kiến.
