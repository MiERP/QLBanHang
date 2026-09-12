import { Package, Plus } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency } from '../../lib/format';
import type { Product } from '../../types';

const BOTTLE_LABEL: Record<string, string> = { VOI: 'Bình Vòi', UP: 'Bình Úp', NONE: 'Không vỏ' };

const emptyForm = {
  code: '',
  name: '',
  category_id: '',
  unit: 'Bình',
  bottle_type: 'NONE',
  standard_price: '',
  wholesale_price: '',
  deposit_fee: '',
  has_shell_cycle: false,
  initial_stock: '',
  warehouse_id: '',
};

export function ProductsTab() {
  const { categories, warehouses, reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.products.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? '', warehouse_id: warehouses[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: Product) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      category_id: row.category_id,
      unit: row.unit,
      bottle_type: row.bottle_type,
      standard_price: row.standard_price,
      wholesale_price: row.wholesale_price,
      deposit_fee: row.deposit_fee,
      has_shell_cycle: !!row.has_shell_cycle,
    });
    setOpen(true);
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
    { key: 'unit', header: 'ĐVT', align: 'center' },
    {
      key: 'bottle_type',
      header: 'Loại vỏ',
      align: 'center',
      render: (r) => <Badge tone={r.bottle_type === 'VOI' ? 'navy' : r.bottle_type === 'UP' ? 'indigo' : 'neutral'}>{BOTTLE_LABEL[r.bottle_type]}</Badge>,
      sortValue: (r) => r.bottle_type,
    },
    { key: 'standard_price', header: 'Giá bán', align: 'right', render: (r) => formatCurrency(r.standard_price), sortValue: (r) => r.standard_price },
    { key: 'wholesale_price', header: 'Giá đại lý', align: 'right', render: (r) => formatCurrency(r.wholesale_price), sortValue: (r) => r.wholesale_price },
    { key: 'deposit_fee', header: 'Cọc vỏ', align: 'right', render: (r) => (r.deposit_fee ? formatCurrency(r.deposit_fee) : '—'), sortValue: (r) => r.deposit_fee },
  ];

  return (
    <>
      <PageHeader
        title="Sản phẩm & Bảng giá"
        subtitle={`${data?.length ?? 0} mặt hàng đang kinh doanh`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm sản phẩm
          </Button>
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
            <Field label="Nhóm hàng">
              <Select value={String(form.category_id ?? '')} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tên sản phẩm" required className="sm:col-span-2">
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Đơn vị tính">
              <Input value={String(form.unit ?? '')} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
            <Field label="Loại vỏ bình">
              <Select value={String(form.bottle_type ?? 'NONE')} onChange={(e) => setForm({ ...form, bottle_type: e.target.value })}>
                <option value="NONE">Không quản lý vỏ</option>
                <option value="VOI">Bình Vòi (VB T9)</option>
                <option value="UP">Bình Úp (VB T8)</option>
              </Select>
            </Field>
            <Field label="Giá bán chuẩn" required>
              <Input type="number" value={String(form.standard_price ?? '')} onChange={(e) => setForm({ ...form, standard_price: e.target.value })} />
            </Field>
            <Field label="Giá bán đại lý">
              <Input type="number" value={String(form.wholesale_price ?? '')} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
            </Field>
            <Field label="Tiền cọc vỏ">
              <Input type="number" value={String(form.deposit_fee ?? '')} onChange={(e) => setForm({ ...form, deposit_fee: e.target.value })} />
            </Field>
            {!editing && (
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
