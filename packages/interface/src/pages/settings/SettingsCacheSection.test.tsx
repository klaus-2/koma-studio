import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import { saveCacheLimitSettings } from '@/utils/cacheLimitSettings';
import { SettingsCacheSection } from './SettingsCacheSection';

const t = (key: string): string => key;

const USAGE_FIXTURE = {
  stage_store: {
    file_size_bytes: 5 * 1024 * 1024,
    page_count: 1280,
    freelist_count: 3,
    tables: {
      segment_cache: { row_count: 12, logical_bytes: 2048 },
      clean_cache: { row_count: 2, logical_bytes: 2 * 1024 * 1024 },
      detect_cache: { row_count: 5, logical_bytes: 512 },
      ocr_cache: { row_count: 0, logical_bytes: 0 },
    },
  },
  translation_store: {
    file_size_bytes: 1024 * 1024,
    page_count: 256,
    freelist_count: 1,
    tables: {
      translation_cache: { row_count: 7, logical_bytes: 4096 },
      tm: { row_count: 3, logical_bytes: 128 },
    },
  },
};

const PRUNE_FIXTURE = {
  freed_rows: 4,
  freed_logical_bytes: 2 * 1024 * 1024,
  per_store: [],
};

const VACUUM_FIXTURE = {
  per_store: [
    {
      store: 'stage',
      file_size_bytes_before: 5 * 1024 * 1024,
      file_size_bytes_after: 3 * 1024 * 1024,
    },
  ],
};

let pruneStatus = 200;

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes('/diagnostics/cache-usage')) {
      return new Response(JSON.stringify(USAGE_FIXTURE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/cache/prune')) {
      return new Response(
        JSON.stringify(pruneStatus === 200 ? PRUNE_FIXTURE : { detail: 'conflict' }),
        {
          status: pruneStatus,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    if (url.includes('/cache/vacuum')) {
      return new Response(JSON.stringify(VACUUM_FIXTURE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  },
);

const resetBatchStores = (): void => {
  useUiShellStore.setState({ processing: false });
  useAioPipelineStore.setState({ aioAbortController: null });
};

const pruneCalls = (): Array<[URL | RequestInfo, RequestInit | undefined]> =>
  fetchMock.mock.calls.filter(
    (call): call is [URL | RequestInfo, RequestInit | undefined] =>
      String(call[0]).includes('/cache/prune'),
  );

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  localStorage.clear();
  resetBatchStores();
  pruneStatus = 200;
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsCacheSection', () => {
  it('renders usage rows from the backend payload', async () => {
    render(<SettingsCacheSection t={t} />);

    await waitFor(() => {
      expect(screen.getByText('segment_cache')).toBeTruthy();
    });
    expect(screen.getByText('clean_cache')).toBeTruthy();
    expect(screen.getByText('translation_cache')).toBeTruthy();
    expect(screen.getByText('tm')).toBeTruthy();
    expect(screen.getAllByText('2 MB').length).toBeGreaterThan(0);
    const stageBlock = screen.getByText('stage_store').closest('.koma-stg-item');
    expect(stageBlock?.textContent).toContain('5 MB');
    expect(stageBlock?.textContent).toContain('3 / 1280');
    expect(screen.getAllByText('settings.cache.table.rows').length).toBe(2);
    expect(screen.getAllByText('settings.cache.table.logicalBytes').length).toBe(2);
  });

  it('disables prune while a batch is active and re-enables after', async () => {
    render(<SettingsCacheSection t={t} />);

    const pruneButton = await screen.findByRole('button', {
      name: 'settings.cache.actions.prune',
    });

    act(() => {
      useUiShellStore.setState({ processing: true });
    });
    await waitFor(() => expect(pruneButton).toHaveProperty('disabled', true));

    act(() => {
      useUiShellStore.setState({ processing: false });
      useAioPipelineStore.setState({ aioAbortController: new AbortController() });
    });
    await waitFor(() => expect(pruneButton).toHaveProperty('disabled', true));

    act(() => {
      useAioPipelineStore.setState({ aioAbortController: null });
    });
    await waitFor(() => expect(pruneButton).toHaveProperty('disabled', false));
  });

  it('sends configured limits on prune and displays freed bytes', async () => {
    saveCacheLimitSettings({
      enabled: true,
      rowsPerTable: 1200,
      totalBytes: 268435456,
    });
    render(<SettingsCacheSection t={t} />);

    const pruneButton = await screen.findByRole('button', {
      name: 'settings.cache.actions.prune',
    });
    await waitFor(() => expect(pruneButton).toHaveProperty('disabled', false));
    fireEvent.click(pruneButton);

    await waitFor(() => {
      expect(pruneCalls().length).toBe(1);
    });
    const pruneCall = pruneCalls()[0];
    expect(pruneCall).toBeDefined();
    expect(JSON.parse(String(pruneCall?.[1]?.body))).toEqual({
      max_rows_per_table: 1200,
      max_total_bytes: 268435456,
    });
    await waitFor(() => {
      expect(screen.getByText(/settings.cache.freed/).textContent).toContain(
        '2 MB',
      );
    });
  });

  it('sends an empty body when the limit is off (store defaults)', async () => {
    saveCacheLimitSettings({ enabled: false, rowsPerTable: null, totalBytes: null });
    render(<SettingsCacheSection t={t} />);

    const pruneButton = await screen.findByRole('button', {
      name: 'settings.cache.actions.prune',
    });
    await waitFor(() => expect(pruneButton).toHaveProperty('disabled', false));
    fireEvent.click(pruneButton);

    await waitFor(() => {
      expect(pruneCalls().length).toBe(1);
    });
    const pruneCall = pruneCalls()[0];
    expect(pruneCall).toBeDefined();
    expect(JSON.parse(String(pruneCall?.[1]?.body))).toEqual({});
  });

  it('surfaces the backend 409 as the batch-active message', async () => {
    pruneStatus = 409;
    render(<SettingsCacheSection t={t} />);

    const pruneButton = await screen.findByRole('button', {
      name: 'settings.cache.actions.prune',
    });
    await waitFor(() => expect(pruneButton).toHaveProperty('disabled', false));
    fireEvent.click(pruneButton);

    await waitFor(() => {
      expect(
        screen.getAllByText('settings.cache.disabledWhileProcessing').length,
      ).toBeGreaterThan(0);
    });
  });

  it('requires a confirm step before VACUUM and reports disk sizes', async () => {
    render(<SettingsCacheSection t={t} />);

    const vacuumButton = await screen.findByRole('button', {
      name: 'settings.cache.actions.vacuum',
    });
    await waitFor(() => expect(vacuumButton).toHaveProperty('disabled', false));
    fireEvent.click(vacuumButton);

    expect(
      screen.getByRole('button', { name: 'settings.cache.actions.confirmVacuum' }),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/cache/vacuum'),
      ).length,
    ).toBe(0);

    fireEvent.click(
      screen.getByRole('button', { name: 'settings.cache.actions.confirmVacuum' }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes('/cache/vacuum'),
        ).length,
      ).toBe(1);
    });
    await waitFor(() => {
      expect(screen.getByText(/stage:/).textContent).toContain('5 MB');
    });
  });
});
