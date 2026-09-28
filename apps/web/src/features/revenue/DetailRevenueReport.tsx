import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Select } from '../../components/ui/Field';
import { SubTable, type SubColumn } from '../../components/ui/SubTable';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatNumber } from '../../lib/format';
import type { RevenueDetailGroupRow } from '../../types';

const columns: Column<RevenueDetailGroupRow>[] = [
  { key: 'name', header: 'Nhóm', render: (r) => <b className="text-brand-navy">{r.name}</b>, sortValue: (r) => r.name },
  { key: 'group_type', header: 'Loại', render: (r) => r.group_type ?? '—', sortValue: (r) => r.group_type ?? '' },
  { key: 'orders', header: 'Số đơn', align: 'right', sortValue: (r) => r.orders },
  { key: 'quantity', header: 'Sản lượng', align: 'right', sortValue: (r) => r.quantity },
  { key: 'promo', header: 'SL khuyến mãi', align: 'right', render: (r) => (r.promo ? formatNumber(r.promo) : '—'), sortValue: (r) => r.promo },
  {
    key: 'revenue',
    header: 'Doanh thu gộp',
    align: 'right',
    render: (r) => formatCurrency(r.revenue + r.returned),
    sortValue: (r) => r.revenue + r.returned,
  },
  {
    key: 'returned',
    header: 'Hàng hoàn',
    align: 'right',
    render: (r) => (r.returned ? <span className="font-semibold text-brand-red">−{formatCurrency(r.returned)}</span> : '—'),
    sortValue: (r) => r.returned,
  },
  {
    key: 'net',
    header: 'Doanh thu thuần',
    align: 'right',
    render: (r) => <b className="text-brand-navy">{formatCurrency(r.net)}</b>,
    sortValue: (r) => r.net,
  },
];

const employeeColumns: SubColumn<RevenueDetailGroupRow>[] = [
  { key: 'name', header: 'Nhân viên bán', render: (r) => r.name },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (r) => formatNumber(r.orders) },
  { key: 'quantity', header: 'Sản lượng', align: 'right', render: (r) => formatNumber(r.quantity) },
  {
    key: 'returned',
    header: 'Hàng hoàn',
    align: 'right',
    render: (r) => (r.returned ? <span className="text-brand-red">−{formatCurrency(r.returned)}</span> : '—'),
  },
  { key: 'net', header: 'Doanh thu thuần', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.net)}</b> },
];

// Báo cáo 2: doanh thu xí nghiệp chi tiết — chọn nhóm theo kho xuất hàng hoặc theo đơn vị (trạm) của nhân viên bán.
export function DetailRevenueReport({ from, to }: { from: string; to: string }) {
  const [group, setGroup] = useState('warehouse');
  const { data, loading } = useApi(() => api.fetchRevenueDetailReport({ from, to, group }), [from, to, group]);
  const totals = data?.totals;
  const rows = data?.rows ?? [];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <Field label="Nhóm theo">
          <Select dense value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="warehouse">Kho xuất hàng</option>
            <option value="unit">Đơn vị (trạm) của nhân viên bán</option>
          </Select>
        </Field>
        <div className="col-span-2 flex items-end text-xs text-slate-500">
          Doanh thu nhân viên bán cộng lại = doanh thu của trạm; đơn vị thuộc xí nghiệp.
          {group === 'unit' ? ' Bấm vào dòng để xổ ra từng nhân viên trong trạm.' : ''}
        </div>
        <div className="col-span-2 flex items-end justify-end sm:col-span-1">
          <Button variant="outline" size="sm" onClick={() => window.open(api.revenueDetailExportUrl({ from, to, group }), '_blank')}>
            <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Số đơn: <b className="text-slate-800">{formatNumber(totals?.orders ?? 0)}</b>
        </span>
        <span>
          Sản lượng: <b className="text-slate-800">{formatNumber(totals?.quantity ?? 0)}</b>
        </span>
        <span>
          SL khuyến mãi: <b className="text-amber-600">{formatNumber(totals?.promo ?? 0)}</b>
        </span>
        <span>
          Doanh thu gộp: <b className="text-brand-navy">{formatCurrency(totals?.revenue ?? 0)}</b>
        </span>
        <span>
          Hàng hoàn: <b className="text-brand-red">−{formatCurrency(totals?.returned ?? 0)}</b>
        </span>
        <span>
          Doanh thu thuần: <b className="text-brand-navy">{formatCurrency(totals?.net ?? 0)}</b>
        </span>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => `${r.key}`}
        loading={loading}
        searchPlaceholder="Tìm theo tên nhóm..."
        initialSortKey="net"
        initialSortDir="desc"
        pageSize={30}
        renderExpanded={
          group === 'unit' && rows.some((r) => r.children?.length)
            ? (r) => (
                <>
                  {r.children?.length ? (
                    <SubTable columns={employeeColumns} rows={r.children} rowKey={(c) => `${c.key}`} />
                  ) : (
                    <div className="py-2 text-sm text-slate-400">Đơn vị này chưa có đơn hàng nào trong kỳ.</div>
                  )}
                </>
              )
            : undefined
        }
      />
    </>
  );
}
