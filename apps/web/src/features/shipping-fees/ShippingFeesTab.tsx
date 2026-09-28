import { MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useApi } from '../../lib/hooks';
import { formatCurrency } from '../../lib/format';
import type { ShippingFee } from '../../types';

const emptyForm = {
  name: '',
  fee_per_unit: 5000,
  is_active: true,
  note: '',
};

export function ShippingFeesTab() {
  const { data, loading, reload } = useApi(() => api.shippingFees.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingFee | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: ShippingFee) => {
    setEditing(row);
    setForm({
      name: row.name,
      fee_per_unit: row.fee_per_unit,
      is_active: !!row.is_active,
      note: row.note ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('Nhập tên tuyến/khu vực');
    try {
      const payload = {
        name: form.name,
        fee_per_unit: Number(form.fee_per_unit) || 0,
        is_active: form.is_active ? 1 : 0,
        note: form.note || '',
      };
      if (editing) {
        await api.shippingFees.update(editing.id, payload);
        toast.success('Đã cập nhật phí vận chuyển');
      } else {
        await api.shippingFees.create(payload);
        toast.success('Đã thêm phí vận chuyển');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: ShippingFee) => {
    const ok = await confirm({
      title: 'Ngừng áp dụng phí',
      message: `Ngừng áp dụng "${row.name}"?`,
      danger: true,
      confirmLabel: 'Ngừng áp dụng',
    });
    if (!ok) return;
    try {
      await api.shippingFees.remove(row.id);
      toast.success('Đã ngừng áp dụng');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<ShippingFee>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Tuyến / khu vực', sortValue: (r) => r.name },
    { key: 'fee_per_unit', header: 'Phí/đơn vị', align: 'right', render: (r) => formatCurrency(r.fee_per_unit), sortValue: (r) => r.fee_per_unit },
    {
      key: 'is_active',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => (r.is_active ? <Badge tone="green">Đang áp dụng</Badge> : <Badge tone="neutral">Ngừng</Badge>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Phí vận chuyển"
        subtitle={`${data?.length ?? 0} tuyến · 5.000₫/đơn vị áp cho 1 Hộp = 1 Vỉ = 1 Bình`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm tuyến
          </Button>
        }
      />
      <DataTable columns={columns} data={data ?? []} rowKey={(r) => r.id} loading={loading} onRowClick={openEdit} searchPlaceholder="Tìm theo mã hoặc tuyến..." />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Phí vận chuyển: ${editing.name}` : 'Thêm tuyến phí vận chuyển'}
        subtitle={editing ? editing.code : 'Mã tuyến được hệ thống tự sinh'}
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
            <MapPin className="h-4 w-4" /> Cấu hình phí theo tuyến
          </div>
          <FormGrid cols={2}>
            <Field label="Tên tuyến / khu vực" required className="sm:col-span-2">
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phí theo đơn vị" hint="Mặc định 5.000₫ cho 1 hộp/vỉ/bình">
              <Input type="number" value={String(form.fee_per_unit ?? '')} onChange={(e) => setForm({ ...form, fee_per_unit: e.target.value })} />
            </Field>
            <Field label="Trạng thái">
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <span className="text-sm text-slate-700">Đang áp dụng</span>
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
