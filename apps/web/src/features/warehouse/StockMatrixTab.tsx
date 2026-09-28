import { ClipboardCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { cn } from '../../lib/cn';
import { formatNumber } from '../../lib/format';
import { stockWarehouses } from '../../lib/warehouses';
import { StockCountModal } from './StockCountModal';

export function StockMatrixTab({ focus }: { focus?: { warehouse_id: number; product_id: number } | null }) {
  const { warehouses: allWarehouses, products: allProducts } = useReference();
  const warehouses = stockWarehouses(allWarehouses);
  // Dịch vụ không có tồn kho → chỉ hiển thị hàng bán.
  const products = allProducts.filter((p) => p.product_type !== 'SERVICE');
  const { data, loading, reload } = useApi(() => api.fetchStock(), []);
  const [countWarehouseId, setCountWarehouseId] = useState<number | null>(null);

  const focusWarehouse = focus ? warehouses.find((w) => w.id === focus.warehouse_id) : undefined;
  const focusProduct = focus ? products.find((p) => p.id === focus.product_id) : undefined;
  const isFocusedCell = (warehouseId: number, productId: number) =>
    !!focus && focus.warehouse_id === warehouseId && focus.product_id === productId;

  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data ?? []) m.set(`${s.warehouse_id}-${s.product_id}`, s.quantity);
    return m;
  }, [data]);

  const qty = (warehouseId: number, productId: number) => map.get(`${warehouseId}-${productId}`) ?? 0;
  const productTotal = (productId: number) => warehouses.reduce((a, w) => a + qty(w.id, productId), 0);
  const warehouseTotal = (warehouseId: number) => products.reduce((a, p) => a + qty(warehouseId, p.id), 0);
  const grandTotal = products.reduce((a, p) => a + productTotal(p.id), 0);

  return (
    <>
      <PageHeader
        title="Tồn kho"
        subtitle={`${products.length} sản phẩm × ${warehouses.length} kho · số lượng tồn và tổng cộng`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!warehouses.length}
              onClick={() => setCountWarehouseId(warehouses[0]?.id ?? null)}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Nhập tồn đầu kỳ
            </Button>
            <ImportExcelButton
              kind="opening-stock"
              hint="Số lượng trong tệp là tồn THỰC TẾ — hệ thống tự tạo phiếu điều chỉnh tăng/giảm cho khớp. Cần nhập sản phẩm và kho trước."
              allowUpsert={false}
              onDone={reload}
            />
          </>
        }
      />

      {focus && focusWarehouse && focusProduct && (
        <div className="mb-3 rounded-lg border border-brand-red/30 bg-brand-red-light/60 px-3 py-2 text-xs text-brand-red">
          Đang xem cảnh báo: <b>{focusWarehouse.name}</b> — {focusProduct.name} (tồn{' '}
          <b>{formatNumber(qty(focus.warehouse_id, focus.product_id))}</b>)
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-14 text-center text-sm text-slate-400">Đang tải...</div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left">Sản phẩm</th>
                {warehouses.map((w) => (
                  <th key={w.id} className={cn('px-4 py-3 text-right', focus?.warehouse_id === w.id && 'text-brand-red')}>
                    {w.name}
                  </th>
                ))}
                <th className="bg-brand-cyan-subtle px-4 py-3 text-right text-brand-navy">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={cn('bg-white hover:bg-brand-cyan-subtle', focus?.product_id === p.id && 'bg-amber-50/70')}
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-slate-700">
                    {p.name}
                    <span className="ml-1 text-xs text-slate-400">({p.unit})</span>
                  </td>
                  {warehouses.map((w) => {
                    const v = qty(w.id, p.id);
                    const focused = isFocusedCell(w.id, p.id);
                    return (
                      <td
                        key={w.id}
                        className={cn(
                          'px-4 py-2.5 text-right',
                          v === 0 ? 'text-slate-300' : 'text-slate-700',
                          focused && 'bg-brand-red/10 font-bold text-brand-red ring-2 ring-inset ring-brand-red/40'
                        )}
                      >
                        {formatNumber(v)}
                      </td>
                    );
                  })}
                  <td className="bg-brand-cyan-subtle px-4 py-2.5 text-right font-bold text-brand-navy">{formatNumber(productTotal(p.id))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-bold text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left">Tổng</td>
                {warehouses.map((w) => (
                  <td key={w.id} className="px-4 py-3 text-right">
                    {formatNumber(warehouseTotal(w.id))}
                  </td>
                ))}
                <td className="bg-brand-cyan-light px-4 py-3 text-right text-brand-navy">{formatNumber(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <StockCountModal
        open={countWarehouseId !== null}
        onClose={() => setCountWarehouseId(null)}
        warehouseId={countWarehouseId ?? 0}
        warehouses={warehouses}
        onWarehouseChange={setCountWarehouseId}
        rows={products.map((p) => ({ product_id: p.id, name: p.name, current: qty(countWarehouseId ?? 0, p.id) }))}
        defaultNote="Tồn kho đầu kỳ"
        onDone={reload}
      />
    </>
  );
}
