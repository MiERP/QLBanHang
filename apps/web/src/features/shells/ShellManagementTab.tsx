import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { ShellActions } from './ShellActions';
import type { ReportPeriod, ShellCustomerRow, ShellOrderRow } from '../../types';

type Scope = 'all' | 'period';

// Một bảng duy nhất cho vỏ bình & cọc: dòng chính là KHÁCH HÀNG (số vỏ đang giữ, tiền cọc đang
// giữ). Bấm vào một khách thì sổ xuống danh sách đơn của khách đó — mỗi đơn thao tác được ngay
// (trả vỏ / tất toán / mất-mua đứt).
export function ShellManagementTab({ period }: { period: ReportPeriod }) {
  const [scope, setScope] = useState<Scope>('all');
  const { data, loading, reload } = useApi(() => api.fetchShellOrders({ scope }), [scope]);

  const held = data?.held;
  const totals = data?.totals;
  const orders = useMemo(() => data?.rows ?? [], [data]);

  const ordersByCustomer = useMemo(() => {
    const map = new Map<number, ShellOrderRow[]>();
    for (const order of orders) {
      const list = map.get(order.customer_id) ?? [];
      list.push(order);
      map.set(order.customer_id, list);
    }
    return map;
  }, [orders]);

  const columns: Column<ShellCustomerRow>[] = [
    {
      key: 'name',
      header: 'Khách hàng',
      render: (r) => (
        <>
          <span className="block font-semibold text-slate-700">{r.name}</span>
          <span className="text-xs text-slate-400">{r.code}</span>
        </>
      ),
      sortValue: (r) => r.name,
    },
    { key: 'order_count', header: 'Số đơn', align: 'right', sortValue: (r) => r.order_count },
    {
      key: 'period',
      header: scope === 'period' ? 'Vỏ giao trong kỳ (Vòi/Úp)' : 'Vỏ giao (Vòi/Úp)',
      align: 'right',
      render: (r) => `${formatNumber(r.period_voi)} / ${formatNumber(r.period_up)}`,
      sortValue: (r) => r.period_voi + r.period_up,
    },
    {
      key: 'period_deposit',
      header: scope === 'period' ? 'Cọc thu trong kỳ' : 'Cọc đã thu',
      align: 'right',
      render: (r) => formatCurrency(r.period_deposit),
      sortValue: (r) => r.period_deposit,
    },
    {
      key: 'held',
      header: 'Khách đang giữ (Vòi/Úp)',
      align: 'right',
      render: (r) => (
        <b className="text-brand-navy">
          {formatNumber(r.debt_voi)} / {formatNumber(r.debt_up)}
        </b>
      ),
      sortValue: (r) => r.debt_voi + r.debt_up,
    },
    {
      key: 'deposit_balance',
      header: 'Cọc đang giữ',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatCurrency(r.deposit_balance)}</b>,
      sortValue: (r) => r.deposit_balance,
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
        <span className="text-xs text-slate-400">Bấm vào một khách hàng để sổ xuống danh sách đơn.</span>
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
        data={data?.customers ?? []}
        rowKey={(r) => r.customer_id}
        loading={loading}
        searchPlaceholder="Tìm theo tên hoặc mã khách hàng..."
        initialSortKey="held"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage="Chưa có khách hàng nào có vỏ bình"
        renderExpanded={(customer) => <CustomerOrders orders={ordersByCustomer.get(customer.customer_id) ?? []} onDone={reload} />}
      />
    </>
  );
}

function CustomerOrders({ orders, onDone }: { orders: ShellOrderRow[]; onDone: () => void }) {
  if (!orders.length) {
    return <p className="text-xs text-slate-400">Khách chưa có đơn bình nước nào trong phạm vi đang xem.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Ngày</th>
            <th className="px-3 py-2">Mã đơn</th>
            <th className="px-3 py-2 text-right">Vỏ Vòi</th>
            <th className="px-3 py-2 text-right">Vỏ Úp</th>
            <th className="px-3 py-2 text-right">Tiền cọc</th>
            <th className="px-3 py-2 text-right">Đã trả (Vòi/Úp)</th>
            <th className="px-3 py-2 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((o) => (
            <tr key={o.order_id} className="bg-white">
              <td className="px-3 py-2">{formatDate(o.order_date)}</td>
              <td className="px-3 py-2 font-mono text-xs font-semibold text-brand-navy">{o.order_code}</td>
              <td className="px-3 py-2 text-right">{o.voi ? formatNumber(o.voi) : '—'}</td>
              <td className="px-3 py-2 text-right">{o.up ? formatNumber(o.up) : '—'}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(o.deposit)}</td>
              <td className="px-3 py-2 text-right">
                {o.returned_voi || o.returned_up ? `${formatNumber(o.returned_voi)} / ${formatNumber(o.returned_up)}` : '—'}
              </td>
              <td className="px-3 py-2">
                <ShellActions
                  target={{
                    customerId: o.customer_id,
                    customerName: o.customer_name,
                    debtVoi: o.debt_voi,
                    debtUp: o.debt_up,
                    orderId: o.order_id,
                    defaultVoi: Math.max(0, o.voi - o.returned_voi),
                    defaultUp: Math.max(0, o.up - o.returned_up),
                  }}
                  onDone={onDone}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
