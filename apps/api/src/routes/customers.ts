import { Router } from 'express';
import ExcelJS from 'exceljs';
import { getDb } from '../db.js';
import { customerCode, today } from '../lib/codes.js';
import { ORDER_DEBT_EXPR, TOTAL_DEBT_EXPR } from '../lib/customerDebt.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { returnCustomerShells, shellDepositFees, writeOffCustomerShells } from '../lib/shells.js';

export function customersRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/customers',
    handle((req, res) => {
      const search = req.query.search as string | undefined;
      // Kèm số dư cọc vỏ đang giữ (đã thu − đã hoàn) để đối chiếu với nợ vỏ của khách.
      let query = `SELECT c.*, g.name as group_name,
                          ${ORDER_DEBT_EXPR} as order_debt,
                          ${TOTAL_DEBT_EXPR} as total_debt,
                          COALESCE((SELECT SUM(CASE WHEN d.transaction_type = 'COLLECT' THEN d.amount ELSE -d.amount END)
                                    FROM deposit_transactions d WHERE d.customer_id = c.id), 0) as deposit_balance
                   FROM customers c
                   LEFT JOIN customer_groups g ON c.group_id = g.id
                   WHERE c.is_active = 1`;
      const params: unknown[] = [];
      if (search) {
        query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.tax_code LIKE ? OR c.code LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      query += ` ORDER BY (c.bottle_debt_voi + c.bottle_debt_up) DESC, c.id ASC`;
      const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
      const { feeVoi, feeUp } = shellDepositFees(db);
      res.json(
        rows.map((row) => {
          const shellValue = (Number(row.bottle_debt_voi) || 0) * feeVoi + (Number(row.bottle_debt_up) || 0) * feeUp;
          return {
            ...row,
            shell_value: shellValue,
            shell_deposit_diff: (Number(row.deposit_balance) || 0) - shellValue,
          };
        })
      );
    })
  );

  router.post(
    '/customers',
    handle((req, res) => {
      const body = req.body ?? {};
      if (!body.name || !body.address) {
        throw badRequest('Tên và địa chỉ khách hàng là bắt buộc');
      }
      const code = body.code || customerCode(db);
      const insert = db
        .prepare(
          `INSERT INTO customers
            (group_id, code, name, phone, address, tax_code, contact_person, personal_id, budget_relation_code, max_debt_limit, current_debt, bottle_debt_voi, bottle_debt_up, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`
        )
        .run(
          body.group_id ? Number(body.group_id) : null,
          code,
          body.name,
          body.phone || '',
          body.address,
          body.tax_code || '',
          body.contact_person || '',
          body.personal_id || '',
          body.budget_relation_code || '',
          Number(body.max_debt_limit) || 10000000,
          Number(body.bottle_debt_voi) || 0,
          Number(body.bottle_debt_up) || 0
        );
      res.json({ success: true, id: Number(insert.lastInsertRowid), code });
    })
  );

  router.put(
    '/customers/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const allowed = [
        'group_id',
        'name',
        'phone',
        'address',
        'tax_code',
        'contact_person',
        'personal_id',
        'budget_relation_code',
        'max_debt_limit',
        'current_debt',
        'bottle_debt_voi',
        'bottle_debt_up',
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
      const result = db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy khách hàng');
      res.json({ success: true, id });
    })
  );

  router.delete(
    '/customers/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const result = db.prepare(`UPDATE customers SET is_active = 0 WHERE id = ?`).run(id);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy khách hàng');
      res.json({ success: true, id });
    })
  );

  router.get(
    '/customers/bottle-ledgers',
    handle((req, res) => {
      const cId = req.query.customer_id as string | undefined;
      let query = `SELECT l.*, c.name as customer_name, c.phone as customer_phone,
                          e.full_name as handler_name, o.order_code
                   FROM customer_bottle_ledgers l
                   JOIN customers c ON l.customer_id = c.id
                   LEFT JOIN employees e ON l.handled_by = e.id
                   LEFT JOIN orders o ON l.order_id = o.id`;
      const params: unknown[] = [];
      if (cId) {
        query += ` WHERE l.customer_id = ?`;
        params.push(cId);
      }
      query += ` ORDER BY l.id DESC LIMIT 200`;
      res.json(db.prepare(query).all(...params));
    })
  );

  router.post(
    '/customers/:id/bottle-return',
    handle((req, res) => {
      const customerId = Number(req.params.id);
      const body = req.body ?? {};
      // Thu hồi vỏ đi qua đúng một cơ chế dùng chung: giảm nợ vỏ + ghi sổ vỏ + hoàn cọc theo loại vỏ.
      const result = db.transaction(() =>
        returnCustomerShells(db, {
          customerId,
          shellsVoi: Number(body.returned_voi) || 0,
          shellsUp: Number(body.returned_up) || 0,
          date: String(body.transaction_date || today()),
          note: String(body.note || 'Thu hồi vỏ bình (không kèm đơn hàng)'),
          handledBy: body.handled_by ? Number(body.handled_by) : null,
          paymentMethod: String(body.payment_method || 'CASH'),
          refundDeposit: body.refund_deposit !== false,
        })
      )();
      res.json({
        success: true,
        remaining_voi: result.newVoi,
        remaining_up: result.newUp,
        deposit_refund: result.refundAmount,
      });
    })
  );

  // Tất toán vỏ: thu hồi TOÀN BỘ vỏ khách đang giữ + hoàn cọc trong một lần.
  router.post(
    '/customers/:id/settle-shells',
    handle((req, res) => {
      const customerId = Number(req.params.id);
      const body = req.body ?? {};
      const result = db.transaction(() => {
        const customer = db.prepare('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?').get(customerId) as
          | { bottle_debt_voi: number; bottle_debt_up: number }
          | undefined;
        if (!customer) throw new ApiError(404, 'Không tìm thấy khách hàng');
        const shellsVoi = Number(customer.bottle_debt_voi) || 0;
        const shellsUp = Number(customer.bottle_debt_up) || 0;
        if (!shellsVoi && !shellsUp) throw badRequest('Khách không còn nợ vỏ để tất toán');
        return {
          shellsVoi,
          shellsUp,
          result: returnCustomerShells(db, {
            customerId,
            shellsVoi,
            shellsUp,
            date: String(body.transaction_date || today()),
            note: String(body.note || 'Tất toán vỏ bình'),
            handledBy: body.handled_by ? Number(body.handled_by) : null,
            paymentMethod: String(body.payment_method || 'CASH'),
          }),
        };
      })();
      res.json({
        success: true,
        shells_voi: result.shellsVoi,
        shells_up: result.shellsUp,
        remaining_voi: result.result.newVoi,
        remaining_up: result.result.newUp,
        deposit_refund: result.result.refundAmount,
      });
    })
  );

  // Vỏ khách không trả lại (mất vỏ / mua đứt / bồi thường): giảm nợ vỏ nhưng GIỮ lại tiền cọc.
  router.post(
    '/customers/:id/shell-writeoff',
    handle((req, res) => {
      const customerId = Number(req.params.id);
      const body = req.body ?? {};
      const result = db.transaction(() =>
        writeOffCustomerShells(db, {
          customerId,
          shellsVoi: Number(body.shells_voi) || 0,
          shellsUp: Number(body.shells_up) || 0,
          date: String(body.transaction_date || today()),
          reason: String(body.reason || 'Vỏ không trả lại'),
          note: String(body.note ?? ''),
          handledBy: body.handled_by ? Number(body.handled_by) : null,
        })
      )();
      res.json({ success: true, ...result });
    })
  );

  // --- Công nợ khách hàng: nợ đầu kỳ + số còn phải thu của đơn bán/mượn đã hoàn tất ---
  interface CustomerDebtOrderRow {
    order_id: number;
    order_code: string;
    order_date: string;
    order_status: string;
    order_type: string;
    total_amount: number;
    paid_amount: number;
    outstanding: number;
    payment_status: string;
    payment_method: string;
    invoice_status: string;
  }

  interface CustomerDebtRow {
    customer_id: number;
    code: string;
    name: string;
    phone: string | null;
    max_debt_limit: number;
    opening_debt: number;
    order_debt: number;
    total_debt: number;
    orders: CustomerDebtOrderRow[];
  }

  const customerDebtData = () => {
    const customers = db
      .prepare(
        `SELECT id as customer_id, code, name, phone,
                COALESCE(current_debt, 0) as opening_debt, COALESCE(max_debt_limit, 0) as max_debt_limit
         FROM customers WHERE is_active = 1`
      )
      .all() as { customer_id: number; code: string; name: string; phone: string | null; opening_debt: number; max_debt_limit: number }[];

    const orderRows = db
      .prepare(
        `SELECT id as order_id, customer_id, order_code, order_date, order_status, order_type,
                total_amount, paid_amount, payment_status, payment_method, invoice_status,
                total_amount - COALESCE(ret.returned_amount, 0) - paid_amount + COALESCE(ret.refund_amount, 0) AS outstanding
         FROM orders o
         LEFT JOIN (SELECT order_id, SUM(returned_amount) AS returned_amount, SUM(refund_amount) AS refund_amount
                    FROM order_returns GROUP BY order_id) ret ON ret.order_id = o.id
         WHERE o.order_status IN ('COMPLETED', 'RETURNED') AND o.order_type IN ('SALE', 'BORROW_IN')
           AND (total_amount - COALESCE(ret.returned_amount, 0) - paid_amount + COALESCE(ret.refund_amount, 0)) > 0.5
         ORDER BY order_date ASC, id ASC`
      )
      .all() as (Omit<CustomerDebtOrderRow, 'outstanding'> & { customer_id: number; outstanding: number })[];

    const ordersByCustomer = new Map<number, CustomerDebtOrderRow[]>();
    for (const row of orderRows) {
      const list = ordersByCustomer.get(row.customer_id) ?? [];
      list.push({ ...row, outstanding: Math.max(0, Number(row.outstanding) || 0) });
      ordersByCustomer.set(row.customer_id, list);
    }

    const byCustomer: CustomerDebtRow[] = [];
    for (const customer of customers) {
      const orders = ordersByCustomer.get(customer.customer_id) ?? [];
      const orderDebt = orders.reduce((a, o) => a + o.outstanding, 0);
      const totalDebt = (Number(customer.opening_debt) || 0) + orderDebt;
      if (totalDebt <= 0.5) continue;
      byCustomer.push({ ...customer, order_debt: orderDebt, total_debt: totalDebt, orders });
    }
    byCustomer.sort((a, b) => b.total_debt - a.total_debt);

    const totals = byCustomer.reduce(
      (a, row) => ({
        customers: a.customers + 1,
        orders: a.orders + row.orders.length,
        opening_debt: a.opening_debt + row.opening_debt,
        order_debt: a.order_debt + row.order_debt,
        total_debt: a.total_debt + row.total_debt,
        over_limit_customers: a.over_limit_customers + (row.max_debt_limit > 0 && row.total_debt > row.max_debt_limit ? 1 : 0),
        over_limit_amount: a.over_limit_amount + Math.max(0, row.total_debt - (row.max_debt_limit || 0)),
      }),
      { customers: 0, orders: 0, opening_debt: 0, order_debt: 0, total_debt: 0, over_limit_customers: 0, over_limit_amount: 0 }
    );
    return { byCustomer, totals };
  };

  router.get(
    '/customers/receivables',
    handle((_req, res) => {
      res.json(customerDebtData());
    })
  );

  router.get(
    '/customers/receivables.xlsx',
    handle(async (_req, res) => {
      const data = customerDebtData();
      const wb = new ExcelJS.Workbook();
      const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } as Partial<ExcelJS.Borders>;
      const put = (ws: ExcelJS.Worksheet, addr: string, value: ExcelJS.CellValue, opts: { bold?: boolean; align?: 'left' | 'right' } = {}) => {
        const cell = ws.getCell(addr);
        cell.value = value;
        cell.font = { name: 'Times New Roman', size: 11, bold: opts.bold };
        cell.alignment = { horizontal: opts.align ?? 'left', vertical: 'middle', wrapText: true };
        if (typeof value === 'number') cell.numFmt = '#,##0';
        return cell;
      };

      const ws1 = wb.addWorksheet('Tổng hợp theo khách hàng');
      ws1.columns = [{ width: 34 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }];
      put(ws1, 'A1', 'CÔNG NỢ PHẢI THU — KHÁCH HÀNG', { bold: true });
      const head1 = ['Khách hàng', 'Mã KH', 'SĐT', 'Số đơn nợ', 'Nợ đầu kỳ', 'Nợ theo đơn', 'Tổng nợ', 'Vượt hạn mức'];
      head1.forEach((h, i) => {
        const cell = put(ws1, `${ws1.getColumn(i + 1).letter}2`, h, { bold: true, align: i >= 3 ? 'right' : 'left' });
        cell.border = border;
      });
      let r = 3;
      for (const row of data.byCustomer) {
        const over = Math.max(0, row.total_debt - (row.max_debt_limit || 0));
        [row.name, row.code, row.phone ?? '', row.orders.length, row.opening_debt, row.order_debt, row.total_debt, over].forEach((v, i) => {
          const cell = put(ws1, `${ws1.getColumn(i + 1).letter}${r}`, v, { align: i >= 3 ? 'right' : 'left' });
          cell.border = border;
        });
        r += 1;
      }
      ['TỔNG CỘNG', '', '', data.totals.orders, data.totals.opening_debt, data.totals.order_debt, data.totals.total_debt, data.totals.over_limit_amount].forEach(
        (v, i) => {
          const cell = put(ws1, `${ws1.getColumn(i + 1).letter}${r}`, v, { bold: true, align: i >= 3 ? 'right' : 'left' });
          cell.border = border;
        }
      );

      const ws2 = wb.addWorksheet('Chi tiết đơn còn nợ');
      ws2.columns = [{ width: 34 }, { width: 18 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }];
      put(ws2, 'A1', 'CHI TIẾT ĐƠN CÒN NỢ CỦA KHÁCH HÀNG', { bold: true });
      const head2 = ['Khách hàng', 'Mã đơn', 'Ngày', 'Loại đơn', 'Tổng đơn', 'Đã thu', 'Còn lại', 'Trạng thái TT', 'Hóa đơn'];
      head2.forEach((h, i) => {
        const cell = put(ws2, `${ws2.getColumn(i + 1).letter}2`, h, { bold: true, align: i >= 4 && i <= 6 ? 'right' : 'left' });
        cell.border = border;
      });
      let r2 = 3;
      for (const customer of data.byCustomer) {
        for (const order of customer.orders) {
          [
            customer.name,
            order.order_code,
            order.order_date,
            order.order_type === 'BORROW_IN' ? 'Mượn hàng về bán' : 'Bán hàng',
            Number(order.total_amount) || 0,
            Number(order.paid_amount) || 0,
            order.outstanding,
            order.payment_status === 'PARTIAL' ? 'Thu một phần' : 'Chưa thu',
            order.invoice_status === 'INVOICED' ? 'Đã xuất' : 'Chưa xuất',
          ].forEach((v, i) => {
            const cell = put(ws2, `${ws2.getColumn(i + 1).letter}${r2}`, v as ExcelJS.CellValue, { align: i >= 4 && i <= 6 ? 'right' : 'left' });
            cell.border = border;
          });
          r2 += 1;
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="cong-no-khach-hang.xlsx"');
      res.send(Buffer.from(buffer));
    })
  );

  return router;
}
