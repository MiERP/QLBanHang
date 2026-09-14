# QAROMI ERP — Mô Hình Điều Hành Nước Uống & DVGT (MiERP Architecture)

> **Dự án chuyển đổi số cho Xí nghiệp Nước Hòn Gai — Công ty CP Nước sạch Quảng Ninh (QUAWACO)**  
> **Kiến trúc:** Học hỏi từ lõi MiERP / Odoo 18 (Bút toán kho kép, chứng từ luân chuyển, từ điển dữ liệu, phân hệ độc lập).

---

## 1. Khởi Chạy Bản Demo

```bash
# 1. Cài đặt thư viện (nếu chưa cài)
npm install

# 2. Khởi chạy máy chủ demo
npm run demo
```

Mở trình duyệt truy cập: **`http://127.0.0.1:4390`**

---

## 2. Các Trụ Cột Đột Phá Đã Triển Khai

1. **Chu trình mô phỏng thực tế (Live Simulation Wizard)**:
   * Chạy thử chu trình 4 bước tương tác:
     * *Bước 1*: Tổ Tiếp thị tạo báo giá và áp dụng khuyến mãi 10+1.
     * *Bước 2*: Xác nhận đơn tự sinh lệnh xuất kho kép nạp xe tải điện, tự động chia cước 5.000đ/bình cho tài xế và bảo vệ bốc xếp theo lịch trực.
     * *Bước 3*: Giao hàng tại khách, thu hồi vỏ rỗng mang về, thu tiền mặt COD.
     * *Bước 4*: Bút toán tự động cập nhật đồng thời 4 sổ sách: **Sổ Kho** (giảm tồn), **Sổ Vỏ Bình** (nợ vỏ cuối kỳ = đầu kỳ + xuất - trả), **Sổ Quỹ** (thu tiền) và **Sổ Thi Đua KPI 2026** (+doanh số người bán).
2. **Giao diện chuẩn MiERP (Odoo 18 UX)**:
   * **MiERP App Switcher**: Lưới chuyển đổi nhanh 7 phân hệ ứng dụng trên đầu Sidebar.
   * **Role Perspective Selector**: Chuyển đổi góc nhìn làm việc theo 5 vai trò nhân sự:
     * *Điều phối viên* (Nhung / Quang)
     * *Lái xe giao hàng* (Phương)
     * *Thủ kho* (Kho Tăng Áp / Huế)
     * *Thợ kỹ thuật DVGT* (SCC)
     * *Ban Giám Đốc Xí nghiệp*
   * **Document Statusbar**: Thanh trạng thái tiến trình chứng từ: `Dự thảo ➔ Đơn bán ➔ Xuất kho ➔ Hoàn tất`.
3. **Báo cáo thương mại nước ion kiềm QAROMI (`excel/Nước thương mại.xlsx`)**:
   * Biểu mẫu báo cáo tiêu thụ chính thức gửi Công ty CP Nước sạch Quảng Ninh (QUAWACO).
   * Cơ chế giá chưa thuế VAT 8% (Ví dụ: Kiềm 19L giá chưa VAT là 48.148đ, Vỉ 500ml giá chưa VAT là 90.741đ).
   * Lũy kế năm tài chính (YTD) tự động tổng hợp đạt gần 1 tỷ đồng.
   * Trang in A4 chuẩn Quốc hiệu Tiêu ngữ và 3 chữ ký: Lập biểu, BP. Kinh doanh, Lãnh đạo đơn vị.
4. **Kiểm toán dữ liệu Excel & Bản đồ kiến trúc**:
   * Khắc phục 12 ô lỗi `#REF!` tại sheet TỒN trong file Excel cũ.
   * Bút toán kho kép (Double-entry) triệt tiêu hoàn toàn lỗi âm kho trên xe tải điện.
   * Sổ nợ vỏ bình đa kỳ tách biệt bình Úp và bình Vòi, chống tranh chấp công nợ vỏ.

---

## 3. Nguồn Dữ Liệu Thực Tế (Thư mục `excel/`)

1. `ĐIỀU PHỐI NƯỚC LỌC. Nhung sửa.xlsx`: Đơn hàng, vận chuyển, xuất kho, lịch trực bảo vệ.
2. `XNT T9.hương -Nhung.xlsx`: Sổ nợ vỏ bình Tháng 9 & Tháng 8, tồn kho các điểm, tiền cọc vỏ.
3. `THEO DÕI CHỈ TIÊU DVGT CBCNV.xlsx`: Kế hoạch năm 1.59 tỷ của 202 CBCNV, ca DVGT, mã ĐH QUAWACO, phụ tùng BNL.
4. `Nước thương mại.xlsx`: Báo cáo thương mại nước ion kiềm, bảng giá chưa thuế VAT 8%, lũy kế năm tài chính (YTD).
