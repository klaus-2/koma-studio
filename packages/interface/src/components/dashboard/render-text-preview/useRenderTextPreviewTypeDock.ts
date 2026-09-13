// Type dock behavior for RenderTextPreview: dock visibility tracking,
// selected-region style/shape mutation with inline-selection patch support,
// and the dock anchor placement solver. Moved verbatim from
// RenderTextPreview.tsx (T07 split); hook order preserved.

import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import type { AioTextRegion, LoadedImage } from '../../../types/dashboard.types';
import type {
  TypographyShape,
  TypographyShapeKind,
} from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  areDockAnchorsEqual,
  clamp,
  cloneRenderStyle,
  normalizeRenderRotation,
  rebuildRegionShapeForKind,
  resolveRegionShapeKind,
} from '../../../utils/dashboard.utils';
import { createDefaultTypographyShape } from '../../../typography/types';
import { buildInlineSelectionStylePatch } from '../../../utils/inlineEditor';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

export interface RenderTextPreviewDockAnchor {
  x: number;
  y: number;
  placement: 'right' | 'left' | 'top' | 'bottom';
}

interface UseRenderTextPreviewTypeDockParams {
  showRenderDock: boolean;
  dockAnchor: RenderTextPreviewDockAnchor | null;
  setDockAnchor: React.Dispatch<
    React.SetStateAction<RenderTextPreviewDockAnchor | null>
  >;
  dockRef: React.RefObject<HTMLDivElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  dockSizeRevision: number;
  setDockSizeRevision: React.Dispatch<React.SetStateAction<number>>;
  dockExpanded: boolean;
  isCompactViewport: boolean;
  selectedRegion: AioTextRegion | null;
  selectedRegionId: string | null;
  selectedRegionStyle: RenderTextStyle;
  selectedRegionIsNoteOverlay: boolean;
  selectedInlineSelectionActive: boolean;
  inlineEditor: RenderTextPreviewInlineEditorState | null;
  image: LoadedImage;
  fallbackStyle: RenderTextStyle;
  savedSelectionRef: React.RefObject<{ start: number; end: number } | null>;
  restoreInlineEditorSelection: () => void;
  updateRegionStyle: (
    regionId: string,
    updater: (style: RenderTextStyle) => RenderTextStyle,
  ) => void;
  updateRegionTextStyleRanges: (
    regionId: string,
    start: number,
    end: number,
    patch: Partial<RenderTextStyle>,
  ) => void;
  updateRegions: (updater: (region: AioTextRegion) => AioTextRegion) => void;
}

export const useRenderTextPreviewTypeDock = ({
  showRenderDock,
  dockAnchor,
  setDockAnchor,
  dockRef,
  overlayRef,
  dockSizeRevision,
  setDockSizeRevision,
  dockExpanded,
  isCompactViewport,
  selectedRegion,
  selectedRegionId,
  selectedRegionStyle,
  selectedRegionIsNoteOverlay,
  selectedInlineSelectionActive,
  inlineEditor,
  image,
  fallbackStyle,
  savedSelectionRef,
  restoreInlineEditorSelection,
  updateRegionStyle,
  updateRegionTextStyleRanges,
  updateRegions,
}: UseRenderTextPreviewTypeDockParams) => {
  useEffect(() => {
    if (!showRenderDock || !dockAnchor) return;
    const node = dockRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setDockSizeRevision((value) => value + 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [dockAnchor, showRenderDock]);

  const [dockVisible, setDockVisible] = useState(true);

  useEffect(() => {
    if (!showRenderDock || !dockAnchor) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const updateDockVisibility = () => {
      const rect = overlay.getBoundingClientRect();
      const dockHeight = dockRef.current?.offsetHeight ?? 120;
      const dockBottom = rect.top + dockAnchor.y + dockHeight;
      const dockTop = rect.top + dockAnchor.y;
      const cardBottom = rect.bottom;
      const cardTop = rect.top;
      const dockWithinCard = dockTop >= cardTop && dockBottom <= cardBottom;
      const cardInViewport = cardTop < window.innerHeight && cardBottom > 0;
      setDockVisible(dockWithinCard && cardInViewport);
    };

    const stageEl = overlay.closest('.koma-stage');
    if (stageEl) {
      stageEl.addEventListener('scroll', updateDockVisibility, { passive: true });
      window.addEventListener('resize', updateDockVisibility);
      updateDockVisibility();
    }
    return () => {
      if (stageEl) stageEl.removeEventListener('scroll', updateDockVisibility);
      window.removeEventListener('resize', updateDockVisibility);
    };
  }, [showRenderDock, dockAnchor, dockSizeRevision]);

  const updateSelectedRegionStyle = useCallback(
    (updater: (style: RenderTextStyle) => RenderTextStyle) => {
      if (!selectedRegionId) return;

      const hasInlineSelection = selectedInlineSelectionActive
        && inlineEditor
        && selectedRegion
        && inlineEditor.regionId === selectedRegionId;


      // Check if we have a saved selection from before the popover opened
      const saved = savedSelectionRef.current;
      const hasSavedSelection = saved
        && saved.start !== saved.end
        && inlineEditor
        && selectedRegion
        && inlineEditor.regionId === selectedRegionId;

      if (hasInlineSelection || hasSavedSelection) {
        const selectionStart = hasInlineSelection
          ? inlineEditor.selectionStart
          : saved!.start;
        const selectionEnd = hasInlineSelection
          ? inlineEditor.selectionEnd
          : saved!.end;

        // CRITICAL: Use the ORIGINAL style (not selectedRegionStyle which may already be modified)
        // to compute the diff correctly
        const selectionPatch = buildInlineSelectionStylePatch(
          selectedRegionStyle,
          updater,
        );
        if (selectionPatch) {
          updateRegionTextStyleRanges(
            selectedRegionId,
            selectionStart,
            selectionEnd,
            selectionPatch,
          );
          restoreInlineEditorSelection();
          return;
        }
      }
      updateRegionStyle(selectedRegionId, updater);
    },
    [
      inlineEditor,
      restoreInlineEditorSelection,
      selectedInlineSelectionActive,
      selectedRegion,
      selectedRegionId,
      selectedRegionStyle,
      updateRegionStyle,
      updateRegionTextStyleRanges,
    ],
  );

  const updateSelectedRegionShapeKind = useCallback(
    (kind: TypographyShapeKind) => {
      if (!selectedRegion || !selectedRegionId || selectedRegionIsNoteOverlay)
        return;
      const [x1, y1, x2, y2] = selectedRegion.bbox;
      updateRegions((region) =>
        region.id === selectedRegionId
          ? {
              ...region,
              shape: createDefaultTypographyShape(
                x2 - x1,
                y2 - y1,
                kind,
                'converted',
              ),
            }
          : region,
      );
    },
    [
      selectedRegion,
      selectedRegionId,
      selectedRegionIsNoteOverlay,
      updateRegions,
    ],
  );

  const normalizeSelectedRegionShape = useCallback(
    (
      options: {
        kind?: TypographyShapeKind;
        centerText?: boolean;
        source?: TypographyShape['source'];
      } = {},
    ) => {
      if (!selectedRegion || !selectedRegionId || selectedRegionIsNoteOverlay)
        return;
      const shapeKind = options.kind ?? resolveRegionShapeKind(selectedRegion);
      updateRegions((region) => {
        if (region.id !== selectedRegionId) return region;
        const nextRegion = rebuildRegionShapeForKind(
          region,
          shapeKind,
          options.source ?? 'converted',
        );
        if (options.centerText) {
          return {
            ...nextRegion,
            renderStyle: {
              ...cloneRenderStyle(nextRegion.renderStyle ?? fallbackStyle),
              alignment: 'center',
            },
          };
        }
        return nextRegion;
      });
    },
    [
      selectedRegion,
      selectedRegionId,
      selectedRegionIsNoteOverlay,
      updateRegions,
    ],
  );

  const adjustSelectedFontSize = useCallback(
    (delta: number) => {
      updateSelectedRegionStyle((style) => {
        const nextFontSize = clamp(Math.round(style.fontSize + delta), 8, 160);
        return {
          ...style,
          fontSize: nextFontSize,
          minFontSize: clamp(Math.round(style.minFontSize), 6, nextFontSize),
        };
      });
    },
    [updateSelectedRegionStyle],
  );

  const adjustSelectedRotation = useCallback(
    (deltaDegrees: number) => {
      updateSelectedRegionStyle((style) => ({
        ...style,
        rotation: normalizeRenderRotation((style.rotation || 0) + deltaDegrees),
      }));
    },
    [updateSelectedRegionStyle],
  );

  useEffect(() => {
    if (!showRenderDock || !selectedRegion) {
      setDockAnchor((current) => (current === null ? current : null));
      return;
    }
    const overlay = overlayRef.current;
    if (!overlay) {
      setDockAnchor((current) => (current === null ? current : null));
      return;
    }
    const width = overlay.clientWidth;
    const height = overlay.clientHeight;
    if (width <= 0 || height <= 0) {
      setDockAnchor((current) => (current === null ? current : null));
      return;
    }

    const margin = 8;
    const gap = 12;
    const estimatedDockWidth = isCompactViewport
      ? 272
      : dockExpanded
        ? 500
        : 430;
    const estimatedDockHeight = isCompactViewport
      ? dockExpanded
        ? 206
        : 148
      : dockExpanded
        ? 186
        : 114;
    const measuredDockWidth = dockRef.current?.offsetWidth ?? 0;
    const measuredDockHeight = dockRef.current?.offsetHeight ?? 0;
    const dockWidth =
      measuredDockWidth > 0 ? measuredDockWidth : estimatedDockWidth;
    const dockHeight =
      measuredDockHeight > 0 ? measuredDockHeight : estimatedDockHeight;

    const [x1, y1, x2, y2] = selectedRegion.bbox;
    const left = (x1 / image.width) * width;
    const right = (x2 / image.width) * width;
    const top = (y1 / image.height) * height;
    const bottom = (y2 / image.height) * height;
    const boxCenterX = (left + right) / 2;
    const boxCenterY = (top + bottom) / 2;

    const blockedRect = {
      left: left - gap,
      right: right + gap,
      top: top - gap,
      bottom: bottom + gap,
    };

    const minVisible = 14;

    // On desktop the tools panel sits immediately to the right of the
    // overlay, so the dock must not overflow past the overlay width.
    // On compact/mobile the tools panel is a fixed overlay — full
    // freedom to the right.
    const maxDockRightEdge = isCompactViewport
      ? width + dockWidth - minVisible
      : width;

    const isInsidePlacementEnvelope = (x: number, y: number): boolean =>
      x >= -dockWidth + minVisible &&
      y >= -dockHeight + minVisible &&
      x + dockWidth <= maxDockRightEdge &&
      y + dockHeight <= height + minVisible;

    const overlapsSelection = (x: number, y: number): boolean => {
      const dockLeft = x;
      const dockRight = x + dockWidth;
      const dockTop = y;
      const dockBottom = y + dockHeight;
      return !(
        dockRight <= blockedRect.left ||
        dockLeft >= blockedRect.right ||
        dockBottom <= blockedRect.top ||
        dockTop >= blockedRect.bottom
      );
    };

    // Clamp helpers — keep the dock within the safe area.
    const clampX = (x: number): number =>
      Math.max(-dockWidth + minVisible, Math.min(x, maxDockRightEdge - dockWidth));
    const clampY = (y: number): number =>
      Math.max(margin, Math.min(y, Math.max(margin, height - dockHeight)));

    const candidatePool: Array<{
      x: number;
      y: number;
      placement: 'right' | 'left' | 'top' | 'bottom';
    }> = [
      {
        placement: 'right',
        x: right + gap,
        y: boxCenterY - dockHeight / 2,
      },
      {
        placement: 'left',
        x: left - dockWidth - gap,
        y: boxCenterY - dockHeight / 2,
      },
      {
        placement: 'top',
        x: boxCenterX - dockWidth / 2,
        y: top - dockHeight - gap,
      },
      {
        placement: 'bottom',
        x: boxCenterX - dockWidth / 2,
        y: bottom + gap,
      },
    ];

    const orderedCandidates = isCompactViewport
      ? [candidatePool[3], candidatePool[2], candidatePool[0], candidatePool[1]]
      : [
          candidatePool[0],
          candidatePool[1],
          candidatePool[2],
          candidatePool[3],
        ];

    const safeCandidate = orderedCandidates.find(
      (candidate) =>
        candidate &&
        isInsidePlacementEnvelope(clampX(candidate.x), clampY(candidate.y)) &&
        !overlapsSelection(clampX(candidate.x), clampY(candidate.y)),
    );
    if (safeCandidate) {
      const nextAnchor = {
        x: clampX(safeCandidate.x),
        y: clampY(safeCandidate.y),
        placement: safeCandidate.placement,
      };
      setDockAnchor((current) =>
        areDockAnchorsEqual(current, nextAnchor) ? current : nextAnchor,
      );
      return;
    }

    const corners: Array<{
      x: number;
      y: number;
      placement: 'top' | 'bottom';
    }> = [
      { x: margin, y: margin, placement: 'top' },
      {
        x: Math.max(margin, Math.min(width - dockWidth - margin, maxDockRightEdge - dockWidth)),
        y: margin,
        placement: 'top',
      },
      {
        x: margin,
        y: Math.max(margin, height - dockHeight - margin),
        placement: 'bottom',
      },
      {
        x: Math.max(margin, Math.min(width - dockWidth - margin, maxDockRightEdge - dockWidth)),
        y: Math.max(margin, height - dockHeight - margin),
        placement: 'bottom',
      },
    ];
    const safeCorner = corners.find(
      (candidate) =>
        isInsidePlacementEnvelope(candidate.x, candidate.y) &&
        !overlapsSelection(candidate.x, candidate.y),
    );
    if (safeCorner) {
      setDockAnchor((current) =>
        areDockAnchorsEqual(current, safeCorner) ? current : safeCorner,
      );
      return;
    }

    setDockAnchor((current) => (current === null ? current : null));
  }, [
    dockExpanded,
    dockSizeRevision,
    image.height,
    image.width,
    isCompactViewport,
    selectedRegion,
    showRenderDock,
  ]);

  return {
    updateSelectedRegionStyle,
    updateSelectedRegionShapeKind,
    normalizeSelectedRegionShape,
    adjustSelectedFontSize,
    adjustSelectedRotation,
    dockVisible,
  };
};
