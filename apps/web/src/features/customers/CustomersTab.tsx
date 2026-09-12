import { Plus, RotateCcw, Users } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import type { BottleLedger, Customer } from '../../types';

const emptyForm = {
  name: '',
  group_id: '',
  phone: '',
  address: '',
  tax_code: '',
  contact_person: '',
  max_debt_limit: '',
  bottle_debt_voi: '',
  bottle_debt_up: '',
};

export function CustomersTab() {
  const { groups, staff, reload: reloadRefs } = useReference();
  const customersApi = useApi(() => api.customers.list(), []);
  const ledgersApi = useApi(() => api.fetchBottleLedgers(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('list');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const [returnCustomer, setReturnCustomer] = useState<Customer | null>(null);
  const [returnForm, setReturnForm] = useState<Record<string, unknown>>({ returned_voi: '', returned_up: '', handled_by: '', note: '' });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, group_id: groups[0]?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (row: Customer) => {
    setEditing(row);
    setForm({
      name: row.name,
      group_id: row.group_id ?? '',
      phone: row.phone ?? '',
      address: row.address,
      tax_code: row.tax_code ?? '',
      contact_person: row.contact_person ?? '',
      max_debt_limit: row.max_debt_limit,
      bottle_debt_voi: row.bottle_debt_voi,
      bottle_debt_up: row.bottle_debt_up,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.address) return toast.error('Nhập tên và địa chỉ khách hàng');
    try {
      if (editing) {
        await api.customers.update(editing.id, form);
        toast.success('Đã cập nhật khách hàng');
      } else {
        await api.customers.create(form);
        toast.success('Đã thêm khách hàng mới');
      }
      setOpen(false);
      customersApi.reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: Customer) => {
    const ok = await confirm({
      title: 'Xóa khách hàng',
      message: `Xóa "${row.name}"? Hồ sơ sẽ được ẩn khỏi danh sách.`,
      danger: true,
      confirmLabel: 'Xóa khách hàng',
    });
    if (!ok) return;
    try {
      await api.customers.remove(row.id);
      toast.success('Đã xóa khách hàng');
      customersApi.reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const submitReturn = async () => {
    if (!returnCustomer) return;
    try {
      await api.returnBottles(returnCustomer.id, returnForm);
      toast.success('Đã ghi nhận thu hồi vỏ bình');
      setReturnCustomer(null);
      customersApi.reload();
      ledgersApi.reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  const customerColumns: Column<Customer>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
    { key: 'group_name', header: 'Nhóm', render: (r) => r.group_name ?? '—' },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone || '—' },
    {
      key: 'bottle_debt_voi',
      header: 'Nợ vỏ Vòi',
      align: 'center',
      render: (r) => <span className={r.bottle_debt_voi > 0 ? 'font-bold text-brand-navy' : 'text-slate-400'}>{r.bottle_debt_voi}</span>,
      sortValue: (r) => r.bottle_debt_voi,
    },
    {
      key: 'bottle_debt_up',
      header: 'Nợ vỏ Úp',
      align: 'center',
      render: (r) => <span className={r.bottle_debt_up > 0 ? 'font-bold text-indigo-600' : 'text-slate-400'}>{r.bottle_debt_up}</span>,
      sortValue: (r) => r.bottle_debt_up,
    },
    {
      key: 'current_debt',
      header: 'Nợ tiền',
      align: 'right',
      render: (r) => (
        <span className={r.current_debt > r.max_debt_limit ? 'font-bold text-brand-red' : ''}>{formatCurrency(r.current_debt)}</span>
      ),
      sortValue: (r) => r.current_debt,
    },
    { key: 'max_debt_limit', header: 'Hạn mức', align: 'right', render: (r) => formatCurrency(r.max_debt_limit), sortValue: (r) => r.max_debt_limit },
  ];

  const ledgerColumns: Column<BottleLedger>[] = [
    { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code ?? '—' },
    { key: 'borrowed_voi', header: 'Xuất Vòi', align: 'center' },
    { key: 'borrowed_up', header: 'Xuất Úp', align: 'center' },
    { key: 'returned_voi', header: 'Trả Vòi', align: 'center' },
    { key: 'returned_up', header: 'Trả Úp', align: 'center' },
    {
      key: 'remaining_balance_voi',
      header: 'Còn Vòi',
      align: 'center',
      render: (r) => <span className="font-bold text-brand-navy">{r.remaining_balance_voi}</span>,
    },
    {
      key: 'remaining_balance_up',
      header: 'Còn Úp',
      align: 'center',
      render: (r) => <span className="font-bold text-indigo-600">{r.remaining_balance_up}</span>,
    },
    { key: 'handler_name', header: 'Người xử lý', render: (r) => r.handler_name ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title="Khách hàng & Sổ nợ vỏ"
        subtitle={`${customersApi.data?.length ?? 0} khách hàng · ${formatNumber((customersApi.data ?? []).reduce((a, c) => a + c.bottle_debt_voi + c.bottle_debt_up, 0))} vỏ đang lưu hành`}
        actions={
          <>
            <Tabs
              items={[
                { id: 'list', label: 'Danh sách khách hàng', icon: Users },
                { id: 'bottles', label: 'Sổ nợ vỏ bình', icon: RotateCcw },
              ]}
              value={tab}
              onChange={setTab}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm khách hàng
            </Button>
          </>
        }
      />

      {tab === 'list' && (
        <DataTable
          columns={customerColumns}
          data={customersApi.data ?? []}
          rowKey={(r) => r.id}
          loading={customersApi.loading}
          onRowClick={openEdit}
          searchPlaceholder="Tìm theo mã, tên, điện thoại, MST..."
          initialSortKey="bottle_debt_voi"
          initialSortDir="desc"
        />
      )}

      {tab === 'bottles' && (
        <DataTable
          columns={ledgerColumns}
          data={ledgersApi.data ?? []}
          rowKey={(r) => r.id}
          loading={ledgersApi.loading}
          searchPlaceholder="Tìm theo khách hàng, mã đơn..."
          toolbar={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReturnCustomer(customersApi.data?.[0] ?? null);
                setReturnForm({ returned_voi: '', returned_up: '', handled_by: '', note: '' });
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Ghi nhận thu hồi vỏ
            </Button>
          }
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Khách hàng: ${editing.name}` : 'Thêm khách hàng mới'}
        subtitle={editing ? editing.code : 'Hồ sơ khách hàng, hạn mức nợ và số dư vỏ'}
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
          <FormGrid cols={2}>
            <Field label="Tên khách hàng" required className="sm:col-span-2">
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Nhóm khách hàng">
              <Select value={String(form.group_id ?? '')} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                <option value="">-- Chưa phân nhóm --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (CK {g.discount_percent}%)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mã số thuế">
              <Input value={String(form.tax_code ?? '')} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} />
            </Field>
            <Field label="Điện thoại">
              <Input value={String(form.phone ?? '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Người liên hệ">
              <Input value={String(form.contact_person ?? '')} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </Field>
            <Field label="Địa chỉ" required className="sm:col-span-2">
              <Textarea value={String(form.address ?? '')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Hạn mức công nợ">
              <Input type="number" value={String(form.max_debt_limit ?? '')} onChange={(e) => setForm({ ...form, max_debt_limit: e.target.value })} />
            </Field>
            <div />
            <Field label="Nợ vỏ Vòi (VB T9)">
              <Input type="number" value={String(form.bottle_debt_voi ?? '')} onChange={(e) => setForm({ ...form, bottle_debt_voi: e.target.value })} />
            </Field>
            <Field label="Nợ vỏ Úp (VB T8)">
              <Input type="number" value={String(form.bottle_debt_up ?? '')} onChange={(e) => setForm({ ...form, bottle_debt_up: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>

      <Modal
        open={!!returnCustomer}
        onClose={() => setReturnCustomer(null)}
        size="sm"
        title="Ghi nhận thu hồi vỏ bình"
        subtitle="Thu hồi vỏ không kèm đơn hàng mới"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setReturnCustomer(null)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitReturn}>
              Xác nhận thu hồi
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <Field label="Khách hàng">
            <Select
              value={String(returnCustomer?.id ?? '')}
              onChange={(e) => setReturnCustomer((customersApi.data ?? []).find((c) => c.id === Number(e.target.value)) ?? null)}
            >
              {(customersApi.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name} (Vòi {c.bottle_debt_voi} / Úp {c.bottle_debt_up})
                </option>
              ))}
            </Select>
          </Field>
          <FormGrid cols={2}>
            <Field label="Số vỏ Vòi trả">
              <Input type="number" value={String(returnForm.returned_voi ?? '')} onChange={(e) => setReturnForm({ ...returnForm, returned_voi: e.target.value })} />
            </Field>
            <Field label="Số vỏ Úp trả">
              <Input type="number" value={String(returnForm.returned_up ?? '')} onChange={(e) => setReturnForm({ ...returnForm, returned_up: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Người thu hồi">
            <Select value={String(returnForm.handled_by ?? '')} onChange={(e) => setReturnForm({ ...returnForm, handled_by: e.target.value })}>
              <option value="">-- Không chỉ định --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input value={String(returnForm.note ?? '')} onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
