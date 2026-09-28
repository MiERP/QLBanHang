import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatNumber, todayISO } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import type { ShellAuditCustomerRow, ShellAuditOrderRow, ShellAuditReport, ShellAuditStockRow } from '../../types';

const BOTTLE_LABEL: Record<string, string> = { VOI: 'Vỏ Vòi', UP: 'Vỏ Úp' };
const ORDER_TYPE_LABEL: Record<string, string> = {
  SALE: 'Bán hàng',
  LEND_OUT: 'Cho mượn',
  BORROW_IN: 'Mượn về bán',
  HIRED_LOAD: 'Bốc xếp',
};

const signed = (v: number) =>
  v === 0 ? (
    <span className="text-slate-400">—</span>
  ) : (
    <b className={v > 0 ? 'text-emerald-600' : 'text-brand-red'}>{formatNumber(v)}</b>
  );

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-2 mt-6">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  );
}

const stockColumns: Column<ShellAuditStockRow>[] = [
  {
    key: 'bottle_type',
    header: 'Loại vỏ',
    render: (r) => BOTTLE_LABEL[r.bottle_type] ?? r.bottle_type,
    sortValue: (r) => r.bottle_type,
  },
  { key: 'opening', header: 'Tồn đầu (sổ)', align: 'right', render: (r) => formatNumber(r.opening), sortValue: (r) => r.opening },
  { key: 'period_in', header: 'Nhập', align: 'right', render: (r) => formatNumber(r.period_in), sortValue: (r) => r.period_in },
  { key: 'period_out', header: 'Xuất', align: 'right', render: (r) => formatNumber(r.period_out), sortValue: (r) => r.period_out },
  {
    key: 'closing',
    header: 'Tồn cuối (sổ)',
    align: 'right',
    render: (r) => <b className="text-brand-navy">{formatNumber(r.closing)}</b>,
    sortValue: (r) => r.closing,
  },
  {
    key: 'stock_now',
    header: 'Vỏ xí nghiệp đang giữ',
    align: 'right',
    render: (r) => (r.stock_now < 0 ? <Badge tone="red">{formatNumber(r.stock_now)}</Badge> : formatNumber(r.stock_now)),
    sortValue: (r) => r.stock_now,
  },
  { key: 'diff', header: 'Lệch', align: 'right', render: (r) => signed(r.diff), sortValue: (r) => r.diff },
];

const customerColumns: Column<ShellAuditCustomerRow>[] = [
  { key: 'code', header: 'Mã KH', className: 'font-mono text-xs', sortValue: (r) => r.code },
  { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
  { key: 'debt_voi', header: 'Nợ vỏ Vòi', align: 'right', render: (r) => formatNumber(r.debt_voi), sortValue: (r) => r.debt_voi },
  { key: 'ledger_voi', header: 'Sổ vỏ Vòi', align: 'right', render: (r) => formatNumber(r.ledger_voi), sortValue: (r) => r.ledger_voi },
  { key: 'diff_voi', header: 'Lệch Vòi', align: 'right', render: (r) => signed(r.diff_voi), sortValue: (r) => r.diff_voi },
  { key: 'debt_up', header: 'Nợ vỏ Úp', align: 'right', render: (r) => formatNumber(r.debt_up), sortValue: (r) => r.debt_up },
  { key: 'ledger_up', header: 'Sổ vỏ Úp', align: 'right', render: (r) => formatNumber(r.ledger_up), sortValue: (r) => r.ledger_up },
  { key: 'diff_up', header: 'Lệch Úp', align: 'right', render: (r) => signed(r.diff_up), sortValue: (r) => r.diff_up },
];

const orderColumns: Column<ShellAuditOrderRow>[] = [
  { key: 'order_code', header: 'Mã đơn', className: 'font-mono text-xs', sortValue: (r) => r.order_code },
  { key: 'order_date', header: 'Ngày', sortValue: (r) => r.order_date },
  {
    key: 'order_type',
    header: 'Loại đơn',
    render: (r) => ORDER_TYPE_LABEL[r.order_type] ?? r.order_type,
    sortValue: (r) => r.order_type,
  },
  { key: 'debt_voi', header: 'Nợ vỏ ghi khách (Vòi)', align: 'right', render: (r) => formatNumber(r.debt_voi), sortValue: (r) => r.debt_voi },
  { key: 'debt_up', header: 'Nợ vỏ ghi khách (Úp)', align: 'right', render: (r) => formatNumber(r.debt_up), sortValue: (r) => r.debt_up },
  {
    key: 'out_voi',
    header: 'Sổ vỏ ghi xuất (Vòi)',
    align: 'right',
    render: (r) => (r.out_voi ? formatNumber(r.out_voi) : <Badge tone="red">0</Badge>),
    sortValue: (r) => r.out_voi,
  },
  {
    key: 'out_up',
    header: 'Sổ vỏ ghi xuất (Úp)',
    align: 'right',
    render: (r) => (r.out_up ? formatNumber(r.out_up) : <Badge tone="red">0</Badge>),
    sortValue: (r) => r.out_up,
  },
  { key: 'diff_voi', header: 'Lệch Vòi', align: 'right', render: (r) => signed(r.diff_voi), sortValue: (r) => r.diff_voi },
  { key: 'diff_up', header: 'Lệch Úp', align: 'right', render: (r) => signed(r.diff_up), sortValue: (r) => r.diff_up },
];

const partnerColumns: Column<ShellAuditReport['partners'][number]>[] = [
  { key: 'partner_unit_name', header: 'Đối tác', sortValue: (r) => r.partner_unit_name },
  { key: 'voi', header: 'Vỏ Vòi', align: 'right', render: (r) => formatNumber(r.voi), sortValue: (r) => r.voi },
  { key: 'up', header: 'Vỏ Úp', align: 'right', render: (r) => formatNumber(r.up), sortValue: (r) => r.up },
];

export function ShellAuditTab() {
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayISO());

  const auditApi = useApi(() => api.fetchShellAudit({ from, to }), [from, to]);

  const data = auditApi.data;
  const totals = data?.totals;
  const customerMismatch = data?.customer_rows.filter((r) => r.diff_voi !== 0 || r.diff_up !== 0) ?? [];
  const clean =
    (totals?.negative_types ?? 0) === 0 && (totals?.customer_mismatch ?? 0) === 0 && (totals?.order_mismatch ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Đối chiếu vỏ bình"
        subtitle="Vỏ bình gắn với sản phẩm (Vòi / Úp) và chỉ có hai nơi: khách đang giữ hoặc xí nghiệp đang giữ. Bút toán xuất vỏ và nợ vỏ khách phải khớp nhau."
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
          Khách đang giữ:{' '}
          <b className="text-slate-800">{formatNumber((totals?.customer_voi ?? 0) + (totals?.customer_up ?? 0))}</b>
          <span className="text-xs text-slate-400">
            {' '}
            (Vòi {formatNumber(totals?.customer_voi ?? 0)} · Úp {formatNumber(totals?.customer_up ?? 0)})
          </span>
        </span>
        <span>
          Xí nghiệp đang giữ:{' '}
          <b className={(totals?.stock_now ?? 0) < 0 ? 'text-brand-red' : 'text-slate-800'}>
            {formatNumber(totals?.stock_now ?? 0)}
          </b>
        </span>
        <span>
          Đối tác đang giữ: <b className="text-slate-800">{formatNumber(totals?.partner_total ?? 0)}</b>
        </span>
        {(totals?.negative_types ?? 0) > 0 && <Badge tone="red">{formatNumber(totals?.negative_types ?? 0)} loại vỏ đang âm</Badge>}
        {(totals?.customer_mismatch ?? 0) > 0 && <Badge tone="amber">{formatNumber(totals?.customer_mismatch ?? 0)} khách lệch nợ vỏ</Badge>}
        {(totals?.order_mismatch ?? 0) > 0 && <Badge tone="amber">{formatNumber(totals?.order_mismatch ?? 0)} đơn lệch vỏ</Badge>}
        {clean && <Badge tone="green">Khớp toàn bộ</Badge>}
      </div>

      <SectionTitle
        title="Vỏ xí nghiệp đang giữ ↔ sổ bút toán vỏ"
        note="Tồn cuối (sổ) = tồn đầu + nhập − xuất theo sổ; Lệch = tồn cuối (sổ) − vỏ xí nghiệp đang giữ tại ngày đến. Lệch khác 0 nghĩa là tồn vỏ bị sửa ngoài sổ."
      />
      <DataTable
        columns={stockColumns}
        data={data?.stock_rows ?? []}
        rowKey={(r) => r.bottle_type}
        loading={auditApi.loading}
        searchable={false}
        pageSize={10}
        initialSortKey="bottle_type"
        emptyMessage="Chưa có dữ liệu vỏ"
      />

      <SectionTitle
        title="Nợ vỏ khách ↔ sổ vỏ khách"
        note="Chỉ hiện khách có chênh lệch. Lệch khác 0 nghĩa là nợ vỏ bị sửa trực tiếp (sửa khách hàng / nhập Excel) mà không qua sổ vỏ."
      />
      <DataTable
        columns={customerColumns}
        data={customerMismatch}
        rowKey={(r) => r.customer_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm theo mã hoặc tên khách hàng..."
        pageSize={20}
        emptyTitle="Khớp toàn bộ"
        emptyMessage="Nợ vỏ của mọi khách đều khớp với sổ vỏ khách."
      />

      <SectionTitle
        title="Đơn ghi nợ vỏ cho khách mà sổ vỏ không ghi xuất"
        note="Đơn đã cộng vỏ vào nợ khách nhưng chưa có bút toán xuất vỏ tương ứng. Khi khách trả số vỏ này, xí nghiệp sẽ nhận vỏ chưa từng được ghi xuất."
      />
      <DataTable
        columns={orderColumns}
        data={data?.order_rows ?? []}
        rowKey={(r) => r.order_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm theo mã đơn..."
        pageSize={20}
        emptyTitle="Khớp toàn bộ"
        emptyMessage="Mọi đơn có ghi nợ vỏ đều đã có bút toán xuất vỏ tương ứng."
      />

      {(data?.partners.length ?? 0) > 0 && (
        <>
          <SectionTitle title="Vỏ của mình đang ở đối tác liên kết" note="Dương = đối tác đang giữ vỏ của mình." />
          <DataTable
            columns={partnerColumns}
            data={data?.partners ?? []}
            rowKey={(r) => r.partner_unit_id}
            searchPlaceholder="Tìm đối tác..."
            pageSize={10}
          />
        </>
      )}
    </>
  );
}
