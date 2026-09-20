import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_MANUAL_STAGE_ORDER } from '../../../constants/dashboard.constants';
import {
  createAioManualProgressForIndex,
  createAioManualProgressFromAutoIndex,
  resolveSnapshotSelectionForImage,
} from '../helpers';
import {
  areAioRegionsEqual,
  buildAioSelectionMapFromDetections,
  clamp,
  cloneAioDetectionsMap,
  cloneAioDownloadEntries,
  cloneAioRegionsCoW,
  cloneRenderStyle,
  resolveSelectedRegionForRegions,
} from '../../../utils/dashboard.utils';
import { capitalizeStageLabel } from '../../../utils/dashboardRenderUtils';
import type {
  AioDownloadEntry,
  AioManualImageProgress,
  AioManualStageStatus,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
  SubMode,
} from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

/* ── AIO snapshot history + active-image pipeline state ──
   Snapshot index/meta resolution, manual-mode normalization, rewind/forward,
   and the per-image active progress/stage memos (aio-pipeline + region-editor +
   export stores; labels i18n come from the page by args). */

export function useAioPipelineSnapshotState({
  resolvedActiveId,
  aioPipelineStageLabels,
  aioPipelineStageProgressLabels,
}: {
  resolvedActiveId: string | null;
  aioPipelineStageLabels: Record<AioPipelineSnapshotKey, string>;
  aioPipelineStageProgressLabels: Record<AioPipelineSnapshotKey, string>;
}) {
  const t = useI18n().t;
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const setSubMode = useUiShellStore((s) => s.setSubMode);
  const processing = useUiShellStore((s) => s.processing);
  const progress = useUiShellStore((s) => s.progress);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioExecutionStatus = useAioPipelineStore((s) => s.aioExecutionStatus);
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const aioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.aioPipelineSnapshotIndex,
  );
  const setAioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshotIndex,
  );
  const aioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.aioImageSnapshotIndexById,
  );
  const setAioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.setAioImageSnapshotIndexById,
  );
  const aioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.aioAutoHistoryAvailable,
  );
  const setAioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.setAioAutoProcessedImageById,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const downloadItems = useExportStore((s) => s.downloadItems);
  const setAioDownloadItems = useExportStore((s) => s.setAioDownloadItems);
  const setAioDownloadItemForImage = useExportStore(
    (s) => s.setAioDownloadItemForImage,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const canAioRewind = aioPipelineSnapshotIndex > 0;
  const canAioForward =
    aioPipelineSnapshotIndex >= 0 &&
    aioPipelineSnapshotIndex < aioPipelineSnapshots.length - 1;
  const currentAioDownloadEntries = useMemo<AioDownloadEntry[]>(
    () => {
      const entries: AioDownloadEntry[] = [];
      for (const item of downloadItems) {
        if (item.scope !== 'aio') continue;
        entries.push({
          fileName: item.name,
          blob: item.blob,
          sourceImageId: item.sourceImageId,
        });
      }
      return entries;
    },
    [downloadItems],
  );
  const buildAioImageSnapshotIndexMap = useCallback(
    (index: number): Record<string, number> => {
      if (index < 0) return {};
      const next: Record<string, number> = {};
      images.forEach((img) => {
        next[img.id] = index;
      });
      return next;
    },
    [images],
  );
  const getAioImageSnapshotIndex = useCallback(
    (imageId: string): number => {
      if (mode === 'aio' && subMode === 'manual') {
        const manualProgress = aioManualProgressByImage[imageId];
        if (manualProgress) return manualProgress.currentIndex;
      }
      const explicitIndex = aioImageSnapshotIndexById[imageId];
      if (typeof explicitIndex === 'number') return explicitIndex;
      if (aioPipelineSnapshotIndex >= 0) return aioPipelineSnapshotIndex;
      if (aioPipelineSnapshots.length > 0)
        return aioPipelineSnapshots.length - 1;
      return -1;
    },
    [
      aioImageSnapshotIndexById,
      aioManualProgressByImage,
      aioPipelineSnapshotIndex,
      aioPipelineSnapshots.length,
      mode,
      subMode,
    ],
  );
  const getAioImageSnapshotMeta = useCallback(
    (imageId: string) => {
      if (mode === 'aio' && subMode === 'manual') {
        const manualProgress = aioManualProgressByImage[imageId];
        const index =
          manualProgress?.currentIndex ?? getAioImageSnapshotIndex(imageId);
        const snapshot =
          index >= 0 ? (aioPipelineSnapshots[index] ?? null) : null;
        const canRewind = index > 0;
        const manualForwardCap = manualProgress?.unlockedMaxIndex ?? index;
        const canForward = index >= 0 && index < manualForwardCap;
        const label = snapshot?.label ?? null;
        const key = snapshot?.key ?? null;
        return { index, canRewind, canForward, label, key };
      }
      const index = getAioImageSnapshotIndex(imageId);
      const snapshot =
        index >= 0 ? (aioPipelineSnapshots[index] ?? null) : null;
      const canRewind = index > 0;
      const canForward = index >= 0 && index < aioPipelineSnapshots.length - 1;
      const label = snapshot?.label ?? null;
      const key = snapshot?.key ?? null;
      return { index, canRewind, canForward, label, key };
    },
    [
      aioManualProgressByImage,
      aioPipelineSnapshots,
      getAioImageSnapshotIndex,
      mode,
      subMode,
    ],
  );
  const getAioFallbackStageKey = useCallback((): AioPipelineSnapshotKey => {
    if (aioSteps.render) return 'render';
    if (aioSteps.cleanImage) return 'cleanImage';
    if (aioSteps.segmentText) return 'segmentText';
    if (aioSteps.getTranslations) return 'getTranslations';
    if (aioSteps.recognizeText) return 'recognizeText';
    return 'detectText';
  }, [
    aioSteps.cleanImage,
    aioSteps.getTranslations,
    aioSteps.recognizeText,
    aioSteps.render,
    aioSteps.segmentText,
  ]);
  const resolveAioStageKeyForImage = useCallback(
    (imageId: string): AioPipelineSnapshotKey => {
      if (mode === 'aio' && subMode === 'manual') {
        const manualProgress = aioManualProgressByImage[imageId];
        if (manualProgress) {
          const normalizedIndex = clamp(
            manualProgress.currentIndex,
            0,
            AIO_MANUAL_STAGE_ORDER.length - 1,
          );
          return AIO_MANUAL_STAGE_ORDER[normalizedIndex] ?? getAioFallbackStageKey();
        }
      }
      const { key } = getAioImageSnapshotMeta(imageId);
      return key ?? getAioFallbackStageKey();
    },
    [
      aioManualProgressByImage,
      getAioFallbackStageKey,
      getAioImageSnapshotMeta,
      mode,
      subMode,
    ],
  );
  const normalizeAioPipelineSnapshotsForManualMode = useCallback(
    (snapshots: AioPipelineSnapshot[]): AioPipelineSnapshot[] => {
      const fallbackDetections = cloneAioDetectionsMap(
        aioDetectionsByImage,
        cloneRenderStyle,
      );
      images.forEach((image) => {
        if (!fallbackDetections[image.id]) {
          fallbackDetections[image.id] = [];
        }
      });
      const fallbackSelection = {
        ...buildAioSelectionMapFromDetections(fallbackDetections),
        ...aioSelectedRegionByImage,
      };
      const snapshotsByKey = new Map<
        AioPipelineSnapshotKey,
        AioPipelineSnapshot
      >();
      snapshots.forEach((snapshot) => {
        snapshotsByKey.set(snapshot.key, snapshot);
      });

      let lastDetections = fallbackDetections;
      let lastSelection = fallbackSelection;
      let lastDownloads = cloneAioDownloadEntries(currentAioDownloadEntries);

      return AIO_MANUAL_STAGE_ORDER.map((stageKey) => {
        const existing = snapshotsByKey.get(stageKey);
        if (existing) {
          lastDetections = cloneAioDetectionsMap(
            existing.detectionsByImage,
            cloneRenderStyle,
          );
          images.forEach((image) => {
            if (!lastDetections[image.id]) {
              lastDetections[image.id] = [];
            }
          });
          lastSelection = { ...existing.selectedRegionByImage };
          lastDownloads = cloneAioDownloadEntries(existing.aioDownloads);
          return {
            key: stageKey,
            label: aioPipelineStageLabels[stageKey],
            detectionsByImage: cloneAioDetectionsMap(
              lastDetections,
              cloneRenderStyle,
            ),
            selectedRegionByImage: { ...lastSelection },
            aioDownloads: cloneAioDownloadEntries(lastDownloads),
          };
        }

        const generatedDownloads =
          stageKey === 'cleanImage' || stageKey === 'render'
            ? cloneAioDownloadEntries(lastDownloads)
            : [];
        return {
          key: stageKey,
          label: aioPipelineStageLabels[stageKey],
          detectionsByImage: cloneAioDetectionsMap(
            lastDetections,
            cloneRenderStyle,
          ),
          selectedRegionByImage: { ...lastSelection },
          aioDownloads: generatedDownloads,
        };
      });
    },
    [
      aioDetectionsByImage,
      aioSelectedRegionByImage,
      currentAioDownloadEntries,
      images,
    ],
  );
  const initializeManualProgressFromSnapshots = useCallback(
    (
      snapshots: AioPipelineSnapshot[],
      snapshotIndexByImage: Record<string, number>,
    ): Record<string, AioManualImageProgress> => {
      if (snapshots.length === 0) return {};
      const next: Record<string, AioManualImageProgress> = {};
      images.forEach((image) => {
        const explicitIndex = aioAutoHistoryAvailable
          ? snapshotIndexByImage[image.id]
          : undefined;
        if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
          next[image.id] = createAioManualProgressFromAutoIndex(
            clamp(explicitIndex, 0, snapshots.length - 1),
          );
          return;
        }
        next[image.id] = createAioManualProgressForIndex(0);
      });
      return next;
    },
    [
      aioAutoHistoryAvailable,
      images,
    ],
  );
  const handleAioSubModeChange = useCallback(
    (nextMode: SubMode) => {
      if (nextMode === subMode) return;

      if (nextMode === 'manual') {
        const normalizedSnapshots =
          normalizeAioPipelineSnapshotsForManualMode(aioPipelineSnapshots);
        const fallbackIndex =
          normalizedSnapshots.length > 0
            ? activeId
              ? (aioImageSnapshotIndexById[activeId] ?? 0)
              : 0
            : -1;
        const normalizedImageIndexById: Record<string, number> = {};
        const autoHistoryImageIds: Record<string, boolean> = {};
        images.forEach((image) => {
          const explicitIndex = aioAutoHistoryAvailable
            ? aioImageSnapshotIndexById[image.id]
            : undefined;
          if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
            normalizedImageIndexById[image.id] = clamp(
              explicitIndex,
              0,
              Math.max(0, normalizedSnapshots.length - 1),
            );
            if (aioAutoHistoryAvailable) {
              autoHistoryImageIds[image.id] = true;
            }
            return;
          }
          normalizedImageIndexById[image.id] = 0;
        });

        const manualProgress = initializeManualProgressFromSnapshots(
          normalizedSnapshots,
          normalizedImageIndexById,
        );
        setAioPipelineSnapshots(normalizedSnapshots);
        setAioImageSnapshotIndexById(normalizedImageIndexById);
        setAioManualProgressByImage(manualProgress);
        if (Object.keys(autoHistoryImageIds).length > 0) {
          setAioAutoProcessedImageById((prev) => ({
            ...prev,
            ...autoHistoryImageIds,
          }));
        }
        setAioPipelineSnapshotIndex(fallbackIndex);

        if (activeId) {
          const activeProgress = manualProgress[activeId];
          if (activeProgress) {
            const snapshot =
              normalizedSnapshots[activeProgress.currentIndex] ?? null;
            if (snapshot) {
            const activeRegions = cloneAioRegionsCoW(
              snapshot.detectionsByImage[activeId] ?? [],
              aioDetectionsByImage[activeId],
              cloneRenderStyle,
            ).regions;
              const activeSelected = resolveSnapshotSelectionForImage(
                snapshot,
                activeId,
                activeRegions,
                aioSelectedRegionByImage[activeId] ?? null,
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
        }
      }

      setSubMode(nextMode);
    },
    [
      activeId,
      aioAutoHistoryAvailable,
      aioImageSnapshotIndexById,
      aioPipelineSnapshots,
      images,
      initializeManualProgressFromSnapshots,
      normalizeAioPipelineSnapshotsForManualMode,
      setAioAutoProcessedImageById,
      setAioDetectionsByImage,
      setAioDownloadItemForImage,
      setAioImageSnapshotIndexById,
      setAioManualProgressByImage,
      setAioPipelineSnapshotIndex,
      setAioPipelineSnapshots,
      setAioSelectedRegionByImage,
      setSubMode,
      subMode,
    ],
  );
  const applyAioPipelineSnapshot = useCallback(
    (snapshot: AioPipelineSnapshot) => {
      setAioDetectionsByImage(
        cloneAioDetectionsMap(snapshot.detectionsByImage, cloneRenderStyle),
      );
      setAioSelectedRegionByImage({ ...snapshot.selectedRegionByImage });
      setAioDownloadItems(snapshot.aioDownloads);
    },
    [setAioDetectionsByImage, setAioDownloadItems, setAioSelectedRegionByImage],
  );
  const applyAioPipelineSnapshotToImage = useCallback(
    (imageId: string, index: number): AioPipelineSnapshot | null => {
      if (index < 0 || index >= aioPipelineSnapshots.length) return null;
      const snapshot = aioPipelineSnapshots[index] ?? null;
      if (!snapshot) return null;

      const regions = cloneAioRegionsCoW(
        snapshot.detectionsByImage[imageId] ?? [],
        aioDetectionsByImage[imageId],
        cloneRenderStyle,
      ).regions;
      const selectedRegionId = resolveSnapshotSelectionForImage(
        snapshot,
        imageId,
        regions,
        aioSelectedRegionByImage[imageId] ?? null,
      );
      setAioDetectionsByImage((prev) => ({ ...prev, [imageId]: regions }));
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: selectedRegionId,
      }));
      const imageDownloadEntry =
        snapshot.aioDownloads.find((item) => item.sourceImageId === imageId) ??
        null;
      setAioDownloadItemForImage(imageId, imageDownloadEntry);
      setAioImageSnapshotIndexById((prev) => ({ ...prev, [imageId]: index }));
      return snapshot;
    },
    [
      aioPipelineSnapshots,
      aioSelectedRegionByImage,
      setAioDetectionsByImage,
      setAioDownloadItemForImage,
      setAioImageSnapshotIndexById,
      setAioSelectedRegionByImage,
    ],
  );
  const setManualCurrentStageForImage = useCallback(
    (imageId: string, nextIndex: number): AioPipelineSnapshot | null => {
      const manualProgress = aioManualProgressByImage[imageId];
      if (!manualProgress) return null;
      const boundedIndex = clamp(
        nextIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      if (boundedIndex > manualProgress.unlockedMaxIndex) return null;
      const snapshot = applyAioPipelineSnapshotToImage(imageId, boundedIndex);
      if (!snapshot) return null;
      setAioManualProgressByImage((prev) => {
        const current = prev[imageId];
        if (!current || current.currentIndex === boundedIndex) return prev;
        return {
          ...prev,
          [imageId]: {
            ...current,
            currentIndex: boundedIndex,
          },
        };
      });
      return snapshot;
    },
    [
      aioManualProgressByImage,
      applyAioPipelineSnapshotToImage,
      setAioManualProgressByImage,
    ],
  );
  const rewindAioPipeline = useCallback(() => {
    if (mode === 'aio' && subMode === 'manual') return;
    if (!canAioRewind) return;
    const nextIndex = aioPipelineSnapshotIndex - 1;
    const snapshot = aioPipelineSnapshots[nextIndex];
    if (!snapshot) return;
    applyAioPipelineSnapshot(snapshot);
    setAioPipelineSnapshotIndex(nextIndex);
    setAioImageSnapshotIndexById(buildAioImageSnapshotIndexMap(nextIndex));
    setStatusMessage(
      t('dashboard.aio.rewind', {
        label: snapshot.label,
        current: nextIndex + 1,
        total: aioPipelineSnapshots.length,
      }),
    );
  }, [
    aioPipelineSnapshotIndex,
    aioPipelineSnapshots,
    applyAioPipelineSnapshot,
    buildAioImageSnapshotIndexMap,
    canAioRewind,
    mode,
    setAioImageSnapshotIndexById,
    setAioPipelineSnapshotIndex,
    setStatusMessage,
    subMode,
  ]);
  const forwardAioPipeline = useCallback(() => {
    if (mode === 'aio' && subMode === 'manual') return;
    if (!canAioForward) return;
    const nextIndex = aioPipelineSnapshotIndex + 1;
    const snapshot = aioPipelineSnapshots[nextIndex];
    if (!snapshot) return;
    applyAioPipelineSnapshot(snapshot);
    setAioPipelineSnapshotIndex(nextIndex);
    setAioImageSnapshotIndexById(buildAioImageSnapshotIndexMap(nextIndex));
    setStatusMessage(
      t('dashboard.aio.forward', {
        label: snapshot.label,
        current: nextIndex + 1,
        total: aioPipelineSnapshots.length,
      }),
    );
  }, [
    aioPipelineSnapshotIndex,
    aioPipelineSnapshots,
    applyAioPipelineSnapshot,
    buildAioImageSnapshotIndexMap,
    canAioForward,
    mode,
    setAioImageSnapshotIndexById,
    setAioPipelineSnapshotIndex,
    setStatusMessage,
    subMode,
  ]);
  const rewindAioPipelineForImage = useCallback(
    (imageId: string) => {
      const currentIndex = getAioImageSnapshotIndex(imageId);
      if (currentIndex <= 0) return;
      const nextIndex = currentIndex - 1;
      const snapshot =
        mode === 'aio' && subMode === 'manual'
          ? setManualCurrentStageForImage(imageId, nextIndex)
          : applyAioPipelineSnapshotToImage(imageId, nextIndex);
      if (!snapshot) return;
      const imageName =
        images.find((img) => img.id === imageId)?.file.name ?? 'image';
      setStatusMessage(
        t('dashboard.aio.rewindImage', {
          imageName,
          label: snapshot.label,
          current: nextIndex + 1,
          total: aioPipelineSnapshots.length,
        }),
      );
    },
    [
      aioPipelineSnapshots.length,
      applyAioPipelineSnapshotToImage,
      getAioImageSnapshotIndex,
      images,
      mode,
      setManualCurrentStageForImage,
      setStatusMessage,
      subMode,
    ],
  );
  const forwardAioPipelineForImage = useCallback(
    (imageId: string) => {
      const currentIndex = getAioImageSnapshotIndex(imageId);
      if (currentIndex < 0) return;
      if (mode !== 'aio' || subMode !== 'manual') {
        if (currentIndex >= aioPipelineSnapshots.length - 1) return;
      } else {
        const manualProgress = aioManualProgressByImage[imageId];
        if (!manualProgress || currentIndex >= manualProgress.unlockedMaxIndex)
          return;
      }
      const nextIndex = currentIndex + 1;
      const snapshot =
        mode === 'aio' && subMode === 'manual'
          ? setManualCurrentStageForImage(imageId, nextIndex)
          : applyAioPipelineSnapshotToImage(imageId, nextIndex);
      if (!snapshot) return;
      const imageName =
        images.find((img) => img.id === imageId)?.file.name ?? 'image';
      setStatusMessage(
        t('dashboard.aio.forwardImage', {
          imageName,
          label: snapshot.label,
          current: nextIndex + 1,
          total: aioPipelineSnapshots.length,
        }),
      );    },
    [
      aioManualProgressByImage,
      aioPipelineSnapshots.length,
      applyAioPipelineSnapshotToImage,
      getAioImageSnapshotIndex,
      images,
      mode,
      setManualCurrentStageForImage,
      setStatusMessage,
      subMode,
    ],
  );
  const patchAioSnapshotStageForImage = useCallback(
    (
      imageId: string,
      stageIndex: number,
      nextRegions: AioTextRegion[],
      downloadEntry?: AioDownloadEntry | null,
    ) => {
      if (stageIndex < 0) return;
      // Clone-on-write against the stage snapshot's committed regions:
      // untouched regions keep identity so snapshot patches stay cheap and
      // downstream identity caches (region model, canvas, memo boxes) hit.
      const { regions: clonedRegions } = cloneAioRegionsCoW(
        nextRegions,
        aioPipelineSnapshots[stageIndex]?.detectionsByImage[imageId],
        cloneRenderStyle,
      );
      const resolvedSelected = resolveSelectedRegionForRegions(
        clonedRegions,
        clonedRegions[0]?.id ?? null,
      );

      setAioPipelineSnapshots((prev) => {
        if (stageIndex >= prev.length) return prev;
        const stageSnapshot = prev[stageIndex];
        if (!stageSnapshot) return prev;

        let nextDownloads = stageSnapshot.aioDownloads;
        if (downloadEntry !== undefined) {
          nextDownloads = stageSnapshot.aioDownloads.filter(
            (entry) => entry.sourceImageId !== imageId,
          );
          if (downloadEntry) {
            nextDownloads = [...nextDownloads, downloadEntry];
          }
        }

        const nextSnapshot: AioPipelineSnapshot = {
          ...stageSnapshot,
          detectionsByImage: {
            ...stageSnapshot.detectionsByImage,
            [imageId]: clonedRegions,
          },
          selectedRegionByImage: {
            ...stageSnapshot.selectedRegionByImage,
            [imageId]: resolvedSelected,
          },
          aioDownloads: nextDownloads,
        };

        const nextState = [...prev];
        nextState[stageIndex] = nextSnapshot;
        return nextState;
      });

      const currentIndex = getAioImageSnapshotIndex(imageId);
      if (currentIndex === stageIndex) {
        setAioDetectionsByImage((prev) => ({
          ...prev,
          [imageId]: clonedRegions,
        }));
        setAioSelectedRegionByImage((prev) => ({
          ...prev,
          [imageId]: resolvedSelected,
        }));
        if (downloadEntry !== undefined) {
          setAioDownloadItemForImage(imageId, downloadEntry ?? null);
        }
      }
    },
    [
      getAioImageSnapshotIndex,
      resolveSelectedRegionForRegions,
      setAioDetectionsByImage,
      setAioDownloadItemForImage,
      setAioPipelineSnapshots,
      setAioSelectedRegionByImage,
    ],
  );
  const syncManualStagePreviewToNextStage = useCallback(
    (imageId: string, fromStageIndex: number, toStageIndex: number) => {
      if (fromStageIndex === toStageIndex) return;
      setAioPipelineSnapshots((prev) => {
        if (fromStageIndex < 0 || toStageIndex < 0) return prev;
        if (fromStageIndex >= prev.length || toStageIndex >= prev.length)
          return prev;
        const sourceSnapshot = prev[fromStageIndex];
        const targetSnapshot = prev[toStageIndex];
        if (!sourceSnapshot || !targetSnapshot) return prev;

        const targetRegions = targetSnapshot.detectionsByImage[imageId] ?? [];
        const sourceRegions = cloneAioRegionsCoW(
          sourceSnapshot.detectionsByImage[imageId] ?? [],
          targetRegions,
          cloneRenderStyle,
        ).regions;
        const sourceHasSelection = Object.prototype.hasOwnProperty.call(
          sourceSnapshot.selectedRegionByImage,
          imageId,
        );
        const targetHasSelection = Object.prototype.hasOwnProperty.call(
          targetSnapshot.selectedRegionByImage,
          imageId,
        );
        const sourceSelected = sourceHasSelection
          ? (sourceSnapshot.selectedRegionByImage[imageId] ?? null)
          : (sourceRegions[0]?.id ?? null);
        const targetSelected = targetHasSelection
          ? (targetSnapshot.selectedRegionByImage[imageId] ?? null)
          : (targetRegions[0]?.id ?? null);
        const sourceDownload =
          sourceSnapshot.aioDownloads.find(
            (entry) => entry.sourceImageId === imageId,
          ) ?? null;
        const targetDownload =
          targetSnapshot.aioDownloads.find(
            (entry) => entry.sourceImageId === imageId,
          ) ?? null;

        const regionsChanged = !areAioRegionsEqual(
          targetRegions,
          sourceRegions,
          cloneRenderStyle,
        );
        const selectedChanged = targetSelected !== sourceSelected;
        const downloadChanged = Boolean(
          sourceDownload &&
          (!targetDownload ||
            targetDownload.fileName !== sourceDownload.fileName ||
            targetDownload.blob !== sourceDownload.blob),
        );

        if (!regionsChanged && !selectedChanged && !downloadChanged) {
          return prev;
        }

        const nextTargetSnapshot: AioPipelineSnapshot = {
          ...targetSnapshot,
          detectionsByImage: regionsChanged
            ? { ...targetSnapshot.detectionsByImage, [imageId]: sourceRegions }
            : targetSnapshot.detectionsByImage,
          selectedRegionByImage: selectedChanged
            ? {
                ...targetSnapshot.selectedRegionByImage,
                [imageId]: sourceSelected,
              }
            : targetSnapshot.selectedRegionByImage,
          aioDownloads:
            downloadChanged && sourceDownload
              ? [
                  ...targetSnapshot.aioDownloads.filter(
                    (entry) => entry.sourceImageId !== imageId,
                  ),
                  sourceDownload,
                ]
              : targetSnapshot.aioDownloads,
        };

        const nextState = [...prev];
        nextState[toStageIndex] = nextTargetSnapshot;
        return nextState;
      });
    },
    [setAioPipelineSnapshots],
  );
  const activeImageSnapshotMeta = useMemo(
    () =>
      resolvedActiveId ? getAioImageSnapshotMeta(resolvedActiveId) : null,
    [getAioImageSnapshotMeta, resolvedActiveId],
  );
  const activeAioStageKey = useMemo<AioPipelineSnapshotKey>(
    () => activeImageSnapshotMeta?.key ?? getAioFallbackStageKey(),
    [activeImageSnapshotMeta?.key, getAioFallbackStageKey],
  );
  const activeManualProgress = useMemo(
    () =>
      resolvedActiveId
        ? (aioManualProgressByImage[resolvedActiveId] ?? null)
        : null,
    [aioManualProgressByImage, resolvedActiveId],
  );
  const activeManualStageStatus = useMemo<AioManualStageStatus | null>(() => {
    if (!activeManualProgress) return null;
    return activeManualProgress.statusByStage[activeAioStageKey] ?? null;
  }, [activeAioStageKey, activeManualProgress]);
  const aioFooterProcessingLabel = useMemo(() => {
    if (mode !== 'aio' || !processing || !aioExecutionStatus) {
      return null;
    }

    const scopeLabel =
      aioExecutionStatus.scope === 'manual' ? t('dashboard.status.aioScopeManual') : t('dashboard.status.aioScopeAuto');
    return `${scopeLabel}: ${aioExecutionStatus.label}`;
  }, [aioExecutionStatus, mode, processing, t]);
  const aioExecuteButtonProcessingLabel = useMemo(() => {
    if (mode !== 'aio' || !processing || !aioExecutionStatus) {
      return `Executando ${Math.round(progress)}%`;
    }

    const stageLabel = aioExecutionStatus.stageKey
      ? capitalizeStageLabel(
          aioPipelineStageProgressLabels[
            aioExecutionStatus.stageKey as AioPipelineSnapshotKey
          ],
        )
      : 'Executando';
    return `${stageLabel} ${Math.round(progress)}%`;
  }, [aioExecutionStatus, mode, processing, progress, aioPipelineStageProgressLabels]);
  const activeImageRenderStageActive = useMemo(() => {
    if (mode !== 'aio') return true;
    if (subMode === 'manual') return activeAioStageKey === 'render';
    if (!aioSteps.render) return true;
    if (!activeImageSnapshotMeta) return true;
    return (
      activeImageSnapshotMeta.key === 'render' ||
      activeImageSnapshotMeta.key === null
    );
  }, [
    activeAioStageKey,
    activeImageSnapshotMeta,
    aioSteps.render,
    mode,
    subMode,
  ]);
  return {
    buildAioImageSnapshotIndexMap,
    getAioImageSnapshotIndex,
    getAioImageSnapshotMeta,
    getAioFallbackStageKey,
    resolveAioStageKeyForImage,
    normalizeAioPipelineSnapshotsForManualMode,
    initializeManualProgressFromSnapshots,
    handleAioSubModeChange,
    applyAioPipelineSnapshotToImage,
    rewindAioPipeline,
    forwardAioPipeline,
    rewindAioPipelineForImage,
    forwardAioPipelineForImage,
    patchAioSnapshotStageForImage,
    syncManualStagePreviewToNextStage,
    activeAioStageKey,
    activeManualProgress,
    activeManualStageStatus,
    aioFooterProcessingLabel,
    aioExecuteButtonProcessingLabel,
    activeImageRenderStageActive,
  };
}
