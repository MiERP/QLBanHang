# THIẾT KẾ ERP TỪ GÓC NHÌN NHÀ QUẢN LÝ
## Xí Nghiệp Nước Hồng Gai (QUAWANCO) — Cơ sở thiết kế & thuyết phục đầu tư

> **Cách tiếp cận:** Không bắt đầu từ file Excel, cũng không bắt đầu từ màn hình phần mềm.
> Bắt đầu từ **câu hỏi của người quản lý**: *"Tôi phải nắm được cái gì để yên tâm?"*
> Từ đó suy ra **5 trụ quản lý** → **các mối quan hệ giữa chúng** → **bài toán cụ thể** → **giải pháp**.

---

## PHẦN 1. NĂM TRỤ QUẢN LÝ

Người quản lý xí nghiệp phải nắm 5 khối. Mọi thứ khác đều là **quan hệ giữa 5 khối này**.

```
                    ┌─────────────────┐
                    │   SẢN PHẨM      │
                    │ (bán cái gì?)   │
                    └────────┬────────┘
                             │
   ┌──────────────┐   ┌──────┴───────┐   ┌──────────────┐
   │  NHÂN VIÊN   │───│  BÁN HÀNG    │───│  KHÁCH HÀNG  │
   │ (ai làm?)    │   │ (bán thế nào)│   │ (bán cho ai) │
   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
          │                  │                  │
          └──────────┬───────┴──────────────────┘
                     ▼
             ┌─────────────────┐
             │      KHO        │
             │ (hàng ở đâu?)   │
             └─────────────────┘
```

### 1.1. Quản lý SẢN PHẨM — *"Tôi đang bán cái gì, giá bao nhiêu, chính sách ra sao?"*

| Câu hỏi của nhà quản lý | Thực trạng trong Excel | Giải pháp |
|---|---|---|
| Có bao nhiêu mặt hàng, quy cách thế nào? | Rải rác trong công thức; "Thùng" lẫn "Hộp"; "Vỉ 500ml"/"Vỉ 500 ml" mỗi nơi một kiểu | **Danh mục sản phẩm chuẩn** + quy cách + đơn vị tính |
| Mỗi mặt hàng bán giá nào, cho đối tượng nào? | Giá nằm trong công thức và bảng nhúng; giá đại lý không tách bạch | **Bảng giá** riêng, nhiều mức giá, có hiệu lực |
| Mặt hàng nào phải thu hồi vỏ, cọc bao nhiêu? | Không ghi rõ; cọc vỏ ghi rải rác | Gắn **cờ quản lý vỏ** + tiền cọc trên sản phẩm |
| Đang có chương trình tặng 10+1 không? | Ghi tay ở cột KM, tự trừ kho | **Ô khuyến mại** trên dòng bán: trừ kho nhưng không tính tiền |
| Quy đổi Vỉ/Hộp/Chai thế nào? | "Nhập 2 hộp, kho ghi 2 vỉ" — sai | **Quy đổi đơn vị** tự động (1 Hộp = 4 Vỉ = 24 Chai) |
| Giá Hộp có phải bằng 4 lần giá Vỉ? | Nhầm tưởng như vậy | Giá theo **từng mặt hàng**; quy đổi **không** dùng để suy giá |

### 1.2. Quản lý NHÂN VIÊN — *"Ai đang làm gì, ai chịu trách nhiệm gì?"*

| Câu hỏi của nhà quản lý | Thực trạng trong Excel | Giải pháp |
|---|---|---|
| Xí nghiệp có bao nhiêu người, thuộc phòng/tổ/trạm nào? | Danh sách ~200 người trong 1 sheet, gõ tay | **Hồ sơ nhân sự** theo Phòng / Tổ / Trạm, chức danh |
| Nhân viên nào bán được bao nhiêu? | Cộng bằng `SUMIFS`, dễ sai | **Doanh thu tự gán theo người bán** trên từng đơn |
| Ai đi giao, ai chỉ bán? | Ghi chung trong ô "Người thực hiện" | Vai trò rõ: **người bán / người giao / hỗ trợ** |
| Ai đang giữ tiền chưa nộp? | Không ai nắm | **Sổ tiền theo nhân viên** (thu – nộp quỹ) |
| Ai đang giữ vỏ bình? | Không phân biệt khách và nhân viên | **Sổ vỏ nhân viên** tách riêng khỏi khách hàng |
| Ai đạt chỉ tiêu, ai chưa? | Tính tay cuối kỳ | **KPI tự tính**, biểu đồ tiến độ từng người |
| Ai có quyền sửa cái gì? | Ai cũng mở được file | **Phân quyền theo vai trò** |

### 1.3. Quản lý KHÁCH HÀNG — *"Bán cho ai, họ đang nợ gì?"*

| Câu hỏi của nhà quản lý | Thực trạng trong Excel | Giải pháp |
|---|---|---|
| Khách này là ai, ai đang phụ trách? | Hồ sơ không có; tên gõ tự do | **Hồ sơ khách hàng** + người phụ trách |
| Khách nợ tiền bao nhiêu, nợ bao lâu? | Không theo dõi | **Sổ công nợ tiền** + hạn mức nợ |
| Khách đang giữ bao nhiêu **bình Úp / bình Vòi**? | 2 sheet riêng, không liên kết đơn bán | **Sổ nợ vỏ 2 cột độc lập** |
| **Nợ vỏ từ khi nào, trả khi nào?** | Chỉ có số dư, không có ngày | Sổ vỏ **theo kỳ**: dư đầu – phát sinh – đã trả – dư cuối, kèm ngày và ghi chú |
| Khách nào đang dùng mặt hàng gì? | Không tra được | **Lịch sử mua hàng** theo khách |
| Khách lẻ, khách vãng lai? | Ghi "Kh lẻ", "KH đến mua trực tiếp" | **Khách nhanh**: tạo ngay khi lập đơn, không cần lập hồ sơ trước |
| Đã đặt cọc bao nhiêu, còn phải hoàn không? | Ghi rải rác | Trường **đặt cọc / hoàn cọc** trong sổ vỏ |

### 1.4. Quản lý BÁN HÀNG — *"Hôm nay bán bao nhiêu, ai bán, tiền đâu?"*

| Câu hỏi của nhà quản lý | Thực trạng trong Excel | Giải pháp |
|---|---|---|
| Hôm nay/tháng này bán bao nhiêu, ai bán? | Gõ sheet `XUẤT`, cuối kỳ mới tổng hợp | **Doanh thu tự cộng** tức thì theo người/kênh/ngày |
| Đơn nào đã giao, đơn nào chưa? | Không có trạng thái, chỉ có cột "Kết quả" gõ tay | **Chứng từ có trạng thái**: Báo giá → Đơn bán → Đã giao |
| Đơn nào đã thu tiền, đơn nào còn nợ? | Ghi chú tự do ("CK11/9") | **Trạng thái thanh toán chuẩn** + vẫn giữ ghi chú gốc |
| Đơn nào cần xuất hóa đơn VAT? | Tự xử lý ngoài | Thông tin **hóa đơn VAT** ngay trên đơn |
| Bán cho kênh nào hiệu quả? | "Chỉ tiêu" ghi lẫn lộn XN/CTY/Bãi Cháy | **Kênh doanh thu** chuẩn; kênh ngoài xí nghiệp tự loại khỏi chỉ tiêu |
| Phí vận chuyển tính thế nào? | Nhập tay 5.000đ/đơn vị | **Bảng giá cước**, tự tính |
| Ai giao, mấy người, chia phí ra sao? | Ghi "Phương + Huế" trong 1 ô | **Nhiều người/lượt giao**, chia đều phí |

### 1.5. Quản lý KHO — *"Hàng đang ở đâu, còn bao nhiêu, có khớp không?"*

| Câu hỏi của nhà quản lý | Thực trạng trong Excel | Giải pháp |
|---|---|---|
| Mỗi kho còn bao nhiêu? Tổng còn bao nhiêu? | Mỗi kho một sheet, muốn tổng phải tự cộng | **Tồn theo kho** + tổng, một màn hình |
| Hàng vào/ra vì lý do gì? | Ghi rời rạc, không có chứng từ | **Phiếu nhập / xuất / chuyển** có trạng thái |
| Hàng trên xe tải điện còn bao nhiêu? | Không quản được | **Kho lưu động**: xuất lên xe, cuối ca đối soát |
| Sổ sách và thực tế có khớp? | Không đối chiếu | **Kiểm kê / điều chỉnh** + báo cáo đối chiếu |
| Kho nào sắp hết để nhập kịp? | Nhìn mắt | **Cảnh báo tồn dưới ngưỡng** |
| Vỏ rỗng đang ở kho nào? | Ghi rải rác | **Tồn vỏ rỗng theo kho** |
| Nhập hàng từ Cẩm Phả vào đâu? | Sổ riêng, không vào sổ chính | **Phiếu nhập từ Cẩm Phả** vào thẳng kho |

---

## PHẦN 2. CÁC BÀI TOÁN PHÁT SINH TỪ **QUAN HỆ** GIỮA CÁC THÀNH PHẦN

Đây là phần cốt lõi: **giá trị của ERP nằm ở chỗ quản lý được các mối quan hệ**, không phải quản lý từng danh mục riêng lẻ.

### 2.1. Bản đồ quan hệ

| # | Quan hệ | Nhà quản lý cần biết | Giải pháp |
|---|---|---|---|
| Q1 | **Nhân viên bán → Bán hàng** | Đơn này ai bán? Có nhiều người cùng bán thì chia công thế nào? | Trường *người bán* trên đơn; nhiều người thì ghi rõ, doanh thu gán theo người bán |
| Q2 | **Nhân viên → Thu tiền** | Ai thu tiền? Thu bao nhiêu? Đã nộp quỹ chưa? | Phiếu thu gắn người thu; sổ tiền theo nhân viên; đối chiếu thu – nộp |
| Q3 | **Nhân viên → Hóa đơn / chứng từ** | Ai xuất hóa đơn? Ai nộp phiếu? Còn phiếu nào chưa nộp? | Thông tin VAT trên đơn; trạng thái *chứng từ* trên đơn/ dịch vụ |
| Q4 | **Nhân viên → Kho** | Ai nhận hàng từ kho? Ai đang giữ vỏ? Hàng trên xe còn bao nhiêu? | Phiếu xuất gắn người nhận; sổ vỏ nhân viên; đối soát cuối ca |
| Q5 | **Nhân viên → Khách hàng** | Ai phụ trách khách nào? Ai mang khách về? | Trường *người phụ trách / người vận động* |
| Q6 | **Nhân viên → KPI** | Ai đạt chỉ tiêu, ai chưa, còn thiếu bao nhiêu? | Kế hoạch năm gắn từng người, % hoàn thành tự tính |
| Q7 | **Khách hàng → Bán hàng** | Khách mua chịu bao nhiêu? Nợ bao lâu? Vượt hạn mức chưa? | Sổ công nợ tiền + hạn mức nợ + cảnh báo |
| Q8 | **Khách hàng → Vỏ bình** | Khách **nợ bình khi nào, trả khi nào**, còn bao nhiêu Úp/Vòi? | Sổ vỏ theo kỳ: dư đầu – phát sinh – đã trả – dư cuối, kèm ngày + đối chiếu |
| Q9 | **Sản phẩm → Kho** | Mặt hàng này đang tồn bao nhiêu ở mỗi kho? Quy cách thế nào? | Tồn theo sản phẩm × vị trí; quy đổi đơn vị |
| Q10 | **Sản phẩm → Bán hàng** | Mặt hàng này giá nào, KM ra sao, có VAT không? | Bảng giá theo mặt hàng; ô KM; thông tin VAT |
| Q11 | **Sản phẩm → Khách hàng** | Khách này đang dùng mặt hàng gì? Kèm bao nhiêu vỏ? | Lịch sử mua + nợ vỏ theo khách |
| Q12 | **Bán hàng → Kho** | Xuất ở kho nào? Giao xong chưa? Hủy đơn thì hoàn kho thế nào? | Xuất kho qua phiếu; hoàn kho có chứng từ khi hủy |
| Q13 | **Bán hàng → Vận chuyển** | Ai giao? Bao nhiêu người? Phí bao nhiêu, trả cho ai? | Chứng từ giao + bảng giá cước + chia phí theo người |
| Q14 | **Kho → Kho** | Điều chuyển nội bộ thế nào? Vay mượn chi nhánh còn nợ không? | Phiếu chuyển kho; phiếu vay/cho vay có hạn trả |
| Q15 | **Khách hàng → Chi nhánh** | Đơn vị bạn vay hàng/gửi bán đã trả chưa? | Phiếu vay mượn gắn chi nhánh, theo dõi quá hạn |

### 2.2. Hai chuỗi quan hệ quan trọng nhất (ví dụ bạn nêu)

**Chuỗi A — Nhân viên → bán → thu tiền → hóa đơn**

```
Nhân viên A bán đơn ──► Ai bán? (doanh thu cho A)
        │
        ├──► Xuất kho từ kho nào? → tồn giảm
        │
        ├──► Ai giao? (B + C cùng giao → chia phí)
        │
        ├──► Thu tiền: thu bao nhiêu? ai thu? hình thức (TM/CK)?
        │        │
        │        └──► Đã nộp quỹ chưa? Nếu chưa → còn treo ở nhân viên  ⚠
        │
        └──► Có xuất hóa đơn VAT không? → đã xuất chưa?
```

*Bài toán:* **tiền đang ở đâu** — trong quỹ hay trong tay nhân viên; **ai chịu trách nhiệm** nếu thiếu.
*Giải pháp:* phiếu thu gắn người thu + sổ tiền theo nhân viên + đối chiếu thu/nộp + trạng thái hóa đơn trên đơn.

**Chuỗi B — Khách mua → nợ bình → nợ khi nào → trả khi nào**

```
Khách X nhận 2 bình Úp + 1 bình Vòi (ngày 05/9)
        │
        ├──► Nợ vỏ tăng: Úp +2, Vòi +1   (ghi nhận ngày 05/9)
        │
        ├──► Ngày 12/9 khách trả 2 bình Úp  → nợ vỏ giảm, ghi ngày trả
        │
        ├──► Còn lại: 0 Úp, 1 Vòi  → tồn nợ đến cuối kỳ
        │
        └──► Đối chiếu với "sổ tay" của nhân viên → chênh lệch bao nhiêu? ⚠
```

*Bài toán:* **nợ loại nào, bao nhiêu, từ khi nào, trả khi nào, còn lại bao nhiêu** — và **khớp với thực tế** không.
*Giải pháp:* sổ vỏ theo kỳ (dư đầu – nhập – trả – dư cuối, tách Úp/Vòi), ghi ngày và ghi chú, kèm báo cáo đối chiếu.

### 2.3. Ma trận quan hệ

| | Sản phẩm | Nhân viên | Khách hàng | Bán hàng | Kho |
|---|---|---|---|---|---|
| **Sản phẩm** | quy cách, giá | — | SP khách đang dùng | giá/KM/VAT trên đơn | tồn, cọc vỏ |
| **Nhân viên** | ai bán SP nào | phân quyền | ai phụ trách khách | Q1, Q2, Q3, Q6 | Q4 (nhận hàng, giữ vỏ) |
| **Khách hàng** | Q11 | Q5 | nợ tiền, nợ vỏ | Q7 | Q8 (nợ bình) |
| **Bán hàng** | Q10 | Q1–Q3 | Q7 | trạng thái đơn | Q12 (xuất/hoàn kho) |
| **Kho** | Q9 | Q4 | Q8 | Q12 | Q14 (chuyển kho) |

---

## PHẦN 3. NHÀ QUẢN LÝ HỎI — HỆ THỐNG TRẢ LỜI Ở ĐÂU

| Câu hỏi | Trả lời ở màn hình |
|---|---|
| Hôm nay bán được bao nhiêu, ai bán? | Tổng quan · Bán hàng |
| Đơn nào chưa giao? | Bán hàng (lọc theo trạng thái) |
| Ai đang thu tiền mà chưa nộp quỹ? | Sổ quỹ thu · hồ sơ nhân viên |
| Khách nào nợ tiền, nợ bao lâu? | Khách hàng · công nợ |
| Khách nào đang giữ bao nhiêu bình Úp/Vòi, từ khi nào? | Sổ nợ vỏ bình |
| Kho nào còn bao nhiêu, sắp hết chưa? | Tồn kho · cảnh báo |
| Hàng trên xe tải điện còn bao nhiêu? | Tồn kho (vị trí xe) |
| Vỏ rỗng đang ở kho nào? | Sổ nợ vỏ bình · tồn vỏ rỗng |
| Nhập hàng từ Cẩm Phả hôm nay bao nhiêu? | Phiếu kho (nhập) |
| Đơn vị bạn vay hàng đã trả chưa? | Vay mượn liên chi nhánh |
| Nhân viên nào đạt chỉ tiêu, còn thiếu bao nhiêu? | Chỉ tiêu KPI |
| Dịch vụ nào đã làm nhưng chưa nộp phiếu? | Dịch vụ gia tăng |
| Tháng này thu bao nhiêu, chi vào đâu? | Sổ quỹ thu–chi |
| Đơn nào cần xuất hóa đơn VAT? | Bán hàng (thông tin VAT) |

---

## PHẦN 4. NHỮNG BÀI TOÁN NHỎ NHƯNG NẾU BỎ SÓT SẼ RẤT MỆT

Đây là các chi tiết "khi nào / bao nhiêu / ai" mà chỉ khi quản lý mới thấy hết:

1. **Nợ vỏ có ngày**: nợ từ ngày nào, đã bao lâu, thuộc loại Úp hay Vòi.
2. **Tiền thu chưa nộp**: thu ngày nào, ai thu, đã nộp chưa, còn treo bao nhiêu.
3. **Khuyến mại đã trừ chưa**: tặng cho ai, đợt nào, đã trừ kho chưa.
4. **Hàng hoàn khi hủy đơn**: hoàn về kho nào, có chứng từ không.
5. **Đổi vỏ khi giao**: giao bình mới, thu bình cũ — hai việc trong một lần.
6. **Khách trả vỏ nhưng không mua gì**: vẫn phải ghi nhận.
7. **Khách đền vỏ mất**: ghi nhận tiền đền thay vì trả vỏ.
8. **Vay mượn có hạn trả**: vay ngày nào, đến hạn chưa, quá hạn bao lâu.
9. **Phiếu dịch vụ chuyển kỳ**: việc tháng này nộp phiếu tháng sau.
10. **Một lần làm nhiều dịch vụ**: tính mấy chỉ tiêu.
11. **Nhiều người cùng một lượt giao**: chia phí thế nào cho công bằng.
12. **Cùng một khách nhiều địa chỉ giao** (nhà riêng, cơ quan).
13. **Tên khách/ sản phẩm gõ khác nhau** dẫn tới báo cáo lệch.
14. **Xe chở hàng đi nhiều điểm**: cuối ngày còn bao nhiêu trên xe.

---

## PHẦN 5. DỰ ĐOÁN VẤN ĐỀ KHI ĐƯA HỆ THỐNG VÀO VẬN HÀNH

| Tình huống | Rủi ro | Cách xử lý |
|---|---|---|
| Cán bộ lớn tuổi ngại dùng máy | Quay lại Excel | Giao diện kiểu bảng tính, nhập Tab/Enter; đào tạo tại chỗ; chạy song song thời gian đầu |
| Lúc đầu nhập chậm hơn Excel | Sốt ruột | Lưới nhập nhanh; 1–2 tuần là nhanh hơn vì tự tính, tự cộng |
| Sợ mất điện / mất mạng | Không nhập được | Chạy nội bộ tại máy xí nghiệp, không phụ thuộc Internet |
| Sợ mất dữ liệu | Không khôi phục được | Sao lưu định kỳ + hướng dẫn sao lưu tay |
| Lo bị "siết" hơn | Không hợp tác | Truyền thông: giảm việc tay, minh bạch, tính đúng công; không dùng để phạt |
| Sợ lộ số liệu | Mất bí mật kinh doanh | Hệ thống nội bộ, không bắt buộc cloud |
| Người phụ trách nghỉ việc | Mất "bí quyết" | Quy trình nằm trong hệ thống; dữ liệu thuộc xí nghiệp |
| Chuyển dữ liệu cũ bị sai | Số liệu sai từ đầu | Đối chiếu song song một kỳ với file Excel gốc trước khi chốt |
| Phát sinh yêu cầu mới | Phải chờ lâu | Thiết kế tùy biến được, thêm danh mục/nghiệp vụ không làm lại từ đầu |
| Nhập trùng khách / trùng đơn | Dữ liệu rác | Cảnh báo trùng theo tên/SĐT; có công cụ gộp |
| Nhập sai khuyến mại | Kho lệch | Ràng buộc số KM hợp lệ |
| Lệch sổ vỏ cuối kỳ | Không rõ nguyên nhân | Sổ vỏ theo kỳ có đối chiếu + nhật ký thao tác |

---

## PHẦN 6. GIÁ TRỊ & ĐỀ XUẤT ĐẦU TƯ

| Chỉ tiêu | Trước (Excel) | Sau (hệ thống) |
|---|---|---|
| Nhập một lượt giao | Gõ 3 nơi | Gõ 1 lần — kho, doanh thu, nợ vỏ tự cập nhật |
| Biết ai bán bao nhiêu | SUMIFS, cuối kỳ | Tức thì |
| Biết ai đang giữ tiền | Không biết | Sổ tiền theo nhân viên |
| Biết khách nợ bình khi nào | Chỉ có số dư | Có ngày nợ – ngày trả – dư cuối |
| Biết tồn kho & hàng trên xe | Phải tự cộng | Một màn hình |
| Cước vận chuyển | Nhập tay | Tự tính theo bảng giá |
| Báo cáo lãnh đạo | Chờ tổng hợp | Có ngay |
| Rủi ro mất dữ liệu | Cao | Thấp (tập trung + sao lưu) |

**Lợi ích cốt lõi:** không chỉ "đổi công cụ", mà **kiểm soát được các mối quan hệ** — ai bán, ai thu, ai giữ tiền, ai giữ vỏ, khách nợ gì, nợ từ khi nào — tức là **quản lý được dòng tiền và tài sản của xí nghiệp**.

---

## PHẦN 7. LỘ TRÌNH TRIỂN KHAI (nghiệm thu từng chặng)

| Chặng | Nội dung | Kết quả |
|:---:|---|---|
| 1 | Danh mục nền: sản phẩm, đơn vị tính, bảng giá, kênh, phòng/tổ/trạm, kho | Khai báo xong |
| 2 | Bán hàng & điều phối: đơn có trạng thái, KM, nhiều người/lượt, cước tự tính | Lập đơn nhanh, đúng |
| 3 | Kho: phiếu nhập/xuất/chuyển, tồn theo vị trí, quy đổi | Sổ kho khớp |
| 4 | Khách hàng: công nợ tiền, sổ vỏ theo kỳ, tồn vỏ rỗng | Đối chiếu được chênh lệch |
| 5 | Nhân viên: sổ tiền, sổ vỏ, KPI kế hoạch năm | Chốt công, chốt chỉ tiêu |
| 6 | Dịch vụ gia tăng, tài chính, báo cáo | Báo cáo chạy đúng |
| 7 | Chuyển dữ liệu & đối chiếu Excel gốc, đào tạo, bàn giao | Số liệu khớp, dùng được |

*Tài liệu minh hoạ kèm theo: `DE_XUAT_GIAI_PHAP_VA_DAU_TU.pdf` (ảnh chụp phần mềm) và `.xlsx` (bảng chi tiết).*
