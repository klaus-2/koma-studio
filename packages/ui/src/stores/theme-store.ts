/* ============================================================
   KŌMA STUDIO — Theme Store
   Dark / Light mode with localStorage persistence
   ============================================================ */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type KomaTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'koma_theme';

interface ThemeStore {
  theme: KomaTheme;
  setTheme: (theme: KomaTheme) => void;
}

const detectInitialTheme = (): KomaTheme => {
  if (typeof window === 'undefined') return 'dark';
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark';
};

export const useThemeStore = create<ThemeStore>()(
  devtools(
    persist(
      (set) => ({
        theme: detectInitialTheme(),
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: THEME_STORAGE_KEY,
      },
    ),
    { name: 'theme-store' },
  ),
);

/**
 * Apply the current theme to the document root.
 * Must be called once on mount and whenever theme changes.
 */
export function applyTheme(theme: KomaTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}
