/**
 * Returns a safe relative redirect path, or null if the value is absent/unsafe.
 * Accepts only paths that start with "/" and not "//", preventing open-redirect attacks.
 */
export function getSafeRedirect(redirect: string | null | undefined): string | null {
  if (!redirect) return null;
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return null;
  return redirect;
}
