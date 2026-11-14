import type { RenderTextStyle } from '../../../utils/renderText';

/** Attributes the style eyedropper (F6) can project onto target regions. */
export type RenderStyleAttribute =
  | 'fontFamily'
  | 'fontSize'
  | 'color'
  | 'outline'
  | 'alignment';

export type StyleApplyScope = 'currentPage' | 'allPages';

export interface ApplyStyleOptions {
  attributes: ReadonlyArray<RenderStyleAttribute>;
  scope: StyleApplyScope;
}

export const ALL_RENDER_STYLE_ATTRIBUTES: readonly RenderStyleAttribute[] = [
  'fontFamily',
  'fontSize',
  'color',
  'outline',
  'alignment',
];

/**
 * Field-projection map for the eyedropper: copies ONLY the checked
 * attributes from the source style onto the target style; every other field
 * keeps the target's value. `fontSize` does not touch `minFontSize` /
 * `autoFontSize`; `color` copies the flat color only (no gradient fields, no
 * `fillCssValue`); `outline` copies color, opacity and width.
 *
 * NOTE: `renderTextStyleRanges` live on the region (not the style) and are
 * threaded separately at the region level by
 * `applyActiveRenderStyleToAllRegions`.
 */
export const projectRenderStyle = (
  source: RenderTextStyle,
  target: RenderTextStyle,
  attributes: ReadonlyArray<RenderStyleAttribute>,
): RenderTextStyle => {
  const next = { ...target };
  for (const attribute of attributes) {
    switch (attribute) {
      case 'fontFamily':
        next.fontFamily = source.fontFamily;
        break;
      case 'fontSize':
        next.fontSize = source.fontSize;
        break;
      case 'color':
        next.color = source.color;
        break;
      case 'outline':
        next.outlineColor = source.outlineColor;
        next.outlineOpacity = source.outlineOpacity;
        next.outlineWidth = source.outlineWidth;
        break;
      case 'alignment':
        next.alignment = source.alignment;
        break;
    }
  }
  return next;
};
