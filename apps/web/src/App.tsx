import { useState } from 'react';
import { fetchAlerts } from './api';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ReferenceProvider } from './context/ReferenceContext';
import { BranchLoansTab } from './features/branchloans/BranchLoansTab';
import { CustomersTab } from './features/customers/CustomersTab';
import { DeliveryTab } from './features/delivery/DeliveryTab';
import { DvgtTab } from './features/dvgt/DvgtTab';
import { FinanceTab } from './features/finance/FinanceTab';
import { KpiTab } from './features/kpi/KpiTab';
import { OverviewTab } from './features/overview/OverviewTab';
import { ProductsTab } from './features/products/ProductsTab';
import { SalesTab } from './features/sales/SalesTab';
import { SettingsTab } from './features/settings/SettingsTab';
import { StaffTab } from './features/staff/StaffTab';
import { WarehouseTab } from './features/warehouse/WarehouseTab';
import type { TabId } from './layout';
import { currentMonth } from './lib/format';
import { useApi } from './lib/hooks';

function Shell() {
  const [tab, setTab] = useState<TabId>('overview');
  const [month, setMonth] = useState(currentMonth());
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: alerts } = useApi(() => fetchAlerts(), []);

  return (
    <div className="flex h-full">
      <Sidebar active={tab} onSelect={setTab} alertCount={alerts?.length ?? 0} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar tab={tab} month={month} onMonthChange={setMonth} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-6">
          {tab === 'overview' && <OverviewTab month={month} onNavigate={setTab} />}
          {tab === 'sales' && <SalesTab />}
          {tab === 'delivery' && <DeliveryTab month={month} />}
          {tab === 'customers' && <CustomersTab />}
          {tab === 'products' && <ProductsTab />}
          {tab === 'warehouse' && <WarehouseTab />}
          {tab === 'branches' && <BranchLoansTab />}
          {tab === 'kpi' && <KpiTab month={month} />}
          {tab === 'dvgt' && <DvgtTab />}
          {tab === 'finance' && <FinanceTab month={month} />}
          {tab === 'staff' && <StaffTab />}
          {tab === 'settings' && <SettingsTab />}
        </main>
      </div>
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
