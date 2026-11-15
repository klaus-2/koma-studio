import type { AioBatchImageResult } from '@/types/dashboard.types';
import { useAioBatchPauseStore } from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { BatchPauseGate } from './batch-pause-gate';

export interface BatchPauseBoundaryOptions {
  readonly gate: BatchPauseGate;
  readonly signal: AbortSignal;
  readonly getAccumulatedResults: () => readonly AioBatchImageResult[];
  readonly consolidate: (
    results: readonly AioBatchImageResult[],
    options?: { skipImageIds?: ReadonlySet<string>; writeSnapshots?: boolean },
  ) => void;
}

export async function runBatchPauseBoundary(
  options: BatchPauseBoundaryOptions,
): Promise<void> {
  const pause = useAioBatchPauseStore.getState();
  if (!pause.pauseRequested && !pause.isPaused) {
    return;
  }

  options.gate.notifyBoundaryReached();

  const accumulated = options.getAccumulatedResults();
  if (accumulated.length > 0) {
    options.consolidate(accumulated, {
      skipImageIds: useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
      writeSnapshots: false,
    });
    useAioBatchPauseStore
      .getState()
      .recordPauseConsolidatedImageIds(
        accumulated.map((result) => result.imageId),
      );
  }

  useUiShellStore.getState().setProcessing(false);
  try {
    await options.gate.waitAtBoundary();
  } finally {
    if (!options.signal.aborted) {
      useUiShellStore.getState().setProcessing(true);
    }
  }
}
