export interface MiniBackendThreadSettings {
  intraOpThreads: number | null;
}

export const MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY =
  'koma-mini-backend-thread-settings-v1';

export const DEFAULT_MINI_BACKEND_THREAD_SETTINGS: MiniBackendThreadSettings = {
  intraOpThreads: null,
};

const MAX_INTRA_OP_THREADS = 64;

const sanitizeIntraOpThreads = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < 1) {
    return null;
  }
  return Math.min(MAX_INTRA_OP_THREADS, rounded);
};

export const sanitizeMiniBackendThreadSettings = (
  value: unknown,
): MiniBackendThreadSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_MINI_BACKEND_THREAD_SETTINGS };
  }
  if (!('intraOpThreads' in value)) {
    return { ...DEFAULT_MINI_BACKEND_THREAD_SETTINGS };
  }
  return {
    intraOpThreads: sanitizeIntraOpThreads(value.intraOpThreads),
  };
};

export const loadMiniBackendThreadSettings =
  (): MiniBackendThreadSettings => {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_MINI_BACKEND_THREAD_SETTINGS };
    }

    try {
      const raw = window.localStorage.getItem(
        MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
      );
      if (!raw) {
        return { ...DEFAULT_MINI_BACKEND_THREAD_SETTINGS };
      }
      return sanitizeMiniBackendThreadSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_MINI_BACKEND_THREAD_SETTINGS };
    }
  };

export const saveMiniBackendThreadSettings = (
  value: MiniBackendThreadSettings,
): MiniBackendThreadSettings => {
  const sanitized = sanitizeMiniBackendThreadSettings(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
  }
  return sanitized;
};
