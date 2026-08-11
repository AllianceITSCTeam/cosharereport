import { LayoutDashboard, Users, Landmark } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Latest Users', path: '/reports/latest-users', icon: Users },
  { label: 'Hoa hồng tổng quan', path: '/reports/commission-overview', icon: Landmark },
];
