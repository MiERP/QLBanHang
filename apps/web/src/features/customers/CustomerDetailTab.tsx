import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import type { BottleLedger, Customer, Order, RevenueTransaction } from '../../types';
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

export function CustomerDetailTab() {
  const { staff, products, reload: reloadRefs } = useReference();
  const customersApi = useApi(() => api.customers.list(), []);
  const shellDepositsApi = useApi(() => api.shellDeposits.list(), []);
  const toast = useToast();

  const [selected, setSelected] = useState<Customer | null>(null);
  const [tab, setTab] = useState('overview');
  const [returnOpen, setReturnOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({ payment_method: 'CASH', handled_by: '', note: '' });
  const [writeOffForm, setWriteOffForm] = useState({ shells_voi: '', shells_up: '', reason: 'Vỏ mất', handled_by: '', note: '' });
  const [returnForm, setReturnForm] = useState({
    returned_voi: '',
    returned_up: '',
    handled_by: '',
    refund_deposit: '1',
    payment_method: 'CASH',
    note: '',
  });

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

  const selectedId = selected?.id;
  const ordersApi = useApi(() => (selectedId ? api.fetchOrders({ customer_id: selectedId, limit: 200 }) : Promise.resolve([])), [selectedId]);
  const revenueApi = useApi(() => (selectedId ? api.fetchRevenue({ customer_id: selectedId }) : Promise.resolve([])), [selectedId]);
  const ledgersApi = useApi(() => (selectedId ? api.fetchBottleLedgers(selectedId) : Promise.resolve([])), [selectedId]);

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
          { id: 'bottles', label: 'Nợ vỏ bình' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'overview' && (
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
      )}
      {tab === 'overview' && Math.abs(selected.shell_deposit_diff ?? 0) > 0.5 && (
        <p className="mt-3 text-xs font-semibold text-brand-red">
          Lệch vỏ - cọc: {formatCurrency(selected.shell_deposit_diff ?? 0)} (cọc đang giữ trừ giá trị vỏ khách đang giữ) — khách mất vỏ
          hoặc vỏ chưa thu cọc sẽ hiện ở đây.
        </p>
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

      {tab === 'bottles' && (
        <DataTable
          columns={ledgerColumns}
          data={ledgersApi.data ?? []}
          rowKey={(r) => r.id}
          loading={ledgersApi.loading}
          searchable={false}
          initialSortKey="transaction_date"
          initialSortDir="desc"
          emptyTitle="Chưa có phát sinh vỏ"
          emptyMessage="Khách hàng này chưa có lịch sử vỏ bình."
          toolbar={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReturnForm({ returned_voi: '', returned_up: '', handled_by: '', refund_deposit: '1', payment_method: 'CASH', note: '' });
                  setReturnOpen(true);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Ghi nhận thu hồi vỏ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSettleForm({ payment_method: 'CASH', handled_by: '', note: '' });
                  setSettleOpen(true);
                }}
              >
                Tất toán vỏ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setWriteOffForm({ shells_voi: '', shells_up: '', reason: 'Vỏ mất', handled_by: '', note: '' });
                  setWriteOffOpen(true);
                }}
              >
                Vỏ mất / mua đứt
              </Button>
            </>
          }
        />
      )}

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        size="sm"
        title="Ghi nhận thu hồi vỏ bình"
        subtitle={`${selected.name} · Vòi ${selected.bottle_debt_voi} / Úp ${selected.bottle_debt_up}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.returnBottles(selected.id, returnForm);
                  toast.success(
                    res.deposit_refund
                      ? `Đã thu hồi vỏ và hoàn cọc ${formatCurrency(res.deposit_refund)}`
                      : 'Đã ghi nhận thu hồi vỏ (không hoàn cọc)'
                  );
                  setReturnOpen(false);
                  customersApi.reload();
                  ledgersApi.reload();
                  reloadRefs();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
                }
              }}
            >
              Xác nhận thu hồi
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
                {formatCurrency(
                  (Number(returnForm.returned_voi) || 0) * shellFee.feeVoi + (Number(returnForm.returned_up) || 0) * shellFee.feeUp
                )}
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
      <Modal
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        size="sm"
        title="Tất toán vỏ bình"
        subtitle={`${selected.name} · Vòi ${selected.bottle_debt_voi} / Úp ${selected.bottle_debt_up}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettleOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.settleShells(selected.id, settleForm);
                  toast.success(
                    `Đã thu hồi ${res.shells_voi} vỏ Vòi + ${res.shells_up} vỏ Úp và hoàn cọc ${formatCurrency(res.deposit_refund)}`
                  );
                  setSettleOpen(false);
                  customersApi.reload();
                  ledgersApi.reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Không tất toán được');
                }
              }}
            >
              Xác nhận tất toán
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Hệ thống thu hồi <b>toàn bộ</b> vỏ khách đang giữ, nhập về kho vỏ bình và hoàn lại tiền cọc theo phí cọc đang áp.
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Thu hồi: Vòi <b>{selected.bottle_debt_voi}</b> · Úp <b>{selected.bottle_debt_up}</b> — tiền cọc hoàn dự kiến{' '}
            <b className="text-brand-navy">
              {formatCurrency(selected.bottle_debt_voi * shellFee.feeVoi + selected.bottle_debt_up * shellFee.feeUp)}
            </b>
          </p>
          <Field label="Hình thức hoàn cọc">
            <Select value={settleForm.payment_method} onChange={(e) => setSettleForm({ ...settleForm, payment_method: e.target.value })}>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </Select>
          </Field>
          <Field label="Người thực hiện">
            <Select value={settleForm.handled_by} onChange={(e) => setSettleForm({ ...settleForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={settleForm.note} onChange={(e) => setSettleForm({ ...settleForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={writeOffOpen}
        onClose={() => setWriteOffOpen(false)}
        size="sm"
        title="Vỏ không trả lại"
        subtitle={`${selected.name} · Vòi ${selected.bottle_debt_voi} / Úp ${selected.bottle_debt_up}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setWriteOffOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.writeOffShells(selected.id, writeOffForm);
                  toast.success(`Đã trừ nợ vỏ (còn Vòi ${res.newVoi} · Úp ${res.newUp}) — tiền cọc được giữ lại`);
                  setWriteOffOpen(false);
                  customersApi.reload();
                  ledgersApi.reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Không ghi nhận được');
                }
              }}
            >
              Xác nhận
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Dùng khi khách báo mất vỏ hoặc mua đứt vỏ: nợ vỏ giảm nhưng <b>tiền cọc đã thu được giữ lại</b> (không hoàn).
          </p>
          <FormGrid cols={2}>
            <Field label="Số vỏ Vòi">
              <Input type="number" value={writeOffForm.shells_voi} onChange={(e) => setWriteOffForm({ ...writeOffForm, shells_voi: e.target.value })} />
            </Field>
            <Field label="Số vỏ Úp">
              <Input type="number" value={writeOffForm.shells_up} onChange={(e) => setWriteOffForm({ ...writeOffForm, shells_up: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Lý do">
            <Select value={writeOffForm.reason} onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}>
              <option value="Vỏ mất">Vỏ mất</option>
              <option value="Khách mua đứt">Khách mua đứt</option>
              <option value="Hư hỏng">Hư hỏng</option>
              <option value="Khác">Khác</option>
            </Select>
          </Field>
          <Field label="Người ghi nhận">
            <Select value={writeOffForm.handled_by} onChange={(e) => setWriteOffForm({ ...writeOffForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={writeOffForm.note} onChange={(e) => setWriteOffForm({ ...writeOffForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
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

const ledgerColumns: Column<BottleLedger>[] = [
  { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
  { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code ?? '—' },
  { key: 'borrowed_voi', header: 'Xuất Vòi', align: 'center' },
  { key: 'borrowed_up', header: 'Xuất Úp', align: 'center' },
  { key: 'returned_voi', header: 'Trả Vòi', align: 'center' },
  { key: 'returned_up', header: 'Trả Úp', align: 'center' },
  { key: 'remaining_balance_voi', header: 'Còn Vòi', align: 'center', render: (r) => <b className="text-brand-navy">{r.remaining_balance_voi}</b> },
  { key: 'remaining_balance_up', header: 'Còn Úp', align: 'center', render: (r) => <b className="text-indigo-600">{r.remaining_balance_up}</b> },
  { key: 'handler_name', header: 'Người xử lý', render: (r) => r.handler_name ?? '—' },
];
