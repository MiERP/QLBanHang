import { Router } from 'express';
import { getDb } from '../db.js';
import { dispatchCode, orderCode, revenueCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { applyStockDelta, getStockQuantity, recordMovement } from '../lib/stock.js';

interface RawItem {
  product_id: number;
  quantity: number;
  quantity_promo?: number;
  unit_price?: number;
  note?: string;
}

export function ordersRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/orders',
    handle((req, res) => {
      const { from, to, status } = req.query as Record<string, string | undefined>;
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      let query = `SELECT o.*,
                          c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                          s.full_name as seller_name,
                          sh.full_name as shipper_name,
                          w.name as warehouse_name
                   FROM orders o
                   JOIN customers c ON o.customer_id = c.id
                   JOIN employees s ON o.seller_employee_id = s.id
                   LEFT JOIN employees sh ON o.shipper_employee_id = sh.id
                   JOIN warehouses w ON o.warehouse_id = w.id`;
      const params: unknown[] = [];
      const clauses: string[] = [];
      if (from) {
        clauses.push('o.order_date >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('o.order_date <= ?');
        params.push(to);
      }
      if (status) {
        clauses.push('o.order_status = ?');
        params.push(status);
      }
      if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
      query += ` ORDER BY o.id DESC LIMIT ${limit}`;

      const orders = db.prepare(query).all(...params) as Record<string, unknown>[];
      const getItems = db.prepare(
        `SELECT oi.*, p.name as product_name, p.unit, p.bottle_type
         FROM order_items oi JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
      );
      res.json(orders.map((o) => ({ ...o, items: getItems.all(o.id as number) })));
    })
  );

  router.post(
    '/orders',
    handle((req, res) => {
      const body = req.body ?? {};
      const items: RawItem[] = Array.isArray(body.items) ? body.items : [];
      if (!body.customer_id) throw badRequest('Khách hàng là bắt buộc');
      if (!body.seller_employee_id) throw badRequest('Nhân viên bán hàng là bắt buộc');
      if (!body.warehouse_id) throw badRequest('Kho xuất hàng là bắt buộc');
      if (items.length === 0) throw badRequest('Đơn hàng phải có ít nhất một mặt hàng');

      const orderDate = body.order_date || today();
      const shippingFee = Number(body.shipping_fee) || 0;
      const discountAmount = Number(body.discount_amount) || 0;
      const depositAmount = Number(body.deposit_amount) || 0;

      const result = db.transaction(() => {
        const warehouseId = Number(body.warehouse_id);
        const normalized = items.map((item) => {
          const product = db
            .prepare(`SELECT id, name, standard_price, bottle_type FROM products WHERE id = ?`)
            .get(Number(item.product_id)) as
            | { id: number; name: string; standard_price: number; bottle_type: string }
            | undefined;
          if (!product) throw badRequest(`Không tìm thấy sản phẩm #${item.product_id}`);
          const quantity = Number(item.quantity) || 0;
          const promo = Number(item.quantity_promo) || 0;
          if (quantity <= 0) throw badRequest(`Số lượng của "${product.name}" phải lớn hơn 0`);
          const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : product.standard_price;
          return {
            product,
            quantity,
            promo,
            unitPrice,
            totalPrice: quantity * unitPrice,
            totalQty: quantity + promo,
            note: item.note,
          };
        });

        // Kiểm tra đủ tồn trước khi thao tác
        for (const item of normalized) {
          const available = getStockQuantity(db, warehouseId, item.product.id);
          if (available < item.totalQty) {
            throw badRequest(
              `Không đủ tồn kho cho "${item.product.name}" (hiện có ${available}, cần ${item.totalQty})`
            );
          }
        }

        const subtotal = normalized.reduce((acc, i) => acc + i.totalPrice, 0);
        const total = subtotal + shippingFee - discountAmount;
        const paymentMethod = body.payment_method || 'CASH';
        let paymentStatus = body.payment_status;
        if (!paymentStatus) paymentStatus = paymentMethod === 'DEBT' ? 'UNPAID' : 'PAID';
        const paidAmount =
          paymentStatus === 'PAID' ? total : paymentStatus === 'UNPAID' ? 0 : Number(body.paid_amount) || 0;

        const shipperId = body.shipper_employee_id ? Number(body.shipper_employee_id) : null;
        const orderStatus = body.order_status || (shipperId ? 'DISPATCHED' : 'DELIVERED');
        const code = orderCode(db, orderDate);

        const insert = db
          .prepare(
            `INSERT INTO orders (
              order_code, customer_id, seller_employee_id, shipper_employee_id, warehouse_id,
              order_date, delivery_date, order_status, payment_status, payment_method,
              is_vat_invoice, vat_rate, vat_number, company_name_vat, tax_code_vat, address_vat,
              subtotal_amount, shipping_fee, discount_amount, deposit_amount, total_amount, paid_amount, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            code,
            Number(body.customer_id),
            Number(body.seller_employee_id),
            shipperId,
            warehouseId,
            orderDate,
            body.delivery_date || orderDate,
            orderStatus,
            paymentStatus,
            paymentMethod,
            body.is_vat_invoice ? 1 : 0,
            Number(body.vat_rate) || 0,
            body.vat_number || null,
            body.company_name_vat || null,
            body.tax_code_vat || null,
            body.address_vat || null,
            subtotal,
            shippingFee,
            discountAmount,
            depositAmount,
            total,
            paidAmount,
            body.note || ''
          );
        const orderId = Number(insert.lastInsertRowid);

        const itemStmt = db.prepare(
          `INSERT INTO order_items (order_id, product_id, quantity, quantity_promo, unit_price, total_price, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );

        let borrowedVoi = 0;
        let borrowedUp = 0;
        for (const item of normalized) {
          itemStmt.run(orderId, item.product.id, item.quantity, item.promo, item.unitPrice, item.totalPrice, item.note ?? '');
          applyStockDelta(db, { warehouseId, productId: item.product.id, delta: -item.totalQty });
          recordMovement(db, {
            movementType: 'EXPORT_ORDER',
            productId: item.product.id,
            quantity: item.quantity,
            quantityPromo: item.promo,
            sourceWarehouseId: warehouseId,
            referenceId: orderId,
            performedBy: shipperId ?? Number(body.seller_employee_id),
            note: `Xuất bán theo đơn ${code}`,
          });
          if (item.product.bottle_type === 'VOI') borrowedVoi += item.totalQty;
          if (item.product.bottle_type === 'UP') borrowedUp += item.totalQty;
        }

        const returnedVoi = Number(body.returned_shells_voi ?? body.returned_bottles_voi) || 0;
        const returnedUp = Number(body.returned_shells_up ?? body.returned_bottles_up) || 0;

        if (borrowedVoi || borrowedUp || returnedVoi || returnedUp) {
          const customer = db
            .prepare(`SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?`)
            .get(Number(body.customer_id)) as { bottle_debt_voi: number; bottle_debt_up: number } | undefined;
          const newVoi = Math.max(0, (customer?.bottle_debt_voi ?? 0) + borrowedVoi - returnedVoi);
          const newUp = Math.max(0, (customer?.bottle_debt_up ?? 0) + borrowedUp - returnedUp);
          db.prepare(`UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?`).run(
            newVoi,
            newUp,
            Number(body.customer_id)
          );
          db.prepare(
            `INSERT INTO customer_bottle_ledgers
              (customer_id, order_id, transaction_date, borrowed_voi, borrowed_up, returned_voi, returned_up,
               remaining_balance_voi, remaining_balance_up, handled_by, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            Number(body.customer_id),
            orderId,
            orderDate,
            borrowedVoi,
            borrowedUp,
            returnedVoi,
            returnedUp,
            newVoi,
            newUp,
            shipperId ?? Number(body.seller_employee_id),
            body.note || 'Giao hàng và đối soát vỏ bình'
          );
        }

        if (paidAmount > 0 && paymentMethod !== 'DEBT') {
          db.prepare(
            `INSERT INTO revenue_transactions
              (transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note)
             VALUES (?, 'WATER_SALE', ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            revenueCode(db, orderDate),
            orderId,
            Number(body.customer_id),
            paidAmount,
            paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
            shipperId ?? Number(body.seller_employee_id),
            orderDate,
            `Thu tiền đơn ${code}`
          );
        }

        if (shipperId) {
          db.prepare(
            `INSERT INTO delivery_dispatches
              (dispatch_code, order_id, shipper_employee_id, warehouse_id, shipping_fee, stair_carrying_allowance, status, note)
             VALUES (?, ?, ?, ?, ?, 0, 'ASSIGNED', ?)`
          ).run(
            dispatchCode(db, orderDate),
            orderId,
            shipperId,
            warehouseId,
            shippingFee,
            `Điều phối giao đơn ${code}`
          );
        }

        return { success: true, orderId, orderCode: code, total };
      })();

      res.json(result);
    })
  );

  router.put(
    '/orders/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'order_status',
        'payment_status',
        'payment_method',
        'shipper_employee_id',
        'warehouse_id',
        'delivery_date',
        'vat_rate',
        'vat_number',
        'company_name_vat',
        'tax_code_vat',
        'address_vat',
        'is_vat_invoice',
        'shipping_fee',
        'discount_amount',
        'note',
        'paid_amount',
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
      const result = db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/orders/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const order = db
        .prepare(`SELECT * FROM orders WHERE id = ?`)
        .get(id) as Record<string, unknown> | undefined;
      if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
      if (order.order_status === 'CANCELLED') {
        return res.json({ success: true, id, alreadyCancelled: true });
      }

      const warehouseId = Number(order.warehouse_id);
      const customerId = Number(order.customer_id);

      db.transaction(() => {
        const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(id) as Record<string, unknown>[];
        for (const item of items) {
          const totalQty = Number(item.quantity) + Number(item.quantity_promo || 0);
          applyStockDelta(db, {
            warehouseId,
            productId: Number(item.product_id),
            delta: totalQty,
            allowNegative: true,
          });
          recordMovement(db, {
            movementType: 'IMPORT',
            productId: Number(item.product_id),
            quantity: Number(item.quantity),
            quantityPromo: Number(item.quantity_promo || 0),
            targetWarehouseId: warehouseId,
            referenceId: id,
            note: `Hoàn kho do hủy đơn ${order.order_code}`,
          });
        }

        const ledgers = db
          .prepare(`SELECT * FROM customer_bottle_ledgers WHERE order_id = ?`)
          .all(id) as Record<string, unknown>[];
        if (ledgers.length) {
          const customer = db
            .prepare(`SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?`)
            .get(customerId) as { bottle_debt_voi: number; bottle_debt_up: number };
          let voi = customer.bottle_debt_voi;
          let up = customer.bottle_debt_up;
          for (const l of ledgers) {
            voi = Math.max(0, voi - Number(l.borrowed_voi) + Number(l.returned_voi));
            up = Math.max(0, up - Number(l.borrowed_up) + Number(l.returned_up));
          }
          db.prepare(`UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?`).run(voi, up, customerId);
          db.prepare(`DELETE FROM customer_bottle_ledgers WHERE order_id = ?`).run(id);
        }

        db.prepare(`DELETE FROM revenue_transactions WHERE order_id = ?`).run(id);
        db.prepare(
          `DELETE FROM delivery_settlements WHERE dispatch_id IN (SELECT id FROM delivery_dispatches WHERE order_id = ?)`
        ).run(id);
        db.prepare(`DELETE FROM delivery_dispatches WHERE order_id = ?`).run(id);
        db.prepare(`UPDATE orders SET order_status = 'CANCELLED' WHERE id = ?`).run(id);
      })();

      res.json({ success: true, id });
    })
  );

  return router;
}
