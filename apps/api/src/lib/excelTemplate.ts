import ExcelJS from 'exceljs';
import type Database from 'better-sqlite3';
import { ApiError, badRequest } from './http.js';
import type { ImportColumn, ImportSpec } from './importSpecs.js';

export interface RowError {
  row: number;
  message: string;
}

// Gom lỗi theo dòng — chỉ khi không còn lỗi mới ghi dữ liệu (nhập kiểu "được ăn cả, ngã về không").
export class RowErrorCollector {
  readonly errors: RowError[] = [];

  add(row: number, message: string) {
    this.errors.push({ row, message });
  }

  throwIfAny() {
    if (!this.errors.length) return;
    const rowCount = new Set(this.errors.map((e) => e.row)).size;
    const detail =
      this.errors.length === rowCount ? `${rowCount} dòng không hợp lệ` : `${this.errors.length} lỗi thuộc ${rowCount} dòng`;
    throw new ApiError(400, `Tệp có ${detail} — chưa nhập dữ liệu nào`, { errors: this.errors });
  }
}

// Chuẩn hóa để so khớp: bỏ dấu, gộp khoảng trắng, viết thường ("Mã sản phẩm" = "ma san pham").
export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Tiêu đề cột trên tệp mẫu có thêm " *" cho cột bắt buộc — bỏ trước khi so khớp.
const headerKey = (value: unknown) => normalizeKey(value).replace(/\*+$/, '').trim();

export function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dateToIso(value);
  return String(value).replace(/\s+/g, ' ').trim();
}

export function numberOf(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  let s = String(value).replace(/\s/g, '');
  if (!s) return undefined;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function boolOf(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = normalizeKey(value);
  return ['x', 'v', 'co', 'true', '1', 'yes', 'y'].includes(s);
}

export function dateOf(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return dateToIso(value);
  if (typeof value === 'number') return dateToIso(new Date(Date.UTC(1899, 11, 30) + value * 86400000));
  const s = textOf(value);
  if (!s) return undefined;
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : dateToIso(d);
}

export function enumOf(column: ImportColumn, value: unknown): string | undefined {
  const key = normalizeKey(textOf(value));
  if (!key) return undefined;
  const option = (column.enumValues ?? []).find((o) => normalizeKey(o.label) === key || normalizeKey(o.value) === key);
  return option?.value;
}

function pad(value: string) {
  return value.padStart(2, '0');
}

function dateToIso(d: Date) {
  return `${d.getFullYear()}-${pad(String(d.getMonth() + 1))}-${pad(String(d.getDate()))}`;
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value as unknown;
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    if ('result' in record) return record.result ?? null;
    if ('richText' in record) return (record.richText as { text: string }[]).map((r) => r.text).join('');
    if ('text' in record) return record.text;
    if ('error' in record) return null;
  }
  return value;
}

export interface ImportRow {
  row: number;
  cells: Record<string, unknown>;
}

export function requireText(row: ImportRow, errors: RowErrorCollector, key: string, label: string): string {
  const value = textOf(row.cells[key]);
  if (!value) errors.add(row.row, `Thiếu "${label}"`);
  return value;
}

export function requireNumber(row: ImportRow, errors: RowErrorCollector, key: string, label: string): number | undefined {
  const raw = row.cells[key];
  if (textOf(raw) === '') {
    errors.add(row.row, `Thiếu "${label}"`);
    return undefined;
  }
  const value = numberOf(raw);
  if (value === undefined) {
    errors.add(row.row, `"${label}" không phải là số hợp lệ`);
    return undefined;
  }
  return value;
}

export function optionalNumber(row: ImportRow, errors: RowErrorCollector, key: string, label: string): number | undefined {
  const raw = row.cells[key];
  if (textOf(raw) === '') return undefined;
  const value = numberOf(raw);
  if (value === undefined) errors.add(row.row, `"${label}" không phải là số hợp lệ`);
  return value;
}

export function requireEnum(
  row: ImportRow,
  errors: RowErrorCollector,
  column: ImportColumn
): string | undefined {
  const raw = row.cells[column.key];
  if (textOf(raw) === '') {
    errors.add(row.row, `Thiếu "${column.header}"`);
    return undefined;
  }
  const value = enumOf(column, raw);
  if (!value) {
    const allowed = (column.enumValues ?? []).map((o) => o.label).join(', ');
    errors.add(row.row, `"${column.header}" không hợp lệ — chỉ nhận: ${allowed}`);
    return undefined;
  }
  return value;
}

export function optionalEnum(row: ImportRow, errors: RowErrorCollector, column: ImportColumn): string | undefined {
  if (textOf(row.cells[column.key]) === '') return undefined;
  return requireEnum(row, errors, column);
}

export function requireDate(row: ImportRow, errors: RowErrorCollector, key: string, label: string): string | undefined {
  const raw = row.cells[key];
  if (textOf(raw) === '') {
    errors.add(row.row, `Thiếu "${label}"`);
    return undefined;
  }
  const value = dateOf(raw);
  if (!value) errors.add(row.row, `"${label}" không phải ngày hợp lệ (nên ghi DD/MM/YYYY)`);
  return value;
}

export function optionalDate(row: ImportRow, errors: RowErrorCollector, key: string, label: string): string | undefined {
  if (textOf(row.cells[key]) === '') return undefined;
  const value = dateOf(row.cells[key]);
  if (!value) errors.add(row.row, `"${label}" không phải ngày hợp lệ (nên ghi DD/MM/YYYY)`);
  return value;
}

// Đọc sheet dữ liệu đầu tiên theo đúng bộ cột của tệp mẫu (chấp nhận cả tên cột thay thế).
export async function readSpecRows(buffer: Buffer, spec: ImportSpec): Promise<ImportRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    throw badRequest('Không đọc được tệp — chỉ hỗ trợ định dạng .xlsx');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw badRequest('Tệp Excel không có sheet dữ liệu');

  const headerIndex = new Map<string, number>();
  const headerRow = ws.getRow(1);
  for (let c = 1; c <= Math.max(ws.columnCount, 1); c += 1) {
    const key = headerKey(cellValue(headerRow.getCell(c)));
    if (key && !headerIndex.has(key)) headerIndex.set(key, c);
  }

  const columnIndex: Record<string, number> = {};
  const missing: string[] = [];
  for (const column of spec.columns) {
    const names = [column.header, ...(column.aliases ?? [])].map(headerKey);
    const idx = names.map((name) => headerIndex.get(name)).find((value) => value !== undefined);
    if (idx === undefined) {
      if (column.required) missing.push(column.header);
      continue;
    }
    columnIndex[column.key] = idx;
  }
  if (missing.length) throw badRequest(`Tệp thiếu cột bắt buộc: ${missing.join(', ')}`);

  const rows: ImportRow[] = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const cells: Record<string, unknown> = {};
    let hasValue = false;
    for (const [key, idx] of Object.entries(columnIndex)) {
      const value = cellValue(row.getCell(idx));
      cells[key] = value;
      if (value !== null && value !== undefined && textOf(value) !== '') hasValue = true;
    }
    if (hasValue) rows.push({ row: r, cells });
  }
  return rows;
}

export interface RefMap {
  label: string;
  byCode: Map<string, number>;
  byName: Map<string, number>;
}

export function buildRefMap(
  db: Database.Database,
  opts: { table: string; label: string; codeColumn?: string; nameColumn?: string; where?: string }
): RefMap {
  const codeColumn = opts.codeColumn ?? 'code';
  const nameColumn = opts.nameColumn ?? 'name';
  const where = opts.where ?? (codeColumn ? `(${codeColumn} IS NOT NULL OR ${nameColumn} IS NOT NULL)` : `${nameColumn} IS NOT NULL`);
  const rows = db
    .prepare(`SELECT id, ${codeColumn} AS code, ${nameColumn} AS name FROM ${opts.table} WHERE ${where}`)
    .all() as { id: number; code: string | null; name: string | null }[];
  const byCode = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const row of rows) {
    if (row.code) byCode.set(normalizeKey(row.code), row.id);
    if (row.name) byName.set(normalizeKey(row.name), row.id);
  }
  return { label: opts.label, byCode, byName };
}

// Tra cứu theo mã trước, sau đó tới tên (không phân biệt dấu / hoa thường).
export function resolveRef(map: RefMap, value: unknown): number | undefined {
  const key = normalizeKey(value);
  if (!key) return undefined;
  return map.byCode.get(key) ?? map.byName.get(key);
}

export function refId(
  row: ImportRow,
  errors: RowErrorCollector,
  map: RefMap,
  key: string,
  label: string,
  required = false
): number | undefined {
  const value = textOf(row.cells[key]);
  if (!value) {
    if (required) errors.add(row.row, `Thiếu "${label}"`);
    return undefined;
  }
  const id = resolveRef(map, value);
  if (!id) errors.add(row.row, `Không tìm thấy ${map.label} "${value}"`);
  return id;
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C2C6B' } };
const REQUIRED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC62430' } };

export async function buildTemplateBuffer(spec: ImportSpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QAROMI ERP';
  const ws = wb.addWorksheet('Dữ liệu');
  const lastColumn = Math.max(spec.columns.length, 1);

  spec.columns.forEach((column, index) => {
    const col = ws.getColumn(index + 1);
    col.width = Math.min(Math.max(column.header.length + 8, 16), 34);
    if (column.type === 'date') col.numFmt = 'dd/mm/yyyy';
  });

  const header = ws.addRow(spec.columns.map((column) => (column.required ? `${column.header} *` : column.header)));
  header.height = 28;
  header.eachCell((cell, index) => {
    const column = spec.columns[index - 1];
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = column?.required ? REQUIRED_FILL : HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD5ECFA' } } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  spec.columns.forEach((column, index) => {
    if (!column.enumValues?.length) return;
    const formula = `"${column.enumValues.map((o) => o.label).join(',')}"`;
    for (let r = 2; r <= 500; r += 1) {
      ws.getCell(r, index + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [formula] };
    }
  });

  const guide = wb.addWorksheet('Hướng dẫn');
  guide.columns = [{ width: 26 }, { width: 10 }, { width: 48 }, { width: 22 }, { width: 34 }];
  const title = guide.addRow([`MẪU NHẬP: ${spec.title.toUpperCase()}`]);
  title.font = { bold: true, size: 13, color: { argb: 'FF2C2C6B' } };
  guide.addRow([]);
  const guideHeader = guide.addRow(['Cột', 'Bắt buộc', 'Mô tả', 'Ví dụ', 'Giá trị hợp lệ']);
  guideHeader.font = { bold: true };
  guideHeader.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  for (const column of spec.columns) {
    guide.addRow([
      column.header,
      column.required ? 'x' : '',
      column.hint ?? '',
      column.sample ?? '',
      (column.enumValues ?? []).map((o) => o.label).join(' / '),
    ]);
  }
  guide.addRow([]);
  const noteHeader = guide.addRow(['Lưu ý khi nhập']);
  noteHeader.font = { bold: true, color: { argb: 'FFC62430' } };
  for (const note of spec.notes) guide.addRow([note]);
  guide.addRow([]);
  guide.addRow(['Chỉ nhập dữ liệu vào sheet "Dữ liệu". Cột có dấu * là bắt buộc. Không đổi tên cột.']);
  guide.addRow(['Chỉ hỗ trợ tệp .xlsx. Hệ thống kiểm tra toàn bộ tệp trước khi ghi — có lỗi thì không nhập dòng nào.']);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
