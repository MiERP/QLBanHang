import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { formatCurrency, formatNumber, todayISO } from '../../lib/format';
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
  const { staff, products, reload: reloadRefs } = useReference();
  const toast = useToast();
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayISO());

  const [returnCustomer, setReturnCustomer] = useState<ShellAuditCustomerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [returnForm, setReturnForm] = useState({
    returned_voi: '',
    returned_up: '',
    handled_by: '',
    refund_deposit: '1',
    payment_method: 'CASH',
    note: '',
  });

  const auditApi = useApi(() => api.fetchShellAudit({ from, to }), [from, to]);
  const shellDepositsApi = useApi(() => api.shellDeposits.list(), []);

  // Phí cọc theo loại vỏ: lấy từ danh mục "Cọc vỏ bình", chưa cấu hình thì theo sản phẩm bình đang bán.
  const shellFee = useMemo(() => {
    const feeOf = (type: 'VOI' | 'UP') => {
      const configured = (shellDepositsApi.data ?? []).find((row) => row.bottle_type === type);
      if (configured && Number(configured.deposit_fee) > 0) return Number(configured.deposit_fee);
      const product = (products ?? []).find((p) => p.bottle_type === type && Number(p.deposit_fee) > 0);
      return Number(product?.deposit_fee) || 0;
    };
    return { feeVoi: feeOf('VOI'), feeUp: feeOf('UP') };
  }, [shellDepositsApi.data, products]);

  const openReturn = (row: ShellAuditCustomerRow) => {
    setReturnForm({ returned_voi: '', returned_up: '', handled_by: '', refund_deposit: '1', payment_method: 'CASH', note: '' });
    setReturnCustomer(row);
  };

  const submitReturn = async () => {
    if (!returnCustomer) return;
    const voi = Number(returnForm.returned_voi) || 0;
    const up = Number(returnForm.returned_up) || 0;
    if (!voi && !up) return toast.error('Nhập số vỏ cần thu hồi');
    setSaving(true);
    try {
      const res = await api.returnBottles(returnCustomer.customer_id, {
        returned_voi: voi,
        returned_up: up,
        refund_deposit: returnForm.refund_deposit === '1',
        payment_method: returnForm.payment_method,
        handled_by: returnForm.handled_by ? Number(returnForm.handled_by) : undefined,
        note: returnForm.note,
      });
      toast.success(
        res.deposit_refund
          ? `Đã thu hồi vỏ và hoàn cọc ${formatCurrency(res.deposit_refund)}`
          : 'Đã ghi nhận thu hồi vỏ (không hoàn cọc)'
      );
      setReturnCustomer(null);
      auditApi.reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    } finally {
      setSaving(false);
    }
  };

  const customerColumns: Column<ShellAuditCustomerRow>[] = [
    { key: 'code', header: 'Mã KH', className: 'font-mono text-xs', sortValue: (r) => r.code },
    { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
    { key: 'debt_voi', header: 'Nợ vỏ Vòi', align: 'right', render: (r) => formatNumber(r.debt_voi), sortValue: (r) => r.debt_voi },
    { key: 'ledger_voi', header: 'Sổ vỏ Vòi', align: 'right', render: (r) => formatNumber(r.ledger_voi), sortValue: (r) => r.ledger_voi },
    { key: 'diff_voi', header: 'Lệch Vòi', align: 'right', render: (r) => signed(r.diff_voi), sortValue: (r) => r.diff_voi },
    { key: 'debt_up', header: 'Nợ vỏ Úp', align: 'right', render: (r) => formatNumber(r.debt_up), sortValue: (r) => r.debt_up },
    { key: 'ledger_up', header: 'Sổ vỏ Úp', align: 'right', render: (r) => formatNumber(r.ledger_up), sortValue: (r) => r.ledger_up },
    { key: 'diff_up', header: 'Lệch Úp', align: 'right', render: (r) => signed(r.diff_up), sortValue: (r) => r.diff_up },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (r) =>
        (Number(r.debt_voi) > 0 || Number(r.debt_up) > 0) ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openReturn(r);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Trả vỏ
          </Button>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
  ];

  const data = auditApi.data;
  const totals = data?.totals;
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
        note="Hiện mọi khách có phát sinh vỏ. Lệch khác 0 nghĩa là nợ vỏ bị sửa trực tiếp (sửa khách hàng / nhập Excel) mà không qua sổ vỏ. Dùng “Trả vỏ” để ghi thu hồi ngay tại đây."
      />
      <DataTable
        columns={customerColumns}
        data={data?.customer_rows ?? []}
        rowKey={(r) => r.customer_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm theo mã hoặc tên khách hàng..."
        pageSize={20}
        emptyTitle="Chưa có phát sinh vỏ"
        emptyMessage="Chưa có khách hàng nào có phát sinh vỏ."
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

      <Modal
        open={!!returnCustomer}
        onClose={() => setReturnCustomer(null)}
        size="sm"
        title="Ghi nhận thu hồi vỏ bình"
        subtitle={returnCustomer ? `${returnCustomer.name} · Vòi ${returnCustomer.debt_voi} / Úp ${returnCustomer.debt_up}` : undefined}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setReturnCustomer(null)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitReturn} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận thu hồi'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Số vỏ Vòi trả">
              <Input type="number" value={returnForm.returned_voi} onChange={(e) => setReturnForm({ ...returnForm, returned_voi: e.target.value })} />
            </Field>
            <Field label="Số vỏ Úp trả">
              <Input type="number" value={returnForm.returned_up} onChange={(e) => setReturnForm({ ...returnForm, returned_up: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="rounded-lg border border-slate-200 p-3">
            <FormGrid cols={2}>
              <Field label="Hoàn cọc">
                <Select value={returnForm.refund_deposit} onChange={(e) => setReturnForm({ ...returnForm, refund_deposit: e.target.value })}>
                  <option value="1">Hoàn tiền cọc cho số vỏ trả</option>
                  <option value="0">Không hoàn (đã xử lý ở chỗ khác)</option>
                </Select>
              </Field>
              <Field label="Hình thức hoàn">
                <Select value={returnForm.payment_method} onChange={(e) => setReturnForm({ ...returnForm, payment_method: e.target.value })}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </Select>
              </Field>
            </FormGrid>
            <p className="mt-1 text-right text-[11px] text-slate-500">
              Tiền cọc hoàn theo phí cọc đang áp: Vòi {formatCurrency(shellFee.feeVoi)} · Úp {formatCurrency(shellFee.feeUp)} — tiền hoàn dự
              kiến{' '}
              <b className="text-slate-700">
                {formatCurrency((Number(returnForm.returned_voi) || 0) * shellFee.feeVoi + (Number(returnForm.returned_up) || 0) * shellFee.feeUp)}
              </b>
            </p>
          </div>
          <Field label="Người thu hồi">
            <Select value={returnForm.handled_by} onChange={(e) => setReturnForm({ ...returnForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={returnForm.note} onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
