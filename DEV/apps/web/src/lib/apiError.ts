import axios from 'axios';

/**
 * Extract a human-readable error message from an API call failure.
 * Prefers the backend's `message` field over the generic Axios HTTP message.
 */
/**
 * If the error is an E205 "cooldown not met" response, returns the server's retryAfterSeconds.
 * Returns null for any other error type.
 */
export function getE205RetryAfter(err: unknown): number | null {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as { code?: string; retryAfterSeconds?: number } | undefined;
  if (data?.code !== 'E205') return null;
  return typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : null;
}

export function getApiErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    const data = err.response?.data as { message?: string | string[]; errors?: string[] } | undefined;
    if (data?.message) {
      if (typeof data.message === 'string' && data.message.includes('ThrottlerException')) {
        return 'Too many requests. Please wait a moment before trying again.';
      }
      const base = Array.isArray(data.message) ? data.message.join('; ') : data.message;
      if (data.errors?.length) {
        return data.errors.join('; ');
      }
      return base;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

type ToastFn = (opts: { title: string; description?: string; variant?: 'destructive' }) => void;

/**
 * Build a reusable error handler for CRUD category pages.
 *
 * @param toast       - The toast function from useToast()
 * @param conflictMap - Optional map of API message substrings → friendly toast titles.
 *                      First matching key wins. If matched, that string becomes the title
 *                      and no description is shown.
 *
 * Returns a function `(err, defaultTitle) => void` that:
 * - Extracts the API error message
 * - If any conflictMap key is a substring of the message → uses the mapped title
 * - Otherwise → uses defaultTitle as title, API message as description (if different)
 *
 * See: docs/conventions/error-toast-pattern.md
 */
export function buildErrorToast(toast: ToastFn, conflictMap?: Record<string, string>) {
  return (err: unknown, defaultTitle: string): void => {
    const msg = getApiErrorMessage(err, defaultTitle);

    if (conflictMap) {
      for (const [pattern, friendlyTitle] of Object.entries(conflictMap)) {
        if (msg.includes(pattern)) {
          toast({ title: friendlyTitle, variant: 'destructive' });
          return;
        }
      }
    }

    toast({
      title: defaultTitle,
      description: msg !== defaultTitle ? msg : undefined,
      variant: 'destructive',
    });
  };
}
