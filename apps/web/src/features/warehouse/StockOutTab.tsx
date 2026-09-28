import { useState } from 'react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useApi } from '../../lib/hooks';
import { formatDate, formatNumber } from '../../lib/format';
import type { Order } from '../../types';
import { OrderDetailTab } from '../orders/OrderDetailTab';
import { ORDER_TYPE_LABEL, orderPromoQuantity, orderTotalQuantity, statusMeta, stockStatusMeta } from '../orders/orderStatus';
import { StockTicketsPanel } from './StockTicketsPanel';

export function StockOutTab() {
  const [tab, setTab] = useState('orders');
  const [detailId, setDetailId] = useState<number | null>(null);
  const ordersApi = useApi(() => api.fetchOrders({ limit: 300 }), []);

  const orders = ordersApi.data ?? [];
  const detail = detailId != null ? orders.find((o) => o.id === detailId) : undefined;
  if (detail) return <OrderDetailTab order={detail} onBack={() => setDetailId(null)} onChanged={() => ordersApi.reload()} />;

  const orderColumns: Column<Order>[] = [
    { key: 'order_code', header: 'Mã đơn', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.order_code },
    { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'warehouse_name', header: 'Kho xuất', render: (r) => r.warehouse_name ?? '—' },
    {
      key: 'order_type',
      header: 'Loại đơn',
      render: (r) =>
        r.order_type === 'SALE' ? (
          <Badge tone="cyan">{ORDER_TYPE_LABEL.SALE}</Badge>
        ) : (
          <Badge tone={r.order_type === 'LEND_OUT' ? 'amber' : 'indigo'}>{ORDER_TYPE_LABEL[r.order_type ?? 'SALE']}</Badge>
        ),
      sortValue: (r) => r.order_type ?? 'SALE',
    },
    {
      key: 'order_status',
      header: 'Trạng thái đơn',
      align: 'center',
      render: (r) => {
        const m = statusMeta(r.order_status);
        return <Badge tone={m.tone}>{m.label}</Badge>;
      },
      sortValue: (r) => r.order_status,
    },
    {
      key: 'stock_status',
      header: 'Trạng thái kho',
      align: 'center',
      render: (r) => {
        const m = stockStatusMeta(r.order_status);
        return <Badge tone={m.tone}>{m.label}</Badge>;
      },
      sortValue: (r) => r.order_status,
    },
    { key: 'qty', header: 'Tổng SL', align: 'right', render: (r) => formatNumber(orderTotalQuantity(r)), sortValue: (r) => orderTotalQuantity(r) },
    {
      key: 'promo',
      header: 'Trong đó KM',
      align: 'right',
      render: (r) => {
        const promo = orderPromoQuantity(r);
        return promo ? <span className="font-semibold text-amber-600">{formatNumber(promo)}</span> : '—';
      },
      sortValue: (r) => orderPromoQuantity(r),
    },
  ];

  return (
    <>
      <PageHeader
        title="Xuất kho"
        subtitle="Đơn nào đã/chưa xuất kho · phiếu xuất và trạng thái ghi sổ tồn kho"
        actions={
          <Tabs
            items={[
              { id: 'orders', label: 'Theo đơn hàng' },
              { id: 'vouchers', label: 'Phiếu xuất kho' },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />
      {tab === 'orders' ? (
        <DataTable
          columns={orderColumns}
          data={orders}
          rowKey={(r) => r.id}
          loading={ordersApi.loading}
          onRowClick={(r) => setDetailId(r.id)}
          searchPlaceholder="Tìm theo mã đơn, khách hàng, kho..."
          initialSortKey="order_date"
          initialSortDir="desc"
        />
      ) : (
        <StockTicketsPanel direction="OUT" />
      )}
    </>
  );
}
