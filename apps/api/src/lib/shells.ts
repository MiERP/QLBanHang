import Database from 'better-sqlite3';
import { dateKey, nextCode } from './codes.js';
import { badRequest } from './http.js';
import { recordShellMovement, type BottleType } from './shellStock.js';

export type { BottleType };

// PHÍ CỌC VỎ: một nguồn sự thật duy nhất theo LOẠI VỎ (danh mục "Cọc vỏ bình").
// Chưa cấu hình thì tạm lấy theo sản phẩm bình đang bán để dữ liệu cũ vẫn chạy đúng như trước.
export function shellDepositFee(db: Database.Database, bottleType: BottleType): number {
  const configured = db
    .prepare('SELECT deposit_fee FROM shell_deposits WHERE bottle_type = ?')
    .get(bottleType) as { deposit_fee: number } | undefined;
  if (configured && Number(configured.deposit_fee) > 0) return Number(configured.deposit_fee);
  const product = db
    .prepare(
      `SELECT deposit_fee FROM products
       WHERE bottle_type = ? AND is_active = 1 AND deposit_fee > 0
       ORDER BY id ASC LIMIT 1`
    )
    .get(bottleType) as { deposit_fee: number } | undefined;
  return Number(product?.deposit_fee) || 0;
}

export function shellDepositFees(db: Database.Database): { feeVoi: number; feeUp: number } {
  return { feeVoi: shellDepositFee(db, 'VOI'), feeUp: shellDepositFee(db, 'UP') };
}

export interface ShellReturnInput {
  customerId: number;
  shellsVoi: number;
  shellsUp: number;
  date: string;
  orderId?: number | null;
  note: string;
  handledBy?: number | null;
  paymentMethod?: string;
  /** false = chỉ ghi sổ vỏ, không hoàn tiền cọc (khi tiền cọc đã được xử lý ở chỗ khác). */
  refundDeposit?: boolean;
}

export interface ShellReturnResult {
  newVoi: number;
  newUp: number;
  refundAmount: number;
  ledgerId: number;
  depositTransactionId: number | null;
  feeVoi: number;
  feeUp: number;
}

// Ghi phiếu HOÀN CỌC cho khách. Dùng chung cho mọi đường: thu hồi vỏ, vỏ trả dư trong đơn giao hàng,
// hàng hoàn — để tiền cọc luôn khớp với số vỏ đã thu hồi.
export function refundShellDeposit(
  db: Database.Database,
  input: {
    customerId: number;
    amount: number;
    date: string;
    orderId?: number | null;
    note: string;
    handledBy?: number | null;
    paymentMethod?: string;
  }
): number | null {
  const amount = Math.round(Number(input.amount) || 0);
  if (amount <= 0) return null;
  const transaction = db
    .prepare(
      `INSERT INTO deposit_transactions
        (transaction_code, transaction_type, customer_id, order_id, amount, payment_method, handled_by, transaction_date, note)
       VALUES (?, 'REFUND', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nextCode(db, {
        table: 'deposit_transactions',
        column: 'transaction_code',
        prefix: `COC-${dateKey(input.date)}-`,
        width: 2,
      }),
      input.customerId,
      input.orderId ?? null,
      amount,
      input.paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
      input.handledBy ?? null,
      input.date,
      input.note
    );
  return Number(transaction.lastInsertRowid);
}

/**
 * Thu hồi vỏ của khách trong MỘT giao dịch: giảm nợ vỏ, ghi sổ vỏ, và hoàn cọc theo đúng loại vỏ thu hồi
 * (kể cả khi khách trả loại vỏ không có trong đơn nào — dùng chung cho thu hồi rời, hàng hoàn, trả dư).
 */
export function returnCustomerShells(db: Database.Database, input: ShellReturnInput): ShellReturnResult {
  const shellsVoi = Math.max(0, Math.floor(Number(input.shellsVoi) || 0));
  const shellsUp = Math.max(0, Math.floor(Number(input.shellsUp) || 0));
  if (!shellsVoi && !shellsUp) throw badRequest('Số lượng vỏ thu hồi phải lớn hơn 0');

  const customer = db
    .prepare('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?')
    .get(input.customerId) as { bottle_debt_voi: number; bottle_debt_up: number } | undefined;
  if (!customer) throw badRequest('Không tìm thấy khách hàng');

  const debtVoi = Number(customer.bottle_debt_voi) || 0;
  const debtUp = Number(customer.bottle_debt_up) || 0;
  if (shellsVoi > debtVoi) throw badRequest(`Vỏ Vòi thu hồi (${shellsVoi}) vượt nợ vỏ hiện tại của khách (${debtVoi})`);
  if (shellsUp > debtUp) throw badRequest(`Vỏ Úp thu hồi (${shellsUp}) vượt nợ vỏ hiện tại của khách (${debtUp})`);

  const { feeVoi, feeUp } = shellDepositFees(db);
  // Chọn "không hoàn cọc" thì không sinh phiếu hoàn và cũng không báo số tiền hoàn.
  const refundAmount = input.refundDeposit === false ? 0 : shellsVoi * feeVoi + shellsUp * feeUp;
  const newVoi = debtVoi - shellsVoi;
  const newUp = debtUp - shellsUp;

  db.prepare('UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?').run(newVoi, newUp, input.customerId);
  const ledger = db
    .prepare(
      `INSERT INTO customer_bottle_ledgers
        (customer_id, order_id, transaction_date, borrowed_voi, borrowed_up, returned_voi, returned_up,
         remaining_balance_voi, remaining_balance_up, deposit_amount, refund_deposit_amount, handled_by, note)
       VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(
      input.customerId,
      input.orderId ?? null,
      input.date,
      shellsVoi,
      shellsUp,
      newVoi,
      newUp,
      refundAmount,
      input.handledBy ?? null,
      input.note
    );
  const ledgerId = Number(ledger.lastInsertRowid);

  const depositTransactionId = refundShellDeposit(db, {
    customerId: input.customerId,
    amount: refundAmount,
    date: input.date,
    orderId: input.orderId ?? null,
    note: input.note,
    handledBy: input.handledBy ?? null,
    paymentMethod: input.paymentMethod,
  });

  // Vỏ về pool vỏ của xí nghiệp (tài sản quay lại), ghi kèm sổ vỏ.
  if (shellsVoi) {
    recordShellMovement(db, {
      movementType: 'RETURN',
      bottleType: 'VOI',
      quantity: shellsVoi,
      customerId: input.customerId,
      orderId: input.orderId ?? null,
      performedBy: input.handledBy ?? null,
      note: input.note,
      movementDate: input.date,
    });
  }
  if (shellsUp) {
    recordShellMovement(db, {
      movementType: 'RETURN',
      bottleType: 'UP',
      quantity: shellsUp,
      customerId: input.customerId,
      orderId: input.orderId ?? null,
      performedBy: input.handledBy ?? null,
      note: input.note,
      movementDate: input.date,
    });
  }

  return { newVoi, newUp, refundAmount, ledgerId, depositTransactionId, feeVoi, feeUp };
}

/**
 * Vỏ khách không trả lại (mất vỏ / khách mua đứt / bồi thường): giảm nợ vỏ nhưng KHÔNG hoàn cọc
 * — tiền cọc đã thu được giữ lại, sổ vỏ ghi rõ lý do để đối chiếu.
 */
export function writeOffCustomerShells(
  db: Database.Database,
  input: {
    customerId: number;
    shellsVoi: number;
    shellsUp: number;
    date: string;
    reason: string;
    note?: string;
    handledBy?: number | null;
  }
) {
  const shellsVoi = Math.max(0, Math.floor(Number(input.shellsVoi) || 0));
  const shellsUp = Math.max(0, Math.floor(Number(input.shellsUp) || 0));
  if (!shellsVoi && !shellsUp) throw badRequest('Nhập số vỏ mất / mua đứt');

  const customer = db
    .prepare('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?')
    .get(input.customerId) as { bottle_debt_voi: number; bottle_debt_up: number } | undefined;
  if (!customer) throw badRequest('Không tìm thấy khách hàng');
  const debtVoi = Number(customer.bottle_debt_voi) || 0;
  const debtUp = Number(customer.bottle_debt_up) || 0;
  if (shellsVoi > debtVoi) throw badRequest(`Số vỏ Vòi (${shellsVoi}) vượt nợ vỏ hiện tại của khách (${debtVoi})`);
  if (shellsUp > debtUp) throw badRequest(`Số vỏ Úp (${shellsUp}) vượt nợ vỏ hiện tại của khách (${debtUp})`);

  const newVoi = debtVoi - shellsVoi;
  const newUp = debtUp - shellsUp;
  db.prepare('UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?').run(newVoi, newUp, input.customerId);
  const note = `${input.reason}${input.note ? ` — ${input.note}` : ''} (giữ cọc, không hoàn)`;
  const ledger = db
    .prepare(
      `INSERT INTO customer_bottle_ledgers
        (customer_id, order_id, transaction_date, borrowed_voi, borrowed_up, returned_voi, returned_up,
         remaining_balance_voi, remaining_balance_up, deposit_amount, refund_deposit_amount, handled_by, note)
       VALUES (?, NULL, ?, 0, 0, ?, ?, ?, ?, 0, 0, ?, ?)`
    )
    .run(input.customerId, input.date, shellsVoi, shellsUp, newVoi, newUp, input.handledBy ?? null, note);

  return { newVoi, newUp, ledgerId: Number(ledger.lastInsertRowid) };
}

// Số dư cọc vỏ khách đang giữ = tổng đã thu − tổng đã hoàn (toàn thời gian).
export function customerDepositBalance(db: Database.Database, customerId: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'COLLECT' THEN amount ELSE -amount END), 0) as balance
       FROM deposit_transactions WHERE customer_id = ?`
    )
    .get(customerId) as { balance: number };
  return Number(row.balance) || 0;
}

// Giá trị vỏ khách đang giữ theo phí cọc hiện hành của từng loại vỏ.
export function customerShellValue(db: Database.Database, debtVoi: number, debtUp: number): number {
  const { feeVoi, feeUp } = shellDepositFees(db);
  return (Number(debtVoi) || 0) * feeVoi + (Number(debtUp) || 0) * feeUp;
}
