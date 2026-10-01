# Quy trình đơn hàng và mượn trả

## Quy tắc nghiệp vụ đã chốt

1. `target_scope` chỉ đánh dấu nguồn chỉ tiêu công ty hoặc xí nghiệp. Doanh thu bán hàng hợp nhất gồm `SALE` và `BORROW_IN`; báo cáo có thể tách theo nguồn chỉ tiêu.
2. `SALE` xuất hàng từ kho xí nghiệp, ghi doanh thu hàng bán và phí giao. `BORROW_IN` lấy hàng đối tác bán cho khách của xí nghiệp, ghi doanh thu và nợ đối tác bằng hàng. `LEND_OUT` xuất hàng xí nghiệp cho đối tác, chỉ ghi nợ đối tác bằng hàng, không ghi doanh thu hàng bán. `HIRED_LOAD` chỉ cung cấp dịch vụ bốc xếp/giao, không biến hàng đối tác thành tồn kho hoặc doanh thu hàng bán. Mọi loại đơn vẫn chọn khách trong danh mục.
3. Phí giao là `phí tuyến × số sản phẩm bán`, không tính hàng khuyến mãi. Hàng khuyến mãi vẫn giao và trừ kho. Có nhân viên xí nghiệp giao thì thu phí của khách (`SALE`, `BORROW_IN`) hoặc đối tác (`LEND_OUT`, `HIRED_LOAD`) và phân bổ tiền công cho nhân viên. `BORROW_IN` do đối tác giao không ghi phí hay công giao của xí nghiệp.
4. Trạng thái đi qua `DRAFT → CONFIRMED → SHIPPING → COMPLETED`; `DRAFT` và `CONFIRMED` được hủy hoặc gộp. `DRAFT` có thể ghi nhu cầu lớn hơn tồn hiện tại. `CONFIRMED` kiểm tồn và tạo phiếu kho chờ, không giữ chỗ và không trừ tồn. Khi vào `SHIPPING`, kiểm lại tồn rồi ghi sổ phiếu xuất. `SHIPPING` chưa giao thành công được hủy và hoàn kho. `COMPLETED` không sửa hoặc hủy.
5. Gộp đơn đã xác nhận: hủy phiếu chờ của đơn nguồn, tạo đơn gộp `CONFIRMED` cùng phiếu chờ mới. Gộp đơn nháp giữ `DRAFT`. Gộp hỗn hợp có ít nhất một đơn xác nhận cho ra đơn `CONFIRMED`.
6. Khách hoàn hàng chỉ từ đơn `COMPLETED`, toàn bộ số lượng hàng bán và khuyến mãi, đúng một lần. Đơn gốc thành `RETURNED`, có phiếu nhập hàng hoàn riêng; phí giao ban đầu vẫn phải thu và tiền hàng đã thu được hoàn. Hàng mượn khách hoàn nhập kho vật lý xí nghiệp trước, sau đó trả đối tác bằng nghiệp vụ riêng.
7. Mượn/trả đối tác có thể trả từng phần bằng hàng, kể cả hàng khuyến mãi. Tiền phí giao và công nợ phí giao tách với nợ hàng đối tác. Mọi khoản `paid_amount > 0` có phiếu thu tương ứng; hủy đơn đã thu tạo phiếu hoàn tiền.
8. Loại đơn và nguồn chỉ tiêu không hợp lệ phải bị từ chối. `SALE` và `LEND_OUT` chỉ dùng kho vật lý đang hoạt động. Đơn giá không âm; giảm giá của `SALE`/`BORROW_IN` nằm trong khoảng từ 0 đến tiền hàng, còn `LEND_OUT`/`HIRED_LOAD` không giảm giá hàng.

## Kiểm chứng bắt buộc

- Kiểm thử API trên SQLite tạm cho từng loại đơn, các chuyển trạng thái, phiếu chờ, tồn kho, gộp, hoàn toàn bộ một lần, nợ hàng, phí giao và khoản phải thu.
- Kiểm tra báo cáo hợp nhất và chia theo nguồn chỉ tiêu; chạy build API và giao diện.
- Bộ kiểm thử độc lập khởi tạo SQLite chỉ có schema, tự thêm toàn bộ danh mục và tồn kho, rồi xác minh các bất biến về kho, tiền thu/hoàn, nợ hàng và báo cáo.
