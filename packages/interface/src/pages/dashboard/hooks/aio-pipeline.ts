import { useEffect, useRef } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
  MIN_REGION_SIZE,
} from '@/constants/dashboard.constants';
import { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import {
  StageBusyError,
  StageModelRefusalError,
  stageKeyForRefusalStage,
  stageTransportNoticeDetail,
} from '@/aio-stages';
import { useI18n, type TranslateFn } from '@/i18n';
import { TRANSLATION_MODELS_REGISTRY } from '@/models/translation-models-registry';
import { parseApiError } from '@/pages/dashboard/helpers';
import type { UseAioPipelineExecutionArgs } from '@/pages/dashboard/hooks/aio-pipeline.execution.types';
import { useCommittedAsyncAction } from '@/pages/dashboard/hooks/use-committed-async-action';
import { enforceCacheLimitAfterRun } from '@/pages/dashboard/hooks/use-cache-limit-enforcement';
import {
  estimateRemainingSeconds,
  type AioBatchProgress,
} from '@/pages/dashboard/lib/aio-batch-progress';
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
import { resolveWorkGlossaryForChapter } from '@/pages/dashboard/hooks/translator.execution';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
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
  AioPipelineSnapshotKey,
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

/**
 * The named "model busy — retry" state replaces the raw refusal text on the
 * per-item error notice; any other failure keeps its message.
 */
function itemBusyMessage(error: unknown, t: TranslateFn): string | null {
  return error instanceof StageBusyError ? t('dashboard.aio.batchItemBusy') : null;
}

/**
 * Surfaces a structured backend refusal (explicit selection of an
 * unimplemented/unknown/unconfigured model) on the stage picker, where the
 * "use default model" action lives.
 */
function recordStageModelRefusal(error: unknown): void {
  if (!(error instanceof StageModelRefusalError)) {
    return;
  }
  const stageKey = stageKeyForRefusalStage(error.refusal.stage);
  if (stageKey !== null) {
    useAioPipelineStore
      .getState()
      .setAioStageModelRefusal(stageKey, error.refusal);
  }
}

function buildItemErrorNotice(
  fileName: string,
  error: unknown,
  busyMessage: string | null,
): string {
  if (busyMessage !== null) {
    return `${fileName}: ${busyMessage}`;
  }
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
  busyMessage: string | null,
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
    executionNotices: [
      buildItemErrorNotice(image.file.name, error, busyMessage),
    ],
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
    // WHY one blob here: non-queue multi-chapter batches fold ALL pages into
    // a single sidecar request carrying ONE llm_settings blob — the backend
    // builds every prompt from that single blob (core/config.py:246), so a
    // per-image/per-chapter work-glossary merge is impossible on this path
    // without a backend protocol change (out of scope for this cycle). The
    // GLOBAL glossary does apply (it rides the same blob). Every other
    // client path merges work glossary per image (retranslate, visual batch,
    // single-image processor, manual stage) or per chapter (the chapter
    // queue below — one blob per chapter request, so per-chapter merge works).
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
      // setAioDownloadItems replaces every prior `aio` download entry on each
      // call, so each settle consolidation must pass the ACCUMULATED results:
      // chunk-only results would revoke earlier chunks' cleaned previews.
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
        let currentStageLabel: string | null = null;
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

          // Stages run inside the sidecar, so polled state is the only source
          // for the indicator the per-image path feeds directly.
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
        };

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
            // Per-chapter request-local merge: one llm_settings blob rides on
            // THIS chapter's sidecar request and every image in the chapter
            // shares the label, so one merge covers the chapter's batch.
            // Direct uploads share the DIRECT_IMAGES_CHAPTER_ID group on the
            // per-image paths — the queue labels that group 'Images', so the
            // group id (not the display label) keys the work lookup here.
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
        // The handoff has to follow the release of `processing`: entering the
        // Manual editor is refused while a run owns the shell.
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

  return { processAIO };
}
