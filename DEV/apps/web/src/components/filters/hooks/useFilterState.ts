import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePersistentState } from '@/hooks/usePersistentState';

export type FilterStoreMode = 'memory' | 'url' | 'localStorage';

export interface UseFilterStateOptions<T extends Record<string, unknown>> {
  key: string;
  defaultValue: T;
  mode?: FilterStoreMode;
}

type FilterStateReturn<T> = [T, (next: T | ((prev: T) => T)) => void, () => void];

// Dummy key used when localStorage mode is not active — avoids polluting storage under real keys
const LS_NOOP_KEY = '__filter-noop__';

// mode and defaultValue must be constants per component (only read at mount via useRef)
export function useFilterState<T extends Record<string, unknown>>(
  opts: UseFilterStateOptions<T>,
): FilterStateReturn<T> {
  const modeRef = useRef(opts.mode ?? 'memory');
  const defaultRef = useRef(opts.defaultValue);
  const mode = modeRef.current;
  const defaultValue = defaultRef.current;

  const lsKey = mode === 'localStorage' ? opts.key : LS_NOOP_KEY;

  // Always call all hooks to satisfy Rules of Hooks (mode is a mount-time constant)
  const [memValue, setMemValue] = useState<T>(defaultValue);
  const [lsValue, setLsValue] = usePersistentState<T>(lsKey, defaultValue);
  const [sp, setSp] = useSearchParams();

  const memReset = useCallback(() => setMemValue(defaultValue), [defaultValue]);
  const lsReset = useCallback(
    () => setLsValue(defaultValue),
    [setLsValue, defaultValue],
  );

  const urlValue = useMemo<T>(() => {
    const out: Record<string, unknown> = { ...defaultValue };
    sp.forEach((v, k) => {
      out[k] = v;
    });
    return out as T;
  }, [sp, defaultValue]);

  const setUrlValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(urlValue) : next;
      // Preserve unrelated URL params — only overwrite filter keys
      setSp(
        (prev) => {
          const newSp = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(resolved)) {
            if (v === undefined || v === null || v === '') {
              newSp.delete(k);
            } else {
              newSp.set(k, String(v));
            }
          }
          return newSp;
        },
        { replace: true },
      );
    },
    [setSp, urlValue],
  );

  const urlReset = useCallback(() => {
    setSp(
      (prev) => {
        const newSp = new URLSearchParams(prev);
        for (const k of Object.keys(defaultValue)) {
          newSp.delete(k);
        }
        return newSp;
      },
      { replace: true },
    );
  }, [setSp, defaultValue]);

  if (mode === 'localStorage')
    return [lsValue, setLsValue as (next: T | ((prev: T) => T)) => void, lsReset];
  if (mode === 'url') return [urlValue, setUrlValue, urlReset];
  return [memValue, setMemValue, memReset];
}
