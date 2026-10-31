import { useEffect, useRef } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
  MIN_REGION_SIZE,
} from '@/constants/dashboard.constants';
import { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import { useI18n } from '@/i18n';
import { stageTransportNoticeDetail } from '@/aio-stages';
import { parseApiError } from '@/pages/dashboard/helpers';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useCommittedAsyncAction } from '@/pages/dashboard/hooks/use-committed-async-action';
import { groupImagesIntoAioChapters } from '@/pages/dashboard/lib/aio-chapters';
import type { AioChapterGroup } from '@/pages/dashboard/lib/aio-chapters';
import {
  reportAioEvent,
  runAioNotification,
} from '@/pages/dashboard/lib/aio-observability';
import {
  createLocalBatchChapterRunner,
  runChapterQueue,
  type ChapterSource,
} from '@/pages/dashboard/lib/chapter-queue';
import {
  aioStageKeyForBatchStage,
  runLocalAioBatchChunks,
  type BatchChunkState,
  type LocalAioBatchOptions,
} from '@/pages/dashboard/lib/local-aio-batch';
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
  AioBatchImageResult,
  AioPipelineSnapshotKey,
  LoadedImage,
} from '@/types/dashboard.types';
import { applyDetectedGradientToStyle } from '@/utils/dashboard.utils';
import { isCustomModelSelectionKey } from '@/utils/customLlm';
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

const ITEM_ERROR_NOTICE_MAX_LENGTH = 200;

function itemErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'Unknown error';
}

function buildItemErrorNotice(fileName: string, error: unknown): string {
  const firstLine = itemErrorMessage(error).split(/\r?\n/, 1)[0] ?? '';
  const collapsed = firstLine.replace(/\s+/g, ' ').trim();
  const summary =
    collapsed.length > ITEM_ERROR_NOTICE_MAX_LENGTH
      ? `${collapsed.slice(0, ITEM_ERROR_NOTICE_MAX_LENGTH - 3)}...`
      : collapsed;

  return `${fileName}: ${summary.length > 0 ? summary : 'Unknown error'}`;
}

function buildFailedBatchResult(
  image: LoadedImage,
  error: unknown,
): AioBatchImageResult {
  return {
    imageId: image.id,
    detectDetections: [],
    ocrDetections: [],
    translationDetections: [],
    segmentDetections: [],
    cleanDetections: [],
    renderDetections: [],
    cleanedDownload: null,
    countAsProcessed: false,
    executionNotices: [buildItemErrorNotice(image.file.name, error)],
  };
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
    localApiUrl: args.localApiUrl,
    aioSteps,
    aioSrcLang,
    aioTgtLang: useAioPipelineStore((state) => state.aioTgtLang),
    detectSelectionKey: selection.detectText,
    ocrSelectionKey: selection.recognizeText,
    translationSelectionKey: selection.getTranslations,
    segmentSelectionKey: selection.segmentText,
    cleanSelectionKey: selection.cleanImage,
    effectiveBatchConcurrency: args.effectiveBatchConcurrency,
    modelEntries: args.modelEntries,
    selectedCustomOcrProfile: args.selectedCustomOcrProfile,
    selectedCustomTranslationProfile: args.selectedCustomTranslationProfile,
    getAioStageOption: args.getAioStageOption,
    openModelManagerForStage: args.openModelManagerForStage,
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
    let runCompleted = false;

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

      let results: AioBatchImageResult[];
      if (prepared.useLocalBatchPipeline) {
        const localOptions: LocalAioBatchOptions = {
          sourceLanguage: options.sourceLanguage,
          targetLanguage: options.targetLanguage,
          detectModelKey: options.detectSelectionKey,
          ocrModelKey: options.ocrSelectionKey,
          translationModelKey: options.translationSelectionKey,
          segmentModelKey: options.segmentSelectionKey,
          cleanModelKey: options.cleanSelectionKey,
          aioSteps: options.aioSteps,
          llmSettings: options.llmSettings,
          maskDilation: options.maskDilation,
          hdStrategy: options.hdStrategy,
          hdResizeLimit: options.hdResizeLimit,
          hdCropMargin: options.hdCropMargin,
          hdCropTriggerSize: options.hdCropTriggerSize,
          gpuStages: options.gpuStages,
          // Only a Custom AI selection carries the profile: the backend folds
          // `custom_llm` into the translation cache key, so sending it while a
          // regular model is selected would fragment the cache for nothing.
          translationCustomProfile: isCustomModelSelectionKey(
            options.translationSelectionKey,
          )
            ? args.selectedCustomTranslationProfile
            : null,
          renderDefaultStyle: args.renderDefaultStyle,
          applyDetectedGradientToStyle,
          minRegionSize: MIN_REGION_SIZE,
          maxAreaRatio: 0.75,
          parseApiError,
        };

        const totalImages = executionImages.length;
        const globalIndexById = new Map(
          executionImages.map((image, index) => [image.id, index]),
        );
        const handleChunkState = (
          chapter: AioChapterGroup | null,
          scopePrefix: string,
          state: BatchChunkState,
        ): void => {
          useStatusStore
            .getState()
            .setStatusMessage(
              `AIO ${scopePrefix}batch ${state.chunkNumber}/${state.chunkCount} · ${state.name}`,
            );

          // Stages run inside the sidecar, so polled state is the only source
          // for the indicator the per-image path feeds directly.
          const stageKey = aioStageKeyForBatchStage(state.stage);
          const image = (chapter?.images ?? executionImages)[state.imageIndex];
          if (
            stageKey === null ||
            image === undefined ||
            executionController.signal.aborted ||
            useAioPipelineStore.getState().aioAbortController !==
              executionController
          ) {
            return;
          }
          args.updateAioExecutionStage(
            'auto',
            stageKey,
            image,
            globalIndexById.get(image.id) ?? state.imageIndex,
            totalImages,
          );
        };

        const chapterGroups = groupImagesIntoAioChapters(executionImages);
        if (chapterGroups.length <= 1) {
          const localRun = await runLocalAioBatchChunks({
            localApiUrl: args.localApiUrl,
            images: executionImages,
            options: localOptions,
            capacity: prepared.batchCapacity,
            signal: executionController.signal,
            onProgress: (startedUnits, totalUnits) => {
              useAioPipelineStore
                .getState()
                .setAioExecutionUnitsStarted(startedUnits, totalUnits);
            },
            onChunkState: (state) => handleChunkState(null, '', state),
          });
          results = localRun.results;
        } else {
          const chapterById = new Map(
            chapterGroups.map((chapter) => [chapter.id, chapter]),
          );
          const chapterPositionById = new Map<
            string,
            { index: number; imagesBefore: number; imageCount: number }
          >();
          let imagesBefore = 0;
          chapterGroups.forEach((chapter, index) => {
            chapterPositionById.set(chapter.id, {
              index,
              imagesBefore,
              imageCount: chapter.images.length,
            });
            imagesBefore += chapter.images.length;
          });

          const chapters: ChapterSource[] = chapterGroups.map((chapter) => ({
            id: chapter.id,
            label: chapter.label,
            images: chapter.images,
            options: localOptions,
          }));

          const runChapter = createLocalBatchChapterRunner({
            localApiUrl: args.localApiUrl,
            concurrency: args.effectiveBatchConcurrency,
            capacity: prepared.batchCapacity,
            onChunkState: (chapter, state) => {
              const position = chapterPositionById.get(chapter.id);
              const scopePrefix = position
                ? `chapter ${position.index + 1}/${chapters.length} · ${chapter.label} · `
                : `${chapter.label} · `;
              handleChunkState(
                chapterById.get(chapter.id) ?? null,
                scopePrefix,
                state,
              );
            },
          });

          const queue = await runChapterQueue({
            chapters,
            signal: executionController.signal,
            runChapter,
            onChapterStart: (chapter, index) => {
              useStatusStore
                .getState()
                .setStatusMessage(
                  `AIO chapter ${index + 1}/${chapters.length} · ${chapter.label}...`,
                );
            },
            onChapterProgress: (chapterId, completedUnits, totalUnits) => {
              const position = chapterPositionById.get(chapterId);
              if (!position || totalUnits <= 0) {
                return;
              }
              const startedImages =
                position.imagesBefore +
                (Math.max(0, completedUnits) / totalUnits) *
                  position.imageCount;
              useAioPipelineStore
                .getState()
                .setAioExecutionUnitsStarted(startedImages, totalImages);
            },
          });

          if (queue.aborted) {
            throwIfAioAborted(executionController.signal);
          }

          results = queue.outcomes.flatMap((outcome, index) => {
            if (outcome.status !== 'failed') {
              return outcome.results;
            }
            const chapter = chapterGroups[index];
            return chapter
              ? chapter.images.map((image) =>
                  buildFailedBatchResult(image, outcome.error),
                )
              : [];
          });
        }
      } else {
        results = await runAioBatch({
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
          onItemError: (error, item) => buildFailedBatchResult(item, error),
        });
      }

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
      runCompleted = true;
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

        const noticeDetail = stageTransportNoticeDetail(error);

        useStatusStore.getState().setTonedStatus(
          timedOut && stageLabel
            ? `The "${stageLabel}" stage timed out.${noticeDetail}`
            : `${t('dashboard.status.aioExecutionFailed')}${noticeDetail}`,
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
        // The handoff has to follow the release of `processing`: entering the
        // Manual editor is refused while a run owns the shell.
        if (runCompleted) {
          args.onAutoRunCompleted();
        }
      }

      activeRef.current = null;

      if (controller && mountedRef.current) {
        void runAioNotification(args.syncDiscordForTab);
      }
    }
  });

  return { processAIO };
}
