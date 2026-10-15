import { converter, parse } from "culori";
import type {
  RenderTextOrientation,
  RenderTextPathMode,
  RenderTextStyle,
  RenderTextStyleRange,
} from "@/typography/renderStyle";
import type {
  FillStyleSource,
  RenderTextPlacementSegment,
  RenderTextVisualPadding,
  StyledGlyph,
} from "@/utils/renderText.types";
import {
  resolveInlineStyleRuns,
  styleValuesEqual,
} from "@/utils/renderTextStyleRanges";
import {
  isParagraphBreak,
  normalizeLineEndings,
  segmentText,
} from "@/utils/renderText.unicode";
import { parseCssGradientValue } from "@/utils/textFillPicker";

export {
  buildRefinedSafeZoneInnerBox,
  clampSafeZoneInset,
  inferAutoFontBounds,
  normalizeShape,
  resolveHorizontalBandWidth,
  resolveHorizontalLineWidths,
  resolveStrictSafeZoneMode,
} from "@/utils/renderText.geometry";

const toRgb = converter("rgb");

export const withCanvasState = <T>(
  ctx: CanvasRenderingContext2D,
  operation: () => T,
): T => {
  ctx.save();
  try {
    return operation();
  } finally {
    ctx.restore();
  }
};

export const normalizeText = (value: string): string =>
  normalizeLineEndings(value).trim();

export const normalizeFontFamily = (value: string): string => {
  const firstFamily =
    /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/u.exec(value);
  const family =
    firstFamily?.[1] ?? firstFamily?.[2] ?? firstFamily?.[3] ?? "";

  // Strip control characters without a control-char regex literal (lint).
  const sanitized = Array.from(family)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
    .join("");

  return sanitized.trim() || "Arial";
};

export const buildCanvasFont = (
  style: RenderTextStyle,
  fontSize: number,
): string => {
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new RangeError("Font size must be finite and positive.");
  }

  const family = normalizeFontFamily(style.fontFamily)
    .replace(/["\\]/gu, "\\$&");

  return `${style.italic ? "italic " : ""}${style.bold ? "bold " : ""}${fontSize}px "${family}", sans-serif`;
};

export const cloneShadowLayers = (
  style: RenderTextStyle,
): RenderTextStyle["shadowLayers"] =>
  style.shadowLayers === undefined
    ? undefined
    : structuredClone(style.shadowLayers);

export const resolveGlyphStyle = (
  baseStyle: RenderTextStyle,
  fontSize: number,
  patch?: Partial<RenderTextStyle>,
): RenderTextStyle =>
  structuredClone({
    ...baseStyle,
    fontSize,
    ...patch,
  });

export const estimateLineHeight = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  fontSize: number,
): number =>
  withCanvasState(ctx, () => {
    ctx.font = buildCanvasFont(style, fontSize);
    const metrics = ctx.measureText("Mg");
    const ascent = Number.isFinite(metrics.actualBoundingBoxAscent)
      ? Math.max(0, metrics.actualBoundingBoxAscent)
      : fontSize * 0.8;
    const descent = Number.isFinite(metrics.actualBoundingBoxDescent)
      ? Math.max(0, metrics.actualBoundingBoxDescent)
      : fontSize * 0.2;
    const spacing = Number.isFinite(style.lineSpacing)
      ? Math.max(0.6, style.lineSpacing)
      : 1;

    return Math.max(fontSize * 0.8, ascent + descent) * spacing;
  });

export const measureStyledGlyph = (
  ctx: CanvasRenderingContext2D,
  text: string,
  style: RenderTextStyle,
): StyledGlyph =>
  withCanvasState(ctx, () => {
    ctx.font = buildCanvasFont(style, style.fontSize);
    return {
      text,
      style,
      measuredWidth: ctx.measureText(text).width,
      lineHeight: estimateLineHeight(ctx, style, style.fontSize),
    };
  });

export const buildStyledGlyphLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  baseStyle: RenderTextStyle,
  fontSize: number,
  ranges?: readonly RenderTextStyleRange[],
): StyledGlyph[][] =>
  withCanvasState(ctx, () => {
    const runs = resolveInlineStyleRuns(text.length, ranges);
    const styles = new Map<number, RenderTextStyle>();
    const metrics = new Map<RenderTextStyle, Map<string, StyledGlyph>>();
    const lines: StyledGlyph[][] = [];
    let line: StyledGlyph[] = [];
    let runIndex = 0;

    for (const grapheme of segmentText(text)) {
      if (isParagraphBreak(grapheme.text)) {
        lines.push(line);
        line = [];
        continue;
      }

      while (
        runs[runIndex] !== undefined &&
        (runs[runIndex]?.end ?? text.length) <= grapheme.start
      ) {
        runIndex += 1;
      }

      let style = styles.get(runIndex);
      if (!style) {
        style = resolveGlyphStyle(
          baseStyle,
          fontSize,
          runs[runIndex]?.style,
        );
        styles.set(runIndex, style);
      }

      const glyphText = style.uppercase
        ? grapheme.text.toUpperCase()
        : grapheme.text;
      const cache = metrics.get(style) ?? new Map<string, StyledGlyph>();
      let glyph = cache.get(glyphText);

      if (!glyph) {
        glyph = measureStyledGlyph(ctx, glyphText, style);
        cache.set(glyphText, glyph);
        metrics.set(style, cache);
      }

      line.push(glyph);
    }

    lines.push(line);
    return lines;
  });

export const compressGlyphSegments = (
  ctx: CanvasRenderingContext2D,
  glyphs: readonly StyledGlyph[],
): RenderTextPlacementSegment[] =>
  withCanvasState(ctx, () => {
    const segments: RenderTextPlacementSegment[] = [];
    let currentStyle: RenderTextStyle | undefined;
    let pieces: string[] = [];

    const flush = (): void => {
      if (!currentStyle || pieces.length === 0) return;

      const text = pieces.join("");
      ctx.font = buildCanvasFont(currentStyle, currentStyle.fontSize);
      segments.push({
        text,
        style: currentStyle,
        measuredWidth: ctx.measureText(text).width,
      });
      pieces = [];
    };

    for (const glyph of glyphs) {
      if (
        currentStyle !== glyph.style &&
        !styleValuesEqual(currentStyle, glyph.style)
      ) {
        flush();
        currentStyle = glyph.style;
      }

      pieces.push(glyph.text);
    }

    flush();
    return segments;
  });

export const normalizeRotationAngle = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
};

export const normalizeSkewAngle = (value: number): number =>
  Number.isFinite(value) ? Math.min(45, Math.max(-45, value)) : 0;

export const normalizeOpacity = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;

export const applyOpacityToColor = (
  color: string,
  opacity: number,
): string => {
  const parsed = parse(color.trim() || "#000000");
  const rgb = parsed ? toRgb(parsed) : undefined;

  if (!rgb) throw new TypeError("Unsupported standalone CSS color.");

  const channel = (value: number): number =>
    Math.round(Math.min(1, Math.max(0, value)) * 255);
  const alpha = normalizeOpacity(rgb.alpha ?? 1) * normalizeOpacity(opacity);

  return `rgba(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)}, ${alpha})`;
};

export const normalizeGradientAngle = (value: number): number =>
  Number.isFinite(value) ? ((value % 360) + 360) % 360 : 90;

export const resolveRadialGradientCenter = (
  x: number,
  y: number,
  width: number,
  height: number,
  position: string,
): Readonly<{ centerX: number; centerY: number; radius: number }> => {
  const tokens = position.trim().toLowerCase().split(/\s+/u);
  const horizontal = tokens.includes("left")
    ? 0
    : tokens.includes("right")
      ? 1
      : 0.5;
  const vertical = tokens.includes("top")
    ? 0
    : tokens.includes("bottom")
      ? 1
      : 0.5;

  const centerX = x + width * horizontal;
  const centerY = y + height * vertical;
  const radius = Math.max(
    Math.hypot(centerX - x, centerY - y),
    Math.hypot(centerX - x - width, centerY - y),
    Math.hypot(centerX - x, centerY - y - height),
    Math.hypot(centerX - x - width, centerY - y - height),
  );

  return { centerX, centerY, radius: Math.max(Number.EPSILON, radius) };
};

export const normalizeTextOrientation = (
  value: RenderTextStyle["textOrientation"],
): RenderTextOrientation =>
  value === "vertical" ? "vertical" : "horizontal";

export const normalizeTextPathMode = (
  value: RenderTextStyle["textPathMode"],
): RenderTextPathMode =>
  value === "circular" ? "circular" : "normal";

const createLinearGradient = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  degrees: number,
): CanvasGradient => {
  const angle = (normalizeGradientAngle(degrees) * Math.PI) / 180;
  const directionX = Math.sin(angle);
  const directionY = -Math.cos(angle);
  const halfLength =
    (Math.abs(width * directionX) + Math.abs(height * directionY)) / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return ctx.createLinearGradient(
    centerX - directionX * halfLength,
    centerY - directionY * halfLength,
    centerX + directionX * halfLength,
    centerY + directionY * halfLength,
  );
};

export const resolveCanvasFillStyle = (
  ctx: CanvasRenderingContext2D,
  style: FillStyleSource,
  x: number,
  y: number,
  width: number,
  height: number,
): string | CanvasGradient => {
  if (![x, y, width, height].every(Number.isFinite)) {
    throw new RangeError("Gradient geometry must be finite.");
  }

  if (!style.gradientEnabled) return style.fillCssValue || style.color;

  const parsed = style.fillCssValue
    ? parseCssGradientValue(style.fillCssValue.trim())
    : null;

  if (parsed?.stops.length) {
    const gradient =
      parsed.mode === "radial"
        ? (() => {
            const { centerX, centerY, radius } =
              resolveRadialGradientCenter(
                x,
                y,
                width,
                height,
                parsed.position,
              );

            return ctx.createRadialGradient(
              centerX,
              centerY,
              0,
              centerX,
              centerY,
              radius,
            );
          })()
        : createLinearGradient(ctx, x, y, width, height, parsed.angle);

    for (const stop of parsed.stops) {
      if (!Number.isFinite(stop.position)) {
        throw new RangeError("Gradient stop position must be finite.");
      }
      gradient.addColorStop(
        Math.min(1, Math.max(0, stop.position / 100)),
        stop.color,
      );
    }

    return gradient;
  }

  const gradient = createLinearGradient(
    ctx,
    x,
    y,
    width,
    height,
    style.gradientAngle,
  );
  gradient.addColorStop(0, style.gradientStartColor || style.color);
  gradient.addColorStop(1, style.gradientEndColor || style.color);
  return gradient;
};

export const resolveTextFillStyle = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  x: number,
  y: number,
  width: number,
  height: number,
): string | CanvasGradient =>
  resolveCanvasFillStyle(ctx, style, x, y, width, height);

export const resolveRenderTextVisualPadding = (
  style: RenderTextStyle,
  _strictSafeZone: boolean,
): RenderTextVisualPadding => {
  const outline = Number.isFinite(style.outlineWidth)
    ? Math.max(0, style.outlineWidth)
    : 0;

  return { left: outline, right: outline, top: outline, bottom: outline };
};
