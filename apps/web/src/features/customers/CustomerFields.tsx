import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { useReference } from '../../context/ReferenceContext';

export const emptyCustomerForm = {
  name: '',
  group_id: '',
  phone: '',
  address: '',
  tax_code: '',
  contact_person: '',
  personal_id: '',
  budget_relation_code: '',
  max_debt_limit: '',
  bottle_debt_voi: '',
  bottle_debt_up: '',
};

interface CustomerFieldsProps {
  form: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
  showInitialBalances?: boolean;
}

export function CustomerFields({ form, set, showInitialBalances = false }: CustomerFieldsProps) {
  const { groups } = useReference();

  return (
    <FormGrid cols={2}>
      <Field label="Tên khách hàng" required className="sm:col-span-2">
        <Input value={String(form.name ?? '')} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Nhóm khách hàng">
        <Select value={String(form.group_id ?? '')} onChange={(e) => set({ group_id: e.target.value })}>
          <option value="">-- Chưa phân nhóm --</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mã số thuế">
        <Input value={String(form.tax_code ?? '')} onChange={(e) => set({ tax_code: e.target.value })} />
      </Field>
      <Field label="Điện thoại">
        <Input value={String(form.phone ?? '')} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label="Người liên hệ">
        <Input value={String(form.contact_person ?? '')} onChange={(e) => set({ contact_person: e.target.value })} />
      </Field>
      <Field label="Số định danh (CCCD/CMND)">
        <Input value={String(form.personal_id ?? '')} onChange={(e) => set({ personal_id: e.target.value })} />
      </Field>
      <Field label="Mã số ĐV quan hệ ngân sách">
        <Input value={String(form.budget_relation_code ?? '')} onChange={(e) => set({ budget_relation_code: e.target.value })} />
      </Field>
      <Field label="Địa chỉ" required className="sm:col-span-2">
        <Textarea value={String(form.address ?? '')} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Field label="Hạn mức công nợ">
        <Input type="number" value={String(form.max_debt_limit ?? '')} onChange={(e) => set({ max_debt_limit: e.target.value })} />
      </Field>
      {showInitialBalances && (
        <>
          <div />
          <Field label="Nợ vỏ Vòi đầu kỳ (VB T9)">
            <Input type="number" value={String(form.bottle_debt_voi ?? '')} onChange={(e) => set({ bottle_debt_voi: e.target.value })} />
          </Field>
          <Field label="Nợ vỏ Úp đầu kỳ (VB T8)">
            <Input type="number" value={String(form.bottle_debt_up ?? '')} onChange={(e) => set({ bottle_debt_up: e.target.value })} />
          </Field>
        </>
      )}
    </FormGrid>
  );
}
