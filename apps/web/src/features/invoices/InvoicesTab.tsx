import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate } from '../../lib/format';
import * as api from '../../api';
import type { Invoice } from '../../types';

export function InvoicesTab() {
  const { data, loading } = useApi(() => api.fetchInvoices(), []);

  const columns: Column<Invoice>[] = [
    { key: 'invoice_code', header: 'Số hóa đơn', className: 'font-mono font-semibold text-brand-navy', sortValue: (r) => r.invoice_code },
    { key: 'invoice_date', header: 'Ngày xuất', render: (r) => formatDate(r.invoice_date), sortValue: (r) => r.invoice_date },
    {
      key: 'invoice_type',
      header: 'Loại',
      align: 'center',
      render: (r) => (r.invoice_type === 'VAT' ? <Badge tone="navy">VAT</Badge> : <Badge tone="neutral">Bán lẻ</Badge>),
    },
    { key: 'buyer_name', header: 'Người mua', render: (r) => r.buyer_name ?? r.customer_name ?? '—' },
    { key: 'order_code', header: 'Đơn hàng', render: (r) => r.order_code ?? '—' },
    { key: 'tax_amount', header: 'Tiền thuế', align: 'right', render: (r) => formatCurrency(r.tax_amount) },
    { key: 'total_amount', header: 'Tổng tiền', align: 'right', render: (r) => formatCurrency(r.total_amount), sortValue: (r) => r.total_amount },
    { key: 'issued_by_name', header: 'Người xuất', render: (r) => r.issued_by_name ?? '—' },
  ];

  return (
    <>
      <PageHeader title="Hóa đơn" subtitle={`${data?.length ?? 0} hóa đơn đã phát hành · chỉ đơn đã HOÀN TẤT mới xuất được hóa đơn`} />
      <DataTable columns={columns} data={data ?? []} rowKey={(r) => r.id} loading={loading} searchPlaceholder="Tìm theo số hóa đơn, người mua..." initialSortKey="invoice_code" initialSortDir="desc" />
    </>
  );
}
