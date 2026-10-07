import { Router } from 'express';
import ExcelJS from 'exceljs';
import type Database from 'better-sqlite3';
import { getDb } from '../db.js';
import { loanState } from './loans.js';
import { freeShipWithoutShipper } from '../lib/appSettings.js';
import { currentReportPeriod } from '../lib/reportPeriod.js';
import { today } from '../lib/codes.js';
import { handle } from '../lib/http.js';
import { shellDepositFees } from '../lib/shells.js';
import { vatRateAt } from '../lib/vat.js';

// Báo cáo doanh thu lấy thẳng theo danh mục sản phẩm (hàng hóa), không gán cứng tên.
const REPORT_PRODUCT_TYPE = 'GOODS';

interface TradeItem {
  key: string;
  label: string;
  quantity: number;
  unit_price: number;
  net_unit_price: number;
  amount_gross: number;
  amount_net: number;
  tax_amount: number;
}

interface TradeBlock {
  items: TradeItem[];
  totals: { quantity: number; amount_gross: number; amount_net: number; tax_amount: number };
}

// Hai nguồn khách của xí nghiệp: khách do xí nghiệp khai thác và khách do Công ty đưa sang.
// Công ty không phải đối tác liên kết mà là một thực thể ngang hàng — doanh thu vẫn là của xí nghiệp,
// tách nguồn chỉ để nhìn rõ nguồn khai thác.
const TRADE_SOURCES = [
  { key: 'ENTERPRISE', label: 'XNN Hồng Gai' },
  { key: 'COMPANY', label: 'Công ty' },
] as const;

interface TradeSourceBlock {
  key: string;
  label: string;
  block: TradeBlock;
}

interface TradeReportData {
  from: string;
  to: string;
  label: string;
  vatRate: number;
  includeBorrowed: boolean;
  current: TradeBlock;
  cumulative: TradeBlock;
  sources: { current: TradeSourceBlock[]; cumulative: TradeSourceBlock[] };
}

// Sinh file Excel khổ ngang (A4 landscape) theo mẫu nộp Công ty, đủ khối chữ ký.
async function buildTradeTemplateWorkbook(data: TradeReportData, mode: 'net' | 'gross'): Promise<ExcelJS.Buffer> {
  const amountOf = (r: TradeItem) => (mode === 'net' ? r.amount_net : r.amount_gross);
  const totalAmountOf = (b: TradeBlock) => (mode === 'net' ? b.totals.amount_net : b.totals.amount_gross);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Báo cáo');
  const n = data.current.items.length || 1;
  const totalCols = 3 + n * 2;
  const letter = (idx: number) => ws.getColumn(idx).letter;
  const pairCols: [string, string][] = data.current.items.map((_, i) => [letter(2 + i * 2), letter(3 + i * 2)]);
  const totalCol1 = letter(2 + n * 2);
  const totalCol2 = letter(3 + n * 2);

  ws.columns = [
    { width: 22 },
    ...Array.from({ length: n }, () => [{ width: 7 }, { width: 12.5 }]).flat(),
    { width: 12 },
    { width: 13 },
  ];
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 1;
  ws.pageSetup.printArea = `A1:${totalCol2}25`;
  ws.pageSetup.margins = { left: 0.29, right: 0.17, top: 0.26, bottom: 0.75, header: 0.51, footer: 0.51 };

  const setCell = (
    addr: string,
    value: ExcelJS.CellValue,
    opts: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; numFmt?: string } = {}
  ) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.font = { name: 'Times New Roman', size: opts.size ?? 11, bold: opts.bold };
    cell.alignment = { horizontal: opts.align ?? 'left', vertical: 'middle', wrapText: true };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    return cell;
  };

  ws.mergeCells('A1:F1');
  setCell('A1', 'CÔNG TY CP NƯỚC SẠCH QUẢNG NINH', { bold: true, align: 'center' });
  ws.mergeCells(`H1:${totalCol2}1`);
  setCell('H1', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, align: 'center' });
  ws.mergeCells('A2:F2');
  setCell('A2', 'XÍ NGHIỆP NƯỚC HỒNG GAI', { bold: true, align: 'center' });
  ws.mergeCells(`H2:${totalCol2}2`);
  setCell('H2', 'Độc lập - Tự do - Hạnh phúc', { bold: true, align: 'center' });

  // Bản cộng thêm hàng đi mượn của đối tác thì ghi rõ phạm vi để không lẫn với bản chuẩn.
  if (data.includeBorrowed) {
    ws.mergeCells(`A3:${totalCol2}3`);
    setCell('A3', 'Phạm vi: đơn bán của xí nghiệp + hàng đi mượn của đối tác về bán', { align: 'center', size: 10 });
  }

  ws.mergeCells(`A4:${totalCol2}4`);
  setCell('A4', 'BÁO CÁO THƯƠNG MẠI NƯỚC ION KIỀM QAROMI', { bold: true, align: 'center', size: 14 });
  ws.mergeCells(`A5:${totalCol2}5`);
  setCell('A5', `Kỳ báo cáo: ${data.from} → ${data.to}`, { align: 'center' });

  // Chiều cao dòng tiêu đề: ô gộp không tự giãn nên phải đặt sẵn để tên sản phẩm xuống dòng hiển thị đủ.
  ws.getRow(6).height = 26;
  ws.getRow(7).height = 26;

  data.current.items.forEach((item, i) => {
    const [c1, c2] = pairCols[i];
    ws.mergeCells(`${c1}6:${c2}7`);
    setCell(`${c1}6`, item.label, { bold: true, align: 'center' });
    setCell(`${c1}8`, 'SL', { bold: true, align: 'center' });
    setCell(`${c2}8`, 'DT', { bold: true, align: 'center' });
  });
  ws.mergeCells('A6:A8');
  setCell('A6', 'Đơn vị', { bold: true, align: 'center' });
  ws.mergeCells(`${totalCol1}6:${totalCol2}7`);
  setCell(`${totalCol1}6`, 'Tổng cộng', { bold: true, align: 'center' });
  setCell(`${totalCol1}8`, 'SL', { bold: true, align: 'center' });
  setCell(`${totalCol2}8`, 'DT', { bold: true, align: 'center' });

  ws.mergeCells(`A9:${totalCol2}9`);
  setCell('A9', 'I. Thực hiện tháng', { bold: true });
  ws.mergeCells(`A13:${totalCol2}13`);
  setCell('A13', 'II. Lũy kế', { bold: true });

  // Mỗi khối: 1 hàng "Tổng" (doanh thu xí nghiệp) + 1 hàng cho từng nguồn khách.
  const fillRow = (rowIdx: number, label: string, block: TradeBlock) => {
    setCell(`A${rowIdx}`, label, { bold: true });
    block.items.forEach((item, i) => {
      const [c1, c2] = pairCols[i];
      setCell(`${c1}${rowIdx}`, item.quantity, { align: 'center', numFmt: '#,##0' });
      setCell(`${c2}${rowIdx}`, amountOf(item), { align: 'right', numFmt: '#,##0' });
    });
    setCell(`${totalCol1}${rowIdx}`, block.totals.quantity, { align: 'center', numFmt: '#,##0', bold: true });
    setCell(`${totalCol2}${rowIdx}`, totalAmountOf(block), { align: 'right', numFmt: '#,##0', bold: true });
  };
  fillRow(10, 'Tổng', data.current);
  data.sources.current.forEach((source, i) => fillRow(11 + i, source.label, source.block));
  fillRow(14, 'Tổng', data.cumulative);
  data.sources.cumulative.forEach((source, i) => fillRow(15 + i, source.label, source.block));

  for (let r = 6; r <= 16; r++) {
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }

  // Khối chữ ký chia 3 phần đều theo bề rộng bảng; dòng 23 để trống ký tay
  // (tên người ký sẽ lấy từ cấu hình Chữ ký báo cáo khi bổ sung).
  const third = Math.ceil(totalCols / 3);
  const sigRanges: [string, string][] = [
    [letter(1), letter(third)],
    [letter(third + 2), letter(Math.min(third * 2 + 1, totalCols))],
    [letter(Math.min(Math.max(third * 2 + 3, third + 3), totalCols)), letter(totalCols)],
  ];
  ['LẬP BIỂU', 'BP. KINH DOANH', 'LÃNH ĐẠO ĐƠN VỊ'].forEach((title, i) => {
    const [c1, c2] = sigRanges[i];
    ws.mergeCells(`${c1}18:${c2}18`);
    setCell(`${c1}18`, title, { bold: true, align: 'center' });
    ws.mergeCells(`${c1}23:${c2}23`);
  });

  return wb.xlsx.writeBuffer();
}

interface PayrollItem {
  id: number;
  code: string;
  date: string;
  customer_name: string;
  note: string;
  amount: number;
}

interface PayrollDetailRow {
  employee_id: number | null;
  name: string;
  unit_name: string | null;
  count: number;
  amount: number;
  items: PayrollItem[];
}

interface PayrollData {
  from: string;
  to: string;
  year: string;
  detail: PayrollDetailRow[];
  summary: {
    year: string;
    rows: { employee_id: number | null; name: string; unit_name: string | null; totals: number[]; total: number }[];
  };
}

// Excel bảng lương: sheet 1 chi tiết theo nhân viên (cộng từng người), sheet 2 tổng hợp theo tháng.
async function buildPayrollWorkbook(data: PayrollData, title: string): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const monthLabel = `Kỳ ${data.from} → ${data.to}`;
  const FONT = { name: 'Times New Roman', size: 11 };
  const BORDER = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  };

  const setup = (ws: ExcelJS.Worksheet, widths: number[]) => {
    ws.columns = widths.map((w) => ({ width: w }));
    ws.pageSetup.paperSize = 9;
    ws.pageSetup.orientation = 'landscape';
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 1;
  };
  const put = (
    ws: ExcelJS.Worksheet,
    addr: string,
    value: ExcelJS.CellValue,
    opts: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; numFmt?: string } = {}
  ) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.font = { ...FONT, size: opts.size ?? 11, bold: opts.bold };
    cell.alignment = { horizontal: opts.align ?? 'left', vertical: 'middle', wrapText: true };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    return cell;
  };

  // --- Sheet 1: Chi tiết theo nhân viên ---
  const ws1 = wb.addWorksheet('Chi tiết theo nhân viên');
  setup(ws1, [24, 20, 12, 16, 28, 26, 14]);
  ws1.mergeCells('A1:G1');
  put(ws1, 'A1', `${title} — ${monthLabel}`, { bold: true, align: 'center', size: 13 });

  const headers = ['Nhân viên', 'Đơn vị', 'Ngày', 'Mã', 'Khách hàng', 'Nội dung', 'Số tiền'];
  headers.forEach((h, i) => put(ws1, ws1.getColumn(i + 1).letter + '2', h, { bold: true, align: 'center' }));

  let r = 3;
  let grand = 0;
  for (const emp of data.detail) {
    for (const it of emp.items) {
      put(ws1, `A${r}`, emp.name);
      put(ws1, `B${r}`, emp.unit_name ?? '—');
      put(ws1, `C${r}`, it.date, { align: 'center' });
      put(ws1, `D${r}`, it.code);
      put(ws1, `E${r}`, it.customer_name || '—');
      put(ws1, `F${r}`, it.note || '—');
      put(ws1, `G${r}`, it.amount, { align: 'right', numFmt: '#,##0' });
      r++;
    }
    ws1.mergeCells(`A${r}:F${r}`);
    put(ws1, `A${r}`, `Cộng ${emp.name}`, { bold: true, align: 'right' });
    put(ws1, `G${r}`, emp.amount, { bold: true, align: 'right', numFmt: '#,##0' });
    grand += emp.amount;
    r += 2;
  }
  ws1.mergeCells(`A${r}:F${r}`);
  put(ws1, `A${r}`, 'TỔNG CỘNG', { bold: true, align: 'right' });
  put(ws1, `G${r}`, grand, { bold: true, align: 'right', numFmt: '#,##0' });
  for (let row = 2; row <= r; row++) {
    for (let col = 1; col <= 7; col++) ws1.getCell(row, col).border = BORDER;
  }

  // --- Sheet 2: Tổng hợp theo tháng ---
  const ws2 = wb.addWorksheet('Tổng hợp theo tháng');
  setup(ws2, [24, 20, ...Array.from({ length: 12 }, () => 10), 13]);
  ws2.mergeCells(`A1:O1`);
  put(ws2, 'A1', `${title} — Năm ${data.year} (tổng hợp theo tháng)`, { bold: true, align: 'center', size: 13 });
  put(ws2, 'A2', 'Nhân viên', { bold: true, align: 'center' });
  put(ws2, 'B2', 'Đơn vị', { bold: true, align: 'center' });
  for (let m = 1; m <= 12; m++) put(ws2, `${ws2.getColumn(2 + m).letter}2`, `Tháng ${m}`, { bold: true, align: 'center' });
  put(ws2, 'O2', 'Tổng', { bold: true, align: 'center' });

  let r2 = 3;
  for (const row of data.summary.rows) {
    put(ws2, `A${r2}`, row.name);
    put(ws2, `B${r2}`, row.unit_name ?? '—');
    row.totals.forEach((v, i) => put(ws2, `${ws2.getColumn(3 + i).letter}${r2}`, v, { align: 'right', numFmt: '#,##0' }));
    put(ws2, `O${r2}`, row.total, { bold: true, align: 'right', numFmt: '#,##0' });
    r2++;
  }
  put(ws2, `A${r2}`, 'TỔNG CỘNG', { bold: true });
  for (let i = 0; i < 12; i++) {
    const col = 3 + i;
    const sum = data.summary.rows.reduce((a, row) => a + (Number(row.totals[i]) || 0), 0);
    put(ws2, `${ws2.getColumn(col).letter}${r2}`, sum, { bold: true, align: 'right', numFmt: '#,##0' });
  }
  put(ws2, `O${r2}`, data.summary.rows.reduce((a, row) => a + row.total, 0), { bold: true, align: 'right', numFmt: '#,##0' });
  for (let row = 2; row <= r2; row++) {
    for (let col = 1; col <= 15; col++) ws2.getCell(row, col).border = BORDER;
  }

  return wb.xlsx.writeBuffer();
}

export function reportsRouter(): Router {
  const router = Router();
  const db = getDb();

  // Khoảng ngày của báo cáo: ưu tiên tham số from/to từ client, thiếu thì lấy kỳ báo cáo hiện tại.
  const periodRange = (q: Record<string, string | undefined>): { from: string; to: string } => {
    const period = currentReportPeriod(db);
    return { from: q.from || period.from, to: q.to || period.to };
  };

  // Phân giải kỳ từ query: nếu có month=YYYY-MM thì lấy đúng tháng đó (xem kỳ cũ / xuất Excel),
  // còn lại ưu tiên from/to rồi mới tới kỳ hiện tại.
  const resolveReportPeriod = (q: Record<string, string | undefined>): { from: string; to: string } => {
    const month = String(q.month || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
    }
    return periodRange(q);
  };

  // Doanh thu hợp nhất mặc định gồm đơn bán và đơn mượn hàng đối tác về bán.
  // Doanh thu lấy theo dòng hàng thực tế của đơn (khớp với màn Doanh thu, không dùng giá chuẩn).
  // Trước thuế suy ngược theo quy tắc đã chốt: làm tròn đơn giá chưa thuế đến đồng rồi mới nhân SL.
  const computeTradeBlock = (from: string, to: string, includeBorrowed: boolean, scope?: string): { rate: number; block: TradeBlock } => {
    const rate = vatRateAt(db, to);
    const factor = 1 + rate / 100;
    const rows = db
      .prepare(
        `SELECT p.id, p.code, p.name, p.standard_price as list_price,
                COALESCE(s.quantity, 0) as quantity,
                COALESCE(s.amount_gross, 0) as amount_gross,
                COALESCE(s.amount_net, 0) as amount_net
         FROM products p
         LEFT JOIN (
           SELECT oi.product_id,
                  SUM(oi.quantity) as quantity,
                  SUM(oi.quantity * oi.unit_price) as amount_gross,
                  SUM(oi.quantity * ROUND(oi.unit_price / ?)) as amount_net
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE o.order_status = 'COMPLETED' AND o.order_type IN (${includeBorrowed ? "'SALE', 'BORROW_IN'" : "'SALE'"})
             AND o.invoice_status = 'INVOICED'
             AND o.order_date >= ? AND o.order_date <= ?
             ${scope ? "AND COALESCE(o.target_scope, 'ENTERPRISE') = ?" : ''}
           GROUP BY oi.product_id
         ) s ON s.product_id = p.id
         WHERE p.product_type = ?
         ORDER BY p.id`
      )
      .all(factor, from, to, ...(scope ? [scope] : []), REPORT_PRODUCT_TYPE) as {
      id: number;
      code: string;
      name: string;
      list_price: number;
      quantity: number;
      amount_gross: number;
      amount_net: number;
    }[];

    const items: TradeItem[] = rows.map((r) => {
      const quantity = Number(r.quantity) || 0;
      const amountGross = Number(r.amount_gross) || 0;
      const amountNet = Number(r.amount_net) || 0;
      const listPrice = Number(r.list_price) || 0;
      // Chưa bán: hiển thị giá chuẩn làm tham chiếu; đã bán: đơn giá bình quân thực tế.
      const unitPrice = quantity ? Math.round(amountGross / quantity) : listPrice;
      const netUnitPrice = quantity ? Math.round(amountNet / quantity) : Math.round(listPrice / factor);
      return {
        key: r.code,
        label: r.name,
        quantity,
        unit_price: unitPrice,
        net_unit_price: netUnitPrice,
        amount_gross: amountGross,
        amount_net: amountNet,
        tax_amount: amountGross - amountNet,
      };
    });

    const totals = items.reduce(
      (a, r) => ({
        quantity: a.quantity + r.quantity,
        amount_gross: a.amount_gross + r.amount_gross,
        amount_net: a.amount_net + r.amount_net,
        tax_amount: a.tax_amount + r.tax_amount,
      }),
      { quantity: 0, amount_gross: 0, amount_net: 0, tax_amount: 0 }
    );
    return { rate, block: { items, totals } };
  };

  const tradeReportData = (from: string, to: string, includeBorrowed = true): TradeReportData => {
    const year = to.slice(0, 4);
    const current = computeTradeBlock(from, to, includeBorrowed);
    const cumulative = computeTradeBlock(`${year}-01-01`, to, includeBorrowed);
    // Tách doanh thu theo nguồn khách; "Tổng" vẫn là tổng của cả hai nguồn (doanh thu của xí nghiệp).
    const sourcesOf = (start: string, end: string): TradeSourceBlock[] =>
      TRADE_SOURCES.map((source) => ({ key: source.key, label: source.label, block: computeTradeBlock(start, end, includeBorrowed, source.key).block }));
    return {
      from,
      to,
      label: `${from} → ${to}`,
      vatRate: current.rate,
      includeBorrowed,
      current: current.block,
      cumulative: cumulative.block,
      sources: { current: sourcesOf(from, to), cumulative: sourcesOf(`${year}-01-01`, to) },
    };
  };

  // ===== BÁO CÁO DOANH THU (4 báo cáo dùng chung bộ lọc ngày) =====
  // 1) Doanh thu xí nghiệp: hàng xuất từ kho của xí nghiệp (đơn bán).
  // 2) Doanh thu xí nghiệp chi tiết: cắt theo kho xuất / đơn vị (trạm) / nhân viên / khách / sản phẩm.
  // 3) Doanh thu đơn hàng đi mượn: hàng mượn của đối tác nào, bán được bao nhiêu.
  // 4) Doanh thu gộp: xí nghiệp + hàng đi mượn của đối tác về bán.
  // Doanh thu = tiền hàng của đơn đã hoàn thành nghĩa vụ (kể cả đơn đã ghi nhận HÀNG HOÀN);
  // hàng hoàn trừ theo kỳ phát sinh hoàn. Phí vận chuyển là tiền công trả nhân viên giao hàng nên tách khỏi doanh thu.
  interface EnterpriseDetailRow {
    order_code: string;
    order_date: string;
    customer_name: string;
    seller_name: string | null;
    warehouse_name: string | null;
    subtotal_amount: number;
    returned_value: number;
    shipping_fee: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    payment_status: string;
    invoice_status: string;
  }
  interface EnterpriseReturnRow {
    ticket_date: string;
    ticket_code: string;
    order_code: string;
    customer_name: string | null;
    seller_name: string | null;
    product_name: string;
    quantity: number;
    quantity_promo: number;
    unit_price: number;
    return_value: number;
  }

  const revenueEnterpriseData = (from?: string, to?: string) => {
    // Doanh thu gộp = giá trị đơn hàng đã bán, tính cả đơn đã ghi nhận HÀNG HOÀN (đơn vẫn hoàn thành nghĩa vụ).
    // Hàng hoàn trừ riêng phần đã trả lại, ghi vào kỳ phát sinh hoàn — KPI/chỉ tiêu không bị ảnh hưởng.
    const clauses: string[] = ["o.order_status IN ('COMPLETED', 'RETURNED')", "o.order_type = 'SALE'", "o.invoice_status = 'INVOICED'"];
    const params: unknown[] = [];
    if (from) {
      clauses.push('o.order_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('o.order_date <= ?');
      params.push(to);
    }
    const where = `WHERE ${clauses.join(' AND ')}`;

    // Hàng hoàn: nguồn duy nhất là phiếu nhập "Hàng hoàn" của đơn, giá trị lấy theo đúng giá đã bán.
    const returnClauses: string[] = ["t.reason = 'ORDER_RETURN'", "t.status = 'CONFIRMED'", "o.order_type = 'SALE'", "o.invoice_status = 'INVOICED'"];
    const returnParams: unknown[] = [];
    if (from) {
      returnClauses.push('t.ticket_date >= ?');
      returnParams.push(from);
    }
    if (to) {
      returnClauses.push('t.ticket_date <= ?');
      returnParams.push(to);
    }
    const returnWhere = returnClauses.join(' AND ');
    const returnJoin = `FROM stock_ticket_items ti
         JOIN stock_tickets t ON t.id = ti.ticket_id
         JOIN order_items oi ON oi.id = ti.order_item_id
         JOIN orders o ON o.id = t.order_id
         JOIN order_returns r ON r.ticket_id = t.id`;
    const returnLineValue = `(CASE WHEN (SELECT SUM(ti2.quantity * oi2.unit_price)
      FROM stock_ticket_items ti2 JOIN order_items oi2 ON oi2.id = ti2.order_item_id
      WHERE ti2.ticket_id = t.id) > 0
      THEN (r.returned_amount + o.discount_amount) * ti.quantity * oi.unit_price /
        (SELECT SUM(ti2.quantity * oi2.unit_price) FROM stock_ticket_items ti2
         JOIN order_items oi2 ON oi2.id = ti2.order_item_id WHERE ti2.ticket_id = t.id)
      ELSE 0 END)`;
    const returnValue = `COALESCE(SUM(${returnLineValue}),0)`;

    // Trạng thái thanh toán của cả nhóm: đủ tiền -> PAID, thu một phần -> PARTIAL, chưa thu -> UNPAID.
    const paymentMetrics = `COALESCE(SUM(o.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM order_returns r WHERE r.order_id = o.id), 0)),0) as paid_amount,
                CASE
                  WHEN COALESCE(SUM(o.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM order_returns r WHERE r.order_id = o.id), 0)),0) >= COALESCE(SUM(o.total_amount -
                    COALESCE((SELECT SUM(r.returned_amount) FROM order_returns r WHERE r.order_id = o.id),0)),0) THEN 'PAID'
                  WHEN COALESCE(SUM(o.paid_amount - COALESCE((SELECT SUM(r.refund_amount) FROM order_returns r WHERE r.order_id = o.id), 0)),0) > 0 THEN 'PARTIAL'
                  ELSE 'UNPAID'
                END as payment_status`;

    const summaryRow = db
      .prepare(
        `SELECT COALESCE(SUM(o.subtotal_amount),0) as totalRevenue,
                COUNT(*) as orderCount,
                COALESCE(SUM(o.shipping_fee),0) as totalShipping,
                COALESCE(SUM(o.total_amount),0) as totalWithShipping
         FROM orders o ${where}`
      )
      .get(...params) as { totalRevenue: number; orderCount: number; totalShipping: number; totalWithShipping: number };
    const returnedTotal = Number(
      (db.prepare(`SELECT ${returnValue} as totalReturned ${returnJoin} WHERE ${returnWhere}`).get(...returnParams) as {
        totalReturned: number;
      }).totalReturned
    ) || 0;
    const summary = {
      ...summaryRow,
      totalReturned: returnedTotal,
      netRevenue: (Number(summaryRow.totalRevenue) || 0) - returnedTotal,
    };

    interface ReturnGroup {
      name?: string;
      product_id?: number;
      date?: string;
      month?: string;
      returned: number;
    }
    interface GroupRow {
      quantity?: number;
      name?: string;
      product_id?: number;
      date?: string;
      month?: string;
      revenue: number;
      orders: number;
      paid_amount: number;
      payment_status: string;
      returned?: number;
    }
    const groupKey = (row: ReturnGroup | GroupRow) => String(row.name ?? row.product_id ?? row.date ?? row.month);
    // Trừ hàng hoàn vào từng cách xem; nhóm chỉ có hàng hoàn (không có đơn bán trong kỳ) vẫn hiện đủ.
    const mergeReturnRows = (rows: GroupRow[], returns: ReturnGroup[]) => {
      const map = new Map(rows.map((row) => [groupKey(row), row]));
      for (const item of returns) {
        const existing = map.get(groupKey(item));
        if (existing) {
          existing.returned = (existing.returned ?? 0) + item.returned;
          existing.revenue -= item.returned;
        } else {
          const row: GroupRow = {
            name: item.name,
            product_id: item.product_id,
            date: item.date,
            month: item.month,
            revenue: -item.returned,
            orders: 0,
            paid_amount: 0,
            payment_status: 'UNPAID',
            returned: item.returned,
          };
          rows.push(row);
          map.set(groupKey(row), row);
        }
      }
      return rows;
    };

    const bySeller = mergeReturnRows(
      db
        .prepare(
          `SELECT e.full_name as name, COALESCE(SUM(o.subtotal_amount),0) as revenue, COUNT(*) as orders, ${paymentMetrics}
           FROM orders o JOIN employees e ON o.seller_employee_id = e.id
           ${where} GROUP BY o.seller_employee_id ORDER BY revenue DESC`
        )
        .all(...params) as (GroupRow & { quantity: number })[],
      db
        .prepare(
          `SELECT COALESCE(e.full_name, 'Không xác định') as name, ${returnValue} as returned
           ${returnJoin} LEFT JOIN employees e ON e.id = o.seller_employee_id
           WHERE ${returnWhere} GROUP BY o.seller_employee_id`
        )
        .all(...returnParams) as ReturnGroup[]
    );

    const byCustomer = mergeReturnRows(
      db
        .prepare(
          `SELECT c.name as name, COALESCE(SUM(o.subtotal_amount),0) as revenue, COUNT(*) as orders, ${paymentMetrics}
           FROM orders o JOIN customers c ON o.customer_id = c.id
           ${where} GROUP BY o.customer_id ORDER BY revenue DESC LIMIT 50`
        )
        .all(...params) as (GroupRow & { quantity: number })[],
      db
        .prepare(
          `SELECT COALESCE(c.name, 'Không xác định') as name, ${returnValue} as returned
           ${returnJoin} LEFT JOIN customers c ON c.id = o.customer_id
           WHERE ${returnWhere} GROUP BY o.customer_id`
        )
        .all(...returnParams) as ReturnGroup[]
    );

    const byProduct = mergeReturnRows(
      db
        .prepare(
          `SELECT p.id as product_id, p.name as name, COALESCE(SUM(oi.quantity),0) as quantity, COALESCE(SUM(oi.total_price),0) as revenue
           FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id
           ${where} GROUP BY oi.product_id ORDER BY revenue DESC`
        )
        .all(...params) as (GroupRow & { quantity: number })[],
      db
        .prepare(
          `SELECT ti.product_id as product_id, ${returnValue} as returned
           ${returnJoin} JOIN products p ON p.id = ti.product_id
           WHERE ${returnWhere} GROUP BY ti.product_id`
        )
        .all(...returnParams) as ReturnGroup[]
    );

    const byDay = mergeReturnRows(
      db
        .prepare(
          `SELECT o.order_date as date, COALESCE(SUM(o.subtotal_amount),0) as revenue, COUNT(*) as orders, ${paymentMetrics}
           FROM orders o ${where} GROUP BY o.order_date ORDER BY o.order_date`
        )
        .all(...params) as (GroupRow & { quantity: number })[],
      db
        .prepare(`SELECT t.ticket_date as date, ${returnValue} as returned ${returnJoin} WHERE ${returnWhere} GROUP BY t.ticket_date`)
        .all(...returnParams) as ReturnGroup[]
    );

    const byMonth = mergeReturnRows(
      db
        .prepare(
          `SELECT strftime('%Y-%m', o.order_date) as month, COALESCE(SUM(o.subtotal_amount),0) as revenue, COUNT(*) as orders, ${paymentMetrics}
           FROM orders o ${where} GROUP BY month ORDER BY month`
        )
        .all(...params) as (GroupRow & { quantity: number })[],
      db
        .prepare(
          `SELECT strftime('%Y-%m', t.ticket_date) as month, ${returnValue} as returned ${returnJoin} WHERE ${returnWhere} GROUP BY month`
        )
        .all(...returnParams) as ReturnGroup[]
    );

    // Sổ chi tiết: từng đơn hàng đã hoàn tất tạo ra doanh thu (kèm phần đã hoàn của đơn).
    // Giới hạn chỉ là hàng rào an toàn cho bảng lớn; đủ xa để tệp Excel không bao giờ bị cắt cụt
    // (tổng vẫn tính trọn kỳ nên nếu cắt, tổng và chi tiết sẽ lệch nhau).
    const detailLimit = 5000;
    const detailCount = (db.prepare(`SELECT COUNT(*) as c FROM orders o ${where}`).get(...params) as { c: number }).c;
    const orderDetail = db
      .prepare(
        `SELECT o.id, o.order_code, o.order_date, o.order_type, o.order_status,
                c.name as customer_name,
                e.full_name as seller_name,
                w.name as warehouse_name,
                o.subtotal_amount, o.shipping_fee, o.discount_amount, o.total_amount,
                o.paid_amount, o.payment_status, o.payment_method, o.invoice_status,
                (SELECT group_concat(oi.product_id) FROM order_items oi WHERE oi.order_id = o.id) as product_ids,
                COALESCE((SELECT SUM(r.returned_amount) FROM order_returns r WHERE r.order_id = o.id), 0) as returned_value
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         LEFT JOIN employees e ON o.seller_employee_id = e.id
         LEFT JOIN warehouses w ON o.warehouse_id = w.id
         ${where}
         ORDER BY o.order_date DESC, o.id DESC
         LIMIT ${detailLimit}`
      )
      .all(...params) as EnterpriseDetailRow[];

    // Tiền công bốc xếp thực thu; đơn cho mượn chỉ ghi nợ hàng, không có doanh thu.
    // — lấy thẳng từ sổ thu để khớp với các phiếu thu đã ghi.
    const serviceClauses: string[] = ["o.order_type = 'HIRED_LOAD'"];
    const serviceParams: unknown[] = [];
    if (from) {
      serviceClauses.push('r.transaction_date >= ?');
      serviceParams.push(from);
    }
    if (to) {
      serviceClauses.push('r.transaction_date <= ?');
      serviceParams.push(to);
    }
    const serviceRevenue = db
      .prepare(
        `SELECT COALESCE(SUM(r.amount),0) as amount, COUNT(DISTINCT o.id) as orders
         FROM revenue_transactions r JOIN orders o ON o.id = r.order_id
         WHERE ${serviceClauses.join(' AND ')}`
      )
      .get(...serviceParams);

    // Chi tiết hàng hoàn trong kỳ: mỗi dòng là một mặt hàng khách đã trả lại.
    const returnRows = db
      .prepare(
        `SELECT t.code as ticket_code, t.ticket_date, t.id as ticket_id,
                o.id as order_id, o.order_code, c.name as customer_name, e.full_name as seller_name,
                p.name as product_name, p.unit, ti.quantity, ti.quantity_promo, oi.unit_price,
                ${returnLineValue} as return_value
         ${returnJoin}
         JOIN products p ON p.id = ti.product_id
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN employees e ON e.id = o.seller_employee_id
         WHERE ${returnWhere}
         ORDER BY t.ticket_date DESC, t.id DESC, ti.id ASC`
      )
      .all(...returnParams) as EnterpriseReturnRow[];

    return {
      summary,
      serviceRevenue,
      bySeller,
      byCustomer,
      byProduct,
      byDay,
      byMonth,
      orderDetail,
      returnRows,
      detailCount,
      detailLimit,
    };
  };

  router.get(
    '/reports/revenue',
    handle((req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);
      res.json(revenueEnterpriseData(from, to));
    })
  );

  // --- Dùng chung cho 3 báo cáo còn lại ---
  interface RevenueScope {
    where: string;
    params: unknown[];
  }
  const orderScope = (types: string[], from?: string, to?: string): RevenueScope => {
    const clauses = [`o.order_status IN ('COMPLETED', 'RETURNED')`, `o.order_type IN (${types.map((t) => `'${t}'`).join(',')})`, `o.invoice_status = 'INVOICED'`];
    const params: unknown[] = [];
    if (from) {
      clauses.push('o.order_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('o.order_date <= ?');
      params.push(to);
    }
    return { where: `WHERE ${clauses.join(' AND ')}`, params };
  };
  // Hàng hoàn tính theo NGÀY HOÀN (không theo ngày bán), đúng nhóm loại đơn đang xem.
  const returnScope = (types: string[], from?: string, to?: string) => {
    const clauses = [`o.order_type IN (${types.map((t) => `'${t}'`).join(',')})`, `o.invoice_status = 'INVOICED'`];
    const params: unknown[] = [];
    if (from) {
      clauses.push('r.return_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('r.return_date <= ?');
      params.push(to);
    }
    return { where: clauses.join(' AND '), params };
  };
  const RETURN_JOIN = `FROM order_returns r JOIN orders o ON o.id = r.order_id`;
  // Giá trị hoàn tính theo giá BÁN (đã trừ giảm giá của đơn) — cộng lại discount để khớp doanh thu gộp,
  // nếu không đơn hoàn toàn bộ có giảm giá sẽ để lại phần doanh thu ảo đúng bằng mức giảm giá.
  const RETURN_VALUE = `COALESCE(SUM(r.returned_amount + o.discount_amount),0)`;

  interface RevenueGroupRow {
    key: string | number;
    name: string;
    group_type?: string | null;
    parent_key?: number | null;
    orders: number;
    quantity: number;
    promo: number;
    revenue: number;
    returned: number;
    net: number;
    children?: RevenueGroupRow[];
  }

  // Trừ hàng hoàn vào từng nhóm; nhóm chỉ có hàng hoàn (không có đơn bán trong kỳ) vẫn hiện đủ dòng.
  const applyReturns = (
    rows: Omit<RevenueGroupRow, 'returned' | 'net'>[],
    returns: { key: string | number; returned: number }[]
  ): RevenueGroupRow[] => {
    const map = new Map(rows.map((r) => [String(r.key), r]));
    for (const item of returns) {
      const found = map.get(String(item.key));
      if (found) found.revenue += 0;
      else {
        const row = { key: item.key, name: String(item.key), orders: 0, quantity: 0, promo: 0, revenue: 0 };
        rows.push(row);
        map.set(String(item.key), row);
      }
    }
    const returnedByKey = new Map(returns.map((r) => [String(r.key), Number(r.returned) || 0]));
    return rows.map((r) => {
      const returned = returnedByKey.get(String(r.key)) ?? 0;
      return { ...r, returned, net: Number(r.revenue) - returned };
    });
  };

  // --- Báo cáo 2: doanh thu xí nghiệp chi tiết — chỉ 2 cách nhóm: kho xuất hàng / đơn vị của nhân viên bán ---
  const DETAIL_GROUPS: Record<string, { label: string; orderKey: string; orderName: string; orderJoin: string; retKey: string; retJoin: string }> = {
    warehouse: {
      label: 'Kho xuất hàng',
      orderKey: 'o.warehouse_id',
      orderName: `COALESCE(w.name, '(không rõ kho)')`,
      orderJoin: 'LEFT JOIN warehouses w ON w.id = o.warehouse_id',
      retKey: 'o.warehouse_id',
      retJoin: 'LEFT JOIN warehouses w ON w.id = o.warehouse_id',
    },
    unit: {
      label: 'Đơn vị (trạm) của nhân viên bán',
      orderKey: 'e.org_unit_id',
      orderName: `COALESCE(ou.name, '(chưa gắn đơn vị)')`,
      orderJoin: 'LEFT JOIN employees e ON e.id = o.seller_employee_id LEFT JOIN org_units ou ON ou.id = e.org_unit_id',
      retKey: 'e.org_unit_id',
      retJoin: 'LEFT JOIN employees e ON e.id = o.seller_employee_id LEFT JOIN org_units ou ON ou.id = e.org_unit_id',
    },
  };

  const revenueDetailData = (from?: string, to?: string, group = 'warehouse') => {
    const scope = orderScope(['SALE'], from, to);
    const hs = returnScope(['SALE'], from, to);
    const quantityExpr = `(SELECT COALESCE(SUM(oi2.quantity),0) FROM order_items oi2 WHERE oi2.order_id = o.id)`;
    const promoExpr = `(SELECT COALESCE(SUM(oi2.quantity_promo),0) FROM order_items oi2 WHERE oi2.order_id = o.id)`;

    const buildRows = (keyExpr: string, nameExpr: string, join: string, groupBy: string, groupTypeExpr?: string) =>
      db
        .prepare(
          `SELECT ${keyExpr} as key, ${nameExpr} as name, ${groupTypeExpr ? `${groupTypeExpr} as group_type,` : ''}
                  COUNT(*) as orders,
                  COALESCE(SUM(${quantityExpr}),0) as quantity,
                  COALESCE(SUM(${promoExpr}),0) as promo,
                  COALESCE(SUM(o.subtotal_amount),0) as revenue
           FROM orders o ${join} ${scope.where} GROUP BY ${groupBy}`
        )
        .all(...scope.params) as Omit<RevenueGroupRow, 'returned' | 'net'>[];

    const buildReturns = (keyExpr: string, join: string, groupBy: string) =>
      db
        .prepare(`SELECT ${keyExpr} as key, ${RETURN_VALUE} as returned ${RETURN_JOIN} ${join} WHERE ${hs.where} GROUP BY ${groupBy}`)
        .all(...hs.params) as { key: string | number; returned: number }[];

    const sumTotals = (rows: RevenueGroupRow[]) =>
      rows.reduce(
        (a, r) => ({
          orders: a.orders + Number(r.orders),
          quantity: a.quantity + Number(r.quantity),
          promo: a.promo + Number(r.promo),
          revenue: a.revenue + Number(r.revenue),
          returned: a.returned + Number(r.returned),
          net: a.net + Number(r.net),
        }),
        { orders: 0, quantity: 0, promo: 0, revenue: 0, returned: 0, net: 0 }
      );

    const cfg = DETAIL_GROUPS[group] ?? DETAIL_GROUPS.warehouse;
    const groupType = group === 'unit' ? 'ou.unit_type' : 'w.type';
    const rows = buildRows(cfg.orderKey, cfg.orderName, cfg.orderJoin, cfg.orderKey, groupType);
    const returns = buildReturns(cfg.retKey, cfg.retJoin, cfg.retKey);

    // Báo cáo trạm: kèm chi tiết từng nhân viên (doanh thu nhân viên cộng lại = doanh thu trạm).
    let children: RevenueGroupRow[] = [];
    if (group === 'unit') {
      const childRows = db
        .prepare(
          `SELECT o.seller_employee_id as key, COALESCE(e.full_name, '(không rõ nhân viên)') as name, e.org_unit_id as parent_key,
                  COUNT(*) as orders,
                  COALESCE(SUM(${quantityExpr}),0) as quantity,
                  COALESCE(SUM(${promoExpr}),0) as promo,
                  COALESCE(SUM(o.subtotal_amount),0) as revenue
           FROM orders o LEFT JOIN employees e ON e.id = o.seller_employee_id ${scope.where}
           GROUP BY o.seller_employee_id`
        )
        .all(...scope.params) as Omit<RevenueGroupRow, 'returned' | 'net'>[];
      const childReturns = buildReturns('o.seller_employee_id', 'LEFT JOIN employees e ON e.id = o.seller_employee_id', 'o.seller_employee_id');
      children = applyReturns(childRows, childReturns);
    }

    const merged = applyReturns(rows, returns).sort((a, b) => b.net - a.net);
    for (const row of merged) {
      const kids = children.filter((c) => String(c.parent_key ?? '') === String(row.key));
      row.children = kids.length ? kids : undefined;
    }
    const totals = sumTotals(merged);
    return { group, label: cfg.label, rows: merged, totals };
  };

  // --- Báo cáo 3: doanh thu đơn hàng đi mượn (mượn hàng của đối tác nào, bán được bao nhiêu) ---
  const revenueBorrowedData = (from?: string, to?: string) => {
    const scope = orderScope(['BORROW_IN'], from, to);
    interface BorrowOrderRow {
      id: number;
      order_code: string;
      order_date: string;
      order_status: string;
      subtotal_amount: number;
      paid_amount: number;
      payment_status: string;
      partner_unit_id: number | null;
      partner_name: string | null;
      partner_phone: string | null;
      warehouse_name: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      seller_name: string | null;
      items: { product_name: string; unit: string | null; quantity: number; quantity_promo: number; unit_price: number; total_price: number }[];
      loan_status: string;
      due_date: string | null;
      overdue_days: number;
      goods_value: number;
      settled_value: number;
      outstanding_value: number;
    }
    const rawOrders = db
      .prepare(
        `SELECT o.*, pu.name as partner_name, pu.phone as partner_phone, w.name as warehouse_name,
                c.name as customer_name, c.phone as customer_phone, e.full_name as seller_name
         FROM orders o
         LEFT JOIN partner_units pu ON pu.id = o.partner_unit_id
         LEFT JOIN warehouses w ON w.id = o.warehouse_id
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN employees e ON e.id = o.seller_employee_id
         ${scope.where}
         ORDER BY o.order_date DESC, o.id DESC`
      )
      .all(...scope.params) as Omit<BorrowOrderRow, 'items' | 'loan_status' | 'due_date' | 'overdue_days' | 'goods_value' | 'settled_value' | 'outstanding_value'>[];

    const itemRows = db
      .prepare(
        `SELECT oi.order_id, p.name as product_name, p.unit, oi.quantity, oi.quantity_promo, oi.unit_price, oi.total_price
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
         ${scope.where} ORDER BY oi.order_id, oi.id`
      )
      .all(...scope.params) as { order_id: number; product_name: string; unit: string | null; quantity: number; quantity_promo: number; unit_price: number; total_price: number }[];

    // Trạng thái mượn / còn nợ lấy từ chính module mượn - trả để hai màn hình luôn khớp nhau.
    const rows: BorrowOrderRow[] = rawOrders.map((o) => {
      const state = loanState(db, o as unknown as Parameters<typeof loanState>[1]);
      return {
        ...o,
        items: itemRows.filter((it) => it.order_id === o.id),
        loan_status: state.status,
        due_date: state.dueDate,
        overdue_days: state.overdueDays,
        goods_value: state.goodsValue,
        settled_value: state.returnedUnits,
        outstanding_value: state.remainingUnits,
      };
    });

    interface PartnerAgg {
      name: string;
      partner_id: number | null;
      orders: number;
      quantity: number;
      revenue: number;
      settled_value: number;
      outstanding_value: number;
      loan_orders: number;
      overdue_orders: number;
    }
    const byPartnerMap = new Map<string, PartnerAgg>();
    for (const r of rows) {
      const key = (r.partner_name as string) ?? '(chưa gắn đối tác)';
      const agg =
        byPartnerMap.get(key) ??
        ({
          name: key,
          partner_id: (r.partner_unit_id as number) ?? null,
          orders: 0,
          quantity: 0,
          revenue: 0,
          settled_value: 0,
          outstanding_value: 0,
          loan_orders: 0,
          overdue_orders: 0,
        } as PartnerAgg);
      agg.orders += 1;
      agg.quantity += r.items.reduce((a, it) => a + Number(it.quantity) + Number(it.quantity_promo), 0);
      agg.revenue += Number(r.subtotal_amount) || 0;
      agg.settled_value += Number(r.settled_value) || 0;
      agg.outstanding_value += Number(r.outstanding_value) || 0;
      if (r.loan_status !== 'SETTLED') agg.loan_orders += 1;
      if (Number(r.overdue_days) > 0) agg.overdue_orders += 1;
      byPartnerMap.set(key, agg);
    }
    const byPartner = [...byPartnerMap.values()].sort((a, b) => b.revenue - a.revenue);
    const totals = rows.reduce(
      (a, r) => ({
        orders: a.orders + 1,
        quantity: a.quantity + r.items.reduce((s, it) => s + Number(it.quantity) + Number(it.quantity_promo), 0),
        revenue: a.revenue + (Number(r.subtotal_amount) || 0),
        settled_value: a.settled_value + (Number(r.settled_value) || 0),
        outstanding_value: a.outstanding_value + (Number(r.outstanding_value) || 0),
        overdue_orders: a.overdue_orders + (Number(r.overdue_days) > 0 ? 1 : 0),
      }),
      { orders: 0, quantity: 0, revenue: 0, settled_value: 0, outstanding_value: 0, overdue_orders: 0 }
    );
    return { rows, byPartner, totals };
  };

  // --- Báo cáo 4: doanh thu gộp — chỉ gồm doanh thu bán hàng: hàng xuất từ kho xí nghiệp và hàng đi mượn
  // của đối tác về bán. Hàng cho đối tác mượn là CÔNG NỢ phải thu (không phải bán); tiền công vận chuyển và
  // tiền công bốc xếp là tiền công trả nhân viên (xí nghiệp giữ lại trả lương) — tách riêng ở "ngoài doanh thu". ---
  const revenueGrossData = (from?: string, to?: string) => {
    const hs = returnScope(['SALE'], from, to);
    const entReturned = Number(
      (db.prepare(`SELECT ${RETURN_VALUE} as total ${RETURN_JOIN} WHERE ${hs.where}`).get(...hs.params) as { total: number }).total
    ) || 0;
    const borrowedScope = returnScope(['BORROW_IN'], from, to);
    const borrowedReturned = Number(
      (db.prepare(`SELECT ${RETURN_VALUE} as total ${RETURN_JOIN} WHERE ${borrowedScope.where}`).get(...borrowedScope.params) as { total: number }).total
    ) || 0;

    const aggBlock = (types: string[], valueExpr = 'o.subtotal_amount') => {
      const scope = orderScope(types, from, to);
      const row = db
        .prepare(
          `SELECT COUNT(*) as orders, COALESCE(SUM(${valueExpr}),0) as value, COALESCE(SUM(o.shipping_fee),0) as shipping
           FROM orders o ${scope.where}`
        )
        .get(...scope.params) as { orders: number; value: number; shipping: number };
      return { scope, orders: Number(row.orders) || 0, value: Number(row.value) || 0, shipping: Number(row.shipping) || 0 };
    };
    const groupBlock = (scope: RevenueScope, keyExpr: string, nameExpr: string, join: string, groupBy: string, valueExpr = 'o.subtotal_amount') =>
      db
        .prepare(
          `SELECT ${nameExpr} as name, COUNT(*) as orders, COALESCE(SUM(${valueExpr}),0) as value
           FROM orders o ${join} ${scope.where} GROUP BY ${groupBy} ORDER BY value DESC`
        )
        .all(...scope.params) as { name: string; orders: number; value: number }[];

    const enterprise = aggBlock(['SALE']);
    const borrowed = aggBlock(['BORROW_IN']);
    const lent = aggBlock(['LEND_OUT']);
    const service = aggBlock(['HIRED_LOAD'], 'o.total_amount');

    const warehouseJoin = 'LEFT JOIN warehouses w ON w.id = o.warehouse_id';
    const partnerJoin = 'LEFT JOIN partner_units pu ON pu.id = o.partner_unit_id';
    const blocks = [
      {
        key: 'enterprise',
        name: 'Doanh thu xí nghiệp (hàng xuất từ kho xí nghiệp)',
        owner: 'Xí nghiệp',
        orders: enterprise.orders,
        value: enterprise.value,
        returned: entReturned,
        net: enterprise.value - entReturned,
        byGroup: groupBlock(enterprise.scope, 'o.warehouse_id', `COALESCE(w.name, '(không rõ kho)')`, warehouseJoin, 'o.warehouse_id'),
      },
      {
        key: 'borrowed',
        name: 'Hàng đi mượn (bán hàng mượn của đối tác)',
        owner: 'Xí nghiệp (hàng mượn đối tác)',
        orders: borrowed.orders,
        value: borrowed.value,
        returned: borrowedReturned,
        net: borrowed.value - borrowedReturned,
        byGroup: groupBlock(borrowed.scope, 'o.partner_unit_id', `COALESCE(pu.name, '(chưa gắn đối tác)')`, partnerJoin, 'o.partner_unit_id'),
      },
    ];
    const total = blocks.reduce((a, b) => a + b.net, 0);

    // Tiền đã thu trong kỳ của một nhóm đơn (theo ngày phiếu thu, không theo ngày đơn).
    const collectedIn = (types: string[]) => {
      const clauses = [`o.order_type IN (${types.map((t) => `'${t}'`).join(',')})`];
      const params: unknown[] = [];
      if (from) {
        clauses.push('r.transaction_date >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('r.transaction_date <= ?');
        params.push(to);
      }
      const row = db
        .prepare(`SELECT COALESCE(SUM(r.amount),0) as amount FROM revenue_transactions r JOIN orders o ON o.id = r.order_id WHERE ${clauses.join(' AND ')}`)
        .get(...params) as { amount: number };
      return Number(row.amount) || 0;
    };

    // Hàng đối tác đã trả lại trong kỳ — mượn hàng chỉ tất toán bằng hàng nên công nợ chỉ giảm theo hàng trả về.
    const lentReturned = (() => {
      const clauses = ["ls.settle_type = 'RETURN_GOODS'", "o.order_type = 'LEND_OUT'"];
      const params: unknown[] = [];
      if (from) {
        clauses.push('ls.settle_date >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('ls.settle_date <= ?');
        params.push(to);
      }
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(ls.settled_value),0) as value FROM loan_settlements ls
           JOIN orders o ON o.id = ls.order_id WHERE ${clauses.join(' AND ')}`
        )
        .get(...params) as { value: number };
      return Number(row.value) || 0;
    })();

    return {
      blocks,
      total,
      shippingCollected: enterprise.shipping + borrowed.shipping + lent.shipping,
      // Phí bốc xếp/giao hàng tách khỏi doanh thu bán hàng hóa.
      serviceFee: { orders: service.orders, value: service.value, collected: collectedIn(['HIRED_LOAD']) },
      // Hàng cho đối tác mượn: công nợ phải thu, không phải doanh thu (chỉ giảm khi đối tác trả hàng).
      lent: {
        orders: lent.orders,
        value: lent.value,
        returned: lentReturned,
        byGroup: groupBlock(lent.scope, 'o.partner_unit_id', `COALESCE(pu.name, '(chưa gắn đối tác)')`, partnerJoin, 'o.partner_unit_id'),
      },
    };
  };

  router.get(
    '/reports/revenue-detail',
    handle((req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const { from, to } = periodRange(q);
      res.json({ from, to, ...revenueDetailData(from, to, q.group) });
    })
  );

  router.get(
    '/reports/revenue-borrowed',
    handle((req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);
      res.json({ from, to, ...revenueBorrowedData(from, to) });
    })
  );

  router.get(
    '/reports/revenue-gross',
    handle((req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);
      res.json({ from, to, ...revenueGrossData(from, to) });
    })
  );

  // --- Xuất Excel cho cả 4 báo cáo doanh thu ---
  interface SheetSpec {
    name: string;
    title: string;
    subtitle?: string;
    columns: { header: string; width: number; align?: 'left' | 'center' | 'right' }[];
    rows: (string | number | null | undefined)[][];
    totals?: (string | number | null | undefined)[];
  }

  async function buildReportWorkbook(sheets: SheetSpec[]): Promise<ExcelJS.Buffer> {
    const wb = new ExcelJS.Workbook();
    const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } as Partial<ExcelJS.Borders>;
    for (const spec of sheets) {
      const ws = wb.addWorksheet(spec.name);
      spec.columns.forEach((c, i) => {
        ws.getColumn(i + 1).width = c.width;
      });
      const lastCol = spec.columns.length;
      ws.mergeCells(1, 1, 1, lastCol);
      const title = ws.getCell(1, 1);
      title.value = spec.title;
      title.font = { bold: true, size: 14 };
      title.alignment = { horizontal: 'center' };
      let r = 2;
      if (spec.subtitle) {
        ws.mergeCells(2, 1, 2, lastCol);
        const sub = ws.getCell(2, 1);
        sub.value = spec.subtitle;
        sub.font = { italic: true, size: 10 };
        sub.alignment = { horizontal: 'center' };
        r = 3;
      }
      spec.columns.forEach((c, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = c.header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = border;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      r += 1;
      const writeRow = (values: (string | number | null | undefined)[], bold = false) => {
        values.forEach((v, i) => {
          const cell = ws.getCell(r, i + 1);
          cell.value = v as ExcelJS.CellValue;
          cell.border = border;
          if (bold) cell.font = { bold: true };
          cell.alignment = { horizontal: spec.columns[i]?.align ?? 'left' };
          if (typeof v === 'number') cell.numFmt = '#,##0';
        });
        r += 1;
      };
      for (const row of spec.rows) writeRow(row);
      if (spec.totals) writeRow(spec.totals, true);
    }
    return wb.xlsx.writeBuffer();
  }

  const periodLabel = (from?: string, to?: string) => `Kỳ báo cáo: ${from ?? 'đầu kỳ'} → ${to ?? 'cuối kỳ'}`;
  const periodSuffix = (from?: string, to?: string) => `${from ?? 'all'}_${to ?? 'all'}`;
  const num = (v: unknown) => Number(v) || 0;

  router.get(
    '/reports/revenue.xlsx',
    handle(async (req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);
      const d = revenueEnterpriseData(from, to);
      const buffer = await buildReportWorkbook([
        {
          name: 'Tổng quan',
          title: 'DOANH THU XÍ NGHIỆP',
          subtitle: `${periodLabel(from, to)} — chỉ tính hàng xuất từ kho của xí nghiệp`,
          columns: [
            { header: 'Chỉ tiêu', width: 40 },
            { header: 'Giá trị', width: 18, align: 'right' },
          ],
          rows: [
            ['Doanh thu gộp (tiền hàng)', num(d.summary.totalRevenue)],
            ['Hàng hoàn trong kỳ', -num(d.summary.totalReturned)],
            ['Doanh thu thuần', num(d.summary.netRevenue)],
            ['Số đơn', num(d.summary.orderCount)],
            ['Tiền công vận chuyển trả nhân viên giao hàng (không tính vào doanh thu)', num(d.summary.totalShipping)],
            ['Tổng đơn gồm phí vận chuyển', num(d.summary.totalWithShipping)],
          ],
        },
        {
          name: 'Theo sản phẩm',
          title: 'Doanh thu theo sản phẩm',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Sản phẩm', width: 40 },
            { header: 'Số lượng', width: 12, align: 'right' },
            { header: 'Doanh thu (thuần)', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
          ],
          rows: d.byProduct.map((r) => [r.name, num(r.quantity), num(r.revenue), num(r.returned)]),
        },
        {
          name: 'Theo nhân viên',
          title: 'Doanh thu theo nhân viên bán',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Nhân viên', width: 30 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Doanh thu (thuần)', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
            { header: 'Đã thu', width: 16, align: 'right' },
          ],
          rows: d.bySeller.map((r) => [r.name, num(r.orders), num(r.revenue), num(r.returned), num(r.paid_amount)]),
        },
        {
          name: 'Theo khách hàng',
          title: 'Doanh thu theo khách hàng',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Khách hàng', width: 38 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Doanh thu (thuần)', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
            { header: 'Đã thu', width: 16, align: 'right' },
          ],
          rows: d.byCustomer.map((r) => [r.name, num(r.orders), num(r.revenue), num(r.returned), num(r.paid_amount)]),
        },
        {
          name: 'Theo ngày',
          title: 'Doanh thu theo ngày',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Ngày', width: 14 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Doanh thu (thuần)', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
          ],
          rows: d.byDay.map((r) => [r.date, num(r.orders), num(r.revenue), num(r.returned)]),
        },
        {
          name: 'Theo tháng',
          title: 'Doanh thu theo tháng',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Tháng', width: 14 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Doanh thu (thuần)', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
          ],
          rows: d.byMonth.map((r) => [r.month, num(r.orders), num(r.revenue), num(r.returned)]),
        },
        {
          name: 'Chi tiết đơn',
          title: 'Chi tiết đơn hàng trong kỳ',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Mã đơn', width: 18 },
            { header: 'Ngày', width: 12 },
            { header: 'Khách hàng', width: 32 },
            { header: 'Nhân viên bán', width: 22 },
            { header: 'Kho', width: 18 },
            { header: 'Tiền hàng', width: 16, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
            { header: 'Thuần', width: 16, align: 'right' },
            { header: 'Phí ship', width: 14, align: 'right' },
            { header: 'Giảm giá', width: 14, align: 'right' },
            { header: 'Tổng đơn', width: 16, align: 'right' },
            { header: 'Đã thu', width: 16, align: 'right' },
            { header: 'Trạng thái TT', width: 14 },
            { header: 'Hóa đơn', width: 14 },
          ],
          rows: d.orderDetail.map((o) => [
            o.order_code,
            o.order_date,
            o.customer_name,
            o.seller_name ?? '',
            o.warehouse_name ?? '',
            num(o.subtotal_amount),
            num(o.returned_value),
            num(o.subtotal_amount) - num(o.returned_value),
            num(o.shipping_fee),
            num(o.discount_amount),
            num(o.total_amount),
            num(o.paid_amount),
            o.payment_status,
            o.invoice_status,
          ]),
        },
        {
          name: 'Hàng hoàn',
          title: 'Hàng hoàn trong kỳ (trừ vào doanh thu)',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Ngày hoàn', width: 14 },
            { header: 'Phiếu nhập', width: 18 },
            { header: 'Đơn gốc', width: 18 },
            { header: 'Khách hàng', width: 30 },
            { header: 'Nhân viên bán', width: 22 },
            { header: 'Sản phẩm', width: 32 },
            { header: 'SL hoàn', width: 10, align: 'right' },
            { header: 'SL KM trả lại', width: 12, align: 'right' },
            { header: 'Đơn giá', width: 14, align: 'right' },
            { header: 'Giá trị hoàn', width: 16, align: 'right' },
          ],
          rows: d.returnRows.map((r) => [
            r.ticket_date,
            r.ticket_code,
            r.order_code,
            r.customer_name ?? '',
            r.seller_name ?? '',
            r.product_name,
            num(r.quantity),
            num(r.quantity_promo),
            num(r.unit_price),
            num(r.return_value),
          ]),
          totals: [
            'TỔNG',
            '',
            '',
            '',
            '',
            '',
            d.returnRows.reduce((a, r) => a + num(r.quantity), 0),
            d.returnRows.reduce((a, r) => a + num(r.quantity_promo), 0),
            '',
            num(d.summary.totalReturned),
          ],
        },
      ]);
      const fileName = `bao-cao-doanh-thu-xi-nghiep-${periodSuffix(from, to)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    })
  );

  router.get(
    '/reports/revenue-detail.xlsx',
    handle(async (req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const { from, to } = periodRange(q);
      const d = revenueDetailData(from, to, q.group);
      const rows = d.rows.map((r) => [
        r.name,
        r.group_type ?? '',
        num(r.orders),
        num(r.quantity),
        num(r.promo),
        num(r.revenue),
        num(r.returned),
        num(r.net),
      ]);
      const sheets: SheetSpec[] = [
        {
          name: 'Chi tiết',
          title: `DOANH THU XÍ NGHIỆP CHI TIẾT — ${d.label ?? 'Nhóm'}`,
          subtitle: `${periodLabel(from, to)} — chỉ tính hàng xuất từ kho của xí nghiệp`,
          columns: [
            { header: d.label ?? 'Nhóm', width: 34 },
            { header: 'Loại', width: 14 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Số lượng', width: 12, align: 'right' },
            { header: 'SL khuyến mãi', width: 14, align: 'right' },
            { header: 'Doanh thu gộp', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
            { header: 'Doanh thu thuần', width: 18, align: 'right' },
          ],
          rows,
        },
      ];
      sheets[0].totals = [
        'TỔNG',
        '',
        d.totals.orders,
        d.totals.quantity,
        d.totals.promo,
        d.totals.revenue,
        d.totals.returned,
        d.totals.net,
      ];
      if (d.rows.some((r) => r.children?.length)) {
        sheets.push({
          name: 'Nhân viên trong đơn vị',
          title: 'Chi tiết nhân viên bán trong từng đơn vị',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Đơn vị (trạm)', width: 30 },
            { header: 'Nhân viên', width: 30 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Số lượng', width: 12, align: 'right' },
            { header: 'Doanh thu gộp', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
            { header: 'Doanh thu thuần', width: 18, align: 'right' },
          ],
          rows: d.rows.flatMap((r) => (r.children ?? []).map((c) => [r.name, c.name, num(c.orders), num(c.quantity), num(c.revenue), num(c.returned), num(c.net)])),
        });
      }
      const buffer = await buildReportWorkbook(sheets);
      const fileName = `bao-cao-doanh-thu-chi-tiet-${d.group ?? 'kho'}-${periodSuffix(from, to)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    })
  );

  router.get(
    '/reports/revenue-borrowed.xlsx',
    handle(async (req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);
      const d = revenueBorrowedData(from, to);
      const buffer = await buildReportWorkbook([
        {
          name: 'Tổng quan',
          title: 'DOANH THU ĐƠN HÀNG ĐI MƯỢN',
          subtitle: `${periodLabel(from, to)} — hàng mượn của đơn vị khác, bán cho khách của xí nghiệp`,
          columns: [
            { header: 'Đối tác cho mượn', width: 32 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Số lượng', width: 12, align: 'right' },
            { header: 'Doanh thu bán được', width: 20, align: 'right' },
            { header: 'Đã trả (sản phẩm)', width: 22, align: 'right' },
            { header: 'Còn lại (sản phẩm)', width: 18, align: 'right' },
            { header: 'Đơn chưa tất toán', width: 16, align: 'right' },
          ],
          rows: d.byPartner.map((p) => [
            p.name,
            p.orders,
            p.quantity,
            p.revenue,
            p.settled_value,
            p.outstanding_value,
            p.loan_orders,
          ]),
          totals: [
            'TỔNG',
            d.totals.orders,
            d.totals.quantity,
            d.totals.revenue,
            d.totals.settled_value,
            d.totals.outstanding_value,
            '',
          ],
        },
        {
          name: 'Đơn đi mượn',
          title: 'Chi tiết đơn hàng đi mượn',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Mã đơn', width: 18 },
            { header: 'Ngày', width: 12 },
            { header: 'Mượn của đối tác', width: 30 },
            { header: 'Khách nhận hàng', width: 30 },
            { header: 'Nhân viên bán', width: 22 },
            { header: 'Số lượng', width: 12, align: 'right' },
            { header: 'Doanh thu', width: 18, align: 'right' },
            { header: 'Đã trả (sản phẩm)', width: 18, align: 'right' },
            { header: 'Còn lại (sản phẩm)', width: 16, align: 'right' },
            { header: 'Trạng thái mượn', width: 16 },
            { header: 'Trạng thái TT', width: 14 },
          ],
          rows: d.rows.map((r) => [
            r.order_code as string,
            r.order_date as string,
            (r.partner_name as string) ?? '',
            (r.customer_name as string) ?? '',
            (r.seller_name as string) ?? '',
            r.items.reduce((a, it) => a + num(it.quantity) + num(it.quantity_promo), 0),
            num(r.subtotal_amount),
            num(r.settled_value),
            num(r.outstanding_value),
            r.loan_status === 'SETTLED' ? 'Đã tất toán' : 'Chưa tất toán',
            r.payment_status as string,
          ]),
        },
        {
          name: 'Mặt hàng',
          title: 'Mặt hàng của các đơn đi mượn',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Mã đơn', width: 18 },
            { header: 'Sản phẩm', width: 34 },
            { header: 'ĐVT', width: 10 },
            { header: 'Số lượng', width: 12, align: 'right' },
            { header: 'SL khuyến mãi', width: 14, align: 'right' },
            { header: 'Đơn giá', width: 14, align: 'right' },
            { header: 'Thành tiền', width: 18, align: 'right' },
          ],
          rows: d.rows.flatMap((r) =>
            r.items.map((it) => [
              r.order_code as string,
              it.product_name,
              it.unit ?? '',
              num(it.quantity),
              num(it.quantity_promo),
              num(it.unit_price),
              num(it.total_price),
            ])
          ),
        },
      ]);
      const fileName = `bao-cao-doanh-thu-di-muon-${periodSuffix(from, to)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    })
  );

  router.get(
    '/reports/revenue-gross.xlsx',
    handle(async (req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);
      const d = revenueGrossData(from, to);
      const buffer = await buildReportWorkbook([
        {
          name: 'Tổng gộp',
          title: 'DOANH THU GỘP',
          subtitle: `${periodLabel(from, to)} — chỉ gồm hàng bán: hàng xuất từ kho xí nghiệp và hàng đi mượn của đối tác về bán`,
          columns: [
            { header: 'Khối doanh thu', width: 42 },
            { header: 'Tính cho', width: 24 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Giá trị gộp', width: 18, align: 'right' },
            { header: 'Hàng hoàn', width: 14, align: 'right' },
            { header: 'Giá trị thuần', width: 18, align: 'right' },
          ],
          rows: d.blocks.map((b) => [b.name, b.owner, b.orders, b.value, b.returned, b.net]),
          totals: ['TỔNG DOANH THU GỘP', '', d.blocks.reduce((a, b) => a + b.orders, 0), d.blocks.reduce((a, b) => a + b.value, 0), d.blocks.reduce((a, b) => a + b.returned, 0), d.total],
        },
        {
          name: 'Phân tích theo khối',
          title: 'Chi tiết từng khối (theo kho / theo đối tác)',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Khối doanh thu', width: 42 },
            { header: 'Kho / Đối tác', width: 30 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Giá trị', width: 18, align: 'right' },
          ],
          rows: d.blocks.flatMap((b) => b.byGroup.map((g) => [b.name, g.name, g.orders, g.value])),
        },
        {
          name: 'Ngoài doanh thu',
          title: 'Các khoản tách khỏi doanh thu (tiền công nhân viên và công nợ cho mượn)',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Khoản', width: 72 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Giá trị', width: 18, align: 'right' },
          ],
          rows: [
            ['Tiền công vận chuyển trả nhân viên giao hàng (không tính vào doanh thu)', '', d.shippingCollected],
            ['Tiền công bốc xếp phải thu (không tính vào doanh thu)', d.serviceFee.orders, d.serviceFee.value],
            ['Tiền công bốc xếp đã thu', '', d.serviceFee.collected],
            ['Hàng cho đối tác mượn trong kỳ (công nợ phải thu)', d.lent.orders, d.lent.value],
            ['Hàng đối tác đã trả lại (nhập kho, giảm công nợ)', '', d.lent.returned],
          ],
        },
        {
          name: 'Cho mượn theo đối tác',
          title: 'Hàng cho đối tác mượn trong kỳ (không phải doanh thu)',
          subtitle: periodLabel(from, to),
          columns: [
            { header: 'Đối tác', width: 34 },
            { header: 'Số đơn', width: 10, align: 'right' },
            { header: 'Giá trị hàng', width: 18, align: 'right' },
          ],
          rows: d.lent.byGroup.map((g) => [g.name, g.orders, g.value]),
        },
      ]);
      const fileName = `bao-cao-doanh-thu-gop-${periodSuffix(from, to)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    })
  );

  // Mỗi dòng = một đơn × một người giao: lấy theo phân bổ order_shippers,
  // đơn chưa phân bổ thì tính cho người giao ghi trên đơn (shipper_employee_id).
  interface ShippingRow {
    order_id: number;
    order_code: string;
    order_date: string;
    order_status: string;
    customer_name: string;
    employee_id: number | null;
    employee_name: string | null;
    unit_name: string | null;
    fee: number;
  }

  const shippingShareRows = (from?: string, to?: string): ShippingRow[] => {
    // Đơn đã hoàn hàng vẫn giữ nguyên phí giao hàng và phí đi nhận hàng hoàn của nhân viên.
    const clauses: string[] = ["o.order_status IN ('SHIPPING', 'COMPLETED', 'RETURNED')"];
    // Đơn miễn ship (không gán người giao) không phát sinh tiền công giao hàng của ai
    // → không tính vào chi phí vận chuyển lẫn bảng lương giao hàng.
    if (freeShipWithoutShipper(db)) clauses.push('e.id IS NOT NULL');
    const params: unknown[] = [];
    if (from) {
      clauses.push('o.order_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('o.order_date <= ?');
      params.push(to);
    }
    return db
      .prepare(
        `SELECT o.id as order_id, o.order_code, o.order_date, o.order_status,
                c.name as customer_name,
                e.id as employee_id, e.full_name as employee_name, ou.name as unit_name,
                COALESCE(os.allocated_fee, o.shipping_fee) as fee
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         LEFT JOIN order_shippers os ON os.order_id = o.id
         LEFT JOIN employees e ON e.id = COALESCE(os.employee_id, o.shipper_employee_id)
         LEFT JOIN org_units ou ON ou.id = e.org_unit_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY o.order_date DESC, o.id DESC`
      )
      .all(...params) as ShippingRow[];
  };

  router.get(
    '/reports/expenses',
    handle((req, res) => {
      const { from, to } = periodRange(req.query as Record<string, string | undefined>);

      // Phí vận chuyển là chi phí phát sinh khi hàng đã rời kho (đang giao / hoàn tất).
      const rows = shippingShareRows(from, to);

      // Tổng hợp từ chính các dòng trên để số liệu nhóm luôn khớp danh sách đơn xổ ra.
      const aggregate = (keyOf: (r: ShippingRow) => string) => {
        const map = new Map<string, { orders: Set<number>; shipping_fee: number }>();
        for (const r of rows) {
          const key = keyOf(r);
          const group = map.get(key) ?? { orders: new Set<number>(), shipping_fee: 0 };
          group.orders.add(r.order_id);
          group.shipping_fee += Number(r.fee) || 0;
          map.set(key, group);
        }
        return [...map.entries()].map(([name, g]) => ({ name, trips: g.orders.size, shipping_fee: g.shipping_fee }));
      };

      const byEmployee = aggregate((r) => r.employee_name ?? 'Chưa gán nhân viên').sort((a, b) => b.shipping_fee - a.shipping_fee);
      const byUnit = aggregate((r) => r.unit_name ?? 'Chưa gán đơn vị').sort((a, b) => b.shipping_fee - a.shipping_fee);
      const byDay = aggregate((r) => r.order_date)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ date: g.name, trips: g.trips, shipping_fee: g.shipping_fee }));
      const byMonth = aggregate((r) => r.order_date.slice(0, 7))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ month: g.name, trips: g.trips, shipping_fee: g.shipping_fee }));

      const totalShipping = rows.reduce((a, r) => a + (Number(r.fee) || 0), 0);
      const orderCount = new Set(rows.map((r) => r.order_id)).size;

      res.json({ totalShipping, orderCount, byEmployee, byUnit, byDay, byMonth, rows });
    })
  );

  // --- Báo cáo doanh thu theo mẫu nộp Công ty (sau thuế / trước thuế) ---

  // Mặc định hợp nhất; ?borrowed=0 chỉ dùng khi cần phân tích riêng doanh thu hàng kho.
  const includeBorrowedFlag = (raw: unknown) => raw !== '0' && raw !== 'false';

  router.get(
    '/reports/trade-template',
    handle((req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const { from, to } = resolveReportPeriod(q);
      res.json(tradeReportData(from, to, includeBorrowedFlag(q.borrowed)));
    })
  );

  router.get(
    '/reports/trade-template.xlsx',
    handle(async (req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const { from, to } = resolveReportPeriod(q);
      const mode = q.mode === 'gross' ? 'gross' : 'net';
      const includeBorrowed = includeBorrowedFlag(q.borrowed);
      const buffer = await buildTradeTemplateWorkbook(tradeReportData(from, to, includeBorrowed), mode);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bao-cao-thuong-mai-${from}_${to}-${mode}${includeBorrowed ? '-kem-hang-di-muon' : ''}.xlsx"`
      );
      res.send(Buffer.from(buffer));
    })
  );

  // --- Đối chiếu vỏ bình & cọc vỏ: nợ vỏ khách đang giữ ↔ tiền cọc mình đang giữ ---
  interface ShellDepositReportRow {
    customer_id: number;
    code: string;
    name: string;
    debt_voi: number;
    debt_up: number;
    pending_voi: number;
    pending_up: number;
    shell_value: number;
    collected: number;
    refunded: number;
    balance: number;
    diff: number;
    collected_month: number;
    refunded_month: number;
    pending_deposit: number;
  }

  const shellDepositReportData = (db: Database.Database, from: string, to: string, mode = 'all') => {
    const { feeVoi, feeUp } = shellDepositFees(db);
    const raw = db
      .prepare(
        `SELECT c.id as customer_id, c.code, c.name,
                COALESCE(c.bottle_debt_voi,0) as debt_voi, COALESCE(c.bottle_debt_up,0) as debt_up,
                COALESCE(b.bottles_voi,0) as bottles_voi, COALESCE(b.bottles_up,0) as bottles_up,
                COALESCE(po.ret_voi,0) as ret_voi, COALESCE(po.ret_up,0) as ret_up,
                COALESCE(po.pending_deposit,0) as pending_deposit,
                COALESCE(d.collected,0) as collected, COALESCE(d.refunded,0) as refunded,
                COALESCE(m.collected,0) as collected_month, COALESCE(m.refunded,0) as refunded_month
         FROM customers c
         LEFT JOIN (SELECT customer_id,
                           SUM(CASE WHEN transaction_type = 'COLLECT' THEN amount ELSE 0 END) as collected,
                           SUM(CASE WHEN transaction_type = 'REFUND' THEN amount ELSE 0 END) as refunded
                    FROM deposit_transactions GROUP BY customer_id) d ON d.customer_id = c.id
         LEFT JOIN (SELECT customer_id,
                           SUM(CASE WHEN transaction_type = 'COLLECT' THEN amount ELSE 0 END) as collected,
                           SUM(CASE WHEN transaction_type = 'REFUND' THEN amount ELSE 0 END) as refunded
                    FROM deposit_transactions WHERE transaction_date >= ? AND transaction_date <= ? GROUP BY customer_id) m
                ON m.customer_id = c.id
         LEFT JOIN (SELECT o.customer_id,
                           SUM(CASE WHEN p.bottle_type = 'VOI' THEN oi.quantity + COALESCE(oi.quantity_promo,0) ELSE 0 END) as bottles_voi,
                           SUM(CASE WHEN p.bottle_type = 'UP' THEN oi.quantity + COALESCE(oi.quantity_promo,0) ELSE 0 END) as bottles_up
                    FROM orders o
                    JOIN order_items oi ON oi.order_id = o.id
                    JOIN products p ON p.id = oi.product_id
                    WHERE o.order_status IN ('CONFIRMED','SHIPPING') AND o.order_type IN ('SALE','BORROW_IN')
                    GROUP BY o.customer_id) b ON b.customer_id = c.id
         LEFT JOIN (SELECT customer_id,
                           SUM(COALESCE(returned_shells_voi,0)) as ret_voi,
                           SUM(COALESCE(returned_shells_up,0)) as ret_up,
                           SUM(COALESCE(deposit_amount,0)) as pending_deposit
                    FROM orders
                    WHERE order_status IN ('CONFIRMED','SHIPPING') AND order_type IN ('SALE','BORROW_IN')
                    GROUP BY customer_id) po ON po.customer_id = c.id
         WHERE c.is_active = 1
         ORDER BY (c.bottle_debt_voi + c.bottle_debt_up) DESC, c.id ASC`
      )
      .all(from, to) as (Omit<ShellDepositReportRow, 'shell_value' | 'balance' | 'diff' | 'pending_voi' | 'pending_up'> & {
        bottles_voi: number;
        bottles_up: number;
        ret_voi: number;
        ret_up: number;
      })[];

    const rows: ShellDepositReportRow[] = raw.map((row) => {
      const shellValue = (Number(row.debt_voi) || 0) * feeVoi + (Number(row.debt_up) || 0) * feeUp;
      const balance = (Number(row.collected) || 0) - (Number(row.refunded) || 0);
      return {
        ...row,
        debt_voi: Number(row.debt_voi) || 0,
        debt_up: Number(row.debt_up) || 0,
        pending_voi: Math.max(0, (Number(row.bottles_voi) || 0) - (Number(row.ret_voi) || 0)),
        pending_up: Math.max(0, (Number(row.bottles_up) || 0) - (Number(row.ret_up) || 0)),
        pending_deposit: Number(row.pending_deposit) || 0,
        collected: Number(row.collected) || 0,
        refunded: Number(row.refunded) || 0,
        collected_month: Number(row.collected_month) || 0,
        refunded_month: Number(row.refunded_month) || 0,
        shell_value: shellValue,
        balance,
        diff: balance - shellValue,
      };
    });

    // mode = 'debt' → chỉ khách còn nợ vỏ (dùng cho "Xuất danh sách nợ").
    const scoped = mode === 'debt' ? rows.filter((row) => row.debt_voi + row.debt_up > 0) : rows;
    const totals = scoped.reduce(
      (acc, row) => ({
        debt_voi: acc.debt_voi + row.debt_voi,
        debt_up: acc.debt_up + row.debt_up,
        pending_voi: acc.pending_voi + row.pending_voi,
        pending_up: acc.pending_up + row.pending_up,
        pending_deposit: acc.pending_deposit + row.pending_deposit,
        shell_value: acc.shell_value + row.shell_value,
        collected: acc.collected + row.collected,
        refunded: acc.refunded + row.refunded,
        balance: acc.balance + row.balance,
        diff: acc.diff + row.diff,
        collected_month: acc.collected_month + row.collected_month,
        refunded_month: acc.refunded_month + row.refunded_month,
      }),
      {
        debt_voi: 0,
        debt_up: 0,
        pending_voi: 0,
        pending_up: 0,
        pending_deposit: 0,
        shell_value: 0,
        collected: 0,
        refunded: 0,
        balance: 0,
        diff: 0,
        collected_month: 0,
        refunded_month: 0,
      }
    );
    const mismatchCount = scoped.filter((row) => Math.abs(row.diff) > 0.5).length;
    return { from, to, feeVoi, feeUp, rows: scoped, totals: { ...totals, mismatch_count: mismatchCount } };
  };

  router.get(
    '/reports/shell-deposits',
    handle((req, res) => {
      const { from, to } = resolveReportPeriod(req.query as Record<string, string | undefined>);
      res.json(shellDepositReportData(db, from, to));
    })
  );

  router.get(
    '/reports/shell-deposits.xlsx',
    handle(async (req, res) => {
      const { from, to } = resolveReportPeriod(req.query as Record<string, string | undefined>);
      const mode = (req.query.mode as string | undefined) === 'debt' ? 'debt' : 'all';
      const data = shellDepositReportData(db, from, to, mode);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Cọc vỏ bình');
      ws.columns = [
        { width: 10 },
        { width: 28 },
        { width: 12 },
        { width: 12 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 14 },
      ];
      ws.mergeCells('A1:L1');
      ws.getCell('A1').value = `ĐỐI CHIẾU VỎ BÌNH - CỌC VỎ · KỲ ${from} → ${to}`;
      ws.getCell('A1').font = { bold: true, size: 13 };
      ws.getCell('A1').alignment = { horizontal: 'center' };
      ws.mergeCells('A2:L2');
      ws.getCell('A2').value = `Phí cọc: vỏ Vòi ${Number(data.feeVoi).toLocaleString('vi-VN')}₫ · vỏ Úp ${Number(data.feeUp).toLocaleString('vi-VN')}₫`;
      ws.getCell('A2').font = { italic: true, size: 10 };

      const header = [
        'Mã KH',
        'Khách hàng',
        'Nợ vỏ Vòi',
        'Nợ vỏ Úp',
        'Giá trị vỏ giữ',
        'Đã thu cọc',
        'Đã hoàn cọc',
        'Cọc đang giữ',
        'Chênh lệch',
        'Chờ ghi nhận Vòi',
        'Chờ ghi nhận Úp',
        'Cọc chờ thu',
      ];
      const headerRow = ws.addRow(header);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center' };

      for (const row of data.rows) {
        ws.addRow([
          row.code,
          row.name,
          row.debt_voi,
          row.debt_up,
          row.shell_value,
          row.collected,
          row.refunded,
          row.balance,
          row.diff,
          row.pending_voi,
          row.pending_up,
          row.pending_deposit,
        ]);
      }
      const totalRow = ws.addRow([
        '',
        'TỔNG',
        data.totals.debt_voi,
        data.totals.debt_up,
        data.totals.shell_value,
        data.totals.collected,
        data.totals.refunded,
        data.totals.balance,
        data.totals.diff,
        data.totals.pending_voi,
        data.totals.pending_up,
        data.totals.pending_deposit,
      ]);
      totalRow.font = { bold: true };
      ws.addRow([]);
      ws.addRow([`Số khách lệch nợ vỏ / cọc: ${data.totals.mismatch_count}`]);

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="doi-chieu-vo-coc-${from}_${to}${mode === 'debt' ? '-danh-sach-no' : ''}.xlsx"`);
      res.send(Buffer.from(buffer));
    })
  );

  // --- Bảng vỏ bình theo TỪNG ĐƠN: số vỏ giao, tiền cọc, đã trả, và số khách đang giữ ---
  interface ShellOrderRow {
    order_id: number;
    order_code: string;
    order_date: string;
    customer_id: number;
    customer_code: string;
    customer_name: string;
    voi: number;
    up: number;
    deposit: number;
    returned_voi: number;
    returned_up: number;
    debt_voi: number;
    debt_up: number;
  }

  router.get(
    '/reports/shell-orders',
    handle((req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const { from, to } = resolveReportPeriod(q);
      const scope = q.scope === 'period' ? 'period' : 'all';
      const dateClause = scope === 'period' ? 'AND o.order_date >= ? AND o.order_date <= ?' : '';
      const params = scope === 'period' ? [from, to] : [];
      const rows = db
        .prepare(
          `SELECT o.id AS order_id, o.order_code, o.order_date,
                  c.id AS customer_id, c.code AS customer_code, c.name AS customer_name,
                  COALESCE(SUM(CASE WHEN p.bottle_type = 'VOI' THEN oi.quantity + COALESCE(oi.quantity_promo, 0) ELSE 0 END), 0) AS voi,
                  COALESCE(SUM(CASE WHEN p.bottle_type = 'UP' THEN oi.quantity + COALESCE(oi.quantity_promo, 0) ELSE 0 END), 0) AS up,
                  COALESCE(o.deposit_amount, 0) AS deposit,
                  COALESCE(o.returned_shells_voi, 0) AS returned_voi,
                  COALESCE(o.returned_shells_up, 0) AS returned_up,
                  COALESCE(c.bottle_debt_voi, 0) AS debt_voi,
                  COALESCE(c.bottle_debt_up, 0) AS debt_up
           FROM orders o
           JOIN customers c ON c.id = o.customer_id
           JOIN order_items oi ON oi.order_id = o.id
           JOIN products p ON p.id = oi.product_id
           WHERE o.order_type IN ('SALE', 'BORROW_IN') AND o.order_status IN ('COMPLETED', 'RETURNED')
             AND EXISTS (
               SELECT 1 FROM order_items oi2 JOIN products p2 ON p2.id = oi2.product_id
               WHERE oi2.order_id = o.id AND p2.bottle_type <> 'NONE'
             )
             ${dateClause}
           GROUP BY o.id
           ORDER BY o.order_date DESC, o.id DESC`
        )
        .all(...params) as ShellOrderRow[];

      const totals = rows.reduce(
        (acc, row) => ({
          voi: acc.voi + row.voi,
          up: acc.up + row.up,
          deposit: acc.deposit + row.deposit,
          returned_voi: acc.returned_voi + row.returned_voi,
          returned_up: acc.returned_up + row.returned_up,
        }),
        { voi: 0, up: 0, deposit: 0, returned_voi: 0, returned_up: 0 }
      );
      // Số hiện đang giữ là trạng thái hiện tại, không phụ thuộc kỳ đang xem.
      const held = db
        .prepare(
          `SELECT COALESCE((SELECT SUM(bottle_debt_voi) FROM customers), 0) AS debt_voi,
                  COALESCE((SELECT SUM(bottle_debt_up) FROM customers), 0) AS debt_up,
                  COALESCE((SELECT SUM(CASE WHEN transaction_type = 'COLLECT' THEN amount ELSE -amount END)
                            FROM deposit_transactions), 0) AS deposit_balance`
        )
        .get() as { debt_voi: number; debt_up: number; deposit_balance: number };
      const { feeVoi, feeUp } = shellDepositFees(db);
      // Gộp theo khách cho dòng chính; bấm vào khách sẽ sổ xuống danh sách đơn (rows).
      const byCustomer = new Map<
        number,
        { period_voi: number; period_up: number; period_deposit: number; order_count: number }
      >();
      for (const row of rows) {
        const acc = byCustomer.get(row.customer_id) ?? { period_voi: 0, period_up: 0, period_deposit: 0, order_count: 0 };
        acc.period_voi += row.voi;
        acc.period_up += row.up;
        acc.period_deposit += row.deposit;
        acc.order_count += 1;
        byCustomer.set(row.customer_id, acc);
      }
      const allCustomers = db
        .prepare(
          `SELECT c.id AS customer_id, c.code, c.name,
                  COALESCE(c.bottle_debt_voi, 0) AS debt_voi, COALESCE(c.bottle_debt_up, 0) AS debt_up,
                  COALESCE((SELECT SUM(CASE WHEN d.transaction_type = 'COLLECT' THEN d.amount ELSE -d.amount END)
                            FROM deposit_transactions d WHERE d.customer_id = c.id), 0) AS deposit_balance
           FROM customers c`
        )
        .all() as {
        customer_id: number;
        code: string;
        name: string;
        debt_voi: number;
        debt_up: number;
        deposit_balance: number;
      }[];
      const customers = allCustomers
        .filter(
          (c) =>
            byCustomer.has(c.customer_id) ||
            c.debt_voi > 0 ||
            c.debt_up > 0 ||
            Math.abs(c.deposit_balance) > 0.5
        )
        .map((c) => {
          const agg = byCustomer.get(c.customer_id) ?? { period_voi: 0, period_up: 0, period_deposit: 0, order_count: 0 };
          return { ...c, ...agg };
        })
        .sort((a, b) => b.debt_voi + b.debt_up - (a.debt_voi + a.debt_up));
      res.json({ scope, from, to, feeVoi, feeUp, rows, totals, held, customers });
    })
  );

  // --- Đối soát kho: nhập/xuất theo sổ bút toán trong kỳ, đối chiếu tồn hệ thống ---

  interface AuditAgg {
    product_id: number;
    in_total: number;
    out_sale: number;
    out_promo: number;
    out_other: number;
    return_in: number;
    adjust: number;
  }

  const auditAggRows = (dateClause: string, whClause: string, params: unknown[]): AuditAgg[] =>
    db
      .prepare(
        `SELECT product_id,
                COALESCE(SUM(CASE WHEN movement_type IN ('IMPORT','TRANSFER_IN','LOAN_IN','BORROW_IN')
                                  THEN quantity + COALESCE(quantity_promo,0) ELSE 0 END),0) as in_total,
                COALESCE(SUM(CASE WHEN movement_type = 'EXPORT_ORDER' THEN quantity ELSE 0 END),0) as out_sale,
                COALESCE(SUM(CASE WHEN movement_type = 'EXPORT_ORDER' THEN COALESCE(quantity_promo,0) ELSE 0 END),0) as out_promo,
                COALESCE(SUM(CASE WHEN movement_type IN ('TRANSFER_OUT','LOAN_OUT','BORROW_OUT','WRITE_OFF')
                                  THEN quantity + COALESCE(quantity_promo,0) ELSE 0 END),0) as out_other,
                COALESCE(SUM(CASE WHEN movement_type = 'RETURN_IN'
                                  THEN quantity + COALESCE(quantity_promo,0) ELSE 0 END),0) as return_in,
                COALESCE(SUM(CASE WHEN movement_type = 'ADJUSTMENT'
                                  THEN (CASE WHEN target_warehouse_id IS NOT NULL THEN quantity + COALESCE(quantity_promo,0)
                                             ELSE -(quantity + COALESCE(quantity_promo,0)) END) ELSE 0 END),0) as adjust
         FROM stock_movements
         WHERE ${whClause} AND ${dateClause}
         GROUP BY product_id`
      )
      .all(...params) as AuditAgg[];

  const auditNet = (r: AuditAgg) =>
    (Number(r.in_total) || 0) +
    (Number(r.return_in) || 0) -
    (Number(r.out_sale) || 0) -
    (Number(r.out_promo) || 0) -
    (Number(r.out_other) || 0) +
    (Number(r.adjust) || 0);

  router.get(
    '/reports/stock-audit',
    handle((req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const warehouseId = Number(q.warehouse_id) || 0;
      const to = q.to || today();
      const from = q.from || `${to.slice(0, 7)}-01`;

      // Kho chứa hàng thật: bỏ kho ảo (trung chuyển / mượn) và nút "Khách hàng" (chỉ là điểm giao trong tuyến).
      const STOCK_TYPES = `('CENTRAL','STORE','VEHICLE','STATION')`;
      // Mỗi chặng chuyển kho chỉ thuộc MỘT kho: TRANSFER_OUT thuộc kho nguồn, TRANSFER_IN thuộc kho đích.
      // Không lọc theo loại thì lọc một kho sẽ hút cả hai chặng và đối soát báo lệch ảo.
      const whClause = warehouseId
        ? `((source_warehouse_id = ? AND movement_type <> 'TRANSFER_IN') OR (target_warehouse_id = ? AND movement_type <> 'TRANSFER_OUT'))`
        : `(source_warehouse_id IN (SELECT id FROM warehouses WHERE type IN ${STOCK_TYPES})
            OR target_warehouse_id IN (SELECT id FROM warehouses WHERE type IN ${STOCK_TYPES}))`;
      const whParams = warehouseId ? [warehouseId, warehouseId] : [];

      const zero: AuditAgg = { product_id: 0, in_total: 0, out_sale: 0, out_promo: 0, out_other: 0, return_in: 0, adjust: 0 };
      const mapOf = (rows: AuditAgg[]) => new Map(rows.map((r) => [r.product_id, r]));
      const openingMap = mapOf(auditAggRows('DATE(created_at) < ?', whClause, [...whParams, from]));
      const periodMap = mapOf(auditAggRows('DATE(created_at) >= ? AND DATE(created_at) <= ?', whClause, [...whParams, from, to]));
      const afterMap = mapOf(auditAggRows('DATE(created_at) > ?', whClause, [...whParams, to]));

      const products = db
        .prepare(`SELECT id as product_id, code, name, unit FROM products WHERE product_type = 'GOODS' ORDER BY id`)
        .all() as { product_id: number; code: string; name: string; unit: string }[];
      const stockRows = (
        warehouseId
          ? db.prepare(`SELECT product_id, quantity FROM inventory_stock WHERE warehouse_id = ?`).all(warehouseId)
          : db
              .prepare(
                `SELECT product_id, SUM(quantity) as quantity FROM inventory_stock
                 WHERE warehouse_id IN (SELECT id FROM warehouses WHERE type IN ${STOCK_TYPES}) GROUP BY product_id`
              )
              .all()
      ) as { product_id: number; quantity: number }[];
      const stockMap = new Map(stockRows.map((r) => [r.product_id, Number(r.quantity) || 0]));

      const rows = products.map((p) => {
        const opening = auditNet(openingMap.get(p.product_id) ?? zero);
        const period = periodMap.get(p.product_id) ?? zero;
        const closing = opening + auditNet(period);
        const stockNow = stockMap.get(p.product_id) ?? 0;
        // Tồn hệ thống suy về ngày `to` để so với sổ sách đúng kỳ.
        const stockAtTo = stockNow - auditNet(afterMap.get(p.product_id) ?? zero);
        return {
          ...p,
          opening,
          in_total: Number(period.in_total) || 0,
          out_sale: Number(period.out_sale) || 0,
          out_promo: Number(period.out_promo) || 0,
          out_other: Number(period.out_other) || 0,
          return_in: Number(period.return_in) || 0,
          adjust: Number(period.adjust) || 0,
          closing,
          stock_now: stockNow,
          stock_at_to: stockAtTo,
          diff: closing - stockAtTo,
        };
      });

      const totals = rows.reduce(
        (a, r) => ({
          opening: a.opening + r.opening,
          in_total: a.in_total + r.in_total,
          out_sale: a.out_sale + r.out_sale,
          out_promo: a.out_promo + r.out_promo,
          out_other: a.out_other + r.out_other,
          return_in: a.return_in + r.return_in,
          adjust: a.adjust + r.adjust,
          closing: a.closing + r.closing,
          stock_now: a.stock_now + r.stock_now,
          diff: a.diff + r.diff,
        }),
        { opening: 0, in_total: 0, out_sale: 0, out_promo: 0, out_other: 0, return_in: 0, adjust: 0, closing: 0, stock_now: 0, diff: 0 }
      );

      res.json({ warehouse_id: warehouseId, from, to, rows, totals });
    })
  );

  // --- Đối chiếu vỏ bình: vỏ xí nghiệp đang giữ ↔ nợ vỏ khách ↔ sổ vỏ khách ---
  // Vỏ bình gắn với SẢN PHẨM (products.bottle_type: Vòi / Úp), KHÔNG gắn với kho: bán bình nước là
  // cho khách mượn luôn vỏ, khách trả lại khi không dùng nữa. Vỏ vì vậy chỉ có hai nơi — khách đang
  // giữ, hoặc xí nghiệp đang giữ — nên đối chiếu theo LOẠI VỎ, không theo kho.

  const SHELL_TYPES = ['VOI', 'UP'] as const;

  interface ShellLedgerAgg {
    bottle_type: string;
    opening_net: number;
    period_net: number;
    period_in: number;
    period_out: number;
    after_net: number;
  }

  // Bút toán vỏ gộp toàn hệ thống. Chuyển vỏ nội bộ không đổi tổng nên không tính vào sổ.
  const shellLedgerRows = (from: string, to: string): ShellLedgerAgg[] =>
    db
      .prepare(
        `WITH mv AS (
           SELECT bottle_type, movement_type AS mt, DATE(created_at) AS d,
                  CASE WHEN movement_type IN ('IN','RETURN','ADJUST_IN') THEN quantity ELSE -quantity END AS delta
             FROM shell_movements WHERE movement_type <> 'TRANSFER'
         )
         SELECT bottle_type,
                COALESCE(SUM(CASE WHEN d < ? THEN delta ELSE 0 END), 0) AS opening_net,
                COALESCE(SUM(CASE WHEN d >= ? AND d <= ? THEN delta ELSE 0 END), 0) AS period_net,
                COALESCE(SUM(CASE WHEN d >= ? AND d <= ? AND mt IN ('IN','RETURN','ADJUST_IN') THEN delta ELSE 0 END), 0) AS period_in,
                COALESCE(SUM(CASE WHEN d >= ? AND d <= ? AND mt IN ('OUT','WRITE_OFF','ADJUST_OUT') THEN -delta ELSE 0 END), 0) AS period_out,
                COALESCE(SUM(CASE WHEN d > ? THEN delta ELSE 0 END), 0) AS after_net
           FROM mv
          GROUP BY bottle_type`
      )
      .all(from, from, to, from, to, from, to, to) as ShellLedgerAgg[];

  router.get(
    '/reports/shell-audit',
    handle((req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const to = q.to || today();
      const from = q.from || `${to.slice(0, 7)}-01`;

      // 1. Vỏ xí nghiệp đang giữ đối chiếu sổ bút toán vỏ, theo loại vỏ.
      const stockNow = new Map<string, number>();
      for (const row of db
        .prepare('SELECT bottle_type, COALESCE(SUM(quantity), 0) as quantity FROM shell_stock GROUP BY bottle_type')
        .all() as { bottle_type: string; quantity: number }[]) {
        stockNow.set(row.bottle_type, Number(row.quantity) || 0);
      }

      const ledger = new Map<string, ShellLedgerAgg>();
      for (const row of shellLedgerRows(from, to)) ledger.set(row.bottle_type, row);

      const stockRows = SHELL_TYPES.map((bottleType) => {
        const agg = ledger.get(bottleType);
        const opening = Number(agg?.opening_net) || 0;
        const closing = opening + (Number(agg?.period_net) || 0);
        const now = stockNow.get(bottleType) ?? 0;
        const atTo = now - (Number(agg?.after_net) || 0);
        return {
          bottle_type: bottleType,
          opening,
          period_in: Number(agg?.period_in) || 0,
          period_out: Number(agg?.period_out) || 0,
          closing,
          stock_now: now,
          stock_at_to: atTo,
          diff: closing - atTo,
        };
      });

      // 2. Nợ vỏ khách đối chiếu sổ vỏ khách — bắt các đường sửa nợ trực tiếp không qua sổ.
      const customerRows = db
        .prepare(
          `SELECT c.id as customer_id, c.code, c.name,
                  COALESCE(c.bottle_debt_voi, 0) as debt_voi,
                  COALESCE(c.bottle_debt_up, 0) as debt_up,
                  COALESCE(l.ledger_voi, 0) as ledger_voi,
                  COALESCE(l.ledger_up, 0) as ledger_up
             FROM customers c
             LEFT JOIN (
               SELECT customer_id,
                      SUM(borrowed_voi - returned_voi) as ledger_voi,
                      SUM(borrowed_up - returned_up) as ledger_up
                 FROM customer_bottle_ledgers GROUP BY customer_id
             ) l ON l.customer_id = c.id
            WHERE COALESCE(c.bottle_debt_voi, 0) <> 0 OR COALESCE(c.bottle_debt_up, 0) <> 0
               OR COALESCE(l.ledger_voi, 0) <> 0 OR COALESCE(l.ledger_up, 0) <> 0
            ORDER BY c.id`
        )
        .all() as {
        customer_id: number;
        code: string;
        name: string;
        debt_voi: number;
        debt_up: number;
        ledger_voi: number;
        ledger_up: number;
      }[];

      const customerAudit = customerRows.map((r) => ({
        ...r,
        diff_voi: (Number(r.debt_voi) || 0) - (Number(r.ledger_voi) || 0),
        diff_up: (Number(r.debt_up) || 0) - (Number(r.ledger_up) || 0),
      }));

      // 3. Đơn ghi nợ vỏ cho khách mà sổ vỏ không ghi lần xuất tương ứng.
      const orderRows = db
        .prepare(
          `SELECT o.id as order_id, o.order_code, o.order_date, o.order_type, o.order_status,
                  COALESCE(l.borrowed_voi, 0) as debt_voi,
                  COALESCE(l.borrowed_up, 0) as debt_up,
                  COALESCE(m.out_voi, 0) as out_voi,
                  COALESCE(m.out_up, 0) as out_up
             FROM orders o
             JOIN (
               SELECT order_id, SUM(borrowed_voi) as borrowed_voi, SUM(borrowed_up) as borrowed_up
                 FROM customer_bottle_ledgers WHERE order_id IS NOT NULL GROUP BY order_id
             ) l ON l.order_id = o.id
             LEFT JOIN (
               SELECT order_id,
                      SUM(CASE WHEN bottle_type = 'VOI' THEN quantity ELSE 0 END) as out_voi,
                      SUM(CASE WHEN bottle_type = 'UP' THEN quantity ELSE 0 END) as out_up
                 FROM shell_movements WHERE movement_type = 'OUT' GROUP BY order_id
             ) m ON m.order_id = o.id
            WHERE COALESCE(l.borrowed_voi, 0) <> COALESCE(m.out_voi, 0)
               OR COALESCE(l.borrowed_up, 0) <> COALESCE(m.out_up, 0)
            ORDER BY o.order_date, o.id`
        )
        .all() as {
        order_id: number;
        order_code: string;
        order_date: string;
        order_type: string;
        order_status: string;
        debt_voi: number;
        debt_up: number;
        out_voi: number;
        out_up: number;
      }[];

      const orderAudit = orderRows.map((r) => ({
        ...r,
        diff_voi: (Number(r.debt_voi) || 0) - (Number(r.out_voi) || 0),
        diff_up: (Number(r.debt_up) || 0) - (Number(r.out_up) || 0),
      }));

      // 4. Vỏ của mình đang nằm ở đối tác liên kết.
      const partners = db
        .prepare(
          `SELECT m.partner_unit_id, p.name as partner_unit_name,
                  COALESCE(SUM(CASE WHEN m.bottle_type = 'VOI' THEN m.quantity ELSE 0 END), 0) as voi,
                  COALESCE(SUM(CASE WHEN m.bottle_type = 'UP' THEN m.quantity ELSE 0 END), 0) as up
             FROM partner_shell_movements m
             JOIN partner_units p ON p.id = m.partner_unit_id
            GROUP BY m.partner_unit_id
           HAVING voi <> 0 OR up <> 0
            ORDER BY (voi + up) DESC`
        )
        .all() as { partner_unit_id: number; partner_unit_name: string; voi: number; up: number }[];

      const totals = stockRows.reduce(
        (a, r) => ({
          opening: a.opening + r.opening,
          period_in: a.period_in + r.period_in,
          period_out: a.period_out + r.period_out,
          closing: a.closing + r.closing,
          stock_now: a.stock_now + r.stock_now,
          diff: a.diff + r.diff,
          negative_types: a.negative_types + (r.stock_now < 0 ? 1 : 0),
        }),
        { opening: 0, period_in: 0, period_out: 0, closing: 0, stock_now: 0, diff: 0, negative_types: 0 }
      );

      res.json({
        from,
        to,
        stock_rows: stockRows,
        customer_rows: customerAudit,
        order_rows: orderAudit,
        partners,
        totals: {
          ...totals,
          customer_voi: customerAudit.reduce((a, r) => a + (Number(r.debt_voi) || 0), 0),
          customer_up: customerAudit.reduce((a, r) => a + (Number(r.debt_up) || 0), 0),
          customer_diff: customerAudit.reduce((a, r) => a + Math.abs(r.diff_voi) + Math.abs(r.diff_up), 0),
          customer_mismatch: customerAudit.filter((r) => r.diff_voi !== 0 || r.diff_up !== 0).length,
          partner_total: partners.reduce((a, r) => a + (Number(r.voi) || 0) + (Number(r.up) || 0), 0),
          order_mismatch: orderAudit.length,
        },
      });
    })
  );

  // --- Đối chiếu tiền: số tiền đã thu trên đơn ↔ sổ quỹ (phiếu thu) ↔ cọc vỏ ---
  // Quy tắc ghi sổ quỹ khi đơn hoàn tất (applyCompletionEffects): đơn bán / mượn hàng về bán ghi đúng
  // số đã thu; đơn cho mượn / bốc xếp chỉ ghi phần thực thu của tiền vận chuyển; đơn ghi nợ không ghi.
  // Mọi chênh lệch so với quy tắc này là sai sổ, không phải sai làm tròn.

  const vnd = (value: number) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}₫`;

  const expectedRevenue = (o: { order_type: string; payment_method: string; paid_amount: number; refunded_amount: number; shipping_fee: number }) => {
    const paid = (Number(o.paid_amount) || 0) - (Number(o.refunded_amount) || 0);
    if (o.order_type === 'SALE' || o.order_type === 'BORROW_IN') return paid;
    if (o.order_type === 'LEND_OUT') return Math.min(paid, Number(o.shipping_fee) || 0);
    return Math.min(paid, Number(o.shipping_fee) || 0);
  };

  router.get(
    '/reports/cash-audit',
    handle((req, res) => {
      const q = req.query as Record<string, string | undefined>;
      const to = q.to || today();
      const from = q.from || `${to.slice(0, 7)}-01`;
      const customerId = Number(q.customer_id) || 0;

      const rows = db
        .prepare(
          `SELECT o.id as order_id, o.order_code, o.order_date, o.order_type, o.order_status,
                  o.payment_method, o.payment_status, o.subtotal_amount, o.shipping_fee,
                  o.deposit_amount, o.total_amount, o.paid_amount, COALESCE(ret.returned_amount, 0) as returned_amount,
                  COALESCE(ret.refund_amount, 0) as refunded_amount,
                  c.id as customer_id, c.code as customer_code, c.name as customer_name,
                  o.partner_unit_id, pu.name as partner_name,
                  COALESCE(r.amount, 0) as ledger_revenue,
                  COALESCE(d.collect, 0) as deposit_collect,
                  COALESCE(d.refund, 0) as deposit_refund
             FROM orders o
             JOIN customers c ON c.id = o.customer_id
             LEFT JOIN partner_units pu ON pu.id = o.partner_unit_id
             LEFT JOIN (SELECT order_id, SUM(returned_amount) AS returned_amount, SUM(refund_amount) AS refund_amount
                          FROM order_returns GROUP BY order_id) ret ON ret.order_id = o.id
             LEFT JOIN (SELECT order_id, SUM(amount) as amount FROM revenue_transactions GROUP BY order_id) r ON r.order_id = o.id
             LEFT JOIN (
               SELECT order_id,
                      SUM(CASE WHEN transaction_type = 'COLLECT' THEN amount ELSE 0 END) as collect,
                      SUM(CASE WHEN transaction_type = 'REFUND' THEN amount ELSE 0 END) as refund
                 FROM deposit_transactions WHERE order_id IS NOT NULL GROUP BY order_id
             ) d ON d.order_id = o.id
            WHERE o.order_status IN ('COMPLETED', 'RETURNED')
              AND DATE(o.order_date) >= ? AND DATE(o.order_date) <= ?
              ${customerId ? 'AND o.customer_id = ?' : ''}
            ORDER BY o.order_date, o.id`
        )
        .all(...(customerId ? [from, to, customerId] : [from, to])) as Record<string, string | number>[];

      const orderRows = rows.map((raw) => {
        const o = {
          order_id: Number(raw.order_id),
          order_code: String(raw.order_code),
          order_date: String(raw.order_date),
          order_type: String(raw.order_type),
          order_status: String(raw.order_status),
          payment_method: String(raw.payment_method),
          payment_status: String(raw.payment_status),
          subtotal_amount: Number(raw.subtotal_amount) || 0,
          shipping_fee: Number(raw.shipping_fee) || 0,
          deposit_amount: Number(raw.deposit_amount) || 0,
          total_amount: Number(raw.total_amount) || 0,
          returned_amount: Number(raw.returned_amount) || 0,
          refunded_amount: Number(raw.refunded_amount) || 0,
          paid_amount: Number(raw.paid_amount) || 0,
          customer_id: Number(raw.customer_id),
          customer_code: String(raw.customer_code),
          customer_name: String(raw.customer_name),
          partner_unit_id: Number(raw.partner_unit_id) || null,
          partner_name: raw.partner_name ? String(raw.partner_name) : null,
          ledger_revenue: Number(raw.ledger_revenue) || 0,
          deposit_collect: Number(raw.deposit_collect) || 0,
          deposit_refund: Number(raw.deposit_refund) || 0,
        };
        const expected = expectedRevenue(o);
        const revenueDiff = o.ledger_revenue - expected;
        // Đơn cho mượn / bốc xếp chỉ thu tiền vận chuyển, và total_amount đã phản ánh đúng điều đó
        // (bằng 0 khi bật miễn ship cho khách) — dùng chung một cách tính cho mọi loại đơn.
        const collectible = Math.max(0, o.total_amount - o.returned_amount);
        const netPaid = o.paid_amount - o.refunded_amount;
        const receivable = Math.max(0, collectible - netPaid);
        const depositDiff = o.deposit_collect - o.deposit_amount;
        const issues: string[] = [];
        if (Math.abs(revenueDiff) > 0.5) {
          issues.push(
            revenueDiff < 0
              ? `Sổ quỹ thiếu ${vnd(-revenueDiff)} so với số đã thu trên đơn`
              : `Sổ quỹ thừa ${vnd(revenueDiff)} so với số đã thu trên đơn`
          );
        }
        if (netPaid > collectible + 0.5) {
          issues.push(`Đã thu vượt tổng đơn sau hoàn hàng ${vnd(netPaid - collectible)}`);
        }
        if (collectible > 0) {
          if (o.payment_status === 'PAID' && netPaid + 0.5 < collectible) {
            issues.push(`Trạng thái "Đã thanh toán" nhưng còn thiếu ${vnd(collectible - netPaid)}`);
          }
          if (o.payment_status !== 'PAID' && netPaid >= collectible - 0.5) {
            issues.push('Đã thu đủ tiền nhưng trạng thái chưa phải "Đã thanh toán"');
          }
        }
        if (Math.abs(depositDiff) > 0.5) {
          issues.push(
            depositDiff < 0
              ? `Cọc vỏ thu thiếu ${vnd(-depositDiff)} so với cọc trên đơn`
              : `Cọc vỏ thu thừa ${vnd(depositDiff)} so với cọc trên đơn`
          );
        }
        return { ...o, expected_revenue: expected, revenue_diff: revenueDiff, collectible, receivable, deposit_balance: o.deposit_collect - o.deposit_refund, deposit_diff: depositDiff, issues };
      });

      const byCustomer = new Map<
        number,
        {
          customer_id: number;
          code: string;
          name: string;
          orders: number;
          order_total: number;
          paid_total: number;
          ledger_total: number;
          receivable: number;
          deposit_balance: number;
        }
      >();
      const byPartner = new Map<number, { partner_unit_id: number; name: string; orders: number; fee_total: number; paid_total: number; receivable: number }>();
      for (const r of orderRows) {
        if (r.order_type === 'LEND_OUT' || r.order_type === 'HIRED_LOAD') {
          if (r.partner_unit_id) {
            const g = byPartner.get(r.partner_unit_id) ?? {
              partner_unit_id: r.partner_unit_id, name: r.partner_name ?? `#${r.partner_unit_id}`,
              orders: 0, fee_total: 0, paid_total: 0, receivable: 0,
            };
            g.orders += 1;
            g.fee_total += r.collectible;
            g.paid_total += r.paid_amount - r.refunded_amount;
            g.receivable += r.receivable;
            byPartner.set(r.partner_unit_id, g);
          }
          continue;
        }
        const g = byCustomer.get(r.customer_id) ?? {
          customer_id: r.customer_id,
          code: r.customer_code,
          name: r.customer_name,
          orders: 0,
          order_total: 0,
          paid_total: 0,
          ledger_total: 0,
          receivable: 0,
          deposit_balance: 0,
        };
        g.orders += 1;
        g.order_total += r.collectible;
        g.paid_total += r.paid_amount;
        g.ledger_total += r.ledger_revenue;
        g.receivable += r.receivable;
        g.deposit_balance += r.deposit_balance;
        byCustomer.set(r.customer_id, g);
      }
      const openingDebt = db.prepare('SELECT id, COALESCE(current_debt, 0) as current_debt FROM customers').all() as {
        id: number;
        current_debt: number;
      }[];
      const openingMap = new Map(openingDebt.map((r) => [r.id, Number(r.current_debt) || 0]));
      const customerRows = [...byCustomer.values()]
        .map((g) => ({
          ...g,
          opening_debt: openingMap.get(g.customer_id) ?? 0,
          revenue_diff: g.ledger_total - g.paid_total,
          total_debt: (openingMap.get(g.customer_id) ?? 0) + g.receivable,
        }))
        .sort((a, b) => Math.abs(b.revenue_diff) - Math.abs(a.revenue_diff) || b.total_debt - a.total_debt);

      const totals = orderRows.reduce(
        (a, r) => ({
          orders: a.orders + 1,
          order_total: a.order_total + r.collectible,
          paid_total: a.paid_total + r.paid_amount,
          ledger_total: a.ledger_total + r.ledger_revenue,
          revenue_diff: a.revenue_diff + r.revenue_diff,
          receivable: a.receivable + r.receivable,
          deposit_expected: a.deposit_expected + r.deposit_amount,
          deposit_collect: a.deposit_collect + r.deposit_collect,
          deposit_refund: a.deposit_refund + r.deposit_refund,
          mismatch_orders: a.mismatch_orders + (Math.abs(r.revenue_diff) > 0.5 ? 1 : 0),
          issue_orders: a.issue_orders + (r.issues.length ? 1 : 0),
          issue_count: a.issue_count + r.issues.length,
        }),
        {
          orders: 0,
          order_total: 0,
          paid_total: 0,
          ledger_total: 0,
          revenue_diff: 0,
          receivable: 0,
          deposit_expected: 0,
          deposit_collect: 0,
          deposit_refund: 0,
          mismatch_orders: 0,
          issue_orders: 0,
          issue_count: 0,
        }
      );

      const flagged = orderRows.filter((r) => r.issues.length).sort((a, b) => Math.abs(b.revenue_diff) - Math.abs(a.revenue_diff));
      res.json({ from, to, customer_id: customerId, rows: flagged, customer_rows: customerRows, partner_rows: [...byPartner.values()], totals });
    })
  );

  // --- Bảng lương theo nhân viên: chi tiết tháng + tổng hợp theo tháng trong năm ---

  interface PayrollSourceRow {
    id: number;
    employee_id: number | null;
    employee_name: string | null;
    unit_name: string | null;
    code: string;
    date: string;
    customer_name: string | null;
    note: string;
    amount: number;
  }

  const buildPayrollDetail = (rows: PayrollSourceRow[]): PayrollDetailRow[] => {
    const map = new Map<string, PayrollDetailRow>();
    for (const row of rows) {
      const key = row.employee_id ? `e${row.employee_id}` : 'none';
      const group = map.get(key) ?? {
        employee_id: row.employee_id,
        name: row.employee_name ?? 'Chưa gán nhân viên',
        unit_name: row.unit_name,
        count: 0,
        amount: 0,
        items: [],
      };
      group.count += 1;
      group.amount += Number(row.amount) || 0;
      group.items.push({
        id: row.id,
        code: row.code,
        date: row.date,
        customer_name: row.customer_name ?? '',
        note: row.note,
        amount: Number(row.amount) || 0,
      });
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  };

  const buildPayrollSummary = (year: string, rows: PayrollSourceRow[]): PayrollData['summary'] => {
    const map = new Map<
      string,
      { employee_id: number | null; name: string; unit_name: string | null; totals: number[]; total: number }
    >();
    for (const row of rows) {
      const monthIdx = Number(row.date.slice(5, 7)) - 1;
      if (monthIdx < 0 || monthIdx > 11) continue;
      const key = row.employee_id ? `e${row.employee_id}` : 'none';
      const group = map.get(key) ?? {
        employee_id: row.employee_id,
        name: row.employee_name ?? 'Chưa gán nhân viên',
        unit_name: row.unit_name,
        totals: Array.from({ length: 12 }, () => 0),
        total: 0,
      };
      group.totals[monthIdx] += Number(row.amount) || 0;
      group.total += Number(row.amount) || 0;
      map.set(key, group);
    }
    return { year, rows: [...map.values()].sort((a, b) => b.total - a.total) };
  };

  const payrollData = (loadRows: (from: string, to: string) => PayrollSourceRow[], from: string, to: string): PayrollData => {
    const year = to.slice(0, 4);
    return {
      from,
      to,
      year,
      detail: buildPayrollDetail(loadRows(from, to)),
      summary: buildPayrollSummary(year, loadRows(`${year}-01-01`, `${year}-12-31`)),
    };
  };

  const shippingPayrollRows = (from: string, to: string): PayrollSourceRow[] =>
    shippingShareRows(from, to).map((r) => ({
      id: r.order_id,
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      unit_name: r.unit_name,
      code: r.order_code,
      date: r.order_date,
      customer_name: r.customer_name,
      note: `Giao đơn ${r.order_code}`,
      amount: Number(r.fee) || 0,
    }));

  const servicePayrollRows = (from: string, to: string): PayrollSourceRow[] =>
    (
      db
        .prepare(
          `SELECT sj.id, sj.code, sj.service_date as date, sj.amount, sj.quantity, sj.note,
                  c.name as customer_name, e.id as employee_id, e.full_name as employee_name,
                  ou.name as unit_name, p.name as product_name
           FROM service_jobs sj
           LEFT JOIN customers c ON sj.customer_id = c.id
           LEFT JOIN employees e ON sj.employee_id = e.id
           LEFT JOIN org_units ou ON ou.id = e.org_unit_id
           LEFT JOIN products p ON sj.product_id = p.id
           WHERE sj.service_date >= ? AND sj.service_date <= ?
           ORDER BY sj.service_date, sj.id`
        )
        .all(from, to) as {
        id: number;
        code: string;
        date: string;
        amount: number;
        quantity: number;
        note: string | null;
        customer_name: string | null;
        employee_id: number | null;
        employee_name: string | null;
        unit_name: string | null;
        product_name: string | null;
      }[]
    ).map((r) => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      unit_name: r.unit_name,
      code: r.code,
      date: r.date,
      customer_name: r.customer_name,
      note: [r.product_name, Number(r.quantity) > 1 ? `SL ${r.quantity}` : null, r.note].filter(Boolean).join(' · '),
      amount: Number(r.amount) || 0,
    }));

  const payrollRoutes = (
    base: string,
    loadRows: (from: string, to: string) => PayrollSourceRow[],
    title: string
  ) => {
    router.get(
      `/reports/${base}`,
      handle((req, res) => {
        const { from, to } = resolveReportPeriod(req.query as Record<string, string | undefined>);
        res.json(payrollData(loadRows, from, to));
      })
    );

    router.get(
      `/reports/${base}.xlsx`,
      handle(async (req, res) => {
        const { from, to } = resolveReportPeriod(req.query as Record<string, string | undefined>);
        const buffer = await buildPayrollWorkbook(payrollData(loadRows, from, to), title);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${base}-${from}_${to}.xlsx"`);
        res.send(Buffer.from(buffer));
      })
    );
  };

  payrollRoutes('payroll-shipping', shippingPayrollRows, 'PHÍ VẬN CHUYỂN THEO NHÂN VIÊN');
  payrollRoutes('payroll-service', servicePayrollRows, 'DỊCH VỤ GIA TĂNG THEO NHÂN VIÊN');

  return router;
}
