import { useMemo, useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useReference } from '../../context/ReferenceContext';
import { useApi } from '../../lib/hooks';
import { formatCurrency } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { CustomerGroup, PriceListEntry, Product } from '../../types';

export function PriceListTab() {
  const { products, groups } = useReference();
  const { data, loading, reload } = useApi(() => api.priceList.list(), []);
  const toast = useToast();

  const [editing, setEditing] = useState<{ product: Product; group: CustomerGroup | null } | null>(null);
  const [price, setPrice] = useState('');

  const { productMap, categoryMap } = useMemo(() => {
    const pm = new Map<string, PriceListEntry>();
    const cm = new Map<string, PriceListEntry>();
    for (const e of data ?? []) {
      if (e.product_id) pm.set(`${e.product_id}-${e.customer_group_id ?? 'default'}`, e);
      else if (e.category_id) cm.set(`${e.category_id}-${e.customer_group_id ?? 'default'}`, e);
    }
    return { productMap: pm, categoryMap: cm };
  }, [data]);

  const entryFor = (productId: number, groupId: number | null) =>
    productMap.get(`${productId}-${groupId ?? 'default'}`);

  const effectivePrice = (p: Product, groupId: number | null): number => {
    const direct = entryFor(p.id, groupId);
    if (direct) return direct.unit_price;
    const byCategory = categoryMap.get(`${p.category_id}-${groupId ?? 'default'}`);
    if (byCategory) return byCategory.unit_price;
    return p.standard_price;
  };

  const openEdit = (p: Product, group: CustomerGroup | null) => {
    setEditing({ product: p, group });
    setPrice(String(effectivePrice(p, group?.id ?? null)));
  };

  const save = async () => {
    if (!editing) return;
    const groupId = editing.group?.id ?? null;
    const existing = entryFor(editing.product.id, groupId);
    try {
      if (existing) {
        await api.priceList.update(existing.id, { unit_price: Number(price) });
      } else {
        await api.priceList.create({
          product_id: editing.product.id,
          category_id: null,
          customer_group_id: groupId,
          unit_price: Number(price),
          is_active: 1,
        });
      }
      toast.success('Đã lưu giá bán');
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được');
    }
  };

  const clearPrice = async () => {
    if (!editing) return;
    const existing = entryFor(editing.product.id, editing.group?.id ?? null);
    if (!existing) {
      setEditing(null);
      return;
    }
    try {
      await api.priceList.remove(existing.id);
      toast.success('Đã bỏ giá riêng, dùng giá mặc định');
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thực hiện được');
    }
  };

  return (
    <>
      <PageHeader
        title="Bảng giá theo nhóm khách hàng"
        subtitle="Click vào ô giá để cấu hình giá riêng cho từng nhóm · ô trống dùng giá mặc định của sản phẩm"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-14 text-center text-sm text-slate-400">Đang tải bảng giá...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3 text-center">Mặc định</th>
                  {groups.map((g) => (
                    <th key={g.id} className="px-4 py-3 text-center">
                      {g.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-700">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.unit}</p>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <PriceCell product={p} value={effectivePrice(p, null)} hasOverride={!!entryFor(p.id, null)} onClick={() => openEdit(p, null)} />
                    </td>
                    {groups.map((g) => (
                      <td key={g.id} className="px-2 py-2.5 text-center">
                        <PriceCell product={p} value={effectivePrice(p, g.id)} hasOverride={!!entryFor(p.id, g.id)} onClick={() => openEdit(p, g)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="sm"
        title={editing ? `Giá bán: ${editing.product.name}` : ''}
        subtitle={editing ? (editing.group ? editing.group.name : 'Nhóm mặc định / khách lẻ') : ''}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Hủy bỏ
            </Button>
            {editing && entryFor(editing.product.id, editing.group?.id ?? null) && (
              <Button variant="danger" size="sm" onClick={clearPrice}>
                Bỏ giá riêng
              </Button>
            )}
            <Button size="sm" onClick={save}>
              Lưu giá
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <Field label="Giá bán" hint="Để trống không lưu được">
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function PriceCell({ product, value, hasOverride, onClick }: { product: Product; value: number; hasOverride: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Cấu hình giá cho ${product.name}`}
      className={cn(
        'w-full rounded-lg border px-2 py-1.5 text-right text-xs font-semibold transition-colors',
        hasOverride ? 'border-brand-cyan/40 bg-brand-cyan-subtle text-brand-navy' : 'border-transparent text-slate-600 hover:bg-slate-50'
      )}
    >
      {formatCurrency(value)}
    </button>
  );
}
