import ExcelJS from 'exceljs';

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

export const TICKET_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  CHECKING: 'Kiểm tra hàng',
  CONFIRMED: 'Đã ghi sổ tồn kho',
};

export const reasonLabel = (reason: string) => REASON_LABEL[reason] ?? reason;

export interface TicketRoute {
  from: string;
  via?: string | null;
  to: string;
}

export interface RouteInput {
  ticket_type: string;
  reason: string;
  warehouse_name?: string | null;
  target_warehouse_name?: string | null;
  partner_unit_name?: string | null;
  source_name?: string | null;
  customer_name?: string | null;
}

// Điểm đi → (điểm trung chuyển) → điểm đến, in thẳng lên phiếu để đối soát hai đầu.
export function ticketRoute(t: RouteInput, transitName: string): TicketRoute {
  const wh = t.warehouse_name ?? '—';
  if (t.ticket_type === 'TRANSFER') return { from: wh, to: t.target_warehouse_name ?? '—' };
  const customer = t.customer_name ? `Khách: ${t.customer_name}` : 'Khách hàng';

  if (t.ticket_type === 'IN') {
    switch (t.reason) {
      case 'PARENT_RECEIVE':
        return { from: t.source_name ?? 'Kho Công ty Quawaco', via: transitName, to: wh };
      case 'PARTNER_RETURN':
      case 'BORROW_IN':
        return { from: t.partner_unit_name ?? 'Đối tác', to: wh };
      case 'TRANSFER_IN':
        return { from: t.source_name ?? 'Kho khác', to: wh };
      case 'ORDER_CANCEL':
        return { from: customer, to: wh };
      default:
        return { from: t.source_name ?? '—', to: wh };
    }
  }

  switch (t.reason) {
    case 'ORDER_SALE':
    case 'LEND_OUT':
    case 'BORROW_DELIVER':
      return { from: wh, to: customer };
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

export interface TicketLine {
  ticket: RouteInput & {
    code: string;
    ticket_date: string;
    status: string;
    note?: string | null;
    order_code?: string | null;
    vehicle?: string | null;
    in_charge_name?: string | null;
  };
  product_name: string;
  unit?: string | null;
  quantity: number;
  quantity_promo: number;
}

const thin = { style: 'thin' as const, color: { argb: 'FF94A3B8' } };
const BORDER: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

/**
 * Danh sách phiếu kho để in/đối soát: mỗi dòng là một mặt hàng của một phiếu,
 * kèm ngày tháng và tuyến đi–đến để đối chiếu với bên cung cấp hoặc kho nhận.
 */
export async function buildStockTicketWorkbook(
  lines: TicketLine[],
  opts: { title: string; from?: string; to?: string; transitName: string }
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QAROMI ERP';
  const ws = wb.addWorksheet('Phieu kho');

  const HEADERS = [
    { header: 'STT', width: 5 },
    { header: 'Mã phiếu', width: 15 },
    { header: 'Ngày', width: 11 },
    { header: 'Loại phiếu', width: 12 },
    { header: 'Lý do', width: 24 },
    { header: 'Điểm đi', width: 22 },
    { header: 'Điểm trung chuyển', width: 20 },
    { header: 'Điểm đến', width: 22 },
    { header: 'Sản phẩm', width: 24 },
    { header: 'ĐVT', width: 7 },
    { header: 'Số lượng', width: 10 },
    { header: 'Trong đó KM', width: 11 },
    { header: 'Trạng thái', width: 16 },
    { header: 'Ghi chú', width: 24 },
  ];
  ws.columns = HEADERS.map((h) => ({ width: h.width }));
  const lastCol = ws.getColumn(HEADERS.length).letter;

  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.3, bottom: 0.4, header: 0.3, footer: 0.3 };

  const setCell = (
    addr: string,
    value: ExcelJS.CellValue,
    o: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; border?: boolean } = {}
  ) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.font = { name: 'Times New Roman', size: o.size ?? 11, bold: o.bold };
    cell.alignment = { horizontal: o.align ?? 'left', vertical: 'middle', wrapText: true };
    if (o.border) cell.border = BORDER;
    return cell;
  };

  ws.mergeCells(`A1:${lastCol}1`);
  setCell('A1', 'CÔNG TY CP NƯỚC SẠCH QUẢNG NINH', { bold: true, align: 'center', size: 12 });
  ws.mergeCells(`A2:${lastCol}2`);
  setCell('A2', opts.title.toUpperCase(), { bold: true, align: 'center', size: 14 });
  ws.mergeCells(`A3:${lastCol}3`);
  const period =
    opts.from || opts.to
      ? `Kỳ báo cáo: ${opts.from ? dateVn(opts.from) : '…'} — ${opts.to ? dateVn(opts.to) : '…'}`
      : 'Tất cả các phiếu';
  setCell('A3', period, { align: 'center', size: 11 });
  ws.getRow(2).height = 22;

  const headerRow = 5;
  HEADERS.forEach((h, i) => setCell(`${ws.getColumn(i + 1).letter}${headerRow}`, h.header, { bold: true, align: 'center', border: true }));
  ws.getRow(headerRow).height = 26;

  let row = headerRow + 1;
  let totalQty = 0;
  lines.forEach((line, index) => {
    const route = ticketRoute(line.ticket, opts.transitName);
    const values: ExcelJS.CellValue[] = [
      index + 1,
      line.ticket.code,
      dateVn(line.ticket.ticket_date),
      TICKET_TYPE_LABEL[line.ticket.ticket_type] ?? line.ticket.ticket_type,
      reasonLabel(line.ticket.reason),
      route.from,
      route.via ?? '',
      route.to,
      line.product_name,
      line.unit ?? '',
      line.quantity,
      line.quantity_promo || '',
      TICKET_STATUS_LABEL[line.ticket.status] ?? line.ticket.status,
      line.ticket.note ?? '',
    ];
    values.forEach((value, i) => {
      const align: 'left' | 'center' | 'right' = i === 0 || (i >= 10 && i <= 11) ? 'center' : 'left';
      setCell(`${ws.getColumn(i + 1).letter}${row}`, value, { border: true, align, size: 10 });
    });
    totalQty += line.quantity;
    row += 1;
  });

  // Dòng tổng: chỉ cộng cột Số lượng để đối chiếu nhanh với sổ.
  ws.mergeCells(`A${row}:J${row}`);
  setCell(`A${row}`, `TỔNG CỘNG (${lines.length} dòng hàng)`, { bold: true, align: 'right', border: true });
  setCell(`K${row}`, totalQty, { bold: true, align: 'center', border: true });
  setCell(`L${row}`, '', { border: true });
  setCell(`M${row}`, '', { border: true });
  setCell(`N${row}`, '', { border: true });

  return wb.xlsx.writeBuffer();
}

function dateVn(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}
