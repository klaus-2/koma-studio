export const PREFERENCES_SCHEMA_VERSION = 1 as const;
export const PREFERENCES_STORAGE_KEY = 'koma:preferences:v1';

export const STAGE_TAB_PREFERENCE_VALUES = [
  'detectText',
  'recognizeText',
  'getTranslations',
  'segmentText',
  'cleanImage',
  'render',
] as const;

export type StageTabPreference = (typeof STAGE_TAB_PREFERENCE_VALUES)[number];

export interface AppPreferences {
  readonly schemaVersion: typeof PREFERENCES_SCHEMA_VERSION;
  readonly leftSidebarCollapsed: boolean;
  readonly toolsPanelCollapsed: boolean;
  readonly leftSidebarWidth: number;
  readonly rightSidebarWidth: number;
  readonly activeStageTab: StageTabPreference;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  schemaVersion: PREFERENCES_SCHEMA_VERSION,
  leftSidebarCollapsed: false,
  toolsPanelCollapsed: false,
  leftSidebarWidth: 260,
  rightSidebarWidth: 320,
  activeStageTab: 'detectText',
};

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 640;

const LEGACY_KEYS = {
  leftSidebarCollapsed: 'koma:leftSidebarCollapsed',
  toolsPanelCollapsed: 'koma:toolsPanelCollapsed',
  leftSidebarWidth: 'koma:leftSidebarWidth',
  rightSidebarWidth: 'koma:rightSidebarWidth',
  activeStageTab: 'koma:activeStageTab',
} as const;

export interface PreferencesStorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export interface PreferencesStore {
  get: <K extends keyof Omit<AppPreferences, 'schemaVersion'>>(
    key: K,
  ) => AppPreferences[K];
  set: <K extends keyof Omit<AppPreferences, 'schemaVersion'>>(
    key: K,
    value: AppPreferences[K],
  ) => void;
  reset: () => void;
  getSnapshot: () => AppPreferences;
  subscribe: (listener: () => void) => () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStageTabPreference = (value: unknown): value is StageTabPreference =>
  typeof value === 'string' &&
  STAGE_TAB_PREFERENCE_VALUES.some((entry) => entry === value);

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeSidebarWidth = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));
};

const parseLegacyBoolean = (raw: string | null): boolean | undefined => {
  if (raw === null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;
  return undefined;
};

const parseLegacyWidth = (raw: string | null): number | undefined => {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readSafeItem = (
  storage: PreferencesStorageAdapter | null,
  key: string,
): string | null => {
  if (storage === null) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeSafeItem = (
  storage: PreferencesStorageAdapter | null,
  key: string,
  value: string,
): void => {
  if (storage === null) return;
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
};

const resolveDefaultStorage = (): PreferencesStorageAdapter | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const sanitizePreferences = (raw: unknown): AppPreferences => {
  if (!isRecord(raw)) {
    return DEFAULT_APP_PREFERENCES;
  }
  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    leftSidebarCollapsed: normalizeBoolean(
      raw.leftSidebarCollapsed,
      DEFAULT_APP_PREFERENCES.leftSidebarCollapsed,
    ),
    toolsPanelCollapsed: normalizeBoolean(
      raw.toolsPanelCollapsed,
      DEFAULT_APP_PREFERENCES.toolsPanelCollapsed,
    ),
    leftSidebarWidth: normalizeSidebarWidth(
      raw.leftSidebarWidth,
      DEFAULT_APP_PREFERENCES.leftSidebarWidth,
    ),
    rightSidebarWidth: normalizeSidebarWidth(
      raw.rightSidebarWidth,
      DEFAULT_APP_PREFERENCES.rightSidebarWidth,
    ),
    activeStageTab: isStageTabPreference(raw.activeStageTab)
      ? raw.activeStageTab
      : DEFAULT_APP_PREFERENCES.activeStageTab,
  };
};

const loadInitialPreferences = (
  storage: PreferencesStorageAdapter | null,
): AppPreferences => {
  const rawV1 = readSafeItem(storage, PREFERENCES_STORAGE_KEY);
  if (rawV1 !== null) {
    try {
      const parsed: unknown = JSON.parse(rawV1);
      if (isRecord(parsed)) {
        return sanitizePreferences(parsed);
      }
    } catch {
      return DEFAULT_APP_PREFERENCES;
    }
  }

  const migratedLeftCollapsed = parseLegacyBoolean(
    readSafeItem(storage, LEGACY_KEYS.leftSidebarCollapsed),
  );
  const migratedToolsCollapsed = parseLegacyBoolean(
    readSafeItem(storage, LEGACY_KEYS.toolsPanelCollapsed),
  );
  const migratedLeftWidth = parseLegacyWidth(
    readSafeItem(storage, LEGACY_KEYS.leftSidebarWidth),
  );
  const migratedRightWidth = parseLegacyWidth(
    readSafeItem(storage, LEGACY_KEYS.rightSidebarWidth),
  );
  const rawTab = readSafeItem(storage, LEGACY_KEYS.activeStageTab);
  const migratedTab = isStageTabPreference(rawTab) ? rawTab : undefined;

  const hasLegacyValue =
    migratedLeftCollapsed !== undefined ||
    migratedToolsCollapsed !== undefined ||
    migratedLeftWidth !== undefined ||
    migratedRightWidth !== undefined ||
    migratedTab !== undefined;

  const migrated = sanitizePreferences({
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    leftSidebarCollapsed: migratedLeftCollapsed,
    toolsPanelCollapsed: migratedToolsCollapsed,
    leftSidebarWidth: migratedLeftWidth,
    rightSidebarWidth: migratedRightWidth,
    activeStageTab: migratedTab,
  });

  if (hasLegacyValue) {
    writeSafeItem(storage, PREFERENCES_STORAGE_KEY, JSON.stringify(migrated));
  }
  return migrated;
};

export const createPreferencesStore = (
  storage: PreferencesStorageAdapter | null = resolveDefaultStorage(),
): PreferencesStore => {
  let state = loadInitialPreferences(storage);
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    get: (key) => state[key],
    set: (key, value) => {
      const next = sanitizePreferences({
        ...state,
        [key]: value,
      });
      if (next[key] === state[key]) {
        return;
      }
      state = next;
      writeSafeItem(storage, PREFERENCES_STORAGE_KEY, JSON.stringify(state));
      emit();
    },
    reset: () => {
      state = DEFAULT_APP_PREFERENCES;
      writeSafeItem(storage, PREFERENCES_STORAGE_KEY, JSON.stringify(state));
      emit();
    },
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const appPreferences = createPreferencesStore();
