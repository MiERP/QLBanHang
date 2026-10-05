import { Router } from 'express';
import { getDb } from '../db.js';
import { readSettings, REPORT_PERIOD_FROM, REPORT_PERIOD_TO, writeSettings } from '../lib/appSettings.js';
import { currentReportPeriod, isValidReportDate } from '../lib/reportPeriod.js';
import { badRequest, handle } from '../lib/http.js';

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
      const patch = (req.body ?? {}) as Record<string, unknown>;
      // Kỳ báo cáo là phạm vi của MỌI báo cáo. Lưu sai định dạng hoặc đảo ngược thì hệ thống âm thầm bỏ
      // qua và rơi về tháng hiện tại — người dùng vẫn thấy "đã lưu" nhưng số liệu là của kỳ khác, nên chặn ngay.
      if (patch[REPORT_PERIOD_FROM] !== undefined || patch[REPORT_PERIOD_TO] !== undefined) {
        const from = String(patch[REPORT_PERIOD_FROM] ?? '').trim();
        const to = String(patch[REPORT_PERIOD_TO] ?? '').trim();
        if (!isValidReportDate(from) || !isValidReportDate(to)) {
          throw badRequest('Kỳ báo cáo phải có ngày bắt đầu và ngày kết thúc hợp lệ (dạng YYYY-MM-DD)');
        }
        if (from > to) throw badRequest('Ngày bắt đầu kỳ báo cáo phải trước hoặc bằng ngày kết thúc');
      }
      writeSettings(db, patch);
      res.json({ success: true, settings: readSettings(db) });
    })
  );

  return router;
}
