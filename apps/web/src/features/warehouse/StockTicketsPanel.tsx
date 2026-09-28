import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useApi } from '../../lib/hooks';
import { formatDate, formatNumber } from '../../lib/format';
import { statusMeta } from '../orders/orderStatus';
import type { StockTicket } from '../../types';
import { StockTicketForm } from './StockTicketForm';
import { TICKET_ACTION_LABEL, TICKET_TYPE_LABEL, DEFAULT_TRANSIT, TRANSIT_WAREHOUSE_CODE, nextTicketStatuses, reasonLabel, ticketRoute, ticketStatusMeta } from './ticketMeta';
import { useReference } from '../../context/ReferenceContext';

// Tổng xuất/nhập kho = hàng tính tiền + hàng khuyến mãi.
const ticketQty = (t: StockTicket) =>
  (t.items ?? []).reduce((a, i) => a + (Number(i.quantity) || 0) + (Number(i.quantity_promo) || 0), 0);

// Tuyến vận chuyển: điểm đi → (trung chuyển) → điểm đến.
function RouteCell({ ticket, transitName, small }: { ticket: StockTicket; transitName: string; small?: boolean }) {
  const r = ticketRoute(ticket, transitName);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${small ? 'text-xs' : 'text-sm'}`}>
      <span className="text-slate-700">{r.from}</span>
      <span className="font-bold text-brand-cyan">→</span>
      {r.via ? (
        <>
          <span className="text-slate-400 italic">{r.via}</span>
          <span className="font-bold text-brand-cyan">→</span>
        </>
      ) : null}
      <b className="text-brand-navy">{r.to}</b>
    </span>
  );
}

// Trạng thái phiếu nói thẳng hàng đã cộng/trừ tồn kho hay chưa.
function StockEffectBadge({ ticket }: { ticket: StockTicket }) {
  return ticket.status === 'CONFIRMED' ? (
    <Badge tone="green">Đã ghi sổ tồn kho</Badge>
  ) : (
    <Badge tone="amber">Chưa ghi sổ</Badge>
  );
}

function TicketDetail({ ticket, transitName, onClose }: { ticket: StockTicket; transitName: string; onClose: () => void }) {
  const meta = ticketStatusMeta(ticket.status);
  const info: [string, React.ReactNode][] = [
    ['Ngày phiếu', formatDate(ticket.ticket_date)],
    ['Loại phiếu', TICKET_TYPE_LABEL[ticket.ticket_type]],
    ['Lý do', reasonLabel(ticket.reason)],
    ['Tuyến', <RouteCell key="route" ticket={ticket} transitName={transitName} small />],
    ['Phương tiện', ticket.vehicle || '—'],
    ['Người phụ trách', ticket.in_charge_name ?? '—'],
    ['Đối tác', ticket.partner_unit_name ?? '—'],
    ['Nguồn nhập', ticket.source_name ?? '—'],
    [
      'Đơn hàng',
      ticket.order_code ? (
        <span className="inline-flex items-center gap-1">
          <b className="font-mono text-brand-navy">{ticket.order_code}</b>
          {ticket.order_status ? (() => { const m = statusMeta(ticket.order_status!); return <Badge tone={m.tone}>{m.label}</Badge>; })() : null}
        </span>
      ) : (
        '—'
      ),
    ],
    ['Người tạo', ticket.created_by_name ?? '—'],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Phiếu ${ticket.code}`}
      subtitle={`${TICKET_TYPE_LABEL[ticket.ticket_type]} · ${reasonLabel(ticket.reason)}`}
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <StockEffectBadge ticket={ticket} />
          {ticket.auto ? <Badge tone="cyan">Tự sinh từ đơn hàng</Badge> : <Badge tone="neutral">Tạo thủ công</Badge>}
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {info.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-medium text-slate-700">{value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
            Hàng hóa ({ticket.items?.length ?? 0} mặt hàng · {formatNumber(ticketQty(ticket))})
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-1.5">Sản phẩm</th>
                <th className="w-16 px-3 py-1.5 text-center">ĐVT</th>
                {ticket.ticket_type === 'IN' && <th className="w-24 px-3 py-1.5 text-center">Chất lượng</th>}
                <th className="w-24 px-3 py-1.5 text-right">Số lượng</th>
                <th className="w-20 px-3 py-1.5 text-right">Trong đó KM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(ticket.items ?? []).map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-1.5 text-slate-700">{it.product_name}</td>
                  <td className="px-3 py-1.5 text-center text-xs text-slate-500">{it.unit ?? '—'}</td>
                  {ticket.ticket_type === 'IN' && (
                    <td className="px-3 py-1.5 text-center">
                      {it.quality === 'OK' ? (
                        <Badge tone="green">Đạt</Badge>
                      ) : it.quality === 'NG' ? (
                        <Badge tone="red">Không đạt</Badge>
                      ) : (
                        <span className="text-[11px] text-slate-300">Chưa kiểm</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-right font-semibold">
                    {formatNumber((Number(it.quantity) || 0) + (Number(it.quantity_promo) || 0))}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {it.quantity_promo ? <span className="font-semibold text-amber-600">{formatNumber(it.quantity_promo)}</span> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ticket.check_note ? <p className="text-xs text-slate-500">Kiểm hàng: {ticket.check_note}</p> : null}
        {ticket.note ? <p className="text-xs text-slate-500">Ghi chú: {ticket.note}</p> : null}
        {ticket.status !== 'CONFIRMED' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Phiếu <b>chưa ghi sổ</b> — tồn kho chưa thay đổi. Bấm <b>Xác nhận</b> để ghi bút toán cộng/trừ tồn kho.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function StockTicketsPanel({ direction }: { direction: 'IN' | 'OUT' }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, reload } = useApi(() => api.fetchStockTickets({ direction, from, to }), [direction, from, to]);
  const { warehouses } = useReference();
  // Tên kho trung chuyển lấy từ danh mục (kho ảo KHO_XN) để tuyến luôn khớp dữ liệu.
  const transitName = warehouses.find((w) => w.code === TRANSIT_WAREHOUSE_CODE)?.name ?? DEFAULT_TRANSIT;
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockTicket | null>(null);
  const [viewing, setViewing] = useState<StockTicket | null>(null);

  const tickets = data ?? [];
  const [selected, setSelected] = useState<number[]>([]);

  const selectedTickets = tickets.filter((t) => selected.includes(t.id));
  // Nút hàng loạt chỉ mở khi mọi phiếu đã chọn đều đi được tới trạng thái đó.
  const canBulk = (target: string) =>
    selected.length > 0 && selectedTickets.every((t) => nextTicketStatuses(t.status).includes(target as never));
  // Phiếu sinh từ đơn hàng / đơn mượn phải hoàn tác ở chính đơn đó nên không xoá trực tiếp được.
  const canDelete = (t: StockTicket) => !t.order_id;
  const canDeleteSelected = selected.length > 0 && selectedTickets.every(canDelete);
  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allChecked = tickets.length > 0 && selected.length === tickets.length;

  const bulk = async (status: string) => {
    if (status === 'CONFIRMED') {
      const ok = await confirm({
        title: 'Xác nhận phiếu kho',
        message: `Xác nhận ${selected.length} phiếu đã chọn? Bút toán cộng/trừ tồn kho sẽ được ghi và các phiếu bị khóa.`,
        confirmLabel: 'Xác nhận',
      });
      if (!ok) return;
    }
    try {
      const res = await api.bulkSetStockTicketStatus(selected, status);
      if (res.failed.length) {
        toast.error(`${res.succeeded.length} phiếu cập nhật, ${res.failed.length} lỗi: ${res.failed[0]?.error ?? ''}`);
      } else {
        toast.success(`Đã cập nhật ${res.succeeded.length} phiếu`);
      }
      setSelected([]);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được phiếu');
    }
  };

  const removeSelected = async () => {
    const ok = await confirm({
      title: 'Xóa phiếu kho',
      message: `Xóa ${selected.length} phiếu đã chọn? Phiếu đã ghi sổ sẽ được hoàn/trừ lại tồn kho tương ứng.`,
      danger: true,
      confirmLabel: 'Xóa phiếu',
    });
    if (!ok) return;
    const failed: string[] = [];
    let done = 0;
    for (const id of selected) {
      try {
        await api.deleteStockTicket(id);
        done += 1;
      } catch (e) {
        failed.push(e instanceof Error ? e.message : 'Lỗi không xác định');
      }
    }
    if (failed.length) toast.error(`${done} phiếu đã xóa, ${failed.length} lỗi: ${failed[0]}`);
    else toast.success(`Đã xóa ${done} phiếu`);
    setSelected([]);
    reload();
  };

  const remove = async (t: StockTicket) => {
    const ok = await confirm({
      title: 'Xóa phiếu kho',
      message:
        t.status === 'CONFIRMED'
          ? `Xóa phiếu ${t.code}? Phiếu đã ghi sổ nên tồn kho sẽ được hoàn/trừ lại theo phiếu.`
          : `Xóa phiếu ${t.code}? Phiếu chưa ghi sổ nên tồn kho không bị ảnh hưởng.`,
      danger: true,
      confirmLabel: 'Xóa phiếu',
    });
    if (!ok) return;
    try {
      await api.deleteStockTicket(t.id);
      toast.success('Đã xóa phiếu');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được phiếu');
    }
  };

  const changeStatus = async (t: StockTicket, status: string) => {
    if (status === 'CONFIRMED') {
      const ok = await confirm({
        title: 'Xác nhận phiếu kho',
        message: `Xác nhận phiếu ${t.code}? Bút toán cộng/trừ tồn kho sẽ được ghi và phiếu bị khóa.`,
        confirmLabel: 'Xác nhận',
      });
      if (!ok) return;
    }
    try {
      await api.setStockTicketStatus(t.id, status);
      toast.success(status === 'CONFIRMED' ? 'Đã ghi sổ và cập nhật tồn kho' : 'Đã chuyển trạng thái phiếu');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không chuyển được trạng thái');
    }
  };

  const columns: Column<StockTicket>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(e) => setSelected(e.target.checked ? tickets.map((t) => t.id) : [])}
        />
      ),
      render: (t) => (
        <input type="checkbox" checked={selected.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(t.id)} />
      ),
    },
    { key: 'code', header: 'Mã phiếu', className: 'font-mono font-semibold text-brand-navy', sortValue: (t) => t.code },
    { key: 'ticket_date', header: 'Ngày', render: (t) => formatDate(t.ticket_date), sortValue: (t) => t.ticket_date },
    {
      key: 'ticket_type',
      header: 'Loại',
      align: 'center',
      render: (t) => (
        <Badge tone={t.ticket_type === 'IN' ? 'green' : t.ticket_type === 'OUT' ? 'amber' : 'indigo'}>
          {TICKET_TYPE_LABEL[t.ticket_type]}
        </Badge>
      ),
      sortValue: (t) => t.ticket_type,
    },
    {
      key: 'status',
      header: 'Trạng thái phiếu',
      align: 'center',
      render: (t) => {
        const m = ticketStatusMeta(t.status);
        return <Badge tone={m.tone}>{m.label}</Badge>;
      },
      sortValue: (t) => t.status,
    },
    {
      key: 'stock_effect',
      header: 'Tồn kho',
      align: 'center',
      render: (t) => <StockEffectBadge ticket={t} />,
      sortValue: (t) => t.status,
    },
    { key: 'reason', header: 'Lý do', render: (t) => reasonLabel(t.reason), sortValue: (t) => t.reason },
    {
      key: 'route',
      header: 'Tuyến',
      render: (t) => (
        <div className="text-xs">
          <RouteCell ticket={t} transitName={transitName} small />
          {t.order_code ? <div className="text-[11px] text-slate-400">Đơn {t.order_code}</div> : null}
        </div>
      ),
      sortValue: (t) => ticketRoute(t).from,
    },
    { key: 'qty', header: 'Tổng SL', align: 'right', render: (t) => formatNumber(ticketQty(t)), sortValue: (t) => ticketQty(t) },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (t) => {
        if (t.auto) return <span className="text-[11px] text-slate-400">Từ đơn hàng</span>;
        if (t.status === 'CONFIRMED') return <span className="text-[11px] text-slate-400">Đã ghi sổ</span>;
        return (
          <div className="flex items-center justify-center gap-1">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(t); }}>
              Sửa
            </Button>
            {nextTicketStatuses(t.status).map((s) => (
              <Button
                key={s}
                variant={s === 'CONFIRMED' ? 'success' : 'outline'}
                size="sm"
                onClick={(e) => { e.stopPropagation(); changeStatus(t, s); }}
              >
                {TICKET_ACTION_LABEL[s]}
              </Button>
            ))}
            {canDelete(t) ? (
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(t); }} title="Xóa phiếu">
                <Trash2 className="h-4 w-4 text-brand-red" />
              </Button>
            ) : (
              <span className="text-[11px] text-slate-300" title="Phiếu sinh từ đơn hàng — hoàn tác ở đơn">
                —
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <Field label="Từ ngày">
          <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        {(from || to) && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Bỏ lọc ngày
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={tickets}
        rowKey={(t) => t.id}
        loading={loading}
        onRowClick={(t) => setViewing(t)}
        searchPlaceholder="Tìm theo mã phiếu, lý do, kho, đối tác, đơn hàng..."
        initialSortKey="ticket_date"
        initialSortDir="desc"
        toolbar={
          <>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {direction === 'IN' ? 'Tạo phiếu nhập' : 'Tạo phiếu xuất'}
            </Button>
            <span className="text-xs font-semibold text-slate-500">Đã chọn {selected.length}</span>
            <Button variant="outline" size="sm" disabled={!canBulk('CHECKING')} onClick={() => bulk('CHECKING')}>
              {TICKET_ACTION_LABEL.CHECKING}
            </Button>
            <Button variant="success" size="sm" disabled={!canBulk('CONFIRMED')} onClick={() => bulk('CONFIRMED')}>
              {TICKET_ACTION_LABEL.CONFIRMED}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-brand-red text-brand-red hover:bg-brand-red/10"
              disabled={!canDeleteSelected}
              onClick={removeSelected}
            >
              Xóa
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!tickets.length}
              onClick={() =>
                window.open(
                  api.stockTicketsExportUrl({ direction, from, to, ids: selected.length ? selected.join(',') : undefined }),
                  '_blank'
                )
              }
              title={selected.length ? `In ${selected.length} phiếu đã chọn` : 'In toàn bộ danh sách theo bộ lọc'}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất Excel
            </Button>
          </>
        }
      />
      {viewing && <TicketDetail ticket={viewing} transitName={transitName} onClose={() => setViewing(null)} />}
      {open && (
        <StockTicketForm
          defaultType={direction}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
      {editing && (
        <StockTicketForm
          defaultType={editing.ticket_type}
          ticket={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
