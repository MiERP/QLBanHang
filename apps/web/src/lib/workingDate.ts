import { useEffect, useState } from 'react';
import { todayISO } from './format';

// Ngày nhập liệu chung (working date): các phiếu mới mặc định theo ngày này.
// Mặc định là hôm nay; người dùng đổi ở góc phải thanh trên cùng (ví dụ lùi về hôm qua
// để nhập liệu bù). Lưu ở trình duyệt và phát sự kiện để mọi màn đang mở cập nhật theo.
const KEY = 'qaromi-working-date';
const EVENT = 'qaromi-working-date';

export function getWorkingDate(): string {
  try {
    const value = localStorage.getItem(KEY);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  } catch {
    // localStorage bị tắt — dùng ngày hôm nay
  }
  return todayISO();
}

export function setWorkingDate(date: string) {
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  try {
    localStorage.setItem(KEY, clean);
  } catch {
    // bỏ qua
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: clean }));
}

// Trạng thái ngày nhập liệu, tự cập nhật khi đổi ở thanh trên cùng.
export function useWorkingDate(): string {
  const [date, setDate] = useState(getWorkingDate());
  useEffect(() => {
    const handler = (e: Event) => setDate((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return date;
}
