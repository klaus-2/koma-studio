import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS } from '../../../constants/dashboard.constants';
import type { LoadedImage } from '../../../types/dashboard.types';
import {
  WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
} from '../../../utils/workspacePreloadSettings';
import { createArchivePageFile, createDirectPageFile } from '../../../utils/page-source';
import type { ArchiveChapter, ArchiveEntryMeta } from '../../../utils/archive-chapter-reader';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useArchivePagePreload } from './useArchivePagePreload';

const PAGE_COUNT = 32;

const idleDeadline: IdleDeadline = {
  didTimeout: false,
  timeRemaining: () => 12,
};

interface IdleStubState {
  pending: Map<number, IdleRequestCallback>;
  cancelled: number[];
  nextId: number;
}

const idleState: IdleStubState = {
  pending: new Map(),
  cancelled: [],
  nextId: 1,
};

const installIdleStub = (): void => {
  idleState.pending.clear();
  idleState.cancelled = [];
  idleState.nextId = 1;
  vi.stubGlobal(
    'requestIdleCallback',
    vi.fn((callback: IdleRequestCallback): number => {
      const id = idleState.nextId++;
      idleState.pending.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    'cancelIdleCallback',
    vi.fn((handle: number): void => {
      idleState.pending.delete(handle);
      idleState.cancelled.push(handle);
    }),
  );
};

const pendingIdleCount = (): number => idleState.pending.size;

const runPendingIdleCallbacks = (): void => {
  const callbacks = [...idleState.pending.values()];
  idleState.pending.clear();
  for (const callback of callbacks) {
    callback(idleDeadline);
  }
};

const archiveEntry: ArchiveEntryMeta = {
  path: 'page-arch.png',
  compressedSize: 10,
  uncompressedSize: 10,
  method: 0,
  compressedOffset: 0,
};

const archiveChapter: ArchiveChapter = {
  id: 'chapter-1',
  label: 'Chapter 1',
  archive: new File([], 'chapter-1.cbz', { type: 'application/zip' }),
  entries: [archiveEntry],
};

let warmed: number[] = [];
let warmedDirect: number[] = [];

const makeArchiveImage = (index: number, reject = false): LoadedImage => ({
  id: `page-${index}`,
  file: {
    ...createArchivePageFile(
      archiveChapter,
      archiveEntry,
      `page-${index}.png`,
      'image/png',
    ),
    toBlob: vi.fn((): Promise<Blob> => {
      warmed.push(index);
      if (reject) {
        return Promise.reject(new Error('extract failed'));
      }
      return Promise.resolve(new Blob(['warm']));
    }),
  },
  url: '',
  width: 0,
  height: 0,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
});

const makeDirectImage = (index: number): LoadedImage => ({
  id: `page-${index}`,
  file: {
    ...createDirectPageFile(
      new File([`bytes-${index}`], `page-${index}.png`, { type: 'image/png' }),
    ),
    toBlob: vi.fn((): Promise<Blob> => {
      warmedDirect.push(index);
      return Promise.resolve(new Blob(['direct']));
    }),
  },
  url: `blob:page-${index}`,
  width: 800,
  height: 1200,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
});

const seedPreloadPages = (archivePreloadPages: number): void => {
  window.localStorage.setItem(
    WORKSPACE_PRELOAD_SETTINGS_STORAGE_KEY,
    JSON.stringify({ archivePreloadPages }),
  );
};

const mountController = (images: LoadedImage[]) =>
  renderHook((props: LoadedImage[]) => useArchivePagePreload({ images: props }), {
    initialProps: images,
  });

const flushPrefetch = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useArchivePagePreload', () => {
  beforeEach(() => {
    warmed = [];
    warmedDirect = [];
    window.localStorage.clear();
    installIdleStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useUiShellStore.setState({ processing: false });
    Reflect.deleteProperty(document, 'visibilityState');
    window.localStorage.clear();
  });

  it('warms archive pages 21-22 and 8-9 exactly once for range [10-20] with N=2', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();

    expect(warmed).toHaveLength(0);
    expect(pendingIdleCount()).toBe(1);

    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([21, 22, 8, 9]);
    expect(warmed.filter((index) => index === 21)).toHaveLength(1);
    expect(warmed.filter((index) => index === 8)).toHaveLength(1);
  });

  it('skips direct pages in the preload windows', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      index === 21 || index === 22 ? makeDirectImage(index) : makeArchiveImage(index),
    );
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();

    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([8, 9]);
    expect(warmedDirect).toEqual([]);
  });

  it('does not re-warm when the same range is reported again', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    act(() => {
      runPendingIdleCallbacks();
    });
    expect(warmed).toEqual([21, 22, 8, 9]);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([21, 22, 8, 9]);
    expect(pendingIdleCount()).toBe(0);
  });

  it('cancels pending idle callbacks when the range changes', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    expect(pendingIdleCount()).toBe(1);

    act(() => {
      result.current.onVisibleRangeChange({ start: 12, end: 22 });
    });
    await flushPrefetch();

    expect(idleState.cancelled).toHaveLength(1);
    expect(pendingIdleCount()).toBe(1);

    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([23, 24, 10, 11]);
    expect(warmed).not.toContain(21);
  });

  it('does not schedule when archivePreloadPages is 0', async () => {
    seedPreloadPages(0);
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([]);
    expect(pendingIdleCount()).toBe(0);
  });

  it('does not schedule while processing', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    useUiShellStore.setState({ processing: true });
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([]);
    expect(pendingIdleCount()).toBe(0);
  });

  it('does not schedule while the document is hidden', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    act(() => {
      runPendingIdleCallbacks();
    });

    expect(warmed).toEqual([]);
    expect(pendingIdleCount()).toBe(0);
  });

  it('cancels pending idle callbacks on unmount', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index),
    );
    const { result, unmount } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    expect(pendingIdleCount()).toBe(1);

    unmount();

    expect(idleState.cancelled).toHaveLength(1);
    expect(pendingIdleCount()).toBe(0);
    act(() => {
      runPendingIdleCallbacks();
    });
    expect(warmed).toEqual([]);
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    try {
      const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
        makeArchiveImage(index),
      );
      const { result } = mountController(images);

      act(() => {
        result.current.onVisibleRangeChange({ start: 10, end: 20 });
      });
      await flushPrefetch();
      expect(warmed).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(warmed).toEqual([21, 22, 8, 9]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('swallows a rejected toBlob without skipping the remaining targets', async () => {
    const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
      makeArchiveImage(index, index === 21),
    );
    const { result } = mountController(images);

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushPrefetch();
    act(() => {
      runPendingIdleCallbacks();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(warmed).toEqual([21, 22, 8, 9]);
  });
});
