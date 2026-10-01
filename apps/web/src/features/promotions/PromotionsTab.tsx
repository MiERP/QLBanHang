import { Gift, Plus } from 'lucide-react';
import { useState } from 'react';
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
import { formatDate } from '../../lib/format';
import type { Promotion } from '../../types';

const emptyForm = {
  name: '',
  scope: 'product',
  product_id: '',
  category_id: '',
  buy_quantity: 10,
  free_quantity: 1,
  start_date: '',
  end_date: '',
  is_active: true,
  note: '',
};

export function PromotionsTab() {
  const { products, categories } = useReference();
  const { data, loading, reload } = useApi(() => api.promotions.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, product_id: products[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: Promotion) => {
    setEditing(row);
    setForm({
      name: row.name,
      scope: row.product_id ? 'product' : row.category_id ? 'category' : 'all',
      product_id: row.product_id ?? '',
      category_id: row.category_id ?? '',
      buy_quantity: row.buy_quantity,
      free_quantity: row.free_quantity,
      start_date: row.start_date ?? '',
      end_date: row.end_date ?? '',
      is_active: !!row.is_active,
      note: row.note ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.buy_quantity || !form.free_quantity) return toast.error('Nhập tên, số lượng mua và số lượng tặng');
    try {
      const payload = {
        name: form.name,
        product_id: form.scope === 'product' ? form.product_id || null : null,
        category_id: form.scope === 'category' ? form.category_id || null : null,
        buy_quantity: Number(form.buy_quantity),
        free_quantity: Number(form.free_quantity),
        free_product_id: null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: form.is_active ? 1 : 0,
        note: form.note || '',
      };
      if (editing) {
        await api.promotions.update(editing.id, payload);
        toast.success('Đã cập nhật khuyến mãi');
      } else {
        await api.promotions.create(payload);
        toast.success('Đã thêm khuyến mãi');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: Promotion) => {
    const ok = await confirm({
      title: 'Ngừng khuyến mãi',
      message: `Ngừng chương trình "${row.name}"?`,
      danger: true,
      confirmLabel: 'Ngừng áp dụng',
    });
    if (!ok) return;
    try {
      await api.promotions.remove(row.id);
      toast.success('Đã ngừng khuyến mãi');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<Promotion>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Chương trình', sortValue: (r) => r.name },
    {
      key: 'scope',
      header: 'Áp dụng cho',
      render: (r) => (r.product_name ? r.product_name : r.category_name ? `Nhóm: ${r.category_name}` : 'Toàn bộ'),
    },
    {
      key: 'rule',
      header: 'Quy tắc',
      render: (r) => `Mua ${r.buy_quantity} tặng ${r.free_quantity}`,
    },
    { key: 'start_date', header: 'Từ', render: (r) => formatDate(r.start_date) },
    { key: 'end_date', header: 'Đến', render: (r) => formatDate(r.end_date) },
    {
      key: 'is_active',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => (r.free_product_id ? <Badge tone="amber">Cần sửa</Badge> : r.is_active ? <Badge tone="green">Đang chạy</Badge> : <Badge tone="neutral">Ngừng</Badge>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Khuyến mãi"
        subtitle={`${data?.length ?? 0} chương trình · tự động tính hàng tặng khi tạo đơn`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm khuyến mãi
          </Button>
        }
      />
      <DataTable columns={columns} data={data ?? []} rowKey={(r) => r.id} loading={loading} onRowClick={openEdit} searchPlaceholder="Tìm theo mã hoặc chương trình..." />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Khuyến mãi: ${editing.name}` : 'Thêm khuyến mãi mua tặng'}
        subtitle={editing ? editing.code : 'Mã khuyến mãi được hệ thống tự sinh'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            {editing && (
              <Button variant="danger" size="sm" onClick={() => remove(editing)}>
                Ngừng áp dụng
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
            <Gift className="h-4 w-4" /> Quy tắc mua X tặng Y
          </div>
          <FormGrid cols={2}>
            <Field label="Tên chương trình" required className="sm:col-span-2">
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Áp dụng theo">
              <Select value={String(form.scope ?? 'product')} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="all">Tất cả sản phẩm</option>
                <option value="category">Nhóm sản phẩm</option>
                <option value="product">Sản phẩm cụ thể</option>
              </Select>
            </Field>
            {form.scope === 'all' ? (
              <Field label="Phạm vi áp dụng">
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">
                  Áp dụng cho mọi sản phẩm
                </div>
              </Field>
            ) : form.scope === 'product' ? (
              <Field label="Sản phẩm áp dụng">
                <Select value={String(form.product_id ?? '')} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Nhóm sản phẩm áp dụng">
                <Select value={String(form.category_id ?? '')} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Số lượng mua" required>
              <Input type="number" value={String(form.buy_quantity ?? '')} onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })} />
            </Field>
            <Field label="Số lượng tặng" required>
              <Input type="number" value={String(form.free_quantity ?? '')} onChange={(e) => setForm({ ...form, free_quantity: e.target.value })} />
            </Field>
            <p className="text-sm text-slate-600">Hàng tặng là chính sản phẩm được mua khi đạt đủ số lượng.</p>
            <Field label="Ngày bắt đầu">
              <Input type="date" value={String(form.start_date ?? '')} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </Field>
            <Field label="Ngày kết thúc">
              <Input type="date" value={String(form.end_date ?? '')} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
            <Field label="Trạng thái">
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <span className="text-sm text-slate-700">Đang chạy</span>
              </label>
            </Field>
            <Field label="Ghi chú" className="sm:col-span-2">
              <Textarea value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
