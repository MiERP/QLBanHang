import { useEffect, useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatNumber, todayISO } from '../../lib/format';
import type { Order } from '../../types';
import { splitShippingFee } from './orderStatus';

interface Props {
  order: Order;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

// Ghi nhận hàng hoàn: nhập kho hàng khách trả lại, giảm doanh thu; KPI và lương giao hàng giữ nguyên.
// Khách trả toàn bộ hàng và khuyến mãi đúng một lần; đơn gốc chuyển sang Hàng hoàn.
export function ReturnModal({ order, open, onClose, onDone }: Props) {
  const { products, staff, customers, warehouses } = useReference();
  const shippingFeesApi = useApi(() => api.shippingFees.list(), []);
  const toast = useToast();

  const items = useMemo(() => order.items ?? [], [order.items]);
  const quantities = useMemo(() => Object.fromEntries(items.map((item) => [item.id ?? 0, String(item.quantity)])), [items]);
  const promos = useMemo(() => Object.fromEntries(items.map((item) => [item.id ?? 0, String(item.quantity_promo ?? 0)])), [items]);
  const [returnDate, setReturnDate] = useState(todayISO());
  const [pickupType, setPickupType] = useState('CUSTOMER_BRING');
  const [collectors, setCollectors] = useState<{ employee_id: number; allocated_fee: number }[]>([]);
  const [addCollectorId, setAddCollectorId] = useState('');
  const [shellsVoi, setShellsVoi] = useState('');
  const [shellsUp, setShellsUp] = useState('');
  const [shellsTouched, setShellsTouched] = useState(false);
  const [depositMethod, setDepositMethod] = useState('CASH');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [returnWarehouseId, setReturnWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const productOf = (productId: number) => products.find((p) => p.id === productId);
  const customer = customers.find((c) => c.id === order.customer_id);
  const debtVoi = Number((customer as unknown as { bottle_debt_voi?: number })?.bottle_debt_voi) || 0;
  const debtUp = Number((customer as unknown as { bottle_debt_up?: number })?.bottle_debt_up) || 0;

  useEffect(() => {
    if (!open) return;
    setReturnDate(todayISO());
    setPickupType('CUSTOMER_BRING');
    setCollectors([]);
    setShellsVoi('');
    setShellsUp('');
    setShellsTouched(false);
    setDepositMethod('CASH');
    setRefundMethod('CASH');
    setReturnWarehouseId('');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id]);

  const billableUnits = items.reduce((sum, item) => sum + (Number(quantities[item.id ?? 0]) || 0) + (Number(promos[item.id ?? 0]) || 0), 0);
  const returnedValue = Math.max(0, (Number(order.subtotal_amount) || 0) - (Number(order.discount_amount) || 0));
  const refundAmount = Math.max(0, Math.round((Number(order.paid_amount) || 0)
    - ((Number(order.total_amount) || 0) - returnedValue)));

  // Vỏ gợi ý = số lượng hoàn của các mặt hàng có vỏ tương ứng (sửa được, không vượt nợ vỏ của khách).
  const suggested = useMemo(() => {
    let voi = 0;
    let up = 0;
    for (const item of items) {
      const qty = (Number(quantities[item.id ?? 0]) || 0) + (Number(promos[item.id ?? 0]) || 0);
      const product = productOf(item.product_id);
      if (!product) continue;
      if (product.bottle_type === 'VOI') voi += qty;
      if (product.bottle_type === 'UP') up += qty;
    }
    return { voi, up };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantities, products]);

  useEffect(() => {
    if (shellsTouched) return;
    setShellsVoi(suggested.voi ? String(suggested.voi) : '');
    setShellsUp(suggested.up ? String(suggested.up) : '');
  }, [suggested, shellsTouched]);

  const depositRefund = useMemo(() => {
    let feeVoi = 0;
    let feeUp = 0;
    for (const item of items) {
      const product = productOf(item.product_id);
      if (!product) continue;
      if (product.bottle_type === 'VOI' && !feeVoi) feeVoi = Number(product.deposit_fee) || 0;
      if (product.bottle_type === 'UP' && !feeUp) feeUp = Number(product.deposit_fee) || 0;
    }
    return (Number(shellsVoi) || 0) * feeVoi + (Number(shellsUp) || 0) * feeUp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellsVoi, shellsUp, items, products]);

  // Phí đi nhận hàng hoàn tính theo đúng tuyến phí của đơn (backend tính lại y hệt khi lưu).
  const returnShippingFee = useMemo(() => {
    const route = (shippingFeesApi.data ?? []).find((f) => f.id === order.shipping_fee_id);
    if (!route) return 0;
    return (Number(route.fee_per_unit) || 0) * billableUnits;
  }, [shippingFeesApi.data, order.shipping_fee_id, billableUnits]);

  const submit = async () => {
    const lines = items
      .filter((item) => item.id)
      .map((item) => ({
        order_item_id: Number(item.id),
        quantity: Number(quantities[item.id ?? 0]) || 0,
        quantity_promo: Number(promos[item.id ?? 0]) || 0,
      }))
      .filter((line) => line.quantity > 0 || line.quantity_promo > 0);
    if (!lines.length) return toast.error('Nhập số lượng hàng hoàn');
    if (order.order_type === 'BORROW_IN' && !returnWarehouseId) return toast.error('Chọn kho thực nhận hàng hoàn');
    if (pickupType === 'STAFF_PICKUP' && !collectors.length) return toast.error('Chọn nhân viên đi nhận hàng hoàn');
    if ((Number(shellsVoi) || 0) > debtVoi) return toast.error(`Vỏ Vòi thu hồi vượt nợ vỏ của khách (${debtVoi})`);
    if ((Number(shellsUp) || 0) > debtUp) return toast.error(`Vỏ Úp thu hồi vượt nợ vỏ của khách (${debtUp})`);

    setSaving(true);
    try {
      const res = await api.returnOrder(order.id, {
        return_date: returnDate,
        pickup_type: pickupType,
        collectors: pickupType === 'STAFF_PICKUP' ? collectors.map((c) => ({ employee_id: c.employee_id })) : [],
        items: lines,
        shells_voi: Number(shellsVoi) || 0,
        shells_up: Number(shellsUp) || 0,
        deposit_payment_method: depositMethod,
        refund_payment_method: refundMethod,
        return_warehouse_id: order.order_type === 'BORROW_IN' ? Number(returnWarehouseId) : undefined,
        note,
      });
      toast.success(`Đã ghi nhận hàng hoàn — phiếu nhập ${res.ticketCode}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không ghi nhận được hàng hoàn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Hàng hoàn: ${order.order_code}`}
      subtitle="Khách trả lại hàng — nhập lại kho và giảm doanh thu; KPI và lương giao hàng không đổi"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Ghi nhận hàng hoàn'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-bold text-slate-600">Hàng khách trả lại {order.order_type === 'BORROW_IN' ? '' : `(nhập về ${order.warehouse_name})`}</p>
          {order.order_type === 'BORROW_IN' && (
            <Field label="Kho thực nhận hàng hoàn">
              <Select dense value={returnWarehouseId} onChange={(e) => setReturnWarehouseId(e.target.value)}>
                <option value="">-- Chọn kho --</option>
                {warehouses.filter((w) => w.is_active && w.type !== 'VIRTUAL' && w.type !== 'CUSTOMER').map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-1">Sản phẩm</th>
                <th className="pb-1 text-right">Đã giao</th>
                <th className="pb-1 text-right">KM</th>
                <th className="w-20 pb-1 text-right">Hoàn toàn bộ</th>
                <th className="w-20 pb-1 text-right">KM trả lại</th>
                <th className="pb-1 text-right">Giá trị hoàn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const delivered = Number(item.quantity) || 0;
                const qty = Number(quantities[item.id ?? 0]) || 0;
                return (
                  <tr key={item.id}>
                    <td className="py-1 text-slate-700">
                      {item.product_name}
                      {item.unit ? <span className="ml-1 text-slate-400">({item.unit})</span> : null}
                    </td>
                    <td className="py-1 text-right text-slate-500">{formatNumber(delivered)}</td>
                    <td className="py-1 text-right text-amber-600">{formatNumber(Number(item.quantity_promo) || 0)}</td>
                    <td className="py-1 text-right font-semibold">{formatNumber(qty)}</td>
                    <td className="py-1 text-right font-semibold">{formatNumber(Number(item.quantity_promo) || 0)}</td>
                    <td className="py-1 text-right font-semibold text-brand-navy">
                      {formatCurrency(qty * (Number(item.unit_price) || 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-right text-[11px] text-slate-500">
            Doanh thu hàng hoàn: <b className="text-slate-700">{formatCurrency(returnedValue)}</b> · số đơn vị hoàn{' '}
            {formatNumber(billableUnits)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-600">Tiền hàng hoàn cho khách</p>
          <p className="mt-1 text-xs text-slate-600">Phí giao ban đầu vẫn giữ nguyên. Số tiền cần hoàn: <b>{formatCurrency(refundAmount)}</b></p>
          {refundAmount > 0 && (
            <Field label="Hình thức hoàn tiền">
              <Select dense value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </Select>
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày hoàn">
            <Input dense type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </Field>
          <Field label="Hình thức nhận hàng hoàn">
            <Select dense value={pickupType} onChange={(e) => setPickupType(e.target.value)}>
              <option value="CUSTOMER_BRING">Khách mang đến kho — miễn ship</option>
              <option value="STAFF_PICKUP">Nhân viên đến lấy — tính ship như giao hàng</option>
            </Select>
          </Field>
        </div>

        {pickupType === 'STAFF_PICKUP' && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-bold text-slate-600">Nhân viên đi nhận hàng hoàn</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Phí ship hàng hoàn:</span>
                <b className="text-brand-navy">{formatCurrency(returnShippingFee)}</b>
                <span className="text-slate-400">(theo tuyến của đơn × {formatNumber(billableUnits)} đơn vị hoàn)</span>
              </div>
              {collectors.map((collector, index) => (
                <div key={collector.employee_id} className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {staff.find((s) => s.id === collector.employee_id)?.full_name ?? `#${collector.employee_id}`}
                  </span>
                  <div className="w-28">
                    <Input
                      dense
                      type="number"
                      value={String(collector.allocated_fee)}
                      onChange={(e) =>
                        setCollectors((prev) =>
                          prev.map((x, i) => (i === index ? { ...x, allocated_fee: Number(e.target.value) || 0 } : x))
                        )
                      }
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setCollectors((prev) => splitShippingFee(prev.filter((_, i) => i !== index), returnShippingFee))}>
                    <span className="text-xs text-brand-red">Xóa</span>
                  </Button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Select dense value={addCollectorId} onChange={(e) => setAddCollectorId(e.target.value)}>
                  <option value="">-- Chọn nhân viên --</option>
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
                    const id = Number(addCollectorId);
                    if (!id || collectors.some((x) => x.employee_id === id)) return;
                    setCollectors((prev) => splitShippingFee([...prev, { employee_id: id, allocated_fee: 0 }], returnShippingFee));
                    setAddCollectorId('');
                  }}
                >
                  Thêm
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-bold text-slate-600">Vỏ thu hồi & hoàn cọc</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Vỏ Vòi thu hồi" hint={`Nợ vỏ hiện tại: ${formatNumber(debtVoi)}`}>
              <Input
                dense
                type="number"
                value={shellsVoi}
                onChange={(e) => {
                  setShellsTouched(true);
                  setShellsVoi(e.target.value);
                }}
              />
            </Field>
            <Field label="Vỏ Úp thu hồi" hint={`Nợ vỏ hiện tại: ${formatNumber(debtUp)}`}>
              <Input
                dense
                type="number"
                value={shellsUp}
                onChange={(e) => {
                  setShellsTouched(true);
                  setShellsUp(e.target.value);
                }}
              />
            </Field>
            <Field label="Hình thức hoàn cọc">
              <Select dense value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-right text-[11px] text-slate-500">
            Tiền hoàn cọc: <b className="text-slate-700">{formatCurrency(depositRefund)}</b>
          </p>
        </div>

        <Field label="Ghi chú">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
