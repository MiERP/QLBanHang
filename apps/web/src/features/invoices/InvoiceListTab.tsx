import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { useApi } from '../../lib/hooks';
import { formatCurrency, formatDate } from '../../lib/format';
import type { InvoiceOrderRow } from '../../types';

type InvoiceStatus = 'INVOICED' | 'NOT_INVOICED';

// Danh sách hóa đơn theo ĐƠN: chọn Đã xuất (trong kỳ) hoặc Chưa xuất; cả hai đều xuất được Excel.
export function InvoiceListTab() {
  const [status, setStatus] = useState<InvoiceStatus>('INVOICED');
  const { data, loading } = useApi(() => api.fetchInvoiceOrders(status), [status]);

  const columns: Column<InvoiceOrderRow>[] = [
    { key: 'completed_date', header: 'Ngày hoàn tất', render: (r) => formatDate(r.completed_date), sortValue: (r) => r.completed_date },
    { key: 'customer_name', header: 'Khách hàng', sortValue: (r) => r.customer_name },
    { key: 'address', header: 'Địa chỉ', render: (r) => r.address || '—' },
    { key: 'products', header: 'Sản phẩm mua', render: (r) => r.products.map((p) => `${p.name} × ${p.quantity}`).join('; ') || '—' },
    { key: 'total_quantity', header: 'Số lượng', align: 'right', render: (r) => String(r.total_quantity), sortValue: (r) => r.total_quantity },
    { key: 'total_amount', header: 'Tổng tiền', align: 'right', render: (r) => <b className="text-brand-navy">{formatCurrency(r.total_amount)}</b>, sortValue: (r) => r.total_amount },
  ];

  return (
    <>
      <PageHeader
        title="Danh sách hóa đơn"
        subtitle="Hóa đơn theo đơn đã hoàn tất — chọn Đã xuất hoặc Chưa xuất để xem và xuất Excel."
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open(api.invoiceOrdersExportUrl(status), '_blank')}>
            <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
          </Button>
        }
      />

      <div className="mb-4 w-64">
        <Select dense value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
          <option value="INVOICED">Hóa đơn đã xuất</option>
          <option value="NOT_INVOICED">Hóa đơn chưa xuất</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(r) => r.order_id}
        loading={loading}
        searchPlaceholder="Tìm theo khách hàng, địa chỉ..."
        initialSortKey="completed_date"
        initialSortDir="desc"
        pageSize={20}
        emptyMessage={status === 'INVOICED' ? 'Chưa có hóa đơn nào đã xuất' : 'Không còn đơn hoàn tất nào chưa xuất hóa đơn'}
      />
    </>
  );
}
