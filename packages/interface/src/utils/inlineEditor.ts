import type { RenderTextStyle } from "@/typography/renderStyle";
import {
  getInlineStylePatchFromStyleDiff,
} from "@/utils/renderTextStyleRanges";
import { normalizeLineEndings } from "@/utils/renderText.unicode";

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
