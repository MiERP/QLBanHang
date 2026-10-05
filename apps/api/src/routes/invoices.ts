import { Router } from 'express';
import ExcelJS from 'exceljs';
import { getDb } from '../db.js';
import { dateKey, nextCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';

// Danh sách hóa đơn theo ĐƠN (đã xuất / chưa xuất): chỉ lấy đơn đã HOÀN TẤT, kèm sản phẩm và tổng số lượng.
function invoiceOrderRows(db: ReturnType<typeof getDb>, invoiceStatus: 'INVOICED' | 'NOT_INVOICED') {
  const orders = db
    .prepare(
      `SELECT o.id as order_id, o.order_code, o.total_amount,
              COALESCE(o.delivery_date, o.order_date) as completed_date,
              c.name as customer_name,
              COALESCE(c.contact_person, o.shipping_receiver, '') as contact_person,
              COALESCE(c.phone, o.shipping_phone, '') as phone,
              COALESCE(o.shipping_address, c.address, '') as address
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.order_status = 'COMPLETED' AND o.invoice_status = ?
       ORDER BY COALESCE(o.delivery_date, o.order_date) DESC, o.id DESC`
    )
    .all(invoiceStatus) as {
    order_id: number;
    order_code: string;
    total_amount: number;
    completed_date: string;
    customer_name: string;
    contact_person: string;
    phone: string;
    address: string;
  }[];

  const orderIds = orders.map((o) => o.order_id);
  const productsByOrder = new Map<number, { name: string; quantity: number }[]>();
  if (orderIds.length) {
    const ph = orderIds.map(() => '?').join(',');
    const items = db
      .prepare(
        `SELECT oi.order_id, p.name, oi.quantity
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id IN (${ph}) ORDER BY oi.id ASC`
      )
      .all(...orderIds) as { order_id: number; name: string; quantity: number }[];
    for (const it of items) {
      const list = productsByOrder.get(it.order_id) ?? [];
      list.push({ name: it.name, quantity: Number(it.quantity) || 0 });
      productsByOrder.set(it.order_id, list);
    }
  }

  return orders.map((o) => {
    const products = productsByOrder.get(o.order_id) ?? [];
    return { ...o, products, total_quantity: products.reduce((a, p) => a + p.quantity, 0) };
  });
}

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

  // Danh sách hóa đơn theo ĐƠN (đã xuất / chưa xuất) — dùng cho màn thống kê hóa đơn.
  router.get(
    '/invoices/orders',
    handle((req, res) => {
      const status = req.query.invoice_status === 'INVOICED' ? 'INVOICED' : 'NOT_INVOICED';
      res.json(invoiceOrderRows(db, status));
    })
  );

  // Xuất Excel danh sách hóa đơn theo đơn (đã xuất / chưa xuất) — theo mẫu sản phẩm pivot thành cột.
  router.get(
    '/invoices/orders.xlsx',
    handle(async (req, res) => {
      const status = req.query.invoice_status === 'INVOICED' ? 'INVOICED' : 'NOT_INVOICED';
      const rows = invoiceOrderRows(db, status);

      // Gom các sản phẩm phân biệt (giữ thứ tự xuất hiện) để tạo cột cho từng sản phẩm.
      const productNames: string[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        for (const p of r.products) {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            productNames.push(p.name);
          }
        }
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(status === 'INVOICED' ? 'Hóa đơn đã xuất' : 'Hóa đơn chưa xuất');

      const FIXED = 5; // Ngày hoàn tất, Khách hàng, Người liên hệ, Số điện thoại, Địa chỉ
      const productStart = FIXED + 1;
      const totalCol = productStart + productNames.length;

      // Hàng 1: tiêu đề chính; "Sản phẩm" gộp ngang trên các cột sản phẩm.
      ws.getCell(1, 1).value = 'Ngày hoàn tất';
      ws.getCell(1, 2).value = 'Khách hàng';
      ws.getCell(1, 3).value = 'Người liên hệ';
      ws.getCell(1, 4).value = 'Số điện thoại';
      ws.getCell(1, 5).value = 'Địa chỉ';
      if (productNames.length > 0) {
        ws.mergeCells(1, productStart, 1, totalCol - 1);
        ws.getCell(1, productStart).value = 'Sản phẩm';
      }
      ws.getCell(1, totalCol).value = 'Tổng tiền';

      // Hàng 2: tên từng sản phẩm.
      productNames.forEach((name, i) => {
        ws.getCell(2, productStart + i).value = name;
      });

      // Gộp dọc các ô tiêu đề không phải sản phẩm.
      for (let c = 1; c <= FIXED; c++) ws.mergeCells(1, c, 2, c);
      ws.mergeCells(1, totalCol, 2, totalCol);
      ws.getRow(1).font = { bold: true };
      ws.getRow(2).font = { bold: true };

      for (const r of rows) {
        ws.addRow([
          r.completed_date,
          r.customer_name,
          r.contact_person,
          r.phone,
          r.address,
          ...productNames.map((name) => r.products.find((p) => p.name === name)?.quantity ?? ''),
          Number(r.total_amount) || 0,
        ]);
      }

      ws.getColumn(1).width = 14;
      ws.getColumn(2).width = 38;
      ws.getColumn(3).width = 16;
      ws.getColumn(4).width = 13;
      ws.getColumn(5).width = 36;
      for (let i = 0; i < productNames.length; i++) ws.getColumn(productStart + i).width = 44;
      ws.getColumn(totalCol).width = 16;

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="danh-sach-hoa-don-${status === 'INVOICED' ? 'da-xuat' : 'chua-xuat'}.xlsx"`);
      res.send(Buffer.from(buffer));
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
        if (order.payment_status !== 'PAID') throw badRequest('Đơn hàng chưa thanh toán đủ — không thể xuất hóa đơn');

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
