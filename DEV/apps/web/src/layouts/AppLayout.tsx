import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { logoutApi } from '@/api/auth.api';
import { NAV_ITEMS } from '@/config/nav.config';

export function AppLayout() {
  const { user, setUser } = useAuthStore();

  async function handleLogout() {
    await logoutApi();
    setUser(null);
    window.location.href = '/';
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="px-4 py-4 border-b">
          <Link to="/" className="font-semibold text-foreground">
            CoShare Report
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div />
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground">{user.name ?? user.email ?? user.sub}</span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
