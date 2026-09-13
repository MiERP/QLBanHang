# TÀI LIỆU TRA CỨU API ENDPOINTS (REST API SPECIFICATION)
## Dự án: QAROMI ERP Backend API
**Base URL:** `http://127.0.0.1:4325/api`
**Content-Type:** `application/json`

> Mọi phản hồi lỗi có dạng `{ "error": "mô tả" }` với mã HTTP tương ứng: `400` thiếu/sai dữ liệu,
> `404` không tìm thấy, `409` trùng khóa/đang được tham chiếu, `500` lỗi hệ thống.

---

## 0. Health check
- **GET** `/api/health` → `{ "status": "ok", "service": "QAROMI ERP API", "time": "..." }`

---

## 1. Danh Mục Hệ Thống (Master Data)

### 1.1. Quy ước chung
Mỗi danh mục dưới đây có **CRUD đầy đủ**:
- **GET** `/api/{resource}` — danh sách
- **POST** `/api/{resource}` — tạo mới → `{ "success": true, "id": 1 }`
- **PUT** `/api/{resource}/:id` — cập nhật (chỉ các trường được gửi lên)
- **DELETE** `/api/{resource}/:id` — xóa (kho dùng xóa mềm `is_active = 0`)

### 1.2. Danh sách resource
| Resource | Bảng | Trường chính |
| :--- | :--- | :--- |
| `/api/stations` | `stations` | `code`, `name`, `address`, `phone` |
| `/api/roles` | `roles` | `code`, `name`, `description` |
| `/api/categories` | `categories` | `code`, `name`, `type` (`BOTTLE_WATER`\|`PACK_WATER`\|`SERVICE_DVGT`) |
| `/api/warehouses` | `warehouses` | `code`, `name`, `type`, `manager_employee_id`, `location`, `is_active` |
| `/api/partner-branches` | `partner_branches` | `code`, `name`, `phone`, `address`, `is_internal` |
| `/api/customer-groups` | `customer_groups` | `code`, `name`, `discount_percent` |
| `/api/product-conversions` | `product_conversions` | `from_product_id`, `to_product_id`, `ratio`, `note` |

**Ví dụ tạo trạm:**
```http
POST /api/stations
{ "code": "TR_MOI", "name": "Trạm Mới", "address": "Hạ Long", "phone": "0203..." }
→ 200 { "success": true, "id": 8 }
```

---

## 2. Sản Phẩm (`/api/products`)

### 2.1. GET `/api/products`
Trả về danh sách sản phẩm đang bán (join nhóm hàng).

### 2.2. POST `/api/products`
```json
{
  "code": "SP-NEW-01",
  "name": "Nước Kiềm QAROMI",
  "category_id": 2,
  "unit": "Thùng 24 chai",
  "bottle_type": "NONE",
  "standard_price": 120000,
  "wholesale_price": 110000,
  "deposit_fee": 0,
  "has_shell_cycle": 0,
  "initial_stock": 50,
  "warehouse_id": 1
}
```
Tồn khởi tạo (`initial_stock`) được ghi vào kho và **có ghi nhật ký `IMPORT`**.

### 2.3. PUT `/api/products/:id`
Cập nhật một phần: `category_id`, `code`, `name`, `unit`, `bottle_type`, `standard_price`, `wholesale_price`, `cost_price`, `deposit_fee`, `has_shell_cycle`, `is_active`.

### 2.4. DELETE `/api/products/:id`
Ngừng bán (xóa mềm `is_active = 0`).

---

## 3. Khách Hàng & Sổ Nợ Vỏ (`/api/customers`)

### 3.1. GET `/api/customers?search=`
Tìm theo tên, điện thoại, MST, mã. Trả về `bottle_debt_voi`, `bottle_debt_up`, `current_debt`, `max_debt_limit`, `group_name`.

### 3.2. POST `/api/customers`
```json
{
  "name": "Khách Sạn Mường Thanh",
  "address": "Bãi Cháy, Hạ Long",
  "group_id": 1,
  "phone": "0203...",
  "tax_code": "5700987654",
  "contact_person": "Anh Tuấn",
  "max_debt_limit": 20000000,
  "bottle_debt_voi": 10,
  "bottle_debt_up": 10
}
→ 200 { "success": true, "id": 9, "code": "KH009" }
```

### 3.3. PUT `/api/customers/:id`
Cập nhật hồ sơ và số dư nợ (`group_id`, `name`, `phone`, `address`, `tax_code`, `contact_person`, `max_debt_limit`, `current_debt`, `bottle_debt_voi`, `bottle_debt_up`, `is_active`).

### 3.4. DELETE `/api/customers/:id`
Xóa mềm (`is_active = 0`).

### 3.5. GET `/api/customers/bottle-ledgers?customer_id=`
Lịch sử mượn/trả vỏ bình (join khách hàng, người xử lý, mã đơn).

### 3.6. POST `/api/customers/:id/bottle-return`
Ghi nhận thu hồi vỏ **không kèm đơn hàng mới**; tự giảm nợ vỏ và ghi ledger.
```json
{ "returned_voi": 5, "returned_up": 3, "handled_by": 12, "note": "Thu hồi định kỳ" }
→ { "success": true, "remaining_voi": 5, "remaining_up": 7 }
```

---

## 4. Nhân Sự (`/api/staff`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/staff` | Danh sách CBCNV (join trạm, vai trò) |
| POST | `/api/staff` | Thêm nhân viên (`full_name`, `position`, `phone`, `station_id`, `role_id`, `commission_rate`, `shipping_allowance`) |
| PUT | `/api/staff/:id` | Cập nhật hồ sơ/vai trò/trạm |
| DELETE | `/api/staff/:id` | Cho thôi việc (xóa mềm) |
| GET | `/api/staff/shipping-settlements?month=YYYY-MM` | Tổng hợp chuyến, phí ship, tiền mặt thu theo shipper |
| GET | `/api/staff/bottle-ledgers?employee_id=` | Sổ vỏ bình tạm ứng trên xe của shipper |

---

## 5. Đơn Hàng (`/api/orders`)

### 5.1. GET `/api/orders?from=&to=&status=&limit=`
Trả về đơn hàng kèm `items`, tên khách hàng, seller, shipper, kho.

### 5.2. POST `/api/orders`
Tạo đơn trong **một giao dịch** với đầy đủ hiệu ứng:
1. **Kiểm tra đủ tồn** tại kho xuất → thiếu hàng trả `400`.
2. Trừ kho và ghi `stock_movements` (`EXPORT_ORDER`, gồm cả số lượng KM).
3. Cập nhật nợ vỏ khách hàng + ghi `customer_bottle_ledgers`.
4. Ghi `revenue_transactions` nếu thu tiền.
5. Tạo `delivery_dispatches` nếu có shipper.
6. Tính lại tiền phía server (không tin số tiền client gửi).

```json
{
  "customer_id": 1,
  "warehouse_id": 1,
  "seller_employee_id": 6,
  "shipper_employee_id": 12,
  "order_date": "2026-09-12",
  "payment_status": "PAID",
  "payment_method": "CASH",
  "shipping_fee": 50000,
  "discount_amount": 0,
  "returned_shells_voi": 10,
  "returned_shells_up": 0,
  "is_vat_invoice": 1,
  "note": "Giao cổng số 2",
  "items": [
    { "product_id": 1, "quantity": 20, "quantity_promo": 2, "unit_price": 48000 }
  ]
}
→ 200 { "success": true, "orderId": 5, "orderCode": "DH-20260912-01", "total": 1010000 }
```

### 5.3. PUT `/api/orders/:id`
Cập nhật một phần: `order_status`, `payment_status`, `payment_method`, `shipper_employee_id`, `warehouse_id`, `delivery_date`, các trường VAT, `shipping_fee`, `discount_amount`, `paid_amount`, `note`.
> Không gửi trường nào sẽ được giữ nguyên (không còn lỗi null hóa shipper).

### 5.4. DELETE `/api/orders/:id`
**Hủy đơn và hoàn tác đầy đủ:** hoàn kho (+ nhật ký `IMPORT`), đảo nợ vỏ và xóa ledger của đơn, xóa phiếu thu, xóa phiếu điều phối + quyết toán liên quan; đặt `order_status = 'CANCELLED'`.

---

## 6. Kho Hàng & Tồn Kho (`/api/inventory`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/inventory/stock?warehouse_id=` | Tồn kho + `urgency_level`, `days_left` |
| GET | `/api/inventory/alerts` | Mặt hàng dưới ngưỡng cảnh báo |
| GET | `/api/inventory/movements?product_id=&warehouse_id=&movement_type=&limit=` | Nhật ký kho (có tên kho, người thực hiện) |
| POST | `/api/inventory/transfer` | Điều chuyển kho (kiểm tra tồn nguồn, ghi cả `TRANSFER_OUT` + `TRANSFER_IN`) |
| PUT | `/api/inventory/stock/:id` | Điều chỉnh tồn (`quantity`, `min_stock_alert`, `avg_daily_sales`) + ghi `ADJUSTMENT` |

**Ví dụ điều chuyển:**
```json
POST /api/inventory/transfer
{ "source_warehouse_id": 1, "target_warehouse_id": 3, "product_id": 1, "quantity": 30, "employee_id": 19, "note": "Bổ sung ca chiều" }
```

---

## 7. Vay Mượn Liên Chi Nhánh (`/api/branch-loans`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/branch-loans` | Danh sách phiếu kèm `items` |
| POST | `/api/branch-loans` | Lập phiếu; `GIVE_LOAN` trừ kho (`LOAN_OUT`), `TAKE_LOAN` cộng kho (`LOAN_IN`) |
| PUT | `/api/branch-loans/:id` | Cập nhật `status`, `due_date`, `note`, `carrier_employee_id` |
| POST | `/api/branch-loans/:id/settle` | Quyết toán hoàn trả, cập nhật tồn kho + `branch_loan_settlements`, tự chuyển `SETTLED`/`PARTIAL_RETURN` |
| DELETE | `/api/branch-loans/:id` | Xóa phiếu và hoàn tác ảnh hưởng tồn kho |

**Ví dụ lập phiếu:**
```json
POST /api/branch-loans
{
  "loan_direction": "TAKE_LOAN",
  "partner_branch_id": 2,
  "warehouse_id": 1,
  "carrier_employee_id": 12,
  "loan_date": "2026-09-12",
  "due_date": "2026-09-19",
  "items": [{ "product_id": 1, "quantity_loaned": 50 }]
}
```

**Ví dụ quyết toán:**
```json
POST /api/branch-loans/1/settle
{ "return_type": "PRODUCT_RETURN", "items": [{ "product_id": 1, "quantity_returned": 50 }] }
```

---

## 8. Giao Hàng & Quyết Toán (`/api/delivery`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/delivery/dispatches?status=&shipper_employee_id=&month=` | Danh sách phiếu điều phối |
| POST | `/api/delivery/dispatches` | Tạo phiếu điều phối cho đơn (`order_id`, `shipper_employee_id`, ...) |
| PUT | `/api/delivery/dispatches/:id` | Đổi trạng thái (`ASSIGNED`→`IN_TRANSIT`→`DELIVERED`/`FAILED`), set `completed_at` khi giao xong |
| GET | `/api/delivery/settlements?month=&shipper_employee_id=` | Danh sách quyết toán ca |
| POST | `/api/delivery/settlements` | Lập quyết toán ca: tiền thu, tiền nộp quỹ, vỏ thu hồi Vòi/Úp, vỏ mất, phí ship trả |

**Ví dụ quyết toán ca:**
```json
POST /api/delivery/settlements
{
  "dispatch_id": 1,
  "cash_collected": 1010000,
  "cash_turned_in": 1010000,
  "shells_returned_voi": 20,
  "shells_returned_up": 0,
  "shells_lost": 0,
  "shipping_fee_paid": 50000,
  "settled_by": 18,
  "note": "Khớp quỹ"
}
```

---

## 9. Dịch Vụ Gia Tăng (`/api/dvgt`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/dvgt?status=&month=` | Danh sách yêu cầu (join dịch vụ, người bán, kỹ thuật viên, trạm) |
| POST | `/api/dvgt` | Đăng ký yêu cầu |
| PUT | `/api/dvgt/:id` | Cập nhật / phân công / hoàn thành |
| DELETE | `/api/dvgt/:id` | Xóa yêu cầu (kèm phiếu thu DVGT liên quan) |

> Khi `status = 'COMPLETED'` **và** `payment_status = 'PAID'` **và** `revenue_amount > 0`, hệ thống
> tự tạo phiếu thu `DVGT_SERVICE` trong Sổ quỹ (chỉ tạo một lần cho mỗi yêu cầu).

---

## 10. Sổ Quỹ Thu - Chi (`/api/finance`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/finance/revenue?from=&to=&type=` | Danh sách phiếu thu |
| POST | `/api/finance/revenue` | Lập phiếu thu (`transaction_type`, `amount`, `payment_method`, `customer_id`, `collected_by`, `transaction_date`, `note`) |
| PUT / DELETE | `/api/finance/revenue/:id` | Sửa / xóa phiếu thu |
| GET | `/api/finance/expenses?from=&to=&category=` | Danh sách phiếu chi |
| POST | `/api/finance/expenses` | Lập phiếu chi (`category`, `amount`, `paid_to`, `paid_by`, `station_id`, `payment_method`, `expense_date`, `note`) |
| PUT / DELETE | `/api/finance/expenses/:id` | Sửa / xóa phiếu chi |
| GET | `/api/finance/summary?month=YYYY-MM` | Tổng thu, tổng chi, chênh lệch, cơ cấu theo loại thu/loại chi |

**Loại thu:** `WATER_SALE`, `BOTTLE_DEPOSIT`, `DEBT_COLLECTION`, `DVGT_SERVICE`, `BRANCH_OFFSET`, `OTHER`.
**Loại chi:** `ELECTRICITY`, `GASOLINE`, `CAPS_LABELS`, `MAINTENANCE`, `SALARY_COMMISSION`, `VEHICLE_REPAIR`, `RENTAL`, `OTHER`.

---

## 11. Chỉ Tiêu KPI (`/api/kpi`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/kpi/records?month=YYYY-MM` | Bảng KPI từng nhân viên (chỉ tiêu & thực tế) |
| GET | `/api/kpi/overview?month=YYYY-MM` | Tổng hợp: số nhân viên, % hoàn thành TB, quỹ thưởng, tổng chỉ tiêu/thực tế nước - DVGT - bình |
| POST | `/api/kpi/records` | Giao chỉ tiêu (`employee_id`, `evaluation_month`, `target_water_revenue`, `target_dvgt_revenue`, `target_bottle_delivery`, `target_new_customers`) |
| PUT | `/api/kpi/records/:id` | Sửa chỉ tiêu / duyệt (`is_approved`, `approved_by`) |
| DELETE | `/api/kpi/records/:id` | Xóa chỉ tiêu |
| POST | `/api/kpi/recompute` | **Tính lại thực tế từ dữ liệu thật** (`{ "month": "2026-09" }`) → completion %, xếp loại, thưởng |

**Quy tắc xếp loại:** ≥120% `A_PLUS`, ≥100% `A`, ≥85% `B`, ≥70% `C`, còn lại `D`.
Thưởng = `commission_rate × actual_water_revenue`.

---

## 12. Bảng Điều Khiển (`/api/dashboard`)

### GET `/api/dashboard?month=YYYY-MM`
Trả về toàn bộ dữ liệu tổng hợp cho Dashboard trong một lần gọi:

```json
{
  "month": "2026-09",
  "kpis": {
    "revenueToday": 0, "revenueYesterday": 0, "revenueMonth": 8712000, "ordersMonth": 4,
    "bottlesMonth": 166, "bottlesVoi": 150, "bottlesUp": 6,
    "bottleDebtVoi": 204, "bottleDebtUp": 48, "totalDebt": 21340000,
    "pendingLoans": 2, "overdueLoans": 0, "alertCount": 1
  },
  "revenueByDay": [{ "date": "2026-09-07", "revenue": 8712000, "orders": 4 }],
  "revenueByWarehouse": [{ "name": "Kho Trạm Tăng Áp", "revenue": 8712000, "bottles": 166 }],
  "productMix": [{ "name": "Nước Tinh Khiết RO QAROMI 19L (Bình Vòi)", "quantity": 150, "revenue": 7284000 }],
  "paymentStatus": [{ "name": "PAID", "value": 3 }],
  "salesBySeller": [{ "name": "Lương Minh Hương", "revenue": 1030000 }],
  "shipperPerformance": [{ "name": "Nguyễn Thị Hồng Phương", "trips": 3, "bottles": 60, "shipping_fee": 70000 }],
  "bottleDebtByCustomer": [{ "name": "Công Ty CN Hóa Chất Mỏ Quảng Ninh", "voi": 125, "up": 0 }],
  "stockLevels": [{ "name": "Nước Tinh Khiết RO QAROMI 19L (Bình Úp)", "quantity": 95, "min_stock_alert": 25 }],
  "branchLoanAging": [{ "code": "VM2026-001", "partner": "Văn Phòng Tổng Công Ty", "direction": "TAKE_LOAN", "due_date": "2026-09-15", "status": "PENDING", "outstanding": 22 }],
  "movementsSummary": [{ "name": "TRANSFER_OUT", "quantity": 5 }],
  "kpiByEmployee": [{ "name": "Nguyễn Thị Hồng Phương", "completion": 74.6 }],
  "cashFlow": [{ "date": "2026-09-10", "revenue": 200000, "expense": 500000 }]
}
```
