import { AIO_MANUAL_STAGE_ORDER } from '@/constants/dashboard.constants';
import {
  createAioManualProgressForIndex,
  createAioManualProgressFromAutoIndex,
} from '@/pages/dashboard/helpers';
import { isSnapshotIndex } from '@/pages/dashboard/hooks/aio-snapshot.queries';
import type {
  AioDownloadEntry,
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
} from '@/types/dashboard.types';
import {
  cloneAioDetectionsMap,
  cloneAioDownloadEntries,
  cloneRenderStyle,
  resolveSelectedRegionForRegions,
} from '@/utils/dashboard.utils';

export type SnapshotLabels = Readonly<
  Record<AioPipelineSnapshotKey, string>
>;

interface NormalizeSnapshotsArgs {
  readonly snapshots: readonly AioPipelineSnapshot[];
  readonly imageIds: readonly string[];
  readonly labels: SnapshotLabels;
  readonly fallbackDetections: AioPipelineSnapshot['detectionsByImage'];
  readonly fallbackSelection: AioPipelineSnapshot['selectedRegionByImage'];
  readonly fallbackDownloads: readonly AioDownloadEntry[];
}

function copyImageDetections(
  source: AioPipelineSnapshot['detectionsByImage'],
  imageIds: readonly string[],
): AioPipelineSnapshot['detectionsByImage'] {
  return cloneAioDetectionsMap(
    Object.fromEntries(
      imageIds.map((imageId) => [imageId, source[imageId] ?? []]),
    ),
    cloneRenderStyle,
  );
}

function resolveSelections(
  detections: AioPipelineSnapshot['detectionsByImage'],
  selection: AioPipelineSnapshot['selectedRegionByImage'],
  imageIds: readonly string[],
): AioPipelineSnapshot['selectedRegionByImage'] {
  return Object.fromEntries(
    imageIds.map((imageId) => {
      const regions = detections[imageId] ?? [];
      const requested = selection[imageId];

      return [
        imageId,
        requested === null
          ? null
          : resolveSelectedRegionForRegions(
            regions,
            requested ?? regions[0]?.id ?? null,
          ),
      ];
    }),
  );
}

export function normalizeSnapshotsForManualMode({
  snapshots,
  imageIds,
  labels,
  fallbackDetections,
  fallbackSelection,
  fallbackDownloads,
}: NormalizeSnapshotsArgs): AioPipelineSnapshot[] {
  const snapshotsByKey = new Map(
    snapshots.map((snapshot) => [snapshot.key, snapshot]),
  );
  const currentImageIds = new Set(imageIds);

  let detections = fallbackDetections;
  let selection = fallbackSelection;
  let downloads: readonly AioDownloadEntry[] = fallbackDownloads;

  return AIO_MANUAL_STAGE_ORDER.map((key) => {
    const existing = snapshotsByKey.get(key);

    if (existing) {
      detections = existing.detectionsByImage;
      selection = existing.selectedRegionByImage;
      downloads = existing.aioDownloads;
    }

    const nextDetections = copyImageDetections(detections, imageIds);
    const stageDownloads =
      existing || key === 'cleanImage' || key === 'render'
        ? downloads.filter(
          (entry) =>
            entry.sourceImageId == null ||
            currentImageIds.has(entry.sourceImageId),
        )
        : [];

    return {
      key,
      label: labels[key],
      detectionsByImage: nextDetections,
      selectedRegionByImage: resolveSelections(
        nextDetections,
        selection,
        imageIds,
      ),
      aioDownloads: cloneAioDownloadEntries([...stageDownloads]),
    };
  });
}

interface InitializeManualProgressArgs {
  readonly snapshots: readonly AioPipelineSnapshot[];
  readonly imageIds: readonly string[];
  readonly snapshotIndexByImage: Readonly<Record<string, number>>;
  readonly autoHistoryAvailable: boolean;
}

export function initializeManualProgress({
  snapshots,
  imageIds,
  snapshotIndexByImage,
  autoHistoryAvailable,
}: InitializeManualProgressArgs): Record<string, AioManualImageProgress> {
  if (snapshots.length === 0) return {};

  return Object.fromEntries(
    imageIds.map((imageId) => {
      const sourceIndex = snapshotIndexByImage[imageId];
      const snapshot =
        autoHistoryAvailable &&
          sourceIndex !== undefined &&
          isSnapshotIndex(sourceIndex, snapshots.length)
          ? snapshots[sourceIndex]
          : undefined;

      const manualIndex = snapshot
        ? AIO_MANUAL_STAGE_ORDER.indexOf(snapshot.key)
        : -1;

      return [
        imageId,
        manualIndex >= 0
          ? createAioManualProgressFromAutoIndex(manualIndex)
          : createAioManualProgressForIndex(0),
      ];
    }),
  );
}
