import {
  Handshake,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Target,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type TabId =
  | 'overview'
  | 'sales'
  | 'delivery'
  | 'customers'
  | 'products'
  | 'warehouse'
  | 'branches'
  | 'kpi'
  | 'dvgt'
  | 'finance'
  | 'staff'
  | 'settings';

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, group: 'Điều hành' },

  { id: 'sales', label: 'Bán hàng & Đơn hàng', icon: ShoppingCart, group: 'Kinh doanh' },
  { id: 'delivery', label: 'Giao hàng & Quyết toán', icon: Truck, group: 'Kinh doanh' },
  { id: 'customers', label: 'Khách hàng & Nợ vỏ', icon: Users, group: 'Kinh doanh' },
  { id: 'dvgt', label: 'Dịch vụ gia tăng', icon: Wrench, group: 'Kinh doanh' },

  { id: 'products', label: 'Sản phẩm & Bảng giá', icon: Package, group: 'Hàng hóa & Kho' },
  { id: 'warehouse', label: 'Tồn kho & Nhật ký', icon: Warehouse, group: 'Hàng hóa & Kho' },
  { id: 'branches', label: 'Vay mượn liên chi nhánh', icon: Handshake, group: 'Hàng hóa & Kho' },

  { id: 'kpi', label: 'Chỉ tiêu KPI', icon: Target, group: 'Nhân sự & Chỉ tiêu' },
  { id: 'staff', label: 'Nhân sự & Phân quyền', icon: UserCog, group: 'Nhân sự & Chỉ tiêu' },

  { id: 'finance', label: 'Sổ quỹ Thu - Chi', icon: Wallet, group: 'Tài chính' },

  { id: 'settings', label: 'Danh mục hệ thống', icon: Settings, group: 'Hệ thống' },
];

export const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
  overview: { title: 'Bảng điều khiển', subtitle: 'Tổng hợp điều hành toàn xí nghiệp' },
  sales: { title: 'Bán hàng & Đơn hàng', subtitle: 'Lập đơn, khuyến mại 10+1, hóa đơn VAT' },
  delivery: { title: 'Giao hàng & Quyết toán', subtitle: 'Điều phối shipper, thu tiền và đối soát vỏ bình' },
  customers: { title: 'Khách hàng & Sổ nợ vỏ', subtitle: 'Hồ sơ khách hàng, công nợ vỏ Vòi / Úp' },
  products: { title: 'Sản phẩm & Bảng giá', subtitle: 'Danh mục nước QAROMI, giá bán và tiền cọc vỏ' },
  warehouse: { title: 'Tồn kho & Nhật ký', subtitle: 'Tồn kho 6 kho, điều chuyển và nhật ký xuất nhập' },
  branches: { title: 'Vay mượn liên chi nhánh', subtitle: 'Phiếu vay mượn, hoàn trả và quyết toán' },
  kpi: { title: 'Chỉ tiêu KPI & DVGT', subtitle: 'Định mức thi đua tháng của CBCNV' },
  dvgt: { title: 'Dịch vụ gia tăng', subtitle: 'Đăng ký và thực hiện dịch vụ bình nóng lạnh, bể téc' },
  finance: { title: 'Sổ quỹ Thu - Chi', subtitle: 'Phiếu thu, phiếu chi và dòng tiền' },
  staff: { title: 'Nhân sự & Phân quyền', subtitle: 'Hồ sơ CBCNV, trạm công tác và vai trò' },
  settings: { title: 'Danh mục hệ thống', subtitle: 'Trạm, vai trò, nhóm hàng, kho, chi nhánh, nhóm khách hàng' },
};
