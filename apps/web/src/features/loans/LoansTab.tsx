import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatDate, formatMonth, formatNumber } from '../../lib/format';
import { stockWarehouses } from '../../lib/warehouses';
import type { LoanRow } from '../../types';

type Tone = 'neutral' | 'navy' | 'cyan' | 'green' | 'amber' | 'red' | 'indigo';

const LOAN_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Chờ giao hàng', tone: 'neutral' },
  OUTSTANDING: { label: 'Đang mượn', tone: 'amber' },
  PARTIAL: { label: 'Trả một phần', tone: 'cyan' },
  SETTLED: { label: 'Đã trả', tone: 'green' },
  CANCELLED: { label: 'Đã hủy', tone: 'red' },
};

const SETTLE_LABEL: Record<string, string> = {
  RETURN_GOODS: 'Trả hàng',
};

const isOpen = (row: LoanRow) => row.loan_status === 'OUTSTANDING' || row.loan_status === 'PARTIAL';

// Hai chiều mượn ngược nhau: cho đối tác mượn (đối tác nợ mình) và đi mượn (mình nợ đối tác).
type Direction = 'ALL' | 'LEND_OUT' | 'BORROW_IN';

export function LoansTab({ month }: { month: string }) {
  const { data, loading, reload } = useApi(() => api.fetchLoans({ month }), [month]);
  const { warehouses } = useReference();
  const toast = useToast();
  const physicalWarehouses = stockWarehouses(warehouses);

  const [filter, setFilter] = useState('open');
  const [direction, setDirection] = useState<Direction>('ALL');
  const [current, setCurrent] = useState<LoanRow | null>(null);
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [returnWarehouseId, setReturnWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const all = data ?? [];
  const lendRows = all.filter((r) => r.loan_direction === 'LEND_OUT');
  const borrowRows = all.filter((r) => r.loan_direction === 'BORROW_IN');
  const lendOpen = lendRows.filter(isOpen);
  const borrowOpen = borrowRows.filter(isOpen);
  const lendOutstanding = lendOpen.reduce((a, r) => a + (r.items ?? []).reduce((sum, item) => sum + item.remaining, 0), 0);
  const borrowOutstanding = borrowOpen.reduce((a, r) => a + (r.items ?? []).reduce((sum, item) => sum + item.remaining, 0), 0);

  const scoped = direction === 'ALL' ? all : all.filter((r) => r.loan_direction === direction);
  const openRows = scoped.filter(isOpen);
  const settledRows = scoped.filter((r) => r.loan_status === 'SETTLED');
  const cancelledRows = scoped.filter((r) => r.loan_status === 'CANCELLED');

  const rows = useMemo(() => {
    if (filter === 'open') return openRows;
    if (filter === 'settled') return settledRows;
    if (filter === 'cancelled') return cancelledRows;
    return scoped;
  }, [filter, direction, data]);

  const openSettle = (row: LoanRow) => {
    setCurrent(row);
    setReturnQty({});
    setReturnWarehouseId('');
    setNote('');
  };

  const fillAllRemaining = () => {
    if (!current) return;
    const next: Record<number, string> = {};
    for (const line of current.items ?? []) next[line.product_id] = String(line.remaining);
    setReturnQty(next);
  };

  const submitSettle = async () => {
    if (!current) return;
    const items = (current.items ?? [])
      .map((line) => ({ product_id: line.product_id, quantity: Number(returnQty[line.product_id]) || 0 }))
      .filter((item) => item.quantity > 0);
    if (!items.length) return toast.error('Nhập số lượng hàng trả lại');
    const needsWarehouse = current.loan_direction === 'BORROW_IN';
    if (needsWarehouse && !returnWarehouseId) return toast.error('Chọn kho xuất hàng trả đối tác');
    setSaving(true);
    try {
      await api.settleLoan(current.order_id, {
        items,
        warehouse_id: needsWarehouse ? Number(returnWarehouseId) : undefined,
        note,
      });
      const isBorrowLoan = current.loan_direction === 'BORROW_IN';
      toast.success(isBorrowLoan ? 'Đã xuất kho trả hàng cho đối tác' : 'Đã nhập lại hàng vào kho');
      setCurrent(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không ghi nhận được');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<LoanRow>[] = [
    { key: 'order_date', header: 'Ngày mượn', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
    {
      key: 'loan_direction',
      header: 'Chiều',
      render: (r) =>
        r.loan_direction === 'LEND_OUT' ? <Badge tone="amber">Mình cho mượn</Badge> : <Badge tone="indigo">Mình đi mượn</Badge>,
      sortValue: (r) => r.loan_direction,
    },
    { key: 'partner_unit_name', header: 'Đối tác', render: (r) => r.partner_unit_name ?? '—', sortValue: (r) => r.partner_unit_name ?? '' },
    { key: 'customer_name', header: 'Khách nhận hàng', sortValue: (r) => r.customer_name },
    {
      key: 'goods_value',
      header: 'Hàng đã giao',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatNumber((r.items ?? []).reduce((sum, item) => sum + item.quantity, 0))}</b>,
      sortValue: (r) => (r.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    },
    {
      key: 'settled_value',
      header: 'Đã trả hàng',
      align: 'right',
      render: (r) => formatNumber((r.items ?? []).reduce((sum, item) => sum + item.returned, 0)),
      sortValue: (r) => (r.items ?? []).reduce((sum, item) => sum + item.returned, 0),
    },
    {
      key: 'outstanding_value',
      header: 'Còn lại',
      align: 'right',
      render: (r) => <b className="text-brand-red">{formatNumber((r.items ?? []).reduce((sum, item) => sum + item.remaining, 0))}</b>,
      sortValue: (r) => (r.items ?? []).reduce((sum, item) => sum + item.remaining, 0),
    },
    {
      key: 'loan_due_date',
      header: 'Hạn trả',
      render: (r) =>
        r.loan_due_date ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <span className="text-slate-600">{formatDate(r.loan_due_date)}</span>
            {!!r.overdue_days && <Badge tone="red">Quá hạn {r.overdue_days} ngày</Badge>}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
      sortValue: (r) => r.loan_due_date ?? '',
    },
    {
      key: 'loan_status',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => {
        const meta = LOAN_STATUS_META[r.loan_status] ?? { label: r.loan_status, tone: 'neutral' as Tone };
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
      sortValue: (r) => r.loan_status,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (r) =>
        isOpen(r) ? (
          r.order_status === 'SHIPPING' || r.order_status === 'COMPLETED' ? (
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openSettle(r); }}>
              Ghi nhận trả hàng
            </Button>
          ) : (
            <span className="text-[11px] text-slate-400">Chờ giao hàng</span>
          )
        ) : (
          <span className="text-[11px] text-slate-400">{r.loan_status === 'CANCELLED' ? 'Đã hủy' : 'Đã trả hết hàng'}</span>
        ),
    },
  ];

  const currentLines = current?.items ?? [];
  const pendingReturnQuantity = currentLines.reduce((sum, line) => sum + (Number(returnQty[line.product_id]) || 0), 0);
  const currentOutstanding = currentLines.reduce((sum, line) => sum + line.remaining, 0);

  return (
    <>
      <PageHeader
        title="Quản lý mượn - trả"
        subtitle={`${formatMonth(month)} · ${openRows.length} đơn đang mở · ${settledRows.length} đơn đã trả`}
        actions={
          <Tabs
            items={[
              { id: 'open', label: `Đang mượn (${openRows.length})` },
              { id: 'settled', label: `Đã trả (${settledRows.length})` },
              { id: 'cancelled', label: `Đã hủy (${cancelledRows.length})` },
              { id: 'all', label: 'Tất cả' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
      />

      {/* Tách hẳn hai chiều để không lẫn khoản đối tác nợ mình với khoản mình nợ đối tác. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <Tabs
          items={[
            { id: 'ALL', label: `Tất cả (${all.length})` },
            { id: 'LEND_OUT', label: `Mình cho mượn (${lendRows.length})` },
            { id: 'BORROW_IN', label: `Mình đi mượn (${borrowRows.length})` },
          ]}
          value={direction}
          onChange={(next) => setDirection(next as Direction)}
        />
        <div className="flex flex-wrap gap-5 text-sm text-slate-600">
          <span>
            Đối tác nợ mình: <b className="text-brand-navy">{formatNumber(lendOutstanding)} sản phẩm</b>{' '}
            <span className="text-xs text-slate-400">({lendOpen.length} đơn mình cho mượn)</span>
          </span>
          <span>
            Mình nợ đối tác: <b className="text-brand-red">{formatNumber(borrowOutstanding)} sản phẩm</b>{' '}
            <span className="text-xs text-slate-400">({borrowOpen.length} đơn mình đi mượn)</span>
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.order_id}
        loading={loading}
        searchPlaceholder="Tìm theo đối tác, khách hàng, mã đơn..."
        initialSortKey="order_date"
        initialSortDir="desc"
        emptyMessage={
          direction === 'LEND_OUT'
            ? 'Không có đơn nào mình cho đối tác mượn trong kỳ này'
            : direction === 'BORROW_IN'
              ? 'Không có đơn nào mình đi mượn trong kỳ này'
              : undefined
        }
      />

      <Modal
        open={!!current}
        onClose={() => setCurrent(null)}
        size="lg"
        title={current ? `Ghi nhận trả hàng: ${current.order_code}` : ''}
        subtitle={
          current
            ? `${current.partner_unit_name ?? 'Đối tác'} · còn lại ${formatNumber(currentOutstanding)} sản phẩm · chỉ trả bằng hàng`
            : ''
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCurrent(null)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitSettle} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận'}
            </Button>
          </>
        }
      >
        {current && (
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600">
                  {current.loan_direction === 'LEND_OUT' ? 'Hàng mình đã giao cho đối tác' : 'Hàng mình đã nhận từ đối tác'}
                </p>
                <Button variant="ghost" size="sm" onClick={fillAllRemaining}>
                  Điền tối đa
                </Button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-1">Sản phẩm</th>
                    <th className="pb-1 text-right">Đã giao</th>
                    <th className="pb-1 text-right">Đã trả</th>
                    <th className="pb-1 text-right">Còn lại</th>
                    <th className="w-24 pb-1 text-right">Trả lần này</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentLines.map((line) => (
                    <tr key={line.product_id}>
                      <td className="py-1 text-slate-700">
                        {line.product_name}
                        {line.unit ? <span className="ml-1 text-slate-400">({line.unit})</span> : null}
                      </td>
                      <td className="py-1 text-right text-slate-500">{formatNumber(line.quantity)}</td>
                      <td className="py-1 text-right text-slate-500">{formatNumber(line.returned)}</td>
                      <td className="py-1 text-right font-semibold text-brand-red">{formatNumber(line.remaining)}</td>
                      <td className="py-1">
                        <Input
                          dense
                          type="number"
                          value={returnQty[line.product_id] ?? ''}
                          placeholder="0"
                          onChange={(e) => setReturnQty((prev) => ({ ...prev, [line.product_id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-right text-[11px] text-slate-500">
                Số hàng trả lần này: <b className="text-slate-700">{formatNumber(pendingReturnQuantity)}</b>
              </p>
            </div>

            {current.loan_direction === 'BORROW_IN' && (
              <Field label="Kho xuất trả hàng" hint="Chọn kho vật lý để xuất hàng trả đối tác">
                <Select value={returnWarehouseId} onChange={(e) => setReturnWarehouseId(e.target.value)}>
                  <option value="">-- Chọn kho --</option>
                  {physicalWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Ghi chú">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            {!!current.settlements?.length && (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-bold text-slate-600">Đã ghi nhận trước đó</p>
                <div className="space-y-1 text-xs">
                  {current.settlements.map((s) => (
                    <div key={s.id} className="flex justify-between gap-3">
                      <span className="text-slate-600">
                        {formatDate(s.settle_date)} · {SETTLE_LABEL[s.settle_type]}
                        {s.settle_type === 'RETURN_GOODS' && s.items?.length
                          ? ` (${s.items.map((i) => `${i.product_name} × ${i.quantity}`).join(', ')})`
                          : ''}
                        {s.ticket_code ? ` · phiếu ${s.ticket_code}` : ''}
                      </span>
                      <b className="text-slate-700">{formatNumber(s.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0)} sản phẩm</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
