import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import type { Customer } from '../../types';
import { CustomerFields, emptyCustomerForm } from './CustomerFields';

export function CustomersTab() {
  const { groups, reload: reloadRefs } = useReference();
  const customersApi = useApi(() => api.customers.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyCustomerForm);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyCustomerForm, group_id: groups[0]?.id ?? '' });
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
      personal_id: row.personal_id ?? '',
      budget_relation_code: row.budget_relation_code ?? '',
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

  const columns: Column<Customer>[] = [
    { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
    { key: 'name', header: 'Khách hàng', sortValue: (r) => r.name },
    { key: 'group_name', header: 'Nhóm', render: (r) => r.group_name ?? '—' },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone || '—' },
    { key: 'personal_id', header: 'Số định danh', render: (r) => r.personal_id || '—' },
    { key: 'budget_relation_code', header: 'Mã QHNS', render: (r) => r.budget_relation_code || '—' },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (r) => (
        <div className="flex justify-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            Sửa
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              remove(r);
            }}
          >
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Danh sách khách hàng"
        subtitle={`${customersApi.data?.length ?? 0} khách hàng`}
        actions={
          <>
            <ImportExcelButton
              kind="customers"
              hint="Nhập khách hàng từ Excel, gồm cả nợ đầu kỳ và nợ vỏ bình. Nhập sau khi đã có nhóm khách hàng."
              onDone={() => {
                customersApi.reload();
                reloadRefs();
              }}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Thêm khách hàng
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        data={customersApi.data ?? []}
        rowKey={(r) => r.id}
        loading={customersApi.loading}
        onRowClick={openEdit}
        searchPlaceholder="Tìm theo mã, tên, điện thoại, MST..."
        initialSortKey="code"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Khách hàng: ${editing.name}` : 'Thêm khách hàng mới'}
        subtitle={editing ? editing.code : 'Hồ sơ thông tin khách hàng'}
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
            <Users className="h-4 w-4" /> Hồ sơ khách hàng
          </div>
          <CustomerFields form={form} set={(patch) => setForm({ ...form, ...patch })} showInitialBalances={!editing} />
        </div>
      </Modal>
    </>
  );
}
