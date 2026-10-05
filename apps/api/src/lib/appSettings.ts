import Database from 'better-sqlite3';

// Cấu hình hệ thống: khai báo MỘT chỗ (khoá · mặc định · giải thích), mọi nơi đọc qua đây.
// Màn "Danh mục hệ thống → Cấu hình chung" hiển thị đúng danh mục này, nên thêm quy tắc mới chỉ cần thêm một dòng.
export interface SettingDef {
  key: string;
  label: string;
  note: string;
  default: string;
  // flag: quy tắc bật/tắt (giá trị '0'/'1'); date: ngày dạng YYYY-MM-DD.
  type?: 'flag' | 'date';
}

// Bật: đơn để trống người giao là đơn miễn ship — không phát sinh tiền công giao hàng.
// Tắt: bắt buộc chọn người giao khi lưu đơn.
export const FREE_SHIP_WITHOUT_SHIPPER = 'free_ship_without_shipper';

// Bật: miễn ship cho khách — khách chỉ trả tiền hàng, phí ship vẫn ghi nhận để trả công giao hàng cuối kỳ.
export const FREE_SHIP_FOR_CUSTOMER = 'free_ship_for_customer';

// Kỳ báo cáo hiện tại: từ ngày → đến ngày. Để trống = tự dùng tháng dương lịch hiện tại.
export const REPORT_PERIOD_FROM = 'report_period_from';
export const REPORT_PERIOD_TO = 'report_period_to';

export const SETTING_DEFS: SettingDef[] = [
  {
    key: FREE_SHIP_WITHOUT_SHIPPER,
    label: 'Đơn không có nhân viên vận chuyển là đơn miễn ship',
    note: 'Bật: đơn để trống người giao được coi là đơn miễn ship — không vào báo cáo phí vận chuyển và bảng lương giao hàng. Tắt: bắt buộc chọn người giao khi lưu đơn.',
    default: '0',
  },
  {
    key: FREE_SHIP_FOR_CUSTOMER,
    label: 'Miễn ship cho khách',
    note: 'Bật: khách chỉ trả tiền hàng, không trả phí ship; phí ship vẫn được tính và ghi nhận để xí nghiệp trả công nhân viên giao hàng cuối kỳ báo cáo.',
    default: '0',
  },
  {
    key: REPORT_PERIOD_FROM,
    label: 'Kỳ báo cáo — từ ngày',
    note: 'Ngày bắt đầu kỳ báo cáo hiện tại. Để trống sẽ dùng ngày đầu tháng dương lịch hiện tại.',
    default: '',
    type: 'date',
  },
  {
    key: REPORT_PERIOD_TO,
    label: 'Kỳ báo cáo — đến ngày',
    note: 'Ngày kết thúc kỳ báo cáo hiện tại. Để trống sẽ dùng ngày cuối tháng dương lịch hiện tại.',
    default: '',
    type: 'date',
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

// Khách có được miễn phí ship (khách chỉ trả tiền hàng, phí ship vẫn tính công giao hàng) không.
export function freeShipForCustomer(db: Database.Database): boolean {
  return settingFlag(db, FREE_SHIP_FOR_CUSTOMER);
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
      // Khoá dạng ngày ghi nguyên giá trị chuỗi (để trống = xoá cấu hình kỳ, rơi về mặc định).
      stmt.run(def.key, def.type === 'date' ? String(patch[def.key] ?? '').trim() : toFlag(patch[def.key]));
    }
  })();
}
