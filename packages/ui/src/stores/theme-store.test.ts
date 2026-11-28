import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hexToRgb, normalizeHexColor, rgbToHex } from '../themes/noir-accent';

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

const STORAGE_KEY = 'koma_theme';

describe('noir-accent color helpers & theme-store', () => {
  beforeEach(() => {
    storageMap.clear();
    document.documentElement.style.removeProperty('--noir-crimson');
    vi.resetModules();
  });

  it('normalizes 3-digit and 6-digit hex strings and rejects invalid ones', () => {
    expect(normalizeHexColor('F2A')).toBe('#ff22aa');
    expect(normalizeHexColor(' #4DC9FF ')).toBe('#4dc9ff');
    expect(normalizeHexColor('not-a-color')).toBeNull();
    expect(normalizeHexColor('')).toBeNull();
  });

  it('converts between free RGB values (0-255) and hex', () => {
    expect(rgbToHex(255, 46, 99)).toBe('#ff2e63');
    expect(rgbToHex(-10, 300, 127.6)).toBe('#00ff80');
    expect(hexToRgb('#4dc9ff')).toEqual({ r: 77, g: 201, b: 255 });
  });

  it('persists noirAccent and sets/clears --noir-crimson in applyTheme', async () => {
    const { applyTheme, useThemeStore } = await import('./theme-store');
    expect(useThemeStore.getState().noirAccent).toBeNull();

    useThemeStore.getState().setNoirAccent('#3EF2B0');
    expect(useThemeStore.getState().noirAccent).toBe('#3ef2b0');

    applyTheme('dark', 'noir', useThemeStore.getState().noirAccent);
    expect(
      document.documentElement.style.getPropertyValue('--noir-crimson'),
    ).toBe('#3ef2b0');

    applyTheme('dark', 'classic', useThemeStore.getState().noirAccent);
    expect(
      document.documentElement.style.getPropertyValue('--noir-crimson'),
    ).toBe('');

    const payload: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    );
    expect(payload).toMatchObject({
      state: { noirAccent: '#3ef2b0' },
      version: 3,
    });

    useThemeStore.getState().resetNoirAccent();
    expect(useThemeStore.getState().noirAccent).toBeNull();
  });

  it('migrates v2 storage cleanly with noirAccent defaulting to null', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { theme: 'light', family: 'noir' },
        version: 2,
      }),
    );

    const { useThemeStore } = await import('./theme-store');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().family).toBe('noir');
    expect(useThemeStore.getState().noirAccent).toBeNull();
  });
});
