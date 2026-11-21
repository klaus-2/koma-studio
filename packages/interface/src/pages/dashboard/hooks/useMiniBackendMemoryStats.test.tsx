// @vitest-environment jsdom

import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpTimeoutError } from '@/utils/http';
import { useUiShellStore } from '../stores/ui-shell-store';
import {
  MEMORY_STATS_TIMEOUT_MS,
  fetchMiniBackendMemoryStats,
  parseMiniBackendMemoryStats,
  useMiniBackendMemoryStats,
} from './useMiniBackendMemoryStats';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined })),
}));

const useQueryMock = vi.mocked(useQuery);
const LOCAL_URL = 'http://127.0.0.1:8765';
const ORIGINAL_MODE = useUiShellStore.getState().mode;

function lastQueryOptions() {
  const options = useQueryMock.mock.calls.at(-1)?.[0];
  if (!options) throw new Error('useQuery was not called');
  return options;
}

afterEach(() => {
  useUiShellStore.setState({ mode: ORIGINAL_MODE });
  useQueryMock.mockClear();
});

describe('useMiniBackendMemoryStats', () => {
  it('polls only in AIO mode and only with a local API URL', () => {
    useUiShellStore.setState({ mode: 'cleaner' });
    renderHook(() => useMiniBackendMemoryStats(LOCAL_URL));
    expect(lastQueryOptions().enabled).toBe(false);

    useUiShellStore.setState({ mode: 'aio' });
    renderHook(() => useMiniBackendMemoryStats(LOCAL_URL));
    const options = lastQueryOptions();
    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual(['aio', 'memory-stats', LOCAL_URL]);
    expect(options.refetchInterval).toBe(1500);
    expect(options.staleTime).toBe(1000);

    renderHook(() => useMiniBackendMemoryStats(''));
    expect(lastQueryOptions().enabled).toBe(false);
  });

  it('parses the sidecar payload with immediate narrowing', () => {
    const parsed = parseMiniBackendMemoryStats({
      process: { pid: 1, rss_mb: 512.3, vms_mb: 900, cpu_percent: 1, system_total_mb: 16384 },
      gpu: {
        allocated_mb: 100,
        reserved_mb: 120,
        total_mb: 1000,
        free_mb: 300,
        device_used_mb: 700,
      },
    });

    expect(parsed).toEqual({
      ram: { used: 512.3, total: 16384 },
      vram: { used: 700, total: 1000, free: 300 },
    });
  });

  it('prefers device-wide VRAM usage and falls back per field on older runtimes', () => {
    const legacy = parseMiniBackendMemoryStats({
      process: { pid: 1, rss_mb: 512.3, vms_mb: 900, cpu_percent: 1 },
      gpu: { allocated_mb: 100, reserved_mb: 120, total_mb: 1000, free_mb: 300 },
    });
    expect(legacy).toEqual({
      ram: { used: 512.3, total: null },
      vram: { used: 100, total: 1000, free: 300 },
    });

    const withoutFree = parseMiniBackendMemoryStats({
      process: { pid: 1, rss_mb: 512.3, vms_mb: 900, cpu_percent: 1, system_total_mb: 16384 },
      gpu: { allocated_mb: 100, reserved_mb: 120, total_mb: 1000 },
    });
    expect(withoutFree).toEqual({
      ram: { used: 512.3, total: 16384 },
      vram: { used: 100, total: 1000, free: null },
    });
  });

  it('degrades to no meter on malformed or failing payloads', () => {
    expect(parseMiniBackendMemoryStats('not a payload')).toEqual({ ram: null, vram: null });
    expect(
      parseMiniBackendMemoryStats({
        process: { rss_mb: '512' },
        gpu: { allocated_mb: 1, total_mb: null },
      }),
    ).toEqual({ ram: null, vram: null });
    expect(parseMiniBackendMemoryStats({ gpu: null })).toEqual({ ram: null, vram: null });
  });

  it('returns no stats while the query has no data', () => {
    useUiShellStore.setState({ mode: 'aio' });
    const { result } = renderHook(() => useMiniBackendMemoryStats(LOCAL_URL));
    expect(result.current).toBeNull();
  });
});

describe('fetchMiniBackendMemoryStats (real queryFn)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a valid payload to the parsed meter data', async () => {
    const fetchStub = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      expect(String(input)).toBe('http://127.0.0.1:8765/memory/stats');
      return new Response(JSON.stringify({
        process: { pid: 1, rss_mb: 512.3, vms_mb: 900, cpu_percent: 1, system_total_mb: 16384 },
        gpu: { allocated_mb: 100, reserved_mb: 120, total_mb: 1000, free_mb: 300, device_used_mb: 700 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchStub);

    await expect(fetchMiniBackendMemoryStats(LOCAL_URL)).resolves.toEqual({
      ram: { used: 512.3, total: 16384 },
      vram: { used: 700, total: 1000, free: 300 },
    });
  });

  it('propagates the JSON parse error for malformed bodies (degradation is structural only)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> =>
      new Response('{not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    await expect(fetchMiniBackendMemoryStats(LOCAL_URL)).rejects.toThrow(SyntaxError);
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> =>
      new Response('boom', { status: 503 }),
    ));

    await expect(fetchMiniBackendMemoryStats(LOCAL_URL)).rejects.toThrow('AIO_MEMORY_STATS_HTTP_ERROR');
  });

  it('aborts with the shared HttpTimeoutError past the 4s deadline', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          }),
      ));

      const pending = fetchMiniBackendMemoryStats(LOCAL_URL);
      const assertion = expect(pending).rejects.toBeInstanceOf(HttpTimeoutError);
      await vi.advanceTimersByTimeAsync(MEMORY_STATS_TIMEOUT_MS + 1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts immediately when the caller signal is already aborted', async () => {
    vi.stubGlobal('fetch', vi.fn(
      (input: RequestInfo | URL): Promise<Response> =>
        Promise.reject(new TypeError(`unexpected fetch of ${String(input)}`)),
    ));

    const controller = new AbortController();
    controller.abort();

    await expect(fetchMiniBackendMemoryStats(LOCAL_URL, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});
