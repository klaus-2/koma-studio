/* ============================================================
   KŌMA STUDIO — Theme Store
   Theme family (classic | noir) × dark/light mode,
   localStorage persistence
   ============================================================ */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { DEFAULT_THEME_FAMILY } from '../themes/registry';

export type KomaTheme = 'dark' | 'light';
export type KomaThemeFamily = 'classic' | 'noir';

const THEME_STORAGE_KEY = 'koma_theme';
const THEME_STORAGE_VERSION = 2;

interface ThemeStore {
  theme: KomaTheme;
  family: KomaThemeFamily;
  setTheme: (theme: KomaTheme) => void;
  setFamily: (family: KomaThemeFamily) => void;
}

// Dark is the shipped default; light is opt-in from settings, independent of
// the OS color scheme.
const DEFAULT_THEME: KomaTheme = 'dark';

export const useThemeStore = create<ThemeStore>()(
  devtools(
    persist(
      (set) => ({
        theme: DEFAULT_THEME,
        // Noir is the shipped design system; classic stays reachable from
        // settings as the legacy family.
        family: DEFAULT_THEME_FAMILY,
        setTheme: (theme) => set({ theme }),
        setFamily: (family) => set({ family }),
      }),
      {
        name: THEME_STORAGE_KEY,
        version: THEME_STORAGE_VERSION,
        migrate: (persisted, version) => {
          const state = persisted as Partial<ThemeStore>;
          if (version < 2) {
            return { ...state, family: DEFAULT_THEME_FAMILY };
          }
          return state;
        },
      },
    ),
    { name: 'theme-store' },
  ),
);

/**
 * Apply the current theme (mode + family) to the document root.
 * Must be called once on mount and whenever theme/family changes.
 */
export function applyTheme(theme: KomaTheme, family: KomaThemeFamily = DEFAULT_THEME_FAMILY): void {
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
