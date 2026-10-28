import { useEffect } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
} from '../../../constants/dashboard.constants';
import type {
  AioManualImageProgress,
  LoadedImage,
  ToolMode,
} from '../../../types/dashboard.types';
import {
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
} from '../../../utils/dashboard.utils';
import {
  createAioManualProgressForIndex,
  createAioManualProgressFromAutoIndex,
  resolveSnapshotSelectionForImage,
} from '../helpers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import type { useExportStore } from '../stores/export-store';
import type { useManualToolsStore } from '../stores/manual-tools-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import type { useUiShellStore } from '../stores/ui-shell-store';
import type { useAioPipelineSnapshotState } from './aio-snapshot-state';

type AioPipelineState = ReturnType<typeof useAioPipelineStore.getState>;
type UiShellState = ReturnType<typeof useUiShellStore.getState>;
type RegionEditorState = ReturnType<typeof useRegionEditorStore.getState>;
type ExportState = ReturnType<typeof useExportStore.getState>;
type ManualToolsState = ReturnType<typeof useManualToolsStore.getState>;
type AioSnapshotStateApi = ReturnType<typeof useAioPipelineSnapshotState>;

export interface UseAioManualProgressSyncArgs {
  readonly activeId: string | null;
  readonly images: LoadedImage[];
  readonly mode: ToolMode;
  readonly subMode: UiShellState['subMode'];
  readonly initializeManualProgressFromSnapshots: AioSnapshotStateApi['initializeManualProgressFromSnapshots'];
  readonly normalizeAioPipelineSnapshotsForManualMode: AioSnapshotStateApi['normalizeAioPipelineSnapshotsForManualMode'];
  readonly setAioDetectionsByImage: RegionEditorState['setAioDetectionsByImage'];
  readonly setAioSelectedRegionByImage: RegionEditorState['setAioSelectedRegionByImage'];
  readonly setAioDownloadItemForImage: ExportState['setAioDownloadItemForImage'];
  readonly setAioImageSnapshotIndexById: AioPipelineState['setAioImageSnapshotIndexById'];
  readonly setAioManualProgressByImage: AioPipelineState['setAioManualProgressByImage'];
  readonly setAioPipelineSnapshotIndex: AioPipelineState['setAioPipelineSnapshotIndex'];
  readonly setAioPipelineSnapshots: AioPipelineState['setAioPipelineSnapshots'];
  readonly setAioAutoProcessedImageById: AioPipelineState['setAioAutoProcessedImageById'];
  readonly setAioManualImageEditsByImage: ManualToolsState['setAioManualImageEditsByImage'];
  readonly setAioManualHealingBusyByImage: ManualToolsState['setAioManualHealingBusyByImage'];
}

/**
 * Keeps the per-image manual-edit and manual-progress maps aligned with the
 * current image list and with the manual-mode pipeline snapshots.
 */
export function useAioManualProgressSync({
  activeId,
  images,
  mode,
  subMode,
  initializeManualProgressFromSnapshots,
  normalizeAioPipelineSnapshotsForManualMode,
  setAioDetectionsByImage,
  setAioSelectedRegionByImage,
  setAioDownloadItemForImage,
  setAioImageSnapshotIndexById,
  setAioManualProgressByImage,
  setAioPipelineSnapshotIndex,
  setAioPipelineSnapshots,
  setAioAutoProcessedImageById,
  setAioManualImageEditsByImage,
  setAioManualHealingBusyByImage,
}: UseAioManualProgressSyncArgs): void {
  useEffect(() => {
    const imageIds = new Set(images.map((item) => item.id));
    setAioManualImageEditsByImage((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
    setAioManualHealingBusyByImage((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
    setAioManualProgressByImage((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
    setAioAutoProcessedImageById((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
  }, [images, setAioManualImageEditsByImage, setAioManualHealingBusyByImage, setAioManualProgressByImage, setAioAutoProcessedImageById]);

  useEffect(() => {
    if (mode !== 'aio' || subMode !== 'manual') return;
    if (images.length === 0) return;

    const pipelineState = useAioPipelineStore.getState();
    const regionState = useRegionEditorStore.getState();
    const aioPipelineSnapshots = pipelineState.aioPipelineSnapshots;
    const snapshotsNeedNormalization =
      aioPipelineSnapshots.length === 0 ||
      aioPipelineSnapshots.length !== AIO_MANUAL_STAGE_ORDER.length ||
      AIO_MANUAL_STAGE_ORDER.some(
        (stageKey, index) => aioPipelineSnapshots[index]?.key !== stageKey,
      );

    if (snapshotsNeedNormalization) {
      const normalizedSnapshots =
        normalizeAioPipelineSnapshotsForManualMode(aioPipelineSnapshots);
      const normalizedImageIndexById: Record<string, number> = {};
      images.forEach((image) => {
        const explicitIndex = pipelineState.aioAutoHistoryAvailable
          ? pipelineState.aioImageSnapshotIndexById[image.id]
          : undefined;
        normalizedImageIndexById[image.id] =
          typeof explicitIndex === 'number' && explicitIndex >= 0
            ? clamp(
              explicitIndex,
              0,
              Math.max(0, normalizedSnapshots.length - 1),
            )
            : 0;
      });
      const manualProgress = initializeManualProgressFromSnapshots(
        normalizedSnapshots,
        normalizedImageIndexById,
      );
      setAioPipelineSnapshots(normalizedSnapshots);
      setAioImageSnapshotIndexById(normalizedImageIndexById);
      setAioManualProgressByImage(manualProgress);
      const activeManualIndex = activeId
        ? (manualProgress[activeId]?.currentIndex ?? 0)
        : 0;
      setAioPipelineSnapshotIndex(activeManualIndex);

      if (activeId) {
        const snapshot = normalizedSnapshots[activeManualIndex] ?? null;
        if (snapshot) {
          const activeRegions = cloneAioRegions(
            snapshot.detectionsByImage[activeId] ?? [],
            cloneRenderStyle,
          );
          const activeSelected = resolveSnapshotSelectionForImage(
            snapshot,
            activeId,
            activeRegions,
            regionState.aioSelectedRegionByImage[activeId] ?? null,
          );
          setAioDetectionsByImage((prev) => ({
            ...prev,
            [activeId]: activeRegions,
          }));
          setAioSelectedRegionByImage((prev) => ({
            ...prev,
            [activeId]: activeSelected,
          }));
          const activeDownload =
            snapshot.aioDownloads.find(
              (entry) => entry.sourceImageId === activeId,
            ) ?? null;
          setAioDownloadItemForImage(activeId, activeDownload);
        }
      }
      return;
    }

    setAioManualProgressByImage((prev) => {
      const imageIds = new Set(images.map((item) => item.id));
      let changed = false;
      const next: Record<string, AioManualImageProgress> = {};
      Object.entries(prev).forEach(([imageId, progress]) => {
        if (!imageIds.has(imageId)) {
          changed = true;
          return;
        }
        next[imageId] = progress;
      });
      images.forEach((image) => {
        if (next[image.id]) return;
        changed = true;
        const explicitIndex = pipelineState.aioAutoHistoryAvailable
          ? pipelineState.aioImageSnapshotIndexById[image.id]
          : undefined;
        if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
          next[image.id] = createAioManualProgressFromAutoIndex(
            clamp(explicitIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1),
          );
          return;
        }
        next[image.id] = createAioManualProgressForIndex(0);
      });
      return changed ? next : prev;
    });
  }, [
    activeId,
    images,
    initializeManualProgressFromSnapshots,
    mode,
    normalizeAioPipelineSnapshotsForManualMode,
    setAioDetectionsByImage,
    setAioDownloadItemForImage,
    setAioImageSnapshotIndexById,
    setAioManualProgressByImage,
    setAioPipelineSnapshotIndex,
    setAioPipelineSnapshots,
    setAioSelectedRegionByImage,
    subMode,
  ]);
}
