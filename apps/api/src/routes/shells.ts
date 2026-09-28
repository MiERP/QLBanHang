import { Router } from 'express';
import { getDb } from '../db.js';
import { today } from '../lib/codes.js';
import { badRequest, handle } from '../lib/http.js';
import { getShellQuantity, partnerShellHoldings, recordShellMovement, type ShellMovementType } from '../lib/shellStock.js';

// Chỉ cho nhập tay các nghiệp vụ vỏ không gắn với đơn hàng; OUT/RETURN do đơn hàng và thu hồi vỏ tự sinh.
const MANUAL_TYPES: ShellMovementType[] = ['IN', 'WRITE_OFF', 'ADJUST_IN', 'ADJUST_OUT'];

export function shellsRouter(): Router {
  const router = Router();
  const db = getDb();

  // Sổ vỏ: vỏ xí nghiệp đang giữ (một pool theo loại vỏ) + vỏ khách đang giữ + vỏ đối tác đang giữ.
  router.get(
    '/shell-stock',
    handle((_req, res) => {
      const stock = { voi: getShellQuantity(db, 'VOI'), up: getShellQuantity(db, 'UP') };
      const customer = db
        .prepare(
          `SELECT COALESCE(SUM(bottle_debt_voi),0) as voi, COALESCE(SUM(bottle_debt_up),0) as up
           FROM customers WHERE is_active = 1`
        )
        .get() as { voi: number; up: number };
      const partners = partnerShellHoldings(db);

      const customerVoi = Number(customer.voi) || 0;
      const customerUp = Number(customer.up) || 0;
      const partnerVoi = partners.reduce((a, p) => a + Number(p.voi || 0), 0);
      const partnerUp = partners.reduce((a, p) => a + Number(p.up || 0), 0);

      res.json({
        stock: { voi: stock.voi, up: stock.up, total: stock.voi + stock.up },
        customer: { voi: customerVoi, up: customerUp },
        partners,
        totals: {
          stock_voi: stock.voi,
          stock_up: stock.up,
          customer_voi: customerVoi,
          customer_up: customerUp,
          partner_voi: partnerVoi,
          partner_up: partnerUp,
          all_voi: stock.voi + customerVoi + partnerVoi,
          all_up: stock.up + customerUp + partnerUp,
        },
      });
    })
  );

  // Sổ vỏ: mỗi lần vỏ vào/ra đều có một dòng.
  router.get(
    '/shell-movements',
    handle((req, res) => {
      const { from, to, movement_type } = req.query as Record<string, string | undefined>;
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (from) {
        clauses.push('DATE(m.created_at) >= ?');
        params.push(from);
      }
      if (to) {
        clauses.push('DATE(m.created_at) <= ?');
        params.push(to);
      }
      if (movement_type) {
        clauses.push('m.movement_type = ?');
        params.push(movement_type);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      res.json(
        db
          .prepare(
            `SELECT m.*, c.name as customer_name, o.order_code, e.full_name as performed_by_name
             FROM shell_movements m
             LEFT JOIN customers c ON c.id = m.customer_id
             LEFT JOIN orders o ON o.id = m.order_id
             LEFT JOIN employees e ON e.id = m.performed_by
             ${where}
             ORDER BY m.id DESC LIMIT 300`
          )
          .all(...params)
      );
    })
  );

  // Nhập tay: nhập vỏ về xí nghiệp, xuất hủy, điều chỉnh số vỏ đang giữ (kiểm kê vỏ).
  router.post(
    '/shell-movements',
    handle((req, res) => {
      const body = req.body ?? {};
      const movementType = String(body.movement_type || '') as ShellMovementType;
      if (!MANUAL_TYPES.includes(movementType)) throw badRequest('Loại nghiệp vụ vỏ không hợp lệ');
      const id = db.transaction(() =>
        recordShellMovement(db, {
          movementType,
          bottleType: body.bottle_type,
          quantity: Number(body.quantity) || 0,
          performedBy: body.performed_by ? Number(body.performed_by) : null,
          note: String(body.note ?? ''),
          movementDate: String(body.movement_date || today()),
        })
      )();
      res.json({ success: true, id });
    })
  );

  return router;
}
