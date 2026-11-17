import {
  createThumbnailFromUrl,
  getCachedThumbnailByKey,
  rememberThumbnailByKey,
} from './imagePerformance';
import { getStoredThumbnail, putStoredThumbnail } from './thumbnailStore';
import { sha256Hex } from '../pages/dashboard/utils/import-duplicates';
import type { DirectPageFile, PageFile } from './page-source';

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 600;
const THUMBNAIL_QUALITY = 0.7;

const hotCacheKeyFor = (hash: string): string =>
  `opfs:${hash}:${THUMBNAIL_WIDTH}:${THUMBNAIL_HEIGHT}:${THUMBNAIL_QUALITY}`;

/** Hashes are memoized per resident File: identical pages hash once. */
const directPageHashCache = new WeakMap<object, Promise<string>>();

const hashDirectPage = (file: DirectPageFile): Promise<string> => {
  const cached = directPageHashCache.get(file.resident);
  if (cached) {
    return cached;
  }
  const promise = sha256Hex(file.resident);
  directPageHashCache.set(file.resident, promise);
  return promise;
};

const readThumbnailBlobFromUrl = async (
  thumbUrl: string,
): Promise<Blob | null> => {
  try {
    const response = await fetch(thumbUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
};

/**
 * Single thumbnail entry point for page files: direct pages go through the
 * content-hash tiers (LRU hot key `opfs:<hash>:<w>:<h>:<q>` → OPFS cold read →
 * encode + store), archive pages encode directly and never touch the store.
 * Returns null only when generation itself failed; callers fall back to
 * `srcUrl` exactly like the previous direct-encode behavior.
 */
export const getOrCreateThumbnailForPage = async (
  file: PageFile,
  srcUrl: string,
): Promise<string | null> => {
  try {
    if (file.kind !== 'direct') {
      return await createThumbnailFromUrl(
        srcUrl,
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT,
        THUMBNAIL_QUALITY,
      );
    }

    const hash = await hashDirectPage(file).catch(() => null);
    if (hash !== null) {
      const hotKey = hotCacheKeyFor(hash);
      const hot = getCachedThumbnailByKey(hotKey);
      if (hot !== undefined) return hot;
      const stored = await getStoredThumbnail(hash);
      if (stored !== null) {
        const url = URL.createObjectURL(stored);
        rememberThumbnailByKey(hotKey, url);
        return url;
      }
    }

    const thumbUrl = await createThumbnailFromUrl(
      srcUrl,
      THUMBNAIL_WIDTH,
      THUMBNAIL_HEIGHT,
      THUMBNAIL_QUALITY,
    );
    if (hash !== null && thumbUrl !== srcUrl) {
      const blob = await readThumbnailBlobFromUrl(thumbUrl);
      if (blob !== null) {
        await putStoredThumbnail(hash, blob);
        rememberThumbnailByKey(hotCacheKeyFor(hash), thumbUrl);
      }
    }
    return thumbUrl;
  } catch {
    return null;
  }
};
