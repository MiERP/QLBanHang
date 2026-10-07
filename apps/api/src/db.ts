import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FREE_SHIP_FOR_CUSTOMER, FREE_SHIP_WITHOUT_SHIPPER, SETTING_DEFS } from './lib/appSettings.js';
import { dateKey, nextCode } from './lib/codes.js';
import { vatRateAt } from './lib/vat.js';
import { recalcTotals } from './lib/orderStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findSqlPath(filename: string): string {
  const candidates = [
    path.resolve(__dirname, filename),
    path.resolve(__dirname, '../src', filename),
    path.resolve(process.cwd(), 'apps', 'api', 'src', filename),
    path.resolve(process.cwd(), 'src', filename),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return candidates[0];
}

function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Luôn dùng chung một CSDL tại thư mục gốc dự án, bất kể chế độ chạy (dev / desktop).
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(repoRoot, 'package.json'))) {
    return path.join(repoRoot, 'qaromi_erp.db');
  }
  return path.resolve(process.cwd(), 'qaromi_erp.db');
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function dropColumnIfExists(db: Database.Database, table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

function dropTableIfExists(db: Database.Database, table: string) {
  db.exec(`DROP TABLE IF EXISTS ${table}`);
}

function allowSaleRefundTransactions(db: Database.Database) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'revenue_transactions'").get() as { sql: string } | undefined;
  if (!row || row.sql.includes('SALE_REFUND')) return;
  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      CREATE TABLE revenue_transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_code TEXT UNIQUE NOT NULL,
        transaction_type TEXT CHECK(transaction_type IN ('WATER_SALE', 'BOTTLE_DEPOSIT', 'DEBT_COLLECTION', 'DVGT_SERVICE', 'BRANCH_OFFSET', 'OTHER', 'SALE_REFUND')) NOT NULL,
        order_id INTEGER REFERENCES orders(id),
        customer_id INTEGER REFERENCES customers(id),
        amount REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')) NOT NULL,
        collected_by INTEGER REFERENCES employees(id),
        transaction_date DATE NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO revenue_transactions_new
        (id, transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note, created_at)
      SELECT id, transaction_code, transaction_type, order_id, customer_id, amount, payment_method, collected_by, transaction_date, note, created_at
      FROM revenue_transactions;
      DROP TABLE revenue_transactions;
      ALTER TABLE revenue_transactions_new RENAME TO revenue_transactions;
      COMMIT;`);
  } catch (error) {
    if (db.inTransaction) db.exec('ROLLBACK;');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function allowMultipleOrderReturns(db: Database.Database) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'order_returns'").get() as { sql: string } | undefined;
  if (!row || !/order_id\s+INTEGER\s+UNIQUE/i.test(row.sql)) return;
  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      CREATE TABLE order_returns_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
        return_date DATE NOT NULL,
        ticket_id INTEGER,
        shells_voi INTEGER DEFAULT 0,
        shells_up INTEGER DEFAULT 0,
        deposit_refund REAL DEFAULT 0,
        returned_amount REAL NOT NULL DEFAULT 0,
        refund_amount REAL NOT NULL DEFAULT 0,
        refund_transaction_id INTEGER,
        deposit_transaction_id INTEGER,
        bottle_ledger_id INTEGER,
        pickup_type TEXT DEFAULT 'CUSTOMER_BRING',
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO order_returns_new SELECT * FROM order_returns;
      DROP TABLE order_returns;
      ALTER TABLE order_returns_new RENAME TO order_returns;
      CREATE INDEX idx_order_returns_order ON order_returns(order_id);
      COMMIT;`);
  } catch (error) {
    if (db.inTransaction) db.exec('ROLLBACK;');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// Bổ sung loại kho VIRTUAL (kho ảo) và CUSTOMER (kho khách hàng) vào CHECK của warehouses;
// đồng thời BỎ loại SHELL_STORAGE — không có kho vỏ bình, vỏ là một pool tách khỏi kho.
function rebuildWarehousesIfNeeded(db: Database.Database) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='warehouses'")
    .get() as { sql: string } | undefined;
  if (!row || (row.sql.includes('VIRTUAL') && row.sql.includes('CUSTOMER') && !row.sql.includes('SHELL_STORAGE'))) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      CREATE TABLE warehouses_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('CENTRAL', 'STORE', 'VEHICLE', 'STATION', 'VIRTUAL', 'CUSTOMER')) NOT NULL,
        manager_employee_id INTEGER REFERENCES employees(id),
        location TEXT,
        is_active INTEGER DEFAULT 1
      );
      INSERT INTO warehouses_new (id, code, name, type, manager_employee_id, location, is_active)
        SELECT id, code, name, type, manager_employee_id, location, is_active FROM warehouses
        WHERE type <> 'SHELL_STORAGE';
      DROP TABLE warehouses;
      ALTER TABLE warehouses_new RENAME TO warehouses;
      COMMIT;`);
    console.log('[API Database] Migrated warehouses: bổ sung VIRTUAL/CUSTOMER, bỏ loại kho vỏ bình.');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// Vỏ bình nay là MỘT pool theo loại vỏ, không gắn với kho: dựng lại shell_stock / shell_movements
// bỏ cột kho (gộp số lượng tồn theo loại vỏ).
function rebuildShellTablesIfNeeded(db: Database.Database) {
  const cols = db.prepare('PRAGMA table_info(shell_stock)').all() as { name: string }[];
  const needStock = cols.length > 0 && cols.some((c) => c.name === 'warehouse_id');
  const mcols = db.prepare('PRAGMA table_info(shell_movements)').all() as { name: string }[];
  const needMoves = mcols.length > 0 && mcols.some((c) => c.name === 'warehouse_id');
  if (!needStock && !needMoves) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      CREATE TABLE shell_stock_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bottle_type TEXT UNIQUE NOT NULL,
        quantity INTEGER DEFAULT 0
      );
      INSERT INTO shell_stock_new (bottle_type, quantity)
        SELECT bottle_type, SUM(quantity) FROM shell_stock GROUP BY bottle_type;
      DROP TABLE shell_stock;
      ALTER TABLE shell_stock_new RENAME TO shell_stock;

      CREATE TABLE shell_movements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movement_type TEXT NOT NULL,
        bottle_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        order_id INTEGER REFERENCES orders(id),
        ticket_id INTEGER,
        performed_by INTEGER REFERENCES employees(id),
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO shell_movements_new (id, movement_type, bottle_type, quantity, customer_id, order_id, ticket_id, performed_by, note, created_at)
        SELECT id, movement_type, bottle_type, quantity, customer_id, order_id, ticket_id, performed_by, note, created_at
        FROM shell_movements;
      DROP TABLE shell_movements;
      ALTER TABLE shell_movements_new RENAME TO shell_movements;
      CREATE INDEX IF NOT EXISTS idx_shell_movements_type ON shell_movements(movement_type);
      COMMIT;`);
    console.log('[API Database] Migrated vỏ bình: gộp về một pool theo loại vỏ, bỏ chiều kho.');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// Kho ảo trung chuyển của xí nghiệp: điểm điều phối trên tuyến nhập hàng từ Công ty Quawaco.
// Không phải kho vật lý nên không phát sinh bút toán tồn kho — chỉ dùng để thể hiện tuyến.
function ensureTransitWarehouse(db: Database.Database): void {
  const existing = db.prepare(`SELECT id FROM warehouses WHERE code = 'KHO_XN'`).get();
  if (existing) return;
  db.prepare(
    `INSERT INTO warehouses (code, name, type, location, is_active)
     VALUES ('KHO_XN', 'Kho Xí nghiệp (trung chuyển)', 'VIRTUAL', 'Điểm điều phối hàng của xí nghiệp', 1)`
  ).run();
}

// Kho ảo trung gian cho đơn mượn đối tác (hàng vào rồi ra ngay, không phải kho vật lý).
function ensureLoanWarehouse(db: Database.Database): number {
  const existing = db.prepare(`SELECT id FROM warehouses WHERE code = 'KHO_MUON'`).get() as { id: number } | undefined;
  if (existing) return existing.id;
  const result = db
    .prepare(
      `INSERT INTO warehouses (code, name, type, location, is_active)
       VALUES ('KHO_MUON', 'Kho mượn (kho ảo)', 'VIRTUAL', 'Kho trung gian cho đơn mượn đối tác', 1)`
    )
    .run();
  return Number(result.lastInsertRowid);
}

// Kho khách hàng: vị trí đặt hàng tại chỗ khách (hàng đã giao, dùng cho tuyến giao tại khách).
function ensureCustomerWarehouse(db: Database.Database): void {
  const existing = db.prepare(`SELECT id FROM warehouses WHERE code = 'KHO_KHACHHANG'`).get();
  if (existing) {
    db.prepare(`UPDATE warehouses SET name = 'Khách hàng' WHERE code = 'KHO_KHACHHANG' AND name <> 'Khách hàng'`).run();
    return;
  }
  db.prepare(
    `INSERT INTO warehouses (code, name, type, location, is_active)
     VALUES ('KHO_KHACHHANG', 'Khách hàng', 'CUSTOMER', 'Hàng hóa giao đặt tại vị trí khách hàng', 1)`
  ).run();
}

// 5 kho vật lý mặc định của xí nghiệp — nút "Xóa dữ liệu nghiệp vụ" đảm bảo các kho này luôn có
// (như danh mục nền), bên cạnh việc giữ nguyên các kho vật lý khác do người dùng tự tạo.
const DEFAULT_PHYSICAL_WAREHOUSES: { code: string; name: string; type: string }[] = [
  { code: 'KHO_TANGAP', name: 'Kho Trạm Tăng Áp (Trung Tâm Chiết Rót)', type: 'CENTRAL' },
  { code: 'KHO_HUE', name: 'Kho Huế (Tổ Thị Trường & Điểm Bán)', type: 'STORE' },
  { code: 'KHO_VP', name: 'Kho Văn Phòng Xí Nghiệp', type: 'CENTRAL' },
  { code: 'KHO_XEDIEN', name: 'Kho Xe Tải Điện (Phương Lái Xe)', type: 'VEHICLE' },
  { code: 'KHO_HALAM', name: 'Kho Hà Lầm', type: 'STATION' },
];

function ensureDefaultPhysicalWarehouses(db: Database.Database): void {
  for (const wh of DEFAULT_PHYSICAL_WAREHOUSES) {
    if (db.prepare('SELECT id FROM warehouses WHERE code = ?').get(wh.code)) continue;
    db.prepare('INSERT INTO warehouses (code, name, type, location, is_active) VALUES (?, ?, ?, ?, 1)').run(
      wh.code,
      wh.name,
      wh.type,
      ''
    );
  }
}

// Danh mục nền mặc định (nhóm hàng, sản phẩm, nhóm khách hàng) nằm ở catalog.sql.
// CSDL mới nạp cùng seed.sql; CSDL đã dùng mà danh mục bị trống (ví dụ bị xoá bằng bản cũ chưa giữ
// danh mục) thì tự nạp lại để danh mục nền luôn có. catalog.sql dùng INSERT OR IGNORE nên bản ghi
// người dùng đã có luôn được giữ nguyên, chỉ bổ sung dòng còn thiếu.
function applyDefaultCatalog(db: Database.Database): void {
  const isEmpty = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c === 0;
  if (!isEmpty('categories') && !isEmpty('products') && !isEmpty('customer_groups')) return;
  const catalogPath = findSqlPath('catalog.sql');
  if (!fs.existsSync(catalogPath)) {
    console.error('[API Database] ERROR: catalog.sql not found!');
    return;
  }
  db.exec(fs.readFileSync(catalogPath, 'utf-8'));
  console.log('[API Database] Danh mục nền đã được nạp lại từ:', catalogPath);
}

// Đồng bộ tổng tiền trên đầu đơn với chính các dòng hàng của nó (dữ liệu nhập ngoài app
// hoặc seed cũ có thể lệch khiến các báo cáo doanh thu không khớp nhau). Idempotent.
function normalizeOrderTotals(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT o.id, o.subtotal_amount,
              COALESCE((SELECT SUM(oi.total_price) FROM order_items oi WHERE oi.order_id = o.id), 0) as items_subtotal
       FROM orders o
       WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`
    )
    .all() as { id: number; subtotal_amount: number; items_subtotal: number }[];
  const mismatched = rows.filter((r) => Math.abs((Number(r.subtotal_amount) || 0) - r.items_subtotal) > 0.5);
  if (mismatched.length) {
    db.transaction(() => {
      for (const r of mismatched) recalcTotals(db, r.id);
    })();
    console.log(`[API Database] Đồng bộ ${mismatched.length} đơn: tiền hàng khớp lại với dòng hàng.`);
  }
  // Đơn "Đã thanh toán" thì tiền đã thu phải bằng tổng đơn (đúng quy tắc app ghi khi lưu đơn).
  const paid = db
    .prepare(`UPDATE orders SET paid_amount = total_amount WHERE payment_status = 'PAID' AND ABS(paid_amount - total_amount) > 0.5`)
    .run();
  if (paid.changes) console.log(`[API Database] Đồng bộ ${paid.changes} đơn: tiền đã thu = tổng đơn.`);
}

// Danh mục phí cọc vỏ bình (Vòi / Úp): khởi tạo theo mức cọc đang dùng ở sản phẩm để người dùng
// nhìn thấy và chỉnh lại ở MỘT chỗ; mọi bước thu/hoàn cọc đều lấy từ danh mục này.
function ensureShellDeposits(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM shell_deposits').get() as { c: number }).c;
  if (count) return;
  const feeOf = (type: string) =>
    Number(
      (
        db
          .prepare(`SELECT deposit_fee FROM products WHERE bottle_type = ? AND deposit_fee > 0 ORDER BY id ASC LIMIT 1`)
          .get(type) as { deposit_fee: number } | undefined
      )?.deposit_fee
    ) || 0;
  const insert = db.prepare('INSERT INTO shell_deposits (bottle_type, deposit_fee, note) VALUES (?, ?, ?)');
  db.transaction(() => {
    insert.run('VOI', feeOf('VOI'), 'Cọc vỏ bình có vòi');
    insert.run('UP', feeOf('UP'), 'Cọc vỏ bình úp');
  })();
  console.log('[API Database] Khởi tạo danh mục Cọc vỏ bình theo mức cọc đang dùng của sản phẩm.');
}

// Công ty không còn là đối tác liên kết mà là một nguồn khách ngang hàng với xí nghiệp. Các đơn
// "cho mượn" gắn đối tác Công ty thực chất là bán hàng cho khách của Công ty (khách đã trả tiền,
// hàng xuất từ kho của xí nghiệp) nên chuyển về đơn bán với chỉ tiêu Công ty. Idempotent.
function normalizeCompanySourceOrders(db: Database.Database): void {
  const partner = db.prepare("SELECT id FROM partner_units WHERE name = 'Công ty'").get() as { id: number } | undefined;
  const orders = partner
    ? (db.prepare(`SELECT id FROM orders WHERE order_type = 'LEND_OUT' AND partner_unit_id = ?`).all(partner.id) as {
        id: number;
      }[])
    : [];

  const moveOrder = db.prepare(
    `UPDATE orders
     SET order_type = 'SALE', partner_unit_id = NULL, target_scope = 'COMPANY',
         loan_settled_at = NULL, loan_settle_type = NULL, loan_due_date = NULL
     WHERE id = ?`
  );
  // Hàng vẫn xuất khỏi kho của xí nghiệp như mọi đơn bán — chỉ đổi loại bút toán cho khớp sổ kho.
  const moveStock = db.prepare(
    `UPDATE stock_movements SET movement_type = 'EXPORT_ORDER' WHERE reference_id = ? AND movement_type = 'LOAN_OUT'`
  );
  // Đơn không còn là khoản cho mượn thì dòng tất toán tiền của nó cũng không còn nghĩa lý.
  const dropSettlement = db.prepare('DELETE FROM loan_settlements WHERE order_id = ?');

  db.transaction(() => {
    for (const order of orders) {
      moveOrder.run(order.id);
      moveStock.run(String(order.id));
      dropSettlement.run(order.id);
    }
  })();

  // Vỏ bình đi kèm hàng đã giao cho khách của Công ty, không phải Công ty đang giữ: bỏ dòng theo dõi
  // vỏ đối tác của các đơn đã chuyển (nếu để lại thì khi đối chiếu sẽ đòi nhầm vỏ của Công ty).
  const staleShells = db
    .prepare(
      `DELETE FROM partner_shell_movements
       WHERE order_id IN (SELECT id FROM orders WHERE order_type = 'SALE' AND target_scope = 'COMPANY' AND partner_unit_id IS NULL)`
    )
    .run();

  if (orders.length || staleShells.changes) {
    console.log(
      `[API Database] Đơn của khách Công ty: chuyển ${orders.length} đơn "cho mượn" sang đơn bán (chỉ tiêu Công ty), bỏ ${staleShells.changes} dòng vỏ đối tác không còn đúng.`
    );
  }
}

// Đơn bán của khách Công ty phải có đủ sổ sách như đơn bán của xí nghiệp: vỏ giao cho khách được ghi
// vào nợ vỏ của khách, tiền cọc vỏ đã thu được ghi vào sổ cọc (khoản phải trả cho khách). Idempotent.
function backfillCompanySourceShells(db: Database.Database): void {
  const orders = db
    .prepare(
      `SELECT o.id, o.order_code, o.order_date, o.customer_id, o.deposit_amount, o.payment_method,
              o.shipper_employee_id, o.seller_employee_id
       FROM orders o
       WHERE o.order_type = 'SALE' AND o.target_scope = 'COMPANY' AND o.partner_unit_id IS NULL
         -- Chỉ đơn đã HOÀN TẤT mới phát sinh cọc và nợ vỏ. Đơn còn Nháp/chưa giao thì chưa thu gì,
         -- nếu ghi ở đây sẽ tạo phiếu thu cọc và nợ vỏ khống cho đơn chưa giao cho khách.
         AND o.order_status IN ('COMPLETED', 'RETURNED')
         AND NOT EXISTS (SELECT 1 FROM customer_bottle_ledgers l WHERE l.order_id = o.id)
       ORDER BY o.id`
    )
    .all() as {
    id: number;
    order_code: string;
    order_date: string;
    customer_id: number;
    deposit_amount: number;
    payment_method: string;
    shipper_employee_id: number | null;
    seller_employee_id: number | null;
  }[];
  if (!orders.length) return;

  // Sổ vỏ kho là nguồn: số vỏ đã xuất theo đơn chính là số vỏ khách đang giữ.
  const shellsOf = db.prepare(
    `SELECT bottle_type, COALESCE(SUM(quantity), 0) as quantity FROM shell_movements
     WHERE order_id = ? AND movement_type = 'OUT' GROUP BY bottle_type`
  );
  const debtOf = db.prepare('SELECT bottle_debt_voi, bottle_debt_up FROM customers WHERE id = ?');
  const setDebt = db.prepare('UPDATE customers SET bottle_debt_voi = ?, bottle_debt_up = ? WHERE id = ?');
  const insertLedger = db.prepare(
    `INSERT INTO customer_bottle_ledgers
      (customer_id, order_id, transaction_date, borrowed_voi, borrowed_up, returned_voi, returned_up,
       deposit_amount, refund_deposit_amount, remaining_balance_voi, remaining_balance_up, handled_by, note)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?, ?, ?)`
  );
  const hasDeposit = db.prepare(`SELECT id FROM deposit_transactions WHERE order_id = ? AND transaction_type = 'COLLECT'`);
  const insertDeposit = db.prepare(
    `INSERT INTO deposit_transactions
      (transaction_code, transaction_type, customer_id, order_id, amount, payment_method, handled_by, transaction_date, note)
     VALUES (?, 'COLLECT', ?, ?, ?, ?, ?, ?, ?)`
  );

  let shells = 0;
  let deposits = 0;
  db.transaction(() => {
    for (const order of orders) {
      const rows = shellsOf.all(order.id) as { bottle_type: string; quantity: number }[];
      const voi = Number(rows.find((r) => r.bottle_type === 'VOI')?.quantity) || 0;
      const up = Number(rows.find((r) => r.bottle_type === 'UP')?.quantity) || 0;
      const deposit = Number(order.deposit_amount) || 0;
      const handledBy = order.shipper_employee_id ?? order.seller_employee_id ?? null;

      if (voi || up) {
        const customer = debtOf.get(order.customer_id) as { bottle_debt_voi: number; bottle_debt_up: number } | undefined;
        const newVoi = (Number(customer?.bottle_debt_voi) || 0) + voi;
        const newUp = (Number(customer?.bottle_debt_up) || 0) + up;
        setDebt.run(newVoi, newUp, order.customer_id);
        insertLedger.run(
          order.customer_id,
          order.id,
          order.order_date,
          voi,
          up,
          deposit,
          newVoi,
          newUp,
          handledBy,
          `Ghi bổ sung vỏ giao theo đơn ${order.order_code}`
        );
        shells += voi + up;
      }

      if (deposit > 0 && !hasDeposit.get(order.id)) {
        insertDeposit.run(
          nextCode(db, { table: 'deposit_transactions', column: 'transaction_code', prefix: `COC-${dateKey(order.order_date)}-`, width: 2 }),
          order.customer_id,
          order.id,
          deposit,
          order.payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
          handledBy,
          order.order_date,
          `Thu cọc vỏ theo đơn ${order.order_code}`
        );
        deposits += 1;
      }
    }
  })();
  console.log(
    `[API Database] Ghi bổ sung cho đơn khách Công ty: ${shells} vỏ vào nợ vỏ khách, ${deposits} phiếu thu cọc vỏ (${orders.length} đơn).`
  );
}

// Danh mục thuế suất GTGT: nguồn dữ liệu cho báo cáo doanh thu trước thuế.
// Khi luật đổi thuế, chỉ thêm dòng hiệu lực mới trong Danh mục hệ thống — không sửa mã nguồn.
function ensureVatRates(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM vat_rates').get() as { c: number }).c;
  if (count) return;
  db.prepare(
    `INSERT INTO vat_rates (code, name, rate, effective_from, effective_to, note)
     VALUES ('VAT08', 'Nước uống đóng bình/chai', 8, '2025-07-01', NULL, 'Kỳ giảm thuế GTGT 8% — thêm dòng mới khi luật thay đổi')`
  ).run();
}

// Cấu hình hệ thống: bảo đảm mọi khoá khai báo trong mã nguồn đều có dòng trong CSDL để người dùng thấy ở màn Cấu hình chung.
function ensureAppSettings(db: Database.Database): void {
  const insert = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const def of SETTING_DEFS) insert.run(def.key, def.default);
  })();
}


// Bổ sung BORROW_IN/BORROW_OUT/RETURN_IN vào CHECK của stock_movements (SQLite không sửa được CHECK tại chỗ).
function rebuildStockMovementsIfNeeded(db: Database.Database) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_movements'")
    .get() as { sql: string } | undefined;
  if (!row || (row.sql.includes('BORROW_IN') && row.sql.includes('RETURN_IN'))) return;

  // DB cũ có thể chưa có các cột này (source_id thêm sau) → bổ sung trước khi copy để SELECT không lỗi.
  ensureColumn(db, 'stock_movements', 'source_id', 'INTEGER');
  ensureColumn(db, 'stock_movements', 'ticket_id', 'INTEGER');
  ensureColumn(db, 'stock_movements', 'quantity_promo', 'INTEGER DEFAULT 0');

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      CREATE TABLE stock_movements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movement_type TEXT CHECK(movement_type IN ('IMPORT', 'EXPORT_ORDER', 'TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_OUT', 'LOAN_IN', 'BORROW_IN', 'BORROW_OUT', 'RETURN_IN', 'ADJUSTMENT')) NOT NULL,
        source_warehouse_id INTEGER REFERENCES warehouses(id),
        target_warehouse_id INTEGER REFERENCES warehouses(id),
        source_id INTEGER REFERENCES import_sources(id),
        product_id INTEGER REFERENCES products(id) NOT NULL,
        quantity INTEGER NOT NULL,
        quantity_promo INTEGER DEFAULT 0,
        reference_id TEXT,
        ticket_id INTEGER,
        performed_by INTEGER REFERENCES employees(id),
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO stock_movements_new
        (id, movement_type, source_warehouse_id, target_warehouse_id, source_id, product_id, quantity, quantity_promo, reference_id, ticket_id, performed_by, note, created_at)
        SELECT id, movement_type, source_warehouse_id, target_warehouse_id, source_id, product_id, quantity, quantity_promo, reference_id, ticket_id, performed_by, note, created_at
        FROM stock_movements;
      DROP TABLE stock_movements;
      ALTER TABLE stock_movements_new RENAME TO stock_movements;
      CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
      COMMIT;`);
    console.log('[API Database] Migrated stock_movements: bổ sung BORROW_IN/BORROW_OUT/RETURN_IN.');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// SQLite không hỗ trợ bỏ NOT NULL / đổi CHECK bằng ALTER COLUMN nên phải dựng lại bảng orders.
// Chạy khi: seller_employee_id còn NOT NULL (DB cũ) HOẶC CHECK order_status chưa có 'SHIPPING'
// HOẶC CHECK order_type chưa có 'HIRED_LOAD' (đơn bốc xếp) HOẶC CHECK target_scope chưa có
// giá trị 'COMPANY' (cột thêm bằng ALTER TABLE không mang theo ràng buộc CHECK của schema.sql).
function rebuildOrdersIfNeeded(db: Database.Database) {
  const cols = db.prepare('PRAGMA table_info(orders)').all() as { name: string; notnull: number }[];
  const seller = cols.find((c) => c.name === 'seller_employee_id');
  const tableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")
    .get() as { sql: string } | undefined;
  const needsStatus = !tableRow || !tableRow.sql.includes("'SHIPPING'");
  const needsHiredLoad = !tableRow || !tableRow.sql.includes('HIRED_LOAD');
  const needsReturned = !tableRow || !tableRow.sql.includes('RETURNED');
  const needsTargetScope = !tableRow || !tableRow.sql.includes("'COMPANY'");
  const needsSellerNullable = !!seller && seller.notnull === 1;
  // Đơn nháp được để trống kho (lưu trước, chọn kho sau) → warehouse_id phải cho phép NULL.
  const warehouse = cols.find((c) => c.name === 'warehouse_id');
  const needsWarehouseNullable = !!warehouse && warehouse.notnull === 1;
  if (!needsStatus && !needsSellerNullable && !needsHiredLoad && !needsReturned && !needsTargetScope && !needsWarehouseNullable) return;

  const newCols = [
    'id', 'order_code', 'customer_id', 'seller_employee_id', 'order_type', 'partner_unit_id', 'target_scope',
    'shipper_employee_id', 'warehouse_id', 'order_date', 'delivery_date', 'order_status', 'payment_status',
    'payment_method', 'is_vat_invoice', 'vat_rate', 'vat_number', 'company_name_vat', 'tax_code_vat',
    'address_vat', 'personal_id_vat', 'budget_relation_code_vat', 'subtotal_amount', 'shipping_fee',
    'discount_amount', 'deposit_amount', 'deposit_override', 'total_amount', 'paid_amount', 'shipping_receiver', 'shipping_phone',
    'shipping_address', 'shipping_note', 'shipping_fee_id', 'returned_shells_voi', 'returned_shells_up', 'merged_into_id', 'invoice_status', 'loan_settled_at',
    'loan_settle_type', 'loan_due_date', 'support_station_id', 'note', 'created_at',
  ];
  const existing = cols.map((c) => c.name);
  const copyCols = newCols.filter((c) => existing.includes(c));
  const targetCols = copyCols.join(', ');
  // Map trạng thái cũ sang bộ trạng thái mới.
  const sourceCols = copyCols
    .map((c) =>
      c === 'order_status'
        ? `CASE order_status WHEN 'DISPATCHED' THEN 'SHIPPING' WHEN 'DELIVERED' THEN 'COMPLETED' ELSE order_status END`
        : c
    )
    .join(', ');

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`BEGIN;
      CREATE TABLE orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES customers(id) NOT NULL,
        seller_employee_id INTEGER REFERENCES employees(id),
        order_type TEXT CHECK(order_type IN ('SALE', 'LEND_OUT', 'BORROW_IN', 'HIRED_LOAD')) DEFAULT 'SALE',
        partner_unit_id INTEGER,
        target_scope TEXT CHECK(target_scope IN ('COMPANY', 'ENTERPRISE')) DEFAULT 'ENTERPRISE',
        shipper_employee_id INTEGER REFERENCES employees(id),
        warehouse_id INTEGER REFERENCES warehouses(id),
        order_date DATE NOT NULL,
        delivery_date DATE,
        order_status TEXT CHECK(order_status IN ('DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'RETURNED')) DEFAULT 'DRAFT',
        payment_status TEXT CHECK(payment_status IN ('UNPAID', 'PARTIAL', 'PAID')) DEFAULT 'UNPAID',
        payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'DEBT')) DEFAULT 'CASH',
        is_vat_invoice INTEGER DEFAULT 0,
        vat_rate REAL DEFAULT 0.0,
        vat_number TEXT,
        company_name_vat TEXT,
        tax_code_vat TEXT,
        address_vat TEXT,
        personal_id_vat TEXT,
        budget_relation_code_vat TEXT,
        subtotal_amount REAL NOT NULL,
        shipping_fee REAL DEFAULT 0.0,
        discount_amount REAL DEFAULT 0.0,
        deposit_amount REAL DEFAULT 0.0,
        deposit_override REAL,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0.0,
        shipping_receiver TEXT,
        shipping_phone TEXT,
        shipping_address TEXT,
        shipping_note TEXT,
        shipping_fee_id INTEGER,
        returned_shells_voi INTEGER DEFAULT 0,
        returned_shells_up INTEGER DEFAULT 0,
        merged_into_id INTEGER,
        invoice_status TEXT CHECK(invoice_status IN ('NOT_INVOICED', 'INVOICED')) DEFAULT 'NOT_INVOICED',
        loan_settled_at DATETIME,
        loan_settle_type TEXT CHECK(loan_settle_type IN ('RETURN_GOODS', 'PAYMENT')),
        loan_due_date DATE,
        support_station_id INTEGER REFERENCES org_units(id),
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO orders_new (${targetCols}) SELECT ${sourceCols} FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_new RENAME TO orders;
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_employee_id);
      CREATE INDEX IF NOT EXISTS idx_orders_shipper ON orders(shipper_employee_id);
      CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
      COMMIT;`);
    console.log('[API Database] Migrated orders: seller nullable + trạng thái mới (CONFIRMED/SHIPPING).');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function seedOrgData(db: Database.Database) {
  const posCount = (db.prepare('SELECT COUNT(*) as c FROM positions').get() as { c: number }).c;
  if (!posCount) {
    const insert = db.prepare('INSERT INTO positions (code, name) VALUES (?, ?)');
    const defaults: [string, string][] = [
      ['CV_GD', 'Giám đốc xí nghiệp'],
      ['CV_PGD', 'Phó giám đốc'],
      ['CV_TP_KD', 'Trưởng phòng kinh doanh'],
      ['CV_TT', 'Trạm trưởng'],
      ['CV_TP', 'Trạm phó'],
      ['CV_TO_TR', 'Tổ trưởng'],
      ['CV_TO_P', 'Tổ phó'],
      ['CV_NV', 'Nhân viên'],
      ['CV_KT', 'Kế toán'],
      ['CV_TK', 'Thủ kho'],
      ['CV_KTV', 'Kỹ thuật viên'],
    ];
    db.transaction(() => {
      for (const [c, n] of defaults) insert.run(c, n);
    })();
  }

  const ouCount = (db.prepare('SELECT COUNT(*) as c FROM org_units').get() as { c: number }).c;
  if (!ouCount) {
    db.transaction(() => {
      const root = db
        .prepare('INSERT INTO org_units (code, name, parent_id, unit_type, sort_order) VALUES (?, ?, NULL, ?, 0)')
        .run('OU_XN', 'Xí nghiệp Nước Hồng Gai', 'Xí nghiệp');
      const rootId = Number(root.lastInsertRowid);
      const ins = db.prepare('INSERT INTO org_units (code, name, parent_id, unit_type, sort_order) VALUES (?, ?, ?, ?, ?)');
      const stations = db.prepare('SELECT id, code, name FROM stations ORDER BY id').all() as { id: number; code: string; name: string }[];
      for (const s of stations) {
        ins.run(`OU_${s.code}`, s.name, rootId, 'Trạm', s.id);
      }
      db.prepare(
        `UPDATE employees
         SET org_unit_id = (SELECT ou.id FROM org_units ou JOIN stations st ON ou.code = 'OU_' || st.code WHERE st.id = employees.station_id)
         WHERE station_id IS NOT NULL AND org_unit_id IS NULL`
      ).run();
    })();
  }
}

function seedMovementsIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM stock_movements').get() as { c: number }).c;
  if (count > 0) return;

  const prodSource = (db.prepare(`SELECT id FROM import_sources WHERE code = 'SRC_PARENT'`).get() ??
    db.prepare(`SELECT id FROM import_sources WHERE code = 'SRC_PRODUCTION'`).get()) as { id: number } | undefined;

  const items = db
    .prepare(
      `SELECT oi.order_id as order_id, oi.product_id as product_id, oi.quantity as quantity, oi.quantity_promo as qp,
              o.warehouse_id as warehouse_id, o.shipper_employee_id as shipper, o.seller_employee_id as seller,
              o.order_date as order_date, o.order_code as order_code
       FROM order_items oi JOIN orders o ON oi.order_id = o.id
       WHERE o.order_status != 'CANCELLED'`
    )
    .all() as {
    order_id: number;
    product_id: number;
    quantity: number;
    qp: number;
    warehouse_id: number;
    shipper: number | null;
    seller: number;
    order_date: string;
    order_code: string;
  }[];

  const stocks = db.prepare(`SELECT warehouse_id, product_id, quantity FROM inventory_stock`).all() as {
    warehouse_id: number;
    product_id: number;
    quantity: number;
  }[];

  const ins = db.prepare(
    `INSERT INTO stock_movements
      (movement_type, source_warehouse_id, target_warehouse_id, source_id, product_id, quantity, quantity_promo, reference_id, performed_by, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Bảng tồn kho là số SAU khi các đơn mẫu đã xuất hàng, nên tồn đầu kỳ trong sổ bút toán
  // phải cộng lại đúng phần đã xuất — nếu không, báo cáo đối soát kho sẽ báo lệch ngay từ dữ liệu gốc.
  const exportedByCell = new Map<string, number>();
  for (const it of items) {
    const key = `${it.warehouse_id}-${it.product_id}`;
    exportedByCell.set(key, (exportedByCell.get(key) ?? 0) + (Number(it.quantity) || 0) + (Number(it.qp) || 0));
  }

  db.transaction(() => {
    for (const it of items) {
      ins.run(
        'EXPORT_ORDER',
        it.warehouse_id,
        null,
        null,
        it.product_id,
        it.quantity,
        it.qp || 0,
        String(it.order_id),
        it.shipper ?? it.seller,
        `Xuất bán theo đơn ${it.order_code}`,
        it.order_date
      );
    }
    for (const s of stocks) {
      const opening = (Number(s.quantity) || 0) + (exportedByCell.get(`${s.warehouse_id}-${s.product_id}`) ?? 0);
      if (opening <= 0) continue;
      ins.run(
        'IMPORT',
        null,
        s.warehouse_id,
        prodSource?.id ?? null,
        s.product_id,
        opening,
        0,
        null,
        null,
        'Tồn kho khởi tạo',
        '2026-09-01'
      );
    }
  })();
}

let dbInstance: Database.Database | null = null;

// Id kho ảo dùng cho đơn mượn đối tác.
export function loanWarehouseId(): number {
  return ensureLoanWarehouse(getDb());
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const isNew = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0;
  dbInstance = new Database(dbPath);
  dbInstance.pragma('foreign_keys = ON');
  initializeDatabase(dbInstance, isNew);
  return dbInstance;
}

// Danh mục nền & cấu hình: nút "Xóa toàn bộ dữ liệu" GIỮ NGUYÊN các bảng này
// (xí nghiệp khai một lần rồi dùng mãi: nhóm hàng, sản phẩm, bảng giá, phí vận chuyển,
// khuyến mãi, cọc vỏ, chức vụ, nhóm khách hàng, thuế, kho hiện tại và cấu hình chung).
const PRESERVED_TABLES = [
  'app_settings',
  'categories',
  'products',
  'price_list',
  'shipping_fees',
  'promotions',
  'shell_deposits',
  'positions',
  'customer_groups',
  'vat_rates',
  'warehouses',
];

// Đưa CSDL về mặc định: xoá sạch DỮ LIỆU NGHIỆP VỤ (khách hàng, đơn hàng, tồn kho, phiếu kho,
// sổ quỹ, nhân viên...) nhưng giữ nguyên danh mục nền ở trên, rồi nạp lại các danh mục
// do phần mềm tự tạo (chức vụ, nguồn nhập, đối tác, cọc vỏ, thuế, 3 kho ảo...).
// KHÔNG nạp seed.sql nên không có dữ liệu mẫu.
export function resetDatabase(): void {
  const db = getDb();
  const preserved = new Set(PRESERVED_TABLES);
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all() as { name: string }[];

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    for (const table of tables) {
      if (preserved.has(table.name)) continue;
      db.prepare(`DELETE FROM "${table.name}"`).run();
    }
    // Nhân viên bị xoá nên bỏ tham chiếu trưởng kho, tránh kho còn trỏ vào bản ghi đã mất.
    db.prepare(`UPDATE warehouses SET manager_employee_id = NULL WHERE manager_employee_id IS NOT NULL`).run();
    // Quy tắc vận chuyển: bật cả hai theo mặc định của xí nghiệp.
    const setSetting = db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    );
    setSetting.run(FREE_SHIP_WITHOUT_SHIPPER, '1');
    setSetting.run(FREE_SHIP_FOR_CUSTOMER, '1');
  })();
  if (db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`).get()) {
    db.prepare('DELETE FROM sqlite_sequence').run();
  }
  db.pragma('foreign_keys = ON');
  initializeDatabase(db, false);
}

// Khởi tạo/khôi phục CSDL: áp schema (idempotent), seed dữ liệu gốc khi cần, rồi chạy migration.
function initializeDatabase(dbInstance: Database.Database, forceSeed: boolean): void {
  // Luôn áp schema (idempotent) để cả DB cũ lẫn DB mới đều có đủ bảng mới.
  const schemaPath = findSqlPath('schema.sql');
  if (fs.existsSync(schemaPath)) {
    dbInstance.exec(fs.readFileSync(schemaPath, 'utf-8'));
    console.log('[API Database] Schema applied from:', schemaPath);
  } else {
    console.error('[API Database] ERROR: schema.sql not found!');
  }

  // Danh mục nền luôn phải có, và phải nạp TRƯỚC dữ liệu mẫu vì dữ liệu mẫu tham chiếu ID danh mục.
  applyDefaultCatalog(dbInstance);

  // Chỉ nạp dữ liệu mẫu cho CSDL MỚI (file chưa có / rỗng) hoặc khi reset có yêu cầu.
  // KHÔNG tự nạp khi bảng đang trống: nút "Xóa toàn bộ dữ liệu" cố ý để lại CSDL trống,
  // tự nạp lại sẽ làm dữ liệu mẫu sống dậy sau mỗi lần khởi động.
  if (forceSeed) {
    console.log('[API Database] Seeding initial data from seed.sql...');
    const seedPath = findSqlPath('seed.sql');
    if (fs.existsSync(seedPath)) {
      dbInstance.exec(fs.readFileSync(seedPath, 'utf-8'));
      console.log('[API Database] Seed data loaded successfully from:', seedPath);
    } else {
      console.error('[API Database] ERROR: seed.sql not found!');
    }
  }

  // 5 kho vật lý mặc định cũng là dữ liệu nền — luôn có mặt (kho người dùng tự tạo vẫn được giữ
  // nguyên). Chạy SAU seed để không tranh ID với dữ liệu mẫu trên CSDL mới.
  ensureDefaultPhysicalWarehouses(dbInstance);

  // Migration nhẹ: bổ sung cột mới vào các bảng đã tồn tại từ phiên bản cũ.
  ensureColumn(dbInstance, 'products', 'barcode', 'TEXT');
  ensureColumn(dbInstance, 'customers', 'personal_id', 'TEXT');
  ensureColumn(dbInstance, 'customers', 'budget_relation_code', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'shipping_receiver', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'shipping_phone', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'shipping_address', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'shipping_note', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'shipping_fee_id', 'INTEGER');
  ensureColumn(dbInstance, 'orders', 'invoice_status', "TEXT DEFAULT 'NOT_INVOICED'");
  ensureColumn(dbInstance, 'orders', 'personal_id_vat', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'budget_relation_code_vat', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'order_type', "TEXT DEFAULT 'SALE'");
  ensureColumn(dbInstance, 'orders', 'partner_unit_id', 'INTEGER');
  ensureColumn(dbInstance, 'orders', 'target_scope', "TEXT DEFAULT 'ENTERPRISE'");
  ensureColumn(dbInstance, 'orders', 'loan_settled_at', 'DATETIME');
  ensureColumn(dbInstance, 'orders', 'loan_settle_type', 'TEXT');
  ensureColumn(dbInstance, 'orders', 'loan_due_date', 'DATE');
  ensureColumn(dbInstance, 'orders', 'returned_shells_voi', 'INTEGER DEFAULT 0');
  ensureColumn(dbInstance, 'orders', 'returned_shells_up', 'INTEGER DEFAULT 0');
  ensureColumn(dbInstance, 'orders', 'deposit_override', 'REAL');
  ensureColumn(dbInstance, 'orders', 'merged_into_id', 'INTEGER');
  ensureColumn(dbInstance, 'orders', 'support_station_id', 'INTEGER');
  dropColumnIfExists(dbInstance, 'orders', 'free_ship_customer');
  ensureColumn(dbInstance, 'stock_movements', 'ticket_id', 'INTEGER');
  ensureColumn(dbInstance, 'stock_tickets', 'status', "TEXT DEFAULT 'DRAFT'");
  ensureColumn(dbInstance, 'stock_tickets', 'check_note', 'TEXT');
  ensureColumn(dbInstance, 'stock_tickets', 'vehicle', 'TEXT');
  ensureColumn(dbInstance, 'stock_tickets', 'in_charge_employee_id', 'INTEGER');
  ensureColumn(dbInstance, 'stock_ticket_items', 'quality', 'TEXT');
  ensureColumn(dbInstance, 'stock_ticket_items', 'quantity_promo', 'INTEGER DEFAULT 0');
  ensureColumn(dbInstance, 'stock_ticket_items', 'order_item_id', 'INTEGER');
  ensureColumn(dbInstance, 'order_shippers', 'kind', "TEXT DEFAULT 'DELIVERY'");

  // Phân loại sản phẩm: hàng bán (có tồn kho) vs dịch vụ (không tồn kho, không lên đơn).
  // Nhóm Dịch Vụ Gia Tăng luôn là dịch vụ — seed cũ và DB cũ có thể đang gán nhầm GOODS.
  ensureColumn(dbInstance, 'products', 'product_type', "TEXT DEFAULT 'GOODS'");
  dbInstance.exec(
    `UPDATE products SET product_type = CASE
       WHEN category_id IN (SELECT id FROM categories WHERE type = 'SERVICE_DVGT') THEN 'SERVICE'
       ELSE 'GOODS' END
     WHERE COALESCE(product_type, '') <> CASE
       WHEN category_id IN (SELECT id FROM categories WHERE type = 'SERVICE_DVGT') THEN 'SERVICE'
       ELSE 'GOODS' END`
  );
  rebuildOrdersIfNeeded(dbInstance);

  // Giá trước thuế của sản phẩm: seed cũ ghi cột cost_price bằng giá vốn (bình 48.000đ ghi 18.000đ)
  // trong khi toàn bộ phần mềm hiểu cost_price là GIÁ TRƯỚC THUẾ. Chỉ sửa những dòng còn giữ đúng
  // giá trị cũ của seed, không đụng vào giá người dùng đã tự nhập.
  const legacyCostPrices: [string, number][] = [
    ['RO_19L_VOI', 18000],
    ['RO_19L_UP', 18000],
    ['KIEM_19L_VOI', 21000],
    ['KIEM_19L_UP', 21000],
    ['VI_350ML', 42000],
    ['HOP_350ML', 50000],
    ['VI_500ML', 48000],
    ['HOP_500ML', 56000],
    ['DV_BINH_NL', 60000],
    ['DV_BE_TEC', 90000],
    ['DV_MAY_GIAT', 70000],
  ];
  const vatRate = vatRateAt(dbInstance);
  const fixLegacyCostPrice = dbInstance.prepare(
    `UPDATE products SET cost_price = ROUND(standard_price / (1 + ? / 100.0)) WHERE code = ? AND cost_price = ?`
  );
  for (const [code, legacyValue] of legacyCostPrices) fixLegacyCostPrice.run(vatRate, code, legacyValue);

  // Kho vật lý mặc định: danh sách chuẩn của xí nghiệp gồm "Kho Hà Lầm". CSDL cũ có thể đang dùng
  // tên cũ "Kho Trạm Đá Trắng" (KHO_DATRANG) — đổi sang "Kho Hà Lầm" cho khớp danh sách chuẩn.
  if (!dbInstance.prepare(`SELECT 1 FROM warehouses WHERE code = 'KHO_HALAM'`).get()) {
    dbInstance
      .prepare(
        `UPDATE warehouses SET code = 'KHO_HALAM', name = 'Kho Hà Lầm', location = 'Hà Lầm, Hạ Long'
         WHERE code = 'KHO_DATRANG'`
      )
      .run();
  }

  // Chuyển dữ liệu từ cột cũ order_owner_type (OWN/PARTNER) sang order_type rồi bỏ cột cũ.
  const orderCols = dbInstance.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  if (orderCols.some((c) => c.name === 'order_owner_type')) {
    dbInstance.exec(
      `UPDATE orders SET order_type = CASE WHEN order_owner_type = 'PARTNER' THEN 'LEND_OUT' ELSE 'SALE' END`
    );
    dropColumnIfExists(dbInstance, 'orders', 'order_owner_type');
  }
  rebuildStockMovementsIfNeeded(dbInstance);
  rebuildShellTablesIfNeeded(dbInstance);
  rebuildWarehousesIfNeeded(dbInstance);
  ensureLoanWarehouse(dbInstance);
  ensureTransitWarehouse(dbInstance);
  ensureCustomerWarehouse(dbInstance);
  ensureVatRates(dbInstance);
  ensureShellDeposits(dbInstance);
  ensureAppSettings(dbInstance);
  normalizeOrderTotals(dbInstance);
  normalizeCompanySourceOrders(dbInstance);
  backfillCompanySourceShells(dbInstance);
  ensureColumn(dbInstance, 'invoices', 'personal_id', 'TEXT');
  ensureColumn(dbInstance, 'invoices', 'budget_relation_code', 'TEXT');

  // Nhóm khách hàng chỉ là định nghĩa; giá theo nhóm do bảng giá quy định.
  dropColumnIfExists(dbInstance, 'customer_groups', 'discount_percent');

  // Nhân sự: đơn vị, chức vụ, hồ sơ lý lịch; bỏ phân quyền vai trò.
  ensureColumn(dbInstance, 'employees', 'org_unit_id', 'INTEGER');
  ensureColumn(dbInstance, 'employees', 'position_id', 'INTEGER');
  ensureColumn(dbInstance, 'employees', 'date_of_birth', 'TEXT');
  ensureColumn(dbInstance, 'employees', 'gender', 'TEXT');
  ensureColumn(dbInstance, 'employees', 'id_number', 'TEXT');
  ensureColumn(dbInstance, 'employees', 'join_date', 'TEXT');
  ensureColumn(dbInstance, 'employees', 'education', 'TEXT');
  dropColumnIfExists(dbInstance, 'employees', 'role_id');
  dropTableIfExists(dbInstance, 'roles');

  // Bỏ module Dịch vụ gia tăng, Vay mượn liên chi nhánh và bảng KPI cũ (đã gộp về targets).
  dropColumnIfExists(dbInstance, 'revenue_transactions', 'dvgt_id');
  allowSaleRefundTransactions(dbInstance);
  ensureColumn(dbInstance, 'order_returns', 'returned_amount', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(dbInstance, 'order_returns', 'refund_amount', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(dbInstance, 'order_returns', 'refund_transaction_id', 'INTEGER');
  allowMultipleOrderReturns(dbInstance);
  dropTableIfExists(dbInstance, 'kpi_evaluations');
  dropTableIfExists(dbInstance, 'branch_loan_settlements');
  dropTableIfExists(dbInstance, 'branch_loan_items');
  dropTableIfExists(dbInstance, 'branch_loans');
  dropTableIfExists(dbInstance, 'partner_branches');
  dropTableIfExists(dbInstance, 'dvgt_requests');
  // Vỏ bình nay do sổ vỏ (shell_stock/shell_movements) quản; bảng quyết toán ca và sổ vỏ nhân viên không còn nơi ghi.
  dropTableIfExists(dbInstance, 'delivery_settlements');
  dropTableIfExists(dbInstance, 'employee_bottle_ledgers');
  // Cờ "có chu kỳ vỏ" không dùng ở đâu — cọc vỏ đã có danh mục riêng theo loại vỏ.
  dropColumnIfExists(dbInstance, 'products', 'has_shell_cycle');

  // Bỏ danh mục quy cách quy đổi — quy đổi 1 Hộp = 4 Vỉ chỉ dùng để đổi đơn vị số lượng, không dùng tính giá.
  dropTableIfExists(dbInstance, 'product_conversions');

  ensureColumn(dbInstance, 'stock_movements', 'source_id', 'INTEGER');

  const srcCount = (dbInstance.prepare('SELECT COUNT(*) as c FROM import_sources').get() as { c: number }).c;
  if (!srcCount) {
    const insSrc = dbInstance.prepare('INSERT INTO import_sources (code, name) VALUES (?, ?)');
    const defaults: [string, string][] = [
      ['SRC_PARENT', 'Kho Công ty Quawaco'],
      ['SRC_PRODUCTION', 'Xưởng sản xuất'],
      ['SRC_SUPPLIER', 'Nhà cung cấp'],
      ['SRC_OTHER', 'Khác'],
    ];
    dbInstance.transaction(() => {
      for (const [c, n] of defaults) insSrc.run(c, n);
    })();
  }
  // Nguồn hàng chính của xí nghiệp: nhận từ công ty mẹ Quawaco (DB cũ chưa có thì bổ sung / đổi tên).
  if (!dbInstance.prepare(`SELECT id FROM import_sources WHERE code = 'SRC_PARENT'`).get()) {
    dbInstance
      .prepare(`INSERT INTO import_sources (code, name, note) VALUES ('SRC_PARENT', 'Kho Công ty Quawaco', 'Nguồn hàng chính của xí nghiệp')`)
      .run();
  } else {
    dbInstance
      .prepare(`UPDATE import_sources SET name = 'Kho Công ty Quawaco' WHERE code = 'SRC_PARENT' AND name <> 'Kho Công ty Quawaco'`)
      .run();
  }

  const partnerCount = (dbInstance.prepare('SELECT COUNT(*) as c FROM partner_units').get() as { c: number }).c;
  if (!partnerCount) {
    const insPartner = dbInstance.prepare(
      'INSERT INTO partner_units (code, name, contact_person, phone, address, note) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const defaults: [string, string, string, string, string, string][] = [
      ['DT_CAM_PHA', 'Xí Nghiệp Nước Cẩm Phả', 'Anh Tuấn', '0203.3861.222', 'Cẩm Phả, Quảng Ninh', 'Đơn vị bạn cùng công ty mẹ'],
      ['DT_BAI_CHAY', 'Xí Nghiệp Nước Bãi Cháy', 'Chị Hạnh', '0203.3846.555', 'Bãi Cháy, Hạ Long', 'Đơn vị bạn cùng công ty mẹ'],
    ];
    dbInstance.transaction(() => {
      for (const row of defaults) insPartner.run(...row);
    })();
  }

  // Chỉ tiêu đổi sang mô hình chỉ tiêu doanh thu (bỏ mô hình metric cũ nếu có).
  const targetCols = dbInstance.prepare('PRAGMA table_info(targets)').all() as { name: string }[];
  if (targetCols.some((c) => c.name === 'metric')) {
    dbInstance.exec('DROP TABLE targets');
  }
  dbInstance.exec(`CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    scope_type TEXT CHECK(scope_type IN ('EMPLOYEE', 'UNIT')) NOT NULL,
    employee_id INTEGER REFERENCES employees(id),
    org_unit_id INTEGER REFERENCES org_units(id),
    target_revenue REAL DEFAULT 0.0,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  seedOrgData(dbInstance);
  seedMovementsIfEmpty(dbInstance);

  // Gỡ 2 cột phí thừa không dùng (chỉ fee_per_unit có tác dụng) — DB cũ còn giữ thì xoá cho sạch.
  dropColumnIfExists(dbInstance, 'shipping_fees', 'fee_per_trip');
  dropColumnIfExists(dbInstance, 'shipping_fees', 'min_fee');

  // Mức phí mặc định đã chốt: 5.000đ cho mỗi đơn vị hàng thực giao.
  if (!(dbInstance.prepare('SELECT 1 FROM shipping_fees LIMIT 1').get())) {
    dbInstance.prepare(`INSERT INTO shipping_fees (code, name, fee_per_unit, is_active)
      VALUES ('MAC_DINH_5000', 'Phí giao mặc định 5.000đ/đơn vị', 5000, 1)`).run();
  }

  // Phí vận chuyển: đơn cũ chỉ có shipper_employee_id mà chưa có dòng phân bổ trong order_shippers
  // → tạo dòng phân bổ cho người giao đó nhận toàn bộ phí ship, để form đơn và báo cáo phí thống nhất.
  const backfilledShippers = dbInstance
    .prepare(
      `INSERT INTO order_shippers (order_id, employee_id, allocated_fee)
       SELECT o.id, o.shipper_employee_id, o.shipping_fee
       FROM orders o
       WHERE o.shipper_employee_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM order_shippers os WHERE os.order_id = o.id)`
    )
    .run();
  if (backfilledShippers.changes) {
    console.log(`[API Database] Bổ sung ${backfilledShippers.changes} dòng phân bổ phí vận chuyển từ người giao trên đơn.`);
  }
}
