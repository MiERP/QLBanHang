import { FileSpreadsheet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SubTable, type SubColumn } from '../../components/ui/SubTable';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import type { PayrollDetailRow, PayrollItem, PayrollReport as PayrollReportData } from '../../types';

type SummaryRow = PayrollReportData['summary']['rows'][number];

// Bảng lương theo nhân viên: chi tiết tháng (xổ từng phiếu/đơn) + tổng hợp 12 tháng trong năm.
export function PayrollReport({
  title,
  subtitle,
  itemLabel,
  report,
  loading,
  exportUrl,
  actions,
  onItemClick,
}: {
  title: string;
  subtitle: string;
  itemLabel: string;
  report: PayrollReportData | null;
  loading: boolean;
  exportUrl: string;
  actions?: ReactNode;
  onItemClick?: (item: PayrollItem) => void;
}) {
  const detail = report?.detail ?? [];
  const summaryRows = report?.summary.rows ?? [];
  const detailTotal = detail.reduce((a, r) => a + r.amount, 0);

  const itemColumns: SubColumn<PayrollItem>[] = [
    { key: 'date', header: 'Ngày', render: (r) => formatDate(r.date) },
    { key: 'code', header: itemLabel, render: (r) => <span className="font-mono font-semibold text-brand-navy">{r.code}</span> },
    { key: 'customer_name', header: 'Khách hàng', render: (r) => r.customer_name || '—' },
    { key: 'note', header: 'Nội dung', render: (r) => r.note || '—' },
    { key: 'amount', header: 'Số tiền', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.amount)}</b> },
  ];

  const detailColumns: Column<PayrollDetailRow>[] = [
    { key: 'name', header: 'Nhân viên', sortValue: (r) => r.name },
    { key: 'unit_name', header: 'Đơn vị', render: (r) => r.unit_name ?? '—' },
    { key: 'count', header: 'Số đơn / phiếu', align: 'center', sortValue: (r) => r.count },
    {
      key: 'amount',
      header: 'Tổng tiền',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatCurrency(r.amount)}</b>,
      sortValue: (r) => r.amount,
    },
  ];

  const summaryColumns: Column<SummaryRow>[] = [
    { key: 'name', header: 'Nhân viên', sortValue: (r) => r.name },
    { key: 'unit_name', header: 'Đơn vị', render: (r) => r.unit_name ?? '—' },
    ...Array.from({ length: 12 }, (_, i) => ({
      key: `month-${i + 1}`,
      header: `T${i + 1}`,
      align: 'right' as const,
      render: (r: SummaryRow) => (r.totals[i] ? formatNumber(r.totals[i]) : <span className="text-slate-300">—</span>),
      sortValue: (r: SummaryRow) => r.totals[i],
    })),
    {
      key: 'total',
      header: 'Cả năm',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatCurrency(r.total)}</b>,
      sortValue: (r) => r.total,
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button onClick={() => window.open(exportUrl, '_blank')}>
              <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
            </Button>
          </div>
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <span className="font-semibold text-slate-700">Chi tiết theo nhân viên — {report ? `${formatDate(report.from)} → ${formatDate(report.to)}` : ''}</span>
        <span>
          Tổng: <b className="text-brand-navy">{formatCurrency(detailTotal)}</b>
        </span>
        <span className="text-xs text-slate-400">
          bấm vào dòng để xổ danh sách{onItemClick ? ' — bấm vào phiếu để sửa' : ''}
        </span>
      </div>
      <DataTable
        columns={detailColumns}
        data={detail}
        rowKey={(r) => r.name}
        loading={loading}
        searchPlaceholder="Tìm nhân viên..."
        pageSize={20}
        renderExpanded={(r) => (
          <SubTable columns={itemColumns} rows={r.items} rowKey={(it, i) => `${it.id}-${i}`} onRowClick={onItemClick} />
        )}
      />

      <div className="mb-2 mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <span className="font-semibold text-slate-700">Tổng hợp theo tháng — Năm {report?.year ?? ''}</span>
        <span className="text-xs text-slate-400">cộng dồn theo 12 tháng trong năm để tính lương</span>
      </div>
      <DataTable columns={summaryColumns} data={summaryRows} rowKey={(r) => r.name} loading={loading} searchable={false} pageSize={20} />
    </>
  );
}
