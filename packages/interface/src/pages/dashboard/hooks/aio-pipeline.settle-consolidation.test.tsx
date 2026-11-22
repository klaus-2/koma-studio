import {
  act,
  renderHook,
  type RenderHookResult,
} from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import {
  runLocalAioBatchChunks,
} from '@/pages/dashboard/lib/local-aio-batch';
import { useAioPipelineExecution } from '@/pages/dashboard/hooks/aio-pipeline';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useAioBatchPauseStore } from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioPipelineSnapshot,
  AioTextRegion,
  LoadedImage,
} from '@/types/dashboard.types';
import { cloneRenderStyle } from '@/utils/dashboard.utils';
import { createDirectPageFile } from '@/utils/page-source';

vi.mock('@/hooks/useAioExecutionPreparation', () => ({
  useAioExecutionPreparation: vi.fn(),
}));
vi.mock('@/hooks/useAioSingleImageProcessor', () => ({
  useAioSingleImageProcessor: vi.fn(),
}));
vi.mock('@/hooks/useAioResultConsolidation', () => ({
  useAioResultConsolidation: vi.fn(),
}));
vi.mock('@/pages/dashboard/lib/local-aio-batch', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/pages/dashboard/lib/local-aio-batch')>();

  return {
    runLocalAioBatchChunks: vi.fn(),
    resolveBatchCapacity: vi.fn(),
    aioStageKeyForBatchStage: actual.aioStageKeyForBatchStage,
  };
});

const mockedPreparation = vi.mocked(useAioExecutionPreparation);
const mockedProcessor = vi.mocked(useAioSingleImageProcessor);
const mockedConsolidation = vi.mocked(useAioResultConsolidation);
const mockedChunks = vi.mocked(runLocalAioBatchChunks);

type PrepareResult = Awaited<
  ReturnType<ReturnType<typeof useAioExecutionPreparation>>
>;

const CAPACITY = {
  maxImages: 64,
  maxImageBytes: 50 * 1024 * 1024,
  requestedConcurrency: 8,
  effectiveConcurrency: 4,
  perImageBudgetSeconds: 1200,
};

const makeImage = (index: number): LoadedImage => ({
  id: `img-${index}`,
  file: createDirectPageFile(new File([`page-${index}`], `page-${index}.png`, {
    type: 'image/png',
  })),
  url: `data:image/png;base64,AA${index}`,
  width: 40,
  height: 30,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
});

const images = [makeImage(0), makeImage(1), makeImage(2)];

const chapteredImages: LoadedImage[] = [
  { ...makeImage(0), chapterId: 'archive:a.cbz', chapterLabel: 'a.cbz' },
  { ...makeImage(1), chapterId: 'archive:a.cbz', chapterLabel: 'a.cbz' },
  { ...makeImage(2), chapterId: 'archive:b.cbz', chapterLabel: 'b.cbz' },
];

const RENDER_STYLE = cloneRenderStyle();

const makeBatchResult = (imageId: string): AioBatchImageResult => ({
  imageId,
  detectDetections: [],
  ocrDetections: [],
  translationDetections: [],
  segmentDetections: [],
  cleanDetections: [],
  renderDetections: [],
  cleanedDownload: null,
  countAsProcessed: true,
  executionNotices: [],
});

const cleanedDownload = (imageId: string): AioDownloadEntry => ({
  fileName: `${imageId}-clean.png`,
  blob: new Blob([imageId]),
  sourceImageId: imageId,
});

const basePrepared = {
  selectedDetectorKey: 'detector',
  selectedOcrKey: 'ocr',
  selectedTranslationKey: 'translation',
  selectedSegmentKey: 'segment',
  selectedCleanKey: 'clean',
  selectedOcrOption: null,
  selectedTranslationOption: null,
  useCloudOcr: false,
  useCloudTranslation: false,
  useLlmSettingsForOcr: false,
  useLlmSettingsForTranslation: false,
  cleanViaAi: false,
  cleanAiCustomProfile: null,
  runningStages: ['detecting text'],
};

const makePrepared = (local: boolean): NonNullable<PrepareResult> =>
  local
    ? {
        ...basePrepared,
        useLocalBatchPipeline: true,
        batchCapacity: CAPACITY,
        capacityFallback: false,
      }
    : {
        ...basePrepared,
        useLocalBatchPipeline: false,
        batchCapacity: null,
        capacityFallback: false,
      };

const processImage = vi.fn(
  async (image: LoadedImage): Promise<AioBatchImageResult> =>
    makeBatchResult(image.id),
);

let recordedIdsAfterSettle: string[][] = [];

const consolidate = vi.fn(
  (
    _results: AioBatchImageResult[],
    _options?: {
      skipImageIds?: ReadonlySet<string>;
      writeSnapshots?: boolean;
    },
  ) => {
    return {
      processedPagesCount: images.length,
      totalDetections: 0,
      totalRecognized: 0,
      totalTranslated: 0,
      totalSegmented: 0,
      totalCleaned: 0,
      totalRendered: 0,
      finalMessage: 'AIO finished.',
    };
  },
);

const makeArgs = (): UseAioPipelineExecutionArgs => ({
  effectiveBatchConcurrency: 8,
  modelEntries: {},
  selectedCustomOcrProfile: null,
  selectedCustomTranslationProfile: null,
  cleanCustomProfiles: [],
  getAioStageOption: () => null,
  openModelManagerForStage: vi.fn(),
  refreshSession: async () => null,
  getAuthToken: () => null,
  setAioManualImageEditsByImage: vi.fn(),
  setAioManualHealingBusyByImage: vi.fn(),
  renderDefaultStyle: RENDER_STYLE,
  isDesktopRuntime: false,
  localApiUrl: 'http://127.0.0.1:8765',
  setAioDetectionsByImage: vi.fn(),
  setAioSelectedRegionByImage: vi.fn(),
  setAioDownloadItems: vi.fn(),
  buildAioImageSnapshotIndexMap: () => ({}),
  aioPipelineStageProgressLabels: {
    detectText: 'Detecting text',
    recognizeText: 'Recognizing text',
    getTranslations: 'Translating text',
    segmentText: 'Segmenting text',
    cleanImage: 'Cleaning image',
    render: 'Preparing render',
  },
  emitProcessStartWebhook: vi.fn(),
  emitProcessCompleteWebhook: vi.fn(),
  emitProcessErrorWebhook: vi.fn(),
  ensureVerifiedEmailOrNotify: () => true,
  recordProcessedPages: vi.fn(),
  syncDiscordForTab: vi.fn(),
  tryShowHealingHint: vi.fn(),
  onAutoRunCompleted: vi.fn(),
  beginAioExecution: (scope, totalImages, stageKeys) => {
    useAioPipelineStore
      .getState()
      .beginAioExecution(scope, totalImages, stageKeys, 'AIO');
  },
  updateAioExecutionStage: vi.fn(),
});

const renderPipeline = (
  overrides: Partial<UseAioPipelineExecutionArgs> = {},
): RenderHookResult<
  Readonly<{ processAIO: () => Promise<void> }>,
  UseAioPipelineExecutionArgs
> => {
  const args = { ...makeArgs(), ...overrides };
  return renderHook(() => useAioPipelineExecution(args), {
    wrapper: I18nProvider,
  });
};

const runProcess = async (
  overrides: Partial<UseAioPipelineExecutionArgs> = {},
): Promise<void> => {
  const { result } = renderPipeline(overrides);
  await act(async () => {
    await result.current.processAIO();
  });
};

const useChapterImages = (): void => {
  useImageCollectionStore.setState({
    images: chapteredImages,
    activeId: chapteredImages[0]?.id ?? null,
    isExtractingUploads: false,
  });
  useAioPipelineStore.setState({ batchModeEnabled: true });
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  mockedPreparation.mockReset();
  mockedProcessor.mockReset();
  mockedConsolidation.mockReset();
  mockedChunks.mockReset();

  mockedProcessor.mockReturnValue(processImage);
  mockedConsolidation.mockReturnValue(consolidate);
  mockedPreparation.mockReturnValue(async () => makePrepared(true));
  processImage.mockClear();
  consolidate.mockClear();

  recordedIdsAfterSettle = [];

  useImageCollectionStore.setState({
    images,
    activeId: images[0]?.id ?? null,
    isExtractingUploads: false,
  });
  useAioPipelineStore.setState({
    aioSteps: {
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: false,
      cleanImage: false,
      render: true,
    },
    aioStageSelection: {
      detectText: 'detector',
      recognizeText: 'ocr',
      getTranslations: 'translation',
      segmentText: 'segment',
      cleanImage: 'clean',
    },
    aioSrcLang: 'ja',
    aioTgtLang: 'en',
    aioAbortController: null,
    aioBackendRestarting: false,
    aioExecutionStatus: null,
    batchModeEnabled: false,
    batchChapterPresetByChapterId: {},
    aioBatchProgress: null,
  });
  useUiShellStore.setState({ processing: false, progress: 0 });
  useAioBatchPauseStore.getState().reset();
});

describe('useAioPipelineExecution per-settle consolidation (chunk branch)', () => {
  const r0 = makeBatchResult('img-0');
  const r1 = {
    ...makeBatchResult('img-1'),
    cleanedDownload: cleanedDownload('img-1'),
  };
  const r2 = {
    ...makeBatchResult('img-2'),
    cleanedDownload: cleanedDownload('img-2'),
  };

  it('consolidates the ACCUMULATED results on each chunk settle without polluting pauseConsolidatedImageIds', async () => {
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([r0, r1]);
      recordedIdsAfterSettle.push([
        ...useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
      ]);
      input.onChunkSettled?.([r2]);
      recordedIdsAfterSettle.push([
        ...useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
      ]);
      return { batchIds: ['batch-1'], results: [r0, r1, r2] };
    });

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(3);
    const [chunk1, chunk2, final] = consolidate.mock.calls;
    expect(chunk1?.[0]).toEqual([r0, r1]);
    expect(chunk1?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
    // Chunk 2 passes the accumulated results (chunk 1's cleanedDownload
    // included) — NOT chunk-only results, which would revoke chunk 1's
    // preview across setAioDownloadItems.
    expect(chunk2?.[0]).toEqual([r0, r1, r2]);
    expect(chunk2?.[1]).toEqual({
      skipImageIds: new Set(['img-0', 'img-1']),
      writeSnapshots: false,
    });
    expect(
      chunk2?.[0].flatMap((result) =>
        result.cleanedDownload ? [result.cleanedDownload.fileName] : [],
      ),
    ).toEqual(['img-1-clean.png', 'img-2-clean.png']);
    expect(final?.[0]).toEqual([r0, r1, r2]);
    expect(final?.[1]).toEqual({
      skipImageIds: new Set<string>(),
    });
    expect(recordedIdsAfterSettle).toEqual([[], []]);
    expect(useStatusStore.getState().statusMessage).toContain('AIO finished.');
  });

  it('ignores an empty settle without consolidating or recording ids', async () => {
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([]);
      recordedIdsAfterSettle.push([
        ...useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
      ]);
      return { batchIds: ['batch-1'], results: [r0, r1, r2] };
    });

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(1);
    const [final] = consolidate.mock.calls;
    expect(final?.[0]).toEqual([r0, r1, r2]);
    expect(final?.[1]).toEqual({ skipImageIds: new Set<string>() });
    expect(recordedIdsAfterSettle).toEqual([[]]);
  });

  it('lets the pause boundary skip already-consolidated ids after streaming', async () => {
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([r0, r1]);
      useUiShellStore.setState({ processing: true });
      useAioBatchPauseStore.getState().requestPause();
      const unsubscribe: () => void = useAioBatchPauseStore.subscribe(
        (state) => {
          if (state.isPaused) {
            unsubscribe();
            useAioBatchPauseStore.getState().resume();
          }
        },
      );
      await input.beforeChunk?.();
      input.onChunkSettled?.([r2]);
      return { batchIds: ['batch-1'], results: [r0, r1, r2] };
    });

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(4);
    const [chunk1, boundary, chunk2, final] = consolidate.mock.calls;
    expect(chunk1?.[0]).toEqual([r0, r1]);
    expect(chunk1?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
    expect(boundary?.[0]).toEqual([r0, r1]);
    expect(boundary?.[1]).toEqual({
      skipImageIds: new Set(['img-0', 'img-1']),
      writeSnapshots: false,
    });
    expect(chunk2?.[0]).toEqual([r0, r1, r2]);
    expect(chunk2?.[1]).toEqual({
      skipImageIds: new Set(['img-0', 'img-1']),
      writeSnapshots: false,
    });
    expect(final?.[1]).toEqual({
      skipImageIds: new Set(['img-0', 'img-1']),
    });
  });

  it('contains a mid-flight consolidate exception without aborting the batch or desyncing skip ids', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consolidate.mockImplementationOnce(() => {
      throw new Error('transient-store-write');
    });
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([r0, r1]);
      input.onChunkSettled?.([r2]);
      return { batchIds: ['batch-1'], results: [r0, r1, r2] };
    });

    await runProcess();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(consolidate).toHaveBeenCalledTimes(3);
    expect(consolidate.mock.calls[1]?.[0]).toEqual([r0, r1, r2]);
    expect(consolidate.mock.calls[1]?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
    expect(consolidate.mock.calls[2]?.[1]).toEqual({
      skipImageIds: new Set<string>(),
    });
    warnSpy.mockRestore();
  });

  it('stops consolidating once the hook unmounts (late settle cannot mutate stores)', async () => {
    const { result, unmount } = renderPipeline();
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([r0]);
      unmount();
      input.onChunkSettled?.([r1]);
      return { batchIds: ['batch-1'], results: [r0, r1] };
    });

    await act(async () => {
      await result.current.processAIO();
    });

    expect(consolidate).toHaveBeenCalledTimes(1);
    expect(consolidate.mock.calls[0]?.[0]).toEqual([r0]);
    expect(consolidate.mock.calls[0]?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
  });

  it('stops consolidating once the execution controller is stale', async () => {
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([r0]);
      useAioPipelineStore.setState({ aioAbortController: new AbortController() });
      input.onChunkSettled?.([r1]);
      return { batchIds: ['batch-1'], results: [r0, r1] };
    });

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(1);
    expect(consolidate.mock.calls[0]?.[0]).toEqual([r0]);
  });

  it('stops consolidating once the image collection changes mid-run', async () => {
    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([r0]);
      useImageCollectionStore.setState({ images: [] });
      input.onChunkSettled?.([r1]);
      return { batchIds: ['batch-1'], results: [r0, r1] };
    });

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(1);
    expect(consolidate.mock.calls[0]?.[0]).toEqual([r0]);
  });
});

describe('useAioPipelineExecution per-settle consolidation (chapter branch)', () => {
  it('consolidates a settled chapter and never settles failed-chapter results', async () => {
    useChapterImages();
    const r0 = makeBatchResult('img-0');
    const r1 = makeBatchResult('img-1');
    mockedChunks.mockImplementation(async (input) => {
      if (input.images[0]?.id === 'img-0') {
        return { batchIds: ['batch-a'], results: [r0, r1] };
      }
      throw new Error('chapter b exploded');
    });

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(2);
    const [chapterA, final] = consolidate.mock.calls;
    expect(chapterA?.[0]).toEqual([r0, r1]);
    expect(chapterA?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
    expect(final?.[0].map((result) => result.imageId)).toEqual([
      'img-0',
      'img-1',
      'img-2',
    ]);
    const failedChapterResult = final?.[0][2];
    expect(failedChapterResult).toMatchObject({
      imageId: 'img-2',
      countAsProcessed: false,
      executionNotices: ['page-2.png: chapter b exploded'],
    });
    expect(consolidate.mock.calls.slice(0, -1).every(([results]) =>
      results.every((result) => result.imageId !== 'img-2'),
    )).toBe(true);
    expect(final?.[1]).toEqual({
      skipImageIds: new Set<string>(),
    });
  });

  it('ignores the empty settle of a chapter skipped by an abort', async () => {
    useChapterImages();
    const r0 = makeBatchResult('img-0');
    const onAutoRunCompleted = vi.fn();
    mockedChunks.mockImplementation(async (input) => {
      if (input.images[0]?.id === 'img-0') {
        useAioPipelineStore.getState().aioAbortController?.abort();
        return { batchIds: ['batch-a'], results: [r0] };
      }
      throw new Error('chapter b must not run');
    });

    await runProcess({ onAutoRunCompleted });

    expect(consolidate).toHaveBeenCalledTimes(1);
    expect(consolidate.mock.calls[0]?.[0]).toEqual([r0]);
    expect(consolidate.mock.calls[0]?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
    expect(onAutoRunCompleted).not.toHaveBeenCalled();
  });
});

const makeStageRegion = (id: string, renderText?: string): AioTextRegion => ({
  id,
  bbox: [2, 2, 20, 20],
  score: 0.95,
  source: 'model',
  modelKey: 'detector',
  renderText,
});

describe('useAioPipelineExecution per-settle consolidation (cloud item branch + real timeline integration)', () => {
  it('passes accumulated results and skipImageIds on each cloud onItemSettled call', async () => {
    mockedPreparation.mockReturnValue(async () => makePrepared(false));
    processImage.mockImplementation(async (image: LoadedImage) => ({
      ...makeBatchResult(image.id),
      cleanedDownload: cleanedDownload(image.id),
    }));

    await runProcess();

    expect(consolidate).toHaveBeenCalledTimes(4);
    const [item0, item1, item2, final] = consolidate.mock.calls;
    expect(item0?.[0].map((r) => r.imageId)).toEqual(['img-0']);
    expect(item0?.[1]).toEqual({
      skipImageIds: new Set<string>(),
      writeSnapshots: false,
    });
    expect(item1?.[0].map((r) => r.imageId)).toEqual(['img-0', 'img-1']);
    expect(item1?.[1]).toEqual({
      skipImageIds: new Set(['img-0']),
      writeSnapshots: false,
    });
    expect(item2?.[0].map((r) => r.imageId)).toEqual(['img-0', 'img-1', 'img-2']);
    expect(item2?.[1]).toEqual({
      skipImageIds: new Set(['img-0', 'img-1']),
      writeSnapshots: false,
    });
    expect(final?.[1]).toEqual({ skipImageIds: new Set<string>() });
  });

  it('preserves distinct per-stage timeline snapshots and reuses unchanged previewUrls with real consolidation', async () => {
    const actualConsolidationModule = await vi.importActual<
      typeof import('@/hooks/useAioResultConsolidation')
    >('@/hooks/useAioResultConsolidation');

    let capturedSnapshots: AioPipelineSnapshot[] = [];
    const setAioPipelineSnapshots = vi.fn(
      (snapshots: AioPipelineSnapshot[]) => {
        capturedSnapshots = snapshots;
      },
    );
    const createdUrls: string[] = [];
    const revokedUrls: string[] = [];
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => {
        const nextUrl = `blob:aio-clean-${createdUrls.length + 1}`;
        createdUrls.push(nextUrl);
        return nextUrl;
      });
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation((url: string) => {
        revokedUrls.push(url);
      });

    useExportStore.setState({ downloadItems: [] });
    useRegionEditorStore.setState({
      aioDetectionsByImage: {},
      aioSelectedRegionByImage: {},
    });

    mockedConsolidation.mockImplementation(() =>
      actualConsolidationModule.useAioResultConsolidation({
        aioSteps: {
          recognizeText: true,
          getTranslations: false,
          segmentText: false,
          cleanImage: true,
          render: true,
        },
        buildAioImageSnapshotIndexMap: () => ({}),
        setAioAutoProcessedImageById: vi.fn(),
        setAioDetectionsByImage: (value) =>
          useRegionEditorStore.getState().setAioDetectionsByImage(value),
        setAioSelectedRegionByImage: (value) =>
          useRegionEditorStore.getState().setAioSelectedRegionByImage(value),
        setAioPipelineSnapshots,
        setAioPipelineSnapshotIndex: vi.fn(),
        setAioImageSnapshotIndexById: vi.fn(),
        setAioAutoHistoryAvailable: vi.fn(),
        setAioDownloadItems: (entries) =>
          useExportStore.getState().setAioDownloadItems(entries),
      }),
    );

    const richR0: AioBatchImageResult = {
      ...makeBatchResult('img-0'),
      detectDetections: [makeStageRegion('det-0')],
      ocrDetections: [makeStageRegion('ocr-0')],
      cleanDetections: [makeStageRegion('clean-0')],
      renderDetections: [makeStageRegion('render-0', 'Rendered 0')],
      cleanedDownload: cleanedDownload('img-0'),
    };
    const richR1: AioBatchImageResult = {
      ...makeBatchResult('img-1'),
      detectDetections: [makeStageRegion('det-1')],
      ocrDetections: [makeStageRegion('ocr-1')],
      cleanDetections: [makeStageRegion('clean-1')],
      renderDetections: [makeStageRegion('render-1', 'Rendered 1')],
      cleanedDownload: cleanedDownload('img-1'),
    };

    mockedChunks.mockImplementation(async (input) => {
      input.onChunkSettled?.([richR0]);
      input.onChunkSettled?.([richR1]);
      return { batchIds: ['batch-1'], results: [richR0, richR1] };
    });

    await runProcess();

    const detectStage = capturedSnapshots.find((s) => s.key === 'detectText');
    const ocrStage = capturedSnapshots.find((s) => s.key === 'recognizeText');
    const renderStage = capturedSnapshots.find((s) => s.key === 'render');
    expect(detectStage?.detectionsByImage['img-0']?.[0]?.id).toBe('det-0');
    expect(ocrStage?.detectionsByImage['img-0']?.[0]?.id).toBe('ocr-0');
    expect(renderStage?.detectionsByImage['img-0']?.[0]?.id).toBe('render-0');
    expect(detectStage?.detectionsByImage['img-1']?.[0]?.id).toBe('det-1');
    expect(ocrStage?.detectionsByImage['img-1']?.[0]?.id).toBe('ocr-1');
    expect(renderStage?.detectionsByImage['img-1']?.[0]?.id).toBe('render-1');

    expect(createdUrls).toEqual(['blob:aio-clean-1', 'blob:aio-clean-2']);
    expect(revokedUrls).toEqual([]);

    const replacementBlob = new Blob(['clean-v2'], { type: 'image/png' });
    useExportStore.getState().setAioDownloadItems([
      {
        sourceImageId: 'img-0',
        fileName: 'img-0-clean.png',
        blob: richR0.cleanedDownload?.blob ?? replacementBlob,
      },
      {
        sourceImageId: 'img-0',
        fileName: 'img-0-clean-v2.png',
        blob: replacementBlob,
      },
      {
        sourceImageId: 'img-1',
        fileName: 'img-1-clean.png',
        blob: richR1.cleanedDownload?.blob ?? replacementBlob,
      },
    ]);
    const aioItems = useExportStore
      .getState()
      .downloadItems.filter((item) => item.scope === 'aio');
    expect(aioItems.map((item) => item.name)).toEqual([
      'img-0-clean-v2.png',
      'img-1-clean.png',
    ]);
    expect(createdUrls).toEqual([
      'blob:aio-clean-1',
      'blob:aio-clean-2',
      'blob:aio-clean-3',
    ]);
    expect(revokedUrls).toEqual(['blob:aio-clean-1']);

    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
