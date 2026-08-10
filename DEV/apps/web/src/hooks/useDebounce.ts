import { useEffect, useState } from 'react';

/**
 * Debounce a value with configurable delay (default 300ms per BA/UI-CONVENTIONS.md section 3.2)
 * Returns the debounced value after delay without updates.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
