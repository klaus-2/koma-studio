import { beforeEach, describe, expect, it } from 'vitest';

import type { AioBatchProgress } from '@/pages/dashboard/lib/aio-batch-progress';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useEconomicUiStore } from './economic-ui-store';

const STAGED_PROGRESS: AioBatchProgress = {
  chapterIndex: 2,
  chapterCount: 3,
  chapterLabel: 'Chapter 2',
  stageLabel: 'OCR',
  etaSeconds: 42,
};

const NEXT_PROGRESS: AioBatchProgress = {
  chapterIndex: 3,
  chapterCount: 3,
  chapterLabel: 'Chapter 3',
  stageLabel: null,
  etaSeconds: null,
};

const resetStores = (): void => {
  const economic = useEconomicUiStore.getState();
  economic.markVisible();
  economic.clearPending();
  useStatusStore.getState().setStatusMessage('ready');
  useAioPipelineStore.getState().setAioBatchProgress(null);
};

describe('economic-ui-store', () => {
  beforeEach(resetStores);

  it('stages a status message while hidden without writing the status store', () => {
    useEconomicUiStore.getState().markHidden();

    const skipWrite = useEconomicUiStore.getState().stageStatusMessage('staged');

    expect(skipWrite).toBe(true);
    expect(useEconomicUiStore.getState().pendingStatusMessage).toBe('staged');
    expect(useStatusStore.getState().statusMessage).toBe('ready');
  });

  it('stages batch progress while hidden without writing the pipeline store', () => {
    useEconomicUiStore.getState().markHidden();

    const skipWrite =
      useEconomicUiStore.getState().stageBatchProgress(STAGED_PROGRESS);

    expect(skipWrite).toBe(true);
    expect(useEconomicUiStore.getState().pendingBatchProgress).toEqual(
      STAGED_PROGRESS,
    );
    expect(useAioPipelineStore.getState().aioBatchProgress).toBeNull();
  });

  it('keeps only the latest staged value per slot', () => {
    useEconomicUiStore.getState().markHidden();
    const economic = useEconomicUiStore.getState();
    economic.stageStatusMessage('first');
    economic.stageStatusMessage('second');
    economic.stageBatchProgress(STAGED_PROGRESS);
    economic.stageBatchProgress(NEXT_PROGRESS);

    expect(useEconomicUiStore.getState().pendingStatusMessage).toBe('second');
    expect(useEconomicUiStore.getState().pendingBatchProgress).toEqual(
      NEXT_PROGRESS,
    );
  });

  it('does not stage while visible and reports the direct write instead', () => {
    const skipMessage =
      useEconomicUiStore.getState().stageStatusMessage('visible write');
    const skipProgress =
      useEconomicUiStore.getState().stageBatchProgress(STAGED_PROGRESS);

    expect(skipMessage).toBe(false);
    expect(skipProgress).toBe(false);
    expect(useEconomicUiStore.getState().pendingStatusMessage).toBeNull();
    expect(useEconomicUiStore.getState().pendingBatchProgress).toBeNull();
  });

  it('markVisible flips the hidden flag and clearPending empties both slots', () => {
    useEconomicUiStore.getState().markHidden();
    const economic = useEconomicUiStore.getState();
    economic.stageStatusMessage('staged');
    economic.stageBatchProgress(STAGED_PROGRESS);

    expect(useEconomicUiStore.getState().hidden).toBe(true);

    useEconomicUiStore.getState().markVisible();
    expect(useEconomicUiStore.getState().hidden).toBe(false);

    useEconomicUiStore.getState().clearPending();
    expect(useEconomicUiStore.getState().pendingStatusMessage).toBeNull();
    expect(useEconomicUiStore.getState().pendingBatchProgress).toBeNull();
  });
});
