import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, todayISO } from '../../lib/format';
import type { Order } from '../../types';

interface LineItem {
  product_id: string | number;
  quantity: string | number;
  quantity_promo: string | number;
  unit_price: string | number;
}

const PAYMENT_STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  PAID: { label: 'Đã thanh toán', tone: 'green' },
  PARTIAL: { label: 'Thanh toán một phần', tone: 'amber' },
  UNPAID: { label: 'Công nợ', tone: 'red' },
};

const METHOD_LABEL: Record<string, string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ' };
const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  DISPATCHED: 'Đã điều phối',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export function SalesTab() {
  const { customers, warehouses, products, staff } = useReference();
  const ordersApi = useApi(() => api.fetchOrders({ limit: 300 }), []);
  const toast = useToast();
  const confirm = useConfirm();

  const sellers = staff.filter((s) => s.role_id === 1 || s.role_id === 2 || s.role_id === 3);
  const shippers = staff.filter((s) => s.role_id === 4);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = {
    customer_id: '',
    warehouse_id: '',
    seller_employee_id: '',
    shipper_employee_id: '',
    order_date: todayISO(),
    payment_method: 'CASH',
    payment_status: 'PAID',
    shipping_fee: 50000,
    discount_amount: 0,
    is_vat_invoice: false,
    vat_number: '',
    company_name_vat: '',
    tax_code_vat: '',
    note: '',
    returned_shells_voi: '',
    returned_shells_up: '',
  };
  const [form, setForm] = useState<Record<string, unknown>>(blankForm);
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', quantity: 1, quantity_promo: 0, unit_price: '' }]);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  const productsExtended = useMemo(() => products, [products]);

  const openCreate = () => {
    setForm({
      ...blankForm,
      customer_id: customers[0]?.id ?? '',
      warehouse_id: warehouses[0]?.id ?? '',
      seller_employee_id: sellers[0]?.id ?? '',
      shipper_employee_id: shippers[0]?.id ?? '',
    });
    setItems([{ product_id: products[0]?.id ?? '', quantity: 1, quantity_promo: 0, unit_price: products[0]?.standard_price ?? '' }]);
    setCreateOpen(true);
  };

  const openEdit = (row: Order) => {
    setEditing(row);
    setEditForm({
      order_status: row.order_status,
      payment_status: row.payment_status,
      payment_method: row.payment_method,
      shipper_employee_id: row.shipper_employee_id ?? '',
      note: row.note ?? '',
    });
  };

  const setLine = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const onProductChange = (index: number, productId: number) => {
    const product = productsExtended.find((p) => p.id === productId);
    setLine(index, { product_id: productId, unit_price: product?.standard_price ?? '' });
  };

  const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = subtotal + (Number(form.shipping_fee) || 0) - (Number(form.discount_amount) || 0);

  const submitCreate = async () => {
    if (!form.customer_id) return toast.error('Chọn khách hàng');
    const validItems = items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (validItems.length === 0) return toast.error('Thêm ít nhất một mặt hàng với số lượng > 0');
    setSaving(true);
    try {
      const res = await api.createOrder({
        ...form,
        shipper_employee_id: form.shipper_employee_id || null,
        items: validItems.map((it) => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          quantity_promo: Number(it.quantity_promo) || 0,
          unit_price: Number(it.unit_price) || undefined,
        })),
      });
      toast.success(`Đã lập đơn ${res.orderCode}`);
      setCreateOpen(false);
      ordersApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lập được đơn');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      await api.updateOrder(editing.id, editForm);
      toast.success('Đã cập nhật đơn hàng');
      setEditing(null);
      ordersApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được');
    }
  };

  const remove = async (row: Order) => {
    const ok = await confirm({
      title: 'Hủy đơn hàng',
      message: `Hủy đơn ${row.order_code}? Hệ thống sẽ hoàn lại tồn kho, đảo nợ vỏ và xóa sổ quỹ/điều phối liên quan.`,
      danger: true,
      confirmLabel: 'Hủy đơn hàng',
    });
    if (!ok) return;
    try {
      await api.deleteOrder(row.id);
      toast.success('Đã hủy đơn và hoàn kho');
      ordersApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không hủy được');
    }
  };

  const columns: Column<Order>[] = [
    { key: 'order_code', header: 'Mã đơn', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.order_code },
    { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'seller_name', header: 'Người bán' },
    { key: 'shipper_name', header: 'Người giao', render: (r) => r.shipper_name ?? '—' },
    { key: 'total_amount', header: 'Tổng tiền', align: 'right', render: (r) => formatCurrency(r.total_amount), sortValue: (r) => r.total_amount },
    {
      key: 'payment_status',
      header: 'Thanh toán',
      align: 'center',
      render: (r) => <Badge tone={PAYMENT_STATUS[r.payment_status]?.tone ?? 'neutral'}>{PAYMENT_STATUS[r.payment_status]?.label ?? r.payment_status}</Badge>,
      sortValue: (r) => r.payment_status,
    },
    {
      key: 'order_status',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => (
        <Badge tone={r.order_status === 'CANCELLED' ? 'red' : r.order_status === 'COMPLETED' ? 'green' : 'cyan'}>
          {ORDER_STATUS_LABEL[r.order_status] ?? r.order_status}
        </Badge>
      ),
      sortValue: (r) => r.order_status,
    },
    { key: 'is_vat_invoice', header: 'VAT', align: 'center', render: (r) => (r.is_vat_invoice ? <Badge tone="navy">HĐ VAT</Badge> : <span className="text-slate-300">—</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Bán hàng & Đơn hàng"
        subtitle={`${ordersApi.data?.length ?? 0} đơn hàng gần đây · khuyến mại 10+1 tự động trừ kho`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Lập đơn mới
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={ordersApi.data ?? []}
        rowKey={(r) => r.id}
        loading={ordersApi.loading}
        onRowClick={openEdit}
        searchPlaceholder="Tìm theo mã đơn, khách hàng..."
        initialSortKey="order_code"
        initialSortDir="desc"
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="xl"
        title="Lập đơn bán hàng"
        subtitle="Đơn hàng, khuyến mại và đối soát vỏ bình"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitCreate} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu đơn hàng'}
            </Button>
          </>
        }
      >
        <div className="space-y-5 p-5">
          <FormGrid cols={3}>
            <Field label="Khách hàng" required>
              <Select value={String(form.customer_id ?? '')} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">-- Chọn khách hàng --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kho xuất hàng" required>
              <Select value={String(form.warehouse_id ?? '')} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày đơn">
              <Input type="date" value={String(form.order_date ?? '')} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
            </Field>
            <Field label="Nhân viên bán hàng" required>
              <Select value={String(form.seller_employee_id ?? '')} onChange={(e) => setForm({ ...form, seller_employee_id: e.target.value })}>
                <option value="">-- Chọn người bán --</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nhân viên giao hàng">
              <Select value={String(form.shipper_employee_id ?? '')} onChange={(e) => setForm({ ...form, shipper_employee_id: e.target.value })}>
                <option value="">-- Không chỉ định --</option>
                {shippers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hình thức thanh toán">
              <Select value={String(form.payment_method ?? 'CASH')} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
                <option value="DEBT">Ghi nợ</option>
              </Select>
            </Field>
          </FormGrid>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <ShoppingCart className="h-4 w-4 text-brand-cyan" /> Chi tiết mặt hàng
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((prev) => [...prev, { product_id: products[0]?.id ?? '', quantity: 1, quantity_promo: 0, unit_price: products[0]?.standard_price ?? '' }])}
              >
                <Plus className="h-3.5 w-3.5" /> Thêm dòng
              </Button>
            </div>
            <div className="space-y-2 p-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-5">
                    <Select value={String(it.product_id)} onChange={(e) => onProductChange(i, Number(e.target.value))}>
                      <option value="">-- Chọn sản phẩm --</option>
                      {productsExtended.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="SL" value={String(it.quantity)} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="KM" value={String(it.quantity_promo)} onChange={(e) => setLine(i, { quantity_promo: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Đơn giá" value={String(it.unit_price)} onChange={(e) => setLine(i, { unit_price: e.target.value })} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4 text-brand-red" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormGrid cols={3}>
            <Field label="Phí vận chuyển">
              <Input type="number" value={String(form.shipping_fee ?? '')} onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })} />
            </Field>
            <Field label="Giảm giá">
              <Input type="number" value={String(form.discount_amount ?? '')} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
            </Field>
            <Field label="Trạng thái thanh toán">
              <Select value={String(form.payment_status ?? 'PAID')} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                <option value="PAID">Đã thanh toán</option>
                <option value="PARTIAL">Thanh toán một phần</option>
                <option value="UNPAID">Công nợ</option>
              </Select>
            </Field>
            <Field label="Vỏ Vòi thu hồi">
              <Input type="number" value={String(form.returned_shells_voi ?? '')} onChange={(e) => setForm({ ...form, returned_shells_voi: e.target.value })} />
            </Field>
            <Field label="Vỏ Úp thu hồi">
              <Input type="number" value={String(form.returned_shells_up ?? '')} onChange={(e) => setForm({ ...form, returned_shells_up: e.target.value })} />
            </Field>
            <Field label="Hóa đơn VAT">
              <Select value={form.is_vat_invoice ? '1' : '0'} onChange={(e) => setForm({ ...form, is_vat_invoice: e.target.value === '1' })}>
                <option value="0">Không xuất hóa đơn</option>
                <option value="1">Có xuất hóa đơn VAT</option>
              </Select>
            </Field>
          </FormGrid>

          <Field label="Ghi chú">
            <Textarea value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-6 rounded-xl bg-brand-cyan-subtle px-4 py-3 text-sm">
            <span className="text-slate-600">
              Tạm tính: <b className="text-slate-800">{formatCurrency(subtotal)}</b>
            </span>
            <span className="text-slate-600">
              Phí ship: <b className="text-slate-800">{formatCurrency(Number(form.shipping_fee) || 0)}</b>
            </span>
            <span className="text-slate-600">
              Tổng cộng: <b className="text-brand-navy text-base">{formatCurrency(total)}</b>
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Đơn hàng ${editing.order_code}` : ''}
        subtitle={editing ? `${editing.customer_name} · ${formatCurrency(editing.total_amount)}` : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Đóng
            </Button>
            {editing && (
              <Button variant="danger" size="sm" onClick={() => remove(editing)}>
                Hủy đơn
              </Button>
            )}
            <Button size="sm" onClick={submitEdit}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-bold text-slate-600">Mặt hàng</p>
              <div className="space-y-1 text-xs">
                {(editing.items ?? []).map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-600">
                      {it.product_name} × {it.quantity}
                      {it.quantity_promo ? ` (+${it.quantity_promo} KM)` : ''}
                    </span>
                    <span className="font-semibold">{formatCurrency(it.total_price)}</span>
                  </div>
                ))}
              </div>
            </div>
            <FormGrid cols={2}>
              <Field label="Trạng thái đơn">
                <Select value={String(editForm.order_status ?? '')} onChange={(e) => setEditForm({ ...editForm, order_status: e.target.value })}>
                  {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Trạng thái thanh toán">
                <Select value={String(editForm.payment_status ?? '')} onChange={(e) => setEditForm({ ...editForm, payment_status: e.target.value })}>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="PARTIAL">Thanh toán một phần</option>
                  <option value="UNPAID">Công nợ</option>
                </Select>
              </Field>
              <Field label="Hình thức thanh toán">
                <Select value={String(editForm.payment_method ?? '')} onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                  <option value="DEBT">Ghi nợ</option>
                </Select>
              </Field>
              <Field label="Người giao hàng">
                <Select value={String(editForm.shipper_employee_id ?? '')} onChange={(e) => setEditForm({ ...editForm, shipper_employee_id: e.target.value })}>
                  <option value="">-- Không chỉ định --</option>
                  {shippers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormGrid>
            <Field label="Ghi chú">
              <Textarea value={String(editForm.note ?? '')} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
