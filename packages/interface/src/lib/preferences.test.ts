import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  PREFERENCES_STORAGE_KEY,
  createPreferencesStore,
  type PreferencesStorageAdapter,
} from './preferences';

const createMemoryStorage = (
  initial: Record<string, string> = {},
): PreferencesStorageAdapter & { data: Record<string, string> } => {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
};

describe('createPreferencesStore', () => {
  it('migrates legacy localStorage keys into v1 schema and ignores invalid values', () => {
    const storage = createMemoryStorage({
      'koma:leftSidebarCollapsed': 'true',
      'koma:toolsPanelCollapsed': 'false',
      'koma:leftSidebarWidth': '1200',
      'koma:rightSidebarWidth': 'not-a-number',
      'koma:activeStageTab': 'cleanImage',
    });

    const store = createPreferencesStore(storage);
    expect(store.getSnapshot()).toEqual({
      schemaVersion: PREFERENCES_SCHEMA_VERSION,
      leftSidebarCollapsed: true,
      toolsPanelCollapsed: false,
      leftSidebarWidth: 640,
      rightSidebarWidth: DEFAULT_APP_PREFERENCES.rightSidebarWidth,
      activeStageTab: 'cleanImage',
    });

    const persisted = JSON.parse(storage.data[PREFERENCES_STORAGE_KEY] ?? '{}');
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.leftSidebarWidth).toBe(640);
  });

  it('falls back cleanly when JSON is corrupted or storage throws', () => {
    const brokenJsonStorage = createMemoryStorage({
      [PREFERENCES_STORAGE_KEY]: '{not valid json',
    });
    expect(createPreferencesStore(brokenJsonStorage).getSnapshot()).toEqual(
      DEFAULT_APP_PREFERENCES,
    );

    const throwingStorage: PreferencesStorageAdapter = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const safeStore = createPreferencesStore(throwingStorage);
    expect(safeStore.get('activeStageTab')).toBe('detectText');
    safeStore.set('leftSidebarCollapsed', true);
    expect(safeStore.get('leftSidebarCollapsed')).toBe(true);
  });

  it('notifies useSyncExternalStore subscribers and resets cleanly', () => {
    const storage = createMemoryStorage();
    const store = createPreferencesStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set('leftSidebarWidth', 310);
    expect(store.get('leftSidebarWidth')).toBe(310);
    expect(listener).toHaveBeenCalledTimes(1);

    store.set('leftSidebarWidth', 310);
    expect(listener).toHaveBeenCalledTimes(1);

    store.reset();
    expect(store.getSnapshot()).toEqual(DEFAULT_APP_PREFERENCES);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set('toolsPanelCollapsed', true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
