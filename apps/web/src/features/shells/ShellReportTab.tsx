import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import * as api from '../../api';
import { CustomerShellPanel } from './CustomerShellPanel';
import type { ReportPeriod, ShellDepositReportRow } from '../../types';

const diffTone = (diff: number) => (Math.abs(diff) <= 0.5 ? 'green' : diff > 0 ? 'amber' : 'red');
const diffLabel = (diff: number) =>
  Math.abs(diff) <= 0.5 ? 'Khớp' : diff > 0 ? `Thừa cọc ${formatCurrency(diff)}` : `Thiếu cọc ${formatCurrency(Math.abs(diff))}`;

const columns: Column<ShellDepositReportRow>[] = [
  { key: 'code', header: 'Mã KH', className: 'font-mono text-xs', sortValue: (r) => r.code },
  { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
  { key: 'debt_voi', header: 'Nợ vỏ Vòi', align: 'right', render: (r) => formatNumber(r.debt_voi), sortValue: (r) => r.debt_voi },
  { key: 'debt_up', header: 'Nợ vỏ Úp', align: 'right', render: (r) => formatNumber(r.debt_up), sortValue: (r) => r.debt_up },
  {
    key: 'pending_voi',
    header: 'Chờ ghi nhận Vòi',
    align: 'right',
    render: (r) => (r.pending_voi ? formatNumber(r.pending_voi) : '—'),
    sortValue: (r) => r.pending_voi,
  },
  {
    key: 'pending_up',
    header: 'Chờ ghi nhận Úp',
    align: 'right',
    render: (r) => (r.pending_up ? formatNumber(r.pending_up) : '—'),
    sortValue: (r) => r.pending_up,
  },
  {
    key: 'shell_value',
    header: 'Giá trị vỏ giữ',
    align: 'right',
    render: (r) => formatCurrency(r.shell_value),
    sortValue: (r) => r.shell_value,
  },
  { key: 'collected', header: 'Đã thu cọc (lũy kế)', align: 'right', render: (r) => formatCurrency(r.collected), sortValue: (r) => r.collected },
  { key: 'refunded', header: 'Đã hoàn cọc (lũy kế)', align: 'right', render: (r) => formatCurrency(r.refunded), sortValue: (r) => r.refunded },
  {
    key: 'balance',
    header: 'Cọc đang giữ',
    align: 'right',
    render: (r) => <b className="text-brand-navy">{formatCurrency(r.balance)}</b>,
    sortValue: (r) => r.balance,
  },
  {
    key: 'pending_deposit',
    header: 'Cọc chờ thu',
    align: 'right',
    render: (r) => (r.pending_deposit ? formatCurrency(r.pending_deposit) : '—'),
    sortValue: (r) => r.pending_deposit,
  },
  {
    key: 'diff',
    header: 'Lệch',
    align: 'center',
    render: (r) => <Badge tone={diffTone(r.diff)}>{diffLabel(r.diff)}</Badge>,
    sortValue: (r) => r.diff,
  },
  {
    key: 'collected_month',
    header: 'Thu trong kỳ',
    align: 'right',
    render: (r) => (r.collected_month ? formatCurrency(r.collected_month) : '—'),
    sortValue: (r) => r.collected_month,
  },
  {
    key: 'refunded_month',
    header: 'Hoàn trong kỳ',
    align: 'right',
    render: (r) => (r.refunded_month ? formatCurrency(r.refunded_month) : '—'),
    sortValue: (r) => r.refunded_month,
  },
];

export function ShellReportTab({ period }: { period: ReportPeriod }) {
  const { data, loading, reload } = useApi(() => api.fetchShellDepositReport(), [period.key]);
  const totals = data?.totals;
  const periodText = `${formatDate(period.from)} → ${formatDate(period.to)}`;

  return (
    <>
      <PageHeader
        title="Vỏ bình & cọc"
        subtitle={`${periodText} · nợ vỏ khách đang giữ đối chiếu với tiền cọc mình đang giữ · phí cọc Vòi ${formatCurrency(data?.feeVoi ?? 0)} / Úp ${formatCurrency(data?.feeUp ?? 0)}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open(api.shellDepositExportUrl(), '_blank')}>
            Xuất Excel
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Nợ vỏ Vòi: <b className="text-slate-800">{formatNumber(totals?.debt_voi ?? 0)}</b>
        </span>
        <span>
          Nợ vỏ Úp: <b className="text-slate-800">{formatNumber(totals?.debt_up ?? 0)}</b>
        </span>
        <span>
          Giá trị vỏ đang cho khách giữ: <b className="text-brand-navy">{formatCurrency(totals?.shell_value ?? 0)}</b>
        </span>
        <span>
          Cọc đang giữ: <b className="text-brand-navy">{formatCurrency(totals?.balance ?? 0)}</b>
        </span>
        <span>
          Chờ ghi nhận (đã xác nhận, chưa giao):{' '}
          <b className="text-amber-600">
            {formatNumber(totals?.pending_voi ?? 0)} Vòi · {formatNumber(totals?.pending_up ?? 0)} Úp ·{' '}
            {formatCurrency(totals?.pending_deposit ?? 0)}
          </b>
        </span>
        <span>
          Lệch: <b className={Math.abs(totals?.diff ?? 0) <= 0.5 ? 'text-emerald-600' : 'text-brand-red'}>{formatCurrency(totals?.diff ?? 0)}</b>{' '}
          <span className="text-xs text-slate-400">({formatNumber(totals?.mismatch_count ?? 0)} khách lệch)</span>
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-400">
        Lệch = cọc đang giữ − giá trị vỏ khách đang giữ. Khách báo mất vỏ hoặc vỏ trả về chưa thu cọc sẽ hiện ở đây; phí cọc khai báo tại
        Danh mục hệ thống → Cọc vỏ bình.
      </p>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        rowKey={(r) => r.customer_id}
        loading={loading}
        searchPlaceholder="Tìm theo mã hoặc tên khách hàng..."
        initialSortKey="debt_voi"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage="Chưa có khách hàng nào"
        renderExpanded={(r) => (
          <div className="bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">
              Thao tác vỏ của {r.name}: thu hồi & hoàn cọc, tất toán, vỏ mất / mua đứt
            </p>
            <CustomerShellPanel
              customer={{ id: r.customer_id, name: r.name, debt_voi: r.debt_voi, debt_up: r.debt_up }}
              onChanged={reload}
            />
          </div>
        )}
      />
    </>
  );
}
