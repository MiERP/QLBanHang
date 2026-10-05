import Database from 'better-sqlite3';
import { nowStamp } from './codes.js';
import { badRequest } from './http.js';

export type MovementType =
  | 'IMPORT'
  | 'EXPORT_ORDER'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'LOAN_OUT'
  | 'LOAN_IN'
  | 'BORROW_IN'
  | 'BORROW_OUT'
  | 'RETURN_IN'
  | 'ADJUSTMENT';

interface StockDeltaOptions {
  warehouseId: number;
  productId: number;
  delta: number;
  allowNegative?: boolean;
}

export function getStockQuantity(db: Database.Database, warehouseId: number, productId: number): number {
  const row = db
    .prepare(`SELECT quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?`)
    .get(warehouseId, productId) as { quantity: number } | undefined;
  return row ? row.quantity : 0;
}

export function applyStockDelta(db: Database.Database, opts: StockDeltaOptions) {
  const { warehouseId, productId, delta, allowNegative } = opts;
  const row = db
    .prepare(`SELECT id, quantity FROM inventory_stock WHERE warehouse_id = ? AND product_id = ?`)
    .get(warehouseId, productId) as { id: number; quantity: number } | undefined;

  const current = row ? row.quantity : 0;
  const next = current + delta;

  if (!allowNegative && next < 0) {
    const product = db.prepare(`SELECT name FROM products WHERE id = ?`).get(productId) as { name: string } | undefined;
    throw badRequest(
      `Không đủ tồn kho cho "${product?.name ?? `SP#${productId}`}" (hiện có ${current}, cần ${Math.abs(delta)})`
    );
  }

  if (row) {
    db.prepare(`UPDATE inventory_stock SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(next, row.id);
  } else {
    db.prepare(
      `INSERT INTO inventory_stock (warehouse_id, product_id, quantity, min_stock_alert, avg_daily_sales)
       VALUES (?, ?, ?, 20, 5.0)`
    ).run(warehouseId, productId, next);
  }
}

interface MovementOptions {
  movementType: MovementType;
  productId: number;
  quantity: number;
  quantityPromo?: number;
  sourceWarehouseId?: number | null;
  targetWarehouseId?: number | null;
  sourceId?: number | null;
  referenceId?: string | number | null;
  ticketId?: number | null;
  performedBy?: number | null;
  note?: string;
  createdAt?: string;
}

export function recordMovement(db: Database.Database, opts: MovementOptions) {
  const cols = [
    'movement_type',
    'source_warehouse_id',
    'target_warehouse_id',
    'source_id',
    'product_id',
    'quantity',
    'quantity_promo',
    'reference_id',
    'ticket_id',
    'performed_by',
    'note',
  ];
  const values: unknown[] = [
    opts.movementType,
    opts.sourceWarehouseId ?? null,
    opts.targetWarehouseId ?? null,
    opts.sourceId ?? null,
    opts.productId,
    opts.quantity,
    opts.quantityPromo ?? 0,
    opts.referenceId != null ? String(opts.referenceId) : null,
    opts.ticketId ?? null,
    opts.performedBy ?? null,
    opts.note ?? null,
  ];
  // Ngày nghiệp vụ của bút toán = ngày phiếu (để đối soát theo kỳ đúng ngày phát sinh).
  // Không truyền ngày thì lấy giờ Việt Nam, không lấy giờ máy chủ (VPS chạy UTC sẽ lệch ngày).
  cols.push('created_at');
  values.push(nowStamp(opts.createdAt));
  db.prepare(`INSERT INTO stock_movements (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...values);
}
