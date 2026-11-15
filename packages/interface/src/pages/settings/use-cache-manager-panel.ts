import { useCallback, useEffect, useState } from 'react';

import { getApiConfig } from '@/config/api';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import {
  DEFAULT_CACHE_LIMIT_SETTINGS,
  loadCacheLimitSettings,
  saveCacheLimitSettings,
  type CacheLimitSettings,
} from '@/utils/cacheLimitSettings';
import {
  parsePruneResponse,
  parseUsageResponse,
  parseVacuumResponse,
} from './cache-wire';
import type {
  CachePruneResultView,
  CacheStoreVacuumView,
  CacheUsageView,
} from './use-cache-manager-panel.types';

export type CachePanelBusy = 'idle' | 'usage' | 'prune' | 'vacuum';

export type CachePanelErrorKind = 'conflict' | 'http' | null;

export interface UseCacheManagerPanelResult {
  usage: CacheUsageView | null;
  busy: CachePanelBusy;
  errorKind: CachePanelErrorKind;
  pruneResult: CachePruneResultView | null;
  vacuumResult: CacheStoreVacuumView[] | null;
  limitSettings: CacheLimitSettings;
  batchActive: boolean;
  setLimitSettings: (next: CacheLimitSettings) => void;
  refreshUsage: () => Promise<void>;
  pruneNow: () => Promise<void>;
  vacuumNow: () => Promise<void>;
}

export function useCacheManagerPanel(): UseCacheManagerPanelResult {
  const [usage, setUsage] = useState<CacheUsageView | null>(null);
  const [busy, setBusy] = useState<CachePanelBusy>('idle');
  const [errorKind, setErrorKind] = useState<CachePanelErrorKind>(null);
  const [pruneResult, setPruneResult] = useState<CachePruneResultView | null>(
    null,
  );
  const [vacuumResult, setVacuumResult] = useState<
    CacheStoreVacuumView[] | null
  >(null);
  const [limitSettings, setLimitSettingsState] =
    useState<CacheLimitSettings>(DEFAULT_CACHE_LIMIT_SETTINGS);

  useEffect(() => {
    setLimitSettingsState(loadCacheLimitSettings());
  }, []);

  const processing = useUiShellStore((state) => state.processing);
  const aioAbortController = useAioPipelineStore(
    (state) => state.aioAbortController,
  );
  const batchActive = processing || aioAbortController !== null;

  const setLimitSettings = useCallback((next: CacheLimitSettings): void => {
    setLimitSettingsState(next);
    saveCacheLimitSettings(next);
  }, []);

  const refreshUsage = useCallback(async (): Promise<void> => {
    setBusy('usage');
    setErrorKind(null);
    try {
      const response = await fetch(
        `${getApiConfig().localUrl}/diagnostics/cache-usage`,
        { method: 'GET' },
      );
      if (!response.ok) {
        setErrorKind('http');
        return;
      }
      const parsed = parseUsageResponse(await response.json());
      if (parsed === null) {
        setErrorKind('http');
        return;
      }
      setUsage(parsed);
    } catch (error) {
      console.error('[cache-panel] usage request failed', error);
      setErrorKind('http');
    } finally {
      setBusy('idle');
    }
  }, []);

  const pruneNow = useCallback(async (): Promise<void> => {
    setBusy('prune');
    setErrorKind(null);
    setPruneResult(null);
    try {
      const body: Record<string, number> = {};
      if (limitSettings.enabled && limitSettings.rowsPerTable !== null) {
        body['max_rows_per_table'] = limitSettings.rowsPerTable;
      }
      if (limitSettings.enabled && limitSettings.totalBytes !== null) {
        body['max_total_bytes'] = limitSettings.totalBytes;
      }
      const response = await fetch(
        `${getApiConfig().localUrl}/cache/prune`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (response.status === 409) {
        setErrorKind('conflict');
        return;
      }
      if (!response.ok) {
        setErrorKind('http');
        return;
      }
      const parsed = parsePruneResponse(await response.json());
      if (parsed === null) {
        setErrorKind('http');
        return;
      }
      setPruneResult(parsed);
      try {
        const usageResponse = await fetch(
          `${getApiConfig().localUrl}/diagnostics/cache-usage`,
          { method: 'GET' },
        );
        if (usageResponse.ok) {
          const freshUsage = parseUsageResponse(await usageResponse.json());
          if (freshUsage !== null) {
            setUsage(freshUsage);
          }
        }
      } catch (refreshError) {
        console.error('[cache-panel] usage refresh failed', refreshError);
      }
    } catch (error) {
      console.error('[cache-panel] prune request failed', error);
      setErrorKind('http');
    } finally {
      setBusy('idle');
    }
  }, [limitSettings]);

  const vacuumNow = useCallback(async (): Promise<void> => {
    setBusy('vacuum');
    setErrorKind(null);
    setVacuumResult(null);
    try {
      const response = await fetch(
        `${getApiConfig().localUrl}/cache/vacuum`,
        { method: 'POST' },
      );
      if (response.status === 409) {
        setErrorKind('conflict');
        return;
      }
      if (!response.ok) {
        setErrorKind('http');
        return;
      }
      const parsed = parseVacuumResponse(await response.json());
      if (parsed === null) {
        setErrorKind('http');
        return;
      }
      setVacuumResult(parsed);
      try {
        const usageResponse = await fetch(
          `${getApiConfig().localUrl}/diagnostics/cache-usage`,
          { method: 'GET' },
        );
        if (usageResponse.ok) {
          const freshUsage = parseUsageResponse(await usageResponse.json());
          if (freshUsage !== null) {
            setUsage(freshUsage);
          }
        }
      } catch (refreshError) {
        console.error('[cache-panel] usage refresh failed', refreshError);
      }
    } catch (error) {
      console.error('[cache-panel] vacuum request failed', error);
      setErrorKind('http');
    } finally {
      setBusy('idle');
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  return {
    usage,
    busy,
    errorKind,
    pruneResult,
    vacuumResult,
    limitSettings,
    batchActive,
    setLimitSettings,
    refreshUsage,
    pruneNow,
    vacuumNow,
  };
}
