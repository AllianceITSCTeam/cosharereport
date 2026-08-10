import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Intercepts in-app navigation and browser tab close when the form has unsaved edits.
 *
 * Usage:
 *   const { blocker } = useUnsavedChangesGuard(formState.isDirty);
 *   // Render <UnsavedChangesDialog blocker={blocker} /> alongside the form.
 *
 * isDirty should be true when current values differ from initialValues (last saved state).
 * For react-hook-form: pass `formState.isDirty` directly.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  // Block React Router navigations (link clicks, navigate(), back/forward)
  const blocker = useBlocker(isDirty);

  // Block browser tab close / page refresh
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set (legacy API)
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return { blocker };
}
