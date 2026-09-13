// Pure region geometry + hit-testing helpers for the render text preview.
// Moved verbatim from RenderTextPreview.tsx (T07 split); rotation is passed in
// by callers (it derives from the region style or the fallback style).

import type { AioTextRegion, RegionCorner } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  cloneRenderStyle,
  normalizeRenderRotation,
} from '../../../utils/dashboard.utils';

export const getRegionRotation = (
  region: AioTextRegion,
  fallbackStyle: RenderTextStyle,
): number =>
  normalizeRenderRotation(
    cloneRenderStyle(region.renderStyle ?? fallbackStyle).rotation || 0,
  );

export const rotatePoint = (
  px: number,
  py: number,
  centerX: number,
  centerY: number,
  angleDeg: number,
): { x: number; y: number } => {
  if (Math.abs(angleDeg) <= 0.001) return { x: px, y: py };
  const radians = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = px - centerX;
  const dy = py - centerY;
  return {
    x: centerX + (dx * cos - dy * sin),
    y: centerY + (dx * sin + dy * cos),
  };
};

export const getOppositeCorner = (corner: RegionCorner): RegionCorner => {
  if (corner === 'nw') return 'se';
  if (corner === 'ne') return 'sw';
  if (corner === 'sw') return 'ne';
  return 'nw';
};

export const getRegionCornerPoint = (
  region: AioTextRegion,
  corner: RegionCorner,
  rotation: number,
): { x: number; y: number } => {
  const [x1, y1, x2, y2] = region.bbox;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  if (corner === 'nw')
    return rotatePoint(x1, y1, centerX, centerY, rotation);
  if (corner === 'ne')
    return rotatePoint(x2, y1, centerX, centerY, rotation);
  if (corner === 'sw')
    return rotatePoint(x1, y2, centerX, centerY, rotation);
  return rotatePoint(x2, y2, centerX, centerY, rotation);
};

export const detectCornerHit = (
  region: AioTextRegion,
  x: number,
  y: number,
  radius: number,
  rotation: number,
): RegionCorner | null => {
  const corners: Array<{ key: RegionCorner; cx: number; cy: number }> = [
    (() => {
      const point = getRegionCornerPoint(region, 'nw', rotation);
      return { key: 'nw' as const, cx: point.x, cy: point.y };
    })(),
    (() => {
      const point = getRegionCornerPoint(region, 'ne', rotation);
      return { key: 'ne' as const, cx: point.x, cy: point.y };
    })(),
    (() => {
      const point = getRegionCornerPoint(region, 'sw', rotation);
      return { key: 'sw' as const, cx: point.x, cy: point.y };
    })(),
    (() => {
      const point = getRegionCornerPoint(region, 'se', rotation);
      return { key: 'se' as const, cx: point.x, cy: point.y };
    })(),
  ];
  for (const corner of corners) {
    if (
      Math.abs(x - corner.cx) <= radius &&
      Math.abs(y - corner.cy) <= radius
    )
      return corner.key;
  }
  return null;
};

export const detectRotateHandleHit = (
  region: AioTextRegion,
  x: number,
  y: number,
  radius: number,
  offset: number,
  rotation: number,
): { centerX: number; centerY: number } | null => {
  const [x1, y1, x2, y2] = region.bbox;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const handle = rotatePoint(
    (x1 + x2) / 2,
    y1 - offset,
    centerX,
    centerY,
    rotation,
  );
  const dx = x - handle.x;
  const dy = y - handle.y;
  if (dx * dx + dy * dy <= radius * radius) {
    return { centerX, centerY };
  }
  return null;
};

export const findRegionAtPoint = (
  regions: AioTextRegion[],
  x: number,
  y: number,
): AioTextRegion | null => {
  for (let idx = regions.length - 1; idx >= 0; idx -= 1) {
    const region = regions[idx];
    if (!region) continue;
    const [x1, y1, x2, y2] = region.bbox;
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return region;
  }
  return null;
};
