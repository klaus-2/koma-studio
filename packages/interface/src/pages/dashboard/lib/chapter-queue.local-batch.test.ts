import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BatchMappingImage } from '@/pages/dashboard/lib/batch-mapping';
import type { BatchCapacity } from '@/pages/dashboard/lib/batch-wire';
import {
  createLocalBatchChapterRunner,
  runChapterQueue,
  type ChapterSource,
} from '@/pages/dashboard/lib/chapter-queue';
import type { LocalAioBatchOptions } from '@/pages/dashboard/lib/local-aio-batch';
import type {
  PipelineBatchItemResult,
  PipelineBatchReport,
} from '@/types/dashboard.types';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '@/utils/customLlm';
import { fetchWithTimeoutAndRetry } from '@/utils/http';

vi.mock('@/utils/http', () => ({
  fetchWithTimeoutAndRetry: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchWithTimeoutAndRetry);

const localBatchUrl = 'http://127.0.0.1:8765';

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
  applyDetectedGradientToStyle,
  minRegionSize: 4,
  parseApiError: async () => 'backend said no',
  ...overrides,
});

const options = makeOptions();

const makeChapter = (id: string, imageCount = 1): ChapterSource => ({
  id,
  label: id.toUpperCase(),
  images: Array.from({ length: imageCount }, (_, index) => makeImage(index)),
  options,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const reportForChunk = (
  count: number,
  offset: number,
): PipelineBatchReport =>
  makeReport(
    Array.from({ length: count }, (_, index) =>
      makeResult(index, { filename: `page-${offset + index}.png` }),
    ),
  );

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
  const box: { resolve: ((value: T) => void) | null } = { resolve: null };
  const promise = new Promise<T>((resolve) => {
    box.resolve = resolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      box.resolve?.(value);
    },
  };
};

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const isCapacityUrl = (url: string): boolean =>
  url.includes('/pipeline/batch/capacity');

const isProgressUrl = (url: string): boolean =>
  url.includes('/pipeline/batch/progress');

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('createLocalBatchChapterRunner', () => {
  it('issues one capacity preflight for two chapters', async () => {
    const posts: Array<(response: Response) => void> = [];
    const urls: string[] = [];
    mockedFetch.mockImplementation((url) => {
      urls.push(url);
      if (isCapacityUrl(url)) {
        return Promise.resolve(jsonResponse(makeCapacity()));
      }
      if (isProgressUrl(url)) {
        return Promise.resolve(jsonResponse({ detail: 'unknown' }, 404));
      }
      const gate = deferred<Response>();
      posts.push(gate.resolve);
      return gate.promise;
    });
    const runChapter = createLocalBatchChapterRunner({
      localApiUrl: localBatchUrl,
      concurrency: 4,
    });

    const queue = runChapterQueue({
      chapters: [makeChapter('chapter-1'), makeChapter('chapter-2')],
      signal: new AbortController().signal,
      runChapter,
    });

    await flush();
    expect(urls.filter(isCapacityUrl)).toHaveLength(1);
    expect(posts).toHaveLength(1);

    posts[0]?.(jsonResponse(reportForChunk(1, 0)));
    await flush();
    expect(posts).toHaveLength(2);

    posts[1]?.(jsonResponse(reportForChunk(1, 0)));
    const result = await queue;

    expect(urls.filter(isCapacityUrl)).toHaveLength(1);
    expect(posts).toHaveLength(2);
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
    ]);
    expect(result.outcomes[0]?.batchIds).toHaveLength(1);
    expect(result.outcomes[1]?.batchIds).toHaveLength(1);
  });

  it('sends the next chapter POST only after the previous one resolves', async () => {
    const posts: Array<(response: Response) => void> = [];
    mockedFetch.mockImplementation((url) => {
      if (isCapacityUrl(url)) {
        return Promise.resolve(jsonResponse(makeCapacity()));
      }
      if (isProgressUrl(url)) {
        return Promise.resolve(jsonResponse({ detail: 'unknown' }, 404));
      }
      const gate = deferred<Response>();
      posts.push(gate.resolve);
      return gate.promise;
    });
    const runChapter = createLocalBatchChapterRunner({
      localApiUrl: localBatchUrl,
      concurrency: 4,
    });

    const queue = runChapterQueue({
      chapters: [makeChapter('a'), makeChapter('b')],
      signal: new AbortController().signal,
      runChapter,
    });

    await flush();
    expect(posts).toHaveLength(1);

    await flush();
    expect(posts).toHaveLength(1);

    posts[0]?.(jsonResponse(reportForChunk(1, 0)));
    await flush();
    expect(posts).toHaveLength(2);

    posts[1]?.(jsonResponse(reportForChunk(1, 0)));
    const result = await queue;

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
    ]);
  });

  it('reuses a pre-resolved capacity without a preflight request', async () => {
    const urls: string[] = [];
    mockedFetch.mockImplementation((url) => {
      urls.push(url);
      if (isProgressUrl(url)) {
        return Promise.resolve(jsonResponse({ detail: 'unknown' }, 404));
      }
      return Promise.resolve(jsonResponse(reportForChunk(1, 0)));
    });
    const runChapter = createLocalBatchChapterRunner({
      localApiUrl: localBatchUrl,
      concurrency: 4,
      capacity: makeCapacity(),
    });

    const result = await runChapterQueue({
      chapters: [makeChapter('chapter-1')],
      signal: new AbortController().signal,
      runChapter,
    });

    expect(urls.filter(isCapacityUrl)).toHaveLength(0);
    expect(result.outcomes[0]?.status).toBe('done');
    expect(result.outcomes[0]?.batchIds).toHaveLength(1);
  });

  it('keeps running the next chapter after a transport failure', async () => {
    let postCount = 0;
    mockedFetch.mockImplementation((url) => {
      if (isCapacityUrl(url)) {
        return Promise.resolve(jsonResponse(makeCapacity()));
      }
      if (isProgressUrl(url)) {
        return Promise.resolve(jsonResponse({ detail: 'unknown' }, 404));
      }
      postCount += 1;
      if (postCount === 1) {
        return Promise.resolve(
          jsonResponse({ detail: 'chapter one died' }, 500),
        );
      }
      return Promise.resolve(jsonResponse(reportForChunk(1, 0)));
    });
    const runChapter = createLocalBatchChapterRunner({
      localApiUrl: localBatchUrl,
      concurrency: 4,
    });

    const result = await runChapterQueue({
      chapters: [makeChapter('chapter-1'), makeChapter('chapter-2')],
      signal: new AbortController().signal,
      runChapter,
    });

    expect(postCount).toBe(2);
    expect(result.outcomes[0]?.status).toBe('failed');
    expect(result.outcomes[0]?.error?.message).toBe('backend said no');
    expect(result.outcomes[1]?.status).toBe('done');
    expect(result.aborted).toBe(false);
  });
});
