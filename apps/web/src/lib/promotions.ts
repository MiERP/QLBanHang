import type { Product, Promotion } from '../types';

export function withPromotions<T extends { product_id: string | number; quantity: string | number; quantity_promo?: string | number }>(
  items: T[], products: Product[], promotions: Promotion[], date: string
): T[] {
  const result = items.map((item) => ({ ...item, quantity_promo: 0 }));
  const quantities = new Map<number, number>();
  for (const item of items) {
    const id = Number(item.product_id);
    if (id > 0) quantities.set(id, (quantities.get(id) ?? 0) + (Number(item.quantity) || 0));
  }
  for (const [id, quantity] of quantities) {
    const product = products.find((p) => p.id === id);
    if (!product) continue;
    const rule = promotions.filter((p) => !!p.is_active && !p.free_product_id &&
      (p.product_id === id || (!p.product_id && p.category_id === product.category_id) || (!p.product_id && !p.category_id)) &&
      (!p.start_date || p.start_date <= date) && (!p.end_date || p.end_date >= date))
      .sort((a, b) => {
        const rank = (p: Promotion) => p.product_id ? 0 : p.category_id ? 1 : 2;
        return rank(a) - rank(b) || b.id - a.id;
      })[0];
    if (!rule || !Number.isSafeInteger(rule.buy_quantity) || rule.buy_quantity <= 0 ||
        !Number.isSafeInteger(rule.free_quantity) || rule.free_quantity <= 0) continue;
    const index = result.findIndex((item) => Number(item.product_id) === id);
    result[index].quantity_promo = Math.floor(quantity / rule.buy_quantity) * rule.free_quantity;
  }
  return result;
}
