import { Router } from 'express';
import { getDb } from '../db.js';
import { handle } from '../lib/http.js';

export function dashboardRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/dashboard',
    handle((req, res) => {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const notCancelled = `order_status != 'CANCELLED'`;

      const one = <T>(sql: string, ...params: unknown[]): T => db.prepare(sql).get(...params) as T;
      const all = <T>(sql: string, ...params: unknown[]): T[] => db.prepare(sql).all(...params) as T[];

      const revenueToday = one<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE order_date = ? AND ${notCancelled}`,
        todayStr
      ).total;
      const revenueYesterday = one<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE order_date = ? AND ${notCancelled}`,
        yesterday
      ).total;
      const revenueMonth = one<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE strftime('%Y-%m', order_date) = ? AND ${notCancelled}`,
        month
      ).total;
      const ordersMonth = one<{ total: number }>(
        `SELECT COUNT(*) as total FROM orders WHERE strftime('%Y-%m', order_date) = ? AND ${notCancelled}`,
        month
      ).total;
      const bottlesRow = one<{ total: number; voi: number; up: number }>(
        `SELECT COALESCE(SUM(oi.quantity),0) as total,
                COALESCE(SUM(CASE WHEN p.bottle_type = 'VOI' THEN oi.quantity ELSE 0 END),0) as voi,
                COALESCE(SUM(CASE WHEN p.bottle_type = 'UP' THEN oi.quantity ELSE 0 END),0) as up
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE strftime('%Y-%m', o.order_date) = ? AND o.${notCancelled}`,
        month
      );
      const bottleDebt = one<{ voi: number; up: number }>(
        `SELECT COALESCE(SUM(bottle_debt_voi),0) as voi, COALESCE(SUM(bottle_debt_up),0) as up FROM customers WHERE is_active = 1`
      );
      const totalDebt = one<{ total: number }>(
        `SELECT COALESCE(SUM(current_debt),0) as total FROM customers WHERE is_active = 1`
      ).total;
      const loans = one<{ pending: number; overdue: number }>(
        `SELECT
           SUM(CASE WHEN status != 'SETTLED' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status != 'SETTLED' AND date(due_date) < date('now') THEN 1 ELSE 0 END) as overdue
         FROM branch_loans`
      );
      const alertCount = one<{ total: number }>(
        `SELECT COUNT(*) as total FROM inventory_stock WHERE quantity <= min_stock_alert OR quantity <= 0`
      ).total;

      const revenueByDay = all<{ date: string; revenue: number; orders: number }>(
        `SELECT order_date as date, COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orders
         FROM orders WHERE strftime('%Y-%m', order_date) = ? AND ${notCancelled}
         GROUP BY order_date ORDER BY order_date ASC`,
        month
      );

      const revenueByWarehouse = all<{ name: string; revenue: number; bottles: number }>(
        `SELECT w.name as name,
                COALESCE(SUM(DISTINCT o.total_amount),0) as revenue,
                COALESCE(SUM(oi.quantity),0) as bottles
         FROM orders o
         JOIN warehouses w ON o.warehouse_id = w.id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE strftime('%Y-%m', o.order_date) = ? AND o.${notCancelled}
         GROUP BY w.id ORDER BY revenue DESC`,
        month
      );

      const productMix = all<{ name: string; quantity: number; revenue: number }>(
        `SELECT p.name as name, COALESCE(SUM(oi.quantity),0) as quantity, COALESCE(SUM(oi.total_price),0) as revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE strftime('%Y-%m', o.order_date) = ? AND o.${notCancelled}
         GROUP BY p.id ORDER BY quantity DESC LIMIT 8`,
        month
      );

      const paymentStatus = all<{ name: string; value: number }>(
        `SELECT payment_status as name, COUNT(*) as value
         FROM orders WHERE strftime('%Y-%m', order_date) = ? AND ${notCancelled}
         GROUP BY payment_status`,
        month
      );

      const salesBySeller = all<{ name: string; revenue: number }>(
        `SELECT e.full_name as name, COALESCE(SUM(o.total_amount),0) as revenue
         FROM orders o JOIN employees e ON o.seller_employee_id = e.id
         WHERE strftime('%Y-%m', o.order_date) = ? AND o.${notCancelled}
         GROUP BY e.id ORDER BY revenue DESC LIMIT 8`,
        month
      );

      const shipperPerformance = all<{ name: string; trips: number; bottles: number; shipping_fee: number }>(
        `SELECT e.full_name as name, COUNT(DISTINCT o.id) as trips,
                COALESCE(SUM(oi.quantity),0) as bottles,
                COALESCE(SUM(DISTINCT o.shipping_fee),0) as shipping_fee
         FROM orders o
         JOIN employees e ON o.shipper_employee_id = e.id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE strftime('%Y-%m', o.order_date) = ? AND o.${notCancelled}
         GROUP BY e.id ORDER BY bottles DESC`,
        month
      );

      const bottleDebtByCustomer = all<{ name: string; voi: number; up: number }>(
        `SELECT name, bottle_debt_voi as voi, bottle_debt_up as up
         FROM customers WHERE is_active = 1 AND (bottle_debt_voi > 0 OR bottle_debt_up > 0)
         ORDER BY (bottle_debt_voi + bottle_debt_up) DESC LIMIT 8`
      );

      const stockLevels = all<{ name: string; quantity: number; min_stock_alert: number }>(
        `SELECT p.name as name, s.quantity as quantity, s.min_stock_alert as min_stock_alert
         FROM inventory_stock s JOIN products p ON s.product_id = p.id
         WHERE s.warehouse_id = 1 ORDER BY s.quantity ASC LIMIT 10`
      );

      const branchLoanAging = all<{
        code: string;
        partner: string;
        direction: string;
        due_date: string;
        status: string;
        outstanding: number;
      }>(
        `SELECT l.loan_code as code, b.name as partner, l.loan_direction as direction, l.due_date as due_date,
                l.status as status,
                COALESCE(SUM(li.quantity_loaned - li.quantity_returned),0) as outstanding
         FROM branch_loans l
         JOIN partner_branches b ON l.partner_branch_id = b.id
         LEFT JOIN branch_loan_items li ON li.branch_loan_id = l.id
         WHERE l.status != 'SETTLED'
         GROUP BY l.id ORDER BY l.due_date ASC LIMIT 10`
      );

      const movementsSummary = all<{ name: string; quantity: number }>(
        `SELECT movement_type as name, COALESCE(SUM(quantity),0) as quantity
         FROM stock_movements
         WHERE strftime('%Y-%m', created_at) = ?
         GROUP BY movement_type ORDER BY quantity DESC`,
        month
      );

      const kpiByEmployee = all<{ name: string; completion: number }>(
        `SELECT e.full_name as name, k.completion_percentage as completion
         FROM kpi_evaluations k JOIN employees e ON k.employee_id = e.id
         WHERE k.evaluation_month = ? ORDER BY completion DESC LIMIT 10`,
        month
      );

      const cashFlow = all<{ date: string; revenue: number; expense: number }>(
        `SELECT d.date as date,
                COALESCE((SELECT SUM(amount) FROM revenue_transactions r WHERE r.transaction_date = d.date),0) as revenue,
                COALESCE((SELECT SUM(amount) FROM expense_transactions x WHERE x.expense_date = d.date),0) as expense
         FROM (
           SELECT transaction_date as date FROM revenue_transactions WHERE strftime('%Y-%m', transaction_date) = ?
           UNION
           SELECT expense_date as date FROM expense_transactions WHERE strftime('%Y-%m', expense_date) = ?
         ) d
         ORDER BY d.date ASC`,
        month,
        month
      );

      res.json({
        month,
        kpis: {
          revenueToday,
          revenueYesterday,
          revenueMonth,
          ordersMonth,
          bottlesMonth: bottlesRow.total,
          bottlesVoi: bottlesRow.voi,
          bottlesUp: bottlesRow.up,
          bottleDebtVoi: bottleDebt.voi,
          bottleDebtUp: bottleDebt.up,
          totalDebt,
          pendingLoans: loans.pending ?? 0,
          overdueLoans: loans.overdue ?? 0,
          alertCount,
        },
        revenueByDay,
        revenueByWarehouse,
        productMix,
        paymentStatus,
        salesBySeller,
        shipperPerformance,
        bottleDebtByCustomer,
        stockLevels,
        branchLoanAging,
        movementsSummary,
        kpiByEmployee,
        cashFlow,
      });
    })
  );

  return router;
}
