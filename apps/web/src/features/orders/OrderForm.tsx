import { Plus, ShoppingCart, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatNumber, todayISO } from '../../lib/format';
import { withPromotions } from '../../lib/promotions';
import { freeShipForCustomer, freeShipWithoutShipper } from '../../lib/settings';
import { stockWarehouses } from '../../lib/warehouses';
import type { Customer, Order, PriceListEntry, Product } from '../../types';
import { CustomerFields, emptyCustomerForm } from '../customers/CustomerFields';
import { splitShippingFee } from './orderStatus';

export interface LineItem {
  product_id: string | number;
  quantity: string | number;
  quantity_promo: string | number;
  unit_price: string | number;
}

const blankLine = (): LineItem => ({ product_id: '', quantity: 1, quantity_promo: 0, unit_price: '' });

const blankHeader = () => ({
  customer_id: '',
  order_type: 'SALE',
  partner_unit_id: '',
  target_scope: 'ENTERPRISE',
  warehouse_id: '',
  seller_employee_id: '',
  support_station_id: '',
  shipping_fee_id: '',
  order_date: todayISO(),
  delivery_date: todayISO(),
  payment_method: 'CASH',
  payment_status: 'UNPAID',
  discount_amount: 0,
  deposit_override: '',
  shipping_fee: 0,
  shipping_receiver: '',
  shipping_phone: '',
  shipping_address: '',
  shipping_note: '',
  returned_shells_voi: '',
  returned_shells_up: '',
  loan_due_date: '',
  is_vat_invoice: false,
  vat_rate: 0,
  vat_number: '',
  company_name_vat: '',
  tax_code_vat: '',
  address_vat: '',
  personal_id_vat: '',
  budget_relation_code_vat: '',
  note: '',
});

function orderToForm(order: Order): Record<string, unknown> {
  return {
    customer_id: order.customer_id ?? '',
    order_type: order.order_type ?? 'SALE',
    partner_unit_id: order.partner_unit_id ?? '',
    target_scope: order.target_scope ?? 'ENTERPRISE',
    warehouse_id: order.warehouse_id ?? '',
    seller_employee_id: order.seller_employee_id ?? '',
    support_station_id: order.support_station_id ?? '',
    shipping_fee_id: order.shipping_fee_id ?? '',
    order_date: order.order_date ?? todayISO(),
    delivery_date: order.delivery_date ?? order.order_date ?? todayISO(),
    payment_method: order.payment_method ?? 'CASH',
    payment_status: order.payment_status ?? 'UNPAID',
    discount_amount: order.discount_amount ?? 0,
    deposit_override: order.deposit_override ?? '',
    shipping_fee: order.shipping_fee ?? 0,
    shipping_receiver: order.shipping_receiver ?? '',
    shipping_phone: order.shipping_phone ?? '',
    shipping_address: order.shipping_address ?? '',
    shipping_note: order.shipping_note ?? '',
    returned_shells_voi: order.returned_shells_voi ?? '',
    returned_shells_up: order.returned_shells_up ?? '',
    loan_due_date: order.loan_due_date ?? '',
    is_vat_invoice: !!order.is_vat_invoice,
    vat_rate: order.vat_rate ?? 0,
    vat_number: order.vat_number ?? '',
    company_name_vat: order.company_name_vat ?? '',
    tax_code_vat: order.tax_code_vat ?? '',
    address_vat: order.address_vat ?? '',
    personal_id_vat: order.personal_id_vat ?? '',
    budget_relation_code_vat: order.budget_relation_code_vat ?? '',
    note: order.note ?? '',
  };
}

type CustomerInfo = Pick<
  Customer,
  'name' | 'phone' | 'address' | 'contact_person' | 'tax_code' | 'personal_id' | 'budget_relation_code' | 'group_id'
>;

interface OrderFormProps {
  /** Có đơn => chế độ sửa; không có => chế độ tạo mới. */
  order?: Order;
  readOnly?: boolean;
  /** Ẩn nút Lưu/Hủy (màn chi tiết tự hiện nút trạng thái). */
  showActions?: boolean;
  onSaved?: (res: { id: number; orderCode?: string }) => void;
  onCancel?: () => void;
}

export function OrderForm({ order, readOnly = false, showActions = true, onSaved, onCancel }: OrderFormProps) {
  const { products, warehouses, staff, customers, partnerUnits, orgUnits, settings, reload: reloadRefs } = useReference();
  const priceListApi = useApi(() => api.priceList.list(), []);
  const shippingFeesApi = useApi(() => api.shippingFees.list(), []);
  const promotionsApi = useApi(() => api.promotions.list(), []);
  const vatRatesApi = useApi(() => api.vatRates.list(), []);
  const shellDepositsApi = useApi(() => api.shellDeposits.list(), []);
  const toast = useToast();
  const editing = !!order;

  const sellers = staff;
  const shipperOptions = staff;
  // Bật cấu hình "đơn không có nhân viên vận chuyển là đơn miễn ship" thì được để trống người giao.
  const freeShipNoShipper = freeShipWithoutShipper(settings);
  // Chỉ hàng bán mới lên đơn được — dịch vụ dùng luồng yêu cầu dịch vụ riêng.
  const sellableProducts = products.filter((p) => p.product_type !== 'SERVICE');
  const activeShippingFees = (shippingFeesApi.data ?? []).filter((f) => !!f.is_active);
  // Thuế suất đang hiệu lực của danh mục — điền sẵn khi tích "Xuất hóa đơn VAT" để hóa đơn không
  // bị 0% do người dùng quên nhập (hóa đơn 0% trong khi báo cáo vẫn tách thuế theo danh mục).
  const currentVatRate = useMemo(() => {
    const today = todayISO();
    const active = (vatRatesApi.data ?? []).filter(
      (v) => (!v.effective_from || v.effective_from <= today) && (!v.effective_to || v.effective_to >= today)
    );
    return active.length ? Number(active[0].rate) || 0 : 0;
  }, [vatRatesApi.data]);

  const [form, setForm] = useState<Record<string, unknown>>(() => (order ? orderToForm(order) : blankHeader()));
  const [items, setItems] = useState<LineItem[]>(() =>
    order?.items?.length
      ? order.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, quantity_promo: i.quantity_promo ?? 0, unit_price: i.unit_price }))
      : [blankLine()]
  );
  const [shippers, setShippers] = useState<{ employee_id: number; allocated_fee: number }[]>(() =>
    (order?.shippers ?? []).map((s) => ({ employee_id: s.employee_id, allocated_fee: s.allocated_fee }))
  );
  const [saving, setSaving] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickForm, setQuickForm] = useState<Record<string, unknown>>({ ...emptyCustomerForm });
  const [addShipperId, setAddShipperId] = useState('');
  // Phí ship của đơn đã tạo là số đã lưu; chỉ tính lại theo tuyến khi tạo đơn mới
  // hoặc khi người dùng đổi tuyến phí / dòng hàng.
  const [feeAuto, setFeeAuto] = useState(!order);

  const updateItems = (updater: (prev: LineItem[]) => LineItem[]) => {
    setItems(updater);
    setFeeAuto(true);
  };

  const orderType = String(form.order_type ?? 'SALE');
  const isSaleLike = orderType === 'SALE' || orderType === 'BORROW_IN';
  const shownItems = useMemo(() => readOnly || !isSaleLike ? items :
    withPromotions(items, products, promotionsApi.data ?? [], String(form.order_date ?? todayISO())),
  [readOnly, isSaleLike, items, products, promotionsApi.data, form.order_date]);
  const isLend = orderType === 'LEND_OUT';
  const isBorrow = orderType === 'BORROW_IN';
  const isHired = orderType === 'HIRED_LOAD';
  const isLoan = isLend || isBorrow;
  // Đơn mượn vào và đơn bốc xếp đều không lấy hàng từ kho của mình.
  const isNoStock = isBorrow || isHired;
  // Đơn cho mượn và đơn bốc xếp chỉ thu tiền vận chuyển/công — không bán hàng, không cọc vỏ, không VAT hàng hóa.
  const isFreightOnly = isLend || isHired;
  const activePartners = partnerUnits.filter((p) => !!p.is_active);
  const physicalWarehouses = stockWarehouses(warehouses);

  const warehouseId = Number(form.warehouse_id) || 0;
  const stockApi = useApi(() => (warehouseId ? api.fetchStock(warehouseId) : Promise.resolve([])), [warehouseId]);
  const stockByProduct = useMemo(() => new Map((stockApi.data ?? []).map((s) => [s.product_id, s.quantity])), [stockApi.data]);

  const selectedCustomer = customers.find((c) => c.id === Number(form.customer_id));
  const customerGroupId = selectedCustomer?.group_id;

  useEffect(() => {
    if (!order && (!isBorrow || shippers.length > 0) && !form.shipping_fee_id && activeShippingFees.length) {
      setForm((prev) => ({ ...prev, shipping_fee_id: String(activeShippingFees[0].id) }));
    }
  }, [activeShippingFees, form.shipping_fee_id, isBorrow, order, shippers.length]);

  const resolvePrice = (p: Product, groupId: number | undefined, list: PriceListEntry[]): number => {
    const active = list.filter((x) => !!x.is_active);
    const byProduct = active.find((x) => x.product_id === p.id && (x.customer_group_id ?? null) === (groupId ?? null));
    if (byProduct) return byProduct.unit_price;
    const byCategory = active.find((x) => x.category_id === p.category_id && (x.customer_group_id ?? null) === (groupId ?? null));
    if (byCategory) return byCategory.unit_price;
    return p.standard_price;
  };

  // Nhận thẳng dữ liệu khách hàng thay vì tra lại danh sách tham chiếu — khách vừa tạo nhanh chưa kịp có trong danh sách.
  const applyCustomer = (value: string, c?: CustomerInfo) => {
    setForm((prev) => ({
      ...prev,
      customer_id: value,
      shipping_receiver: c?.contact_person || c?.name || '',
      shipping_phone: c?.phone || '',
      shipping_address: c?.address || '',
      company_name_vat: prev.is_vat_invoice ? c?.name || '' : prev.company_name_vat,
      tax_code_vat: prev.is_vat_invoice ? c?.tax_code || '' : prev.tax_code_vat,
      address_vat: prev.is_vat_invoice ? c?.address || '' : prev.address_vat,
      personal_id_vat: prev.is_vat_invoice ? c?.personal_id || '' : prev.personal_id_vat,
      budget_relation_code_vat: prev.is_vat_invoice ? c?.budget_relation_code || '' : prev.budget_relation_code_vat,
    }));
    const gid = c?.group_id;
    updateItems((prev) =>
      prev.map((it) => {
        const p = products.find((pp) => pp.id === Number(it.product_id));
        return p ? { ...it, unit_price: resolvePrice(p, gid, priceListApi.data ?? []) } : it;
      })
    );
  };

  const onCustomerChange = (value: string) => applyCustomer(value, customers.find((x) => x.id === Number(value)));

  const onProductChange = (index: number, productId: number) => {
    const p = products.find((x) => x.id === Number(productId));
    if (!p) return;
    updateItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              product_id: productId,
              unit_price: resolvePrice(p, customerGroupId, priceListApi.data ?? []),
              quantity_promo: 0,
            }
          : it
      )
    );
  };

  const onQuantityChange = (index: number, qty: string | number) => {
    updateItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        return { ...it, quantity: qty };
      })
    );
  };

  // Phí ship chỉ tính theo sản phẩm bán; hàng khuyến mãi vẫn giao và trừ kho nhưng miễn phí ship.
  const billableUnits = shownItems.reduce((a, it) => Number(it.product_id) > 0
    ? a + (Number(it.quantity) || 0) : a, 0);
  const selectedFee = activeShippingFees.find((f) => f.id === Number(form.shipping_fee_id));
  const routeShippingFee = selectedFee
    ? (selectedFee.fee_per_unit || 0) * billableUnits
    : 0;
  const shippingFee = feeAuto ? (shippers.length ? routeShippingFee : 0) : Number(form.shipping_fee) || 0;
  const subtotal = shownItems.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const discountAmount = Number(form.discount_amount) || 0;
  // Miễn ship cho khách (cấu hình chung): khách chỉ trả tiền hàng, phí ship vẫn hiển thị (để tính công giao hàng) nhưng không cộng vào tổng.
  const freeShipCustomer = freeShipForCustomer(settings);
  const total = (isFreightOnly ? 0 : subtotal - discountAmount) + (freeShipCustomer && !isFreightOnly ? 0 : shippingFee);

  // Tiền cọc vỏ bình khách phải trả để được mượn vỏ (chỉ với hàng bình RO / bình kiềm):
  // số bình giao (kể cả bình khuyến mãi, trừ bình khách trả ngay) × phí cọc theo loại vỏ.
  // Phí cọc lấy từ danh mục "Cọc vỏ bình", chưa cấu hình thì theo sản phẩm bình đang bán.
  const shellFee = (type: 'VOI' | 'UP'): number => {
    const configured = (shellDepositsApi.data ?? []).find((r) => r.bottle_type === type);
    if (configured && Number(configured.deposit_fee) > 0) return Number(configured.deposit_fee);
    const product = (products ?? []).find((p) => p.bottle_type === type && Number(p.deposit_fee) > 0);
    return Number(product?.deposit_fee) || 0;
  };
  const depositAmount = (() => {
    if (isFreightOnly) return 0;
    let voi = 0;
    let up = 0;
    for (const it of shownItems) {
      const product = (products ?? []).find((p) => p.id === Number(it.product_id));
      const qty = (Number(it.quantity) || 0) + (Number(it.quantity_promo) || 0);
      if (product?.bottle_type === 'VOI') voi += qty;
      else if (product?.bottle_type === 'UP') up += qty;
    }
    const netVoi = Math.max(0, voi - (Number(form.returned_shells_voi) || 0));
    const netUp = Math.max(0, up - (Number(form.returned_shells_up) || 0));
    return netVoi * shellFee('VOI') + netUp * shellFee('UP');
  })();
  // Người dùng có thể điền tay số tiền cọc; để trống thì dùng số tự tính.
  const depositOverrideRaw = String(form.deposit_override ?? '').trim();
  const depositValue =
    depositOverrideRaw !== '' && Number.isFinite(Number(depositOverrideRaw))
      ? Math.max(0, Number(depositOverrideRaw))
      : depositAmount;

  const addLine = () => updateItems((prev) => [...prev, blankLine()]);

  const buildPayload = (valid: LineItem[]) => ({
    ...form,
    order_type: orderType,
    partner_unit_id: orderType !== 'SALE' ? Number(form.partner_unit_id) : null,
    support_station_id: form.support_station_id ? Number(form.support_station_id) : null,
    loan_due_date: isLoan && form.loan_due_date ? form.loan_due_date : null,
    shippers: shippers.map((s) => ({ employee_id: s.employee_id, allocated_fee: s.allocated_fee })),
    shipping_fee: shippingFee,
    shipping_fee_id: isBorrow && !shippers.length ? null : form.shipping_fee_id,
    // Để trống = tự tính theo số bình × phí cọc; điền số thì lấy đúng số người dùng nhập.
    deposit_override: depositOverrideRaw === '' ? null : Math.max(0, Number(depositOverrideRaw)),
    items: valid.map((it) => ({
      product_id: it.product_id,
      quantity: Number(it.quantity),
      quantity_promo: Number(it.quantity_promo) || 0,
      // Đơn bốc xếp: hàng của đơn vị thuê, chỉ ghi số lượng để tính phí và đối chiếu.
      unit_price: isHired ? 0 : Number(it.unit_price) || undefined,
    })),
  });

  const validate = (valid: LineItem[]): string | null => {
    if (!form.customer_id) return 'Chọn khách hàng';
    if (!isNoStock && !form.warehouse_id) return 'Chọn kho xuất hàng';
    if (orderType !== 'SALE' && !form.partner_unit_id) return 'Chọn đối tác liên kết';
    if (!isLend && !isHired && !form.seller_employee_id) return 'Chọn nhân viên bán hàng';
    if ((!isBorrow || shippers.length > 0) && !form.shipping_fee_id) return 'Chọn tuyến phí vận chuyển';
    // Tắt cấu hình "miễn ship" thì đơn phải có người giao (đơn mượn kho ảo không có người giao).
    if (!isBorrow && !freeShipNoShipper && !shippers.length) return 'Chọn nhân viên vận chuyển';
    if (valid.length === 0) return 'Thêm ít nhất một mặt hàng với số lượng > 0';
    return null;
  };

  const save = async () => {
    const valid = shownItems.filter((it) => it.product_id && Number(it.quantity) > 0);
    const err = validate(valid);
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const payload = buildPayload(valid);
      if (editing && order) {
        await api.updateOrder(order.id, payload);
        toast.success('Đã lưu thay đổi đơn hàng');
        onSaved?.({ id: order.id, orderCode: order.order_code });
      } else {
        const res = await api.createOrder(payload);
        toast.success(`Đã lưu nháp đơn ${res.orderCode}`);
        setForm(blankHeader());
        setItems([blankLine()]);
        setFeeAuto(true);
        setShippers([]);
        setAddShipperId('');
        onSaved?.({ id: res.orderId, orderCode: res.orderCode });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được đơn');
    } finally {
      setSaving(false);
    }
  };

  const quickAddCustomer = async () => {
    if (!quickForm.name || !quickForm.address) return toast.error('Nhập tên và địa chỉ khách hàng');
    try {
      const res = await api.customers.create({ ...quickForm, group_id: quickForm.group_id || null });
      toast.success('Đã thêm khách hàng vào danh sách');
      setQuickOpen(false);
      applyCustomer(String(res.id), {
        name: String(quickForm.name),
        phone: quickForm.phone ? String(quickForm.phone) : undefined,
        address: String(quickForm.address),
        contact_person: quickForm.contact_person ? String(quickForm.contact_person) : undefined,
        tax_code: quickForm.tax_code ? String(quickForm.tax_code) : undefined,
        personal_id: quickForm.personal_id ? String(quickForm.personal_id) : undefined,
        budget_relation_code: quickForm.budget_relation_code ? String(quickForm.budget_relation_code) : undefined,
        group_id: quickForm.group_id ? Number(quickForm.group_id) : undefined,
      });
      setQuickForm({ ...emptyCustomerForm });
      await reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thêm được khách hàng');
    }
  };

  return (
    <>
      <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <ShoppingCart className="h-4 w-4 text-brand-cyan" />
              <h3 className="text-sm font-bold text-brand-navy">Thông tin đơn hàng</h3>
            </div>

            <div className="space-y-4 p-4">
              <FormGrid cols={4}>
                <Field label="Loại đơn" required>
                  <Select
                    dense
                    value={orderType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        order_type: e.target.value,
                        partner_unit_id: e.target.value === 'SALE' ? '' : prev.partner_unit_id,
                      }))
                    }
                  >
                    <option value="SALE">Đơn bán</option>
                    <option value="LEND_OUT">Đơn cho mượn</option>
                    <option value="BORROW_IN">Đơn mượn</option>
                    <option value="HIRED_LOAD">Đơn bốc xếp</option>
                  </Select>
                </Field>
                {orderType !== 'SALE' && (
                  <Field
                    label="Đối tác liên kết"
                    required
                    hint={isLend ? 'Đối tác nhận hàng mượn' : isHired ? 'Đơn vị thuê bốc xếp' : 'Đối tác cho mình mượn hàng'}
                  >
                    <Select dense value={String(form.partner_unit_id ?? '')} onChange={(e) => setForm({ ...form, partner_unit_id: e.target.value })}>
                      <option value="">-- Chọn đối tác --</option>
                      {activePartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Khách hàng" required>
                  <div className="flex gap-1.5">
                    <Select dense value={String(form.customer_id ?? '')} onChange={(e) => onCustomerChange(e.target.value)}>
                      <option value="">-- Chọn --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setQuickOpen(true)} title="Thêm khách nhanh">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
                {isLend || isHired ? (
                  <Field label="Người bán">
                    <div className="flex h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-700">
                      {isLend ? 'Đơn cho mượn — không tính doanh thu' : 'Đơn bốc xếp — không tính doanh thu bán nước'}
                    </div>
                  </Field>
                ) : (
                  <Field label="Người bán" required>
                    <Select dense value={String(form.seller_employee_id ?? '')} onChange={(e) => setForm({ ...form, seller_employee_id: e.target.value })}>
                      <option value="">-- Chọn --</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {!isNoStock && (
                  <Field label="Kho xuất" required>
                    <Select dense value={String(form.warehouse_id ?? '')} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                      <option value="">-- Chọn --</option>
                      {physicalWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Trạm hỗ trợ" hint="Đơn lớn cần trạm bốc xếp; đơn nhỏ để trống">
                  <Select dense value={String(form.support_station_id ?? '')} onChange={(e) => setForm({ ...form, support_station_id: e.target.value })}>
                    <option value="">-- Không cần --</option>
                    {orgUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {(
                  <Field
                    label="Người giao (nhiều người)"
                    required={!isBorrow && !freeShipNoShipper}
                    hint={
                      freeShipNoShipper && !shippers.length
                        ? 'Để trống = đơn miễn ship: phí vận chuyển không tính cho nhân viên nào.'
                        : undefined
                    }
                    className="lg:col-span-2"
                  >
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        <Select dense value={addShipperId} onChange={(e) => setAddShipperId(e.target.value)}>
                          <option value="">-- Chọn người giao --</option>
                          {shipperOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name}
                            </option>
                          ))}
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!addShipperId) return;
                            const id = Number(addShipperId);
                            if (shippers.some((x) => x.employee_id === id)) return;
                            setFeeAuto(true);
                            setShippers((prev) => splitShippingFee([...prev, { employee_id: id, allocated_fee: 0 }], routeShippingFee));
                            setAddShipperId('');
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" /> Thêm
                        </Button>
                        {shippers.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => setShippers((prev) => splitShippingFee(prev, shippingFee))}>
                            Chia đều
                          </Button>
                        )}
                      </div>
                      {shippers.map((s, i) => {
                        const emp = shipperOptions.find((x) => x.id === s.employee_id);
                        return (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{emp?.full_name ?? `#${s.employee_id}`}</span>
                            <div className="w-28">
                              <Input
                                dense
                                type="number"
                                value={String(s.allocated_fee)}
                                onChange={(e) => setShippers((prev) => prev.map((x, j) => (j === i ? { ...x, allocated_fee: Number(e.target.value) || 0 } : x)))}
                              />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => { setFeeAuto(true); setShippers((prev) => splitShippingFee(prev.filter((_, j) => j !== i), shippingFee)); }}>
                              <Trash2 className="h-4 w-4 text-brand-red" />
                            </Button>
                          </div>
                        );
                      })}
                      {shippers.length > 0 && (
                        <p className="text-[11px] text-slate-400">
                          Tổng đã chia: {formatCurrency(shippers.reduce((a, s) => a + s.allocated_fee, 0))} / phí ship {formatCurrency(shippingFee)}
                        </p>
                      )}
                    </div>
                  </Field>
                )}
                <Field label="Chỉ tiêu">
                  <Select
                    dense
                    value={String(form.target_scope ?? 'ENTERPRISE')}
                    onChange={(e) => setForm({ ...form, target_scope: e.target.value })}
                  >
                    <option value="COMPANY">Công ty</option>
                    <option value="ENTERPRISE">Xí nghiệp</option>
                  </Select>
                </Field>
                <Field label="Ngày đơn">
                  <Input dense type="date" value={String(form.order_date ?? '')} onChange={(e) => { setForm({ ...form, order_date: e.target.value }); setFeeAuto(true); }} />
                </Field>
                <Field label="Ngày giao">
                  <Input dense type="date" value={String(form.delivery_date ?? '')} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
                </Field>
                {isLoan && (
                  <Field label="Hạn trả">
                    <Input dense type="date" value={String(form.loan_due_date ?? '')} onChange={(e) => setForm({ ...form, loan_due_date: e.target.value })} />
                  </Field>
                )}
                <Field label="Người nhận">
                  <Input dense value={String(form.shipping_receiver ?? '')} onChange={(e) => setForm({ ...form, shipping_receiver: e.target.value })} />
                </Field>
                <Field label="SĐT giao">
                  <Input dense value={String(form.shipping_phone ?? '')} onChange={(e) => setForm({ ...form, shipping_phone: e.target.value })} />
                </Field>
                <Field label="Địa chỉ giao" hint="Có thể khác địa chỉ khách" className="lg:col-span-2">
                  <Input dense value={String(form.shipping_address ?? '')} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} />
                </Field>
                {(
                  <>
                    <Field label="Tuyến phí vận chuyển" required={!isBorrow || shippers.length > 0}>
                      <Select
                        dense
                        value={String(form.shipping_fee_id ?? '')}
                        onChange={(e) => {
                          setForm({ ...form, shipping_fee_id: e.target.value });
                          setFeeAuto(true);
                        }}
                      >
                        <option value="">-- Chọn --</option>
                        {activeShippingFees.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Phí vận chuyển" hint={`${formatNumber(billableUnits)} đơn vị`}>
                      <div className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-100 px-2 text-xs font-semibold text-brand-navy">
                        {formatCurrency(shippingFee)}
                      </div>
                    </Field>
                  </>
                )}
              </FormGrid>

              <div className="rounded-lg bg-slate-50 p-3">
                <FormGrid cols={4}>
                  <Field label="Hình thức thanh toán">
                    <Select
                      dense
                      value={String(form.payment_method ?? 'CASH')}
                      onChange={(e) => {
                        const m = e.target.value;
                        setForm({ ...form, payment_method: m, payment_status: m === 'DEBT' ? 'UNPAID' : 'PAID' });
                      }}
                    >
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK_TRANSFER">Chuyển khoản</option>
                      <option value="DEBT">Công nợ</option>
                    </Select>
                  </Field>
                  <Field label="Thanh toán">
                    <Select dense value={String(form.payment_status ?? 'UNPAID')} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                      <option value="PAID">Đã thanh toán</option>
                      <option value="PARTIAL">Một phần</option>
                      <option value="UNPAID">Chưa thanh toán</option>
                    </Select>
                  </Field>
                  {/* Đơn cho mượn / bốc xếp không bán hàng nên không có giảm giá và vỏ bình thu hồi. */}
                  {!isFreightOnly && (
                    <>
                      <Field label="Giảm giá">
                        <Input dense type="number" value={String(form.discount_amount ?? '')} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
                      </Field>
                      <Field label="Vỏ Vòi thu hồi">
                        <Input dense type="number" value={String(form.returned_shells_voi ?? '')} onChange={(e) => setForm({ ...form, returned_shells_voi: e.target.value })} />
                      </Field>
                      <Field label="Vỏ Úp thu hồi">
                        <Input dense type="number" value={String(form.returned_shells_up ?? '')} onChange={(e) => setForm({ ...form, returned_shells_up: e.target.value })} />
                      </Field>
                      <Field label="Tiền cọc vỏ (trống = tự tính)">
                        <Input
                          dense
                          type="number"
                          placeholder={formatNumber(depositAmount)}
                          value={String(form.deposit_override ?? '')}
                          onChange={(e) => setForm({ ...form, deposit_override: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                  <div className="col-span-full">
                    <Field label="Ghi chú giao">
                      <Textarea value={String(form.shipping_note ?? '')} onChange={(e) => setForm({ ...form, shipping_note: e.target.value })} />
                    </Field>
                  </div>
                </FormGrid>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-brand-navy">Danh sách sản phẩm</h3>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Thêm dòng
              </Button>
            </div>
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Sản phẩm</th>
                    <th className="w-14 px-2 py-2 text-center">ĐVT</th>
                    <th className="w-16 px-2 py-2 text-center">Tồn kho</th>
                    <th className="w-20 px-2 py-2 text-right">Số lượng</th>
                    <th className="w-20 px-2 py-2 text-right">Khuyến mãi</th>
                    <th className="w-28 px-2 py-2 text-right">Đơn giá</th>
                    <th className="w-28 px-2 py-2 text-right">Thành tiền</th>
                    <th className="w-9 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownItems.map((it, i) => {
                    const p = products.find((x) => x.id === Number(it.product_id));
                    const available = stockByProduct.get(Number(it.product_id)) ?? 0;
                    const need = (Number(it.quantity) || 0) + (Number(it.quantity_promo) || 0);
                    const overStock = !isNoStock && need > available;
                    return (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <Select dense value={String(it.product_id)} onChange={(e) => onProductChange(i, Number(e.target.value))}>
                            <option value="">-- Chọn sản phẩm --</option>
                            {sellableProducts.map((pp) => (
                              <option key={pp.id} value={pp.id}>
                                {pp.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs text-slate-500">{p?.unit ?? '—'}</td>
                        <td className={`px-2 py-1.5 text-center text-xs font-semibold ${overStock ? 'text-brand-red' : 'text-slate-500'}`}>{isNoStock ? '—' : available}</td>
                        <td className="px-2 py-1.5">
                          <Input dense type="number" value={String(it.quantity)} onChange={(e) => onQuantityChange(i, e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          {isSaleLike ? <span className="block text-right font-semibold text-amber-600">{formatNumber(Number(it.quantity_promo) || 0)}</span> :
                            <Input dense type="number" value={String(it.quantity_promo)} onChange={(e) => updateItems((prev) => prev.map((x, j) => (j === i ? { ...x, quantity_promo: e.target.value } : x)))} />}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input dense type="number" value={String(it.unit_price)} onChange={(e) => updateItems((prev) => prev.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-brand-navy">{formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Button variant="ghost" size="icon" onClick={() => updateItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                            <Trash2 className="h-4 w-4 text-brand-red" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-brand-navy">Hóa đơn & ghi chú</h3>
            </div>
            <div className="space-y-4 p-4">
              {/* Đơn cho mượn / bốc xếp không bán hàng nên không xuất hóa đơn hàng hóa. */}
              {!isFreightOnly && (
              <div className="rounded-lg border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.is_vat_invoice}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      // Tích xuất hóa đơn thì điền sẵn thuế suất đang hiệu lực nếu ô đang trống/0.
                      const vatRate = checked && !Number(form.vat_rate) ? currentVatRate : form.vat_rate;
                      setForm({ ...form, is_vat_invoice: checked, vat_rate: vatRate });
                    }}
                  />
                  Xuất hóa đơn VAT
                </label>
                {!!form.is_vat_invoice && (
                  <div className="mt-3">
                    <FormGrid cols={4}>
                      <Field label="Thuế suất (%)">
                        <Input dense type="number" value={String(form.vat_rate ?? '')} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
                      </Field>
                      <Field label="Số hóa đơn">
                        <Input dense value={String(form.vat_number ?? '')} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
                      </Field>
                      <Field label="Tên công ty">
                        <Input dense value={String(form.company_name_vat ?? '')} onChange={(e) => setForm({ ...form, company_name_vat: e.target.value })} />
                      </Field>
                      <Field label="Mã số thuế">
                        <Input dense value={String(form.tax_code_vat ?? '')} onChange={(e) => setForm({ ...form, tax_code_vat: e.target.value })} />
                      </Field>
                      <Field label="Số định danh cá nhân">
                        <Input dense value={String(form.personal_id_vat ?? '')} onChange={(e) => setForm({ ...form, personal_id_vat: e.target.value })} />
                      </Field>
                      <Field label="Mã ĐV quan hệ ngân sách">
                        <Input dense value={String(form.budget_relation_code_vat ?? '')} onChange={(e) => setForm({ ...form, budget_relation_code_vat: e.target.value })} />
                      </Field>
                      <Field label="Địa chỉ xuất hóa đơn" className="lg:col-span-2">
                        <Input dense value={String(form.address_vat ?? '')} onChange={(e) => setForm({ ...form, address_vat: e.target.value })} />
                      </Field>
                    </FormGrid>
                  </div>
                )}
              </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-5 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-600">
                {isFreightOnly ? 'Giá trị hàng tham chiếu' : 'Tiền hàng'}: <b className="text-slate-800">{formatCurrency(subtotal)}</b>
              </span>
              {(
                <span className="text-slate-600">
                  Phí ship: <b className="text-slate-800">{formatCurrency(shippingFee)}</b>
                </span>
              )}
              {!isFreightOnly && <span className="text-slate-600">
                Giảm giá: <b className="text-slate-800">{formatCurrency(discountAmount)}</b>
              </span>}
              {!isFreightOnly && (
                <span
                  className="text-slate-600"
                  title="Khoản cọc vỏ bình khách trả để được mượn bình (RO / kiềm), hoàn lại khi khách trả vỏ"
                >
                  Cọc vỏ bình: <b className="text-slate-800">{formatCurrency(depositValue)}</b>
                  <span className="ml-1 text-xs text-slate-400">
                    {depositOverrideRaw !== '' ? '(nhập tay)' : '(tự tính · hoàn lại khi trả vỏ)'}
                  </span>
                </span>
              )}
              <span className="text-slate-600">
                Tổng cộng: <b className="text-base text-brand-navy">{formatCurrency(total)}</b>
              </span>
              {showActions && (
                <>
                  {editing && onCancel && (
                    <Button variant="outline" onClick={onCancel}>
                      Hủy
                    </Button>
                  )}
                  <Button onClick={save} disabled={saving}>
                    {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Lưu nháp'}
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      </fieldset>

      <Modal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        size="md"
        title="Thêm khách hàng nhanh"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setQuickOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={quickAddCustomer}>
              Lưu vào danh sách khách hàng
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <CustomerFields form={quickForm} set={(patch) => setQuickForm({ ...quickForm, ...patch })} />
        </div>
      </Modal>
    </>
  );
}
