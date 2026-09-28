import { Briefcase, Building2, Coins, Layers, Network, Percent, Plus, Settings2, Tags } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatDate, formatNumber } from '../../lib/format';
import type { Category, CustomerGroup, ShellDeposit, VatRate, Warehouse } from '../../types';
import { PositionsTab } from '../positions/PositionsTab';
import { UnitsTab } from '../units/UnitsTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';

type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'date';
interface FieldCfg {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string | number; label: string }[];
  required?: boolean;
  colSpan?: boolean;
  editOnly?: boolean;
  createOnly?: boolean;
}

interface SectionCfg<T> {
  columns: Column<T>[];
  fields: FieldCfg[];
  empty: Record<string, unknown>;
  api: { create: (d: Record<string, unknown>) => Promise<unknown>; update: (id: number, d: Record<string, unknown>) => Promise<unknown>; remove: (id: number) => Promise<unknown> };
}

function MasterSection<T extends { id: number }>({
  data,
  loading,
  reload,
  cfg,
  title,
  subtitle,
  extra,
}: {
  data: T[];
  loading: boolean;
  reload: () => void;
  cfg: SectionCfg<T>;
  title: string;
  subtitle: string;
  extra?: ReactNode;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ ...cfg.empty });
    setOpen(true);
  };
  const openEdit = (row: T) => {
    setEditing(row);
    const next: Record<string, unknown> = {};
    for (const f of cfg.fields) next[f.name] = (row as Record<string, unknown>)[f.name] ?? '';
    setForm(next);
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload: Record<string, unknown> = {};
      for (const f of cfg.fields) {
        if (f.editOnly && !editing) continue;
        if (f.createOnly && editing) continue;
        if (form[f.name] === undefined) continue;
        payload[f.name] = f.type === 'checkbox' ? (form[f.name] ? 1 : 0) : form[f.name];
      }
      if (editing) {
        await cfg.api.update(editing.id, payload);
        toast.success('Đã cập nhật danh mục');
      } else {
        await cfg.api.create(payload);
        toast.success('Đã thêm mới danh mục');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const remove = async (row: T) => {
    const ok = await confirm({ title: 'Xóa danh mục', message: 'Bạn chắc chắn muốn xóa bản ghi này?', danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await cfg.api.remove(row.id);
      toast.success('Đã xóa danh mục');
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được (có thể đang được tham chiếu)');
    }
  };

  return (
    <>
      <DataTable
        columns={cfg.columns}
        data={data}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={openEdit}
        searchPlaceholder={`Tìm trong ${title.toLowerCase()}...`}
        toolbar={
          <>
            {extra}
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Thêm mới
            </Button>
          </>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Sửa: ${title}` : `Thêm mới: ${title}`}
        subtitle={subtitle}
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
        <div className="p-5">
          <FormGrid cols={2}>
            {cfg.fields
              .filter((f) => !(f.editOnly && !editing) && !(f.createOnly && editing))
              .map((f) => (
                <Field key={f.name} label={f.label} required={f.required} className={f.colSpan ? 'sm:col-span-2' : undefined}>
                  {f.type === 'select' ? (
                    <Select value={String(form[f.name] ?? '')} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                      <option value="">-- Chọn --</option>
                      {(f.options ?? []).map((o) => (
                        <option key={String(o.value)} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === 'checkbox' ? (
                    <label className="flex h-9 items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                      Bật
                    </label>
                  ) : (
                    <Input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={String(form[f.name] ?? '')}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                </Field>
              ))}
          </FormGrid>
        </div>
      </Modal>
    </>
  );
}

export function SettingsTab() {
  const { staff, reload: reloadRefs } = useReference();
  const [tab, setTab] = useState('units');

  const categoriesApi = useApi(() => api.categories.list(), []);
  const warehousesApi = useApi(() => api.warehouses.list(), []);
  const groupsApi = useApi(() => api.customerGroups.list(), []);
  const vatApi = useApi(() => api.vatRates.list(), []);
  const shellApi = useApi(() => api.shellDeposits.list(), []);
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.full_name }));

  const sections: Record<string, ReactNode> = {
    general: <GeneralSettingsTab />,
    units: <UnitsTab />,
    categories: (
      <MasterSection<Category>
        title="Nhóm hàng hóa"
        subtitle="Phân nhóm sản phẩm và dịch vụ"
        data={categoriesApi.data ?? []}
        loading={categoriesApi.loading}
        reload={categoriesApi.reload}
        extra={
          <ImportExcelButton
            kind="categories"
            hint="Nhóm hàng là danh mục nền — nhập trước khi nhập sản phẩm từ Excel."
            onDone={() => {
              categoriesApi.reload();
              reloadRefs();
            }}
          />
        }
        cfg={{
          api: api.categories,
          empty: { code: '', name: '', type: 'BOTTLE_WATER' },
          fields: [
            { name: 'code', label: 'Mã nhóm', required: true },
            { name: 'name', label: 'Tên nhóm', required: true },
            {
              name: 'type',
              label: 'Loại nhóm',
              type: 'select',
              required: true,
              options: [
                { value: 'BOTTLE_WATER', label: 'Nước đóng bình 19L' },
                { value: 'PACK_WATER', label: 'Nước đóng chai nhỏ' },
                { value: 'SERVICE_DVGT', label: 'Dịch vụ gia tăng' },
              ],
            },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Tên nhóm', sortValue: (r) => r.name },
            {
              key: 'type',
              header: 'Loại',
              render: (r) => (
                <Badge tone={r.type === 'SERVICE_DVGT' ? 'amber' : 'cyan'}>
                  {r.type === 'BOTTLE_WATER' ? 'Bình 19L' : r.type === 'PACK_WATER' ? 'Chai nhỏ' : 'DVGT'}
                </Badge>
              ),
            },
          ],
        }}
      />
    ),
    warehouses: (
      <MasterSection<Warehouse>
        title="Kho hàng"
        subtitle="Kho bãi, xe lưu động, khách hàng và kho ảo"
        data={warehousesApi.data ?? []}
        loading={warehousesApi.loading}
        reload={warehousesApi.reload}
        extra={
          <ImportExcelButton
            kind="warehouses"
            hint="Nhập kho từ Excel. Nên nhập kho trước khi nhập tồn kho đầu kỳ và đơn hàng."
            onDone={() => {
              warehousesApi.reload();
              reloadRefs();
            }}
          />
        }
        cfg={{
          api: api.warehouses,
          empty: { name: '', type: 'STORE', manager_employee_id: '', location: '', is_active: true },
          fields: [
            { name: 'name', label: 'Tên kho', required: true },
            {
              name: 'type',
              label: 'Loại kho',
              type: 'select',
              required: true,
              options: [
                { value: 'CENTRAL', label: 'Kho trung tâm' },
                { value: 'STORE', label: 'Kho cửa hàng' },
                { value: 'VEHICLE', label: 'Kho lưu động (xe)' },
                { value: 'STATION', label: 'Kho trạm' },
                { value: 'CUSTOMER', label: 'Khách hàng' },
                { value: 'VIRTUAL', label: 'Kho ảo (trung gian)' },
              ],
            },
            { name: 'manager_employee_id', label: 'Thủ kho phụ trách', type: 'select', options: staffOptions },
            { name: 'location', label: 'Vị trí', colSpan: true },
            { name: 'is_active', label: 'Đang hoạt động', type: 'checkbox' },
          ],
          columns: [
            { key: 'name', header: 'Tên kho', sortValue: (r) => r.name },
            { key: 'type', header: 'Loại' },
            { key: 'manager_name', header: 'Thủ kho', render: (r) => r.manager_name ?? '—' },
            { key: 'location', header: 'Vị trí' },
          ],
        }}
      />
    ),
    groups: (
      <MasterSection<CustomerGroup>
        title="Nhóm khách hàng"
        subtitle="Phân loại khách hàng"
        data={groupsApi.data ?? []}
        loading={groupsApi.loading}
        reload={groupsApi.reload}
        extra={
          <ImportExcelButton
            kind="customer-groups"
            hint="Nhóm khách hàng dùng để phân loại và áp bảng giá riêng — nhập trước khi nhập khách hàng."
            onDone={() => {
              groupsApi.reload();
              reloadRefs();
            }}
          />
        }
        cfg={{
          api: api.customerGroups,
          empty: { code: '', name: '' },
          fields: [
            { name: 'code', label: 'Mã nhóm', required: true },
            { name: 'name', label: 'Tên nhóm', required: true },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Nhóm khách hàng', sortValue: (r) => r.name },
          ],
        }}
      />
    ),
    positions: <PositionsTab />,
    shells: (
      <MasterSection<ShellDeposit>
        title="Cọc vỏ bình"
        subtitle="Một mức cọc cho mỗi loại vỏ — dùng chung cho cả thu cọc khi giao hàng lẫn hoàn cọc khi thu hồi"
        data={shellApi.data ?? []}
        loading={shellApi.loading}
        reload={shellApi.reload}
        cfg={{
          api: api.shellDeposits,
          empty: { bottle_type: 'VOI', deposit_fee: 0, note: '' },
          fields: [
            {
              name: 'bottle_type',
              label: 'Loại vỏ',
              type: 'select',
              required: true,
              options: [
                { value: 'VOI', label: 'Vỏ Vòi' },
                { value: 'UP', label: 'Vỏ Úp' },
              ],
            },
            { name: 'deposit_fee', label: 'Tiền cọc (đ/bình)', type: 'number', required: true },
            { name: 'note', label: 'Ghi chú', colSpan: true },
          ],
          columns: [
            {
              key: 'bottle_type',
              header: 'Loại vỏ',
              render: (r) => <Badge tone={r.bottle_type === 'VOI' ? 'cyan' : 'indigo'}>{r.bottle_type === 'VOI' ? 'Vỏ Vòi' : 'Vỏ Úp'}</Badge>,
              sortValue: (r) => r.bottle_type,
            },
            {
              key: 'deposit_fee',
              header: 'Tiền cọc',
              align: 'right',
              render: (r) => `${formatNumber(r.deposit_fee)} đ`,
              sortValue: (r) => r.deposit_fee,
            },
            { key: 'note', header: 'Ghi chú', render: (r) => r.note || '—' },
          ],
        }}
      />
    ),
    vat: (
      <MasterSection<VatRate>
        title="Thuế suất GTGT"
        subtitle="Danh mục theo thời hiệu — luật đổi thuế chỉ cần thêm dòng mới, số liệu kỳ cũ giữ nguyên"
        data={vatApi.data ?? []}
        loading={vatApi.loading}
        reload={vatApi.reload}
        cfg={{
          api: api.vatRates,
          empty: { code: '', name: '', rate: 8, effective_from: '', effective_to: '', note: '' },
          fields: [
            { name: 'code', label: 'Mã', required: true },
            { name: 'name', label: 'Nhóm thuế', required: true },
            { name: 'rate', label: 'Thuế suất (%)', type: 'number', required: true },
            { name: 'effective_from', label: 'Hiệu lực từ ngày', type: 'date' },
            { name: 'effective_to', label: 'Đến ngày (bỏ trống = còn hiệu lực)', type: 'date' },
            { name: 'note', label: 'Ghi chú', colSpan: true },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Nhóm thuế', sortValue: (r) => r.name },
            {
              key: 'rate',
              header: 'Thuế suất',
              align: 'right',
              render: (r) => `${formatNumber(r.rate)}%`,
              sortValue: (r) => r.rate,
            },
            { key: 'effective_from', header: 'Từ ngày', render: (r) => (r.effective_from ? formatDate(r.effective_from) : '—') },
            { key: 'effective_to', header: 'Đến ngày', render: (r) => (r.effective_to ? formatDate(r.effective_to) : 'Còn hiệu lực') },
            { key: 'note', header: 'Ghi chú', render: (r) => r.note || '—' },
          ],
        }}
      />
    ),
  };

  return (
    <>
      <PageHeader
        title="Danh mục hệ thống"
        subtitle="Khai báo tập trung toàn bộ danh mục nền — đơn vị, nhóm hàng, kho, nhóm khách hàng, chức vụ"
      />
      <Tabs
        className="mb-4"
        items={[
          { id: 'general', label: 'Cấu hình chung', icon: Settings2 },
          { id: 'units', label: 'Đơn vị', icon: Network },
          { id: 'categories', label: 'Nhóm hàng', icon: Layers },
          { id: 'warehouses', label: 'Kho', icon: Building2 },
          { id: 'groups', label: 'Nhóm KH', icon: Tags },
          { id: 'positions', label: 'Chức vụ', icon: Briefcase },
          { id: 'shells', label: 'Cọc vỏ', icon: Coins },
          { id: 'vat', label: 'Thuế suất VAT', icon: Percent },
        ]}
        value={tab}
        onChange={setTab}
      />
      {sections[tab]}
    </>
  );
}
