import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import type { ReportPeriod, TradeReportBlock, TradeReportItem, TradeReportSource } from '../../types';

type Mode = 'net' | 'gross';

const emptyBlock: TradeReportBlock = {
  items: [],
  totals: { quantity: 0, amount_gross: 0, amount_net: 0, tax_amount: 0 },
};

// Doanh thu vẫn là một đầu ra duy nhất của xí nghiệp; tách hàng chỉ để nhìn rõ nguồn khách:
// khách do xí nghiệp khai thác hay khách do Công ty đưa sang.
function SourceBreakdown({
  title,
  total,
  sources,
  mode,
}: {
  title: string;
  total: TradeReportBlock;
  sources: TradeReportSource[];
  mode: Mode;
}) {
  const amountOf = (block: TradeReportBlock) => (mode === 'net' ? block.totals.amount_net : block.totals.amount_gross);
  const rows = [{ key: 'TOTAL', label: 'Tổng', block: total }, ...sources];

  return (
    <div className="mb-2">
      <p className="mb-1 text-sm font-semibold text-slate-700">{title}</p>
      <table className="text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-400">
            <th className="pr-8 pb-0.5 text-left font-semibold">Nguồn khách</th>
            <th className="pr-8 pb-0.5 text-right font-semibold">SL</th>
            <th className="pr-8 pb-0.5 text-right font-semibold">Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.key === 'TOTAL' ? 'font-semibold text-brand-navy' : 'text-slate-600'}>
              <td className="pr-8">{row.label}</td>
              <td className="pr-8 text-right">{formatNumber(row.block.totals.quantity)}</td>
              <td className="pr-8 text-right">{formatCurrency(amountOf(row.block))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TradeReportTab({ period }: { period: ReportPeriod }) {
  const [mode, setMode] = useState<Mode>('net');
  // Đơn đi mượn hàng của đối tác (hàng lấy từ kho đối tác, giao cho khách của xí nghiệp) cũng là
  // doanh thu của xí nghiệp — tick để cộng gộp vào báo cáo.
  const [borrowed, setBorrowed] = useState(true);
  const { data, loading } = useApi(() => api.fetchTradeReport(borrowed), [borrowed, period.key]);
  const periodText = `${formatDate(period.from)} → ${formatDate(period.to)}`;

  const amountOf = (r: TradeReportItem) => (mode === 'net' ? r.amount_net : r.amount_gross);
  const unitPriceOf = (r: TradeReportItem) => (mode === 'net' ? r.net_unit_price : r.unit_price);

  const columns: Column<TradeReportItem>[] = [
    { key: 'label', header: 'Mặt hàng', sortValue: (r) => r.label },
    { key: 'quantity', header: 'SL', align: 'center', render: (r) => formatNumber(r.quantity), sortValue: (r) => r.quantity },
    { key: 'unit_price', header: 'Đơn giá', align: 'right', render: (r) => formatCurrency(unitPriceOf(r)), sortValue: (r) => unitPriceOf(r) },
    {
      key: 'amount',
      header: 'Doanh thu',
      align: 'right',
      render: (r) => <b className="text-brand-navy">{formatCurrency(amountOf(r))}</b>,
      sortValue: (r) => amountOf(r),
    },
  ];

  const current = data?.current ?? emptyBlock;
  const cumulative = data?.cumulative ?? emptyBlock;

  return (
    <>
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">
            Kỳ báo cáo: <b className="text-slate-800">{periodText}</b>
          </span>
          <div className="w-72">
            <Select dense value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="net">Doanh thu trước thuế (giá chưa VAT)</option>
              <option value="gross">Doanh thu sau thuế (giá đã gồm VAT)</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={borrowed} onChange={(e) => setBorrowed(e.target.checked)} />
            Cộng doanh thu đơn đi mượn hàng của đối tác
          </label>
          <span className="text-xs text-slate-500">
            Thuế suất GTGT áp dụng: <b>{formatNumber(data?.vatRate ?? 0)}%</b> — quản lý tại Danh mục hệ thống → Thuế suất VAT
          </span>
          <Button
            className="ml-auto"
            variant="outline"
            size="sm"
            onClick={() => window.open(api.tradeReportExportUrl(mode, borrowed), '_blank')}
          >
            <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {borrowed
            ? 'Đang cộng gộp: đơn bán của xí nghiệp + đơn đi mượn hàng của đối tác (hàng lấy từ kho đối tác, giao cho khách của xí nghiệp).'
            : 'Chỉ tính đơn bán của xí nghiệp (hàng xuất từ kho xí nghiệp) — chưa gồm đơn đi mượn hàng của đối tác.'}{' '}
          Mẫu báo cáo thương mại nộp Công ty, kỳ báo cáo theo kỳ đang cấu hình.
        </p>
      </div>

      <div className="mt-6">
        <SourceBreakdown
          title="I. Thực hiện tháng"
          total={current}
          sources={data?.sources.current ?? []}
          mode={mode}
        />
      </div>
      <DataTable
        columns={columns}
        data={current.items}
        rowKey={(r) => r.key}
        loading={loading}
        searchable={false}
        pageSize={10}
        emptyMessage="Chưa có đơn hoàn tất trong tháng này"
      />

      <div className="mt-6">
        <SourceBreakdown
          title="II. Lũy kế từ đầu năm đến hết kỳ"
          total={cumulative}
          sources={data?.sources.cumulative ?? []}
          mode={mode}
        />
      </div>
      <DataTable
        columns={columns}
        data={cumulative.items}
        rowKey={(r) => r.key}
        loading={loading}
        searchable={false}
        pageSize={10}
        emptyMessage="Chưa có đơn hoàn tất trong năm"
      />
    </>
  );
}
