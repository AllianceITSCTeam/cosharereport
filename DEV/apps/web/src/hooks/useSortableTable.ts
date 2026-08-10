import { useState, useMemo, useRef } from 'react';

type SortDir = 'asc' | 'desc';
type SortGetter<T> = (item: T) => string | number | null | undefined;

export interface SortState {
  key: string | null;
  dir: SortDir;
}

export function useSortableTable<T>(
  data: T[],
  getters: Record<string, SortGetter<T>>,
): { sorted: T[]; sortState: SortState; toggleSort: (key: string) => void } {
  const [sortState, setSortState] = useState<SortState>({ key: null, dir: 'asc' });
  const gettersRef = useRef(getters);
  gettersRef.current = getters;

  const sorted = useMemo(() => {
    const { key, dir } = sortState;
    if (!key) return data;
    const getter = gettersRef.current[key];
    if (!getter) return data;
    return [...data].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir === 'asc' ? av - bv : bv - av;
      }
      const as = av == null ? '' : String(av).toLowerCase();
      const bs = bv == null ? '' : String(bv).toLowerCase();
      const cmp = as.localeCompare(bs);
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortState]);

  function toggleSort(key: string) {
    setSortState((prev) => {
      if (prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return { key: null, dir: 'desc' };
    });
  }

  return { sorted, sortState, toggleSort };
}
