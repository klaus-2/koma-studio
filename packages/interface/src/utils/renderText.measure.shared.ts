import type { RenderTextStyle } from "@/typography/renderStyle";
import type { TypographyShape } from "@/typography/types";
import type {
  RenderTextLayout,
  RenderTextLinePlacement,
  StyledGlyph,
} from "@/utils/renderText.types";
import {
  compressGlyphSegments,
  estimateLineHeight,
  normalizeShape,
  resolveHorizontalBandWidth,
  resolveRenderTextVisualPadding,
  resolveStrictSafeZoneMode,
} from "@/utils/renderText.core";

export interface MeasurementBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly paddingX: number;
  readonly paddingY: number;
  readonly paddingTop: number;
  readonly fallbackLineHeight: number;
  readonly shape: TypographyShape | null;
  widthAt(y: number, height: number): number;
}

export interface MeasuredGlyphLine {
  readonly text: string;
  readonly measuredWidth: number;
  readonly lineHeight: number;
  readonly segments: NonNullable<RenderTextLinePlacement["segments"]>;
}

export const createMeasurementBox = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
): MeasurementBox => {
  if (
    typeof text !== "string" ||
    !Number.isFinite(roiWidth) ||
    roiWidth <= 0 ||
    !Number.isFinite(roiHeight) ||
    roiHeight <= 0 ||
    !Number.isFinite(fontSize) ||
    fontSize <= 0
  ) {
    throw new Error("Invalid measurement input.");
  }

  const normalized = normalizeShape(shape, roiWidth, roiHeight);
  const strict = resolveStrictSafeZoneMode(normalized, roiWidth, roiHeight);
  const padding = resolveRenderTextVisualPadding(style, strict);
  const bounds = normalized?.innerBox ?? [0, 0, roiWidth, roiHeight];
  const x1 = bounds[0] ?? 0;
  const y1 = bounds[1] ?? 0;
  const x2 = bounds[2] ?? roiWidth;
  const y2 = bounds[3] ?? roiHeight;
  const paddingX = padding.left + padding.right;
  const paddingY = padding.top + padding.bottom;
  const width = Math.max(0, x2 - x1 - paddingX);
  const height = Math.max(0, y2 - y1 - paddingY);

  return {
    x: x1 + padding.left,
    y: y1 + padding.top,
    width,
    height,
    paddingX,
    paddingY,
    paddingTop: padding.top,
    fallbackLineHeight: estimateLineHeight(ctx, style, fontSize),
    shape: normalized,
    widthAt: (y, lineHeight) =>
      height > 0
        ? resolveHorizontalBandWidth(
            normalized,
            width,
            y / height,
            (y + lineHeight) / height,
          )
        : 0,
  };
};

export const measureGlyphLine = (
  ctx: CanvasRenderingContext2D,
  glyphs: readonly StyledGlyph[],
  fallbackLineHeight: number,
): MeasuredGlyphLine => {
  const segments = compressGlyphSegments(ctx, glyphs);
  let lineHeight = fallbackLineHeight;
  let measuredWidth = 0;

  for (const glyph of glyphs) {
    lineHeight = Math.max(lineHeight, glyph.lineHeight);
  }

  for (const segment of segments) {
    measuredWidth += segment.measuredWidth;
  }

  if (
    !Number.isFinite(measuredWidth) ||
    measuredWidth < 0 ||
    !Number.isFinite(lineHeight) ||
    lineHeight <= 0
  ) {
    throw new RangeError("Canvas returned invalid text metrics.");
  }

  return {
    text: segments.map((segment) => segment.text).join(""),
    segments,
    lineHeight,
    measuredWidth,
  };
};

export const createMeasuredLayout = (
  placements: RenderTextLinePlacement[],
  fontSize: number,
  textWidth: number,
  textHeight: number,
  box: MeasurementBox,
): RenderTextLayout => {
  const lines = placements.map((placement) => placement.text);
  let lineHeight = box.fallbackLineHeight;

  for (const placement of placements) {
    lineHeight = Math.max(
      lineHeight,
      placement.lineHeight ?? box.fallbackLineHeight,
    );
  }

  return {
    wrappedText: lines.join("\n"),
    lines,
    fontSize,
    lineHeight,
    textWidth,
    textHeight,
    placements,
    shapeKind: box.shape?.kind ?? "square",
  };
};
