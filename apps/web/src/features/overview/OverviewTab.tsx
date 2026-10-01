import { BarChart3, Boxes, Building2, Droplets, Package, Target, Wallet } from 'lucide-react';
import * as api from '../../api';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { AreaTrend, BarSeries, ChartCard } from '../../components/ui/charts';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDateShort, formatMonth, formatNumber } from '../../lib/format';
import type { DashboardData, TargetBoardRow } from '../../types';
import type { TabId } from '../../layout';

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-brand-navy">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function KpiTable({ rows, label }: { rows: TargetBoardRow[]; label: string }) {
  if (!rows.length) return <EmptyState icon={Target} title={`Chưa có ${label.toLowerCase()}`} message="Danh sách sẽ hiện khi có dữ liệu." />;
  const sorted = [...rows].sort((a, b) => Number(b.target_revenue > 0) - Number(a.target_revenue > 0) ||
    b.completion_percentage - a.completion_percentage || a.name.localeCompare(b.name));
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-2.5">{label}</th><th className="px-3 py-2.5 text-right">Thực hiện</th><th className="px-3 py-2.5 text-right">Chỉ tiêu</th><th className="px-4 py-2.5 text-right">Đạt</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr key={`${row.scope_type}-${row.employee_id ?? row.org_unit_id}`}>
              <th scope="row" className="max-w-48 px-4 py-3 font-semibold text-slate-700">{row.name}</th>
              <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">{formatCurrency(row.actual_revenue)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-slate-500">{row.target_revenue > 0 ? formatCurrency(row.target_revenue) : 'Chưa giao'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {row.target_revenue > 0 ? (
                  <span className={`font-bold ${row.completion_percentage >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {formatNumber(row.completion_percentage)}%
                  </span>
                ) : <span className="text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WarehouseStock({ warehouses }: { warehouses: DashboardData['stockByWarehouse'] }) {
  if (!warehouses.length) return <EmptyState icon={Boxes} title="Chưa có kho vật lý" message="Thêm kho để theo dõi tồn theo từng địa điểm." />;
  return (
    <div className="divide-y divide-slate-100">
      {warehouses.map((warehouse, index) => (
        <details key={warehouse.warehouse_id} className="group" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-cyan">
            <span className="min-w-0 font-semibold text-slate-700">{warehouse.name}</span>
            <span className="shrink-0 text-xs text-slate-500">{formatNumber(warehouse.items.filter((item) => item.quantity > 0).length)} mã còn hàng <span aria-hidden="true" className="ml-1 inline-block text-brand-cyan group-open:rotate-90">›</span></span>
          </summary>
          <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/50 px-4 pb-3">
            <table className="w-full min-w-[380px] text-xs">
              <thead className="text-slate-500"><tr><th className="py-2 text-left font-semibold">Sản phẩm</th><th className="py-2 text-right font-semibold">Tồn</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {warehouse.items.map((item) => (
                  <tr key={item.product_id}><td className="py-2 text-slate-700">{item.product_name}</td><td className={`py-2 text-right font-semibold ${item.quantity <= 0 ? 'text-brand-red' : 'text-brand-navy'}`}>{formatNumber(item.quantity)} {item.unit}</td></tr>
                ))}
              </tbody>
            </table>
            {!warehouse.items.length && <p className="py-3 text-xs text-slate-500">Chưa có sản phẩm hàng hóa đang hoạt động.</p>}
          </div>
        </details>
      ))}
    </div>
  );
}

export function OverviewTab({ month, onNavigate }: { month: string; onNavigate: (t: TabId) => void }) {
  const dashboardApi = useApi(() => api.fetchDashboard(month), [month]);
  const targetsApi = useApi(() => api.fetchTargets(month), [month]);
  const d = dashboardApi.data;
  const k = d?.kpis;
  const scopeChart = (d?.revenueByScope ?? []).map((row) => ({
    name: row.scope === 'COMPANY' ? 'Công ty' : 'Xí nghiệp', 'Doanh thu': row.revenue,
  }));
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const periodHint = `01/01–${lastDay}/${month.slice(5, 7)}/${month.slice(0, 4)}`;

  return (
    <>
      <PageHeader title="Bảng điều khiển" subtitle={`Tình hình điều hành · ${formatMonth(month)}`} />

      {dashboardApi.error && (
        <Card className="mb-5 border-brand-red/30"><CardBody className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-red">
          <span>Không tải được dashboard: {dashboardApi.error}</span>
          <button type="button" className="font-semibold underline" onClick={dashboardApi.reload}>Thử lại</button>
        </CardBody></Card>
      )}
      {dashboardApi.error ? null : dashboardApi.loading ? <p role="status" className="mb-5 rounded-xl bg-slate-100 p-8 text-sm text-slate-500">Đang tải số liệu điều hành…</p> : (
        <>
          <section className="mb-6" aria-label="Doanh thu">
            <SectionHeading title="Doanh thu" subtitle="Giá trị tiền hàng của đơn đã hoàn tất, chưa trừ hàng hoàn và không gồm phí vận chuyển." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard icon={Wallet} tone="navy" label="Trong ngày" value={formatCurrency(k?.revenueToday ?? 0)} hint="Hôm nay" />
              <StatCard icon={BarChart3} tone="cyan" label="Trong tháng" value={formatCurrency(k?.revenueMonth ?? 0)} hint={formatMonth(month)} />
              <StatCard icon={Building2} tone="green" label="Lũy kế năm" value={formatCurrency(k?.revenueYear ?? 0)} hint={periodHint} />
            </div>
          </section>

          <section className="mb-6" aria-label="Công nợ chưa thu">
            <SectionHeading title="Công nợ chưa thu" subtitle="Số hiện còn phải thu của đơn phát sinh trong kỳ, sau các khoản đã thanh toán và hàng hoàn." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard icon={Wallet} tone="red" label="Phát sinh trong ngày" value={formatCurrency(k?.debtToday ?? 0)} hint="Đơn lập hôm nay" />
              <StatCard icon={Wallet} tone="amber" label="Phát sinh trong tháng" value={formatCurrency(k?.debtMonth ?? 0)} hint={formatMonth(month)} />
              <StatCard icon={Wallet} tone="indigo" label="Phát sinh lũy kế năm" value={formatCurrency(k?.debtYear ?? 0)} hint={periodHint} />
            </div>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Doanh thu theo chỉ tiêu" subtitle={`Công ty và Xí nghiệp · ${formatMonth(month)}`} empty={!scopeChart.some((row) => row['Doanh thu'] > 0)} height={260}>
              <BarSeries data={scopeChart} xKey="name" currency series={[{ key: 'Doanh thu', name: 'Doanh thu', color: '#2C2C6B' }]} />
            </ChartCard>
            <ChartCard title="Xu hướng doanh thu" subtitle={`Theo ngày · ${formatMonth(month)}`} empty={(d?.revenueByDay ?? []).length === 0} height={260}>
              <AreaTrend data={(d?.revenueByDay ?? []).map((row) => ({ date: formatDateShort(row.date), revenue: row.revenue }))} xKey="date" currency series={[{ key: 'revenue', name: 'Doanh thu', color: '#50ADDE' }]} />
            </ChartCard>
          </div>

          <section className="mb-6" aria-label="Nợ vỏ bình">
            <SectionHeading title="Nợ vỏ bình" subtitle="Số vỏ khách hàng đang giữ, theo loại bình." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard icon={Droplets} tone="navy" label="Vỏ bình Vòi" value={`${formatNumber(k?.bottleDebtVoi ?? 0)} vỏ`} hint="Số dư hiện tại" />
              <StatCard icon={Droplets} tone="cyan" label="Vỏ bình Úp" value={`${formatNumber(k?.bottleDebtUp ?? 0)} vỏ`} hint="Số dư hiện tại" />
            </div>
          </section>

          <section className="mb-6" aria-label="KPI">
            <SectionHeading title="KPI nhân viên và đơn vị" subtitle={`Thực hiện so với chỉ tiêu được giao trong ${formatMonth(month)}.`} />
            {targetsApi.error && <p role="alert" className="mb-3 text-sm text-brand-red">Không tải được KPI: {targetsApi.error} <button type="button" className="underline" onClick={targetsApi.reload}>Thử lại</button></p>}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card><CardHeader title="Nhân viên" subtitle="Doanh thu và tỷ lệ hoàn thành" action={<button type="button" onClick={() => onNavigate('kpi')} className="text-xs font-semibold text-brand-cyan hover:underline">Xem chỉ tiêu →</button>} /><CardBody className="p-0">{targetsApi.error ? <p className="p-5 text-xs text-slate-500">Dữ liệu KPI chưa sẵn sàng.</p> : targetsApi.loading ? <p className="p-5 text-xs text-slate-500">Đang tải KPI…</p> : <KpiTable rows={targetsApi.data?.employees ?? []} label="Nhân viên" />}</CardBody></Card>
              <Card><CardHeader title="Đơn vị" subtitle="Bao gồm nhân viên thuộc đơn vị con" action={<button type="button" onClick={() => onNavigate('kpi')} className="text-xs font-semibold text-brand-cyan hover:underline">Xem chỉ tiêu →</button>} /><CardBody className="p-0">{targetsApi.error ? <p className="p-5 text-xs text-slate-500">Dữ liệu KPI chưa sẵn sàng.</p> : targetsApi.loading ? <p className="p-5 text-xs text-slate-500">Đang tải KPI…</p> : <KpiTable rows={targetsApi.data?.units ?? []} label="Đơn vị" />}</CardBody></Card>
            </div>
          </section>

          <section aria-label="Tồn kho chi tiết">
            <SectionHeading title="Tồn kho theo kho" subtitle={`Tất cả ${formatNumber(k?.warehouseCount ?? 0)} kho vật lý đang hoạt động; mở từng kho để xem tồn của mọi mã hàng, kể cả tồn 0.`} />
            <Card><CardHeader title={<span className="flex items-center gap-2"><Package className="h-4 w-4 text-brand-cyan" /> Chi tiết hàng hóa</span>} action={<button type="button" onClick={() => onNavigate('stock')} className="text-xs font-semibold text-brand-cyan hover:underline">Mở phân hệ kho →</button>} /><CardBody className="p-0"><WarehouseStock warehouses={d?.stockByWarehouse ?? []} /></CardBody></Card>
          </section>
        </>
      )}
    </>
  );
}
