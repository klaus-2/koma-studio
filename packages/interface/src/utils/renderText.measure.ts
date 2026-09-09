import type { TypographyShape } from "../typography/types";
import type { RenderTextStyle, RenderTextStyleRange } from "../typography/renderStyle";
import type {
  RenderTextLayout,
  RenderTextLinePlacement,
  StyledGlyph,
} from "./renderText.types";
import {
  buildCanvasFont,
  buildStyledGlyphLines,
  compressGlyphSegments,
  estimateLineHeight,
  inferAutoFontBounds,
  normalizeShape,
  normalizeText,
  normalizeTextOrientation,
  normalizeTextPathMode,
  resolveHorizontalLineWidths,
  resolveRenderTextVisualPadding,
  resolveStrictSafeZoneMode,
} from "./renderText.core";
import { wrapParagraphGreedy, wrapParagraphWithProfile } from "./renderText.hyphenation";

export const wrapAndMeasureVertical = (
  ctx: CanvasRenderingContext2D,
  text: string,
  _roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
): RenderTextLayout => {
  const safeHeight = Math.max(1, roiHeight);
  const outlineWidth = Math.max(0, style.outlineWidth || 0);
  const lineHeight = estimateLineHeight(ctx, style, fontSize);
  const availableHeight = Math.max(1, safeHeight - (outlineWidth * 2));
  const maxRows = Math.max(1, Math.floor(availableHeight / lineHeight));
  const paragraphs = text.split("\n");
  const columns: string[] = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index] ?? "";
    const glyphs = Array.from(paragraph);
    if (glyphs.length === 0) {
      columns.push(" ");
    } else {
      for (let glyphOffset = 0; glyphOffset < glyphs.length; glyphOffset += maxRows) {
        columns.push(glyphs.slice(glyphOffset, glyphOffset + maxRows).join(""));
      }
    }
    if (index < paragraphs.length - 1) {
      columns.push(" ");
    }
  }

  if (columns.length === 0) {
    columns.push(" ");
  }

  let maxGlyphWidth = 0;
  let maxRowsUsed = 1;
  for (const column of columns) {
    const glyphs = Array.from(column);
    maxRowsUsed = Math.max(maxRowsUsed, Math.max(1, glyphs.length));
    for (const glyph of glyphs) {
      maxGlyphWidth = Math.max(maxGlyphWidth, ctx.measureText(glyph || " ").width);
    }
  }

  const fallbackGlyphWidth = ctx.measureText("M").width;
  const columnAdvance = Math.max(1, Math.max(maxGlyphWidth, fallbackGlyphWidth) * 1.05);
  const textWidth = (columnAdvance * columns.length) + (outlineWidth * 2);
  const textHeight = (lineHeight * maxRowsUsed) + (outlineWidth * 2);
  const placements = columns.map((column, index) => ({
    text: column,
    x: (index * columnAdvance) + (columnAdvance / 2),
    y: 0,
    measuredWidth: columnAdvance,
    availableWidth: columnAdvance,
  }));

  return {
    wrappedText: columns.join("\n"),
    lines: columns,
    fontSize,
    lineHeight,
    textWidth,
    textHeight,
    placements,
    shapeKind: "square",
  };
};

export const wrapAndMeasureHorizontal = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
): RenderTextLayout | null => {
  const safeWidth = Math.max(1, roiWidth);
  const safeHeight = Math.max(1, roiHeight);
  const normalizedShape = normalizeShape(shape, safeWidth, safeHeight);
  const strictSafeZone = resolveStrictSafeZoneMode(
    normalizedShape,
    safeWidth,
    safeHeight,
  );
  const visualPadding = resolveRenderTextVisualPadding(style, strictSafeZone);
  const innerBox = normalizedShape?.innerBox ?? [0, 0, safeWidth, safeHeight];
  const innerWidth = Math.max(
    1,
    innerBox[2] - innerBox[0] - visualPadding.left - visualPadding.right,
  );
  const innerHeight = Math.max(
    1,
    innerBox[3] - innerBox[1] - visualPadding.top - visualPadding.bottom,
  );
  const lineHeight = estimateLineHeight(ctx, style, fontSize);
  const maxLines = Math.max(1, Math.floor(innerHeight / Math.max(1, lineHeight)));
  const baseLineWidths = resolveHorizontalLineWidths(normalizedShape, maxLines, innerWidth);
  const paragraphs = text.split("\n");
  const wrappedLines: string[] = [];
  const allowHyphenation = style.hyphenationEnabled === true;
  const hyphenationLanguage = style.hyphenationLanguage?.trim().toLowerCase();

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index] ?? "";
    const remainingLines = maxLines - wrappedLines.length;
    if (remainingLines <= 0) {
      return null;
    }
    const paragraphLineWidths = baseLineWidths.slice(wrappedLines.length, wrappedLines.length + remainingLines);
    const nextParagraphLines = normalizedShape?.kind === "rounded"
      ? wrapParagraphWithProfile(
        ctx,
        paragraph,
        paragraphLineWidths,
        remainingLines,
        allowHyphenation,
        hyphenationLanguage,
        strictSafeZone,
      )
      : wrapParagraphGreedy(
        ctx,
        paragraph,
        paragraphLineWidths[0] ?? innerWidth,
        allowHyphenation,
        hyphenationLanguage,
        strictSafeZone,
      );
    const resolvedParagraphLines = nextParagraphLines
      ?? wrapParagraphGreedy(
        ctx,
        paragraph,
        innerWidth,
        allowHyphenation,
        hyphenationLanguage,
        strictSafeZone,
      );
    if (!resolvedParagraphLines) {
      return null;
    }
    wrappedLines.push(...resolvedParagraphLines);
    if (wrappedLines.length > maxLines) {
      return null;
    }
  }

  if (wrappedLines.length === 0) {
    wrappedLines.push("");
  }

  const usedLineWidths = resolveHorizontalLineWidths(normalizedShape, wrappedLines.length, innerWidth);
  const placements = wrappedLines.map((line, index) => ({
    text: line,
    x:
      innerBox[0]
      + visualPadding.left
      + Math.max(0, (innerWidth - (usedLineWidths[index] ?? innerWidth)) / 2),
    y: visualPadding.top + (index * lineHeight),
    measuredWidth: ctx.measureText(line).width,
    availableWidth: usedLineWidths[index] ?? innerWidth,
  }));

  if (
    strictSafeZone &&
    placements.some((placement) => placement.measuredWidth > placement.availableWidth)
  ) {
    return null;
  }

  const textWidth =
    placements.reduce((max, placement) => Math.max(max, placement.measuredWidth), 0)
    + visualPadding.left
    + visualPadding.right;
  const textHeight =
    (lineHeight * wrappedLines.length)
    + visualPadding.top
    + visualPadding.bottom;

  return {
    wrappedText: wrappedLines.join("\n"),
    lines: wrappedLines,
    fontSize,
    lineHeight,
    textWidth,
    textHeight,
    placements,
    shapeKind: normalizedShape?.kind ?? "square",
  };
};

export const wrapAndMeasureCircular = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
): RenderTextLayout | null => {
  const safeWidth = Math.max(1, roiWidth);
  const safeHeight = Math.max(1, roiHeight);
  const outlineWidth = Math.max(0, style.outlineWidth || 0);
  const normalizedShape = normalizeShape(shape, safeWidth, safeHeight);
  const innerBox = normalizedShape?.innerBox ?? [0, 0, safeWidth, safeHeight];
  const innerWidth = Math.max(1, innerBox[2] - innerBox[0] - (outlineWidth * 2));
  const innerHeight = Math.max(1, innerBox[3] - innerBox[1] - (outlineWidth * 2));
  const radius = (Math.min(innerWidth, innerHeight) / 2) * Math.min(Math.max(style.circularRadiusScale || 0.78, 0.2), 1.2);
  const normalizedText = text.replace(/\s+/g, " ").trim() || " ";
  const chars = Array.from(normalizedText);
  const spacingPx = fontSize * 0.08 * Math.min(Math.max(style.circularLetterSpacing || 1, 0.5), 2.5);
  const measuredWidths = chars.map((glyph) => ctx.measureText(glyph).width + spacingPx);
  const totalArcLength = measuredWidths.reduce((sum, width) => sum + width, 0);
  const circumference = 2 * Math.PI * Math.max(1, radius);

  if (totalArcLength > circumference * 0.96) {
    return null;
  }

  return {
    wrappedText: normalizedText,
    lines: [normalizedText],
    fontSize,
    lineHeight: estimateLineHeight(ctx, style, fontSize),
    textWidth: totalArcLength,
    textHeight: radius * 2,
    placements: [],
    shapeKind: normalizedShape?.kind ?? "square",
  };
};

export const wrapAndMeasureHorizontalStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape: TypographyShape | undefined,
  ranges: RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null => {
  const safeWidth = Math.max(1, roiWidth);
  const safeHeight = Math.max(1, roiHeight);
  const normalizedShape = normalizeShape(shape, safeWidth, safeHeight);
  const strictSafeZone = resolveStrictSafeZoneMode(
    normalizedShape,
    safeWidth,
    safeHeight,
  );
  const visualPadding = resolveRenderTextVisualPadding(style, strictSafeZone);
  const innerBox = normalizedShape?.innerBox ?? [0, 0, safeWidth, safeHeight];
  const innerWidth = Math.max(
    1,
    innerBox[2] - innerBox[0] - visualPadding.left - visualPadding.right,
  );
  const innerHeight = Math.max(
    1,
    innerBox[3] - innerBox[1] - visualPadding.top - visualPadding.bottom,
  );
  const fallbackLineHeight = estimateLineHeight(ctx, style, fontSize);
  const maxLines = Math.max(1, Math.floor(innerHeight / Math.max(1, fallbackLineHeight)));
  const lineWidths = resolveHorizontalLineWidths(
    normalizedShape,
    maxLines,
    innerWidth,
  );
  const styledLines = buildStyledGlyphLines(ctx, text, style, fontSize, ranges);
  const placements: RenderTextLinePlacement[] = [];
  let overflowed = false;

  const pushLine = (glyphs: StyledGlyph[], lineIndex: number) => {
    if (enforceBounds && lineIndex >= maxLines) {
      overflowed = true;
      return;
    }
    const availableWidth = lineWidths[Math.min(lineWidths.length - 1, lineIndex)] ?? innerWidth;
    const measuredWidth = glyphs.reduce((sum, glyph) => sum + glyph.measuredWidth, 0);
    if (enforceBounds && strictSafeZone && measuredWidth > availableWidth) {
      overflowed = true;
      return;
    }
    placements.push({
      text: glyphs.map((glyph) => glyph.text).join(""),
      x:
        innerBox[0]
        + visualPadding.left
        + Math.max(0, (innerWidth - availableWidth) / 2),
      y: 0,
      measuredWidth,
      availableWidth,
      lineHeight: Math.max(
        fallbackLineHeight,
        ...glyphs.map((glyph) => glyph.lineHeight),
      ),
      segments: compressGlyphSegments(ctx, glyphs),
    });
  };

  styledLines.forEach((paragraphGlyphs) => {
    if (overflowed) return;
    if (paragraphGlyphs.length === 0) {
      pushLine([
        {
          text: " ",
          style,
          measuredWidth: ctx.measureText(" ").width,
          lineHeight: fallbackLineHeight,
        },
      ], placements.length);
      return;
    }

    const words: StyledGlyph[][] = [];
    let currentWord: StyledGlyph[] = [];
    paragraphGlyphs.forEach((glyph) => {
      if (/\s/u.test(glyph.text)) {
        if (currentWord.length > 0) {
          words.push(currentWord);
          currentWord = [];
        }
        return;
      }
      currentWord.push(glyph);
    });
    if (currentWord.length > 0) {
      words.push(currentWord);
    }
    if (words.length === 0) {
      pushLine([
        {
          text: " ",
          style,
          measuredWidth: ctx.measureText(" ").width,
          lineHeight: fallbackLineHeight,
        },
      ], placements.length);
      return;
    }

    let lineGlyphs: StyledGlyph[] = [];
    words.forEach((wordGlyphs) => {
      if (overflowed) return;
      let pendingWord = [...wordGlyphs];
      while (pendingWord.length > 0) {
        if (overflowed) break;
        const lineIndex = placements.length;
        const availableWidth =
          lineWidths[Math.min(lineWidths.length - 1, lineIndex)] ?? innerWidth;
        const hasLineContent = lineGlyphs.length > 0;
        const leadingStyle = pendingWord[0]?.style ?? style;
        ctx.font = buildCanvasFont(leadingStyle, leadingStyle.fontSize);
        const spaceGlyph: StyledGlyph = {
          text: " ",
          style: leadingStyle,
          measuredWidth: hasLineContent ? ctx.measureText(" ").width : 0,
          lineHeight: estimateLineHeight(
            ctx,
            leadingStyle,
            leadingStyle.fontSize,
          ),
        };
        const wordWidth = pendingWord.reduce(
          (sum, glyph) => sum + glyph.measuredWidth,
          0,
        );
        const candidateWidth =
          lineGlyphs.reduce((sum, glyph) => sum + glyph.measuredWidth, 0)
          + spaceGlyph.measuredWidth
          + wordWidth;

        if (candidateWidth <= availableWidth) {
          if (spaceGlyph.measuredWidth > 0) {
            lineGlyphs.push(spaceGlyph);
          }
          lineGlyphs.push(...pendingWord);
          pendingWord = [];
          continue;
        }

        if (lineGlyphs.length > 0) {
          pushLine(lineGlyphs, placements.length);
          lineGlyphs = [];
          continue;
        }

        const splitGlyphs: StyledGlyph[] = [];
        let splitWidth = 0;
        pendingWord.forEach((glyph) => {
          if (splitWidth + glyph.measuredWidth <= availableWidth || splitGlyphs.length === 0) {
            splitGlyphs.push(glyph);
            splitWidth += glyph.measuredWidth;
          }
        });

        const consumedLength = splitGlyphs.length > 0 ? splitGlyphs.length : 1;
        pushLine(
          splitGlyphs.length > 0 ? splitGlyphs : [pendingWord[0]!],
          placements.length,
        );
        pendingWord = pendingWord.slice(consumedLength);
      }
    });

    if (lineGlyphs.length > 0) {
      pushLine(lineGlyphs, placements.length);
    }
  });

  if (overflowed || placements.length === 0) {
    return null;
  }

  let cursorY = visualPadding.top;
  placements.forEach((placement) => {
    placement.y = cursorY;
    cursorY += placement.lineHeight ?? fallbackLineHeight;
  });

  const textWidth =
    Math.max(...placements.map((placement) => placement.measuredWidth))
    + visualPadding.left
    + visualPadding.right;
  const textHeight = cursorY + visualPadding.bottom;

  return {
    wrappedText: placements.map((placement) => placement.text).join("\n"),
    lines: placements.map((placement) => placement.text),
    fontSize,
    lineHeight: Math.max(...placements.map((placement) => placement.lineHeight ?? fallbackLineHeight)),
    textWidth,
    textHeight,
    placements,
    shapeKind: normalizedShape?.kind ?? "square",
  };
};

export const wrapAndMeasureVerticalStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  _roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  ranges: RenderTextStyleRange[],
): RenderTextLayout | null => {
  const fallbackLineHeight = estimateLineHeight(ctx, style, fontSize);
  const safeHeight = Math.max(1, roiHeight);
  const maxRows = Math.max(1, Math.floor(safeHeight / Math.max(1, fallbackLineHeight)));
  const paragraphs = buildStyledGlyphLines(ctx, text, style, fontSize, ranges);
  const columns: RenderTextLinePlacement[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const source = paragraph.length > 0 ? paragraph : [{
      text: " ",
      style,
      measuredWidth: ctx.measureText(" ").width,
      lineHeight: fallbackLineHeight,
    }];
    for (let offset = 0; offset < source.length; offset += maxRows) {
      const glyphs = source.slice(offset, offset + maxRows);
      const measuredWidth = Math.max(...glyphs.map((glyph) => glyph.measuredWidth));
      columns.push({
        text: glyphs.map((glyph) => glyph.text).join(""),
        x: 0,
        y: 0,
        measuredWidth,
        availableWidth: measuredWidth,
        lineHeight: Math.max(
          fallbackLineHeight,
          ...glyphs.map((glyph) => glyph.lineHeight),
        ),
        segments: glyphs.map((glyph) => ({
          text: glyph.text,
          style: glyph.style,
          measuredWidth: glyph.measuredWidth,
        })),
      });
    }
    if (paragraphIndex < paragraphs.length - 1) {
      columns.push({
        text: " ",
        x: 0,
        y: 0,
        measuredWidth: ctx.measureText(" ").width,
        availableWidth: ctx.measureText(" ").width,
        lineHeight: fallbackLineHeight,
        segments: [{
          text: " ",
          style,
          measuredWidth: ctx.measureText(" ").width,
        }],
      });
    }
  });

  if (columns.length === 0) {
    return null;
  }

  let cursorX = 0;
  columns.forEach((column) => {
    column.x = cursorX + (column.measuredWidth / 2);
    cursorX += column.measuredWidth;
  });

  return {
    wrappedText: columns.map((column) => column.text).join("\n"),
    lines: columns.map((column) => column.text),
    fontSize,
    lineHeight: fallbackLineHeight,
    textWidth: cursorX,
    textHeight:
      Math.max(
        ...columns.map((column) => (column.segments?.length ?? 1) * fallbackLineHeight),
      ),
    placements: columns,
    shapeKind: "square",
  };
};

export const wrapAndMeasureCircularStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape: TypographyShape | undefined,
  ranges: RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null => {
  const safeWidth = Math.max(1, roiWidth);
  const safeHeight = Math.max(1, roiHeight);
  const outlineWidth = Math.max(0, style.outlineWidth || 0);
  const normalizedShape = normalizeShape(shape, safeWidth, safeHeight);
  const innerBox = normalizedShape?.innerBox ?? [0, 0, safeWidth, safeHeight];
  const innerWidth = Math.max(1, innerBox[2] - innerBox[0] - (outlineWidth * 2));
  const innerHeight = Math.max(1, innerBox[3] - innerBox[1] - (outlineWidth * 2));
  const radius = (Math.min(innerWidth, innerHeight) / 2) * Math.min(Math.max(style.circularRadiusScale || 0.78, 0.2), 1.2);
  const glyphs = buildStyledGlyphLines(
    ctx,
    text.replace(/\s+/g, " ").trim() || " ",
    style,
    fontSize,
    ranges,
  )[0] ?? [];
  if (glyphs.length === 0) {
    return null;
  }
  const spacingPx = fontSize * 0.08 * Math.min(Math.max(style.circularLetterSpacing || 1, 0.5), 2.5);
  const segments = glyphs.map((glyph) => ({
    text: glyph.text,
    style: glyph.style,
    measuredWidth: glyph.measuredWidth + spacingPx,
  }));
  const totalArcLength = segments.reduce((sum, segment) => sum + segment.measuredWidth, 0);
  const circumference = 2 * Math.PI * Math.max(1, radius);
  if (enforceBounds && totalArcLength > circumference * 0.96) {
    return null;
  }

  return {
    wrappedText: segments.map((segment) => segment.text).join(""),
    lines: [segments.map((segment) => segment.text).join("")],
    fontSize,
    lineHeight: Math.max(...glyphs.map((glyph) => glyph.lineHeight)),
    textWidth: totalArcLength,
    textHeight: radius * 2,
    placements: [{
      text: segments.map((segment) => segment.text).join(""),
      x: 0,
      y: 0,
      measuredWidth: totalArcLength,
      availableWidth: totalArcLength,
      lineHeight: Math.max(...glyphs.map((glyph) => glyph.lineHeight)),
      segments,
    }],
    shapeKind: normalizedShape?.kind ?? "square",
  };
};

export const wrapAndMeasureStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape: TypographyShape | undefined,
  ranges: RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null => {
  const pathMode = normalizeTextPathMode(style.textPathMode);
  const orientation = normalizeTextOrientation(style.textOrientation);
  if (pathMode === "circular") {
    return wrapAndMeasureCircularStyled(
      ctx,
      text,
      roiWidth,
      roiHeight,
      style,
      fontSize,
      shape,
      ranges,
      enforceBounds,
    );
  }
  if (orientation === "vertical") {
    return wrapAndMeasureVerticalStyled(
      ctx,
      text,
      roiWidth,
      roiHeight,
      style,
      fontSize,
      ranges,
    );
  }
  return wrapAndMeasureHorizontalStyled(
    ctx,
    text,
    roiWidth,
    roiHeight,
    style,
    fontSize,
    shape,
    ranges,
    enforceBounds,
  );
};

export const wrapAndMeasure = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
  ranges?: RenderTextStyleRange[],
  styledAllowOverflow = false,
): RenderTextLayout | null => {
  if (ranges?.length) {
    return wrapAndMeasureStyled(
      ctx,
      text,
      roiWidth,
      roiHeight,
      style,
      fontSize,
      shape,
      ranges,
      !styledAllowOverflow,
    );
  }
  ctx.font = buildCanvasFont(style, fontSize);
  const orientation = normalizeTextOrientation(style.textOrientation);
  const pathMode = normalizeTextPathMode(style.textPathMode);
  if (pathMode === "circular") {
    return wrapAndMeasureCircular(ctx, text, roiWidth, roiHeight, style, fontSize, shape);
  }
  if (orientation === "vertical") {
    return wrapAndMeasureVertical(ctx, text, roiWidth, roiHeight, style, fontSize);
  }
  return wrapAndMeasureHorizontal(ctx, text, roiWidth, roiHeight, style, fontSize, shape);
};

export const computeRenderTextLayout = (
  ctx: CanvasRenderingContext2D,
  textInput: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  shape?: TypographyShape,
  ranges?: RenderTextStyleRange[],
): RenderTextLayout => {
  const textInputNormalized = style.uppercase ? textInput.toUpperCase() : textInput;
  const text = normalizeText(textInputNormalized);
  const safeText = text.length > 0 ? text : " ";
  const strictSafeZone = resolveStrictSafeZoneMode(shape, roiWidth, roiHeight);
  const targetHeight = Math.max(1, roiHeight);
  const autoFontSize = style.autoFontSize !== false;

  // Inferred bounds from shape/ROI dimensions
  const inferredBounds = inferAutoFontBounds(roiWidth, targetHeight, style, shape);

  // User-configured min/max (always respected as constraints)
  const userMinFontSize = strictSafeZone
    ? 1
    : Math.max(6, Math.floor(style.minFontSize || 10));
  const userMaxFontSize = Math.max(userMinFontSize, Math.floor(style.fontSize || 40));

  // Merge: shape-inferred bounds constrained by user-configured min/max
  const minFontSize = strictSafeZone
    ? 1
    : Math.max(inferredBounds.minFontSize, userMinFontSize);
  const maxFontSize = Math.max(minFontSize, Math.min(inferredBounds.maxFontSize, userMaxFontSize));

  if (!autoFontSize) {
    const fixedFontSize = Math.min(Math.max(Math.floor(style.fontSize || userMaxFontSize), minFontSize), maxFontSize);
    if (ranges?.length) {
      return wrapAndMeasure(
        ctx,
        safeText,
        roiWidth,
        targetHeight,
        style,
        fixedFontSize,
        shape,
        ranges,
      )
        ?? wrapAndMeasure(
          ctx,
          safeText,
          roiWidth,
          targetHeight,
          style,
          minFontSize,
          shape,
          ranges,
          true,
        )
        ?? wrapAndMeasure(
          ctx,
          safeText,
          roiWidth,
          targetHeight,
          style,
          8,
          shape,
          ranges,
          true,
        )!;
    }
    return wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, fixedFontSize, shape)
      ?? wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, minFontSize)
      ?? wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, 8)!;
  }

  let bestLayout: RenderTextLayout | null = null;
  let lo = minFontSize;
  let hi = maxFontSize;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, mid, shape, ranges);
    const fits = candidate !== null
      && candidate.textWidth <= roiWidth
      && candidate.textHeight <= targetHeight;
    if (candidate && fits) {
      bestLayout = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestLayout) {
    return bestLayout;
  }

  if (strictSafeZone) {
    const strictFallback = wrapAndMeasure(
      ctx,
      safeText,
      roiWidth,
      targetHeight,
      style,
      1,
      shape,
      ranges,
    );
    if (strictFallback) {
      return strictFallback;
    }
  }

  if (ranges?.length) {
    return wrapAndMeasure(
      ctx,
      safeText,
      roiWidth,
      targetHeight,
      style,
      minFontSize,
      shape,
      ranges,
      true,
    )
      ?? wrapAndMeasure(
        ctx,
        safeText,
        roiWidth,
        targetHeight,
        style,
        8,
        shape,
        ranges,
        true,
      )!;
  }

  return wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, minFontSize, shape)
    ?? wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, minFontSize)
    ?? wrapAndMeasure(ctx, safeText, roiWidth, targetHeight, style, 8)!;
};
