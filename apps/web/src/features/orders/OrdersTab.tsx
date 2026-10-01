import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ImportExcelButton } from '../../components/ui/ImportExcelButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate } from '../../lib/format';
import type { Order } from '../../types';
import { OrderDetailTab } from './OrderDetailTab';
import { MergeOrdersModal } from './MergeOrdersModal';
import { ORDER_ACTION_LABEL, ORDER_TYPE_LABEL, nextStatuses, paymentStatusMeta, statusMeta } from './orderStatus';

export function OrdersTab({ openOrderId, onOpened }: { openOrderId?: number | null; onOpened?: () => void } = {}) {
  const ordersApi = useApi(() => api.fetchOrders({ limit: 300 }), []);
  const toast = useToast();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<number[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const orders = ordersApi.data ?? [];
  // Đơn được chỉ định từ màn khác có thể không nằm trong danh sách đã tải -> tải riêng theo id.
  const externalApi = useApi(() => (openOrderId ? api.fetchOrder(openOrderId) : Promise.resolve(null)), [openOrderId]);
  const detailOrder =
    detailId != null ? orders.find((o) => o.id === detailId) : openOrderId ? (externalApi.data ?? undefined) : undefined;

  const selectedOrders = orders.filter((o) => selected.includes(o.id));
  const canBulk = (target: string) => selected.length > 0 && selectedOrders.every((o) => nextStatuses(o.order_status).includes(target as never));
  // Chỉ gộp khi chọn từ 2 đơn trở lên và tất cả đều ở trạng thái chưa xuất kho (Nháp / Đã tạo đơn).
  const canMerge =
    selectedOrders.length >= 2 &&
    selectedOrders.every((o) => o.order_status === 'DRAFT' || o.order_status === 'CONFIRMED');
  // Chỉ xóa được đơn chưa có dấu vết sổ sách và không dính tới gộp đơn (backend kiểm tra lại lần cuối).
  const canDelete =
    selectedOrders.length > 0 &&
    selectedOrders.every(
      (o) =>
        !o.merged_into_id &&
        !(o.merged_from ?? []).length &&
        o.invoice_status !== 'INVOICED' &&
        o.order_status !== 'SHIPPING' &&
        o.order_status !== 'COMPLETED' &&
        o.order_status !== 'RETURNED'
    );

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allChecked = orders.length > 0 && selected.length === orders.length;

  const bulk = async (status: string) => {
    try {
      const res = await api.bulkUpdateOrderStatus(selected, status);
      if (res.failed.length) {
        toast.error(`${res.succeeded.length} đơn cập nhật, ${res.failed.length} lỗi: ${res.failed[0]?.error ?? ''}`);
      } else {
        toast.success(`Đã cập nhật ${res.succeeded.length} đơn`);
      }
      setSelected([]);
      ordersApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được');
    }
  };

  const removeSelected = async () => {
    const ok = await confirm({
      title: 'Xóa đơn hàng',
      message:
        `Xóa vĩnh viễn ${selected.length} đơn đã chọn? Thao tác này không hoàn tác được — chỉ xóa được đơn chưa phát sinh bút toán kho, ` +
        'doanh thu, cọc hoặc hóa đơn. Đơn đã xuất kho thì dùng "Hủy đơn".',
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.bulkDeleteOrders(selected);
      if (res.failed.length) {
        toast.error(`${res.succeeded.length} đơn đã xóa, ${res.failed.length} lỗi: ${res.failed[0]?.error ?? ''}`);
      } else {
        toast.success(`Đã xóa ${res.succeeded.length} đơn`);
      }
      setSelected([]);
      ordersApi.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được đơn');
    }
  };

  if (detailOrder) {
    return (
      <OrderDetailTab
        order={detailOrder}
        onBack={() => {
          setDetailId(null);
          onOpened?.();
        }}
        onChanged={() => {
          ordersApi.reload();
          externalApi.reload();
        }}
      />
    );
  }

  const columns: Column<Order>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(e) => setSelected(e.target.checked ? orders.map((o) => o.id) : [])}
        />
      ),
      render: (r) => (
        <input type="checkbox" checked={selected.includes(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
      ),
    },
    { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    {
      key: 'order_type',
      header: 'Loại đơn',
      render: (r) =>
        r.order_type === 'SALE' ? (
          <Badge tone="cyan">{ORDER_TYPE_LABEL.SALE}</Badge>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Badge tone={r.order_type === 'LEND_OUT' ? 'amber' : r.order_type === 'HIRED_LOAD' ? 'green' : 'indigo'}>
              {r.partner_unit_name ?? 'Đối tác'}
            </Badge>
            <span className="text-[11px] text-slate-400">
              {r.order_type === 'LEND_OUT' ? 'cho mượn' : r.order_type === 'HIRED_LOAD' ? 'bốc xếp' : 'đi mượn'}
            </span>
          </span>
        ),
      sortValue: (r) => r.order_type ?? 'SALE',
    },
    { key: 'seller_name', header: 'Người bán', render: (r) => r.seller_name ?? '—' },
    { key: 'warehouse_name', header: 'Kho', render: (r) => r.warehouse_name ?? '—' },
    { key: 'total_amount', header: 'Tổng tiền', align: 'right', render: (r) => formatCurrency(r.total_amount), sortValue: (r) => r.total_amount },
    { key: 'outstanding_amount', header: 'Còn nợ', align: 'right', render: (r) => formatCurrency(r.outstanding_amount ?? 0), sortValue: (r) => r.outstanding_amount ?? 0 },
    {
      key: 'payment_status',
      header: 'Thanh toán',
      align: 'center',
      render: (r) => {
        const m = paymentStatusMeta(r.payment_status);
        return <Badge tone={m.tone}>{m.label}</Badge>;
      },
      sortValue: (r) => r.payment_status,
    },
    {
      key: 'order_status',
      header: 'Trạng thái',
      align: 'center',
      render: (r) => {
        if (r.merged_into_id) return <Badge tone="navy">Đã gộp</Badge>;
        const m = statusMeta(r.order_status);
        return <Badge tone={m.tone}>{m.label}</Badge>;
      },
      sortValue: (r) => r.order_status,
    },
    {
      key: 'invoice_status',
      header: 'Hóa đơn',
      align: 'center',
      render: (r) => (r.invoice_status === 'INVOICED' ? <Badge tone="green">Đã xuất HĐ</Badge> : <Badge tone="amber">Chưa xuất HĐ</Badge>),
      sortValue: (r) => r.invoice_status ?? '',
    },
  ];

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        subtitle={`${orders.length} đơn · Nháp → Đã tạo đơn → Đang giao → Hoàn tất (hoặc Hàng hoàn nếu khách trả lại) · bấm vào dòng để xem chi tiết`}
      />

      <DataTable
        columns={columns}
        data={orders}
        rowKey={(r) => r.id}
        loading={ordersApi.loading}
        onRowClick={(r) => setDetailId(r.id)}
        searchPlaceholder="Tìm theo khách hàng, người bán..."
        initialSortKey="order_date"
        initialSortDir="desc"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Đã chọn {selected.length}</span>
            <Button size="sm" variant="success" disabled={!canBulk('CONFIRMED')} onClick={() => bulk('CONFIRMED')}>
              {ORDER_ACTION_LABEL.CONFIRMED}
            </Button>
            <Button size="sm" variant="success" disabled={!canBulk('SHIPPING')} onClick={() => bulk('SHIPPING')}>
              {ORDER_ACTION_LABEL.SHIPPING}
            </Button>
            <Button size="sm" variant="success" disabled={!canBulk('COMPLETED')} onClick={() => bulk('COMPLETED')}>
              {ORDER_ACTION_LABEL.COMPLETED}
            </Button>
            <Button size="sm" variant="danger" disabled={!canBulk('CANCELLED')} onClick={() => bulk('CANCELLED')}>
              {ORDER_ACTION_LABEL.CANCELLED}
            </Button>
            <Button size="sm" variant="outline" disabled={!canMerge} onClick={() => setMergeOpen(true)}>
              Gộp đơn
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-brand-red text-brand-red hover:bg-brand-red/10"
              disabled={!canDelete}
              onClick={removeSelected}
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa
            </Button>
            <ImportExcelButton
              kind="orders"
              hint="Nhập đơn hàng từ Excel: mỗi dòng là một mặt hàng, các dòng cùng Mã nhóm đơn gộp thành một đơn. Nên nhập tồn kho đầu kỳ trước."
              allowUpsert={false}
              onDone={ordersApi.reload}
            />
          </div>
        }
      />

      {mergeOpen && selectedOrders.length >= 2 && (
        <MergeOrdersModal
          orders={selectedOrders}
          onClose={() => setMergeOpen(false)}
          onMerged={() => {
            setMergeOpen(false);
            setSelected([]);
            ordersApi.reload();
          }}
        />
      )}
    </>
  );
}
