import { useCallback } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
} from '../constants/dashboard.constants';
import {
  areAioRegionsEqual,
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
} from '../utils/dashboard.utils';
import type {
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
} from '../types/dashboard.types';

import { useAioPipelineStore } from '../pages/dashboard/stores/aio-pipeline-store';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';

interface UseAioManualProgressControlsArgs {
  activeId: string | null;
  applyAioPipelineSnapshotToImage: (imageId: string, index: number) => AioPipelineSnapshot | null;
  syncManualStagePreviewToNextStage: (imageId: string, fromIndex: number, toIndex: number) => void;
  setAioManualProgressByImage: React.Dispatch<React.SetStateAction<Record<string, AioManualImageProgress>>>;
  setStatusMessage: (value: string) => void;
}

export function useAioManualProgressControls({
  activeId,
  applyAioPipelineSnapshotToImage,
  syncManualStagePreviewToNextStage,
  setAioManualProgressByImage,
  setStatusMessage,
}: UseAioManualProgressControlsArgs) {
  const getAioRegionsFromSnapshot = useCallback((stageKey: AioPipelineSnapshotKey, imageId: string): AioTextRegion[] => {
    const snapshots = useAioPipelineStore.getState().aioPipelineSnapshots;
    const stageIndex = AIO_MANUAL_STAGE_ORDER.indexOf(stageKey);
    if (stageIndex < 0 || stageIndex >= snapshots.length) return [];
    return cloneAioRegions(snapshots[stageIndex]?.detectionsByImage[imageId] ?? [], cloneRenderStyle);
  }, []);

  const setManualStageForActiveImage = useCallback((targetIndex: number) => {
    if (!activeId) return;
    const progress =
      useAioPipelineStore.getState().aioManualProgressByImage[activeId];
    if (!progress) return;
    const bounded = clamp(targetIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    if (bounded > progress.unlockedMaxIndex) return;
    const snapshot = applyAioPipelineSnapshotToImage(activeId, bounded);
    if (!snapshot) return;
    setAioManualProgressByImage((prev) => {
      const current = prev[activeId];
      if (!current || current.currentIndex === bounded) return prev;
      return {
        ...prev,
        [activeId]: {
          ...current,
          currentIndex: bounded,
        },
      };
    });
    setStatusMessage(`Modo manual: etapa "${snapshot.label}" selecionada.`);
  }, [activeId, applyAioPipelineSnapshotToImage, setAioManualProgressByImage, setStatusMessage]);

  const completeManualStageForImage = useCallback((imageId: string, stageIndex: number, status: 'done' | 'skipped') => {
    const progress =
      useAioPipelineStore.getState().aioManualProgressByImage[imageId];
    if (!progress) return;
    const boundedCurrent = clamp(stageIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    const currentStageKey = AIO_MANUAL_STAGE_ORDER[boundedCurrent];
    const lastStageIndex = AIO_MANUAL_STAGE_ORDER.length - 1;
    const nextUnlocked = Math.max(progress.unlockedMaxIndex, Math.min(boundedCurrent + 1, lastStageIndex));
    const nextIndex = boundedCurrent < lastStageIndex ? boundedCurrent + 1 : boundedCurrent;
    const nextStageKey = AIO_MANUAL_STAGE_ORDER[nextIndex];
    if (!currentStageKey || !nextStageKey) return;
    const nextStatusByStage = {
      ...progress.statusByStage,
      [currentStageKey]: status,
    };
    // Always sync when cleanImage completes so the new clean image is reflected in the
    // render stage even if render was already 'done' from a prior AIO Auto run.
    const currentStageAlwaysPropagate = currentStageKey === 'cleanImage';
    const shouldSyncNextPreview =
      nextIndex !== boundedCurrent &&
      (progress.statusByStage[nextStageKey] === 'locked' || currentStageAlwaysPropagate);
    if (shouldSyncNextPreview) {
      syncManualStagePreviewToNextStage(imageId, boundedCurrent, nextIndex);
    }
    if (nextIndex !== boundedCurrent && nextStatusByStage[nextStageKey] === 'locked') {
      nextStatusByStage[nextStageKey] = 'pending';
    }

    setAioManualProgressByImage((prev) => ({
      ...prev,
      [imageId]: {
        ...progress,
        currentIndex: nextIndex,
        unlockedMaxIndex: nextUnlocked,
        statusByStage: nextStatusByStage,
      },
    }));
    void applyAioPipelineSnapshotToImage(imageId, nextIndex);
  }, [
    applyAioPipelineSnapshotToImage,
    setAioManualProgressByImage,
    syncManualStagePreviewToNextStage,
  ]);

  let isSyncingActiveManualStage = false;
  const syncActiveManualStageSnapshot = useCallback(() => {
    if (isSyncingActiveManualStage) return;
    if (!activeId) return;
    const pipelineState = useAioPipelineStore.getState();
    const regionState = useRegionEditorStore.getState();
    const progress = pipelineState.aioManualProgressByImage[activeId];
    if (!progress) return;
    const stageIndex = clamp(progress.currentIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    const snapshot = pipelineState.aioPipelineSnapshots[stageIndex];
    if (!snapshot) return;

    const expectedRegions = snapshot.detectionsByImage[activeId] ?? [];
    const hasExpectedSelection = Object.prototype.hasOwnProperty.call(snapshot.selectedRegionByImage, activeId);
    const currentRegions = regionState.aioDetectionsByImage[activeId] ?? [];
    const currentSelected = regionState.aioSelectedRegionByImage[activeId] ?? null;
    const expectedSelected = hasExpectedSelection
      ? (snapshot.selectedRegionByImage[activeId] ?? null)
      : currentSelected;
    const currentIndex = pipelineState.aioImageSnapshotIndexById[activeId] ?? -1;
    const regionsChanged = !areAioRegionsEqual(currentRegions, expectedRegions, cloneRenderStyle);
    const shouldSync =
      currentIndex !== stageIndex
      || regionsChanged
      || currentSelected !== expectedSelected;
    if (!shouldSync) return;
    isSyncingActiveManualStage = true;
    try {
      void applyAioPipelineSnapshotToImage(activeId, stageIndex);
    } finally {
      isSyncingActiveManualStage = false;
    }
  }, [
    activeId,
    applyAioPipelineSnapshotToImage,
  ]);

  return {
    getAioRegionsFromSnapshot,
    setManualStageForActiveImage,
    completeManualStageForImage,
    syncActiveManualStageSnapshot,
  };
}
