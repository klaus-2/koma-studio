import { describe, expect, it } from 'vitest';

import type { BatchMappingImage } from '@/pages/dashboard/lib/batch-mapping';
import {
  runChapterQueue,
  type ChapterOutcome,
  type ChapterRunResult,
  type ChapterSource,
  type RunChapter,
} from '@/pages/dashboard/lib/chapter-queue';
import type { LocalAioBatchOptions } from '@/pages/dashboard/lib/local-aio-batch';
import { createAioAbortError } from '@/pages/dashboard/lib/run-aio-batch';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '@/utils/customLlm';

const makeImage = (index: number): BatchMappingImage => ({
  id: `image-${index}`,
  file: new File([new Uint8Array([index])], `page-${index}.png`, {
    type: 'image/png',
  }),
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
    recognizeText: true,
    getTranslations: true,
    segmentText: true,
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
};

const makeChapter = (id: string, imageCount = 2): ChapterSource => ({
  id,
  label: id.toUpperCase(),
  images: Array.from({ length: imageCount }, (_, index) => makeImage(index)),
  options,
});

const makeChapters = (): ChapterSource[] => ['a', 'b', 'c'].map((id) => makeChapter(id));

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

describe('runChapterQueue', () => {
  it('starts chapter N+1 only after chapter N settles', async () => {
    const order: string[] = [];
    const gates = new Map<string, Deferred<ChapterRunResult>>();
    let active = 0;
    let maxActive = 0;

    const gateFor = (id: string): Deferred<ChapterRunResult> => {
      const gate = gates.get(id);
      if (!gate) throw new Error(`chapter ${id} did not start`);
      return gate;
    };

    const runChapter: RunChapter = async (chapter) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(chapter.id);
      const gate = deferred<ChapterRunResult>();
      gates.set(chapter.id, gate);
      try {
        return await gate.promise;
      } finally {
        active -= 1;
      }
    };

    const queue = runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
    });

    await flush();
    expect(order).toEqual(['a']);

    gateFor('a').resolve({ batchIds: ['a'], results: [] });
    await flush();
    expect(order).toEqual(['a', 'b']);

    gateFor('b').resolve({ batchIds: ['b'], results: [] });
    await flush();
    expect(order).toEqual(['a', 'b', 'c']);

    gateFor('c').resolve({ batchIds: ['c'], results: [] });
    const result = await queue;

    expect(maxActive).toBe(1);
    expect(result.outcomes.map((outcome) => outcome.chapterId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns one done outcome per chapter, in input order', async () => {
    const runChapter: RunChapter = async (chapter) => ({
      batchIds: [chapter.id],
      results: [],
    });

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
    });

    expect(result.outcomes.map((outcome) => outcome.chapterId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
      'done',
    ]);
    expect(result.outcomes.map((outcome) => outcome.batchIds)).toEqual([
      ['a'],
      ['b'],
      ['c'],
    ]);
    expect(result.aborted).toBe(false);
  });

  it('keeps running after a chapter fails', async () => {
    const called: string[] = [];
    const runChapter: RunChapter = async (chapter) => {
      called.push(chapter.id);
      if (chapter.id === 'b') throw new Error('boom');
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
    });

    expect(called).toEqual(['a', 'b', 'c']);
    expect(result.outcomes[0]).toMatchObject({ status: 'done', error: null });
    expect(result.outcomes[1]).toMatchObject({ status: 'failed' });
    expect(result.outcomes[1]?.error?.message).toBe('boom');
    expect(result.outcomes[1]?.batchIds).toEqual([]);
    expect(result.outcomes[2]).toMatchObject({ status: 'done', error: null });
  });

  it('normalizes a non-Error rejection into an Error', async () => {
    const rejection: unknown = 'boom';
    const runChapter: RunChapter = async (chapter) => {
      if (chapter.id === 'b') throw rejection;
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
    });

    const failed = result.outcomes[1];
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBeInstanceOf(Error);
    expect(failed?.error?.message).toBe('boom');
  });

  it('skips every chapter when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const started: string[] = [];
    const settled: ChapterOutcome[] = [];
    let runnerCalls = 0;

    const runChapter: RunChapter = async () => {
      runnerCalls += 1;
      return { batchIds: [], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: controller.signal,
      runChapter,
      onChapterStart: (chapter) => started.push(chapter.id),
      onChapterSettled: (outcome) => settled.push(outcome),
    });

    expect(result.aborted).toBe(true);
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(runnerCalls).toBe(0);
    expect(started).toEqual([]);
    expect(settled).toHaveLength(3);
  });

  it('marks the in-flight and remaining chapters skipped when aborted mid-run', async () => {
    const controller = new AbortController();
    const called: string[] = [];

    const runChapter: RunChapter = async (chapter) => {
      called.push(chapter.id);
      if (chapter.id === 'b') {
        controller.abort();
        throw createAioAbortError();
      }
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: controller.signal,
      runChapter,
    });

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'skipped',
      'skipped',
    ]);
    expect(result.outcomes[1]?.error).toBeNull();
    expect(result.aborted).toBe(true);
    expect(called).toEqual(['a', 'b']);
  });

  it('skips the rest of the queue after stopAfterChapterId settles', async () => {
    const called: string[] = [];
    const runChapter: RunChapter = async (chapter) => {
      called.push(chapter.id);
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
      stopAfterChapterId: 'b',
    });

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
      'skipped',
    ]);
    expect(result.aborted).toBe(false);
    expect(called).toEqual(['a', 'b']);
  });

  it('stops after a failed chapter when stopAfterChapterId matches it', async () => {
    const runChapter: RunChapter = async (chapter) => {
      if (chapter.id === 'b') throw new Error('boom');
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
      stopAfterChapterId: 'b',
    });

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'failed',
      'skipped',
    ]);
    expect(result.outcomes[1]?.error?.message).toBe('boom');
    expect(result.aborted).toBe(false);
  });

  it('runs the whole queue when the stop id matches nothing', async () => {
    const runChapter: RunChapter = async (chapter) => ({
      batchIds: [chapter.id],
      results: [],
    });

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
      stopAfterChapterId: 'missing',
    });

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
      'done',
    ]);
    expect(result.aborted).toBe(false);
  });

  it('returns an empty result for an empty chapter list', async () => {
    const runChapter: RunChapter = async () => {
      throw new Error('the runner must not be called');
    };

    const result = await runChapterQueue({
      chapters: [],
      signal: new AbortController().signal,
      runChapter,
      onChapterStart: () => {
        throw new Error('onChapterStart must not be called');
      },
      onChapterSettled: () => {
        throw new Error('onChapterSettled must not be called');
      },
    });

    expect(result).toEqual({ outcomes: [], aborted: false });
  });

  it('reports start, progress and settle callbacks per settled chapter', async () => {
    const started: string[] = [];
    const settled: ChapterOutcome[] = [];
    const progress: Array<[string, number, number]> = [];

    const runChapter: RunChapter = async (chapter, _signal, onProgress) => {
      onProgress(chapter.images.length, 10);
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: makeChapters(),
      signal: new AbortController().signal,
      runChapter,
      stopAfterChapterId: 'b',
      onChapterStart: (chapter) => started.push(chapter.id),
      onChapterProgress: (chapterId, completedUnits, totalUnits) =>
        progress.push([chapterId, completedUnits, totalUnits]),
      onChapterSettled: (outcome) => settled.push(outcome),
    });

    expect(started).toEqual(['a', 'b']);
    expect(progress).toEqual([
      ['a', 2, 10],
      ['b', 2, 10],
    ]);
    expect(settled.map((outcome) => outcome.chapterId)).toEqual(['a', 'b', 'c']);
    expect(settled.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
      'skipped',
    ]);
    expect(result.outcomes).toHaveLength(3);
  });

  it('runs chapters that share an id instead of collapsing them', async () => {
    let runnerCalls = 0;
    const runChapter: RunChapter = async (chapter) => {
      runnerCalls += 1;
      return { batchIds: [chapter.id], results: [] };
    };

    const result = await runChapterQueue({
      chapters: [
        { ...makeChapter('a'), label: 'First A' },
        { ...makeChapter('a'), label: 'Second A' },
      ],
      signal: new AbortController().signal,
      runChapter,
    });

    expect(runnerCalls).toBe(2);
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes.map((outcome) => outcome.chapterId)).toEqual([
      'a',
      'a',
    ]);
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      'done',
      'done',
    ]);
  });
});
