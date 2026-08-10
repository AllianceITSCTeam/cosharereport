import { type ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { initAuth } from '@/lib/auth-init';

interface IProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: IProtectedRouteProps) {
  const { user, isLoading, isInitialized, setLoading } = useAuthStore();

  useEffect(() => {
    if (isInitialized) return;
    setLoading(true);
    void initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
          <p className="text-sm text-muted-foreground">
            You're not signed in. Please open this report from the link provided in CoShare.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
