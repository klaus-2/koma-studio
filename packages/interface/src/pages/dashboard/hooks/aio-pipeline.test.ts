import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MIN_REGION_SIZE } from '@/constants/dashboard.constants';
import { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import {
  runLocalAioBatchChunks,
  type LocalAioBatchOptions,
} from '@/pages/dashboard/lib/local-aio-batch';
import { useAioPipelineExecution } from '@/pages/dashboard/hooks/aio-pipeline';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioBatchImageResult,
  LoadedImage,
} from '@/types/dashboard.types';
import type { CustomLlmProfile } from '@/utils/customLlm';
import { cloneRenderStyle } from '@/utils/dashboard.utils';

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
  file: new File([`page-${index}`], `page-${index}.png`, {
    type: 'image/png',
  }),
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

const succeedForImage = async (
  image: LoadedImage,
): Promise<AioBatchImageResult> => makeBatchResult(image.id);

const processImage = vi.fn(succeedForImage);

const consolidate = vi.fn((_results: AioBatchImageResult[]) => ({
  processedPagesCount: images.length,
  totalDetections: 0,
  totalRecognized: 0,
  totalTranslated: 0,
  totalSegmented: 0,
  totalCleaned: 0,
  totalRendered: 0,
  finalMessage: 'AIO finished.',
}));

const makeArgs = (): UseAioPipelineExecutionArgs => ({
  effectiveBatchConcurrency: 8,
  modelEntries: {},
  selectedCustomOcrProfile: null,
  selectedCustomTranslationProfile: null,
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

const runProcess = async (
  overrides: Partial<UseAioPipelineExecutionArgs> = {},
): Promise<void> => {
  const args = { ...makeArgs(), ...overrides };
  const { result } = renderHook(() => useAioPipelineExecution(args), {
    wrapper: I18nProvider,
  });

  await act(async () => {
    await result.current.processAIO();
  });
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
  processImage.mockReset();
  processImage.mockImplementation(succeedForImage);

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
  });
  useUiShellStore.setState({ processing: false, progress: 0 });
});

describe('useAioPipelineExecution local batch branch', () => {
  it('runs the chunked local batch and never calls the per-image processor', async () => {
    const observed: { progress?: number; status?: string } = {};
    const updateAioExecutionStage = vi.fn();
    mockedChunks.mockImplementation(async (input) => {
      input.onProgress?.(20, 45);
      observed.progress = useUiShellStore.getState().progress;
      input.onChunkState?.({
        chunkNumber: 2,
        chunkCount: 3,
        imageIndex: 1,
        stage: 'translation',
        name: 'page-1.png',
      });
      observed.status = useStatusStore.getState().statusMessage;
      return {
        batchIds: ['batch-1'],
        results: images.map((image) => makeBatchResult(image.id)),
      };
    });

    await runProcess({ updateAioExecutionStage });

    expect(mockedChunks).toHaveBeenCalledTimes(1);
    const call = mockedChunks.mock.calls[0]?.[0];
    expect(call?.images).toHaveLength(3);
    expect(call?.localApiUrl).toBe('http://127.0.0.1:8765');
    expect(call?.capacity).toEqual(CAPACITY);
    expect(call?.options).toMatchObject({
      sourceLanguage: 'ja',
      targetLanguage: 'en',
      detectModelKey: 'detector',
      ocrModelKey: 'ocr',
      translationModelKey: 'translation',
      segmentModelKey: 'segment',
      cleanModelKey: 'clean',
      minRegionSize: MIN_REGION_SIZE,
      maxAreaRatio: 0.75,
    });
    expect(call?.options.aioSteps).toMatchObject({
      recognizeText: true,
      getTranslations: true,
      segmentText: false,
      cleanImage: false,
      render: true,
    });
    expect(call?.options.renderDefaultStyle).toBe(RENDER_STYLE);
    expect(processImage).not.toHaveBeenCalled();
    expect(observed.progress).toBe(44);
    expect(observed.status).toBe('AIO batch 2/3 · page-1.png');
    // The polled stage is what drives the same indicator the per-image path
    // fed from onStageStart; without it the run sits on "Preparing…".
    expect(updateAioExecutionStage).toHaveBeenCalledWith(
      'auto',
      'getTranslations',
      images[1],
      1,
      3,
    );
    expect(consolidate).toHaveBeenCalledTimes(1);
  });
});

describe('useAioPipelineExecution cloud branch', () => {
  it('keeps the per-image processor path for cloud stages', async () => {
    mockedPreparation.mockReturnValue(async () => makePrepared(false));

    await runProcess();

    expect(mockedChunks).not.toHaveBeenCalled();
    expect(processImage).toHaveBeenCalledTimes(images.length);
    expect(processImage.mock.calls.map(([image]) => image.id)).toEqual([
      'img-0',
      'img-1',
      'img-2',
    ]);
  });

  it('returns a failed result for one image and continues the run', async () => {
    mockedPreparation.mockReturnValue(async () => makePrepared(false));
    processImage.mockImplementation(async (image) => {
      if (image.id === 'img-1') {
        throw new Error('OCR exploded\n    at stack line');
      }

      return makeBatchResult(image.id);
    });

    await runProcess();

    expect(processImage).toHaveBeenCalledTimes(images.length);
    expect(consolidate).toHaveBeenCalledTimes(1);

    const results = consolidate.mock.calls[0]?.[0] ?? [];
    expect(results).toHaveLength(images.length);
    expect(results[0]).toMatchObject({
      imageId: 'img-0',
      countAsProcessed: true,
    });
    expect(results[1]).toEqual({
      imageId: 'img-1',
      detectDetections: [],
      ocrDetections: [],
      translationDetections: [],
      segmentDetections: [],
      cleanDetections: [],
      renderDetections: [],
      cleanedDownload: null,
      countAsProcessed: false,
      executionNotices: ['page-1.png: OCR exploded'],
    });
    expect(results[2]).toMatchObject({
      imageId: 'img-2',
      countAsProcessed: true,
    });
  });
});

describe('useAioPipelineExecution custom AI payload', () => {
  const profile: CustomLlmProfile = {
    id: 'p1',
    stage: 'translation',
    label: 'freeLLMAPI',
    apiBase: 'http://127.0.0.1:31415/v1',
    apiKey: 'local-provider-key',
    model: 'auto',
    createdAt: '',
    updatedAt: '',
  };

  const captureCarriedProfile = async (
    translationKey: string,
  ): Promise<LocalAioBatchOptions['translationCustomProfile']> => {
    mockedPreparation.mockReturnValue(async () => ({
      ...makePrepared(true),
      selectedTranslationKey: translationKey,
    }));
    mockedChunks.mockImplementation(async () => ({
      batchIds: ['batch-1'],
      results: images.map((image) => makeBatchResult(image.id)),
    }));

    await runProcess({ selectedCustomTranslationProfile: profile });

    return mockedChunks.mock.calls[0]?.[0].options.translationCustomProfile ?? null;
  };

  it('carries the profile when the stage selects Custom AI', async () => {
    await expect(captureCarriedProfile('custom:p1')).resolves.toEqual(profile);
  });

  it('withholds the profile when a regular model is selected', async () => {
    await expect(captureCarriedProfile('opus-mt-ja-en')).resolves.toBeNull();
  });
});

describe('useAioPipelineExecution manual handoff', () => {
  it('hands the finished run to the editor once processing is released', async () => {
    mockedChunks.mockImplementation(async () => ({
      batchIds: ['batch-1'],
      results: images.map((image) => makeBatchResult(image.id)),
    }));
    const processingAtHandoff: boolean[] = [];

    await runProcess({
      onAutoRunCompleted: () => {
        processingAtHandoff.push(useUiShellStore.getState().processing);
      },
    });

    expect(processingAtHandoff).toEqual([false]);
  });

  it('stays in the automatic editor when the run fails', async () => {
    mockedChunks.mockRejectedValue(new Error('The cleaning image stage timed out'));
    const onAutoRunCompleted = vi.fn();

    await runProcess({ onAutoRunCompleted });

    expect(onAutoRunCompleted).not.toHaveBeenCalled();
  });
});
