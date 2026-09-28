import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SubTable, type SubColumn } from '../../components/ui/SubTable';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatNumber, todayISO } from '../../lib/format';
import { paymentStatusMeta } from '../orders/orderStatus';
import type { CustomerDebtOrderRow, CustomerDebtRow } from '../../types';

interface PayTarget {
  customerName: string;
  order: CustomerDebtOrderRow;
}

// Công nợ khách hàng: nợ đầu kỳ + phần chưa thu của các đơn đã hoàn thành (luỹ kế, không theo tháng).
// Thu nợ ngay tại đây: mỗi lần thu sinh một phiếu thu "Thu nợ" trong sổ quỹ và giảm nợ của đơn.
export function CustomerDebtTab() {
  const { data, loading, reload } = useApi(() => api.fetchCustomerDebts(), []);
  const { staff } = useReference();
  const toast = useToast();

  const [target, setTarget] = useState<PayTarget | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [collectedBy, setCollectedBy] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const totals = data?.totals;

  const openPay = (customerName: string, order: CustomerDebtOrderRow) => {
    setTarget({ customerName, order });
    setAmount(String(order.outstanding));
    setPaymentMethod('CASH');
    setCollectedBy('');
    setTransactionDate(todayISO());
    setNote('');
  };

  const submitPay = async () => {
    if (!target) return;
    const value = Number(amount) || 0;
    if (value <= 0) return toast.error('Nhập số tiền thu');
    if (value > target.order.outstanding + 0.5) return toast.error(`Số tiền vượt số còn lại (${formatCurrency(target.order.outstanding)})`);
    setSaving(true);
    try {
      const res = await api.collectOrderPayment(target.order.order_id, {
        amount: value,
        payment_method: paymentMethod,
        transaction_date: transactionDate,
        collected_by: collectedBy ? Number(collectedBy) : undefined,
        note,
      });
      toast.success(
        res.payment_status === 'PAID'
          ? `Đã thu đủ đơn ${target.order.order_code}`
          : `Đã thu ${formatCurrency(value)} — còn lại ${formatCurrency(res.remaining)}`
      );
      setTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thu được tiền');
    } finally {
      setSaving(false);
    }
  };

  const orderColumns: SubColumn<CustomerDebtOrderRow>[] = [
    { key: 'order_code', header: 'Mã đơn', render: (r) => <span className="font-mono font-semibold text-brand-navy">{r.order_code}</span> },
    { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date) },
    { key: 'order_type', header: 'Loại đơn', render: (r) => (r.order_type === 'BORROW_IN' ? 'Mượn hàng về bán' : 'Bán hàng') },
    { key: 'total_amount', header: 'Tổng đơn', align: 'right', render: (r) => formatCurrency(r.total_amount) },
    { key: 'paid_amount', header: 'Đã thu', align: 'right', render: (r) => (r.paid_amount ? formatCurrency(r.paid_amount) : '—') },
    { key: 'outstanding', header: 'Còn lại', align: 'right', render: (r) => <b className="text-brand-red">{formatCurrency(r.outstanding)}</b> },
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
      header: 'Thu tiền',
      align: 'center',
      render: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openPay(String(r.order_code), r);
          }}
        >
          Thu tiền
        </Button>
      ),
    },
  ];

  const columns: Column<CustomerDebtRow>[] = [
    {
      key: 'name',
      header: 'Khách hàng',
      render: (r) => (
        <span className="flex items-center gap-2">
          <b className="text-brand-navy">{r.name}</b>
          {r.max_debt_limit > 0 && r.total_debt > r.max_debt_limit && <Badge tone="red">Vượt hạn mức</Badge>}
        </span>
      ),
      sortValue: (r) => r.name,
    },
    { key: 'code', header: 'Mã', className: 'font-mono', render: (r) => r.code, sortValue: (r) => r.code },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone || '—', sortValue: (r) => r.phone ?? '' },
    {
      key: 'orders',
      header: 'Số đơn nợ',
      align: 'center',
      render: (r) => formatNumber(r.orders.length),
      sortValue: (r) => r.orders.length,
    },
    { key: 'opening_debt', header: 'Nợ đầu kỳ', align: 'right', render: (r) => (r.opening_debt ? formatCurrency(r.opening_debt) : '—'), sortValue: (r) => r.opening_debt },
    { key: 'order_debt', header: 'Nợ theo đơn', align: 'right', render: (r) => formatCurrency(r.order_debt), sortValue: (r) => r.order_debt },
    {
      key: 'total_debt',
      header: 'Tổng nợ',
      align: 'right',
      render: (r) => <b className="text-brand-red">{formatCurrency(r.total_debt)}</b>,
      sortValue: (r) => r.total_debt,
    },
    { key: 'max_debt_limit', header: 'Hạn mức', align: 'right', render: (r) => (r.max_debt_limit ? formatCurrency(r.max_debt_limit) : '—'), sortValue: (r) => r.max_debt_limit },
  ];

  return (
    <>
      <PageHeader
        title="Công nợ khách hàng"
        subtitle="Tiền khách còn nợ = nợ đầu kỳ + phần chưa thu của các đơn đã hoàn thành — luỹ kế tới nay."
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open(api.customerDebtExportUrl(), '_blank')}>
            <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Tổng còn phải thu</p>
          <p className="text-lg font-bold text-brand-red">{formatCurrency(totals?.total_debt ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Vượt hạn mức</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrency(totals?.over_limit_amount ?? 0)}</p>
          <p className="text-xs text-slate-400">{formatNumber(totals?.over_limit_customers ?? 0)} khách</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Khách đang nợ</p>
          <p className="text-lg font-bold text-slate-800">{formatNumber(totals?.customers ?? 0)}</p>
          <p className="text-xs text-slate-400">{formatNumber(totals?.orders ?? 0)} đơn chưa thu đủ</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Nợ đầu kỳ / nợ theo đơn</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(totals?.opening_debt ?? 0)}</p>
          <p className="text-xs text-slate-400">theo đơn: {formatCurrency(totals?.order_debt ?? 0)}</p>
        </div>
      </div>

      <div className="mb-2 text-xs text-slate-400">
        Bấm vào dòng để xổ ra từng đơn còn nợ và <b>Thu tiền</b> (mỗi lần thu sinh phiếu thu "Thu nợ" trong sổ quỹ).
      </div>

      <DataTable
        columns={columns}
        data={data?.byCustomer ?? []}
        rowKey={(r) => r.customer_id}
        loading={loading}
        searchPlaceholder="Tìm theo khách hàng, mã, điện thoại..."
        initialSortKey="total_debt"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage="Không có khách hàng nào đang nợ tiền"
        renderExpanded={(r) => <SubTable columns={orderColumns} rows={r.orders} rowKey={(o) => o.order_id} />}
      />

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        size="lg"
        title={target ? `Thu tiền đơn ${target.order.order_code}` : ''}
        subtitle={target ? `${target.customerName} · còn lại ${formatCurrency(target.order.outstanding)}` : ''}
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
              Tổng đơn <b>{formatCurrency(target.order.total_amount)}</b> · đã thu <b>{formatCurrency(target.order.paid_amount)}</b> · còn lại{' '}
              <b className="text-brand-red">{formatCurrency(target.order.outstanding)}</b>
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
