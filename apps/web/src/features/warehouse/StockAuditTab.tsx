import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatNumber, todayISO } from '../../lib/format';
import { stockWarehouses } from '../../lib/warehouses';
import type { StockAuditRow } from '../../types';
import { StockCountModal } from './StockCountModal';

const signedCell = (v: number) =>
  v === 0 ? <span className="text-slate-400">—</span> : <b className={v > 0 ? 'text-emerald-600' : 'text-brand-red'}>{formatNumber(v)}</b>;

const columns: Column<StockAuditRow>[] = [
  { key: 'name', header: 'Sản phẩm', sortValue: (r) => r.name },
  { key: 'opening', header: 'Tồn đầu', align: 'right', render: (r) => formatNumber(r.opening), sortValue: (r) => r.opening },
  { key: 'in_total', header: 'Nhập', align: 'right', render: (r) => formatNumber(r.in_total), sortValue: (r) => r.in_total },
  {
    key: 'return_in',
    header: 'Hàng hoàn',
    align: 'right',
    render: (r) => (r.return_in ? <span className="font-semibold text-indigo-600">{formatNumber(r.return_in)}</span> : '—'),
    sortValue: (r) => r.return_in,
  },
  { key: 'out_sale', header: 'Xuất bán', align: 'right', render: (r) => formatNumber(r.out_sale), sortValue: (r) => r.out_sale },
  {
    key: 'out_promo',
    header: 'Xuất KM',
    align: 'right',
    render: (r) => (r.out_promo ? <span className="font-semibold text-amber-600">{formatNumber(r.out_promo)}</span> : '—'),
    sortValue: (r) => r.out_promo,
  },
  { key: 'out_other', header: 'Xuất khác', align: 'right', render: (r) => formatNumber(r.out_other), sortValue: (r) => r.out_other },
  { key: 'adjust', header: 'Điều chỉnh', align: 'right', render: (r) => signedCell(r.adjust), sortValue: (r) => r.adjust },
  {
    key: 'closing',
    header: 'Tồn cuối (sổ)',
    align: 'right',
    render: (r) => <b className="text-brand-navy">{formatNumber(r.closing)}</b>,
    sortValue: (r) => r.closing,
  },
  { key: 'stock_now', header: 'Tồn hệ thống', align: 'right', render: (r) => formatNumber(r.stock_now), sortValue: (r) => r.stock_now },
  { key: 'diff', header: 'Lệch', align: 'right', render: (r) => signedCell(r.diff), sortValue: (r) => r.diff },
];

export function StockAuditTab() {
  const { warehouses } = useReference();
  const toast = useToast();
  // "Toàn xí nghiệp" = cộng dồn mọi kho chứa hàng; nút "Khách hàng" không phải kho nên không xuất hiện.
  const physical = stockWarehouses(warehouses);

  const [warehouseId, setWarehouseId] = useState('all');
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayISO());
  const [counting, setCounting] = useState(false);

  const isAll = warehouseId === 'all';
  const auditApi = useApi(
    () => api.fetchStockAudit({ warehouse_id: isAll ? 0 : Number(warehouseId), from, to }),
    [warehouseId, from, to]
  );

  const rows = auditApi.data?.rows ?? [];
  const totals = auditApi.data?.totals;

  return (
    <>
      <PageHeader
        title="Đối soát kho"
        subtitle="Tồn đầu + nhập + hàng hoàn − xuất bán − xuất KM − xuất khác ± điều chỉnh = tồn cuối sổ sách; đối chiếu với tồn hệ thống và chốt bằng kiểm kê."
        actions={
          <Button onClick={() => setCounting(true)} disabled={isAll || !rows.length} title={isAll ? 'Chọn từng kho cụ thể để kiểm kê' : undefined}>
            <ClipboardCheck className="h-4 w-4" /> Kiểm kê
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <Field label="Kho">
          <Select dense value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="all">Toàn xí nghiệp (tất cả kho)</option>
            {physical.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Từ ngày">
          <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Tồn đầu kỳ: <b className="text-slate-800">{formatNumber(totals?.opening ?? 0)}</b>
        </span>
        <span>
          Nhập: <b className="text-slate-800">{formatNumber(totals?.in_total ?? 0)}</b>
        </span>
        <span>
          Hàng hoàn: <b className="text-indigo-600">{formatNumber(totals?.return_in ?? 0)}</b>
        </span>
        <span>
          Xuất bán: <b className="text-slate-800">{formatNumber(totals?.out_sale ?? 0)}</b>
        </span>
        <span>
          Xuất KM: <b className="text-amber-600">{formatNumber(totals?.out_promo ?? 0)}</b>
        </span>
        <span>
          Tồn cuối (sổ): <b className="text-brand-navy">{formatNumber(totals?.closing ?? 0)}</b>
        </span>
        {(totals?.diff ?? 0) !== 0 && (
          <span className="font-semibold text-brand-red">Lệch sổ vs hệ thống: {formatNumber(totals?.diff ?? 0)}</span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.product_id}
        loading={auditApi.loading}
        searchPlaceholder="Tìm sản phẩm..."
        pageSize={20}
        emptyMessage="Chưa có dữ liệu kho cho kỳ này"
      />

      <StockCountModal
        open={counting}
        onClose={() => setCounting(false)}
        warehouseId={Number(warehouseId)}
        rows={rows.map((r) => ({ product_id: r.product_id, name: r.name, current: r.stock_now }))}
        onDone={auditApi.reload}
      />
    </>
  );
}
