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
  withCanvasState,
} from "@/utils/renderText.core";
import { getWordBreakOffsets } from "@/utils/renderText.hyphenation";
import { isBreakableWhitespace } from "@/utils/renderText.unicode";
import {
  createMeasuredLayout,
  createMeasurementBox,
  measureGlyphLine,
} from "@/utils/renderText.measure.shared";

interface StyledWord {
  readonly glyphs: readonly StyledGlyph[];
  readonly separator: StyledGlyph | undefined;
}

const tokenizeParagraph = (
  glyphs: readonly StyledGlyph[],
): StyledWord[] => {
  const words: StyledWord[] = [];
  let word: StyledGlyph[] = [];
  let separator: StyledGlyph | undefined;
  let pendingSeparator: StyledGlyph | undefined;

  for (const glyph of glyphs) {
    if (isBreakableWhitespace(glyph.text)) {
      if (word.length > 0) {
        words.push({ glyphs: word, separator });
        word = [];
      }
      pendingSeparator ??= glyph;
      continue;
    }

    if (word.length === 0) {
      separator = pendingSeparator;
      pendingSeparator = undefined;
    }

    word.push(glyph);
  }

  if (word.length > 0) words.push({ glyphs: word, separator });
  return words;
};

export const measureHorizontalText = (
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

    if (enforceBounds && (box.width <= 0 || box.height <= 0)) return null;

    const paragraphs = buildStyledGlyphLines(
      ctx,
      text,
      style,
      fontSize,
      ranges,
    );
    const placements: RenderTextLinePlacement[] = [];
    let cursorY = 0;
    let maximumWidth = 0;

    const fits = (glyphs: readonly StyledGlyph[]): boolean => {
      const measured = measureGlyphLine(
        ctx,
        glyphs,
        box.fallbackLineHeight,
      );

      return (
        measured.measuredWidth <=
          box.widthAt(cursorY, measured.lineHeight) &&
        (!enforceBounds || cursorY + measured.lineHeight <= box.height)
      );
    };

    const pushLine = (glyphs: readonly StyledGlyph[]): boolean => {
      const measured = measureGlyphLine(
        ctx,
        glyphs,
        box.fallbackLineHeight,
      );
      const availableWidth = box.widthAt(cursorY, measured.lineHeight);

      if (
        enforceBounds &&
        (measured.measuredWidth > availableWidth ||
          cursorY + measured.lineHeight > box.height)
      ) {
        return false;
      }

      placements.push({
        ...measured,
        x: box.x + Math.max(0, (box.width - availableWidth) / 2),
        y: box.y + cursorY,
        availableWidth,
      });

      cursorY += measured.lineHeight;
      maximumWidth = Math.max(maximumWidth, measured.measuredWidth);
      return true;
    };

    const splitWord = (
      leading: readonly StyledGlyph[],
      word: readonly StyledGlyph[],
    ): Readonly<{
      head: StyledGlyph[];
      tail: StyledGlyph[];
    }> | null => {
      const token = word.map((glyph) => glyph.text).join("");
      const boundaryIndexes = new Map<number, number>();
      let offset = 0;

      word.forEach((glyph, index) => {
        offset += glyph.text.length;
        boundaryIndexes.set(offset, index + 1);
      });

      for (const boundary of getWordBreakOffsets(
        token,
        style.hyphenationLanguage,
      )) {
        const index = boundaryIndexes.get(boundary);
        if (index === undefined || index >= word.length) continue;

        const lastGlyph = word[index - 1];
        if (!lastGlyph) continue;

        const hyphen = measureStyledGlyph(ctx, "-", lastGlyph.style);
        const head = [...leading, ...word.slice(0, index), hyphen];

        if (fits(head)) {
          return { head, tail: word.slice(index) };
        }
      }

      return null;
    };

    for (const paragraph of paragraphs) {
      const words = tokenizeParagraph(paragraph);
      let line: StyledGlyph[] = [];

      if (words.length === 0) {
        if (!pushLine([])) return null;
        continue;
      }

      for (const word of words) {
        let pending = word.glyphs;
        let separator = word.separator;

        while (pending.length > 0) {
          const gap =
            line.length > 0 && separator
              ? [measureStyledGlyph(ctx, " ", separator.style)]
              : [];
          const leading = [...line, ...gap];
          const candidate = [...leading, ...pending];

          if (fits(candidate)) {
            line = candidate;
            break;
          }

          const split =
            style.hyphenationEnabled === true
              ? splitWord(leading, pending)
              : null;

          if (split) {
            if (!pushLine(split.head)) return null;
            line = [];
            pending = split.tail;
            separator = undefined;
            continue;
          }

          if (line.length > 0) {
            if (!pushLine(line)) return null;
            line = [];
            separator = undefined;
            continue;
          }

          if (enforceBounds) return null;
          if (!pushLine(pending)) return null;
          pending = [];
        }
      }

      if (line.length > 0 && !pushLine(line)) return null;
    }

    return createMeasuredLayout(
      placements,
      fontSize,
      maximumWidth + box.paddingX,
      cursorY + box.paddingY,
      box,
    );
  });
