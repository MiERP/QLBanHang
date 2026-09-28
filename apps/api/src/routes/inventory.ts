import { Router } from 'express';
import { getDb } from '../db.js';
import { handle } from '../lib/http.js';
import { stockAlertRows } from '../lib/alerts.js';

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

  router.get(
    '/inventory/alerts',
    handle((_req, res) => {
      res.json(stockAlertRows(db));
    })
  );

  return router;
}
