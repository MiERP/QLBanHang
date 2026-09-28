export const TICKET_TYPE_LABEL: Record<string, string> = {
  IN: 'Phiếu nhập',
  OUT: 'Phiếu xuất',
  TRANSFER: 'Phiếu điều chuyển',
};

export const REASON_LABEL: Record<string, string> = {
  PARENT_RECEIVE: 'Nhận hàng từ Công ty Quawaco',
  PARTNER_RETURN: 'Đối tác trả hàng mượn',
  ORDER_CANCEL: 'Hoàn kho do hủy đơn',
  BORROW_IN: 'Nhập hàng mượn đối tác',
  ORDER_RETURN: 'Hàng hoàn',
  TRANSFER_IN: 'Nhận điều chuyển',
  ADJUST_IN: 'Điều chỉnh tăng',
  OTHER_IN: 'Nhập khác',
  ORDER_SALE: 'Xuất bán theo đơn',
  LEND_OUT: 'Cho đối tác mượn',
  BORROW_DELIVER: 'Xuất hàng mượn cho khách',
  RETURN_BORROW: 'Trả hàng mượn cho đối tác',
  TRANSFER_OUT: 'Xuất điều chuyển',
  ADJUST_OUT: 'Điều chỉnh giảm',
  WRITE_OFF: 'Xuất hủy / hàng mất',
  OTHER_OUT: 'Xuất khác',
  TRANSFER: 'Điều chuyển kho nội bộ',
};

export const IN_REASONS = ['PARENT_RECEIVE', 'TRANSFER_IN', 'ADJUST_IN', 'OTHER_IN'];
export const OUT_REASONS = ['WRITE_OFF', 'ADJUST_OUT', 'OTHER_OUT'];

export type TicketType = 'IN' | 'OUT' | 'TRANSFER';
export type TicketStatus = 'DRAFT' | 'CHECKING' | 'CONFIRMED';

type Tone = 'neutral' | 'navy' | 'cyan' | 'green' | 'amber' | 'red' | 'indigo';

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Nháp', tone: 'neutral' },
  CHECKING: { label: 'Kiểm tra hàng', tone: 'amber' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'green' },
};

// Nháp → Kiểm tra hàng → Xác nhận. Bút toán kho chỉ sinh khi XÁC NHẬN.
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  DRAFT: ['CHECKING', 'CONFIRMED'],
  CHECKING: ['CONFIRMED'],
  CONFIRMED: [],
};

export const TICKET_ACTION_LABEL: Record<TicketStatus, string> = {
  DRAFT: 'Về nháp',
  CHECKING: 'Kiểm tra hàng',
  CONFIRMED: 'Xác nhận (ghi sổ)',
};

export function ticketStatusMeta(status: string): { label: string; tone: Tone } {
  return TICKET_STATUS_META[status as TicketStatus] ?? { label: status, tone: 'neutral' };
}

export function nextTicketStatuses(status: string): TicketStatus[] {
  return TICKET_TRANSITIONS[status as TicketStatus] ?? [];
}

export function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

// --- Tuyến vận chuyển của phiếu: điểm đi → (trung chuyển) → điểm đến ---
export interface TicketRoute {
  from: string;
  via?: string | null;
  to: string;
}

// Kho ảo trung chuyển của xí nghiệp (mã KHO_XN) — mặc định khi chưa tra được tên từ danh mục.
export const TRANSIT_WAREHOUSE_CODE = 'KHO_XN';
export const DEFAULT_TRANSIT = 'Kho Xí nghiệp (trung chuyển)';

const customerNode = (t: StockTicketLike) => (t.customer_name ? `Khách: ${t.customer_name}` : 'Khách hàng');

interface StockTicketLike {
  ticket_type: 'IN' | 'OUT' | 'TRANSFER';
  reason: string;
  warehouse_name?: string;
  target_warehouse_name?: string | null;
  partner_unit_name?: string | null;
  source_name?: string | null;
  customer_name?: string | null;
}

export function ticketRoute(t: StockTicketLike, transitName = DEFAULT_TRANSIT): TicketRoute {
  const wh = t.warehouse_name ?? '—';
  if (t.ticket_type === 'TRANSFER') return { from: wh, to: t.target_warehouse_name ?? '—' };

  if (t.ticket_type === 'IN') {
    switch (t.reason) {
      case 'PARENT_RECEIVE':
        // Công ty Quawaco cấp hàng → (kho xí nghiệp điều phối) → kho con nhận hàng
        return { from: t.source_name ?? 'Kho Công ty Quawaco', via: transitName, to: wh };
      case 'PARTNER_RETURN':
      case 'BORROW_IN':
        return { from: t.partner_unit_name ?? 'Đối tác', to: wh };
      case 'TRANSFER_IN':
        return { from: t.source_name ?? 'Kho khác', to: wh };
      case 'ORDER_CANCEL':
        return { from: customerNode(t), to: wh };
      default:
        return { from: t.source_name ?? '—', to: wh };
    }
  }

  switch (t.reason) {
    case 'ORDER_SALE':
    case 'LEND_OUT':
    case 'BORROW_DELIVER':
      return { from: wh, to: customerNode(t) };
    case 'RETURN_BORROW':
      return { from: wh, to: t.partner_unit_name ?? 'Đối tác' };
    case 'WRITE_OFF':
      return { from: wh, to: 'Xuất hủy' };
    case 'ADJUST_OUT':
      return { from: wh, to: 'Điều chỉnh giảm' };
    default:
      return { from: wh, to: t.partner_unit_name ?? 'Khách hàng' };
  }
}
