import { describe, expect, it } from "vitest";

import {
  deriveOverflowIssues,
  fitRegionFontSize,
  type RegionTextMeasure,
} from "@/utils/region-review";
import type { AioTextRegion } from "@/types/dashboard.types";
import { DEFAULT_RENDER_STYLE } from "@/constants/dashboard.constants";

interface StubExtents {
  width: number;
  height: number;
  fontSize: number;
}

const measureWithExtents = (
  extents: (
    region: AioTextRegion,
    fontSizeOverride: number | undefined,
  ) => StubExtents | null,
): RegionTextMeasure => (region, fontSizeOverride) => {
  const result = extents(region, fontSizeOverride);
  return result
    ? {
        textWidth: result.width,
        textHeight: result.height,
        fontSize: result.fontSize,
      }
    : null;
};

// Stub layout: width scales with the effective font size so the bounded
// search exercises real size-dependent measurement (5 chars * 1.2 * size —
// "Hello" fits the 100px-wide bbox from size 16 down). Like the real engine,
// an overflowing autoFontSize layout sits at the minFontSize fallback.
const linearMeasure: RegionTextMeasure = measureWithExtents(
  (region, fontSizeOverride) => {
    const style = region.renderStyle;
    const fontSize =
      fontSizeOverride ??
      (style === undefined
        ? undefined
        : style.autoFontSize === false
          ? style.fontSize
          : style.minFontSize);
    if (fontSize === undefined) return null;
    const text =
      region.renderText ?? region.translatedText ?? region.recognizedText ?? "";
    const charCount = text.length;
    if (charCount === 0) return null;
    return {
      width: charCount * 1.2 * fontSize,
      height: fontSize * 1.2,
      fontSize,
    };
  },
);

const fixedMeasure = (width: number, height: number): RegionTextMeasure =>
  measureWithExtents(() => ({ width, height, fontSize: 20 }));

const region = (
  id: string,
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox: [0, 0, 100, 40],
  score: 1,
  source: "model",
  modelKey: "test-model",
  renderText: "Hello",
  renderStyle: {
    ...DEFAULT_RENDER_STYLE,
    fontSize: 24,
    minFontSize: 12,
    autoFontSize: false,
  },
  ...overrides,
});

describe("deriveOverflowIssues", () => {
  it("flags a region whose laid-out text exceeds the region bbox", () => {
    const issues = deriveOverflowIssues(
      "image-1",
      [region("r1", { renderText: "Way too long here" })],
      fixedMeasure(150, 30),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "overflow",
      imageId: "image-1",
      regionId: "r1",
      detail: "Way too long here",
    });
  });

  it("does NOT flag text that fits within the region bbox", () => {
    const issues = deriveOverflowIssues(
      "image-1",
      [region("r1")],
      fixedMeasure(90, 30),
    );
    expect(issues).toEqual([]);
  });

  it("tolerates sub-pixel layout noise at the bound", () => {
    const issues = deriveOverflowIssues(
      "image-1",
      [region("r1")],
      fixedMeasure(100.4, 40),
    );
    expect(issues).toEqual([]);
  });

  it("tightens the bound to the mask polygon bounding box when present", () => {
    const shaped = region("r1", {
      shape: {
        kind: "square",
        source: "refined",
        cornerRadius: 0,
        innerBox: [0, 0, 100, 40],
        fitProfile: [],
        maskPolygon: [
          [0, 0],
          [60, 0],
          [60, 40],
          [0, 40],
        ],
      },
    });
    expect(deriveOverflowIssues("image-1", [shaped], fixedMeasure(90, 30))).toHaveLength(1);
    expect(deriveOverflowIssues("image-1", [region("r1")], fixedMeasure(90, 30))).toEqual([]);
  });

  it("skips regions the painter would not paint (no renderable text)", () => {
    const empty = region("r1", {
      renderText: undefined,
      translatedText: undefined,
      recognizedText: undefined,
    });
    const issues = deriveOverflowIssues("image-1", [empty], linearMeasure);
    expect(issues).toEqual([]);
  });

  it("derives the detail from the rendered text with a recognized fallback", () => {
    const issues = deriveOverflowIssues(
      "image-1",
      [region("r1", { renderText: undefined, translatedText: "Fallback text" })],
      fixedMeasure(150, 30),
    );
    expect(issues[0]?.detail).toBe("Fallback text");
  });
});

describe("fitRegionFontSize", () => {
  it("lands the adjusted size within [minFontSize, fontSize] and never below the bound", () => {
    const fit = fitRegionFontSize(region("r1"), linearMeasure);
    expect(fit).not.toBeNull();
    expect(fit?.status).toBe("fitted");
    expect(fit?.toFontSize).toBeGreaterThanOrEqual(12);
    expect(fit?.toFontSize).toBeLessThanOrEqual(24);
    // 5 chars * 6 * size <= 100.5 fits from size 16 down; the largest such
    // candidate must win.
    expect(fit?.toFontSize).toBe(16);
  });

  it("reports at-bound overflow instead of shrinking below minFontSize", () => {
    const oversized = region("r1", { renderText: "A very long balloon line" });
    const fit = fitRegionFontSize(oversized, linearMeasure);
    expect(fit).not.toBeNull();
    expect(fit?.status).toBe("at_bound_overflow");
    expect(fit?.toFontSize).toBe(12);
    expect(fit?.toFontSize).toBeGreaterThanOrEqual(12);
    // Even at the bound the text still overflows, so the derivation keeps
    // reporting the region after the bounded adjustment was applied.
    const atBound = region("r1", {
      renderText: "A very long balloon line",
      renderStyle: {
        ...DEFAULT_RENDER_STYLE,
        fontSize: 12,
        minFontSize: 12,
        autoFontSize: false,
      },
    });
    expect(deriveOverflowIssues("image-1", [atBound], linearMeasure)).toHaveLength(1);
  });

  it("reports autoFontSize regions at-bound without searching or changing the style", () => {
    let overrideCalls = 0;
    const spyMeasure: RegionTextMeasure = (measuredRegion, fontSizeOverride) => {
      if (fontSizeOverride !== undefined) overrideCalls += 1;
      return linearMeasure(measuredRegion, fontSizeOverride);
    };
    const autoRegion = region("r1", {
      renderText: "A very long balloon line",
      renderStyle: {
        ...DEFAULT_RENDER_STYLE,
        fontSize: 24,
        minFontSize: 12,
        autoFontSize: true,
      },
    });
    const fit = fitRegionFontSize(autoRegion, spyMeasure);
    expect(fit).not.toBeNull();
    expect(fit?.status).toBe("at_bound_overflow");
    // The engine already sits at the minFontSize fallback layout.
    expect(fit?.fromFontSize).toBe(12);
    expect(fit?.toFontSize).toBe(fit?.fromFontSize);
    expect(overrideCalls).toBe(0);
  });

  it("returns null when the region already fits or has no style", () => {
    const fitting = region("r1", { renderText: "Hi" });
    expect(fitRegionFontSize(fitting, linearMeasure)).toBeNull();
    expect(
      fitRegionFontSize(region("r1", { renderStyle: undefined }), linearMeasure),
    ).toBeNull();
  });

  it("uses a non-integer minFontSize bound in a final fit attempt", () => {
    // 8 * size: no integer candidate down to 13 fits the 100px bbox, but the
    // exact 12.5 bound does (100 <= 100.5).
    const tightMeasure: RegionTextMeasure = measureWithExtents(
      (measuredRegion, fontSizeOverride) => {
        const fontSize = fontSizeOverride ?? measuredRegion.renderStyle?.fontSize;
        if (fontSize === undefined) return null;
        return { width: fontSize * 8, height: fontSize, fontSize };
      },
    );
    const fit = fitRegionFontSize(
      region("r1", {
        renderStyle: {
          ...DEFAULT_RENDER_STYLE,
          fontSize: 24,
          minFontSize: 12.5,
          autoFontSize: false,
        },
      }),
      tightMeasure,
    );
    expect(fit).not.toBeNull();
    expect(fit?.status).toBe("fitted");
    expect(fit?.toFontSize).toBe(12.5);
    expect(fit?.toFontSize).toBeGreaterThanOrEqual(12.5);
  });
});
