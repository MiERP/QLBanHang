import { Network, Plus } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import type { PartnerUnit } from '../../types';

const emptyForm = { code: '', name: '', contact_person: '', phone: '', address: '', note: '' };

export function PartnerUnitsTab() {
  const { reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.partnerUnits.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerUnit | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: PartnerUnit) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      contact_person: row.contact_person ?? '',
      phone: row.phone ?? '',
      address: row.address ?? '',
      note: row.note ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('Nhập tên đối tác');
    try {
      if (editing) {
        await api.partnerUnits.update(editing.id, form);
        toast.success('Đã cập nhật đối tác liên kết');
      } else {
        await api.partnerUnits.create(form);
        toast.success('Đã thêm đối tác liên kết');
      }
      setOpen(false);
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: PartnerUnit) => {
    const ok = await confirm({
      title: 'Xóa đối tác liên kết',
      message: `Xóa đối tác "${row.name}"?`,
      danger: true,
      confirmLabel: 'Xóa đối tác',
    });
    if (!ok) return;
    try {
      await api.partnerUnits.remove(row.id);
      toast.success('Đã xóa đối tác liên kết');
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<PartnerUnit>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Tên đối tác', sortValue: (r) => r.name },
    { key: 'contact_person', header: 'Người liên hệ', render: (r) => r.contact_person ?? '—' },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone ?? '—' },
    { key: 'address', header: 'Địa chỉ', render: (r) => r.address ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title="Đối tác liên kết"
        subtitle={`${data?.length ?? 0} đơn vị bạn · dùng để đánh dấu đơn hàng cho mượn`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm đối tác
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={openEdit}
        searchPlaceholder="Tìm theo mã hoặc tên đối tác..."
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Đối tác: ${editing.name}` : 'Thêm đối tác liên kết'}
        subtitle="Đơn vị bạn trong cùng công ty mẹ"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            {editing && (
              <Button variant="danger" size="sm" onClick={() => remove(editing)}>
                Xóa
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
            <Network className="h-4 w-4" /> Đối tác liên kết — xí nghiệp bạn trong cùng công ty mẹ
          </div>
          <FormGrid cols={2}>
            <Field label="Mã đối tác" hint="Để trống sẽ tự sinh">
              <Input value={String(form.code ?? '')} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Tên đối tác" required>
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Người liên hệ">
              <Input value={String(form.contact_person ?? '')} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </Field>
            <Field label="Điện thoại">
              <Input value={String(form.phone ?? '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Địa chỉ" className="sm:col-span-2">
              <Input value={String(form.address ?? '')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Ghi chú" className="sm:col-span-2">
              <Input value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
