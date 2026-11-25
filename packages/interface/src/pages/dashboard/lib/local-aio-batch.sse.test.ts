import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PipelineBatchReport } from '@/types/dashboard.types';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '@/utils/http';
import { createDirectPageFile } from '@/utils/page-source';
import type { BatchMappingImage } from './batch-mapping';
import {
  LocalAioBatchError,
  type BatchCapacity,
  type BatchProgress,
} from './batch-wire';
import {
  runLocalAioBatch,
  startBatchProgressStream,
  type BatchPageStreamEvent,
  type LocalAioBatchOptions,
} from './local-aio-batch';

vi.mock('@/utils/http', () => ({
  fetchWithTimeoutAndRetry: vi.fn(),
}));

const mockedFetchWithRetry = vi.mocked(fetchWithTimeoutAndRetry);

const makeProgress = (overrides: Partial<BatchProgress> = {}): BatchProgress => ({
  batchId: 'sse-batch-1',
  total: 2,
  completed: 1,
  failed: 0,
  stageUnitsStarted: 2,
  currentIndex: 1,
  currentName: 'page-1.png',
  currentStage: 'clean',
  cancelled: false,
  finished: false,
  updatedAt: '2026-11-25T12:00:00Z',
  stageSeconds: null,
  lastStageMs: null,
  ...overrides,
});

const makeSseStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
};

const flushAsync = async (turns = 8): Promise<void> => {
  for (let i = 0; i < turns; i += 1) {
    await Promise.resolve();
  }
};

const makeImage = (index: number): BatchMappingImage => ({
  id: `image-${index}`,
  file: createDirectPageFile(
    new File([new Uint8Array([index])], `page-${index}.png`, { type: 'image/png' }),
  ),
  width: 400,
  height: 300,
});

const makeCapacity = (): BatchCapacity => ({
  maxImages: 64,
  maxImageBytes: 50 * 1024 * 1024,
  requestedConcurrency: 8,
  effectiveConcurrency: 4,
  perImageBudgetSeconds: 1200,
});

const makeOptions = (
  overrides: Partial<LocalAioBatchOptions> = {},
): LocalAioBatchOptions => ({
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
  llmSettings: {
    extra_context: '',
    image_input_enabled: false,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 1024,
    translation_notes_enabled: false,
    neighbor_image_context_enabled: false,
    translation_memory_enabled: false,
    glossary: [],
  },
  maskDilation: 5,
  hdStrategy: 'original',
  hdResizeLimit: 960,
  hdCropMargin: 512,
  hdCropTriggerSize: 512,
  renderDefaultStyle: cloneRenderStyle(),
  typographyPresetState: {
    version: 1,
    folders: [],
    presets: [],
    modeBindings: {},
    defaultPresetId: null,
  },
  applyDetectedGradientToStyle,
  minRegionSize: 4,
  parseApiError: async () => 'backend error',
  ...overrides,
});

describe('startBatchProgressStream', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('streams progress, page, keepalive comments, and terminal done events', async () => {
    const sseBody = makeSseStream([
      `event: progress\ndata: ${JSON.stringify(makeProgress())}\n\n`,
      ': keepalive\n\n',
      `event: page\ndata: ${JSON.stringify({
        index: 1,
        filename: 'page-1.png',
        status: 'success',
        errors: [],
        has_cleaned: true,
        cleaned_url: '/pipeline/batch/sse-batch-1/cleaned/1',
      })}\n\n`,
      `event: done\ndata: ${JSON.stringify(
        makeProgress({ completed: 2, finished: true, currentStage: '' }),
      )}\n\n`,
    ]);

    fetchSpy.mockResolvedValueOnce(
      new Response(sseBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const updates: BatchProgress[] = [];
    const pages: BatchPageStreamEvent[] = [];
    const errors: LocalAioBatchError[] = [];
    const controller = new AbortController();

    const stop = startBatchProgressStream({
      localApiUrl: 'http://127.0.0.1:4123/',
      batchId: 'sse-batch-1',
      signal: controller.signal,
      headers: { 'x-koma-local-session': 'tok-123' },
      onUpdate: (progress) => updates.push(progress),
      onPageResult: (page) => pages.push(page),
      onError: (err) => errors.push(err),
    });

    await flushAsync(16);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchSpy.mock.calls[0];
    expect(requestUrl).toBe('http://127.0.0.1:4123/pipeline/batch/sse-batch-1/events');
    expect(new Headers(requestInit?.headers).get('x-koma-local-session')).toBe('tok-123');
    expect(new Headers(requestInit?.headers).get('accept')).toBe('text/event-stream');

    expect(updates).toHaveLength(2);
    expect(updates[0]?.currentStage).toBe('clean');
    expect(updates[1]?.finished).toBe(true);

    expect(pages).toHaveLength(1);
    expect(pages[0]?.item.index).toBe(1);
    expect(pages[0]?.hasCleaned).toBe(true);
    expect(pages[0]?.cleanedUrl).toBe('/pipeline/batch/sse-batch-1/cleaned/1');
    expect(errors).toEqual([]);

    stop();
  });

  it('falls back to polling when /events returns 404 or lacks ReadableStream body', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeProgress({ completed: 2, finished: true })),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const updates: BatchProgress[] = [];
    const controller = new AbortController();
    const stop = startBatchProgressStream({
      localApiUrl: 'http://127.0.0.1:4123',
      batchId: 'sse-batch-1',
      signal: controller.signal,
      pollIntervalMs: 10,
      onUpdate: (progress) => updates.push(progress),
    });

    await flushAsync(16);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe(
      'http://127.0.0.1:4123/pipeline/batch/progress?batch_id=sse-batch-1',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]?.finished).toBe(true);

    stop();
  });

  it('falls back when SSE stream terminates unexpectedly without done', async () => {
    const truncatedStream = makeSseStream([
      `event: progress\ndata: ${JSON.stringify(makeProgress())}\n\n`,
    ]);

    fetchSpy
      .mockResolvedValueOnce(
        new Response(truncatedStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeProgress({ completed: 2, finished: true })),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const updates: BatchProgress[] = [];
    const controller = new AbortController();
    const stop = startBatchProgressStream({
      localApiUrl: 'http://127.0.0.1:4123',
      batchId: 'sse-batch-1',
      signal: controller.signal,
      pollIntervalMs: 10,
      onUpdate: (progress) => updates.push(progress),
    });

    await flushAsync(20);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(updates.map((item) => item.finished)).toEqual([false, true]);

    stop();
  });

  it('stops cleanly when aborted without emitting fallback polls or updates', async () => {
    const controller = new AbortController();
    controller.abort();

    const updates: BatchProgress[] = [];
    const stop = startBatchProgressStream({
      localApiUrl: 'http://127.0.0.1:4123',
      batchId: 'sse-batch-1',
      signal: controller.signal,
      onUpdate: (progress) => updates.push(progress),
    });

    await flushAsync(8);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    stop();
  });
});

describe('runLocalAioBatch priorityIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends priority_index to batch FormData when configured', async () => {
    const report: PipelineBatchReport = {
      batch_id: 'prio-batch-1',
      total_images: 1,
      succeeded: 1,
      partial: 0,
      failed: 0,
      stages: {
        detect: false,
        ocr: false,
        translation: false,
        segment: false,
        clean: false,
      },
      results: [
        {
          index: 0,
          filename: 'page-0.png',
          status: 'success',
          detect: null,
          ocr: null,
          translation: null,
          segment: null,
          clean: null,
          errors: [],
        },
      ],
    };

    mockedFetchWithRetry.mockResolvedValueOnce(
      new Response(JSON.stringify(report), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Koma-Batch-Id': 'prio-batch-1',
        },
      }),
    );

    const controller = new AbortController();
    await runLocalAioBatch({
      localApiUrl: 'http://127.0.0.1:4123',
      images: [makeImage(0)],
      options: makeOptions({ priorityIndex: 3 }),
      capacity: makeCapacity(),
      signal: controller.signal,
      batchId: 'prio-batch-1',
    });

    const requestInit = mockedFetchWithRetry.mock.calls[0]?.[1];
    expect(requestInit?.body).toBeInstanceOf(FormData);
    if (requestInit?.body instanceof FormData) {
      expect(requestInit.body.get('priority_index')).toBe('3');
    }
  });
});
