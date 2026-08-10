import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { LatestUsersPage } from '@/pages/LatestUsersPage';
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
