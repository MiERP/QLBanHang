import { Package, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency } from '../../lib/format';
import type { Product } from '../../types';

const BOTTLE_LABEL: Record<string, string> = { VOI: 'Bình Vòi', UP: 'Bình Úp', NONE: 'Không vỏ' };
const UNIT_OPTIONS = ['Bình', 'Vỉ', 'Hộp', 'Lần', 'Hệ thống', 'Máy'];

const emptyForm = {
  code: '',
  barcode: '',
  name: '',
  category_id: '',
  unit: 'Bình',
  product_type: 'GOODS',
  bottle_type: 'NONE',
  standard_price: '',
  cost_price: '',
  deposit_fee: '',
  has_shell_cycle: false,
  initial_stock: '',
  warehouse_id: '',
};

export function ProductsTab() {
  const { categories, warehouses, reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.products.list(), []);
  const vatApi = useApi(() => api.vatRates.list(), []);

  // Thuế suất đang hiệu lực (danh mục sắp xếp hiệu lực mới nhất trước) — dùng để suy giá trước thuế.
  const vatRate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = (vatApi.data ?? []).filter(
      (v) => (!v.effective_from || v.effective_from <= today) && (!v.effective_to || v.effective_to >= today)
    );
    return active.length ? active[0].rate : 0;
  }, [vatApi.data]);

  const netPriceOf = (gross: unknown) => {
    const value = Number(gross);
    if (!Number.isFinite(value) || value <= 0) return '';
    return Math.round(value / (1 + vatRate / 100));
  };

  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const categoryType = (categoryId: string | number) => categories.find((c) => c.id === Number(categoryId))?.type;
  const isService = form.product_type === 'SERVICE';
  const isBinh = !isService && String(form.unit ?? '') === 'Bình';

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? '', warehouse_id: warehouses[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: Product) => {
    setEditing(row);
    setForm({
      code: row.code,
      barcode: row.barcode ?? '',
      name: row.name,
      category_id: row.category_id,
      unit: row.unit,
      product_type: row.product_type ?? 'GOODS',
      bottle_type: row.bottle_type,
      standard_price: row.standard_price,
      cost_price: row.cost_price,
      deposit_fee: row.deposit_fee,
      has_shell_cycle: !!row.has_shell_cycle,
    });
    setOpen(true);
  };

  const changeCategory = (value: string) => {
    const type = categoryType(value);
    const unit = type === 'BOTTLE_WATER' ? 'Bình' : type === 'PACK_WATER' ? 'Vỉ' : type === 'SERVICE_DVGT' ? 'Lần' : 'Bình';
    const productType = type === 'SERVICE_DVGT' ? 'SERVICE' : 'GOODS';
    const service = productType === 'SERVICE';
    setForm({
      ...form,
      category_id: value,
      unit,
      product_type: productType,
      bottle_type: !service && unit === 'Bình' ? form.bottle_type : 'NONE',
      deposit_fee: !service && unit === 'Bình' ? form.deposit_fee : '',
      has_shell_cycle: !service && unit === 'Bình' ? form.has_shell_cycle : false,
    });
  };

  const changeUnit = (value: string) => {
    const binh = value === 'Bình';
    setForm({
      ...form,
      unit: value,
      bottle_type: binh ? form.bottle_type : 'NONE',
      deposit_fee: binh ? form.deposit_fee : '',
      has_shell_cycle: binh ? form.has_shell_cycle : false,
    });
  };

  const save = async () => {
    if (!form.name || !form.standard_price) return toast.error('Nhập tên và giá bán sản phẩm');
    try {
      const payload = { ...form, has_shell_cycle: form.has_shell_cycle ? 1 : 0 };
      if (editing) {
        await api.products.update(editing.id, payload);
        toast.success('Đã cập nhật sản phẩm');
      } else {
        await api.products.create(payload);
        toast.success('Đã thêm sản phẩm mới');
      }
      setOpen(false);
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: Product) => {
    const ok = await confirm({
      title: 'Ngừng bán sản phẩm',
      message: `Ngừng bán "${row.name}"? Sản phẩm sẽ ẩn khỏi danh mục nhưng dữ liệu đơn hàng cũ vẫn giữ nguyên.`,
      danger: true,
      confirmLabel: 'Ngừng bán',
    });
    if (!ok) return;
    try {
      await api.products.remove(row.id);
      toast.success('Đã ngừng bán sản phẩm');
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<Product>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Tên sản phẩm', sortValue: (r) => r.name },
    { key: 'category_name', header: 'Nhóm hàng', render: (r) => r.category_name ?? '—' },
    {
      key: 'product_type',
      header: 'Phân loại',
      align: 'center',
      render: (r) =>
        r.product_type === 'SERVICE' ? <Badge tone="indigo">Dịch vụ</Badge> : <Badge tone="cyan">Để bán</Badge>,
      sortValue: (r) => r.product_type ?? 'GOODS',
    },
    { key: 'unit', header: 'ĐVT', align: 'center' },
    {
      key: 'bottle_type',
      header: 'Loại vỏ',
      align: 'center',
      render: (r) => <Badge tone={r.bottle_type === 'VOI' ? 'navy' : r.bottle_type === 'UP' ? 'indigo' : 'neutral'}>{BOTTLE_LABEL[r.bottle_type]}</Badge>,
      sortValue: (r) => r.bottle_type,
    },
    { key: 'standard_price', header: 'Giá bán', align: 'right', render: (r) => formatCurrency(r.standard_price), sortValue: (r) => r.standard_price },
    { key: 'cost_price', header: 'Giá trước thuế', align: 'right', render: (r) => formatCurrency(r.cost_price), sortValue: (r) => r.cost_price },
    { key: 'deposit_fee', header: 'Cọc vỏ', align: 'right', render: (r) => (r.deposit_fee ? formatCurrency(r.deposit_fee) : '—'), sortValue: (r) => r.deposit_fee },
  ];

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        subtitle={`${data?.length ?? 0} mặt hàng đang kinh doanh · đơn vị tối thiểu Hộp / Vỉ / Bình`}
        actions={
          <>
            <ImportExcelButton
              kind="products"
              hint="Nhập sản phẩm từ Excel. Cần có sẵn nhóm hàng trước khi nhập. Tồn kho đầu kỳ nhập ở màn Kho → Tồn kho."
              onDone={() => {
                reload();
                reloadRefs();
              }}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm sản phẩm
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={openEdit}
        searchPlaceholder="Tìm theo mã hoặc tên sản phẩm..."
        initialSortKey="code"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Sản phẩm: ${editing.name}` : 'Thêm sản phẩm mới'}
        subtitle={editing ? editing.code : 'Khai báo mặt hàng, giá bán và tiền cọc vỏ'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            {editing && (
              <Button variant="danger" size="sm" onClick={() => remove(editing)}>
                Ngừng bán
              </Button>
            )}
            <Button size="sm" onClick={save}>
              {editing ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2 rounded-lg bg-brand-cyan-subtle px-3 py-2 text-xs text-brand-navy">
            <Package className="h-4 w-4" /> Thông tin mặt hàng
          </div>
          <FormGrid cols={2}>
            <Field label="Mã sản phẩm" hint={editing ? undefined : 'Để trống để hệ thống tự sinh'}>
              <Input value={String(form.code ?? '')} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Mã vạch">
              <Input value={String(form.barcode ?? '')} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </Field>
            <Field label="Nhóm hàng">
              <Select value={String(form.category_id ?? '')} onChange={(e) => changeCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Phân loại"
              required
              hint={isService ? 'Dịch vụ: không có tồn kho, không lên đơn hàng' : 'Hàng bán: có tồn kho, lên đơn hàng được'}
            >
              <Select
                value={String(form.product_type ?? 'GOODS')}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({
                    ...form,
                    product_type: v,
                    bottle_type: v === 'SERVICE' ? 'NONE' : form.bottle_type,
                    deposit_fee: v === 'SERVICE' ? '' : form.deposit_fee,
                    has_shell_cycle: v === 'SERVICE' ? false : form.has_shell_cycle,
                  });
                }}
              >
                <option value="GOODS">Sản phẩm để bán</option>
                <option value="SERVICE">Dịch vụ gia tăng</option>
              </Select>
            </Field>
            <Field label="Đơn vị tính">
              <Select value={String(form.unit ?? '')} onChange={(e) => changeUnit(e.target.value)}>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tên sản phẩm" required className="sm:col-span-2">
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            {!isService && (
              <Field label="Loại vỏ bình" hint={isBinh ? undefined : 'Chỉ áp dụng cho loại Bình'}>
                <Select
                  value={String(form.bottle_type ?? 'NONE')}
                  disabled={!isBinh}
                  onChange={(e) => setForm({ ...form, bottle_type: e.target.value })}
                >
                  {isBinh ? (
                    <>
                      <option value="VOI">Bình Vòi (VB T9)</option>
                      <option value="UP">Bình Úp (VB T8)</option>
                    </>
                  ) : (
                    <option value="NONE">Không quản lý vỏ</option>
                  )}
                </Select>
              </Field>
            )}
            {!isService && (
              <Field label="Vòng quay vỏ" hint={isBinh ? 'Theo dõi nợ vỏ Vòi/Úp' : 'Chỉ áp dụng cho loại Bình'}>
                <label className="flex h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form.has_shell_cycle}
                    disabled={!isBinh}
                    onChange={(e) => setForm({ ...form, has_shell_cycle: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Có theo dõi nợ vỏ</span>
                </label>
              </Field>
            )}
            <Field label="Giá bán (mặc định)" required>
              <Input
                type="number"
                value={String(form.standard_price ?? '')}
                onChange={(e) => {
                  const value = e.target.value;
                  // Đổi giá bán → giá trước thuế tự cập nhật theo thuế suất hiện hành.
                  setForm({ ...form, standard_price: value, cost_price: netPriceOf(value) });
                }}
              />
            </Field>
            <Field label="Giá trước thuế">
              <Input type="number" value={String(form.cost_price ?? '')} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </Field>
            {!isService && (
              <Field label="Tiền cọc vỏ" hint={isBinh ? 'Áp dụng cho bình' : 'Chỉ áp dụng cho loại Bình'}>
                <Input type="number" disabled={!isBinh} value={String(form.deposit_fee ?? '')} onChange={(e) => setForm({ ...form, deposit_fee: e.target.value })} />
              </Field>
            )}
            {!editing && !isService && (
              <>
                <Field label="Tồn kho ban đầu">
                  <Input type="number" value={String(form.initial_stock ?? '')} onChange={(e) => setForm({ ...form, initial_stock: e.target.value })} />
                </Field>
                <Field label="Nhập vào kho">
                  <Select value={String(form.warehouse_id ?? '')} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
