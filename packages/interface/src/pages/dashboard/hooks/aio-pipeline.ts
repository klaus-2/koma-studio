/**
 * AIO pipeline domain — entry point. Hosts the auto pipeline execution hook
 * (processAIO orchestration) and re-exports the per-concern sibling modules
 * split out in T10, so consumer imports from 'hooks/aio-pipeline' stay valid.
 */
import { useCallback, useEffect, useRef } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_MANUAL_STAGE_ORDER, MIN_REGION_SIZE } from '../../../constants/dashboard.constants';
import type { ModelInstallState } from '../../../models/types';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { parseApiError } from '../helpers';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import { applyDetectedGradientToStyle } from '../../../utils/dashboard.utils';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  isAbortError,
  isTimeoutError,
  type AioExecutionScope,
} from '../../../utils/dashboardRenderUtils';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import type { AioStageKey } from '../../../types/aioModelPresets';
import type {
  AioDownloadEntry,
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  WebhookMetrics,
} from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useAioExecutionPreparation } from '../../../hooks/useAioExecutionPreparation';
import { useAioSingleImageProcessor } from '../../../hooks/useAioSingleImageProcessor';
import { useAioResultConsolidation } from '../../../hooks/useAioResultConsolidation';

export { useAioPresetEditor } from './aio-pipeline.preset';
export {
  useAioModelSelection,
  useAioStageCatalogBuild,
  useAioSelectedStageModels,
  useAioStageAvailability,
} from './aio-pipeline.catalog';
export {
  useAioMiniBackendRuntimeSync,
  useAioDeviceInfoSync,
  useAioStageSelectionFallbacks,
  useEffectiveBatchConcurrency,
} from './aio-pipeline.runtime';
export { useAioManualExecution } from './aio-pipeline.manual-execution';

/* ── Auto pipeline execution (prepare, per-image processor, result consolidation, processAIO) ── */

interface UseAioPipelineExecutionArgs {
  /* Cross-domain state not yet in stores (region-editor T07) */
  renderDefaultStyle: RenderTextStyle;
  /* Page-derived values */
  isDesktopRuntime: boolean;
  localApiUrl: string;
  effectiveBatchConcurrency: number;
  modelEntries: Record<string, ModelInstallState>;
  compatibleTranslationModelIds: Set<string>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  aioPipelineStageProgressLabels: Record<AioPipelineSnapshotKey, string>;
  /* Cross-domain setters (region-editor T07, manual-tools T08, export-download T10) */
  setAioDetectionsByImage: (value: Record<string, AioTextRegion[]>) => void;
  setAioSelectedRegionByImage: (value: Record<string, string | null>) => void;
  setAioDownloadItems: (entries: AioDownloadEntry[]) => void;
  setAioManualImageEditsByImage: (value: Record<string, never>) => void;
  setAioManualHealingBusyByImage: (value: Record<string, never>) => void;
  /* Page callbacks */
  getAioStageOption: (
    stageKey: 'recognizeText' | 'getTranslations',
    key: string,
  ) => AioStageOption | null;
  openModelManagerForStage: (
    stage: AioStageKey,
    options?: Record<string, unknown>,
  ) => void;
  resolveLocalModelFocusForStage: (
    stage: Exclude<AioStageKey, 'getTranslations'>,
    key: string,
  ) => string | null;
  refreshSession: () => Promise<string | null>;
  getAuthToken: () => string | null;
  buildAioImageSnapshotIndexMap: (index: number) => Record<string, number>;
  emitProcessStartWebhook: (
    processMode: string,
    pages: number,
    metrics?: WebhookMetrics,
  ) => void;
  emitProcessCompleteWebhook: (
    processMode: string,
    pages: number,
    metrics?: WebhookMetrics,
  ) => void;
  emitProcessErrorWebhook: (
    processMode: string,
    pages: number,
    error: unknown,
    metrics?: WebhookMetrics,
  ) => void;
  ensureVerifiedEmailOrNotify: () => boolean;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void> | void;
  tryShowHealingHint: () => void;
  /* Page bindings that compute the execution i18n labels (kept at the call
     site per the T05b review decision — do not move into the store) */
  beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
  ) => void;
  updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
  ) => void;
}

export function useAioPipelineExecution({
  renderDefaultStyle,
  isDesktopRuntime,
  localApiUrl,
  effectiveBatchConcurrency,
  modelEntries,
  compatibleTranslationModelIds,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  aioPipelineStageProgressLabels,
  setAioDetectionsByImage,
  setAioSelectedRegionByImage,
  setAioDownloadItems,
  setAioManualImageEditsByImage,
  setAioManualHealingBusyByImage,
  getAioStageOption,
  openModelManagerForStage,
  resolveLocalModelFocusForStage,
  refreshSession,
  getAuthToken,
  buildAioImageSnapshotIndexMap,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  ensureVerifiedEmailOrNotify,
  recordProcessedPages,
  syncDiscordForTab,
  tryShowHealingHint,
  beginAioExecution,
  updateAioExecutionStage,
}: UseAioPipelineExecutionArgs) {
  const { t } = useI18n();
  const images = useImageCollectionStore((s) => s.images);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setRuntimeExecutionNotice = useStatusStore(
    (s) => s.setRuntimeExecutionNotice,
  );
  const invalidateAioPipelineHistory = useAioPipelineStore(
    (s) => s.invalidateAioPipelineHistory,
  );
  const getActiveAioAbortSignal = useAioPipelineStore(
    (s) => s.getActiveAioAbortSignal,
  );
  const setAioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.setAioAutoProcessedImageById,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const setAioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshotIndex,
  );
  const setAioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.setAioImageSnapshotIndexById,
  );
  const setAioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.setAioAutoHistoryAvailable,
  );

  const prepareAioExecution = useAioExecutionPreparation({
    imagesCount: images.length,
    aioSteps,
    aioSrcLang,
    detectSelectionKey: aioStageSelection.detectText,
    ocrSelectionKey: aioStageSelection.recognizeText,
    translationSelectionKey: aioStageSelection.getTranslations,
    segmentSelectionKey: aioStageSelection.segmentText,
    cleanSelectionKey: aioStageSelection.cleanImage,
    effectiveBatchConcurrency,
    modelEntries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    getAioStageOption,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    refreshSession,
    getAuthToken,
    invalidateAioPipelineHistory,
    setAioManualImageEditsByImage,
    setAioManualHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
  });

  const processSingleAioImageWithHook = useAioSingleImageProcessor({
    localApiUrl,
    minRegionSize: MIN_REGION_SIZE,
    renderDefaultStyle,
    applyDetectedGradientToStyle,
    isDesktopRuntime,
    refreshSession,
    parseApiError,
    getAbortSignal: getActiveAioAbortSignal,
    onStageStart: (stageKey, image, index) =>
      updateAioExecutionStage('auto', stageKey, image, index, images.length),
    setRuntimeExecutionNotice,
  });

  const consolidateAioResults = useAioResultConsolidation({
    aioSteps,
    buildAioImageSnapshotIndexMap,
    setAioAutoProcessedImageById,
    setAioDetectionsByImage,
    setAioSelectedRegionByImage,
    setAioPipelineSnapshots,
    setAioPipelineSnapshotIndex,
    setAioImageSnapshotIndexById,
    setAioAutoHistoryAvailable,
    setAioDownloadItems,
  });

  // processAIO keeps the baseline ref pattern (the entry below always calls
  // the latest closure, so callbacks/read points see current values). The old
  // `aioStateRef` mirror (~30 fields re-assigned every render) is gone: every
  // store-backed member is read via `getState()` at the exact same read point
  // (strictly fresher for reads that happen after awaits), while page-owned
  // members (callbacks, memos, `t`) are closure args of this hook — same
  // frozen-at-invocation semantics the mirror object had.
  const processAIORef = useRef<(() => Promise<void>) | null>(null);

  const processAioImpl = async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    useStatusStore.getState().setRuntimeExecutionNotice(null);
    const enabledStageKeys = AIO_MANUAL_STAGE_ORDER.filter((stageKey) =>
      stageKey === 'detectText'
        ? true
        : stageKey === 'recognizeText'
          ? useAioPipelineStore.getState().aioSteps.recognizeText
          : stageKey === 'getTranslations'
            ? useAioPipelineStore.getState().aioSteps.getTranslations
            : stageKey === 'segmentText'
              ? useAioPipelineStore.getState().aioSteps.segmentText
              : stageKey === 'cleanImage'
                ? useAioPipelineStore.getState().aioSteps.cleanImage
                : useAioPipelineStore.getState().aioSteps.render,
    );
    beginAioExecution(
      'auto',
      useImageCollectionStore.getState().images.length,
      enabledStageKeys,
    );
    const preparedAioExecution = await prepareAioExecution();
    if (!preparedAioExecution) {
      useAioPipelineStore.getState().clearAioExecutionState();
      return;
    }

    const {
      selectedDetectorKey,
      selectedOcrKey,
      selectedTranslationKey,
      selectedSegmentKey,
      selectedCleanKey,
      useCloudOcr,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
    } = preparedAioExecution;

    const logAioBatchDebug = (...args: unknown[]) => {
      if (
        !import.meta.env.DEV ||
        typeof console === 'undefined' ||
        typeof console.info !== 'function'
      ) {
        return;
      }
      console.info('[AIO batch]', ...args);
    };
    const executionStrategy = 'per-image-concurrent';

    try {
      const processSingleAioImage = (imgData: LoadedImage, index: number) =>
        processSingleAioImageWithHook(
          imgData,
          index,
          {
            sourceLanguage: useAioPipelineStore.getState().aioSrcLang,
            targetLanguage: useAioPipelineStore.getState().aioTgtLang,
            detectSelectionKey: selectedDetectorKey,
            ocrSelectionKey: selectedOcrKey,
            translationSelectionKey: selectedTranslationKey,
            segmentSelectionKey: selectedSegmentKey,
            cleanSelectionKey: selectedCleanKey,
            aioSteps: {
              recognizeText: useAioPipelineStore.getState().aioSteps.recognizeText,
              getTranslations: useAioPipelineStore.getState().aioSteps.getTranslations,
              segmentText: useAioPipelineStore.getState().aioSteps.segmentText,
              cleanImage: useAioPipelineStore.getState().aioSteps.cleanImage,
              render: useAioPipelineStore.getState().aioSteps.render,
            },
            useCloudOcr: useCloudOcr ?? false,
            useLlmSettingsForOcr: useLlmSettingsForOcr ?? false,
            useLlmSettingsForTranslation: useLlmSettingsForTranslation ?? false,
            llmSettings: useLlmProvidersStore.getState().llmSettings,
            selectedCustomOcrProfile,
            selectedCustomTranslationProfile,
            maskDilation: useAioPipelineStore.getState().aioMaskDilation,
            hdStrategy: useAioPipelineStore.getState().aioHdStrategy,
            hdResizeLimit: useAioPipelineStore.getState().aioHdResizeLimit,
            hdCropMargin: useAioPipelineStore.getState().aioHdCropMargin,
            hdCropTriggerSize: useAioPipelineStore.getState().aioHdCropTriggerSize,
            gpuStages: useAioPipelineStore.getState().aioGpuStages,
          },
        );

      logAioBatchDebug('strategy', {
        type: executionStrategy,
        concurrency: effectiveBatchConcurrency,
        stages: {
          detect: Boolean(useAioPipelineStore.getState().aioSteps.detectText),
          ocr: Boolean(useAioPipelineStore.getState().aioSteps.recognizeText),
          translation: Boolean(useAioPipelineStore.getState().aioSteps.getTranslations),
          segment: Boolean(useAioPipelineStore.getState().aioSteps.segmentText),
          clean: Boolean(useAioPipelineStore.getState().aioSteps.cleanImage),
        },
      });

      const imageResults = await runConcurrentBatch({
        items: useImageCollectionStore.getState().images,
        concurrency: effectiveBatchConcurrency,
        signal: useAioPipelineStore.getState().getActiveAioAbortSignal(),
        worker: async ({ item: imgData, index }) =>
          processSingleAioImage(imgData, index),
        onProgress: ({ completed }) => {
          if (completed >= useImageCollectionStore.getState().images.length) {
            useUiShellStore.getState().setProgress(100);
          }
        },
      });

      const {
        processedPagesCount,
        totalDetections,
        totalRecognized,
        totalTranslated,
        totalSegmented,
        totalCleaned,
        totalRendered,
        finalMessage,
      } = consolidateAioResults(imageResults);

      if (processedPagesCount > 0) {
        recordProcessedPages(processedPagesCount);
      }
      logAioBatchDebug('final-summary', {
        strategy: executionStrategy,
        total_detected: totalDetections,
        total_recognized: totalRecognized,
        total_translated: totalTranslated,
        total_segmented: totalSegmented,
        total_cleaned_images: totalCleaned,
        processed_pages: processedPagesCount,
      });
      emitProcessCompleteWebhook(
        'AIO',
        useImageCollectionStore.getState().images.length,
        {
          regioes_detectadas: totalDetections,
          textos_reconhecidos: totalRecognized,
          traducoes_geradas: totalTranslated,
          regioes_segmentadas: totalSegmented,
          imagens_limpas: totalCleaned,
          blocos_render_prontos: totalRendered,
          paginas_processadas: processedPagesCount,
          estrategia: executionStrategy,
        },
      );
      useStatusStore.getState().setTonedStatus(
        t('dashboard.status.aioCompleteAdjust', { message: finalMessage }),
        'success',
      );
      tryShowHealingHint();
      if (finalMessage.includes('caiu para CPU por falta de VRAM')) {
        window.setTimeout(() => {
          useStatusStore.getState().setRuntimeExecutionNotice(null);
        }, 4500);
      } else {
        useStatusStore.getState().setRuntimeExecutionNotice(null);
      }
    } catch (error) {
      if (isAbortError(error)) {
        useStatusStore.getState().setTonedStatus(
          t('dashboard.status.aioAborted'),
          'warning',
        );
      } else if (isTimeoutError(error)) {
        const executionStatus = useAioPipelineStore.getState().aioExecutionStatus;
        const stageLabel = executionStatus?.stageKey
          ? aioPipelineStageProgressLabels[
          executionStatus.stageKey as AioPipelineSnapshotKey
          ]
          : 'OCR';
        useStatusStore.getState().setTonedStatus(
          `Timed out during the "${stageLabel}" stage. The mini-backend may have crashed, restarted, or taken too long to respond.`,
          'error',
        );
      } else {
        emitProcessErrorWebhook(
          'AIO',
          useImageCollectionStore.getState().images.length,
          error,
          {
            estrategia: executionStrategy,
          },
        );
        useStatusStore.getState().setTonedStatus(
          error instanceof Error ? error.message : t('dashboard.status.aioExecutionFailed'),
          'error',
        );
      }
    } finally {
      useUiShellStore.getState().setProcessing(false);
      useUiShellStore.getState().setProgress(0);
      useAioPipelineStore.getState().clearAioExecutionState();
      void syncDiscordForTab();
    }
  };

  useEffect(() => {
    processAIORef.current = processAioImpl;
  });

  const processAIO = useCallback(() => processAIORef.current?.(), []);

  return { processAIO };
}
