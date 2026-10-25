import type {
  RenderTextAlign,
  RenderTextStyle,
} from "@/typography/renderStyle";
import type {
  TypographyBounds,
  TypographyShape,
} from "@/typography/types";
import { resolveRenderTextVisualPadding } from "@/utils/renderText.core";
import { resolveInnerBoxOffset } from "@/utils/renderText.draw";
import type { RenderTextLayout } from "@/utils/renderText.types";

export interface InlineEditorLayoutFrame {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly paddingTop: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly textAlign: RenderTextAlign;
}

export interface InlineEditorLineBox {
  readonly start: number;
  readonly end: number;
  /** Fractions of the region box (0..1), so the overlay scales with the canvas. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface InlineEditorLayoutFrameInput {
  readonly bbox: TypographyBounds;
  readonly layout: RenderTextLayout;
  readonly style: RenderTextStyle;
  readonly shape?: TypographyShape;
  readonly displayScale: number;
}

const positiveScale = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 1;

/**
 * Places the editable layer over the same layout the canvas draws: shape inset,
 * horizontal alignment and vertically centered text block. The half-leading
 * compensation keeps the first DOM line on the canvas glyph top.
 */
export const resolveInlineEditorLayoutFrame = ({
  bbox,
  layout,
  style,
  shape,
  displayScale,
}: InlineEditorLayoutFrameInput): InlineEditorLayoutFrame => {
  const boxWidth = Math.max(1, bbox[2] - bbox[0]);
  const boxHeight = Math.max(1, bbox[3] - bbox[1]);
  const [innerX1, innerY1, innerX2, innerY2] = resolveInnerBoxOffset(
    [0, 0, boxWidth, boxHeight],
    shape,
  );
  const innerWidth = Math.max(0, innerX2 - innerX1);
  const innerHeight = Math.max(0, innerY2 - innerY1);
  const padding = resolveRenderTextVisualPadding(style, false);
  const maxContentWidth = Math.max(
    1,
    innerWidth - padding.left - padding.right,
  );
  const canvasLineWidth = layout.placements.reduce(
    (minWidth, placement) =>
      placement.text.length > 0
        ? Math.min(minWidth, placement.availableWidth)
        : minWidth,
    Number.POSITIVE_INFINITY,
  );
  const contentWidth = Math.min(
    maxContentWidth,
    Number.isFinite(canvasLineWidth) ? canvasLineWidth : maxContentWidth,
  );
  const contentLeft =
    innerX1
    + padding.left
    + Math.max(0, (maxContentWidth - contentWidth) / 2);
  const verticalGap = Math.max(0, innerHeight - layout.textHeight);
  const halfLeading = Math.max(0, (layout.lineHeight - layout.fontSize) / 2);
  const scale = positiveScale(displayScale);

  return {
    fontSize: layout.fontSize * scale,
    lineHeight: layout.lineHeight * scale,
    paddingTop:
      Math.max(
        0,
        innerY1 + verticalGap / 2 + padding.top - halfLeading,
      ) * scale,
    paddingLeft: contentLeft * scale,
    paddingRight:
      Math.max(0, boxWidth - contentLeft - contentWidth) * scale,
    textAlign: style.alignment,
  };
};

interface InlineEditorLineBoxInput {
  readonly text: string;
  readonly bbox: TypographyBounds;
  readonly layout: RenderTextLayout;
  readonly style: RenderTextStyle;
  readonly shape?: TypographyShape;
}

export const resolveInlineEditorOffsetFromPoint = (
  lines: readonly InlineEditorLineBox[],
  xFraction: number,
  yFraction: number,
  textLength: number,
): number | null => {
  if (lines.length === 0) return null;
  let target = lines[0]!;
  let verticalDistance = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    const lineTop = line.top;
    const lineBottom = line.top + line.height;
    const distance =
      yFraction < lineTop
        ? lineTop - yFraction
        : yFraction > lineBottom
          ? yFraction - lineBottom
          : 0;
    if (distance < verticalDistance) {
      verticalDistance = distance;
      target = line;
    }
  }

  const width = Math.max(1e-6, target.width);
  const horizontal = Math.min(
    1,
    Math.max(0, (xFraction - target.left) / width),
  );
  return Math.max(
    0,
    Math.min(
      textLength,
      target.start
      + Math.round(horizontal * Math.max(0, target.end - target.start)),
    ),
  );
};

export const resolveInlineEditorLineBoxes = ({
  text,
  bbox,
  layout,
  style,
  shape,
}: InlineEditorLineBoxInput): InlineEditorLineBox[] => {
  if (
    style.textOrientation !== "horizontal"
    || style.textPathMode === "circular"
  ) {
    return [];
  }

  const boxWidth = Math.max(1, bbox[2] - bbox[0]);
  const boxHeight = Math.max(1, bbox[3] - bbox[1]);
  const [, innerY1, , innerY2] = resolveInnerBoxOffset(
    [0, 0, boxWidth, boxHeight],
    shape,
  );
  const innerHeight = Math.max(0, innerY2 - innerY1);
  const drawTop =
    innerY1 + Math.max(0, (innerHeight - layout.textHeight) / 2);
  const upper = style.uppercase === true;
  const source = upper ? text.toLocaleUpperCase() : text;
  let cursor = 0;

  return layout.placements.flatMap((placement) => {
    let target = upper
      ? placement.text.toLocaleUpperCase()
      : placement.text;
    let start = target.trim().length > 0
      ? source.indexOf(target, cursor)
      : -1;

    if (start < 0 && target.trim().length > 0) {
      target = target.trim();
      start = source.indexOf(target, cursor);
    }
    if (start < 0 && target.endsWith("-")) {
      target = target.slice(0, -1);
      start = source.indexOf(target, cursor);
    }
    if (start < 0) {
      if (target.trim().length === 0) {
        const newline = text.indexOf("\n", cursor);
        start = newline >= 0 ? newline : Math.min(cursor, text.length);
        cursor = newline >= 0
          ? newline + 1
          : Math.min(text.length, cursor + 1);
        return [];
      }
      start = Math.min(cursor, text.length);
    }

    const end = Math.min(
      text.length,
      start + target.trim().length,
    );
    cursor = end;

    let left = placement.x;
    if (style.alignment === "center") {
      left += (placement.availableWidth - placement.measuredWidth) / 2;
    } else if (style.alignment === "right") {
      left += placement.availableWidth - placement.measuredWidth;
    }

    return [{
      start,
      end,
      left: left / boxWidth,
      top: (drawTop + placement.y) / boxHeight,
      width: placement.measuredWidth / boxWidth,
      height: layout.lineHeight / boxHeight,
    }];
  });
};
