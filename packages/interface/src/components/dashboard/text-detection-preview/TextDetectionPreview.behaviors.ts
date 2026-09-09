import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MIN_REGION_SIZE } from '../../../constants/dashboard.constants';
import type {
  AioTextRegion,
  OverlayInteraction,
  RegionCorner,
  SegmentEditTool,
} from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import { createDefaultTypographyShape } from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { clamp, cloneRenderStyle, normalizeRegion } from '../../../utils/dashboard.utils';
import { useTextDetectionPreviewTextState } from './TextDetectionPreview.textState';

interface TextDetectionPreviewBehaviorDeps {
  image: {
    width: number;
    height: number;
  };
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
  segmentBrushDataUrl: string | null;
  onSegmentBrushChange?: (dataUrl: string | null) => void;
  translationNotesEnabled: boolean;
  fallbackStyle: RenderTextStyle;
  overlayRef: React.MutableRefObject<HTMLDivElement | null>;
  segBrushCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  segBrushLastRef: React.MutableRefObject<{ x: number; y: number } | null>;
  brushCursorRef: React.MutableRefObject<HTMLDivElement | null>;
  regionById: Map<string, AioTextRegion>;
  isBrushCursorActive: boolean;
  updateBrushCursor: (event: React.PointerEvent<HTMLDivElement>) => void;
  hideBrushCursor: () => void;
  toImagePoint: (
    event: React.PointerEvent<HTMLDivElement>,
  ) => { x: number; y: number; scale: number } | null;
  drawSegBrushOnCanvas: (
    x: number,
    y: number,
    radius: number,
    erase: boolean,
  ) => void;
  findRegionAtPoint: (x: number, y: number) => AioTextRegion | null;
  getRegionRotation: (region: AioTextRegion) => number;
  getOppositeCorner: (corner: RegionCorner) => RegionCorner;
  getRegionCornerPoint: (
    region: AioTextRegion,
    corner: RegionCorner,
  ) => { x: number; y: number };
  detectCornerHit: (
    region: AioTextRegion,
    x: number,
    y: number,
    radius: number,
  ) => RegionCorner | null;
  detectRotateHandleHit: (
    region: AioTextRegion,
    x: number,
    y: number,
    radius: number,
    offset: number,
  ) => { centerX: number; centerY: number } | null;
  updateRegionBox: (
    regionId: string,
    nextBox: [number, number, number, number],
  ) => void;
  setRegionRotation: (regionId: string, nextRotation: number) => void;
  setRegionSkew: (
    regionId: string,
    nextSkewX: number,
    nextSkewY: number,
  ) => void;
}

export interface TextDetectionPreviewContextMenu {
  regionId: string;
  x: number;
  y: number;
}

export const useTextDetectionPreviewBehaviors = ({
  image,
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
}: TextDetectionPreviewBehaviorDeps) => {
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const segBrushDataUrlRef = useRef<string | null>(null);
  const [interaction, setInteraction] = useState<OverlayInteraction | null>(
    null,
  );
  const textState = useTextDetectionPreviewTextState({
    regions,
    selectedRegionId,
    editable,
    selectionEnabled,
    onCardSelect,
    onSelectRegion,
    onRegionsChange,
    translationNotesEnabled,
    overlayRef,
    fallbackStyle,
  });
  const {
    hoveredRegionId,
    setHoveredRegionId,
    contextMenu,
    setContextMenu,
    textEditor,
    setTextEditor,
    hoveredRegionTooltip,
    contextMenuTargetRegion,
    handleTextEditorChange,
    handleRegionContextMenu,
    handleRegionDoubleClick,
    handleContextCopyRecognized,
    handleContextCopyTranslated,
    handleContextEditRecognized,
    handleContextEditTranslated,
    handleContextRemoveRegion,
    handleEditorSave,
    handleEditorCancel,
  } = textState;

  const removeRegionById = useCallback(
    (regionId: string) => {
      const nextRegions = regionsRef.current.filter(
        (region) => region.id !== regionId,
      );
      onRegionsChange(
        nextRegions,
        selectedRegionId === regionId
          ? (nextRegions[0]?.id ?? null)
          : selectedRegionId,
      );
      setContextMenu(null);
      setTextEditor((prev) => (prev?.regionId === regionId ? null : prev));
    },
    [onRegionsChange, selectedRegionId, setContextMenu, setTextEditor],
  );

  const hoveredRegion = useMemo(
    () =>
      hoveredRegionId ? regionById.get(hoveredRegionId) ?? null : null,
    [hoveredRegionId, regionById],
  );

  useEffect(() => {
    const container = overlayRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const canvas = segBrushCanvasRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const newW = Math.round(rect.width);
      const newH = Math.round(rect.height);
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, newW, newH);
      const savedUrl = segBrushDataUrlRef.current;
      if (!savedUrl) return;
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, newW, newH);
      img.src = savedUrl;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [overlayRef, segBrushCanvasRef]);

  useEffect(() => {
    segBrushDataUrlRef.current = segmentBrushDataUrl ?? null;
    const canvas = segBrushCanvasRef.current;
    const container = overlayRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const newW = Math.round(rect.width);
    const newH = Math.round(rect.height);
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, newW, newH);
    const savedUrl = segBrushDataUrlRef.current;
    if (!savedUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, newW, newH);
    img.src = savedUrl;
  }, [overlayRef, segBrushCanvasRef, segmentBrushDataUrl]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onCardSelect();
      setContextMenu(null);
      setTextEditor(null);
      setHoveredRegionId(null);
      if (event.button !== 0) return;
      const point = toImagePoint(event);
      if (!point) return;
      event.preventDefault();

      const region = findRegionAtPoint(point.x, point.y);
      if (segmentEditEnabled && editable && segmentEditTool !== 'select') {
        const erase = segmentEditTool === 'eraser';
        segBrushLastRef.current = null;
        const radius = Math.max(2, segmentBrushSize / 2);
        drawSegBrushOnCanvas(point.x, point.y, radius, erase);
        setInteraction({
          kind: 'segment_paint',
          pointerId: event.pointerId,
          regionId: '',
          erase,
          brushSize: segmentBrushSize,
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (!selectionEnabled) return;

      const targetElement = event.target as HTMLElement | null;
      const handleElement = targetElement?.closest<HTMLElement>(
        '.koma-render-handle',
      );
      if (editable && handleElement) {
        const handleRegionId = handleElement.dataset.regionId ?? '';
        const handleRegion =
          regionsRef.current.find((item) => item.id === handleRegionId) ?? null;
        if (handleRegion) {
          onSelectRegion(handleRegion.id);
          const [x1, y1, x2, y2] = handleRegion.bbox;
          const handleType = handleElement.dataset.renderHandle;

          if (handleType === 'close') {
            removeRegionById(handleRegion.id);
            return;
          }

          if (handleType === 'rotate') {
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            const startRotation = getRegionRotation(handleRegion);
            setInteraction({
              kind: 'rotate',
              pointerId: event.pointerId,
              regionId: handleRegion.id,
              centerX,
              centerY,
              startPointerAngle: Math.atan2(
                point.y - centerY,
                point.x - centerX,
              ),
              startRotation,
            });
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }

          if (handleType === 'corner') {
            const cornerRaw = handleElement.dataset.corner;
            const corner: RegionCorner | null =
              cornerRaw === 'nw' ||
              cornerRaw === 'ne' ||
              cornerRaw === 'sw' ||
              cornerRaw === 'se'
                ? cornerRaw
                : null;
            if (corner) {
              const oppositeCorner = getOppositeCorner(corner);
              const anchor = getRegionCornerPoint(handleRegion, oppositeCorner);
              setInteraction({
                kind: 'resize',
                pointerId: event.pointerId,
                regionId: handleRegion.id,
                corner,
                anchorX: anchor.x,
                anchorY: anchor.y,
                rotation: getRegionRotation(handleRegion),
                startPointerX: point.x,
                startPointerY: point.y,
                startSkewX:
                  cloneRenderStyle(handleRegion.renderStyle ?? fallbackStyle)
                    .skewX || 0,
                startSkewY:
                  cloneRenderStyle(handleRegion.renderStyle ?? fallbackStyle)
                    .skewY || 0,
                boxWidth: handleRegion.bbox[2] - handleRegion.bbox[0],
                boxHeight: handleRegion.bbox[3] - handleRegion.bbox[1],
              });
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
          }
        }
      }

      const selectedRegion = selectedRegionId
        ? (regionsRef.current.find((item) => item.id === selectedRegionId) ?? null)
        : null;
      const handleRadius = 15 * point.scale;
      const rotateHandleRadius = 16 * point.scale;
      const rotateHandleOffset = 20 * point.scale;

      if (editable && selectedRegion) {
        const rotateHit = detectRotateHandleHit(
          selectedRegion,
          point.x,
          point.y,
          rotateHandleRadius,
          rotateHandleOffset,
        );
        if (rotateHit) {
          const startRotation = getRegionRotation(selectedRegion);
          setInteraction({
            kind: 'rotate',
            pointerId: event.pointerId,
            regionId: selectedRegion.id,
            centerX: rotateHit.centerX,
            centerY: rotateHit.centerY,
            startPointerAngle: Math.atan2(
              point.y - rotateHit.centerY,
              point.x - rotateHit.centerX,
            ),
            startRotation,
          });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }

        const selectedCorner = detectCornerHit(
          selectedRegion,
          point.x,
          point.y,
          handleRadius,
        );
        if (selectedCorner) {
          const oppositeCorner = getOppositeCorner(selectedCorner);
          const anchor = getRegionCornerPoint(selectedRegion, oppositeCorner);
          setInteraction({
            kind: 'resize',
            pointerId: event.pointerId,
            regionId: selectedRegion.id,
            corner: selectedCorner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            rotation: getRegionRotation(selectedRegion),
            startPointerX: point.x,
            startPointerY: point.y,
            startSkewX:
              cloneRenderStyle(selectedRegion.renderStyle ?? fallbackStyle)
                .skewX || 0,
            startSkewY:
              cloneRenderStyle(selectedRegion.renderStyle ?? fallbackStyle)
                .skewY || 0,
            boxWidth: selectedRegion.bbox[2] - selectedRegion.bbox[0],
            boxHeight: selectedRegion.bbox[3] - selectedRegion.bbox[1],
          });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }

      const regionIsSelected = Boolean(
        region && region.id === selectedRegionId,
      );
      if (region) {
        onSelectRegion(region.id);
        if (!editable) return;
        if (!regionIsSelected) return;

        const corner = detectCornerHit(region, point.x, point.y, handleRadius);
        if (corner) {
          const oppositeCorner = getOppositeCorner(corner);
          const anchor = getRegionCornerPoint(region, oppositeCorner);
          setInteraction({
            kind: 'resize',
            pointerId: event.pointerId,
            regionId: region.id,
            corner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            rotation: getRegionRotation(region),
            startPointerX: point.x,
            startPointerY: point.y,
            startSkewX:
              cloneRenderStyle(region.renderStyle ?? fallbackStyle).skewX || 0,
            startSkewY:
              cloneRenderStyle(region.renderStyle ?? fallbackStyle).skewY || 0,
            boxWidth: region.bbox[2] - region.bbox[0],
            boxHeight: region.bbox[3] - region.bbox[1],
          });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }

        const [x1, y1, x2, y2] = region.bbox;
        setInteraction({
          kind: 'move',
          pointerId: event.pointerId,
          regionId: region.id,
          offsetX: point.x - x1,
          offsetY: point.y - y1,
          boxWidth: x2 - x1,
          boxHeight: y2 - y1,
          startPointerX: point.x,
          startPointerY: point.y,
          hasMoved: false,
        });
        return;
      }

      onSelectRegion(null);
      if (!editable || !creationEnabled) return;
      setInteraction({
        kind: 'draw',
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      creationEnabled,
      detectCornerHit,
      detectRotateHandleHit,
      drawSegBrushOnCanvas,
      editable,
      fallbackStyle,
      findRegionAtPoint,
      getOppositeCorner,
      getRegionCornerPoint,
      getRegionRotation,
      onCardSelect,
      onSelectRegion,
      removeRegionById,
      selectedRegionId,
      selectionEnabled,
      segmentBrushSize,
      segmentEditEnabled,
      segmentEditTool,
      segBrushLastRef,
      setContextMenu,
      setHoveredRegionId,
      setTextEditor,
      toImagePoint,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      const point = toImagePoint(event);
      if (!point) return;
      event.preventDefault();

      if (interaction.kind === 'segment_paint') {
        drawSegBrushOnCanvas(
          point.x,
          point.y,
          Math.max(2, interaction.brushSize / 2),
          interaction.erase,
        );
        return;
      }

      if (interaction.kind === 'draw') {
        setInteraction({
          ...interaction,
          currentX: point.x,
          currentY: point.y,
        });
        return;
      }

      if (interaction.kind === 'move') {
        const pointerTravel = Math.hypot(
          point.x - interaction.startPointerX,
          point.y - interaction.startPointerY,
        );
        const dragThreshold = Math.max(3, point.scale * 4);
        if (!interaction.hasMoved && pointerTravel < dragThreshold) {
          return;
        }
        if (!interaction.hasMoved) {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          setInteraction((prev) =>
            prev && prev.kind === 'move' && prev.pointerId === event.pointerId
              ? { ...prev, hasMoved: true }
              : prev,
          );
        }
        const x1 = clamp(
          point.x - interaction.offsetX,
          0,
          image.width - interaction.boxWidth,
        );
        const y1 = clamp(
          point.y - interaction.offsetY,
          0,
          image.height - interaction.boxHeight,
        );
        const x2 = x1 + interaction.boxWidth;
        const y2 = y1 + interaction.boxHeight;
        updateRegionBox(
          interaction.regionId,
          normalizeRegion(x1, y1, x2, y2, image.width, image.height),
        );
        return;
      }

      if (interaction.kind === 'rotate') {
        const currentPointerAngle = Math.atan2(
          point.y - interaction.centerY,
          point.x - interaction.centerX,
        );
        let deltaDegrees =
          ((currentPointerAngle - interaction.startPointerAngle) * 180) /
          Math.PI;
        if (deltaDegrees > 180) deltaDegrees -= 360;
        if (deltaDegrees < -180) deltaDegrees += 360;
        setRegionRotation(
          interaction.regionId,
          interaction.startRotation + deltaDegrees,
        );
        return;
      }

      if (interaction.kind === 'resize') {
        if (event.ctrlKey) {
          const deltaX = point.x - interaction.startPointerX;
          const deltaY = point.y - interaction.startPointerY;
          const horizontalSign =
            interaction.corner === 'nw' || interaction.corner === 'sw' ? -1 : 1;
          const verticalSign =
            interaction.corner === 'nw' || interaction.corner === 'ne' ? -1 : 1;
          const skewXDelta =
            (deltaX / Math.max(40, interaction.boxWidth)) * 30 * horizontalSign;
          const skewYDelta =
            (deltaY / Math.max(40, interaction.boxHeight)) * 30 * verticalSign;
          setRegionSkew(
            interaction.regionId,
            interaction.startSkewX + skewXDelta,
            interaction.startSkewY + skewYDelta,
          );
          return;
        }
        if (Math.abs(interaction.rotation) > 0.001) {
          const radians = (interaction.rotation * Math.PI) / 180;
          const cosNeg = Math.cos(-radians);
          const sinNeg = Math.sin(-radians);
          const worldDeltaX = point.x - interaction.anchorX;
          const worldDeltaY = point.y - interaction.anchorY;
          const localDeltaX = worldDeltaX * cosNeg - worldDeltaY * sinNeg;
          const localDeltaY = worldDeltaX * sinNeg + worldDeltaY * cosNeg;
          const nextWidth = Math.abs(localDeltaX);
          const nextHeight = Math.abs(localDeltaY);
          if (nextWidth < MIN_REGION_SIZE || nextHeight < MIN_REGION_SIZE)
            return;

          const halfLocalX = localDeltaX / 2;
          const halfLocalY = localDeltaY / 2;
          const cosPos = Math.cos(radians);
          const sinPos = Math.sin(radians);
          const centerOffsetX = halfLocalX * cosPos - halfLocalY * sinPos;
          const centerOffsetY = halfLocalX * sinPos + halfLocalY * cosPos;
          const centerX = interaction.anchorX + centerOffsetX;
          const centerY = interaction.anchorY + centerOffsetY;

          const [x1, y1, x2, y2] = normalizeRegion(
            centerX - nextWidth / 2,
            centerY - nextHeight / 2,
            centerX + nextWidth / 2,
            centerY + nextHeight / 2,
            image.width,
            image.height,
          );
          if (x2 - x1 < MIN_REGION_SIZE || y2 - y1 < MIN_REGION_SIZE) return;
          updateRegionBox(interaction.regionId, [x1, y1, x2, y2]);
          return;
        }

        const [x1, y1, x2, y2] = normalizeRegion(
          interaction.anchorX,
          interaction.anchorY,
          point.x,
          point.y,
          image.width,
          image.height,
        );
        if (x2 - x1 < MIN_REGION_SIZE || y2 - y1 < MIN_REGION_SIZE) return;
        updateRegionBox(interaction.regionId, [x1, y1, x2, y2]);
      }
    },
    [
      drawSegBrushOnCanvas,
      image.height,
      image.width,
      interaction,
      setRegionRotation,
      setRegionSkew,
      toImagePoint,
      updateRegionBox,
    ],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (interaction.kind === 'segment_paint') {
        const canvas = segBrushCanvasRef.current;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          segBrushDataUrlRef.current = canvas.toDataURL();
          const offscreen = document.createElement('canvas');
          offscreen.width = image.width;
          offscreen.height = image.height;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.drawImage(canvas, 0, 0, image.width, image.height);
            const imageScaleUrl = offscreen.toDataURL();
            onSegmentBrushChange?.(imageScaleUrl);
          }
          offscreen.width = 0;
          offscreen.height = 0;
        }
        segBrushLastRef.current = null;
        setInteraction(null);
        return;
      }

      if (interaction.kind === 'move' && !interaction.hasMoved) {
        setInteraction(null);
        return;
      }

      if (interaction.kind === 'draw') {
        const [x1, y1, x2, y2] = normalizeRegion(
          interaction.startX,
          interaction.startY,
          interaction.currentX,
          interaction.currentY,
          image.width,
          image.height,
        );
        if (x2 - x1 >= MIN_REGION_SIZE && y2 - y1 >= MIN_REGION_SIZE) {
          const manualRegion: AioTextRegion = {
            id: `manual-${uuidv4()}`,
            bbox: [x1, y1, x2, y2],
            score: 1,
            source: 'manual',
            modelKey: 'manual',
            detectorModelKey: 'manual',
            detectedRenderMode: 'text_bubble',
            renderMode: 'auto',
            shape: createDefaultTypographyShape(
              x2 - x1,
              y2 - y1,
              newRegionShapeKind,
              'manual',
            ),
            stylePresetId: null,
            queueIndex: null,
            hidden: false,
            locked: false,
          };
          onRegionsChange([...regionsRef.current, manualRegion], manualRegion.id);
        }
      }
      if (interaction.kind === 'rotate') {
        const point = toImagePoint(event);
        if (point) {
          const currentPointerAngle = Math.atan2(
            point.y - interaction.centerY,
            point.x - interaction.centerX,
          );
          let deltaDegrees =
            ((currentPointerAngle - interaction.startPointerAngle) * 180) /
            Math.PI;
          if (deltaDegrees > 180) deltaDegrees -= 360;
          if (deltaDegrees < -180) deltaDegrees += 360;
          if (Math.abs(deltaDegrees) < 1) {
            setRegionRotation(interaction.regionId, 15);
          }
        }
      }
      setInteraction(null);
      setHoveredRegionId(null);
    },
    [
      segBrushCanvasRef,
      segBrushLastRef,
      image.height,
      image.width,
      interaction,
      newRegionShapeKind,
      onRegionsChange,
      onSegmentBrushChange,
      setRegionRotation,
      setHoveredRegionId,
      toImagePoint,
    ],
  );

  const handleRegionContextMenuDelegated = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-region-id]',
      );
      if (!box) return;
      const region = box.dataset.regionId
        ? regionById.get(box.dataset.regionId) ?? null
        : null;
      if (region) handleRegionContextMenu(event, region);
    },
    [handleRegionContextMenu, regionById],
  );

  const handleRegionDoubleClickDelegated = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-region-id]',
      );
      if (!box) return;
      const region = box.dataset.regionId
        ? regionById.get(box.dataset.regionId) ?? null
        : null;
      if (region) handleRegionDoubleClick(event, region);
    },
    [handleRegionDoubleClick, regionById],
  );

  const handleRegionRemoveClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const btn = event.currentTarget;
      const rid = btn.dataset.removeRegionId;
      if (rid) removeRegionById(rid);
    },
    [removeRegionById],
  );

  const stopPropagationPointerDown = useCallback(
    (event: React.PointerEvent) => event.stopPropagation(),
    [],
  );

  const lastHoveredRegionIdRef = useRef<string | null>(null);

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handlePointerMove(event);
      if (isBrushCursorActive) updateBrushCursor(event);
      const box = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-region-id]',
      );
      const rid = box?.dataset.regionId ?? null;
      if (rid !== lastHoveredRegionIdRef.current) {
        lastHoveredRegionIdRef.current = rid;
        setHoveredRegionId(rid);
      }
    },
    [handlePointerMove, isBrushCursorActive, setHoveredRegionId, updateBrushCursor],
  );

  const handleOverlayPointerEnter = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBrushCursorActive) updateBrushCursor(event);
    },
    [isBrushCursorActive, updateBrushCursor],
  );

  const handleOverlayPointerLeave = useCallback(() => {
    lastHoveredRegionIdRef.current = null;
    setHoveredRegionId(null);
    hideBrushCursor();
  }, [hideBrushCursor, setHoveredRegionId]);

  const handleOverlayPointerCancel = useCallback(() => {
    lastHoveredRegionIdRef.current = null;
    setInteraction(null);
    setHoveredRegionId(null);
    setContextMenu(null);
    setTextEditor(null);
    hideBrushCursor();
  }, [hideBrushCursor, setContextMenu, setHoveredRegionId, setTextEditor]);

  const draftBox = useMemo(
    () =>
      interaction && interaction.kind === 'draw'
        ? normalizeRegion(
            interaction.startX,
            interaction.startY,
            interaction.currentX,
            interaction.currentY,
            image.width,
            image.height,
          )
        : null,
    [image.height, image.width, interaction],
  );

  const segmentOverlayBoxes = useMemo(
    () =>
      regions.flatMap((region) => {
        const boxes = region.mergedSegmentBoxes?.length
          ? region.mergedSegmentBoxes
          : (region.segmentBoxes ?? []);

        return boxes.map((segmentBox, idx) => ({
          key: `seg-${region.id}-${idx}`,
          box: segmentBox,
        }));
      }),
    [regions],
  );

  return {
    brushCursorRef,
    contextMenu,
    contextMenuTargetRegion,
    draftBox,
    handleContextCopyRecognized,
    handleContextCopyTranslated,
    handleContextEditRecognized,
    handleContextEditTranslated,
    handleContextRemoveRegion,
    handleEditorCancel,
    handleEditorSave,
    handleOverlayPointerCancel,
    handleOverlayPointerEnter,
    handleOverlayPointerLeave,
    handleOverlayPointerMove,
    handlePointerDown,
    handlePointerUp,
    handleRegionContextMenuDelegated,
    handleRegionDoubleClickDelegated,
    handleRegionRemoveClick,
    handleTextEditorChange,
    hoveredRegion,
    hoveredRegionTooltip,
    segBrushCanvasRef,
    segmentOverlayBoxes,
    stopPropagationPointerDown,
    textEditor,
  };
};
