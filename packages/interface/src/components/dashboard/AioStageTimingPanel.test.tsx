import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AioStageTimingPanel from './AioStageTimingPanel';
import type { BatchProgress } from '@/pages/dashboard/lib/batch-wire';
import { useAioStageTimingStore } from '@/pages/dashboard/stores/aio-stage-timing-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { copyTextToClipboardSafe } from '../../utils/clipboard';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string): string => key,
  }),
}));

vi.mock('../../utils/clipboard', () => ({
  copyTextToClipboardSafe: vi.fn(async (): Promise<void> => undefined),
}));

const wireProgress = (overrides: Partial<BatchProgress>): BatchProgress => ({
  batchId: 'chunk-1',
  total: 4,
  completed: 1,
  failed: 0,
  stageUnitsStarted: 2,
  currentIndex: 1,
  currentName: 'page-2.png',
  currentStage: 'ocr',
  cancelled: false,
  finished: false,
  updatedAt: '2026-11-14T00:00:00.000Z',
  stageSeconds: null,
  lastStageMs: null,
  ...overrides,
});

const seedStore = (): void => {
  const store = useAioStageTimingStore.getState();
  store.resetForRun();
  store.setProviderLine('cuda.executionprovider · gpu-profile', 'local');
  store.ingestWireProgress(
    wireProgress({
      batchId: 'chunk-1',
      stageSeconds: { detect: 1.0, ocr: 0.5 },
    }),
    'ch-1',
    'Chapter 1',
  );
  store.ingestWireProgress(
    wireProgress({
      batchId: 'chunk-1',
      stageSeconds: { detect: 2.5, ocr: 0.5, translation: 0 },
      completed: 2,
    }),
    'ch-1',
    'Chapter 1',
  );
};

beforeEach(() => {
  seedStore();
});

afterEach(() => {
  act(() => {
    useAioStageTimingStore.getState().resetForRun();
  });
});

describe('AioStageTimingPanel', () => {
  it('shows the empty state before any poll data', () => {
    act(() => {
      useAioStageTimingStore.getState().resetForRun();
    });
    render(<AioStageTimingPanel className="timing" />);

    const toggle = screen.getByRole('button', {
      name: 'dashboard.footer.timing.title ▸',
    });
    fireEvent.click(toggle);

    expect(screen.getByText('dashboard.footer.timing.empty')).toBeTruthy();
  });

  it('renders accumulated chapter timing, bottleneck and provider when open', () => {
    render(<AioStageTimingPanel className="timing" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.footer.timing.title ▸' }),
    );

    expect(
      screen.getByText('dashboard.footer.timing.accumulated'),
    ).toBeTruthy();
    expect(
      screen.getByText(/dashboard\.footer\.timing\.chapter/),
    ).toBeTruthy();
    expect(
      screen.getByText(/dashboard\.footer\.timing\.bottleneck/).textContent,
    ).toContain('2.5s');
    expect(screen.getByText(/detect 2\.5s/)).toBeTruthy();
    expect(
      screen.getByText('dashboard.footer.timing.providerLocal'),
    ).toBeTruthy();
    expect(screen.getByText('dashboard.footer.timing.cacheHit')).toBeTruthy();
  });

  it('hides the body again after the second toggle (aria-expanded flips)', () => {
    render(<AioStageTimingPanel className="timing" />);

    const toggle = screen.getByRole('button', {
      name: 'dashboard.footer.timing.title ▸',
    });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText('dashboard.footer.timing.accumulated'),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.footer.timing.title ▾' }),
    );
    expect(
      screen.queryByText('dashboard.footer.timing.accumulated'),
    ).toBeNull();
  });

  it('hides the per-page section and copy action while no report arrived', () => {
    render(<AioStageTimingPanel className="timing" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.footer.timing.title ▸' }),
    );

    expect(
      screen.queryByRole('button', {
        name: 'dashboard.footer.timing.pages ▸',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'dashboard.footer.timing.copyReport',
      }),
    ).toBeNull();
  });

  it('lists per-page stage timings from the report, sorted by arrival and index', () => {
    act(() => {
      useAioStageTimingStore.getState().ingestReportItems('chunk-1', [
        {
          index: 1,
          filename: 'page-2.png',
          status: 'success',
          stage_timings: { detect: 0.5, ocr: 2.5 },
        },
        {
          index: 0,
          filename: 'page-1.png',
          status: 'success',
          stage_timings: { detect: 1 },
        },
      ]);
    });
    render(<AioStageTimingPanel className="timing" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.footer.timing.title ▸' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'dashboard.footer.timing.pages ▸',
      }),
    );

    expect(screen.getByText(/1\. page-1\.png/).textContent).toBe(
      '1. page-1.png — detect 1s',
    );
    expect(screen.getByText(/2\. page-2\.png/).textContent).toBe(
      '2. page-2.png — detect 0.5s · ocr 2.5s',
    );
  });

  it('copies the plain-text digest and reports success through the status store', async () => {
    const copyMock = vi.mocked(copyTextToClipboardSafe);
    copyMock.mockClear();
    act(() => {
      useAioStageTimingStore.getState().ingestReportItems('chunk-1', [
        {
          index: 0,
          filename: 'page-1.png',
          status: 'success',
          stage_timings: { detect: 2.5 },
        },
      ]);
    });
    render(<AioStageTimingPanel className="timing" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.footer.timing.title ▸' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'dashboard.footer.timing.copyReport',
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(copyMock).toHaveBeenCalledTimes(1);
    const digest = copyMock.mock.calls[0]?.[0] ?? '';
    expect(digest).toContain('AIO timing report');
    expect(digest).toContain('detect 2.5s');
    expect(useStatusStore.getState().statusMessage).toBe(
      'dashboard.footer.timing.copied',
    );
    expect(useStatusStore.getState().statusToneExplicit).toBe(true);
  });

  it('reports a copy failure through the status store without throwing', async () => {
    const copyMock = vi.mocked(copyTextToClipboardSafe);
    copyMock.mockClear();
    copyMock.mockRejectedValueOnce(new Error('clipboard blocked'));
    act(() => {
      useAioStageTimingStore.getState().ingestReportItems('chunk-1', [
        {
          index: 0,
          filename: 'page-1.png',
          status: 'success',
          stage_timings: { detect: 2.5 },
        },
      ]);
    });
    render(<AioStageTimingPanel className="timing" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.footer.timing.title ▸' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'dashboard.footer.timing.copyReport',
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useStatusStore.getState().statusMessage).toBe(
      'dashboard.footer.timing.copyFailed',
    );
  });
});
