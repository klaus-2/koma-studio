import { useCallback, useEffect, useRef } from 'react';

import type { LoadedImage } from '../../../types/dashboard.types';
import { loadWorkspacePreloadSettings } from '../../../utils/workspacePreloadSettings';
import { useUiShellStore } from '../stores/ui-shell-store';
import type { VisiblePageRange } from './usePageUrlWindow';

interface UseArchivePagePreloadArgs {
  images: LoadedImage[];
}

interface UseArchivePagePreloadResult {
  onVisibleRangeChange: (range: VisiblePageRange) => void;
}

const IDLE_TIMEOUT_MS = 200;

type IdleWarmHandle =
  | { kind: 'idle'; id: number }
  | { kind: 'timeout'; id: number }
  | null;

const scheduleIdleWarm = (task: () => void): IdleWarmHandle => {
  if (typeof window.requestIdleCallback === 'function') {
    return {
      kind: 'idle',
      id: window.requestIdleCallback(() => task(), { timeout: IDLE_TIMEOUT_MS }),
    };
  }
  return { kind: 'timeout', id: window.setTimeout(task, IDLE_TIMEOUT_MS) };
};

const cancelIdleWarm = (handle: NonNullable<IdleWarmHandle>): void => {
  if (handle.kind === 'idle') {
    window.cancelIdleCallback(handle.id);
    return;
  }
  window.clearTimeout(handle.id);
};

/**
 * Archive page idle prefetch: warms the per-page extract cache (`toBlob()`)
 * for the N archive pages beyond each edge of the reported virtualizer range
 * (N = `archivePreloadPages`, 0 disables). No blob URLs are created and
 * `release()` semantics are untouched — the view-driven release keeps
 * eviction honest. Direct pages are skipped: their bytes are always resident.
 */
export function useArchivePagePreload({
  images,
}: UseArchivePagePreloadArgs): UseArchivePagePreloadResult {
  const imagesRef = useRef(images);
  const rangeRef = useRef<VisiblePageRange | null>(null);
  const lastRangeRef = useRef<VisiblePageRange | null>(null);
  const idleHandleRef = useRef<IdleWarmHandle>(null);
  const flushScheduledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const pending = idleHandleRef.current;
      if (pending !== null) {
        cancelIdleWarm(pending);
      }
      idleHandleRef.current = null;
    };
  }, []);

  const collectPreloadTargets = useCallback((): LoadedImage[] => {
    if (document.visibilityState === 'hidden') return [];
    if (useUiShellStore.getState().processing) return [];
    const { archivePreloadPages } = loadWorkspacePreloadSettings();
    if (archivePreloadPages === 0) return [];
    const range = rangeRef.current;
    if (range === null) return [];
    const count = imagesRef.current.length;
    const targets = new Map<string, LoadedImage>();
    const behindEnd = Math.min(count - 1, range.end + archivePreloadPages);
    const aheadStart = Math.max(0, range.start - archivePreloadPages);
    for (let index = range.end + 1; index <= behindEnd; index++) {
      const image = imagesRef.current[index];
      if (image !== undefined && image.file.kind === 'archive') {
        targets.set(image.id, image);
      }
    }
    for (let index = aheadStart; index < range.start; index++) {
      const image = imagesRef.current[index];
      if (image !== undefined && image.file.kind === 'archive') {
        targets.set(image.id, image);
      }
    }
    return [...targets.values()];
  }, []);

  const flushPrefetch = useCallback((): void => {
    if (!mountedRef.current) return;
    const range = rangeRef.current;
    if (range === null) return;
    const last = lastRangeRef.current;
    if (
      last !== null &&
      last.start === range.start &&
      last.end === range.end
    ) {
      return;
    }
    const pending = idleHandleRef.current;
    if (pending !== null) {
      cancelIdleWarm(pending);
      idleHandleRef.current = null;
    }
    lastRangeRef.current = range;
    const targets = collectPreloadTargets();
    if (targets.length === 0) return;
    idleHandleRef.current = scheduleIdleWarm(() => {
      idleHandleRef.current = null;
      for (const image of targets) {
        void image.file.toBlob().catch(() => undefined);
      }
    });
  }, [collectPreloadTargets]);

  const onVisibleRangeChange = useCallback(
    (range: VisiblePageRange): void => {
      rangeRef.current = range;
      if (flushScheduledRef.current) return;
      flushScheduledRef.current = true;
      queueMicrotask(() => {
        flushScheduledRef.current = false;
        flushPrefetch();
      });
    },
    [flushPrefetch],
  );

  return { onVisibleRangeChange };
}
