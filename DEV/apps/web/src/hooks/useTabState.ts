import { useSearchParams } from 'react-router-dom';

/**
 * Persists active tab to the URL `?tab=` param.
 * - Shareable: copying the URL shows the correct tab.
 * - Uses `replace: true` so tab switches don't pollute browser history.
 *
 * Standard: ALL tab state must use this hook. Never use usePersistentState for tabs.
 */
export function useTabState<T extends string>(
  defaultTab: T,
  isValid?: (value: unknown) => value is T,
): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');

  const activeTab = (
    isValid
      ? raw !== null && isValid(raw) ? raw : defaultTab
      : raw ?? defaultTab
  ) as T;

  function setTab(tab: T) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  }

  return [activeTab, setTab];
}
