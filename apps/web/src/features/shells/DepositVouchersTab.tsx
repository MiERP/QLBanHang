import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Select } from '../../components/ui/Field';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDate } from '../../lib/format';
import { useApi } from '../../lib/hooks';
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

// Sổ lưu vết tiền cọc vỏ THEO KHÁCH HÀNG: dòng chính là khách (đã thu, đã chi trả, cọc đang giữ),
// bấm vào khách thì sổ xuống các phiếu thu/chi cọc của khách đó. Phiếu do đơn hàng / trả vỏ sinh ra.
export function DepositVouchersTab({ period }: { period: ReportPeriod }) {
  const [scope, setScope] = useState<'all' | 'period'>('all');
  const [type, setType] = useState('');

  const from = scope === 'period' ? period.from : undefined;
  const to = scope === 'period' ? period.to : undefined;
  const { data, loading } = useApi(() => api.fetchDeposits({ from, to, type: type || undefined }), [from, to, type]);

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

  // Lọc theo loại phiếu: chỉ hiện cột tiền tương ứng; "Cọc đang giữ" chỉ đúng khi xem tất cả.
  const columns: Column<CustomerVouchers>[] = [
    { key: 'name', header: 'Khách hàng', render: (r) => <span className="font-semibold text-slate-700">{r.name}</span>, sortValue: (r) => r.name },
    { key: 'count', header: 'Số phiếu', align: 'right', render: (r) => r.vouchers.length, sortValue: (r) => r.vouchers.length },
  ];
  if (type !== 'REFUND') {
    columns.push({
      key: 'collected',
      header: `Đã thu cọc (${scopeLabel})`,
      align: 'right',
      render: (r) => <b className="text-emerald-600">{formatCurrency(r.collected)}</b>,
      sortValue: (r) => r.collected,
    });
  }
  if (type !== 'COLLECT') {
    columns.push({
      key: 'refunded',
      header: `Đã chi trả cọc (${scopeLabel})`,
      align: 'right',
      render: (r) => <b className="text-brand-red">{formatCurrency(r.refunded)}</b>,
      sortValue: (r) => r.refunded,
    });
  }
  if (!type) {
    columns.push({
      key: 'balance',
      header: 'Cọc đang giữ',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatCurrency(r.collected - r.refunded)}</b>,
      sortValue: (r) => r.collected - r.refunded,
    });
  }

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
        <Field label="Loại phiếu">
          <Select dense value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="COLLECT">Thu cọc</option>
            <option value="REFUND">Chi trả cọc</option>
          </Select>
        </Field>
        {scope === 'period' && (
          <span className="text-xs text-slate-500">
            Kỳ: {formatDate(period.from)} → {formatDate(period.to)}
          </span>
        )}
        <span className="text-xs text-slate-400">Bấm vào một khách hàng để xem các phiếu thu/chi cọc của khách đó.</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        {type !== 'REFUND' && (
          <span>
            Tổng thu cọc ({scopeLabel}): <b className="text-emerald-600">{formatCurrency(totalCollect)}</b>
          </span>
        )}
        {type !== 'COLLECT' && (
          <span>
            Tổng chi trả cọc ({scopeLabel}): <b className="text-brand-red">{formatCurrency(totalRefund)}</b>
          </span>
        )}
        {!type && (
          <span>
            Cọc đang giữ ({scopeLabel}): <b className="text-brand-navy">{formatCurrency(totalCollect - totalRefund)}</b>
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={groups}
        rowKey={(r) => r.customer_id ?? 'none'}
        loading={loading}
        searchPlaceholder="Tìm theo tên khách hàng..."
        initialSortKey={type === 'REFUND' ? 'refunded' : type === 'COLLECT' ? 'collected' : 'balance'}
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
    </>
  );
}
