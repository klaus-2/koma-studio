import type { AioTextRegion, RegionCorner } from '@/types/dashboard.types';
import type { RenderTextStyle } from '@/utils/renderText';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RegionGeometry {
  readonly bbox: readonly [number, number, number, number];
  readonly renderStyle?:
  | Readonly<
    Pick<RenderTextStyle, "rotation" | "skewX" | "skewY">
  >
  | undefined;
}

interface Transform {
  readonly centerX: number;
  readonly centerY: number;
  readonly cos: number;
  readonly sin: number;
  readonly shearX: number;
  readonly shearY: number;
}

const CORNERS = ["nw", "ne", "sw", "se"] as const;

const OPPOSITE_CORNERS = {
  nw: "se",
  ne: "sw",
  sw: "ne",
  se: "nw",
} as const satisfies Readonly<Record<RegionCorner, RegionCorner>>;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const normalizeRotation = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  let angle = value % 360;

  if (angle > 180) {
    angle -= 360;
  } else if (angle <= -180) {
    angle += 360;
  }

  return Math.round(angle * 10) / 10;
};

const normalizeSkew = (value: number): number =>
  Number.isFinite(value)
    ? Math.round(Math.min(45, Math.max(-45, value)) * 10) / 10
    : 0;

const createTransform = (
  region: RegionGeometry,
  rotation: number,
  skewX: number,
  skewY: number,
): Transform => {
  const [x1, y1, x2, y2] = region.bbox;
  const radians = toRadians(normalizeRotation(rotation));

  return {
    centerX: (x1 + x2) / 2,
    centerY: (y1 + y2) / 2,
    cos: Math.cos(radians),
    sin: Math.sin(radians),
    shearX: Math.tan(toRadians(normalizeSkew(skewX))),
    shearY: Math.tan(toRadians(normalizeSkew(skewY))),
  };
};

const transformPoint = (
  x: number,
  y: number,
  transform: Transform,
): Point => {
  const dx = x - transform.centerX;
  const dy = y - transform.centerY;
  const shearedX = dx + transform.shearX * dy;
  const shearedY = transform.shearY * dx + dy;

  return {
    x:
      transform.centerX +
      shearedX * transform.cos -
      shearedY * transform.sin,
    y:
      transform.centerY +
      shearedX * transform.sin +
      shearedY * transform.cos,
  };
};

const inverseTransformPoint = (
  x: number,
  y: number,
  transform: Transform,
): Point | null => {
  const determinant = 1 - transform.shearX * transform.shearY;

  if (Math.abs(determinant) < 1e-8) {
    return null;
  }

  const dx = x - transform.centerX;
  const dy = y - transform.centerY;

  const rotatedX = dx * transform.cos + dy * transform.sin;
  const rotatedY = -dx * transform.sin + dy * transform.cos;

  return {
    x:
      transform.centerX +
      (rotatedX - transform.shearX * rotatedY) / determinant,
    y:
      transform.centerY +
      (rotatedY - transform.shearY * rotatedX) / determinant,
  };
};

const hasFiniteBounds = (region: RegionGeometry): boolean =>
  region.bbox.every(Number.isFinite);

export const getRegionRotation = (
  region: RegionGeometry,
  fallbackStyle: RenderTextStyle,
): number =>
  normalizeRotation(
    (region.renderStyle ?? fallbackStyle).rotation ?? 0,
  );

export const rotatePoint = (
  px: number,
  py: number,
  centerX: number,
  centerY: number,
  angleDeg: number,
): Point => {
  const radians = toRadians(normalizeRotation(angleDeg));
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = px - centerX;
  const dy = py - centerY;

  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  };
};

export const getOppositeCorner = (
  corner: RegionCorner,
): RegionCorner => OPPOSITE_CORNERS[corner];

export const getRegionCornerPoint = (
  region: RegionGeometry,
  corner: RegionCorner,
  rotation: number,
  skewX = 0,
  skewY = 0,
): Point => {
  const [x1, y1, x2, y2] = region.bbox;

  const x = corner === "nw" || corner === "sw" ? x1 : x2;
  const y = corner === "nw" || corner === "ne" ? y1 : y2;

  return transformPoint(
    x,
    y,
    createTransform(region, rotation, skewX, skewY),
  );
};

export const detectCornerHit = (
  region: RegionGeometry,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  skewX = 0,
  skewY = 0,
): RegionCorner | null => {
  if (
    !hasFiniteBounds(region) ||
    ![x, y, radius].every(Number.isFinite) ||
    radius < 0
  ) {
    return null;
  }

  let closest: RegionCorner | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const corner of CORNERS) {
    const point = getRegionCornerPoint(
      region,
      corner,
      rotation,
      skewX,
      skewY,
    );
    const dx = x - point.x;
    const dy = y - point.y;
    const distance = dx * dx + dy * dy;

    if (
      Math.abs(dx) <= radius &&
      Math.abs(dy) <= radius &&
      distance < closestDistance
    ) {
      closest = corner;
      closestDistance = distance;
    }
  }

  return closest;
};

export const detectRotateHandleHit = (
  region: RegionGeometry,
  x: number,
  y: number,
  radius: number,
  offset: number,
  rotation: number,
  skewX = 0,
  skewY = 0,
): Readonly<{ centerX: number; centerY: number }> | null => {
  if (
    !hasFiniteBounds(region) ||
    ![x, y, radius, offset].every(Number.isFinite) ||
    radius < 0 ||
    offset < 0
  ) {
    return null;
  }

  const transform = createTransform(region, rotation, skewX, skewY);
  const handle = transformPoint(
    transform.centerX,
    region.bbox[1] - offset,
    transform,
  );

  const dx = x - handle.x;
  const dy = y - handle.y;

  return dx * dx + dy * dy <= radius * radius
    ? {
      centerX: transform.centerX,
      centerY: transform.centerY,
    }
    : null;
};

export function findRegionAtPoint(
  regions: readonly AioTextRegion[],
  x: number,
  y: number,
  fallbackStyle?: RenderTextStyle,
): AioTextRegion | null;

export function findRegionAtPoint<TRegion extends RegionGeometry>(
  regions: readonly TRegion[],
  x: number,
  y: number,
  fallbackStyle?: RenderTextStyle,
): TRegion | null;

export function findRegionAtPoint<TRegion extends RegionGeometry>(
  regions: readonly TRegion[],
  x: number,
  y: number,
  fallbackStyle?: RenderTextStyle,
): TRegion | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  for (let index = regions.length - 1; index >= 0; index -= 1) {
    const region = regions[index];

    if (region === undefined || !hasFiniteBounds(region)) {
      continue;
    }

    const style = region.renderStyle ?? fallbackStyle;
    const transform = createTransform(
      region,
      style?.rotation ?? 0,
      style?.skewX ?? 0,
      style?.skewY ?? 0,
    );

    const local = inverseTransformPoint(x, y, transform);

    if (local === null) {
      continue;
    }

    const [x1, y1, x2, y2] = region.bbox;

    if (
      local.x >= Math.min(x1, x2) &&
      local.x <= Math.max(x1, x2) &&
      local.y >= Math.min(y1, y2) &&
      local.y <= Math.max(y1, y2)
    ) {
      return region;
    }
  }

  return null;
}
