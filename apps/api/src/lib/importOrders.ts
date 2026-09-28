import Database from 'better-sqlite3';
import { normalizeKey, optionalDate, optionalEnum, optionalNumber, refId, requireDate, requireNumber, resolveRef, textOf, RowErrorCollector, type ImportRow } from './excelTemplate.js';
import { columnOf, refMaps, type ImportOutcome } from './importMaster.js';
import { createOrder, type RawItem } from './orderCreate.js';
import { changeStatus, shipperRequired, type OrderStatus } from './orderStatus.js';
import { IMPORT_SPECS } from './importSpecs.js';

// Đi theo đúng luồng trạng thái: Nháp → Đã xác nhận → Đang giao → Hoàn tất.
const STATUS_CHAIN: Record<string, OrderStatus[]> = {
  DRAFT: [],
  CONFIRMED: ['CONFIRMED'],
  SHIPPING: ['CONFIRMED', 'SHIPPING'],
  COMPLETED: ['CONFIRMED', 'SHIPPING', 'COMPLETED'],
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
};

interface OrderHeader {
  customer_id: number;
  order_date: string;
  warehouse_id: number | null;
  order_type: string;
  partner_unit_id: number | null;
  seller_employee_id: number | null;
  shipper_ids: number[];
  status: string;
  payment_status: string;
  payment_method: string;
  paid_amount?: number;
  shipping_fee: number;
  shipping_fee_id: number | null;
  delivery_date?: string;
  note: string;
}

interface Group {
  header: OrderHeader;
  firstRow: number;
  groupLabel: string;
  items: RawItem[];
}

export function importOrderRows(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector): ImportOutcome {
  const maps = refMaps(db);
  const customers = maps.customers();
  const warehouses = maps.warehouses();
  const products = maps.products();
  const staff = maps.staff();
  const partnerUnits = maps.partnerUnits();
  const shippingFees = maps.shippingFees();
  const spec = IMPORT_SPECS.orders;
  const requiredStatuses = new Set(['CONFIRMED', 'SHIPPING', 'COMPLETED']);

  const integer = (row: ImportRow, key: string, label: string, required: boolean): number | undefined => {
    const value = required
      ? requireNumber(row, errors, key, label)
      : optionalNumber(row, errors, key, label);
    if (value === undefined) return undefined;
    if (!Number.isInteger(value)) errors.add(row.row, `"${label}" phải là số nguyên`);
    if (value < 0) errors.add(row.row, `"${label}" không được là số âm`);
    return value;
  };

  const groups = new Map<string, Group>();
  for (const row of rows) {
    const orderDate = requireDate(row, errors, 'order_date', 'Ngày đơn');
    const customerId = refId(row, errors, customers, 'customer', 'Khách hàng', true);
    const productId = refId(row, errors, products, 'product', 'Mã sản phẩm', true);
    const quantity = integer(row, 'quantity', 'Số lượng', true);
    const quantityPromo = integer(row, 'quantity_promo', 'SL khuyến mãi', false) ?? 0;
    const unitPrice = optionalNumber(row, errors, 'unit_price', 'Đơn giá');
    if (unitPrice !== undefined && unitPrice < 0) errors.add(row.row, '"Đơn giá" không được là số âm');

    const orderType = optionalEnum(row, errors, columnOf('orders', 'order_type')) ?? 'SALE';
    const status = optionalEnum(row, errors, columnOf('orders', 'status')) ?? 'DRAFT';
    const paymentStatus = optionalEnum(row, errors, columnOf('orders', 'payment_status')) ?? 'UNPAID';
    const paymentMethod = optionalEnum(row, errors, columnOf('orders', 'payment_method')) ?? 'CASH';
    const paidAmount = optionalNumber(row, errors, 'paid_amount', 'Số tiền đã trả');
    const shippingFee = optionalNumber(row, errors, 'shipping_fee', 'Phí vận chuyển') ?? 0;
    if (shippingFee < 0) errors.add(row.row, '"Phí vận chuyển" không được là số âm');

    const isBorrow = orderType === 'BORROW_IN';
    // Đơn mượn vào và đơn bốc xếp không lấy hàng từ kho của mình nên không cần cột kho xuất.
    const needsWarehouse = orderType !== 'BORROW_IN' && orderType !== 'HIRED_LOAD';
    const warehouseId = refId(row, errors, warehouses, 'warehouse', 'Kho xuất', needsWarehouse) ?? null;
    const partnerUnitId = refId(row, errors, partnerUnits, 'partner_unit', 'Đối tác liên kết', orderType !== 'SALE') ?? null;
    const sellerEmployeeId = refId(row, errors, staff, 'seller', 'Nhân viên bán') ?? null;
    // Một đơn có thể nhiều người giao — ghi cách nhau dấu "+" (VD: Huế + Phương), phí vận chuyển chia đều.
    const shipperIds: number[] = [];
    for (const part of textOf(row.cells.shipper).split(/[+,;]/).map((p) => p.trim()).filter(Boolean)) {
      const id = resolveRef(staff, part);
      if (!id) errors.add(row.row, `Không tìm thấy nhân viên giao "${part}"`);
      else if (!shipperIds.includes(id)) shipperIds.push(id);
    }
    // Tắt cấu hình "đơn không có nhân viên vận chuyển là đơn miễn ship" thì đơn phải có người giao —
    // báo theo từng dòng để biết sửa ở đâu, thay vì để lỗi khi tạo đơn giữa chừng.
    if (shipperRequired(db, orderType) && !shipperIds.length) {
      errors.add(row.row, 'Cần có "Nhân viên giao" (hoặc bật "Đơn không có nhân viên vận chuyển là đơn miễn ship" trong Danh mục hệ thống)');
    }
    const shippingFeeId = refId(row, errors, shippingFees, 'shipping_fee_id', 'Tuyến phí vận chuyển') ?? null;
    const deliveryDate = optionalDate(row, errors, 'delivery_date', 'Ngày giao');

    // Đơn khác Nháp sẽ đi qua đúng luồng nghiệp vụ nên phải đủ điều kiện xác nhận ngay từ tệp.
    if (requiredStatuses.has(status)) {
      const label = STATUS_LABEL[status] ?? status;
      if (orderType !== 'LEND_OUT' && orderType !== 'HIRED_LOAD' && !sellerEmployeeId) {
        errors.add(row.row, `Đơn ở trạng thái "${label}" cần có "Nhân viên bán"`);
      }
      if (!isBorrow && !shippingFeeId) errors.add(row.row, `Đơn ở trạng thái "${label}" cần có "Tuyến phí vận chuyển"`);
    }
    if (paymentStatus === 'PARTIAL' && paidAmount === undefined) {
      errors.add(row.row, 'Thanh toán một phần cần nhập "Số tiền đã trả"');
    }

    const header: OrderHeader = {
      customer_id: customerId ?? 0,
      order_date: orderDate ?? '',
      warehouse_id: warehouseId,
      order_type: orderType,
      partner_unit_id: partnerUnitId,
      seller_employee_id: sellerEmployeeId,
      shipper_ids: shipperIds,
      status,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      paid_amount: paidAmount,
      shipping_fee: shippingFee,
      shipping_fee_id: shippingFeeId,
      delivery_date: deliveryDate,
      note: textOf(row.cells.note),
    };

    const explicitGroup = textOf(row.cells.order_group);
    const groupKey = explicitGroup
      ? `G:${normalizeKey(explicitGroup)}`
      : `A:${customerId ?? 0}|${orderDate ?? ''}|${warehouseId ?? 0}|${orderType}`;
    const groupLabel = explicitGroup || `khách hàng "${textOf(row.cells.customer)}" ngày ${orderDate ?? ''}`;
    const existing = groups.get(groupKey);
    if (existing) {
      const differs =
        existing.header.customer_id !== header.customer_id ||
        existing.header.order_date !== header.order_date ||
        existing.header.warehouse_id !== header.warehouse_id ||
        existing.header.order_type !== header.order_type;
      if (differs) {
        errors.add(row.row, `Dòng này không cùng khách hàng / ngày đơn / kho xuất / loại đơn với dòng ${existing.firstRow} trong nhóm "${groupLabel}"`);
      }
    } else {
      groups.set(groupKey, { header, firstRow: row.row, groupLabel, items: [] });
    }
    const group = groups.get(groupKey)!;
    if (productId && quantity !== undefined && quantity > 0) {
      group.items.push({ product_id: productId, quantity, quantity_promo: quantityPromo, unit_price: unitPrice, note: '' });
    }
  }

  for (const group of groups.values()) {
    if (!group.items.length) errors.add(group.firstRow, `Nhóm "${group.groupLabel}" không có dòng hàng hợp lệ nào`);
  }
  errors.throwIfAny();

  const orderCodes: string[] = [];
  let lines = 0;
  db.transaction(() => {
    for (const group of groups.values()) {
      const created = createOrder(db, {
        customer_id: group.header.customer_id,
        order_type: group.header.order_type,
        partner_unit_id: group.header.partner_unit_id,
        seller_employee_id: group.header.seller_employee_id,
        shipper_employee_id: group.header.shipper_ids[0] ?? null,
        shippers: group.header.shipper_ids.map((id) => ({ employee_id: id, allocated_fee: 0 })),
        warehouse_id: group.header.warehouse_id,
        order_date: group.header.order_date,
        delivery_date: group.header.delivery_date,
        payment_status: group.header.payment_status,
        payment_method: group.header.payment_method,
        paid_amount: group.header.paid_amount,
        shipping_fee: group.header.shipping_fee,
        shipping_fee_id: group.header.shipping_fee_id,
        note: group.header.note,
        items: group.items,
      });
      for (const step of STATUS_CHAIN[group.header.status] ?? []) changeStatus(db, created.orderId, step);
      orderCodes.push(created.orderCode);
      lines += group.items.length;
    }
  })();

  const message = `Đã nhập ${orderCodes.length} đơn hàng (${lines} dòng hàng)`;
  return { imported: orderCodes.length, updated: 0, message, orderCodes };
}
