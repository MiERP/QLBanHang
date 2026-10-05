import { useState } from 'react';
import { Plus } from 'lucide-react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatDateTime, formatNumber, todayISO } from '../../lib/format';
import type { ShellMovement } from '../../types';

const MOVEMENT_LABEL: Record<string, string> = {
  IN: 'Nhập vỏ về xí nghiệp',
  OUT: 'Xuất vỏ theo đơn',
  RETURN: 'Thu hồi vỏ về xí nghiệp',
  WRITE_OFF: 'Xuất hủy vỏ',
  ADJUST_IN: 'Điều chỉnh tăng',
  ADJUST_OUT: 'Điều chỉnh giảm',
};

const MOVEMENT_TONE: Record<string, 'green' | 'amber' | 'indigo' | 'red' | 'neutral' | 'cyan'> = {
  IN: 'green',
  RETURN: 'cyan',
  ADJUST_IN: 'green',
  OUT: 'amber',
  WRITE_OFF: 'red',
  ADJUST_OUT: 'red',
};

const MANUAL_TYPES = [
  { value: 'IN', label: 'Nhập vỏ về xí nghiệp' },
  { value: 'WRITE_OFF', label: 'Xuất hủy vỏ' },
  { value: 'ADJUST_IN', label: 'Điều chỉnh tăng' },
  { value: 'ADJUST_OUT', label: 'Điều chỉnh giảm' },
];

const movementColumns: Column<ShellMovement>[] = [
  // created_at là mốc thời gian thật (UTC) — hiển thị kèm giờ, cắt 10 ký tự sẽ lùi ngày với phát sinh sau 17h UTC.
  { key: 'created_at', header: 'Ngày', render: (r) => formatDateTime(r.created_at), sortValue: (r) => r.created_at },
  {
    key: 'movement_type',
    header: 'Nghiệp vụ',
    render: (r) => <Badge tone={MOVEMENT_TONE[r.movement_type] ?? 'neutral'}>{MOVEMENT_LABEL[r.movement_type] ?? r.movement_type}</Badge>,
    sortValue: (r) => r.movement_type,
  },
  { key: 'bottle_type', header: 'Loại vỏ', align: 'center', render: (r) => (r.bottle_type === 'VOI' ? 'Vòi' : 'Úp'), sortValue: (r) => r.bottle_type },
  { key: 'quantity', header: 'Số lượng', align: 'right', render: (r) => formatNumber(r.quantity), sortValue: (r) => r.quantity },
  {
    key: 'reference',
    header: 'Gắn với',
    render: (r) =>
      r.order_code ? (
        <span className="font-mono text-xs text-brand-navy">{r.order_code}</span>
      ) : r.customer_name ? (
        r.customer_name
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  { key: 'performed_by_name', header: 'Người thực hiện', render: (r) => r.performed_by_name ?? '—' },
  { key: 'note', header: 'Ghi chú', render: (r) => r.note || '—' },
];

export function ShellStockTab() {
  const { staff } = useReference();
  const toast = useToast();
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayISO());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    movement_type: 'IN',
    bottle_type: 'VOI',
    quantity: '',
    performed_by: '',
    movement_date: todayISO(),
    note: '',
  });

  const stockApi = useApi(() => api.fetchShellStock(), []);
  const movementsApi = useApi(() => api.fetchShellMovements({ from, to }), [from, to]);

  const save = async () => {
    if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Nhập số lượng vỏ');
    setSaving(true);
    try {
      await api.createShellMovement({
        movement_type: form.movement_type,
        bottle_type: form.bottle_type,
        quantity: Number(form.quantity),
        performed_by: form.performed_by ? Number(form.performed_by) : undefined,
        movement_date: form.movement_date,
        note: form.note,
      });
      toast.success('Đã ghi nhận vỏ');
      setOpen(false);
      setForm({ ...form, quantity: '', note: '' });
      stockApi.reload();
      movementsApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không ghi nhận được');
    } finally {
      setSaving(false);
    }
  };

  const totals = stockApi.data?.totals;
  const stock = stockApi.data?.stock;

  return (
    <>
      <PageHeader
        title="Vỏ bình"
        subtitle="Vỏ gắn với sản phẩm và chỉ có hai nơi: khách đang giữ hoặc xí nghiệp đang giữ — không theo kho. Cọc theo loại vỏ ở Danh mục hệ thống."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Ghi nhận vỏ
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Xí nghiệp đang giữ: Vòi{' '}
          <b className={(stock?.voi ?? 0) < 0 ? 'text-brand-red' : 'text-slate-800'}>{formatNumber(stock?.voi ?? 0)}</b> · Úp{' '}
          <b className={(stock?.up ?? 0) < 0 ? 'text-brand-red' : 'text-slate-800'}>{formatNumber(stock?.up ?? 0)}</b>
        </span>
        <span>
          Khách đang giữ: Vòi <b className="text-amber-600">{formatNumber(totals?.customer_voi ?? 0)}</b> · Úp{' '}
          <b className="text-amber-600">{formatNumber(totals?.customer_up ?? 0)}</b>
        </span>
        <span>
          Đối tác đang giữ: Vòi <b className="text-indigo-600">{formatNumber(totals?.partner_voi ?? 0)}</b> · Úp{' '}
          <b className="text-indigo-600">{formatNumber(totals?.partner_up ?? 0)}</b>
        </span>
        <span>
          Tổng vỏ Vòi: <b className="text-brand-navy">{formatNumber(totals?.all_voi ?? 0)}</b> · Tổng vỏ Úp:{' '}
          <b className="text-brand-navy">{formatNumber(totals?.all_up ?? 0)}</b>
        </span>
      </div>

      <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left">Vỏ xí nghiệp đang giữ</th>
              <th className="px-4 py-3 text-right">Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-brand-cyan-subtle">
              <td className="px-4 py-2.5 font-medium text-slate-700">Vỏ Vòi</td>
              <td className={`px-4 py-2.5 text-right ${(stock?.voi ?? 0) < 0 ? 'font-bold text-brand-red' : 'text-slate-700'}`}>
                {formatNumber(stock?.voi ?? 0)}
              </td>
            </tr>
            <tr className="hover:bg-brand-cyan-subtle">
              <td className="px-4 py-2.5 font-medium text-slate-700">Vỏ Úp</td>
              <td className={`px-4 py-2.5 text-right ${(stock?.up ?? 0) < 0 ? 'font-bold text-brand-red' : 'text-slate-700'}`}>
                {formatNumber(stock?.up ?? 0)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-bold text-slate-800">
              <td className="px-4 py-3 text-left">Tổng</td>
              <td className="px-4 py-3 text-right text-brand-navy">{formatNumber(stock?.total ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
        {(stock?.voi ?? 0) < 0 || (stock?.up ?? 0) < 0 ? (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-brand-red">
            Số âm nghĩa là chưa khai tồn vỏ đầu kỳ: sổ mới chỉ có bút toán xuất vỏ cho khách. Hãy dùng “Ghi nhận vỏ” → “Điều chỉnh
            tăng” để khai số vỏ xí nghiệp đang giữ.
          </p>
        ) : null}
      </div>

      {!!stockApi.data?.partners.length && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-sm text-slate-700">
          <b className="text-brand-navy">Vỏ đang ở đối tác:</b>{' '}
          {stockApi.data.partners.map((p) => `${p.partner_unit_name} (Vòi ${p.voi} · Úp ${p.up})`).join(' · ')}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <Field label="Từ ngày">
          <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <DataTable
        columns={movementColumns}
        data={movementsApi.data ?? []}
        rowKey={(r) => r.id}
        loading={movementsApi.loading}
        searchPlaceholder="Tìm theo đơn hàng, khách, ghi chú..."
        initialSortKey="created_at"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage="Chưa có phát sinh vỏ trong kỳ"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title="Ghi nhận vỏ bình"
        subtitle="Nhập vỏ, xuất hủy hoặc điều chỉnh số vỏ xí nghiệp đang giữ — vỏ theo đơn hàng và khách trả vỏ được hệ thống tự ghi"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Ghi nhận'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Nghiệp vụ" required>
              <Select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value })}>
                {MANUAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Loại vỏ" required>
              <Select value={form.bottle_type} onChange={(e) => setForm({ ...form, bottle_type: e.target.value })}>
                <option value="VOI">Vỏ Vòi</option>
                <option value="UP">Vỏ Úp</option>
              </Select>
            </Field>
            <Field label="Số lượng" required>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label="Ngày">
              <Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
            </Field>
            <Field label="Người thực hiện">
              <Select value={form.performed_by} onChange={(e) => setForm({ ...form, performed_by: e.target.value })}>
                <option value="">-- Không chỉ định --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
          <Field label="Ghi chú">
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
