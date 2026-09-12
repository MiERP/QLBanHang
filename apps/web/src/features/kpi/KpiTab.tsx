import { CheckCircle2, Plus, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { BarSeries, ChartCard } from '../../components/ui/charts';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatMonth, formatNumber } from '../../lib/format';
import type { KpiEvaluation } from '../../types';

const GRADE: Record<string, { label: string; tone: 'green' | 'cyan' | 'navy' | 'amber' | 'red' }> = {
  A_PLUS: { label: 'Xuất sắc', tone: 'green' },
  A: { label: 'Tốt', tone: 'cyan' },
  B: { label: 'Đạt', tone: 'navy' },
  C: { label: 'Cần cố gắng', tone: 'amber' },
  D: { label: 'Yếu', tone: 'red' },
};

export function KpiTab({ month }: { month: string }) {
  const { staff } = useReference();
  const recordsApi = useApi(() => api.fetchKpiRecords(month), [month]);
  const overviewApi = useApi(() => api.fetchKpiOverview(month), [month]);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const openCreate = () => {
    setForm({
      employee_id: staff[0]?.id ?? '',
      evaluation_month: month,
      target_water_revenue: '',
      target_dvgt_revenue: '',
      target_bottle_delivery: '',
      target_new_customers: '',
    });
    setOpen(true);
  };

  const submit = async () => {
    try {
      await api.createKpiRecord(form);
      toast.success('Đã giao chỉ tiêu KPI');
      setOpen(false);
      recordsApi.reload();
      overviewApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được chỉ tiêu');
    }
  };

  const recompute = async () => {
    try {
      const res = await api.recomputeKpi(month);
      toast.success(`Đã tính lại thực tế cho ${res.updated} nhân viên`);
      recordsApi.reload();
      overviewApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tính lại được');
    }
  };

  const approve = async (row: KpiEvaluation) => {
    const ok = await confirm({
      title: row.is_approved ? 'Bỏ duyệt KPI' : 'Duyệt KPI',
      message: row.is_approved ? `Bỏ duyệt KPI của ${row.employee_name}?` : `Duyệt KPI tháng ${formatMonth(month)} cho ${row.employee_name}?`,
      confirmLabel: row.is_approved ? 'Bỏ duyệt' : 'Duyệt',
    });
    if (!ok) return;
    try {
      await api.updateKpiRecord(row.id, { is_approved: row.is_approved ? 0 : 1 });
      toast.success('Đã cập nhật trạng thái duyệt');
      recordsApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được');
    }
  };

  const remove = async (row: KpiEvaluation) => {
    const ok = await confirm({ title: 'Xóa chỉ tiêu', message: `Xóa chỉ tiêu KPI của ${row.employee_name} tháng ${formatMonth(month)}?`, danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await api.deleteKpiRecord(row.id);
      toast.success('Đã xóa chỉ tiêu');
      recordsApi.reload();
      overviewApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được');
    }
  };

  const columns: Column<KpiEvaluation>[] = [
    { key: 'employee_name', header: 'Nhân viên', sortValue: (r) => r.employee_name },
    { key: 'station_name', header: 'Trạm', render: (r) => r.station_name ?? '—' },
    { key: 'role_name', header: 'Vai trò', render: (r) => r.role_name ?? '—' },
    { key: 'target_water_revenue', header: 'Chỉ tiêu nước', align: 'right', render: (r) => formatCurrency(r.target_water_revenue), sortValue: (r) => r.target_water_revenue },
    {
      key: 'actual_water_revenue',
      header: 'Thực tế nước',
      align: 'right',
      render: (r) => (
        <span className={r.actual_water_revenue >= r.target_water_revenue && r.target_water_revenue > 0 ? 'font-bold text-emerald-600' : ''}>
          {formatCurrency(r.actual_water_revenue)}
        </span>
      ),
      sortValue: (r) => r.actual_water_revenue,
    },
    { key: 'actual_dvgt_revenue', header: 'DVGT', align: 'right', render: (r) => formatCurrency(r.actual_dvgt_revenue), sortValue: (r) => r.actual_dvgt_revenue },
    { key: 'actual_bottle_delivery', header: 'Bình giao', align: 'right', render: (r) => formatNumber(r.actual_bottle_delivery), sortValue: (r) => r.actual_bottle_delivery },
    {
      key: 'completion_percentage',
      header: '% Hoàn thành',
      align: 'center',
      render: (r) => (
        <span className={r.completion_percentage >= 100 ? 'font-bold text-emerald-600' : 'font-bold text-slate-700'}>{r.completion_percentage}%</span>
      ),
      sortValue: (r) => r.completion_percentage,
    },
    {
      key: 'grade',
      header: 'Xếp loại',
      align: 'center',
      render: (r) => <Badge tone={GRADE[r.grade]?.tone ?? 'neutral'}>{GRADE[r.grade]?.label ?? r.grade}</Badge>,
      sortValue: (r) => r.grade,
    },
    { key: 'bonus_amount', header: 'Thưởng', align: 'right', render: (r) => formatCurrency(r.bonus_amount), sortValue: (r) => r.bonus_amount },
    {
      key: 'is_approved',
      header: 'Duyệt',
      align: 'center',
      render: (r) => (r.is_approved ? <Badge tone="green">Đã duyệt</Badge> : <Badge tone="amber">Chờ duyệt</Badge>),
    },
  ];

  const overview = overviewApi.data;
  const chartData = (recordsApi.data ?? []).map((r) => ({
    name: r.employee_name.split(' ').slice(-2).join(' '),
    'Chỉ tiêu nước': r.target_water_revenue,
    'Thực tế nước': r.actual_water_revenue,
  }));

  return (
    <>
      <PageHeader
        title="Chỉ tiêu KPI & DVGT"
        subtitle={`${formatMonth(month)} · ${overview?.totalEmployees ?? 0} nhân viên có chỉ tiêu`}
        actions={
          <>
            <Button variant="outline" onClick={recompute}>
              <RefreshCw className="h-4 w-4" /> Tính lại thực tế
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Giao chỉ tiêu
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} tone="navy" label="Nhân viên có chỉ tiêu" value={formatNumber(overview?.totalEmployees ?? 0)} />
        <StatCard icon={TrendingUp} tone="cyan" label="Tỷ lệ hoàn thành TB" value={`${overview?.avgCompletion ?? 0}%`} />
        <StatCard icon={Target} tone="amber" label="Thực tế / Chỉ tiêu nước" value={`${formatNumber(Math.round((overview?.totalActualWater ?? 0) / 1000))}k / ${formatNumber(Math.round((overview?.totalTargetWater ?? 0) / 1000))}k`} />
        <StatCard icon={CheckCircle2} tone="green" label="Quỹ thưởng tạm tính" value={formatCurrency(overview?.totalBonus ?? 0)} />
      </div>

      <div className="mb-5">
        <ChartCard title="Chỉ tiêu vs Thực tế doanh thu nước" subtitle={formatMonth(month)} empty={chartData.length === 0}>
          <BarSeries
            data={chartData}
            xKey="name"
            currency
            angleLabels
            series={[
              { key: 'Chỉ tiêu nước', name: 'Chỉ tiêu', color: '#94a3b8' },
              { key: 'Thực tế nước', name: 'Thực tế', color: '#50ADDE' },
            ]}
          />
        </ChartCard>
      </div>

      <DataTable
        columns={columns}
        data={recordsApi.data ?? []}
        rowKey={(r) => r.id}
        loading={recordsApi.loading}
        onRowClick={approve}
        searchPlaceholder="Tìm theo nhân viên, trạm..."
        initialSortKey="completion_percentage"
        initialSortDir="desc"
        toolbar={
          <>
            <span className="text-xs text-slate-400">Nhấn dòng để duyệt / bỏ duyệt</span>
            {(recordsApi.data ?? []).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const row = recordsApi.data![0];
                  remove(row);
                }}
              >
                Xóa dòng đầu
              </Button>
            )}
          </>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Giao chỉ tiêu KPI"
        subtitle={`Thiết lập định mức thi đua ${formatMonth(month)}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submit}>
              Giao chỉ tiêu
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Nhân viên" required>
              <Select value={String(form.employee_id ?? '')} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tháng đánh giá">
              <Input type="month" value={String(form.evaluation_month ?? month)} onChange={(e) => setForm({ ...form, evaluation_month: e.target.value })} />
            </Field>
            <Field label="Chỉ tiêu doanh thu nước">
              <Input type="number" value={String(form.target_water_revenue ?? '')} onChange={(e) => setForm({ ...form, target_water_revenue: e.target.value })} />
            </Field>
            <Field label="Chỉ tiêu doanh thu DVGT">
              <Input type="number" value={String(form.target_dvgt_revenue ?? '')} onChange={(e) => setForm({ ...form, target_dvgt_revenue: e.target.value })} />
            </Field>
            <Field label="Chỉ tiêu bình giao (shipper)">
              <Input type="number" value={String(form.target_bottle_delivery ?? '')} onChange={(e) => setForm({ ...form, target_bottle_delivery: e.target.value })} />
            </Field>
            <Field label="Chỉ tiêu khách hàng mới">
              <Input type="number" value={String(form.target_new_customers ?? '')} onChange={(e) => setForm({ ...form, target_new_customers: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
