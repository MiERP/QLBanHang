import { useState } from 'react';
import * as api from '../../api';
import { cn } from '../../lib/cn';
import { formatCurrency, formatNumber } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { DepositsTab } from '../deposits/DepositsTab';
import { ShellAuditTab } from '../warehouse/ShellAuditTab';
import { ShellReportTab } from './ShellReportTab';
import { ShellStockTab } from './ShellStockTab';
import type { ReportPeriod } from '../../types';

type SubTab = 'overview' | 'customers' | 'ledger';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan & đối chiếu' },
  { id: 'customers', label: 'Theo khách' },
  { id: 'ledger', label: 'Sổ phát sinh' },
];

// Một màn duy nhất quản lý vỏ bình & cọc: gộp "Vỏ bình", "Đối chiếu vỏ", "Dòng tiền cọc vỏ"
// và báo cáo "Vỏ bình & cọc" trước đây thành 3 tab — dữ liệu lấy từ đúng các API đang có.
export function ShellManagementTab({ period }: { period: ReportPeriod }) {
  const [sub, setSub] = useState<SubTab>('overview');
  const stock = useApi(() => api.fetchShellStock(), []);
  const deposits = useApi(() => api.fetchShellDepositReport(), [period.key]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSub(tab.id)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
              sub === tab.id
                ? 'bg-brand-navy text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sub === 'overview' && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Vỏ khách đang giữ"
              value={`${formatNumber(stock.data?.totals.customer_voi ?? 0)} Vòi · ${formatNumber(stock.data?.totals.customer_up ?? 0)} Úp`}
            />
            <SummaryCard
              label="Vỏ xí nghiệp đang giữ"
              value={`${formatNumber(stock.data?.totals.stock_voi ?? 0)} Vòi · ${formatNumber(stock.data?.totals.stock_up ?? 0)} Úp`}
            />
            <SummaryCard
              label="Vỏ đang ở đối tác"
              value={`${formatNumber(stock.data?.totals.partner_voi ?? 0)} Vòi · ${formatNumber(stock.data?.totals.partner_up ?? 0)} Úp`}
            />
            <SummaryCard
              label="Cọc đang giữ (phải trả khách)"
              value={formatCurrency(deposits.data?.totals.balance ?? 0)}
              hint={`Chờ thu từ đơn đã xác nhận: ${formatCurrency(deposits.data?.totals.pending_deposit ?? 0)}`}
            />
          </div>
          <ShellAuditTab />
        </>
      )}

      {sub === 'customers' && <ShellReportTab period={period} />}

      {sub === 'ledger' && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Thu & hoàn cọc vỏ</h2>
            <DepositsTab period={period} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Kho vỏ & bút toán vỏ</h2>
            <ShellStockTab />
          </section>
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-brand-navy">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
