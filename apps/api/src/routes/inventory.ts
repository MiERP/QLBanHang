import { Router } from 'express';
import { getDb } from '../db.js';
import { badRequest, handle } from '../lib/http.js';
import { stockAlertRows } from '../lib/alerts.js';
import { buildInventoryWorkbook, type InventoryColumn, type InventoryRow } from '../lib/inventoryExcel.js';

// Kho chứa hàng thật: bỏ kho ảo (trung chuyển / mượn) và nút "Khách hàng".
const STOCK_WAREHOUSE_FILTER = `type NOT IN ('VIRTUAL', 'CUSTOMER')`;

type Db = ReturnType<typeof getDb>;

interface StockCell {
  warehouse_id: number;
  product_id: number;
  quantity: number;
}

const cellKey = (warehouseId: number, productId: number) => `${warehouseId}-${productId}`;

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const addDays = (iso: string, diff: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
};

const dateVn = (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
};

// Khoảng ngày hợp lệ, tối đa 120 ngày để bảng nhật ký không phình vô hạn.
const MAX_DAYS = 120;

function dayRange(fromValue: unknown, toValue: unknown): { from: string; to: string } {
  if (!isDate(fromValue) || !isDate(toValue)) throw badRequest('Khoảng ngày không hợp lệ (cần dạng YYYY-MM-DD)');
  if (fromValue > toValue) throw badRequest('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
  const days = Math.round((Date.parse(`${toValue}T00:00:00Z`) - Date.parse(`${fromValue}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > MAX_DAYS) throw badRequest(`Chỉ xem được tối đa ${MAX_DAYS} ngày mỗi lần (đang chọn ${days} ngày)`);
  return { from: fromValue, to: toValue };
}

/**
 * Số lượng tồn của mọi cặp kho × mặt hàng vào CUỐI TỪNG NGÀY trong khoảng [from, to].
 * Đi ngược từ hôm nay: tồn cuối ngày D = tồn hiện tại − tổng biến động ghi SAU ngày D,
 * nên ngày cuối cùng luôn khớp bảng tồn đang chạy và không phụ thuộc sổ bút toán cũ.
 */
function stockByDay(db: Db, from: string, to: string): Map<string, Map<string, number>> {
  const live = db.prepare('SELECT warehouse_id, product_id, quantity FROM inventory_stock').all() as StockCell[];
  const liveMap = new Map(live.map((row) => [cellKey(row.warehouse_id, row.product_id), Number(row.quantity) || 0]));

  const movements = db
    .prepare(
      `SELECT day, warehouse_id, product_id, SUM(delta) AS delta FROM (
         SELECT date(created_at) AS day, target_warehouse_id AS warehouse_id, product_id,
                quantity + COALESCE(quantity_promo, 0) AS delta
           FROM stock_movements WHERE target_warehouse_id IS NOT NULL AND date(created_at) > ?
         UNION ALL
         SELECT date(created_at) AS day, source_warehouse_id AS warehouse_id, product_id,
                -(quantity + COALESCE(quantity_promo, 0)) AS delta
           FROM stock_movements WHERE source_warehouse_id IS NOT NULL AND date(created_at) > ?
       ) GROUP BY day, warehouse_id, product_id`
    )
    .all(from, from) as { day: string; warehouse_id: number; product_id: number; delta: number }[];

  const byDay = new Map<string, Map<string, number>>();
  for (const row of movements) {
    const key = cellKey(row.warehouse_id, row.product_id);
    const dayMap = byDay.get(row.day) ?? new Map<string, number>();
    dayMap.set(key, (dayMap.get(key) ?? 0) + (Number(row.delta) || 0));
    byDay.set(row.day, dayMap);
  }

  const addDay = (target: Map<string, number>, dayMap: Map<string, number> | undefined) => {
    if (!dayMap) return;
    for (const [key, delta] of dayMap) target.set(key, (target.get(key) ?? 0) + delta);
  };

  // Biến động của các ngày SAU ngày đang xét (kể cả sau `to`).
  const running = new Map<string, number>();
  for (const day of [...byDay.keys()].sort().reverse()) if (day > to) addDay(running, byDay.get(day));

  const result = new Map<string, Map<string, number>>();
  for (let day = to; day >= from; day = addDays(day, -1)) {
    const snapshot = new Map<string, number>();
    for (const [key, quantity] of liveMap) snapshot.set(key, quantity - (running.get(key) ?? 0));
    result.set(day, snapshot);
    addDay(running, byDay.get(day));
  }
  return result;
}

export function inventoryRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/inventory/stock',
    handle((req, res) => {
      const wId = req.query.warehouse_id;
      let query = `SELECT s.*,
                          w.name as warehouse_name, w.code as warehouse_code,
                          p.name as product_name, p.code as product_code, p.unit, p.bottle_type, p.standard_price,
                          (CASE
                            WHEN s.quantity <= 0 THEN 'CRITICAL'
                            WHEN s.quantity <= s.min_stock_alert THEN 'HIGH'
                            WHEN s.quantity <= (s.avg_daily_sales * 5) THEN 'MEDIUM'
                            ELSE 'NORMAL'
                          END) as urgency_level,
                          ROUND(CAST(s.quantity AS REAL) / MAX(s.avg_daily_sales, 1), 1) as days_left
                   FROM inventory_stock s
                   JOIN warehouses w ON s.warehouse_id = w.id
                   JOIN products p ON s.product_id = p.id`;
      const params: unknown[] = [];
      if (wId) {
        query += ` WHERE s.warehouse_id = ?`;
        params.push(wId);
      }
      query += ` ORDER BY s.quantity ASC`;
      res.json(db.prepare(query).all(...params));
    })
  );

  // Nhật ký tồn theo ngày: mỗi ngày × mỗi kho một dòng, số liệu là tồn CUỐI ngày đó.
  router.get(
    '/inventory/stock-daily',
    handle((req, res) => {
      const { from, to } = dayRange(req.query.from, req.query.to);
      const byDay = stockByDay(db, from, to);
      const rows: { date: string; warehouse_id: number; product_id: number; quantity: number }[] = [];
      for (const date of [...byDay.keys()].sort()) {
        for (const [key, quantity] of byDay.get(date)!) {
          const [warehouseId, productId] = key.split('-').map(Number);
          rows.push({ date, warehouse_id: warehouseId, product_id: productId, quantity });
        }
      }
      res.json({ from, to, rows });
    })
  );

  router.get(
    '/inventory/alerts',
    handle((_req, res) => {
      res.json(stockAlertRows(db));
    })
  );

  // Xuất tồn kho ra Excel theo mẫu đang dùng của xí nghiệp: mỗi dòng là một kho,
  // mỗi mặt hàng một cột, khối "TỒN CUỐI" và dòng TỔNG cuối bảng.
  // Có from/to thì xuất NHẬT KÝ THEO NGÀY (thêm cột NGÀY gộp ô, như sheet TỒN TỔNG).
  router.get(
    '/inventory/stock.xlsx',
    handle(async (req, res) => {
      const { from, to } = req.query;
      const range = from !== undefined || to !== undefined ? dayRange(from, to) : null;

      const products = db
        .prepare(
          `SELECT id, name, unit FROM products
           WHERE COALESCE(product_type, 'GOODS') <> 'SERVICE'
           ORDER BY category_id, id`
        )
        .all() as { id: number; name: string; unit: string }[];
      const warehouses = db
        .prepare(`SELECT id, name FROM warehouses WHERE ${STOCK_WAREHOUSE_FILTER} ORDER BY id`)
        .all() as { id: number; name: string }[];
      const columns: InventoryColumn[] = products.map((p) => ({ name: p.name, unit: p.unit }));
      const today = new Date().toISOString().slice(0, 10);

      if (range) {
        const byDay = stockByDay(db, range.from, range.to);
        const rows: InventoryRow[] = [];
        for (const date of [...byDay.keys()].sort()) {
          const quantities = byDay.get(date)!;
          for (const warehouse of warehouses) {
            rows.push({
              date,
              warehouse: warehouse.name,
              quantities: products.map((p) => quantities.get(cellKey(warehouse.id, p.id)) ?? 0),
            });
          }
        }
        const buffer = await buildInventoryWorkbook(columns, rows, {
          title: 'Nhật ký tồn kho theo ngày',
          subtitle: `Tồn cuối mỗi ngày — ${rows.length} dòng (${dateVn(range.from)} → ${dateVn(range.to)}), ${columns.length} mặt hàng`,
          blockHeader: 'TỒN CUỐI',
          dateColumn: true,
          totalRow: false,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="ton-kho-${range.from}_${range.to}.xlsx"`);
        res.send(Buffer.from(buffer));
        return;
      }

      const quantities = new Map(
        (db.prepare(`SELECT warehouse_id, product_id, quantity FROM inventory_stock`).all() as StockCell[]).map((s) => [
          cellKey(s.warehouse_id, s.product_id),
          Number(s.quantity) || 0,
        ])
      );
      const rows: InventoryRow[] = warehouses.map((w) => ({
        warehouse: w.name,
        quantities: products.map((p) => quantities.get(cellKey(w.id, p.id)) ?? 0),
      }));
      const [y, m, d] = today.split('-');
      const buffer = await buildInventoryWorkbook(columns, rows, {
        title: 'Tổng hợp tồn kho',
        subtitle: `Tồn hiện tại đến hết ngày ${d}/${m}/${y} — ${rows.length} kho × ${columns.length} mặt hàng`,
        blockHeader: 'TỒN CUỐI',
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ton-kho-${today}.xlsx"`);
      res.send(Buffer.from(buffer));
    })
  );

  return router;
}
