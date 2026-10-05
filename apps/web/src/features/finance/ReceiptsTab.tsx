import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, todayISO } from '../../lib/format';
import { paymentStatusMeta } from '../orders/orderStatus';
import type { CustomerDebtOrderRow, RevenueTransaction } from '../../types';

const REV_TYPE: Record<string, string> = {
  WATER_SALE: 'Bán nước',
  BOTTLE_DEPOSIT: 'Cọc vỏ',
  DEBT_COLLECTION: 'Thu nợ',
  SALE_REFUND: 'Hoàn tiền hàng trả',
  DVGT_SERVICE: 'DVGT',
  BRANCH_OFFSET: 'Bù trừ',
  OTHER: 'Khác',
};

type OutstandingRow = CustomerDebtOrderRow & { customer_name: string };

// Danh sách phiếu thu: "Đã thanh toán" = phiếu thu phát sinh trong kỳ báo cáo; "Chưa thanh toán" = đơn còn nợ lũy kế.
export function ReceiptsTab() {
  const { staff, reportPeriod } = useReference();
  const toast = useToast();

  const from = reportPeriod?.from ?? `${todayISO().slice(0, 7)}-01`;
  const to = reportPeriod?.to ?? todayISO();
  const revenueApi = useApi(() => api.fetchRevenue({ from, to }), [from, to]);
  const debtApi = useApi(() => api.fetchCustomerDebts(), []);

  const paid = revenueApi.data ?? [];
  const outstanding: OutstandingRow[] = (debtApi.data?.byCustomer ?? []).flatMap((c) =>
    c.orders.map((o) => ({ ...o, customer_name: c.name }))
  );

  const [tab, setTab] = useState<'paid' | 'outstanding'>('paid');
  const [target, setTarget] = useState<OutstandingRow | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [collectedBy, setCollectedBy] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const openPay = (row: OutstandingRow) => {
    setTarget(row);
    setAmount(String(row.outstanding));
    setPaymentMethod('CASH');
    setCollectedBy('');
    setTransactionDate(todayISO());
    setNote('');
  };

  const submitPay = async () => {
    if (!target) return;
    const value = Number(amount) || 0;
    if (value <= 0) return toast.error('Nhập số tiền thu');
    if (value > target.outstanding + 0.5) return toast.error(`Số tiền vượt số còn lại (${formatCurrency(target.outstanding)})`);
    setSaving(true);
    try {
      const res = await api.collectOrderPayment(target.order_id, {
        amount: value,
        payment_method: paymentMethod,
        transaction_date: transactionDate,
        collected_by: collectedBy ? Number(collectedBy) : undefined,
        note,
      });
      toast.success(
        res.payment_status === 'PAID'
          ? `Đã thu đủ đơn ${target.order_code}`
          : `Đã thu ${formatCurrency(value)} — còn lại ${formatCurrency(res.remaining)}`
      );
      setTarget(null);
      revenueApi.reload();
      debtApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thu được tiền');
    } finally {
      setSaving(false);
    }
  };

  const paidColumns: Column<RevenueTransaction>[] = [
    { key: 'transaction_code', header: 'Mã phiếu', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.transaction_code },
    { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
    { key: 'transaction_type', header: 'Loại', render: (r) => REV_TYPE[r.transaction_type] ?? r.transaction_type },
    { key: 'customer_name', header: 'Khách hàng', render: (r) => r.customer_name ?? '—' },
    { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code ?? '—' },
    { key: 'amount', header: 'Số tiền', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.amount)}</b>, sortValue: (r) => r.amount },
    { key: 'payment_method', header: 'Hình thức', render: (r) => (r.payment_method === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt') },
    { key: 'collected_by_name', header: 'Người thu', render: (r) => r.collected_by_name ?? '—' },
  ];

  const outstandingColumns: Column<OutstandingRow>[] = [
    { key: 'order_code', header: 'Mã đơn', render: (r) => <span className="font-mono font-semibold text-brand-navy">{r.order_code}</span> },
    { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'order_type', header: 'Loại đơn', render: (r) => (r.order_type === 'BORROW_IN' ? 'Mượn hàng về bán' : 'Bán hàng') },
    { key: 'total_amount', header: 'Tổng đơn', align: 'right', render: (r) => formatCurrency(r.total_amount), sortValue: (r) => r.total_amount },
    { key: 'paid_amount', header: 'Đã thu', align: 'right', render: (r) => (r.paid_amount ? formatCurrency(r.paid_amount) : '—'), sortValue: (r) => r.paid_amount },
    { key: 'outstanding', header: 'Còn lại', align: 'right', render: (r) => <b className="text-brand-red">{formatCurrency(r.outstanding)}</b>, sortValue: (r) => r.outstanding },
    {
      key: 'payment_status',
      header: 'Thanh toán',
      align: 'center',
      render: (r) => {
        const meta = paymentStatusMeta(r.payment_status);
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openPay(r); }}>
          Thanh toán
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Phiếu thu"
        subtitle="Phiếu thu đã thanh toán trong kỳ báo cáo · đơn chưa thanh toán hiển thị lũy kế từ các kỳ trước."
      />

      <Tabs
        className="mb-4"
        items={[
          { id: 'paid', label: `Đã thanh toán (${paid.length})` },
          { id: 'outstanding', label: `Chưa thanh toán (${outstanding.length})` },
        ]}
        value={tab}
        onChange={(v) => setTab(v as 'paid' | 'outstanding')}
      />

      {tab === 'paid' ? (
        <>
          <div className="mb-3 text-sm text-slate-600">
            Tổng đã thu trong kỳ:{' '}
            <b className="text-brand-navy">{formatCurrency(paid.reduce((a, r) => a + (Number(r.amount) || 0), 0))}</b>
          </div>
          <DataTable
            columns={paidColumns}
            data={paid}
            rowKey={(r) => r.id}
            loading={revenueApi.loading}
            searchPlaceholder="Tìm theo mã phiếu, khách hàng..."
            initialSortKey="transaction_date"
            initialSortDir="desc"
            pageSize={20}
            emptyMessage="Chưa có phiếu thu nào trong kỳ"
          />
        </>
      ) : (
        <>
          <div className="mb-3 text-sm text-slate-600">
            Còn phải thu (lũy kế):{' '}
            <b className="text-brand-red">{formatCurrency(outstanding.reduce((a, r) => a + (Number(r.outstanding) || 0), 0))}</b>
          </div>
          <DataTable
            columns={outstandingColumns}
            data={outstanding}
            rowKey={(r) => r.order_id}
            loading={debtApi.loading}
            searchPlaceholder="Tìm theo mã đơn, khách hàng..."
            initialSortKey="outstanding"
            initialSortDir="desc"
            pageSize={20}
            emptyMessage="Không còn đơn nào chưa thanh toán"
          />
        </>
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        size="lg"
        title={target ? `Thu tiền đơn ${target.order_code}` : ''}
        subtitle={target ? `${target.customer_name} · còn lại ${formatCurrency(target.outstanding)}` : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setTarget(null)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitPay} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận thu'}
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
              Tổng đơn <b>{formatCurrency(target.total_amount)}</b> · đã thu <b>{formatCurrency(target.paid_amount)}</b> · còn lại{' '}
              <b className="text-brand-red">{formatCurrency(target.outstanding)}</b>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số tiền thu">
                <Input dense type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Hình thức">
                <Select dense value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </Select>
              </Field>
              <Field label="Ngày thu">
                <Input dense type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
              </Field>
              <Field label="Người thu" hint="Để trống = nhân viên bán của đơn">
                <Select dense value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)}>
                  <option value="">-- Theo đơn --</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Ghi chú">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: khách chuyển khoản trả nợ tháng 9" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
