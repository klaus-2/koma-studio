// Marquee selection layer: mounted as a sibling of the region boxes
// inside the shared region overlay. Reads the active tool from the
// typographer store itself (no tool prop threads through the previews) and
// intercepts pointer events with stopPropagation so the region pointer
// handlers never fire while the marquee tool is active. On release it writes
// the intersecting regions — in region array order — to the per-image
// multi-selection map; a marquee that intersects nothing clears the map.
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';

import { useImageCollectionStore } from '../../../pages/dashboard/stores/image-collection-store';
import { useTypographerStore } from '../../../pages/dashboard/stores/typographer-store';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';
import { clamp } from '../../../utils/dashboard.utils';
import type { AioTextRegion } from '../../../types/dashboard.types';
import { regionsIntersectingRect, type MarqueeRect } from './marqueeSelection';

interface MarqueeSelectionLayerProps {
  regions: readonly AioTextRegion[];
  imageWidth: number;
  imageHeight: number;
  areaSelectionEnabled: boolean;
  /** Owning image id — the multi-selection is written per image. */
  marqueeImageId: string | null;
}

interface ImageSpacePoint {
  x: number;
  y: number;
}

export default function MarqueeSelectionLayer({
  regions,
  imageWidth,
  imageHeight,
  areaSelectionEnabled,
  marqueeImageId,
}: MarqueeSelectionLayerProps): ReactElement | null {
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const setTypographerMultiSelectedByImage = useTypographerStore(
    (s) => s.setTypographerMultiSelectedByImage,
  );
  // The marquee belongs to the typesetter stage only: in other modes the
  // global tool leaks across stages (the stage items enable area selection
  // independently), so the layer must not mount outside 'typesetter' — it
  // would silently swallow every stage pointer interaction.
  const dashboardMode = useUiShellStore((s) => s.mode);
  // The overlay rect maps to the image with the stage's rotation applied
  // (same mapping the pointer hook uses); the layer mirrors it so the
  // marquee rectangle lands in image space like the region bboxes.
  const imageRotation = useImageCollectionStore((s) => {
    if (marqueeImageId === null) return 0;
    return s.images.find((image) => image.id === marqueeImageId)?.rotation ?? 0;
  });

  const layerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<ImageSpacePoint | null>(null);
  const [dragRect, setDragRect] = useState<MarqueeRect | null>(null);

  const toImageSpace = useCallback(
    (clientX: number, clientY: number): ImageSpacePoint | null => {
      const node = layerRef.current;
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const normalizedX = clamp((clientX - rect.left) / rect.width, 0, 1);
      const normalizedY = clamp((clientY - rect.top) / rect.height, 0, 1);
      const rotation = ((imageRotation % 360) + 360) % 360;
      let localX = normalizedX;
      let localY = normalizedY;
      if (rotation === 90) {
        localX = 1 - normalizedY;
        localY = normalizedX;
      } else if (rotation === 180) {
        localX = 1 - normalizedX;
        localY = 1 - normalizedY;
      } else if (rotation === 270) {
        localX = normalizedY;
        localY = 1 - normalizedX;
      }
      return { x: localX * imageWidth, y: localY * imageHeight };
    },
    [imageHeight, imageRotation, imageWidth],
  );

  const writeSelection = useCallback(
    (rect: MarqueeRect): void => {
      if (marqueeImageId === null) return;
      const hits = regionsIntersectingRect(regions, rect);
      setTypographerMultiSelectedByImage((prev) => {
        if (hits.length === 0) {
          const { [marqueeImageId]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [marqueeImageId]: hits.map((region) => region.id) };
      });
    },
    [marqueeImageId, regions, setTypographerMultiSelectedByImage],
  );

  if (
    typographerSelectionTool !== 'marquee' ||
    !areaSelectionEnabled ||
    marqueeImageId === null ||
    dashboardMode !== 'typesetter'
  ) {
    return null;
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const point = toImageSpace(event.clientX, event.clientY);
    if (!point) return;
    dragStartRef.current = point;
    setDragRect({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = dragStartRef.current;
    if (!start) return;
    event.stopPropagation();
    const point = toImageSpace(event.clientX, event.clientY);
    if (!point) return;
    setDragRect({ x1: start.x, y1: start.y, x2: point.x, y2: point.y });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = dragStartRef.current;
    if (!start) return;
    event.stopPropagation();
    dragStartRef.current = null;
    const point = toImageSpace(event.clientX, event.clientY);
    const rect = point
      ? { x1: start.x, y1: start.y, x2: point.x, y2: point.y }
      : null;
    setDragRect(null);
    if (rect) writeSelection(rect);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragStartRef.current) return;
    event.stopPropagation();
    // Gesture aborted: discard the uncommitted rectangle without writing.
    dragStartRef.current = null;
    setDragRect(null);
  };

  const rectLeft = dragRect
    ? (Math.min(dragRect.x1, dragRect.x2) / Math.max(1, imageWidth)) * 100
    : 0;
  const rectTop = dragRect
    ? (Math.min(dragRect.y1, dragRect.y2) / Math.max(1, imageHeight)) * 100
    : 0;
  const rectWidth = dragRect
    ? (Math.abs(dragRect.x2 - dragRect.x1) / Math.max(1, imageWidth)) * 100
    : 0;
  const rectHeight = dragRect
    ? (Math.abs(dragRect.y2 - dragRect.y1) / Math.max(1, imageHeight)) * 100
    : 0;

  return (
    <div
      ref={layerRef}
      data-testid="marquee-selection-layer"
      style={{
        position: 'absolute',
        inset: 0,
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {dragRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${rectLeft}%`,
            top: `${rectTop}%`,
            width: `${rectWidth}%`,
            height: `${rectHeight}%`,
            border: '1px dashed rgba(234, 179, 8, 0.95)',
            background: 'rgba(234, 179, 8, 0.12)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
