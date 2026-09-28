import { useEffect, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatNumber, todayISO } from '../../lib/format';

export interface StockCountRow {
  product_id: number;
  name: string;
  current: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  warehouseId: number;
  /** Có danh sách kho thì hiện ô chọn kho trong modal; không có thì dùng kho đã chọn sẵn ở màn ngoài. */
  warehouses?: { id: number; name: string }[];
  onWarehouseChange?: (id: number) => void;
  rows: StockCountRow[];
  defaultNote?: string;
  onDone: () => void;
}

// Một nguồn duy nhất cho nghiệp vụ kiểm kê: nhập số đếm thực tế, hệ thống tự tạo phiếu điều chỉnh phần lệch.
export function StockCountModal({ open, onClose, warehouseId, warehouses, onWarehouseChange, rows, defaultNote = '', onDone }: Props) {
  const toast = useToast();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    onClose();
  };

  // Mỗi lần mở (hoặc đổi kho): ô nhập bắt đầu bằng tồn hệ thống, ghi chú về mặc định.
  useEffect(() => {
    if (!open) return;
    const next: Record<number, string> = {};
    for (const row of rows) next[row.product_id] = String(row.current);
    setCounts(next);
    setNote(defaultNote);
    setDate(todayISO());
    // Chỉ khởi tạo lại khi mở/đổi kho — không phụ thuộc rows để không xoá số người dùng đang gõ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, warehouseId]);

  const submit = async () => {
    if (!warehouseId) return toast.error('Chọn kho cần kiểm kê');
    const lines = rows.map((row) => ({ product_id: row.product_id, counted: Number(counts[row.product_id] ?? row.current) || 0 }));
    setSaving(true);
    try {
      const res = await api.submitStockCount({ warehouse_id: warehouseId, count_date: date, lines, note });
      if (res.tickets.length) toast.success(`Đã chốt kiểm kê — phiếu điều chỉnh: ${res.tickets.join(', ')}`);
      else toast.success('Số đếm khớp tồn hệ thống — không cần điều chỉnh');
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không chốt được kiểm kê');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Nhập tồn kho"
      subtitle="Nhập số lượng thực tế — hệ thống tự tạo phiếu điều chỉnh cho phần lệch"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={close} disabled={saving}>
            Hủy bỏ
          </Button>
          <Button size="sm" onClick={submit} disabled={saving || !rows.length}>
            {saving ? 'Đang chốt...' : 'Chốt kiểm kê'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5">
        <FormGrid cols={3}>
          {warehouses && (
            <Field label="Kho" required>
              <Select
                value={String(warehouseId || '')}
                onChange={(e) => {
                  onWarehouseChange?.(Number(e.target.value));
                  setCounts({});
                }}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Ngày kiểm kê">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ghi chú">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: tồn kho đầu kỳ" />
          </Field>
        </FormGrid>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="w-28 px-3 py-2 text-right">Tồn hệ thống</th>
                <th className="w-32 px-3 py-2 text-right">Số lượng thực tế</th>
                <th className="w-24 px-3 py-2 text-right">Lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const value = counts[row.product_id];
                const counted = value === undefined ? row.current : Number(value) || 0;
                const delta = counted - row.current;
                return (
                  <tr key={row.product_id}>
                    <td className="px-3 py-1.5 text-slate-700">{row.name}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500">{formatNumber(row.current)}</td>
                    <td className="px-3 py-1.5">
                      <Input
                        dense
                        type="number"
                        value={value ?? String(row.current)}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [row.product_id]: e.target.value }))}
                      />
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-semibold ${
                        delta === 0 ? 'text-slate-400' : delta > 0 ? 'text-emerald-600' : 'text-brand-red'
                      }`}
                    >
                      {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
