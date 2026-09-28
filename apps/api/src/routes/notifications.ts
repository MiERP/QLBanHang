import { Router } from 'express';
import { getDb } from '../db.js';
import { stockAlertRows } from '../lib/alerts.js';
import { freeShipWithoutShipper } from '../lib/appSettings.js';
import { today } from '../lib/codes.js';
import { handle } from '../lib/http.js';

// Trung tâm thông báo: mỗi mục gắn sẵn tab + đối tượng cụ thể để đi thẳng tới nơi xử lý.
export interface AppNotification {
  id: string;
  type: string;
  severity: 'high' | 'medium';
  title: string;
  message: string;
  tab: string;
  target?: Record<string, unknown>;
  read: boolean;
}

export function notificationsRouter(): Router {
  const router = Router();
  const db = getDb();

  router.get(
    '/notifications',
    handle((_req, res) => {
      const items: Omit<AppNotification, 'read'>[] = [];

      // 1. Tồn kho dưới ngưỡng → mở màn Tồn kho, làm nổi đúng ô kho × mặt hàng.
      for (const row of stockAlertRows(db)) {
        items.push({
          id: `stock-${row.warehouse_id}-${row.product_id}`,
          type: 'STOCK_LOW',
          severity: row.urgency_level === 'CRITICAL' ? 'high' : 'medium',
          title: `Tồn kho thấp — ${row.warehouse_name}`,
          message: `${row.product_name}: còn ${row.quantity} ${row.unit ?? ''} (ngưỡng ${row.min_stock_alert})`,
          tab: 'stock',
          target: { warehouse_id: row.warehouse_id, product_id: row.product_id },
        });
      }

      // 2. Đơn đã giao mà chưa gán người giao → phí ship không tính được cho ai (ảnh hưởng lương).
      // Bật cấu hình "đơn không có nhân viên vận chuyển là đơn miễn ship" thì đây là chủ ý, không phải thiếu sót.
      const unassigned = freeShipWithoutShipper(db)
        ? []
        : (db
            .prepare(
              `SELECT o.id, o.order_code, o.order_date, o.shipping_fee, c.name as customer_name
               FROM orders o
               JOIN customers c ON c.id = o.customer_id
               WHERE o.order_status IN ('SHIPPING', 'COMPLETED', 'RETURNED')
                 AND o.shipping_fee > 0
                 AND o.shipper_employee_id IS NULL
                 AND NOT EXISTS (SELECT 1 FROM order_shippers os WHERE os.order_id = o.id)
               ORDER BY o.order_date DESC, o.id DESC
               LIMIT 50`
            )
            .all() as { id: number; order_code: string; order_date: string; shipping_fee: number; customer_name: string }[]);

      for (const row of unassigned) {
        items.push({
          id: `order-shipper-${row.id}`,
          type: 'ORDER_NO_SHIPPER',
          severity: 'medium',
          title: `Đơn ${row.order_code} chưa gán người giao`,
          message: `${row.customer_name} · phí vận chuyển ${Number(row.shipping_fee).toLocaleString('vi-VN')}₫ chưa tính cho ai`,
          tab: 'orders',
          target: { order_id: row.id },
        });
      }

      // 3. Đơn mượn / cho mượn quá hạn trả → mở màn Quản lý mượn - trả để quyết toán.
      const todayStr = today();
      const overdueLoans = db
        .prepare(
          `SELECT o.id, o.order_code, o.order_type, o.loan_due_date, o.subtotal_amount,
                  pu.name as partner_unit_name, c.name as customer_name
           FROM orders o
           LEFT JOIN partner_units pu ON o.partner_unit_id = pu.id
           JOIN customers c ON c.id = o.customer_id
           WHERE o.order_type IN ('LEND_OUT', 'BORROW_IN')
             AND o.order_status IN ('SHIPPING', 'COMPLETED')
             AND o.loan_settled_at IS NULL
             AND o.loan_due_date IS NOT NULL AND o.loan_due_date <> ''
             AND o.loan_due_date < ?
           ORDER BY o.loan_due_date ASC
           LIMIT 50`
        )
        .all(todayStr) as {
        id: number;
        order_code: string;
        order_type: string;
        loan_due_date: string;
        subtotal_amount: number;
        partner_unit_name: string | null;
        customer_name: string;
      }[];

      for (const row of overdueLoans) {
        const days = Math.max(1, Math.floor((Date.parse(todayStr) - Date.parse(row.loan_due_date)) / 86400000));
        const direction = row.order_type === 'LEND_OUT' ? 'Đối tác chưa trả hàng mượn' : 'Mình chưa trả hàng cho đối tác';
        items.push({
          id: `loan-overdue-${row.id}`,
          type: 'LOAN_OVERDUE',
          severity: days > 7 ? 'high' : 'medium',
          title: `Đơn ${row.order_code} quá hạn ${days} ngày`,
          message: `${row.partner_unit_name ?? row.customer_name} · ${direction} · hạn ${row.loan_due_date}`,
          tab: 'loans',
          target: { order_id: row.id },
        });
      }

      // Đánh dấu đã xem: cảnh báo đã bấm vào thì tắt chấm và không tính vào số trên chuông.
      const readIds = new Set(
        (db.prepare('SELECT notification_id FROM notification_reads').all() as { notification_id: string }[]).map(
          (r) => r.notification_id
        )
      );
      const ids = new Set(items.map((i) => i.id));
      // Dọn dấu của những cảnh báo đã hết (để nếu tái phát thì lại báo mới).
      for (const id of [...readIds]) {
        if (!ids.has(id)) {
          db.prepare('DELETE FROM notification_reads WHERE notification_id = ?').run(id);
          readIds.delete(id);
        }
      }

      const withRead = items.map((i) => ({ ...i, read: readIds.has(i.id) }));
      res.json({ count: withRead.filter((i) => !i.read).length, items: withRead });
    })
  );

  // Bấm vào một thông báo → đánh dấu đã xem.
  router.post(
    '/notifications/:id/read',
    handle((req, res) => {
      db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id) VALUES (?)').run(req.params.id);
      res.json({ ok: true });
    })
  );

  return router;
}
