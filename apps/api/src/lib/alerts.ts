import type Database from 'better-sqlite3';
import { stockAlertThreshold } from './appSettings.js';

export interface StockAlertRow {
  id: number;
  warehouse_id: number;
  warehouse_name: string;
  product_id: number;
  product_name: string;
  unit: string | null;
  quantity: number;
  min_stock_alert: number;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  days_left: number;
}

// Nguồn sự thật duy nhất cho cảnh báo tồn kho: chỉ tính kho chứa hàng thật
// (bỏ kho ảo mượn/trung chuyển và nút "Khách hàng"). Ngưỡng lấy từ Cấu hình chung.
export function stockAlertRows(db: Database.Database): StockAlertRow[] {
  const threshold = stockAlertThreshold(db);
  return db
    .prepare(
      `SELECT s.id, s.warehouse_id, w.name as warehouse_name,
              s.product_id, p.name as product_name, p.unit,
              s.quantity, ? as min_stock_alert,
              (CASE
                WHEN s.quantity <= 0 THEN 'CRITICAL'
                WHEN s.quantity <= ? THEN 'HIGH'
                ELSE 'MEDIUM'
              END) as urgency_level,
              ROUND(CAST(s.quantity AS REAL) / MAX(s.avg_daily_sales, 1), 1) as days_left
       FROM inventory_stock s
       JOIN warehouses w ON s.warehouse_id = w.id
       JOIN products p ON s.product_id = p.id
       WHERE w.type IN ('CENTRAL', 'STORE', 'VEHICLE', 'STATION')
         AND (s.quantity <= ? OR s.quantity <= 0)
       ORDER BY s.quantity ASC`
    )
    .all(threshold, threshold, threshold) as StockAlertRow[];
}
