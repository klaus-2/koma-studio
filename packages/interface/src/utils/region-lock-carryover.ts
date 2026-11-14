import type { AioTextRegion } from '../types/dashboard.types';
import type { TypographyBounds } from '../typography/types';
import { isRegionFieldLocked } from './region-lock';

const REGION_LOCK_FIELDS = ['geometry', 'text', 'style'] as const;

const hasAnyRegionLock = (region: AioTextRegion): boolean =>
  REGION_LOCK_FIELDS.some((field) => isRegionFieldLocked(region, field));

/** Bounds are corner pairs [x1, y1, x2, y2] (codebase-wide contract). */
const boundsArea = (bounds: TypographyBounds): number =>
  Math.abs(bounds[2] - bounds[0]) * Math.abs(bounds[3] - bounds[1]);

const intersectionArea = (a: TypographyBounds, b: TypographyBounds): number => {
  const width = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const height = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return width > 0 && height > 0 ? width * height : 0;
};

const overlapRatio = (a: TypographyBounds, b: TypographyBounds): number => {
  const smaller = Math.min(boundsArea(a), boundsArea(b));
  if (smaller <= 0) return 0;
  return intersectionArea(a, b) / smaller;
};

/**
 * Carries locked regions across a fresh batch detection (F1).
 *
 * Fresh backend ids differ on every run, so matching is spatial: candidate
 * (locked, fresh) pairs with intersection / min(area) >= `overlapThreshold`
 * are assigned best-ratio-first (both sides exclusive — one fresh box
 * carries at most one locked region and vice versa). The carried region
 * keeps its geometry, text, style, shape and lock flags while the fresh
 * region's id and detection metadata survive. Fresh boxes overlapping a
 * carried locked region without being its match are dropped; unmatched
 * fresh regions pass through unchanged.
 */
export const carryOverLockedRegions = (
  prevRegions: readonly AioTextRegion[],
  freshRegions: readonly AioTextRegion[],
  overlapThreshold = 0.5,
): AioTextRegion[] => {
  const lockedPrev = prevRegions.filter(hasAnyRegionLock);
  if (lockedPrev.length === 0) {
    return [...freshRegions];
  }

  const candidatePairs: Array<{
    prevIndex: number;
    lockedRegion: AioTextRegion;
    freshIndex: number;
    ratio: number;
  }> = [];
  lockedPrev.forEach((lockedRegion, prevIndex) => {
    for (const [freshIndex, fresh] of freshRegions.entries()) {
      const ratio = overlapRatio(lockedRegion.bbox, fresh.bbox);
      if (ratio >= overlapThreshold) {
        candidatePairs.push({ prevIndex, lockedRegion, freshIndex, ratio });
      }
    }
  });
  candidatePairs.sort((left, right) => right.ratio - left.ratio);

  const matchByFreshIndex = new Map<number, AioTextRegion>();
  const matchedPrevIndexes = new Set<number>();
  const droppedFreshIndexes = new Set<number>();
  for (const pair of candidatePairs) {
    if (
      matchedPrevIndexes.has(pair.prevIndex) ||
      matchByFreshIndex.has(pair.freshIndex)
    ) {
      continue;
    }
    matchedPrevIndexes.add(pair.prevIndex);
    matchByFreshIndex.set(pair.freshIndex, pair.lockedRegion);
  }

  // Fresh boxes overlapping a CARRIED locked region without being its match
  // are duplicate detections of the same balloon — drop them.
  for (const [freshIndex, fresh] of freshRegions.entries()) {
    if (matchByFreshIndex.has(freshIndex)) continue;
    for (const lockedRegion of matchByFreshIndex.values()) {
      if (overlapRatio(lockedRegion.bbox, fresh.bbox) >= overlapThreshold) {
        droppedFreshIndexes.add(freshIndex);
        break;
      }
    }
  }

  const output: AioTextRegion[] = [];
  for (const [index, fresh] of freshRegions.entries()) {
    const lockedRegion = matchByFreshIndex.get(index);
    if (droppedFreshIndexes.has(index)) continue;
    if (lockedRegion) {
      output.push({
        ...fresh,
        bbox: lockedRegion.bbox,
        renderText: lockedRegion.renderText,
        recognizedText: lockedRegion.recognizedText,
        translatedText: lockedRegion.translatedText,
        renderTextStyleRanges: lockedRegion.renderTextStyleRanges,
        renderStyle: lockedRegion.renderStyle,
        shape: lockedRegion.shape,
        locked: lockedRegion.locked,
        lockedFields: lockedRegion.lockedFields,
      });
    } else {
      output.push(fresh);
    }
  }
  return output;
};
