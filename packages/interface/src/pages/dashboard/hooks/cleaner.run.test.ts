import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCleaner } from '@/pages/dashboard/hooks/cleaner';
import type { CleanerRunContext } from '@/pages/dashboard/hooks/cleaner.types';
import { useCleanerStore } from '@/pages/dashboard/stores/cleaner-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import { DEFAULT_LLM_REQUEST_SETTINGS } from '@/utils/customLlm';
import type { LoadedImage } from '@/types/dashboard.types';

const cleanerInitial = useCleanerStore.getState();
const statusInitial = useStatusStore.getState();
const uiInitial = useUiShellStore.getState();

function makeImage(id: string): LoadedImage {
  return {
    id,
    file: new File(['x'], `${id}.png`, { type: 'image/png' }),
    url: 'data:image/png;base64,AA==',
    width: 4,
    height: 4,
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
  };
}

function makeContext(overrides: Partial<CleanerRunContext> = {}): CleanerRunContext {
  return {
    images: [makeImage('img-1')],
    activeImage: null,
    localApiUrl: 'http://127.0.0.1:9',
    detectSelectionKey: 'det',
    ocrSelectionKey: 'ocr',
    segmentSelectionKey: 'seg',
    cleanSelectionKey: 'clean',
    selectedCleanerCustomProfile: null,
    sourceLanguage: 'ja',
    llmSettings: { ...DEFAULT_LLM_REQUEST_SETTINGS },
    maskDilation: 5,
    hdStrategy: 'original',
    hdResizeLimit: 960,
    hdCropMargin: 512,
    hdCropTriggerSize: 512,
    effectiveBatchConcurrency: 1,
    minRegionSize: 8,
    modelEntries: {},
    selectedCustomOcrProfile: null,
    discord: { setPreset: vi.fn(async () => undefined) },
    ensureVerifiedEmailOrNotify: () => true,
    validateManualLocalStageModel: () => true,
    getAioStageOption: () => ({
      key: 'ocr',
      name: 'OCR',
      device: 'cpu',
      use_case: 'ocr',
      implemented: true,
      available: true,
    }),
    parseApiError: async () => 'api-error',
    registerDownloads: vi.fn(),
    recordProcessedPages: vi.fn(),
    emitProcessStartWebhook: vi.fn(),
    emitProcessCompleteWebhook: vi.fn(),
    emitProcessErrorWebhook: vi.fn(),
    syncDiscordForTab: vi.fn(),
    // store bits resolved by resolveCleanerRunStores in production; tests pass stubs
    cleanerMode: 'assisted',
    cleanerAiModelKey: 'gemini_2_0_flash_ocr',
    cleanerAiAdditionalInstructions: '',
    setCleanerDetectionsByImage: vi.fn(),
    setCleanerSelectedRegionByImage: vi.fn(),
    setCleanerProcessedBaseByImage: vi.fn(),
    setCleanerRunMetaByImage: vi.fn(),
    setCleanerManualImageEditsByImage: vi.fn(),
    setCleanerHealingBusyByImage: vi.fn(),
    setProcessing: vi.fn(),
    setProgress: vi.fn(),
    setStatusMessage: vi.fn(),
    setRuntimeExecutionNotice: vi.fn(),
    t: ((key: string) => key) as CleanerRunContext['t'],
    ...overrides,
  };
}

beforeEach(() => {
  useCleanerStore.setState(cleanerInitial, true);
  useStatusStore.setState(statusInitial, true);
  useUiShellStore.setState(uiInitial, true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('runCleaner seam', () => {
  it('routes assisted mode to /detect and never to /sfx/classify', async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response('bad', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeContext({ cleanerMode: 'assisted' });
    await runCleaner(ctx);

    const urls = fetchMock.mock.calls.map((call) => String(call[0] ?? ''));
    expect(urls.some((url) => url.includes('/detect'))).toBe(true);
    expect(urls.some((url) => url.includes('/sfx/classify'))).toBe(false);
    expect(ctx.emitProcessStartWebhook).toHaveBeenCalledWith(
      'Cleaner Assistido',
      1,
      expect.objectContaining({ modelo_ocr: 'ocr' }),
    );
  });

  it('routes ai_sfx mode through the SFX classify path', async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0] ?? '');
      if (url.includes('/detect')) {
        return new Response(
          JSON.stringify({
            image_width: 4,
            image_height: 4,
            detections: [
              {
                id: 's1',
                bbox: [0, 0, 4, 4],
                score: 0.9,
                source: 'model',
                model_key: 'det',
                label: 'text_bubble',
                foreground_rgb: [0, 0, 0],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('bad', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeContext({
      cleanerMode: 'ai_sfx',
      cleanerAiModelKey: 'gemini_2_0_flash_ocr',
      minRegionSize: 1,
    });
    await runCleaner(ctx);

    const urls = fetchMock.mock.calls.map((call) => String(call[0] ?? ''));
    expect(urls.some((url) => url.includes('/detect'))).toBe(true);
    expect(ctx.emitProcessStartWebhook).toHaveBeenCalledWith(
      'AI SFX Cleaner',
      1,
      expect.anything(),
    );
  });

  it('fail-fast validates detect model before any network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const ctx = makeContext({
      cleanerMode: 'assisted',
      validateManualLocalStageModel: () => false,
    });
    await runCleaner(ctx);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});