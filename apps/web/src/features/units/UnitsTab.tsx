import { ChevronDown, ChevronRight, Network, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import type { OrgUnit } from '../../types';

export function UnitsTab() {
  const { staff, reload: reloadRefs } = useReference();
  const { data, loading, reload } = useApi(() => api.orgUnits.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const units = data ?? [];

  const hasChildren = (id: number) => units.some((u) => u.parent_id === id);

  const rows = useMemo(() => {
    const childrenOf = (pid: number | null) => units.filter((u) => (u.parent_id ?? null) === pid);
    const out: { unit: OrgUnit; depth: number }[] = [];
    const walk = (pid: number | null, depth: number) => {
      for (const u of childrenOf(pid)) {
        out.push({ unit: u, depth });
        if (!collapsed[u.id]) walk(u.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [units, collapsed]);

  const openCreate = (parent?: OrgUnit) => {
    setEditing(null);
    setForm({ name: '', parent_id: parent?.id ?? '', unit_type: '', manager_employee_id: '', sort_order: 0 });
    setOpen(true);
  };

  const openEdit = (row: OrgUnit) => {
    setEditing(row);
    setForm({
      name: row.name,
      parent_id: row.parent_id ?? '',
      unit_type: row.unit_type ?? '',
      manager_employee_id: row.manager_employee_id ?? '',
      sort_order: row.sort_order ?? 0,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('Nhập tên đơn vị');
    try {
      if (editing) {
        await api.orgUnits.update(editing.id, form);
        toast.success('Đã cập nhật đơn vị');
      } else {
        await api.orgUnits.create(form);
        toast.success('Đã thêm đơn vị');
      }
      setOpen(false);
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: OrgUnit) => {
    const ok = await confirm({
      title: 'Xóa đơn vị',
      message: `Xóa đơn vị "${row.name}"?`,
      danger: true,
      confirmLabel: 'Xóa đơn vị',
    });
    if (!ok) return;
    try {
      await api.orgUnits.remove(row.id);
      toast.success('Đã xóa đơn vị');
      reload();
      reloadRefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-500">{units.length} đơn vị · tổ chức theo cây phân cấp</span>
        <span className="flex flex-wrap items-center gap-2">
          <ImportExcelButton
            kind="org-units"
            hint="Nhập đơn vị theo cây phân cấp: đơn vị cấp trên phải nằm ở dòng phía trên (ghi mã hoặc tên)."
            onDone={() => {
              reload();
              reloadRefs();
            }}
          />
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Thêm đơn vị
          </Button>
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-14 text-center text-sm text-slate-400">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400">Chưa có đơn vị nào</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ unit, depth }) => (
              <div key={unit.id} className="flex items-center gap-2 px-3 py-2 hover:bg-brand-cyan-subtle">
                <span style={{ width: depth * 20 }} />
                {hasChildren(unit.id) ? (
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [unit.id]: !c[unit.id] }))}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
                  >
                    {collapsed[unit.id] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                <Network className="h-4 w-4 shrink-0 text-brand-cyan" />
                <span className="font-medium text-slate-700">{unit.name}</span>
                {unit.unit_type && <Badge tone="navy">{unit.unit_type}</Badge>}
                {unit.manager_name && <span className="text-xs text-slate-400">Trưởng: {unit.manager_name}</span>}
                <span className="ml-auto flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openCreate(unit)}>
                    Thêm cấp dưới
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(unit)}>
                    Sửa
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(unit)}>
                    Xóa
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Đơn vị: ${editing.name}` : 'Thêm đơn vị'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={save}>
              {editing ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Tên đơn vị" required className="sm:col-span-2">
              <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Cấp trên">
              <Select value={String(form.parent_id ?? '')} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                <option value="">-- Cấp cao nhất --</option>
                {units
                  .filter((u) => u.id !== editing?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Loại đơn vị" hint="VD: Xí nghiệp, Trạm, Tổ">
              <Input value={String(form.unit_type ?? '')} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} />
            </Field>
            <Field label="Trưởng đơn vị">
              <Select value={String(form.manager_employee_id ?? '')} onChange={(e) => setForm({ ...form, manager_employee_id: e.target.value })}>
                <option value="">-- Chưa chỉ định --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Thứ tự">
              <Input type="number" value={String(form.sort_order ?? '')} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}
