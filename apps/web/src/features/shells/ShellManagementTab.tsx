import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { ShellActions } from './ShellActions';
import type { ReportPeriod, ShellOrderRow } from '../../types';

type Scope = 'all' | 'period';

// Một bảng duy nhất cho vỏ bình & cọc: mỗi dòng là một đơn có bình — số vỏ giao, tiền cọc,
// số đã trả, số khách đang giữ, và thao tác ngay tại dòng (trả vỏ / tất toán / mất-mua đứt).
export function ShellManagementTab({ period }: { period: ReportPeriod }) {
  const [scope, setScope] = useState<Scope>('all');
  const { data, loading, reload } = useApi(() => api.fetchShellOrders({ scope }), [scope]);

  const held = data?.held;
  const totals = data?.totals;
  const rows = data?.rows ?? [];

  const columns: Column<ShellOrderRow>[] = [
    { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
    { key: 'order_code', header: 'Mã đơn', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.order_code },
    {
      key: 'customer_name',
      header: 'Khách hàng',
      render: (r) => (
        <>
          <span className="block">{r.customer_name}</span>
          <span className="text-xs text-slate-400">{r.customer_code}</span>
        </>
      ),
      sortValue: (r) => r.customer_name,
    },
    { key: 'voi', header: 'Vỏ Vòi', align: 'right', render: (r) => (r.voi ? formatNumber(r.voi) : '—'), sortValue: (r) => r.voi },
    { key: 'up', header: 'Vỏ Úp', align: 'right', render: (r) => (r.up ? formatNumber(r.up) : '—'), sortValue: (r) => r.up },
    { key: 'deposit', header: 'Tiền cọc', align: 'right', render: (r) => formatCurrency(r.deposit), sortValue: (r) => r.deposit },
    {
      key: 'returned',
      header: 'Đã trả (Vòi/Úp)',
      align: 'right',
      render: (r) => (r.returned_voi || r.returned_up ? `${formatNumber(r.returned_voi)} / ${formatNumber(r.returned_up)}` : '—'),
      sortValue: (r) => r.returned_voi + r.returned_up,
    },
    {
      key: 'held',
      header: 'Khách còn giữ (Vòi/Úp)',
      align: 'right',
      render: (r) => (
        <b className="text-brand-navy">
          {formatNumber(r.debt_voi)} / {formatNumber(r.debt_up)}
        </b>
      ),
      sortValue: (r) => r.debt_voi + r.debt_up,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (r) => (
        <ShellActions
          target={{
            customerId: r.customer_id,
            customerName: r.customer_name,
            debtVoi: r.debt_voi,
            debtUp: r.debt_up,
            orderId: r.order_id,
            defaultVoi: Math.max(0, r.voi - r.returned_voi),
            defaultUp: Math.max(0, r.up - r.returned_up),
          }}
          onDone={reload}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Vỏ bình & cọc"
        subtitle={`Khách nợ vỏ — xí nghiệp giữ cọc · phí cọc Vòi ${formatCurrency(data?.feeVoi ?? 0)} / Úp ${formatCurrency(data?.feeUp ?? 0)}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => window.open(api.shellDepositExportUrl(), '_blank')}>
              Xuất theo khách hàng
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(api.shellDepositExportUrl('debt'), '_blank')}>
              Xuất danh sách nợ
            </Button>
          </>
        }
      />

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
            Kỳ báo cáo: {formatDate(period.from)} → {formatDate(period.to)}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Khách đang giữ: <b className="text-brand-navy">{formatNumber(held?.debt_voi ?? 0)} Vòi · {formatNumber(held?.debt_up ?? 0)} Úp</b>
        </span>
        <span>
          Cọc đang giữ: <b className="text-brand-navy">{formatCurrency(held?.deposit_balance ?? 0)}</b>
        </span>
        {scope === 'period' && (
          <span>
            Phát sinh trong kỳ: <b className="text-slate-800">{formatNumber(totals?.voi ?? 0)} Vòi · {formatNumber(totals?.up ?? 0)} Úp</b> · cọc{' '}
            <b className="text-slate-800">{formatCurrency(totals?.deposit ?? 0)}</b>
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.order_id}
        loading={loading}
        searchPlaceholder="Tìm theo mã đơn, khách hàng..."
        initialSortKey="order_date"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage="Chưa có đơn bình nước nào"
      />
    </>
  );
}
