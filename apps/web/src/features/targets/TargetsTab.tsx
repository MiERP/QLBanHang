import { Plus, Target as TargetIcon } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatMonth } from '../../lib/format';
import type { TargetBoardRow } from '../../types';

const GRADE_LABEL: Record<string, { label: string; tone: 'green' | 'cyan' | 'amber' | 'red' | 'navy' }> = {
  A_PLUS: { label: 'Xuất sắc', tone: 'green' },
  A: { label: 'Tốt', tone: 'green' },
  B: { label: 'Đạt', tone: 'cyan' },
  C: { label: 'Cần cố gắng', tone: 'amber' },
  D: { label: 'Yếu', tone: 'red' },
};

function completionTone(c: number): 'green' | 'cyan' | 'amber' | 'red' {
  if (c >= 100) return 'green';
  if (c >= 85) return 'cyan';
  if (c >= 70) return 'amber';
  return 'red';
}

export function TargetsTab({ month }: { month: string }) {
  const { data, loading, reload } = useApi(() => api.fetchTargets(month), [month]);
  const toast = useToast();

  const [tab, setTab] = useState('employees');
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<TargetBoardRow | null>(null);
  const [value, setValue] = useState('');

  const rows = tab === 'employees' ? data?.employees ?? [] : data?.units ?? [];
  const totalTarget = rows.reduce((a, r) => a + r.target_revenue, 0);
  const totalActual = rows.reduce((a, r) => a + r.actual_revenue, 0);
  const overall = totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;

  const openAssign = (row: TargetBoardRow) => {
    setCurrent(row);
    setValue(row.target_revenue ? String(row.target_revenue) : '');
    setOpen(true);
  };

  const save = async () => {
    if (!current) return;
    if (!value) return toast.error('Nhập số tiền chỉ tiêu');
    try {
      if (current.target_id) {
        await api.updateTarget(current.target_id, { target_revenue: Number(value) });
      } else {
        await api.createTarget({
          period: month,
          scope_type: current.scope_type,
          employee_id: current.employee_id ?? null,
          org_unit_id: current.org_unit_id ?? null,
          target_revenue: Number(value),
        });
      }
      toast.success('Đã lưu chỉ tiêu');
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const columns: Column<TargetBoardRow>[] = [
    { key: 'name', header: tab === 'units' ? 'Đơn vị' : 'Nhân viên', sortValue: (r) => r.name },
    ...(tab === 'employees'
      ? [{ key: 'org_unit_name', header: 'Đơn vị', render: (r: TargetBoardRow) => r.org_unit_name ?? '—' } as Column<TargetBoardRow>]
      : []),
    { key: 'target_revenue', header: 'Chỉ tiêu', align: 'right', render: (r) => (r.target_revenue ? formatCurrency(r.target_revenue) : '—'), sortValue: (r) => r.target_revenue },
    { key: 'actual_revenue', header: 'Thực hiện', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.actual_revenue)}</b>, sortValue: (r) => r.actual_revenue },
    {
      key: 'completion_percentage',
      header: 'Hoàn thành',
      align: 'center',
      render: (r) => (r.target_revenue ? <Badge tone={completionTone(r.completion_percentage)}>{r.completion_percentage}%</Badge> : <span className="text-slate-300">—</span>),
      sortValue: (r) => r.completion_percentage,
    },
    {
      key: 'grade',
      header: 'Xếp loại',
      align: 'center',
      render: (r) => {
        if (!r.target_revenue) return <span className="text-slate-300">—</span>;
        const g = GRADE_LABEL[r.grade];
        return <Badge tone={g?.tone ?? 'neutral'}>{g?.label ?? r.grade}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openAssign(r); }}>
          {r.target_id ? 'Sửa chỉ tiêu' : 'Giao chỉ tiêu'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Chỉ tiêu"
        subtitle={`${formatMonth(month)} · giao chỉ tiêu doanh thu cho nhân viên hoặc tổ/trạm`}
        actions={
          <Tabs
            items={[
              { id: 'employees', label: 'Theo nhân viên' },
              { id: 'units', label: 'Theo tổ/trạm' },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={TargetIcon} tone="navy" label="Tổng chỉ tiêu" value={formatCurrency(totalTarget)} hint={`${rows.length} đối tượng`} />
        <StatCard icon={TargetIcon} tone="green" label="Tổng thực hiện" value={formatCurrency(totalActual)} hint="Doanh thu đạt được" />
        <StatCard icon={TargetIcon} tone={completionTone(overall)} label="Tỉ lệ hoàn thành" value={`${overall}%`} hint="Thực hiện / chỉ tiêu" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => `${r.scope_type}-${r.employee_id ?? r.org_unit_id}`}
        loading={loading}
        onRowClick={openAssign}
        searchPlaceholder="Tìm theo tên..."
        initialSortKey={tab === 'employees' ? 'name' : 'name'}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={current ? `Chỉ tiêu: ${current.name}` : ''}
        subtitle={formatMonth(month)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={save}>
              <Plus className="h-3.5 w-3.5" /> Lưu chỉ tiêu
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <Field label="Chỉ tiêu doanh thu" required hint="Số tiền nhân viên/đơn vị cần đạt trong tháng">
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
