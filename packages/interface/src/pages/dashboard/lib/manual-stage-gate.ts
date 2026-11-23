import { AIO_MANUAL_STAGE_ORDER } from '../../../constants/dashboard.constants';
import type { AioManualStageStatus, AioPipelineSnapshotKey } from '../../../types/dashboard.types';

export const isPreviousManualStageFinished = (
  stageIndex: number,
  statusByStage: Partial<Record<AioPipelineSnapshotKey, AioManualStageStatus>>,
): boolean => {
  if (stageIndex <= 0) return false;
  const previousStage = AIO_MANUAL_STAGE_ORDER[stageIndex - 1];
  if (previousStage === undefined) return false;
  const status = statusByStage[previousStage];
  return status === 'done' || status === 'skipped';
};
