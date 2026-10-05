import { Router } from 'express';
import { getDb } from '../db.js';
import { readSettings, writeSettings } from '../lib/appSettings.js';
import { currentReportPeriod } from '../lib/reportPeriod.js';
import { handle } from '../lib/http.js';

// Cấu hình hệ thống (quy tắc nghiệp vụ bật/tắt) — danh mục khoá nằm ở lib/appSettings.ts.
export function settingsRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/settings',
    handle((_req, res) => {
      res.json(readSettings(db));
    })
  );

  // Kỳ báo cáo hiện tại đã phân giải (từ/đến) — frontend dùng để hiển thị nhãn kỳ ở mọi màn báo cáo.
  router.get(
    '/report-period',
    handle((_req, res) => {
      res.json(currentReportPeriod(db));
    })
  );

  router.put(
    '/settings',
    handle((req, res) => {
      writeSettings(db, (req.body ?? {}) as Record<string, unknown>);
      res.json({ success: true, settings: readSettings(db) });
    })
  );

  return router;
}
