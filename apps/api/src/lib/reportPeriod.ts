import type Database from 'better-sqlite3';
import { REPORT_PERIOD_FROM, REPORT_PERIOD_TO, settingValue } from './appSettings.js';
import { today } from './codes.js';

// Kỳ báo cáo hiện tại là NGUỒN DUY NHẤT để gom doanh thu/chi phí/lương/vỏ/cọc trong toàn hệ thống.
// Ưu tiên lấy từ cấu hình (report_period_from → report_period_to); chưa cấu hình thì rơi về tháng dương lịch hiện tại.
export interface ReportPeriod {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  label: string; // "YYYY-MM-DD → YYYY-MM-DD"
  key: string; // "YYYY-MM-DD..YYYY-MM-DD" — định danh kỳ (dùng cho chỉ tiêu doanh thu)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Ngày nghiệp vụ hợp lệ (đúng định dạng và tồn tại thật). Dùng chung cho lúc lưu cấu hình kỳ báo cáo
// để không lưu được một kỳ sai rồi bị hệ thống âm thầm bỏ qua.
export function isValidReportDate(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!DATE_RE.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === text;
}

// Tháng dương lịch chứa `date` (mặc định khi chưa cấu hình kỳ).
function calendarMonth(date: string): { from: string; to: string } {
  const prefix = date.slice(0, 7);
  const [y, m] = prefix.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}` };
}

export function currentReportPeriod(db: Database.Database): ReportPeriod {
  const from = settingValue(db, REPORT_PERIOD_FROM);
  const to = settingValue(db, REPORT_PERIOD_TO);
  const range = isValidReportDate(from) && isValidReportDate(to) && from <= to
    ? { from, to }
    : calendarMonth(today());
  return { from: range.from, to: range.to, label: `${range.from} → ${range.to}`, key: `${range.from}..${range.to}` };
}
