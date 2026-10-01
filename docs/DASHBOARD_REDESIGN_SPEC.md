# Dashboard điều hành

## Mục tiêu và cách hiểu số liệu

- Trang Tổng quan tập trung vào doanh thu, công nợ, nợ vỏ, tồn kho, KPI và doanh thu theo phạm vi chỉ tiêu.
- Ngày là ngày hiện tại của máy chủ; tháng là tháng đang chọn trong ứng dụng; lũy kế năm tính từ 01/01 đến hết tháng đang chọn.
- Doanh thu là `subtotal_amount` của đơn `SALE`/`BORROW_IN` đã `COMPLETED` hoặc `RETURNED`, cùng định nghĩa với báo cáo KPI hiện tại; không gồm phí vận chuyển. Hàng hoàn được thể hiện riêng, không âm thầm đổi nghĩa doanh thu.
- Công nợ phát sinh chưa thu trong kỳ là phần dương còn phải thu **hiện tại** của các đơn bán đã hoàn tất có `order_date` thuộc kỳ, sau khi trừ tiền đã thu và hàng hoàn, cộng khoản đã hoàn tiền. Đây là lát cắt theo ngày đơn, không phải lịch sử dư nợ tại cuối kỳ. Nợ đầu kỳ của khách không được gán vào một ngày/tháng không có nguồn phát sinh.
- Nợ vỏ hiển thị số dư hiện tại từ khách hàng đang hoạt động, tách vỏ Vòi và vỏ Úp.
- Tồn kho hiển thị số hiện tại theo từng kho vật lý đang hoạt động và từng sản phẩm hàng hóa đang hoạt động, kể cả ô tồn 0. Không cộng kho ảo vào tổng tồn vật lý.
- KPI nhân viên/đơn vị dùng API `/targets?period=` đã có; chỉ hiển thị tỷ lệ hoàn thành khi có chỉ tiêu được giao. Đơn vị dùng cách cộng nhân viên trực thuộc và đơn vị con của API đó.
- Doanh thu theo chỉ tiêu Công ty/Xí nghiệp dùng `orders.target_scope` (`COMPANY`/`ENTERPRISE`) trong tháng đang chọn; hai phạm vi cộng lại bằng doanh thu tháng.

## Giao diện và tiêu chí nghiệm thu

1. Hai hàng thẻ doanh thu và công nợ, mỗi hàng gồm ngày, tháng, lũy kế năm; nhãn ngày/tháng/năm rõ ràng.
2. Nợ vỏ có hai số Vòi/Úp. Tồn kho có tổng vật lý và bảng chi tiết theo tất cả kho, có thể mở từng kho để xem sản phẩm và tồn 0.
3. KPI nhân viên và KPI đơn vị hiển thị thực hiện, chỉ tiêu, tỷ lệ; trạng thái chưa giao chỉ tiêu không bị hiểu thành 0% hoàn thành.
4. Biểu đồ doanh thu tháng theo Công ty/Xí nghiệp và xu hướng doanh thu theo ngày.
5. Tháng không có dữ liệu và lỗi tải có trạng thái rõ ràng; bố cục dùng được trên màn hình hẹp.

## Triển khai

1. Mở rộng `/api/dashboard?month=YYYY-MM` theo hướng cộng thêm trường, giữ các trường cũ. Kiểm thử công thức theo kỳ, phạm vi và tồn kho.
2. Cập nhật kiểu dữ liệu frontend và bố cục Tổng quan, tái dùng `/targets` cho KPI.
3. Kiểm tra `npx tsx --test apps/api/tests/*.test.ts`, `npm run build` và trình duyệt thật.

## Kỹ thuật và giới hạn

- React/TypeScript, Express và SQLite; mã ở `apps/web/src/features/overview`, `apps/api/src/routes/dashboard.ts`, kiểu tại `apps/web/src/types.ts`, kiểm thử tại `apps/api/tests`.
- Giữ kiểu đặt tên camelCase cho JSON và mã TS. Ví dụ: `revenueYear: Number(row.total) || 0`.
- Không thay đổi dữ liệu giao dịch hay lược đồ CSDL. API chỉ đọc và xác thực tham số tháng.
- Không tổng hợp phần trăm KPI từ các đối tượng vừa cha vừa con để tránh tính trùng; mỗi hàng KPI được hiển thị độc lập.
