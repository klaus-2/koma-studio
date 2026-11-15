import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AioCloudPreviewDialog } from './AioCloudPreviewDialog';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import type { CloudPreviewGate } from '@/pages/dashboard/lib/aio-cloud-preview';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>): string =>
      vars && 'count' in vars
        ? `${key}:${vars.count}`
        : vars && 'bytes' in vars
          ? `${key}:${vars.bytes}`
          : key,
  }),
}));

const OCR_LISTING = {
  models: [
    {
      key: 'google_cloud_vision',
      provider: 'google_cloud_vision',
      default_api_base: 'https://vision.googleapis.com/v1',
    },
  ],
};

const TRANSLATION_LISTING = {
  models: [
    {
      key: 'gpt_4_1',
      provider: 'openai',
      default_api_base: 'https://api.openai.com/v1',
    },
  ],
};

const fetchMock = vi.fn(
  async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/ocr/models')) {
      return new Response(JSON.stringify(OCR_LISTING), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/translation/models')) {
      return new Response(JSON.stringify(TRANSLATION_LISTING), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  },
);

const gate = (overrides: Partial<CloudPreviewGate>): CloudPreviewGate => ({
  required: true,
  ocr: {
    stage: 'ocr',
    provider: 'google_cloud_vision',
    providerLabel: 'google_cloud_vision',
    apiBase: null,
    source: 'builtin',
    modelKey: 'google_cloud_vision',
  },
  translation: {
    stage: 'translation',
    provider: 'gpt_4_1',
    providerLabel: 'gpt_4_1',
    apiBase: null,
    source: 'builtin',
    modelKey: 'gpt_4_1',
  },
  ...overrides,
});

const confirmed = vi.fn();
const cancelled = vi.fn();

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  confirmed.mockClear();
  cancelled.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AioCloudPreviewDialog', () => {
  it('renders destination, OCR image inventory and estimate layer', async () => {
    render(
      <AioCloudPreviewDialog
        gate={gate({})}
        imageCount={3}
        imageBytes={2048}
        textRegionCount={12}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/vision\.googleapis\.com/)).toBeTruthy();
    });
    expect(screen.getByText('dashboard.aio.cloudPreview.inventory.imageCount:3')).toBeTruthy();
    expect(screen.getByText('dashboard.aio.cloudPreview.inventory.imageBytes:2 KB')).toBeTruthy();
    expect(screen.getByText(/12/)).toBeTruthy();
    expect(screen.getByText('dashboard.aio.costEstimate.estimateLabel')).toBeTruthy();
  });

  it('translation-only gate never claims image uploads', async () => {
    render(
      <AioCloudPreviewDialog
        gate={gate({ ocr: null })}
        imageCount={3}
        imageBytes={2048}
        textRegionCount={12}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/api\.openai\.com/)).toBeTruthy();
    });
    expect(screen.queryByText(/inventory\.imageCount/)).toBeNull();
    expect(screen.queryByText(/inventory\.imageBytes/)).toBeNull();
  });

  it('confirm proceeds and cancel leaves everything untouched', async () => {
    render(
      <AioCloudPreviewDialog
        gate={gate({ ocr: null })}
        imageCount={1}
        imageBytes={0}
        textRegionCount={4}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.aio.cloudPreview.cancel' }),
    );
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.aio.cloudPreview.confirm' }),
    );
    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('dont-ask-again + confirm records the skip keys per provider', async () => {
    render(
      <AioCloudPreviewDialog
        gate={gate({})}
        imageCount={1}
        imageBytes={0}
        textRegionCount={4}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'dashboard.aio.cloudPreview.confirm' }),
    );

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('koma.aio.cloudPreview.skip.google_cloud_vision')).toBe(
      'true',
    );
    expect(localStorage.getItem('koma.aio.cloudPreview.skip.gpt_4_1')).toBe('true');
  });

  it('threshold warning appears only above the seeded limit', async () => {
    localStorage.setItem(
      'koma.aio.costRates',
      JSON.stringify({
        ocrPerImage: 1000,
        translationPer1kTokens: 1000,
        threshold: 5,
        maxOutputTokens: 4096,
      }),
    );
    const { unmount } = render(
      <AioCloudPreviewDialog
        gate={gate({ translation: null })}
        imageCount={2}
        imageBytes={0}
        textRegionCount={4}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/vision\.googleapis\.com/)).toBeTruthy();
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('dashboard.aio.costEstimate.thresholdWarning');
    unmount();

    localStorage.setItem(
      'koma.aio.costRates',
      JSON.stringify({
        ocrPerImage: 1000,
        translationPer1kTokens: 1000,
        threshold: 0,
        maxOutputTokens: 4096,
      }),
    );
    render(
      <AioCloudPreviewDialog
        gate={gate({ translation: null })}
        imageCount={2}
        imageBytes={0}
        textRegionCount={4}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/vision\.googleapis\.com/)).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancel runs on Escape keydown', () => {
    render(
      <AioCloudPreviewDialog
        gate={gate({})}
        imageCount={1}
        imageBytes={0}
        textRegionCount={4}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('rate edits persist to localStorage and recompute the estimate', async () => {
    render(
      <AioCloudPreviewDialog
        gate={gate({ translation: null })}
        imageCount={2}
        imageBytes={0}
        textRegionCount={4}
        knownTextChars={0}
        imagesWithKnownText={0}
        neighborContextEnabled={false}
        onConfirm={confirmed}
        onCancel={cancelled}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/vision\.googleapis\.com/)).toBeTruthy();
    });
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBe(3);
    const ocrInput = inputs[0];
    if (!(ocrInput instanceof HTMLInputElement)) {
      throw new Error('OCR rate input missing');
    }
    fireEvent.change(ocrInput, { target: { value: '2.5' } });
    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem('koma.aio.costRates') ?? '{}',
      ) as { ocrPerImage?: number };
      expect(stored.ocrPerImage).toBe(2.5);
    });
    expect(screen.getByDisplayValue('2.5')).toBeTruthy();
  });
});
