import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { createRegionTextMeasurer } from '../../../components/dashboard/render-text-preview/canvasDrawing';
import {
  deriveOverflowIssues,
  fitRegionFontSize,
  type RegionIssue,
} from '../../../utils/region-review';
import { applyRenderDefaultsToRegion } from '../../../utils/dashboard.region.utils';
import { applyDetectedGradientToStyle } from '../../../utils/dashboard.rendering.utils';
import type { AioTextRegion } from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useStatusStore } from '../stores/status-store';

interface RegionOverflowReviewApi {
  /** Overflow issues across all loaded images (render-layout derived). */
  readonly overflowIssues: RegionIssue[];
  /** Overflow issue count per image id (only images with issues). */
  readonly overflowCountByImageId: ReadonlyMap<string, number>;
  /** Bounded auto-fit for one overflowing region (per-region action). */
  readonly adjustRegion: (issue: RegionIssue) => void;
  /** Bounded auto-fit for every overflowing region of one page. */
  readonly adjustPage: (imageId: string) => void;
}

/**
 * Render-stage overflow review (Feature 5): derives overflowing balloons
 * from the region-editor store through the preview's own layout resolution
 * (LRU-cached — repeated derivation hits the shared layout cache), and
 * applies bounded font-size adjustments through the EXISTING authoritative
 * region map setter (the same store-update path the sheet reimport uses —
 * fresh state read via getState, clone-on-write for untouched regions).
 *
 * Regions still overflowing at minFontSize are never shrunk below the
 * bound; they stay flagged in the issues panel and are reported via the
 * status message. Regions with autoFontSize enabled are already searched
 * down to the bound by the layout engine itself, so an overflowing auto-font
 * region is reported at-bound without a style change.
 */
export const useRegionOverflowReview = (): RegionOverflowReviewApi => {
  const { t } = useI18n();
  const images = useImageCollectionStore((s) => s.images);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const measure = useMemo(
    () => createRegionTextMeasurer(renderDefaultStyle),
    [renderDefaultStyle],
  );

  const overflowIssues = useMemo(
    () =>
      images.flatMap((image) =>
        deriveOverflowIssues(
          image.id,
          aioDetectionsByImage[image.id] ?? [],
          measure,
        ),
      ),
    [images, aioDetectionsByImage, measure],
  );

  const overflowCountByImageId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of overflowIssues) {
      counts.set(issue.imageId, (counts.get(issue.imageId) ?? 0) + 1);
    }
    return counts;
  }, [overflowIssues]);

  const resolveFitForRegion = useCallback(
    (region: AioTextRegion) =>
      fitRegionFontSize(
        applyRenderDefaultsToRegion(
          region,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
        ),
        measure,
      ),
    [measure, renderDefaultStyle],
  );

  // Single clone-on-write pass over the image's region map: adjusted regions
  // get a full render-effective style with the new fontSize (the same
  // per-region style semantics the type dock's style updates use), untouched
  // regions keep their identity so the downstream caches stay warm.
  const applyFontSizeAdjustments = useCallback(
    (
      imageId: string,
      nextSizeByRegionId: ReadonlyMap<string, number>,
    ): boolean => {
      const { aioDetectionsByImage: detectionsByImage, setAioDetectionsByImage } =
        useRegionEditorStore.getState();
      const regions = detectionsByImage[imageId];
      if (!regions) return false;
      let changed = false;
      const nextRegions = regions.map((region): AioTextRegion => {
        const nextSize = nextSizeByRegionId.get(region.id);
        if (nextSize === undefined) return region;
        const effectiveStyle = applyRenderDefaultsToRegion(
          region,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
        ).renderStyle;
        if (!effectiveStyle || effectiveStyle.fontSize === nextSize) {
          return region;
        }
        changed = true;
        return {
          ...region,
          renderStyle: { ...effectiveStyle, fontSize: nextSize },
        };
      });
      if (!changed) return false;
      setAioDetectionsByImage((prev) => ({ ...prev, [imageId]: nextRegions }));
      return true;
    },
    [renderDefaultStyle],
  );

  const adjustRegion = useCallback(
    (issue: RegionIssue): void => {
      if (issue.kind !== 'overflow') return;
      const regions =
        useRegionEditorStore.getState().aioDetectionsByImage[issue.imageId];
      const region = regions?.find((item) => item.id === issue.regionId);
      if (!region) return;
      const fit = resolveFitForRegion(region);
      if (!fit) return;
      if (fit.toFontSize === fit.fromFontSize) {
        setStatusMessage(t('dashboard.aio.review.overflow.atBound'));
        return;
      }
      const applied = applyFontSizeAdjustments(
        issue.imageId,
        new Map([[issue.regionId, fit.toFontSize]]),
      );
      if (!applied) return;
      setStatusMessage(
        fit.status === 'fitted'
          ? t('dashboard.aio.review.overflow.fitted', {
              size: fit.toFontSize,
            })
          : t('dashboard.aio.review.overflow.atBoundApplied', {
              size: fit.toFontSize,
            }),
      );
    },
    [applyFontSizeAdjustments, resolveFitForRegion, setStatusMessage, t],
  );

  const adjustPage = useCallback(
    (imageId: string): void => {
      const regions =
        useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? [];
      const nextSizeByRegionId = new Map<string, number>();
      let fittedCount = 0;
      let remainingCount = 0;
      for (const region of regions) {
        const fit = resolveFitForRegion(region);
        if (!fit) continue;
        if (fit.status === 'fitted') fittedCount += 1;
        else remainingCount += 1;
        if (fit.toFontSize !== fit.fromFontSize) {
          nextSizeByRegionId.set(region.id, fit.toFontSize);
        }
      }
      if (fittedCount === 0 && remainingCount === 0) return;
      applyFontSizeAdjustments(imageId, nextSizeByRegionId);
      setStatusMessage(
        t('dashboard.aio.review.overflow.pageReport', {
          fitted: fittedCount,
          remaining: remainingCount,
        }),
      );
    },
    [applyFontSizeAdjustments, resolveFitForRegion, setStatusMessage, t],
  );

  return {
    overflowIssues,
    overflowCountByImageId,
    adjustRegion,
    adjustPage,
  };
};
