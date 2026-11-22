import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useEconomicUiStore } from '../stores/economic-ui-store';
import { createSingleBatchProgressReporter } from './single-batch-progress';

describe('createSingleBatchProgressReporter', () => {
  beforeEach(() => {
    useAioPipelineStore.setState({ aioBatchProgress: null });
    useEconomicUiStore.setState({
      hidden: false,
      pendingBatchProgress: null,
    });
  });

  it('publishes single-batch progress with the current stage label to the pipeline store', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000);
    nowSpy.mockReturnValueOnce(31_000);
    const reporter = createSingleBatchProgressReporter({
      getStageLabel: () => 'Translating text',
      totalImages: 4,
    });
    reporter.report(3, 12);
    nowSpy.mockRestore();
    const progress = useAioPipelineStore.getState().aioBatchProgress;
    expect(progress?.chapterIndex).toBe(1);
    expect(progress?.chapterCount).toBe(1);
    expect(progress?.chapterLabel).toBe('');
    expect(progress?.stageLabel).toBe('Translating text');
    expect(progress?.etaSeconds).toBe(90);
  });

  it('stages the progress in the economic store while the hidden mode is on', () => {
    useEconomicUiStore.setState({ hidden: true });
    const reporter = createSingleBatchProgressReporter({
      getStageLabel: () => null,
      totalImages: 4,
    });
    reporter.report(0, 12);
    expect(useAioPipelineStore.getState().aioBatchProgress).toBeNull();
    const staged = useEconomicUiStore.getState().pendingBatchProgress;
    expect(staged?.stageLabel).toBeNull();
    expect(staged?.etaSeconds).toBeNull();
  });
});
