import { renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../i18n';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import type { AioTextRegion, LoadedImage } from '../types/dashboard.types';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '../utils/customLlm';
import {
  DEFAULT_AIO_AI_OPTIONS,
  DEFAULT_IMAGE_EDIT_MODEL_CONFIG,
} from '../utils/imageEditModelConfig';
import {
  useAioAiImageProcessor,
  type SingleAioAiRunConfig,
} from './useAioAiImageProcessor';

const PNG_BLOB = new Blob(['png-bytes'], { type: 'image/png' });
const LOCAL_API_URL = 'http://127.0.0.1:8765';

const sampleRegion = (overrides: Partial<AioTextRegion> = {}): AioTextRegion =>
  ({
    id: 'r1',
    bbox: [10, 20, 110, 120],
    score: 0.95,
    source: 'model',
    modelKey: 'font_rtdetr_v2',
    recognizedText: 'こんにちは',
    translatedText: 'Hello!',
    ...overrides,
  }) as AioTextRegion;

vi.mock('../aio-stages', () => ({
  runDetectTextStage: vi.fn(async () => ({
    value: [sampleRegion()],
    notice: null,
  })),
  runRecognizeTextStage: vi.fn(async ({ regions }: { regions: AioTextRegion[] }) => ({
    value: regions.map((r) => ({ ...r, recognizedText: 'おい！' })),
    notice: null,
  })),
  runGetTranslationsStage: vi.fn(async ({ regions }: { regions: AioTextRegion[] }) => ({
    value: regions.map((r) => ({ ...r, translatedText: 'Hey!' })),
    notice: null,
  })),
  runAioAiStage: vi.fn(async () => ({
    value: {
      blob: PNG_BLOB,
      modelUsed: 'gemini-3.1-flash-image-preview',
      segments: 1,
      skipped: false,
    },
    notice: null,
  })),
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
    stageRuntime: { localApiUrl: LOCAL_API_URL },
    executionNotices: [],
    ...sessionMocks,
  })),
}));

vi.mock('../utils/page-source', () => ({
  materializePageForProcessing: vi.fn(async () => ({
    file: new File(['raw'], 'page-01.png', { type: 'image/png' }),
    width: 800,
    height: 1200,
  })),
  releasePage: vi.fn(),
}));

vi.mock('../pages/dashboard/hooks/translator.execution', () => ({
  resolveWorkGlossarySettings: vi.fn((_img: unknown, settings: unknown) => settings),
}));

vi.mock('../utils/dashboard.region.utils', () => ({
  resolveRegionRenderShape: vi.fn(() => ({
    kind: 'rounded' as const,
    source: 'refined' as const,
    cornerRadius: 12,
    innerBox: [18, 35, 102, 105] as [number, number, number, number],
    fitProfile: [0.5, 0.71, 1, 1, 0.71, 0.5],
  })),
}));

import {
  runAioAiStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
} from '../aio-stages';

const image = {
  id: 'img-1',
  file: { name: 'page-01.png' } as unknown as File,
} as unknown as LoadedImage;

const baseConfig: SingleAioAiRunConfig = {
  sourceLanguage: 'ja',
  targetLanguage: 'en',
  modelKey: 'custom_clean:gem-1',
  customProfile: {
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKey: 'AIza-key',
    model: 'gemini-3.1-flash-image-preview',
    protocol: 'gemini',
  },
  options: { ...DEFAULT_AIO_AI_OPTIONS },
  modelConfig: {
    ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG,
    imageQuality: '2k',
    aspectRatioStrategy: 'pad_unpad',
  },
  additionalInstructions: '  Keep handwritten font  ',
  llmSettings: {
    ...DEFAULT_LLM_REQUEST_SETTINGS,
    glossary: [{ source: '先輩', target: 'Senpai', never_translate: true }],
  },
  detectSelectionKey: 'font_rtdetr_v2',
  ocrSelectionKey: 'manga_ocr',
  translationSelectionKey: 'google_translate',
  useCloudOcr: false,
  useLlmSettingsForOcr: false,
  useLlmSettingsForTranslation: false,
  selectedCustomOcrProfile: null,
  selectedCustomTranslationProfile: null,
  previousPageContext: 'Prior dialogue line',
};

const renderProcessor = () =>
  renderHook(
    () =>
      useAioAiImageProcessor({
        localApiUrl: LOCAL_API_URL,
        minRegionSize: 64,
        parseApiError: async () => 'error',
        getAbortSignal: () => null,
        onStageStart: vi.fn(),
        setRuntimeExecutionNotice: vi.fn(),
      }),
    { wrapper: I18nProvider },
  );

describe('useAioAiImageProcessor', () => {
  beforeAll(() => {
    setDesktopBridgeProvider({ desktop: null });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runDetectTextStage).mockResolvedValue({
      value: [sampleRegion()],
      notice: null,
    } as never);
  });

  it('runs direct mode in one /aio/ai call forwarding glossary, modelConfig, and previous context', async () => {
    const { result } = renderProcessor();
    const res = await result.current(image, 0, baseConfig);

    expect(runDetectTextStage).not.toHaveBeenCalled();
    expect(runAioAiStage).toHaveBeenCalledTimes(1);
    expect(runAioAiStage).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: 'custom_clean:gem-1',
        additionalInstructions: 'Keep handwritten font',
        regions: [],
        modelConfig: expect.objectContaining({
          imageQuality: '2k',
          aspectRatioStrategy: 'pad_unpad',
        }),
        glossary: [{ source: '先輩', target: 'Senpai', never_translate: true }],
        previousPageContext: 'Prior dialogue line',
      }),
      expect.objectContaining({ localApiUrl: LOCAL_API_URL }),
      expect.objectContaining({ stageLabel: 'AIO AI' }),
    );
    expect(res.download.fileName).toBe('koma-studio-aio-ai-page-01.png');
    expect(res.skipped).toBe(false);
  });

  it('runs hybrid_guided with Refinar shape_kind + inner_box and skips empty pages', async () => {
    const { result } = renderProcessor();
    await result.current(image, 0, {
      ...baseConfig,
      options: { ...DEFAULT_AIO_AI_OPTIONS, executionMode: 'hybrid_guided' },
    });

    expect(runDetectTextStage).toHaveBeenCalledTimes(1);
    expect(runRecognizeTextStage).not.toHaveBeenCalled();
    expect(runAioAiStage).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: [
          expect.objectContaining({
            id: 'r1',
            shape_kind: 'rounded',
            inner_box: [18, 35, 102, 105],
          }),
        ],
      }),
      expect.anything(),
      expect.anything(),
    );

    vi.mocked(runAioAiStage).mockClear();
    vi.mocked(runDetectTextStage).mockResolvedValueOnce({
      value: [],
      notice: null,
    } as never);
    const skipped = await result.current(image, 0, {
      ...baseConfig,
      options: {
        ...DEFAULT_AIO_AI_OPTIONS,
        executionMode: 'hybrid_guided',
        skipEmptyPages: true,
      },
    });
    expect(skipped.skipped).toBe(true);
    expect(runAioAiStage).not.toHaveBeenCalled();
  });

  it('runs script_guided end-to-end (detect -> ocr -> translate -> /aio/ai) and carries nextPageContext', async () => {
    const { result } = renderProcessor();
    const res = await result.current(image, 0, {
      ...baseConfig,
      options: { ...DEFAULT_AIO_AI_OPTIONS, executionMode: 'script_guided' },
    });

    expect(runDetectTextStage).toHaveBeenCalledTimes(1);
    expect(runRecognizeTextStage).toHaveBeenCalledTimes(1);
    expect(runGetTranslationsStage).toHaveBeenCalledTimes(1);
    expect(runAioAiStage).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: [
          expect.objectContaining({
            source_text: 'おい！',
            translated_text: 'Hey!',
            shape_kind: 'rounded',
            inner_box: [18, 35, 102, 105],
          }),
        ],
      }),
      expect.anything(),
      expect.anything(),
    );
    expect(res.nextPageContext).toContain('Hey!');
  });

  it('forwards local HF diffusers model key with customProfile=null and diffusion tuning params', async () => {
    const { result } = renderProcessor();
    await result.current(image, 0, {
      ...baseConfig,
      modelKey: 'local_image_edit:flux2_klein_4b_gguf_q4',
      customProfile: null,
      modelConfig: {
        ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG,
        numInferenceSteps: 6,
        guidanceScale: 1.5,
        seed: 777,
      },
    });

    expect(runAioAiStage).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: 'local_image_edit:flux2_klein_4b_gguf_q4',
        customProfile: null,
        modelConfig: expect.objectContaining({
          numInferenceSteps: 6,
          guidanceScale: 1.5,
          seed: 777,
        }),
      }),
      expect.anything(),
      expect.anything(),
    );
  });
});
