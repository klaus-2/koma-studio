import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AioStageTimingPanel from './AioStageTimingPanel';
import type { BatchProgress } from '@/pages/dashboard/lib/batch-wire';
import { useAioStageTimingStore } from '@/pages/dashboard/stores/aio-stage-timing-store';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string): string => key,
  }),
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
});
