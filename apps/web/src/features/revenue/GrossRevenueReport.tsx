import { FileSpreadsheet } from 'lucide-react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SubTable, type SubColumn } from '../../components/ui/SubTable';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatNumber } from '../../lib/format';
import type { RevenueGrossBlock } from '../../types';

const blockColumns: Column<RevenueGrossBlock>[] = [
  { key: 'name', header: 'Khối doanh thu', render: (r) => <b className="text-brand-navy">{r.name}</b>, sortValue: (r) => r.name },
  { key: 'owner', header: 'Tính cho', render: (r) => r.owner, sortValue: (r) => r.owner },
  { key: 'orders', header: 'Số đơn', align: 'right', sortValue: (r) => r.orders },
  { key: 'value', header: 'Giá trị gộp', align: 'right', render: (r) => formatCurrency(r.value), sortValue: (r) => r.value },
  {
    key: 'returned',
    header: 'Hàng hoàn',
    align: 'right',
    render: (r) => (r.returned ? <span className="font-semibold text-brand-red">−{formatCurrency(r.returned)}</span> : '—'),
    sortValue: (r) => r.returned,
  },
  {
    key: 'net',
    header: 'Giá trị thuần',
    align: 'right',
    render: (r) => <b className="text-brand-navy">{formatCurrency(r.net)}</b>,
    sortValue: (r) => r.net,
  },
];

const groupColumns: SubColumn<{ name: string; orders: number; value: number }>[] = [
  { key: 'name', header: 'Kho / Đối tác', render: (r) => r.name },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (r) => formatNumber(r.orders) },
  { key: 'value', header: 'Giá trị', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.value)}</b> },
];

// Báo cáo 4: doanh thu gộp — chỉ gồm hàng bán: hàng xuất từ kho xí nghiệp và hàng đi mượn của đối tác về bán.
// Hàng cho đối tác mượn là công nợ phải thu; tiền công vận chuyển / bốc xếp là tiền công trả nhân viên
// (xí nghiệp giữ lại, cuối tháng cộng vào lương) nên tách riêng, không tính vào doanh thu.
export function GrossRevenueReport({ from, to }: { from: string; to: string }) {
  const { data, loading } = useApi(() => api.fetchRevenueGrossReport({ from, to }), [from, to]);
  const total = data?.total ?? 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-xs text-slate-500">
          Doanh thu gộp = doanh thu xí nghiệp + hàng đi mượn của đối tác bán được.
          Hàng cho đối tác mượn là công nợ phải thu (không phải doanh thu). Tiền công vận chuyển / bốc xếp là
          tiền công trả cho nhân viên giao hàng — xí nghiệp giữ lại, cuối tháng cộng vào lương (không tính vào doanh thu).
          Bấm vào dòng để xổ ra chi tiết theo kho / đối tác.
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open(api.revenueGrossExportUrl({ from, to }), '_blank')}>
          <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Tổng doanh thu gộp: <b className="text-brand-navy">{formatCurrency(total)}</b>
        </span>
        {(data?.blocks ?? []).map((b) => (
          <span key={b.key}>
            {b.name.split(' (')[0]}: <b className="text-slate-800">{formatCurrency(b.net)}</b>{' '}
            <span className="text-xs text-slate-400">({total ? Math.round((b.net / total) * 100) : 0}%)</span>
          </span>
        ))}
      </div>

      <DataTable
        columns={blockColumns}
        data={data?.blocks ?? []}
        rowKey={(r) => r.key}
        loading={loading}
        searchable={false}
        pageSize={10}
        renderExpanded={(r) => <SubTable columns={groupColumns} rows={r.byGroup} rowKey={(g) => `${r.key}-${g.name}`} />}
      />

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <div className="flex flex-wrap gap-5">
          <span>
            Tiền công vận chuyển trả nhân viên giao hàng (không tính vào doanh thu):{' '}
            <b className="text-slate-700">{formatCurrency(data?.shippingCollected ?? 0)}</b>
          </span>
          <span>
            Tiền công bốc xếp (không tính vào doanh thu):{' '}
            <b className="text-slate-700">{formatCurrency(data?.serviceFee.value ?? 0)}</b>{' '}
            <span className="text-slate-400">
              ({formatNumber(data?.serviceFee.orders ?? 0)} đơn · đã thu {formatCurrency(data?.serviceFee.collected ?? 0)})
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-5">
          <span>
            Hàng cho đối tác mượn trong kỳ (công nợ phải thu, không phải doanh thu):{' '}
            <b className="text-slate-700">{formatCurrency(data?.lent.value ?? 0)}</b>{' '}
            <span className="text-slate-400">({formatNumber(data?.lent.orders ?? 0)} đơn)</span>
          </span>
          <span>
            Đối tác trả lại hàng (nhập kho, giảm công nợ): <b className="text-slate-700">{formatCurrency(data?.lent.returned ?? 0)}</b>
          </span>
        </div>
      </div>
    </>
  );
}
