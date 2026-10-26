import { beforeEach, describe, expect, it, vi } from 'vitest';

// The vitest jsdom env has no storage backend (same as
// theme-store.test.ts) — Map-backed stub keeps the zustand persist
// rehydration path honest.
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

describe('focus mode store', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.resetModules();
  });

  it('defaults to the studio layout', async () => {
    const { useFocusModeStore, isFocusModeActive } = await import(
      './focus-mode-store'
    );
    expect(useFocusModeStore.getState().displayMode).toBe('studio');
    expect(useFocusModeStore.getState().reviewedImageIds).toEqual([]);
    expect(useFocusModeStore.getState().shellStash).toBeNull();
    expect(isFocusModeActive()).toBe(false);
  });

  it('persists the display mode and review marks, but never the shell stash', async () => {
    const { useFocusModeStore } = await import('./focus-mode-store');
    const store = useFocusModeStore.getState();

    store.setShellStash({ mode: 'cleaner', subMode: 'auto', viewMode: 'long_strip' });
    store.setDisplayMode('focus');
    store.setImageReviewed('img-1', true);

    const persisted = JSON.parse(storageMap.get('koma_focus_mode') ?? '{}') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(persisted.version).toBe(1);
    expect(persisted.state.displayMode).toBe('focus');
    expect(persisted.state.reviewedImageIds).toEqual(['img-1']);
    expect(persisted.state).not.toHaveProperty('shellStash');
  });

  it('rehydrates a persisted focus session without a stash', async () => {
    storageMap.set(
      'koma_focus_mode',
      JSON.stringify({
        state: { displayMode: 'focus', reviewedImageIds: ['a', 'b'] },
        version: 1,
      }),
    );

    const { useFocusModeStore } = await import('./focus-mode-store');
    expect(useFocusModeStore.getState().displayMode).toBe('focus');
    expect(useFocusModeStore.getState().reviewedImageIds).toEqual(['a', 'b']);
    expect(useFocusModeStore.getState().shellStash).toBeNull();
  });

  it('falls back to studio on a corrupt persisted payload', async () => {
    storageMap.set(
      'koma_focus_mode',
      JSON.stringify({
        state: { displayMode: 'zen-ultra', reviewedImageIds: 'nope' },
        version: 1,
      }),
    );

    const { useFocusModeStore } = await import('./focus-mode-store');
    expect(useFocusModeStore.getState().displayMode).toBe('studio');
    expect(useFocusModeStore.getState().reviewedImageIds).toEqual([]);
  });

  it('toggles, dedupes and prunes review marks', async () => {
    const { useFocusModeStore } = await import('./focus-mode-store');
    const store = useFocusModeStore.getState();

    store.setImageReviewed('img-1');
    store.setImageReviewed('img-2', true);
    store.setImageReviewed('img-2', true);
    expect(useFocusModeStore.getState().reviewedImageIds).toEqual([
      'img-1',
      'img-2',
    ]);

    store.setImageReviewed('img-1');
    expect(useFocusModeStore.getState().reviewedImageIds).toEqual(['img-2']);

    store.pruneReviewedImages(['img-3']);
    expect(useFocusModeStore.getState().reviewedImageIds).toEqual([]);
  });

  it('guards display mode ids', async () => {
    const { isDisplayMode } = await import('./focus-mode-store');
    expect(isDisplayMode('focus')).toBe(true);
    expect(isDisplayMode('studio')).toBe(true);
    expect(isDisplayMode('zen')).toBe(false);
    expect(isDisplayMode(undefined)).toBe(false);
  });
});
