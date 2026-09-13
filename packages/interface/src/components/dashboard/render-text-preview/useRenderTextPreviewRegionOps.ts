// Region mutation callbacks for RenderTextPreview: box/text/skew/rotation/
// style/style-ranges updates that work for both regular regions and
// translation-note overlay parents. Moved verbatim from RenderTextPreview.tsx
// (T07 split); hook order preserved.

import { useCallback } from 'react';
import type {
  AioTextRegion,
  TranslationNoteOverlayConfig,
} from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  clamp,
  cloneRenderStyle,
  normalizeDetectedGradientAngle,
  normalizeRenderRotation,
  normalizeRenderSkew,
  scaleTypographyShapeForBounds,
} from '../../../utils/dashboard.utils';
import { isNativeTextEffectPresetId } from '../../../typography/textEffects';
import {
  applyInlineRenderTextStylePatch,
  remapRenderTextStyleRangesAfterTextEdit,
} from '../../../utils/renderTextStyleRanges';

interface UseRenderTextPreviewRegionOpsParams {
  updateRegions: (updater: (region: AioTextRegion) => AioTextRegion) => void;
  getTranslationNoteOverlayParentId: (regionId: string) => string | null;
  resolveTranslationNoteOverlayConfig: (
    region: AioTextRegion,
  ) => TranslationNoteOverlayConfig | null;
  fallbackStyle: RenderTextStyle;
}

export const useRenderTextPreviewRegionOps = ({
  updateRegions,
  getTranslationNoteOverlayParentId,
  resolveTranslationNoteOverlayConfig,
  fallbackStyle,
}: UseRenderTextPreviewRegionOpsParams) => {
  const updateRegionBox = useCallback(
    (regionId: string, nextBox: [number, number, number, number]) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          return {
            ...region,
            bbox: nextBox,
            shape: scaleTypographyShapeForBounds(
              region.shape,
              region.bbox,
              nextBox,
            ),
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            bbox: nextBox,
          },
        };
      });
    },
    [
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionText = useCallback(
    (regionId: string, nextText: string) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const baseStyle = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderText: nextText,
            renderStyle: baseStyle,
            renderTextStyleRanges: remapRenderTextStyleRangesAfterTextEdit(
              region.renderText ?? '',
              nextText,
              baseStyle,
              region.renderTextStyleRanges,
            ),
            source: region.source ?? 'manual',
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const baseStyle = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderText: nextText,
            renderStyle: baseStyle,
            renderTextStyleRanges: remapRenderTextStyleRangesAfterTextEdit(
              overlay.renderText ?? '',
              nextText,
              baseStyle,
              overlay.renderTextStyleRanges,
            ),
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const setRegionSkew = useCallback(
    (regionId: string, nextSkewX: number, nextSkewY: number) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              skewX: normalizeRenderSkew(nextSkewX),
              skewY: normalizeRenderSkew(nextSkewY),
            },
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const style = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderStyle: {
              ...style,
              skewX: normalizeRenderSkew(nextSkewX),
              skewY: normalizeRenderSkew(nextSkewY),
            },
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const setRegionRotation = useCallback(
    (regionId: string, nextRotation: number) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(nextRotation),
            },
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const style = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(nextRotation),
            },
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionRotation = useCallback(
    (regionId: string, deltaDegrees: number) => {
      if (!Number.isFinite(deltaDegrees) || Math.abs(deltaDegrees) < 0.001)
        return;
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(
                (style.rotation || 0) + deltaDegrees,
              ),
            },
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const style = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(
                (style.rotation || 0) + deltaDegrees,
              ),
            },
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionStyle = useCallback(
    (
      regionId: string,
      updater: (style: RenderTextStyle) => RenderTextStyle,
    ) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId && region.id !== regionId) return region;
        if (parentId && region.id !== parentId) return region;
        const overlay = parentId
          ? resolveTranslationNoteOverlayConfig(region)
          : null;
        const currentStyle = cloneRenderStyle(
          parentId
            ? (overlay?.renderStyle ?? fallbackStyle)
            : (region.renderStyle ?? fallbackStyle),
        );
        const nextStyle = cloneRenderStyle(updater(currentStyle));
        const nextFontSize = Math.max(6, Math.round(nextStyle.fontSize));
        const nextMinFontSize = clamp(
          Math.round(nextStyle.minFontSize),
          6,
          nextFontSize,
        );
        const nextOpacity = clamp(Number(nextStyle.opacity), 0, 1);
        const nextOutlineOpacity = clamp(
          Number(nextStyle.outlineOpacity ?? 1),
          0,
          1,
        );
        const nextShadowOpacity = clamp(
          Number(nextStyle.shadowOpacity ?? 1),
          0,
          1,
        );
        const nextShadowBlur = clamp(Number(nextStyle.shadowBlur), 0, 40);
        const nextShadowOffsetX = clamp(
          Number(nextStyle.shadowOffsetX),
          -40,
          40,
        );
        const nextShadowOffsetY = clamp(
          Number(nextStyle.shadowOffsetY),
          -40,
          40,
        );
        const sanitizedStyle: RenderTextStyle = {
          ...nextStyle,
          fontSize: nextFontSize,
          minFontSize: nextMinFontSize,
          autoFontSize: nextStyle.autoFontSize !== false,
          lineSpacing: clamp(nextStyle.lineSpacing, 0.6, 2.5),
          textOrientation:
            nextStyle.textOrientation === 'vertical'
              ? 'vertical'
              : 'horizontal',
          textPathMode:
            nextStyle.textPathMode === 'circular' ? 'circular' : 'normal',
          circularRadiusScale: clamp(
            Number(nextStyle.circularRadiusScale ?? 0.78),
            0.2,
            1.2,
          ),
          circularStartAngle: normalizeRenderRotation(
            Number(nextStyle.circularStartAngle ?? -90),
          ),
          circularLetterSpacing: clamp(
            Number(nextStyle.circularLetterSpacing ?? 1),
            0.5,
            2.5,
          ),
          outlineWidth: clamp(nextStyle.outlineWidth, 0, 10),
          opacity: Number.isFinite(nextOpacity) ? nextOpacity : 1,
          outlineOpacity: Number.isFinite(nextOutlineOpacity)
            ? nextOutlineOpacity
            : 1,
          shadowEnabled: Boolean(nextStyle.shadowEnabled),
          shadowFillCssValue: nextStyle.shadowFillCssValue
            ? String(nextStyle.shadowFillCssValue).trim()
            : String(nextStyle.shadowColor || '#000000'),
          shadowGradientEnabled: Boolean(nextStyle.shadowGradientEnabled),
          shadowGradientStartColor: String(
            nextStyle.shadowGradientStartColor ||
              nextStyle.shadowColor ||
              '#000000',
          ),
          shadowGradientEndColor: String(
            nextStyle.shadowGradientEndColor ||
              nextStyle.shadowColor ||
              '#000000',
          ),
          shadowGradientAngle: normalizeDetectedGradientAngle(
            nextStyle.shadowGradientAngle ?? 90,
          ),
          shadowOpacity: Number.isFinite(nextShadowOpacity)
            ? nextShadowOpacity
            : 1,
          shadowBlur: Number.isFinite(nextShadowBlur) ? nextShadowBlur : 0,
          shadowOffsetX: Number.isFinite(nextShadowOffsetX)
            ? nextShadowOffsetX
            : 0,
          shadowOffsetY: Number.isFinite(nextShadowOffsetY)
            ? nextShadowOffsetY
            : 0,
          skewX: normalizeRenderSkew(nextStyle.skewX),
          skewY: normalizeRenderSkew(nextStyle.skewY),
          gradientEnabled: Boolean(nextStyle.gradientEnabled),
          gradientStartColor: String(
            nextStyle.gradientStartColor || nextStyle.color || '#111111',
          ),
          gradientEndColor: String(
            nextStyle.gradientEndColor || nextStyle.color || '#111111',
          ),
          gradientAngle: normalizeDetectedGradientAngle(
            nextStyle.gradientAngle,
          ),
          detectGradient: nextStyle.detectGradient !== false,
          textEffectPreset: isNativeTextEffectPresetId(
            nextStyle.textEffectPreset,
          )
            ? nextStyle.textEffectPreset
            : 'none',
          textEffectIntensity: clamp(
            Number(nextStyle.textEffectIntensity ?? 1),
            0,
            2,
          ),
          hyphenationEnabled: nextStyle.hyphenationEnabled === true,
          rotation: normalizeRenderRotation(nextStyle.rotation),
        };
        if (parentId) {
          if (!overlay) return region;
          return {
            ...region,
            translationNoteOverlay: {
              ...overlay,
              renderStyle: sanitizedStyle,
            },
          };
        }
        return {
          ...region,
          renderStyle: sanitizedStyle,
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionTextStyleRanges = useCallback(
    (
      regionId: string,
      start: number,
      end: number,
      patch: Partial<RenderTextStyle>,
    ) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const baseStyle = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderTextStyleRanges: applyInlineRenderTextStylePatch(
              region.renderText ?? '',
              baseStyle,
              region.renderTextStyleRanges,
              start,
              end,
              patch,
            ),
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const baseStyle = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderTextStyleRanges: applyInlineRenderTextStylePatch(
              overlay.renderText ?? '',
              baseStyle,
              overlay.renderTextStyleRanges,
              start,
              end,
              patch,
            ),
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  return {
    updateRegionBox,
    updateRegionText,
    setRegionSkew,
    setRegionRotation,
    updateRegionRotation,
    updateRegionStyle,
    updateRegionTextStyleRanges,
  };
};
