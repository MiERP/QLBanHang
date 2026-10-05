import ExcelJS from 'exceljs';

const thin = { style: 'thin' as const, color: { argb: 'FF94A3B8' } };
const BORDER: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEBFA' } };

export interface InventoryColumn {
  name: string;
  unit: string;
}

export interface InventoryRow {
  warehouse: string;
  quantities: number[];
  /** Ngày của dòng (YYYY-MM-DD) — có thì bảng thêm cột NGÀY và gộp ô theo từng ngày. */
  date?: string;
}

const dateVn = (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
};

/**
 * Bảng tổng hợp tồn kho theo mẫu đang dùng của xí nghiệp (sheet TỒN TỔNG):
 * mỗi dòng là một kho, mỗi cột là một mặt hàng, khối "TỒN CUỐI" gộp phía trên,
 * cuối bảng có dòng TỔNG theo từng mặt hàng.
 * Khi mỗi dòng có ngày (nhật ký tồn theo ngày) thì thêm cột NGÀY, gộp ô theo ngày.
 */
export async function buildInventoryWorkbook(
  columns: InventoryColumn[],
  rows: InventoryRow[],
  opts: { title: string; subtitle: string; blockHeader?: string; dateColumn?: boolean; totalRow?: boolean }
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QAROMI ERP';
  const ws = wb.addWorksheet('Tồn kho');

  const withDate = Boolean(opts.dateColumn);
  const dateCol = 2;
  const warehouseCol = withDate ? 3 : 2;
  const firstProductCol = warehouseCol + 1;
  const lastProductCol = firstProductCol + columns.length - 1;
  const noteCol = lastProductCol + 1;
  const lastCol = noteCol;
  const letters = (index: number) => ws.getColumn(index).letter;

  ws.columns = [
    { width: 5 },
    ...(withDate ? [{ width: 12 }] : []),
    { width: 30 },
    ...columns.map(() => ({ width: 13 })),
    { width: 26 },
  ];

  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.3, bottom: 0.4, header: 0.3, footer: 0.3 };

  const setCell = (
    addr: string,
    value: ExcelJS.CellValue,
    o: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; border?: boolean; fill?: boolean } = {}
  ) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.font = { name: 'Times New Roman', size: o.size ?? 11, bold: o.bold };
    cell.alignment = { horizontal: o.align ?? 'left', vertical: 'middle', wrapText: true };
    if (o.border) cell.border = BORDER;
    if (o.fill) cell.fill = HEADER_FILL;
    return cell;
  };

  ws.mergeCells(`A1:${letters(lastCol)}1`);
  setCell('A1', 'CÔNG TY CP NƯỚC SẠCH QUẢNG NINH — XÍ NGHIỆP NƯỚC HỒNG GAI', { bold: true, align: 'center', size: 12 });
  ws.mergeCells(`A2:${letters(lastCol)}2`);
  setCell('A2', opts.title.toUpperCase(), { bold: true, align: 'center', size: 14 });
  ws.mergeCells(`A3:${letters(lastCol)}3`);
  setCell('A3', opts.subtitle, { align: 'center', size: 11 });
  ws.getRow(2).height = 22;

  const headRow = 5;
  const subRow = headRow + 1;
  ws.mergeCells(`A${headRow}:A${subRow}`);
  setCell(`A${headRow}`, 'STT', { bold: true, align: 'center', border: true, fill: true });
  if (withDate) {
    ws.mergeCells(`${letters(dateCol)}${headRow}:${letters(dateCol)}${subRow}`);
    setCell(`${letters(dateCol)}${headRow}`, 'NGÀY', { bold: true, align: 'center', border: true, fill: true });
  }
  ws.mergeCells(`${letters(warehouseCol)}${headRow}:${letters(warehouseCol)}${subRow}`);
  setCell(`${letters(warehouseCol)}${headRow}`, 'KHO', { bold: true, align: 'center', border: true, fill: true });

  if (columns.length) {
    ws.mergeCells(`${letters(firstProductCol)}${headRow}:${letters(lastProductCol)}${headRow}`);
  }
  setCell(`${letters(firstProductCol)}${headRow}`, opts.blockHeader ?? 'TỒN CUỐI', { bold: true, align: 'center', border: true, fill: true });
  ws.mergeCells(`${letters(noteCol)}${headRow}:${letters(noteCol)}${subRow}`);
  setCell(`${letters(noteCol)}${headRow}`, 'GHI CHÚ', { bold: true, align: 'center', border: true, fill: true });

  columns.forEach((column, index) => {
    setCell(`${letters(firstProductCol + index)}${subRow}`, column.name, { bold: true, align: 'center', size: 10, border: true, fill: true });
  });
  ws.getRow(headRow).height = 22;
  ws.getRow(subRow).height = 34;

  const totals = columns.map(() => 0);
  let rowIndex = subRow + 1;
  let dayStart = rowIndex;
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const newDay = withDate && (!previous || previous.date !== row.date);
    if (newDay) dayStart = rowIndex;

    setCell(`A${rowIndex}`, index + 1, { align: 'center', border: true });
    if (withDate) {
      // Ngày chỉ ghi ở dòng đầu rồi gộp xuống hết các kho của ngày đó (giống sheet TỒN TỔNG).
      setCell(`${letters(dateCol)}${rowIndex}`, newDay && row.date ? dateVn(row.date) : '', { align: 'center', border: true });
    }
    setCell(`${letters(warehouseCol)}${rowIndex}`, row.warehouse, { border: true });
    columns.forEach((_column, columnIndex) => {
      const quantity = Number(row.quantities[columnIndex]) || 0;
      totals[columnIndex] += quantity;
      const cell = setCell(`${letters(firstProductCol + columnIndex)}${rowIndex}`, quantity, { align: 'right', border: true });
      cell.numFmt = '#,##0';
    });
    setCell(`${letters(noteCol)}${rowIndex}`, '', { border: true });
    rowIndex++;

    const next = rows[index + 1];
    if (withDate && row.date && (!next || next.date !== row.date) && rowIndex - 1 > dayStart) {
      ws.mergeCells(`${letters(dateCol)}${dayStart}:${letters(dateCol)}${rowIndex - 1}`);
    }
  });

  // Nhật ký nhiều ngày thì dòng TỔNG cộng dồn nhiều ngày là vô nghĩa → chỉ dùng cho bản chụp một thời điểm.
  if (opts.totalRow !== false) {
    setCell(`A${rowIndex}`, '', { border: true });
    if (withDate) setCell(`${letters(dateCol)}${rowIndex}`, '', { border: true });
    setCell(`${letters(warehouseCol)}${rowIndex}`, 'TỔNG', { bold: true, align: 'center', border: true });
    totals.forEach((total, columnIndex) => {
      const cell = setCell(`${letters(firstProductCol + columnIndex)}${rowIndex}`, total, { bold: true, align: 'right', border: true });
      cell.numFmt = '#,##0';
      cell.fill = TOTAL_FILL;
    });
    const totalNote = setCell(`${letters(noteCol)}${rowIndex}`, '', { border: true });
    totalNote.fill = TOTAL_FILL;
    ws.getRow(rowIndex).height = 20;
  }

  ws.views = [{ state: 'frozen', xSplit: warehouseCol, ySplit: subRow }];

  return wb.xlsx.writeBuffer();
}
