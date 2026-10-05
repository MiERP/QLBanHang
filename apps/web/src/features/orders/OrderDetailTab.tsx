import { ArrowLeft, Pencil, Plus, Receipt, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import { freeShipWithoutShipper } from '../../lib/settings';
import type { Order } from '../../types';
import { OrderForm } from './OrderForm';
import { ReturnModal } from './ReturnModal';
import { ORDER_ACTION_LABEL, ORDER_TYPE_LABEL, nextStatuses, paymentStatusMeta, splitShippingFee, statusMeta } from './orderStatus';

export function OrderDetailTab({ order, onBack, onChanged }: { order: Order; onBack: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { staff, settings } = useReference();
  const freeShipNoShipper = freeShipWithoutShipper(settings);
  const [editing, setEditing] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('CASH');
  const [busy, setBusy] = useState(false);
  const [shippers, setShippers] = useState<{ employee_id: number; allocated_fee: number }[]>([]);
  const [addShipperId, setAddShipperId] = useState('');
  const [savingShippers, setSavingShippers] = useState(false);

  const meta = statusMeta(order.order_status);
  const payment = paymentStatusMeta(order.payment_status);
  // Vòng đời đơn hàng do TRẠNG THÁI ĐƠN quyết định: chỉ Nháp / Đã tạo đơn mới sửa được.
  const isCompleted = order.order_status === 'COMPLETED';
  const canEdit = order.order_status === 'DRAFT' || order.order_status === 'CONFIRMED';
  const invoiced = order.invoice_status === 'INVOICED';
  // Chỉ đơn có bán hàng (bán, mượn vào rồi bán cho khách) mới xuất hóa đơn hàng hóa — và phải thanh toán đủ.
  const canInvoice = (order.order_type === 'SALE' || order.order_type === 'BORROW_IN') && isCompleted && !invoiced && order.payment_status === 'PAID';
  // Đơn đã xuất kho không sửa được ở form, nhưng vẫn phải gán được người giao để phân bổ phí ship.
  // Đơn đã giao hoàn tất mới ghi nhận hàng hoàn; đơn đã xuất hóa đơn thì không cho hoàn.
  const canReturn =
    (order.order_type === 'SALE' || order.order_type === 'BORROW_IN') &&
    order.order_status === 'COMPLETED' &&
    order.invoice_status !== 'INVOICED';
  const canAssignShippers = (order.order_type !== 'BORROW_IN' || Number(order.shipping_fee) > 0) && (order.order_status === 'SHIPPING' || isCompleted);
  const freightOnly = order.order_type === 'LEND_OUT' || order.order_type === 'HIRED_LOAD';
  const refunded = (order.return_history ?? []).reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
  const collectible = freightOnly ? Number(order.shipping_fee) || 0 : Math.max(0, (Number(order.total_amount) || 0) - (Number(order.returned_value) || 0));
  const remaining = Math.max(0, collectible - ((Number(order.paid_amount) || 0) - refunded));
  const canCollect = (isCompleted || order.order_status === 'RETURNED') && remaining > 0.5;

  useEffect(() => {
    setShippers((order.shippers ?? []).map((s) => ({ employee_id: s.employee_id, allocated_fee: s.allocated_fee })));
  }, [order]);

  const employeeName = (id: number) => staff.find((s) => s.id === id)?.full_name ?? `#${id}`;

  const splitEven = (list: { employee_id: number; allocated_fee: number }[]) => splitShippingFee(list, Number(order.shipping_fee) || 0);

  const saveShippers = async () => {
    if (!freeShipNoShipper && !shippers.length) return toast.error('Chọn nhân viên vận chuyển');
    setSavingShippers(true);
    try {
      await api.updateOrderShippers(order.id, shippers);
      toast.success('Đã lưu người giao của đơn hàng');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được người giao');
    } finally {
      setSavingShippers(false);
    }
  };

  const changeStatus = async (status: string) => {
    setBusy(true);
    try {
      await api.updateOrderStatus(order.id, status);
      toast.success('Đã cập nhật trạng thái đơn hàng');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không đổi được trạng thái');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    const ok = await confirm({
      title: 'Hủy đơn hàng',
      message: `Hủy đơn ${order.order_code}? Hệ thống sẽ hoàn kho và đảo sổ sách liên quan theo trạng thái hiện tại.`,
      danger: true,
      confirmLabel: 'Hủy đơn',
    });
    if (!ok) return;
    await changeStatus('CANCELLED');
  };

  const issueInvoice = async () => {
    const ok = await confirm({
      title: 'Xuất hóa đơn',
      message: `Xuất hóa đơn cho đơn ${order.order_code}? Đây là thao tác một lần cho đơn đã hoàn tất.`,
      confirmLabel: 'Xuất hóa đơn',
    });
    if (!ok) return;
    try {
      const res = await api.createInvoice({ order_id: order.id });
      toast.success(`Đã xuất hóa đơn ${res.invoiceCode}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xuất được hóa đơn');
    }
  };

  const collectPayment = async () => {
    const amount = Math.round(Number(collectAmount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.5) return toast.error('Số tiền thu không hợp lệ');
    setBusy(true);
    try {
      await api.collectOrderPayment(order.id, { amount, payment_method: collectMethod });
      toast.success('Đã ghi phiếu thu và cập nhật công nợ');
      setCollectOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không ghi được phiếu thu');
    } finally {
      setBusy(false);
    }
  };

  // Nút hành động lấy trực tiếp từ bảng chuyển trạng thái dùng chung (Hoàn tất = không còn hành động).
  const nextActions = nextStatuses(order.order_status);

  return (
    <>
      <PageHeader
        title={`Đơn ${order.order_code}`}
        subtitle={`${order.customer_name} · ${ORDER_TYPE_LABEL[order.order_type ?? 'SALE']} · ${formatCurrency(order.total_amount)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Badge tone={payment.tone}>{payment.label}</Badge>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Danh sách
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-slate-500">Tổng phải thanh toán</span>
          <b className="ml-2 text-brand-navy">{formatCurrency(order.total_amount)}</b>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-slate-500">Đã thu</span>
          <b className="ml-2 text-emerald-700">{formatCurrency(order.paid_amount)}</b>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-amber-700">Còn phải thu</span>
          <b className="ml-2 text-amber-800">{formatCurrency(order.outstanding_amount ?? remaining)}</b>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {nextActions.map((s) =>
          s === 'CANCELLED' ? (
            <Button key={s} variant="danger" size="sm" onClick={cancelOrder} disabled={busy}>
              {ORDER_ACTION_LABEL[s]}
            </Button>
          ) : (
            <Button key={s} variant="success" size="sm" onClick={() => changeStatus(s)} disabled={busy}>
              {ORDER_ACTION_LABEL[s]}
            </Button>
          )
        )}
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Sửa đơn
          </Button>
        )}
        {/* Hóa đơn chỉ sinh từ đơn đã HOÀN TẤT; chuyển "chưa xuất -> đã xuất" do người dùng bấm tay. */}
        {canInvoice && (
          <Button variant="outline" size="sm" onClick={issueInvoice}>
            <Receipt className="h-4 w-4" /> Xuất hóa đơn
          </Button>
        )}
        {/* Hàng hoàn toàn bộ chỉ thực hiện một lần từ đơn đã hoàn tất. */}
        {canReturn && (
          <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Hàng hoàn
          </Button>
        )}
        {canCollect && (
          <Button variant="outline" size="sm" onClick={() => { setCollectAmount(String(Math.round(remaining))); setCollectOpen(true); }}>
            <Receipt className="h-4 w-4" /> {freightOnly ? 'Thu phí giao đối tác' : 'Thu tiền đơn'}
          </Button>
        )}
        {isCompleted && (
          <span className="text-xs text-slate-400">
            {invoiced
              ? 'Đơn đã hoàn tất và đã xuất hóa đơn — không ghi nhận hàng hoàn được.'
              : order.payment_status === 'PAID'
                ? 'Đơn đã hoàn tất và thanh toán đủ — có thể xuất hóa đơn, hoặc ghi nhận hàng hoàn nếu khách trả lại.'
                : 'Đơn đã hoàn tất nhưng chưa thanh toán đủ — thu đủ tiền trước khi xuất hóa đơn.'}
          </span>
        )}
        {order.order_status === 'SHIPPING' && (
          <span className="text-xs text-slate-400">Đơn đang giao — không sửa được thông tin, có thể hủy để hoàn kho.</span>
        )}
      </div>

      {!!order.merged_from?.length && (
        <div className="mb-4 rounded-lg bg-brand-cyan-subtle px-3 py-2 text-xs text-brand-navy">
          Đơn này được <b>gộp từ</b>:{' '}
          {order.merged_from.map((s) => s.order_code).join(', ')}
        </div>
      )}
      {!!order.merged_into_id && (
        <div className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Đơn này đã được gộp vào đơn <b>{order.merged_into_code ?? `#${order.merged_into_id}`}</b>.
        </div>
      )}

      {!!order.return_history?.length && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <h3 className="mb-2 text-sm font-semibold text-brand-navy">Hàng hoàn · {order.return_history.length} phiếu · giảm doanh thu {formatCurrency(order.returned_value ?? 0)}</h3>
          {order.return_history.map((receipt) => <div key={receipt.id} className="mb-3 grid gap-1 border-t border-indigo-100 pt-2 text-xs text-slate-700 sm:grid-cols-2">
            <span>
              Ngày hoàn: <b>{formatDate(receipt.return_date)}</b>
            </span>
            <span>
              Phiếu nhập: <b>{receipt.ticket_code ?? '—'}</b>
            </span>
            <span>
              Giảm doanh thu: <b className="text-brand-red">{formatCurrency(receipt.returned_amount)}</b>
            </span>
            <span>
              Hình thức nhận:{' '}
              <b>{receipt.pickup_type === 'STAFF_PICKUP' ? 'Nhân viên đến lấy (có ship)' : 'Khách mang đến kho (miễn ship)'}</b>
            </span>
            <span>
              Vỏ thu hồi: <b>{formatNumber(receipt.shells_voi)} Vòi · {formatNumber(receipt.shells_up)} Úp</b>
            </span>
            <span>
              Hoàn cọc: <b>{formatCurrency(receipt.deposit_refund)}</b>
            </span>
            <span>Tiền hàng đã hoàn: <b>{formatCurrency(receipt.refund_amount)}</b></span>
            {receipt.return_warehouse_name && <span>Kho nhận hàng hoàn: <b>{receipt.return_warehouse_name}</b></span>}
            {receipt.note ? <p className="text-xs text-slate-500">Ghi chú: {receipt.note}</p> : null}
          </div>)}
          {!!order.return_collectors?.length && (
            <p className="mt-2 text-xs text-slate-600">
              Nhân viên đi nhận:{' '}
              {order.return_collectors
                .map((c) => `${c.employee_name ?? `#${c.employee_id}`} (${formatCurrency(c.allocated_fee)})`)
                .join(', ')}
            </p>
          )}
        </div>
      )}

      <OrderForm
        order={order}
        readOnly={!editing}
        showActions={editing}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />

      {canAssignShippers && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">Người giao & phân bổ phí vận chuyển</h3>
          <p className="mb-3 mt-0.5 text-xs text-slate-400">
            Phí ship của đơn là {formatCurrency(order.shipping_fee)} — phân bổ cho nhân viên giao để tính vào báo cáo phí vận chuyển.
          </p>
          <div className="max-w-xl space-y-2">
            {!shippers.length &&
              (freeShipNoShipper ? (
                <p className="text-xs text-slate-500">
                  Đơn không gán người giao — là đơn miễn ship nên phí ship không tính vào báo cáo phí vận chuyển.
                </p>
              ) : (
                <p className="text-xs font-medium text-amber-600">Đơn chưa gán người giao — phí ship chưa được tính cho nhân viên nào.</p>
              ))}
            {shippers.map((s, i) => (
              <div key={s.employee_id} className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{employeeName(s.employee_id)}</span>
                <div className="w-32">
                  <Input
                    dense
                    type="number"
                    value={String(s.allocated_fee)}
                    onChange={(e) => setShippers((prev) => prev.map((x, j) => (j === i ? { ...x, allocated_fee: Number(e.target.value) || 0 } : x)))}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShippers((prev) => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-brand-red" />
                </Button>
              </div>
            ))}
            <div className="flex gap-1.5">
              <Select dense value={addShipperId} onChange={(e) => setAddShipperId(e.target.value)}>
                <option value="">-- Chọn người giao --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const id = Number(addShipperId);
                  if (!id || shippers.some((x) => x.employee_id === id)) return;
                  setShippers((prev) => splitEven([...prev, { employee_id: id, allocated_fee: 0 }]));
                  setAddShipperId('');
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Thêm
              </Button>
              {shippers.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setShippers((prev) => splitEven(prev))}>
                  Chia đều
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={saveShippers} disabled={savingShippers}>
              Lưu người giao
            </Button>
            {shippers.length > 0 && (
              <span className="text-[11px] text-slate-400">
                Tổng đã chia: {formatCurrency(shippers.reduce((a, s) => a + s.allocated_fee, 0))} / phí ship{' '}
                {formatCurrency(order.shipping_fee)}
              </span>
            )}
          </div>
        </section>
      )}

      {order.order_status === 'COMPLETED' && (
        <p className="mt-4 text-xs text-slate-400">
          Đơn đã hoàn tất — trạng thái cuối, không sửa/hủy. Dữ liệu kho, doanh thu và KPI đã được ghi nhận; khách trả lại hàng thì dùng
          "Hàng hoàn".
        </p>
      )}
      {order.order_status === 'RETURNED' && (
        <p className="mt-4 text-xs text-slate-400">
          Đơn đã ghi nhận hàng hoàn — trạng thái cuối. KPI và lương giao hàng giữ nguyên; tồn kho và doanh thu đã được điều chỉnh theo
          số lượng hoàn.
        </p>
      )}
      <ReturnModal
        order={order}
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        onDone={onChanged}
      />
      <Modal
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
        title={freightOnly ? 'Thu phí giao từ đối tác' : 'Thu tiền đơn hàng'}
        subtitle={`Đơn ${order.order_code} · còn phải thu ${formatCurrency(remaining)}`}
        footer={<>
          <Button variant="outline" onClick={() => setCollectOpen(false)}>Đóng</Button>
          <Button onClick={collectPayment} disabled={busy}>{busy ? 'Đang lưu...' : 'Ghi phiếu thu'}</Button>
        </>}
      >
        <div className="space-y-3 p-5">
          <label className="block text-sm">Số tiền thu
            <Input dense type="number" min="1" max={Math.round(remaining)} value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
          </label>
          <label className="block text-sm">Hình thức thu
            <Select dense value={collectMethod} onChange={(e) => setCollectMethod(e.target.value)}>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </Select>
          </label>
        </div>
      </Modal>
    </>
  );
}
