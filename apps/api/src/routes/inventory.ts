import { Router } from 'express';
import { getDb } from '../db.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { applyStockDelta, getStockQuantity, recordMovement } from '../lib/stock.js';

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
      const alerts = db
        .prepare(
          `SELECT s.*, w.name as warehouse_name, p.name as product_name, p.unit,
                  (CASE
                    WHEN s.quantity <= 0 THEN 'CRITICAL'
                    WHEN s.quantity <= s.min_stock_alert THEN 'HIGH'
                    ELSE 'MEDIUM'
                  END) as urgency_level,
                  ROUND(CAST(s.quantity AS REAL) / MAX(s.avg_daily_sales, 1), 1) as days_left
           FROM inventory_stock s
           JOIN warehouses w ON s.warehouse_id = w.id
           JOIN products p ON s.product_id = p.id
           WHERE s.quantity <= s.min_stock_alert OR s.quantity <= 0
           ORDER BY s.quantity ASC`
        )
        .all();
      res.json(alerts);
    })
  );

  router.get(
    '/inventory/movements',
    handle((req, res) => {
      const { product_id, warehouse_id, movement_type } = req.query as Record<string, string | undefined>;
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (product_id) {
        clauses.push('m.product_id = ?');
        params.push(product_id);
      }
      if (warehouse_id) {
        clauses.push('(m.source_warehouse_id = ? OR m.target_warehouse_id = ?)');
        params.push(warehouse_id, warehouse_id);
      }
      if (movement_type) {
        clauses.push('m.movement_type = ?');
        params.push(movement_type);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT m.*, p.name as product_name, p.unit,
                  sw.name as source_warehouse_name, tw.name as target_warehouse_name,
                  e.full_name as performed_by_name
           FROM stock_movements m
           LEFT JOIN products p ON m.product_id = p.id
           LEFT JOIN warehouses sw ON m.source_warehouse_id = sw.id
           LEFT JOIN warehouses tw ON m.target_warehouse_id = tw.id
           LEFT JOIN employees e ON m.performed_by = e.id
           ${where}
           ORDER BY m.id DESC LIMIT ${limit}`
        )
        .all(...params);
      res.json(rows);
    })
  );

  router.post(
    '/inventory/transfer',
    handle((req, res) => {
      const body = req.body ?? {};
      const sourceId = Number(body.source_warehouse_id);
      const targetId = Number(body.target_warehouse_id);
      const productId = Number(body.product_id);
      const quantity = Number(body.quantity);
      if (!sourceId || !targetId || !productId) throw badRequest('Thiếu thông tin kho nguồn, kho đích hoặc sản phẩm');
      if (sourceId === targetId) throw badRequest('Kho nguồn và kho đích phải khác nhau');
      if (quantity <= 0) throw badRequest('Số lượng điều chuyển phải lớn hơn 0');

      db.transaction(() => {
        const available = getStockQuantity(db, sourceId, productId);
        if (available < quantity) {
          throw badRequest(`Kho nguồn không đủ hàng (hiện có ${available}, cần ${quantity})`);
        }
        applyStockDelta(db, { warehouseId: sourceId, productId, delta: -quantity });
        applyStockDelta(db, { warehouseId: targetId, productId, delta: quantity, allowNegative: true });
        recordMovement(db, {
          movementType: 'TRANSFER_OUT',
          productId,
          quantity,
          sourceWarehouseId: sourceId,
          targetWarehouseId: targetId,
          performedBy: body.employee_id ? Number(body.employee_id) : null,
          note: body.note || 'Điều chuyển kho nội bộ',
        });
        recordMovement(db, {
          movementType: 'TRANSFER_IN',
          productId,
          quantity,
          sourceWarehouseId: sourceId,
          targetWarehouseId: targetId,
          performedBy: body.employee_id ? Number(body.employee_id) : null,
          note: body.note || 'Điều chuyển kho nội bộ',
        });
      })();

      res.json({ success: true });
    })
  );

  router.put(
    '/inventory/stock/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const row = db.prepare(`SELECT * FROM inventory_stock WHERE id = ?`).get(id) as
        | { id: number; quantity: number; warehouse_id: number; product_id: number }
        | undefined;
      if (!row) throw new ApiError(404, 'Không tìm thấy bản ghi tồn kho');

      db.transaction(() => {
        if (body.quantity !== undefined) {
          const next = Number(body.quantity);
          const delta = next - row.quantity;
          if (delta !== 0) {
            applyStockDelta(db, { warehouseId: row.warehouse_id, productId: row.product_id, delta, allowNegative: true });
            recordMovement(db, {
              movementType: 'ADJUSTMENT',
              productId: row.product_id,
              quantity: Math.abs(delta),
              targetWarehouseId: row.warehouse_id,
              performedBy: body.employee_id ? Number(body.employee_id) : null,
              note: body.note || `Điều chỉnh tồn từ ${row.quantity} → ${next}`,
            });
          }
        }
        const sets: string[] = [];
        const values: unknown[] = [];
        for (const key of ['quantity', 'min_stock_alert', 'avg_daily_sales']) {
          if (body[key] === undefined) continue;
          sets.push(`${key} = ?`);
          values.push(Number(body[key]));
        }
        if (sets.length) {
          sets.push('last_updated = CURRENT_TIMESTAMP');
          values.push(id);
          db.prepare(`UPDATE inventory_stock SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        }
      })();

      res.json({ success: true, id });
    })
  );

  return router;
}
