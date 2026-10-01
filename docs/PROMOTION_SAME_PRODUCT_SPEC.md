# Khuyến mãi mua X tặng Y cùng sản phẩm

## Mục tiêu

Đơn bán và phiếu giao nhận thủ công chỉ tặng đúng mã sản phẩm được mua/giao nhận khi số lượng của mã đó đạt ngưỡng của chương trình đang có hiệu lực. Ví dụ 10 tặng 1 thì 9 tặng 0, 10 tặng 1, 20 tặng 2. Hàng tặng không tạo doanh thu nhưng được tính vào số lượng nhập/xuất kho.

## Quy tắc

- Cộng số lượng mua của cùng mã sản phẩm trong một đơn trước khi tính khuyến mãi. Không cộng số lượng của các mã khác nhau.
- Xét chương trình đang bật và có hiệu lực vào ngày đặt hàng. Ưu tiên chương trình chỉ định sản phẩm, sau đó nhóm sản phẩm, sau đó toàn bộ; trong cùng mức ưu tiên lấy chương trình mới nhất. Không cộng dồn nhiều chương trình.
- Chỉ nhận chương trình tặng cùng sản phẩm. Không cho tạo hoặc sửa chương trình chỉ định sản phẩm tặng khác; chương trình cũ có `free_product_id` không được tự áp dụng.
- API tự tính số hàng tặng khi tạo, sửa hoặc gộp đơn `SALE`/`BORROW_IN`. Nếu đầu vào khai báo hàng tặng lớn hơn mức được hưởng, từ chối đơn. Các loại đơn cho mượn và bốc xếp giữ nghiệp vụ hiện có.
- Khi gộp đơn, tính lại số tặng từ tổng số lượng mua của đơn mới; không cộng số tặng của các đơn nguồn.
- Phiếu giao nhận thủ công dùng cùng chương trình, xét theo `ticket_date`: phiếu nhập `PARENT_RECEIVE` / `TRANSFER_IN` / `OTHER_IN`, phiếu xuất `OTHER_OUT`, và phiếu điều chuyển `TRANSFER`. Cộng số lượng cùng mã trên toàn phiếu rồi tính thưởng; số thưởng ghi ở dòng đầu tiên của mã đó.
- Phiếu điều chỉnh, kiểm kê, hủy, hoàn trả và phiếu tự sinh từ đơn hàng không tính thưởng thêm. Phiếu tự sinh từ đơn giữ số thưởng đã tính ở đơn.
- Phiếu nhập 100 + 10 ghi tăng tồn 110. Điều chuyển 50 + 5 ghi giảm kho xuất 55 và ghi tăng kho nhận 55. Phiếu xuất 10 + 1 ghi giảm tồn 11. Phiếu nháp chỉ ghi tồn khi xác nhận.

## Kiểm chứng

- `npx tsx --test apps/api/tests/*.test.ts`
- `npm run build`
- Trên form đơn bán, cột khuyến mãi chỉ đọc và thay đổi theo số lượng mua, ngày đơn và chương trình đang bật.
- Trên form phiếu giao nhận, số khuyến mãi và tổng số lượng cập nhật theo mã hàng, số lượng, ngày và lý do phiếu; trước khi xuất/điều chuyển, kiểm tra tồn gồm cả hàng tặng.
