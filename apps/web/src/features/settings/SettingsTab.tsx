import { Building2, Factory, Layers, Plus, Repeat, ShieldCheck, Tags, Users2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import type { Category, CustomerGroup, PartnerBranch, ProductConversion, Role, Station, Warehouse } from '../../types';

type FieldType = 'text' | 'number' | 'select' | 'checkbox';
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
}: {
  data: T[];
  loading: boolean;
  reload: () => void;
  cfg: SectionCfg<T>;
  title: string;
  subtitle: string;
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Thêm mới
          </Button>
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
                      type={f.type === 'number' ? 'number' : 'text'}
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
  const { staff, products } = useReference();
  const [tab, setTab] = useState('stations');

  const stationsApi = useApi(() => api.stations.list(), []);
  const rolesApi = useApi(() => api.roles.list(), []);
  const categoriesApi = useApi(() => api.categories.list(), []);
  const warehousesApi = useApi(() => api.warehouses.list(), []);
  const branchesApi = useApi(() => api.partnerBranches.list(), []);
  const groupsApi = useApi(() => api.customerGroups.list(), []);
  const conversionsApi = useApi(() => api.productConversions.list(), []);

  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.full_name }));

  const sections: Record<string, ReactNode> = {
    stations: (
      <MasterSection<Station>
        title="Trạm cấp nước"
        subtitle="Danh mục trạm trực thuộc xí nghiệp"
        data={stationsApi.data ?? []}
        loading={stationsApi.loading}
        reload={stationsApi.reload}
        cfg={{
          api: api.stations,
          empty: { code: '', name: '', address: '', phone: '' },
          fields: [
            { name: 'code', label: 'Mã trạm', required: true },
            { name: 'name', label: 'Tên trạm', required: true },
            { name: 'address', label: 'Địa chỉ', colSpan: true },
            { name: 'phone', label: 'Điện thoại' },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Tên trạm', sortValue: (r) => r.name },
            { key: 'address', header: 'Địa chỉ' },
            { key: 'phone', header: 'Điện thoại' },
          ],
        }}
      />
    ),
    roles: (
      <MasterSection<Role>
        title="Vai trò & Phân quyền"
        subtitle="Định nghĩa vai trò người dùng"
        data={rolesApi.data ?? []}
        loading={rolesApi.loading}
        reload={rolesApi.reload}
        cfg={{
          api: api.roles,
          empty: { code: '', name: '', description: '' },
          fields: [
            { name: 'code', label: 'Mã vai trò', required: true },
            { name: 'name', label: 'Tên vai trò', required: true },
            { name: 'description', label: 'Mô tả', colSpan: true },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Vai trò', sortValue: (r) => r.name },
            { key: 'description', header: 'Mô tả' },
          ],
        }}
      />
    ),
    categories: (
      <MasterSection<Category>
        title="Nhóm hàng hóa"
        subtitle="Phân nhóm sản phẩm và dịch vụ"
        data={categoriesApi.data ?? []}
        loading={categoriesApi.loading}
        reload={categoriesApi.reload}
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
        subtitle="6 kho bãi và kho lưu động"
        data={warehousesApi.data ?? []}
        loading={warehousesApi.loading}
        reload={warehousesApi.reload}
        cfg={{
          api: api.warehouses,
          empty: { code: '', name: '', type: 'STORE', manager_employee_id: '', location: '', is_active: true },
          fields: [
            { name: 'code', label: 'Mã kho', required: true },
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
                { value: 'SHELL_STORAGE', label: 'Kho vỏ bình' },
                { value: 'STATION', label: 'Kho trạm' },
              ],
            },
            { name: 'manager_employee_id', label: 'Thủ kho phụ trách', type: 'select', options: staffOptions },
            { name: 'location', label: 'Vị trí', colSpan: true },
            { name: 'is_active', label: 'Đang hoạt động', type: 'checkbox', createOnly: true },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Tên kho', sortValue: (r) => r.name },
            { key: 'type', header: 'Loại' },
            { key: 'manager_name', header: 'Thủ kho', render: (r) => r.manager_name ?? '—' },
            { key: 'location', header: 'Vị trí' },
          ],
        }}
      />
    ),
    branches: (
      <MasterSection<PartnerBranch>
        title="Chi nhánh liên kết"
        subtitle="Đơn vị bạn trong Tổng công ty QUAWANCO"
        data={branchesApi.data ?? []}
        loading={branchesApi.loading}
        reload={branchesApi.reload}
        cfg={{
          api: api.partnerBranches,
          empty: { code: '', name: '', phone: '', address: '', is_internal: 1 },
          fields: [
            { name: 'code', label: 'Mã chi nhánh', required: true },
            { name: 'name', label: 'Tên chi nhánh', required: true },
            { name: 'phone', label: 'Điện thoại' },
            { name: 'address', label: 'Địa chỉ', colSpan: true },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Tên chi nhánh', sortValue: (r) => r.name },
            { key: 'phone', header: 'Điện thoại' },
            { key: 'address', header: 'Địa chỉ' },
          ],
        }}
      />
    ),
    groups: (
      <MasterSection<CustomerGroup>
        title="Nhóm khách hàng"
        subtitle="Phân loại và chiết khấu khách hàng"
        data={groupsApi.data ?? []}
        loading={groupsApi.loading}
        reload={groupsApi.reload}
        cfg={{
          api: api.customerGroups,
          empty: { code: '', name: '', discount_percent: 0 },
          fields: [
            { name: 'code', label: 'Mã nhóm', required: true },
            { name: 'name', label: 'Tên nhóm', required: true },
            { name: 'discount_percent', label: 'Chiết khấu (%)', type: 'number' },
          ],
          columns: [
            { key: 'code', header: 'Mã', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.code },
            { key: 'name', header: 'Nhóm khách hàng', sortValue: (r) => r.name },
            { key: 'discount_percent', header: 'Chiết khấu', align: 'right', render: (r) => `${r.discount_percent}%`, sortValue: (r) => r.discount_percent },
          ],
        }}
      />
    ),
    conversions: (
      <MasterSection<ProductConversion>
        title="Quy cách quy đổi"
        subtitle="Chai ↔ Vỉ ↔ Hộp/Thùng"
        data={conversionsApi.data ?? []}
        loading={conversionsApi.loading}
        reload={conversionsApi.reload}
        cfg={{
          api: api.productConversions,
          empty: { from_product_id: '', to_product_id: '', ratio: 1, note: '' },
          fields: [
            { name: 'from_product_id', label: 'Từ sản phẩm', type: 'select', required: true, options: productOptions },
            { name: 'to_product_id', label: 'Sang sản phẩm', type: 'select', required: true, options: productOptions },
            { name: 'ratio', label: 'Tỷ lệ quy đổi', type: 'number', required: true },
            { name: 'note', label: 'Ghi chú', colSpan: true },
          ],
          columns: [
            { key: 'from_product_name', header: 'Từ sản phẩm', render: (r) => r.from_product_name ?? '—' },
            { key: 'to_product_name', header: 'Sang sản phẩm', render: (r) => r.to_product_name ?? '—' },
            { key: 'ratio', header: 'Tỷ lệ', align: 'right', sortValue: (r) => r.ratio },
            { key: 'note', header: 'Ghi chú' },
          ],
        }}
      />
    ),
  };

  return (
    <>
      <PageHeader title="Danh mục hệ thống" subtitle="Khai báo toàn bộ danh mục nền — không cần sửa trực tiếp trong cơ sở dữ liệu" />
      <Tabs
        className="mb-4"
        items={[
          { id: 'stations', label: 'Trạm', icon: Factory },
          { id: 'roles', label: 'Vai trò', icon: ShieldCheck },
          { id: 'categories', label: 'Nhóm hàng', icon: Layers },
          { id: 'warehouses', label: 'Kho', icon: Building2 },
          { id: 'branches', label: 'Chi nhánh', icon: Users2 },
          { id: 'groups', label: 'Nhóm KH', icon: Tags },
          { id: 'conversions', label: 'Quy đổi', icon: Repeat },
        ]}
        value={tab}
        onChange={setTab}
      />
      {sections[tab]}
    </>
  );
}
