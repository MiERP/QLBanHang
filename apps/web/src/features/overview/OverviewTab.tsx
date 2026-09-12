import { AlertTriangle, ArrowLeftRight, Boxes, Droplets, Handshake, Package, ShoppingCart, TrendingDown, TrendingUp, Truck, Users, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { AreaTrend, BarSeries, ChartCard, DonutChart } from '../../components/ui/charts';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDateShort, formatMonth, formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Order, StockItem } from '../../types';
import type { TabId } from '../../layout';

const PAYMENT_LABEL: Record<string, string> = { PAID: 'Đã thanh toán', PARTIAL: 'Một phần', UNPAID: 'Công nợ' };

export function OverviewTab({ month, onNavigate }: { month: string; onNavigate: (t: TabId) => void }) {
  const dashboardApi = useApi(() => api.fetchDashboard(month), [month]);
  const alertsApi = useApi(() => api.fetchAlerts(), []);
  const ordersApi = useApi(() => api.fetchOrders({ limit: 8 }), []);

  const d = dashboardApi.data;
  const kpis = d?.kpis;

  const revenueDelta = useMemo(() => {
    if (!kpis) return 0;
    if (!kpis.revenueYesterday) return kpis.revenueToday > 0 ? 100 : 0;
    return Math.round(((kpis.revenueToday - kpis.revenueYesterday) / kpis.revenueYesterday) * 100);
  }, [kpis]);

  const productMix = (d?.productMix ?? []).map((p) => ({ name: p.name.replace('Nước Tinh Khiết RO QAROMI ', 'RO ').replace('Nước Ion Kiềm QAROMI ', 'Kiềm '), value: p.quantity }));
  const paymentMix = (d?.paymentStatus ?? []).map((p) => ({ name: PAYMENT_LABEL[p.name] ?? p.name, value: p.value }));
  const bottleDebt = (d?.bottleDebtByCustomer ?? []).map((c) => ({ name: c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name, 'Vỏ Vòi': c.voi, 'Vỏ Úp': c.up }));
  const loanAging = (d?.branchLoanAging ?? []).map((l) => ({ name: l.code, 'Còn lại': l.outstanding }));
  const movements = (d?.movementsSummary ?? []).map((m) => ({ name: m.name, 'Số lượng': m.quantity }));

  const alertColumns: Column<StockItem>[] = [
    { key: 'product_name', header: 'Sản phẩm' },
    { key: 'warehouse_name', header: 'Kho' },
    { key: 'quantity', header: 'Tồn', align: 'right', render: (r) => <b>{r.quantity}</b>, sortValue: (r) => r.quantity },
    { key: 'days_left', header: 'Còn lại', align: 'right', render: (r) => `${r.days_left} ngày`, sortValue: (r) => r.days_left },
    {
      key: 'urgency_level',
      header: 'Mức độ',
      align: 'center',
      render: (r) => (
        <Badge tone={r.urgency_level === 'CRITICAL' ? 'red' : r.urgency_level === 'HIGH' ? 'amber' : 'cyan'}>
          {r.urgency_level === 'CRITICAL' ? 'Cực gấp' : r.urgency_level === 'HIGH' ? 'Cao' : 'Trung bình'}
        </Badge>
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    { key: 'order_code', header: 'Mã đơn', className: 'font-mono font-semibold text-brand-navy' },
    { key: 'customer_name', header: 'Khách hàng' },
    { key: 'total_amount', header: 'Tổng tiền', align: 'right', render: (r) => formatCurrency(r.total_amount) },
    { key: 'payment_status', header: 'Thanh toán', align: 'center', render: (r) => <Badge tone={r.payment_status === 'PAID' ? 'green' : r.payment_status === 'PARTIAL' ? 'amber' : 'red'}>{PAYMENT_LABEL[r.payment_status]}</Badge> },
    { key: 'order_status', header: 'Trạng thái', align: 'center', render: (r) => <span className="text-slate-500">{r.order_status}</span> },
  ];

  return (
    <>
      <PageHeader title="Bảng điều khiển" subtitle={`Tổng hợp điều hành · ${formatMonth(month)}`} />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          tone="navy"
          label="Doanh thu hôm nay"
          value={formatCurrency(kpis?.revenueToday ?? 0)}
          hint={
            <span className={cn('inline-flex items-center gap-1 font-semibold', revenueDelta >= 0 ? 'text-emerald-600' : 'text-brand-red')}>
              {revenueDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {revenueDelta >= 0 ? '+' : ''}
              {revenueDelta}% so với hôm qua
            </span>
          }
        />
        <StatCard icon={ShoppingCart} tone="cyan" label={`Doanh thu ${formatMonth(month)}`} value={formatCurrency(kpis?.revenueMonth ?? 0)} hint={`${formatNumber(kpis?.ordersMonth ?? 0)} đơn hàng`} onClick={() => onNavigate('sales')} />
        <StatCard
          icon={Droplets}
          tone="indigo"
          label="Sản lượng bình xuất"
          value={`${formatNumber(kpis?.bottlesMonth ?? 0)} bình`}
          hint={`RO/Vòi ${formatNumber(kpis?.bottlesVoi ?? 0)} · Úp ${formatNumber(kpis?.bottlesUp ?? 0)}`}
        />
        <StatCard
          icon={Package}
          tone="amber"
          label="Tồn vỏ ngoài thị trường"
          value={`${formatNumber((kpis?.bottleDebtVoi ?? 0) + (kpis?.bottleDebtUp ?? 0))} vỏ`}
          hint={`Vòi ${formatNumber(kpis?.bottleDebtVoi ?? 0)} · Úp ${formatNumber(kpis?.bottleDebtUp ?? 0)}`}
          onClick={() => onNavigate('customers')}
        />
        <StatCard icon={Users} tone="red" label="Công nợ tiền khách hàng" value={formatCurrency(kpis?.totalDebt ?? 0)} hint="Tổng dư nợ hiện tại" onClick={() => onNavigate('customers')} />
        <StatCard icon={Handshake} tone="green" label="Vay mượn chờ hoàn trả" value={`${formatNumber(kpis?.pendingLoans ?? 0)} phiếu`} hint={`${formatNumber(kpis?.overdueLoans ?? 0)} phiếu quá hạn`} onClick={() => onNavigate('branches')} />
        <StatCard icon={Truck} tone="amber" label="Cảnh báo tồn kho" value={`${formatNumber(kpis?.alertCount ?? 0)} mặt hàng`} hint="Dưới ngưỡng tối thiểu" onClick={() => onNavigate('warehouse')} />
        <StatCard icon={Boxes} tone="cyan" label="Lưu chuyển kho trong tháng" value={`${formatNumber((d?.movementsSummary ?? []).reduce((a, m) => a + m.quantity, 0))} lượt`} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard title="Doanh thu theo ngày" subtitle={formatMonth(month)} empty={(d?.revenueByDay ?? []).length === 0}>
            <AreaTrend
              data={(d?.revenueByDay ?? []).map((r) => ({ date: formatDateShort(r.date), revenue: r.revenue, orders: r.orders }))}
              xKey="date"
              currency
              series={[{ key: 'revenue', name: 'Doanh thu', color: '#50ADDE' }]}
            />
          </ChartCard>
        </div>
        <ChartCard title="Cơ cấu thanh toán" subtitle={`${kpis?.ordersMonth ?? 0} đơn trong tháng`} empty={paymentMix.length === 0}>
          <DonutChart data={paymentMix} colors={['#10B981', '#F59E0B', '#C62430']} />
        </ChartCard>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Sản lượng theo mặt hàng" subtitle="Top mặt hàng bán chạy" empty={productMix.length === 0}>
          <DonutChart data={productMix} />
        </ChartCard>
        <ChartCard title="Doanh thu theo kho xuất" subtitle="Phân bổ theo kho/trạm" empty={(d?.revenueByWarehouse ?? []).length === 0}>
          <BarSeries
            data={(d?.revenueByWarehouse ?? []).map((w) => ({ name: w.name.length > 20 ? `${w.name.slice(0, 20)}…` : w.name, 'Doanh thu': w.revenue }))}
            xKey="name"
            currency
            angleLabels
            series={[{ key: 'Doanh thu', name: 'Doanh thu', color: '#2C2C6B' }]}
          />
        </ChartCard>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Doanh số theo nhân viên bán" subtitle="Top 8" empty={(d?.salesBySeller ?? []).length === 0}>
          <BarSeries
            data={(d?.salesBySeller ?? []).map((s) => ({ name: s.name.split(' ').slice(-2).join(' '), 'Doanh số': s.revenue }))}
            xKey="name"
            currency
            angleLabels
            series={[{ key: 'Doanh số', name: 'Doanh số', color: '#50ADDE' }]}
          />
        </ChartCard>
        <ChartCard title="Nợ vỏ bình theo khách hàng" subtitle="Top khách đang giữ vỏ" empty={bottleDebt.length === 0}>
          <BarSeries
            data={bottleDebt}
            xKey="name"
            angleLabels
            series={[
              { key: 'Vỏ Vòi', name: 'Vỏ Vòi (T9)', color: '#2C2C6B', stackId: 'a' },
              { key: 'Vỏ Úp', name: 'Vỏ Úp (T8)', color: '#50ADDE', stackId: 'a' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Hiệu suất giao hàng" subtitle="Bình giao theo shipper" empty={(d?.shipperPerformance ?? []).length === 0}>
          <BarSeries
            data={(d?.shipperPerformance ?? []).map((s) => ({ name: s.name.split(' ').slice(-2).join(' '), 'Bình giao': s.bottles, 'Chuyến': s.trips }))}
            xKey="name"
            angleLabels
            series={[
              { key: 'Bình giao', name: 'Bình giao', color: '#10B981' },
              { key: 'Chuyến', name: 'Chuyến', color: '#F59E0B' },
            ]}
          />
        </ChartCard>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Tiến độ hoàn thành KPI" subtitle="Top nhân viên" empty={(d?.kpiByEmployee ?? []).length === 0}>
          <BarSeries
            data={(d?.kpiByEmployee ?? []).map((k) => ({ name: k.name.split(' ').slice(-2).join(' '), 'Hoàn thành': k.completion }))}
            xKey="name"
            angleLabels
            series={[{ key: 'Hoàn thành', name: '% hoàn thành', color: '#8B5CF6' }]}
          />
        </ChartCard>
        <ChartCard title="Vay mượn chi nhánh chưa hoàn trả" subtitle="Xếp theo hạn trả" empty={loanAging.length === 0}>
          <BarSeries
            data={loanAging}
            xKey="name"
            angleLabels
            series={[{ key: 'Còn lại', name: 'SL còn lại', color: '#F59E0B' }]}
          />
        </ChartCard>
        <ChartCard title="Biến động kho trong tháng" subtitle="Theo loại giao dịch" empty={movements.length === 0}>
          <BarSeries
            data={movements}
            xKey="name"
            angleLabels
            series={[{ key: 'Số lượng', name: 'Số lượng', color: '#2C2C6B' }]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Cảnh báo tồn kho cấp bách"
              subtitle="Mặt hàng dưới ngưỡng tối thiểu"
              action={
                <button onClick={() => onNavigate('warehouse')} className="text-xs font-semibold text-brand-cyan hover:underline">
                  Xem tất cả →
                </button>
              }
            />
            <CardBody className="p-0">
              {alertsApi.loading ? (
                <p className="p-6 text-center text-xs text-slate-400">Đang tải...</p>
              ) : (alertsApi.data?.length ?? 0) === 0 ? (
                <EmptyState icon={Boxes} title="Tồn kho an toàn" message="Không có mặt hàng nào dưới ngưỡng cảnh báo." />
              ) : (
                <DataTable
                  columns={alertColumns}
                  data={alertsApi.data ?? []}
                  rowKey={(r) => r.id}
                  searchable={false}
                  pageSize={5}
                  onRowClick={() => onNavigate('warehouse')}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Đơn hàng gần nhất"
            action={
              <button onClick={() => onNavigate('sales')} className="text-xs font-semibold text-brand-cyan hover:underline">
                Xem tất cả →
              </button>
            }
          />
          <CardBody className="p-0">
            <DataTable columns={orderColumns} data={ordersApi.data ?? []} rowKey={(r) => r.id} searchable={false} pageSize={5} onRowClick={() => onNavigate('sales')} dense />
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Dòng tiền thu - chi" subtitle={formatMonth(month)} empty={(d?.cashFlow ?? []).length === 0}>
          <AreaTrend
            data={(d?.cashFlow ?? []).map((c) => ({ date: formatDateShort(c.date), 'Thu': c.revenue, 'Chi': c.expense }))}
            xKey="date"
            currency
            series={[
              { key: 'Thu', name: 'Thu', color: '#10B981' },
              { key: 'Chi', name: 'Chi', color: '#C62430' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Tồn kho tại Kho Tăng Áp" subtitle="So với ngưỡng cảnh báo" empty={(d?.stockLevels ?? []).length === 0}>
          <BarSeries
            data={(d?.stockLevels ?? []).map((s) => ({ name: s.name.replace('Nước Tinh Khiết RO QAROMI ', 'RO ').replace('Nước Ion Kiềm QAROMI ', 'Kiềm '), 'Tồn': s.quantity, 'Ngưỡng': s.min_stock_alert }))}
            xKey="name"
            angleLabels
            series={[
              { key: 'Tồn', name: 'Tồn hiện tại', color: '#50ADDE' },
              { key: 'Ngưỡng', name: 'Ngưỡng tối thiểu', color: '#C62430' },
            ]}
          />
        </ChartCard>
      </div>

      <p className="mt-4 flex items-center gap-1 text-xs text-slate-400">
        <AlertTriangle className="h-3.5 w-3.5" /> Số liệu tổng hợp trực tiếp từ hệ thống, cập nhật theo thời gian thực.
        <ArrowLeftRight className="ml-2 h-3.5 w-3.5" /> Nhấn vào thẻ để mở phân hệ tương ứng.
      </p>
    </>
  );
}
