import { Router } from 'express';
import { getDb } from '../db.js';
import { productCode } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { applyStockDelta, recordMovement } from '../lib/stock.js';
import { netPrice, vatRateAt } from '../lib/vat.js';

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
      // Bỏ trống giá trước thuế → tự suy ra từ giá bán và thuế suất đang hiệu lực.
      const providedCost = Number(body.cost_price);
      const costPrice =
        body.cost_price === undefined || body.cost_price === null || body.cost_price === '' || !Number.isFinite(providedCost)
          ? netPrice(standardPrice, vatRateAt(db))
          : providedCost;
      const result = db.transaction(() => {
        const category = db
          .prepare(`SELECT type FROM categories WHERE id = ?`)
          .get(Number(body.category_id) || 1) as { type: string } | undefined;
        const categoryType = category?.type ?? '';
        const unit = body.unit || (categoryType === 'PACK_WATER' ? 'Vỉ' : 'Bình');
        // Phân loại: GOODS = hàng bán (có tồn kho, lên đơn được); SERVICE = dịch vụ (không tồn kho, không lên đơn).
        const productType = body.product_type === 'SERVICE' ? 'SERVICE' : 'GOODS';
        const isService = productType === 'SERVICE';

        // Chỉ bình nước (nhóm BOTTLE_WATER, đơn vị Bình) mới có loại vỏ Vòi/Úp và cọc vỏ.
        const bottleType =
          !isService && categoryType === 'BOTTLE_WATER' && unit === 'Bình'
            ? body.bottle_type === 'UP'
              ? 'UP'
              : 'VOI'
            : 'NONE';
        const depositFee = bottleType === 'NONE' ? 0 : Number(body.deposit_fee) || 0;

        const insert = db
          .prepare(
            `INSERT INTO products
              (category_id, code, barcode, name, unit, product_type, bottle_type, standard_price, wholesale_price, cost_price, deposit_fee, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
          )
          .run(
            Number(body.category_id) || 1,
            code,
            body.barcode || null,
            body.name,
            unit,
            productType,
            bottleType,
            standardPrice,
            standardPrice,
            costPrice,
            depositFee
          );
        const productId = Number(insert.lastInsertRowid);
        const warehouseId = Number(body.warehouse_id) || 1;
        const initialQty = isService ? 0 : Number(body.initial_stock) || 0;
        if (initialQty > 0) {
          applyStockDelta(db, { warehouseId, productId, delta: initialQty, allowNegative: true });
          const prodSource = (db.prepare(`SELECT id FROM import_sources WHERE code = 'SRC_PARENT'`).get() ??
            db.prepare(`SELECT id FROM import_sources WHERE code = 'SRC_PRODUCTION'`).get()) as { id: number } | undefined;
          recordMovement(db, {
            movementType: 'IMPORT',
            productId,
            quantity: initialQty,
            targetWarehouseId: warehouseId,
            sourceId: prodSource?.id ?? null,
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
      const body = { ...(req.body ?? {}) } as Record<string, unknown>;
      // Giá trước thuế luôn đi theo giá bán: nếu chỉ gửi giá bán thì tự tính lại theo thuế suất hiện hành.
      if (body.standard_price !== undefined && body.cost_price === undefined) {
        body.cost_price = netPrice(Number(body.standard_price) || 0, vatRateAt(db));
      }
      const allowed = [
        'category_id',
        'code',
        'barcode',
        'name',
        'unit',
        'product_type',
        'bottle_type',
        'standard_price',
        'cost_price',
        'deposit_fee',
        'is_active',
      ];
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      // Dịch vụ không có vỏ bình / cọc vỏ.
      if (body.product_type === 'SERVICE') {
        sets.push(`bottle_type = 'NONE'`, 'deposit_fee = 0');
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
