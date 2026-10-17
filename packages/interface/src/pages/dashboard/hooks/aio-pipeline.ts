import { useEffect, useRef } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
  MIN_REGION_SIZE,
} from '@/constants/dashboard.constants';
import { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import { useI18n } from '@/i18n';
import { parseApiError } from '@/pages/dashboard/helpers';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useCommittedAsyncAction } from '@/pages/dashboard/hooks/use-committed-async-action';
import {
  reportAioEvent,
  runAioNotification,
} from '@/pages/dashboard/lib/aio-observability';
import {
  createAioAbortError,
  runAioBatch,
  throwIfAioAborted,
} from '@/pages/dashboard/lib/run-aio-batch';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioPipelineSnapshotKey,
  LoadedImage,
} from '@/types/dashboard.types';
import { applyDetectedGradientToStyle } from '@/utils/dashboard.utils';
import {
  isAbortError,
  isTimeoutError,
} from '@/utils/dashboardRenderUtils';

export { useAioPresetEditor } from '@/pages/dashboard/hooks/aio-pipeline.preset';
export {
  useAioModelSelection,
} from '@/pages/dashboard/hooks/aio-pipeline.catalog.selection';
export {
  useAioStageCatalogBuild,
} from '@/pages/dashboard/hooks/aio-pipeline.catalog.build';
export {
  useAioSelectedStageModels,
  useAioStageAvailability,
} from '@/pages/dashboard/hooks/aio-pipeline.catalog';
export {
  useAioMiniBackendRuntimeSync,
  useAioDeviceInfoSync,
  useAioStageSelectionFallbacks,
  useEffectiveBatchConcurrency,
} from '@/pages/dashboard/hooks/aio-pipeline.runtime';
export { useAioManualExecution } from '@/pages/dashboard/hooks/aio-pipeline.manual-execution';

interface ActiveAutoExecution {
  readonly controller: AbortController;
  readonly images: ReadonlyArray<LoadedImage>;
}

function isSameImageCollection(
  current: ReadonlyArray<LoadedImage>,
  captured: ReadonlyArray<LoadedImage>,
): boolean {
  return (
    current.length === captured.length &&
    current.every((image, index) => image === captured[index])
  );
}

export function useAioPipelineExecution(
  args: UseAioPipelineExecutionArgs,
): Readonly<{ processAIO: () => Promise<void> }> {
  const { t } = useI18n();
  const images = useImageCollectionStore((state) => state.images);
  const aioSteps = useAioPipelineStore((state) => state.aioSteps);
  const aioSrcLang = useAioPipelineStore((state) => state.aioSrcLang);
  const selection = useAioPipelineStore((state) => state.aioStageSelection);

  const activeRef = useRef<ActiveAutoExecution | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeRef.current?.controller.abort(createAioAbortError());
    };
  }, []);

  const prepare = useAioExecutionPreparation({
    imagesCount: images.length,
    aioSteps,
    aioSrcLang,
    detectSelectionKey: selection.detectText,
    ocrSelectionKey: selection.recognizeText,
    translationSelectionKey: selection.getTranslations,
    segmentSelectionKey: selection.segmentText,
    cleanSelectionKey: selection.cleanImage,
    effectiveBatchConcurrency: args.effectiveBatchConcurrency,
    modelEntries: args.modelEntries,
    compatibleTranslationModelIds: args.compatibleTranslationModelIds,
    selectedCustomOcrProfile: args.selectedCustomOcrProfile,
    selectedCustomTranslationProfile: args.selectedCustomTranslationProfile,
    getAioStageOption: args.getAioStageOption,
    openModelManagerForStage: args.openModelManagerForStage,
    resolveLocalModelFocusForStage: args.resolveLocalModelFocusForStage,
    refreshSession: args.refreshSession,
    getAuthToken: args.getAuthToken,
    invalidateAioPipelineHistory:
      useAioPipelineStore.getState().invalidateAioPipelineHistory,
    setAioManualImageEditsByImage: args.setAioManualImageEditsByImage,
    setAioManualHealingBusyByImage: args.setAioManualHealingBusyByImage,
    setProcessing: useUiShellStore.getState().setProcessing,
    setProgress: useUiShellStore.getState().setProgress,
    setStatusMessage: useStatusStore.getState().setStatusMessage,
    emitProcessStartWebhook: () => {
      const active = activeRef.current;

      if (!active || active.controller.signal.aborted) {
        return;
      }

      void runAioNotification(() =>
        args.emitProcessStartWebhook('AIO', active.images.length, {
          estrategia: 'per-image-concurrent',
        }),
      );
    },
  });

  const processImage = useAioSingleImageProcessor({
    localApiUrl: args.localApiUrl,
    minRegionSize: MIN_REGION_SIZE,
    renderDefaultStyle: args.renderDefaultStyle,
    applyDetectedGradientToStyle,
    isDesktopRuntime: args.isDesktopRuntime,
    refreshSession: args.refreshSession,
    parseApiError,
    getAbortSignal: () => activeRef.current?.controller.signal ?? null,
    onStageStart: (stageKey, image, index) => {
      const active = activeRef.current;

      if (
        active &&
        !active.controller.signal.aborted &&
        useAioPipelineStore.getState().aioAbortController === active.controller
      ) {
        args.updateAioExecutionStage(
          'auto',
          stageKey,
          image,
          index,
          active.images.length,
        );
      }
    },
    setRuntimeExecutionNotice: (notice) => {
      const active = activeRef.current;

      if (active && !active.controller.signal.aborted && mountedRef.current) {
        useStatusStore.getState().setRuntimeExecutionNotice(notice);
      }
    },
  });

  const consolidate = useAioResultConsolidation({
    aioSteps,
    buildAioImageSnapshotIndexMap: (index) =>
      Object.fromEntries(
        (activeRef.current?.images ?? []).map((image) => [image.id, index]),
      ),
    setAioAutoProcessedImageById:
      useAioPipelineStore.getState().setAioAutoProcessedImageById,
    setAioDetectionsByImage: args.setAioDetectionsByImage,
    setAioSelectedRegionByImage: args.setAioSelectedRegionByImage,
    setAioPipelineSnapshots:
      useAioPipelineStore.getState().setAioPipelineSnapshots,
    setAioPipelineSnapshotIndex:
      useAioPipelineStore.getState().setAioPipelineSnapshotIndex,
    setAioImageSnapshotIndexById:
      useAioPipelineStore.getState().setAioImageSnapshotIndexById,
    setAioAutoHistoryAvailable:
      useAioPipelineStore.getState().setAioAutoHistoryAvailable,
    setAioDownloadItems: args.setAioDownloadItems,
  });

  const processAIO = useCommittedAsyncAction(async (): Promise<void> => {
    const pipeline = useAioPipelineStore.getState();

    if (
      activeRef.current ||
      pipeline.aioAbortController ||
      pipeline.aioBackendRestarting ||
      useUiShellStore.getState().processing ||
      images.length === 0
    ) {
      return;
    }

    // Preparação e consolidação pertencem ao mesmo commit do React.
    if (
      pipeline.aioSteps !== aioSteps ||
      pipeline.aioSrcLang !== aioSrcLang ||
      pipeline.aioStageSelection !== selection ||
      !isSameImageCollection(
        useImageCollectionStore.getState().images,
        images,
      )
    ) {
      return;
    }

    if (!args.ensureVerifiedEmailOrNotify()) {
      return;
    }

    const executionImages = [...images];
    const llmSettings = useLlmProvidersStore.getState().llmSettings;
    const enabledStages = AIO_MANUAL_STAGE_ORDER.filter(
      (stage) => stage === 'detectText' || aioSteps[stage],
    );

    let controller: AbortController | null = null;
    let unsubscribeImages: (() => void) | null = null;
    let lastStage: AioPipelineSnapshotKey | null = null;

    try {
      useStatusStore.getState().setRuntimeExecutionNotice(null);
      args.beginAioExecution('auto', executionImages.length, enabledStages);

      controller = useAioPipelineStore.getState().aioAbortController;

      if (!controller) {
        throw new Error(
          'AIO execution did not acquire an abort controller.',
        );
      }

      const executionController = controller;

      activeRef.current = {
        controller: executionController,
        images: executionImages,
      };

      unsubscribeImages = useImageCollectionStore.subscribe((state) => {
        if (!isSameImageCollection(state.images, executionImages)) {
          executionController.abort(createAioAbortError());
        }
      });

      const prepared = await prepare();

      throwIfAioAborted(executionController.signal);

      if (!prepared) {
        return;
      }

      const options = {
        sourceLanguage: pipeline.aioSrcLang,
        targetLanguage: pipeline.aioTgtLang,
        detectSelectionKey: prepared.selectedDetectorKey,
        ocrSelectionKey: prepared.selectedOcrKey,
        translationSelectionKey: prepared.selectedTranslationKey,
        segmentSelectionKey: prepared.selectedSegmentKey,
        cleanSelectionKey: prepared.selectedCleanKey,
        aioSteps: { ...aioSteps },
        useCloudOcr: prepared.useCloudOcr ?? false,
        useLlmSettingsForOcr: prepared.useLlmSettingsForOcr ?? false,
        useLlmSettingsForTranslation:
          prepared.useLlmSettingsForTranslation ?? false,
        llmSettings,
        selectedCustomOcrProfile: args.selectedCustomOcrProfile,
        selectedCustomTranslationProfile:
          args.selectedCustomTranslationProfile,
        maskDilation: pipeline.aioMaskDilation,
        hdStrategy: pipeline.aioHdStrategy,
        hdResizeLimit: pipeline.aioHdResizeLimit,
        hdCropMargin: pipeline.aioHdCropMargin,
        hdCropTriggerSize: pipeline.aioHdCropTriggerSize,
        gpuStages: { ...pipeline.aioGpuStages },
      } satisfies Parameters<typeof processImage>[2];

      reportAioEvent('batch-started', {
        scope: 'auto',
        pages: executionImages.length,
        concurrency: args.effectiveBatchConcurrency,
      });

      const results = await runAioBatch({
        items: executionImages,
        concurrency: args.effectiveBatchConcurrency,
        controller: executionController,
        worker: async ({ item, index }) => {
          try {
            return await processImage(item, index, options);
          } catch (error: unknown) {
            const stage =
              useAioPipelineStore.getState().aioExecutionStatus?.stageKey;

            lastStage =
              AIO_MANUAL_STAGE_ORDER.find(
                (candidate) => candidate === stage,
              ) ?? null;

            throw error;
          }
        },
      });

      throwIfAioAborted(executionController.signal);

      if (
        !mountedRef.current ||
        useAioPipelineStore.getState().aioAbortController !==
        executionController
      ) {
        return;
      }

      const summary = consolidate(results);

      useUiShellStore.getState().setProgress(100);

      if (summary.processedPagesCount > 0) {
        void runAioNotification(() =>
          args.recordProcessedPages(summary.processedPagesCount),
        );
      }

      void runAioNotification(() =>
        args.emitProcessCompleteWebhook(
          'AIO',
          executionImages.length,
          {
            regioes_detectadas: summary.totalDetections,
            textos_reconhecidos: summary.totalRecognized,
            traducoes_geradas: summary.totalTranslated,
            regioes_segmentadas: summary.totalSegmented,
            imagens_limpas: summary.totalCleaned,
            blocos_render_prontos: summary.totalRendered,
            paginas_processadas: summary.processedPagesCount,
            estrategia: 'per-image-concurrent',
          },
        ),
      );

      useStatusStore.getState().setTonedStatus(
        t('dashboard.status.aioCompleteAdjust', {
          message: summary.finalMessage,
        }),
        'success',
      );

      reportAioEvent('batch-completed', {
        scope: 'auto',
        pages: summary.processedPagesCount,
      });

      void runAioNotification(args.tryShowHealingHint);
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return;
      }

      if (isAbortError(error)) {
        useStatusStore.getState().setTonedStatus(
          t('dashboard.status.aioAborted'),
          'warning',
        );
      } else {
        const timedOut = isTimeoutError(error);
        const stageLabel = lastStage
          ? args.aioPipelineStageProgressLabels[lastStage]
          : null;

        reportAioEvent(
          timedOut ? 'execution-timeout' : 'execution-failed',
          { scope: 'auto', pages: executionImages.length },
        );

        useStatusStore.getState().setTonedStatus(
          timedOut && stageLabel
            ? `The "${stageLabel}" stage timed out.`
            : t('dashboard.status.aioExecutionFailed'),
          'error',
        );

        void runAioNotification(() =>
          args.emitProcessErrorWebhook(
            'AIO',
            executionImages.length,
            new Error(timedOut ? 'AIO_TIMEOUT' : 'AIO_EXECUTION_FAILED'),
            { estrategia: 'per-image-concurrent' },
          ),
        );
      }
    } finally {
      unsubscribeImages?.();

      if (
        controller &&
        useAioPipelineStore.getState().aioAbortController === controller
      ) {
        useAioPipelineStore.getState().clearAioExecutionState(controller);
        useUiShellStore.getState().setProcessing(false);
        useUiShellStore.getState().setProgress(0);
        useStatusStore.getState().setRuntimeExecutionNotice(null);
      }

      activeRef.current = null;

      if (controller && mountedRef.current) {
        void runAioNotification(args.syncDiscordForTab);
      }
    }
  });

  return { processAIO };
}
