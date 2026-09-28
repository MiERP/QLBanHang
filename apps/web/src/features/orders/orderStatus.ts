import type { Order, OrderStatus } from '../../types';

type Tone = 'neutral' | 'navy' | 'cyan' | 'green' | 'amber' | 'red' | 'indigo';

// Nguồn sự thật duy nhất cho nhãn/màu trạng thái đơn hàng.
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Nháp', tone: 'neutral' },
  CONFIRMED: { label: 'Đã tạo đơn', tone: 'cyan' },
  SHIPPING: { label: 'Đang giao', tone: 'amber' },
  COMPLETED: { label: 'Hoàn tất', tone: 'green' },
  CANCELLED: { label: 'Đã hủy', tone: 'red' },
  RETURNED: { label: 'Hàng hoàn', tone: 'indigo' },
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  RETURNED: [],
};

export const ORDER_ACTION_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Về nháp',
  CONFIRMED: 'Xác nhận đơn',
  SHIPPING: 'Giao hàng',
  COMPLETED: 'Hoàn tất đơn',
  CANCELLED: 'Hủy đơn',
  RETURNED: 'Hàng hoàn',
};

export const PAYMENT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: 'Đã thanh toán', tone: 'green' },
  PARTIAL: { label: 'Thanh toán một phần', tone: 'amber' },
  UNPAID: { label: 'Công nợ', tone: 'red' },
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  SALE: 'Đơn bán',
  LEND_OUT: 'Đơn cho mượn',
  BORROW_IN: 'Đơn mượn',
  HIRED_LOAD: 'Đơn bốc xếp',
};

export function statusMeta(status: string): { label: string; tone: Tone } {
  return ORDER_STATUS_META[status as OrderStatus] ?? { label: status, tone: 'neutral' };
}

export function paymentStatusMeta(status: string): { label: string; tone: Tone } {
  return PAYMENT_STATUS_META[status] ?? { label: status, tone: 'neutral' };
}

export function nextStatuses(status: string): OrderStatus[] {
  return ORDER_TRANSITIONS[status as OrderStatus] ?? [];
}

// --- Trạng thái kho suy ra từ trạng thái đơn hàng ---
export type StockStatus = 'NOT_EXPORTED' | 'EXPORTED' | 'CANCELLED';

export const STOCK_STATUS_META: Record<StockStatus, { label: string; tone: Tone }> = {
  NOT_EXPORTED: { label: 'Chưa xuất kho', tone: 'amber' },
  EXPORTED: { label: 'Đã xuất kho', tone: 'green' },
  CANCELLED: { label: 'Hủy', tone: 'red' },
};

// Nháp / Đã tạo đơn → chưa xuất kho; Đang giao / Hoàn tất / Hàng hoàn → đã xuất kho; Đã hủy → hủy.
export function stockStatusOf(orderStatus: string): StockStatus {
  if (orderStatus === 'CANCELLED') return 'CANCELLED';
  if (orderStatus === 'SHIPPING' || orderStatus === 'COMPLETED' || orderStatus === 'RETURNED') return 'EXPORTED';
  return 'NOT_EXPORTED';
}

export function stockStatusMeta(orderStatus: string): { label: string; tone: Tone } {
  return STOCK_STATUS_META[stockStatusOf(orderStatus)];
}

// Tổng số lượng của đơn (hàng bán + hàng khuyến mãi).
export function orderTotalQuantity(order: Order): number {
  return (order.items ?? []).reduce((a, i) => a + (Number(i.quantity) || 0) + (Number(i.quantity_promo) || 0), 0);
}

// Số lượng hàng khuyến mãi (không tính doanh thu) của đơn.
export function orderPromoQuantity(order: Order): number {
  return (order.items ?? []).reduce((a, i) => a + (Number(i.quantity_promo) || 0), 0);
}

// Chia đều phí ship cho danh sách người giao; phần lẻ cộng vào người đầu tiên.
export function splitShippingFee<T extends { allocated_fee: number }>(list: T[], fee: number): T[] {
  if (!list.length) return list;
  const base = Math.floor(fee / list.length);
  const rem = fee - base * list.length;
  return list.map((s, i) => ({ ...s, allocated_fee: base + (i < rem ? 1 : 0) }));
}
