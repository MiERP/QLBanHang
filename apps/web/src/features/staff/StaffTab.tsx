import { Plus, UserCog } from 'lucide-react';
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
import type { Employee } from '../../types';

const emptyForm = { full_name: '', position: '', phone: '', station_id: '', role_id: '' };

export function StaffTab() {
  const { stations, roles, reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.staff.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, station_id: stations[0]?.id ?? '', role_id: roles[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: Employee) => {
    setEditing(row);
    setForm({
      full_name: row.full_name,
      position: row.position,
      phone: row.phone,
      station_id: row.station_id ?? '',
      role_id: row.role_id ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name) return toast.error('Vui lòng nhập họ tên nhân viên');
    try {
      if (editing) {
        await api.staff.update(editing.id, form);
        toast.success('Đã cập nhật nhân viên');
      } else {
        await api.staff.create(form);
        toast.success('Đã thêm nhân viên mới');
      }
      setOpen(false);
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: Employee) => {
    const ok = await confirm({
      title: 'Cho thôi việc',
      message: `Bạn chắc chắn muốn cho "${row.full_name}" thôi việc? Hồ sơ sẽ được ẩn khỏi danh sách.`,
      danger: true,
      confirmLabel: 'Cho thôi việc',
    });
    if (!ok) return;
    try {
      await api.staff.remove(row.id);
      toast.success('Đã cập nhật trạng thái nhân sự');
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const columns: Column<Employee>[] = [
    { key: 'code', header: 'Mã NV', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'full_name', header: 'Họ và tên', sortValue: (r) => r.full_name },
    { key: 'position', header: 'Chức danh', sortValue: (r) => r.position },
    { key: 'station_name', header: 'Trạm công tác', render: (r) => r.station_name ?? '—' },
    {
      key: 'role_name',
      header: 'Vai trò',
      render: (r) => <Badge tone={r.role_id === 4 ? 'cyan' : 'navy'}>{r.role_name ?? '—'}</Badge>,
      sortValue: (r) => r.role_name ?? '',
    },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Nhân sự & Phân quyền"
        subtitle={`${data?.length ?? 0} cán bộ công nhân viên đang công tác`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm nhân viên
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={openEdit}
        searchPlaceholder="Tìm theo mã, tên, chức danh..."
        initialSortKey="code"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Hồ sơ: ${editing.full_name}` : 'Thêm nhân viên mới'}
        subtitle={editing ? editing.code : 'Khai báo hồ sơ CBCNV và vai trò'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            {editing && (
              <Button variant="danger" size="sm" onClick={() => remove(editing)}>
                Cho thôi việc
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
            <UserCog className="h-4 w-4" /> Thông tin nhân sự & phân quyền
          </div>
          <FormGrid cols={2}>
            <Field label="Họ và tên" required>
              <Input value={String(form.full_name ?? '')} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Chức danh">
              <Input value={String(form.position ?? '')} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </Field>
            <Field label="Trạm công tác">
              <Select value={String(form.station_id ?? '')} onChange={(e) => setForm({ ...form, station_id: e.target.value })}>
                <option value="">-- Chọn trạm --</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vai trò / Phân quyền" required>
              <Select value={String(form.role_id ?? '')} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                <option value="">-- Chọn vai trò --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Điện thoại">
              <Input value={String(form.phone ?? '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
