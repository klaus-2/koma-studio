import { useCallback, useEffect, useRef } from 'react';

import type { LoadedImage } from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';

export interface VisiblePageRange {
  readonly start: number;
  readonly end: number;
}

/** GATE-3: fixed ±8-page margin around the virtualizer range. */
const EVICTION_MARGIN = 8;

interface UsePageUrlWindowArgs {
  images: LoadedImage[];
  activeImageId: string | null;
}

interface UsePageUrlWindowResult {
  onVisibleRangeChange: (range: VisiblePageRange) => void;
}

// Only live object URLs are eviction targets: '' is the already-evicted
// (or archive-by-design) state and must not be revoked again.
const isEvictableDirectPage = (image: LoadedImage): boolean =>
  image.file.kind === 'direct' && image.url.startsWith('blob:');

/**
 * Offscreen direct-page URL eviction (GATE-3): pages outside the reported
 * virtualizer range ± 8 have their blob URLs revoked and are synchronously
 * re-created from the resident File on re-entry (`ensureDirectPageUrl`).
 * Never revokes the active page, runs only while visible and not processing.
 */
export function usePageUrlWindow({
  images,
  activeImageId,
}: UsePageUrlWindowArgs): UsePageUrlWindowResult {
  const imagesRef = useRef(images);
  const activeImageIdRef = useRef(activeImageId);
  const rangeRef = useRef<VisiblePageRange | null>(null);
  const flushScheduledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    activeImageIdRef.current = activeImageId;
  }, [activeImageId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const evictOutsideWindow = useCallback((): void => {
    if (!mountedRef.current) return;
    const range = rangeRef.current;
    if (range === null) return;
    if (document.visibilityState === 'hidden') return;
    if (useUiShellStore.getState().processing) return;
    const keepStart = Math.max(0, range.start - EVICTION_MARGIN);
    const keepEnd = range.end + EVICTION_MARGIN;
    const activeImageId = activeImageIdRef.current;
    const windowImages = imagesRef.current;
    const evictedIds: string[] = [];
    for (let index = 0; index < windowImages.length; index++) {
      if (index >= keepStart && index <= keepEnd) continue;
      const image = windowImages[index];
      if (image === undefined) continue;
      if (image.id === activeImageId) continue;
      if (!isEvictableDirectPage(image)) continue;
      URL.revokeObjectURL(image.url);
      evictedIds.push(image.id);
    }
    const { updateImageUrl } = useImageCollectionStore.getState();
    for (const id of evictedIds) {
      updateImageUrl(id, '');
    }
  }, []);

  const scheduleEviction = useCallback((): void => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    queueMicrotask(() => {
      flushScheduledRef.current = false;
      evictOutsideWindow();
    });
  }, [evictOutsideWindow]);

  const onVisibleRangeChange = useCallback(
    (range: VisiblePageRange): void => {
      rangeRef.current = range;
      scheduleEviction();
    },
    [scheduleEviction],
  );

  return { onVisibleRangeChange };
}
