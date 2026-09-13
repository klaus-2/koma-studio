// Region model pipeline for RenderTextPreview: regions -> display regions
// (with render defaults + translation-note overlays) and the shared
// updateRegions mutator. Moved verbatim from RenderTextPreview.tsx (T07 split);
// hook order preserved.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AioTextRegion, TranslationNoteOverlayConfig } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  TRANSLATION_NOTE_REGION_PREFIX,
} from '../../../constants/dashboard.constants';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  buildTranslationNoteOverlayRegions,
  cloneRenderStyle,
  normalizeTranslationNotes,
} from '../../../utils/dashboard.utils';
import { cloneRenderTextStyleRanges } from '../../../utils/renderTextStyleRanges';

interface UseRenderTextPreviewRegionModelParams {
  regions: AioTextRegion[];
  fallbackStyle: RenderTextStyle;
  imageWidth: number;
  imageHeight: number;
  translationNotesEnabled: boolean;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
}

export const useRenderTextPreviewRegionModel = ({
  regions,
  fallbackStyle,
  imageWidth,
  imageHeight,
  translationNotesEnabled,
  onRegionsChange,
}: UseRenderTextPreviewRegionModelParams) => {
  const regionsWithDefaultsRef = useRef<AioTextRegion[]>([]);

  const regionsWithDefaults = useMemo(
    () =>
      regions.map((region) =>
        applyRenderDefaultsToRegion(
          region,
          fallbackStyle,
          applyDetectedGradientToStyle,
        ),
      ),
    [fallbackStyle, regions],
  );
  useEffect(() => {
    regionsWithDefaultsRef.current = regionsWithDefaults;
  });
  const noteOverlayRegions = useMemo(
    () =>
      buildTranslationNoteOverlayRegions(
        regionsWithDefaults,
        imageWidth,
        imageHeight,
        fallbackStyle,
        translationNotesEnabled,
      ),
    [
      fallbackStyle,
      imageHeight,
      imageWidth,
      regionsWithDefaults,
      translationNotesEnabled,
    ],
  );
  const displayRegionsWithDefaults = useMemo(
    () => [...regionsWithDefaults, ...noteOverlayRegions],
    [noteOverlayRegions, regionsWithDefaults],
  );
  const regionsWithDefaultsById = useMemo(() => {
    const next = new Map<string, AioTextRegion>();
    regionsWithDefaults.forEach((region) => {
      next.set(region.id, region);
    });
    return next;
  }, [regionsWithDefaults]);
  const displayRegionById = useMemo(() => {
    const next = new Map<string, AioTextRegion>();
    displayRegionsWithDefaults.forEach((region) => {
      next.set(region.id, region);
    });
    return next;
  }, [displayRegionsWithDefaults]);
  const getTranslationNoteOverlayParentId = useCallback(
    (regionId: string): string | null =>
      regionId.startsWith(TRANSLATION_NOTE_REGION_PREFIX)
        ? regionId.slice(TRANSLATION_NOTE_REGION_PREFIX.length)
        : null,
    [],
  );
  const resolveTranslationNoteOverlayConfig = useCallback(
    (region: AioTextRegion): TranslationNoteOverlayConfig | null => {
      const notes = normalizeTranslationNotes(region.translationNotes);
      if (!notes || notes.length === 0) return null;
      if (region.translationNoteOverlay) {
        return {
          bbox: [...region.translationNoteOverlay.bbox] as [
            number,
            number,
            number,
            number,
          ],
          renderText: region.translationNoteOverlay.renderText,
          renderStyle: region.translationNoteOverlay.renderStyle
            ? cloneRenderStyle(region.translationNoteOverlay.renderStyle)
            : undefined,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            region.translationNoteOverlay.renderTextStyleRanges,
          ),
        };
      }
      const defaultOverlay = buildTranslationNoteOverlayRegions(
        [
          applyRenderDefaultsToRegion(
            region,
            fallbackStyle,
            applyDetectedGradientToStyle,
          ),
        ],
        imageWidth,
        imageHeight,
        fallbackStyle,
        true,
      )[0];
      if (!defaultOverlay) return null;
      return {
        bbox: [...defaultOverlay.bbox] as [number, number, number, number],
        renderText: defaultOverlay.renderText ?? '',
        renderStyle: defaultOverlay.renderStyle
          ? cloneRenderStyle(defaultOverlay.renderStyle)
          : undefined,
        renderTextStyleRanges: cloneRenderTextStyleRanges(
          defaultOverlay.renderTextStyleRanges,
        ),
      };
    },
    [fallbackStyle, imageHeight, imageWidth],
  );

  const updateRegions = useCallback(
    (updater: (region: AioTextRegion) => AioTextRegion) => {
      onRegionsChange(regionsWithDefaultsRef.current.map(updater));
    },
    [onRegionsChange],
  );

  return {
    regionsWithDefaults,
    regionsWithDefaultsRef,
    noteOverlayRegions,
    displayRegionsWithDefaults,
    regionsWithDefaultsById,
    displayRegionById,
    getTranslationNoteOverlayParentId,
    resolveTranslationNoteOverlayConfig,
    updateRegions,
  };
};
