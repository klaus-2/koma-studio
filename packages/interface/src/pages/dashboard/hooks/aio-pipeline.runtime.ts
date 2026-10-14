import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { z } from 'zod';

import { desktopBridge } from '@/lib/desktop-bridge';
import type {
  AioDeviceInfo,
  AioStageOption,
} from '@/models/aioStageCatalog';
import { reportAioEvent } from '@/pages/dashboard/lib/aio-observability';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { DesktopMiniBackendRuntimeState } from '@/types';
import type { AioStageSelection } from '@/types/aioModelPresets';
import { normalizeBatchConcurrency } from '@/utils/concurrentBatch';
import { isCustomModelSelectionKey } from '@/utils/customLlm';
import { fetchWithTimeoutAndRetry } from '@/utils/http';

export function useAioMiniBackendRuntimeSync(): void {
  const setRuntime = useAioPipelineStore(
    (state) => state.setAioMiniBackendRuntimeState,
  );

  useEffect(() => {
    const desktop = desktopBridge.desktop;
    let disposed = false;
    let eventVersion = 0;
    let listening = false;

    const listener = (payload: DesktopMiniBackendRuntimeState): void => {
      if (disposed) {
        return;
      }

      eventVersion += 1;
      setRuntime(payload);
    };

    if (desktop?.onMiniBackendRuntimeState) {
      try {
        desktop.onMiniBackendRuntimeState(listener);
        listening = true;
      } catch {
        reportAioEvent('runtime-sync-failed');
      }
    }

    const versionAtRequest = eventVersion;

    void (async (): Promise<void> => {
      try {
        const payload = await desktop?.getMiniBackendRuntimeState?.();

        if (!disposed && eventVersion === versionAtRequest) {
          setRuntime(payload ?? null);
        }
      } catch {
        if (!disposed && eventVersion === versionAtRequest) {
          reportAioEvent('runtime-sync-failed');
        }
      }
    })();

    return () => {
      disposed = true;

      if (listening) {
        try {
          desktop?.offMiniBackendRuntimeState?.(listener);
        } catch {
          reportAioEvent('runtime-sync-failed');
        }
      }
    };
  }, [setRuntime]);
}

function getDeviceInfoEndpoint(baseUrl: string): URL {
  const base = new URL(baseUrl);

  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error('Invalid local API URL.');
  }

  base.pathname = `${base.pathname.replace(/\/+$/u, '')}/`;

  return new URL('device/info', base);
}

/**
 * O contrato é fornecido pelo módulo que conhece o payload real do backend.
 * Um cast de response.json() não substitui essa validação.
 */
export function useAioDeviceInfoSync(
  localApiUrl: string,
  deviceInfoSchema: z.ZodType<AioDeviceInfo>,
): void {
  const mode = useUiShellStore((state) => state.mode);
  const setDeviceInfo = useAioPipelineStore(
    (state) => state.setAioDeviceInfo,
  );

  const query = useQuery({
    queryKey: ['aio', 'device-info', localApiUrl],
    enabled: mode === 'aio',
    staleTime: 30_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<AioDeviceInfo> => {
      const response = await fetchWithTimeoutAndRetry(
        getDeviceInfoEndpoint(localApiUrl).toString(),
        { method: 'GET' },
        { timeoutMs: 10_000, retryCount: 0, signal },
      );

      if (!response.ok) {
        throw new Error('AIO_DEVICE_INFO_HTTP_ERROR');
      }

      const payload: unknown = await response.json();
      return deviceInfoSchema.parse(payload);
    },
  });

  useEffect(() => {
    if (mode === 'aio' && query.data !== undefined) {
      setDeviceInfo(query.data);
    }
  }, [mode, query.data, setDeviceInfo]);

  useEffect(() => {
    if (mode === 'aio' && query.isError) {
      reportAioEvent('device-info-failed');
    }
  }, [mode, query.isError, query.errorUpdatedAt]);
}

interface UseAioStageSelectionFallbacksArgs {
  readonly availableDetectStageOptions: ReadonlyArray<AioStageOption>;
  readonly availableOcrStageOptions: ReadonlyArray<AioStageOption>;
  readonly availableTranslationStageOptions: ReadonlyArray<AioStageOption>;
  readonly availableSegmentStageOptions: ReadonlyArray<AioStageOption>;
  readonly availableCleanStageOptions: ReadonlyArray<AioStageOption>;
  readonly selectedCustomOcrProfile: Readonly<{ id: string }> | null;
  readonly selectedCustomTranslationProfile: Readonly<{ id: string }> | null;
  readonly isInstalledLocalAioEntry: (modelKey: string) => boolean;
}

function resolveSelection(
  current: string,
  options: ReadonlyArray<AioStageOption>,
  preserve: boolean,
): string {
  if (preserve || options.some((option) => option.key === current)) {
    return current;
  }

  return options[0]?.key ?? current;
}

export function useAioStageSelectionFallbacks(
  args: UseAioStageSelectionFallbacksArgs,
): void {
  const selection = useAioPipelineStore((state) => state.aioStageSelection);
  const setSelection = useAioPipelineStore(
    (state) => state.setAioStageSelection,
  );
  const loading = useAioPipelineStore((state) => state.aioOptionsLoading);
  const executing = useAioPipelineStore(
    (state) => state.aioAbortController !== null,
  );
  const pendingOcr = useLlmProvidersStore(
    (state) => state.pendingCustomSelections.ocr,
  );
  const pendingTranslation = useLlmProvidersStore(
    (state) => state.pendingCustomSelections.translation,
  );

  const {
    availableDetectStageOptions,
    availableOcrStageOptions,
    availableTranslationStageOptions,
    availableSegmentStageOptions,
    availableCleanStageOptions,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    isInstalledLocalAioEntry,
  } = args;

  useEffect(() => {
    if (loading || executing) {
      return;
    }

    setSelection((previous) => {
      const preserveOcr =
        isCustomModelSelectionKey(previous.recognizeText) &&
        (pendingOcr === previous.recognizeText ||
          (previous.recognizeText === selection.recognizeText &&
            selectedCustomOcrProfile !== null));

      const preserveTranslation =
        isInstalledLocalAioEntry(previous.getTranslations) ||
        (isCustomModelSelectionKey(previous.getTranslations) &&
          (pendingTranslation === previous.getTranslations ||
            (previous.getTranslations === selection.getTranslations &&
              selectedCustomTranslationProfile !== null)));

      const next: AioStageSelection = {
        detectText: resolveSelection(
          previous.detectText,
          availableDetectStageOptions,
          false,
        ),
        recognizeText: resolveSelection(
          previous.recognizeText,
          availableOcrStageOptions,
          preserveOcr,
        ),
        getTranslations: resolveSelection(
          previous.getTranslations,
          availableTranslationStageOptions,
          preserveTranslation,
        ),
        segmentText: resolveSelection(
          previous.segmentText,
          availableSegmentStageOptions,
          false,
        ),
        cleanImage: resolveSelection(
          previous.cleanImage,
          availableCleanStageOptions,
          false,
        ),
      };

      return (
        next.detectText === previous.detectText &&
        next.recognizeText === previous.recognizeText &&
        next.getTranslations === previous.getTranslations &&
        next.segmentText === previous.segmentText &&
        next.cleanImage === previous.cleanImage
      )
        ? previous
        : next;
    });
  }, [
    availableCleanStageOptions,
    availableDetectStageOptions,
    availableOcrStageOptions,
    availableSegmentStageOptions,
    availableTranslationStageOptions,
    executing,
    isInstalledLocalAioEntry,
    loading,
    pendingOcr,
    pendingTranslation,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    selection.getTranslations,
    selection.recognizeText,
    setSelection,
  ]);
}

export function useEffectiveBatchConcurrency(): Readonly<{
  effectiveBatchConcurrency: number;
}> {
  const imageCount = useImageCollectionStore((state) => state.images.length);
  const enabled = useAioPipelineStore((state) => state.batchThreadsEnabled);
  const threads = useAioPipelineStore((state) => state.batchThreads);

  return {
    effectiveBatchConcurrency: normalizeBatchConcurrency(
      enabled,
      threads,
      imageCount,
    ),
  };
}
