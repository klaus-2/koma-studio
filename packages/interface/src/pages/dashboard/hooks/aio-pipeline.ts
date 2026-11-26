import { useCallback, useEffect, useRef } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
  MIN_REGION_SIZE,
} from '@/constants/dashboard.constants';
import { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import {
  stageTransportNoticeDetail,
} from '@/aio-stages';
import {
  buildFailedBatchResult,
  isSameImageCollection,
  itemBusyMessage,
  recordStageModelRefusal,
} from '@/pages/dashboard/hooks/aio-pipeline.batch-helpers';
import { useI18n } from '@/i18n';
import { TRANSLATION_MODELS_REGISTRY } from '@/models/translation-models-registry';
import { parseApiError } from '@/pages/dashboard/helpers';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useAioAiPipelineExecution } from '@/pages/dashboard/hooks/aio-pipeline.aio-ai';
import { useCommittedAsyncAction } from '@/pages/dashboard/hooks/use-committed-async-action';
import { enforceCacheLimitAfterRun } from '@/pages/dashboard/hooks/use-cache-limit-enforcement';
import {
  estimateRemainingSeconds,
  type AioBatchProgress,
} from '@/pages/dashboard/lib/aio-batch-progress';
import { createSingleBatchProgressReporter } from '@/pages/dashboard/lib/single-batch-progress';
import {
  findChapterPreset,
  resolveChapterBatchOptions,
} from '@/pages/dashboard/lib/aio-chapter-options';
import {
  DIRECT_IMAGES_CHAPTER_ID,
  groupImagesIntoAioChapters,
} from '@/pages/dashboard/lib/aio-chapters';
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
import { createBatchPauseGate } from '@/pages/dashboard/lib/batch-pause-gate';
import { runBatchPauseBoundary } from '@/pages/dashboard/lib/batch-pause-boundary';
import { useAioBatchPauseStore } from '@/pages/dashboard/stores/aio-batch-pause-store';
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
import {
  publishBatchError,
  publishBatchIdle,
  publishBatchRunning,
} from '@/pages/dashboard/lib/desktop-batch-bus';
import { showDesktopNotification } from '@/pages/dashboard/lib/desktop-notifications';
import { resolveWorkGlossaryForChapter } from '@/pages/dashboard/hooks/translator.execution';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import {
  advanceLiveStageView,
  createBatchLiveStageTracker,
} from '@/pages/dashboard/hooks/aio-live-stage-advance';
import {
  deriveLocalProviderLabel,
  useAioStageTimingStore,
} from '@/pages/dashboard/stores/aio-stage-timing-store';
import { useEconomicUiStore } from '@/pages/dashboard/stores/economic-ui-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
} from '@/types/dashboard.types';
import { applyDetectedGradientToStyle } from '@/utils/dashboard.utils';
import { isCustomModelSelectionKey } from '@/utils/customLlm';
import { resolveTranslationStageExecutionKey } from '@/utils/translationAutoResolution';
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

export function useAioPipelineExecution(
  args: UseAioPipelineExecutionArgs,
): Readonly<{ processAIO: () => Promise<void>; processAioAi: () => Promise<void> }> {
  const { processAioAi } = useAioAiPipelineExecution(args);
  const { t } = useI18n();
  const images = useImageCollectionStore((state) => state.images);
  const aioSteps = useAioPipelineStore((state) => state.aioSteps);
  const aioSrcLang = useAioPipelineStore((state) => state.aioSrcLang);
  const selection = useAioPipelineStore((state) => state.aioStageSelection);
  const cleanViaAi = useAioPipelineStore((state) => state.aioCleanViaAi);
  const cleanAiModelKey = useAioPipelineStore(
    (state) => state.aioCleanAiModelKey,
  );
  const cleanAiInstructions = useAioPipelineStore(
    (state) => state.aioCleanAiInstructions,
  );

  const activeRef = useRef<ActiveAutoExecution | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeRef.current?.controller.abort(createAioAbortError());
    };
  }, []);

  const aioTgtLang = useAioPipelineStore((state) => state.aioTgtLang);
  const aioDeviceInfo = useAioPipelineStore((state) => state.aioDeviceInfo);

  const prepare = useAioExecutionPreparation({
    imagesCount: images.length,
    localApiUrl: args.localApiUrl,
    aioSteps,
    aioSrcLang,
    aioTgtLang,
    detectSelectionKey: selection.detectText,
    ocrSelectionKey: selection.recognizeText,
    translationSelectionKey: resolveTranslationStageExecutionKey(
      selection.getTranslations,
      {
        registryModels: TRANSLATION_MODELS_REGISTRY,
        installEntries: args.modelEntries,
        sourceLanguage: aioSrcLang,
        targetLanguage: aioTgtLang,
        deviceInfo: aioDeviceInfo,
      },
    ),
    segmentSelectionKey: selection.segmentText,
    cleanSelectionKey: selection.cleanImage,
    effectiveBatchConcurrency: args.effectiveBatchConcurrency,
    modelEntries: args.modelEntries,
    selectedCustomOcrProfile: args.selectedCustomOcrProfile,
    selectedCustomTranslationProfile: args.selectedCustomTranslationProfile,
    cleanViaAi,
    cleanAiModelKey,
    cleanCustomProfiles: args.cleanCustomProfiles,
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

  const advanceLiveStageForRun = useCallback(
    (
      stageKey: AioPipelineSnapshotKey,
      image: LoadedImage,
      regions: AioTextRegion[] | null,
      download?: AioDownloadEntry | null,
    ): void => {
      advanceLiveStageView(
        { labels: args.aioPipelineStageProgressLabels },
        stageKey,
        image,
        regions,
        download,
      );
    },
    [args.aioPipelineStageProgressLabels],
  );

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
        advanceLiveStageForRun(stageKey, image, null);
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

    if (
      pipeline.aioSteps !== aioSteps ||
      pipeline.aioSrcLang !== aioSrcLang ||
      pipeline.aioStageSelection !== selection ||
      pipeline.aioCleanViaAi !== cleanViaAi ||
      pipeline.aioCleanAiModelKey !== cleanAiModelKey ||
      pipeline.aioCleanAiInstructions !== cleanAiInstructions ||
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
      let publishedBatchRunning = false;
      let publishedTerminalBatchState = false;

    try {
      useStatusStore.getState().setRuntimeExecutionNotice(null);
      useAioPipelineStore.getState().setAioBatchProgress(null);
      useAioStageTimingStore.getState().resetForRun();
      useAioBatchPauseStore.getState().reset();
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

      if (prepared.useCloudOcr || prepared.useCloudTranslation) {
        useAioStageTimingStore
          .getState()
          .setProviderLine(
            prepared.useCloudOcr
              ? prepared.selectedOcrKey
              : prepared.selectedTranslationKey,
            'cloud',
          );
      } else {
        useAioStageTimingStore
          .getState()
          .setProviderLine(
            deriveLocalProviderLabel(
              useAioPipelineStore.getState().aioDeviceInfo,
            ),
            'local',
          );
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
        cleanViaAi,
        cleanAiModelKey,
        cleanAiInstructions,
        cleanAiCustomProfile: prepared.cleanAiCustomProfile ?? null,
        cleanAiModelConfig: pipeline.aioCleanAiModelConfig,
        onStageCompleted: (stageKey, image, regions, download) => {
          advanceLiveStageForRun(stageKey, image, regions, download);
        },
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

      publishBatchRunning(0, executionImages.length);
      publishedBatchRunning = true;

      let results: AioBatchImageResult[];
      const pauseGate = createBatchPauseGate(executionController.signal);
      const pauseSettledResults: AioBatchImageResult[] = [];
      const streamedConsolidatedImageIds = new Set<string>();
      const runBatchPauseBoundaryAtBoundary = (): Promise<void> =>
        runBatchPauseBoundary({
          gate: pauseGate,
          signal: executionController.signal,
          getAccumulatedResults: () => pauseSettledResults,
          consolidate: (batchResults, consolidateOptions) => {
            consolidate([...batchResults], {
              ...consolidateOptions,
              skipImageIds: new Set<string>([
                ...(consolidateOptions?.skipImageIds ?? []),
                ...streamedConsolidatedImageIds,
              ]),
            });
          },
        });
      const consolidateSettledResults = (
        newResults: readonly AioBatchImageResult[],
      ): void => {
        if (newResults.length === 0) {
          return;
        }
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
        pauseSettledResults.push(...newResults);
        try {
          consolidate([...pauseSettledResults], {
            skipImageIds: new Set<string>([
              ...useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
              ...streamedConsolidatedImageIds,
            ]),
            writeSnapshots: false,
          });
          for (const result of newResults) {
            streamedConsolidatedImageIds.add(result.imageId);
          }
        } catch (error) {
          console.warn(
            '[aio-pipeline] settle consolidation failed; deferring to final consolidation',
            error,
          );
        }
      };
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
          translationCustomProfile: isCustomModelSelectionKey(
            options.translationSelectionKey,
          )
            ? args.selectedCustomTranslationProfile
            : null,
          renderDefaultStyle: args.renderDefaultStyle,
          typographyPresetState:
            useRegionEditorStore.getState().typographyPresetState,
          applyDetectedGradientToStyle,
          minRegionSize: MIN_REGION_SIZE,
          maxAreaRatio: 0.75,
          parseApiError,
        };

        const totalImages = executionImages.length;
        const globalIndexById = new Map(
          executionImages.map((image, index) => [image.id, index]),
        );
        let currentStageLabel: string | null = null;
        const advanceBatchLiveStage = createBatchLiveStageTracker<LoadedImage>(
          (stageKey, image) => advanceLiveStageForRun(stageKey, image, null),
        );
        const handleChunkState = (
          chapter: AioChapterGroup | null,
          scopePrefix: string,
          state: BatchChunkState,
        ): void => {
          const chunkMessage = `AIO ${scopePrefix}batch ${state.chunkNumber}/${state.chunkCount} · ${state.name}`;
          const economic = useEconomicUiStore.getState();
          if (economic.hidden) {
            economic.stageStatusMessage(chunkMessage);
            return;
          }
          useStatusStore.getState().setStatusMessage(chunkMessage);

          const stageKey = aioStageKeyForBatchStage(state.stage);
          if (stageKey !== null) {
            currentStageLabel =
              args.aioPipelineStageProgressLabels[stageKey];
          }
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
          advanceBatchLiveStage(stageKey, image);
        };

        const singleBatchProgress = createSingleBatchProgressReporter({
          getStageLabel: () => currentStageLabel,
          totalImages,
        });

        const chapterGroups = groupImagesIntoAioChapters(executionImages);
        const runAsChapterQueue =
          pipeline.batchModeEnabled && chapterGroups.length > 1;
        if (!runAsChapterQueue) {
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
              publishBatchRunning(startedUnits, totalUnits);
              singleBatchProgress.report(startedUnits, totalUnits);
            },
            onChunkState: (state) => handleChunkState(null, '', state),
            onWireProgress: (progress) => {
              useAioStageTimingStore
                .getState()
                .ingestWireProgress(progress, 'batch', '');
            },
            beforeChunk: runBatchPauseBoundaryAtBoundary,
            onChunkSettled: (chunkResults) => {
              consolidateSettledResults(chunkResults);
            },
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

          const runStartedAt = Date.now();
          const reportBatchProgress = (
            chapter: AioChapterGroup,
            startedImages: number,
          ): void => {
            const position = chapterPositionById.get(chapter.id);

            const progress: AioBatchProgress = {
              chapterIndex: (position?.index ?? 0) + 1,
              chapterCount: chapterGroups.length,
              chapterLabel: chapter.label,
              stageLabel: currentStageLabel,
              etaSeconds: estimateRemainingSeconds({
                elapsedMs: Date.now() - runStartedAt,
                completedImages: startedImages,
                totalImages,
              }),
            };
            const economic = useEconomicUiStore.getState();
            if (economic.hidden) {
              economic.stageBatchProgress(progress);
              return;
            }
            useAioPipelineStore.getState().setAioBatchProgress(progress);
          };

          const chapterRunOptions = (chapter: AioChapterGroup): LocalAioBatchOptions => {
            const options = resolveChapterBatchOptions(
              localOptions,
              findChapterPreset(
                pipeline.aioPresetState.presets,
                pipeline.batchChapterPresetByChapterId[chapter.id],
                pipeline.aioSrcLang,
              ),
              pipeline.aioStageOptions,
            );
            return {
              ...options,
              llmSettings: resolveWorkGlossaryForChapter(
                chapter.id === DIRECT_IMAGES_CHAPTER_ID
                  ? DIRECT_IMAGES_CHAPTER_ID
                  : chapter.label,
                options.llmSettings,
              ),
            };
          };

          const chapters: ChapterSource[] = chapterGroups.map((chapter) => ({
            id: chapter.id,
            label: chapter.label,
            images: chapter.images,
            options: chapterRunOptions(chapter),
          }));

          const runChapter = createLocalBatchChapterRunner({
            localApiUrl: args.localApiUrl,
            concurrency: args.effectiveBatchConcurrency,
            capacity: prepared.batchCapacity,
            onWireProgress: (chapter, progress) => {
              useAioStageTimingStore
                .getState()
                .ingestWireProgress(progress, chapter.id, chapter.label);
            },
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
            beforeChapter: runBatchPauseBoundaryAtBoundary,
            onChapterSettled: (outcome) => {
              if (outcome.status !== 'failed') {
                consolidateSettledResults(outcome.results);
              }
            },
            onChapterStart: (chapter, index) => {
              const group = chapterGroups[index];

              if (group) {
                reportBatchProgress(
                  group,
                  chapterPositionById.get(group.id)?.imagesBefore ?? 0,
                );
              }

              const chapterMessage = `AIO chapter ${index + 1}/${chapters.length} · ${chapter.label}...`;
              const economic = useEconomicUiStore.getState();
              if (economic.hidden) {
                economic.stageStatusMessage(chapterMessage);
                return;
              }
              useStatusStore.getState().setStatusMessage(chapterMessage);
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
              publishBatchRunning(Math.floor(startedImages), totalImages);
              const group = chapterGroups[position.index];

              if (group) {
                reportBatchProgress(group, startedImages);
              }

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
            recordStageModelRefusal(outcome.error);
            return chapter
              ? chapter.images.map((image) =>
                  buildFailedBatchResult(
                    image,
                    outcome.error,
                    itemBusyMessage(outcome.error, t),
                  ),
                )
              : [];
          });
        }
      } else {
        results = await runAioBatch({
          items: executionImages,
          concurrency: args.effectiveBatchConcurrency,
          controller: executionController,
          onProgress: (completed, total) => {
            publishBatchRunning(completed, total);
          },
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
          onItemError: (error, item) => {
            recordStageModelRefusal(error);
            return buildFailedBatchResult(item, error, itemBusyMessage(error, t));
          },
          beforeItem: runBatchPauseBoundaryAtBoundary,
          onItemSettled: (value) => {
            consolidateSettledResults([value]);
          },
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

      const summary = consolidate(results, {
        skipImageIds: useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
      });

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

      publishBatchIdle(executionImages.length, executionImages.length);
      publishedTerminalBatchState = true;

      showDesktopNotification({
        title: t('aio.batch.done.notify.title'),
        body: t('aio.batch.done.notify.body', { count: summary.processedPagesCount }),
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
      useEconomicUiStore.getState().clearPending();

      if (
        controller &&
        useAioPipelineStore.getState().aioAbortController === controller
      ) {
        useAioPipelineStore.getState().clearAioExecutionState(controller);
        useAioPipelineStore.getState().setAioBatchProgress(null);
        useUiShellStore.getState().setProcessing(false);
        useUiShellStore.getState().setProgress(0);
        useStatusStore.getState().setRuntimeExecutionNotice(null);
        if (runCompleted) {
          void enforceCacheLimitAfterRun();
          args.onAutoRunCompleted();
        }
      }

      activeRef.current = null;

      if (controller && mountedRef.current) {
        void runAioNotification(args.syncDiscordForTab);
      }
    }
  });

  return { processAIO, processAioAi };
}
