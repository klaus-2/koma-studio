import { renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../i18n';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import type { LoadedImage, AioBatchImageResult } from '../types/dashboard.types';
import type { RenderTextStyle } from '../utils/renderText';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '../utils/customLlm';
import { useAioSingleImageProcessor } from './useAioSingleImageProcessor';

vi.mock('../aio-stages', () => ({
  getAioStageReadiness: vi.fn(() => ({ runnable: true })),
  resolveUpstreamRegions: vi.fn((_stage: string, regions: unknown) => regions),
  runDetectTextStage: vi.fn(async () => ({ value: [], notice: null })),
  runRecognizeTextStage: vi.fn(async () => ({ value: [], notice: null })),
  runGetTranslationsStage: vi.fn(async () => ({ value: [], notice: null })),
  runSegmentTextStage: vi.fn(async () => ({ value: [], notice: null })),
  runCleanImageStage: vi.fn(async () => ({ value: PNG_BLOB, notice: null })),
  runCleanImageAiStage: vi.fn(async () => ({ value: PNG_BLOB, notice: null })),
}));

const sessionMocks = {
  assertNotAborted: vi.fn(),
  pushNotice: vi.fn(),
  ensureStageImageBlob: vi.fn((blob: Blob) => blob),
  buildCleanDownloadName: vi.fn(
    (prefix: string, name: string) => `${prefix}-${name}`,
  ),
};

vi.mock('../pages/dashboard/hooks/aio-stage-runner', () => ({
  createAioStageRunSession: vi.fn(() => ({
    stageRuntime: { localApiUrl: 'http://127.0.0.1:8765' },
    executionNotices: [],
    ...sessionMocks,
  })),
}));

vi.mock('../utils/page-source', () => ({
  materializePageForProcessing: vi.fn(async () => ({
    file: { name: 'page-01.png' } as unknown as File,
    width: 100,
    height: 100,
  })),
  releasePage: vi.fn(),
}));

vi.mock('../pages/dashboard/hooks/translator.execution', () => ({
  resolveWorkGlossarySettings: vi.fn(
    (_image: unknown, settings: unknown) => settings,
  ),
}));

vi.mock('../pages/dashboard/stores/region-editor-store', () => ({
  useRegionEditorStore: { getState: () => ({ typographyPresetState: {} }) },
}));

vi.mock('../typography/autoModeApply', () => ({
  applyModePresetBindingsToRegions: vi.fn(({ regions }: { regions: unknown }) => regions),
}));

vi.mock('../utils/dashboard.utils', () => ({
  cloneAioRegions: vi.fn((regions: unknown) => regions),
  cloneRenderStyle: vi.fn((style: unknown) => style),
}));

import {
  runCleanImageAiStage,
  runCleanImageStage,
  runSegmentTextStage,
} from '../aio-stages';

const PNG_BLOB = new Blob(['png'], { type: 'image/png' });
const LOCAL_API_URL = 'http://127.0.0.1:8765';

const REPLICATE_PROFILE = {
  apiBase: 'https://api.replicate.com/v1',
  apiKey: 'r8_test-key',
  model: 'dpakkk/image-object-removal',
  protocol: 'replicate' as const,
};

const baseRunConfig = {
  sourceLanguage: 'ja',
  targetLanguage: 'en',
  detectSelectionKey: 'detector',
  ocrSelectionKey: 'ocr',
  translationSelectionKey: 'translation',
  segmentSelectionKey: 'segment',
  cleanSelectionKey: 'lama_manga',
  aioSteps: {
    recognizeText: false,
    getTranslations: false,
    segmentText: true,
    cleanImage: true,
    render: false,
  },
  useCloudOcr: false,
  useLlmSettingsForOcr: false,
  useLlmSettingsForTranslation: false,
  llmSettings: DEFAULT_LLM_REQUEST_SETTINGS,
  selectedCustomOcrProfile: null,
  selectedCustomTranslationProfile: null,
  maskDilation: 5,
  hdStrategy: 'resize',
  hdResizeLimit: 960,
  hdCropMargin: 512,
  hdCropTriggerSize: 512,
};

const image = {
  id: 'img-1',
  file: { name: 'page-01.png' } as unknown as File,
} as unknown as LoadedImage;

const renderProcessor = () =>
  renderHook(
    () =>
      useAioSingleImageProcessor({
        localApiUrl: LOCAL_API_URL,
        minRegionSize: 64,
        renderDefaultStyle: {} as RenderTextStyle,
        applyDetectedGradientToStyle: vi.fn(),
        isDesktopRuntime: false,
        refreshSession: async () => null,
        parseApiError: async () => 'provider error',
        getAbortSignal: () => null,
        onStageStart: vi.fn(),
        setRuntimeExecutionNotice: vi.fn(),
      }),
    { wrapper: I18nProvider },
  );

type RunConfig = Parameters<
  ReturnType<typeof useAioSingleImageProcessor>
>[2];

describe('useAioSingleImageProcessor AI Clean branch', () => {
  beforeAll(() => {
    setDesktopBridgeProvider({ desktop: null });
  });

  beforeEach(() => {
    vi.mocked(runCleanImageAiStage).mockClear();
    vi.mocked(runCleanImageStage).mockClear();
    vi.mocked(runSegmentTextStage).mockClear();
    sessionMocks.ensureStageImageBlob.mockClear();
    sessionMocks.buildCleanDownloadName.mockClear();
  });

  it('skips segment and cleans through /clean/ai when AI Clean is on', async () => {
    const { result } = renderProcessor();

    const processed: AioBatchImageResult = await result.current(image, 0, {
      ...baseRunConfig,
      cleanViaAi: true,
      cleanAiModelKey: 'custom_clean:free::replicate::clean',
      cleanAiInstructions: '  keep tones  ',
      cleanAiCustomProfile: REPLICATE_PROFILE,
    } satisfies RunConfig);

    expect(runCleanImageAiStage).toHaveBeenCalledTimes(1);
    expect(runCleanImageAiStage).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: 'custom_clean:free::replicate::clean',
        additionalInstructions: 'keep tones',
        customProfile: REPLICATE_PROFILE,
      }),
      expect.objectContaining({ localApiUrl: LOCAL_API_URL }),
      expect.objectContaining({ stageLabel: expect.any(String) }),
    );
    expect(runSegmentTextStage).not.toHaveBeenCalled();
    expect(runCleanImageStage).not.toHaveBeenCalled();
    expect(processed.cleanedDownload).not.toBeNull();
    expect(processed.cleanedDownload?.fileName).toBe(
      'koma-studio-aio-clean-page-01.png',
    );
    expect(processed.countAsProcessed).toBe(true);
  });

  it('keeps the local segment and clean path when AI Clean is off', async () => {
    const { result } = renderProcessor();

    await result.current(image, 0, {
      ...baseRunConfig,
      cleanViaAi: false,
      cleanAiModelKey: '',
      cleanAiInstructions: '',
      cleanAiCustomProfile: null,
    } satisfies RunConfig);

    expect(runCleanImageStage).toHaveBeenCalledTimes(1);
    expect(runSegmentTextStage).toHaveBeenCalledTimes(1);
    expect(runCleanImageAiStage).not.toHaveBeenCalled();
  });
});
