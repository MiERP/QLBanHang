import { ArrowDownRight, ArrowUpRight, Plus, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { ChartCard, AreaTrend, DonutChart } from '../../components/ui/charts';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatMonth, formatNumber, todayISO } from '../../lib/format';
import type { ExpenseTransaction, RevenueTransaction } from '../../types';

const REVENUE_TYPES: Record<string, string> = {
  WATER_SALE: 'Bán nước',
  BOTTLE_DEPOSIT: 'Thu cọc vỏ',
  DEBT_COLLECTION: 'Thu nợ cũ',
  DVGT_SERVICE: 'Dịch vụ gia tăng',
  BRANCH_OFFSET: 'Cấn trừ chi nhánh',
  OTHER: 'Khác',
};

const EXPENSE_CATEGORIES: Record<string, string> = {
  ELECTRICITY: 'Điện sản xuất',
  GASOLINE: 'Xăng xe',
  CAPS_LABELS: 'Nắp bình / màng co',
  MAINTENANCE: 'Bảo dưỡng',
  SALARY_COMMISSION: 'Lương & hoa hồng',
  VEHICLE_REPAIR: 'Sửa chữa xe',
  RENTAL: 'Thuê mặt bằng',
  OTHER: 'Khác',
};

export function FinanceTab({ month }: { month: string }) {
  const { staff, customers, stations } = useReference();
  const [tab, setTab] = useState('revenue');

  const summaryApi = useApi(() => api.fetchFinanceSummary(month), [month]);
  const revenueApi = useApi(() => api.fetchRevenue({ from: `${month}-01`, to: `${month}-31` }), [month]);
  const expenseApi = useApi(() => api.fetchExpenses({ from: `${month}-01`, to: `${month}-31` }), [month]);
  const toast = useToast();
  const confirm = useConfirm();

  const [revenueOpen, setRevenueOpen] = useState(false);
  const [revenueForm, setRevenueForm] = useState<Record<string, unknown>>({});
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<Record<string, unknown>>({});

  const reloadAll = () => {
    summaryApi.reload();
    revenueApi.reload();
    expenseApi.reload();
  };

  const openRevenue = () => {
    setRevenueForm({ transaction_type: 'WATER_SALE', amount: '', payment_method: 'CASH', customer_id: '', collected_by: '', transaction_date: todayISO(), note: '' });
    setRevenueOpen(true);
  };

  const submitRevenue = async () => {
    try {
      await api.createRevenue(revenueForm);
      toast.success('Đã lập phiếu thu');
      setRevenueOpen(false);
      reloadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lập được phiếu thu');
    }
  };

  const openExpense = () => {
    setExpenseForm({ category: 'ELECTRICITY', amount: '', paid_to: '', paid_by: '', station_id: '', payment_method: 'CASH', expense_date: todayISO(), note: '' });
    setExpenseOpen(true);
  };

  const submitExpense = async () => {
    try {
      await api.createExpense(expenseForm);
      toast.success('Đã lập phiếu chi');
      setExpenseOpen(false);
      reloadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lập được phiếu chi');
    }
  };

  const removeRevenue = async (row: RevenueTransaction) => {
    const ok = await confirm({ title: 'Xóa phiếu thu', message: `Xóa phiếu ${row.transaction_code}?`, danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await api.deleteRevenue(row.id);
      toast.success('Đã xóa phiếu thu');
      reloadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được');
    }
  };

  const removeExpense = async (row: ExpenseTransaction) => {
    const ok = await confirm({ title: 'Xóa phiếu chi', message: `Xóa phiếu ${row.expense_code}?`, danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await api.deleteExpense(row.id);
      toast.success('Đã xóa phiếu chi');
      reloadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được');
    }
  };

  const revenueColumns: Column<RevenueTransaction>[] = [
    { key: 'transaction_code', header: 'Mã phiếu', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.transaction_code },
    { key: 'transaction_date', header: 'Ngày', render: (r) => formatDate(r.transaction_date), sortValue: (r) => r.transaction_date },
    { key: 'transaction_type', header: 'Loại thu', render: (r) => <Badge tone="green">{REVENUE_TYPES[r.transaction_type] ?? r.transaction_type}</Badge>, sortValue: (r) => r.transaction_type },
    { key: 'customer_name', header: 'Khách hàng', render: (r) => r.customer_name ?? '—' },
    { key: 'amount', header: 'Số tiền', align: 'right', render: (r) => <b className="text-emerald-600">{formatCurrency(r.amount)}</b>, sortValue: (r) => r.amount },
    { key: 'payment_method', header: 'Hình thức', render: (r) => (r.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản') },
    { key: 'collected_by_name', header: 'Người thu', render: (r) => r.collected_by_name ?? '—' },
  ];

  const expenseColumns: Column<ExpenseTransaction>[] = [
    { key: 'expense_code', header: 'Mã phiếu', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.expense_code },
    { key: 'expense_date', header: 'Ngày', render: (r) => formatDate(r.expense_date), sortValue: (r) => r.expense_date },
    { key: 'category', header: 'Loại chi', render: (r) => <Badge tone="red">{EXPENSE_CATEGORIES[r.category] ?? r.category}</Badge>, sortValue: (r) => r.category },
    { key: 'paid_to', header: 'Trả cho', sortValue: (r) => r.paid_to },
    { key: 'amount', header: 'Số tiền', align: 'right', render: (r) => <b className="text-brand-red">{formatCurrency(r.amount)}</b>, sortValue: (r) => r.amount },
    { key: 'paid_by_name', header: 'Người chi', render: (r) => r.paid_by_name ?? '—' },
    { key: 'station_name', header: 'Trạm', render: (r) => r.station_name ?? '—' },
  ];

  const summary = summaryApi.data;
  const cashFlow = (summary?.byType ?? []).map((t) => ({ name: REVENUE_TYPES[t.label] ?? t.label, value: t.value }));
  const expenseMix = (summary?.byCategory ?? []).map((c) => ({ name: EXPENSE_CATEGORIES[c.label] ?? c.label, value: c.value }));

  return (
    <>
      <PageHeader
        title="Sổ quỹ Thu - Chi"
        subtitle={`${formatMonth(month)} · theo dõi dòng tiền xí nghiệp`}
        actions={
          <>
            <Tabs
              items={[
                { id: 'revenue', label: 'Phiếu thu', icon: ArrowUpRight },
                { id: 'expenses', label: 'Phiếu chi', icon: ArrowDownRight },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'revenue' && (
              <Button onClick={openRevenue}>
                <Plus className="h-4 w-4" /> Lập phiếu thu
              </Button>
            )}
            {tab === 'expenses' && (
              <Button variant="danger" onClick={openExpense}>
                <Plus className="h-4 w-4" /> Lập phiếu chi
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={ArrowUpRight} tone="green" label="Tổng thu trong tháng" value={formatCurrency(summary?.totalRevenue ?? 0)} hint={`${revenueApi.data?.length ?? 0} phiếu thu`} />
        <StatCard icon={ArrowDownRight} tone="red" label="Tổng chi trong tháng" value={formatCurrency(summary?.totalExpense ?? 0)} hint={`${expenseApi.data?.length ?? 0} phiếu chi`} />
        <StatCard
          icon={TrendingUp}
          tone={(summary?.profit ?? 0) >= 0 ? 'navy' : 'red'}
          label="Chênh lệch thu - chi"
          value={formatCurrency(summary?.profit ?? 0)}
          hint={(summary?.profit ?? 0) >= 0 ? 'Thặng dư quỹ' : 'Thâm hụt quỹ'}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Cơ cấu nguồn thu" subtitle={formatMonth(month)} empty={cashFlow.length === 0} height={260}>
          <DonutChart data={cashFlow} currency colors={['#10B981', '#50ADDE', '#2C2C6B', '#F59E0B', '#8B5CF6']} />
        </ChartCard>
        <ChartCard title="Cơ cấu chi phí" subtitle={formatMonth(month)} empty={expenseMix.length === 0} height={260}>
          <DonutChart data={expenseMix} currency colors={['#C62430', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6']} />
        </ChartCard>
      </div>

      {tab === 'revenue' && (
        <DataTable columns={revenueColumns} data={revenueApi.data ?? []} rowKey={(r) => r.id} loading={revenueApi.loading} onRowClick={removeRevenue} searchPlaceholder="Tìm theo mã phiếu, khách hàng..." />
      )}
      {tab === 'expenses' && (
        <DataTable columns={expenseColumns} data={expenseApi.data ?? []} rowKey={(r) => r.id} loading={expenseApi.loading} onRowClick={removeExpense} searchPlaceholder="Tìm theo mã phiếu, nhà cung cấp..." />
      )}

      <Modal
        open={revenueOpen}
        onClose={() => setRevenueOpen(false)}
        title="Lập phiếu thu"
        subtitle="Ghi nhận tiền thu vào quỹ"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRevenueOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitRevenue}>
              Lập phiếu thu
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Loại thu">
              <Select value={String(revenueForm.transaction_type ?? '')} onChange={(e) => setRevenueForm({ ...revenueForm, transaction_type: e.target.value })}>
                {Object.entries(REVENUE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Số tiền" required>
              <Input type="number" value={String(revenueForm.amount ?? '')} onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })} />
            </Field>
            <Field label="Khách hàng">
              <Select value={String(revenueForm.customer_id ?? '')} onChange={(e) => setRevenueForm({ ...revenueForm, customer_id: e.target.value })}>
                <option value="">-- Không gắn khách hàng --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hình thức">
              <Select value={String(revenueForm.payment_method ?? 'CASH')} onChange={(e) => setRevenueForm({ ...revenueForm, payment_method: e.target.value })}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </Select>
            </Field>
            <Field label="Người thu">
              <Select value={String(revenueForm.collected_by ?? '')} onChange={(e) => setRevenueForm({ ...revenueForm, collected_by: e.target.value })}>
                <option value="">-- Không chỉ định --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày thu">
              <Input type="date" value={String(revenueForm.transaction_date ?? '')} onChange={(e) => setRevenueForm({ ...revenueForm, transaction_date: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Ghi chú">
            <Textarea value={String(revenueForm.note ?? '')} onChange={(e) => setRevenueForm({ ...revenueForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Lập phiếu chi"
        subtitle="Ghi nhận chi phí hoạt động"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setExpenseOpen(false)}>
              Hủy bỏ
            </Button>
            <Button variant="danger" size="sm" onClick={submitExpense}>
              Lập phiếu chi
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Loại chi">
              <Select value={String(expenseForm.category ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Số tiền" required>
              <Input type="number" value={String(expenseForm.amount ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            </Field>
            <Field label="Trả cho" required>
              <Input value={String(expenseForm.paid_to ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, paid_to: e.target.value })} />
            </Field>
            <Field label="Người chi">
              <Select value={String(expenseForm.paid_by ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, paid_by: e.target.value })}>
                <option value="">-- Không chỉ định --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Trạm">
              <Select value={String(expenseForm.station_id ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, station_id: e.target.value })}>
                <option value="">-- Không gắn trạm --</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hình thức">
              <Select value={String(expenseForm.payment_method ?? 'CASH')} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </Select>
            </Field>
            <Field label="Ngày chi">
              <Input type="date" value={String(expenseForm.expense_date ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            </Field>
          </FormGrid>
          <Field label="Ghi chú">
            <Textarea value={String(expenseForm.note ?? '')} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <div className="mt-5">
        <Card>
          <CardHeader title="Dòng tiền theo ngày" subtitle={formatMonth(month)} />
          <CardBody>
            <div style={{ width: '100%', height: 260 }}>
              <AreaTrend
                data={[
                  ...(revenueApi.data ?? []).map((r) => ({ date: r.transaction_date, revenue: r.amount, expense: 0 })),
                  ...(expenseApi.data ?? []).map((x) => ({ date: x.expense_date, revenue: 0, expense: x.amount })),
                ]
                  .reduce<{ date: string; revenue: number; expense: number }[]>((acc, row) => {
                    const found = acc.find((a) => a.date === row.date);
                    if (found) {
                      found.revenue += row.revenue;
                      found.expense += row.expense;
                    } else {
                      acc.push({ ...row });
                    }
                    return acc;
                  }, [])
                  .sort((a, b) => a.date.localeCompare(b.date))}
                xKey="date"
                currency
                series={[
                  { key: 'revenue', name: 'Thu', color: '#10B981' },
                  { key: 'expense', name: 'Chi', color: '#C62430' },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
        <Wallet className="h-3.5 w-3.5" /> Tổng {formatNumber((revenueApi.data?.length ?? 0) + (expenseApi.data?.length ?? 0))} giao dịch trong kỳ
      </p>
    </>
  );
}
