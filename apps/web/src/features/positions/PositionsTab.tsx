import { Briefcase, Plus } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import type { Position } from '../../types';

const emptyForm = { name: '', note: '' };

export function PositionsTab() {
  const { reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.positions.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: Position) => {
    setEditing(row);
    setForm({ name: row.name, note: row.note ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('Nhập tên chức vụ');
    try {
      if (editing) {
        await api.positions.update(editing.id, form);
        toast.success('Đã cập nhật chức vụ');
      } else {
        await api.positions.create(form);
        toast.success('Đã thêm chức vụ');
      }
      setOpen(false);
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: Position) => {
    const ok = await confirm({
      title: 'Xóa chức vụ',
      message: `Xóa chức vụ "${row.name}"?`,
      danger: true,
      confirmLabel: 'Xóa chức vụ',
    });
    if (!ok) return;
    try {
      await api.positions.remove(row.id);
      toast.success('Đã xóa chức vụ');
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<Position>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Tên chức vụ', sortValue: (r) => r.name },
    { key: 'note', header: 'Ghi chú', render: (r) => r.note || '—' },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-500">{data?.length ?? 0} chức danh · Trạm trưởng, Tổ phó, Nhân viên...</span>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Thêm chức vụ
        </Button>
      </div>
      <DataTable columns={columns} data={data ?? []} rowKey={(r) => r.id} loading={loading} onRowClick={openEdit} searchPlaceholder="Tìm theo mã hoặc tên chức vụ..." />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Chức vụ: ${editing.name}` : 'Thêm chức vụ'}
        subtitle={editing ? editing.code : 'Mã chức vụ được hệ thống tự sinh'}
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
            <Briefcase className="h-4 w-4" /> Chức danh tổ chức
          </div>
          <FormGrid cols={1}>
            <Field label="Tên chức vụ" required>
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
