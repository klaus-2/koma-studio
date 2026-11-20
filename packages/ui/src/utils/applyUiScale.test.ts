import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The vitest jsdom env may ship no storage backend; zustand persist captures
// its storage when the store module is evaluated, so this stub must be
// installed before the dynamic imports below. jsdom also cannot represent the
// non-listed `zoom` CSS property, so zoom assertions spy on style.setProperty
// (classList assertions are real).
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

// react's act() requires the act-environment flag outside @testing-library.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COMPACT_DENSITY_CLASS = 'koma-density-compact';

const resetRoot = (): void => {
  document.documentElement.style.removeProperty('zoom');
  document.documentElement.classList.remove(COMPACT_DENSITY_CLASS);
};

describe('applyUiScale', () => {
  beforeEach(() => {
    vi.resetModules();
    resetRoot();
  });

  afterEach(resetRoot);

  it('sets the root zoom from the scale value', async () => {
    const { applyUiScale } = await import('./applyUiScale');
    const setProperty = vi.spyOn(document.documentElement.style, 'setProperty');

    applyUiScale(1.25, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.25');

    applyUiScale(0.9, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '0.9');

    applyUiScale(1.5, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1.5');

    applyUiScale(1, false);
    expect(setProperty).toHaveBeenLastCalledWith('zoom', '1');

    setProperty.mockRestore();
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
    resetRoot();
  });

  afterEach(resetRoot);

  it('applies the store state on mount and re-applies on every change', async () => {
    const { useUiScaleEffect } = await import('./applyUiScale');
    const { useUiScaleStore } = await import('../stores/ui-scale-store');

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
