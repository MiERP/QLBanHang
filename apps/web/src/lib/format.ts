export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('vi-VN')}₫`;
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('vi-VN');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// SQLite lưu CURRENT_TIMESTAMP theo UTC — thêm 'Z' để hiển thị đúng giờ của máy người dùng.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Tháng/năm ghi dạng mm/yyyy (ngày đầy đủ dùng formatDate → dd/mm/yyyy).
export function formatMonth(month: string | null | undefined): string {
  if (!month) return '—';
  const [y, m] = month.split('-');
  if (!y || !m) return month;
  return `${m}/${y}`;
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
