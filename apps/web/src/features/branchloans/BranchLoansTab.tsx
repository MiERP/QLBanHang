import { Handshake, PackageCheck, Plus, Trash2 } from 'lucide-react';
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
import { formatDate } from '../../lib/format';
import type { BranchLoan } from '../../types';

const STATUS: Record<string, { label: string; tone: 'amber' | 'cyan' | 'green' | 'red' }> = {
  PENDING: { label: 'Chờ hoàn trả', tone: 'amber' },
  PARTIAL_RETURN: { label: 'Đã trả một phần', tone: 'cyan' },
  SETTLED: { label: 'Đã quyết toán', tone: 'green' },
  OVERDUE: { label: 'Quá hạn', tone: 'red' },
};

interface LoanLine {
  product_id: string | number;
  quantity_loaned: string | number;
}

export function BranchLoansTab() {
  const { branches, warehouses, products, staff } = useReference();
  const loansApi = useApi(() => api.branchLoans.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [lines, setLines] = useState<LoanLine[]>([{ product_id: '', quantity_loaned: 1 }]);

  const [settling, setSettling] = useState<BranchLoan | null>(null);
  const [settleLines, setSettleLines] = useState<Record<number, number>>({});

  const openCreate = () => {
    setForm({
      loan_direction: 'TAKE_LOAN',
      partner_branch_id: branches[0]?.id ?? '',
      warehouse_id: warehouses[0]?.id ?? '',
      carrier_employee_id: '',
      loan_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      note: '',
    });
    setLines([{ product_id: products[0]?.id ?? '', quantity_loaned: 1 }]);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const valid = lines.filter((l) => l.product_id && Number(l.quantity_loaned) > 0);
    if (valid.length === 0) return toast.error('Thêm ít nhất một mặt hàng');
    try {
      await api.branchLoans.create({
        ...form,
        items: valid.map((l) => ({ product_id: l.product_id, quantity_loaned: Number(l.quantity_loaned) })),
      });
      toast.success('Đã lập phiếu vay mượn');
      setCreateOpen(false);
      loansApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lập được phiếu');
    }
  };

  const openSettle = (row: BranchLoan) => {
    setSettling(row);
    setSettleLines({});
  };

  const submitSettle = async () => {
    if (!settling) return;
    const items = (settling.items ?? [])
      .filter((it) => (settleLines[it.product_id] ?? 0) > 0)
      .map((it) => ({ product_id: it.product_id, quantity_returned: settleLines[it.product_id] }));
    if (items.length === 0) return toast.error('Nhập số lượng hoàn trả cho ít nhất một mặt hàng');
    try {
      await api.settleBranchLoan(settling.id, { return_type: 'PRODUCT_RETURN', items });
      toast.success('Đã ghi nhận hoàn trả và cập nhật tồn kho');
      setSettling(null);
      loansApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không quyết toán được');
    }
  };

  const remove = async (row: BranchLoan) => {
    const ok = await confirm({
      title: 'Xóa phiếu vay mượn',
      message: `Xóa phiếu ${row.loan_code}? Hệ thống sẽ hoàn tác ảnh hưởng tồn kho liên quan.`,
      danger: true,
      confirmLabel: 'Xóa phiếu',
    });
    if (!ok) return;
    try {
      await api.branchLoans.remove(row.id);
      toast.success('Đã xóa phiếu vay mượn');
      loansApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được');
    }
  };

  const columns: Column<BranchLoan>[] = [
    { key: 'loan_code', header: 'Mã phiếu', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.loan_code },
    {
      key: 'loan_direction',
      header: 'Chiều',
      render: (r) => <Badge tone={r.loan_direction === 'GIVE_LOAN' ? 'cyan' : 'indigo'}>{r.loan_direction === 'GIVE_LOAN' ? 'Cho vay' : 'Đi vay'}</Badge>,
      sortValue: (r) => r.loan_direction,
    },
    { key: 'partner_branch_name', header: 'Đơn vị', sortValue: (r) => r.partner_branch_name },
    { key: 'warehouse_name', header: 'Kho' },
    { key: 'carrier_name', header: 'Người vận chuyển', render: (r) => r.carrier_name ?? '—' },
    { key: 'loan_date', header: 'Ngày vay', render: (r) => formatDate(r.loan_date), sortValue: (r) => r.loan_date },
    { key: 'due_date', header: 'Hạn trả', render: (r) => formatDate(r.due_date), sortValue: (r) => r.due_date },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => <Badge tone={STATUS[r.status]?.tone ?? 'neutral'}>{STATUS[r.status]?.label ?? r.status}</Badge>,
      sortValue: (r) => r.status,
    },
  ];

  return (
    <>
      <PageHeader
        title="Vay mượn liên chi nhánh"
        subtitle="Phiếu vay mượn hai chiều, hoàn trả và quyết toán"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Lập phiếu vay mượn
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={loansApi.data ?? []}
        rowKey={(r) => r.id}
        loading={loansApi.loading}
        onRowClick={openSettle}
        searchPlaceholder="Tìm theo mã phiếu, đơn vị..."
        initialSortKey="loan_code"
        initialSortDir="desc"
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="lg"
        title="Lập phiếu vay mượn"
        subtitle="Chọn chiều vay, đơn vị và mặt hàng"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitCreate}>
              Lập phiếu
            </Button>
          </>
        }
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2 rounded-lg bg-brand-cyan-subtle px-3 py-2 text-xs text-brand-navy">
            <Handshake className="h-4 w-4" /> Đi vay sẽ nhập kho, cho vay sẽ xuất kho.
          </div>
          <FormGrid cols={2}>
            <Field label="Chiều vay mượn" required>
              <Select value={String(form.loan_direction ?? 'TAKE_LOAN')} onChange={(e) => setForm({ ...form, loan_direction: e.target.value })}>
                <option value="TAKE_LOAN">Đi vay (nhập kho)</option>
                <option value="GIVE_LOAN">Cho vay (xuất kho)</option>
              </Select>
            </Field>
            <Field label="Đơn vị liên kết" required>
              <Select value={String(form.partner_branch_id ?? '')} onChange={(e) => setForm({ ...form, partner_branch_id: e.target.value })}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kho hàng" required>
              <Select value={String(form.warehouse_id ?? '')} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Người vận chuyển">
              <Select value={String(form.carrier_employee_id ?? '')} onChange={(e) => setForm({ ...form, carrier_employee_id: e.target.value })}>
                <option value="">-- Không chỉ định --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày vay">
              <Input type="date" value={String(form.loan_date ?? '')} onChange={(e) => setForm({ ...form, loan_date: e.target.value })} />
            </Field>
            <Field label="Hạn hoàn trả">
              <Input type="date" value={String(form.due_date ?? '')} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
          </FormGrid>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-xs font-bold text-slate-700">Mặt hàng vay mượn</p>
              <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { product_id: products[0]?.id ?? '', quantity_loaned: 1 }])}>
                <Plus className="h-3.5 w-3.5" /> Thêm dòng
              </Button>
            </div>
            <div className="space-y-2 p-3">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-8">
                    <Select value={String(l.product_id)} onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, product_id: Number(e.target.value) } : x)))}>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="SL"
                      value={String(l.quantity_loaned)}
                      onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, quantity_loaned: e.target.value } : x)))}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1}>
                      <Trash2 className="h-4 w-4 text-brand-red" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Ghi chú">
            <Input value={String(form.note ?? '')} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!settling}
        onClose={() => setSettling(null)}
        title={settling ? `Quyết toán ${settling.loan_code}` : ''}
        subtitle={settling ? `${settling.partner_branch_name} · ${settling.loan_direction === 'GIVE_LOAN' ? 'Cho vay' : 'Đi vay'}` : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettling(null)}>
              Đóng
            </Button>
            {settling && (
              <Button variant="danger" size="sm" onClick={() => remove(settling)}>
                Xóa phiếu
              </Button>
            )}
            <Button size="sm" onClick={submitSettle}>
              <PackageCheck className="h-4 w-4" /> Ghi nhận hoàn trả
            </Button>
          </>
        }
      >
        {settling && (
          <div className="space-y-3 p-5">
            <p className="text-xs text-slate-500">Nhập số lượng hoàn trả thực tế cho từng mặt hàng. Tồn kho sẽ được cập nhật tự động.</p>
            {(settling.items ?? []).map((it) => {
              const remaining = it.quantity_loaned - it.quantity_returned;
              return (
                <div key={it.product_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{it.product_name}</p>
                    <p className="text-[11px] text-slate-400">
                      Đã vay {it.quantity_loaned} · đã trả {it.quantity_returned} · còn {remaining}
                    </p>
                  </div>
                  <Input
                    type="number"
                    className="w-28"
                    placeholder="Trả"
                    max={remaining}
                    value={String(settleLines[it.product_id] ?? '')}
                    onChange={(e) => setSettleLines({ ...settleLines, [it.product_id]: Number(e.target.value) })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
