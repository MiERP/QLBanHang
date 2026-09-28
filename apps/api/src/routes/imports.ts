import express, { Router } from 'express';
import { getDb } from '../db.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { buildTemplateBuffer, readSpecRows, RowErrorCollector } from '../lib/excelTemplate.js';
import { importMasterRows, type ImportMode } from '../lib/importMaster.js';
import { importOrderRows } from '../lib/importOrders.js';
import { IMPORT_SPECS, isImportKind } from '../lib/importSpecs.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function kindFromFile(file: string): string {
  return file.replace(/\.xlsx$/i, '');
}

export function importsRouter(): Router {
  const router = Router();
  const db = getDb();
  // Tệp Excel gửi thẳng trong body (nhị phân) — không cần thư viện upload.
  const rawXlsx = express.raw({ type: () => true, limit: '25mb' });

  router.get(
    '/imports/templates/:file',
    handle(async (req, res) => {
      const kind = kindFromFile(String(req.params.file));
      if (!isImportKind(kind)) throw new ApiError(404, 'Không có mẫu nhập này');
      const spec = IMPORT_SPECS[kind];
      const buffer = await buildTemplateBuffer(spec);
      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader('Content-Disposition', `attachment; filename="${spec.fileName}"`);
      res.send(buffer);
    })
  );

  router.post(
    '/imports/:kind',
    rawXlsx,
    handle(async (req, res) => {
      const kind = String(req.params.kind);
      if (!isImportKind(kind)) throw new ApiError(404, 'Không có mẫu nhập này');
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest('Thiếu tệp Excel cần nhập');
      const mode: ImportMode = req.query.mode === 'upsert' ? 'upsert' : 'strict';
      const rows = await readSpecRows(req.body, IMPORT_SPECS[kind]);
      const errors = new RowErrorCollector();
      const outcome = kind === 'orders' ? importOrderRows(db, rows, errors) : importMasterRows(db, kind, rows, mode);
      res.json({ success: true, kind, ...outcome });
    })
  );

  return router;
}
