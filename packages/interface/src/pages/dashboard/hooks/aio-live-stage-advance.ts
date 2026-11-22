import { AIO_MANUAL_STAGE_ORDER } from '@/constants/dashboard.constants';
import { createAioManualProgressForIndex } from '@/pages/dashboard/helpers';
import {
  applyAioPipelineSnapshotToImage,
  patchAioSnapshotStageForImage,
} from '@/pages/dashboard/hooks/aio-snapshot.commands';
import { normalizeSnapshotsForManualMode } from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import type {
  AioDownloadEntry,
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
} from '@/types/dashboard.types';
import { cloneAioRegions, cloneRenderStyle } from '@/utils/dashboard.utils';

interface LiveStageAdvanceContext {
  readonly labels: Readonly<Record<AioPipelineSnapshotKey, string>>;
}

/**
 * Mirrors the manual mode's per-stage canvas advance during a live AIO run:
 * normalizes the snapshot timeline to the six manual slots once, patches the
 * stage's slot with the fresh regions (and the clean download entry when the
 * stage produced one), applies the slot to the focused canvas image, and
 * advances the per-image stage progress that drives the canvas stage header.
 * Called on stage START (regions = null: the slot inherits the editor state)
 * and on stage COMPLETE (regions = the stage output).
 */
export function advanceLiveStageView(
  { labels }: LiveStageAdvanceContext,
  stageKey: AioPipelineSnapshotKey,
  image: LoadedImage,
  regions: AioTextRegion[] | null,
  download?: AioDownloadEntry | null,
): void {
  const stageIndex = AIO_MANUAL_STAGE_ORDER.indexOf(stageKey);
  if (stageIndex < 0) {
    return;
  }
  let pipelineState = useAioPipelineStore.getState();
  if (
    pipelineState.aioPipelineSnapshots.length !== AIO_MANUAL_STAGE_ORDER.length ||
    AIO_MANUAL_STAGE_ORDER.some(
      (stage, index) => pipelineState.aioPipelineSnapshots[index]?.key !== stage,
    )
  ) {
    pipelineState.setAioPipelineSnapshots(
      normalizeSnapshotsForManualMode({
        snapshots: pipelineState.aioPipelineSnapshots,
        imageIds: useImageCollectionStore
          .getState()
          .images.map((item) => item.id),
        labels,
        fallbackDetections: useRegionEditorStore.getState().aioDetectionsByImage,
        fallbackSelection: useRegionEditorStore.getState().aioSelectedRegionByImage,
        fallbackDownloads: [],
      }),
    );
    pipelineState = useAioPipelineStore.getState();
  }
  const stageRegions =
    regions ?? useRegionEditorStore.getState().aioDetectionsByImage[image.id] ?? [];
  patchAioSnapshotStageForImage(
    image.id,
    stageIndex,
    cloneAioRegions(stageRegions, cloneRenderStyle),
    download ?? undefined,
  );
  const canvasImageId = useImageCollectionStore.getState().activeId;
  if (canvasImageId === image.id) {
    applyAioPipelineSnapshotToImage(canvasImageId, stageIndex);
  }
  pipelineState.setAioManualProgressByImage((prev) => {
    const current = prev[image.id] ?? createAioManualProgressForIndex(0);
    return {
      ...prev,
      [image.id]: {
        ...current,
        currentIndex: stageIndex,
        unlockedMaxIndex:
          regions !== null
            ? Math.max(current.unlockedMaxIndex, stageIndex)
            : current.unlockedMaxIndex,
        statusByStage: {
          ...current.statusByStage,
          [stageKey]: regions !== null ? 'done' : 'pending',
        },
      },
    };
  });
}
