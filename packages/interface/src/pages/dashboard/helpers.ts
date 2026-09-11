import { AIO_MANUAL_STAGE_ORDER } from '../../constants/dashboard.constants';
import {
  clamp,
  parseResponseErrorMessage,
  resolveSelectedRegionForRegions,
} from '../../utils/dashboard.utils';
import type {
  AioManualImageProgress,
  AioManualStageStatus,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
} from '../../types/dashboard.types';

/** Parses the error message out of a fetch `Response` (pure passthrough kept
 * under the same name the page's call sites already use). */
export function parseApiError(response: Response): Promise<string> {
  return parseResponseErrorMessage(response);
}

/** Manual-progress factory for an image starting at `startIndex`. */
export function createAioManualProgressForIndex(
  startIndex: number,
): AioManualImageProgress {
  const boundedStartIndex = clamp(startIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
  const statusByStage = AIO_MANUAL_STAGE_ORDER.reduce<
    Record<AioPipelineSnapshotKey, AioManualStageStatus>
  >(
    (acc, stageKey, index) => {
      if (index < boundedStartIndex) {
        acc[stageKey] = 'done';
      } else if (index === boundedStartIndex) {
        acc[stageKey] = 'pending';
      } else {
        acc[stageKey] = 'locked';
      }
      return acc;
    },
    {} as Record<AioPipelineSnapshotKey, AioManualStageStatus>,
  );
  return {
    currentIndex: boundedStartIndex,
    unlockedMaxIndex: boundedStartIndex,
    statusByStage,
  };
}

/** Manual-progress factory for an image whose auto run completed `completedIndex`. */
export function createAioManualProgressFromAutoIndex(
  completedIndex: number,
): AioManualImageProgress {
  const boundedCompletedIndex = clamp(
    completedIndex,
    0,
    AIO_MANUAL_STAGE_ORDER.length - 1,
  );
  const lastStageIndex = AIO_MANUAL_STAGE_ORDER.length - 1;
  const nextPendingIndex = Math.min(boundedCompletedIndex + 1, lastStageIndex);
  const statusByStage = AIO_MANUAL_STAGE_ORDER.reduce<
    Record<AioPipelineSnapshotKey, AioManualStageStatus>
  >(
    (acc, stageKey, index) => {
      if (index <= boundedCompletedIndex) {
        acc[stageKey] = 'done';
      } else if (index === nextPendingIndex) {
        acc[stageKey] = 'pending';
      } else {
        acc[stageKey] = 'locked';
      }
      return acc;
    },
    {} as Record<AioPipelineSnapshotKey, AioManualStageStatus>,
  );

  return {
    currentIndex: boundedCompletedIndex,
    unlockedMaxIndex: nextPendingIndex,
    statusByStage,
  };
}

/** Resolves the selected region id for `imageId` inside a snapshot, falling
 * back to the current selection when the snapshot has no explicit entry. */
export function resolveSnapshotSelectionForImage(
  snapshot: AioPipelineSnapshot,
  imageId: string,
  regions: AioTextRegion[],
  fallbackSelectedRegionId: string | null,
) {
  const hasExplicitSelection = Object.prototype.hasOwnProperty.call(
    snapshot.selectedRegionByImage,
    imageId,
  );
  const preferredSelection = hasExplicitSelection
    ? (snapshot.selectedRegionByImage[imageId] ?? null)
    : fallbackSelectedRegionId;
  return resolveSelectedRegionForRegions(regions, preferredSelection);
}
