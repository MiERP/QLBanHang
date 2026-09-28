import { useEffect, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { SubTable, type SubColumn } from '../../components/ui/SubTable';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatMonth, formatNumber } from '../../lib/format';
import { freeShipWithoutShipper } from '../../lib/settings';
import type { ExpenseOrderRow } from '../../types';
import { statusMeta } from '../orders/orderStatus';

type CostMetrics = { trips: number; shipping_fee: number };
type GroupRow = { name: string } & CostMetrics;
type DayRow = { date: string } & CostMetrics;
type MonthRow = { month: string } & CostMetrics;

const costColumns: Column<CostMetrics>[] = [
  { key: 'trips', header: 'Số đơn giao', align: 'center', sortValue: (r) => r.trips },
  {
    key: 'shipping_fee',
    header: 'Phí vận chuyển',
    align: 'right',
    render: (r) => <b className="text-brand-navy">{formatCurrency(r.shipping_fee)}</b>,
    sortValue: (r) => r.shipping_fee,
  },
];

// Nhóm "chưa gán" tô vàng để thấy ngay phần phí ship chưa gán được cho ai.
const nameColumn = (header: string, unassigned: string): Column<GroupRow> => ({
  key: 'name',
  header,
  render: (r) => (r.name === unassigned ? <span className="font-medium text-amber-600">{r.name}</span> : r.name),
  sortValue: (r) => r.name,
});

const employeeColumns: Column<GroupRow>[] = [nameColumn('Nhân viên', 'Chưa gán nhân viên'), ...costColumns];
const unitColumns: Column<GroupRow>[] = [nameColumn('Đơn vị', 'Chưa gán đơn vị'), ...costColumns];

const dayColumns: Column<DayRow>[] = [
  { key: 'date', header: 'Ngày', render: (r) => formatDate(r.date), sortValue: (r) => r.date },
  ...costColumns,
];

const monthColumns: Column<MonthRow>[] = [
  { key: 'month', header: 'Tháng', render: (r) => formatMonth(r.month), sortValue: (r) => r.month },
  ...costColumns,
];

// Cột bảng con khi xổ chi tiết một nhóm — bấm vào đơn để mở đơn hàng.
const drillColumns: SubColumn<ExpenseOrderRow>[] = [
  { key: 'order_code', header: 'Mã đơn', render: (r) => <span className="font-mono font-semibold text-brand-navy">{r.order_code}</span> },
  { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date) },
  { key: 'customer_name', header: 'Khách hàng', render: (r) => r.customer_name },
  { key: 'employee_name', header: 'Nhân viên giao', render: (r) => r.employee_name ?? '—' },
  { key: 'unit_name', header: 'Đơn vị', render: (r) => r.unit_name ?? '—' },
  { key: 'fee', header: 'Phí vận chuyển', align: 'right', render: (r) => formatCurrency(r.fee) },
  {
    key: 'order_status',
    header: 'Trạng thái',
    align: 'center',
    render: (r) => {
      const m = statusMeta(r.order_status);
      return <Badge tone={m.tone}>{m.label}</Badge>;
    },
  },
];

export function ExpensesTab({ month, onOpenOrder }: { month: string; onOpenOrder?: (orderId: number) => void }) {
  const { settings } = useReference();
  const freeShipNoShipper = freeShipWithoutShipper(settings);
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(`${month}-31`);
  const [group, setGroup] = useState('employee');

  useEffect(() => {
    setFrom(`${month}-01`);
    setTo(`${month}-31`);
  }, [month]);

  const { data, loading } = useApi(() => api.fetchExpenseReport({ from, to }), [from, to]);

  // Mọi cách xem đều quy về đơn hàng: xổ một dòng nhóm ra danh sách đơn tương ứng.
  const rows = data?.rows ?? [];
  const expandedOrders = (match: (r: ExpenseOrderRow) => boolean) => (
    <SubTable
      columns={drillColumns}
      rows={rows.filter(match)}
      rowKey={(r, i) => `${r.order_id}-${i}`}
      onRowClick={onOpenOrder ? (r) => onOpenOrder(r.order_id) : undefined}
    />
  );

  return (
    <>
      <PageHeader
        title="Phí vận chuyển"
        subtitle={`Tiền công trả cho nhân viên giao hàng của các đơn đang giao / hoàn tất, tính theo phân bổ người giao trên đơn — ${
          freeShipNoShipper ? 'đơn không gán người giao là đơn miễn ship nên không tính vào đây.' : 'đơn chưa gán người giao được gom riêng.'
        } Xí nghiệp giữ lại khoản này và cuối tháng cộng vào lương.`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <Field label="Từ ngày">
          <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Xem theo">
          <Select dense value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="employee">Nhân viên</option>
            <option value="unit">Đơn vị</option>
            <option value="day">Ngày</option>
            <option value="month">Tháng</option>
          </Select>
        </Field>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Tổng phí vận chuyển: <b className="text-brand-navy">{formatCurrency(data?.totalShipping ?? 0)}</b>
        </span>
        <span>
          Số đơn giao: <b className="text-slate-800">{formatNumber(data?.orderCount ?? 0)}</b>
        </span>
      </div>

      <div className="mb-2 text-xs text-slate-400">
        Bấm vào dòng để xổ ra danh sách đơn hàng tương ứng{onOpenOrder ? ' — bấm vào đơn để mở đơn hàng' : ''}.
      </div>

      {group === 'employee' && (
        <DataTable
          columns={employeeColumns}
          data={data?.byEmployee ?? []}
          rowKey={(r) => r.name}
          loading={loading}
          searchPlaceholder="Tìm nhân viên..."
          pageSize={20}
          renderExpanded={(r) => expandedOrders((o) => (o.employee_name ?? 'Chưa gán nhân viên') === r.name)}
        />
      )}
      {group === 'unit' && (
        <DataTable
          columns={unitColumns}
          data={data?.byUnit ?? []}
          rowKey={(r) => r.name}
          loading={loading}
          searchPlaceholder="Tìm đơn vị..."
          pageSize={20}
          renderExpanded={(r) => expandedOrders((o) => (o.unit_name ?? 'Chưa gán đơn vị') === r.name)}
        />
      )}
      {group === 'day' && (
        <DataTable
          columns={dayColumns}
          data={data?.byDay ?? []}
          rowKey={(r) => r.date}
          loading={loading}
          searchable={false}
          pageSize={31}
          renderExpanded={(r) => expandedOrders((o) => o.order_date === r.date)}
        />
      )}
      {group === 'month' && (
        <DataTable
          columns={monthColumns}
          data={data?.byMonth ?? []}
          rowKey={(r) => r.month}
          loading={loading}
          searchable={false}
          pageSize={24}
          renderExpanded={(r) => expandedOrders((o) => o.order_date.startsWith(r.month))}
        />
      )}
    </>
  );
}
