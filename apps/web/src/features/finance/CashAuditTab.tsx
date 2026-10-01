import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, formatNumber, todayISO } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import type { CashAuditCustomerRow, CashAuditOrderRow, CashAuditPartnerRow } from '../../types';

const ORDER_TYPE_LABEL: Record<string, string> = {
  SALE: 'Bán hàng',
  LEND_OUT: 'Cho mượn',
  BORROW_IN: 'Mượn về bán',
  HIRED_LOAD: 'Bốc xếp',
};
const PAYMENT_LABEL: Record<string, string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', DEBT: 'Công nợ' };

// Lệch âm = sổ quỹ thiếu so với số đã thu trên đơn (đã thu mà chưa ghi sổ quỹ).
const diffCell = (v: number) => (
  <b className={Math.abs(v) <= 0.5 ? 'text-slate-400' : v < 0 ? 'text-brand-red' : 'text-amber-600'}>
    {Math.abs(v) <= 0.5 ? '—' : formatCurrency(v)}
  </b>
);

const columns: Column<CashAuditOrderRow>[] = [
  { key: 'order_code', header: 'Mã đơn', className: 'font-mono text-xs', sortValue: (r) => r.order_code },
  { key: 'order_date', header: 'Ngày', sortValue: (r) => r.order_date },
  {
    key: 'order_type',
    header: 'Loại đơn',
    render: (r) => ORDER_TYPE_LABEL[r.order_type] ?? r.order_type,
    sortValue: (r) => r.order_type,
  },
  {
    key: 'payment_method',
    header: 'Hình thức',
    render: (r) => PAYMENT_LABEL[r.payment_method] ?? r.payment_method,
    sortValue: (r) => r.payment_method,
  },
  { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
  {
    key: 'paid_amount',
    header: 'Đã thu (đơn)',
    align: 'right',
    render: (r) => formatCurrency(r.paid_amount),
    sortValue: (r) => r.paid_amount,
  },
  {
    key: 'ledger_revenue',
    header: 'Sổ quỹ',
    align: 'right',
    render: (r) => formatCurrency(r.ledger_revenue),
    sortValue: (r) => r.ledger_revenue,
  },
  { key: 'revenue_diff', header: 'Lệch', align: 'right', render: (r) => diffCell(r.revenue_diff), sortValue: (r) => r.revenue_diff },
  {
    key: 'deposit',
    header: 'Cọc vỏ (đơn/sổ)',
    align: 'right',
    render: (r) => (
      <span className={Math.abs(r.deposit_diff) > 0.5 ? 'font-semibold text-brand-red' : ''}>
        {formatCurrency(r.deposit_amount)} / {formatCurrency(r.deposit_collect)}
      </span>
    ),
    sortValue: (r) => r.deposit_diff,
  },
  {
    key: 'issues',
    header: 'Cảnh báo',
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.issues.map((issue) => (
          <Badge key={issue} tone="red">
            {issue}
          </Badge>
        ))}
      </div>
    ),
  },
];

const customerColumns: Column<CashAuditCustomerRow>[] = [
  { key: 'code', header: 'Mã KH', className: 'font-mono text-xs', sortValue: (r) => r.code },
  { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (r) => formatNumber(r.orders), sortValue: (r) => r.orders },
  { key: 'order_total', header: 'Phải thu theo đơn', align: 'right', render: (r) => formatCurrency(r.order_total), sortValue: (r) => r.order_total },
  { key: 'paid_total', header: 'Đã thu', align: 'right', render: (r) => formatCurrency(r.paid_total), sortValue: (r) => r.paid_total },
  { key: 'ledger_total', header: 'Sổ quỹ', align: 'right', render: (r) => formatCurrency(r.ledger_total), sortValue: (r) => r.ledger_total },
  { key: 'revenue_diff', header: 'Lệch sổ quỹ', align: 'right', render: (r) => diffCell(r.revenue_diff), sortValue: (r) => r.revenue_diff },
  { key: 'total_debt', header: 'Tổng nợ', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.total_debt)}</b>, sortValue: (r) => r.total_debt },
  {
    key: 'deposit_balance',
    header: 'Cọc đang giữ',
    align: 'right',
    render: (r) => (r.deposit_balance ? formatCurrency(r.deposit_balance) : <span className="text-slate-400">—</span>),
    sortValue: (r) => r.deposit_balance,
  },
];

const partnerColumns: Column<CashAuditPartnerRow>[] = [
  { key: 'name', header: 'Đối tác', sortValue: (r) => r.name },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (r) => formatNumber(r.orders), sortValue: (r) => r.orders },
  { key: 'fee_total', header: 'Phí giao phải thu', align: 'right', render: (r) => formatCurrency(r.fee_total), sortValue: (r) => r.fee_total },
  { key: 'paid_total', header: 'Đã thu', align: 'right', render: (r) => formatCurrency(r.paid_total), sortValue: (r) => r.paid_total },
  { key: 'receivable', header: 'Còn phải thu', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.receivable)}</b>, sortValue: (r) => r.receivable },
];

export function CashAuditTab() {
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayISO());

  const auditApi = useApi(() => api.fetchCashAudit({ from, to }), [from, to]);
  const totals = auditApi.data?.totals;
  const customerMismatch = auditApi.data?.customer_rows.filter((r) => Math.abs(r.revenue_diff) > 0.5) ?? [];
  const diff = totals?.revenue_diff ?? 0;

  return (
    <>
      <PageHeader
        title="Đối chiếu tiền"
        subtitle="Số tiền đã thu trên đơn phải bằng sổ quỹ. Phí giao của đơn cho mượn và bốc xếp là khoản phải thu đối tác; nợ hàng được theo dõi riêng."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
        <Field label="Từ ngày">
          <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Đã thu theo đơn: <b className="text-slate-800">{formatCurrency(totals?.paid_total ?? 0)}</b>
        </span>
        <span>
          Ghi trong sổ quỹ: <b className="text-slate-800">{formatCurrency(totals?.ledger_total ?? 0)}</b>
        </span>
        <span>
          Lệch:{' '}
          <b className={Math.abs(diff) <= 0.5 ? 'text-emerald-600' : 'text-brand-red'}>
            {formatCurrency(diff)}
          </b>
        </span>
        <span>
          Còn phải thu: <b className="text-brand-navy">{formatCurrency(totals?.receivable ?? 0)}</b>
        </span>
        <span>
          Cọc vỏ đã thu / trên đơn:{' '}
          <b className={Math.abs((totals?.deposit_expected ?? 0) - (totals?.deposit_collect ?? 0)) <= 0.5 ? 'text-slate-800' : 'text-brand-red'}>
            {formatCurrency(totals?.deposit_collect ?? 0)} / {formatCurrency(totals?.deposit_expected ?? 0)}
          </b>
        </span>
        <span>
          <Badge tone={Math.abs(diff) <= 0.5 ? 'green' : 'red'}>{formatNumber(totals?.issue_orders ?? 0)} đơn cần kiểm tra</Badge>
        </span>
      </div>

      <DataTable
        columns={columns}
        data={auditApi.data?.rows ?? []}
        rowKey={(r) => r.order_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm theo mã đơn hoặc khách hàng..."
        initialSortKey="revenue_diff"
        initialSortDir="asc"
        pageSize={20}
        emptyTitle="Khớp toàn bộ"
        emptyMessage="Mọi đơn đã hoàn tất trong kỳ đều khớp giữa số đã thu và sổ quỹ."
      />

      <div className="mb-2 mt-6">
        <h3 className="text-sm font-semibold text-slate-700">Lệch theo khách hàng</h3>
        <p className="text-xs text-slate-400">Chỉ hiện khách có chênh lệch giữa số đã thu trên đơn và sổ quỹ.</p>
      </div>
      <DataTable
        columns={customerColumns}
        data={customerMismatch}
        rowKey={(r) => r.customer_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm theo mã hoặc tên khách hàng..."
        initialSortKey="revenue_diff"
        initialSortDir="asc"
        pageSize={20}
        emptyTitle="Khớp toàn bộ"
        emptyMessage="Không có khách hàng nào lệch sổ quỹ."
      />

      <div className="mb-2 mt-6">
        <h3 className="text-sm font-semibold text-slate-700">Phí giao phải thu đối tác</h3>
      </div>
      <DataTable
        columns={partnerColumns}
        data={auditApi.data?.partner_rows ?? []}
        rowKey={(r) => r.partner_unit_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm đối tác..."
        initialSortKey="receivable"
        initialSortDir="desc"
        pageSize={20}
        emptyTitle="Chưa có phí giao đối tác"
      />
    </>
  );
}
