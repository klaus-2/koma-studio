// Skin-agnostic model for the compare-review overlay: store reads, the shared
// transform for both panes, Ctrl+wheel zoom (same store value + gesture math
// as the stage), pointer pan, the maskPolygon collection and the canvas paint
// step through `renderRegionsToCanvas` — the exact render-stage code path.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

import { useI18n } from '../../../i18n';
import type {
  AioTextRegion,
  ComparePanOffset,
  CompareReviewView,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { TypographyPoint } from '../../../typography/types';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  buildTranslationNoteOverlayRegions,
} from '../../../utils/dashboard.utils';
import { renderRegionsToCanvas } from '../render-text-preview/canvasDrawing';
import { useRafWheelZoom } from '../../../hooks/useRafWheelZoom';
import {
  applyZoomSteps,
  zoomStepsFromWheelDeltas,
} from '../../../pages/dashboard/hooks/useStageWheelZoom';
import {
  ensureDirectPageUrl,
  resolveImagePreviewSrc,
} from '../../../pages/dashboard/hooks/image-collection';
import { useStatusStore } from '../../../pages/dashboard/stores/status-store';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';
import { useImageCollectionStore } from '../../../pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '../../../pages/dashboard/stores/region-editor-store';
import { useLlmProvidersStore } from '../../../pages/dashboard/stores/llm-providers-store';

const EMPTY_COMPARE_REGIONS: AioTextRegion[] = [];

interface PanDragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export interface UseCompareReviewModelParams {
  /** Wheel-zoom target: the element wrapping BOTH panes (one listener syncs both). */
  panesRef: RefObject<HTMLDivElement | null>;
}

/** One region's cleaning-mask polygon, mapped into image-pixel coordinates. */
export interface CompareMaskPolygon {
  regionId: string;
  points: TypographyPoint[];
}

export interface CompareReviewModel {
  /** Page under review (active page in the collection), or null when none. */
  image: LoadedImage | null;
  originalSrc: string | null;
  /** Base image the render stage shows behind the text canvas (cleaned page). */
  previewSrc: string | null;
  /** Left-pane view: exactly the store's three-way toggle value. */
  leftView: CompareReviewView;
  /** Right-pane view: rendered, unless the left pane already shows it. */
  rightView: CompareReviewView;
  zoom: number;
  panOffset: ComparePanOffset;
  /** One transform string applied identically to both panes — exact sync. */
  paneTransform: string;
  /** Vector cleaning-mask polygons (image-pixel coordinates). */
  maskPolygons: CompareMaskPolygon[];
  renderCanvasRef: RefObject<HTMLCanvasElement | null>;
  setViewMode: (view: CompareReviewView) => void;
  beginPan: (event: ReactPointerEvent<HTMLElement>) => void;
  movePan: (event: ReactPointerEvent<HTMLElement>) => void;
  endPan: (event: ReactPointerEvent<HTMLElement>) => void;
}

export const useCompareReviewModel = ({
  panesRef,
}: UseCompareReviewModelParams): CompareReviewModel => {
  const { t } = useI18n();
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const image = useMemo(
    () => images.find((img) => img.id === activeId) ?? images[0] ?? null,
    [activeId, images],
  );

  const mode = useUiShellStore((s) => s.mode);
  const zoom = useUiShellStore((s) => s.zoom);
  const panOffset = useUiShellStore((s) => s.comparePanOffset);
  const viewMode = useUiShellStore((s) => s.compareReviewView);
  const setZoom = useUiShellStore((s) => s.setZoom);
  const setPanOffset = useUiShellStore((s) => s.setComparePanOffset);
  const setCompareReviewView = useUiShellStore((s) => s.setCompareReviewView);

  const imageId = image?.id ?? null;
  const regions = useRegionEditorStore((s) =>
    imageId === null ? EMPTY_COMPARE_REGIONS : s.aioDetectionsByImage[imageId],
  );
  const fallbackStyle = useRegionEditorStore((s) => s.renderDefaultStyle);
  const translationNotesEnabled = useLlmProvidersStore(
    (s) => s.llmSettings.translation_notes_enabled,
  );

  const regionsList = regions ?? EMPTY_COMPARE_REGIONS;

  // Same region prep as the render stage's region model: render defaults
  // filled, then translation-note overlay regions appended to the display list.
  const regionsWithDefaults = useMemo(
    () =>
      regionsList.map((region) =>
        applyRenderDefaultsToRegion(
          region,
          fallbackStyle,
          applyDetectedGradientToStyle,
        ),
      ),
    [fallbackStyle, regionsList],
  );
  const displayRegions = useMemo(() => {
    const noteOverlayRegions = buildTranslationNoteOverlayRegions(
      regionsWithDefaults,
      image?.width ?? 0,
      image?.height ?? 0,
      fallbackStyle,
      translationNotesEnabled,
    );
    return [...regionsWithDefaults, ...noteOverlayRegions];
  }, [
    fallbackStyle,
    image?.height,
    image?.width,
    regionsWithDefaults,
    translationNotesEnabled,
  ]);

  // maskPolygon points are region-relative (same space as shape.innerBox —
  // see region-review.ts), so each polygon is offset by its region bbox
  // origin to render over the page image.
  const maskPolygons = useMemo(
    (): CompareMaskPolygon[] => {
      const polygons: CompareMaskPolygon[] = [];
      for (const region of regionsWithDefaults) {
        const polygon = region.shape?.maskPolygon;
        if (!polygon || polygon.length === 0) continue;
        const [x1, y1, x2, y2] = region.bbox;
        const originX = Math.min(x1, x2);
        const originY = Math.min(y1, y2);
        const points: TypographyPoint[] = polygon.map((point) => {
          const shifted: TypographyPoint = [
            point[0] + originX,
            point[1] + originY,
          ];
          return shifted;
        });
        polygons.push({ regionId: region.id, points });
      }
      return polygons;
    },
    [regionsWithDefaults],
  );

  const originalSrc = useMemo(
    () => (image ? ensureDirectPageUrl(image) || image.thumbnailUrl || null : null),
    [image],
  );

  const previewSrc = useMemo(
    () => (image ? resolveImagePreviewSrc(image, mode) : null),
    [image, mode],
  );

  const leftView = viewMode;
  const rightView: CompareReviewView =
    viewMode === 'rendered' ? 'original' : 'rendered';

  const paneTransform = `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`;

  // Ctrl+wheel zoom — same store value and step formula as the stage zoom.
  const flushWheelZoom = useCallback(
    (deltas: readonly number[]): void => {
      setZoom((previous) =>
        applyZoomSteps(previous, zoomStepsFromWheelDeltas(deltas)),
      );
    },
    [setZoom],
  );
  const resolveWheelTarget = useCallback(() => panesRef.current, [panesRef]);
  useRafWheelZoom(resolveWheelTarget, flushWheelZoom, null);

  const panDragRef = useRef<PanDragState | null>(null);
  const beginPan = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (event.button !== 0) return;
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: panOffset.x,
        originY: panOffset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [panOffset.x, panOffset.y],
  );
  const movePan = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const drag = panDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      setPanOffset({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
    },
    [setPanOffset],
  );
  const endPan = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (panDragRef.current?.pointerId !== event.pointerId) return;
      panDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  // Same paint protocol as the render stage's preview canvas: one rAF-gated
  // renderRegionsToCanvas call (fonts preloaded inside, layouts LRU-shared).
  // leftView is a dependency because the canvas element remounts into the
  // other pane when the toggle crosses the rendered view. Paint failures are
  // surfaced through the status store — a rejected layout or a missing 2D
  // context must never degrade into a silently blank pane.
  const renderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    const paint = async (): Promise<void> => {
      const canvas = renderCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setStatusMessage(t('dashboard.compareReview.paintFailed'));
        return;
      }
      try {
        await renderRegionsToCanvas(ctx, {
          imageWidth: image.width,
          imageHeight: image.height,
          regions: displayRegions,
          fallbackStyle,
          renderStageActive: true,
          skipRegionId: null,
          isCancelled: () => cancelled,
        });
      } catch (error) {
        console.warn('compare review paint failed', error);
        setStatusMessage(t('dashboard.compareReview.paintFailed'));
      }
    };
    const frame = requestAnimationFrame(() => {
      void paint();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [displayRegions, fallbackStyle, image, leftView, setStatusMessage, t]);

  return {
    image,
    originalSrc,
    previewSrc,
    leftView,
    rightView,
    zoom,
    panOffset,
    paneTransform,
    maskPolygons,
    renderCanvasRef,
    setViewMode: setCompareReviewView,
    beginPan,
    movePan,
    endPan,
  };
};
