import { Router } from 'express';
import { getDb } from '../db.js';
import { branchLoanCode, today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { applyStockDelta, getStockQuantity, recordMovement } from '../lib/stock.js';

export function branchLoansRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/branch-loans',
    handle((_req, res) => {
      const loans = db
        .prepare(
          `SELECT l.*, b.name as partner_branch_name, b.code as partner_branch_code,
                  w.name as warehouse_name, e.full_name as carrier_name
           FROM branch_loans l
           JOIN partner_branches b ON l.partner_branch_id = b.id
           JOIN warehouses w ON l.warehouse_id = w.id
           LEFT JOIN employees e ON l.carrier_employee_id = e.id
           ORDER BY l.id DESC`
        )
        .all() as Record<string, unknown>[];
      const getItems = db.prepare(
        `SELECT li.*, p.name as product_name, p.unit
         FROM branch_loan_items li JOIN products p ON li.product_id = p.id
         WHERE li.branch_loan_id = ?`
      );
      res.json(loans.map((l) => ({ ...l, items: getItems.all(l.id as number) })));
    })
  );

  router.post(
    '/branch-loans',
    handle((req, res) => {
      const body = req.body ?? {};
      const direction = body.loan_direction || 'TAKE_LOAN';
      const items = Array.isArray(body.items) ? body.items : [];
      if (!body.partner_branch_id) throw badRequest('Đơn vị vay mượn là bắt buộc');
      if (!body.warehouse_id) throw badRequest('Kho hàng là bắt buộc');
      if (items.length === 0) throw badRequest('Phiếu vay mượn phải có ít nhất một mặt hàng');

      const loanDate = body.loan_date || today();
      const dueDate = body.due_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const code = branchLoanCode(db, loanDate);
      const warehouseId = Number(body.warehouse_id);

      const loanId = db.transaction(() => {
        const insert = db
          .prepare(
            `INSERT INTO branch_loans
              (loan_code, loan_direction, partner_branch_id, warehouse_id, carrier_employee_id, status, loan_date, due_date, note)
             VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
          )
          .run(
            code,
            direction,
            Number(body.partner_branch_id),
            warehouseId,
            body.carrier_employee_id ? Number(body.carrier_employee_id) : null,
            loanDate,
            dueDate,
            body.note || ''
          );
        const lId = Number(insert.lastInsertRowid);
        const itemStmt = db.prepare(
          `INSERT INTO branch_loan_items (branch_loan_id, product_id, quantity_loaned, quantity_returned) VALUES (?, ?, ?, 0)`
        );
        for (const item of items) {
          const productId = Number(item.product_id);
          const qty = Number(item.quantity_loaned) || 0;
          if (qty <= 0) throw badRequest('Số lượng vay mượn phải lớn hơn 0');
          itemStmt.run(lId, productId, qty);
          // GIVE_LOAN: xí nghiệp cho vay -> xuất kho. TAKE_LOAN: đi vay -> nhập kho.
          const delta = direction === 'GIVE_LOAN' ? -qty : qty;
          applyStockDelta(db, { warehouseId, productId, delta });
          recordMovement(db, {
            movementType: direction === 'GIVE_LOAN' ? 'LOAN_OUT' : 'LOAN_IN',
            productId,
            quantity: qty,
            ...(direction === 'GIVE_LOAN' ? { sourceWarehouseId: warehouseId } : { targetWarehouseId: warehouseId }),
            referenceId: lId,
            performedBy: body.carrier_employee_id ? Number(body.carrier_employee_id) : null,
            note: `${direction === 'GIVE_LOAN' ? 'Cho vay' : 'Nhận vay'} theo phiếu ${code}`,
          });
        }
        return lId;
      })();

      res.json({ success: true, id: loanId, code });
    })
  );

  router.put(
    '/branch-loans/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of ['status', 'due_date', 'note', 'carrier_employee_id']) {
        if (body[key] === undefined) continue;
        sets.push(`${key} = ?`);
        values.push(body[key]);
      }
      if (!sets.length) throw badRequest('Không có trường nào để cập nhật');
      values.push(id);
      const result = db.prepare(`UPDATE branch_loans SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) throw new ApiError(404, 'Không tìm thấy phiếu vay mượn');
      res.json({ success: true, id });
    })
  );

  router.post(
    '/branch-loans/:id/settle',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const loan = db.prepare(`SELECT * FROM branch_loans WHERE id = ?`).get(id) as
        | { id: number; loan_direction: string; warehouse_id: number; loan_code: string }
        | undefined;
      if (!loan) throw new ApiError(404, 'Không tìm thấy phiếu vay mượn');

      const returnType = body.return_type || 'PRODUCT_RETURN';
      const warehouseId = Number(loan.warehouse_id);

      db.transaction(() => {
        if (returnType === 'PRODUCT_RETURN' && Array.isArray(body.items)) {
          for (const item of body.items) {
            const productId = Number(item.product_id);
            const qty = Number(item.quantity_returned) || 0;
            if (qty <= 0) continue;
            // GIVE_LOAN: đối tác trả hàng về -> nhập kho. TAKE_LOAN: ta trả hàng đi -> xuất kho.
            const delta = loan.loan_direction === 'GIVE_LOAN' ? qty : -qty;
            applyStockDelta(db, { warehouseId, productId, delta });
            recordMovement(db, {
              movementType: loan.loan_direction === 'GIVE_LOAN' ? 'LOAN_IN' : 'LOAN_OUT',
              productId,
              quantity: qty,
              ...(delta > 0 ? { targetWarehouseId: warehouseId } : { sourceWarehouseId: warehouseId }),
              referenceId: id,
              note: `Hoàn trả theo phiếu ${loan.loan_code}`,
            });
            db.prepare(
              `UPDATE branch_loan_items SET quantity_returned = quantity_returned + ?
               WHERE branch_loan_id = ? AND product_id = ?`
            ).run(qty, id, productId);
            db.prepare(
              `INSERT INTO branch_loan_settlements (branch_loan_id, return_type, product_id, quantity_returned, amount_settled, settled_by, note)
               VALUES (?, 'PRODUCT_RETURN', ?, ?, 0, ?, ?)`
            ).run(id, productId, qty, body.settled_by ? Number(body.settled_by) : null, body.note || '');
          }
        } else if (returnType !== 'PRODUCT_RETURN') {
          db.prepare(
            `INSERT INTO branch_loan_settlements (branch_loan_id, return_type, product_id, quantity_returned, amount_settled, settled_by, note)
             VALUES (?, ?, NULL, 0, ?, ?, ?)`
          ).run(id, returnType, Number(body.amount_settled) || 0, body.settled_by ? Number(body.settled_by) : null, body.note || '');
        }

        const remaining = db
          .prepare(
            `SELECT COUNT(*) as c FROM branch_loan_items WHERE branch_loan_id = ? AND quantity_returned < quantity_loaned`
          )
          .get(id) as { c: number };
        const total = db.prepare(`SELECT COUNT(*) as c FROM branch_loan_items WHERE branch_loan_id = ?`).get(id) as { c: number };
        const status = remaining.c === 0 ? 'SETTLED' : total.c > 0 ? 'PARTIAL_RETURN' : 'SETTLED';
        db.prepare(`UPDATE branch_loans SET status = ? WHERE id = ?`).run(status, id);
      })();

      res.json({ success: true, id });
    })
  );

  router.delete(
    '/branch-loans/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const loan = db.prepare(`SELECT * FROM branch_loans WHERE id = ?`).get(id) as
        | { loan_direction: string; warehouse_id: number }
        | undefined;
      if (!loan) throw new ApiError(404, 'Không tìm thấy phiếu vay mượn');

      db.transaction(() => {
        const items = db.prepare(`SELECT * FROM branch_loan_items WHERE branch_loan_id = ?`).all(id) as Record<string, unknown>[];
        for (const item of items) {
          const outstanding = Number(item.quantity_loaned) - Number(item.quantity_returned || 0);
          if (outstanding <= 0) continue;
          // Đảo ngược tác động tồn kho ban đầu (GIVE_LOAN đã trừ kho, TAKE_LOAN đã cộng kho)
          const delta = loan.loan_direction === 'GIVE_LOAN' ? outstanding : -outstanding;
          applyStockDelta(db, {
            warehouseId: Number(loan.warehouse_id),
            productId: Number(item.product_id),
            delta,
            allowNegative: true,
          });
        }
        db.prepare(`DELETE FROM branch_loan_settlements WHERE branch_loan_id = ?`).run(id);
        db.prepare(`DELETE FROM branch_loan_items WHERE branch_loan_id = ?`).run(id);
        db.prepare(`DELETE FROM branch_loans WHERE id = ?`).run(id);
      })();

      res.json({ success: true, id });
    })
  );

  return router;
}
