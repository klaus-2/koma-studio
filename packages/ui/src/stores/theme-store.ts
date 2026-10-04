/* ============================================================
   KŌMA STUDIO — Theme Store
   Theme family (classic | noir) × dark/light mode,
   localStorage persistence
   ============================================================ */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type KomaTheme = 'dark' | 'light';
export type KomaThemeFamily = 'classic' | 'noir';

const THEME_STORAGE_KEY = 'koma_theme';

interface ThemeStore {
  theme: KomaTheme;
  family: KomaThemeFamily;
  setTheme: (theme: KomaTheme) => void;
  setFamily: (family: KomaThemeFamily) => void;
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
        // New state dimension: persisted stores without `family` keep this
        // default via zustand's shallow merge — no migration needed.
        family: 'classic',
        setTheme: (theme) => set({ theme }),
        setFamily: (family) => set({ family }),
      }),
      {
        name: THEME_STORAGE_KEY,
      },
    ),
    { name: 'theme-store' },
  ),
);

/**
 * Apply the current theme (mode + family) to the document root.
 * Must be called once on mount and whenever theme/family changes.
 */
export function applyTheme(theme: KomaTheme, family: KomaThemeFamily = 'classic'): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-family', family);

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

  // Clear the pre-paint background set by the shell bootstrap script so the
  // themed stylesheet takes over (inline style would win specificity).
  root.style.removeProperty('background-color');
}
