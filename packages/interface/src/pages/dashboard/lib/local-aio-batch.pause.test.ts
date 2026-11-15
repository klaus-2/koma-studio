import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBatchPauseGate } from './batch-pause-gate';
import { runLocalAioBatchChunks } from './local-aio-batch';
import { runBatchPauseBoundary } from './batch-pause-boundary';
import {
  useAioBatchPauseStore,
} from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { AioBatchImageResult } from '@/types/dashboard.types';
import type { LocalAioBatchOptions } from './local-aio-batch';
import type { BatchCapacity } from './batch-wire';
import type { BatchMappingImage } from './batch-mapping';
import type {
  PipelineBatchItemResult,
  PipelineBatchReport,
} from '@/types/dashboard.types';
import { createDirectPageFile } from '@/utils/page-source';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '@/utils/customLlm';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';

vi.mock('@/utils/http', () => ({
  fetchWithTimeoutAndRetry: vi.fn(),
}));

const mockedFetch = vi.mocked(
  (await import('@/utils/http')).fetchWithTimeoutAndRetry,
);

const makeImage = (index: number): BatchMappingImage => ({
  id: `image-${index}`,
  file: createDirectPageFile(
    new File([new Uint8Array([index])], `page-${index}.png`, {
      type: 'image/png',
    }),
  ),
  width: 400,
  height: 300,
});

const options: LocalAioBatchOptions = {
  sourceLanguage: 'ja',
  targetLanguage: 'en',
  detectModelKey: 'detector',
  ocrModelKey: 'got_ocr2',
  translationModelKey: 'opus-mt-ja-en',
  segmentModelKey: 'segmenter',
  cleanModelKey: 'cleaner',
  aioSteps: {
    recognizeText: false,
    getTranslations: false,
    segmentText: false,
    cleanImage: false,
    render: false,
  },
  llmSettings: { ...DEFAULT_LLM_REQUEST_SETTINGS },
  maskDilation: 5,
  hdStrategy: 'original',
  hdResizeLimit: 960,
  hdCropMargin: 512,
  hdCropTriggerSize: 512,
  renderDefaultStyle: cloneRenderStyle(),
  gpuStages: {
    detectText: false,
    recognizeText: false,
    segmentText: false,
    cleanImage: false,
  },
  applyDetectedGradientToStyle,
  minRegionSize: 4,
  parseApiError: async () => 'backend said no',
};

const capacity: BatchCapacity = {
  maxImages: 64,
  maxImageBytes: 50 * 1024 * 1024,
  requestedConcurrency: 4,
  effectiveConcurrency: 4,
  perImageBudgetSeconds: 1200,
};

const makeResult = (index: number): PipelineBatchItemResult => ({
  index,
  filename: `page-${index}.png`,
  status: 'success',
  detect: null,
  ocr: null,
  translation: null,
  segment: null,
  clean: {
    output_file: `cleaned/${String(index).padStart(3, '0')}-page-${index}.png`,
  },
  errors: [],
});

const reportForChunk = (count: number, offset: number): PipelineBatchReport => {
  const results = Array.from({ length: count }, (_, index) =>
    makeResult(offset + index),
  );
  return {
    batch_id: `batch-${offset}`,
    total_images: count,
    succeeded: count,
    partial: 0,
    failed: 0,
    stages: {
      detect: true,
      ocr: true,
      translation: true,
      segment: true,
      clean: true,
    },
    results,
    requested_concurrency: 4,
    effective_concurrency: 4,
    concurrency_note: null,
  };
};

const jsonErrorResponse = (): Response =>
  new Response(JSON.stringify({ detail: 'unknown batch' }), { status: 404 });

beforeEach(() => {
  useAioBatchPauseStore.getState().reset();
  useUiShellStore.setState({ processing: false });
  mockedFetch.mockReset();
});

describe('chunk loop pause at the real chunk boundary (Fase D F1, FIX F.1)', () => {
  it('holds between chunks and completes all chunks with ordered batchIds', async () => {
    const images = Array.from({ length: 25 }, (_, index) => makeImage(index));

    const batchIdsSeen: string[] = [];
    let postCalls = 0;
    mockedFetch.mockImplementation((url) => {
      const target = String(url);
      if (target.includes('/pipeline/batch/progress')) {
        return Promise.resolve(jsonErrorResponse());
      }
      postCalls += 1;
      const offset = postCalls === 1 ? 0 : 20;
      const count = postCalls === 1 ? 20 : 5;
      const report = reportForChunk(count, offset);
      if (typeof report.batch_id === 'string') {
        batchIdsSeen.push(report.batch_id);
      }
      return Promise.resolve(
        new Response(JSON.stringify(report), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const gate = createBatchPauseGate(new AbortController().signal);
    const settled: AioBatchImageResult[] = [];
    let boundaries = 0;
    const beforeChunk = async (): Promise<void> => {
      boundaries += 1;
      if (boundaries === 2) {
        useUiShellStore.setState({ processing: true });
        useAioBatchPauseStore.getState().requestPause();
        setTimeout(() => useAioBatchPauseStore.getState().resume(), 20);
      }
      const pause = useAioBatchPauseStore.getState();
      if (!pause.pauseRequested && !pause.isPaused) {
        return;
      }
      await runBatchPauseBoundary({
        gate,
        signal: new AbortController().signal,
        getAccumulatedResults: () => settled,
        consolidate: (results, consolidateOptions) => {
          resultConsolidated = results.length;
          void consolidateOptions;
        },
      });
    };
    let resultConsolidated = 0;

    const run = await runLocalAioBatchChunks({
      localApiUrl: 'http://127.0.0.1:8765/',
      images,
      options,
      capacity,
      signal: new AbortController().signal,
      beforeChunk,
      onChunkSettled: (chunkResults) => {
        settled.push(...chunkResults);
      },
    });

    expect(boundaries).toBe(2);
    expect(postCalls).toBe(2);
    expect(batchIdsSeen).toEqual(['batch-0', 'batch-20']);
    expect(run.batchIds.length).toBe(2);
    expect(new Set(run.batchIds).size).toBe(2);
    expect(run.results.length).toBe(25);
    expect(settled.length).toBe(25);
    expect(useAioBatchPauseStore.getState().isPaused).toBe(false);
    expect(resultConsolidated).toBe(20);
  });
});
