import { useEffect } from 'react';

import { getOrCreateThumbnailForPage } from '../../utils/getOrCreateThumbnail';
import type { LoadedImage } from '../../types/dashboard.types';
import { ensureDirectPageUrl } from '../../pages/dashboard/hooks/image-collection';

interface UseSidebarThumbnailHydrationArgs {
  images: readonly LoadedImage[];
  setThumbnailUrl: (imageId: string, thumbnailUrl: string) => void;
}

const THUMBNAIL_HYDRATION_BUDGET = 2;
const MAX_ATTEMPTS_PER_IMAGE = 2;
let activeHydrationJobs = 0;
const hydrationQueue: LoadedImage[] = [];
const queuedIds = new Set<string>();
const inFlightIds = new Set<string>();
const attemptCounts = new Map<string, number>();

const pumpHydration = (
  setThumbnailUrl: (imageId: string, thumbnailUrl: string) => void,
): void => {
  while (activeHydrationJobs < THUMBNAIL_HYDRATION_BUDGET && hydrationQueue.length > 0) {
    const next = hydrationQueue.shift();
    if (!next) return;
    if (inFlightIds.has(next.id)) continue;
    inFlightIds.add(next.id);
    activeHydrationJobs += 1;
    void getOrCreateThumbnailForPage(next.file, ensureDirectPageUrl(next))
      .then((thumbnailUrl) => {
        if (thumbnailUrl === null) {
          attemptCounts.set(next.id, (attemptCounts.get(next.id) ?? 0) + 1);
          return;
        }
        setThumbnailUrl(next.id, thumbnailUrl);
      })
      .catch(() => {
        attemptCounts.set(next.id, (attemptCounts.get(next.id) ?? 0) + 1);
      })
      .finally(() => {
        activeHydrationJobs -= 1;
        inFlightIds.delete(next.id);
        queuedIds.delete(next.id);
        pumpHydration(setThumbnailUrl);
      });
  }
};

export const useSidebarThumbnailHydration = ({
  images,
  setThumbnailUrl,
}: UseSidebarThumbnailHydrationArgs): void => {
  useEffect(() => {
    const pending = images.filter(
      (img) =>
        // Direct pages qualify even with an evicted ('') URL: the pump
        // re-creates it synchronously. Archive pages have no URL by design.
        (img.url !== '' || img.file.kind === 'direct') &&
        !img.thumbnailUrl &&
        !queuedIds.has(img.id) &&
        (attemptCounts.get(img.id) ?? 0) < MAX_ATTEMPTS_PER_IMAGE,
    );
    if (pending.length === 0) return;
    for (const image of pending) queuedIds.add(image.id);
    hydrationQueue.push(...pending);
    pumpHydration(setThumbnailUrl);
  }, [images, setThumbnailUrl]);
};
