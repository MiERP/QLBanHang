import Database from 'better-sqlite3';
import { nowStamp } from './codes.js';
import { badRequest } from './http.js';

export type BottleType = 'VOI' | 'UP';

// Loại nghiệp vụ vỏ: dấu của số lượng do loại quyết định, số lưu luôn dương.
// Vỏ là MỘT pool của xí nghiệp (không gắn với kho): chỉ có nhập vào, xuất cho khách, thu hồi, huỷ và điều chỉnh.
export type ShellMovementType = 'IN' | 'OUT' | 'RETURN' | 'WRITE_OFF' | 'ADJUST_IN' | 'ADJUST_OUT';
const SHELL_MOVEMENT_TYPES: ShellMovementType[] = ['IN', 'OUT', 'RETURN', 'WRITE_OFF', 'ADJUST_IN', 'ADJUST_OUT'];
export const SHELL_MOVEMENT_LABEL: Record<string, string> = {
  IN: 'Nhập vỏ về xí nghiệp',
  OUT: 'Xuất vỏ theo đơn',
  RETURN: 'Thu hồi vỏ về xí nghiệp',
  WRITE_OFF: 'Xuất hủy vỏ',
  ADJUST_IN: 'Điều chỉnh tăng',
  ADJUST_OUT: 'Điều chỉnh giảm',
};

export const BOTTLE_TYPE_LABEL: Record<string, string> = { VOI: 'Vỏ Vòi', UP: 'Vỏ Úp' };

export function isBottleType(value: unknown): value is BottleType {
  return value === 'VOI' || value === 'UP';
}

// Số vỏ xí nghiệp đang giữ theo loại vỏ.
export function getShellQuantity(db: Database.Database, bottleType: BottleType): number {
  const row = db.prepare('SELECT quantity FROM shell_stock WHERE bottle_type = ?').get(bottleType) as
    | { quantity: number }
    | undefined;
  return Number(row?.quantity) || 0;
}

function applyShellDelta(db: Database.Database, bottleType: BottleType, delta: number) {
  db.prepare(
    `INSERT INTO shell_stock (bottle_type, quantity) VALUES (?, ?)
     ON CONFLICT(bottle_type) DO UPDATE SET quantity = quantity + excluded.quantity`
  ).run(bottleType, delta);
}

export interface ShellMovementInput {
  movementType: ShellMovementType;
  bottleType: BottleType;
  quantity: number;
  customerId?: number | null;
  orderId?: number | null;
  ticketId?: number | null;
  performedBy?: number | null;
  note?: string;
  movementDate?: string;
}

/**
 * Ghi một lần vỏ vào/ra của xí nghiệp: cập nhật số vỏ đang giữ + ghi sổ vỏ.
 * Sổ vỏ là nguồn sự thật của tài sản vỏ; số vỏ đang giữ có thể âm nếu chưa khai tồn đầu kỳ nên
 * báo cáo đối chiếu sẽ cảnh báo.
 */
export function recordShellMovement(db: Database.Database, input: ShellMovementInput) {
  const quantity = Math.floor(Number(input.quantity) || 0);
  if (quantity <= 0) throw badRequest('Số lượng vỏ phải lớn hơn 0');
  if (!isBottleType(input.bottleType)) throw badRequest('Loại vỏ không hợp lệ');
  // Chặn loại nghiệp vụ lạ ngay tại đây: hàm này là cửa duy nhất ghi sổ vỏ, dấu của số lượng
  // phụ thuộc loại nên một giá trị không nằm trong danh sách sẽ bị hiểu sai thành giảm vỏ.
  if (!SHELL_MOVEMENT_TYPES.includes(input.movementType)) throw badRequest('Loại nghiệp vụ vỏ không hợp lệ');

  const direction = (movementType: ShellMovementType) =>
    movementType === 'IN' || movementType === 'RETURN' || movementType === 'ADJUST_IN' ? 1 : -1;

  applyShellDelta(db, input.bottleType, direction(input.movementType) * quantity);

  const insert = db
    .prepare(
      `INSERT INTO shell_movements
        (movement_type, bottle_type, quantity, customer_id, order_id, ticket_id, performed_by, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.movementType,
      input.bottleType,
      quantity,
      input.customerId ? Number(input.customerId) : null,
      input.orderId ? Number(input.orderId) : null,
      input.ticketId ? Number(input.ticketId) : null,
      input.performedBy ? Number(input.performedBy) : null,
      input.note ?? '',
      input.movementDate ? `${input.movementDate} 00:00:00` : nowStamp()
    );
  return Number(insert.lastInsertRowid);
}

// Vỏ của mình đang nằm ở đối tác liên kết (dương = đối tác đang giữ vỏ của mình).
export function addPartnerShellMovement(
  db: Database.Database,
  input: { partnerUnitId: number; bottleType: BottleType; quantity: number; orderId?: number | null; note: string }
) {
  const quantity = Math.floor(Number(input.quantity) || 0);
  if (!quantity) return;
  db.prepare(
    `INSERT INTO partner_shell_movements (partner_unit_id, bottle_type, quantity, order_id, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(Number(input.partnerUnitId), input.bottleType, quantity, input.orderId ?? null, input.note);
}

export function partnerShellHoldings(db: Database.Database) {
  return db
    .prepare(
      `SELECT m.partner_unit_id, p.name as partner_unit_name,
              COALESCE(SUM(CASE WHEN m.bottle_type = 'VOI' THEN m.quantity ELSE 0 END), 0) as voi,
              COALESCE(SUM(CASE WHEN m.bottle_type = 'UP' THEN m.quantity ELSE 0 END), 0) as up
       FROM partner_shell_movements m
       JOIN partner_units p ON p.id = m.partner_unit_id
       GROUP BY m.partner_unit_id
       HAVING voi <> 0 OR up <> 0
       ORDER BY (voi + up) DESC`
    )
    .all() as { partner_unit_id: number; partner_unit_name: string; voi: number; up: number }[];
}
