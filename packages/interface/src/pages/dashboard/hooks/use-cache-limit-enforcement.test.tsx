import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CACHE_LIMIT_SETTINGS,
  loadCacheLimitSettings,
  saveCacheLimitSettings,
} from '@/utils/cacheLimitSettings';

const loadEnforcementModule = async (): Promise<
  typeof import('./use-cache-limit-enforcement')
> => {
  const bridge = await import('@/lib/desktop-bridge');
  bridge.setDesktopBridgeProvider({ desktop: null });
  return await import('./use-cache-limit-enforcement');
};

const PRUNE_WIRE = { freed_rows: 3, freed_logical_bytes: 42 };

const createFetchMock = (): ReturnType<typeof vi.fn> =>
  vi.fn(
    async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> =>
      new Response(JSON.stringify(PRUNE_WIRE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  saveCacheLimitSettings(DEFAULT_CACHE_LIMIT_SETTINGS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCacheLimitEnforcement (session mount trigger)', () => {
  it('prunes once per session with the persisted limits when enabled', async () => {
    saveCacheLimitSettings({
      enabled: true,
      rowsPerTable: 500,
      totalBytes: 1048576,
    });
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const enforcement = await loadEnforcementModule();
    renderHook(() => enforcement.useCacheLimitEnforcement());
    renderHook(() => enforcement.useCacheLimitEnforcement());

    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBe(1);
    });
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain('/cache/prune');
    expect(JSON.parse(String(firstCall?.[1]?.body))).toEqual({
      max_rows_per_table: 500,
      max_total_bytes: 1048576,
    });
  });

  it('never calls prune when the limit is off (default)', async () => {
    saveCacheLimitSettings({ enabled: false, rowsPerTable: null, totalBytes: null });
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const enforcement = await loadEnforcementModule();
    renderHook(() => enforcement.useCacheLimitEnforcement());

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

describe('enforceCacheLimitAfterRun (post-run trigger)', () => {
  it('sends the persisted limits when enabled', async () => {
    saveCacheLimitSettings({ enabled: true, rowsPerTable: 250, totalBytes: null });
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const enforcement = await loadEnforcementModule();
    await enforcement.enforceCacheLimitAfterRun();

    expect(fetchMock.mock.calls.length).toBe(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain('/cache/prune');
    expect(JSON.parse(String(firstCall?.[1]?.body))).toEqual({
      max_rows_per_table: 250,
    });
  });

  it('does not call prune when disabled', async () => {
    saveCacheLimitSettings({ enabled: false, rowsPerTable: null, totalBytes: null });
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const enforcement = await loadEnforcementModule();
    await enforcement.enforceCacheLimitAfterRun();

    expect(fetchMock.mock.calls.length).toBe(0);
    expect(loadCacheLimitSettings().enabled).toBe(false);
  });
});
