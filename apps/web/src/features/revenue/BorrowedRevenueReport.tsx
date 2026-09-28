import { FileSpreadsheet } from 'lucide-react';
import * as api from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SubTable, type SubColumn } from '../../components/ui/SubTable';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import type { RevenueBorrowedRow } from '../../types';
import { paymentStatusMeta } from '../orders/orderStatus';

type PartnerRow = {
  name: string;
  orders: number;
  quantity: number;
  revenue: number;
  settled_value: number;
  outstanding_value: number;
  loan_orders: number;
  overdue_orders: number;
};

const partnerColumns: Column<PartnerRow>[] = [
  { key: 'name', header: 'Mượn của đối tác', render: (r) => <b className="text-brand-navy">{r.name}</b>, sortValue: (r) => r.name },
  { key: 'orders', header: 'Số đơn', align: 'right', sortValue: (r) => r.orders },
  { key: 'quantity', header: 'Số lượng', align: 'right', sortValue: (r) => r.quantity },
  { key: 'revenue', header: 'Doanh thu bán được', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.revenue)}</b>, sortValue: (r) => r.revenue },
  { key: 'settled_value', header: 'Đã trả (sản phẩm)', align: 'right', render: (r) => formatNumber(r.settled_value), sortValue: (r) => r.settled_value },
  {
    key: 'outstanding_value',
    header: 'Còn lại',
    align: 'right',
    render: (r) => <span className="font-semibold text-brand-red">{formatNumber(r.outstanding_value)}</span>,
    sortValue: (r) => r.outstanding_value,
  },
  {
    key: 'loan_orders',
    header: 'Đơn chưa tất toán',
    align: 'center',
    render: (r) => (r.loan_orders ? <Badge tone="amber">{formatNumber(r.loan_orders)}</Badge> : <Badge tone="green">Xong</Badge>),
    sortValue: (r) => r.loan_orders,
  },
];

const orderColumns = (onOpenOrder?: (orderId: number) => void): Column<RevenueBorrowedRow>[] => [
  {
    key: 'order_code',
    header: 'Mã đơn',
    className: 'font-mono font-semibold text-brand-navy',
    render: (r) =>
      onOpenOrder ? (
        <button
          type="button"
          className="font-mono font-semibold text-brand-navy underline decoration-dotted hover:text-brand-cyan"
          onClick={(e) => {
            e.stopPropagation();
            onOpenOrder(r.id);
          }}
        >
          {r.order_code}
        </button>
      ) : (
        r.order_code
      ),
    sortValue: (r) => r.order_code,
  },
  { key: 'order_date', header: 'Ngày', render: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
  { key: 'partner_name', header: 'Mượn của đối tác', render: (r) => r.partner_name ?? '—', sortValue: (r) => r.partner_name ?? '' },
  { key: 'customer_name', header: 'Khách nhận hàng', render: (r) => r.customer_name ?? '—', sortValue: (r) => r.customer_name ?? '' },
  { key: 'seller_name', header: 'Nhân viên bán', render: (r) => r.seller_name ?? '—' },
  {
    key: 'quantity',
    header: 'Số lượng',
    align: 'right',
    render: (r) => formatNumber(r.items.reduce((a, it) => a + it.quantity + (it.quantity_promo ?? 0), 0)),
    sortValue: (r) => r.items.reduce((a, it) => a + it.quantity + (it.quantity_promo ?? 0), 0),
  },
  { key: 'subtotal_amount', header: 'Doanh thu', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.subtotal_amount)}</b>, sortValue: (r) => r.subtotal_amount },
  { key: 'settled_value', header: 'Đã trả (sản phẩm)', align: 'right', render: (r) => formatNumber(r.settled_value), sortValue: (r) => r.settled_value },
  {
    key: 'outstanding_value',
    header: 'Còn lại',
    align: 'right',
    render: (r) => (r.outstanding_value ? <span className="font-semibold text-brand-red">{formatNumber(r.outstanding_value)}</span> : '—'),
    sortValue: (r) => r.outstanding_value,
  },
  {
    key: 'loan_status',
    header: 'Trạng thái mượn',
    align: 'center',
    render: (r) =>
      r.loan_status === 'SETTLED' ? (
        <Badge tone="green">Đã tất toán</Badge>
      ) : Number(r.overdue_days) > 0 ? (
        <Badge tone="red">Quá hạn {formatNumber(r.overdue_days)} ngày</Badge>
      ) : (
        <Badge tone="amber">Chưa tất toán</Badge>
      ),
  },
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
];

const itemColumns: SubColumn<RevenueBorrowedRow['items'][number]>[] = [
  { key: 'product_name', header: 'Sản phẩm', render: (r) => r.product_name },
  { key: 'unit', header: 'ĐVT', render: (r) => r.unit ?? '' },
  { key: 'quantity', header: 'Số lượng', align: 'right', render: (r) => formatNumber(r.quantity) },
  { key: 'quantity_promo', header: 'KM', align: 'right', render: (r) => (r.quantity_promo ? formatNumber(r.quantity_promo) : '—') },
  { key: 'unit_price', header: 'Đơn giá', align: 'right', render: (r) => formatCurrency(r.unit_price) },
  { key: 'total_price', header: 'Thành tiền', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.total_price)}</b> },
];

// Báo cáo 3: doanh thu đơn hàng đi mượn — mượn hàng của đơn vị nào, bán được bao nhiêu.
export function BorrowedRevenueReport({ from, to, onOpenOrder }: { from: string; to: string; onOpenOrder?: (orderId: number) => void }) {
  const { data, loading } = useApi(() => api.fetchRevenueBorrowedReport({ from, to }), [from, to]);
  const totals = data?.totals;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-xs text-slate-500">
          Hàng đi mượn = hàng của đơn vị khác, xí nghiệp bán cho khách rồi trả lại bằng hàng cho đối tác.
          Trạng thái và số còn lại lấy từ màn Quản lý mượn - trả.
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open(api.revenueBorrowedExportUrl({ from, to }), '_blank')}>
          <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-600">
        <span>
          Số đơn đi mượn: <b className="text-slate-800">{formatNumber(totals?.orders ?? 0)}</b>
        </span>
        <span>
          Số lượng: <b className="text-slate-800">{formatNumber(totals?.quantity ?? 0)}</b>
        </span>
        <span>
          Doanh thu bán được: <b className="text-brand-navy">{formatCurrency(totals?.revenue ?? 0)}</b>
        </span>
        <span>
          Đã trả đối tác: <b className="text-slate-800">{formatNumber(totals?.settled_value ?? 0)} sản phẩm</b>
        </span>
        <span>
          Còn lại: <b className="text-brand-red">{formatNumber(totals?.outstanding_value ?? 0)} sản phẩm</b>
        </span>
        {!!totals?.overdue_orders && <span className="font-semibold text-brand-red">{formatNumber(totals.overdue_orders)} đơn quá hạn</span>}
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold text-slate-600">Tổng hợp theo đối tác cho mượn</div>
        <DataTable
          columns={partnerColumns}
          data={data?.byPartner ?? []}
          rowKey={(r) => r.name}
          loading={loading}
          searchable={false}
          pageSize={10}
        />
      </div>

      <div className="mb-2 text-xs text-slate-400">Bấm vào dòng để xổ ra mặt hàng của đơn mượn; bấm mã đơn để mở đơn hàng.</div>
      <DataTable
        columns={orderColumns(onOpenOrder)}
        data={data?.rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        searchPlaceholder="Tìm theo mã đơn, đối tác, khách nhận..."
        initialSortKey="order_date"
        initialSortDir="desc"
        pageSize={20}
        renderExpanded={(r) => <SubTable columns={itemColumns} rows={r.items} rowKey={(it) => `${it.product_name}-${it.unit ?? ''}`} />}
      />
    </>
  );
}
