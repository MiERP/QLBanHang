import { Router } from 'express';
import { getDb } from '../db.js';
import { today } from '../lib/codes.js';
import { ApiError, badRequest, handle } from '../lib/http.js';
import { getStockQuantity } from '../lib/stock.js';
import { IN_REASONS, OUT_REASONS, createTicket, deleteTicket, setTicketStatus, updateTicket, type TicketStatus, type TicketType } from '../lib/stockTickets.js';
import { buildStockTicketWorkbook, type TicketLine } from '../lib/stockTicketExcel.js';

interface TicketQuery {
  direction?: string;
  order_id?: string;
  month?: string;
  warehouse_id?: string;
  from?: string;
  to?: string;
  /** Danh sách id cách nhau dấu phẩy — dùng khi chỉ in/xuất các phiếu đã chọn. */
  ids?: string;
}

function loadTickets(db: ReturnType<typeof getDb>, q: TicketQuery) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (q.ids) {
    const list = q.ids.split(',').map(Number).filter(Boolean);
    if (list.length) {
      clauses.push(`t.id IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (q.order_id) {
    clauses.push('t.order_id = ?');
    params.push(q.order_id);
  }
  if (q.month) {
    clauses.push(`strftime('%Y-%m', t.ticket_date) = ?`);
    params.push(q.month);
  }
  if (q.from) {
    clauses.push('t.ticket_date >= ?');
    params.push(q.from);
  }
  if (q.to) {
    clauses.push('t.ticket_date <= ?');
    params.push(q.to);
  }
  if (q.warehouse_id) {
    clauses.push('(t.warehouse_id = ? OR t.target_warehouse_id = ?)');
    params.push(q.warehouse_id, q.warehouse_id);
  }
  if (q.direction === 'IN') clauses.push(`t.ticket_type IN ('IN', 'TRANSFER')`);
  else if (q.direction === 'OUT') clauses.push(`t.ticket_type IN ('OUT', 'TRANSFER')`);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT t.*, w.name as warehouse_name, tw.name as target_warehouse_name,
              pu.name as partner_unit_name, src.name as source_name,
              o.order_code, o.order_status, c.name as customer_name, e.full_name as created_by_name,
              ic.full_name as in_charge_name
       FROM stock_tickets t
       LEFT JOIN warehouses w ON t.warehouse_id = w.id
       LEFT JOIN warehouses tw ON t.target_warehouse_id = tw.id
       LEFT JOIN partner_units pu ON t.partner_unit_id = pu.id
       LEFT JOIN import_sources src ON t.source_id = src.id
       LEFT JOIN orders o ON t.order_id = o.id
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN employees e ON t.created_by = e.id
       LEFT JOIN employees ic ON t.in_charge_employee_id = ic.id
       ${where}
       ORDER BY t.id DESC LIMIT 500`
    )
    .all(...params) as Record<string, unknown>[];

  const getItems = db.prepare(
    `SELECT i.*, p.name as product_name, p.unit
     FROM stock_ticket_items i JOIN products p ON i.product_id = p.id
     WHERE i.ticket_id = ?`
  );
  return rows.map((r) => ({ ...r, items: getItems.all(r.id as number) }));
}

export function stockTicketsRouter(): Router {
  const router = Router();
  const db = getDb();

  // Kiểm kê kho: so số đếm thực tế với tồn hệ thống, tự sinh phiếu điều chỉnh tăng/giảm.
  router.post(
    '/stock-tickets/stock-count',
    handle((req, res) => {
      const body = req.body ?? {};
      const warehouseId = Number(body.warehouse_id);
      if (!warehouseId) throw badRequest('Chọn kho cần kiểm kê');
      const countDate = String(body.count_date || today());
      const note = String(body.note || '').trim();
      const lines = Array.isArray(body.lines) ? (body.lines as { product_id: unknown; counted: unknown }[]) : [];
      if (!lines.length) throw badRequest('Chưa nhập số lượng kiểm kê');

      const result = db.transaction(() => {
        const surplus: { product_id: number; quantity: number }[] = [];
        const shortage: { product_id: number; quantity: number }[] = [];
        for (const line of lines) {
          const productId = Number(line.product_id);
          const counted = Number(line.counted);
          if (!productId || Number.isNaN(counted) || counted < 0) continue;
          const delta = counted - getStockQuantity(db, warehouseId, productId);
          if (delta > 0) surplus.push({ product_id: productId, quantity: delta });
          else if (delta < 0) shortage.push({ product_id: productId, quantity: -delta });
        }

        const tickets: string[] = [];
        const ticketNote = note || `Kiểm kê kho ngày ${countDate}`;
        if (surplus.length) {
          const t = createTicket(db, {
            ticketType: 'IN',
            ticketDate: countDate,
            warehouseId,
            reason: 'ADJUST_IN',
            note: ticketNote,
            auto: true,
            status: 'CONFIRMED',
            items: surplus,
          });
          tickets.push(t.code);
        }
        if (shortage.length) {
          const t = createTicket(db, {
            ticketType: 'OUT',
            ticketDate: countDate,
            warehouseId,
            reason: 'ADJUST_OUT',
            note: ticketNote,
            auto: true,
            status: 'CONFIRMED',
            items: shortage,
          });
          tickets.push(t.code);
        }
        return { tickets, surplus: surplus.length, shortage: shortage.length };
      })();

      res.json({ success: true, ...result });
    })
  );

  router.get(
    '/stock-tickets',
    handle((req, res) => {
      res.json(loadTickets(db, req.query as TicketQuery));
    })
  );

  // Xuất danh sách phiếu kho ra Excel để in và đối soát với bên cung cấp / kho nhận.
  router.get(
    '/stock-tickets/export.xlsx',
    handle(async (req, res) => {
      const q = req.query as TicketQuery;
      const tickets = loadTickets(db, q);
      const transitName =
        (db.prepare(`SELECT name FROM warehouses WHERE code = 'KHO_XN'`).get() as { name: string } | undefined)?.name ??
        'Kho Xí nghiệp (trung chuyển)';

      const lines: TicketLine[] = [];
      for (const ticket of tickets) {
        const items = (ticket.items ?? []) as { product_name: string; unit?: string | null; quantity: number; quantity_promo?: number }[];
        for (const item of items) {
          lines.push({
            ticket: ticket as unknown as TicketLine['ticket'],
            product_name: item.product_name,
            unit: item.unit,
            quantity: (Number(item.quantity) || 0) + (Number(item.quantity_promo) || 0),
            quantity_promo: Number(item.quantity_promo) || 0,
          });
        }
      }

      const title = q.direction === 'IN' ? 'Danh sách phiếu nhập kho' : q.direction === 'OUT' ? 'Danh sách phiếu xuất kho' : 'Danh sách phiếu kho';
      const buffer = await buildStockTicketWorkbook(lines, { title, from: q.from, to: q.to, transitName });
      const suffix = [q.from, q.to].filter(Boolean).join('_') || today();
      const fileName = `${q.direction === 'IN' ? 'phieu-nhap-kho' : q.direction === 'OUT' ? 'phieu-xuat-kho' : 'phieu-kho'}-${suffix}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
    })
  );

  // Tạo phiếu kho thủ công (nhập mua, đối tác trả hàng, xuất hủy, điều chuyển, điều chỉnh…).
  router.post(
    '/stock-tickets',
    handle((req, res) => {
      const body = req.body ?? {};
      const ticketType: TicketType | null =
        body.ticket_type === 'IN' || body.ticket_type === 'OUT' || body.ticket_type === 'TRANSFER' ? body.ticket_type : null;
      if (!ticketType) throw badRequest('Loại phiếu không hợp lệ');
      const reason = String(body.reason || '');
      const allowed = ticketType === 'IN' ? IN_REASONS : ticketType === 'OUT' ? OUT_REASONS : ['TRANSFER'];
      if (!allowed.includes(reason)) throw badRequest('Lý do không hợp lệ với loại phiếu này');
      if (!body.warehouse_id) throw badRequest('Chọn kho xuất/nhập');

      const result = db.transaction(() =>
        createTicket(db, {
          ticketType,
          ticketDate: String(body.ticket_date || today()),
          warehouseId: Number(body.warehouse_id),
          targetWarehouseId: body.target_warehouse_id ? Number(body.target_warehouse_id) : null,
          partnerUnitId: body.partner_unit_id ? Number(body.partner_unit_id) : null,
          sourceId: body.source_id ? Number(body.source_id) : null,
          reason,
          checkNote: body.check_note || null,
          vehicle: body.vehicle || null,
          inChargeEmployeeId: body.in_charge_employee_id ? Number(body.in_charge_employee_id) : null,
          note: body.note || '',
          createdBy: body.created_by ? Number(body.created_by) : null,
          items: Array.isArray(body.items) ? body.items : [],
        })
      )();

      res.json({ success: true, ...result });
    })
  );

  // Sửa phiếu (chỉ khi chưa xác nhận).
  router.put(
    '/stock-tickets/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const ticket = db.prepare('SELECT * FROM stock_tickets WHERE id = ?').get(id) as
        | { ticket_type: TicketType; reason: string }
        | undefined;
      if (!ticket) throw new ApiError(404, 'Không tìm thấy phiếu kho');
      const reason = String(body.reason ?? ticket.reason);
      const allowed = ticket.ticket_type === 'IN' ? IN_REASONS : ticket.ticket_type === 'OUT' ? OUT_REASONS : ['TRANSFER'];
      if (!allowed.includes(reason)) throw badRequest('Lý do không hợp lệ với loại phiếu này');

      db.transaction(() =>
        updateTicket(db, id, {
          ticketType: ticket.ticket_type,
          ticketDate: String(body.ticket_date || today()),
          warehouseId: Number(body.warehouse_id),
          targetWarehouseId: body.target_warehouse_id ? Number(body.target_warehouse_id) : null,
          partnerUnitId: body.partner_unit_id ? Number(body.partner_unit_id) : null,
          sourceId: body.source_id ? Number(body.source_id) : null,
          reason,
          checkNote: body.check_note || null,
          vehicle: body.vehicle || null,
          inChargeEmployeeId: body.in_charge_employee_id ? Number(body.in_charge_employee_id) : null,
          note: body.note || '',
          items: Array.isArray(body.items) ? body.items : [],
        })
      )();
      res.json({ success: true, id });
    })
  );

  // Chuyển trạng thái nhiều phiếu cùng lúc — trả về kết quả từng phiếu.
  router.post(
    '/stock-tickets/bulk-status',
    handle((req, res) => {
      const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(Number).filter(Boolean) : [];
      const status = req.body?.status as TicketStatus;
      if (!ids.length) throw badRequest('Chưa chọn phiếu kho');
      if (status !== 'DRAFT' && status !== 'CHECKING' && status !== 'CONFIRMED') throw badRequest('Trạng thái phiếu không hợp lệ');
      const succeeded: number[] = [];
      const failed: { id: number; error: string }[] = [];
      for (const id of ids) {
        try {
          db.transaction(() => setTicketStatus(db, id, status))();
          succeeded.push(id);
        } catch (e) {
          failed.push({ id, error: e instanceof Error ? e.message : 'Lỗi không xác định' });
        }
      }
      res.json({ success: true, status, succeeded, failed });
    })
  );

  // Chuyển trạng thái phiếu: Nháp → Kiểm tra hàng → Xác nhận (ghi sổ sinh bút toán).
  router.post(
    '/stock-tickets/:id/status',
    handle((req, res) => {
      const id = Number(req.params.id);
      const status = req.body?.status as TicketStatus;
      if (status !== 'DRAFT' && status !== 'CHECKING' && status !== 'CONFIRMED') throw badRequest('Trạng thái phiếu không hợp lệ');
      db.transaction(() => setTicketStatus(db, id, status))();
      res.json({ success: true, id, status });
    })
  );

  router.delete(
    '/stock-tickets/:id',
    handle((req, res) => {
      const id = Number(req.params.id);
      const ticket = db.prepare('SELECT id FROM stock_tickets WHERE id = ?').get(id);
      if (!ticket) throw new ApiError(404, 'Không tìm thấy phiếu kho');
      db.transaction(() => deleteTicket(db, id))();
      res.json({ success: true, id });
    })
  );

  return router;
}
