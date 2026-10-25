// Shift+wheel rotates the selected region; shared by the classic and noir
// previews.

import { useCallback } from 'react';
import type React from 'react';
import { useNonPassiveWheel } from '../../../hooks/useNonPassiveWheel';

interface UseRenderTextPreviewOverlayWheelParams {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  editable: boolean;
  renderStageActive: boolean;
  areaSelectionEnabled: boolean;
  selectedRegionId: string | null;
  updateRegionRotation: (regionId: string, delta: number) => void;
}

export const useRenderTextPreviewOverlayWheel = ({
  overlayRef,
  editable,
  renderStageActive,
  areaSelectionEnabled,
  selectedRegionId,
  updateRegionRotation,
}: UseRenderTextPreviewOverlayWheelParams): void => {
  const handleOverlayWheel = useCallback(
    (event: WheelEvent) => {
      if (!editable || !renderStageActive || !areaSelectionEnabled) return;
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (!selectedRegionId) return;

      const dominantDelta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (Math.abs(dominantDelta) < 0.5) return;

      event.preventDefault();
      event.stopPropagation();

      const direction = dominantDelta < 0 ? 1 : -1;
      const steps = Math.max(
        1,
        Math.min(12, Math.round(Math.abs(dominantDelta) / 90)),
      );
      const rotationDelta = direction * steps * 2;
      updateRegionRotation(selectedRegionId, rotationDelta);
    },
    [
      areaSelectionEnabled,
      editable,
      renderStageActive,
      selectedRegionId,
      updateRegionRotation,
    ],
  );

  useNonPassiveWheel(overlayRef, handleOverlayWheel, true);
};
