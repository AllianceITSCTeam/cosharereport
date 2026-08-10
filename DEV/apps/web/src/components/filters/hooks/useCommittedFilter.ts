import { useCallback, useRef, useState } from 'react';
import { useFilterState, type UseFilterStateOptions } from './useFilterState';

export interface UseCommittedFilterResult<T> {
  draft: T;
  setDraft: (patch: Partial<T>) => void;
  committed: T;
  commit: () => void;
  reset: () => void;
  isDirty: boolean;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

export function useCommittedFilter<T extends Record<string, unknown>>(
  opts: UseFilterStateOptions<T>,
): UseCommittedFilterResult<T> {
  const defaultRef = useRef(opts.defaultValue);
  const [committed, setCommitted, resetCommitted] = useFilterState<T>(opts);
  // Boot draft from committed so localStorage-restored values appear in inputs on first render
  const [draft, setDraftRaw] = useState<T>(() => committed);

  const setDraft = useCallback((patch: Partial<T>) => {
    setDraftRaw((prev) => ({ ...prev, ...patch }));
  }, []);

  const commit = useCallback(() => setCommitted(draft), [draft, setCommitted]);

  const reset = useCallback(() => {
    setDraftRaw(defaultRef.current);
    resetCommitted();
  }, [resetCommitted]);

  const isDirty = !shallowEqual(
    draft as Record<string, unknown>,
    committed as Record<string, unknown>,
  );

  return { draft, setDraft, committed, commit, reset, isDirty };
}
