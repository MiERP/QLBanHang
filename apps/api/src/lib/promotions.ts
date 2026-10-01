import Database from 'better-sqlite3';
import { badRequest } from './http.js';

interface OrderLine {
  id: number;
  product_id: number;
  quantity: number;
  quantity_promo: number;
  category_id: number | null;
  product_name: string;
}

interface PromotionRule {
  buy_quantity: number;
  free_quantity: number;
}

export function promotionQuantityFor(db: Database.Database, productId: number, categoryId: number | null,
  date: string, quantity: number): number {
  const rule = db.prepare(`SELECT buy_quantity, free_quantity FROM promotions
    WHERE is_active = 1 AND free_product_id IS NULL
      AND (product_id = ? OR (product_id IS NULL AND category_id = ?)
           OR (product_id IS NULL AND category_id IS NULL))
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY CASE WHEN product_id = ? THEN 0 WHEN category_id = ? THEN 1 ELSE 2 END, id DESC
    LIMIT 1`).get(productId, categoryId, date, date, productId, categoryId) as PromotionRule | undefined;
  return rule && Number.isSafeInteger(rule.buy_quantity) && rule.buy_quantity > 0 &&
    Number.isSafeInteger(rule.free_quantity) && rule.free_quantity > 0
    ? Math.floor(quantity / rule.buy_quantity) * rule.free_quantity : 0;
}

// Tính khuyến mãi theo tổng số mua của từng mã hàng trong đơn; một mã chỉ nhận một chương trình.
export function applyOrderPromotions(db: Database.Database, orderId: number, validateRequested = true): void {
  const order = db.prepare('SELECT order_type, order_date FROM orders WHERE id = ?')
    .get(orderId) as { order_type: string; order_date: string } | undefined;
  if (!order || (order.order_type !== 'SALE' && order.order_type !== 'BORROW_IN')) return;

  const lines = db.prepare(`SELECT oi.id, oi.product_id, oi.quantity, oi.quantity_promo,
                                  p.category_id, p.name AS product_name
                           FROM order_items oi JOIN products p ON p.id = oi.product_id
                           WHERE oi.order_id = ? ORDER BY oi.id`)
    .all(orderId) as OrderLine[];
  const byProduct = new Map<number, OrderLine[]>();
  for (const line of lines) {
    const group = byProduct.get(line.product_id) ?? [];
    group.push(line);
    byProduct.set(line.product_id, group);
  }

  const update = db.prepare('UPDATE order_items SET quantity_promo = ? WHERE id = ?');
  for (const group of byProduct.values()) {
    const first = group[0];
    const purchased = group.reduce((sum, line) => sum + Number(line.quantity), 0);
    const entitled = promotionQuantityFor(db, first.product_id, first.category_id, order.order_date, purchased);
    const requested = group.reduce((sum, line) => sum + Number(line.quantity_promo || 0), 0);
    if (validateRequested && requested > entitled) {
      throw badRequest(`Số lượng khuyến mãi của "${first.product_name}" vượt điều kiện chương trình`);
    }
    group.forEach((line, index) => update.run(index === 0 ? entitled : 0, line.id));
  }
}
