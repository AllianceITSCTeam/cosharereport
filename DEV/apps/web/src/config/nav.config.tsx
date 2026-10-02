import { LayoutDashboard, Landmark, Building2, ClipboardList, Package, TrendingUp } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Landmark;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Hoa hồng tổng quan', path: '/reports/commission-overview', icon: Landmark },
  { label: 'Hoa hồng theo công ty', path: '/reports/commission-by-company', icon: Building2 },
  { label: 'Báo cáo đơn hàng', path: '/reports/commission-orders', icon: ClipboardList },
  { label: 'Hàng hóa trên website', path: '/reports/merchant-products', icon: Package },
  { label: 'Thống kê lượt bán', path: '/reports/sales-count', icon: TrendingUp },
];
