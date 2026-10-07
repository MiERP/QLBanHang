import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDate } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { getWorkingDate } from '../../lib/workingDate';
import type { DepositTransaction, ReportPeriod } from '../../types';

interface CustomerVouchers {
  customer_id: number | null;
  name: string;
  vouchers: DepositTransaction[];
  collected: number;
  refunded: number;
}

const voucherColumns: Column<DepositTransaction>[] = [
  { key: 'transaction_code', header: 'Mã phiếu', className: 'font-mono text-xs font-semibold text-brand-navy', sortValue: (r) => r.transaction_code },
  { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
  {
    key: 'transaction_type',
    header: 'Loại phiếu',
    align: 'center',
    render: (r) => (r.transaction_type === 'COLLECT' ? <Badge tone="green">Thu cọc</Badge> : <Badge tone="amber">Chi trả cọc</Badge>),
    sortValue: (r) => r.transaction_type,
  },
  { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code ?? '—' },
  {
    key: 'amount',
    header: 'Số tiền',
    align: 'right',
    render: (r) =>
      r.transaction_type === 'COLLECT' ? (
        <b className="text-emerald-600">{formatCurrency(r.amount)}</b>
      ) : (
        <b className="text-brand-red">-{formatCurrency(r.amount)}</b>
      ),
    sortValue: (r) => r.amount,
  },
  { key: 'payment_method', header: 'Hình thức', render: (r) => (r.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản') },
  { key: 'handled_by_name', header: 'Người xử lý', render: (r) => r.handled_by_name ?? '—' },
  { key: 'note', header: 'Ghi chú', render: (r) => r.note || '—' },
];

// Quản lý tiền cọc vỏ THEO KHÁCH HÀNG: dòng chính là khách (đã thu, đã chi trả, cọc đang giữ),
// bấm vào khách thì sổ xuống các phiếu thu/chi cọc của khách đó.
export function DepositVouchersTab({ period }: { period: ReportPeriod }) {
  const { customers, staff } = useReference();
  const toast = useToast();
  const [scope, setScope] = useState<'all' | 'period'>('all');

  const from = scope === 'period' ? period.from : undefined;
  const to = scope === 'period' ? period.to : undefined;
  const { data, loading, reload } = useApi(() => api.fetchDeposits({ from, to }), [from, to]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const rows = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => {
    const map = new Map<string, CustomerVouchers>();
    for (const r of rows) {
      const key = r.customer_id ? String(r.customer_id) : 'none';
      const g =
        map.get(key) ??
        ({ customer_id: r.customer_id ?? null, name: r.customer_name ?? 'Không gắn khách hàng', vouchers: [], collected: 0, refunded: 0 } as CustomerVouchers);
      g.vouchers.push(r);
      if (r.transaction_type === 'COLLECT') g.collected += r.amount;
      else g.refunded += r.amount;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.collected - b.refunded - (a.collected - a.refunded));
  }, [rows]);

  const totalCollect = rows.filter((r) => r.transaction_type === 'COLLECT').reduce((a, r) => a + r.amount, 0);
  const totalRefund = rows.filter((r) => r.transaction_type === 'REFUND').reduce((a, r) => a + r.amount, 0);
  const scopeLabel = scope === 'all' ? 'lũy kế' : 'trong kỳ';

  const columns: Column<CustomerVouchers>[] = [
    { key: 'name', header: 'Khách hàng', render: (r) => <span className="font-semibold text-slate-700">{r.name}</span>, sortValue: (r) => r.name },
    { key: 'count', header: 'Số phiếu', align: 'right', render: (r) => r.vouchers.length, sortValue: (r) => r.vouchers.length },
    {
      key: 'collected',
      header: `Đã thu cọc (${scopeLabel})`,
      align: 'right',
      render: (r) => <b className="text-emerald-600">{formatCurrency(r.collected)}</b>,
      sortValue: (r) => r.collected,
    },
    {
      key: 'refunded',
      header: `Đã chi trả cọc (${scopeLabel})`,
      align: 'right',
      render: (r) => <b className="text-brand-red">{formatCurrency(r.refunded)}</b>,
      sortValue: (r) => r.refunded,
    },
    {
      key: 'balance',
      header: 'Cọc đang giữ',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatCurrency(r.collected - r.refunded)}</b>,
      sortValue: (r) => r.collected - r.refunded,
    },
  ];

  const openCreate = (kind: 'COLLECT' | 'REFUND') => {
    setForm({
      transaction_type: kind,
      amount: '',
      customer_id: '',
      payment_method: 'CASH',
      handled_by: '',
      transaction_date: getWorkingDate(),
      note: '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.amount) return toast.error('Nhập số tiền');
    try {
      await api.createDeposit(form);
      toast.success(form.transaction_type === 'REFUND' ? 'Đã lập phiếu chi trả cọc' : 'Đã lập phiếu thu cọc');
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lập được phiếu');
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'Lũy kế' },
              { id: 'period', label: 'Trong kỳ báo cáo' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                scope === s.id ? 'bg-brand-navy text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {scope === 'period' && (
          <span className="text-xs text-slate-500">
            Kỳ: {formatDate(period.from)} → {formatDate(period.to)}
          </span>
        )}
        <span className="text-xs text-slate-400">Bấm vào một khách hàng để xem các phiếu thu/chi cọc của khách đó.</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openCreate('COLLECT')}>
            <Plus className="h-3.5 w-3.5" /> Phiếu thu cọc
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCreate('REFUND')}>
            <Plus className="h-3.5 w-3.5" /> Phiếu chi trả cọc
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Tổng thu cọc ({scopeLabel}): <b className="text-emerald-600">{formatCurrency(totalCollect)}</b>
        </span>
        <span>
          Tổng chi trả cọc ({scopeLabel}): <b className="text-brand-red">{formatCurrency(totalRefund)}</b>
        </span>
        <span>
          Cọc đang giữ ({scopeLabel}): <b className="text-brand-navy">{formatCurrency(totalCollect - totalRefund)}</b>
        </span>
      </div>

      <DataTable
        columns={columns}
        data={groups}
        rowKey={(r) => r.customer_id ?? 'none'}
        loading={loading}
        searchPlaceholder="Tìm theo tên khách hàng..."
        initialSortKey="balance"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage="Chưa có phiếu thu/chi cọc nào"
        renderExpanded={(g) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {voucherColumns.map((c) => (
                  <th key={c.key} className="px-3 py-2">
                    {c.header}
                  </th>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {g.vouchers.map((v) => (
                  <tr key={v.id} className="bg-white">
                    {voucherColumns.map((c) => (
                      <td key={c.key} className="px-3 py-2">
                        {c.render ? c.render(v) : String((v as unknown as Record<string, unknown>)[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.transaction_type === 'REFUND' ? 'Lập phiếu chi trả cọc vỏ' : 'Lập phiếu thu cọc vỏ'}
        subtitle="Tiền cọc vỏ bình: thu khi khách mượn bình, chi trả khi khách trả vỏ"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={save}>
              Lập phiếu
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Loại phiếu">
              <Select
                value={String(form.transaction_type ?? 'COLLECT')}
                onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
              >
                <option value="COLLECT">Thu cọc</option>
                <option value="REFUND">Chi trả cọc</option>
              </Select>
            </Field>
            <Field label="Số tiền" required>
              <Input type="number" value={String(form.amount ?? '')} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Khách hàng">
              <Select value={String(form.customer_id ?? '')} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">-- Không gắn khách hàng --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hình thức">
              <Select value={String(form.payment_method ?? 'CASH')} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </Select>
            </Field>
            <Field label="Người xử lý">
              <Select value={String(form.handled_by ?? '')} onChange={(e) => setForm({ ...form, handled_by: e.target.value })}>
                <option value="">-- Không chỉ định --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày">
              <Input type="date" value={String(form.transaction_date ?? '')} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Ghi chú">
            <Textarea value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
