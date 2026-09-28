import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardCheck,
  Coins,
  FilePlus,
  FileSpreadsheet,
  Gift,
  History,
  Network,
  LayoutDashboard,
  Landmark,
  ListOrdered,
  MapPin,
  Package,
  Receipt,
  Recycle,
  Scale,
  Settings,
  ShoppingCart,
  Tags,
  Target,
  TrendingUp,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type TabId =
  | 'overview'
  | 'create-order'
  | 'orders'
  | 'invoices'
  | 'products'
  | 'price-list'
  | 'shipping-fees'
  | 'promotions'
  | 'partner-units'
  | 'customers'
  | 'customer-detail'
  | 'stock-in'
  | 'stock-out'
  | 'stock'
  | 'stock-audit'
  | 'import-sources'
  | 'shell-stock'
  | 'shell-audit'
  | 'loans'
  | 'kpi'
  | 'revenue'
  | 'expenses'
  | 'customer-debt'
  | 'cash-audit'
  | 'deposits'
  | 'shipping-report'
  | 'service-report'
  | 'shell-deposits'
  | 'staff'
  | 'settings'
  | 'audit-log';

export interface NavChild {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },

  {
    id: 'orders',
    label: 'Đơn hàng',
    icon: ShoppingCart,
    children: [
      { id: 'create-order', label: 'Tạo đơn', icon: FilePlus },
      { id: 'orders', label: 'Đơn hàng', icon: ListOrdered },
      { id: 'invoices', label: 'Hóa đơn', icon: Receipt },
      { id: 'products', label: 'Sản phẩm', icon: Package },
      { id: 'price-list', label: 'Bảng giá', icon: Tags },
      { id: 'shipping-fees', label: 'Phí vận chuyển', icon: MapPin },
      { id: 'promotions', label: 'Khuyến mãi', icon: Gift },
      { id: 'partner-units', label: 'Đối tác liên kết', icon: Network },
    ],
  },

  {
    id: 'customers',
    label: 'Khách hàng',
    icon: Users,
    children: [
      { id: 'customers', label: 'Danh sách khách hàng', icon: Users },
      { id: 'customer-detail', label: 'Chi tiết khách hàng', icon: UserRound },
    ],
  },
  {
    id: 'expenses',
    label: 'Tài chính',
    icon: Wallet,
    children: [
      { id: 'expenses', label: 'Phí vận chuyển', icon: Receipt },
      { id: 'customer-debt', label: 'Công nợ khách hàng', icon: Users },
      { id: 'cash-audit', label: 'Đối chiếu tiền', icon: Landmark },
      { id: 'deposits', label: 'Dòng tiền cọc vỏ', icon: Coins },
    ],
  },
  {
    id: 'stock-in',
    label: 'Kho',
    icon: Warehouse,
    children: [
      { id: 'stock-in', label: 'Nhập kho', icon: ArrowDownToLine },
      { id: 'stock-out', label: 'Xuất kho', icon: ArrowUpFromLine },
      { id: 'stock', label: 'Tồn kho', icon: Boxes },
      { id: 'stock-audit', label: 'Đối soát kho', icon: ClipboardCheck },
      { id: 'shell-stock', label: 'Vỏ bình', icon: Recycle },
      { id: 'shell-audit', label: 'Đối chiếu vỏ', icon: Scale },
      { id: 'import-sources', label: 'Nguồn nhập', icon: Package },
      { id: 'loans', label: 'Quản lý mượn - trả', icon: ArrowUpFromLine },
    ],
  },

  {
    id: 'staff',
    label: 'Nhân sự',
    icon: UserCog,
    children: [
      { id: 'staff', label: 'Danh sách nhân viên', icon: Users },
      { id: 'kpi', label: 'Chỉ tiêu', icon: Target },
    ],
  },

  {
    id: 'revenue',
    label: 'Báo cáo',
    icon: FileSpreadsheet,
    children: [
      { id: 'revenue', label: 'Doanh thu', icon: TrendingUp },
      { id: 'shipping-report', label: 'Phí vận chuyển', icon: Truck },
      { id: 'service-report', label: 'Dịch vụ gia tăng', icon: Wrench },
      { id: 'shell-deposits', label: 'Vỏ bình & cọc', icon: Coins },
    ],
  },

  {
    id: 'settings',
    label: 'Hệ thống',
    icon: Settings,
    children: [
      { id: 'settings', label: 'Cấu hình', icon: Settings },
      { id: 'audit-log', label: 'Nhật ký hệ thống', icon: History },
    ],
  },
];
