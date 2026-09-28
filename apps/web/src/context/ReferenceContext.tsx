import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  categories,
  customerGroups,
  customers,
  fetchSettings,
  orgUnits,
  partnerUnits,
  positions,
  products,
  staff,
  warehouses,
} from '../api';
import type {
  AppSettings,
  Category,
  Customer,
  CustomerGroup,
  Employee,
  OrgUnit,
  PartnerUnit,
  Position,
  Product,
  Warehouse,
} from '../types';

interface ReferenceData {
  products: Product[];
  warehouses: Warehouse[];
  staff: Employee[];
  orgUnits: OrgUnit[];
  positions: Position[];
  categories: Category[];
  groups: CustomerGroup[];
  customers: Customer[];
  partnerUnits: PartnerUnit[];
  /** Cấu hình hệ thống (khoá → giá trị) — các màn nghiệp vụ đọc để áp quy tắc chung. */
  settings: AppSettings;
  loading: boolean;
  reload: () => void;
}

const ReferenceContext = createContext<ReferenceData | null>(null);

export function ReferenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<ReferenceData, 'loading' | 'reload'>>({
    products: [],
    warehouses: [],
    staff: [],
    orgUnits: [],
    positions: [],
    categories: [],
    groups: [],
    customers: [],
    partnerUnits: [],
    settings: {},
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w, e, ou, pos, c, g, cu, pu, st] = await Promise.all([
        products.list(),
        warehouses.list(),
        staff.list(),
        orgUnits.list(),
        positions.list(),
        categories.list(),
        customerGroups.list(),
        customers.list(),
        partnerUnits.list(),
        fetchSettings(),
      ]);
      setState({
        products: p,
        warehouses: w,
        staff: e,
        orgUnits: ou,
        positions: pos,
        categories: c,
        groups: g,
        customers: cu,
        partnerUnits: pu,
        settings: st,
      });
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
