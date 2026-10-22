import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PipelineBatchItemResult,
  PipelineBatchReport,
} from '@/types/dashboard.types';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '@/utils/http';
import type { BatchMappingImage } from './batch-mapping';
import {
  LocalAioBatchError,
  type BatchCapacity,
  type BatchProgress,
} from './batch-wire';
import {
  BATCH_PROGRESS_POLL_INTERVAL_MS,
  buildFallbackBatchCapacity,
  createBatchId,
  fetchBatchCapacity,
  fetchBatchProgress,
  resolveBatchCapacity,
  runLocalAioBatch,
  runLocalAioBatchChunks,
  startBatchProgressPolling,
  type LocalAioBatchOptions,
} from './local-aio-batch';

vi.mock('@/utils/http', () => ({
  fetchWithTimeoutAndRetry: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchWithTimeoutAndRetry);

const makeImage = (index: number): BatchMappingImage => ({
  id: `image-${index}`,
  file: new File([new Uint8Array([index])], `page-${index}.png`, {
    type: 'image/png',
  }),
  width: 400,
  height: 300,
});

const makeResult = (
  index: number,
  overrides: Partial<PipelineBatchItemResult> = {},
): PipelineBatchItemResult => ({
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
  ...overrides,
});

const makeReport = (
  results: PipelineBatchItemResult[],
  overrides: Partial<PipelineBatchReport> = {},
): PipelineBatchReport => ({
  batch_id: 'batch-1',
  total_images: results.length,
  succeeded: results.length,
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
  requested_concurrency: 8,
  effective_concurrency: 4,
  concurrency_note: null,
  ...overrides,
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
    recognizeText: true,
    getTranslations: true,
    segmentText: true,
    cleanImage: true,
    render: true,
  },
  llmSettings: {
    extra_context: '',
    image_input_enabled: false,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 1024,
    translation_notes_enabled: false,
    neighbor_image_context_enabled: false,
  },
  maskDilation: 5,
  hdStrategy: 'original',
  hdResizeLimit: 960,
  hdCropMargin: 512,
  hdCropTriggerSize: 512,
  gpuStages: {
    detectText: true,
    recognizeText: false,
    segmentText: true,
    cleanImage: false,
  },
  renderDefaultStyle: cloneRenderStyle(),
  applyDetectedGradientToStyle,
  minRegionSize: 4,
  parseApiError: async () => 'backend said no',
  ...overrides,
});

const firstCall = (): Parameters<typeof fetchWithTimeoutAndRetry> => {
  const call = mockedFetch.mock.calls.at(0);
  if (!call) throw new Error('fetchWithTimeoutAndRetry was not called.');
  return call;
};

const formFrom = (init: RequestInit | undefined): FormData => {
  const body = init?.body;
  if (!(body instanceof FormData)) {
    throw new Error('Expected the request body to be FormData.');
  }
  return body;
};

const stringField = (form: FormData, key: string): string => {
  const value = form.get(key);
  if (typeof value !== 'string') {
    throw new Error(`Expected "${key}" to be a string field.`);
  }
  return value;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const makeProgress = (
  overrides: Partial<BatchProgress> = {},
): BatchProgress => ({
  batchId: 'batch-1',
  total: 20,
  completed: 0,
  failed: 0,
  currentIndex: 0,
  currentName: 'page-0.png',
  cancelled: false,
  finished: false,
  updatedAt: '2026-10-10T00:00:00Z',
  ...overrides,
});

const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} => {
  const resolver: { current: ((value: T) => void) | null } = { current: null };
  const promise = new Promise<T>((res) => {
    resolver.current = res;
  });
  return {
    promise,
    resolve: (value: T) => {
      resolver.current?.(value);
    },
  };
};

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const makeImages = (count: number): BatchMappingImage[] =>
  Array.from({ length: count }, (_, index) => makeImage(index));

const reportForChunk = (
  count: number,
  offset: number,
): PipelineBatchReport =>
  makeReport(
    Array.from({ length: count }, (_, index) =>
      makeResult(index, { filename: `page-${offset + index}.png` }),
    ),
  );

const jsonOnlyOptions = makeOptions({
  aioSteps: {
    recognizeText: false,
    getTranslations: false,
    segmentText: false,
    cleanImage: false,
    render: false,
  },
});

const localBatchUrl = 'http://127.0.0.1:8765';

beforeEach(() => {
  mockedFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchBatchCapacity', () => {
  it('reads the preflight with no session header and a 10 s budget', async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify(makeCapacity()), { status: 200 }),
    );
    const controller = new AbortController();

    const capacity = await fetchBatchCapacity({
      localApiUrl: 'http://127.0.0.1:8765/',
      concurrency: 6,
      signal: controller.signal,
    });

    const [url, init, options] = firstCall();
    expect(url).toBe(
      'http://127.0.0.1:8765/pipeline/batch/capacity?concurrency=6',
    );
    expect(init).toEqual({ method: 'GET' });
    expect(options).toEqual({
      timeoutMs: 10_000,
      retryCount: 0,
      signal: controller.signal,
    });
    expect(capacity).toEqual(makeCapacity());
  });

  it('throws a typed error on a non-OK preflight', async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'capacity exploded' }), {
        status: 500,
      }),
    );

    await expect(
      fetchBatchCapacity({
        localApiUrl: 'http://127.0.0.1:8765',
        concurrency: 4,
      }),
    ).rejects.toMatchObject({
      name: 'LocalAioBatchError',
      status: 500,
      message: 'capacity exploded',
    });
  });
});

describe('runLocalAioBatch', () => {
  it('issues one multipart request and maps the zip report', async () => {
    const images = [makeImage(0), makeImage(1)];
    const report = makeReport([makeResult(0), makeResult(1)]);
    const zip = zipSync({
      'batch_report.json': strToU8(JSON.stringify(report)),
      'cleaned/000-page-0.png': new Uint8Array([1, 2, 3]),
      'cleaned/001-page-1.png': new Uint8Array([4, 5, 6]),
    });
    mockedFetch.mockResolvedValue(
      new Response(new Uint8Array(zip), {
        status: 200,
        headers: { 'X-Koma-Batch-Id': 'server-batch-id' },
      }),
    );
    const controller = new AbortController();
    const options = makeOptions();
    const onProgress = vi.fn();

    const result = await runLocalAioBatch({
      localApiUrl: 'http://127.0.0.1:8765',
      images,
      options,
      capacity: makeCapacity(),
      signal: controller.signal,
      onProgress,
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init, requestOptions] = firstCall();
    expect(url).toBe('http://127.0.0.1:8765/pipeline/batch');
    expect(requestOptions).toEqual({
      timeoutMs: 1200 * 1000 * Math.ceil(images.length / 4) + 120_000,
      retryCount: 0,
      signal: controller.signal,
    });

    const form = formFrom(init);
    expect(form.getAll('files')).toHaveLength(2);
    expect(stringField(form, 'source_language')).toBe('ja');
    expect(stringField(form, 'target_language')).toBe('en');
    expect(stringField(form, 'detect_model_key')).toBe('detector');
    expect(stringField(form, 'ocr_model_key')).toBe('got_ocr2');
    expect(stringField(form, 'translation_model_key')).toBe('opus-mt-ja-en');
    expect(stringField(form, 'segment_model_key')).toBe('segmenter');
    expect(stringField(form, 'clean_model_key')).toBe('cleaner');
    expect(stringField(form, 'run_detect')).toBe('true');
    expect(stringField(form, 'run_ocr')).toBe('true');
    expect(stringField(form, 'run_translation')).toBe('true');
    expect(stringField(form, 'run_segment')).toBe('true');
    expect(stringField(form, 'run_clean')).toBe('true');
    expect(stringField(form, 'concurrency')).toBe('4');
    expect(stringField(form, 'batch_id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(stringField(form, 'mask_dilation')).toBe('5');
    expect(stringField(form, 'hd_strategy')).toBe('original');
    expect(stringField(form, 'hd_strategy_resize_limit')).toBe('960');
    expect(stringField(form, 'hd_strategy_crop_margin')).toBe('512');
    expect(stringField(form, 'hd_strategy_crop_trigger_size')).toBe('512');
    const llmPayload: unknown = JSON.parse(stringField(form, 'llm_settings'));
    expect(llmPayload).toEqual(options.llmSettings);
    expect(stringField(form, 'use_gpu_detect')).toBe('true');
    expect(stringField(form, 'use_gpu_ocr')).toBe('false');
    expect(stringField(form, 'use_gpu_segment')).toBe('true');
    expect(stringField(form, 'use_gpu_clean')).toBe('false');

    expect(result.batchId).toBe('server-batch-id');
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.imageId).toBe('image-0');
    expect(result.results[1]?.cleanedDownload).not.toBeNull();
    expect(result.zipEntries).not.toBeNull();
    expect(Object.keys(result.zipEntries ?? {})).toContain(
      'batch_report.json',
    );
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('parses a JSON response when the clean stage is off', async () => {
    const images = [makeImage(0)];
    const report = makeReport([makeResult(0, { clean: null })], {
      stages: {
        detect: true,
        ocr: true,
        translation: true,
        segment: true,
        clean: false,
      },
    });
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify(report), { status: 200 }),
    );
    const options = makeOptions({
      aioSteps: {
        recognizeText: true,
        getTranslations: true,
        segmentText: true,
        cleanImage: false,
        render: false,
      },
    });

    const result = await runLocalAioBatch({
      localApiUrl: 'http://127.0.0.1:8765',
      images,
      options,
      capacity: makeCapacity(),
    });

    const [, init] = firstCall();
    expect(stringField(formFrom(init), 'run_clean')).toBe('false');
    expect(result.zipEntries).toBeNull();
    expect(result.batchId).toBe('batch-1');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.cleanedDownload).toBeNull();
    expect(result.results[0]?.countAsProcessed).toBe(true);
  });

  it('throws the parsed API error on a non-OK response', async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'batch exploded' }), {
        status: 500,
      }),
    );

    await expect(
      runLocalAioBatch({
        localApiUrl: 'http://127.0.0.1:8765',
        images: [makeImage(0)],
        options: makeOptions(),
        capacity: makeCapacity(),
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'LocalAioBatchError',
        status: 500,
        message: 'backend said no',
      }),
    );
  });

  it('refuses a request above the capacity image cap', async () => {
    await expect(
      runLocalAioBatch({
        localApiUrl: 'http://127.0.0.1:8765',
        images: [makeImage(0), makeImage(1)],
        options: makeOptions(),
        capacity: { ...makeCapacity(), maxImages: 1 },
      }),
    ).rejects.toBeInstanceOf(LocalAioBatchError);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('announces the caller batch id synchronously, before sending the request', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(reportForChunk(1, 0)));
    const onBatchId = vi.fn<(batchId: string) => void>();

    const pending = runLocalAioBatch({
      localApiUrl: localBatchUrl,
      images: [makeImage(0)],
      options: jsonOnlyOptions,
      capacity: makeCapacity(),
      batchId: 'client-batch-id',
      onBatchId,
    });

    expect(onBatchId).toHaveBeenCalledTimes(1);
    expect(onBatchId).toHaveBeenCalledWith('client-batch-id');
    expect(onBatchId.mock.invocationCallOrder[0]).toBeLessThan(
      mockedFetch.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );

    await pending;

    const [, init] = firstCall();
    expect(stringField(formFrom(init), 'batch_id')).toBe('client-batch-id');
  });

  it('generates a uuid when the caller omits the batch id', () => {
    expect(createBatchId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('resolveBatchCapacity', () => {
  it('falls back to the documented conservative capacity on failure', async () => {
    mockedFetch.mockRejectedValue(new Error('preflight offline'));

    await expect(
      resolveBatchCapacity({ localApiUrl: localBatchUrl, concurrency: 8 }),
    ).resolves.toEqual({
      capacity: {
        maxImages: 64,
        maxImageBytes: 50 * 1024 * 1024,
        requestedConcurrency: 8,
        effectiveConcurrency: 4,
        perImageBudgetSeconds: 1200,
      },
      fallback: true,
    });
  });

  it('never falls back above the requested concurrency', () => {
    expect(buildFallbackBatchCapacity(2).effectiveConcurrency).toBe(2);
    expect(buildFallbackBatchCapacity(32).effectiveConcurrency).toBe(4);
  });

  it('keeps the preflight values when the request succeeds', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(makeCapacity()));

    await expect(
      resolveBatchCapacity({ localApiUrl: localBatchUrl, concurrency: 8 }),
    ).resolves.toEqual({ capacity: makeCapacity(), fallback: false });
  });
});

describe('fetchBatchProgress', () => {
  it('reads the progress contract with a 10 s, no-retry budget', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(makeProgress({ completed: 3 })));
    const controller = new AbortController();

    const progress = await fetchBatchProgress({
      localApiUrl: `${localBatchUrl}/`,
      batchId: 'batch id/1',
      signal: controller.signal,
    });

    const [url, init, options] = firstCall();
    expect(url).toBe(
      `${localBatchUrl}/pipeline/batch/progress?batch_id=batch%20id%2F1`,
    );
    expect(init).toEqual({ method: 'GET' });
    expect(options).toEqual({
      timeoutMs: 10_000,
      retryCount: 0,
      signal: controller.signal,
    });
    expect(progress).toMatchObject({ completed: 3, total: 20 });
  });

  it('returns null for an unknown or expired id (404)', async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse({ detail: 'Unknown or expired batch id.' }, 404),
    );

    await expect(
      fetchBatchProgress({ localApiUrl: localBatchUrl, batchId: 'gone' }),
    ).resolves.toBeNull();
  });
});

describe('startBatchProgressPolling', () => {
  it('polls every 500 ms, stops on finished and clears its timer', async () => {
    vi.useFakeTimers();
    mockedFetch
      .mockResolvedValueOnce(jsonResponse(makeProgress({ completed: 1 })))
      .mockResolvedValueOnce(
        jsonResponse(makeProgress({ completed: 2, finished: true })),
      );
    const onUpdate = vi.fn();
    const controller = new AbortController();

    const stop = startBatchProgressPolling({
      localApiUrl: localBatchUrl,
      batchId: 'batch-1',
      signal: controller.signal,
      onUpdate,
    });

    expect(BATCH_PROGRESS_POLL_INTERVAL_MS).toBe(500);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(mockedFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[1]?.[0]).toMatchObject({
      completed: 2,
      finished: true,
    });
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(1500);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps polling after a 404 until real progress arrives', async () => {
    vi.useFakeTimers();
    mockedFetch
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'Unknown or expired batch id.' }, 404),
      )
      .mockResolvedValueOnce(jsonResponse(makeProgress({ completed: 2 })));
    const onUpdate = vi.fn();
    const controller = new AbortController();

    const stop = startBatchProgressPolling({
      localApiUrl: localBatchUrl,
      batchId: 'batch-1',
      signal: controller.signal,
      onUpdate,
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({ completed: 2 });
    expect(vi.getTimerCount()).toBe(1);

    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is stopped by abort and never polls afterwards', async () => {
    vi.useFakeTimers();
    mockedFetch.mockResolvedValue(jsonResponse(makeProgress()));
    const controller = new AbortController();

    const stop = startBatchProgressPolling({
      localApiUrl: localBatchUrl,
      batchId: 'batch-1',
      signal: controller.signal,
      onUpdate: vi.fn(),
    });

    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockedFetch).not.toHaveBeenCalled();
    stop();
  });
});

describe('runLocalAioBatchChunks', () => {
  it('sends 45 images as sequential 20/20/5 chunks', async () => {
    const chunkSizes: number[] = [];
    const pending: Array<(response: Response) => void> = [];
    mockedFetch.mockImplementation((url, init) => {
      if (url.includes('/pipeline/batch/progress')) {
        return Promise.resolve(jsonResponse({ detail: 'unknown' }, 404));
      }
      chunkSizes.push(formFrom(init).getAll('files').length);
      const gate = deferred<Response>();
      pending.push(gate.resolve);
      return gate.promise;
    });
    const onProgress = vi.fn();
    const onChunkState = vi.fn();
    const controller = new AbortController();

    const runPromise = runLocalAioBatchChunks({
      localApiUrl: localBatchUrl,
      images: makeImages(45),
      options: jsonOnlyOptions,
      capacity: makeCapacity(),
      signal: controller.signal,
      onProgress,
      onChunkState,
    });

    expect(chunkSizes).toEqual([20]);
    expect(onChunkState).toHaveBeenLastCalledWith(1, 3, 'page-0.png');

    pending[0]?.(jsonResponse(reportForChunk(20, 0)));
    await flush();
    expect(chunkSizes).toEqual([20, 20]);
    expect(onChunkState).toHaveBeenLastCalledWith(2, 3, 'page-20.png');

    pending[1]?.(jsonResponse(reportForChunk(20, 20)));
    await flush();
    expect(chunkSizes).toEqual([20, 20, 5]);
    expect(onChunkState).toHaveBeenLastCalledWith(3, 3, 'page-40.png');

    pending[2]?.(jsonResponse(reportForChunk(5, 40)));
    const result = await runPromise;

    expect(result.results).toHaveLength(45);
    expect(result.results[44]?.imageId).toBe('image-44');
    expect(result.batchIds).toHaveLength(3);
    expect(new Set(result.batchIds).size).toBe(3);
    expect(onProgress.mock.calls).toEqual([
      [20, 45],
      [40, 45],
      [45, 45],
    ]);
  });

  it('polls the same batch id while the chunk request is still in flight', async () => {
    vi.useFakeTimers();
    const post = deferred<Response>();
    let formBatchId = '';
    mockedFetch.mockImplementation((url, init) => {
      if (url.includes('/pipeline/batch/progress')) {
        return Promise.resolve(
          jsonResponse(makeProgress({ total: 1, finished: true })),
        );
      }
      formBatchId = stringField(formFrom(init), 'batch_id');
      return post.promise;
    });
    const controller = new AbortController();

    const runPromise = runLocalAioBatchChunks({
      localApiUrl: localBatchUrl,
      images: [makeImage(0)],
      options: jsonOnlyOptions,
      capacity: makeCapacity(),
      signal: controller.signal,
    });

    expect(formBatchId).not.toBe('');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(mockedFetch.mock.calls[1]?.[0]).toBe(
      `${localBatchUrl}/pipeline/batch/progress?batch_id=${encodeURIComponent(formBatchId)}`,
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockedFetch).toHaveBeenCalledTimes(2);

    post.resolve(jsonResponse(reportForChunk(1, 0)));
    const result = await runPromise;

    expect(result.batchIds).toEqual([formBatchId]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps polling through a 404 and stops when the chunk completes', async () => {
    vi.useFakeTimers();
    const post = deferred<Response>();
    mockedFetch.mockImplementation((url) => {
      if (url.includes('/pipeline/batch/progress')) {
        return Promise.resolve(
          jsonResponse({ detail: 'Unknown or expired batch id.' }, 404),
        );
      }

      return post.promise;
    });
    const controller = new AbortController();

    const runPromise = runLocalAioBatchChunks({
      localApiUrl: localBatchUrl,
      images: [makeImage(0)],
      options: jsonOnlyOptions,
      capacity: makeCapacity(),
      signal: controller.signal,
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);

    post.resolve(jsonResponse(reportForChunk(1, 0)));
    const result = await runPromise;

    expect(result.results).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops at the failed chunk and lets the error propagate', async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse({ detail: 'batch exploded' }, 500),
    );
    const controller = new AbortController();

    await expect(
      runLocalAioBatchChunks({
        localApiUrl: localBatchUrl,
        images: makeImages(45),
        options: makeOptions(),
        capacity: makeCapacity(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      name: 'LocalAioBatchError',
      status: 500,
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
