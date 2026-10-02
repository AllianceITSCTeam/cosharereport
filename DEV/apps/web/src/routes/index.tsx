import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { NAV_ITEMS } from '@/config/nav.config';
import { LatestUsersPage } from '@/pages/LatestUsersPage';
import { CommissionOverviewPage } from '@/pages/CommissionOverviewPage';
import { CommissionByCompanyPage } from '@/pages/CommissionByCompanyPage';
import { CommissionOrdersPage } from '@/pages/CommissionOrdersPage';
import { MerchantProductsPage } from '@/pages/MerchantProductsPage';
import { SalesCountPage } from '@/pages/SalesCountPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuthErrorPage } from '@/pages/AuthErrorPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/MiscPages';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/auth-error',
    element: <AuthErrorPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to={NAV_ITEMS[0].path} replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'reports/latest-users', element: <LatestUsersPage /> },
      { path: 'reports/commission-overview', element: <CommissionOverviewPage /> },
      { path: 'reports/commission-by-company', element: <CommissionByCompanyPage /> },
      { path: 'reports/commission-orders', element: <CommissionOrdersPage /> },
      { path: 'reports/merchant-products', element: <MerchantProductsPage /> },
      { path: 'reports/sales-count', element: <SalesCountPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
