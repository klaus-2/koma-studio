import type { AioTextRegion } from '../types/dashboard.types';
import { deriveOverflowIssues } from './region-review';
import type { RegionTextMeasure } from './region-review';

/**
 * Identity-keyed overflow-count cache.
 *
 * The sidebars subscribe per image instead of the whole detections map: an
 * edit on image B gives B's regions a NEW array identity (CoW), so only B's
 * derivation reruns — image A's cached count survives untouched. The cache is
 * keyed by the measure function identity (one per render-default style), so a
 * style change re-derives everything while repeated renders are free.
 */
const countsByMeasure = new WeakMap<
  RegionTextMeasure,
  WeakMap<readonly AioTextRegion[], number>
>();

/**
 * Count of overflowing regions on one image, derived on demand and cached by
 * (measure identity × regions identity). `regions` may be the stable
 * `EMPTY_REGION_LIST` fallback — its identity caches a zero count.
 */
export const deriveOverflowCount = (
  imageId: string,
  regions: readonly AioTextRegion[],
  measure: RegionTextMeasure,
): number => {
  let perMeasure = countsByMeasure.get(measure);
  if (perMeasure === undefined) {
    perMeasure = new WeakMap();
    countsByMeasure.set(measure, perMeasure);
  }
  const cached = perMeasure.get(regions);
  if (cached !== undefined) {
    return cached;
  }
  const count = deriveOverflowIssues(imageId, Array.from(regions), measure).length;
  perMeasure.set(regions, count);
  return count;
};
