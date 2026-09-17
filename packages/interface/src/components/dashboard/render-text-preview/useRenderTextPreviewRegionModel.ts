import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AioTextRegion, TranslationNoteOverlayConfig } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  TRANSLATION_NOTE_REGION_PREFIX,
} from '../../../constants/dashboard.constants';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  areAioRegionsEqual,
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

const reuseIfSameElements = (
  prev: AioTextRegion[],
  next: AioTextRegion[],
): AioTextRegion[] => {
  if (prev.length === next.length) {
    let same = true;
    for (let index = 0; index < next.length; index += 1) {
      if (prev[index] !== next[index]) {
        same = false;
        break;
      }
    }
    if (same) return prev;
  }
  return next;
};

interface RegionsWithDefaultsCache {
  bySource: WeakMap<AioTextRegion, AioTextRegion>;
  prevById: Map<string, { source: AioTextRegion; derived: AioTextRegion }>;
}

const regionsWithDefaultsCaches = new WeakMap<
  RenderTextStyle,
  RegionsWithDefaultsCache
>();

export const useRenderTextPreviewRegionModel = ({
  regions,
  fallbackStyle,
  imageWidth,
  imageHeight,
  translationNotesEnabled,
  onRegionsChange,
}: UseRenderTextPreviewRegionModelParams) => {
  const regionsWithDefaultsRef = useRef<AioTextRegion[]>([]);
  const regionsWithDefaultsPrevRef = useRef<AioTextRegion[]>([]);

  const regionsWithDefaults = useMemo(() => {
    let cache = regionsWithDefaultsCaches.get(fallbackStyle);
    if (!cache) {
      cache = { bySource: new WeakMap(), prevById: new Map() };
      regionsWithDefaultsCaches.set(fallbackStyle, cache);
    }
    const { bySource, prevById } = cache;
    const next = regions.map((region) => {
      const cached = bySource.get(region);
      if (cached) return cached;
      const prev = prevById.get(region.id);
      if (prev && areAioRegionsEqual([prev.source], [region], cloneRenderStyle)) {
        bySource.set(region, prev.derived);
        return prev.derived;
      }
      const derived = applyRenderDefaultsToRegion(
        region,
        fallbackStyle,
        applyDetectedGradientToStyle,
      );
      bySource.set(region, derived);
      return derived;
    });
    prevById.clear();
    for (let index = 0; index < regions.length; index += 1) {
      const region = regions[index];
      const derived = next[index];
      if (region && derived) prevById.set(region.id, { source: region, derived });
    }
    return reuseIfSameElements(regionsWithDefaultsPrevRef.current, next);
  }, [fallbackStyle, regions]);
  useEffect(() => {
    regionsWithDefaultsRef.current = regionsWithDefaults;
    regionsWithDefaultsPrevRef.current = regionsWithDefaults;
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
