import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardFooter from '@/components/dashboard/DashboardFooter';
import type { AioBatchProgress } from '@/pages/dashboard/lib/aio-batch-progress';
import type { BatchProgress } from '@/pages/dashboard/lib/batch-wire';
import { startBatchProgressPolling } from '@/pages/dashboard/lib/local-aio-batch';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useEconomicUiStore } from '@/pages/dashboard/stores/economic-ui-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useEconomicUiMode } from './use-economic-ui-mode';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string): string => key,
  }),
}));

const STAGED_PROGRESS: AioBatchProgress = {
  chapterIndex: 1,
  chapterCount: 2,
  chapterLabel: 'Chapter 1',
  stageLabel: 'OCR',
  etaSeconds: 12,
};

const WIRE_PROGRESS = {
  batchId: 'econ-batch',
  total: 3,
  completed: 1,
  failed: 0,
  stageUnitsStarted: 4,
  currentIndex: 1,
  currentName: 'page-2.png',
  currentStage: 'ocr',
  cancelled: false,
  finished: false,
  updatedAt: '2026-11-14T00:00:00.000Z',
};

const setVisibility = (state: 'hidden' | 'visible'): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

const restoreVisibility = (): void => {
  Reflect.deleteProperty(document, 'visibilityState');
};

const resetStores = (): void => {
  const economic = useEconomicUiStore.getState();
  economic.markVisible();
  economic.clearPending();
  useStatusStore.getState().setStatusMessage('ready');
  useAioPipelineStore.getState().setAioBatchProgress(null);
};

beforeEach(resetStores);

afterEach(() => {
  cleanup();
  restoreVisibility();
});

describe('useEconomicUiMode', () => {
  it('stages batch-path writes while hidden and leaves the UI stores untouched', () => {
    renderHook(() => useEconomicUiMode());

    act(() => {
      setVisibility('hidden');
    });
    expect(useEconomicUiStore.getState().hidden).toBe(true);

    expect(
      useEconomicUiStore.getState().stageStatusMessage('AIO chapter 2/3 · c2'),
    ).toBe(true);
    expect(
      useEconomicUiStore.getState().stageBatchProgress(STAGED_PROGRESS),
    ).toBe(true);

    expect(useStatusStore.getState().statusMessage).toBe('ready');
    expect(useAioPipelineStore.getState().aioBatchProgress).toBeNull();
  });

  it('flushes pending values once on visible and clears the staging slots', () => {
    renderHook(() => useEconomicUiMode());

    act(() => {
      setVisibility('hidden');
    });
    useEconomicUiStore.getState().stageStatusMessage('staged message');
    useEconomicUiStore.getState().stageBatchProgress(STAGED_PROGRESS);

    act(() => {
      setVisibility('visible');
    });

    expect(useStatusStore.getState().statusMessage).toBe('staged message');
    expect(useAioPipelineStore.getState().aioBatchProgress).toEqual(
      STAGED_PROGRESS,
    );
    expect(useEconomicUiStore.getState().pendingStatusMessage).toBeNull();
    expect(useEconomicUiStore.getState().pendingBatchProgress).toBeNull();

    useStatusStore.getState().setStatusMessage('written after flush');
    act(() => {
      setVisibility('visible');
    });
    expect(useStatusStore.getState().statusMessage).toBe('written after flush');
  });

  it('flushes an empty staging slot without clobbering current store state', () => {
    renderHook(() => useEconomicUiMode());

    act(() => {
      setVisibility('hidden');
    });
    act(() => {
      setVisibility('visible');
    });

    expect(useStatusStore.getState().statusMessage).toBe('ready');
    expect(useAioPipelineStore.getState().aioBatchProgress).toBeNull();
  });

  it('keeps the batch progress poll consumer running while hidden', async () => {
    renderHook(() => useEconomicUiMode());

    act(() => {
      setVisibility('hidden');
    });

    const consumed: BatchProgress[] = [];
    const fetchStub = vi.fn(
      async (
        _input: RequestInfo | URL,
        _init?: RequestInit,
      ): Promise<Response> =>
        new Response(JSON.stringify(WIRE_PROGRESS), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const controller = new AbortController();
    const stopPolling = startBatchProgressPolling({
      localApiUrl: 'http://127.0.0.1:9',
      batchId: WIRE_PROGRESS.batchId,
      signal: controller.signal,
      onUpdate: (progress: BatchProgress): void => {
        consumed.push(progress);
      },
      intervalMs: 5,
    });

    try {
      await vi.waitFor(() => {
        if (consumed.length === 0) {
          throw new Error('poll consumer was not invoked yet');
        }
      });
    } finally {
      stopPolling();
      vi.unstubAllGlobals();
    }

    expect(consumed[0]?.batchId).toBe(WIRE_PROGRESS.batchId);
    expect(fetchStub.mock.calls.length).toBeGreaterThan(0);
    expect(useStatusStore.getState().statusMessage).toBe('ready');
  });
});

describe('DashboardFooter economic-mode mount', () => {
  it('mounts exactly one listener instance and flushes once on visible', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');

    render(
      <DashboardFooter
        openBugReportModal={() => undefined}
        openProjectExternalLink={() => undefined}
        projectDiscordUrl="https://discord.example"
        projectWebsiteUrl="https://example.com"
      />,
    );

    const visibilityListeners = addSpy.mock.calls.filter(
      (call) => call[0] === 'visibilitychange',
    ).length;
    addSpy.mockRestore();
    expect(visibilityListeners).toBe(1);

    act(() => {
      setVisibility('hidden');
    });
    expect(
      useEconomicUiStore.getState().stageStatusMessage('footer staged'),
    ).toBe(true);

    act(() => {
      setVisibility('visible');
    });
    expect(useStatusStore.getState().statusMessage).toBe('footer staged');
    expect(useEconomicUiStore.getState().pendingStatusMessage).toBeNull();

    useStatusStore.getState().setStatusMessage('written after flush');
    act(() => {
      setVisibility('visible');
    });
    expect(useStatusStore.getState().statusMessage).toBe('written after flush');
  });
});
