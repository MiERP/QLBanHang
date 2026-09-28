import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { formatCurrency, formatDate } from '../../lib/format';
import type { Order } from '../../types';
import { statusMeta } from './orderStatus';

interface AggregatedLine {
  product_id: number;
  product_name: string;
  unit?: string;
  quantity: number;
  unit_price: number;
}

export function MergeOrdersModal({
  orders,
  onClose,
  onMerged,
}: {
  orders: Order[];
  onClose: () => void;
  onMerged: (res: { orderId: number; orderCode: string }) => void;
}) {
  const { customers } = useReference();
  const toast = useToast();
  const first = orders[0];

  const [customerId, setCustomerId] = useState(String(first?.customer_id ?? ''));
  const [receiver, setReceiver] = useState(first?.shipping_receiver ?? '');
  const [phone, setPhone] = useState(first?.shipping_phone ?? '');
  const [address, setAddress] = useState(first?.shipping_address ?? '');
  const [saving, setSaving] = useState(false);

  const lines = useMemo(() => {
    const map = new Map<number, AggregatedLine>();
    for (const o of orders) {
      for (const it of o.items ?? []) {
        const cur = map.get(it.product_id);
        if (cur) cur.quantity += Number(it.quantity) || 0;
        else
          map.set(it.product_id, {
            product_id: it.product_id,
            product_name: it.product_name ?? `SP#${it.product_id}`,
            unit: it.unit,
            quantity: Number(it.quantity) || 0,
            unit_price: Number(it.unit_price) || 0,
          });
      }
    }
    return [...map.values()];
  }, [orders]);

  const mergedSubtotal = lines.reduce((a, l) => a + l.quantity * l.unit_price, 0);

  const confirm = async () => {
    if (!customerId) return toast.error('Chọn khách hàng cho đơn gộp');
    setSaving(true);
    try {
      const res = await api.mergeOrders(
        orders.map((o) => o.id),
        { customer_id: Number(customerId), shipping_receiver: receiver, shipping_phone: phone, shipping_address: address }
      );
      toast.success(`Đã gộp thành đơn ${res.orderCode}`);
      onMerged({ orderId: res.orderId, orderCode: res.orderCode });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không gộp được đơn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Gộp ${orders.length} đơn hàng`}
      subtitle="Đơn gộp được tạo ở trạng thái Nháp, giữ nguyên mặt hàng và tính lại khuyến mãi theo số lượng gộp"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button size="sm" onClick={confirm} disabled={saving}>
            {saving ? 'Đang gộp...' : 'Xác nhận gộp đơn'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-bold text-slate-600">Đơn được gộp ({orders.length})</p>
          <div className="space-y-1 text-xs">
            {orders.map((o) => {
              const meta = statusMeta(o.order_status);
              return (
                <div key={o.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <b className="font-mono text-brand-navy">{o.order_code}</b>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-slate-500">
                      {formatDate(o.order_date)} · {o.customer_name}
                    </span>
                  </span>
                  <span className="font-semibold">{formatCurrency(o.total_amount)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-bold text-slate-600">Hàng hóa sau khi gộp</p>
          <div className="space-y-1 text-xs">
            {lines.map((l) => (
              <div key={l.product_id} className="flex items-center justify-between gap-2">
                <span className="text-slate-600">
                  {l.product_name} {l.unit ? `(${l.unit})` : ''}
                </span>
                <span className="text-slate-500">
                  {l.quantity} × {formatCurrency(l.unit_price)}
                </span>
                <span className="w-28 text-right font-semibold">{formatCurrency(l.quantity * l.unit_price)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-4 border-t border-slate-100 pt-2 text-xs">
            <span className="text-slate-500">
              Tạm tính: <b className="text-brand-navy">{formatCurrency(mergedSubtotal)}</b>
            </span>
          </div>
          <p className="mt-2 text-[11px] text-amber-600">
            Khuyến mãi sẽ được tính lại theo tổng số lượng gộp (có thể được tặng thêm so với từng đơn lẻ).
          </p>
        </div>

        <FormGrid cols={2}>
          <Field label="Khách hàng" required>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">-- Chọn --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Người nhận">
            <Input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
          </Field>
          <Field label="SĐT giao">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Địa chỉ giao">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </FormGrid>

        <p className="text-[11px] text-slate-400">
          Các đơn nguồn sẽ được đánh dấu “đã gộp” và chuyển sang trạng thái Đã hủy (không ảnh hưởng kho/doanh thu vì đều là đơn chưa xuất kho).
        </p>
      </div>
    </Modal>
  );
}
