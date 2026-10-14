import { resolveSnapshotSelectionForImage } from '@/pages/dashboard/helpers';
import { isSnapshotIndex } from '@/pages/dashboard/hooks/aio-snapshot.queries';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import type {
  AioDownloadEntry,
  AioPipelineSnapshot,
  AioTextRegion,
} from '@/types/dashboard.types';
import {
  areAioRegionsEqual,
  cloneAioDetectionsMap,
  cloneAioDownloadEntries,
  cloneAioRegionsCoW,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';

export function equalImageDownload(
  left: AioDownloadEntry | null,
  right: AioDownloadEntry | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.sourceImageId === right.sourceImageId &&
      left.fileName === right.fileName &&
      left.blob === right.blob)
  );
}

function replaceImageDownload(
  downloads: AioDownloadEntry[],
  imageId: string,
  next: AioDownloadEntry | null,
): AioDownloadEntry[] {
  const matches = downloads.filter(
    (entry) => entry.sourceImageId === imageId,
  );

  if (
    matches.length <= 1 &&
    equalImageDownload(matches[0] ?? null, next)
  ) {
    return downloads;
  }

  const remaining = downloads.filter(
    (entry) => entry.sourceImageId !== imageId,
  );

  return next ? [...remaining, { ...next }] : remaining;
}

function applySnapshotRegionsToImage(
  imageId: string,
  snapshot: AioPipelineSnapshot,
): void {
  useRegionEditorStore.setState((state) => {
    const previousRegions = state.aioDetectionsByImage[imageId];
    const regions = cloneAioRegionsCoW(
      snapshot.detectionsByImage[imageId] ?? [],
      previousRegions,
      cloneRenderStyle,
    ).regions;
    const selected = resolveSnapshotSelectionForImage(
      snapshot,
      imageId,
      regions,
      state.aioSelectedRegionByImage[imageId] ?? null,
    );

    const sameRegions =
      previousRegions !== undefined &&
      areAioRegionsEqual(previousRegions, regions, cloneRenderStyle);
    const sameSelection =
      state.aioSelectedRegionByImage[imageId] === selected;

    if (sameRegions && sameSelection) return state;

    return {
      aioDetectionsByImage: sameRegions
        ? state.aioDetectionsByImage
        : { ...state.aioDetectionsByImage, [imageId]: regions },
      aioSelectedRegionByImage: sameSelection
        ? state.aioSelectedRegionByImage
        : { ...state.aioSelectedRegionByImage, [imageId]: selected },
    };
  });

  const download =
    snapshot.aioDownloads.find(
      (entry) => entry.sourceImageId === imageId,
    ) ?? null;

  useExportStore
    .getState()
    .setAioDownloadItemForImage(imageId, download ? { ...download } : null);
}

export function applyAioPipelineSnapshot(
  snapshot: AioPipelineSnapshot,
): void {
  const detections = cloneAioDetectionsMap(
    snapshot.detectionsByImage,
    cloneRenderStyle,
  );
  const selections = Object.fromEntries(
    Object.entries(detections).map(([imageId, regions]) => [
      imageId,
      resolveSnapshotSelectionForImage(snapshot, imageId, regions, null),
    ]),
  );

  useRegionEditorStore.setState({
    aioDetectionsByImage: detections,
    aioSelectedRegionByImage: selections,
  });

  useExportStore
    .getState()
    .setAioDownloadItems(cloneAioDownloadEntries(snapshot.aioDownloads));
}

export function applyAioPipelineSnapshotToImage(
  imageId: string,
  index: number,
): AioPipelineSnapshot | null {
  const pipeline = useAioPipelineStore.getState();
  if (!isSnapshotIndex(index, pipeline.aioPipelineSnapshots.length)) {
    return null;
  }

  const snapshot = pipeline.aioPipelineSnapshots[index];
  if (!snapshot) return null;

  applySnapshotRegionsToImage(imageId, snapshot);

  useAioPipelineStore.setState((state) =>
    state.aioImageSnapshotIndexById[imageId] === index
      ? state
      : {
        aioImageSnapshotIndexById: {
          ...state.aioImageSnapshotIndexById,
          [imageId]: index,
        },
      },
  );

  return snapshot;
}

export function patchAioSnapshotStageForImage(
  imageId: string,
  stageIndex: number,
  nextRegions: AioTextRegion[],
  downloadEntry?: AioDownloadEntry | null,
): void {
  if (downloadEntry != null && downloadEntry.sourceImageId !== imageId) {
    throw new Error('AIO_DOWNLOAD_IMAGE_MISMATCH');
  }

  useAioPipelineStore.setState((state) => {
    if (!isSnapshotIndex(stageIndex, state.aioPipelineSnapshots.length)) {
      return state;
    }

    const snapshot = state.aioPipelineSnapshots[stageIndex];
    if (!snapshot) return state;

    const previousRegions = snapshot.detectionsByImage[imageId] ?? [];
    const regions = cloneAioRegionsCoW(
      nextRegions,
      previousRegions,
      cloneRenderStyle,
    ).regions;
    const selected = resolveSnapshotSelectionForImage(
      snapshot,
      imageId,
      regions,
      snapshot.selectedRegionByImage[imageId] ?? null,
    );
    const downloads =
      downloadEntry === undefined
        ? snapshot.aioDownloads
        : replaceImageDownload(
          snapshot.aioDownloads,
          imageId,
          downloadEntry,
        );

    if (
      areAioRegionsEqual(previousRegions, regions, cloneRenderStyle) &&
      snapshot.selectedRegionByImage[imageId] === selected &&
      downloads === snapshot.aioDownloads
    ) {
      return state;
    }

    const snapshots = [...state.aioPipelineSnapshots];
    snapshots[stageIndex] = {
      ...snapshot,
      detectionsByImage: {
        ...snapshot.detectionsByImage,
        [imageId]: regions,
      },
      selectedRegionByImage: {
        ...snapshot.selectedRegionByImage,
        [imageId]: selected,
      },
      aioDownloads: downloads,
    };

    return { aioPipelineSnapshots: snapshots };
  });
}

export function syncManualStagePreviewToNextStage(
  imageId: string,
  fromStageIndex: number,
  toStageIndex: number,
): void {
  if (fromStageIndex === toStageIndex) return;

  useAioPipelineStore.setState((state) => {
    const snapshots = state.aioPipelineSnapshots;
    if (
      !isSnapshotIndex(fromStageIndex, snapshots.length) ||
      !isSnapshotIndex(toStageIndex, snapshots.length)
    ) {
      return state;
    }

    const source = snapshots[fromStageIndex];
    const target = snapshots[toStageIndex];
    if (!source || !target) return state;

    const previousRegions = target.detectionsByImage[imageId] ?? [];
    const regions = cloneAioRegionsCoW(
      source.detectionsByImage[imageId] ?? [],
      previousRegions,
      cloneRenderStyle,
    ).regions;
    const selected = resolveSnapshotSelectionForImage(
      source,
      imageId,
      regions,
      null,
    );
    const sourceDownload =
      source.aioDownloads.find(
        (entry) => entry.sourceImageId === imageId,
      ) ?? null;
    const downloads = replaceImageDownload(
      target.aioDownloads,
      imageId,
      sourceDownload,
    );
    const regionsChanged = !areAioRegionsEqual(
      previousRegions,
      regions,
      cloneRenderStyle,
    );
    const selectionChanged =
      target.selectedRegionByImage[imageId] !== selected;

    if (
      !regionsChanged &&
      !selectionChanged &&
      downloads === target.aioDownloads
    ) {
      return state;
    }

    const next = [...snapshots];
    next[toStageIndex] = {
      ...target,
      detectionsByImage: regionsChanged
        ? { ...target.detectionsByImage, [imageId]: regions }
        : target.detectionsByImage,
      selectedRegionByImage: selectionChanged
        ? { ...target.selectedRegionByImage, [imageId]: selected }
        : target.selectedRegionByImage,
      aioDownloads: downloads,
    };

    return { aioPipelineSnapshots: next };
  });
}

export function refreshActiveSnapshotImage(
  imageId: string,
  stageIndex: number,
): void {
  const snapshot =
    useAioPipelineStore.getState().aioPipelineSnapshots[stageIndex];

  if (snapshot) applySnapshotRegionsToImage(imageId, snapshot);
}
