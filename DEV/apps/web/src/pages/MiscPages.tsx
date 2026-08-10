import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-foreground">404</h1>
        <p className="text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
