import type {
  RenderTextStyle,
  RenderTextStyleRange,
} from "@/typography/renderStyle";
import type { TypographyShape } from "@/typography/types";
import type { RenderTextLayout } from "@/utils/renderText.types";
import {
  inferAutoFontBounds,
  normalizeShape,
  normalizeTextOrientation,
  normalizeTextPathMode,
} from "@/utils/renderText.core";
import { measureHorizontalText } from "@/utils/renderText.measure.horizontal";
import {
  measureCircularText,
  measureVerticalText,
} from "@/utils/renderText.measure.paths";

export class RenderTextLayoutError extends Error {
  readonly code = "TEXT_DOES_NOT_FIT";

  constructor() {
    super("Text does not fit the configured geometry and font constraints.");
    this.name = "RenderTextLayoutError";
  }
}

export const wrapAndMeasureHorizontal = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
): RenderTextLayout | null =>
  measureHorizontalText(
    ctx,
    text,
    roiWidth,
    roiHeight,
    style,
    fontSize,
    shape,
  );

export const wrapAndMeasureVertical = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
): RenderTextLayout | null =>
  measureVerticalText(ctx, text, roiWidth, roiHeight, style, fontSize);

export const wrapAndMeasureCircular = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
): RenderTextLayout | null =>
  measureCircularText(ctx, text, roiWidth, roiHeight, style, fontSize, shape);

export const wrapAndMeasureHorizontalStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape: TypographyShape | undefined,
  ranges: readonly RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null =>
  measureHorizontalText(
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

export const wrapAndMeasureVerticalStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  ranges: readonly RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null =>
  measureVerticalText(
    ctx,
    text,
    roiWidth,
    roiHeight,
    style,
    fontSize,
    undefined,
    ranges,
    enforceBounds,
  );

export const wrapAndMeasureCircularStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape: TypographyShape | undefined,
  ranges: readonly RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null =>
  measureCircularText(
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

export const wrapAndMeasure = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape?: TypographyShape,
  ranges?: readonly RenderTextStyleRange[],
  styledAllowOverflow = false,
): RenderTextLayout | null => {
  const measure =
    normalizeTextPathMode(style.textPathMode) === "circular"
      ? measureCircularText
      : normalizeTextOrientation(style.textOrientation) === "vertical"
        ? measureVerticalText
        : measureHorizontalText;

  return measure(
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
};

export const wrapAndMeasureStyled = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  fontSize: number,
  shape: TypographyShape | undefined,
  ranges: readonly RenderTextStyleRange[],
  enforceBounds = true,
): RenderTextLayout | null =>
  wrapAndMeasure(
    ctx,
    text,
    roiWidth,
    roiHeight,
    style,
    fontSize,
    shape,
    ranges,
    !enforceBounds,
  );

export const computeRenderTextLayout = (
  ctx: CanvasRenderingContext2D,
  text: string,
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  shape?: TypographyShape,
  ranges?: readonly RenderTextStyleRange[],
): RenderTextLayout => {
  const constraints = { fontSize: style.fontSize, minFontSize: style.minFontSize };
  if (
    !Number.isFinite(constraints.fontSize) ||
    constraints.fontSize <= 0 ||
    !Number.isFinite(constraints.minFontSize) ||
    constraints.minFontSize <= 0
  ) {
    throw new Error("Invalid font constraints.");
  }

  if (constraints.minFontSize > constraints.fontSize) {
    throw new RangeError("Minimum font size exceeds maximum font size.");
  }

  const normalizedShape = normalizeShape(shape, roiWidth, roiHeight);
  const resolvedShape = normalizedShape ?? undefined;

  const measure = (fontSize: number): RenderTextLayout | null =>
    wrapAndMeasure(
      ctx,
      text,
      roiWidth,
      roiHeight,
      style,
      fontSize,
      resolvedShape,
      ranges,
    );

  if (style.autoFontSize === false) {
    const fixed = measure(constraints.fontSize);
    if (!fixed) throw new RenderTextLayoutError();
    return fixed;
  }

  const inferred = inferAutoFontBounds(
    roiWidth,
    roiHeight,
    style,
    normalizedShape,
  );
  const minimum = constraints.minFontSize;
  const maximum = Math.min(
    constraints.fontSize,
    Math.max(minimum, inferred.maxFontSize),
  );

  // Perfil geométrico e tamanhos inline absolutos não garantem monotonicidade.
  const maximumCandidate = measure(maximum);
  if (maximumCandidate) return maximumCandidate;

  for (
    let fontSize = Math.ceil(maximum) - 1;
    fontSize >= Math.ceil(minimum);
    fontSize -= 1
  ) {
    const candidate = measure(fontSize);
    if (candidate) return candidate;
  }

  if (!Number.isInteger(minimum) && minimum !== maximum) {
    const minimumCandidate = measure(minimum);
    if (minimumCandidate) return minimumCandidate;
  }

  throw new RenderTextLayoutError();
};
