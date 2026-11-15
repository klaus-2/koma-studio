
const LIMIT_ENABLED_STORAGE_KEY = 'koma.cache.limit.enabled';
const LIMIT_ROWS_STORAGE_KEY = 'koma.cache.limit.rows';
const LIMIT_BYTES_STORAGE_KEY = 'koma.cache.limit.bytes';

export interface CacheLimitSettings {
  enabled: boolean;
  rowsPerTable: number | null;
  totalBytes: number | null;
}

export const DEFAULT_CACHE_LIMIT_SETTINGS: CacheLimitSettings = {
  enabled: false,
  rowsPerTable: null,
  totalBytes: null,
};

const parseNonNegativeInt = (raw: string | null): number | null => {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const parseBoolean = (raw: string | null): boolean => raw === 'true';

export function loadCacheLimitSettings(): CacheLimitSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_CACHE_LIMIT_SETTINGS;
  }
  return {
    enabled: parseBoolean(localStorage.getItem(LIMIT_ENABLED_STORAGE_KEY)),
    rowsPerTable: parseNonNegativeInt(
      localStorage.getItem(LIMIT_ROWS_STORAGE_KEY),
    ),
    totalBytes: parseNonNegativeInt(
      localStorage.getItem(LIMIT_BYTES_STORAGE_KEY),
    ),
  };
}

export function saveCacheLimitSettings(settings: CacheLimitSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(LIMIT_ENABLED_STORAGE_KEY, String(settings.enabled));
  if (settings.rowsPerTable === null) {
    localStorage.removeItem(LIMIT_ROWS_STORAGE_KEY);
  } else {
    localStorage.setItem(LIMIT_ROWS_STORAGE_KEY, String(settings.rowsPerTable));
  }
  if (settings.totalBytes === null) {
    localStorage.removeItem(LIMIT_BYTES_STORAGE_KEY);
  } else {
    localStorage.setItem(
      LIMIT_BYTES_STORAGE_KEY,
      String(settings.totalBytes),
    );
  }
}
