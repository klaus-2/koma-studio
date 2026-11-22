import { beforeEach, describe, expect, it } from 'vitest';

import type { PipelineBatchItemResult } from '@/types/dashboard.types';
import type { BatchProgress } from '@/pages/dashboard/lib/batch-wire';
import {
  deriveLocalProviderLabel,
  useAioStageTimingStore,
} from './aio-stage-timing-store';

const wireProgress = (overrides: Partial<BatchProgress>): BatchProgress => ({
  batchId: 'chunk-1',
  total: 4,
  completed: 0,
  failed: 0,
  stageUnitsStarted: 0,
  currentIndex: 0,
  currentName: '',
  currentStage: null,
  cancelled: false,
  finished: false,
  updatedAt: '2026-11-14T00:00:00.000Z',
  stageSeconds: null,
  lastStageMs: null,
  ...overrides,
});

const resetStore = (): void => {
  useAioStageTimingStore.getState().resetForRun();
};

beforeEach(resetStore);

describe('aio-stage-timing-store', () => {
  it('accumulates per-poll deltas into chapter buckets', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-1',
        stageSeconds: { detect: 1.0, ocr: 0.5 },
      }),
      'ch-1',
      'Chapter 1',
    );
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-1',
        stageSeconds: { detect: 2.5, ocr: 0.5, clean: 1.0 },
        completed: 1,
      }),
      'ch-1',
      'Chapter 1',
    );

    const state = useAioStageTimingStore.getState();
    expect(state.chapters['ch-1']?.stageSeconds).toEqual({
      detect: 2.5,
      ocr: 0.5,
      clean: 1.0,
    });
    expect(state.chapterOrder).toEqual(['ch-1']);
    expect(state.totals).toEqual({ detect: 2.5, ocr: 0.5, clean: 1.0 });
    expect(state.bottleneck).toBe('detect');
    expect(state.lastStageMs).toBeNull();
  });

  it('starts a fresh cumulative baseline when the backend entry changes', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-1',
        stageSeconds: { ocr: 5.0 },
        lastStageMs: 500,
      }),
      'ch-1',
      'Chapter 1',
    );
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-2',
        stageSeconds: { ocr: 1.5 },
        lastStageMs: 250,
        completed: 2,
      }),
      'ch-1',
      'Chapter 1',
    );

    const state = useAioStageTimingStore.getState();
    expect(state.chapters['ch-1']?.stageSeconds['ocr']).toBe(6.5);
    expect(state.lastStageMs).toBe(250);
  });

  it('keeps separate buckets per chapter in insertion order', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestWireProgress(
      wireProgress({ batchId: 'a', stageSeconds: { ocr: 1.0 } }),
      'ch-2',
      'Chapter 2',
    );
    store.ingestWireProgress(
      wireProgress({ batchId: 'b', stageSeconds: { ocr: 2.0 } }),
      'ch-1',
      'Chapter 1',
    );

    const state = useAioStageTimingStore.getState();
    expect(state.chapterOrder).toEqual(['ch-2', 'ch-1']);
    expect(state.chapters['ch-1']?.label).toBe('Chapter 1');
    expect(state.chapters['ch-2']?.stageSeconds['ocr']).toBe(1.0);
    expect(state.totals['ocr']).toBe(3.0);
  });

  it('flags the translation cache hit for a chapter with no translation time', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-1',
        stageSeconds: { detect: 1.0, translation: 0 },
        completed: 2,
      }),
      'ch-1',
      'Chapter 1',
    );

    expect(useAioStageTimingStore.getState().cacheHitDetected).toBe(true);
  });

  it('does not flag a cache hit while translation time is being accumulated', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-1',
        stageSeconds: { detect: 1.0, translation: 3.5 },
        completed: 2,
      }),
      'ch-1',
      'Chapter 1',
    );

    expect(useAioStageTimingStore.getState().cacheHitDetected).toBe(false);
  });

  it('ignores legacy payloads without stageSeconds', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestWireProgress(wireProgress({ stageSeconds: null }), 'ch-1', 'c1');

    const state = useAioStageTimingStore.getState();
    expect(state.chapterOrder).toEqual([]);
    expect(state.bottleneck).toBeNull();
  });

  it('resetForRun clears buckets, totals, provider line and flags', () => {
    const store = useAioStageTimingStore.getState();
    store.setProviderLine('cpu.executionprovider', 'local');
    store.ingestWireProgress(
      wireProgress({
        batchId: 'chunk-1',
        stageSeconds: { ocr: 2.0 },
        completed: 1,
      }),
      'ch-1',
      'Chapter 1',
    );

    useAioStageTimingStore.getState().resetForRun();

    const state = useAioStageTimingStore.getState();
    expect(state.chapterOrder).toEqual([]);
    expect(state.chapters).toEqual({});
    expect(state.totals).toEqual({});
    expect(state.bottleneck).toBeNull();
    expect(state.providerLabel).toBeNull();
    expect(state.providerKind).toBeNull();
    expect(state.cacheHitDetected).toBe(false);
  });

  it('setProviderLine stores the local and cloud lines', () => {
    useAioStageTimingStore.getState().setProviderLine('cuda · gpu-profile', 'local');
    expect(useAioStageTimingStore.getState().providerKind).toBe('local');

    useAioStageTimingStore.getState().setProviderLine('google-cloud-vision', 'cloud');
    const state = useAioStageTimingStore.getState();
    expect(state.providerKind).toBe('cloud');
    expect(state.providerLabel).toBe('google-cloud-vision');
  });
});

describe('aio-stage-timing-store ingestReportItems (Fase C C4)', () => {
  const makeReportItem = (
    index: number,
    overrides: Partial<PipelineBatchItemResult> = {},
  ): PipelineBatchItemResult => ({
    index,
    filename: `page-${index + 1}.png`,
    status: 'success',
    ...overrides,
  });

  it('collects one page per report item carrying stage timings, in index order', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestReportItems('batch-1', [
      makeReportItem(1, { stage_timings: { ocr: 2.5 } }),
      makeReportItem(0, { stage_timings: { detect: 1 } }),
      makeReportItem(2, {}),
    ]);

    const state = useAioStageTimingStore.getState();
    expect(state.pages).toEqual([
      {
        key: 'batch-1:0',
        batchId: 'batch-1',
        index: 0,
        filename: 'page-1.png',
        stageSeconds: { detect: 1 },
      },
      {
        key: 'batch-1:1',
        batchId: 'batch-1',
        index: 1,
        filename: 'page-2.png',
        stageSeconds: { ocr: 2.5 },
      },
    ]);
    expect(state.reportBatchId).toBe('batch-1');
    expect(state.reportCapturedAt).not.toBeNull();
  });

  it('upserts by batch id and index instead of duplicating pages', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestReportItems('batch-1', [
      makeReportItem(0, { stage_timings: { detect: 1 } }),
    ]);
    store.ingestReportItems('batch-1', [
      makeReportItem(0, { stage_timings: { detect: 2, ocr: 3 } }),
    ]);

    const state = useAioStageTimingStore.getState();
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0]?.stageSeconds).toEqual({ detect: 2, ocr: 3 });
  });

  it('appends pages from the next chunk batch after the current ones', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestReportItems('chunk-1', [
      makeReportItem(0, { stage_timings: { detect: 1 } }),
    ]);
    store.ingestReportItems('chunk-2', [
      makeReportItem(0, { stage_timings: { detect: 1.5 } }),
    ]);

    const state = useAioStageTimingStore.getState();
    expect(state.pages.map((page) => page.key)).toEqual([
      'chunk-1:0',
      'chunk-2:0',
    ]);
    expect(state.reportBatchId).toBe('chunk-2');
  });

  it('keeps an empty page list when no report item carries timings', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestReportItems('batch-1', [
      makeReportItem(0),
      makeReportItem(1, { stage_timings: {} }),
    ]);

    const state = useAioStageTimingStore.getState();
    expect(state.pages).toEqual([]);
    expect(state.reportBatchId).toBeNull();
    expect(state.reportCapturedAt).toBeNull();
  });

  it('resetForRun clears report pages and header fields', () => {
    const store = useAioStageTimingStore.getState();
    store.ingestReportItems('batch-1', [
      makeReportItem(0, { stage_timings: { detect: 1 } }),
    ]);

    useAioStageTimingStore.getState().resetForRun();

    const state = useAioStageTimingStore.getState();
    expect(state.pages).toEqual([]);
    expect(state.reportBatchId).toBeNull();
    expect(state.reportCapturedAt).toBeNull();
  });
});

describe('deriveLocalProviderLabel', () => {
  const baseDevice = {
    name: 'RTX 4070',
    has_gpu: true,
    provider: 'cuda.executionprovider',
    vram_gb: 12,
  };

  it('joins provider and profile when a profile exists', () => {
    expect(
      deriveLocalProviderLabel({ ...baseDevice, profile: 'gpu-profile' }),
    ).toBe('cuda.executionprovider · gpu-profile');
  });

  it('returns the bare provider without a profile', () => {
    expect(deriveLocalProviderLabel({ ...baseDevice, profile: null })).toBe(
      'cuda.executionprovider',
    );
  });

  it('returns null before the device sync', () => {
    expect(deriveLocalProviderLabel(null)).toBeNull();
  });
});
