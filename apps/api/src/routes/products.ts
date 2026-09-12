import { Router } from 'express';
import { getDb } from '../db.js';
import { productCode } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { applyStockDelta, recordMovement } from '../lib/stock.js';

export function productsRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/products',
    handle((_req, res) => {
      const products = db
        .prepare(
          `SELECT p.*, c.name as category_name, c.type as category_type
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE p.is_active = 1
           ORDER BY p.category_id ASC, p.id ASC`
        )
        .all();
      res.json(products);
    })
  );

  router.post(
    '/products',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.name || body.standard_price === undefined) {
        throw badRequest('Tên sản phẩm và giá bán là bắt buộc');
      }
      const code = body.code || productCode(db);
      const standardPrice = Number(body.standard_price);
      const result = db.transaction(() => {
        const insert = db
          .prepare(
            `INSERT INTO products
              (category_id, code, name, unit, bottle_type, standard_price, wholesale_price, cost_price, deposit_fee, has_shell_cycle, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
          )
          .run(
            Number(body.category_id) || 1,
            code,
            body.name,
            body.unit || 'Bình',
            body.bottle_type || 'NONE',
            standardPrice,
            Number(body.wholesale_price) || standardPrice,
            Number(body.cost_price) || standardPrice * 0.6,
            Number(body.deposit_fee) || 0,
            body.has_shell_cycle ? 1 : 0
          );
        const productId = Number(insert.lastInsertRowid);
        const warehouseId = Number(body.warehouse_id) || 1;
        const initialQty = Number(body.initial_stock) || 0;
        if (initialQty > 0) {
          applyStockDelta(db, { warehouseId, productId, delta: initialQty, allowNegative: true });
          recordMovement(db, {
            movementType: 'IMPORT',
            productId,
            quantity: initialQty,
            targetWarehouseId: warehouseId,
            note: 'Tồn kho khởi tạo khi tạo sản phẩm',
          });
        }
        return { success: true, id: productId, code };
      })();
      res.json(result);
    })
  );

  router.put(
    '/products/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'category_id',
        'code',
        'name',
        'unit',
        'bottle_type',
        'standard_price',
        'wholesale_price',
        'cost_price',
        'deposit_fee',
        'has_shell_cycle',
        'is_active',
      ];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (sets.length === 0) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy sản phẩm');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/products/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`UPDATE products SET is_active = 0 WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy sản phẩm');
      res.json({ success: true, id });
    })
  );

  return router;
}
