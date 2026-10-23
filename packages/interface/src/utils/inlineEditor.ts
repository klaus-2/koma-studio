import type { RenderTextStyle } from "@/typography/renderStyle";
import type { RenderTextStyleRange } from "@/typography/renderStyle";
import {
  getInlineStylePatchFromStyleDiff,
  pickInlineRenderTextStylePatch,
  resolveInlineStyleRuns,
} from "@/utils/renderTextStyleRanges";
import { normalizeLineEndings } from "@/utils/renderText.unicode";
import { converter, parse as parseColor } from "culori";
import { isGradientFillValue, parseCssGradientValue } from "@/utils/textFillPicker";

export interface InlineEditorTextSource {
  readonly innerText?: string | null;
  readonly textContent?: string | null;
}

export const normalizeInlineEditorPlainText = normalizeLineEndings;

export const readInlineEditorPlainText = (
  source: InlineEditorTextSource,
): string =>
  normalizeInlineEditorPlainText(
    source.innerText ?? source.textContent ?? "",
  );

export const buildInlineSelectionStylePatch = (
  currentStyle: RenderTextStyle,
  updater: (style: RenderTextStyle) => RenderTextStyle,
): Partial<RenderTextStyle> | null => {
  const original = structuredClone(currentStyle);
  const updated = updater(structuredClone(original));

  return getInlineStylePatchFromStyleDiff(
    original,
    structuredClone(updated),
  );
};

export interface InlineEditorTextAppearance {
  readonly color: string;
  readonly textShadow: string;
}

const toRgb = converter("rgb");

const DARK_TEXT_HALO =
  "0 0 3px rgba(255, 255, 255, 0.9), 0 1px 1px rgba(255, 255, 255, 0.55)";
const LIGHT_TEXT_HALO =
  "0 0 2px rgba(0, 0, 0, 0.75), 0 1px 2px rgba(0, 0, 0, 0.6)";
const NEUTRAL_TEXT_SHADOW = "0 1px 2px rgba(0, 0, 0, 0.65)";

const relativeLuminance = (color: string): number | null => {
  const rgb = toRgb(parseColor(color));
  if (!rgb) return null;
  const linear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
  );
};

/**
 * The editor paints the region's text on a dark panel, while the render fills
 * it with `fillCssValue || color` — a bright gradient over a dark `color` is
 * the common case, and using `color` alone made the text disappear. Mirrors
 * the canvas fill rule (gradient reduced to its first stop) and picks a halo
 * from that fill's luminance so any fill stays readable on the panel.
 */
export const resolveInlineEditorTextAppearance = (
  style: RenderTextStyle,
): InlineEditorTextAppearance => {
  const fill = (style.fillCssValue ?? "").trim();
  const color = !fill
    ? style.color
    : isGradientFillValue(fill)
      ? parseCssGradientValue(fill)?.stops[0]?.color ?? style.color
      : fill;

  const luminance = relativeLuminance(color);
  return {
    color,
    textShadow:
      luminance === null
        ? NEUTRAL_TEXT_SHADOW
        : luminance > 0.4
          ? LIGHT_TEXT_HALO
          : DARK_TEXT_HALO,
  };
};

export interface InlineEditorRunAppearance {
  readonly text: string;
  readonly fontFamily: string;
  readonly fontWeight: "700" | "400";
  readonly fontStyle: "italic" | "normal";
  readonly textDecoration: "underline" | "none";
  readonly textTransform: "uppercase" | "none";
  readonly color: string;
  readonly textShadow: string;
}

/**
 * Splits the editor draft into runs so the text inside the contentEditable
 * shows the same per-range formatting the canvas draws.
 */
export const buildInlineEditorRuns = (
  value: string,
  ranges: readonly RenderTextStyleRange[] | null | undefined,
  baseStyle: RenderTextStyle,
): InlineEditorRunAppearance[] =>
  resolveInlineStyleRuns(value.length, ranges).map((run) => {
    const merged = {
      ...baseStyle,
      ...pickInlineRenderTextStylePatch(run.style),
    };
    const appearance = resolveInlineEditorTextAppearance(merged);
    return {
      text: value.slice(run.start, run.end),
      fontFamily: merged.fontFamily,
      fontWeight: merged.bold ? "700" : "400",
      fontStyle: merged.italic ? "italic" : "normal",
      textDecoration: merged.underline ? "underline" : "none",
      textTransform: merged.uppercase ? "uppercase" : "none",
      color: appearance.color,
      textShadow: appearance.textShadow,
    };
  });
