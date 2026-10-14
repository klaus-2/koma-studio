import { useCallback } from 'react';

import { useI18n } from '@/i18n';
import {
  applyAioPipelineSnapshot,
  applyAioPipelineSnapshotToImage,
} from '@/pages/dashboard/hooks/aio-snapshot.commands';
import {
  initializeManualProgress,
  normalizeSnapshotsForManualMode,
} from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import type { SnapshotLabels } from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import {
  isManualAioMode,
  isSnapshotIndex,
  resolveImageSnapshotIndex,
  resolveImageSnapshotMeta,
} from '@/pages/dashboard/hooks/aio-snapshot.queries';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioDownloadEntry,
  AioManualImageProgress,
  AioPipelineSnapshot,
  SubMode,
} from '@/types/dashboard.types';

export function buildAioImageSnapshotIndexMap(
  index: number,
): Record<string, number> {
  if (!Number.isInteger(index) || index < 0) return {};

  return Object.fromEntries(
    useImageCollectionStore.getState().images.map((image) => [image.id, index]),
  );
}

function readCurrentAioDownloads(): AioDownloadEntry[] {
  return useExportStore.getState().downloadItems.flatMap((item) =>
    item.scope === 'aio'
      ? [
        {
          fileName: item.name,
          blob: item.blob,
          sourceImageId: item.sourceImageId,
        },
      ]
      : [],
  );
}

export function useAioSnapshotNavigation(
  labels: SnapshotLabels,
  resolvedActiveId: string | null,
) {
  const { t } = useI18n();

  const normalizeAioPipelineSnapshotsForManualMode = useCallback(
    (snapshots: readonly AioPipelineSnapshot[]): AioPipelineSnapshot[] => {
      const regions = useRegionEditorStore.getState();

      return normalizeSnapshotsForManualMode({
        snapshots,
        imageIds: useImageCollectionStore
          .getState()
          .images.map((image) => image.id),
        labels,
        fallbackDetections: regions.aioDetectionsByImage,
        fallbackSelection: regions.aioSelectedRegionByImage,
        fallbackDownloads: readCurrentAioDownloads(),
      });
    },
    [labels],
  );

  const initializeManualProgressFromSnapshots = useCallback(
    (
      snapshots: readonly AioPipelineSnapshot[],
      snapshotIndexByImage: Readonly<Record<string, number>>,
    ): Record<string, AioManualImageProgress> =>
      initializeManualProgress({
        snapshots,
        snapshotIndexByImage,
        imageIds: useImageCollectionStore
          .getState()
          .images.map((image) => image.id),
        autoHistoryAvailable:
          useAioPipelineStore.getState().aioAutoHistoryAvailable,
      }),
    [],
  );

  const handleAioSubModeChange = useCallback(
    (nextMode: SubMode): void => {
      const shell = useUiShellStore.getState();
      if (shell.processing || nextMode === shell.subMode) return;

      if (nextMode === 'manual') {
        const pipeline = useAioPipelineStore.getState();
        const collection = useImageCollectionStore.getState();

        const originalIndices = Object.fromEntries(
          collection.images.map((image) => [
            image.id,
            pipeline.aioAutoHistoryAvailable
              ? resolveImageSnapshotIndex(image.id, pipeline, shell)
              : -1,
          ]),
        );
        const snapshots = normalizeAioPipelineSnapshotsForManualMode(
          pipeline.aioPipelineSnapshots,
        );
        const progress = initializeManualProgressFromSnapshots(
          pipeline.aioPipelineSnapshots.length > 0
            ? pipeline.aioPipelineSnapshots
            : snapshots,
          originalIndices,
        );
        const indices = Object.fromEntries(
          collection.images.map((image) => [
            image.id,
            progress[image.id]?.currentIndex ?? 0,
          ]),
        );
        const autoProcessed = Object.fromEntries(
          collection.images
            .filter((image) => (originalIndices[image.id] ?? -1) >= 0)
            .map((image) => [image.id, true]),
        );
        const requestedActiveId = resolvedActiveId ?? collection.activeId;
        const activeId = collection.images.some(
          (image) => image.id === requestedActiveId,
        )
          ? requestedActiveId
          : null;
        const activeIndex = activeId ? (indices[activeId] ?? 0) : -1;

        useAioPipelineStore.setState((state) => ({
          aioPipelineSnapshots: snapshots,
          aioImageSnapshotIndexById: indices,
          aioManualProgressByImage: progress,
          aioAutoProcessedImageById: {
            ...state.aioAutoProcessedImageById,
            ...autoProcessed,
          },
          aioPipelineSnapshotIndex: activeIndex,
        }));

        if (activeId && activeIndex >= 0) {
          applyAioPipelineSnapshotToImage(activeId, activeIndex);
        }
      }

      useUiShellStore.getState().setSubMode(nextMode);
    },
    [
      initializeManualProgressFromSnapshots,
      normalizeAioPipelineSnapshotsForManualMode,
      resolvedActiveId,
    ],
  );

  const navigatePipeline = useCallback(
    (direction: -1 | 1): void => {
      const shell = useUiShellStore.getState();
      if (shell.processing || isManualAioMode(shell)) return;

      const pipeline = useAioPipelineStore.getState();
      const currentIndex = pipeline.aioPipelineSnapshotIndex;
      if (
        !isSnapshotIndex(currentIndex, pipeline.aioPipelineSnapshots.length)
      ) {
        return;
      }

      const nextIndex = currentIndex + direction;
      if (!isSnapshotIndex(nextIndex, pipeline.aioPipelineSnapshots.length)) {
        return;
      }

      const snapshot = pipeline.aioPipelineSnapshots[nextIndex];
      if (!snapshot) return;

      applyAioPipelineSnapshot(snapshot);
      useAioPipelineStore.setState({
        aioPipelineSnapshotIndex: nextIndex,
        aioImageSnapshotIndexById:
          buildAioImageSnapshotIndexMap(nextIndex),
      });
      useStatusStore.getState().setStatusMessage(
        t(
          direction === -1
            ? 'dashboard.aio.rewind'
            : 'dashboard.aio.forward',
          {
            label: labels[snapshot.key],
            current: nextIndex + 1,
            total: pipeline.aioPipelineSnapshots.length,
          },
        ),
      );
    },
    [labels, t],
  );

  const navigateImage = useCallback(
    (imageId: string, direction: -1 | 1): void => {
      const shell = useUiShellStore.getState();
      if (shell.processing) return;

      const image = useImageCollectionStore
        .getState()
        .images.find((candidate) => candidate.id === imageId);
      if (!image) return;

      const pipeline = useAioPipelineStore.getState();
      const meta = resolveImageSnapshotMeta(imageId, pipeline, shell);
      if (direction === -1 ? !meta.canRewind : !meta.canForward) return;

      const nextIndex = meta.index + direction;
      const snapshot = applyAioPipelineSnapshotToImage(imageId, nextIndex);
      if (!snapshot) return;

      if (isManualAioMode(shell)) {
        useAioPipelineStore.setState((state) => {
          const current = state.aioManualProgressByImage[imageId];
          if (!current || current.currentIndex === nextIndex) return state;

          return {
            aioManualProgressByImage: {
              ...state.aioManualProgressByImage,
              [imageId]: { ...current, currentIndex: nextIndex },
            },
          };
        });
      }

      useStatusStore.getState().setStatusMessage(
        t(
          direction === -1
            ? 'dashboard.aio.rewindImage'
            : 'dashboard.aio.forwardImage',
          {
            imageName: image.file.name,
            label: labels[snapshot.key],
            current: nextIndex + 1,
            total: pipeline.aioPipelineSnapshots.length,
          },
        ),
      );
    },
    [labels, t],
  );

  const rewindAioPipeline = useCallback(
    (): void => navigatePipeline(-1),
    [navigatePipeline],
  );
  const forwardAioPipeline = useCallback(
    (): void => navigatePipeline(1),
    [navigatePipeline],
  );
  const rewindAioPipelineForImage = useCallback(
    (imageId: string): void => navigateImage(imageId, -1),
    [navigateImage],
  );
  const forwardAioPipelineForImage = useCallback(
    (imageId: string): void => navigateImage(imageId, 1),
    [navigateImage],
  );

  return {
    buildAioImageSnapshotIndexMap,
    normalizeAioPipelineSnapshotsForManualMode,
    initializeManualProgressFromSnapshots,
    handleAioSubModeChange,
    rewindAioPipeline,
    forwardAioPipeline,
    rewindAioPipelineForImage,
    forwardAioPipelineForImage,
  };
}
