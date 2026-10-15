import type {
  RenderTextStyle,
  RenderTextStyleRange,
} from "@/typography/renderStyle";
import type { TypographyShape } from "@/typography/types";
import type {
  RenderTextLayout,
  RenderTextLinePlacement,
  StyledGlyph,
} from "@/utils/renderText.types";
import {
  buildStyledGlyphLines,
  measureStyledGlyph,
  resolveGlyphStyle,
  withCanvasState,
} from "@/utils/renderText.core";
import {
  createMeasuredLayout,
  createMeasurementBox,
} from "@/utils/renderText.measure.shared";

export const measureVerticalText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
  ranges?: readonly RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null =>
  withCanvasState(ctx, () => {
    const box = createMeasurementBox(
      ctx,
      text,
      roiWidth,
      roiHeight,
      style,
      fontSize,
      shape,
    );
    const baseStyle = resolveGlyphStyle(style, fontSize);
    const blank = measureStyledGlyph(ctx, " ", baseStyle);
    const fallbackWidth = measureStyledGlyph(ctx, "M", baseStyle).measuredWidth;
    const paragraphs = buildStyledGlyphLines(
      ctx,
      text,
      style,
      fontSize,
      ranges,
    );
    const placements: RenderTextLinePlacement[] = [];
    let cursorX = 0;
    let maximumHeight = 0;

    for (const paragraph of paragraphs) {
      const source = paragraph.length > 0 ? paragraph : [blank];
      let offset = 0;

      while (offset < source.length) {
        const glyphs: StyledGlyph[] = [];
        let rowHeight = box.fallbackLineHeight;
        let width = fallbackWidth;

        while (offset < source.length) {
          const glyph = source[offset];
          if (!glyph) break;

          const nextHeight = Math.max(rowHeight, glyph.lineHeight);
          const nextWidth = Math.max(width, glyph.measuredWidth);
          const fits = nextHeight * (glyphs.length + 1) <= box.height;

          if (!fits && glyphs.length > 0) break;
          if (!fits && enforceBounds) return null;

          glyphs.push(glyph);
          rowHeight = nextHeight;
          width = nextWidth;
          offset += 1;

          if (!fits) break;
        }

        const advance = Math.max(Number.EPSILON, width * 1.05);
        const usedHeight = rowHeight * glyphs.length;

        if (
          enforceBounds &&
          (cursorX + advance > box.width || usedHeight > box.height)
        ) {
          return null;
        }

        const columnText = glyphs.map((glyph) => glyph.text).join("");

        placements.push({
          text: columnText,
          x: box.x + cursorX + advance / 2,
          y: box.y,
          measuredWidth: advance,
          availableWidth: advance,
          lineHeight: rowHeight,
          segments: glyphs.map((glyph) => ({
            text: glyph.text,
            style: glyph.style,
            measuredWidth: glyph.measuredWidth,
          })),
        });

        cursorX += advance;
        maximumHeight = Math.max(maximumHeight, usedHeight);
      }
    }

    return createMeasuredLayout(
      placements,
      fontSize,
      cursorX + box.paddingX,
      maximumHeight + box.paddingY,
      box,
    );
  });

const collapseCircularWhitespace = (
  ctx: CanvasRenderingContext2D,
  paragraphs: readonly (readonly StyledGlyph[])[],
  fallbackStyle: RenderTextStyle,
): StyledGlyph[] => {
  const result: StyledGlyph[] = [];
  let pendingSpaceStyle: RenderTextStyle | undefined;

  for (let index = 0; index < paragraphs.length; index += 1) {
    if (index > 0) pendingSpaceStyle ??= fallbackStyle;

    for (const glyph of paragraphs[index] ?? []) {
      if (/^\s+$/u.test(glyph.text)) {
        pendingSpaceStyle ??= glyph.style;
        continue;
      }

      if (result.length > 0 && pendingSpaceStyle) {
        result.push(measureStyledGlyph(ctx, " ", pendingSpaceStyle));
      }

      pendingSpaceStyle = undefined;
      result.push(glyph);
    }
  }

  return result.length > 0
    ? result
    : [measureStyledGlyph(ctx, " ", fallbackStyle)];
};

export const measureCircularText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
  ranges?: readonly RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null =>
  withCanvasState(ctx, () => {
    const box = createMeasurementBox(
      ctx,
      text,
      roiWidth,
      roiHeight,
      style,
      fontSize,
      shape,
    );
    const baseStyle = resolveGlyphStyle(style, fontSize);
    const glyphs = collapseCircularWhitespace(
      ctx,
      buildStyledGlyphLines(ctx, text, style, fontSize, ranges),
      baseStyle,
    );

    const radiusScale = Number.isFinite(style.circularRadiusScale)
      ? Math.min(1.2, Math.max(0.2, style.circularRadiusScale ?? 0.78))
      : 0.78;
    const letterSpacing = Number.isFinite(style.circularLetterSpacing)
      ? Math.min(2.5, Math.max(0.5, style.circularLetterSpacing ?? 1))
      : 1;
    const radius = (Math.min(box.width, box.height) / 2) * radiusScale;
    const spacing = fontSize * 0.08 * letterSpacing;
    let lineHeight = box.fallbackLineHeight;
    let arcLength = 0;

    const segments = glyphs.map((glyph) => {
      lineHeight = Math.max(lineHeight, glyph.lineHeight);
      const measuredWidth = glyph.measuredWidth + spacing;
      arcLength += measuredWidth;

      return {
        text: glyph.text,
        style: glyph.style,
        measuredWidth,
      };
    });

    const diameter = radius * 2 + lineHeight;

    if (
      enforceBounds &&
      (radius <= 0 ||
        arcLength > 2 * Math.PI * radius * 0.96 ||
        diameter > box.width ||
        diameter > box.height)
    ) {
      return null;
    }

    const circularText = segments.map((segment) => segment.text).join("");
    const placements: RenderTextLinePlacement[] = [
      {
        text: circularText,
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        measuredWidth: arcLength,
        availableWidth: Math.max(0, 2 * Math.PI * radius * 0.96),
        lineHeight,
        segments,
      },
    ];

    return createMeasuredLayout(
      placements,
      fontSize,
      diameter + box.paddingX,
      diameter + box.paddingY,
      box,
    );
  });
