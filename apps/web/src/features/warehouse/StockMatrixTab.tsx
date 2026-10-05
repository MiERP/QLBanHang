import { ClipboardCheck, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { cn } from '../../lib/cn';
import { formatDate, formatNumber, todayISO } from '../../lib/format';
import { stockWarehouses } from '../../lib/warehouses';
import type { StockItem } from '../../types';
import { StockCountModal } from './StockCountModal';

type ViewMode = 'current' | 'day' | 'period';

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'current', label: 'Hiện tại' },
  { id: 'day', label: 'Theo ngày' },
  { id: 'period', label: 'Theo kỳ' },
];

type StockView =
  | { kind: 'current'; items: StockItem[] }
  | { kind: 'daily'; rows: api.StockDailyRow[]; items: StockItem[] };

// Bảng tồn kho theo cách xí nghiệp đang theo dõi:
//  • Hiện tại  — mỗi kho một dòng, mỗi mặt hàng một cột (tồn đang chạy).
//  • Theo ngày / Theo kỳ — NHẬT KÝ: mỗi ngày × mỗi kho một dòng, số liệu là tồn CUỐI ngày đó,
//    nhìn liền nhau sẽ thấy hôm qua còn bao nhiêu, sau một ngày bán thì cuối hôm nay còn bao nhiêu.
export function StockMatrixTab({ focus }: { focus?: { warehouse_id: number; product_id: number } | null }) {
  const { warehouses: allWarehouses, products: allProducts, categories, reportPeriod } = useReference();
  const warehouses = stockWarehouses(allWarehouses);
  // Dịch vụ không có tồn kho → chỉ hiển thị hàng bán, xếp theo nhóm hàng như bảng giá.
  const products = useMemo(
    () =>
      allProducts
        .filter((p) => p.product_type !== 'SERVICE')
        .sort((a, b) => (a.category_id ?? 0) - (b.category_id ?? 0) || a.id - b.id),
    [allProducts]
  );

  const [mode, setMode] = useState<ViewMode>('current');
  const [day, setDay] = useState(todayISO());
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const range = mode === 'current' ? null : mode === 'day' ? { from: day, to: day } : { from, to };

  const { data, loading, reload } = useApi<StockView>(
    async () => {
      if (!range) return { kind: 'current', items: await api.fetchStock() };
      const [daily, items] = await Promise.all([api.fetchStockDaily(range.from, range.to), api.fetchStock()]);
      return { kind: 'daily', rows: daily.rows, items };
    },
    [range?.from, range?.to]
  );

  const [countWarehouseId, setCountWarehouseId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // Định mức tối thiểu của từng kho × mặt hàng (dùng chung cho cả hai chế độ xem).
  const minOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.items ?? []) m.set(`${s.warehouse_id}-${s.product_id}`, Number(s.min_stock_alert) || 0);
    return m;
  }, [data]);

  // Tồn ĐANG CHẠY của từng kho × mặt hàng — luôn có, kể cả khi đang xem nhật ký theo ngày,
  // vì ô kiểm kê ("Nhập tồn đầu kỳ") phải đối chiếu với số hệ thống đang giữ.
  const currentQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.items ?? []) m.set(`${s.warehouse_id}-${s.product_id}`, Number(s.quantity) || 0);
    return m;
  }, [data]);

  const dailyQty = useMemo(() => {
    const m = new Map<string, number>();
    if (data?.kind === 'daily') for (const r of data.rows) m.set(`${r.date}-${r.warehouse_id}-${r.product_id}`, Number(r.quantity) || 0);
    return m;
  }, [data]);

  const dates = useMemo(
    () => (data?.kind === 'daily' ? [...new Set(data.rows.map((r) => r.date))].sort() : []),
    [data]
  );

  const isDaily = data?.kind === 'daily';
  const quantityOf = (warehouseId: number, productId: number, date: string) =>
    date ? (dailyQty.get(`${date}-${warehouseId}-${productId}`) ?? 0) : (currentQty.get(`${warehouseId}-${productId}`) ?? 0);
  const isLow = (warehouseId: number, productId: number, quantity: number) => {
    const min = minOf.get(`${warehouseId}-${productId}`) ?? 0;
    return min > 0 && quantity <= min;
  };

  // Ô tìm kiếm lọc cả kho (dòng) lẫn mặt hàng (cột); bên nào không có kết quả thì giữ nguyên bên đó.
  const term = search.trim().toLowerCase();
  const matchedWarehouses = warehouses.filter((w) => w.name.toLowerCase().includes(term));
  const matchedProducts = products.filter((p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
  const rows = term && matchedWarehouses.length ? matchedWarehouses : warehouses;
  const columns = term && matchedProducts.length ? matchedProducts : products;

  const groups = useMemo(() => {
    const list: { id: number; name: string; items: typeof columns }[] = [];
    for (const product of columns) {
      const id = product.category_id ?? 0;
      let group = list.find((g) => g.id === id);
      if (!group) {
        group = { id, name: categories.find((c) => c.id === id)?.name ?? 'Khác', items: [] };
        list.push(group);
      }
      group.items.push(product);
    }
    return list;
  }, [columns, categories]);

  const rowTotal = (warehouseId: number, date: string) =>
    columns.reduce((sum, p) => sum + quantityOf(warehouseId, p.id, date), 0);
  const lowCells = isDaily
    ? dates.reduce((sum, date) => sum + rows.reduce((s, w) => s + columns.filter((p) => isLow(w.id, p.id, quantityOf(w.id, p.id, date))).length, 0), 0)
    : rows.reduce((sum, w) => sum + columns.filter((p) => isLow(w.id, p.id, quantityOf(w.id, p.id, ''))).length, 0);

  const focusWarehouse = focus ? warehouses.find((w) => w.id === focus.warehouse_id) : undefined;
  const focusProduct = focus ? products.find((p) => p.id === focus.product_id) : undefined;
  const lastDate = dates[dates.length - 1];
  const scopeLabel = isDaily
    ? `${dates.length} ngày × ${rows.length} kho · tồn cuối mỗi ngày`
    : `${rows.length} kho × ${columns.length} mặt hàng · tồn hiện tại`;
  const exportParams = range ?? {};

  return (
    <>
      <PageHeader
        title="Tồn kho"
        subtitle={`${scopeLabel}, ô đỏ là dưới định mức`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => window.open(api.stockExportUrl(exportParams), '_blank')}>
              <Download className="h-3.5 w-3.5" /> Xuất Excel
            </Button>
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

      {focus && focusWarehouse && focusProduct && !isDaily && (
        <div className="mb-3 rounded-lg border border-brand-red/30 bg-brand-red-light/60 px-3 py-2 text-xs text-brand-red">
          Đang xem cảnh báo: <b>{focusWarehouse.name}</b> — {focusProduct.name} (tồn{' '}
          <b>{formatNumber(quantityOf(focus.warehouse_id, focus.product_id, ''))}</b>)
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                mode === item.id ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'day' && (
          <div className="w-40">
            <Input dense type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} />
          </div>
        )}

        {mode === 'period' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Input dense type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <span className="text-xs text-slate-400">→</span>
            <div className="w-40">
              <Input dense type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!reportPeriod}
              onClick={() => {
                if (!reportPeriod) return;
                setFrom(reportPeriod.from);
                setTo(reportPeriod.to);
              }}
            >
              Kỳ hiện tại
            </Button>
          </div>
        )}

        {isDaily && (
          <span className="rounded-md bg-brand-cyan-subtle px-2 py-1 text-xs font-semibold text-brand-navy">
            Tồn cuối mỗi ngày · {formatDate(dates[0])} → {formatDate(lastDate)}
          </span>
        )}

        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input dense value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kho hoặc mặt hàng..." className="pl-7" />
        </div>
        {lowCells > 0 && (
          <span className="rounded-md bg-brand-red-light px-2 py-1 text-xs font-semibold text-brand-red">
            {lowCells} ô dưới định mức
          </span>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-14 text-center text-sm text-slate-400">Đang tải...</div>
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {isDaily && (
                  <th rowSpan={2} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">
                    Ngày
                  </th>
                )}
                <th
                  rowSpan={2}
                  className={cn(
                    'border-r border-slate-200 bg-slate-50 px-4 py-2 text-left',
                    isDaily ? 'sticky left-[92px] z-10' : 'sticky left-0 z-10'
                  )}
                >
                  Kho
                </th>
                {groups.map((group) => (
                  <th key={group.id} colSpan={group.items.length} className="border-r border-slate-200 px-3 py-2 text-center text-brand-navy">
                    {group.name}
                  </th>
                ))}
                <th rowSpan={2} className="bg-brand-cyan-subtle px-4 py-2 text-right text-brand-navy">
                  Tổng
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                {columns.map((product) => (
                  <th key={product.id} className="border-r border-slate-100 px-3 py-2 text-right align-bottom">
                    <span className="block font-semibold normal-case text-slate-600">{product.name}</span>
                    <span className="block text-[10px] font-normal text-slate-400">{product.unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isDaily
                ? dates.map((date) =>
                    rows.map((warehouse, index) => {
                      const isToday = date === lastDate;
                      return (
                        <tr
                          key={`${date}-${warehouse.id}`}
                          className={cn('bg-white hover:bg-brand-cyan-subtle', index === 0 && 'border-t-2 border-slate-200')}
                        >
                          {index === 0 && (
                            <td
                              rowSpan={rows.length}
                              className={cn(
                                'sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 text-center align-middle font-semibold',
                                isToday ? 'text-brand-navy' : 'text-slate-600'
                              )}
                            >
                              {formatDate(date)}
                              {isToday && <span className="mt-0.5 block text-[10px] font-normal text-slate-400">hôm nay</span>}
                            </td>
                          )}
                          <td
                            className={cn(
                              'sticky border-r border-slate-200 bg-white px-4 py-2 font-medium text-slate-700',
                              'left-[92px] z-10'
                            )}
                          >
                            {warehouse.name}
                          </td>
                          {columns.map((product) => {
                            const quantity = quantityOf(warehouse.id, product.id, date);
                            const low = isLow(warehouse.id, product.id, quantity);
                            return (
                              <td
                                key={product.id}
                                className={cn(
                                  'border-r border-slate-100 px-3 py-2 text-right tabular-nums',
                                  quantity === 0 ? 'text-slate-300' : 'text-slate-700',
                                  low && 'bg-brand-red-light font-bold text-brand-red'
                                )}
                              >
                                {formatNumber(quantity)}
                              </td>
                            );
                          })}
                          <td className="bg-brand-cyan-subtle px-4 py-2 text-right font-semibold tabular-nums text-brand-navy">
                            {formatNumber(rowTotal(warehouse.id, date))}
                          </td>
                        </tr>
                      );
                    })
                  )
                : rows.map((warehouse) => (
                    <tr
                      key={warehouse.id}
                      className={cn('bg-white hover:bg-brand-cyan-subtle', focus?.warehouse_id === warehouse.id && 'bg-amber-50/70')}
                    >
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700">
                        {warehouse.name}
                        <span className="ml-1 text-xs text-slate-400">({warehouse.code})</span>
                      </td>
                      {columns.map((product) => {
                        const quantity = quantityOf(warehouse.id, product.id, '');
                        const low = isLow(warehouse.id, product.id, quantity);
                        const focused = focus?.warehouse_id === warehouse.id && focus?.product_id === product.id;
                        return (
                          <td
                            key={product.id}
                            className={cn(
                              'border-r border-slate-100 px-3 py-2.5 text-right tabular-nums',
                              quantity === 0 ? 'text-slate-300' : 'text-slate-700',
                              low && 'bg-brand-red-light font-bold text-brand-red',
                              focused && 'ring-2 ring-inset ring-brand-red/50'
                            )}
                          >
                            {formatNumber(quantity)}
                          </td>
                        );
                      })}
                      <td className="bg-brand-cyan-subtle px-4 py-2.5 text-right font-bold tabular-nums text-brand-navy">
                        {formatNumber(rowTotal(warehouse.id, ''))}
                      </td>
                    </tr>
                  ))}
              {!rows.length && (
                <tr>
                  <td colSpan={columns.length + 2 + (isDaily ? 1 : 0)} className="px-4 py-10 text-center text-sm text-slate-400">
                    Không có kho nào khớp từ khóa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {isDaily ? (
          <>
            Mỗi dòng là <b>tồn cuối một ngày</b> của một kho — so các ngày liền nhau để biết hôm qua còn bao nhiêu, sau một ngày
            bán thì cuối hôm nay còn bao nhiêu. Ô đỏ = tồn ≤ định mức tối thiểu.
          </>
        ) : (
          <>
            Ô đỏ = tồn ≤ định mức tối thiểu của mặt hàng ở kho đó. Số 0 hiển thị mờ. Chọn “Theo ngày” hoặc “Theo kỳ” để xem nhật ký
            tồn cuối từng ngày.
          </>
        )}
      </p>

      <StockCountModal
        open={countWarehouseId !== null}
        onClose={() => setCountWarehouseId(null)}
        warehouseId={countWarehouseId ?? 0}
        warehouses={warehouses}
        onWarehouseChange={setCountWarehouseId}
        rows={products.map((p) => ({ product_id: p.id, name: p.name, current: currentQty.get(`${countWarehouseId ?? 0}-${p.id}`) ?? 0 }))}
        defaultNote="Tồn kho đầu kỳ"
        onDone={reload}
      />
    </>
  );
}
