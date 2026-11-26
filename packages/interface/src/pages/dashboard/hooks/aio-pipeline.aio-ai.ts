import { useEffect, useRef } from 'react';

import {
  ensureStageModelReadiness,
  resolveAioCleanAiReadiness,
  skipStageCatalog,
  stageCatalogOption,
  stageTransportNoticeDetail,
  type StageReadinessReady,
} from '@/aio-stages';
import {
  AIO_STAGE_LABEL_KEYS,
  MIN_REGION_SIZE,
} from '@/constants/dashboard.constants';
import {
  useAioAiImageProcessor,
  type AioAiImageResult,
  type SingleAioAiRunConfig,
} from '@/hooks/useAioAiImageProcessor';
import { useI18n } from '@/i18n';
import { TRANSLATION_MODELS_REGISTRY } from '@/models/translation-models-registry';
import { parseApiError } from '@/pages/dashboard/helpers';
import {
  buildFailedBatchResult,
  isSameImageCollection,
  itemBusyMessage,
  recordStageModelRefusal,
} from '@/pages/dashboard/hooks/aio-pipeline.batch-helpers';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useCommittedAsyncAction } from '@/pages/dashboard/hooks/use-committed-async-action';
import { enforceCacheLimitAfterRun } from '@/pages/dashboard/hooks/use-cache-limit-enforcement';
import { createBatchPauseGate } from '@/pages/dashboard/lib/batch-pause-gate';
import { runBatchPauseBoundary } from '@/pages/dashboard/lib/batch-pause-boundary';
import {
  publishBatchError,
  publishBatchIdle,
  publishBatchRunning,
} from '@/pages/dashboard/lib/desktop-batch-bus';
import { showDesktopNotification } from '@/pages/dashboard/lib/desktop-notifications';
import {
  reportAioEvent,
  runAioNotification,
} from '@/pages/dashboard/lib/aio-observability';
import {
  createAioAbortError,
  runAioBatch,
  throwIfAioAborted,
} from '@/pages/dashboard/lib/run-aio-batch';
import { useAioBatchPauseStore } from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useAioStageTimingStore } from '@/pages/dashboard/stores/aio-stage-timing-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  LoadedImage,
} from '@/types/dashboard.types';
import { cloneAioDownloadEntries } from '@/utils/dashboard.utils';
import { isAbortError, isTimeoutError } from '@/utils/dashboardRenderUtils';
import { getLocalImageEditSpec } from '@/utils/imageEditLocalModels';
import { assessImageEditModelCompatibility } from '@/utils/imageEditModelCompatibility';
import { resolveTranslationStageExecutionKey } from '@/utils/translationAutoResolution';

interface ActiveAioAiExecution {
  readonly controller: AbortController;
  readonly images: ReadonlyArray<LoadedImage>;
}

const toSyntheticBatchResult = (
  imageId: string,
  download: AioDownloadEntry,
  skipped: boolean,
): AioBatchImageResult => ({
  imageId,
  detectDetections: [],
  ocrDetections: [],
  translationDetections: [],
  segmentDetections: [],
  cleanDetections: [],
  renderDetections: [],
  cleanedDownload: download,
  countAsProcessed: !skipped,
  executionNotices: [],
});

export function useAioAiPipelineExecution(
  args: UseAioPipelineExecutionArgs,
): Readonly<{ processAioAi: () => Promise<void> }> {
  const { t } = useI18n();
  const images = useImageCollectionStore((state) => state.images);
  const activeRef = useRef<ActiveAioAiExecution | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current?.controller.abort(createAioAbortError());
    };
  }, []);

  const processSingleAioAiImage = useAioAiImageProcessor({
    localApiUrl: args.localApiUrl,
    minRegionSize: MIN_REGION_SIZE,
    parseApiError,
    getAbortSignal: () => activeRef.current?.controller.signal ?? null,
    onStageStart: (stageKey, image, index) => {
      const active = activeRef.current;
      if (
        active &&
        !active.controller.signal.aborted &&
        useAioPipelineStore.getState().aioAbortController === active.controller
      ) {
        useAioPipelineStore.getState().recordAioStageStarted(image, stageKey);
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

  const processAioAi = useCommittedAsyncAction(async (): Promise<void> => {
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

    if (!args.ensureVerifiedEmailOrNotify()) {
      return;
    }

    const cleanAiReadiness = resolveAioCleanAiReadiness({
      modelKey: pipeline.aioAiModelKey,
      profiles: args.cleanCustomProfiles,
      modelEntries: args.modelEntries,
      t,
    });
    if (!cleanAiReadiness.ok) {
      useStatusStore.getState().setTonedStatus(cleanAiReadiness.message, 'error');
      return;
    }

    const localSpec = cleanAiReadiness.localModelId
      ? getLocalImageEditSpec(cleanAiReadiness.localModelId)
      : null;
    const profileModel =
      localSpec?.id ?? cleanAiReadiness.customProfile?.model?.trim() ?? '';
    const compatibility = assessImageEditModelCompatibility({
      model: profileModel,
      apiBase: cleanAiReadiness.customProfile?.apiBase ?? '',
      protocol: cleanAiReadiness.customProfile?.protocol ?? 'auto',
      targetMode: 'aio_ai',
    });
    if (compatibility.status === 'incompatible_text_only') {
      useStatusStore.getState().setTonedStatus(
        t(
          compatibility.reasonKey === 'localOllama'
            ? 'dashboard.aio.customAi.cleanCompatibility.localOllama'
            : 'dashboard.aio.customAi.cleanCompatibility.textOnlyModel',
          {
            model: profileModel,
            examples: compatibility.recommendedReplacements.join(', '),
          },
        ),
        'error',
      );
      return;
    }
    if (localSpec && compatibility.status === 'clean_only') {
      useStatusStore.getState().setTonedStatus(
        t('dashboard.aio.customAi.cleanCompatibility.textInpaintingOnly', {
          model: localSpec.name,
          examples: compatibility.recommendedReplacements.join(', '),
        }),
        'error',
      );
      return;
    }

    const aiOptions = pipeline.aioAiOptions;
    const selection = pipeline.aioStageSelection;
    const readinessSink = {
      setStatusMessage: useStatusStore.getState().setStatusMessage,
      openModelManagerForStage: args.openModelManagerForStage,
    };
    const ensureReady = (
      config: Parameters<typeof ensureStageModelReadiness>[0],
    ): StageReadinessReady | null =>
      ensureStageModelReadiness(config, readinessSink);

    if (aiOptions.executionMode !== 'direct') {
      const detectReadiness = ensureReady({
        stage: 'detectText',
        stageLabel: t(AIO_STAGE_LABEL_KEYS.detectText),
        modelKey: selection.detectText,
        catalog: skipStageCatalog(),
        modelEntries: args.modelEntries,
        t,
      });
      if (!detectReadiness) {
        return;
      }
    }

    const resolvedTranslationKey = resolveTranslationStageExecutionKey(
      selection.getTranslations,
      {
        registryModels: TRANSLATION_MODELS_REGISTRY,
        installEntries: args.modelEntries,
        sourceLanguage: pipeline.aioSrcLang,
        targetLanguage: pipeline.aioTgtLang,
        deviceInfo: pipeline.aioDeviceInfo,
      },
    );

    let useCloudOcr = false;
    let useLlmSettingsForOcr = false;
    let useCloudTranslation = false;
    let useLlmSettingsForTranslation = false;

    if (aiOptions.executionMode === 'script_guided') {
      const selectedOcrOption = args.getAioStageOption(
        'recognizeText',
        selection.recognizeText,
      );
      const ocrReadiness = ensureReady({
        stage: 'recognizeText',
        stageLabel: t(AIO_STAGE_LABEL_KEYS.recognizeText),
        modelKey: selection.recognizeText,
        catalog: stageCatalogOption(selectedOcrOption),
        modelEntries: args.modelEntries,
        customProfile: args.selectedCustomOcrProfile,
        t,
      });
      if (!ocrReadiness) {
        return;
      }
      useCloudOcr = ocrReadiness.useCloud;
      useLlmSettingsForOcr = ocrReadiness.useLlmSettings;

      const selectedTranslationOption = args.getAioStageOption(
        'getTranslations',
        resolvedTranslationKey,
      );
      const translationReadiness = ensureReady({
        stage: 'getTranslations',
        stageLabel: t(AIO_STAGE_LABEL_KEYS.getTranslations),
        modelKey: resolvedTranslationKey,
        catalog: stageCatalogOption(selectedTranslationOption),
        modelEntries: args.modelEntries,
        customProfile: args.selectedCustomTranslationProfile,
        languages: { source: pipeline.aioSrcLang, target: pipeline.aioTgtLang },
        t,
      });
      if (!translationReadiness) {
        return;
      }
      useCloudTranslation = translationReadiness.useCloud;
      useLlmSettingsForTranslation = translationReadiness.useLlmSettings;

      if (useCloudOcr || useCloudTranslation) {
        const token = (await args.refreshSession()) ?? args.getAuthToken();
        if (!token) {
          useStatusStore
            .getState()
            .setStatusMessage(t('aioExec.sessionUnavailable'));
          return;
        }
      }
    }

    const executionImages = [...images];
    const llmSettings = useLlmProvidersStore.getState().llmSettings;
    const enabledStages: AioPipelineSnapshotKey[] =
      aiOptions.executionMode === 'script_guided'
        ? ['detectText', 'recognizeText', 'getTranslations', 'render']
        : aiOptions.executionMode === 'hybrid_guided'
          ? ['detectText', 'render']
          : ['render'];

    let controller: AbortController | null = null;
    let unsubscribeImages: (() => void) | null = null;
    let publishedBatchRunning = false;
    let publishedTerminalBatchState = false;

    try {
      pipeline.invalidateAioPipelineHistory();
      args.setAioManualImageEditsByImage({});
      args.setAioManualHealingBusyByImage({});
      useUiShellStore.getState().setProcessing(true);
      useUiShellStore.getState().setProgress(0);
      useStatusStore.getState().setRuntimeExecutionNotice(null);
      useAioPipelineStore.getState().setAioBatchProgress(null);
      useAioStageTimingStore.getState().resetForRun();
      useAioBatchPauseStore.getState().reset();
      useStatusStore
        .getState()
        .setStatusMessage(t('dashboard.aio.ai.status.starting'));
      args.beginAioExecution('auto', executionImages.length, enabledStages);

      controller = useAioPipelineStore.getState().aioAbortController;
      if (!controller) {
        throw new Error('AIO AI execution did not acquire an abort controller.');
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

      useAioStageTimingStore
        .getState()
        .setProviderLine(profileModel || null, 'cloud');

      reportAioEvent('batch-started', {
        scope: 'ai',
        pages: executionImages.length,
        concurrency: 1,
      });

      void runAioNotification(() =>
        args.emitProcessStartWebhook('AIO AI', executionImages.length, {
          modo: aiOptions.executionMode,
          modelo: profileModel,
        }),
      );

      publishBatchRunning(0, executionImages.length);
      publishedBatchRunning = true;

      const settledDownloadsByImageId = new Map<string, AioDownloadEntry>();
      const bakedIds: Record<string, boolean> = {};
      const processedIds: Record<string, boolean> = {};
      const syntheticResults: AioBatchImageResult[] = [];
      let previousPageContext = '';
      let processedPagesCount = 0;
      let skippedPagesCount = 0;
      const pauseGate = createBatchPauseGate(executionController.signal);

      const syncSettledToStores = (): void => {
        if (
          !mountedRef.current ||
          useAioPipelineStore.getState().aioAbortController !==
            executionController ||
          !isSameImageCollection(
            useImageCollectionStore.getState().images,
            executionImages,
          )
        ) {
          return;
        }
        const orderedDownloads: AioDownloadEntry[] = [];
        for (const img of executionImages) {
          const entry = settledDownloadsByImageId.get(img.id);
          if (entry) {
            orderedDownloads.push(entry);
          }
        }
        args.setAioDownloadItems(cloneAioDownloadEntries(orderedDownloads));
        useAioPipelineStore.getState().setAioAiBakedImageIds({ ...bakedIds });
        useAioPipelineStore
          .getState()
          .setAioAutoProcessedImageById((prev) => ({
            ...prev,
            ...processedIds,
          }));
      };

      const runBatchPauseBoundaryAtBoundary = (): Promise<void> =>
        runBatchPauseBoundary({
          gate: pauseGate,
          signal: executionController.signal,
          getAccumulatedResults: () => syntheticResults,
          consolidate: () => {
            syncSettledToStores();
          },
        });

      const batchOutcomes = await runAioBatch<
        LoadedImage,
        AioAiImageResult | AioBatchImageResult
      >({
        items: executionImages,
        concurrency: 1,
        controller: executionController,
        onProgress: (completed, total) => {
          publishBatchRunning(completed, total);
          useUiShellStore
            .getState()
            .setProgress(total > 0 ? Math.round((completed / total) * 100) : 0);
        },
        beforeItem: runBatchPauseBoundaryAtBoundary,
        worker: async ({ item, index }) => {
          const singleConfig: SingleAioAiRunConfig = {
            sourceLanguage: pipeline.aioSrcLang,
            targetLanguage: pipeline.aioTgtLang,
            modelKey: cleanAiReadiness.modelKey,
            customProfile: cleanAiReadiness.customProfile,
            options: pipeline.aioAiOptions,
            modelConfig: pipeline.aioAiModelConfig,
            additionalInstructions: pipeline.aioAiInstructions,
            llmSettings,
            detectSelectionKey: selection.detectText,
            ocrSelectionKey: selection.recognizeText,
            translationSelectionKey: resolvedTranslationKey,
            useCloudOcr,
            useLlmSettingsForOcr,
            useLlmSettingsForTranslation,
            selectedCustomOcrProfile: args.selectedCustomOcrProfile,
            selectedCustomTranslationProfile:
              args.selectedCustomTranslationProfile,
            gpuStages: {
              detectText: pipeline.aioGpuStages.detectText,
              recognizeText: pipeline.aioGpuStages.recognizeText,
            },
            previousPageContext,
          };
          const outcome = await processSingleAioAiImage(item, index, singleConfig);
          if (outcome.nextPageContext) {
            previousPageContext = outcome.nextPageContext;
          }
          return outcome;
        },
        onItemError: (error, item) => {
          recordStageModelRefusal(error);
          return buildFailedBatchResult(item, error, itemBusyMessage(error, t));
        },
        onItemSettled: (settled) => {
          if ('download' in settled) {
            settledDownloadsByImageId.set(settled.imageId, settled.download);
            bakedIds[settled.imageId] = true;
            if (!settled.skipped) {
              processedIds[settled.imageId] = true;
              processedPagesCount += 1;
            } else {
              skippedPagesCount += 1;
            }
            syntheticResults.push(
              toSyntheticBatchResult(
                settled.imageId,
                settled.download,
                settled.skipped,
              ),
            );
            syncSettledToStores();
          }
        },
      });

      throwIfAioAborted(executionController.signal);
      if (
        !mountedRef.current ||
        useAioPipelineStore.getState().aioAbortController !== executionController
      ) {
        return;
      }

      const orderedDownloads: AioDownloadEntry[] = [];
      for (const img of executionImages) {
        const entry = settledDownloadsByImageId.get(img.id);
        if (entry) {
          orderedDownloads.push(entry);
        }
      }
      const failedCount = batchOutcomes.filter(
        (outcome) => !('download' in outcome),
      ).length;

      const snapshot: AioPipelineSnapshot = {
        key: 'render',
        label: 'AIO IA',
        detectionsByImage: {},
        selectedRegionByImage: {},
        aioDownloads: cloneAioDownloadEntries(orderedDownloads),
      };

      const pipelineStore = useAioPipelineStore.getState();
      pipelineStore.setAioPipelineSnapshots([snapshot]);
      pipelineStore.setAioPipelineSnapshotIndex(0);
      pipelineStore.setAioImageSnapshotIndexById(
        args.buildAioImageSnapshotIndexMap(0),
      );
      pipelineStore.setAioAutoHistoryAvailable(true);
      syncSettledToStores();
      useUiShellStore.getState().setProgress(100);

      if (processedPagesCount > 0) {
        void runAioNotification(() =>
          args.recordProcessedPages(processedPagesCount),
        );
      }

      void runAioNotification(() =>
        args.emitProcessCompleteWebhook('AIO AI', executionImages.length, {
          paginas_processadas: processedPagesCount,
          paginas_ignoradas: skippedPagesCount,
          paginas_falhas: failedCount,
          modo: aiOptions.executionMode,
        }),
      );

      useStatusStore.getState().setTonedStatus(
        failedCount > 0
          ? t('dashboard.aio.ai.status.completedWithErrors', {
              processed: processedPagesCount,
              skipped: skippedPagesCount,
              failed: failedCount,
            })
          : t('dashboard.aio.ai.status.completed', {
              processed: processedPagesCount,
              skipped: skippedPagesCount,
            }),
        failedCount > 0 ? 'warning' : 'success',
      );

      reportAioEvent('batch-completed', {
        scope: 'ai',
        pages: processedPagesCount,
      });

      publishBatchIdle(executionImages.length, executionImages.length);
      publishedTerminalBatchState = true;

      showDesktopNotification({
        title: t('aio.batch.done.notify.title'),
        body: t('aio.batch.done.notify.body', { count: processedPagesCount }),
      });

      void enforceCacheLimitAfterRun();
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return;
      }

      if (isAbortError(error)) {
        useStatusStore
          .getState()
          .setTonedStatus(t('dashboard.status.aioAborted'), 'warning');
      } else {
        const timedOut = isTimeoutError(error);
        const noticeDetail = stageTransportNoticeDetail(error);
        useStatusStore.getState().setTonedStatus(
          timedOut
            ? `AIO AI timed out.${noticeDetail}`
            : `${t('dashboard.status.aioExecutionFailed')}${noticeDetail}`,
          'error',
        );

        void runAioNotification(() =>
          args.emitProcessErrorWebhook(
            'AIO AI',
            executionImages.length,
            new Error(timedOut ? 'AIO_AI_TIMEOUT' : 'AIO_AI_EXECUTION_FAILED'),
            { modo: aiOptions.executionMode },
          ),
        );

        showDesktopNotification({
          title: t('aio.batch.failed.notify.title'),
          body: t('aio.batch.failed.notify.body'),
        });

        publishBatchError(executionImages.length);
        publishedTerminalBatchState = true;
      }
    } finally {
      unsubscribeImages?.();
      if (publishedBatchRunning && !publishedTerminalBatchState) {
        publishBatchIdle(0, executionImages.length);
      }
      useAioBatchPauseStore.getState().reset();

      if (
        controller &&
        useAioPipelineStore.getState().aioAbortController === controller
      ) {
        useAioPipelineStore.getState().clearAioExecutionState(controller);
        useAioPipelineStore.getState().setAioBatchProgress(null);
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

  return { processAioAi };
}
