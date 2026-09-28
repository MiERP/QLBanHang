import { Plus } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { todayISO } from '../../lib/format';
import type { PayrollItem, ServiceJob } from '../../types';
import { PayrollReport } from './PayrollReport';

export function ServiceReportTab({ month }: { month: string }) {
  const { customers, staff, products } = useReference();
  const toast = useToast();
  const confirm = useConfirm();

  const payrollApi = useApi(() => api.fetchServicePayroll(month), [month]);
  const jobsApi = useApi(() => api.serviceJobs.list(), []);
  const serviceProducts = products.filter((p) => p.product_type === 'SERVICE');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceJob | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const blankForm = () => ({
    service_date: todayISO(),
    customer_id: '',
    employee_id: '',
    product_id: serviceProducts[0]?.id ?? '',
    quantity: 1,
    amount: '',
    note: '',
  });

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setOpen(true);
  };

  const openEdit = (item: PayrollItem) => {
    const job = (jobsApi.data ?? []).find((j) => j.id === item.id);
    if (!job) return;
    setEditing(job);
    setForm({
      service_date: job.service_date,
      customer_id: job.customer_id ?? '',
      employee_id: job.employee_id ?? '',
      product_id: job.product_id ?? '',
      quantity: job.quantity ?? 1,
      amount: job.amount,
      note: job.note ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.service_date) return toast.error('Chọn ngày thực hiện');
    if (!Number(form.amount)) return toast.error('Nhập số tiền dịch vụ');
    setSaving(true);
    try {
      if (editing) {
        await api.serviceJobs.update(editing.id, form);
        toast.success(`Đã lưu phiếu ${editing.code}`);
      } else {
        await api.serviceJobs.create(form);
        toast.success('Đã thêm phiếu dịch vụ');
      }
      setOpen(false);
      jobsApi.reload();
      payrollApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được phiếu dịch vụ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Xóa phiếu dịch vụ',
      message: `Xóa phiếu ${editing.code}? Phiếu sẽ không còn trong bảng lương.`,
      danger: true,
      confirmLabel: 'Xóa phiếu',
    });
    if (!ok) return;
    try {
      await api.serviceJobs.remove(editing.id);
      toast.success('Đã xóa phiếu dịch vụ');
      setOpen(false);
      jobsApi.reload();
      payrollApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được phiếu');
    }
  };

  return (
    <>
      <PayrollReport
        title="Báo cáo dịch vụ gia tăng"
        subtitle="Doanh thu dịch vụ (bình nóng lạnh, bể téc, máy giặt...) theo nhân viên thực hiện — chi tiết từng phiếu và tổng hợp theo tháng để tính lương."
        itemLabel="Mã phiếu"
        report={payrollApi.data}
        loading={payrollApi.loading}
        exportUrl={api.servicePayrollExportUrl(month)}
        onItemClick={openEdit}
        actions={
          <Button variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Thêm phiếu dịch vụ
          </Button>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Phiếu dịch vụ ${editing.code}` : 'Thêm phiếu dịch vụ'}
        subtitle="Ghi nhận một lần thực hiện dịch vụ để tính lương cho nhân viên"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            {editing && (
              <Button variant="danger" size="sm" onClick={remove}>
                Xóa phiếu
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm phiếu'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Ngày thực hiện" required>
              <Input type="date" value={String(form.service_date ?? '')} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
            </Field>
            <Field label="Số tiền (đ)" required>
              <Input
                type="number"
                value={String(form.amount ?? '')}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Khách hàng">
              <Select value={String(form.customer_id ?? '')} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">-- Chọn khách hàng --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nhân viên thực hiện">
              <Select value={String(form.employee_id ?? '')} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">-- Chọn nhân viên --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Loại dịch vụ">
              <Select value={String(form.product_id ?? '')} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">-- Chọn dịch vụ --</option>
                {serviceProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Số lượng">
              <Input
                type="number"
                value={String(form.quantity ?? 1)}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
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
