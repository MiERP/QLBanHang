import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import type { TabId } from '../../layout';
import type { Customer, Order, RevenueTransaction } from '../../types';
import { paymentStatusMeta, statusMeta } from '../orders/orderStatus';

const REV_TYPE: Record<string, string> = {
  WATER_SALE: 'Bán nước',
  BOTTLE_DEPOSIT: 'Cọc vỏ',
  DEBT_COLLECTION: 'Thu nợ',
  SALE_REFUND: 'Hoàn tiền hàng trả',
  DVGT_SERVICE: 'DVGT',
  BRANCH_OFFSET: 'Bù trừ',
  OTHER: 'Khác',
};

// Nợ tiền của khách = nợ đầu kỳ + phần chưa thu của các đơn đã hoàn thành (API trả sẵn ở `total_debt`).
const customerDebt = (customer: Customer) => customer.total_debt ?? customer.current_debt;

// Chi tiết khách hàng: đơn hàng + công nợ tiền. Quản lý & thao tác vỏ bình / cọc vỏ nằm ở màn
// "Vỏ bình & cọc" (Báo cáo) — nút "Quản lý vỏ & cọc" ở tab Tổng quan dẫn sang đó.
export function CustomerDetailTab({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const customersApi = useApi(() => api.customers.list(), []);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [tab, setTab] = useState('overview');

  const selectedId = selected?.id;
  const ordersApi = useApi(() => (selectedId ? api.fetchOrders({ customer_id: selectedId, limit: 200 }) : Promise.resolve([])), [selectedId]);
  const revenueApi = useApi(() => (selectedId ? api.fetchRevenue({ customer_id: selectedId }) : Promise.resolve([])), [selectedId]);

  if (!selected) {
    return (
      <>
        <PageHeader title="Chi tiết khách hàng" subtitle="Chọn một khách hàng để xem đơn hàng, công nợ và nợ vỏ" />
        <DataTable
          columns={listColumns}
          data={customersApi.data ?? []}
          rowKey={(r) => r.id}
          loading={customersApi.loading}
          onRowClick={(c) => {
            setSelected(c);
            setTab('overview');
          }}
          searchPlaceholder="Tìm theo mã, tên, điện thoại..."
          initialSortKey="code"
        />
      </>
    );
  }

  // Doanh thu của khách = giá trị các đơn đã HOÀN TẤT VÀ ĐÃ XUẤT HÓA ĐƠN (đúng quy tắc doanh thu cuối kỳ) trừ phần hàng hoàn.
  // Không tính đơn nháp / đã hủy / đơn cho đối tác mượn; giá trị là tiền hàng.
  const completedOrders = (ordersApi.data ?? []).filter(
    (o) =>
      (o.order_status === 'COMPLETED' || o.order_status === 'RETURNED') &&
      (o.order_type === 'SALE' || o.order_type === 'BORROW_IN') &&
      o.invoice_status === 'INVOICED'
  );
  const totalRevenue = completedOrders.reduce(
    (a, o) => a + (Number(o.subtotal_amount) || 0) - (Number(o.returned_value) || 0),
    0
  );
  const totalOrders = ordersApi.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title={`Chi tiết khách hàng: ${selected.name}`}
        subtitle={`${selected.code} · ${selected.group_name ?? 'Chưa phân nhóm'}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoCard label="Điện thoại" value={selected.phone || '—'} />
        <InfoCard label="Người liên hệ" value={selected.contact_person || '—'} />
        <InfoCard label="Mã số thuế" value={selected.tax_code || '—'} />
        <InfoCard label="Địa chỉ" value={selected.address} />
      </div>

      <Tabs
        items={[
          { id: 'overview', label: 'Tổng quan' },
          { id: 'orders', label: 'Đơn hàng', badge: totalOrders },
          { id: 'debt', label: 'Công nợ tiền' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Nợ tiền" value={formatCurrency(customerDebt(selected))} danger={customerDebt(selected) > selected.max_debt_limit} />
            <StatCard label="Hạn mức" value={formatCurrency(selected.max_debt_limit)} />
            <StatCard label="Nợ vỏ Vòi" value={String(selected.bottle_debt_voi)} />
            <StatCard label="Nợ vỏ Úp" value={String(selected.bottle_debt_up)} />
            <StatCard
              label="Giá trị vỏ đang giữ"
              value={formatCurrency(selected.shell_value ?? 0)}
              danger={Math.abs(selected.shell_deposit_diff ?? 0) > 0.5}
            />
            <StatCard
              label="Cọc vỏ đang giữ"
              value={formatCurrency(selected.deposit_balance ?? 0)}
              danger={Math.abs(selected.shell_deposit_diff ?? 0) > 0.5}
            />
            <StatCard label="Doanh thu (đơn đã xuất HĐ)" value={formatCurrency(totalRevenue)} />
            <StatCard label="Số đơn (200 gần nhất)" value={formatNumber(totalOrders)} />
          </div>

          {Math.abs(selected.shell_deposit_diff ?? 0) > 0.5 && (
            <p className="text-xs font-semibold text-brand-red">
              Lệch vỏ - cọc: {formatCurrency(selected.shell_deposit_diff ?? 0)} (cọc đang giữ trừ giá trị vỏ khách đang giữ) — khách mất vỏ
              hoặc vỏ chưa thu cọc sẽ hiện ở đây.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Vỏ bình &amp; cọc vỏ của khách</p>
              <p className="text-xs text-slate-500">
                Nợ vỏ: {selected.bottle_debt_voi} Vòi · {selected.bottle_debt_up} Úp — cọc đang giữ{' '}
                {formatCurrency(selected.deposit_balance ?? 0)}. Thao tác thu hồi, tất toán, vỏ mất / mua đứt ở màn Vỏ bình &amp; cọc.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.('shell-deposits')}>
              Quản lý vỏ &amp; cọc
            </Button>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <DataTable
          columns={orderColumns}
          data={ordersApi.data ?? []}
          rowKey={(r) => r.id}
          loading={ordersApi.loading}
          searchable={false}
          initialSortKey="order_code"
          initialSortDir="desc"
          emptyTitle="Chưa có đơn hàng"
          emptyMessage="Khách hàng này chưa có đơn hàng nào."
        />
      )}

      {tab === 'debt' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-sm text-slate-500">Công nợ hiện tại:</span>
            <b className={customerDebt(selected) > selected.max_debt_limit ? 'text-lg text-brand-red' : 'text-lg text-brand-navy'}>
              {formatCurrency(customerDebt(selected))}
            </b>
            <span className="text-xs text-slate-400">/ hạn mức {formatCurrency(selected.max_debt_limit)}</span>
            <span className="text-xs text-slate-400">
              (nợ đầu kỳ {formatCurrency(selected.current_debt)} · nợ theo đơn {formatCurrency(selected.order_debt ?? 0)})
            </span>
          </div>
          <DataTable
            columns={revenueColumns}
            data={revenueApi.data ?? []}
            rowKey={(r) => r.id}
            loading={revenueApi.loading}
            searchable={false}
            initialSortKey="transaction_date"
            initialSortDir="desc"
            emptyTitle="Chưa có phiếu thu"
            emptyMessage="Khách hàng này chưa có phiếu thu nào."
          />
        </div>
      )}
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function StatCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${danger ? 'text-brand-red' : 'text-brand-navy'}`}>{value}</p>
    </div>
  );
}

const listColumns: Column<Customer>[] = [
  { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
  { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
  { key: 'group_name', header: 'Nhóm', render: (r) => r.group_name ?? '—' },
  { key: 'phone', header: 'Điện thoại', render: (r) => r.phone || '—' },
  { key: 'total_debt', header: 'Nợ tiền', align: 'right', render: (r) => formatCurrency(customerDebt(r)), sortValue: (r) => customerDebt(r) },
  { key: 'bottle_debt_voi', header: 'Vỏ Vòi', align: 'center' },
  { key: 'bottle_debt_up', header: 'Vỏ Úp', align: 'center' },
];

const orderColumns: Column<Order>[] = [
  { key: 'order_code', header: 'Mã đơn', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.order_code },
  { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
  { key: 'total_amount', header: 'Tổng tiền', align: 'right', render: (r) => formatCurrency(r.total_amount), sortValue: (r) => r.total_amount },
  {
    key: 'payment_status',
    header: 'Thanh toán',
    align: 'center',
    render: (r) => {
      const m = paymentStatusMeta(r.payment_status);
      return <Badge tone={m.tone}>{m.label}</Badge>;
    },
  },
  {
    key: 'order_status',
    header: 'Trạng thái',
    align: 'center',
    render: (r) => {
      const m = statusMeta(r.order_status);
      return <Badge tone={m.tone}>{m.label}</Badge>;
    },
  },
  {
    key: 'invoice_status',
    header: 'Hóa đơn',
    align: 'center',
    render: (r) => (r.invoice_status === 'INVOICED' ? <Badge tone="green">Đã xuất HĐ</Badge> : <Badge tone="amber">Chưa xuất HĐ</Badge>),
  },
];

const revenueColumns: Column<RevenueTransaction>[] = [
  { key: 'transaction_code', header: 'Mã phiếu', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.transaction_code },
  { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
  { key: 'transaction_type', header: 'Loại', render: (r) => REV_TYPE[r.transaction_type] ?? r.transaction_type },
  { key: 'amount', header: 'Số tiền', align: 'right', render: (r) => formatCurrency(r.amount), sortValue: (r) => r.amount },
  { key: 'payment_method', header: 'Hình thức', render: (r) => (r.payment_method === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt') },
  { key: 'collected_by_name', header: 'Người thu', render: (r) => r.collected_by_name ?? '—' },
];
