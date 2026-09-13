import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_RENDER_STYLE } from '../../constants/dashboard.constants';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  RegionCorner,
  SegmentEditTool,
  ViewMode,
} from '../../types/dashboard.types';
import type { TypographyShapeKind } from '../../typography/types';
import type { RenderTextStyle } from '../../utils/renderText';
import {
  clamp,
  cloneRenderStyle,
  normalizeRenderRotation,
  normalizeRenderSkew,
} from '../../utils/dashboard.utils';
import { useTextDetectionPreviewBehaviors } from './text-detection-preview/TextDetectionPreview.behaviors';
import TextDetectionPreviewView from './text-detection-preview/TextDetectionPreview.view';

export interface TextDetectionPreviewProps {
  label: string;
  image: LoadedImage;
  previewSrc: string;
  zoom: number;
  viewMode: ViewMode;
  active: boolean;
  regions: AioTextRegion[];
  selectedRegionId: string | null;
  onCardSelect: () => void;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  editable: boolean;
  selectionEnabled: boolean;
  creationEnabled: boolean;
  newRegionShapeKind: TypographyShapeKind;
  segmentEditEnabled: boolean;
  segmentEditTool: SegmentEditTool;
  segmentBrushSize: number;
  segmentBrushDataUrl?: string | null;
  onSegmentBrushChange?: (dataUrl: string | null) => void;
  stageBadgeKey: AioPipelineSnapshotKey;
  stageBadgeLabel: string;
  canRewind: boolean;
  canForward: boolean;
  onRewind: () => void;
  onForward: () => void;
  historyHint: string | null;
  translationNotesEnabled: boolean;
  fallbackStyle?: RenderTextStyle;
}

export type TextDetectionPreviewController = ReturnType<
  typeof useTextDetectionPreviewBehaviors
> & {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  imgElemW: number;
  imgElemH: number;
  canvasWrapW: number;
  canvasWrapH: number;
  isBrushCursorActive: boolean;
};

export const useTextDetectionPreviewController = (
  {
    image,
    zoom,
    viewMode,
    regions,
    selectedRegionId,
    onCardSelect,
    onSelectRegion,
    onRegionsChange,
    editable,
    selectionEnabled,
    creationEnabled,
    newRegionShapeKind,
    segmentEditEnabled,
    segmentEditTool,
    segmentBrushSize,
    segmentBrushDataUrl = null,
    onSegmentBrushChange,
    translationNotesEnabled,
    fallbackStyle = DEFAULT_RENDER_STYLE,
  }: TextDetectionPreviewProps,
): TextDetectionPreviewController => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const segBrushCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segBrushLastRef = useRef<{ x: number; y: number } | null>(null);
  const brushCursorRef = useRef<HTMLDivElement | null>(null);
  const regionsRef = useRef(regions);
  useEffect(() => {
    regionsRef.current = regions;
  });

  const imageMaxWidth = viewMode === 'paginated' ? 420 : 960;
  const isRotationSwapped = image.rotation === 90 || image.rotation === 270;
  const rotationScaleFactor = isRotationSwapped
    ? image.height > imageMaxWidth ? imageMaxWidth / image.height : 1
    : image.width > imageMaxWidth ? imageMaxWidth / image.width : 1;
  const imgElemW = image.width * rotationScaleFactor;
  const imgElemH = image.height * rotationScaleFactor;
  const canvasWrapW = isRotationSwapped ? imgElemH : imgElemW;
  const canvasWrapH = isRotationSwapped ? imgElemW : imgElemH;
  const isBrushCursorActive =
    segmentEditEnabled &&
    editable &&
    (segmentEditTool === 'brush' || segmentEditTool === 'eraser');

  const regionById = useMemo(() => {
    const next = new Map<string, AioTextRegion>();
    regions.forEach((region) => next.set(region.id, region));
    return next;
  }, [regions]);

  const updateBrushCursor = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const cursor = brushCursorRef.current;
      if (!cursor) return;
      const diameter = segmentBrushSize * rotationScaleFactor * zoom;
      const radius = diameter / 2;
      if (cursor.dataset.size !== String(diameter)) {
        cursor.style.width = `${diameter}px`;
        cursor.style.height = `${diameter}px`;
        cursor.dataset.size = String(diameter);
      }
      cursor.style.transform = `translate(${e.clientX - radius}px, ${e.clientY - radius}px)`;
      cursor.style.display = 'block';
    },
    [brushCursorRef, rotationScaleFactor, segmentBrushSize, zoom],
  );

  const hideBrushCursor = useCallback(() => {
    if (brushCursorRef.current) brushCursorRef.current.style.display = 'none';
  }, [brushCursorRef]);

  const toImagePoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = overlayRef.current;
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const normalizedX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const rotation = ((image.rotation % 360) + 360) % 360;
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
      const isSideways = rotation === 90 || rotation === 270;
      const scaleX = isSideways
        ? image.width / rect.height
        : image.width / rect.width;
      const scaleY = isSideways
        ? image.height / rect.width
        : image.height / rect.height;
      return {
        x: localX * image.width,
        y: localY * image.height,
        scale: Math.max(scaleX, scaleY),
      };
    },
    [image.height, image.rotation, image.width],
  );

  const drawSegBrushOnCanvas = useCallback(
    (x: number, y: number, radius: number, erase: boolean) => {
      const canvas = segBrushCanvasRef.current;
      const container = overlayRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (
        canvas.width !== Math.round(rect.width) ||
        canvas.height !== Math.round(rect.height)
      ) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scaleX = canvas.width / image.width;
      const scaleY = canvas.height / image.height;
      const r = Math.max(1, radius * scaleX);
      const cx = x * scaleX;
      const cy = y * scaleY;
      const last = segBrushLastRef.current;
      ctx.save();
      if (erase) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(248,113,113,0.55)';
        ctx.strokeStyle = 'rgba(248,113,113,0.55)';
      }
      if (last) {
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x * scaleX, last.y * scaleY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      segBrushLastRef.current = { x, y };
    },
    [image.height, image.width, overlayRef, segBrushCanvasRef, segBrushLastRef],
  );

  const findRegionAtPoint = useCallback(
    (x: number, y: number): AioTextRegion | null => {
    const r = regionsRef.current;
    for (let idx = r.length - 1; idx >= 0; idx -= 1) {
      const region = r[idx];
      if (!region) continue;
      const [x1, y1, x2, y2] = region.bbox;
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return region;
    }
    return null;
  }, []);

  const getRegionRotation = useCallback(
    (region: AioTextRegion): number =>
      normalizeRenderRotation(
        cloneRenderStyle(region.renderStyle).rotation || 0,
      ),
    [],
  );

  const rotatePoint = useCallback(
    (
      px: number,
      py: number,
      centerX: number,
      centerY: number,
      angleDeg: number,
    ): { x: number; y: number } => {
      if (Math.abs(angleDeg) <= 0.001) return { x: px, y: py };
      const radians = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const dx = px - centerX;
      const dy = py - centerY;
      return {
        x: centerX + (dx * cos - dy * sin),
        y: centerY + (dx * sin + dy * cos),
      };
    },
    [],
  );

  const getOppositeCorner = useCallback((corner: RegionCorner): RegionCorner => {
    if (corner === 'nw') return 'se';
    if (corner === 'ne') return 'sw';
    if (corner === 'sw') return 'ne';
    return 'nw';
  }, []);

  const getRegionCornerPoint = useCallback(
    (region: AioTextRegion, corner: RegionCorner): { x: number; y: number } => {
      const [x1, y1, x2, y2] = region.bbox;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const rotation = getRegionRotation(region);
      if (corner === 'nw')
        return rotatePoint(x1, y1, centerX, centerY, rotation);
      if (corner === 'ne')
        return rotatePoint(x2, y1, centerX, centerY, rotation);
      if (corner === 'sw')
        return rotatePoint(x1, y2, centerX, centerY, rotation);
      return rotatePoint(x2, y2, centerX, centerY, rotation);
    },
    [getRegionRotation, rotatePoint],
  );

  const detectCornerHit = useCallback(
    (
      region: AioTextRegion,
      x: number,
      y: number,
      radius: number,
    ): RegionCorner | null => {
      const corners: Array<{ key: RegionCorner; cx: number; cy: number }> = [
        (() => {
          const point = getRegionCornerPoint(region, 'nw');
          return { key: 'nw' as const, cx: point.x, cy: point.y };
        })(),
        (() => {
          const point = getRegionCornerPoint(region, 'ne');
          return { key: 'ne' as const, cx: point.x, cy: point.y };
        })(),
        (() => {
          const point = getRegionCornerPoint(region, 'sw');
          return { key: 'sw' as const, cx: point.x, cy: point.y };
        })(),
        (() => {
          const point = getRegionCornerPoint(region, 'se');
          return { key: 'se' as const, cx: point.x, cy: point.y };
        })(),
      ];
      for (const corner of corners) {
        if (
          Math.abs(x - corner.cx) <= radius &&
          Math.abs(y - corner.cy) <= radius
        )
          return corner.key;
      }
      return null;
    },
    [getRegionCornerPoint],
  );

  const detectRotateHandleHit = useCallback(
    (
      region: AioTextRegion,
      x: number,
      y: number,
      radius: number,
      offset: number,
    ): { centerX: number; centerY: number } | null => {
      const [x1, y1, x2, y2] = region.bbox;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const rotation = getRegionRotation(region);
      const handle = rotatePoint(
        (x1 + x2) / 2,
        y1 - offset,
        centerX,
        centerY,
        rotation,
      );
      const dx = x - handle.x;
      const dy = y - handle.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return { centerX, centerY };
      }
      return null;
    },
    [getRegionRotation, rotatePoint],
  );

  const updateRegionBox = useCallback(
    (regionId: string, nextBox: [number, number, number, number]) => {
      onRegionsChange(
        regionsRef.current.map((region) =>
          region.id === regionId ? { ...region, bbox: nextBox } : region,
        ),
      );
    },
    [onRegionsChange],
  );

  const setRegionRotation = useCallback(
    (regionId: string, nextRotation: number) => {
      onRegionsChange(
        regionsRef.current.map((region) => {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(nextRotation),
            },
          };
        }),
      );
    },
    [onRegionsChange],
  );

  const setRegionSkew = useCallback(
    (regionId: string, nextSkewX: number, nextSkewY: number) => {
      onRegionsChange(
        regionsRef.current.map((region) => {
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
        }),
      );
    },
    [fallbackStyle, onRegionsChange],
  );

  const behavior = useTextDetectionPreviewBehaviors({
    image: { width: image.width, height: image.height },
    regions,
    selectedRegionId,
    onCardSelect,
    onSelectRegion,
    onRegionsChange,
    editable,
    selectionEnabled,
    creationEnabled,
    newRegionShapeKind,
    segmentEditEnabled,
    segmentEditTool,
    segmentBrushSize,
    segmentBrushDataUrl,
    onSegmentBrushChange,
    translationNotesEnabled,
    fallbackStyle,
    overlayRef,
    segBrushCanvasRef,
    segBrushLastRef,
    brushCursorRef,
    regionById,
    isBrushCursorActive,
    updateBrushCursor,
    hideBrushCursor,
    toImagePoint,
    drawSegBrushOnCanvas,
    findRegionAtPoint,
    getRegionRotation,
    getOppositeCorner,
    getRegionCornerPoint,
    detectCornerHit,
    detectRotateHandleHit,
    updateRegionBox,
    setRegionRotation,
    setRegionSkew,
  });

  return {
    overlayRef,
    imgElemW,
    imgElemH,
    canvasWrapW,
    canvasWrapH,
    isBrushCursorActive,
    ...behavior,
  };
};

const TextDetectionPreview = (props: TextDetectionPreviewProps) => {
  const controller = useTextDetectionPreviewController(props);
  return <TextDetectionPreviewView {...props} controller={controller} />;
};

function areEqual(
  prev: TextDetectionPreviewProps,
  next: TextDetectionPreviewProps,
): boolean {
  return (
    prev.regions === next.regions &&
    prev.selectedRegionId === next.selectedRegionId &&
    prev.image === next.image &&
    prev.previewSrc === next.previewSrc &&
    prev.zoom === next.zoom &&
    prev.editable === next.editable &&
    prev.active === next.active &&
    prev.viewMode === next.viewMode &&
    prev.selectionEnabled === next.selectionEnabled &&
    prev.creationEnabled === next.creationEnabled &&
    prev.newRegionShapeKind === next.newRegionShapeKind &&
    prev.segmentEditEnabled === next.segmentEditEnabled &&
    prev.segmentEditTool === next.segmentEditTool &&
    prev.segmentBrushSize === next.segmentBrushSize &&
    prev.segmentBrushDataUrl === next.segmentBrushDataUrl &&
    prev.stageBadgeKey === next.stageBadgeKey &&
    prev.stageBadgeLabel === next.stageBadgeLabel &&
    prev.translationNotesEnabled === next.translationNotesEnabled &&
    prev.fallbackStyle === next.fallbackStyle &&
    prev.historyHint === next.historyHint &&
    prev.canRewind === next.canRewind &&
    prev.canForward === next.canForward
  );
}

export default React.memo(TextDetectionPreview, areEqual);
