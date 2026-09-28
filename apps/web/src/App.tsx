import { useState } from 'react';
import { fetchNotifications, markNotificationRead } from './api';
import { TopNav } from './components/layout/TopNav';
import { ReferenceProvider } from './context/ReferenceContext';
import { AuditLogTab } from './features/audit-log/AuditLogTab';
import { CreateOrderTab } from './features/create-order/CreateOrderTab';
import { CustomerDebtTab } from './features/customers/CustomerDebtTab';
import { CustomerDetailTab } from './features/customers/CustomerDetailTab';
import { CustomersTab } from './features/customers/CustomersTab';
import { DepositsTab } from './features/deposits/DepositsTab';
import { CashAuditTab } from './features/finance/CashAuditTab';
import { ExpensesTab } from './features/expenses/ExpensesTab';
import { InvoicesTab } from './features/invoices/InvoicesTab';
import { LoansTab } from './features/loans/LoansTab';
import { PartnerUnitsTab } from './features/partner-units/PartnerUnitsTab';
import { TargetsTab } from './features/targets/TargetsTab';
import { OrdersTab } from './features/orders/OrdersTab';
import { OverviewTab } from './features/overview/OverviewTab';
import { PriceListTab } from './features/price-list/PriceListTab';
import { ProductsTab } from './features/products/ProductsTab';
import { PromotionsTab } from './features/promotions/PromotionsTab';
import { ShippingReportTab } from './features/reports/ShippingReportTab';
import { ServiceReportTab } from './features/reports/ServiceReportTab';
import { ShellReportTab } from './features/shells/ShellReportTab';
import { ShellStockTab } from './features/shells/ShellStockTab';
import { RevenueTab } from './features/revenue/RevenueTab';
import { SettingsTab } from './features/settings/SettingsTab';
import { ShippingFeesTab } from './features/shipping-fees/ShippingFeesTab';
import { StaffTab } from './features/staff/StaffTab';
import { ImportSourcesTab } from './features/warehouse/ImportSourcesTab';
import { StockAuditTab } from './features/warehouse/StockAuditTab';
import { ShellAuditTab } from './features/warehouse/ShellAuditTab';
import { StockInTab } from './features/warehouse/StockInTab';
import { StockMatrixTab } from './features/warehouse/StockMatrixTab';
import { StockOutTab } from './features/warehouse/StockOutTab';
import type { TabId } from './layout';
import { todayISO } from './lib/format';
import { useApi } from './lib/hooks';
import type { AppNotification } from './types';

function Shell() {
  const [tab, setTab] = useState<TabId>('overview');
  // Ngày làm việc chọn ở góc phải thanh menu. Kì báo cáo vẫn theo tháng nên tháng suy ra từ ngày này.
  const [workDate, setWorkDate] = useState(todayISO());
  const month = workDate.slice(0, 7);
  // Đơn cần mở sẵn khi điều hướng sang màn Đơn hàng từ màn khác (vd: bấm vào dòng trong Báo cáo doanh thu).
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  // Ô tồn kho cần làm nổi khi bấm một cảnh báo ở chuông thông báo.
  const [stockFocus, setStockFocus] = useState<{ warehouse_id: number; product_id: number } | null>(null);
  // Tải lại mỗi khi đổi màn để cảnh báo đã xử lý không còn treo trên chuông.
  const notificationsApi = useApi(() => fetchNotifications(), [tab]);

  const openTab = (next: TabId) => {
    setStockFocus(null);
    setTab(next);
  };

  // Mỗi thông báo trỏ thẳng tới module + đối tượng cần xử lý; bấm vào là đánh dấu đã xem.
  const openNotification = (n: AppNotification) => {
    if (!n.read) {
      void markNotificationRead(n.id).then(() => notificationsApi.reload());
    }
    const target = n.target ?? {};
    if (typeof target.order_id === 'number') {
      setStockFocus(null);
      setOpenOrderId(target.order_id);
      setTab('orders');
      return;
    }
    if (typeof target.warehouse_id === 'number' && typeof target.product_id === 'number') {
      setStockFocus({ warehouse_id: target.warehouse_id, product_id: target.product_id });
    } else {
      setStockFocus(null);
    }
    setTab(n.tab as TabId);
  };

  return (
    <div className="flex h-full flex-col">
      <TopNav
        active={tab}
        onSelect={openTab}
        notifications={notificationsApi.data?.items ?? []}
        onOpenNotification={openNotification}
        onRefreshNotifications={notificationsApi.reload}
        workDate={workDate}
        // Xoá trống ô ngày thì giữ ngày hôm nay, tránh tháng báo cáo rỗng làm hỏng mọi báo cáo.
        onWorkDateChange={(value) => setWorkDate(value || todayISO())}
      />
      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-6">
          {tab === 'overview' && <OverviewTab month={month} onNavigate={openTab} />}
          {tab === 'create-order' && <CreateOrderTab />}
          {tab === 'orders' && <OrdersTab openOrderId={openOrderId} onOpened={() => setOpenOrderId(null)} />}
          {tab === 'invoices' && <InvoicesTab />}
          {tab === 'products' && <ProductsTab />}
          {tab === 'price-list' && <PriceListTab />}
          {tab === 'shipping-fees' && <ShippingFeesTab />}
          {tab === 'promotions' && <PromotionsTab />}
          {tab === 'partner-units' && <PartnerUnitsTab />}
          {tab === 'customers' && <CustomersTab />}
          {tab === 'customer-detail' && <CustomerDetailTab />}
          {tab === 'stock-in' && <StockInTab />}
          {tab === 'stock-out' && <StockOutTab />}
          {tab === 'stock' && <StockMatrixTab focus={stockFocus} />}
          {tab === 'stock-audit' && <StockAuditTab />}
          {tab === 'shell-audit' && <ShellAuditTab />}
          {tab === 'import-sources' && <ImportSourcesTab />}
          {tab === 'loans' && <LoansTab month={month} />}
          {tab === 'kpi' && <TargetsTab month={month} />}
          {tab === 'revenue' && (
            <RevenueTab
              month={month}
              onOpenOrder={(id) => {
                setOpenOrderId(id);
                setTab('orders');
              }}
            />
          )}
          {tab === 'expenses' && (
            <ExpensesTab
              month={month}
              onOpenOrder={(id) => {
                setOpenOrderId(id);
                setTab('orders');
              }}
            />
          )}
          {tab === 'customer-debt' && <CustomerDebtTab />}
          {tab === 'cash-audit' && <CashAuditTab />}
          {tab === 'shipping-report' && <ShippingReportTab month={month} />}
          {tab === 'service-report' && <ServiceReportTab month={month} />}
          {tab === 'shell-deposits' && <ShellReportTab month={month} />}
          {tab === 'shell-stock' && <ShellStockTab />}
          {tab === 'deposits' && <DepositsTab month={month} />}
          {tab === 'staff' && <StaffTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'audit-log' && <AuditLogTab />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ReferenceProvider>
      <Shell />
    </ReferenceProvider>
  );
}
