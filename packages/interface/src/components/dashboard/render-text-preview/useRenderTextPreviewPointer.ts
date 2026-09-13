// Pointer interaction handlers for RenderTextPreview: region drag/resize/
// rotate/draw, manual paint + healing brush strokes, segment brush painting,
// magic wand targeting and the delegated overlay handlers.
// Moved verbatim from RenderTextPreview.tsx (T07 split); hook order preserved.
// Geometry hit-testing moved to regionGeometry.ts (pure module functions).

import { useCallback } from 'react';
import type React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  AioTextRegion,
  LoadedImage,
  ManualImageEditTool,
  RegionCorner,
  RenderOverlayInteraction,
  SegmentEditTool,
} from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { MIN_REGION_SIZE } from '../../../constants/dashboard.constants';
import { clamp, cloneRenderStyle } from '../../../utils/dashboard.utils';
import { getRenderModePresetStyle } from '../../../utils/renderModes';
import { createDefaultTypographyShape } from '../../../typography/types';
import { drawManualStroke } from './canvasDrawing';
import {
  detectCornerHit,
  detectRotateHandleHit,
  findRegionAtPoint,
  getOppositeCorner,
  getRegionCornerPoint,
  getRegionRotation,
} from './regionGeometry';
import type { RenderTextPreviewContextMenuState } from './RenderTextPreviewContextMenu';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';

type RenderTextPreviewInteraction = RenderOverlayInteraction;

interface ManualInteractionState {
  pointerId: number;
  tool: 'paint' | 'paint_eraser' | 'healing_brush';
  lastX: number;
  lastY: number;
}

interface UseRenderTextPreviewPointerParams {
  interaction: RenderTextPreviewInteraction | null;
  setInteraction: React.Dispatch<
    React.SetStateAction<RenderTextPreviewInteraction | null>
  >;
  setContextMenu: React.Dispatch<
    React.SetStateAction<RenderTextPreviewContextMenuState | null>
  >;
  setInlineEditor: React.Dispatch<
    React.SetStateAction<RenderTextPreviewInlineEditorState | null>
  >;
  setHoveredRegionId: React.Dispatch<React.SetStateAction<string | null>>;
  paintCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  healingMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  segBrushCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  segBrushLastRef: React.RefObject<{ x: number; y: number } | null>;
  segBrushDataUrlRef: React.RefObject<string | null>;
  wandMaskSelectedRef: React.RefObject<Uint8Array | null>;
  manualInteractionRef: React.RefObject<ManualInteractionState | null>;
  lastHoveredRegionIdRef: React.RefObject<string | null>;
  regionsWithDefaultsRef: React.RefObject<AioTextRegion[]>;
  image: LoadedImage;
  displayRegionsWithDefaults: AioTextRegion[];
  regionsWithDefaultsById: Map<string, AioTextRegion>;
  fallbackStyle: RenderTextStyle;
  selectedRegionId: string | null;
  editable: boolean;
  areaSelectionEnabled: boolean;
  allowRegionCreation: boolean;
  renderStageActive: boolean;
  segmentEditEnabled: boolean;
  segmentEditTool: SegmentEditTool;
  segmentBrushSize: number;
  activeManualImageTool: ManualImageEditTool;
  manualHealingPending: boolean;
  isBrushCursorActive: boolean;
  manualBrushSize: number;
  manualPaintColor: string;
  manualBrushOpacity: number;
  manualBrushBlur: number;
  newRegionShapeKind: TypographyShapeKind;
  onCardSelect: () => void;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  onMultiSelectToggle?: (regionId: string) => void;
  onManualWandMaskChange: (nextMask: string | null) => void;
  onManualWandRequest: (x: number, y: number) => Promise<void>;
  onSegmentBrushChange?: (dataUrl: string | null) => void;
  toImagePoint: (
    event: React.PointerEvent<HTMLDivElement>,
  ) => { x: number; y: number; scale: number } | null;
  drawSegBrushOnCanvas: (x: number, y: number, radius: number, erase: boolean) => void;
  commitPaintLayer: () => void;
  commitHealingMask: () => void;
  updateRegionBox: (regionId: string, nextBox: [number, number, number, number]) => void;
  setRegionSkew: (regionId: string, nextSkewX: number, nextSkewY: number) => void;
  setRegionRotation: (regionId: string, nextRotation: number) => void;
  updateRegionRotation: (regionId: string, deltaDegrees: number) => void;
  updateBrushCursor: (e: React.PointerEvent<HTMLDivElement>) => void;
  hideBrushCursor: () => void;
  handleRegionContextMenu: (
    event: React.MouseEvent<HTMLDivElement>,
    region: AioTextRegion,
  ) => void;
  openInlineEditorForRegion: (region: AioTextRegion) => void;
}

export const useRenderTextPreviewPointer = ({
  interaction,
  setInteraction,
  setContextMenu,
  setInlineEditor,
  setHoveredRegionId,
  paintCanvasRef,
  healingMaskCanvasRef,
  segBrushCanvasRef,
  segBrushLastRef,
  segBrushDataUrlRef,
  wandMaskSelectedRef,
  manualInteractionRef,
  lastHoveredRegionIdRef,
  regionsWithDefaultsRef,
  image,
  displayRegionsWithDefaults,
  regionsWithDefaultsById,
  fallbackStyle,
  selectedRegionId,
  editable,
  areaSelectionEnabled,
  allowRegionCreation,
  renderStageActive,
  segmentEditEnabled,
  segmentEditTool,
  segmentBrushSize,
  activeManualImageTool,
  manualHealingPending,
  isBrushCursorActive,
  manualBrushSize,
  manualPaintColor,
  manualBrushOpacity,
  manualBrushBlur,
  newRegionShapeKind,
  onCardSelect,
  onSelectRegion,
  onRegionsChange,
  onMultiSelectToggle,
  onManualWandMaskChange,
  onManualWandRequest,
  onSegmentBrushChange,
  toImagePoint,
  drawSegBrushOnCanvas,
  commitPaintLayer,
  commitHealingMask,
  updateRegionBox,
  setRegionSkew,
  setRegionRotation,
  updateRegionRotation,
  updateBrushCursor,
  hideBrushCursor,
  handleRegionContextMenu,
  openInlineEditorForRegion,
}: UseRenderTextPreviewPointerParams) => {
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onCardSelect();
      setContextMenu(null);
      setInlineEditor(null);
      setHoveredRegionId(null);
      if (event.button !== 0) return;
      event.preventDefault();
      const point = toImagePoint(event);
      if (!point) return;

      if (segmentEditEnabled && editable && segmentEditTool !== 'select') {
        const erase = segmentEditTool === 'eraser';
        segBrushLastRef.current = null;
        drawSegBrushOnCanvas(point.x, point.y, Math.max(2, segmentBrushSize / 2), erase);
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

      if (activeManualImageTool !== 'none') {
        if (
          manualHealingPending &&
          (activeManualImageTool === 'healing_brush' ||
            activeManualImageTool === 'magic_wand')
        ) {
          return;
        }
        onSelectRegion(null);
        setInteraction(null);
        if (activeManualImageTool === 'magic_wand') {
          const selectedArr = wandMaskSelectedRef.current;
          if (selectedArr) {
            const px = Math.round(point.x);
            const py = Math.round(point.y);
            if (px >= 0 && py >= 0 && px < image.width && py < image.height) {
              if (selectedArr[py * image.width + px] === 1) {
                onManualWandMaskChange(null);
                return;
              }
            }
          }
          void onManualWandRequest(point.x, point.y);
          return;
        }

        if (
          activeManualImageTool === 'paint' ||
          activeManualImageTool === 'paint_eraser'
        ) {
          const erase = activeManualImageTool === 'paint_eraser';
          drawManualStroke(
            paintCanvasRef.current,
            point.x,
            point.y,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: manualPaintColor,
              erase,
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
          manualInteractionRef.current = {
            pointerId: event.pointerId,
            tool: activeManualImageTool,
            lastX: point.x,
            lastY: point.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }

        if (activeManualImageTool === 'healing_brush') {
          onManualWandMaskChange(null);
          drawManualStroke(
            healingMaskCanvasRef.current,
            point.x,
            point.y,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: 'rgba(248, 113, 113, 0.96)',
              erase: false,
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
          manualInteractionRef.current = {
            pointerId: event.pointerId,
            tool: 'healing_brush',
            lastX: point.x,
            lastY: point.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }

      if (!areaSelectionEnabled) return;

      const targetElement = event.target as HTMLElement | null;
      const handleElement = targetElement?.closest<HTMLElement>(
        '.koma-render-handle',
      );
      if (editable && handleElement) {
        const handleRegionId = handleElement.dataset.regionId ?? '';
        const handleRegion =
          displayRegionsWithDefaults.find(
            (region) => region.id === handleRegionId,
          ) ?? null;
        if (handleRegion) {
          onSelectRegion(handleRegion.id);
          const [x1, y1, x2, y2] = handleRegion.bbox;
          const handleType = handleElement.dataset.renderHandle;

          if (handleType === 'rotate') {
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            const startRotation = getRegionRotation(handleRegion, fallbackStyle);
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
              const handleRotation = getRegionRotation(handleRegion, fallbackStyle);
              const anchor = getRegionCornerPoint(handleRegion, oppositeCorner, handleRotation);
              setInteraction({
                kind: 'resize',
                pointerId: event.pointerId,
                regionId: handleRegion.id,
                corner,
                anchorX: anchor.x,
                anchorY: anchor.y,
                rotation: handleRotation,
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
        ? (displayRegionsWithDefaults.find(
            (region) => region.id === selectedRegionId,
          ) ?? null)
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
          getRegionRotation(selectedRegion, fallbackStyle),
        );
        if (rotateHit) {
          const startRotation = getRegionRotation(selectedRegion, fallbackStyle);
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
          getRegionRotation(selectedRegion, fallbackStyle),
        );
        if (selectedCorner) {
          const oppositeCorner = getOppositeCorner(selectedCorner);
          const selectedRotation = getRegionRotation(selectedRegion, fallbackStyle);
          const anchor = getRegionCornerPoint(selectedRegion, oppositeCorner, selectedRotation);
          setInteraction({
            kind: 'resize',
            pointerId: event.pointerId,
            regionId: selectedRegion.id,
            corner: selectedCorner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            rotation: selectedRotation,
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

      const region = findRegionAtPoint(displayRegionsWithDefaults, point.x, point.y);
      const regionIsSelected = Boolean(
        region && region.id === selectedRegionId,
      );
      if (region) {
        if ((event.ctrlKey || event.metaKey) && onMultiSelectToggle && areaSelectionEnabled) {
          onMultiSelectToggle(region.id);
          return;
        }
        onSelectRegion(region.id);
        if (!editable) return;
        if (!regionIsSelected) return;

        const corner = detectCornerHit(
          region,
          point.x,
          point.y,
          handleRadius,
          getRegionRotation(region, fallbackStyle),
        );
        if (corner) {
          const oppositeCorner = getOppositeCorner(corner);
          const regionRotation = getRegionRotation(region, fallbackStyle);
          const anchor = getRegionCornerPoint(region, oppositeCorner, regionRotation);
          setInteraction({
            kind: 'resize',
            pointerId: event.pointerId,
            regionId: region.id,
            corner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            rotation: regionRotation,
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
      if (!editable || !allowRegionCreation) return;
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
      activeManualImageTool,
      allowRegionCreation,
      areaSelectionEnabled,
      drawSegBrushOnCanvas,
      editable,
      fallbackStyle,
      manualBrushSize,
      manualBrushOpacity,
      manualBrushBlur,
      manualHealingPending,
      manualPaintColor,
      onManualWandMaskChange,
      onManualWandRequest,
      onCardSelect,
      onSelectRegion,
      displayRegionsWithDefaults,
      segmentBrushSize,
      segmentEditEnabled,
      segmentEditTool,
      selectedRegionId,
      toImagePoint,
      onMultiSelectToggle,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const manualInteraction = manualInteractionRef.current;
      if (
        manualInteraction &&
        manualInteraction.pointerId === event.pointerId
      ) {
        const point = toImagePoint(event);
        if (!point) return;
        event.preventDefault();
        if (
          manualInteraction.tool === 'paint' ||
          manualInteraction.tool === 'paint_eraser'
        ) {
          drawManualStroke(
            paintCanvasRef.current,
            manualInteraction.lastX,
            manualInteraction.lastY,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: manualPaintColor,
              erase: manualInteraction.tool === 'paint_eraser',
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
        } else if (manualInteraction.tool === 'healing_brush') {
          drawManualStroke(
            healingMaskCanvasRef.current,
            manualInteraction.lastX,
            manualInteraction.lastY,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: 'rgba(248, 113, 113, 0.96)',
              erase: false,
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
        }
        manualInteractionRef.current = {
          ...manualInteraction,
          lastX: point.x,
          lastY: point.y,
        };
        return;
      }

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
        const bleedX = interaction.boxWidth;
        const bleedY = interaction.boxHeight;
        const x1 = clamp(
          point.x - interaction.offsetX,
          -bleedX,
          image.width,
        );
        const y1 = clamp(
          point.y - interaction.offsetY,
          -bleedY,
          image.height,
        );
        const x2 = x1 + interaction.boxWidth;
        const y2 = y1 + interaction.boxHeight;
        updateRegionBox(interaction.regionId, [x1, y1, x2, y2]);
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

          const [x1, y1, x2, y2] = [
            centerX - nextWidth / 2,
            centerY - nextHeight / 2,
            centerX + nextWidth / 2,
            centerY + nextHeight / 2,
          ];
          if (x2 - x1 < MIN_REGION_SIZE || y2 - y1 < MIN_REGION_SIZE) return;
          updateRegionBox(interaction.regionId, [x1, y1, x2, y2]);
          return;
        }

        const rawX1 = Math.min(interaction.anchorX, point.x);
        const rawY1 = Math.min(interaction.anchorY, point.y);
        const rawX2 = Math.max(interaction.anchorX, point.x);
        const rawY2 = Math.max(interaction.anchorY, point.y);
        if (rawX2 - rawX1 < MIN_REGION_SIZE || rawY2 - rawY1 < MIN_REGION_SIZE)
          return;
        updateRegionBox(interaction.regionId, [rawX1, rawY1, rawX2, rawY2]);
      }
    },
    [
      drawSegBrushOnCanvas,
      image.height,
      image.width,
      interaction,
      manualBrushSize,
      manualBrushOpacity,
      manualBrushBlur,
      manualPaintColor,
      newRegionShapeKind,
      setRegionSkew,
      setRegionRotation,
      toImagePoint,
      updateRegionBox,
    ],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const manualInteraction = manualInteractionRef.current;
      if (
        manualInteraction &&
        manualInteraction.pointerId === event.pointerId
      ) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (
          manualInteraction.tool === 'paint' ||
          manualInteraction.tool === 'paint_eraser'
        ) {
          commitPaintLayer();
        } else if (manualInteraction.tool === 'healing_brush') {
          commitHealingMask();
        }
        manualInteractionRef.current = null;
        return;
      }

      if (!interaction || interaction.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (interaction.kind === 'move' && !interaction.hasMoved) {
        setInteraction(null);
        return;
      }

      if (interaction.kind === 'segment_paint') {
        const canvas = segBrushCanvasRef.current;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          segBrushDataUrlRef.current = canvas.toDataURL();
          // Scale to image dimensions for persistence
          const offscreen = document.createElement('canvas');
          offscreen.width = image.width;
          offscreen.height = image.height;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.drawImage(canvas, 0, 0, image.width, image.height);
            const imageScaleUrl = offscreen.toDataURL();
            onSegmentBrushChange?.(imageScaleUrl);
          }
          // Free GPU texture memory immediately.
          offscreen.width = 0;
          offscreen.height = 0;
        }
        segBrushLastRef.current = null;
        setInteraction(null);
        return;
      }

      if (interaction.kind === 'draw') {
        const rawX1 = Math.min(interaction.startX, interaction.currentX);
        const rawY1 = Math.min(interaction.startY, interaction.currentY);
        const rawX2 = Math.max(interaction.startX, interaction.currentX);
        const rawY2 = Math.max(interaction.startY, interaction.currentY);
        if (rawX2 - rawX1 >= MIN_REGION_SIZE && rawY2 - rawY1 >= MIN_REGION_SIZE) {
          const manualRegion: AioTextRegion = {
            id: `manual-${uuidv4()}`,
            bbox: [rawX1, rawY1, rawX2, rawY2],
            score: 1,
            source: 'manual',
            modelKey: 'manual',
            detectorModelKey: 'manual',
            detectedRenderMode: 'text_bubble',
            renderMode: 'auto',
            renderStyle: {
              ...getRenderModePresetStyle('auto', fallbackStyle, 'text_bubble'),
              hyphenationEnabled: false,
            },
            shape: createDefaultTypographyShape(
              rawX2 - rawX1,
              rawY2 - rawY1,
              newRegionShapeKind,
              'manual',
            ),
            stylePresetId: null,
            queueIndex: null,
            hidden: false,
            locked: false,
          };
          onRegionsChange(
            [...regionsWithDefaultsRef.current, manualRegion],
            manualRegion.id,
          );
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
            updateRegionRotation(interaction.regionId, 15);
          }
        }
      }
      setInteraction(null);
    },
    [
      commitHealingMask,
      commitPaintLayer,
      fallbackStyle,
      image.height,
      image.width,
      interaction,
      allowRegionCreation,
      onRegionsChange,
      onSelectRegion,
      toImagePoint,
      updateRegionRotation,
    ],
  );

  // Resolve the region under the pointer from the closest data-region-id ancestor
  // before dispatching context-menu actions, so each region doesn't carry its
  // own inline handler.
  const handleRegionContextMenuDelegated = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region-id]');
      if (!box) return;
      const region = box.dataset.regionId
        ? regionsWithDefaultsById.get(box.dataset.regionId) ?? null
        : null;
      if (region) handleRegionContextMenu(event, region);
    },
    [handleRegionContextMenu, regionsWithDefaultsById],
  );

  const handleRegionDoubleClickDelegated = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region-id]');
      if (!box) return;
      const region = box.dataset.regionId
        ? regionsWithDefaultsById.get(box.dataset.regionId) ?? null
        : null;
      if (!region) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu(null);
      if (!editable || !renderStageActive || !areaSelectionEnabled) return;
      openInlineEditorForRegion(region);
    },
    [
      areaSelectionEnabled,
      editable,
      openInlineEditorForRegion,
      regionsWithDefaultsById,
      renderStageActive,
    ],
  );

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handlePointerMove(event);
      if (isBrushCursorActive) updateBrushCursor(event);
      // Track region hover via event delegation — skip if unchanged
      const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region-id]');
      const rid = box?.dataset.regionId ?? null;
      if (rid !== lastHoveredRegionIdRef.current) {
        lastHoveredRegionIdRef.current = rid;
        setHoveredRegionId(rid);
      }
    },
    [handlePointerMove, isBrushCursorActive, updateBrushCursor],
  );

  const handleOverlayPointerEnter = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBrushCursorActive) updateBrushCursor(event);
    },
    [isBrushCursorActive, updateBrushCursor],
  );

  const handleOverlayPointerLeave = useCallback(() => {
    setHoveredRegionId(null);
    hideBrushCursor();
  }, [hideBrushCursor]);

  const handleOverlayPointerCancel = useCallback(() => {
    setInteraction(null);
    setHoveredRegionId(null);
    setContextMenu(null);
    setInlineEditor(null);
    hideBrushCursor();
  }, [hideBrushCursor]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleRegionContextMenuDelegated,
    handleRegionDoubleClickDelegated,
    handleOverlayPointerMove,
    handleOverlayPointerEnter,
    handleOverlayPointerLeave,
    handleOverlayPointerCancel,
  };
};
