# Bộ file nhập thử (dựng từ sổ "ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa (1).xlsx")

Các file dưới đây **đúng theo mẫu của từng màn hình** (giữ nguyên tiêu đề cột, sheet "Hướng dẫn" và dropdown), đã điền dữ liệu lấy từ sổ điều phối tháng 9/2026.

## Thứ tự nhập & kết quả

| # | File | Màn hình nhập | Nội dung | Kết quả nhập (chế độ thường) |
|---|------|----------------|----------|------------------------------|
| 1 | `1-nhom-khach-hang.xlsx` | Hệ thống → Nhóm KH | 4 nhóm mới (Nhà hàng - KS - Karaoke, Trường học - Cơ quan, Chung cư, Cửa hàng - Tạp hoá) | Thêm 4 dòng |
| 2 | `2-nhom-hang.xlsx` | Hệ thống → Nhóm hàng | 3 nhóm **đã có sẵn** trong hệ thống | Báo lỗi trùng mã (xem lưu ý bên dưới) |
| 3 | `3-kho.xlsx` | Hệ thống → Kho | Kho Trạm Hà Lầm (thủ kho NV015) | Thêm 1 kho |
| 4 | `4-don-vi.xlsx` | Hệ thống → Đơn vị | 4 tổ mới: Tổ Thị Trường, Tổ DV-CSTT, Tổ Bảo Vệ, Tổ Kỹ Thuật (thuộc Xí nghiệp) | Thêm 4 đơn vị |
| 5 | `5-nhan-vien.xlsx` | Nhân sự → Nhân viên | 41 nhân sự từ sổ (bảo vệ, tổ DV, kỹ thuật, kinh doanh, lái xe…) kèm SĐT, địa chỉ | Thêm 41 nhân viên (mã tự sinh NV021…) |
| 6 | `6-san-pham.xlsx` | Đơn hàng → Sản phẩm | 6 mặt hàng **đã có sẵn**, giá bán theo sổ | Báo lỗi trùng mã (xem lưu ý) |
| 7 | `7-khach-hang.xlsx` | Khách hàng → Danh sách | 60 khách hàng thật trong sổ (nhà hàng, cơ quan, chung cư, cửa hàng…) | Thêm 60 khách (mã tự sinh KH009…) |
| 8 | `8-ton-kho-dau-ky.xlsx` | Kho → Tồn kho | Tồn cuối cùng đọc được của 5 kho trong sổ (Kho Huế, Tăng Áp, Văn phòng, Xe điện, Hà Lầm) | Đặt tồn cho 8 mặt hàng, sinh 6 phiếu điều chỉnh |
| 9 | `9-don-hang.xlsx` | Đơn hàng → Đơn hàng | 66 đơn / 69 dòng hàng từ sheet XUẤT (07–14/09/2026) | Thêm 66 đơn (trạng thái Nháp) |

**Nên nhập tồn kho đầu kỳ (file 8) TRƯỚC khi nhập đơn hàng (file 9).**

## Lưu ý quan trọng

- **File 2 và 6 dùng mã đang có trong hệ thống** nên nhập ở chế độ thường sẽ báo *"Mã … đã tồn tại"* — đúng như thiết kế (hệ thống chặn ghi trùng). Muốn cập nhật theo các mã này thì tích ô **"Cập nhật bản ghi đã tồn tại theo mã"** trong hộp thoại nhập.
- **Cột "Chức vụ" của file nhân viên phải là chức vụ đã có trong hệ thống** (Hệ thống → Chức vụ). Sổ ghi nhiều chức danh chưa có (Bảo vệ, Lái xe tải điện, Nhân viên ghi số, Công nhân kẹp chì…) nên đã tạm gán về **Nhân viên** / **Kỹ thuật viên**. Muốn giữ đúng chức danh: thêm chức vụ mới ở màn *Hệ thống → Chức vụ*, sửa lại cột "Chức vụ" trong file rồi nhập lại.
- **Đơn hàng nhập ở trạng thái Nháp**, kho xuất mặc định *Kho Trạm Tăng Áp* (sổ không ghi cột Kho) nên **chưa tác động tồn kho hay doanh thu**. Muốn thấy luồng kho/doanh thu thì vào Đơn hàng chuyển trạng thái (Đã xác nhận → Đang giao → Hoàn tất).
- **Số tồn đầu kỳ** lấy từ dòng cuối cùng có số thực trong các sheet `TỒN KHO HUẾ`, `TỒN KHO TĂNG ÁP`, `Tồn kho VP`, `tồn xe`, `TỒN KHO HÀ LẦM`. Các ô là công thức không đọc được thì **bỏ trống** — hệ thống giữ nguyên tồn hiện tại của mặt hàng đó (không đặt về 0).
- Khách hàng, nhân viên, nhóm khách hàng để **trống cột mã** để hệ thống tự sinh mã, tránh trùng với dữ liệu đang có.
- Nên thử trên **bản sao cơ sở dữ liệu** trước khi nhập vào dữ liệu thật.

## Nguồn dữ liệu trong sổ

| File | Sheet nguồn |
|------|-------------|
| 1, 7, 9 | `XUẤT` (đơn hàng, khách hàng, người vận chuyển, phí vận chuyển, ghi chú) |
| 4, 5 | `ĐIÈU PHỐI` (họ tên, tổ/trạm, SĐT, địa chỉ) và `CBCNV` (chức danh) |
| 6 | `Đơn giá` (bảng giá bán) |
| 8 | `TỒN KHO HUẾ`, `TỒN KHO TĂNG ÁP`, `Tồn kho VP`, `tồn xe`, `TỒN KHO HÀ LẦM` |
