import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { LatestUsersPage } from '@/pages/LatestUsersPage';
import { CommissionOverviewPage } from '@/pages/CommissionOverviewPage';
import { CommissionByCompanyPage } from '@/pages/CommissionByCompanyPage';
import { CommissionOrdersPage } from '@/pages/CommissionOrdersPage';
import { AuthErrorPage } from '@/pages/AuthErrorPage';
import { NotFoundPage } from '@/pages/MiscPages';

const router = createBrowserRouter([
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
      { index: true, element: <DashboardPage /> },
      { path: 'reports/latest-users', element: <LatestUsersPage /> },
      { path: 'reports/commission-overview', element: <CommissionOverviewPage /> },
      { path: 'reports/commission-by-company', element: <CommissionByCompanyPage /> },
      { path: 'reports/commission-orders', element: <CommissionOrdersPage /> },
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
