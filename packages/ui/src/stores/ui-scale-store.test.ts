import { beforeEach, describe, expect, it, vi } from 'vitest';

// The vitest jsdom env may ship no storage backend (same stub as
// packages/interface/src/theme-store.test.ts) — a Map-backed localStorage
// keeps the zustand persist rehydration path honest and observable.
const storageMap = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string): string | null => storageMap.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storageMap.set(key, value);
    },
    removeItem: (key: string): void => {
      storageMap.delete(key);
    },
    clear: (): void => {
      storageMap.clear();
    },
  },
});

const STORAGE_KEY = 'koma_ui_scale.v1';

describe('ui-scale store', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.resetModules();
  });

  it('defaults to 100% scale without compact density', async () => {
    const { useUiScaleStore } = await import('./ui-scale-store');
    expect(useUiScaleStore.getState().uiScale).toBe(1);
    expect(useUiScaleStore.getState().compactDensity).toBe(false);
  });

  it('exposes the closed 4-option scale union', async () => {
    const { UI_SCALE_OPTIONS } = await import('./ui-scale-store');
    expect([...UI_SCALE_OPTIONS]).toEqual([0.9, 1, 1.25, 1.5]);
  });

  it('persists setters under koma_ui_scale.v1', async () => {
    const { useUiScaleStore } = await import('./ui-scale-store');
    useUiScaleStore.getState().setUiScale(1.25);
    useUiScaleStore.getState().setCompactDensity(true);

    const payload: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    );
    expect(payload).toMatchObject({
      state: { uiScale: 1.25, compactDensity: true },
      version: 1,
    });
  });

  it('restores the persisted scale and density on a fresh store load', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { uiScale: 1.5, compactDensity: true },
        version: 1,
      }),
    );

    const { useUiScaleStore } = await import('./ui-scale-store');
    expect(useUiScaleStore.getState().uiScale).toBe(1.5);
    expect(useUiScaleStore.getState().compactDensity).toBe(true);
  });

  it('normalizes an out-of-union scale and non-boolean density back to defaults', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { uiScale: 2.3, compactDensity: 'yes' },
        version: 1,
      }),
    );

    const { useUiScaleStore } = await import('./ui-scale-store');
    expect(useUiScaleStore.getState().uiScale).toBe(1);
    expect(useUiScaleStore.getState().compactDensity).toBe(false);
  });

  it('migrates an older-version payload with the same sanitization', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { uiScale: 0.9 }, version: 0 }),
    );

    const { useUiScaleStore } = await import('./ui-scale-store');
    expect(useUiScaleStore.getState().uiScale).toBe(0.9);
    expect(useUiScaleStore.getState().compactDensity).toBe(false);
  });

  it('falls back to defaults for a corrupt payload', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');

    const { useUiScaleStore } = await import('./ui-scale-store');
    expect(useUiScaleStore.getState().uiScale).toBe(1);
    expect(useUiScaleStore.getState().compactDensity).toBe(false);
  });
});
