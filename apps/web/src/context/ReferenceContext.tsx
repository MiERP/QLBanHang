import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { categories, customerGroups, customers, partnerBranches, products, roles, staff, stations, warehouses } from '../api';
import type { Category, Customer, CustomerGroup, Employee, PartnerBranch, Product, Role, Station, Warehouse } from '../types';

interface ReferenceData {
  products: Product[];
  warehouses: Warehouse[];
  staff: Employee[];
  stations: Station[];
  roles: Role[];
  categories: Category[];
  groups: CustomerGroup[];
  branches: PartnerBranch[];
  customers: Customer[];
  loading: boolean;
  reload: () => void;
}

const ReferenceContext = createContext<ReferenceData | null>(null);

export function ReferenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<ReferenceData, 'loading' | 'reload'>>({
    products: [],
    warehouses: [],
    staff: [],
    stations: [],
    roles: [],
    categories: [],
    groups: [],
    branches: [],
    customers: [],
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w, e, st, r, c, g, b, cu] = await Promise.all([
        products.list(),
        warehouses.list(),
        staff.list(),
        stations.list(),
        roles.list(),
        categories.list(),
        customerGroups.list(),
        partnerBranches.list(),
        customers.list(),
      ]);
      setState({ products: p, warehouses: w, staff: e, stations: st, roles: r, categories: c, groups: g, branches: b, customers: cu });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return <ReferenceContext.Provider value={{ ...state, loading, reload: load }}>{children}</ReferenceContext.Provider>;
}

export function useReference(): ReferenceData {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error('useReference must be used within ReferenceProvider');
  return ctx;
}
