
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { normalizeHexColor } from '../themes/noir-accent';

import { DEFAULT_THEME_FAMILY } from '../themes/registry';
import type { KomaThemeFamily } from '../themes/theme-family';

export type { KomaThemeFamily } from '../themes/theme-family';
export type KomaTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'koma_theme';
const THEME_STORAGE_VERSION = 3;

interface ThemeStore {
  theme: KomaTheme;
  family: KomaThemeFamily;
  noirAccent: string | null;
  setTheme: (theme: KomaTheme) => void;
  setFamily: (family: KomaThemeFamily) => void;
  setNoirAccent: (hex: string | null) => void;
  resetNoirAccent: () => void;
}

const DEFAULT_THEME: KomaTheme = 'dark';

export const useThemeStore = create<ThemeStore>()(
  devtools(
    persist(
      (set) => ({
        theme: DEFAULT_THEME,
        family: DEFAULT_THEME_FAMILY,
        noirAccent: null,
        setTheme: (theme) => set({ theme }),
        setFamily: (family) => set({ family }),
        setNoirAccent: (hex) =>
          set({
            noirAccent: hex === null ? null : normalizeHexColor(hex),
          }),
        resetNoirAccent: () => set({ noirAccent: null }),
      }),
      {
        name: THEME_STORAGE_KEY,
        version: THEME_STORAGE_VERSION,
        migrate: (persisted, version) => {
          const state = persisted as Partial<ThemeStore>;
          const normalizedAccent =
            typeof state.noirAccent === 'string'
              ? normalizeHexColor(state.noirAccent)
              : null;
          if (version < 2) {
            return {
              ...state,
              family: DEFAULT_THEME_FAMILY,
              noirAccent: normalizedAccent,
            };
          }
          if (version < 3) {
            return {
              ...state,
              noirAccent: normalizedAccent,
            };
          }
          return {
            ...state,
            noirAccent: normalizedAccent,
          };
        },
      },
    ),
    { name: 'theme-store', enabled: import.meta.env.DEV },
  ),
);

export function applyTheme(
  theme: KomaTheme,
  family: KomaThemeFamily = DEFAULT_THEME_FAMILY,
  noirAccent: string | null = null,
): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-family', family);

  const normalizedAccent =
    family === 'noir' && typeof noirAccent === 'string'
      ? normalizeHexColor(noirAccent)
      : null;

  if (normalizedAccent) {
    root.style.setProperty('--noir-crimson', normalizedAccent);
  } else {
    root.style.removeProperty('--noir-crimson');
  }

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

  root.style.removeProperty('background-color');
}
