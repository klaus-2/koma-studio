import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeoutAndRetry } from '@/utils/http';

import { I18nProvider } from '../i18n';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import { useAioExecutionPreparation } from './useAioExecutionPreparation';

vi.mock('@/utils/http', () => ({
  fetchWithTimeoutAndRetry: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchWithTimeoutAndRetry);

type PreparationArgs = Parameters<typeof useAioExecutionPreparation>[0];
type PreparedAioExecution = Awaited<
  ReturnType<ReturnType<typeof useAioExecutionPreparation>>
>;

const LOCAL_BATCH_STEPS: PreparationArgs['aioSteps'] = {
  detectText: true,
  recognizeText: false,
  getTranslations: false,
  segmentText: false,
  cleanImage: false,
  render: true,
};

const installedDetector = {
  status: 'installed',
  model: { id: 'detector', name: 'Detector' },
};

const localApiUrl = 'http://127.0.0.1:8765';

const makeArgs = (
  overrides: Partial<PreparationArgs> = {},
): PreparationArgs => ({
  imagesCount: 45,
  localApiUrl,
  aioSteps: LOCAL_BATCH_STEPS,
  aioSrcLang: 'ja',
  aioTgtLang: 'en',
  detectSelectionKey: 'detector',
  ocrSelectionKey: 'ocr',
  translationSelectionKey: 'translation',
  segmentSelectionKey: 'segment',
  cleanSelectionKey: 'clean',
  effectiveBatchConcurrency: 8,
  modelEntries: { detector: installedDetector },
  selectedCustomOcrProfile: null,
  selectedCustomTranslationProfile: null,
  getAioStageOption: () => null,
  openModelManagerForStage: vi.fn(),
  refreshSession: async () => null,
  getAuthToken: () => null,
  invalidateAioPipelineHistory: vi.fn(),
  setAioManualImageEditsByImage: vi.fn(),
  setAioManualHealingBusyByImage: vi.fn(),
  setProcessing: vi.fn(),
  setProgress: vi.fn(),
  setStatusMessage: vi.fn(),
  emitProcessStartWebhook: vi.fn(),
  ...overrides,
});

type StatusMessageSpy = ReturnType<
  typeof vi.fn<(message: string) => void>
>;

const lastStatusMessage = (spy: StatusMessageSpy): string =>
  spy.mock.calls.at(-1)?.[0] ?? '';

const runPrepare = async (
  args: PreparationArgs,
): Promise<NonNullable<PreparedAioExecution>> => {
  const { result } = renderHook(() => useAioExecutionPreparation(args), {
    wrapper: I18nProvider,
  });

  let prepared: PreparedAioExecution = null;

  await act(async () => {
    prepared = await result.current();
  });

  if (!prepared) {
    throw new Error('The preparation was refused.');
  }

  return prepared;
};

const capacityBody = (overrides: Record<string, number> = {}): string =>
  JSON.stringify({
    maxImages: 64,
    maxImageBytes: 50 * 1024 * 1024,
    requestedConcurrency: 8,
    effectiveConcurrency: 8,
    perImageBudgetSeconds: 1200,
    ...overrides,
  });

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('useAioExecutionPreparation capacity preflight', () => {
  it('renders 4 effective threads (not the image count) when the preflight fails', async () => {
    mockedFetch.mockRejectedValue(new Error('preflight offline'));
    const setStatusMessage = vi.fn<(message: string) => void>();

    const prepared = await runPrepare(
      makeArgs({ imagesCount: 45, effectiveBatchConcurrency: 8, setStatusMessage }),
    );

    expect(prepared.useLocalBatchPipeline).toBe(true);
    expect(prepared.capacityFallback).toBe(true);
    expect(prepared.batchCapacity).toEqual({
      maxImages: 64,
      maxImageBytes: 50 * 1024 * 1024,
      requestedConcurrency: 8,
      effectiveConcurrency: 4,
      perImageBudgetSeconds: 1200,
    });

    const message = lastStatusMessage(setStatusMessage);
    expect(message).toContain('4 effective threads');
    expect(message).not.toContain('45');
    expect(message).toContain(
      'Neighbor-image context applies within each 20-image chunk.',
    );

    const [url, init, options] = mockedFetch.mock.calls[0] ?? [];
    expect(url).toBe(`${localApiUrl}/pipeline/batch/capacity?concurrency=8`);
    expect(init).toEqual({ method: 'GET' });
    expect(options).toMatchObject({ timeoutMs: 10_000, retryCount: 0 });
  });

  it('shows the preflight effective concurrency when the backend clamps it', async () => {
    mockedFetch.mockResolvedValue(
      new Response(capacityBody({ effectiveConcurrency: 2 }), { status: 200 }),
    );
    const setStatusMessage = vi.fn<(message: string) => void>();

    const prepared = await runPrepare(makeArgs({ setStatusMessage }));

    expect(prepared.capacityFallback).toBe(false);
    expect(prepared.batchCapacity?.effectiveConcurrency).toBe(2);
    expect(lastStatusMessage(setStatusMessage)).toContain('2 effective threads');
  });

  it('shows the effective thread count, never the image count, on a small run', async () => {
    mockedFetch.mockResolvedValue(
      new Response(capacityBody(), { status: 200 }),
    );
    const setStatusMessage = vi.fn<(message: string) => void>();

    const prepared = await runPrepare(
      makeArgs({ imagesCount: 12, setStatusMessage }),
    );

    expect(prepared.batchCapacity?.effectiveConcurrency).toBe(8);
    const message = lastStatusMessage(setStatusMessage);
    expect(message).toContain('8 threads');
    expect(message).not.toContain('effective');
    expect(message).not.toContain('Neighbor-image');
  });

  it('does not run the capacity preflight for a cloud run', async () => {
    const prepared = await runPrepare(
      makeArgs({
        aioSteps: { ...LOCAL_BATCH_STEPS, recognizeText: true },
        ocrSelectionKey: 'google_ocr',
        getAioStageOption: () => ({
          key: 'google_ocr',
          name: 'Google OCR',
          device: 'cloud',
          use_case: 'OCR',
          available: true,
          implemented: true,
        }),
        refreshSession: async () => 'session-token',
      }),
    );

    expect(prepared.useLocalBatchPipeline).toBe(false);
    expect(prepared.batchCapacity).toBeNull();
    expect(prepared.capacityFallback).toBe(false);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
