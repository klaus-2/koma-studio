import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COMPACT_DENSITY_CLASS = 'koma-density-compact';

const resetRoot = (): void => {
  document.documentElement.style.removeProperty('zoom');
  document.documentElement.classList.remove(COMPACT_DENSITY_CLASS);
  delete document.documentElement.dataset.uiScale;
};

describe('applyUiScale', () => {
  beforeEach(() => {
    vi.resetModules();
    storageMap.clear();
    resetRoot();
  });

  afterEach(resetRoot);

  it('sets the root zoom from the scale value in CSS fallback mode', async () => {
    const {
      applyUiScale,
      getEffectiveCssRootZoom,
      isNativeUiZoomActive,
      setUiScaleNativeZoomHandler,
      toCssViewportCoord,
    } = await import('./applyUiScale');
    const { useUiScaleStore } = await import('../stores/ui-scale-store');

    setUiScaleNativeZoomHandler(null);
    const setProperty = vi.spyOn(document.documentElement.style, 'setProperty');

    useUiScaleStore.getState().setUiScale(1.25);
    applyUiScale(1.25, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.25');
    expect(isNativeUiZoomActive()).toBe(false);
    expect(getEffectiveCssRootZoom()).toBe(1.25);
    expect(toCssViewportCoord(250)).toBeCloseTo(200, 6);

    applyUiScale(0.9, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '0.9');

    applyUiScale(1.5, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.5');

    applyUiScale(1, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1');

    setProperty.mockRestore();
  });

  it('uses native webview zoom and clears CSS root zoom when native handler succeeds', async () => {
    const {
      applyUiScale,
      getEffectiveCssRootZoom,
      isNativeUiZoomActive,
      setUiScaleNativeZoomHandler,
      toCssViewportCoord,
    } = await import('./applyUiScale');
    const { useUiScaleStore } = await import('../stores/ui-scale-store');

    const nativeCalls: number[] = [];
    setUiScaleNativeZoomHandler(async (scale) => {
      nativeCalls.push(scale);
      return true;
    });

    const removeProperty = vi.spyOn(document.documentElement.style, 'removeProperty');
    useUiScaleStore.getState().setUiScale(1.25);
    applyUiScale(1.25, false);
    await Promise.resolve();
    await Promise.resolve();

    expect(nativeCalls).toEqual([1.25]);
    expect(isNativeUiZoomActive()).toBe(true);
    expect(getEffectiveCssRootZoom()).toBe(1);
    expect(toCssViewportCoord(250)).toBe(250);
    expect(removeProperty).toHaveBeenCalledWith('zoom');

    removeProperty.mockRestore();
    setUiScaleNativeZoomHandler(null);
  });

  it('falls back to CSS root zoom when native zoom handler returns false or rejects', async () => {
    const {
      applyUiScale,
      getEffectiveCssRootZoom,
      isNativeUiZoomActive,
      setUiScaleNativeZoomHandler,
    } = await import('./applyUiScale');
    const { useUiScaleStore } = await import('../stores/ui-scale-store');

    const setProperty = vi.spyOn(document.documentElement.style, 'setProperty');
    useUiScaleStore.getState().setUiScale(1.5);

    setUiScaleNativeZoomHandler(async () => false);
    applyUiScale(1.5, false);
    await Promise.resolve();
    await Promise.resolve();

    expect(isNativeUiZoomActive()).toBe(false);
    expect(getEffectiveCssRootZoom()).toBe(1.5);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.5');

    setUiScaleNativeZoomHandler(async () => {
      throw new Error('unsupported');
    });
    applyUiScale(1.25, false);
    await Promise.resolve();
    await Promise.resolve();

    expect(isNativeUiZoomActive()).toBe(false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.25');

    setProperty.mockRestore();
    setUiScaleNativeZoomHandler(null);
  });

  it('toggles the compact-density class without leaving residue', async () => {
    const { applyUiScale, COMPACT_DENSITY_CLASS: compactClass } = await import(
      './applyUiScale'
    );
    expect(compactClass).toBe(COMPACT_DENSITY_CLASS);

    applyUiScale(1, true);
    expect(document.documentElement.classList.contains(COMPACT_DENSITY_CLASS)).toBe(true);

    applyUiScale(1, false);
    expect(document.documentElement.classList.contains(COMPACT_DENSITY_CLASS)).toBe(false);
  });
});

describe('useUiScaleEffect', () => {
  beforeEach(() => {
    vi.resetModules();
    storageMap.clear();
    resetRoot();
  });

  afterEach(resetRoot);

  it('applies the store state on mount and re-applies on every change', async () => {
    const { setUiScaleNativeZoomHandler, useUiScaleEffect } = await import('./applyUiScale');
    const { useUiScaleStore } = await import('../stores/ui-scale-store');

    setUiScaleNativeZoomHandler(null);

    const HookProbe = (): ReactNode => {
      useUiScaleEffect();
      return null;
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    try {
      const setProperty = vi.spyOn(document.documentElement.style, 'setProperty');

      act(() => {
        root.render(createElement(HookProbe));
      });
      expect(setProperty).toHaveBeenLastCalledWith('zoom', '1');
      expect(
        document.documentElement.classList.contains(COMPACT_DENSITY_CLASS),
      ).toBe(false);

      act(() => {
        useUiScaleStore.getState().setUiScale(1.5);
      });
      expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.5');

      act(() => {
        useUiScaleStore.getState().setCompactDensity(true);
      });
      expect(
        document.documentElement.classList.contains(COMPACT_DENSITY_CLASS),
      ).toBe(true);

      setProperty.mockRestore();
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
