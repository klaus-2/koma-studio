/**
 * AIO runtime/environment sync — mini-backend runtime state listener, device
 * info fetch, per-stage selection fallback effects (keep each stage selection
 * pointing at a live option), and the effective batch concurrency memo.
 * Split out of aio-pipeline.ts (T10); the entry file keeps orchestration and
 * re-exports this module.
 */
import { useEffect, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { desktopBridge } from '../../../lib/desktop-bridge';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import { isCustomModelSelectionKey } from '../../../utils/customLlm';
import { normalizeBatchConcurrency } from '../../../utils/concurrentBatch';
import type { DesktopMiniBackendRuntimeState } from '../../../types';
import type { AioDeviceInfo, AioStageOption } from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useUiShellStore } from '../stores/ui-shell-store';

/* ── Mini-backend runtime state (desktop IPC listener + initial fetch) ── */

export function useAioMiniBackendRuntimeSync() {
  const setAioMiniBackendRuntimeState = useAioPipelineStore(
    (s) => s.setAioMiniBackendRuntimeState,
  );

  useEffect(() => {
    let cancelled = false;
    const runtimeListener = (payload: DesktopMiniBackendRuntimeState) => {
      if (!cancelled) {
        setAioMiniBackendRuntimeState(payload);
      }
    };

    const loadMiniBackendRuntimeState = async () => {
      try {
        const payload = await desktopBridge.desktop?.getMiniBackendRuntimeState?.();
        if (!cancelled) {
          setAioMiniBackendRuntimeState(
            (payload ?? null) as DesktopMiniBackendRuntimeState | null,
          );
        }
      } catch {
        if (!cancelled) {
          setAioMiniBackendRuntimeState(null);
        }
      }
    };

    void loadMiniBackendRuntimeState();
    desktopBridge.desktop?.onMiniBackendRuntimeState?.(runtimeListener);
    return () => {
      cancelled = true;
      desktopBridge.desktop?.offMiniBackendRuntimeState?.(runtimeListener);
    };
  }, [setAioMiniBackendRuntimeState]);
}

/* ── Device info (GPU snapshot from the local backend) ── */

export function useAioDeviceInfoSync(localApiUrl: string) {
  const { t } = useI18n();
  const mode = useUiShellStore((s) => s.mode);
  const setAioDeviceInfo = useAioPipelineStore((s) => s.setAioDeviceInfo);

  useEffect(() => {
    if (mode !== 'aio') return;
    let cancelled = false;

    const loadAioDeviceInfo = async () => {
      try {
        const response = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/device/info`,
          { method: 'GET' },
          { timeoutMs: 10_000, retryCount: 1 },
        );
        if (!response.ok) {
          throw new Error(t('dashboard.error.loadHardwareFailed'));
        }
        const payload = (await response.json()) as AioDeviceInfo;
        if (!cancelled) {
          setAioDeviceInfo(payload);
        }
      } catch {
        // Preserve the previous device snapshot on transient failures so
        // the UI does not randomly hide GPU-related controls.
      }
    };

    void loadAioDeviceInfo();
    return () => {
      cancelled = true;
    };
    // `t` deliberately outside the deps — parity with the baseline effect.
  }, [localApiUrl, mode, setAioDeviceInfo]);
}

/* ── Selection fallbacks (keep per-stage selection pointing at a live option) ── */

interface UseAioStageSelectionFallbacksArgs {
  availableDetectStageOptions: AioStageOption[];
  availableOcrStageOptions: AioStageOption[];
  availableTranslationStageOptions: AioStageOption[];
  availableSegmentStageOptions: AioStageOption[];
  availableCleanStageOptions: AioStageOption[];
  selectedCustomOcrProfile: { id: string } | null;
  selectedCustomTranslationProfile: { id: string } | null;
  isInstalledLocalAioEntry: (modelKey: string) => boolean;
}

export function useAioStageSelectionFallbacks({
  availableDetectStageOptions,
  availableOcrStageOptions,
  availableTranslationStageOptions,
  availableSegmentStageOptions,
  availableCleanStageOptions,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  isInstalledLocalAioEntry,
}: UseAioStageSelectionFallbacksArgs) {
  const pendingCustomSelections = useLlmProvidersStore(
    (s) => s.pendingCustomSelections,
  );
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableDetectStageOptions.some(
          (option) => option.key === prev.detectText,
        )
      ) {
        return prev;
      }
      const fallback = availableDetectStageOptions[0]?.key;
      if (!fallback || fallback === prev.detectText) {
        return prev;
      }
      return { ...prev, detectText: fallback };
    });
  }, [availableDetectStageOptions, setAioStageSelection]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (isCustomModelSelectionKey(prev.recognizeText)) {
        if (
          pendingCustomSelections.ocr === prev.recognizeText ||
          selectedCustomOcrProfile
        ) {
          return prev;
        }
      }
      if (
        availableOcrStageOptions.some(
          (option) => option.key === prev.recognizeText,
        )
      ) {
        return prev;
      }
      const fallback = availableOcrStageOptions[0]?.key;
      if (!fallback || fallback === prev.recognizeText) {
        return prev;
      }
      return { ...prev, recognizeText: fallback };
    });
  }, [
    availableOcrStageOptions,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (isInstalledLocalAioEntry(prev.getTranslations)) {
        return prev;
      }
      if (isCustomModelSelectionKey(prev.getTranslations)) {
        if (
          pendingCustomSelections.translation === prev.getTranslations ||
          selectedCustomTranslationProfile
        ) {
          return prev;
        }
      }
      if (
        availableTranslationStageOptions.some(
          (option) => option.key === prev.getTranslations,
        )
      ) {
        return prev;
      }
      const fallback = availableTranslationStageOptions[0]?.key;
      if (!fallback || fallback === prev.getTranslations) {
        return prev;
      }
      return {
        ...prev,
        getTranslations: fallback,
      };
    });
  }, [
    availableTranslationStageOptions,
    isInstalledLocalAioEntry,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableSegmentStageOptions.some(
          (option) => option.key === prev.segmentText,
        )
      ) {
        return prev;
      }
      const fallback = availableSegmentStageOptions[0]?.key;
      if (!fallback || fallback === prev.segmentText) {
        return prev;
      }
      return { ...prev, segmentText: fallback };
    });
  }, [availableSegmentStageOptions, setAioStageSelection]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableCleanStageOptions.some(
          (option) => option.key === prev.cleanImage,
        )
      ) {
        return prev;
      }
      const fallback = availableCleanStageOptions[0]?.key;
      if (!fallback || fallback === prev.cleanImage) {
        return prev;
      }
      return { ...prev, cleanImage: fallback };
    });
  }, [availableCleanStageOptions, setAioStageSelection]);
}

/* ── Effective batch concurrency: normalizes the batch-threads settings against
   the image count (aio-pipeline store + image-collection length) ── */

export function useEffectiveBatchConcurrency() {
  const images = useImageCollectionStore((s) => s.images);
  const batchThreadsEnabled = useAioPipelineStore((s) => s.batchThreadsEnabled);
  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const effectiveBatchConcurrency = useMemo(
    () =>
      normalizeBatchConcurrency(
        batchThreadsEnabled,
        batchThreads,
        images.length,
      ),
    [batchThreads, batchThreadsEnabled, images.length],
  );
  return { effectiveBatchConcurrency };
}
