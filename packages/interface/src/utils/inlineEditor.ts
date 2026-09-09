import type { RenderTextStyle } from './renderText.ts';
import { getInlineStylePatchFromStyleDiff } from './renderTextStyleRanges.ts';

const cloneInlineEditorStyle = (style: RenderTextStyle): RenderTextStyle => ({
  ...style,
  shadowLayers: style.shadowLayers?.map((layer) => ({ ...layer })),
});

export interface InlineEditorTextSource {
  innerText?: string | null;
  textContent?: string | null;
}

export const normalizeInlineEditorPlainText = (value: string): string =>
  value.replace(/\r\n/g, '\n');

export const readInlineEditorPlainText = (
  source: InlineEditorTextSource,
): string =>
  normalizeInlineEditorPlainText(source.innerText ?? source.textContent ?? '');

export const buildInlineSelectionStylePatch = (
  currentStyle: RenderTextStyle,
  updater: (style: RenderTextStyle) => RenderTextStyle,
): Partial<RenderTextStyle> | null => {
  const originalStyle = cloneInlineEditorStyle(currentStyle);
  const nextStyle = cloneInlineEditorStyle(updater(originalStyle));
  return getInlineStylePatchFromStyleDiff(originalStyle, nextStyle);
};
