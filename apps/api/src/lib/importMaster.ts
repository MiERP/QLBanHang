import Database from 'better-sqlite3';
import { nextCode, today } from './codes.js';
import {
  buildRefMap,
  normalizeKey,
  optionalDate,
  optionalEnum,
  optionalNumber,
  refId,
  requireEnum,
  requireNumber,
  requireText,
  resolveRef,
  RowErrorCollector,
  textOf,
  boolOf,
  type ImportRow,
  type RefMap,
} from './excelTemplate.js';
import { IMPORT_SPECS, type ImportKind } from './importSpecs.js';
import { badRequest } from './http.js';
import { getStockQuantity } from './stock.js';
import { createTicket } from './stockTickets.js';
import { netPrice, vatRateAt } from './vat.js';

export type ImportMode = 'strict' | 'upsert';

export interface ImportOutcome {
  imported: number;
  updated: number;
  message: string;
  tickets?: string[];
  orderCodes?: string[];
}

export function columnOf(kind: ImportKind, key: string) {
  const column = IMPORT_SPECS[kind].columns.find((c) => c.key === key);
  if (!column) throw new Error(`Thiếu định nghĩa cột "${key}" của "${kind}"`);
  return column;
}

export function refMaps(db: Database.Database) {
  const cache = new Map<string, RefMap>();
  const get = (key: string, build: () => RefMap) => {
    const found = cache.get(key) ?? build();
    cache.set(key, found);
    return found;
  };
  return {
    categories: () => get('categories', () => buildRefMap(db, { table: 'categories', label: 'nhóm hàng' })),
    customerGroups: () => get('customer-groups', () => buildRefMap(db, { table: 'customer_groups', label: 'nhóm khách hàng' })),
    warehouses: () => get('warehouses', () => buildRefMap(db, { table: 'warehouses', label: 'kho' })),
    orgUnits: () => get('org-units', () => buildRefMap(db, { table: 'org_units', label: 'đơn vị' })),
    staff: () => get('staff', () => buildRefMap(db, { table: 'employees', label: 'nhân viên', nameColumn: 'full_name' })),
    positions: () => get('positions', () => buildRefMap(db, { table: 'positions', label: 'chức vụ' })),
    partnerUnits: () => get('partner-units', () => buildRefMap(db, { table: 'partner_units', label: 'đối tác liên kết' })),
    products: () => get('products', () => buildRefMap(db, { table: 'products', label: 'sản phẩm' })),
    customers: () => get('customers', () => buildRefMap(db, { table: 'customers', label: 'khách hàng' })),
    shippingFees: () => get('shipping-fees', () => buildRefMap(db, { table: 'shipping_fees', label: 'tuyến phí vận chuyển' })),
  };
}

export type RefMaps = ReturnType<typeof refMaps>;

interface PreparedRow {
  row: number;
  code: string | null;
  values: Record<string, unknown>;
}

interface SaveResult {
  action: 'insert' | 'update';
  id: number;
  code: string;
}

const clean = (value: unknown) => (value === undefined ? null : typeof value === 'boolean' ? (value ? 1 : 0) : value);

function insertRow(db: Database.Database, table: string, code: string | null, values: Record<string, unknown>): SaveResult {
  const columns = ['code', ...Object.keys(values)];
  const params = [code, ...Object.values(values).map(clean)];
  const result = db
    .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
    .run(...params);
  return { action: 'insert', id: Number(result.lastInsertRowid), code: code ?? '' };
}

function updateRow(db: Database.Database, table: string, code: string, values: Record<string, unknown>): SaveResult {
  const columns = Object.keys(values);
  const params = [...Object.values(values).map(clean), code];
  db.prepare(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE code = ?`).run(...params);
  const row = db.prepare(`SELECT id FROM ${table} WHERE code = ?`).get(code) as { id: number } | undefined;
  return { action: 'update', id: row?.id ?? 0, code };
}

function saveRow(
  db: Database.Database,
  table: string,
  code: string | null,
  autoCode: () => string,
  values: Record<string, unknown>,
  mode: ImportMode
): SaveResult {
  if (code) {
    const existing = db.prepare(`SELECT id FROM ${table} WHERE code = ?`).get(code) as { id: number } | undefined;
    if (existing) {
      if (mode !== 'upsert') throw badRequest(`Mã "${code}" đã tồn tại`);
      return updateRow(db, table, code, values);
    }
  }
  return insertRow(db, table, code ?? autoCode(), values);
}

// Kiểm tra toàn bộ dòng trước: mã bắt buộc, mã lặp trong tệp, mã đã có trong hệ thống.
function prepareRows(
  db: Database.Database,
  table: string,
  rows: ImportRow[],
  errors: RowErrorCollector,
  mode: ImportMode,
  validate: (row: ImportRow) => { code: string | null; values: Record<string, unknown> } | null
): PreparedRow[] {
  const existing = new Set(
    (db.prepare(`SELECT code FROM ${table}`).all() as { code: string | null }[])
      .filter((r) => r.code)
      .map((r) => normalizeKey(r.code))
  );
  const seen = new Map<string, number>();
  const prepared: PreparedRow[] = [];
  for (const row of rows) {
    const result = validate(row);
    if (!result) continue;
    if (result.code) {
      const key = normalizeKey(result.code);
      const duplicated = seen.get(key);
      if (duplicated) {
        errors.add(row.row, `Mã "${result.code}" bị lặp trong tệp (đã dùng ở dòng ${duplicated})`);
        continue;
      }
      seen.set(key, row.row);
      if (existing.has(key) && mode !== 'upsert') {
        errors.add(row.row, `Mã "${result.code}" đã tồn tại trong hệ thống`);
      }
    }
    prepared.push({ row: row.row, code: result.code, values: result.values });
  }
  return prepared;
}

function writePrepared(
  db: Database.Database,
  table: string,
  prepared: PreparedRow[],
  mode: ImportMode,
  autoCode: () => string
): ImportOutcome {
  let imported = 0;
  let updated = 0;
  db.transaction(() => {
    for (const item of prepared) {
      const saved = saveRow(db, table, item.code, autoCode, item.values, mode);
      if (saved.action === 'insert') imported += 1;
      else updated += 1;
    }
  })();
  return { imported, updated, message: outcomeMessage(imported, updated) };
}

function outcomeMessage(imported: number, updated: number) {
  const parts = [`Đã nhập ${imported} dòng`];
  if (updated) parts.push(`cập nhật ${updated} dòng`);
  return parts.join(', ');
}

function importCategories(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const prepared = prepareRows(db, 'categories', rows, errors, mode, (row) => ({
    code: requireText(row, errors, 'code', 'Mã nhóm') || null,
    values: {
      name: requireText(row, errors, 'name', 'Tên nhóm'),
      type: requireEnum(row, errors, columnOf('categories', 'type')),
    },
  }));
  errors.throwIfAny();
  return writePrepared(db, 'categories', prepared, mode, () => nextCode(db, { table: 'categories', column: 'code', prefix: 'NH', width: 3 }));
}

function importCustomerGroups(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const prepared = prepareRows(db, 'customer_groups', rows, errors, mode, (row) => ({
    code: requireText(row, errors, 'code', 'Mã nhóm') || null,
    values: { name: requireText(row, errors, 'name', 'Tên nhóm') },
  }));
  errors.throwIfAny();
  return writePrepared(db, 'customer_groups', prepared, mode, () =>
    nextCode(db, { table: 'customer_groups', column: 'code', prefix: 'NKH', width: 3 })
  );
}

function importWarehouses(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const staff = refMaps(db).staff();
  const prepared = prepareRows(db, 'warehouses', rows, errors, mode, (row) => ({
    code: textOf(row.cells.code) || null,
    values: {
      name: requireText(row, errors, 'name', 'Tên kho'),
      type: requireEnum(row, errors, columnOf('warehouses', 'type')),
      manager_employee_id: refId(row, errors, staff, 'manager', 'Thủ kho') ?? null,
      location: textOf(row.cells.location) || null,
      is_active: boolOf(row.cells.inactive) ? 0 : 1,
    },
  }));
  errors.throwIfAny();
  return writePrepared(db, 'warehouses', prepared, mode, () => nextCode(db, { table: 'warehouses', column: 'code', prefix: 'KHO-', width: 3 }));
}

function importOrgUnits(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const staff = refMaps(db).staff();
  const existing = db.prepare('SELECT id, code, name FROM org_units').all() as { id: number; code: string; name: string }[];
  const ids = new Map<string, number>();
  const existingCodes = new Set<string>();
  for (const unit of existing) {
    if (unit.code) {
      ids.set(normalizeKey(unit.code), unit.id);
      existingCodes.add(normalizeKey(unit.code));
    }
    if (unit.name) ids.set(normalizeKey(unit.name), unit.id);
  }

  const seen = new Map<string, number>();
  const fileKeys = new Set<string>();
  const prepared: { row: number; code: string | null; name: string; parentRaw: string; unitType: string; managerId: number | null; sortOrder: number }[] = [];

  for (const row of rows) {
    const code = textOf(row.cells.code) || null;
    const name = requireText(row, errors, 'name', 'Tên đơn vị');
    const parentRaw = textOf(row.cells.parent);
    const unitType = textOf(row.cells.unit_type);
    const managerId = refId(row, errors, staff, 'manager', 'Trưởng đơn vị') ?? null;
    const sortOrder = optionalNumber(row, errors, 'sort_order', 'Thứ tự') ?? 0;
    if (code) {
      const key = normalizeKey(code);
      const duplicated = seen.get(key);
      if (duplicated) {
        errors.add(row.row, `Mã "${code}" bị lặp trong tệp (đã dùng ở dòng ${duplicated})`);
      } else {
        seen.set(key, row.row);
        if (existingCodes.has(key) && mode !== 'upsert') errors.add(row.row, `Mã "${code}" đã tồn tại trong hệ thống`);
      }
    }
    if (parentRaw) {
      const key = normalizeKey(parentRaw);
      if (!ids.has(key) && !fileKeys.has(key)) {
        errors.add(row.row, `Không tìm thấy đơn vị cấp trên "${parentRaw}" — phải nằm ở dòng phía trên trong tệp hoặc đã có trong hệ thống`);
      }
    }
    if (code) fileKeys.add(normalizeKey(code));
    if (name) fileKeys.add(normalizeKey(name));
    prepared.push({ row: row.row, code, name, parentRaw, unitType, managerId, sortOrder });
  }
  errors.throwIfAny();

  let imported = 0;
  let updated = 0;
  db.transaction(() => {
    for (const item of prepared) {
      const parentId = item.parentRaw ? ids.get(normalizeKey(item.parentRaw)) ?? null : null;
      const saved = saveRow(
        db,
        'org_units',
        item.code,
        () => nextCode(db, { table: 'org_units', column: 'code', prefix: 'DV-', width: 3 }),
        {
          name: item.name,
          parent_id: parentId,
          unit_type: item.unitType || null,
          manager_employee_id: item.managerId,
          sort_order: item.sortOrder,
        },
        mode
      );
      if (saved.action === 'insert') imported += 1;
      else updated += 1;
      ids.set(normalizeKey(item.name), saved.id);
      ids.set(normalizeKey(saved.code), saved.id);
    }
  })();
  return { imported, updated, message: outcomeMessage(imported, updated) };
}

function importStaff(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const maps = refMaps(db);
  const orgUnits = maps.orgUnits();
  const positions = maps.positions();
  const prepared = prepareRows(db, 'employees', rows, errors, mode, (row) => {
    const positionId = refId(row, errors, positions, 'position', 'Chức vụ') ?? null;
    const positionName = positionId
      ? ((db.prepare('SELECT name FROM positions WHERE id = ?').get(positionId) as { name: string } | undefined)?.name ?? '')
      : '';
    return {
      code: textOf(row.cells.code) || null,
      values: {
        full_name: requireText(row, errors, 'full_name', 'Họ tên'),
        org_unit_id: refId(row, errors, orgUnits, 'org_unit', 'Đơn vị') ?? null,
        position_id: positionId,
        position: positionName,
        phone: textOf(row.cells.phone),
        home_address: textOf(row.cells.home_address),
        date_of_birth: optionalDate(row, errors, 'date_of_birth', 'Ngày sinh') ?? null,
        gender: textOf(row.cells.gender) || null,
        id_number: textOf(row.cells.id_number) || null,
        join_date: optionalDate(row, errors, 'join_date', 'Ngày vào làm') ?? null,
        education: textOf(row.cells.education) || null,
        commission_rate: optionalNumber(row, errors, 'commission_rate', 'Tỷ lệ hoa hồng') ?? 0,
        shipping_allowance: optionalNumber(row, errors, 'shipping_allowance', 'Phụ cấp giao hàng') ?? 5000,
        is_active: boolOf(row.cells.inactive) ? 0 : 1,
      },
    };
  });
  errors.throwIfAny();
  return writePrepared(db, 'employees', prepared, mode, () => nextCode(db, { table: 'employees', column: 'code', prefix: 'NV', width: 3 }));
}

function importProducts(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const categories = refMaps(db).categories();
  const fallbackCategory = db.prepare('SELECT id FROM categories ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
  const prepared = prepareRows(db, 'products', rows, errors, mode, (row) => {
    const categoryRaw = textOf(row.cells.category);
    let categoryId = fallbackCategory?.id;
    if (categoryRaw) {
      const resolved = resolveRef(categories, categoryRaw);
      if (!resolved) errors.add(row.row, `Không tìm thấy nhóm hàng "${categoryRaw}"`);
      else categoryId = resolved;
    }
    const categoryType = categoryId
      ? ((db.prepare('SELECT type FROM categories WHERE id = ?').get(categoryId) as { type: string } | undefined)?.type ?? '')
      : '';
    const productType = optionalEnum(row, errors, columnOf('products', 'product_type')) ?? 'GOODS';
    const isService = productType === 'SERVICE';
    const unit = textOf(row.cells.unit) || (categoryType === 'PACK_WATER' ? 'Vỉ' : 'Bình');
    const bottleType =
      optionalEnum(row, errors, columnOf('products', 'bottle_type')) ??
      (!isService && categoryType === 'BOTTLE_WATER' && unit === 'Bình' ? 'VOI' : 'NONE');
    const standardPrice = requireNumber(row, errors, 'standard_price', 'Giá bán');
    const bottleFree = isService || bottleType === 'NONE';
    const costPrice = optionalNumber(row, errors, 'cost_price', 'Giá trước thuế');
    const depositFee = bottleFree ? undefined : optionalNumber(row, errors, 'deposit_fee', 'Cọc vỏ');
    if (standardPrice !== undefined && standardPrice < 0) errors.add(row.row, '"Giá bán" không được là số âm');
    if (costPrice !== undefined && costPrice < 0) errors.add(row.row, '"Giá trước thuế" không được là số âm');
    if (depositFee !== undefined && depositFee < 0) errors.add(row.row, '"Cọc vỏ" không được là số âm');
    return {
      code: textOf(row.cells.code) || null,
      values: {
        category_id: categoryId ?? null,
        name: requireText(row, errors, 'name', 'Tên sản phẩm'),
        unit,
        product_type: productType,
        bottle_type: bottleFree ? 'NONE' : bottleType,
        standard_price: standardPrice ?? 0,
        wholesale_price: standardPrice ?? 0,
        cost_price: costPrice ?? netPrice(standardPrice ?? 0, vatRateAt(db)),
        deposit_fee: depositFee ?? 0,
        barcode: textOf(row.cells.barcode) || null,
        is_active: boolOf(row.cells.inactive) ? 0 : 1,
      },
    };
  });
  errors.throwIfAny();
  return writePrepared(db, 'products', prepared, mode, () => nextCode(db, { table: 'products', column: 'code', prefix: 'SP', width: 4 }));
}

function importCustomers(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector, mode: ImportMode): ImportOutcome {
  const groups = refMaps(db).customerGroups();
  const nonNegative = (row: ImportRow, key: string, label: string) => {
    const value = optionalNumber(row, errors, key, label);
    if (value !== undefined && value < 0) errors.add(row.row, `"${label}" không được là số âm`);
    return value;
  };
  const prepared = prepareRows(db, 'customers', rows, errors, mode, (row) => ({
    code: textOf(row.cells.code) || null,
    values: {
      group_id: refId(row, errors, groups, 'group', 'Nhóm khách hàng') ?? null,
      name: requireText(row, errors, 'name', 'Tên khách hàng'),
      phone: textOf(row.cells.phone),
      address: requireText(row, errors, 'address', 'Địa chỉ'),
      tax_code: textOf(row.cells.tax_code),
      contact_person: textOf(row.cells.contact_person),
      personal_id: textOf(row.cells.personal_id),
      budget_relation_code: textOf(row.cells.budget_relation_code),
      max_debt_limit: nonNegative(row, 'max_debt_limit', 'Hạn mức nợ') ?? 10000000,
      current_debt: nonNegative(row, 'current_debt', 'Nợ đầu kỳ') ?? 0,
      bottle_debt_voi: nonNegative(row, 'bottle_debt_voi', 'Nợ vỏ bình vòi') ?? 0,
      bottle_debt_up: nonNegative(row, 'bottle_debt_up', 'Nợ vỏ bình úp') ?? 0,
      is_active: boolOf(row.cells.inactive) ? 0 : 1,
    },
  }));
  errors.throwIfAny();
  return writePrepared(db, 'customers', prepared, mode, () => nextCode(db, { table: 'customers', column: 'code', prefix: 'KH', width: 3 }));
}

// Tồn kho đầu kỳ: đặt tồn = đúng số trong tệp bằng phiếu điều chỉnh tăng/giảm đã xác nhận.
function importOpeningStock(db: Database.Database, rows: ImportRow[], errors: RowErrorCollector): ImportOutcome {
  const maps = refMaps(db);
  const warehouses = maps.warehouses();
  const products = maps.products();
  const seen = new Map<string, number>();
  const lines: { warehouseId: number; productId: number; quantity: number; minStock?: number; date: string }[] = [];

  for (const row of rows) {
    const warehouseId = refId(row, errors, warehouses, 'warehouse', 'Kho', true);
    const productId = refId(row, errors, products, 'product', 'Mã sản phẩm', true);
    const quantity = requireNumber(row, errors, 'quantity', 'Số lượng tồn');
    const minStock = optionalNumber(row, errors, 'min_stock_alert', 'Tồn tối thiểu');
    const date = optionalDate(row, errors, 'date', 'Ngày') ?? today();
    if (quantity !== undefined && quantity < 0) errors.add(row.row, 'Số lượng tồn không được là số âm');
    if (minStock !== undefined && minStock < 0) errors.add(row.row, 'Tồn tối thiểu không được là số âm');
    if (warehouseId && productId) {
      const key = `${warehouseId}|${productId}`;
      const duplicated = seen.get(key);
      if (duplicated) errors.add(row.row, `Trùng mặt hàng với dòng ${duplicated} trong cùng kho`);
      else seen.set(key, row.row);
    }
    if (warehouseId && productId && quantity !== undefined && quantity >= 0) {
      lines.push({ warehouseId, productId, quantity, minStock, date });
    }
  }
  errors.throwIfAny();

  const tickets: string[] = [];
  db.transaction(() => {
    const setThreshold = db.prepare(
      `INSERT INTO inventory_stock (warehouse_id, product_id, quantity, min_stock_alert)
       VALUES (?, ?, 0, ?)
       ON CONFLICT(warehouse_id, product_id) DO UPDATE SET min_stock_alert = excluded.min_stock_alert`
    );
    const groups = new Map<string, { warehouseId: number; direction: 'IN' | 'OUT'; date: string; items: { product_id: number; quantity: number }[] }>();
    for (const line of lines) {
      if (line.minStock !== undefined) setThreshold.run(line.warehouseId, line.productId, line.minStock);
      const delta = line.quantity - getStockQuantity(db, line.warehouseId, line.productId);
      if (delta === 0) continue;
      const direction = delta > 0 ? 'IN' : 'OUT';
      const key = `${line.warehouseId}|${direction}|${line.date}`;
      const group = groups.get(key) ?? { warehouseId: line.warehouseId, direction, date: line.date, items: [] };
      group.items.push({ product_id: line.productId, quantity: Math.abs(delta) });
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const ticket = createTicket(db, {
        ticketType: group.direction,
        ticketDate: group.date,
        warehouseId: group.warehouseId,
        reason: group.direction === 'IN' ? 'ADJUST_IN' : 'ADJUST_OUT',
        note: 'Tồn kho đầu kỳ (nhập từ Excel)',
        status: 'CONFIRMED',
        items: group.items,
      });
      tickets.push(ticket.code);
    }
  })();

  const message = tickets.length
    ? `Đã đặt tồn kho cho ${lines.length} mặt hàng, tạo ${tickets.length} phiếu điều chỉnh`
    : `Đã kiểm tra ${lines.length} mặt hàng — tồn kho đã khớp, không cần điều chỉnh`;
  return { imported: lines.length, updated: 0, message, tickets };
}

export function importMasterRows(
  db: Database.Database,
  kind: ImportKind,
  rows: ImportRow[],
  mode: ImportMode
): ImportOutcome {
  const errors = new RowErrorCollector();
  if (!rows.length) return { imported: 0, updated: 0, message: 'Tệp không có dòng dữ liệu nào' };
  switch (kind) {
    case 'categories':
      return importCategories(db, rows, errors, mode);
    case 'customer-groups':
      return importCustomerGroups(db, rows, errors, mode);
    case 'warehouses':
      return importWarehouses(db, rows, errors, mode);
    case 'org-units':
      return importOrgUnits(db, rows, errors, mode);
    case 'staff':
      return importStaff(db, rows, errors, mode);
    case 'products':
      return importProducts(db, rows, errors, mode);
    case 'customers':
      return importCustomers(db, rows, errors, mode);
    case 'opening-stock':
      return importOpeningStock(db, rows, errors);
    default:
      return { imported: 0, updated: 0, message: '' };
  }
}
