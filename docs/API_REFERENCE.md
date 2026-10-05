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

**Ví dụ tạo trạm:**
```http
POST /api/stations
{ "code": "TR_MOI", "name": "Trạm Mới", "address": "Hạ Long", "phone": "0203..." }
→ 200 { "success": true, "id": 8 }
```

### 1.3. Cấu hình chung — `/api/settings`
Bật/tắt các quy tắc nghiệp vụ dùng chung. Danh mục khoá, giá trị mặc định và giải thích nằm ở `apps/api/src/lib/appSettings.ts`; bảng `app_settings` chỉ giữ giá trị đang dùng.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/settings` | Toàn bộ cấu hình dạng `{ "free_ship_without_shipper": "0" }` |
| PUT | `/api/settings` | Ghi đè các khoá gửi lên (`0` = tắt, `1` = bật) → `{ "success": true, "settings": {...} }` |

| Khoá | Mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `free_ship_without_shipper` | `0` | `1`: đơn để trống người giao là **đơn miễn ship** — không vào báo cáo phí vận chuyển và bảng lương giao hàng, không cảnh báo thiếu người giao. `0`: bắt buộc chọn người giao khi lưu đơn (tạo mới, sửa đơn, gán người giao, xác nhận đơn, nhập Excel). |

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
Ghi nhận thu hồi vỏ **không kèm đơn hàng mới**: tự giảm nợ vỏ, ghi sổ vỏ và **hoàn tiền cọc** cho số vỏ trả (theo phí cọc của loại vỏ).

```json
POST /api/customers/5/bottle-return
{
  "returned_voi": 3,
  "returned_up": 0,
  "refund_deposit": true,
  "payment_method": "CASH",
  "handled_by": 12,
  "note": "Khách mang vỏ đến trả"
}
```
Đáp: `{ success, remaining_voi, remaining_up, deposit_refund }`. `refund_deposit: false` khi tiền cọc đã được xử lý ở chỗ khác.

### 3.7. Công nợ khách hàng — `GET /api/customers/receivables` (+ `.xlsx`)
**Nợ tiền của khách = nợ đầu kỳ (`customers.current_debt`) + phần chưa thu của các đơn đã hoàn thành**
(`order_status IN ('COMPLETED','RETURNED')`, `order_type IN ('SALE','BORROW_IN')`, `total_amount − paid_amount > 0`).
Danh sách khách (`GET /api/customers`) và Bảng điều khiển (`totalDebt`) cũng trả sẵn `order_debt` / `total_debt` theo công thức này.

- Trả `byCustomer` (khách còn nợ: `opening_debt`, `order_debt`, `total_debt`, `max_debt_limit`, `orders[]` chi tiết từng đơn còn thiếu)
  và `totals` (số khách/đơn, tổng nợ, số khách **vượt hạn mức** + phần vượt).
- Bản `.xlsx` gồm 2 sheet: *Tổng hợp theo khách hàng* và *Chi tiết đơn còn nợ*.

---

## 3b. Vỏ Bình & Cọc Vỏ

Vỏ bình đi theo **hai sổ song song**: số vỏ khách đang giữ (`customers.bottle_debt_voi/up` + sổ `customer_bottle_ledgers`) và tiền cọc (`deposit_transactions`).
Mọi đường thu hồi vỏ đều đi qua **một cơ chế duy nhất** (`lib/shells.ts`): giảm nợ vỏ → ghi sổ vỏ → hoàn cọc theo đúng **loại vỏ thu hồi**, kể cả vỏ trả khác loại với hàng giao.

| Nơi phát sinh | Xử lý |
| :--- | :--- |
| Giao hàng (đơn bán / mượn vào) | Cộng nợ vỏ theo số bình giao (gồm hàng KM), thu cọc theo số vỏ giao thực tế, ghi sổ vỏ |
| Khách trả vỏ ngay trong đơn giao | Trừ nợ vỏ; vỏ trả **dư** so với số giao được **hoàn cọc** tự động cho phần vỏ khách thực sự đang giữ |
| Thu hồi vỏ rời (`/api/customers/:id/bottle-return`) | Trừ nợ vỏ + ghi sổ vỏ + hoàn cọc + nhập vỏ về kho vỏ |
| Hàng hoàn (`/api/orders/:id/return`) | Thu hồi vỏ kèm hàng hoàn + hoàn cọc (xem 5.5) |
| Tất toán vỏ (`/api/customers/:id/settle-shells`) | Thu hồi **toàn bộ** vỏ khách đang giữ + hoàn cọc trong một lần |
| Vỏ mất / mua đứt (`/api/customers/:id/shell-writeoff`) | Trừ nợ vỏ, **giữ lại tiền cọc** (không hoàn); ghi rõ lý do trong sổ vỏ |
| Vỏ theo đơn cho mượn | Xuất vỏ khỏi kho mình + ghi số vỏ **đối tác đang giữ**; đối tác trả hàng thì nhập lại kho vỏ và trừ số đang giữ |
| Hoàn cọc thủ công | `/api/deposits` (phiếu thu/chi tiền cọc) |

> Khách chỉ được trả số vỏ mình **đang giữ** (nợ vỏ hiện tại + số giao trong đơn): vượt quá sẽ bị chặn ngay khi xác nhận đơn.

**Sổ vỏ** — vỏ gắn với **sản phẩm** (`products.bottle_type`), KHÔNG gắn với kho: chỉ có hai nơi là khách đang giữ hoặc xí nghiệp đang giữ.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/shell-stock` | Vỏ **xí nghiệp** đang giữ (một pool theo loại vỏ) + vỏ **khách** đang giữ + vỏ **đối tác** đang giữ + tổng ba nơi |
| GET | `/api/shell-movements?from=&to=&movement_type=` | Sổ vỏ: `IN` nhập vỏ về xí nghiệp, `OUT` xuất theo đơn, `RETURN` thu hồi vỏ, `WRITE_OFF` xuất hủy, `ADJUST_IN`/`ADJUST_OUT` điều chỉnh |
| POST | `/api/shell-movements` | Nhập tay một lần vỏ vào/ra: `movement_type` (chỉ `IN`, `WRITE_OFF`, `ADJUST_IN`, `ADJUST_OUT`), `bottle_type` (`VOI`/`UP`), `quantity`, `movement_date`, `performed_by`, `note` |

> `OUT` và `RETURN` do đơn hàng / thu hồi vỏ tự sinh, không nhập tay. Số vỏ xí nghiệp đang giữ có thể âm nếu chưa khai tồn đầu — màn Vỏ bình hiển thị đỏ và nhắc khai bằng “Điều chỉnh tăng”.

**Phí cọc theo loại vỏ** — `GET/POST/PUT/DELETE /api/shell-deposits` (danh mục hệ thống → Cọc vỏ bình):

| Trường | Ý nghĩa |
| :--- | :--- |
| `bottle_type` | `VOI` (vỏ Vòi) hoặc `UP` (vỏ Úp) |
| `deposit_fee` | Tiền cọc mỗi bình |
| `note` | Ghi chú |

> Một vỏ bình chỉ có **một mức cọc**, không phụ thuộc sản phẩm nước trong bình. Chưa khai báo thì hệ thống tạm lấy theo sản phẩm bình đang bán.

**Báo cáo đối chiếu vỏ - cọc** — `GET /api/reports/shell-deposits?month=YYYY-MM`:

- `feeVoi`, `feeUp`: phí cọc đang áp.
- `rows`: mỗi khách gồm `debt_voi`, `debt_up`, `shell_value` (giá trị vỏ khách đang giữ), `collected`, `refunded`, `balance` (cọc đang giữ = thu − hoàn), `diff` (balance − shell_value), `collected_month`, `refunded_month`.
- `totals`: tổng các cột + `mismatch_count` (số khách lệch nợ vỏ / cọc).
- `GET /api/reports/shell-deposits.xlsx?month=` — xuất Excel cùng số liệu.

**Báo cáo đối chiếu vỏ bình** — `GET /api/reports/shell-audit?from=YYYY-MM-DD&to=YYYY-MM-DD`:

Vỏ bình gắn với **sản phẩm** (`products.bottle_type`: Vòi / Úp), **không gắn với kho**: bán bình nước là cho khách mượn luôn vỏ, khách đặt cọc và trả lại vỏ khi không dùng nữa. Vỏ vì vậy chỉ có hai nơi — khách đang giữ, hoặc xí nghiệp đang giữ — nên báo cáo đối chiếu theo **loại vỏ**, không theo kho.

- `stock_rows`: mỗi loại vỏ gồm `opening`, `period_in`, `period_out`, `closing` (tồn cuối theo sổ bút toán vỏ), `stock_now` (vỏ xí nghiệp đang giữ), `stock_at_to` (suy về ngày `to`), `diff` = `closing` − `stock_at_to`. Lệch khác 0 nghĩa là tồn vỏ bị sửa ngoài sổ.
- `customer_rows`: mỗi khách gồm `debt_voi`/`debt_up` (nợ vỏ trên bảng khách) và `ledger_voi`/`ledger_up` (sổ vỏ khách) + `diff_voi`/`diff_up`. Lệch khác 0 nghĩa là nợ vỏ bị sửa trực tiếp mà không qua sổ.
- `order_rows`: đơn đã ghi nợ vỏ cho khách nhưng sổ vỏ không ghi lần xuất tương ứng (`debt_*` so với `out_*`).
- `partners`: vỏ của mình đang ở đối tác liên kết (`voi`, `up`).
- `totals`: tổng các cột + `negative_types` (số loại vỏ xí nghiệp đang giữ bị âm), `customer_mismatch`, `order_mismatch`.

> Vỏ xí nghiệp đang giữ bị âm là dấu hiệu chưa khai tồn vỏ đầu kỳ: sổ chỉ có bút toán xuất vỏ cho khách mà chưa có bút toán nhập/khai đầu kỳ.

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
Trả về đơn hàng kèm `items`, tên khách hàng, seller, shipper, kho và `outstanding_amount` (số còn phải thu, không âm).

### 5.2. POST `/api/orders`
Tạo đơn ở trạng thái **DRAFT**. Kho, doanh thu và nợ vỏ chỉ phát sinh theo các bước chuyển trạng thái giao hàng. API luôn tính lại tiền phía server.

Phí vận chuyển được tính bằng `phí tuyến × số lượng sản phẩm bán`; `quantity_promo` vẫn xuất kho nhưng không tính phí vận chuyển.

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
    { "product_id": 1, "quantity": 20, "unit_price": 48000 }
  ]
}
→ 200 { "success": true, "orderId": 5, "orderCode": "DH-20260912-01", "total": 1010000 }
```

Với đơn `SALE` và `BORROW_IN`, API tự tính `quantity_promo` theo chương trình đang bật vào `order_date` và tổng số mua của từng mã sản phẩm trong đơn. Hàng tặng luôn cùng mã sản phẩm; khai báo số tặng vượt mức được hưởng sẽ trả 400. Khi gộp đơn, API tính lại số tặng theo số lượng mua của đơn gộp.

Phiếu giao nhận thủ công `POST /api/stock-tickets` và `PUT /api/stock-tickets/:id` cũng tự tính `quantity_promo` theo `ticket_date` và tổng số của từng mã hàng. Áp dụng cho phiếu nhập `PARENT_RECEIVE` / `TRANSFER_IN` / `OTHER_IN`, phiếu xuất `OTHER_OUT` và điều chuyển `TRANSFER`. Phiếu điều chỉnh, kiểm kê, hủy, hoàn trả và phiếu tự sinh từ đơn không nhận thêm khuyến mãi. Khi xác nhận phiếu, tồn kho thay đổi theo `quantity + quantity_promo`.

### 5.3. PUT `/api/orders/:id`
Cập nhật một phần: `order_status`, `payment_status`, `payment_method`, `shipper_employee_id`, `warehouse_id`, `delivery_date`, các trường VAT, `shipping_fee`, `discount_amount`, `paid_amount`, `note`.
> Không gửi trường nào sẽ được giữ nguyên (không còn lỗi null hóa shipper).

### 5.4. DELETE `/api/orders/:id`
**Hủy đơn và hoàn tác đầy đủ:** hoàn kho (+ nhật ký `IMPORT`), đảo nợ vỏ và xóa ledger của đơn, xóa phiếu thu, xóa phiếu điều phối + quyết toán liên quan; đặt `order_status = 'CANCELLED'`.

### 5.4b. Thu nợ — `POST /api/orders/:id/collect`
Thu tiền của đơn **đã hoàn tất** (kể cả đơn đã ghi nhận hàng hoàn) mà khách còn nợ — thu được nhiều lần.

```json
POST /api/orders/12/collect
{ "amount": 500000, "payment_method": "CASH", "transaction_date": "2026-09-22", "collected_by": 12, "note": "Khách trả nợ" }
```
- Điều kiện: trạng thái `COMPLETED` / `RETURNED`, `amount` ≤ số còn lại sau khi trừ tiền hàng hoàn.
- Đơn `SALE` / `BORROW_IN` sinh phiếu thu `DEBT_COLLECTION` gắn khách. Đơn `LEND_OUT` / `HIRED_LOAD` chỉ thu phần phí vận chuyển hoặc công bốc xếp, sinh phiếu `OTHER` không gắn khách.
- Cập nhật `paid_amount` và tính lại `payment_status` theo số thực thu.
- `collected_by` để trống thì lấy nhân viên bán của đơn; ngày thu mặc định hôm nay.

### 5.5. Hàng hoàn — `POST /api/orders/:id/return`
Khách trả lại hàng của đơn **đã hoàn tất**. Đơn chuyển sang trạng thái thứ 6 `RETURNED` (Hàng hoàn) và:
`order_status` nhận thêm giá trị `RETURNED`; đơn đã hoàn tất vẫn được tính **đủ doanh thu gộp và KPI**, chỉ **trừ phần hàng hoàn**.

- Điều kiện: đơn loại `SALE` / `BORROW_IN`, trạng thái `COMPLETED` (hoặc gọi lại trên đơn `RETURNED` để **sửa** số lượng hoàn), **chưa xuất hóa đơn**.
- Không đụng: KPI/chỉ tiêu, phân bổ lương giao hàng, điều phối giao hàng của đơn gốc.

```json
POST /api/orders/12/return
{
  "return_date": "2026-09-21",
  "pickup_type": "CUSTOMER_BRING",
  "collectors": [],
  "items": [{ "order_item_id": 34, "quantity": 4, "quantity_promo": 1 }],
  "shells_voi": 2,
  "shells_up": 0,
  "deposit_payment_method": "CASH",
  "refund_payment_method": "BANK_TRANSFER",
  "return_warehouse_id": 1,
  "note": "Khách trả 4 vỉ, còn 1 vỉ khuyến mãi"
}
```

- `items`: số lượng hoàn theo **từng dòng hàng của đơn** (cộng các dòng trùng trước khi so với số đã giao). Phiếu nhập kho sinh ra có lý do
  `ORDER_RETURN` và bút toán kho `RETURN_IN`. Đơn `SALE` nhập về kho đã xuất; đơn `BORROW_IN` bắt buộc chọn `return_warehouse_id` là kho thực đang hoạt động. Nợ hàng với đối tác chỉ giảm khi làm nghiệp vụ trả hàng cho đối tác.
- `pickup_type`: `CUSTOMER_BRING` = khách mang đến kho (**miễn ship**); `STAFF_PICKUP` = nhân viên đến lấy →
  tính phí y như phí giao hàng (theo tuyến × số đơn vị hoàn) và **phải** gửi `collectors` (nhân viên đi nhận).
- `shells_voi` / `shells_up`: vỏ thu hồi → **giảm nợ vỏ** của khách và sinh **phiếu hoàn cọc** tương ứng.
- Doanh thu và khoản phải thu giảm theo giá trị hàng hoàn sau khi phân bổ giảm giá của đơn, ghi vào **kỳ của ngày hoàn**; hàng khuyến mãi trả lại chỉ nhập kho. Phí giao ban đầu vẫn phải thu.
- Nếu tiền đã thu vượt số phải trả sau hoàn hàng, hệ thống hoàn phần chênh cho khách theo `refund_payment_method` (`CASH` hoặc `BANK_TRANSFER`), sinh phiếu `SALE_REFUND` âm trong sổ thu và giảm `paid_amount`. Gọi lại endpoint để sửa hàng hoàn sẽ hoàn tác phiếu cũ trước khi tính lại.
- Phản hồi: `{ success, orderId, ticketCode, returnedValue, refundAmount, depositRefund, shellsVoi, shellsUp }`.

**Đối soát kho** có cột riêng "Hàng hoàn"; **báo cáo doanh thu** trả thêm `summary.totalReturned`,
`summary.netRevenue` và bảng chi tiết `returnRows`. Tổng quan có thêm 2 chỉ số `revenueReturnedMonth`,
`revenueNetMonth`.

### 5.6. Bốn báo cáo doanh thu (tách theo nguồn hàng)
Doanh thu = **tiền hàng** của đơn đã hoàn thành nghĩa vụ (`COMPLETED`, kể cả đơn đã ghi nhận `RETURNED`);
hàng hoàn trừ vào **kỳ phát sinh hoàn** (`ticket_date` của phiếu nhập hàng hoàn). Phí vận chuyển là khoản
tiền công trả nhân viên giao hàng nên **tách khỏi doanh thu**. Cả 4 báo cáo nhận `from`, `to` và đều có bản `.xlsx`.

1. **Doanh thu xí nghiệp** — `GET /api/reports/revenue` / `GET /api/reports/revenue.xlsx`
   Hàng xuất từ kho của xí nghiệp (`order_type = 'SALE'`). Trả `summary` (gộp / hàng hoàn / thuần / số đơn /
   tiền công vận chuyển trả nhân viên giao hàng), `bySeller`, `byCustomer`, `byProduct`, `byDay`, `byMonth`, `orderDetail`, `returnRows`.
2. **Doanh thu xí nghiệp chi tiết** — `GET /api/reports/revenue-detail?group=warehouse|unit`
   / `GET /api/reports/revenue-detail.xlsx?group=...`
   `group=warehouse` → doanh thu từng kho xuất; `group=unit` → doanh thu từng **đơn vị (trạm)** và kèm
   `children` là từng nhân viên trong trạm (doanh thu nhân viên cộng lại = doanh thu trạm). Mỗi dòng:
   `orders`, `quantity`, `promo`, `revenue`, `returned`, `net`.
3. **Doanh thu đơn hàng đi mượn** — `GET /api/reports/revenue-borrowed` / `GET /api/reports/revenue-borrowed.xlsx`
   Đơn `BORROW_IN`: `rows` (mượn của đối tác nào, khách nhận, mặt hàng, giá trị, còn lại), `byPartner`
   (tổng theo đơn vị cho mượn), `totals`. Trạng thái và số còn lại lấy từ module mượn - trả (`loanState`).
4. **Doanh thu gộp** — `GET /api/reports/revenue-gross` / `GET /api/reports/revenue-gross.xlsx`
   `blocks` gồm 2 khối bán hàng: xí nghiệp (`SALE`) và hàng đi mượn của đối tác (`BORROW_IN`); mỗi khối có
   `byGroup` (theo kho hoặc theo đối tác) và tổng `total`. Kèm các khoản **không tính vào doanh thu**:
   `shippingCollected` (tiền công vận chuyển trả nhân viên giao hàng), `serviceFee` (tiền công bốc xếp — số đơn / phải thu / đã thu)
   và `lent` (hàng cho đối tác mượn — công nợ phải thu: số đơn, `value`, `returned`, `collected`, `byGroup`).

---

## 6. Kho Hàng & Tồn Kho (`/api/inventory`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/inventory/stock?warehouse_id=` | Tồn kho + `urgency_level`, `days_left` |
| GET | `/api/inventory/stock-daily?from=&to=` | Nhật ký tồn: tồn CUỐI mỗi ngày của từng kho × mặt hàng (tối đa 120 ngày) |
| GET | `/api/inventory/stock.xlsx` | Xuất tồn kho ra Excel: mỗi kho một dòng, mỗi mặt hàng một cột, kèm dòng TỔNG |
| GET | `/api/inventory/stock.xlsx?from=&to=` | Xuất NHẬT KÝ theo ngày: thêm cột NGÀY gộp theo khối ngày (như sheet TỒN TỔNG) |
| GET | `/api/inventory/alerts` | Mặt hàng dưới ngưỡng cảnh báo |
| GET | `/api/inventory/movements?product_id=&warehouse_id=&movement_type=&limit=` | Nhật ký kho (có tên kho, người thực hiện) |
| PUT | `/api/inventory/stock/:id` | Điều chỉnh tồn (`quantity`, `min_stock_alert`, `avg_daily_sales`) + ghi `ADJUSTMENT` |

**Ví dụ điều chuyển:**
```json
POST /api/stock-tickets
{ "ticket_type": "TRANSFER", "ticket_date": "2026-09-12", "warehouse_id": 1, "target_warehouse_id": 3, "reason": "TRANSFER", "items": [{ "product_id": 1, "quantity": 50 }], "note": "Bổ sung ca chiều" }
```
Phiếu tạo ở trạng thái nháp. Gọi `POST /api/stock-tickets/:id/status` với `{ "status": "CONFIRMED" }` để ghi sổ. Với chương trình 10 tặng 1, dòng 50 tự có `quantity_promo = 5`: kho xuất giảm 55, kho nhận tăng 55.

---

## 7. Mượn - Trả Hàng Hóa (`/api/loans`)

Nghiệp vụ mượn **hàng hóa** giữa xí nghiệp và đối tác liên kết (`partner_units`), lưu trên bảng `orders`
qua `order_type`:

| `order_type` | Nghiệp vụ | Kho | Phát sinh |
| :--- | :--- | :--- | :--- |
| `LEND_OUT` | Mình cho đối tác mượn hàng | Xuất kho mình (`LOAN_OUT`) | Đối tác **nợ hàng** → trả bằng hàng |
| `BORROW_IN` | Mình mượn hàng của đối tác | Kho ảo, nhập rồi xuất ngay (net 0) | Mình **nợ hàng** → trả bằng hàng |
| `HIRED_LOAD` | Đơn bốc xếp: công nhân mình đến kho đơn vị thuê bốc hàng, giao tới khách của họ | Không đụng kho mình | **Không nợ hàng** — chỉ thu tiền công vận chuyển |

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/loans?month=YYYY-MM&direction=LEND_OUT\|BORROW_IN` | Danh sách đơn mượn/cho mượn kèm dòng hàng (`quantity`, `returned`, `remaining`), lịch sử quyết toán, `loan_due_date`, `outstanding_value` và trạng thái `OUTSTANDING` / `PARTIAL` / `SETTLED` / `CANCELLED` |
| POST | `/api/loans/:orderId/settle` | Ghi nhận trả hàng từng phần (mượn hàng chỉ tất toán bằng hàng); đơn tự chốt khi trả hết hàng |

**Trả hàng** — chỉ áp dụng cho đơn đã giao hàng (Đang giao / Hoàn tất), không áp dụng cho đơn bốc xếp:

```json
POST /api/loans/12/settle
{
  "items": [{ "product_id": 3, "quantity": 10 }],
  "warehouse_id": 1,
  "settle_date": "2026-09-21",
  "note": "Đối tác trả một phần hàng"
}
```

- `items`: số lượng trả hàng theo từng mặt hàng, không vượt số còn lại. `LEND_OUT` → sinh phiếu **NHẬP**
  vào kho đã xuất (`PARTNER_RETURN` / `LOAN_IN`); `BORROW_IN` → sinh phiếu **XUẤT** từ `warehouse_id`
  (`RETURN_BORROW` / `BORROW_OUT`, kho phải là kho vật lý).
- **Mượn hàng chỉ tất toán bằng hàng** — không có trả tiền, nên không sinh phiếu thu/phiếu chi.
- Ngày phiếu luôn lấy theo ngày quyết toán thực tế, không lấy theo ngày đơn.

---

## 7b. Đơn bốc xếp (`order_type = 'HIRED_LOAD'`)

Hàng thuộc đơn vị thuê nên đơn bốc xếp **không sinh bút toán kho** và **không nằm trong màn Quản lý mượn - trả**:

- Bắt buộc: khách nhận hàng (khách của đơn vị thuê), `partner_unit_id` (đơn vị thuê), tuyến phí vận chuyển, người bốc/giao.
- Không bắt buộc: kho xuất (đơn luôn trỏ về kho ảo), nhân viên bán (không tính doanh thu/KPI bán nước).
- Giao hàng: chỉ sinh điều phối giao để phân bổ tiền công cho người bốc/giao.
- Hoàn tất: ghi tiền công bốc xếp thu được vào sổ thu.
- Vòng đời dùng chung: Nháp → Đã tạo đơn → Đang giao → Hoàn tất (không hủy được đơn đã hoàn tất).


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

**Báo cáo đối chiếu tiền** — `GET /api/reports/cash-audit?from=YYYY-MM-DD&to=YYYY-MM-DD&customer_id=`:

Số tiền đã thu trên đơn phải bằng số đã ghi vào sổ quỹ. Quy tắc ghi sổ khi đơn hoàn tất (`applyCompletionEffects`):

- Đơn `SALE` / `BORROW_IN`: ghi đúng `paid_amount`.
- Đơn `LEND_OUT` / `HIRED_LOAD`: chỉ ghi phần tiền vận chuyển thực thu = `min(paid_amount, shipping_fee)`.
- Đơn `payment_method = 'DEBT'`: không ghi phiếu thu.

Trả về:

- `rows`: chỉ gồm đơn có cảnh báo, gồm `paid_amount` (đã thu trên đơn), `ledger_revenue` (sổ quỹ), `expected_revenue` (số phải ghi theo quy tắc trên), `revenue_diff` = `ledger_revenue` − `expected_revenue`, `deposit_amount` so với `deposit_collect`, và `issues` (danh sách cảnh báo dạng câu).
- `customer_rows`: tổng hợp theo khách gồm `order_total`, `paid_total`, `ledger_total`, `revenue_diff`, `receivable`, `opening_debt`, `total_debt`.
- `totals`: tổng các cột + `receivable` (còn phải thu), `mismatch_orders` (số đơn lệch sổ quỹ), `issue_orders`, `issue_count`.

> `revenue_diff` âm = sổ quỹ thiếu so với số đã thu trên đơn (đã thu mà chưa ghi phiếu thu).

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

Dashboard điều hành còn trả `kpis.revenueYear`, `debtToday`, `debtMonth`, `debtYear`, `warehouseCount`; `revenueByScope` gồm hai phạm vi `COMPANY` và `ENTERPRISE`; `stockByWarehouse` gồm mọi kho vật lý đang hoạt động và tồn theo từng mã hàng (kể cả tồn 0). Doanh thu và công nợ theo năm lũy kế từ 01/01 đến hết tháng chọn. Công nợ kỳ là phần còn chưa thu **hiện tại** của các đơn hoàn tất có ngày đơn trong kỳ, sau thu tiền và hàng hoàn; nợ đầu kỳ không được gán vào kỳ. KPI nhân viên/đơn vị dùng `GET /api/targets?period=YYYY-MM`.

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

---

## 13. Nhập Dữ Liệu Từ Excel (`/api/imports`)

Mỗi màn hình danh sách có nút **Nhập Excel** (tải tệp mẫu → điền → tải lên). Hệ thống đọc tệp bằng ExcelJS, kiểm tra toàn bộ các dòng trước khi ghi: **có lỗi thì không nhập dòng nào**.

### 13.1. Danh sách mẫu (`kind`)

| kind | Màn hình | Bảng đích |
|------|----------|-----------|
| `categories` | Hệ thống → Nhóm hàng | `categories` |
| `customer-groups` | Hệ thống → Nhóm KH | `customer_groups` |
| `warehouses` | Hệ thống → Kho | `warehouses` |
| `org-units` | Hệ thống → Đơn vị | `org_units` |
| `staff` | Nhân sự → Nhân viên | `employees` |
| `products` | Đơn hàng → Sản phẩm | `products` |
| `customers` | Khách hàng → Danh sách | `customers` |
| `opening-stock` | Kho → Tồn kho | phiếu điều chỉnh `ADJUST_IN`/`ADJUST_OUT` |
| `orders` | Đơn hàng → Đơn hàng | `orders` + `order_items` |

**Thứ tự nhập:** danh mục (nhóm hàng, nhóm KH, kho, đơn vị, nhân viên, sản phẩm, khách hàng) → **tồn kho đầu kỳ** → **đơn hàng**.

### 13.2. GET `/api/imports/templates/:kind.xlsx`
Trả về tệp mẫu `.xlsx` gồm sheet **Dữ liệu** (tiêu đề cột, dropdown cho cột enum) và sheet **Hướng dẫn** (mô tả cột, ví dụ, giá trị hợp lệ).

### 13.3. POST `/api/imports/:kind?mode=strict|upsert`
| Thành phần | Giá trị |
|------------|---------|
| Body | Nội dung tệp `.xlsx` dạng nhị phân (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |
| `mode` | `strict` (mặc định): mã đã tồn tại → báo lỗi. `upsert`: cập nhật bản ghi theo mã |
| Giới hạn | 25MB (vượt → `413`), chỉ hỗ trợ `.xlsx` |

Quy ước dữ liệu:
- Cột tham chiếu (nhóm hàng, kho, đơn vị, nhân viên, sản phẩm, khách hàng, đối tác, tuyến phí) nhận **mã hoặc tên**, không phân biệt hoa/thường và dấu.
- Cột mã để trống → hệ thống tự sinh (`SP0001`, `KH001`, `NV001`, `KHO-001`, `DV-001`...).
- Ngày nhận `DD/MM/YYYY`, `YYYY-MM-DD` hoặc định dạng ngày của Excel.
- `opening-stock`: số trong tệp là tồn **thực tế** — hệ thống tự tính chênh lệch và tạo phiếu điều chỉnh đã xác nhận; nhập lại cùng tệp không làm sai số liệu.
- `orders`: 1 sheet phẳng, các dòng cùng `Mã nhóm đơn` gộp thành 1 đơn (để trống thì gộp theo khách hàng + ngày + kho + loại đơn); trạng thái khác "Nháp" sẽ đi đúng luồng nghiệp vụ (cần nhân viên bán, tuyến phí vận chuyển, đủ tồn kho).

**Thành công — `200`:**
```json
{ "success": true, "kind": "products", "imported": 12, "updated": 0, "message": "Đã nhập 12 dòng" }
```
`opening-stock` trả thêm `tickets` (mã phiếu điều chỉnh), `orders` trả thêm `orderCodes`.

**Có dòng lỗi — `400`:** không ghi dữ liệu nào, trả về danh sách lỗi kèm số dòng trong tệp Excel:
```json
{
  "error": "Tệp có 2 lỗi thuộc 1 dòng — chưa nhập dữ liệu nào",
  "details": { "errors": [{ "row": 2, "message": "Không tìm thấy nhóm hàng \"Không có\"" }] }
}
```
Lỗi khác: `400` thiếu tệp / sai định dạng tệp, `404` kind không hợp lệ.

---

## 14. Quản Trị CSDL (`/api/system`)

Dùng cho màn **Danh mục hệ thống → Cấu hình chung → Sao lưu & khôi phục dữ liệu**.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/system/export.xlsx` | Xuất TOÀN BỘ dữ liệu: mỗi bảng một sheet (tên sheet = tên bảng, dòng 1 là tên cột) |
| POST | `/api/system/import` | Khôi phục từ tệp đã xuất — **upsert theo khoá chính**, không xoá dữ liệu ngoài tệp |
| POST | `/api/system/reset-database` | Xoá sạch dữ liệu nghiệp vụ, đưa CSDL về mặc định ban đầu (giữ cấu hình chung) |

**`POST /api/system/import`** — body là tệp `.xlsx` nhị phân (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), giới hạn 50MB.

Cách ghi dữ liệu (theo khoá chính của từng bảng — `id`, hoặc `key`/`notification_id` với bảng khoá chữ):

| Trường hợp | Hành động |
| :--- | :--- |
| Khoá chính đã tồn tại trong CSDL | **Cập nhật** các cột còn lại của dòng đó |
| Khoá chính chưa có | **Thêm mới** đúng với khoá đó (giữ nguyên liên kết) |
| Ô khoá chính để trống | **Thêm mới** với khoá do hệ thống cấp |
| Dòng có trong CSDL nhưng không có trong tệp | **Giữ nguyên** (không xoá) |

Toàn bộ nằm trong một transaction (lỗi giữa chừng thì không ghi gì) và tạm tắt kiểm tra khoá ngoại nên thứ tự bảng trong tệp không quan trọng. Nhập cùng một tệp nhiều lần không sinh dòng trùng.

**Thành công — `200`:**
```json
{ "success": true, "inserted": 0, "updated": 175,
  "results": [{ "table": "customers", "inserted": 0, "updated": 10, "missing": [] }] }
```
`missing` là các cột có trong CSDL nhưng thiếu trong tệp — dữ liệu cột đó về mặc định/NULL, giao diện sẽ cảnh báo.

Lỗi: `400` tệp không đọc được / không có bảng nào khớp với hệ thống / thiếu tệp.

**`POST /api/system/reset-database`** — xoá sạch **dữ liệu nghiệp vụ** (khách hàng, đơn hàng, tồn kho, phiếu kho, sổ quỹ, hóa đơn, nhân viên, cọc vỏ, vỏ bình...) nhưng **giữ nguyên danh mục nền**: nhóm hàng, sản phẩm, bảng giá, phí vận chuyển, khuyến mãi, cọc vỏ, chức vụ, nhóm khách hàng, thuế suất, **kho hiện tại** và cấu hình chung (hai quy tắc vận chuyển được bật lại). Sau đó nạp lại các danh mục do phần mềm tự tạo (đơn vị gốc, nguồn nhập, đối tác mặc định, 3 kho ảo...). **Không** nạp `seed.sql` nên không có dữ liệu mẫu. Giao diện yêu cầu xác nhận 2 lần trước khi gọi.

