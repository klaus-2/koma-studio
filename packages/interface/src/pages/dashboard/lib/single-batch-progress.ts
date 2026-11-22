import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useEconomicUiStore } from '../stores/economic-ui-store';
import { buildSingleBatchProgress } from './aio-batch-progress';

export interface SingleBatchProgressReporterInput {
  readonly getStageLabel: () => string | null;
  readonly totalImages: number;
}

export interface SingleBatchProgressReporter {
  readonly report: (startedUnits: number, totalUnits: number) => void;
}

export const createSingleBatchProgressReporter = (
  input: SingleBatchProgressReporterInput,
): SingleBatchProgressReporter => {
  const runStartedAt = Date.now();
  return {
    report: (startedUnits, totalUnits) => {
      const progress = buildSingleBatchProgress({
        runStartedAt,
        nowMs: Date.now(),
        startedUnits,
        totalUnits,
        totalImages: input.totalImages,
        stageLabel: input.getStageLabel(),
      });
      const economic = useEconomicUiStore.getState();
      if (economic.hidden) {
        economic.stageBatchProgress(progress);
        return;
      }
      useAioPipelineStore.getState().setAioBatchProgress(progress);
    },
  };
};
