/** Detect Text → Region adapter — the one place a Bubble is born from Detect output. */
import { createDefaultTypographyShape } from '../typography/types';
import type { AioTextRegion, DetectApiResponse } from '../types/dashboard.types';
import { clamp, normalizeRgbTriplet, toApiIntegerBbox } from './dashboard.utils';
import { normalizeDetectedRenderMode } from './renderModes';

type DetectionItem = DetectApiResponse['detections'][number];

export interface ImageSize {
  width: number;
  height: number;
}

export interface RegionsFromDetectOptions {
  minRegionSize: number;
  /**
   * When set, drop detections covering more than this fraction of the source
   * area unless their score reaches `minScoreForMaxArea`.
   */
  maxAreaRatio?: number;
  minScoreForMaxArea?: number;
}

function detectionToRegion(
  item: DetectionItem,
  source: ImageSize,
  target: ImageSize,
  scaleX: number,
  scaleY: number,
  options: RegionsFromDetectOptions,
): AioTextRegion | null {
  const [bx1, by1, bx2, by2] = item.bbox;
  const rawX1 = clamp(Math.min(bx1, bx2), 0, source.width);
  const rawY1 = clamp(Math.min(by1, by2), 0, source.height);
  const rawX2 = clamp(Math.max(bx1, bx2), 0, source.width);
  const rawY2 = clamp(Math.max(by1, by2), 0, source.height);
  const x1 = Math.round(clamp(rawX1 * scaleX, 0, target.width));
  const y1 = Math.round(clamp(rawY1 * scaleY, 0, target.height));
  const x2 = Math.round(clamp(rawX2 * scaleX, 0, target.width));
  const y2 = Math.round(clamp(rawY2 * scaleY, 0, target.height));
  const boxWidth = x2 - x1;
  const boxHeight = y2 - y1;
  if (boxWidth < options.minRegionSize || boxHeight < options.minRegionSize) {
    return null;
  }

  if (options.maxAreaRatio !== undefined) {
    const areaRatio =
      ((rawX2 - rawX1) * (rawY2 - rawY1)) / Math.max(1, source.width * source.height);
    const minScore = options.minScoreForMaxArea ?? 0.9;
    if (areaRatio > options.maxAreaRatio && item.score < minScore) {
      return null;
    }
  }

  const detectedRenderMode = normalizeDetectedRenderMode(item.label) ?? 'text_bubble';
  const shapeKind =
    detectedRenderMode === 'text_bubble' || detectedRenderMode === 'text_inside_black_bubble'
      ? 'rounded'
      : 'square';

  return {
    id: item.id,
    bbox: [x1, y1, x2, y2],
    score: item.score,
    source: item.source,
    modelKey: item.model_key,
    detectorModelKey: item.model_key,
    detectedForegroundRgb: normalizeRgbTriplet(item.foreground_rgb),
    structuralType: item.structural_type ?? undefined,
    structuralConfidence: item.structural_confidence ?? undefined,
    structuralSource: item.structural_source ?? undefined,
    matchedReferenceImage: item.matched_reference_image ?? undefined,
    detectedRenderMode,
    renderMode: 'auto',
    shape: createDefaultTypographyShape(boxWidth, boxHeight, shapeKind, 'detected'),
  };
}

/**
 * Normalize hand-edited Regions before a Detect Text re-run: clamp bbox into
 * image bounds, drop boxes below `minRegionSize`, and fill manual defaults.
 * Lives next to `regionsFromDetectPayload` so both Detect entry paths share
 * one size/clamp policy (locality).
 */
export function normalizeManualRegions(
  regions: readonly AioTextRegion[],
  image: ImageSize,
  options: Pick<RegionsFromDetectOptions, 'minRegionSize'>,
): AioTextRegion[] {
  const normalized: AioTextRegion[] = [];
  for (const region of regions) {
    const [x1, y1, x2, y2] = toApiIntegerBbox(region.bbox, image.width, image.height);
    if (x2 - x1 < options.minRegionSize || y2 - y1 < options.minRegionSize) continue;
    const resolvedModelKey = region.modelKey || 'manual';
    normalized.push({
      ...region,
      bbox: [x1, y1, x2, y2],
      source: region.source ?? 'manual',
      score: Number.isFinite(region.score) ? region.score : 1,
      modelKey: resolvedModelKey,
      detectorModelKey: region.detectorModelKey || resolvedModelKey,
    });
  }
  return normalized;
}

/**
 * Map Detect Text API bubbles onto Regions in target-image coordinates.
 * Owns bbox scale/clamp, min-size filtering and the default Typographer shape.
 */
export function regionsFromDetectPayload(
  payload: DetectApiResponse,
  target: ImageSize,
  options: RegionsFromDetectOptions,
): AioTextRegion[] {
  const source: ImageSize = {
    width: payload.image_width > 0 ? payload.image_width : target.width,
    height: payload.image_height > 0 ? payload.image_height : target.height,
  };
  const scaleX = target.width / Math.max(1, source.width);
  const scaleY = target.height / Math.max(1, source.height);

  const regions: AioTextRegion[] = [];
  for (const item of payload.detections) {
    const region = detectionToRegion(item, source, target, scaleX, scaleY, options);
    if (region) regions.push(region);
  }
  return regions;
}
