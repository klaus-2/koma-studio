import type { RenderTextStyle } from "@/typography/renderStyle";
import type { StyledGlyph } from "@/utils/renderText.types";
import { buildCanvasFont, withCanvasState } from "@/utils/renderText.core";

export const GLYPH_METRICS_CACHE_LIMIT = 2048;

interface GlyphMetricsEntry {
  measuredWidth: number;
  lineHeight: number;
}

let glyphMetricsCache = new Map<string, GlyphMetricsEntry>();

export const clearGlyphMetricsCache = (): void => {
  glyphMetricsCache = new Map();
};

const effectiveLineSpacing = (style: RenderTextStyle): string =>
  String(
    Number.isFinite(style.lineSpacing)
      ? Math.max(0.6, style.lineSpacing)
      : 1,
  );

const fontReadinessBit = (font: string): string => {
  if (typeof document === "undefined" || !("fonts" in document)) return "1";
  try {
    return document.fonts.check(font) ? "1" : "0";
  } catch {
    return "1";
  }
};

const rememberGlyphMetrics = (key: string, entry: GlyphMetricsEntry): void => {
  if (!Number.isFinite(entry.measuredWidth) || !Number.isFinite(entry.lineHeight)) {
    return;
  }
  glyphMetricsCache.delete(key);
  glyphMetricsCache.set(key, entry);
  if (glyphMetricsCache.size > GLYPH_METRICS_CACHE_LIMIT) {
    const oldest = glyphMetricsCache.keys().next().value;
    if (oldest !== undefined) glyphMetricsCache.delete(oldest);
  }
};

const buildGlyphMetricsKey = (font: string, text: string, style: RenderTextStyle): string =>
  `${font}\u0000${text}\u0000${effectiveLineSpacing(style)}\u0000${fontReadinessBit(font)}`;

const measureProbeEntryUncached = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  fontSize: number,
  font: string,
): GlyphMetricsEntry =>
  withCanvasState(ctx, () => {
    ctx.font = font;
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

    return {
      measuredWidth: metrics.width,
      lineHeight: Math.max(fontSize * 0.8, ascent + descent) * spacing,
    };
  });

export const measureStyledLineHeightCached = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  fontSize: number,
): number => {
  const font = buildCanvasFont(style, fontSize);
  const key = buildGlyphMetricsKey(font, "Mg", style);
  const cached = glyphMetricsCache.get(key);
  if (cached) return cached.lineHeight;

  const entry = measureProbeEntryUncached(ctx, style, fontSize, font);
  rememberGlyphMetrics(key, entry);
  return entry.lineHeight;
};

export const measureStyledGlyphCached = (
  ctx: CanvasRenderingContext2D,
  text: string,
  style: RenderTextStyle,
): StyledGlyph => {
  const font = buildCanvasFont(style, style.fontSize);
  const key = buildGlyphMetricsKey(font, text, style);
  const cached = glyphMetricsCache.get(key);
  if (cached) {
    return { text, style, ...cached };
  }

  const lineHeight = measureStyledLineHeightCached(ctx, style, style.fontSize);
  return withCanvasState(ctx, () => {
    ctx.font = font;
    const measuredWidth = ctx.measureText(text).width;
    const entry: GlyphMetricsEntry = { measuredWidth, lineHeight };
    rememberGlyphMetrics(key, entry);
    return { text, style, ...entry };
  });
};
