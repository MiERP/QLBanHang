# QAROMI ERP — HỒ SƠ VẤN ĐỀ & THIẾT KẾ HỆ THỐNG
## Phương pháp "Excel-first": hiểu thật kỹ vận hành → mới học Odoo → tùy biến phần còn thiếu

**Đơn vị:** Xí nghiệp Nước Hồng Gai — Công ty CP Nước sạch Quảng Ninh (QUAWANCO)
**Thương hiệu:** Nước uống tinh khiết & ion kiềm QAROMI
**Nguồn chân lý:** 3 file Excel vận hành thật trong `excel/` (22 sheet, đã đọc cả công thức)
**Trạng thái:** HỒ SƠ THIẾT KẾ — tài liệu gốc để xây phần mềm chuyên biệt

> **Nguyên tắc chỉ đạo:** Mọi hạng mục trong tài liệu này đều **xuất phát từ 3 file Excel**.
> Odoo chỉ được dùng để trả lời câu hỏi: "bài toán này đã có khuôn mẫu sẵn chưa?".
> Chỗ nào Excel đặt ra mà Odoo không có → đó là **tùy biến theo thực tế** (phần giá trị riêng của xí nghiệp).

---

## MỤC LỤC

- [Phần 0. Phương pháp & phạm vi](#phần-0-phương-pháp--phạm-vi)
- [Phần 1. Kiểm kê nguồn dữ liệu (3 file / 22 sheet)](#phần-1-kiểm-kê-nguồn-dữ-liệu)
- [Phần 2. DANH MỤC VẤN ĐỀ CẦN QUẢN LÝ](#phần-2-danh-mục-vấn-đề-cần-quản-lý)
- [Phần 3. CÁC LUỒNG NGHIỆP VỤ PHẢI CHẠY ĐƯỢC](#phần-3-các-luồng-nghiệp-vụ)
- [Phần 4. GIẢI PHÁP CHO TỪNG VẤN ĐỀ (Odoo kế thừa / tùy biến)](#phần-4-giải-pháp-cho-từng-vấn-đề)
- [Phần 5. KIẾN TRÚC DỮ LIỆU](#phần-5-kiến-trúc-dữ-liệu)
- [Phần 6. GIAO DIỆN ERP DỰ KIẾN](#phần-6-giao-diện-erp-dự-kiến)
- [Phần 7. CÁC BƯỚC VẬN HÀNH (chạy thử trên phần mềm)](#phần-7-các-bước-vận-hành)
- [Phần 8. LỘ TRÌNH & ĐỐI CHIẾU](#phần-8-lộ-trình--đối-chiếu)
- [Phụ lục A. Bảng giá trị phân loại trích từ Excel](#phụ-lục-a-giá-trị-phân-loại-trích-từ-excel)

---

## Phần 0. Phương pháp & phạm vi

**Quy trình làm việc (theo đúng chỉ đạo):**

1. **Mổ xẻ 3 file Excel trước tiên** → rút ra *mọi vấn đề cần quản lý, mọi luồng, mọi quy trình nhỏ*, kể cả các "quy tắc ngầm" nằm trong ghi chú và công thức.
2. **Chỉ sau đó mới tra Odoo** (module `sale`, `stock`, `crm`, `delivery`) → tìm khuôn mẫu đã có sẵn để tái sử dụng, tránh làm lại bánh xe.
3. **Phần Odoo không trả lời được** → thiết kế tùy biến, ghi rõ là "đặc thù xí nghiệp".

**Cách đọc dữ liệu:** đọc giá trị ô **và công thức** (SUMIFS/SUBTOTAL) để hiểu quan hệ giữa các sheet; trích **toàn bộ giá trị phân biệt** của các cột phân loại (Công việc, Kho, Chỉ tiêu, Sản phẩm, Trạng thái…) để không bỏ sót nghiệp vụ.

**Ngoài phạm vi:** sản xuất/chiết rót (nhà máy), kế toán tài chính tổng hợp, thuế — tài liệu này tập trung vào **bán hàng, kho, vỏ bình, điều phối–vận chuyển, DVGT, KPI**.

---

## Phần 1. Kiểm kê nguồn dữ liệu

| # | File | Sheet | Chức năng thật | Vấn đề nổi lên |
|---|------|-------|----------------|----------------|
| 1 | **ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa.xlsx** | `XUẤT` | Nhật ký bán hàng + điều phối theo ngày | 2 trục doanh thu (kênh + CBCNV), nhiều người/lượt, phí VC, KM 10+1, thanh toán bằng ghi chú |
| | | `CBCNV` | Ma trận doanh số người × 6 SKU (SUMIFS từ `XUẤT`) | Chỉ tiêu cá nhân; 43 chức danh; 9 tổ/trạm |
| | | `TỒN` | Tồn theo ngày (nhập/xuất/tồn theo 6 nhóm) | XNT ngày |
| | | `ĐIÈU PHỐI` | DS điều phối viên, phân công ngày, lịch tổ bảo vệ, thứ tự ưu tiên | Lịch trực + thứ tự điều phối |
| | | `Vận chuyển` | Tổng hợp phí VC/bốc xếp theo người/tháng | Phí = SL × 5.000đ |
| | | `Đơn giá` | Bảng giá 6 SKU | Nguồn chân lý giá |
| | | `TỒN KHO TỔNG / TỒN TỔNG / TỒN KHO HUẾ / TỒN KHO TĂNG ÁP / tồn xe / Tồn kho VP` | Tồn theo từng kho | Kho ảo trên xe |
| | | `nhập từ CP` | Nhập từ Cẩm Phả theo ngày | Liên chi nhánh |
| 2 | **XNT T9.hương -Nhung.xlsx** | `XNT` | Tổng hợp XNT + đối chiếu Thực tế/Công nợ | Đối chiếu |
| | | `KHO TỔNG`, `Lại Lan`, `Huế`, `Xe điện`, `Đá Trắng` | Ma trận NHẬP/XUẤT × 6 nhóm × {thường, TẶNG} | Nhập từ đâu, xuất cho ai/bộ phận |
| | | `Theo dõi vỏ bình` | Vòng quay lấy bình/trả vỏ theo tháng + tồn vỏ rỗng | Nợ vỏ gồm cả nội bộ |
| | | `VB T9`, `VB T8` | **Sổ nợ vỏ theo KỲ** (T9/T8 = tháng 9/tháng 8) | Nợ cũ→nhập→trả→nợ mới, Úp/Vòi, Trả XN, đặt cọc, "báo cáo chuẩn" |
| | | `DATA` | Danh sách nhân sự/đơn vị | Danh mục nền |
| 3 | **THEO DÕI CHỈ TIÊU DVGT CBCNV.xlsx** | `DS bình chỉnh` | DS khách dùng DV Bình NL / VS HTCN | Hình thức đăng ký |
| | | `ban cu Nhung`, `Thư` | Nhật ký đăng ký DVGT đa kênh | Trạng thái nộp phiếu, chuyển kỳ, lý do huỷ/hoãn |
| | | `XN` | Doanh thu tháng T1–T12 theo CBCNV + kế hoạch năm | KPI |
| | | `BPKD` | Tổng hợp theo BP Kinh doanh | Báo cáo |

---

## Phần 2. DANH MỤC VẤN ĐỀ CẦN QUẢN LÝ

> Mỗi vấn đề có mã `Pxx` để theo dõi xuyên suốt tài liệu (vấn đề → giải pháp → màn hình → bước vận hành).

### Nhóm A — Sản phẩm, đơn vị, giá, khuyến mại

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P01** | Chỉ bán **6 SKU nước** + dịch vụ; tên gọi lệch nhau giữa các sheet ("Thùng"/"Hộp", "Vỉ 350ml"/"Vỉ 350 ml"/"Vỉ 350") → cần một danh mục chuẩn. |
| **P02** | Quy cách đóng gói: **Vỉ = 6 chai**, **Hộp/Thùng = 24 chai = 4 vỉ** → cần quy đổi đơn vị khi nhập/xuất. |
| **P03** | **Giá Hộp KHÔNG suy từ giá Vỉ** (106.000 ≠ 4 × 98.000) → quy đổi chỉ để đổi đơn vị, **không dùng để tính giá**. |
| **P04** | Có nhiều mức giá (giá bán, giá đại lý/KH lớn) → cần bảng giá nhiều mức, có hiệu lực theo thời gian. |
| **P05** | **Khuyến mại 10+1** (và biến thể 10+2, 20+2, 30+3): hàng tặng **trừ kho** nhưng **doanh thu = 0**. |
| **P06** | Sheet `CBCNV` bị **đảo nhãn Hộp 350 ↔ Hộp 500** (lỗi tiêu đề) → hệ thống phải lấy giá từ `Đơn giá`, không nhúng tay. |
| **P07** | **Vòi/Úp KHÔNG phải mặt hàng** — chỉ bán "Bình RO"/"Bình ion kiềm"; Vòi/Úp là **thuộc tính vỏ khi giao**. |

### Nhóm B — Kho & Xuất–Nhập–Tồn

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P08** | **Đa kho**: Tăng Áp (trung tâm), Huế (tổ thị trường), **Lại Lan**, Xe tải điện, Đá Trắng, Văn Phòng (VPXN), kho Vỏ bình rỗng. |
| **P09** | **Kho ảo trên xe tải điện**: đầu ca bốc hàng lên xe, cuối ca đối soát hàng đã giao / tiền / hàng còn trên xe. |
| **P10** | **Ma trận XNT** = NHẬP × XUẤT × 6 nhóm hàng × biến thể **TẶNG**. |
| **P11** | Nhập hàng có **nguồn nhập** rõ: Kho Huế, Tăng áp, Viancontrol (nước), "trả BC", "đơn CP". |
| **P12** | Xuất hàng kèm **người nhận + bộ phận** (Văn Phòng, Hà Tu, Hà Lầm, Hồng Gai, Cao Xanh, Đá Trắng, Hạ Long, Tổ DV). |
| **P13** | Mỗi dòng kho có **Thành tiền** (giá trị tồn) và **Tình trạng**. |
| **P14** | **Tồn theo ngày**: tồn đầu kỳ → nhập → xuất → tồn cuối kỳ. |
| **P15** | Bảng `XNT` có dòng đối chiếu **"THỰC TẾ" vs "CÔNG NỢ"** (phát hiện lệch). |
| **P16** | **Nhập hàng từ Cẩm Phả** vào Kho Tăng Áp + Kho chị Huế (theo ngày, 4 nhóm hàng). |
| **P17** | **Điều chuyển nội bộ** giữa các kho (Tăng Áp → Huế/Lại Lan/xe). |

### Nhóm C — Vỏ bình (đặc thù xí nghiệp)

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P18** | Nợ vỏ **2 loại độc lập: Úp và Vòi** (không thay thế nhau). |
| **P19** | **Sổ vỏ theo KỲ (tháng)**: `Nợ cũ → Nhập (xuất mới) → Trả vỏ → Nợ mới`. |
| **P20** | Có nghiệp vụ **"Trả XN"** (trả vỏ về xí nghiệp) và **"ĐẶT CỌC"** (tiền cọc vỏ 50.000đ). |
| **P21** | **Đối tượng nợ vỏ gồm cả KHÁCH HÀNG và NHÂN VIÊN/NỘI BỘ** (Thơ, Quỳnh, C Tươi, Hiên, Thu, VPXN, Khoa, Yến KD…). |
| **P22** | **Tồn vỏ rỗng theo kho** (Cao Xanh 15, Hồng Hải 10, VPXN 7). |
| **P23** | Đối chiếu **"Báo cáo chuẩn" (thủ công) vs thực tế → chênh lệch**. |
| **P24** | Ghi chú nợ vỏ tự do; có trường hợp **"KH đền vỏ"**, "trả diamond", "huế trả chung cư ruby". |

### Nhóm D — Bán hàng, điều phối, vận chuyển

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P25** | **1 lượt giao = 1 dòng**; một đơn nhiều SKU **tách thành nhiều dòng con**. |
| **P26** | **Công việc**: `Vận chuyển` / `Bốc xếp` (ảnh hưởng cách tính công). |
| **P27** | **Kho xuất** (Hồng Gai, tăng áp, VP/VPXN, Hà Lầm…) + có trường hợp "vay Quảng Yên", "xe cp hạ luôn". |
| **P28** | **Hai trục hạch toán độc lập**: `Chỉ tiêu` (kênh) và `Chỉ tiêu CBCNV` (người bán). |
| **P29** | **Kênh không thuộc Xí nghiệp** (Công ty, Bãi Cháy, Miền Đông, Diễn Vọng, Quảng Yên) → **không tính doanh thu/chỉ tiêu** xí nghiệp. |
| **P30** | **Nhiều người trên một lượt**: Người thực hiện, Hỗ trợ (trạm QL), Người vận chuyển — thường ghép trong 1 ô ("Phương + Huế", "Tùng + Huế + Huy"). |
| **P31** | **Phí vận chuyển = SL × 5.000đ**, gắn "Người vận chuyển"; tổng hợp theo người/tháng. |
| **P32** | **Kết quả** lượt giao (Đã hoàn thành / hoàn thành). |
| **P33** | **Thanh toán là ghi chú tự do**: "CK11/9", "TM11/9", "công ty thu tiền", "Bãi Cháy tự thu". |
| **P34** | **Vay mượn ghi ngay trên dòng bán**: "CÔNG TY VAY", "BÃI CHÁY VAY", "vay công ty", "Vay Hà Lầm". |
| **P35** | **Lịch trực tổ bảo vệ theo tháng** + **thứ tự ưu tiên điều phối tổ** (Tiếp thị → Dịch vụ → Bảo vệ → Trạm QL). |
| **P36** | Điều phối viên có **địa chỉ nhà, SĐT, khu vực phụ trách**. |

### Nhóm E — Khách hàng & liên chi nhánh

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P37** | Nhiều loại khách: KH lớn/cơ quan (than Hóa chất mỏ, UBND tỉnh, SHB, Hanet, Luxury…), **"Kh lẻ"**, **"KH đến mua trực tiếp"**. |
| **P38** | **Đơn vị bạn/chi nhánh**: Cẩm Phả, Bãi Cháy, Miền Đông, Móng Cái, Tổng công ty, Uông Bí, Đông Triều, Quảng Yên, Diễn Vọng, SCC. |
| **P39** | **Công nợ tiền** của khách (hạn mức nợ; thu nợ). |

### Nhóm F — Dịch vụ gia tăng (DVGT)

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P40** | **5 loại DV thật**: rửa bể, rửa téc, bể+téc, máy giặt, bình nóng lạnh (BNL) + **dịch vụ phát sinh** (thay hộp/van/rắc co, di chuyển đồng hồ, sục đường ống…). |
| **P41** | **Đa kênh đăng ký**: người vận động (phòng/trạm/SCC), KH tự đăng ký, "khách book"; hình thức: XN, CX, YK, CT, CTT, DV, HC, HB, LĐ, KD, SCC… |
| **P42** | Có **"người vận động"** (ai mang KH về) — phải ghi nhận. |
| **P43** | **Trạng thái nộp phiếu**: đã có phiếu / chưa có phiếu / Hủy / Hoãn / **chuyển kỳ (T2 chuyển T3)**. |
| **P44** | **1 lần làm có thể = nhiều chỉ tiêu** ("1 BNL + 1 téc = 2 chỉ tiêu", "2BNL", "3BNL+tec+1MG"). |
| **P45** | **KH huỷ/hoãn với lý do** (bể nứt, máy hỏng, người ốm, đi vắng…). |
| **P46** | **Doanh thu DVGT nhập tự do** khi hoàn thành (không có bảng giá dịch vụ cố định). |

### Nhóm G — KPI, nhân sự, tổ chức

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P47** | **Kế hoạch năm 1.592.834.000đ ÷ 202 CBCNV ≈ 7.885.317đ/người/tháng**; theo dõi **% hoàn thành kế hoạch năm**. |
| **P48** | Doanh thu tháng **theo từng CBCNV**, **theo Trạm**, **theo BP Kinh doanh**. |
| **P49** | Cơ cấu **Phòng / Tổ / Trạm**; 43 chức danh; ~202 CBCNV. |
| **P50** | Báo cáo **thực tế theo trạm so với chỉ tiêu** (sheet `XN`). |

### Nhóm H — Tài chính / quỹ

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P51** | **Thu**: bán nước, cọc vỏ, thu nợ, DVGT. **Chi**: điện, xăng xe, nắp/màng co, lương… |
| **P52** | **Phí vận chuyển phải trả** cho nhân viên theo tháng (đối chiếu công nợ lương). |

### Nhóm I — Danh mục nền & đối chiếu

| Mã | Vấn đề đặt ra từ Excel |
|----|------------------------|
| **P53** | **Danh mục nền**: Kho, Bộ phận, Chỉ tiêu (kênh), Sản phẩm, Công việc, Kết quả, Đơn giá, Nhân sự/Đơn vị. |
| **P54** | **Đối chiếu định kỳ**: tồn kho, nợ vỏ, doanh thu — phải so được với "báo cáo chuẩn". |

---

## Phần 3. CÁC LUỒNG NGHIỆP VỤ

### L1 — Luồng nhập hàng & phân bổ kho
```
[Cẩm Phả / nhà máy / Viancontrol]
        │ (nhập)
        ▼
   KHO TĂNG ÁP (trung tâm)
        │ điều chuyển nội bộ
        ├────────► KHO HUẾ (tổ thị trường)
        ├────────► KHO LẠI LAN
        ├────────► XE TẢI ĐIỆN (kho động)
        └────────► KHO ĐÁ TRẮNG / VP
```
Ghi nhận: nguồn nhập (P11), thành tiền (P13), tồn theo ngày (P14), liên chi nhánh (P16).

### L2 — Luồng bán hàng & điều phối (luồng trung tâm)
```
Khách đặt (điện thoại / ghi số / vận động)
   │
   ▼
[LẬP LƯỢT GIAO]  ── chọn Kênh (P28) + Kho xuất (P27) + Công việc (P26)
   │               ── dòng hàng: 6 SKU + SL + KM 10+1 (P05)
   │               ── gán NGƯỜI BÁN (doanh thu) + NGƯỜI VẬN CHUYỂN (phí 5.000đ) (P28, P30, P31)
   │               ── nếu kênh KHÔNG thuộc XN → ghi nhận cho vay, không tính chỉ tiêu (P29, P34)
   ▼
[TRỪ KHO] (P10) + [GHI NHẬN THU TIỀN] (P33)
   ▼
[GIAO HÀNG] → nếu trên xe điện: đối soát đầu/cuối ca (P09)
   ▼
[QUYẾT TOÁN] → tiền mặt nộp quỹ + thu hồi vỏ (P18–P24)
   ▼
[GHI NHẬN DOANH THU] theo người bán (P48) + theo kênh
```

### L3 — Luồng vỏ bình (theo kỳ)
```
Nợ đầu kỳ  +  Vỏ xuất mới (theo đơn)  −  Vỏ khách trả  =  Nợ cuối kỳ
   (Úp)        (Úp)                        (Úp)             (Úp)
   (Vòi)       (Vòi)                       (Vòi)            (Vòi)
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   Trả về XN (P20)      Đặt cọc vỏ (P20)
          │
          ▼
   Tồn vỏ rỗng theo kho (P22) → súc rửa → tái chiết rót
```
Đối tượng: Khách hàng + Nhân viên/Nội bộ (P21). Đối chiếu "báo cáo chuẩn" (P23).

### L4 — Luồng DVGT
```
Đăng ký (đa kênh, có người vận động)  ──► Phân công thực hiện
      │                                        │
      ▼                                        ▼
  Lên lịch (ngày hẹn)                    Hoàn thành (có thể nhiều chỉ tiêu P44)
      │                                        │
      ├── Hủy / Hoãn (có lý do P45)             ▼
      └── Chuyển kỳ (T2→T3)              Nộp phiếu (P43) → Ghi nhận doanh thu (P46)
                                                │
                                                ▼
                                       Cộng vào KPI người vận động/thực hiện
```

### L5 — Luồng KPI & tổ chức
```
Kế hoạch NĂM (1,592 tỷ ÷ 202 người)  ──► Giao chỉ tiêu từng CBCNV/Trạm
        │
        ▼
Thực tế tháng = Doanh thu nước (theo người bán) + Doanh thu DVGT
        │
        ▼
% hoàn thành = Thực tế / Kế hoạch  ──► Báo cáo theo CBCNV / Trạm / BPKD
```

### L6 — Luồng điều phối & lịch trực
```
Thứ tự ưu tiên điều phối: Tiếp thị → Dịch vụ → Bảo vệ → Trạm QL
        │
        ▼
Lịch trực tổ bảo vệ theo tháng (ngày/thứ/người; có nghỉ phép)
        │
        ▼
Phân công theo khu vực phụ trách của từng điều phối viên
```

---

## Phần 4. GIẢI PHÁP CHO TỪNG VẤN ĐỀ

Ký hiệu: 🟦 = Odoo đã có khuôn mẫu (kế thừa) · 🟨 = tùy biến một phần · 🟥 = **đặc thù xí nghiệp, phải làm riêng**.

| Mã | Bài toán | Giải pháp | Nguồn |
|----|----------|-----------|-------|
| P01 | Danh mục 6 SKU chuẩn | Bảng `products` + `product_category`; mã cố định `VI_500, VI_350, HOP_500, HOP_350, KIEM_19L, RO_19L` | 🟦 Odoo `product.product` |
| P02 | Quy đổi Vỉ/Hộp/Chai | `uom` + `uom_category` + `factor`; quant lưu theo UoM gốc, chứng từ quy đổi | 🟦 Odoo `uom.uom._compute_quantity` |
| P03 | Giá Hộp độc lập | `list_price` theo từng SKU; quy đổi **không** tham gia tính giá | 🟦 Odoo `product.template.list_price` |
| P04 | Nhiều mức giá | `pricelist` + `pricelist_item` (`applied_on`, `min_quantity`, `compute_price`, `date_start/end`) | 🟦 Odoo `product.pricelist.item` |
| P05 | KM 10+1 | `order_line.promo_qty` riêng, `price_unit = 0`; trừ kho theo `quantity + promo_qty` | 🟨 Odoo không có sẵn KM tặng theo dòng → thêm cột |
| P06 | Lỗi nhãn giá | Bỏ bảng giá nhúng; mọi giá đọc từ `pricelist` | 🟨 tùy biến (dữ liệu) |
| P07 | Vòi/Úp là thuộc tính vỏ | **Không** tạo SKU Vòi/Úp; `order_line.shell_type ∈ {VOI, UP}` chọn khi giao | 🟥 đặc thù |
| P08 | Đa kho | `stock.warehouse` + `stock.location` (usage internal/store) | 🟦 Odoo `stock.warehouse` |
| P09 | Kho ảo trên xe | `stock.location` usage `internal` con của kho (hoặc `transit`) cho xe điện | 🟨 Odoo `transit` location |
| P10 | Ma trận XNT × TẶNG | `stock.move` với cặp `location_src → location_dest`, thêm `is_promo` | 🟨 Odoo move + cờ tặng |
| P11 | Nguồn nhập | `stock.move.location_id` trỏ supplier/branch location; `origin` ghi nguồn | 🟦 Odoo `stock.move` |
| P12 | Người nhận + bộ phận | `stock.move_line.partner_id`/`owner_id` + `department_id` | 🟨 Odoo partner + thêm department |
| P13 | Thành tiền tồn | **Định giá tồn** `stock_valuation` (giá vốn × SL) | 🟦 Odoo `stock_account` |
| P14 | Tồn theo ngày | `stock_quant` + truy vấn tồn đầu/nhập/xuất/cuối theo ngày | 🟦 Odoo `stock.quant` |
| P15 | Đối chiếu Thực tế/Công nợ | Báo cáo đối chiếu 2 nguồn + cột chênh lệch | 🟥 đặc thù (báo cáo riêng) |
| P16 | Nhập từ Cẩm Phả | `stock.picking` loại nhập với `partner_id` = chi nhánh Cẩm Phả | 🟦 Odoo picking + partner |
| P17 | Điều chuyển nội bộ | `stock.picking` code `internal`, cặp location internal→internal | 🟦 Odoo internal transfer |
| P18 | Nợ vỏ 2 loại | Sổ vỏ có 2 cột độc lập `up`/`voi` | 🟥 đặc thù |
| P19 | Sổ vỏ theo kỳ | `bottle_ledger_lines`: `period, opening/in/returned/closing × {up,voi}` | 🟥 đặc thù |
| P20 | Trả XN + đặt cọc | Thêm cột `returned_to_enterprise_*`, `deposit_amount` | 🟥 đặc thù |
| P21 | Nợ vỏ gồm nhân viên | `subject_type ∈ {CUSTOMER, EMPLOYEE, INTERNAL}` | 🟥 đặc thù |
| P22 | Tồn vỏ rỗng theo kho | `shell_balances (warehouse_id, shell_type, qty)` | 🟥 đặc thù |
| P23 | Đối chiếu báo cáo chuẩn | Bảng đối chiếu: số hệ thống – "báo cáo chuẩn" = chênh lệch | 🟥 đặc thù |
| P24 | Ghi chú nợ vỏ | `note` tự do trên dòng sổ vỏ | 🟨 tùy biến |
| P25 | 1 đơn nhiều dòng con | `sale.order` (1 lượt) + `sale.order.line` (n dòng SKU) | 🟦 Odoo SO/SOL |
| P26 | Loại công việc | `delivery_line.work_type ∈ {VAN_CHUYEN, BOC_XEP}` | 🟥 đặc thù |
| P27 | Kho xuất | `sale.order.warehouse_id` / `stock.move.location_id` | 🟦 Odoo warehouse |
| P28 | 2 trục hạch toán | `sale_order.seller_id` (doanh thu) + `revenue_channel_id` (kênh) | 🟨 Odoo `user_id` + thêm channel |
| P29 | Kênh ngoài XN | `revenue_channel.counts_for_kpi`; kênh ngoài → sinh phiếu cho vay | 🟥 đặc thù |
| P30 | Nhiều người/lượt | `delivery_line_workers (role, employee_id, fee_share)` — chia đều | 🟥 đặc thù |
| P31 | Phí VC 5.000đ | `delivery_method` + `delivery_price_rule` `base_price 5000 × quantity` | 🟦 Odoo `delivery.price.rule` |
| P32 | Kết quả lượt giao | `delivery_line.result` (hoàn thành/chưa) | 🟥 đặc thù |
| P33 | Thu tiền chuẩn hóa | `payment_status/payment_method` + `collection_note` giữ ghi chú gốc | 🟨 Odoo + note |
| P34 | Vay mượn trên dòng bán | Khi kênh ngoài XN → sinh `branch_loan` gắn chi nhánh | 🟥 đặc thù (Odoo không có) |
| P35 | Lịch trực + thứ tự ĐP | `shift_schedules` + `dispatch_priorities` | 🟥 đặc thù |
| P36 | Khu vực điều phối viên | `dispatch_agents (employee, home_address, phone, area)` | 🟥 đặc thù |
| P37 | Khách lẻ / mua trực tiếp | `customers.is_quick` (mã `KHL`), chụp nhanh tên/SĐT/địa chỉ trên đơn | 🟨 Odoo `res.partner` + quick create |
| P38 | Chi nhánh/đơn vị bạn | `partner_branches` (Cẩm Phả, Bãi Cháy, Miền Đông, Móng Cái, TCT…) | 🟦 Odoo `res.partner` (loại nhà cung cấp/khách) |
| P39 | Công nợ tiền | `customers.current_debt` + `max_debt_limit` + phiếu thu `DEBT_COLLECTION` | 🟨 Odoo `account` (đơn giản hóa) |
| P40 | 5 loại DV + phát sinh | `service_types` (5 loại) + cho phép nhập mô tả tự do cho phát sinh | 🟨 Odoo product service |
| P41 | Đa kênh đăng ký | `utm_source/medium/campaign` + `registration_channel` | 🟦 Odoo `utm` + mở rộng |
| P42 | Người vận động | `dvgt.referrer_employee_id` | 🟥 đặc thù |
| P43 | Trạng thái nộp phiếu | `dvgt.doc_status ∈ {HAS_DOC, NO_DOC, CANCELLED}` + `carry_over_period` | 🟥 đặc thù |
| P44 | Nhiều chỉ tiêu/lần làm | `dvgt_lines` (mỗi dòng = 1 chỉ tiêu/dịch vụ con) | 🟥 đặc thù |
| P45 | Huỷ/hoãn có lý do | `dvgt.state` + `lost_reason_id` | 🟦 Odoo CRM `lost_reason` |
| P46 | Doanh thu nhập tự do | `dvgt.revenue_amount` nhập tay khi hoàn thành | 🟨 tùy biến |
| P47 | Kế hoạch năm/người | `kpi_plans (employee, year, month?, target_revenue)` | 🟥 đặc thù |
| P48 | Doanh thu tháng theo CBCNV/Trạm | `sale_report`-style view + nhóm theo employee/department | 🟦 Odoo `sale.report` |
| P49 | Cơ cấu Phòng/Tổ/Trạm | `departments (type ∈ {PHONG, TO, TRAM, VP}, parent_id)` | 🟥 đặc thù |
| P50 | Báo cáo theo trạm | Dashboard KPI theo department | 🟨 tùy biến |
| P51 | Sổ quỹ Thu–Chi | `revenue_transactions` + `expense_transactions` | 🟨 Odoo `account` (đơn giản hóa) |
| P52 | Phí VC phải trả NV | Tổng hợp `delivery_line_workers.fee_share` theo tháng | 🟥 đặc thù |
| P53 | Danh mục nền | Master data: kho, bộ phận, kênh, sản phẩm, công việc, kết quả, đơn giá, nhân sự/đơn vị | 🟦 Odoo master data |
| P54 | Đối chiếu định kỳ | Bộ báo cáo đối chiếu (kho, vỏ, doanh thu) | 🟥 đặc thù |

**Tổng kết:** tái sử dụng Odoo cho phần **lõi chuẩn** (kho–move–quant, đơn–dòng–pricelist, UoM, delivery rule, CRM stage/utm, báo cáo SQL view); **tùy biến** cho phần **đặc thù nước đóng bình**: nợ vỏ theo kỳ, vòi/úp, tồn vỏ rỗng, kho ảo trên xe, nhiều người/lượt giao, kênh counts_for_kpi, vay mượn gắn dòng bán, DVGT đa chỉ tiêu + nộp phiếu, KPI kế hoạch năm.

---

## Phần 5. KIẾN TRÚC DỮ LIỆU

### 5.1. Kế thừa từ Odoo (mô hình chuẩn)

| Khái niệm Odoo | Áp dụng cho xí nghiệp |
|----------------|----------------------|
| `stock.location` (usage) | Cây vị trí: kho cha → kệ/ngăn; `internal` cho kho & xe; `supplier` cho Cẩm Phả; `customer` cho xuất bán; `inventory` cho kiểm kê |
| `stock.move` | **Bút toán kho duy nhất**: mọi nhập/xuất/chuyển/kiểm kê đều là 1 move `src → dest` |
| `stock.picking` | **Phiếu** nhập/xuất/chuyển nội bộ; trạng thái suy từ move |
| `stock.quant` | **Tồn** theo (product, location) + `reserved_quantity` |
| `uom` / `uom_category` | Quy đổi Chai ↔ Vỉ ↔ Hộp |
| `product.pricelist` / `pricelist.item` | Bảng giá bán & giá đại lý |
| `sale.order` / `sale.order.line` | Đơn bán + dòng hàng; `qty_delivered` tự tính |
| `procurement.group` | Gom các move/picking của một đơn |
| `crm.lead` / `crm.stage` | Phễu DVGT & chăm sóc KH |
| `utm.source/medium/campaign` | Kênh đăng ký & nguồn khách |
| `delivery.carrier` / `delivery.price.rule` | Bảng giá cước & phương thức giao |
| `sale.report` (SQL view) | Báo cáo doanh thu đa chiều |

### 5.2. Tùy biến (đặc thù xí nghiệp) — **bảng mới**

| Bảng | Mục đích | Trường chính |
|------|----------|--------------|
| `revenue_channels` | Kênh/đơn vị hưởng doanh thu | `code, name, kind, counts_for_kpi, partner_branch_id` |
| `departments` | Cơ cấu tổ chức | `code, name, type(PHONG/TO/TRAM/VP), parent_id` |
| `shell_ledger_lines` | Sổ vỏ theo kỳ | `period, subject_type, subject_id, opening/in/returned/returned_to_xn/closing × {up, voi}, deposit_amount, note` |
| `shell_balances` | Tồn vỏ rỗng theo kho | `warehouse_id, shell_type, quantity` |
| `shell_checks` | Đối chiếu "báo cáo chuẩn" | `period, subject_id, system_qty, manual_qty, diff` |
| `delivery_lines` | Lượt giao/bốc xếp | `order_id, work_type, warehouse_id, result, note` |
| `delivery_line_workers` | Nhiều người/lượt | `delivery_line_id, role(PERFORMER/CARRIER/SUPPORT), employee_id, fee_share` |
| `dispatch_agents` | Điều phối viên | `employee_id, home_address, phone, area` |
| `shift_schedules` | Lịch trực bảo vệ | `department_id, duty_date, weekday, employee_id, note` |
| `dispatch_priorities` | Thứ tự điều phối tổ | `department_id, priority_order` |
| `service_types` | Loại DVGT | `code, name, is_active` |
| `dvgt_requests` | Yêu cầu DVGT | `code, customer, service_type, referrer_employee_id, registration_channel, scheduled_date, completed_date, state, doc_status, carry_over_period, revenue_amount` |
| `dvgt_lines` | Nhiều chỉ tiêu/lần làm | `dvgt_id, service_type, quantity` |
| `kpi_plans` | Kế hoạch doanh thu | `employee_id, year, month(NULL=năm), target_revenue` |
| `branch_loans` (+items/settlements) | Vay mượn liên chi nhánh | `direction(GIVE/TAKE), partner_branch_id, status, due_date` |
| `revenue_transactions` / `expense_transactions` | Sổ quỹ Thu–Chi | `type, amount, payment_method, date, note` |

### 5.3. Sửa đổi trên bảng kế thừa

| Bảng | Thay đổi |
|------|----------|
| `products` | Rút về **6 SKU nước** (+ dịch vụ); bỏ Vòi/Úp khỏi SKU; thêm `tracks_shell` |
| `order_lines` | Thêm `promo_qty` (KM), `shell_type` (VOI/UP khi giao) |
| `orders` | Thêm `revenue_channel_id` (bắt buộc), `seller_id`, `is_quick_customer`, thông tin khách nhanh, `collection_note`, `warehouse_id` |
| `stock_moves` | Thêm `is_promo`, `department_id`, `partner_branch_id` |
| `customers` | Thêm `is_quick`; chuyển nợ vỏ sang `shell_ledger_lines` |
| `employees` | Thêm `department_id` (giữ `station_id` để tương thích) |

---

## Phần 6. GIAO DIỆN ERP DỰ KIẾN

> Sơ đồ dạng wireframe — mô tả bố cục từng màn hình và nút bấm chính. Đây là cơ sở để dựng phần mềm demo.

### 6.1. Khung chung (Shell)
```
┌───────────────────────────────────────────────────────────────────────────────┐
│  QAROMI ERP            [Kỳ: Tháng 9/2026 ▼]        🔔 Cảnh báo  👤 Đinh Thu Huế │
├──────────────┬────────────────────────────────────────────────────────────────┤
│ ▶ Điều hành  │                                                                │
│   • Tổng quan│                                                                │
│ ▶ Kinh doanh │                                                                │
│   • Bán hàng │                    VÙNG NỘI DUNG PHÂN HỆ                       │
│   • Điều phối│                                                                │
│   • Khách hàng│                                                               │
│   • DVGT     │                                                                │
│ ▶ Kho        │                                                                │
│   • XNT kho  │                                                                │
│   • Tồn vỏ   │                                                                │
│ ▶ Nhân sự    │                                                                │
│   • KPI      │                                                                │
│   • Nhân sự  │                                                                │
│ ▶ Tài chính  │                                                                │
│   • Sổ quỹ   │                                                                │
│ ▶ Hệ thống   │                                                                │
│   • Danh mục │                                                                │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

### 6.2. Màn hình 1 — Bán hàng & Điều phối (lưới nhập nhanh) 【P25–P34】
```
┌─ LẬP LƯỢT GIAO ──────────────────────────────────────────────── [Lưu] [In] ──┐
│ Ngày: 12/09/2026   Kênh*: [Xí nghiệp ▼]   Kho xuất: [Hồng Gai ▼]            │
│ Khách: [🔍 Tìm...  ] hoặc [＋ Khách nhanh]   SĐT: ____  Địa chỉ: __________  │
│ Công việc: (•) Vận chuyển  ( ) Bốc xếp                                      │
├── DÒNG HÀNG (nhập như bảng tính: Tab/Enter) ────────────────────────────────┤
│ #│ Sản phẩm    │ ĐVT │ SL │ KM │ Vỏ   │ Đơn giá │ Thành tiền │ Ghi chú      │
│ 1│ Vỉ 500ml    │ Vỉ  │ 10 │ 1  │ —     │  98.000 │   980.000  │              │
│ 2│ Bình ion    │ Bình│  8 │ 0  │ Vòi   │  52.000 │   416.000  │              │
│ 3│ Vỉ 350ml    │ Vỉ  │  2 │ 0  │ —     │  85.000 │   170.000  │              │
│ ＋ Thêm dòng…                                    │ TỔNG: 1.566.000           │
├── LƯỢT GIAO ────────────────────────────────────────────────────────────────┤
│ Người bán (doanh thu): [Đinh Thu Huế ▼]                                     │
│ Người thực hiện: [Phương ×] [Huế ×] [＋]   → công VC chia đều               │
│ Người vận chuyển: [Tùng ×] [Huế ×] [＋]    → phí 5.000đ/đơn vị              │
│ Hỗ trợ: [trạm Hồng Gai ×]                                                   │
│ Kết quả: [Hoàn thành ▼]    Thu tiền: [CK 12/9 _____ ] (ghi chú tự do)       │
│ Ghi chú: [______________________________________]                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Nếu **Kênh ≠ Xí nghiệp** (Công ty/Bãi Cháy/Miền Đông…): hiện băng vàng **"KHÔNG tính chỉ tiêu – sẽ sinh phiếu cho vay"** 【P29, P34】.

### 6.3. Màn hình 2 — Điều phối & Vận chuyển 【P31, P35, P36】
```
┌─ BẢNG PHÍ VẬN CHUYỂN – THÁNG 9/2026 ──────────────────────────────── [Xuất] ─┐
│ STT │ Người thực hiện      │ Tổ/Trạm      │ Số lượng │ Số tiền             │
│  1  │ Đinh Thu Huế         │ Tổ thị trường│   161    │   805.000           │
│  2  │ Nguyễn Văn Hưng      │ Hà Lầm       │    20    │   100.000           │
│ ... │ ...                  │ ...          │  ...     │  ...                │
│     │ CỘNG                 │              │   277    │ 1.385.000           │
├─ LỊCH TRỰC TỔ BẢO VỆ ────────────────────────────────────────────────────────┤
│ Ngày │ Thứ │ Người thực hiện │ Ghi chú                                       │
│  1   │  2  │ Bùi Đức Hoàng   │                                               │
│  2   │  3  │ Nguyễn Thị Hằng │ nghỉ phép                                     │
├─ THỨ TỰ ĐIỀU PHỐI ───────────────────────────────────────────────────────────┤
│ 1. Tổ Tiếp thị  →  2. Tổ Dịch vụ  →  3. Tổ Bảo vệ  →  4. Trạm QL            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.4. Màn hình 3 — XNT kho 【P08–P17】
```
┌─ XUẤT – NHẬP – TỒN ─── Kho: [Hồng Gai ▼]   Từ [01/09] đến [30/09] ─  [Xuất] ┐
│ STT│ Ngày   │ Diễn giải           │ Vỉ500│ Vỉ350│ Hộp500│ BìnhIon│ BìnhRO │
│ 1  │ 08/09  │ Tồn đầu kỳ          │  28  │  46  │   0   │   9    │  ...   │
│ 2  │ 08/09  │ Nhập từ CP (60 vỉ)  │ +60  │      │       │        │        │
│ 3  │ 09/09  │ Xuất bán – Huế      │ -50  │      │  +11  │  +22   │  ...   │
│ .. │        │ …                   │      │      │       │        │        │
├────┴────────┴─────────────────────┴──────┴──────┴───────┴────────┴────────┤
│ TỔNG NHẬP: …   TỔNG XUẤT: …   TỒN CUỐI: …      THÀNH TIỀN: 12.340.000đ     │
├─ ĐỐI CHIẾU ────────────────────────────────────────────────────────────────┤
│ Chỉ tiêu        │ Hệ thống │ Báo cáo thực tế │ Chênh lệch                  │
│ Tồn Vỉ 500ml    │   172    │       175       │        -3   ⚠               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.5. Màn hình 4 — Sổ vỏ bình theo kỳ 【P18–P24】
```
┌─ SỔ NỢ VỎ – KỲ 09/2026 ─── Đối tượng: [Khách hàng ▼] ───────────── [Xuất] ─┐
│ Đối tượng        │ Nợ đầu│ Nhập│ Trả vỏ│ Trả XN│ Đặt cọc│ Nợ cuối        │
│                  │ Úp│Vòi│ Úp│Vòi│ Úp│Vòi│ Úp│Vòi│        │ Úp │ Vòi       │
│ UBND Tỉnh QN     │ 10│ 35│ 0 │22 │ 1│ 19│ 0 │ 0 │ 0      │  9 │  38       │
│ Đinh Thu Huế     │  5│ 91│ 5 │47 │ 0│ 52│ 0 │ 0 │ 0      │ 10 │  86       │
│ …                │    │   │   │   │  │   │   │   │        │    │           │
├─ ĐỐI CHIẾU BÁO CÁO CHUẨN ───────────────────────────────────────────────────┤
│ Tổng hệ thống: 103│419    Báo cáo chuẩn: 102│412    Chênh lệch: +1│+7  ⚠     │
├─ TỒN VỎ RỖNG THEO KHO ──────────────────────────────────────────────────────┤
│ Cao Xanh: 15   Hồng Hải: 10   VPXN: 7                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.6. Màn hình 5 — DVGT (Kanban pipeline) 【P40–P46】
```
┌─ DỊCH VỤ GIA TĂNG ──────────────────────────── [＋ Đăng ký mới] ─────────────┐
│ ┌─ Mới đăng ký ─┐ ┌─ Đã phân công ─┐ ┌─ Đang làm ─┐ ┌─ Hoàn thành ─┐        │
│ │ Bể - C Hương │ │ MG - a Tiến    │ │ Téc - bà Na│ │ 2BNL - V.Hải │        │
│ │ Nguồn: Thơ CX│ │ Nguồn: SCC     │ │ Người: Hiếu│ │ Phiếu: ✓     │        │
│ │ VĐ: Thảo KD  │ │ VĐ: Lại Lan    │ │            │ │ DT: 500.000  │        │
│ └──────────────┘ └────────────────┘ └────────────┘ └──────────────┘        │
├─ CHI TIẾT ĐĂNG KÝ ──────────────────────────────────────────────────────────┤
│ Khách: [Đặng Văn Thơ]  SĐT: [0915655786]  ĐC: [T21B K3 Hà Khánh]           │
│ Dịch vụ: [Bể ×] [Téc ×]  → 2 chỉ tiêu  │ Người vận động: [Thơ CX ▼]         │
│ Hình thức ĐK: [CX ▼]  Ngày hẹn: [13/09]  Nộp phiếu: [Đã có phiếu ▼]         │
│ Trạng thái: [Hoàn thành ▼]  Doanh thu: [500.000]  (nhập tự do)              │
│ Lý do huỷ/hoãn (nếu có): [___________________]                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.7. Màn hình 6 — KPI 【P47–P50】
```
┌─ CHỈ TIÊU KPI – NĂM 2026 ─── [Giao chỉ tiêu] [Tính lại thực tế] ────────────┐
│ Kế hoạch năm: 1.592.834.000đ   │  CBCNV: 202   │  BQ/người: 7.885.317đ      │
├─────────────────────────────────────────────────────────────────────────────┤
│ CBCNV             │ Trạm     │ Tháng 9      │ Lũy kế      │ %KH năm │ Đạt   │
│ Đinh Thu Huế      │ VP       │   6.860.000  │  55.209.822 │  58%    │  ▓▓▓░ │
│ Bùi Hà Thu        │ Hà Lầm   │   8.147.658  │  ...        │  ...    │       │
│ …                 │          │              │             │         │       │
├─ TỔNG HỢP THEO TRẠM ────────────────────────────────────────────────────────┤
│ Trạm Hạ Long: 31.862.582 │ Hà Tu: 35.854.433 │ Hà Lầm: 73.241.350 │ …       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.8. Các màn hình còn lại (tóm tắt bố cục)
- **Khách hàng & công nợ** 【P37–P39】: danh sách KH (nhóm, hạn mức nợ, nợ tiền, nợ vỏ Úp/Vòi) + tab **Sổ nợ vỏ** + nút "Thu nợ".
- **Sản phẩm & Bảng giá** 【P01–P06】: 6 SKU, quy cách, giá bán/đại lý, cọc vỏ, `tracks_shell`.
- **Tồn vỏ rỗng** 【P22】: bảng kho × {Úp, Vòi}.
- **Vay mượn liên chi nhánh** 【P16, P34, P38】: phiếu 2 chiều + quyết toán (trả hàng/tiền/bù trừ).
- **Nhân sự & Tổ chức** 【P49】: cây Phòng/Tổ/Trạm, chức danh, trạm công tác.
- **Sổ quỹ Thu–Chi** 【P51】: phiếu thu (bán nước, cọc vỏ, thu nợ, DVGT), phiếu chi (điện, xăng, nắp/màng co, lương, phí VC).
- **Danh mục hệ thống** 【P53】: kênh, phòng/tổ/trạm, loại DV, kho, sản phẩm, công việc, kết quả, đơn giá.

---

## Phần 7. CÁC BƯỚC VẬN HÀNH

> Kịch bản chạy thử trên phần mềm demo — mỗi bước ghi rõ **màn hình**, **thao tác**, và **vấn đề được giải quyết (Pxx)**.

### Kịch bản S1 — Nhập hàng từ Cẩm Phả về kho 【P08, P11, P13, P16】
1. Vào **Kho → Phiếu nhập**, bấm **[＋ Phiếu nhập]**.
2. Chọn **Nguồn nhập = Chi nhánh Cẩm Phả**, **Kho nhận = Kho Tăng Áp**, ngày nhập.
3. Nhập dòng: Bình RO 60, Bình ion 120, Vỉ 500… (nhập theo sheet `nhập từ CP`).
4. Bấm **[Xác nhận]** → hệ thống sinh `stock.move` (`supplier → internal`) và **cộng tồn** đúng kho.
5. Lặp lại cho **Kho chị Huế** nếu cùng chuyến.
6. Kiểm tra **Báo cáo XNT ngày** thấy cột "Nhập" tăng và **Thành tiền** cập nhật 【P13, P14】.

### Kịch bản S2 — Lập một đơn bán 10+1 có giao và thu tiền 【P03, P05, P25–P34】
1. Vào **Bán hàng → [＋ Lượt giao]**. Chọn **Ngày**, **Kênh = Xí nghiệp** 【P28】.
2. Chọn khách: gõ tìm; nếu **"Kh lẻ"** → **[＋ Khách nhanh]** chỉ nhập tên/SĐT 【P37】.
3. Chọn **Kho xuất = Hồng Gai**, **Công việc = Vận chuyển** 【P26, P27】.
4. Trên **lưới dòng hàng**: dòng 1 `Vỉ 500ml`, `SL = 10`, `KM = 1` → thành tiền chỉ tính 10 (980.000đ) 【P05】.
5. Gán **Người bán = Đinh Thu Huế** (doanh thu); **Người vận chuyển = [Tùng][Huế]** → hệ thống chia đều & tính **11 × 5.000 = 55.000đ** 【P30, P31】.
6. Ghi **Thu tiền: "CK12/9"** 【P33】. Bấm **[Lưu]**.
7. Kết quả: trừ tồn 11 vỉ (10 bán + 1 KM) 【P10】; nếu là bình → tăng **nợ vỏ Vòi/Úp** tương ứng 【P18】; doanh thu cộng vào KPI của Huế 【P48】.
8. Nếu ở bước 1 chọn **Kênh = Công ty** → hiện băng vàng **"không tính chỉ tiêu"** và hệ thống **tự tạo phiếu cho vay** gắn chi nhánh 【P29, P34】.

### Kịch bản S3 — Giao hàng trên xe điện & quyết toán ca 【P09, P31, P32】
1. Đầu ca: vào **Kho → Điều chuyển**, chuyển hàng từ **Kho Tăng Áp → Xe tải điện** (kho ảo) 【P09】.
2. Trong ngày, các lượt giao có **Người vận chuyển = Phương** tự ghi nhận phí 【P31】.
3. Cuối ca: vào **Điều phối → Quyết toán ca**, nhập **hàng còn trên xe**, **tiền mặt thu**, **vỏ thu hồi** (Úp/Vòi) 【P18】.
4. Hệ thống **hoàn hàng còn lại về kho**, ghi nhận **chênh lệch** nếu có 【P15】.
5. Bảng **Phí vận chuyển theo người/tháng** tự cộng dồn 【P52】.

### Kịch bản S4 — Khách trả vỏ / phát sinh nợ vỏ 【P18–P24】
1. Vào **Khách hàng → Sổ nợ vỏ**, chọn khách, kỳ hiện tại.
2. Bấm **[＋ Thu hồi vỏ]**: nhập số vỏ trả (Úp/Vòi) và/hoặc **Đặt cọc** 【P20】.
3. Nếu **khách chưa trả đủ** → dòng "Nợ mới" tăng; hệ thống ghi **chênh lệch** so với "báo cáo chuẩn" 【P23】.
4. Nếu **nhân viên/nội bộ giữ vỏ** (VPXN, Khoa, Thơ…) → chọn **Đối tượng = Nhân viên/Nội bộ** 【P21】.
5. Trả vỏ về xí nghiệp → bấm **[Trả XN]**, tự cập nhật **tồn vỏ rỗng theo kho** 【P22】.

### Kịch bản S5 — Đăng ký & hoàn thành DVGT 【P40–P46】
1. Vào **DVGT → [＋ Đăng ký]**.
2. Nhập khách, SĐT, địa chỉ; chọn **dịch vụ** (Bể, Téc, Máy giặt, BNL…); có thể thêm **nhiều dòng** nếu 1 lần làm = nhiều chỉ tiêu 【P40, P44】.
3. Chọn **Người vận động** và **Hình thức đăng ký** (XN/CX/YK/CT/SCC…) 【P41, P42】.
4. Đặt **ngày hẹn**; nếu khách hoãn/huỷ → chọn trạng thái + **lý do** 【P45】; nếu đẩy sang tháng sau → chọn **"Chuyển kỳ"** 【P43】.
5. Khi làm xong: kéo thẻ sang **Hoàn thành**, bật **"Nộp phiếu"**, nhập **doanh thu tự do** 【P46】.
6. Hệ thống cộng doanh thu DVGT vào **KPI** tháng của người vận động/thực hiện 【P48】.

### Kịch bản S6 — Giao chỉ tiêu & chốt KPI tháng 【P47, P48, P50】
1. Vào **KPI → [Giao chỉ tiêu]**: nhập **kế hoạch năm** cho từng CBCNV (mặc định 7.885.317đ/tháng) 【P47】.
2. Cuối tháng: bấm **[Tính lại thực tế]** → hệ thống lấy doanh thu nước (theo người bán) + doanh thu DVGT.
3. Xem cột **% hoàn thành kế hoạch năm** theo từng người 【P48】.
4. Chuyển tab **Theo Trạm / Theo BPKD** để đối chiếu chỉ tiêu 【P50】.

### Kịch bản S7 — Đối chiếu cuối kỳ 【P15, P23, P54】
1. Vào **Kho → Đối chiếu XNT**: so **Hệ thống** với **Báo cáo thực tế** theo từng kho/SKU → cột **Chênh lệch**.
2. Vào **Khách hàng → Đối chiếu sổ vỏ**: so **Hệ thống** với **Báo cáo chuẩn** → cột **Chênh lệch**.
3. Vào **Báo cáo doanh thu**: đối chiếu tổng doanh thu tháng với file Excel gốc.
4. Xuất Excel kết quả đối chiếu để lưu hồ sơ.

---

## Phần 8. LỘ TRÌNH & ĐỐI CHIẾU

### 8.1. Lộ trình 7 chặng

| Chặng | Nội dung | Nghiệm thu |
|:-----:|----------|-----------|
| **1** | Danh mục & giá nền: 6 SKU, bảng giá `Đơn giá`, kênh doanh thu, phòng/tổ/trạm, loại DV, kho + Lại Lan | Khai báo được qua UI; giá đúng |
| **2** | Bán hàng nhập nhanh: lưới bảng tính, khách nhanh, kênh bắt buộc, KM 10+1, chọn vỏ | Lập đơn nhanh; tồn & doanh thu đúng |
| **3** | Lượt giao & phí vận chuyển: nhiều người/vai trò, 5.000đ/đơn vị, tổng hợp tháng | Bảng phí khớp file |
| **4** | Sổ vỏ theo kỳ: nợ đầu/nhập/trả/nợ cuối, Úp/Vòi, Trả XN, cọc, nợ nội bộ, đối chiếu | Báo cáo đối chiếu đúng chênh lệch |
| **5** | KPI doanh thu: kế hoạch năm/người, thực tế tháng, % hoàn thành, báo cáo Trạm/BPKD | Khớp sheet `XN`/`BPKD` |
| **6** | DVGT, kho nâng cao, điều phối: 5 loại DV + kênh đăng ký; XNT ngày có thành tiền; tồn vỏ rỗng; nhập từ CP; lịch trực + thứ tự ĐP | Các báo cáo chạy đúng |
| **7** | Migration & đối chiếu: ~202 CBCNV, gộp SKU, gán kênh, chuyển số dư vỏ, đối chiếu Excel | Số liệu khớp file gốc |

### 8.2. Ma trận đối chiếu chặng ↔ vấn đề

| Chặng | Vấn đề bao phủ |
|:-----:|----------------|
| 1 | P01–P07, P38, P49, P53 |
| 2 | P25–P30, P32, P33, P37 |
| 3 | P26, P31, P52 |
| 4 | P18–P24 |
| 5 | P47, P48, P50 |
| 6 | P08–P17, P40–P46, P35, P36 |
| 7 | P39, P51, P54, toàn bộ |

### 8.3. Điểm còn để ngỏ (không chặn triển khai)
- **"Nội bộ công ty"** có tính vào chỉ tiêu cá nhân hay không (mặc định tách riêng).
- Khối lượng chuyển đổi lớn (gộp SKU + ~202 nhân sự + số dư vỏ) — cần backup và đối chiếu từng bước.
- Doanh thu DVGT có tách VAT hay không (Excel đang nhập gộp).

---

## Phụ lục A. Giá trị phân loại trích từ Excel

> Trích trực tiếp từ 3 file (đã lọc bỏ dòng tiêu đề/số điện thoại lẫn vào cột).

**A1. Sản phẩm & giá (`Đơn giá`)** — 6 dòng:

| Mã | Mặt hàng | Quy cách | Giá bán | Cọc vỏ |
|----|----------|----------|--------:|-------:|
| `VI_500` | Vỉ 500ml | 6 chai | 98.000 | 0 |
| `VI_350` | Vỉ 350ml | 6 chai | 85.000 | 0 |
| `HOP_500` | Hộp/Thùng 500ml | 24 chai (4 vỉ) | 106.000 | 0 |
| `HOP_350` | Hộp/Thùng 350ml | 24 chai (4 vỉ) | 93.000 | 0 |
| `KIEM_19L` | Bình ion kiềm 19L | Bình | 52.000 | 50.000 |
| `RO_19L` | Bình RO 19L | Bình | 48.000 | 50.000 |

**A2. Công việc (`XUẤT`.`D`)**: `Vận chuyển`, `Bốc xếp`.
**A3. Kho (`XUẤT`.`E`)**: `Hồng Gai`, `tăng áp`, `VP`/`VPXN`/`Văn phòng`, `Hà Lầm`, `vay Quảng Yên`, `xe cp hạ luôn`.
**A4. Kết quả (`XUẤT`.`L`)**: `hoàn thành`, `Đã hoàn thành`.
**A5. Chỉ tiêu/kênh (`XUẤT`.`M`)**: `Xí nghiệp`, `Công ty`, `Bãi Cháy`, `Miền Đông`, `Diễn Vọng`, `nội bộ công ty`.
**A6. Thu tiền (`XUẤT`.`Z`)**: `CK<ngày>`, `TM<ngày>`, `công ty thu tiền`, `Bãi Cháy tự thu`.
**A7. Ghi chú (`XUẤT`.`AC`)**: `CÔNG TY VAY`, `BÃI CHÁY VAY`, `vay công ty`, `Vay Hà Lầm`, `DIỄN VỌNG VAY`, `<ai> thu tiền`, `công ty trả nợ luôn rồi`.
**A8. Bộ phận nhận (`KHO TỔNG`.`Q`)**: `Văn Phòng`, `Hà Tu`, `Hà Lầm`, `Hồng Gai`, `Cao Xanh`, `Đá Trắng`, `Hạ Long`, `Tổ DV`.
**A9. Nguồn nhập (`KHO TỔNG`.`B`)**: `Kho Huế`, `Tăng áp`, `Viancontrol`, `trả BC`, `đơn cp`.
**A10. Bộ phận/kênh kho Huế (`Huế`.`Q`)**: `XN`, `BC`, `cty`, `CP`.
**A11. Tổ/Trạm (`CBCNV`.`D`, `XN`.`D`)**: `Văn phòng`, `Đá Trắng`, `Hồng Gai`, `Hạ Long`, `Hà Lầm`, `Cao Xanh`, `Hà Tu`, `DV-CTT`.
**A12. Chức danh (`CBCNV`.`C`)**: 43 giá trị, gồm `Giám đốc`, `P. Giám đốc`, `TBP. Kinh doanh`, `Trạm trưởng`, `Trạm phó`, `CN quản lý`, `CN VHMB`, `CN ghi số`, `CN Bảo vệ`, `NV kinh doanh`, `NV kế toán`, `CN kỹ thuật`…
**A13. Hình thức đăng ký DVGT (`DS bình chỉnh`.`K`)**: `XN`, `CX`, `YK`, `CT`, `CTT`, `DV`, `HC`, `HB`, `LĐ`, `KD`, `SCC`.
**A14. Dịch vụ DVGT (`Thư`.`I`, `ban cu Nhung`.`K`)**: `bể`, `rửa bể`, `téc`, `rửa téc`, `BNL`, `máy giặt` (lồng đứng/ngang), `thay hộp`, `thay van`, `thay rắc co`, `di chuyển đồng hồ`, `sục đường ống`…
**A15. Trạng thái nộp phiếu (`Thư`.`E`, `ban cu Nhung`.`G`)**: `đã có phiếu`, `Hủy`/`hủy`, `Hoãn`, `Done`, `T2 chuyển T3`, `Kh T2 chuyển T3`, `chuyển BC`.
**A16. Đối tượng giữ vỏ (`Theo dõi vỏ bình`.`C`)**: khách hàng lớn + **nội bộ** (`Thơ`, `Quỳnh`, `C Tươi`, `Hiên`, `Thu`, `Dung Cương`, `VPXN`, `Khoa`, `Yến KD`, `Thịt chó Long Bình`…).
**A17. Tồn vỏ rỗng theo kho (`Theo dõi vỏ bình`)**: `Tồn kho Cao Xanh = 15`, `Hồng Hải = 10`, `VPXN = 7`.
**A18. Kế hoạch/KPI (`XN`)**: `Kế hoạch năm 2026 = 1.592.834.000`; `CBCNV = 202`; `Kế hoạch/người ≈ 7.885.317`.
**A19. Lý do huỷ/hoãn DVGT (`Thư`.`D`)**: `KH huỷ không còn nhu cầu`, `máy hỏng`, `bể nứt`, `KH có người ốm`, `hẹn lại hôm khác`…

---

*Tài liệu này là nguồn gốc thiết kế; mọi thay đổi nghiệp vụ cần cập nhật ngược lại đây.*
