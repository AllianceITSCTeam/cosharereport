import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'vibe';

const STORAGE_KEY = 'coshare-report-theme';

// Cycle order: light → dark → vibe → light
const CYCLE: Theme[] = ['light', 'dark', 'vibe'];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'vibe');
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'vibe') root.classList.add('vibe');
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'vibe') return stored;
  } catch {
    // ignore
  }
  return 'light';
}

interface IThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialTheme = readStoredTheme();
applyTheme(initialTheme);

export const useThemeStore = create<IThemeStore>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    get().setTheme(next);
  },
}));
