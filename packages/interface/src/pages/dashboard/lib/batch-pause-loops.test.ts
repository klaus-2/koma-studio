import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runChapterQueue } from './chapter-queue';
import { runAioBatch } from './run-aio-batch';
import { createBatchPauseGate } from './batch-pause-gate';
import type { LocalAioBatchOptions } from './local-aio-batch';
import {
  useAioBatchPauseStore,
} from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '@/utils/customLlm';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';

const chapterOptions: LocalAioBatchOptions = {
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
  typographyPresetState: {
    version: 1,
    folders: [],
    presets: [],
    modeBindings: {},
    defaultPresetId: null,
  },
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

beforeEach(() => {
  useAioBatchPauseStore.getState().reset();
  useUiShellStore.setState({ processing: false });
});

const pauseAfterFirstBoundary = (): (() => void) => {
  let boundaries = 0;
  return () => {
    boundaries += 1;
    if (boundaries === 1) {
      act(() => {
        useUiShellStore.setState({ processing: true });
        useAioBatchPauseStore.getState().requestPause();
      });
      setTimeout(() => {
        act(() => {
          useAioBatchPauseStore.getState().resume();
        });
      }, 20);
    }
    return undefined;
  };
};

const makeBoundaryCallback = (
  gate: ReturnType<typeof createBatchPauseGate>,
): (() => Promise<void>) => async () => {
  const pause = useAioBatchPauseStore.getState();
  if (!pause.pauseRequested && !pause.isPaused) {
    return;
  }
  gate.notifyBoundaryReached();
  await gate.waitAtBoundary();
};

describe('batch pause at loop boundaries (Fase D F1)', () => {
  it('chapter queue pauses between chapters and still completes all', async () => {
    const gate = createBatchPauseGate(new AbortController().signal);
    const armPause = pauseAfterFirstBoundary();
    const chapterNames: string[] = [];

    const queue = await runChapterQueue({
      chapters: [
        { id: 'ch-1', label: 'c1', images: [], options: chapterOptions },
        { id: 'ch-2', label: 'c2', images: [], options: chapterOptions },
        { id: 'ch-3', label: 'c3', images: [], options: chapterOptions },
      ],
      signal: new AbortController().signal,
      beforeChapter: async () => {
        armPause();
        await makeBoundaryCallback(gate)();
      },
      runChapter: async (chapter) => {
        chapterNames.push(chapter.id);
        return { batchIds: [], results: [] };
      },
    });

    expect(chapterNames).toEqual(['ch-1', 'ch-2', 'ch-3']);
    expect(queue.aborted).toBe(false);
    expect(queue.outcomes.every((outcome) => outcome.status === 'done')).toBe(true);
    expect(useAioBatchPauseStore.getState().isPaused).toBe(false);
  });

  it('boundary hold resolves when the user resumes (gate mechanics)', async () => {
    const gate = createBatchPauseGate(new AbortController().signal);
    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();

    let entered = 0;
    const beforeChunk = async (): Promise<void> => {
      entered += 1;
      const pause = useAioBatchPauseStore.getState();
      if (!pause.pauseRequested && !pause.isPaused) {
        return;
      }
      gate.notifyBoundaryReached();
      setTimeout(() => useAioBatchPauseStore.getState().resume(), 10);
      await gate.waitAtBoundary();
    };

    await beforeChunk();

    expect(entered).toBe(1);
    expect(useAioBatchPauseStore.getState().isPaused).toBe(false);
    expect(useAioBatchPauseStore.getState().pauseRequested).toBe(false);
  });

  it('cloud consume loop pauses between items and completes all items', async () => {
    const controller = new AbortController();
    const gate = createBatchPauseGate(controller.signal);
    const armPause = pauseAfterFirstBoundary();
    const processed: number[] = [];

    const results = await runAioBatch<number, number>({
      items: [1, 2, 3],
      concurrency: 1,
      controller,
      beforeItem: async () => {
        armPause();
        await makeBoundaryCallback(gate)();
      },
      worker: async ({ item }) => {
        processed.push(item);
        return item * 10;
      },
    });

    expect(processed).toEqual([1, 2, 3]);
    expect(results).toEqual([10, 20, 30]);
  });

  it('abort during a pause ends the run instead of holding forever', async () => {
    const controller = new AbortController();
    const gate = createBatchPauseGate(controller.signal);
    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();

    const boundary = makeBoundaryCallback(gate);
    const held = boundary();
    await vi.waitFor(() => {
      expect(useAioBatchPauseStore.getState().isPaused).toBe(true);
    });

    act(() => {
      controller.abort();
    });
    await held;
    expect(useAioBatchPauseStore.getState().isPaused).toBe(true);
  });
});
