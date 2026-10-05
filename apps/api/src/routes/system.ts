import express, { Router } from 'express';
import ExcelJS from 'exceljs';
import { getDb, resetDatabase } from '../db.js';
import { badRequest, handle } from '../lib/http.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function appTables(db: ReturnType<typeof getDb>): string[] {
  return (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[])
    .map((t) => t.name);
}

function tableColumns(db: ReturnType<typeof getDb>, table: string): string[] {
  return (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name);
}

// Ngày/giờ Excel → chuỗi SQLite: chỉ ngày khi không có phần giờ, ngược lại kèm giờ.
function excelDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  const time = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  return time === '00:00:00' ? date : `${date} ${time}`;
}

// Ô Excel → giá trị SQLite. Chuỗi rỗng giữ nguyên '' (ExcelJS phân biệt được với ô trống = NULL);
// công thức lấy kết quả; rich text ghép lại; boolean quy về 1/0.
function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return excelDate(value);
  if (typeof value === 'object') {
    if ('result' in value) return cellValue((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
    return null;
  }
  return null;
}

interface TableResult {
  table: string;
  inserted: number;
  updated: number;
  // Cột có trong CSDL nhưng thiếu trong tệp — dữ liệu cột đó sẽ về mặc định/NULL.
  missing: string[];
}

// Quản trị CSDL: đưa về mặc định, sao lưu toàn bộ ra Excel và khôi phục lại từ file đó.
export function systemRouter(): Router {
  const router = Router();
  const db = getDb();
  const rawXlsx = express.raw({ type: () => true, limit: '50mb' });

  router.post(
    '/system/reset-database',
    handle((_req, res) => {
      resetDatabase();
      res.json({ success: true });
    })
  );

  // Xuất toàn bộ dữ liệu ra Excel — mỗi bảng một sheet (dùng để sao lưu hằng ngày).
  router.get(
    '/system/export.xlsx',
    handle(async (_req, res) => {
      const wb = new ExcelJS.Workbook();
      for (const table of appTables(db)) {
        const columns = tableColumns(db, table);
        const rows = db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
        const ws = wb.addWorksheet(table);
        ws.addRow(columns);
        ws.getRow(1).font = { bold: true };
        for (const row of rows) {
          ws.addRow(columns.map((c) => (row[c] === undefined ? null : row[c])));
        }
      }
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader('Content-Disposition', `attachment; filename="qaromi-backup-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.send(Buffer.from(buffer));
    })
  );

  // Khôi phục dữ liệu từ file Excel đã xuất: ghi đè toàn bộ bảng có trong file.
  router.post(
    '/system/import',
    rawXlsx,
    handle(async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest('Thiếu tệp Excel cần nhập');
      const wb = new ExcelJS.Workbook();
      try {
        await wb.xlsx.load(req.body as unknown as Parameters<typeof wb.xlsx.load>[0]);
      } catch {
        throw badRequest('Không đọc được tệp — hãy dùng đúng tệp Excel do hệ thống xuất ra (.xlsx)');
      }
      const tables = new Set(appTables(db));
      const results: TableResult[] = [];

      db.pragma('foreign_keys = OFF');
      try {
        db.transaction(() => {
          for (const ws of wb.worksheets) {
            if (!tables.has(ws.name)) continue;
            const header = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((v) => String(v ?? '').trim());
            const tableInfo = db.prepare(`PRAGMA table_info("${ws.name}")`).all() as { name: string; notnull: number; pk: number }[];
            const tableCols = new Map(tableInfo.map((c) => [c.name, c.notnull === 1]));
            const cols = header.filter((h) => tableCols.has(h));
            if (!cols.length) continue;
            const missing = [...tableCols.keys()].filter((c) => !header.includes(c));

            // Khoá chính của bảng (id, hoặc key/notification_id với bảng khoá chữ): dùng để biết
            // dòng nào đã có thì CẬP NHẬT, dòng nào chưa có (hoặc không ghi khoá) thì THÊM MỚI.
            const pkCol = tableInfo.find((c) => c.pk === 1)?.name;
            const pkIndex = pkCol ? cols.indexOf(pkCol) : -1;
            const updateCols = pkCol ? cols.filter((c) => c !== pkCol) : [];
            const indexOf = new Map(cols.map((c, i) => [c, i] as const));

            const insertStmt = db.prepare(
              `INSERT INTO "${ws.name}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
            );
            const existsStmt = pkIndex >= 0 ? db.prepare(`SELECT 1 FROM "${ws.name}" WHERE "${pkCol}" = ?`) : null;
            const updateStmt =
              pkIndex >= 0 && updateCols.length
                ? db.prepare(
                    `UPDATE "${ws.name}" SET ${updateCols.map((c) => `"${c}" = ?`).join(', ')} WHERE "${pkCol}" = ?`
                  )
                : null;

            let inserted = 0;
            let updated = 0;
            for (let r = 2; r <= ws.rowCount; r++) {
              const row = ws.getRow(r);
              const values = cols.map((col) => {
                const value = cellValue(row.getCell(header.indexOf(col) + 1).value);
                // Ô trống ở cột NOT NULL chỉ có thể là chuỗi rỗng (Excel không phân biệt được với NULL).
                return value === null && tableCols.get(col) ? '' : value;
              });
              if (values.every((v) => v === null)) continue;

              const pkValue = pkIndex >= 0 ? values[pkIndex] : null;
              if (existsStmt && updateStmt && pkValue !== null && existsStmt.get(pkValue)) {
                updateStmt.run(...updateCols.map((c) => values[indexOf.get(c) as number]), pkValue);
                updated++;
                continue;
              }
              insertStmt.run(...values);
              inserted++;
            }
            results.push({ table: ws.name, inserted, updated, missing });
          }
        })();
      } finally {
        db.pragma('foreign_keys = ON');
      }
      if (!results.length) {
        throw badRequest('Tệp không có bảng nào khớp với hệ thống — hãy dùng đúng tệp Excel do chức năng "Xuất toàn bộ dữ liệu" tạo ra');
      }
      const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
      const updated = results.reduce((sum, r) => sum + r.updated, 0);
      res.json({ success: true, inserted, updated, results });
    })
  );

  return router;
}
