import { describe, expect, it } from "vitest";

import {
  detectCornerHit,
  detectRotateHandleHit,
  findRegionAtPoint,
  findRegionsAtPoint,
  getOppositeCorner,
  getRegionCornerPoint,
  rotatePoint,
} from "@/components/dashboard/render-text-preview/regionGeometry";
import type { RegionGeometry } from "@/components/dashboard/render-text-preview/regionGeometry";

const region = {
  bbox: [0, 0, 100, 20],
} satisfies RegionGeometry;

describe("region geometry", () => {
  it("rotates a point around its center", () => {
    const point = rotatePoint(10, 0, 0, 0, 90);

    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(10);
  });

  it.each([
    ["nw", "se"],
    ["ne", "sw"],
    ["sw", "ne"],
    ["se", "nw"],
  ] as const)("maps %s to %s", (corner, opposite) => {
    expect(getOppositeCorner(corner)).toBe(opposite);
  });

  it("finds rotated corners", () => {
    const point = getRegionCornerPoint(region, "nw", 90);

    expect(point.x).toBeCloseTo(60);
    expect(point.y).toBeCloseTo(-40);

    expect(
      detectCornerHit(region, point.x, point.y, 2, 90),
    ).toBe("nw");
  });

  it("rejects negative hit radii", () => {
    expect(detectCornerHit(region, 0, 0, -1, 0)).toBeNull();
    expect(
      detectRotateHandleHit(region, 50, -10, -1, 10, 0),
    ).toBeNull();
  });

  it("detects the rotation handle", () => {
    expect(
      detectRotateHandleHit(region, 50, -10, 2, 10, 0),
    ).toEqual({ centerX: 50, centerY: 10 });

    expect(
      detectRotateHandleHit(region, 80, -10, 2, 10, 0),
    ).toBeNull();
  });

  it("returns the topmost region", () => {
    const back = { ...region, id: "back" };
    const front = { ...region, id: "front" };

    expect(findRegionAtPoint([back, front], 50, 10)).toBe(front);
  });

  it("tests the rotated rectangle rather than its original bounds", () => {
    const rotated = {
      ...region,
      renderStyle: { rotation: 90, skewX: 0, skewY: 0 },
    } satisfies RegionGeometry;

    expect(findRegionAtPoint([rotated], 50, -30)).toBe(rotated);
    expect(findRegionAtPoint([rotated], 10, 10)).toBeNull();
  });

  it("inverts skew before testing bounds", () => {
    const skewed = {
      bbox: [0, 0, 100, 100],
      renderStyle: { rotation: 0, skewX: 30, skewY: 0 },
    } satisfies RegionGeometry;

    expect(findRegionAtPoint([skewed], 110, 90)).toBe(skewed);
    expect(findRegionAtPoint([skewed], 0, 90)).toBeNull();
  });

  it("does not select a singular transform", () => {
    const singular = {
      ...region,
      renderStyle: { rotation: 0, skewX: 45, skewY: 45 },
    } satisfies RegionGeometry;

    expect(findRegionAtPoint([singular], 50, 10)).toBeNull();
  });

  it("rejects non-finite pointer coordinates", () => {
    expect(findRegionAtPoint([region], Number.NaN, 0)).toBeNull();
    expect(
      findRegionAtPoint([region], 0, Number.POSITIVE_INFINITY),
    ).toBeNull();
  });

  it("supports an empty collection", () => {
    expect(findRegionAtPoint([], 0, 0)).toBeNull();
  });

  it("returns every overlapping region in draw order", () => {
    const back = { ...region, id: "back" };
    const front = { ...region, id: "front" };
    const farBbox: readonly [number, number, number, number] = [200, 0, 300, 20];
    const far = {
      ...region,
      bbox: farBbox,
      id: "far",
    };

    expect(findRegionsAtPoint([back, far, front], 50, 10)).toEqual([
      back,
      front,
    ]);
    expect(findRegionsAtPoint([back, far, front], 250, 10)).toEqual([far]);
    expect(findRegionsAtPoint([back, far, front], 500, 10)).toEqual([]);
  });

  it("applies the rotation-aware transform to every hit", () => {
    const rotated = {
      ...region,
      id: "rotated",
      renderStyle: { rotation: 90, skewX: 0, skewY: 0 },
    };
    const plain = { ...region, id: "plain" };

    expect(findRegionsAtPoint([rotated, plain], 50, -30)).toEqual([rotated]);
    expect(findRegionsAtPoint([rotated, plain], 10, 10)).toEqual([plain]);
  });

  it("rejects non-finite pointer coordinates for the plural hit test", () => {
    expect(findRegionsAtPoint([region], Number.NaN, 0)).toEqual([]);
    expect(
      findRegionsAtPoint([region], 0, Number.POSITIVE_INFINITY),
    ).toEqual([]);
    expect(findRegionsAtPoint([], 0, 0)).toEqual([]);
  });
});
