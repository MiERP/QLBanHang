import { Router } from 'express';
import { getDb } from '../db.js';
import { dateKey, nextCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

export function invoicesRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/invoices',
    handle((_req, res) => {
      const rows = db
        .prepare(
          `SELECT i.*, o.order_code, o.order_date, c.name as customer_name, c.phone as customer_phone,
                  e.full_name as issued_by_name
           FROM invoices i
           LEFT JOIN orders o ON i.order_id = o.id
           LEFT JOIN customers c ON i.customer_id = c.id
           LEFT JOIN employees e ON i.issued_by = e.id
           ORDER BY i.id DESC`
        )
        .all();
      res.json(rows);
    })
  );

  router.post(
    '/invoices',
    handle((req, res) => {
      const body = req.body ?? {};
      const orderId = Number(body.order_id);
      if (!orderId) throw badRequest('Đơn hàng là bắt buộc');

      const result = db.transaction(() => {
        const order = db
          .prepare(
            `SELECT o.*, c.name as customer_name, c.tax_code as customer_tax_code, c.address as customer_address,
                    c.personal_id as customer_personal_id, c.budget_relation_code as customer_budget_relation_code
             FROM orders o JOIN customers c ON o.customer_id = c.id
             WHERE o.id = ?`
          )
          .get(orderId) as Record<string, unknown> | undefined;
        if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng');
        // Hóa đơn chỉ sinh từ đơn đã HOÀN TẤT. Việc chuyển "chưa xuất" -> "đã xuất" do người dùng
        // xác nhận thủ công, không tự động.
        if (order.order_status !== 'COMPLETED')
          throw badRequest('Chỉ xuất hóa đơn cho đơn hàng đã HOÀN TẤT');
        if (order.invoice_status === 'INVOICED') throw badRequest('Đơn hàng đã xuất hóa đơn rồi');

        const invoiceDate = body.invoice_date || today();
        const invoiceCode = nextCode(db, {
          table: 'invoices',
          column: 'invoice_code',
          prefix: `HD-${dateKey(invoiceDate)}-`,
          width: 2,
        });

        const subtotal = Number(order.subtotal_amount) || 0;
        const discount = Number(order.discount_amount) || 0;
        const vatRate = order.is_vat_invoice ? Number(order.vat_rate) || 0 : 0;
        const taxAmount = vatRate > 0 ? Math.round(subtotal * vatRate) / 100 : 0;
        const total = Number(order.total_amount) || 0;

        const insert = db
          .prepare(
            `INSERT INTO invoices (
              invoice_code, invoice_symbol, invoice_template, order_id, customer_id,
              invoice_date, invoice_type, buyer_name, tax_code, address, personal_id, budget_relation_code,
              vat_rate, tax_amount, subtotal_amount, discount_amount, total_amount, issued_by, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            invoiceCode,
            body.invoice_symbol || null,
            body.invoice_template || null,
            orderId,
            Number(order.customer_id),
            invoiceDate,
            order.is_vat_invoice ? 'VAT' : 'RETAIL',
            order.company_name_vat || order.customer_name,
            order.tax_code_vat || order.customer_tax_code,
            order.address_vat || order.customer_address,
            order.personal_id_vat || order.customer_personal_id,
            order.budget_relation_code_vat || order.customer_budget_relation_code,
            vatRate,
            taxAmount,
            subtotal,
            discount,
            total,
            body.issued_by ? Number(body.issued_by) : null,
            body.note || null
          );
        const invoiceId = Number(insert.lastInsertRowid);

        db.prepare(`UPDATE orders SET invoice_status = 'INVOICED' WHERE id = ?`).run(orderId);

        return { success: true, id: invoiceId, invoiceCode };
      })();

      res.json(result);
    })
  );

  return router;
}
