import Database from 'better-sqlite3';
import { today } from './codes.js';

// Thuế suất GTGT hiệu lực tại một ngày — danh mục vat_rates, đổi luật chỉ thêm dòng mới.
export function vatRateAt(db: Database.Database, date: string = today()): number {
  const row = db
    .prepare(
      `SELECT rate FROM vat_rates
       WHERE (effective_from IS NULL OR effective_from = '' OR effective_from <= ?)
         AND (effective_to IS NULL OR effective_to = '' OR effective_to >= ?)
       ORDER BY effective_from DESC LIMIT 1`
    )
    .get(date, date) as { rate: number } | undefined;
  return Number(row?.rate) || 0;
}

// Giá trước thuế = giá bán ÷ (1 + thuế suất), làm tròn đến đồng (khớp quy tắc tính doanh thu trước thuế).
export function netPrice(grossPrice: number, rate: number): number {
  return Math.round(Number(grossPrice || 0) / (1 + rate / 100));
}

// Tiền hàng TRƯỚC THUẾ của một đơn: đơn giá trên đơn là giá bán đã gồm VAT nên phải suy ngược
// về đơn giá chưa thuế (làm tròn đến đồng) rồi mới nhân số lượng — đúng bằng cách báo cáo
// thương mại tính, nhờ vậy hóa đơn và báo cáo không lệch nhau vài đồng.
export function orderGoodsNet(db: Database.Database, orderId: number, rate: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(quantity * ROUND(unit_price / (1 + ? / 100.0))), 0) AS net
       FROM order_items WHERE order_id = ?`
    )
    .get(rate, orderId) as { net: number } | undefined;
  return Math.round(Number(row?.net) || 0);
}
