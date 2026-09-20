/**
 * AIO region snapshot sync — plumbing region edits into the aio snapshot
 * history (patch snapshots, manual-progress rewind/forward sync). Split out of
 * region-editor.ts (T10); the entry file keeps the region editing hook and
 * re-exports this module.
 */
import { useCallback } from 'react';

import { AIO_MANUAL_STAGE_ORDER } from '../../../constants/dashboard.constants';
import {
  areAioRegionsEqual,
  cloneAioRegion,
  cloneAioRegionsCoW,
  cloneRenderStyle,
  resolveSelectedRegionForRegions,
} from '../../../utils/dashboard.utils';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { useTypographerWorkspace } from './typographer';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useUiShellStore } from '../stores/ui-shell-store';

type TypographerWorkspaceApi = ReturnType<typeof useTypographerWorkspace>;

/* ── Snapshot sync: region edits plumbed into the aio snapshot history ── */

interface UseAioRegionSnapshotSyncArgs {
  /* Page callbacks */
  getAioImageSnapshotIndex: (imageId: string) => number;
  syncManualStagePreviewToNextStage: (
    imageId: string,
    fromStageIndex: number,
    toStageIndex: number,
  ) => void;
  typographerWorkspace: TypographerWorkspaceApi;
}

export function useAioRegionSnapshotSync({
  getAioImageSnapshotIndex,
  syncManualStagePreviewToNextStage,
  typographerWorkspace,
}: UseAioRegionSnapshotSyncArgs) {
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);

  const patchAioSnapshotsForImageEdit = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionId: string | null,
    ) => {
      const snapshotIndex = getAioImageSnapshotIndex(imageId);
      if (snapshotIndex < 0) return;
      setAioPipelineSnapshots((prev) => {
        if (prev.length === 0 || snapshotIndex >= prev.length) return prev;
        let changed = false;
        const nextSnapshots = prev.map((snapshot, index) => {
          if (index < snapshotIndex) return snapshot;
          const snapshotRegions = snapshot.detectionsByImage[imageId] ?? [];
          const snapshotSelected =
            snapshot.selectedRegionByImage[imageId] ?? null;
          const snapshotById = new Map(
            snapshotRegions.map((region) => [region.id, region]),
          );
          // Identity fast path: regions the snapshot already shares with the
          // committed state are reused as-is; only genuinely merged regions
          // are copied. A merge that reuses every element identity is
          // content-equal by construction and skips the deep compare.
          let mergedChanged = false;
          const mergedSnapshotRegions = nextRegions.map((region) => {
            const existing = snapshotById.get(region.id);
            if (existing === region) return existing;
            mergedChanged = true;
            if (!existing) return cloneAioRegion(region, cloneRenderStyle);
            const merged = {
              ...existing,
              ...region,
              bbox: [...region.bbox] as [number, number, number, number],
              segmentBoxes:
                region.segmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ) ??
                existing.segmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ),
              mergedSegmentBoxes:
                region.mergedSegmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ) ??
                existing.mergedSegmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ),
              renderStyle: region.renderStyle
                ? cloneRenderStyle(region.renderStyle)
                : existing.renderStyle
                  ? cloneRenderStyle(existing.renderStyle)
                  : undefined,
            };
            return areAioRegionsEqual([existing], [merged], cloneRenderStyle)
              ? existing
              : merged;
          });
          const resolvedSelected =
            selectedRegionId === null ? null : selectedRegionId;
          const regionsChanged = mergedChanged
            ? !areAioRegionsEqual(
                snapshotRegions,
                mergedSnapshotRegions,
                cloneRenderStyle,
              )
            : false;
          const selectedChanged = snapshotSelected !== resolvedSelected;
          if (!regionsChanged && !selectedChanged) return snapshot;
          changed = true;
          return {
            ...snapshot,
            detectionsByImage: regionsChanged
              ? {
                  ...snapshot.detectionsByImage,
                  [imageId]: mergedSnapshotRegions,
                }
              : snapshot.detectionsByImage,
            selectedRegionByImage: selectedChanged
              ? {
                  ...snapshot.selectedRegionByImage,
                  [imageId]: resolvedSelected,
                }
              : snapshot.selectedRegionByImage,
          };
        });
        return changed ? nextSnapshots : prev;
      });
    },
    [getAioImageSnapshotIndex, resolveSelectedRegionForRegions, setAioPipelineSnapshots],
  );

  const patchAioSnapshotSelectionForImage = useCallback(
    (imageId: string, selectedRegionId: string | null) => {
      const snapshotIndex = getAioImageSnapshotIndex(imageId);
      if (snapshotIndex < 0) return;
      setAioPipelineSnapshots((prev) => {
        if (prev.length === 0 || snapshotIndex >= prev.length) return prev;
        let changed = false;
        const nextSnapshots = prev.map((snapshot, index) => {
          if (index < snapshotIndex) return snapshot;
          const snapshotSelected =
            snapshot.selectedRegionByImage[imageId] ?? null;
          const resolvedSelected = selectedRegionId;
          if (snapshotSelected === resolvedSelected) return snapshot;
          changed = true;
          return {
            ...snapshot,
            selectedRegionByImage: {
              ...snapshot.selectedRegionByImage,
              [imageId]: resolvedSelected,
            },
          };
        });
        return changed ? nextSnapshots : prev;
      });
    },
    [getAioImageSnapshotIndex, setAioPipelineSnapshots],
  );

  const applyAioRegionsEditForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const currentRegions = aioDetectionsByImage[imageId] ?? [];
      const currentSelected = aioSelectedRegionByImage[imageId] ?? null;
      // Clone-on-write: untouched regions keep their identity so the
      // downstream caches stay warm and the store diff stays cheap.
      const { regions: clonedRegions, changed: regionsChanged } =
        cloneAioRegionsCoW(nextRegions, currentRegions, cloneRenderStyle);
      const hasSelectedOverride = selectedRegionIdOverride !== undefined;
      const resolvedSelected = hasSelectedOverride
        ? selectedRegionIdOverride === null
          ? null
          : resolveSelectedRegionForRegions(
              clonedRegions,
              selectedRegionIdOverride,
            )
        : currentSelected === null
          ? null
          : resolveSelectedRegionForRegions(clonedRegions, currentSelected);

      const selectedChanged = currentSelected !== resolvedSelected;
      if (!regionsChanged && !selectedChanged) return;

      setAioDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
      patchAioSnapshotsForImageEdit(imageId, clonedRegions, resolvedSelected);
    },
    [
      aioDetectionsByImage,
      aioSelectedRegionByImage,
      patchAioSnapshotsForImageEdit,
      resolveSelectedRegionForRegions,
      setAioDetectionsByImage,
      setAioSelectedRegionByImage,
    ],
  );

  const unlockManualDetectStageIfReady = useCallback(
    (imageId: string, nextRegions: AioTextRegion[]) => {
      if (mode !== 'aio' || subMode !== 'manual') return;
      if (nextRegions.length === 0) return;

      const detectStageIndex = AIO_MANUAL_STAGE_ORDER.indexOf('detectText');
      if (detectStageIndex < 0) return;
      const nextStageIndex = Math.min(
        detectStageIndex + 1,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      if (nextStageIndex === detectStageIndex) return;

      const currentProgress = aioManualProgressByImage[imageId];
      if (!currentProgress || currentProgress.currentIndex !== detectStageIndex)
        return;

      syncManualStagePreviewToNextStage(
        imageId,
        detectStageIndex,
        nextStageIndex,
      );

      setAioManualProgressByImage((prev) => {
        const progress = prev[imageId];
        if (!progress || progress.currentIndex !== detectStageIndex)
          return prev;

        const detectStageKey = AIO_MANUAL_STAGE_ORDER[detectStageIndex];
        const nextStageKey = AIO_MANUAL_STAGE_ORDER[nextStageIndex];
        if (!detectStageKey || !nextStageKey) return prev;
        const nextUnlockedIndex = Math.max(
          progress.unlockedMaxIndex,
          nextStageIndex,
        );
        const nextStatusByStage = { ...progress.statusByStage };
        let changed = false;

        if (nextStatusByStage[detectStageKey] !== 'done') {
          nextStatusByStage[detectStageKey] = 'done';
          changed = true;
        }
        if (nextStatusByStage[nextStageKey] === 'locked') {
          nextStatusByStage[nextStageKey] = 'pending';
          changed = true;
        }
        if (nextUnlockedIndex !== progress.unlockedMaxIndex) {
          changed = true;
        }
        if (!changed) return prev;

        return {
          ...prev,
          [imageId]: {
            ...progress,
            unlockedMaxIndex: nextUnlockedIndex,
            statusByStage: nextStatusByStage,
          },
        };
      });
    },
    [
      aioManualProgressByImage,
      mode,
      setAioManualProgressByImage,
      subMode,
      syncManualStagePreviewToNextStage,
    ],
  );

  const updateAioRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      applyAioRegionsEditForImage(
        imageId,
        nextRegions,
        selectedRegionIdOverride,
      );
      unlockManualDetectStageIfReady(imageId, nextRegions);
    },
    [applyAioRegionsEditForImage, unlockManualDetectStageIfReady],
  );

  const selectAioRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const resolvedSelected = regionId;
      setAioSelectedRegionByImage((prev) => {
        if ((prev[imageId] ?? null) === resolvedSelected) return prev;
        return { ...prev, [imageId]: resolvedSelected };
      });
      typographerWorkspace.setSelectedRegionId(imageId, resolvedSelected);
      patchAioSnapshotSelectionForImage(imageId, resolvedSelected);
    },
    [patchAioSnapshotSelectionForImage, setAioSelectedRegionByImage, typographerWorkspace],
  );

  return {
    applyAioRegionsEditForImage,
    selectAioRegionForImage,
    updateAioRegionsForImage,
  };
}
