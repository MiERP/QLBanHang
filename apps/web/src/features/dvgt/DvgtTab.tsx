import { Plus, Wrench } from 'lucide-react';
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
import { formatCurrency, formatDate } from '../../lib/format';
import type { DvgtRequest } from '../../types';

const STATUS: Record<string, { label: string; tone: 'amber' | 'cyan' | 'green' | 'red' | 'neutral' }> = {
  REGISTERED: { label: 'Đã đăng ký', tone: 'amber' },
  ASSIGNED: { label: 'Đã phân công', tone: 'cyan' },
  IN_PROGRESS: { label: 'Đang thực hiện', tone: 'cyan' },
  COMPLETED: { label: 'Hoàn thành', tone: 'green' },
  CANCELLED: { label: 'Đã hủy', tone: 'red' },
};

const emptyForm = {
  customer_name: '',
  phone: '',
  address: '',
  service_product_id: '',
  seller_employee_id: '',
  technician_employee_id: '',
  station_id: '',
  scheduled_date: '',
  completed_date: '',
  status: 'REGISTERED',
  revenue_amount: '',
  payment_status: 'UNPAID',
  note: '',
};

export function DvgtTab() {
  const { products, staff, stations, reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.dvgt.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const services = products.filter((p) => p.category_type === 'SERVICE_DVGT');
  const technicians = staff.filter((s) => s.role_id === 7);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DvgtRequest | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, service_product_id: services[0]?.id ?? '', seller_employee_id: staff[0]?.id ?? '', station_id: stations[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: DvgtRequest) => {
    setEditing(row);
    setForm({
      customer_name: row.customer_name,
      phone: row.phone,
      address: row.address,
      service_product_id: row.service_product_id,
      seller_employee_id: row.seller_employee_id,
      technician_employee_id: row.technician_employee_id ?? '',
      station_id: row.station_id ?? '',
      scheduled_date: row.scheduled_date ?? '',
      completed_date: row.completed_date ?? '',
      status: row.status,
      revenue_amount: row.revenue_amount,
      payment_status: row.payment_status,
      note: row.note ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.customer_name || !form.phone || !form.address) return toast.error('Nhập tên, điện thoại và địa chỉ khách hàng');
    try {
      if (editing) {
        await api.dvgt.update(editing.id, form);
        toast.success('Đã cập nhật yêu cầu DVGT');
      } else {
        await api.dvgt.create(form);
        toast.success('Đã đăng ký yêu cầu DVGT');
      }
      setOpen(false);
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: DvgtRequest) => {
    const ok = await confirm({
      title: 'Xóa yêu cầu DVGT',
      message: `Xóa yêu cầu ${row.request_code}?`,
      danger: true,
      confirmLabel: 'Xóa',
    });
    if (!ok) return;
    try {
      await api.dvgt.remove(row.id);
      toast.success('Đã xóa yêu cầu DVGT');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được');
    }
  };

  const columns: Column<DvgtRequest>[] = [
    { key: 'request_code', header: 'Mã yêu cầu', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.request_code },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'service_name', header: 'Dịch vụ', render: (r) => r.service_name ?? '—' },
    { key: 'seller_name', header: 'Người bán', render: (r) => r.seller_name ?? '—' },
    { key: 'technician_name', header: 'Kỹ thuật viên', render: (r) => r.technician_name ?? '—' },
    { key: 'scheduled_date', header: 'Ngày hẹn', render: (r) => formatDate(r.scheduled_date), sortValue: (r) => r.scheduled_date ?? '' },
    { key: 'revenue_amount', header: 'Doanh thu', align: 'right', render: (r) => formatCurrency(r.revenue_amount), sortValue: (r) => r.revenue_amount },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => <Badge tone={STATUS[r.status]?.tone ?? 'neutral'}>{STATUS[r.status]?.label ?? r.status}</Badge>,
      sortValue: (r) => r.status,
    },
    {
      key: 'payment_status',
      header: 'Thu tiền',
      align: 'center',
      render: (r) => <Badge tone={r.payment_status === 'PAID' ? 'green' : 'red'}>{r.payment_status === 'PAID' ? 'Đã thu' : 'Chưa thu'}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dịch vụ gia tăng"
        subtitle="Đăng ký và thực hiện dịch vụ bình nóng lạnh, súc rửa bể téc, máy giặt"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Đăng ký dịch vụ
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={openEdit}
        searchPlaceholder="Tìm theo mã, khách hàng, dịch vụ..."
        initialSortKey="request_code"
        initialSortDir="desc"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? `Yêu cầu ${editing.request_code}` : 'Đăng ký dịch vụ gia tăng'}
        subtitle="Thông tin khách hàng, dịch vụ và phân công kỹ thuật"
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
              {editing ? 'Lưu thay đổi' : 'Đăng ký'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2 rounded-lg bg-brand-cyan-subtle px-3 py-2 text-xs text-brand-navy">
            <Wrench className="h-4 w-4" /> Yêu cầu hoàn thành và thu tiền sẽ tự động ghi vào Sổ quỹ thu.
          </div>
          <FormGrid cols={2}>
            <Field label="Tên khách hàng" required>
              <Input value={String(form.customer_name ?? '')} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </Field>
            <Field label="Điện thoại" required>
              <Input value={String(form.phone ?? '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Địa chỉ" required className="sm:col-span-2">
              <Textarea value={String(form.address ?? '')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Dịch vụ" required>
              <Select value={String(form.service_product_id ?? '')} onChange={(e) => setForm({ ...form, service_product_id: e.target.value })}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Người bán / giới thiệu">
              <Select value={String(form.seller_employee_id ?? '')} onChange={(e) => setForm({ ...form, seller_employee_id: e.target.value })}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kỹ thuật viên">
              <Select value={String(form.technician_employee_id ?? '')} onChange={(e) => setForm({ ...form, technician_employee_id: e.target.value })}>
                <option value="">-- Chưa phân công --</option>
                {technicians.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Trạm">
              <Select value={String(form.station_id ?? '')} onChange={(e) => setForm({ ...form, station_id: e.target.value })}>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày hẹn">
              <Input type="date" value={String(form.scheduled_date ?? '')} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </Field>
            <Field label="Ngày hoàn thành">
              <Input type="date" value={String(form.completed_date ?? '')} onChange={(e) => setForm({ ...form, completed_date: e.target.value })} />
            </Field>
            <Field label="Trạng thái">
              <Select value={String(form.status ?? 'REGISTERED')} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Doanh thu dịch vụ">
              <Input type="number" value={String(form.revenue_amount ?? '')} onChange={(e) => setForm({ ...form, revenue_amount: e.target.value })} />
            </Field>
            <Field label="Trạng thái thu tiền">
              <Select value={String(form.payment_status ?? 'UNPAID')} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                <option value="UNPAID">Chưa thu</option>
                <option value="PAID">Đã thu</option>
              </Select>
            </Field>
          </FormGrid>
          <Field label="Ghi chú">
            <Input value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
