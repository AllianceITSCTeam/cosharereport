import { useSearchParams } from 'react-router-dom';

const REASON_MESSAGES: Record<string, string> = {
  'missing-token': 'No access token was provided.',
  'invalid-token': 'This link is invalid or has expired.',
};

export function AuthErrorPage() {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason') ?? '';
  const message = REASON_MESSAGES[reason] ?? 'Unable to sign you in.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center space-y-3">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-lg font-semibold text-foreground">Sign-in failed</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">
          Please go back to CoShare and open the report link again.
        </p>
      </div>
    </div>
  );
}
