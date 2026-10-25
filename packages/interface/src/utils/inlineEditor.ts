import type { RenderTextStyle } from "@/typography/renderStyle";
import type { RenderTextStyleRange } from "@/typography/renderStyle";
import {
  getInlineStylePatchFromStyleDiff,
  pickInlineRenderTextStylePatch,
  remapRenderTextStyleRangesAfterTextEdit,
  resolveInlineStyleRuns,
} from "@/utils/renderTextStyleRanges";
import { normalizeLineEndings } from "@/utils/renderText.unicode";
import { cloneRenderStyle } from "@/utils/dashboard.utils";
import { isGradientFillValue, parseCssGradientValue } from "@/utils/textFillPicker";

export interface InlineEditorTextSource {
  readonly innerText?: string | null;
  readonly textContent?: string | null;
}

export const normalizeInlineEditorPlainText = normalizeLineEndings;

const INLINE_EDITOR_WORD_CHAR = /[\p{L}\p{N}_'’-]/u;

export const resolveInlineEditorWordRange = (
  text: string,
  offset: number,
): { start: number; end: number } => {
  const safeOffset = Math.max(0, Math.min(text.length, Math.floor(offset)));
  let anchor = Math.min(safeOffset, Math.max(0, text.length - 1));
  if (
    anchor > 0
    && !INLINE_EDITOR_WORD_CHAR.test(text[anchor] ?? "")
    && INLINE_EDITOR_WORD_CHAR.test(text[anchor - 1] ?? "")
  ) {
    anchor -= 1;
  }
  if (!INLINE_EDITOR_WORD_CHAR.test(text[anchor] ?? "")) {
    return { start: safeOffset, end: safeOffset };
  }

  let start = anchor;
  let end = anchor + 1;
  while (start > 0 && INLINE_EDITOR_WORD_CHAR.test(text[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < text.length && INLINE_EDITOR_WORD_CHAR.test(text[end] ?? "")) {
    end += 1;
  }
  return { start, end };
};

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

export const resolveInlineEditorFillColor = (style: RenderTextStyle): string => {
  const fill = (style.fillCssValue ?? "").trim();
  if (!fill) return style.color;
  return isGradientFillValue(fill)
    ? parseCssGradientValue(fill)?.stops[0]?.color ?? style.color
    : fill;
};

const colorWithOpacity = (color: string, opacity: number): string =>
  opacity >= 1
    ? color
    : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;

const cssPx = (value: number): string =>
  `${Math.round(value * 100) / 100}px`;

const resolveShadowColor = (style: RenderTextStyle, fillCssValue: string): string =>
  fillCssValue.trim()
    ? resolveInlineEditorFillColor({
      ...style,
      color: style.shadowColor || "#000000",
      fillCssValue,
    })
    : style.shadowColor || "#000000";

export interface InlineEditorTextPaint {
  readonly color: string;
  readonly textShadow?: string;
  readonly textStroke?: string;
  readonly opacity: number;
}

/** CSS approximation of the canvas fill, outline and shadow layers. */
export const resolveInlineEditorTextPaint = (
  style: RenderTextStyle,
  displayScale = 1,
): InlineEditorTextPaint => {
  const scale =
    Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1;
  const shadowLayers = style.shadowEnabled
    ? (style.shadowLayers?.length
      ? style.shadowLayers
      : [{
        fillCssValue:
          style.shadowFillCssValue || style.shadowColor || "#000000",
        opacity: style.shadowOpacity ?? 1,
        blur: style.shadowBlur ?? 0,
        offsetX: style.shadowOffsetX ?? 0,
        offsetY: style.shadowOffsetY ?? 0,
      }])
    : [];
  const outlineWidth = Math.max(0, style.outlineWidth ?? 0);

  return {
    color: resolveInlineEditorFillColor(style),
    textShadow: shadowLayers.length
      ? shadowLayers.map((layer) => {
        const color = colorWithOpacity(
          resolveShadowColor(style, layer.fillCssValue),
          layer.opacity,
        );
        return `${cssPx(layer.offsetX * 1.35 * scale)} ${cssPx(layer.offsetY * 1.35 * scale)} ${cssPx(Math.max(0, layer.blur) * scale)} ${color}`;
      }).join(", ")
      : undefined,
    textStroke: outlineWidth > 0
      ? `${cssPx(outlineWidth * 2 * scale)} ${colorWithOpacity(
        style.outlineColor || "#ffffff",
        style.outlineOpacity ?? 1,
      )}`
      : undefined,
    opacity: style.opacity,
  };
};

export interface InlineEditorRunAppearance {
  readonly text: string;
  readonly fontFamily: string;
  readonly fontSize?: number;
  readonly fontWeight: "700" | "400";
  readonly fontStyle: "italic" | "normal";
  readonly textDecoration: "underline" | "none";
  readonly textTransform: "uppercase" | "none";
}

/**
 * Splits the hidden editable text into runs so the native selection offsets
 * and caret hit-testing keep the same metrics as the canvas renderer.
 */
export const buildInlineEditorRuns = (
  value: string,
  ranges: readonly RenderTextStyleRange[] | null | undefined,
  baseStyle: RenderTextStyle,
): InlineEditorRunAppearance[] =>
  resolveInlineStyleRuns(value.length, ranges).map((run) => {
    const patch = pickInlineRenderTextStylePatch(run.style);
    const merged = {
      ...baseStyle,
      ...patch,
    };
    return {
      text: value.slice(run.start, run.end),
      fontFamily: merged.fontFamily,
      fontSize: patch.fontSize,
      fontWeight: merged.bold ? "700" : "400",
      fontStyle: merged.italic ? "italic" : "normal",
      textDecoration: merged.underline ? "underline" : "none",
      textTransform: merged.uppercase ? "uppercase" : "none",
    };
  });

export interface InlineEditorDraftRegion {
  readonly id: string;
  readonly renderText?: string;
  readonly renderStyle?: RenderTextStyle;
  readonly renderTextStyleRanges?: RenderTextStyleRange[];
}

export const applyInlineEditorTextDraft = <TRegion extends InlineEditorDraftRegion>(
  regions: readonly TRegion[],
  draft: Readonly<{
    regionId: string;
    value: string;
    styleRanges?: RenderTextStyleRange[];
  }> | null,
): readonly TRegion[] =>
  draft
    ? regions.map((region) =>
      region.id === draft.regionId
        ? {
          ...region,
          renderText: draft.value,
          renderTextStyleRanges: draft.styleRanges,
        }
        : region,
    )
    : regions;

export interface InlineEditorDraftSource {
  readonly regionId: string;
  readonly value: string;
  readonly originalValue: string;
}

/**
 * Draft ranges are derived, never stored: the region's ranges remapped onto
 * the edited text. Identity once the draft was flushed (originalValue equals
 * value and the region already carries the flushed ranges).
 */
export const buildInlineEditorTextDraft = (
  inlineEditor: InlineEditorDraftSource | null,
  regions: readonly InlineEditorDraftRegion[],
  fallbackStyle: RenderTextStyle,
): Readonly<{
  regionId: string;
  value: string;
  styleRanges?: RenderTextStyleRange[];
}> | null => {
  if (!inlineEditor) return null;
  const editedRegion = regions.find(
    (region) => region.id === inlineEditor.regionId,
  );
  const baseStyle = cloneRenderStyle(editedRegion?.renderStyle ?? fallbackStyle);
  return {
    regionId: inlineEditor.regionId,
    value: inlineEditor.value,
    styleRanges: remapRenderTextStyleRangesAfterTextEdit(
      inlineEditor.originalValue,
      inlineEditor.value,
      baseStyle,
      editedRegion?.renderTextStyleRanges,
    ),
  };
};
