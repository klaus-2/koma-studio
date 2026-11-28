import { useCallback, useMemo } from 'react';
import type React from 'react';
import { getEffectiveCssRootZoom } from '@koma/ui/utils/applyUiScale';
import type { ManualImageEditTool } from '../../../types/dashboard.types';
import type { SegmentEditTool } from '../../../types/dashboard.types';

interface UseRenderTextPreviewToolFlagsParams {
  manualEditEnabled: boolean;
  editable: boolean;
  areaSelectionEnabled: boolean;
  enableManualImageTools: boolean;
  stageBadgeKey: string;
  manualImageTool: ManualImageEditTool;
  segmentEditEnabled: boolean;
  segmentEditTool: SegmentEditTool;
  segmentBrushSize: number;
  manualBrushSize: number;
  rotationScaleFactor: number;
  zoom: number;
  brushCursorRef: React.RefObject<HTMLDivElement | null>;
}

export const useRenderTextPreviewToolFlags = ({
  manualEditEnabled,
  editable,
  areaSelectionEnabled,
  enableManualImageTools,
  stageBadgeKey,
  manualImageTool,
  segmentEditEnabled,
  segmentEditTool,
  segmentBrushSize,
  manualBrushSize,
  rotationScaleFactor,
  zoom,
  brushCursorRef,
}: UseRenderTextPreviewToolFlagsParams) => {
  const canUseManualImageTools = useMemo(
    () =>
      manualEditEnabled &&
      editable &&
      (enableManualImageTools || stageBadgeKey === 'render'),
    [manualEditEnabled, editable, enableManualImageTools, stageBadgeKey],
  );
  const activeManualImageTool: ManualImageEditTool = useMemo(
    () => (canUseManualImageTools ? manualImageTool : 'none'),
    [canUseManualImageTools, manualImageTool],
  );
  const showSegmentOverlay = useMemo(
    () => segmentEditEnabled || stageBadgeKey === 'segmentText',
    [segmentEditEnabled, stageBadgeKey],
  );
  const isBrushCursorActive = useMemo(
    () =>
      (segmentEditEnabled && editable && (segmentEditTool === 'brush' || segmentEditTool === 'eraser')) ||
      activeManualImageTool === 'paint' ||
      activeManualImageTool === 'paint_eraser' ||
      activeManualImageTool === 'healing_brush',
    [segmentEditEnabled, editable, segmentEditTool, activeManualImageTool],
  );

  const activeBrushCursorSize = useMemo(
    () =>
      segmentEditEnabled && editable && segmentEditTool !== 'select'
        ? (segmentBrushSize ?? 28)
        : manualBrushSize,
    [segmentEditEnabled, editable, segmentEditTool, segmentBrushSize, manualBrushSize],
  );

  const manualOverlayCursor = useMemo(
    () =>
      isBrushCursorActive
        ? 'none'
        : segmentEditEnabled && editable && segmentEditTool !== 'select'
          ? segmentEditTool === 'brush'
            ? 'crosshair'
            : 'cell'
          : activeManualImageTool === 'magic_wand'
            ? 'copy'
            : editable && areaSelectionEnabled
              ? 'crosshair'
              : 'default',
    [isBrushCursorActive, segmentEditEnabled, editable, segmentEditTool, activeManualImageTool, areaSelectionEnabled],
  );

  const updateBrushCursor = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const cursor = brushCursorRef.current;
      if (!cursor) return;
      const diameter = activeBrushCursorSize * rotationScaleFactor * zoom;
      const r = diameter / 2;
      if (cursor.dataset.size !== String(diameter)) {
        cursor.style.width = `${diameter}px`;
        cursor.style.height = `${diameter}px`;
        cursor.dataset.size = String(diameter);
      }
      const cssZoom = getEffectiveCssRootZoom();
      cursor.style.transform = `translate(${e.clientX / cssZoom - r}px, ${e.clientY / cssZoom - r}px)`;
      cursor.style.display = 'block';
    },
    [activeBrushCursorSize, rotationScaleFactor, zoom],
  );

  const hideBrushCursor = useCallback(() => {
    if (brushCursorRef.current) brushCursorRef.current.style.display = 'none';
  }, []);

  return {
    canUseManualImageTools,
    activeManualImageTool,
    showSegmentOverlay,
    isBrushCursorActive,
    activeBrushCursorSize,
    manualOverlayCursor,
    updateBrushCursor,
    hideBrushCursor,
  };
};
