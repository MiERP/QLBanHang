import { Router } from 'express';
import { getDb } from '../db.js';
import { today } from '../lib/codes.js';
import { currentReportPeriod } from '../lib/reportPeriod.js';
import { stockAlertThreshold } from '../lib/appSettings.js';
import { badRequest, handle } from '../lib/http.js';

export function dashboardRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/dashboard',
    handle((req, res) => {
      // Kỳ báo cáo: ưu tiên month=YYYY-MM (xem kỳ cũ / test), thiếu thì lấy kỳ báo cáo hiện tại.
      const q = req.query as Record<string, string | undefined>;
      const month = String(q.month || '').slice(0, 7);
      if (q.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw badRequest('Tháng không hợp lệ');
      let from: string;
      let to: string;
      if (/^\d{4}-\d{2}$/.test(month)) {
        const [y, m] = month.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        from = `${month}-01`;
        to = `${month}-${String(lastDay).padStart(2, '0')}`;
      } else {
        const period = currentReportPeriod(db);
        from = period.from;
        to = period.to;
      }
      const periodKey = `${from}..${to}`;
      const todayStr = today();
      const yesterday = today(new Date(Date.now() - 86400000).toISOString());
      // Số liệu luỹ kế "theo năm" vẫn theo năm dương lịch chứa ngày cuối kỳ.
      const year = Number(to.slice(0, 4));
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year + 1}-01-01`;
      // DOANH THU = giá trị đơn hàng đã bán, tức đơn ở trạng thái HOÀN TẤT.
      // Đơn đã ghi nhận HÀNG HOÀN vẫn tính đủ doanh thu gộp và KPI (đơn đã hoàn thành nghĩa vụ);
      // phần hàng hoàn được trừ riêng thành "doanh thu thuần".
      // Chỉ tính đơn của mình (SALE, BORROW_IN) — đơn cho đối tác mượn không phát sinh doanh thu.
      // Giá trị = tiền hàng (subtotal_amount); phí vận chuyển là tiền công trả nhân viên giao hàng nên tách riêng.
      const completed = `order_status IN ('COMPLETED', 'RETURNED')`;
      const own = `order_type IN ('SALE', 'BORROW_IN')`;
      // Doanh thu chỉ ghi nhận khi đơn đã xuất hóa đơn.
      const invoiced = `invoice_status = 'INVOICED'`;
      // Đơn đã rời kho (đang giao hoặc hoàn tất, kể cả đơn đã hoàn hàng) — dùng cho phí vận chuyển.
      const shipped = `order_status IN ('SHIPPING', 'COMPLETED', 'RETURNED')`;
      const inPeriod = (col: string) => `${col} >= ? AND ${col} <= ?`;

      const one = <T>(sql: string, ...params: unknown[]): T => db.prepare(sql).get(...params) as T;
      const all = <T>(sql: string, ...params: unknown[]): T[] => db.prepare(sql).all(...params) as T[];
      // Ngưỡng cảnh báo tồn kho lấy từ Cấu hình chung (dùng cho thẻ cảnh báo và danh sách tồn thấp).
      const alertThreshold = stockAlertThreshold(db);

      const revenueToday = one<{ total: number }>(
        `SELECT COALESCE(SUM(subtotal_amount),0) as total FROM orders WHERE order_date = ? AND ${completed} AND ${own} AND ${invoiced}`,
        todayStr
      ).total;
      const revenueYesterday = one<{ total: number }>(
        `SELECT COALESCE(SUM(subtotal_amount),0) as total FROM orders WHERE order_date = ? AND ${completed} AND ${own} AND ${invoiced}`,
        yesterday
      ).total;
      const revenueMonth = one<{ total: number }>(
        `SELECT COALESCE(SUM(subtotal_amount),0) as total FROM orders WHERE ${inPeriod('order_date')} AND ${completed} AND ${own} AND ${invoiced}`,
        from, to
      ).total;
      const revenueYear = one<{ total: number }>(
        `SELECT COALESCE(SUM(subtotal_amount),0) as total FROM orders
         WHERE order_date >= ? AND order_date < ? AND ${completed} AND ${own} AND ${invoiced}`,
        yearStart, yearEnd
      ).total;
      // Công nợ theo ngày đơn: phần còn phải thu hiện tại, sau thu tiền và hàng hoàn.
      const debtFor = (periodWhere: string, ...params: unknown[]): number => one<{ total: number }>(
        `SELECT COALESCE(SUM(CASE WHEN balance > 0.5 THEN balance ELSE 0 END),0) AS total
         FROM (SELECT o.total_amount - COALESCE(ret.returned_amount,0) - COALESCE(o.paid_amount,0)
                       + COALESCE(ret.refund_amount,0) AS balance
               FROM orders o JOIN customers c ON c.id = o.customer_id AND c.is_active = 1
               LEFT JOIN (SELECT order_id, SUM(returned_amount) AS returned_amount,
                                  SUM(refund_amount) AS refund_amount FROM order_returns GROUP BY order_id) ret
                 ON ret.order_id = o.id
               WHERE o.${completed} AND o.${own} AND ${periodWhere})`, ...params
      ).total;
      const debtToday = debtFor('o.order_date = ?', todayStr);
      const debtMonth = debtFor(inPeriod('o.order_date'), from, to);
      const debtYear = debtFor('o.order_date >= ? AND o.order_date < ?', yearStart, yearEnd);
      const ordersMonth = one<{ total: number }>(
        `SELECT COUNT(*) as total FROM orders WHERE ${inPeriod('order_date')} AND ${completed} AND ${own} AND ${invoiced}`,
        from, to
      ).total;
      // Hàng hoàn trong kỳ: trừ theo GIÁ TRỊ GỘP đã bán (đã cộng lại giảm giá của đơn), để đơn hoàn
      // toàn bộ có giảm giá trả về doanh thu đúng bằng 0 thay vì để lại phần bằng mức giảm giá.
      const revenueReturnedMonth = one<{ total: number }>(
        `SELECT COALESCE(SUM(r.returned_amount + o.discount_amount),0) as total
         FROM order_returns r JOIN orders o ON o.id = r.order_id
         WHERE ${inPeriod('r.return_date')} AND o.invoice_status = 'INVOICED'`,
        from, to
      ).total;
      const bottlesRow = one<{ total: number; voi: number; up: number }>(
        `SELECT COALESCE(SUM(oi.quantity),0) as total,
                COALESCE(SUM(CASE WHEN p.bottle_type = 'VOI' THEN oi.quantity ELSE 0 END),0) as voi,
                COALESCE(SUM(CASE WHEN p.bottle_type = 'UP' THEN oi.quantity ELSE 0 END),0) as up
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE ${inPeriod('o.order_date')} AND o.${completed} AND o.${own} AND o.${invoiced}`,
        from, to
      );
      const bottleDebt = one<{ voi: number; up: number }>(
        `SELECT COALESCE(SUM(bottle_debt_voi),0) as voi, COALESCE(SUM(bottle_debt_up),0) as up FROM customers WHERE is_active = 1`
      );
      // Công nợ tiền khách hàng = nợ đầu kỳ của khách + phần chưa thu của các đơn đã hoàn thành.
      const totalDebt = one<{ total: number }>(
        `SELECT COALESCE((SELECT SUM(current_debt) FROM customers WHERE is_active = 1), 0)
              + COALESCE((SELECT SUM(o.total_amount - COALESCE(ret.returned_amount, 0) - o.paid_amount + COALESCE(ret.refund_amount, 0)) FROM orders o
                          LEFT JOIN (SELECT order_id, SUM(returned_amount) AS returned_amount, SUM(refund_amount) AS refund_amount
                                       FROM order_returns GROUP BY order_id) ret ON ret.order_id = o.id
                          JOIN customers c ON c.id = o.customer_id AND c.is_active = 1
                          WHERE o.order_status IN ('COMPLETED', 'RETURNED')
                            AND o.order_type IN ('SALE', 'BORROW_IN')
                            AND (o.total_amount - COALESCE(ret.returned_amount, 0) - o.paid_amount + COALESCE(ret.refund_amount, 0)) > 0.5), 0) as total`
      ).total;
      const alertCount = one<{ total: number }>(
        `SELECT COUNT(*) as total FROM inventory_stock s JOIN warehouses w ON s.warehouse_id = w.id
         WHERE w.type IN ('CENTRAL', 'STORE', 'VEHICLE', 'STATION')
           AND (s.quantity <= ? OR s.quantity <= 0)`,
        alertThreshold
      ).total;

      const revenueByDay = all<{ date: string; revenue: number; orders: number }>(
        `SELECT order_date as date, COALESCE(SUM(subtotal_amount),0) as revenue, COUNT(*) as orders
         FROM orders WHERE ${inPeriod('order_date')} AND ${completed} AND ${own} AND ${invoiced}
         GROUP BY order_date ORDER BY order_date ASC`,
        from, to
      );
      const scopeRows = all<{ scope: string; revenue: number }>(
        `SELECT COALESCE(target_scope, 'ENTERPRISE') AS scope, COALESCE(SUM(subtotal_amount),0) AS revenue
         FROM orders WHERE ${inPeriod('order_date')} AND ${completed} AND ${own} AND ${invoiced}
         GROUP BY COALESCE(target_scope, 'ENTERPRISE')`, from, to
      );
      const scopeRevenue = new Map(scopeRows.map((row) => [row.scope, row.revenue]));
      const revenueByScope = (['COMPANY', 'ENTERPRISE'] as const).map((scope) =>
        ({ scope, revenue: scopeRevenue.get(scope) ?? 0 }));

      const warehouses = all<{ id: number; code: string; name: string }>(
        `SELECT id, code, name FROM warehouses
         WHERE is_active = 1 AND type IN ('CENTRAL', 'STORE', 'VEHICLE', 'STATION') ORDER BY name, id`
      );
      const stockRows = all<{ warehouse_id: number; product_id: number; product_name: string; unit: string; quantity: number }>(
        `SELECT w.id AS warehouse_id, p.id AS product_id, p.name AS product_name, p.unit,
                COALESCE(s.quantity,0) AS quantity
         FROM warehouses w CROSS JOIN products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN inventory_stock s ON s.warehouse_id = w.id AND s.product_id = p.id
         WHERE w.is_active = 1 AND w.type IN ('CENTRAL', 'STORE', 'VEHICLE', 'STATION')
           AND p.is_active = 1 AND p.product_type = 'GOODS'
           AND (c.type IS NULL OR c.type <> 'SERVICE_DVGT')
         ORDER BY w.name, p.name`
      );
      const stockByWarehouse = warehouses.map((warehouse) => {
        const items = stockRows.filter((row) => row.warehouse_id === warehouse.id)
          .map(({ product_id, product_name, unit, quantity }) => ({ product_id, product_name, unit, quantity }));
        return {
          warehouse_id: warehouse.id, code: warehouse.code, name: warehouse.name,
          items,
        };
      });

      // Doanh thu theo kho + sản lượng bình: tách 2 nhánh con để tránh SUM(DISTINCT) làm đếm thiếu.
      const revenueByWarehouse = all<{ name: string; revenue: number; bottles: number }>(
        `SELECT w.name as name,
                COALESCE(rev.revenue,0) as revenue,
                COALESCE(bot.bottles,0) as bottles
         FROM (SELECT o.warehouse_id as wid, SUM(o.subtotal_amount) as revenue
               FROM orders o WHERE ${inPeriod('o.order_date')} AND o.${completed} AND o.${own} AND o.${invoiced}
               GROUP BY o.warehouse_id) rev
         JOIN warehouses w ON rev.wid = w.id
         LEFT JOIN (SELECT o.warehouse_id as wid, SUM(oi.quantity) as bottles
                    FROM order_items oi JOIN orders o ON oi.order_id = o.id
                    WHERE ${inPeriod('o.order_date')} AND o.${completed} AND o.${own} AND o.${invoiced}
                    GROUP BY o.warehouse_id) bot ON bot.wid = rev.wid
         ORDER BY revenue DESC`,
        from, to,
        from, to
      );

      const productMix = all<{ name: string; quantity: number; revenue: number }>(
        `SELECT p.name as name, COALESCE(SUM(oi.quantity),0) as quantity, COALESCE(SUM(oi.total_price),0) as revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE ${inPeriod('o.order_date')} AND o.${completed} AND o.${own} AND o.${invoiced}
         GROUP BY p.id ORDER BY quantity DESC LIMIT 8`,
        from, to
      );

      const paymentStatus = all<{ name: string; value: number }>(
        `SELECT payment_status as name, COUNT(*) as value
         FROM orders WHERE ${inPeriod('order_date')} AND ${completed} AND ${own} AND ${invoiced}
         GROUP BY payment_status`,
        from, to
      );

      const salesBySeller = all<{ name: string; revenue: number }>(
        `SELECT e.full_name as name, COALESCE(SUM(o.subtotal_amount),0) as revenue
         FROM orders o JOIN employees e ON o.seller_employee_id = e.id
         WHERE ${inPeriod('o.order_date')} AND o.${completed} AND o.${own} AND o.${invoiced}
         GROUP BY e.id ORDER BY revenue DESC LIMIT 8`,
        from, to
      );

      const shipperPerformance = all<{ name: string; trips: number; bottles: number; shipping_fee: number }>(
        `SELECT e.full_name as name,
                COALESCE(t.trips,0) as trips,
                COALESCE(b.bottles,0) as bottles,
                COALESCE(t.fee,0) as shipping_fee
         FROM (SELECT o.shipper_employee_id as eid, COUNT(*) as trips, SUM(o.shipping_fee) as fee
               FROM orders o
               WHERE ${inPeriod('o.order_date')} AND o.${shipped} AND o.shipper_employee_id IS NOT NULL
               GROUP BY o.shipper_employee_id) t
         JOIN employees e ON t.eid = e.id
         LEFT JOIN (SELECT o.shipper_employee_id as eid, SUM(oi.quantity) as bottles
                    FROM order_items oi JOIN orders o ON oi.order_id = o.id
                    WHERE ${inPeriod('o.order_date')} AND o.${shipped} AND o.shipper_employee_id IS NOT NULL
                    GROUP BY o.shipper_employee_id) b ON b.eid = t.eid
         ORDER BY bottles DESC`,
        from, to,
        from, to
      );

      const bottleDebtByCustomer = all<{ name: string; voi: number; up: number }>(
        `SELECT name, bottle_debt_voi as voi, bottle_debt_up as up
         FROM customers WHERE is_active = 1 AND (bottle_debt_voi > 0 OR bottle_debt_up > 0)
         ORDER BY (bottle_debt_voi + bottle_debt_up) DESC LIMIT 8`
      );

      const stockLevels = all<{ name: string; quantity: number; min_stock_alert: number }>(
        `SELECT p.name as name, s.quantity as quantity, ? as min_stock_alert
         FROM inventory_stock s JOIN products p ON s.product_id = p.id
         WHERE s.warehouse_id = 1 ORDER BY s.quantity ASC LIMIT 10`,
        alertThreshold
      );

      const movementsSummary = all<{ name: string; quantity: number }>(
        `SELECT movement_type as name, COALESCE(SUM(quantity),0) as quantity
         FROM stock_movements
         WHERE date(created_at) >= ? AND date(created_at) <= ?
         GROUP BY movement_type ORDER BY quantity DESC`,
        from, to
      );

      const kpiByEmployee = all<{ name: string; completion: number }>(
        `SELECT e.full_name as name,
                CASE WHEN t.target_revenue > 0
                     THEN ROUND(COALESCE(a.actual,0) * 100.0 / t.target_revenue, 1)
                     ELSE 0 END as completion
         FROM targets t
         JOIN employees e ON t.employee_id = e.id
         LEFT JOIN (
           SELECT seller_employee_id as emp, SUM(subtotal_amount) as actual
           FROM orders
           WHERE order_type IN ('SALE', 'BORROW_IN') AND order_status IN ('COMPLETED', 'RETURNED')
             AND invoice_status = 'INVOICED'
             AND ${inPeriod('order_date')}
           GROUP BY seller_employee_id
         ) a ON a.emp = t.employee_id
         WHERE t.period = ? AND t.scope_type = 'EMPLOYEE' AND t.target_revenue > 0
         ORDER BY completion DESC LIMIT 10`,
        from, to,
        periodKey
      );

      const cashFlow = all<{ date: string; revenue: number; expense: number }>(
        `SELECT d.date as date,
                COALESCE((SELECT SUM(amount) FROM revenue_transactions r WHERE r.transaction_date = d.date),0) as revenue,
                COALESCE((SELECT SUM(amount) FROM expense_transactions x WHERE x.expense_date = d.date),0) as expense
         FROM (
           SELECT transaction_date as date FROM revenue_transactions WHERE ${inPeriod('transaction_date')}
           UNION
           SELECT expense_date as date FROM expense_transactions WHERE ${inPeriod('expense_date')}
         ) d
         ORDER BY d.date ASC`,
        from, to,
        from, to
      );

      res.json({
        from,
        to,
        label: `${from} → ${to}`,
        kpis: {
          revenueToday,
          revenueYesterday,
          revenueMonth,
          revenueYear,
          debtToday,
          debtMonth,
          debtYear,
          warehouseCount: stockByWarehouse.length,
          revenueReturnedMonth,
          revenueNetMonth: revenueMonth - revenueReturnedMonth,
          ordersMonth,
          bottlesMonth: bottlesRow.total,
          bottlesVoi: bottlesRow.voi,
          bottlesUp: bottlesRow.up,
          bottleDebtVoi: bottleDebt.voi,
          bottleDebtUp: bottleDebt.up,
          totalDebt,
          alertCount,
        },
        revenueByDay,
        revenueByScope,
        stockByWarehouse,
        revenueByWarehouse,
        productMix,
        paymentStatus,
        salesBySeller,
        shipperPerformance,
        bottleDebtByCustomer,
        stockLevels,
        movementsSummary,
        kpiByEmployee,
        cashFlow,
      });
    })
  );

  return router;
}
