import { ArrowLeftRight, Boxes, ClipboardList, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, FormGrid, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatDate, formatNumber } from '../../lib/format';
import type { StockItem, StockMovement } from '../../types';

const URGENCY: Record<string, { label: string; tone: 'red' | 'amber' | 'cyan' | 'green' }> = {
  CRITICAL: { label: 'Cực gấp', tone: 'red' },
  HIGH: { label: 'Cao', tone: 'amber' },
  MEDIUM: { label: 'Trung bình', tone: 'cyan' },
  NORMAL: { label: 'Bình thường', tone: 'green' },
};

const MOVEMENT_LABEL: Record<string, string> = {
  IMPORT: 'Nhập kho',
  EXPORT_ORDER: 'Xuất bán',
  TRANSFER_OUT: 'Chuyển đi',
  TRANSFER_IN: 'Chuyển đến',
  LOAN_OUT: 'Cho vay / trả đi',
  LOAN_IN: 'Nhận vay / nhận về',
  ADJUSTMENT: 'Điều chỉnh',
};

export function WarehouseTab() {
  const { products, warehouses, staff } = useReference();
  const [tab, setTab] = useState('stock');
  const stockApi = useApi(() => api.fetchStock(), []);
  const movementsApi = useApi(() => api.fetchMovements({ limit: 300 }), []);
  const toast = useToast();

  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [adjustForm, setAdjustForm] = useState<Record<string, unknown>>({});
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<Record<string, unknown>>({});

  const openAdjust = (row: StockItem) => {
    setAdjusting(row);
    setAdjustForm({ quantity: row.quantity, min_stock_alert: row.min_stock_alert, avg_daily_sales: row.avg_daily_sales });
  };

  const submitAdjust = async () => {
    if (!adjusting) return;
    try {
      await api.updateStock(adjusting.id, adjustForm);
      toast.success('Đã điều chỉnh tồn kho');
      setAdjusting(null);
      stockApi.reload();
      movementsApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được');
    }
  };

  const openTransfer = () => {
    setTransferForm({
      source_warehouse_id: warehouses[0]?.id ?? '',
      target_warehouse_id: warehouses[1]?.id ?? '',
      product_id: products[0]?.id ?? '',
      quantity: 1,
      employee_id: '',
      note: '',
    });
    setTransferOpen(true);
  };

  const submitTransfer = async () => {
    try {
      await api.transferStock(transferForm);
      toast.success('Đã điều chuyển hàng giữa các kho');
      setTransferOpen(false);
      stockApi.reload();
      movementsApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không điều chuyển được');
    }
  };

  const stockColumns: Column<StockItem>[] = [
    { key: 'product_name', header: 'Sản phẩm', sortValue: (r) => r.product_name },
    { key: 'warehouse_name', header: 'Kho', sortValue: (r) => r.warehouse_name },
    { key: 'unit', header: 'ĐVT', align: 'center' },
    { key: 'quantity', header: 'Tồn hiện tại', align: 'right', render: (r) => <b className="text-slate-800">{formatNumber(r.quantity)}</b>, sortValue: (r) => r.quantity },
    { key: 'min_stock_alert', header: 'Ngưỡng tối thiểu', align: 'right', sortValue: (r) => r.min_stock_alert },
    { key: 'avg_daily_sales', header: 'Bán TB/ngày', align: 'right', render: (r) => r.avg_daily_sales.toFixed(1), sortValue: (r) => r.avg_daily_sales },
    { key: 'days_left', header: 'Ngày còn lại', align: 'right', render: (r) => `${r.days_left}`, sortValue: (r) => r.days_left },
    {
      key: 'urgency_level',
      header: 'Mức độ',
      align: 'center',
      render: (r) => <Badge tone={URGENCY[r.urgency_level]?.tone ?? 'neutral'}>{URGENCY[r.urgency_level]?.label ?? r.urgency_level}</Badge>,
      sortValue: (r) => r.urgency_level,
    },
  ];

  const movementColumns: Column<StockMovement>[] = [
    { key: 'created_at', header: 'Thời điểm', render: (r) => formatDate(r.created_at), sortValue: (r) => r.created_at },
    {
      key: 'movement_type',
      header: 'Loại',
      render: (r) => (
        <Badge tone={r.movement_type.includes('IN') || r.movement_type === 'IMPORT' ? 'green' : r.movement_type.includes('OUT') || r.movement_type === 'EXPORT_ORDER' ? 'red' : 'amber'}>
          {MOVEMENT_LABEL[r.movement_type] ?? r.movement_type}
        </Badge>
      ),
      sortValue: (r) => r.movement_type,
    },
    { key: 'product_name', header: 'Sản phẩm', sortValue: (r) => r.product_name },
    { key: 'quantity', header: 'SL', align: 'right', sortValue: (r) => r.quantity },
    { key: 'quantity_promo', header: 'KM', align: 'right', render: (r) => r.quantity_promo || '—' },
    { key: 'source_warehouse_name', header: 'Từ kho', render: (r) => r.source_warehouse_name ?? '—' },
    { key: 'target_warehouse_name', header: 'Đến kho', render: (r) => r.target_warehouse_name ?? '—' },
    { key: 'performed_by_name', header: 'Người thực hiện', render: (r) => r.performed_by_name ?? '—' },
    { key: 'note', header: 'Ghi chú', render: (r) => <span className="text-slate-500">{r.note ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Tồn kho & Nhật ký"
        subtitle="Quản lý tồn kho 6 kho, điều chuyển nội bộ và nhật ký xuất nhập"
        actions={
          <>
            <Tabs
              items={[
                { id: 'stock', label: 'Tồn kho', icon: Boxes },
                { id: 'movements', label: 'Nhật ký kho', icon: ClipboardList },
              ]}
              value={tab}
              onChange={setTab}
            />
            <Button onClick={openTransfer}>
              <ArrowLeftRight className="h-4 w-4" /> Điều chuyển kho
            </Button>
          </>
        }
      />

      {tab === 'stock' && (
        <DataTable
          columns={stockColumns}
          data={stockApi.data ?? []}
          rowKey={(r) => r.id}
          loading={stockApi.loading}
          onRowClick={openAdjust}
          searchPlaceholder="Tìm theo sản phẩm, kho..."
          initialSortKey="quantity"
        />
      )}

      {tab === 'movements' && (
        <DataTable
          columns={movementColumns}
          data={movementsApi.data ?? []}
          rowKey={(r) => r.id}
          loading={movementsApi.loading}
          searchPlaceholder="Tìm theo sản phẩm, loại giao dịch, ghi chú..."
        />
      )}

      <Modal
        open={!!adjusting}
        onClose={() => setAdjusting(null)}
        size="sm"
        title="Điều chỉnh tồn kho"
        subtitle={adjusting ? `${adjusting.product_name} · ${adjusting.warehouse_name}` : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAdjusting(null)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitAdjust}>
              Lưu điều chỉnh
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <SlidersHorizontal className="h-4 w-4" /> Mọi thay đổi đều được ghi vào nhật ký kho.
          </div>
          <Field label="Số lượng tồn thực tế">
            <Input type="number" value={String(adjustForm.quantity ?? '')} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
          </Field>
          <FormGrid cols={2}>
            <Field label="Ngưỡng tối thiểu">
              <Input type="number" value={String(adjustForm.min_stock_alert ?? '')} onChange={(e) => setAdjustForm({ ...adjustForm, min_stock_alert: e.target.value })} />
            </Field>
            <Field label="Bán TB/ngày">
              <Input type="number" value={String(adjustForm.avg_daily_sales ?? '')} onChange={(e) => setAdjustForm({ ...adjustForm, avg_daily_sales: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      </Modal>

      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Điều chuyển hàng giữa các kho"
        subtitle="Kho Tăng Áp → Kho Huế → Xe tải điện..."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(false)}>
              Hủy bỏ
            </Button>
            <Button size="sm" onClick={submitTransfer}>
              Thực hiện điều chuyển
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <FormGrid cols={2}>
            <Field label="Kho nguồn" required>
              <Select value={String(transferForm.source_warehouse_id ?? '')} onChange={(e) => setTransferForm({ ...transferForm, source_warehouse_id: e.target.value })}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kho đích" required>
              <Select value={String(transferForm.target_warehouse_id ?? '')} onChange={(e) => setTransferForm({ ...transferForm, target_warehouse_id: e.target.value })}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
          <Field label="Sản phẩm" required>
            <Select value={String(transferForm.product_id ?? '')} onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <FormGrid cols={2}>
            <Field label="Số lượng" required>
              <Input type="number" value={String(transferForm.quantity ?? '')} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} />
            </Field>
            <Field label="Người thực hiện">
              <Select value={String(transferForm.employee_id ?? '')} onChange={(e) => setTransferForm({ ...transferForm, employee_id: e.target.value })}>
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
            <Input value={String(transferForm.note ?? '')} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
