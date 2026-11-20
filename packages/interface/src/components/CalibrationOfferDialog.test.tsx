// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import CalibrationOfferDialog from '@/components/CalibrationOfferDialog';

const { fetchWithTimeoutAndRetryMock } = vi.hoisted(() => ({
  fetchWithTimeoutAndRetryMock: vi.fn(),
}));

vi.mock('@/utils/http', () => ({
  fetchWithTimeoutAndRetry: fetchWithTimeoutAndRetryMock,
}));

const OFFER_FLAG_KEY = 'koma-studio.calibration-offer.v1';
const TUNABLES_KEY = 'koma-mini-backend-thread-settings-v1';

const okReport = (recommended: number | null): Record<string, unknown> => ({
  status: 'ok',
  started_at: '2026-11-19T00:00:00Z',
  completed_at: '2026-11-19T00:00:05Z',
  detector_model_key: 'font_rtdetr_v2',
  device: {
    name: 'cpu',
    has_gpu: false,
    cuda_available: false,
    total_vram_mb: null,
  },
  wall_clock_seconds: 5,
  results: [
    {
      megapixels: 4,
      status: 'ok',
      iterations: 2,
      throughput_images_per_second: 3.5,
      peak_vram_mb: null,
      downscaled: false,
      effective_megapixels: 4,
      error: null,
    },
  ],
  recommended_working_resolution: recommended,
  error: null,
});

const renderDialog = () =>
  render(
    <I18nProvider>
      <CalibrationOfferDialog />
    </I18nProvider>,
  );

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  window.localStorage.clear();
  useUiShellStore.setState({ processing: false });
  fetchWithTimeoutAndRetryMock.mockReset();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('CalibrationOfferDialog', () => {
  it('offers calibration on the first dashboard entry', async () => {
    fetchWithTimeoutAndRetryMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'never-run' }), { status: 200 }),
    );
    renderDialog();
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('never offers while a processing run is active', () => {
    useUiShellStore.setState({ processing: true });
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('persists the offer flag when declined and does not ask again', () => {
    const first = renderDialog();
    fireEvent.click(screen.getByText('Not now'));
    expect(window.localStorage.getItem(OFFER_FLAG_KEY)).not.toBeNull();
    first.unmount();
    // Remount: the answer flag prevents a new offer.
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('accepting calls the calibration endpoint', async () => {
    fetchWithTimeoutAndRetryMock.mockImplementation(
      async (url: string) =>
        new Response(JSON.stringify(url.includes('/calibration/run') ? okReport(16) : okReport(16)), {
          status: 200,
        }),
    );
    renderDialog();
    fireEvent.click(screen.getByText('Calibrate now'));
    await waitFor(() => {
      const runCall = fetchWithTimeoutAndRetryMock.mock.calls.find(([url]) =>
        String(url).includes('/calibration/run'),
      );
      expect(runCall).toBeDefined();
      expect(String(runCall?.[0])).toContain('/calibration/run');
    });
    expect(screen.getByText('Recommended working resolution: 16 MP')).toBeDefined();
  });

  it('applies the recommendation through the existing tunables save flow', async () => {
    fetchWithTimeoutAndRetryMock.mockResolvedValue(
      new Response(JSON.stringify(okReport(16)), { status: 200 }),
    );
    renderDialog();
    fireEvent.click(screen.getByText('Calibrate now'));
    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Apply'));
    });
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(TUNABLES_KEY) ?? 'null',
      ) as Record<string, unknown> | null;
      expect(saved).not.toBeNull();
      expect(saved?.workingResolutionMegapixels).toBe(16);
    });
  });

  it('a failed benchmark shows the failure and applies nothing', async () => {
    fetchWithTimeoutAndRetryMock.mockRejectedValue(new Error('offline'));
    renderDialog();
    fireEvent.click(screen.getByText('Calibrate now'));
    await waitFor(() => {
      expect(screen.getByText('No safe working resolution was found. Nothing was applied.')).toBeDefined();
    });
    expect(screen.queryByText('Apply')).toBeNull();
    expect(window.localStorage.getItem(TUNABLES_KEY)).toBeNull();
  });

  it('a failed report never enables the Apply button', async () => {
    fetchWithTimeoutAndRetryMock.mockResolvedValue(
      new Response(
        JSON.stringify({ ...okReport(null), status: 'failed', recommended_working_resolution: null }),
        { status: 200 },
      ),
    );
    renderDialog();
    fireEvent.click(screen.getByText('Calibrate now'));
    await waitFor(() => {
      expect(screen.getByText('No safe working resolution was found. Nothing was applied.')).toBeDefined();
    });
    // The Apply button stays in the DOM (phase 'result') but disabled.
    const applyButton = screen.getByText('Apply').closest('button');
    expect(applyButton?.disabled).toBe(true);
    expect(window.localStorage.getItem(TUNABLES_KEY)).toBeNull();
  });
});
