import { Package, Plus } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useApi } from '../../lib/hooks';
import type { ImportSource } from '../../types';

const emptyForm = { name: '', note: '' };

export function ImportSourcesTab() {
  const { data, loading, reload } = useApi(() => api.importSources.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ImportSource | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: ImportSource) => {
    setEditing(row);
    setForm({ name: row.name, note: row.note ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('Nhập tên nguồn nhập');
    try {
      if (editing) {
        await api.importSources.update(editing.id, form);
        toast.success('Đã cập nhật nguồn nhập');
      } else {
        await api.importSources.create(form);
        toast.success('Đã thêm nguồn nhập');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: ImportSource) => {
    const ok = await confirm({ title: 'Xóa nguồn nhập', message: `Xóa nguồn "${row.name}"?`, danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await api.importSources.remove(row.id);
      toast.success('Đã xóa nguồn nhập');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<ImportSource>[] = [
    { key: 'name', header: 'Tên nguồn nhập', sortValue: (r) => r.name },
    { key: 'note', header: 'Ghi chú', render: (r) => r.note || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Nguồn nhập"
        subtitle={`${data?.length ?? 0} nguồn · Xưởng sản xuất, Nhà cung cấp...`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm nguồn
          </Button>
        }
      />
      <DataTable columns={columns} data={data ?? []} rowKey={(r) => r.id} loading={loading} onRowClick={openEdit} searchPlaceholder="Tìm theo tên nguồn..." />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Nguồn nhập: ${editing.name}` : 'Thêm nguồn nhập'}
        subtitle="Mã nguồn được hệ thống tự sinh"
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
            <Package className="h-4 w-4" /> Nguồn nhập kho
          </div>
          <FormGrid cols={1}>
            <Field label="Tên nguồn nhập" required>
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Ghi chú">
              <Textarea value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
