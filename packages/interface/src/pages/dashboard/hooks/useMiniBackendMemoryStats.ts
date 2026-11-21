import { useQuery } from '@tanstack/react-query';

import type { FooterMemoryMeterData } from '@/components/dashboard/footer/FooterMemoryMeter';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import { fetchWithTimeoutAndRetry } from '@/utils/http';

export const MEMORY_STATS_TIMEOUT_MS = 4000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseMiniBackendMemoryStats(value: unknown): FooterMemoryMeterData {
  if (!isRecord(value)) return { ram: null, vram: null };

  const processStats = isRecord(value.process) ? value.process : null;
  const ramUsed = processStats === null ? null : finiteOrNull(processStats.rss_mb);
  const ramTotal = processStats === null ? null : finiteOrNull(processStats.system_total_mb);
  const ram = ramUsed === null ? null : { used: ramUsed, total: ramTotal };

  const gpuStats =
    value.gpu === null || value.gpu === undefined
      ? null
      : isRecord(value.gpu)
        ? value.gpu
        : null;
  const deviceUsed = gpuStats === null ? null : finiteOrNull(gpuStats.device_used_mb);
  const allocated = gpuStats === null ? null : finiteOrNull(gpuStats.allocated_mb);
  const usedMb = deviceUsed ?? allocated;
  const total = gpuStats === null ? null : finiteOrNull(gpuStats.total_mb);
  const free = gpuStats === null ? null : finiteOrNull(gpuStats.free_mb);
  const vram = usedMb === null || total === null ? null : { used: usedMb, total, free };

  return { ram, vram };
}

export async function fetchMiniBackendMemoryStats(
  localApiUrl: string,
  signal?: AbortSignal,
): Promise<FooterMemoryMeterData> {
  const response = await fetchWithTimeoutAndRetry(
    `${localApiUrl.replace(/\/+$/u, '')}/memory/stats`,
    { method: 'GET' },
    { timeoutMs: MEMORY_STATS_TIMEOUT_MS, retryCount: 0, signal },
  );
  if (!response.ok) throw new Error('AIO_MEMORY_STATS_HTTP_ERROR');
  const payload: unknown = await response.json();
  return parseMiniBackendMemoryStats(payload);
}

export function useMiniBackendMemoryStats(localApiUrl: string): FooterMemoryMeterData | null {
  const mode = useUiShellStore((state) => state.mode);

  const query = useQuery({
    queryKey: ['aio', 'memory-stats', localApiUrl],
    enabled: mode === 'aio' && localApiUrl.length > 0,
    staleTime: 1000,
    refetchInterval: 1500,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => fetchMiniBackendMemoryStats(localApiUrl, signal),
  });

  return query.data ?? null;
}
