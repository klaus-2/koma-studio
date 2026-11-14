import { useCallback, useMemo, useState } from 'react';

/**
 * Per-user font favorites (F5): user-level prefs in localStorage — never in
 * the workspace document, never per-locale. Family names are stored with
 * their original casing and compared case-insensitively.
 */
const FONT_FAVORITES_STORAGE_KEY = 'koma-studio.font-favorites.v1';

const EMPTY_FAVORITES: readonly string[] = [];

const readStoredFavorites = (): readonly string[] => {
  if (typeof window === 'undefined') {
    return EMPTY_FAVORITES;
  }
  try {
    const raw = window.localStorage.getItem(FONT_FAVORITES_STORAGE_KEY);
    if (!raw) {
      return EMPTY_FAVORITES;
    }
    const parsed: readonly (string | null | undefined)[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY_FAVORITES;
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    // Invalid/missing JSON degrades to an empty favorites list, never a throw.
    return EMPTY_FAVORITES;
  }
};

export interface UseFontFavoritesResult {
  favorites: readonly string[];
  isFavorite: (family: string) => boolean;
  toggleFavorite: (family: string) => void;
}

export const useFontFavorites = (): UseFontFavoritesResult => {
  const [favorites, setFavorites] = useState<readonly string[]>(
    readStoredFavorites,
  );

  const isFavorite = useCallback(
    (family: string): boolean => {
      const normalized = family.trim().toLowerCase();
      return favorites.some((item) => item.toLowerCase() === normalized);
    },
    [favorites],
  );

  const toggleFavorite = useCallback(
    (family: string): void => {
      const normalized = family.trim().toLowerCase();
      const exists = favorites.some((item) => item.toLowerCase() === normalized);
      const next = exists
        ? favorites.filter((item) => item.toLowerCase() !== normalized)
        : [...favorites, family.trim()];
      setFavorites(next);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            FONT_FAVORITES_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          // Quota/security failures degrade to an in-memory-only favorite
          // (mirrors the guarded read); the picker keeps working.
        }
      }
    },
    [favorites],
  );

  return useMemo(
    () => ({ favorites, isFavorite, toggleFavorite }),
    [favorites, isFavorite, toggleFavorite],
  );
};
