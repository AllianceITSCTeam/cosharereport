import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

export function usePersistentState<T>(
  storageKey: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return defaultValue;

      const parsed: unknown = JSON.parse(raw);
      if (validate && !validate(parsed)) return defaultValue;

      return (parsed as T) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignore quota/private mode errors and keep in-memory state.
    }
  }, [storageKey, value]);

  return [value, setValue];
}
