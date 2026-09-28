import Database from 'better-sqlite3';

// Cấu hình hệ thống: khai báo MỘT chỗ (khoá · mặc định · giải thích), mọi nơi đọc qua đây.
// Màn "Danh mục hệ thống → Cấu hình chung" hiển thị đúng danh mục này, nên thêm quy tắc mới chỉ cần thêm một dòng.
export interface SettingDef {
  key: string;
  label: string;
  note: string;
  default: string;
}

// Bật: đơn để trống người giao là đơn miễn ship — không phát sinh tiền công giao hàng.
// Tắt: bắt buộc chọn người giao khi lưu đơn.
export const FREE_SHIP_WITHOUT_SHIPPER = 'free_ship_without_shipper';

export const SETTING_DEFS: SettingDef[] = [
  {
    key: FREE_SHIP_WITHOUT_SHIPPER,
    label: 'Đơn không có nhân viên vận chuyển là đơn miễn ship',
    note: 'Bật: đơn để trống người giao được coi là đơn miễn ship — không vào báo cáo phí vận chuyển và bảng lương giao hàng. Tắt: bắt buộc chọn người giao khi lưu đơn.',
    default: '0',
  },
];

const DEFAULT_VALUES = new Map(SETTING_DEFS.map((def) => [def.key, def.default]));

// Giá trị đang dùng của mọi khoá đã khai báo; khoá chưa có trong CSDL (hoặc chưa từng đặt) lấy mặc định.
export function readSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
  const stored = new Map(rows.map((row) => [String(row.key), String(row.value)]));
  return Object.fromEntries(SETTING_DEFS.map((def) => [def.key, stored.get(def.key) ?? def.default]));
}

export function settingValue(db: Database.Database, key: string): string {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? String(row.value) : (DEFAULT_VALUES.get(key) ?? '');
}

export function settingFlag(db: Database.Database, key: string): boolean {
  return settingValue(db, key) === '1';
}

// Đơn không gán người giao có được coi là đơn miễn ship không.
export function freeShipWithoutShipper(db: Database.Database): boolean {
  return settingFlag(db, FREE_SHIP_WITHOUT_SHIPPER);
}

// Nhận cả boolean lẫn chuỗi '0'/'1' từ client — chuỗi '0' vẫn là TẮT nên không được dựa vào truthy của JS.
function toFlag(value: unknown): string {
  return value === false || value === 0 || value === '0' || value === '' || value === null || value === undefined ? '0' : '1';
}

// Chỉ ghi các khoá đã khai báo; giá trị quy về '0' / '1' để so sánh một kiểu duy nhất.
export function writeSettings(db: Database.Database, patch: Record<string, unknown>) {
  const stmt = db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  );
  db.transaction(() => {
    for (const def of SETTING_DEFS) {
      if (!(def.key in patch)) continue;
      stmt.run(def.key, toFlag(patch[def.key]));
    }
  })();
}
