/**
 * Marquee selection math. Pure module — the MarqueeSelectionLayer
 * converts pointer coordinates to image space and consumes this decision;
 * the returned order is the region array order, which is the contract the
 * multi-bubble queue pairs against pending queue items (hooks/typographer.ts).
 */
import type { RegionGeometry } from './regionGeometry';

export interface MarqueeRect {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Regions whose bounding box intersects the dragged rectangle, in the region
 * array order. A degenerate rectangle (zero width or height — a click without
 * a drag) intersects nothing, so a stray click clears the selection.
 */
export const regionsIntersectingRect = <TRegion extends RegionGeometry>(
  regions: readonly TRegion[],
  rect: MarqueeRect,
): TRegion[] => {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);
  if (maxX <= minX || maxY <= minY) return [];
  return regions.filter((region) => {
    const [rx1, ry1, rx2, ry2] = region.bbox;
    return rx1 < maxX && rx2 > minX && ry1 < maxY && ry2 > minY;
  });
};
