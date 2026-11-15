import { useEffect } from 'react';

import { getApiConfig } from '@/config/api';
import { loadCacheLimitSettings } from '@/utils/cacheLimitSettings';

interface CachePruneWireResponse {
  freed_rows: number;
  freed_logical_bytes: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

let enforcedThisSession = false;

export function buildCachePruneRequestBody(): Record<string, number> {
  const settings = loadCacheLimitSettings();
  const body: Record<string, number> = {};
  if (settings.enabled && settings.rowsPerTable !== null) {
    body['max_rows_per_table'] = settings.rowsPerTable;
  }
  if (settings.enabled && settings.totalBytes !== null) {
    body['max_total_bytes'] = settings.totalBytes;
  }
  return body;
}

export async function pruneCachesWithPersistedLimits(): Promise<CachePruneWireResponse | null> {
  try {
    const response = await fetch(`${getApiConfig().localUrl}/cache/prune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCachePruneRequestBody()),
    });
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      return null;
    }
    const freedRows = asFiniteNumber(payload['freed_rows']);
    const freedBytes = asFiniteNumber(payload['freed_logical_bytes']);
    if (freedRows === null || freedBytes === null) {
      return null;
    }
    return { freed_rows: freedRows, freed_logical_bytes: freedBytes };
  } catch (error) {
    console.error('[cache-limit-enforcement] prune request failed', error);
    return null;
  }
}

export async function enforceCacheLimitAfterRun(): Promise<void> {
  if (!loadCacheLimitSettings().enabled) {
    return;
  }
  await pruneCachesWithPersistedLimits();
}

export function useCacheLimitEnforcement(): void {
  useEffect(() => {
    if (enforcedThisSession) {
      return;
    }
    enforcedThisSession = true;
    if (!loadCacheLimitSettings().enabled) {
      return;
    }
    void pruneCachesWithPersistedLimits();
  }, []);
}
