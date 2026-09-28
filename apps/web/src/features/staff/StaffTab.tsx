import { Plus, UserCog } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import type { Employee } from '../../types';

const emptyForm = {
  full_name: '',
  position_id: '',
  org_unit_id: '',
  phone: '',
  home_address: '',
  date_of_birth: '',
  gender: '',
  id_number: '',
  join_date: '',
  education: '',
  commission_rate: '',
  shipping_allowance: '',
};

export function StaffTab() {
  const { orgUnits, positions, reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.staff.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, org_unit_id: orgUnits[0]?.id ?? '', position_id: positions[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: Employee) => {
    setEditing(row);
    setForm({
      full_name: row.full_name,
      position_id: row.position_id ?? '',
      org_unit_id: row.org_unit_id ?? '',
      phone: row.phone ?? '',
      home_address: row.home_address ?? '',
      date_of_birth: row.date_of_birth ?? '',
      gender: row.gender ?? '',
      id_number: row.id_number ?? '',
      join_date: row.join_date ?? '',
      education: row.education ?? '',
      commission_rate: row.commission_rate ?? '',
      shipping_allowance: row.shipping_allowance ?? '',
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
    { key: 'position_name', header: 'Chức vụ', render: (r) => r.position_name ?? '—', sortValue: (r) => r.position_name ?? '' },
    { key: 'org_unit_name', header: 'Đơn vị', render: (r) => r.org_unit_name ?? '—', sortValue: (r) => r.org_unit_name ?? '' },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone || '—' },
    { key: 'join_date', header: 'Ngày vào làm', render: (r) => r.join_date || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Danh sách nhân viên"
        subtitle={`${data?.length ?? 0} cán bộ công nhân viên đang công tác`}
        actions={
          <>
            <ImportExcelButton
              kind="staff"
              hint="Nhập nhân viên từ Excel. Nên nhập đơn vị và chức vụ trước để gán được đơn vị công tác."
              onDone={() => {
                reload();
                reloadRefs();
              }}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm nhân viên
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
        searchPlaceholder="Tìm theo mã, tên, chức vụ..."
        initialSortKey="code"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Hồ sơ: ${editing.full_name}` : 'Thêm nhân viên mới'}
        subtitle={editing ? editing.code : 'Khai báo hồ sơ lý lịch CBCNV'}
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
            <UserCog className="h-4 w-4" /> Hồ sơ nhân sự
          </div>
          <FormGrid cols={2}>
            <Field label="Họ và tên" required className="sm:col-span-2">
              <Input value={String(form.full_name ?? '')} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Đơn vị công tác">
              <Select value={String(form.org_unit_id ?? '')} onChange={(e) => setForm({ ...form, org_unit_id: e.target.value })}>
                <option value="">-- Chọn đơn vị --</option>
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Chức vụ">
              <Select value={String(form.position_id ?? '')} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
                <option value="">-- Chọn chức vụ --</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Điện thoại">
              <Input value={String(form.phone ?? '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Ngày sinh">
              <Input type="date" value={String(form.date_of_birth ?? '')} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </Field>
            <Field label="Giới tính">
              <Select value={String(form.gender ?? '')} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">-- Chọn --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </Select>
            </Field>
            <Field label="Số định danh (CCCD/CMND)">
              <Input value={String(form.id_number ?? '')} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
            </Field>
            <Field label="Ngày vào làm">
              <Input type="date" value={String(form.join_date ?? '')} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
            </Field>
            <Field label="Trình độ">
              <Input value={String(form.education ?? '')} onChange={(e) => setForm({ ...form, education: e.target.value })} />
            </Field>
            <Field label="Tỷ lệ hoa hồng">
              <Input type="number" value={String(form.commission_rate ?? '')} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
            </Field>
            <Field label="Phụ cấp giao hàng">
              <Input type="number" value={String(form.shipping_allowance ?? '')} onChange={(e) => setForm({ ...form, shipping_allowance: e.target.value })} />
            </Field>
            <Field label="Địa chỉ" className="sm:col-span-2">
              <Textarea value={String(form.home_address ?? '')} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
