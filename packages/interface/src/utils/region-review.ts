import type { AioTextRegion } from "../types/dashboard.types";
import type { TypographyRegion } from "../typography/types";

export type RegionIssueKind =
  | "untranslated"
  | "empty"
  | "cjk_leftover"
  | "overflow";

export interface RegionIssue {
  kind: RegionIssueKind;
  imageId: string;
  regionId: string;
  detail: string;
}

/**
 * Inclusive Unicode ranges scanned for CJK/Korean leftovers in a translation:
 * Hangul jamo, Hiragana/Katakana, CJK ideographs (extensions A/B + unified +
 * compatibility), Hangul syllables and fullwidth forms.
 */
const CJK_LEFTOVER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x11ff],
  [0x3040, 0x30ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7af],
  [0xf900, 0xfaff],
  [0xff00, 0xffef],
  [0x20000, 0x2a6df],
];

const DETAIL_MAX_CHARS = 80;

const normalizeTargetLang = (targetLang: string): string =>
  targetLang.trim().toLowerCase().replaceAll("_", "-");

/**
 * The CJK leftover rule is meaningless when the target language is itself
 * CJK: legitimate ja/ko/zh output would be mass-flagged. `targetLang` is the
 * AIO target language (the `aioTgtLang` store value from
 * `aio-pipeline.catalog.build.ts`).
 */
const isCjkTargetLanguage = (targetLang: string): boolean => {
  const normalized = normalizeTargetLang(targetLang);
  return (
    normalized === "ja" ||
    normalized === "ko" ||
    normalized === "zh" ||
    normalized.startsWith("zh-")
  );
};

const containsCjkLeftover = (text: string): boolean => {
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    for (const [min, max] of CJK_LEFTOVER_RANGES) {
      if (code >= min && code <= max) return true;
    }
  }
  return false;
};

const collapseWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const buildIssueDetail = (
  translatedText: string,
  recognizedText: string,
): string => {
  const translated = collapseWhitespace(translatedText);
  const recognized = collapseWhitespace(recognizedText);
  const preview = translated.length > 0 ? translated : recognized;
  return preview.length > DETAIL_MAX_CHARS
    ? `${preview.slice(0, DETAIL_MAX_CHARS)}…`
    : preview;
};

const resolveIssueKind = (
  recognizedText: string,
  translatedText: string,
  skipCjkCheck: boolean,
): RegionIssueKind | null => {
  if (translatedText.trim().length === 0) return "empty";
  if (
    recognizedText.normalize("NFKC") === translatedText.normalize("NFKC")
  ) {
    return "untranslated";
  }
  if (!skipCjkCheck && containsCjkLeftover(translatedText)) {
    return "cjk_leftover";
  }
  return null;
};

/**
 * Laid-out text extents of one region, as resolved by the render pipeline's
 * single source of truth (`resolveRegionTextLayout`).
 */
export interface RegionTextMeasurement {
  readonly textWidth: number;
  readonly textHeight: number;
  readonly fontSize: number;
}

/**
 * Measurement bridge injected into the overflow derivation. The production
 * implementation resolves the layout the preview painter would produce for
 * the region; `fontSizeOverride` re-resolves the layout at a candidate size
 * for the bounded auto-adjust search. Returns null when the region has no
 * renderable text or no layout can be resolved (nothing is painted, so there
 * is nothing to overflow).
 */
export type RegionTextMeasure = (
  region: AioTextRegion,
  fontSizeOverride?: number,
) => RegionTextMeasurement | null;

/** Sub-pixel tolerance so float layout noise never flags a fitting balloon. */
const OVERFLOW_EPSILON = 0.5;

/**
 * Effective overflow bound for a region: the region bbox, tightened to the
 * bounding box of the balloon mask polygon when one is present (the polygon
 * is region-relative, like shape.innerBox, and is clipped to the bbox).
 */
const resolveOverflowBounds = (
  region: AioTextRegion,
): { width: number; height: number } => {
  const [x1, y1, x2, y2] = region.bbox;
  let left = Math.min(x1, x2);
  let top = Math.min(y1, y2);
  let right = Math.max(x1, x2);
  let bottom = Math.max(y1, y2);
  const polygon = region.shape?.maskPolygon;
  if (polygon && polygon.length > 0) {
    let polygonLeft = Infinity;
    let polygonTop = Infinity;
    let polygonRight = -Infinity;
    let polygonBottom = -Infinity;
    for (const [pointX, pointY] of polygon) {
      polygonLeft = Math.min(polygonLeft, pointX);
      polygonTop = Math.min(polygonTop, pointY);
      polygonRight = Math.max(polygonRight, pointX);
      polygonBottom = Math.max(polygonBottom, pointY);
    }
    left = Math.max(left, polygonLeft);
    top = Math.max(top, polygonTop);
    right = Math.min(right, polygonRight);
    bottom = Math.min(bottom, polygonBottom);
  }
  return {
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const isWithinOverflowBounds = (
  region: AioTextRegion,
  measurement: RegionTextMeasurement,
): boolean => {
  const bounds = resolveOverflowBounds(region);
  return (
    measurement.textWidth <= bounds.width + OVERFLOW_EPSILON &&
    measurement.textHeight <= bounds.height + OVERFLOW_EPSILON
  );
};

const buildOverflowDetail = (region: AioTextRegion): string =>
  buildIssueDetail(
    region.renderText ?? region.translatedText ?? "",
    region.recognizedText ?? "",
  );

/**
 * Derive the overflow issues for one image's regions: a region overflows
 * when its laid-out text box (resolved through the injected measure, i.e.
 * the render pipeline's own layout) exceeds the region bounds. Pure — the
 * caller owns measurement and recomputes from existing state.
 */
export const deriveOverflowIssues = (
  imageId: string,
  regions: AioTextRegion[],
  measure: RegionTextMeasure,
): RegionIssue[] => {
  const issues: RegionIssue[] = [];
  for (const region of regions) {
    const measurement = measure(region);
    if (!measurement) continue;
    if (isWithinOverflowBounds(region, measurement)) continue;
    issues.push({
      kind: "overflow",
      imageId,
      regionId: region.id,
      detail: buildOverflowDetail(region),
    });
  }
  return issues;
};

export type RegionFontSizeFitStatus = "fitted" | "at_bound_overflow";

export interface RegionFontSizeFit {
  readonly regionId: string;
  /** Font size of the layout as currently rendered. */
  readonly fromFontSize: number;
  /** Bounded target size — never below the region's minFontSize bound. */
  readonly toFontSize: number;
  readonly status: RegionFontSizeFitStatus;
}

/**
 * Bounded font-size search for one overflowing region: walks the size down
 * from the current one toward `renderStyle.minFontSize` (never below the
 * bound), re-resolving the layout through `measure` at each integer
 * candidate, and reports the first (largest) size whose laid-out text fits
 * the region bounds. A region that still overflows at the bound is reported
 * with status "at_bound_overflow" and the bound size as the target — it is
 * never shrunk below minFontSize.
 *
 * Interaction with autoFontSize: with autoFontSize enabled the layout engine
 * already searches [minFontSize, fontSize] and only falls back to an
 * out-of-bounds layout at minFontSize, so an overflowing auto-font region is
 * already at the bound — the fit is reported at-bound with
 * toFontSize === fromFontSize (no style change), while fixed-size regions
 * (autoFontSize: false) get the actual downward search.
 *
 * `region` must carry the render-effective style (renderStyle filled);
 * returns null when there is no style, no measurement, or nothing to adjust.
 */
export const fitRegionFontSize = (
  region: AioTextRegion,
  measure: RegionTextMeasure,
): RegionFontSizeFit | null => {
  const style = region.renderStyle;
  if (!style) return null;
  const current = measure(region);
  if (!current) return null;
  if (isWithinOverflowBounds(region, current)) return null;
  const bound = Math.min(style.minFontSize, style.fontSize);
  if (style.autoFontSize !== false) {
    return {
      regionId: region.id,
      fromFontSize: current.fontSize,
      toFontSize: current.fontSize,
      status: "at_bound_overflow",
    };
  }
  for (
    let candidate = Math.ceil(style.fontSize) - 1;
    candidate >= Math.ceil(bound);
    candidate -= 1
  ) {
    const candidateFit = measure(region, candidate);
    if (candidateFit && isWithinOverflowBounds(region, candidateFit)) {
      return {
        regionId: region.id,
        fromFontSize: current.fontSize,
        toFontSize: candidate,
        status: "fitted",
      };
    }
  }
  if (!Number.isInteger(bound)) {
    const boundFit = measure(region, bound);
    if (boundFit && isWithinOverflowBounds(region, boundFit)) {
      return {
        regionId: region.id,
        fromFontSize: current.fontSize,
        toFontSize: bound,
        status: "fitted",
      };
    }
  }
  return {
    regionId: region.id,
    fromFontSize: current.fontSize,
    toFontSize: bound,
    status: "at_bound_overflow",
  };
};

/**
 * Derive the pending review issues for one image's regions. Pure — no store
 * reads/writes, no persistence; the caller recomputes it from existing state.
 *
 * At most one issue per region, first matching rule wins (empty > untranslated
 * > cjk_leftover). `overflow` is part of the union but NOT produced here —
 * `deriveOverflowIssues` covers it against the render layout.
 */
export const deriveRegionIssues = (
  imageId: string,
  regions: TypographyRegion[],
  targetLang: string,
): RegionIssue[] => {
  const skipCjkCheck = isCjkTargetLanguage(targetLang);
  const issues: RegionIssue[] = [];
  for (const region of regions) {
    const translatedText = region.translatedText ?? "";
    const recognizedText = region.recognizedText ?? "";
    const kind = resolveIssueKind(recognizedText, translatedText, skipCjkCheck);
    if (kind === null) continue;
    issues.push({
      kind,
      imageId,
      regionId: region.id,
      detail: buildIssueDetail(translatedText, recognizedText),
    });
  }
  return issues;
};
