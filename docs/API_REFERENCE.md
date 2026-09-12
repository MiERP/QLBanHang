# TÀI LIỆU TRA CỨU API ENDPOINTS (REST API SPECIFICATION)
## Dự án: QAROMI ERP Backend API
**Base URL:** `http://127.0.0.1:4325/api`  
**Content-Type:** `application/json`

---

## 1. Phân Hệ Đơn Hàng & Bán Hàng (`/api/orders`)

### 1.1. Lấy danh sách đơn hàng
- **Method:** `GET`
- **Endpoint:** `/api/orders`
- **Response (200 OK):**
```json
[
  {
    "id": 1,
    "order_code": "DH-202609-01",
    "order_date": "2026-09-02",
    "customer_name": "Công ty CP Than Hóa Chất Mỏ",
    "customer_address": "Cột 5, Phường Hồng Hà, Hạ Long",
    "customer_phone": "0203.3835.123",
    "seller_name": "Nguyễn Thị Lan",
    "shipper_name": "Nguyễn Văn Phương (Lái xe điện)",
    "warehouse_name": "Kho Trạm Tăng Áp",
    "subtotal_amount": 960000,
    "shipping_fee": 50000,
    "total_amount": 1010000,
    "order_status": "DELIVERED",
    "payment_status": "PAID",
    "payment_method": "CASH",
    "is_vat_invoice": 1,
    "company_name_vat": "Công ty CP Than Hóa Chất Mỏ",
    "tax_code_vat": "5700100200",
    "items": [
      {
        "product_name": "Nước tinh khiết RO QAROMI (Vòi)",
        "unit": "Bình 19L",
        "quantity": 20,
        "quantity_promo": 2,
        "unit_price": 48000,
        "total_price": 960000
      }
    ]
  }
]
```

### 1.2. Tạo mới đơn hàng
- **Method:** `POST`
- **Endpoint:** `/api/orders`
- **Request Body:**
```json
{
  "customer_id": 1,
  "warehouse_id": 1,
  "seller_employee_id": 6,
  "shipper_employee_id": 12,
  "order_status": "DELIVERED",
  "payment_status": "PAID",
  "payment_method": "CASH",
  "shipping_fee": 50000,
  "note": "Giao cổng số 2",
  "is_vat_invoice": 1,
  "tax_code_vat": "5700100200",
  "company_name_vat": "Công ty Than Hóa Chất",
  "address_vat": "Hạ Long, Quảng Ninh",
  "returned_bottles_voi": 10,
  "returned_bottles_up": 0,
  "items": [
    {
      "product_id": 1,
      "quantity": 20,
      "quantity_promo": 2,
      "unit_price": 48000
    }
  ]
}
```
- **Tác vụ ngầm:** Tự động trừ tồn kho mặt hàng tại kho xuất, tự động cập nhật Sổ nợ vỏ bình khách hàng (cộng vỏ xuất, trừ vỏ trả).

### 1.3. Chỉnh sửa đơn hàng
- **Method:** `PUT`
- **Endpoint:** `/api/orders/:id`
- **Request Body:**
```json
{
  "order_status": "DELIVERED",
  "payment_status": "PAID",
  "payment_method": "BANK_TRANSFER",
  "shipper_employee_id": 12,
  "note": "Đã nhận đủ tiền chuyển khoản"
}
```

### 1.4. Hủy / Xóa đơn hàng
- **Method:** `DELETE`
- **Endpoint:** `/api/orders/:id`
- **Tác vụ ngầm:** Hoàn trả số lượng hàng về tồn kho ban đầu, hủy ghi nhận công nợ.

---

## 2. Phân Hệ Khách Hàng (`/api/customers`)

### 2.1. Lấy danh sách khách hàng
- **Method:** `GET`
- **Endpoint:** `/api/customers`
- **Response (200 OK):**
```json
[
  {
    "id": 1,
    "code": "KH001",
    "name": "Công ty CP Than Hóa Chất Mỏ",
    "phone": "0203.3835.123",
    "address": "Cột 5, Phường Hồng Hà, TP. Hạ Long",
    "tax_code": "5700100200",
    "bottle_debt_voi": 12,
    "bottle_debt_up": 5,
    "current_debt": 0,
    "max_debt_limit": 15000000
  }
]
```

### 2.2. Thêm mới khách hàng
- **Method:** `POST`
- **Endpoint:** `/api/customers`
- **Request Body:**
```json
{
  "name": "Khách Sạn Mường Thanh Grand Hạ Long",
  "phone": "0203.3812.345",
  "address": "Bãi Cháy, TP. Hạ Long",
  "tax_code": "5700987654",
  "contact_person": "Anh Tuấn - Quản lý",
  "max_debt_limit": 20000000,
  "bottle_debt_voi": 10,
  "bottle_debt_up": 10
}
```

### 2.3. Cập nhật hồ sơ & nợ vỏ khách hàng
- **Method:** `PUT`
- **Endpoint:** `/api/customers/:id`
- **Request Body:**
```json
{
  "name": "Công ty CP Than Hóa Chất Mỏ (Sửa)",
  "phone": "0987654321",
  "address": "Số 10 Tràng Thi, Hà Nội",
  "tax_code": "5700100200",
  "bottle_debt_voi": 15,
  "bottle_debt_up": 5,
  "current_debt": 500000,
  "max_debt_limit": 20000000
}
```

### 2.4. Xóa khách hàng
- **Method:** `DELETE`
- **Endpoint:** `/api/customers/:id`

---

## 3. Phân Hệ Sản Phẩm & Bảng Giá (`/api/products`)

### 3.1. Lấy danh mục sản phẩm
- **Method:** `GET`
- **Endpoint:** `/api/products`

### 3.2. Thêm mới sản phẩm
- **Method:** `POST`
- **Endpoint:** `/api/products`
- **Request Body:**
```json
{
  "code": "SP-NEW-01",
  "name": "Nước Kiềm QAROMI 500ml Thùng Đặc Biệt",
  "category_id": 2,
  "unit": "Thùng 24 chai",
  "bottle_type": "NONE",
  "standard_price": 120000,
  "wholesale_price": 110000,
  "deposit_fee": 0,
  "initial_stock": 50,
  "warehouse_id": 1
}
```

### 3.3. Cập nhật sản phẩm & bảng giá
- **Method:** `PUT`
- **Endpoint:** `/api/products/:id`
- **Request Body:**
```json
{
  "name": "Nước tinh khiết RO QAROMI (Vòi)",
  "unit": "Bình 19L",
  "bottle_type": "VOI",
  "standard_price": 48000,
  "wholesale_price": 45000,
  "deposit_fee": 50000
}
```

### 3.4. Xóa sản phẩm
- **Method:** `DELETE`
- **Endpoint:** `/api/products/:id`

---

## 4. Phân Hệ Kho Hàng & Tồn Kho (`/api/inventory`)

### 4.1. Lấy tồn kho thời gian thực
- **Method:** `GET`
- **Endpoint:** `/api/inventory/stock`

### 4.2. Cảnh báo tồn kho cạn cấp bách
- **Method:** `GET`
- **Endpoint:** `/api/inventory/alerts`

### 4.3. Điều chuyển hàng giữa các kho
- **Method:** `POST`
- **Endpoint:** `/api/inventory/transfer`
- **Request Body:**
```json
{
  "source_warehouse_id": 1,
  "target_warehouse_id": 2,
  "product_id": 1,
  "quantity": 30,
  "employee_id": 6,
  "note": "Bổ sung hàng ca chiều từ Tăng Áp sang Kho Huế"
}
```

### 4.4. Điều chỉnh số lượng tồn kho trực tiếp
- **Method:** `PUT`
- **Endpoint:** `/api/inventory/stock/:id`
- **Request Body:**
```json
{
  "quantity_on_hand": 120,
  "min_stock_alert": 20,
  "avg_daily_sales": 8
}
```

---

## 5. Phân Hệ Vay Mượn Liên Chi Nhánh (`/api/branch-loans`)

### 5.1. Lấy danh sách phiếu vay mượn
- **Method:** `GET`
- **Endpoint:** `/api/branch-loans`

### 5.2. Lập phiếu vay mượn mới
- **Method:** `POST`
- **Endpoint:** `/api/branch-loans`
- **Request Body:**
```json
{
  "loan_direction": "TAKE_LOAN",
  "partner_branch_id": 1,
  "warehouse_id": 1,
  "carrier_employee_id": 12,
  "product_id": 1,
  "quantity_loaned": 50,
  "loan_date": "2026-09-12",
  "due_date": "2026-09-19",
  "note": "Vay vỏ bình RO gấp phục vụ ca sản xuất"
}
```

### 5.3. Cập nhật trạng thái phiếu vay mượn
- **Method:** `PUT`
- **Endpoint:** `/api/branch-loans/:id`
- **Request Body:**
```json
{
  "status": "SETTLED",
  "due_date": "2026-09-20",
  "note": "Đã hoàn trả đủ 50 bình nguyên vẹn"
}
```

### 5.4. Xóa phiếu vay mượn
- **Method:** `DELETE`
- **Endpoint:** `/api/branch-loans/:id`

---

## 6. Phân Hệ Nhân Sự & Phân Quyền (`/api/staff`)

### 6.1. Lấy danh sách nhân viên
- **Method:** `GET`
- **Endpoint:** `/api/staff`

### 6.2. Thêm nhân viên mới
- **Method:** `POST`
- **Endpoint:** `/api/staff`
- **Request Body:**
```json
{
  "code": "NV020",
  "full_name": "Trần Văn Toàn",
  "position": "Nhân viên vận chuyển",
  "phone": "0912.333.444",
  "station_id": 2,
  "role_id": 4
}
```

### 6.3. Sửa thông tin & vai trò nhân viên
- **Method:** `PUT`
- **Endpoint:** `/api/staff/:id`
- **Request Body:**
```json
{
  "full_name": "Nguyễn Văn Phương",
  "position": "Lái xe tải điện chuyên trách",
  "phone": "0988.777.666",
  "station_id": 1,
  "role_id": 4
}
```

### 6.4. Cho thôi việc / Xóa nhân viên
- **Method:** `DELETE`
- **Endpoint:** `/api/staff/:id`

---

## 7. Phân Hệ KPI & Chỉ Tiêu Thi Đua (`/api/kpi`)

### 7.1. Lấy tổng quan KPI tháng hiện tại
- **Method:** `GET`
- **Endpoint:** `/api/kpi/overview`
- **Response (200 OK):**
```json
{
  "current_month": "2026-09",
  "total_target_water": 3500,
  "total_actual_water": 2850,
  "water_completion_rate": 81.4,
  "total_target_dvgt": 120,
  "total_actual_dvgt": 95,
  "dvgt_completion_rate": 79.2
}
```

### 7.2. Lấy chi tiết KPI từng nhân viên & trạm
- **Method:** `GET`
- **Endpoint:** `/api/kpi/records`
