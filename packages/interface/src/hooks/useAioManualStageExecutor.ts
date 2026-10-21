import { useCallback, useEffect, useRef } from 'react';

import { useI18n } from '../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_LABELS,
  AIO_STAGE_LABELS,
} from '../constants/dashboard.constants';
import {
  ensureStageModelReadiness,
  getAioStageReadiness,
  resolveUpstreamRegions,
  runCleanImageStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
  runSegmentTextStage,
  stageCatalogOption,
  stageTransportNoticeDetail,
  type StageRegions,
  type StageReadinessReady,
} from '../aio-stages';
import {
  applyRenderDefaultsToRegion,
  clamp,
} from '../utils/dashboard.utils';
import { normalizeManualRegions } from '../utils/detectTextRegions';
import {
  type CustomLlmProfile,
  type LlmRequestSettings,
} from '../utils/customLlm';
import type { RenderTextStyle } from '../utils/renderText';
import type {
  AioDownloadEntry,
  AioManualImageEditState,
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  RuntimeExecutionNotice,
} from '../types/dashboard.types';
import type { AioStageOption } from '../models/aioStageCatalog';
import { useAioPipelineStore } from '../pages/dashboard/stores/aio-pipeline-store';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';
import { patchAioSnapshotStageForImage } from '../pages/dashboard/hooks/aio-snapshot.commands';

interface ModelManagerEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseAioManualStageExecutorArgs {
  activeId: string | null;
  processing: boolean;
  images: LoadedImage[];
  aioAutoProcessedImageById: Record<string, boolean>;
  aioStageOptions: {
    detectText: AioStageOption[];
    recognizeText: AioStageOption[];
    segmentText: AioStageOption[];
    cleanImage: AioStageOption[];
  };
  aioStageSelection: {
    detectText: string;
    recognizeText: string;
    getTranslations: string;
    segmentText: string;
    cleanImage: string;
  };
  aioSrcLang: string;
  aioTgtLang: string;
  aioMaskDilation: number;
  aioHdStrategy: string;
  aioHdResizeLimit: number;
  aioHdCropMargin: number;
  aioHdCropTriggerSize: number;
  gpuStages?: { detectText: boolean; recognizeText: boolean; segmentText: boolean; cleanImage: boolean };
  minRegionSize: number;
  llmSettings: LlmRequestSettings;
  renderDefaultStyle: RenderTextStyle;
  localApiUrl: string;
  modelEntries: Record<string, ModelManagerEntryLike | undefined>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  openModelManagerForStage: (stage: string, options?: Record<string, unknown>) => void;
  getAioStageOption: (stageKey: 'recognizeText' | 'getTranslations', key: string) => AioStageOption | null;
  parseApiError: (response: Response) => Promise<string>;
  getAioRegionsFromSnapshot: (stageKey: AioPipelineSnapshotKey, imageId: string) => AioTextRegion[];
  getAioManualImageEditState: (imageId: string) => AioManualImageEditState;
  completeManualStageForImage: (imageId: string, stageIndex: number, status: 'done' | 'skipped') => void;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void> | void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (value: string) => void;
  applyDetectedGradientToStyle: (...args: any[]) => any;
  getAbortSignal: () => AbortSignal | null;
  onStageStart: (stageKey: AioPipelineSnapshotKey, image: LoadedImage, index: number) => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
}

/**
 * Converts a segment brush data URL (image-scale PNG with painted areas)
 * into a binary grayscale mask Blob (painted pixels = white, unpainted = black).
 * This gives pixel-exact inpainting — only the brushed pixels are cleaned.
 */
export function useAioManualStageExecutor({
  activeId,
  processing,
  images,
  aioAutoProcessedImageById,
  aioStageOptions,
  aioStageSelection,
  aioSrcLang,
  aioTgtLang,
  aioMaskDilation,
  aioHdStrategy,
  aioHdResizeLimit,
  aioHdCropMargin,
  aioHdCropTriggerSize,
  gpuStages,
  minRegionSize,
  llmSettings,
  renderDefaultStyle,
  localApiUrl,
  modelEntries,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  openModelManagerForStage,
  getAioStageOption,
  parseApiError,
  getAioRegionsFromSnapshot,
  getAioManualImageEditState,
  completeManualStageForImage,
  recordProcessedPages,
  syncDiscordForTab,
  setProcessing,
  setProgress,
  setStatusMessage,
  applyDetectedGradientToStyle,
  getAbortSignal,
  onStageStart,
  setRuntimeExecutionNotice,
}: UseAioManualStageExecutorArgs) {
  const { t } = useI18n();
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  return useCallback(async () => {
    if (!activeId) {
      setStatusMessage(t('aioManual.selectImage'));
      return;
    }
    if (processing) return;

    const activeImageData = images.find((image) => image.id === activeId);
    if (!activeImageData) {
      setStatusMessage(t('aioManual.imageNotFound'));
      return;
    }
    const progress =
      useAioPipelineStore.getState().aioManualProgressByImage[activeId];
    if (!progress) {
      setStatusMessage(t('aioManual.progressNotInitialized'));
      return;
    }
    const stageIndex = clamp(progress.currentIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    const stageKey = AIO_MANUAL_STAGE_ORDER[stageIndex]!;
    const stageLabel = AIO_PIPELINE_STAGE_LABELS[stageKey];
    const stageRegionsFromSnapshot = (): StageRegions => ({
      detectText: getAioRegionsFromSnapshot('detectText', activeId),
      recognizeText: getAioRegionsFromSnapshot('recognizeText', activeId),
      getTranslations: getAioRegionsFromSnapshot('getTranslations', activeId),
      segmentText: getAioRegionsFromSnapshot('segmentText', activeId),
      cleanImage: getAioRegionsFromSnapshot('cleanImage', activeId),
    });
    // The shared provenance module decides runnability from the stage regions.
    // Manual now accepts the same fallback chains as the runner: detect-text
    // for segmentText and getTranslations for cleanImage; everything else
    // stays equally strict.
    const readiness = getAioStageReadiness(stageKey, stageRegionsFromSnapshot());
    if (!readiness.runnable) {
      setStatusMessage(t(`aioManual.prereqMissing.${stageKey}`));
      return;
    }
    const signal = getAbortSignal();
    const stageRuntime = { localApiUrl, signal };
    const assertNotAborted = (): void => {
      if (!signal?.aborted) {
        return;
      }

      throw (
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError')
      );
    };
    let selectedDetectorKey = aioStageSelection.detectText;
    let selectedOcrKey = aioStageSelection.recognizeText;
    let selectedTranslationKey = aioStageSelection.getTranslations;
    let selectedSegmentKey = aioStageSelection.segmentText;
    let selectedCleanKey = aioStageSelection.cleanImage;

    const readinessSink = { setStatusMessage, openModelManagerForStage };
    const ensureReady = (
      args: Parameters<typeof ensureStageModelReadiness>[0],
    ): StageReadinessReady | null => ensureStageModelReadiness(args, readinessSink);

    setProcessing(true);
    setProgress(0);
    onStageStart(stageKey, activeImageData, 0);
    setStatusMessage(`Modo manual: executando "${stageLabel}" em "${activeImageData.file.name}"...`);

    // Named stage body keeps the try/catch shallow around error mapping.
    // Tagged result: refusals already set their own status message and must not
    // be overwritten by the "stage done" message.
    type ManualStageBodyResult =
      | { refused: true }
      | { refused: false; notice: RuntimeExecutionNotice | null };
    const runStageBody = async (): Promise<ManualStageBodyResult> => {
      let executionNotice: RuntimeExecutionNotice | null = null;
      if (stageKey === 'detectText') {
        assertNotAborted();
        const currentDetectRegions =
          useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
        const normalizedSelectedRegions = normalizeManualRegions(
          currentDetectRegions,
          activeImageData,
          { minRegionSize },
        );

        if (normalizedSelectedRegions.length > 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, normalizedSelectedRegions);
        } else {
          const detectReadiness = ensureReady({
            stage: 'detectText',
            stageLabel: AIO_STAGE_LABELS.detectText,
            modelKey: selectedDetectorKey,
            catalog: stageCatalogOption(
              aioStageOptions.detectText.find((item) => item.key === selectedDetectorKey) ?? null,
            ),
            modelEntries,
            t,
          });
          if (!detectReadiness) {
            return { refused: true };
          }

          const detectDone = await runDetectTextStage(
            {
              image: activeImageData,
              modelKey: selectedDetectorKey,
              sourceLanguage: aioSrcLang,
              useGpu: gpuStages?.detectText,
              minRegionSize,
            },
            stageRuntime,
            { stageLabel, failurePrefix: 'Failed to detect text', parseApiError },
          );
          executionNotice = detectDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);

          patchAioSnapshotStageForImage(activeId, stageIndex, detectDone.value);
        }
      } else if (stageKey === 'recognizeText') {
        assertNotAborted();
        const ocrReadiness = ensureReady({
          stage: 'recognizeText',
          stageLabel: AIO_STAGE_LABELS.recognizeText,
          modelKey: selectedOcrKey,
          catalog: stageCatalogOption(
            aioStageOptions.recognizeText.find((item) => item.key === selectedOcrKey) ?? null,
          ),
          modelEntries,
          customProfile: selectedCustomOcrProfile,
          t,
        });
        if (!ocrReadiness) {
          return { refused: true };
        }

        const detectRegions = getAioRegionsFromSnapshot('detectText', activeId);
        if (detectRegions.length === 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, []);
        } else {
          const ocrDone = await runRecognizeTextStage(
            {
              image: activeImageData,
              modelKey: selectedOcrKey,
              sourceLanguage: aioSrcLang,
              regions: detectRegions,
              useGpu: gpuStages?.recognizeText,
              useCloudOcr: ocrReadiness.useCloud,
              llmSettings: ocrReadiness.useLlmSettings ? llmSettings : null,
              customProfile: ocrReadiness.useLlmSettings ? ocrReadiness.customProfile : null,
            },
            stageRuntime,
            { stageLabel, failurePrefix: 'Failed to recognize text', parseApiError },
          );
          executionNotice = ocrDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          patchAioSnapshotStageForImage(activeId, stageIndex, ocrDone.value);
        }
      } else if (stageKey === 'getTranslations') {
        assertNotAborted();
        const translationReadiness = ensureReady({
          stage: 'getTranslations',
          stageLabel: AIO_STAGE_LABELS.getTranslations,
          modelKey: selectedTranslationKey,
          catalog: stageCatalogOption(
            getAioStageOption('getTranslations', selectedTranslationKey),
          ),
          modelEntries,
          customProfile: selectedCustomTranslationProfile,
          languages: { source: aioSrcLang, target: aioTgtLang },
          t,
        });
        if (!translationReadiness) {
          return { refused: true };
        }

        const ocrRegions = resolveUpstreamRegions('getTranslations', stageRegionsFromSnapshot());
        const hasTextForTranslation = ocrRegions.some((region) => (region.recognizedText ?? '').trim().length > 0);
        if (!hasTextForTranslation) {
          patchAioSnapshotStageForImage(activeId, stageIndex, ocrRegions);
        } else {
          const translateDone = await runGetTranslationsStage(
            {
              image: activeImageData,
              modelKey: selectedTranslationKey,
              sourceLanguage: aioSrcLang,
              targetLanguage: aioTgtLang,
              regions: ocrRegions,
              fallbackOcrModelKey: selectedOcrKey,
              llmSettings: translationReadiness.useLlmSettings ? llmSettings : null,
              customProfile: translationReadiness.useLlmSettings
                ? translationReadiness.customProfile
                : null,
            },
            stageRuntime,
            { stageLabel, failurePrefix: 'Failed to translate text', parseApiError },
          );
          executionNotice = translateDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          patchAioSnapshotStageForImage(activeId, stageIndex, translateDone.value);
        }
      } else if (stageKey === 'segmentText') {
        assertNotAborted();
        const segmentReadiness = ensureReady({
          stage: 'segmentText',
          stageLabel: AIO_STAGE_LABELS.segmentText,
          modelKey: selectedSegmentKey,
          catalog: stageCatalogOption(
            aioStageOptions.segmentText.find((item) => item.key === selectedSegmentKey) ?? null,
          ),
          modelEntries,
          t,
        });
        if (!segmentReadiness) {
          return { refused: true };
        }

        const sourceRegions = resolveUpstreamRegions('segmentText', stageRegionsFromSnapshot());
        if (sourceRegions.length === 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, []);
        } else {
          const segmentDone = await runSegmentTextStage(
            {
              image: activeImageData,
              modelKey: selectedSegmentKey,
              regions: sourceRegions,
              fallbackOcrModelKey: selectedOcrKey,
              fallbackTranslatorModelKey: selectedTranslationKey,
              useGpu: gpuStages?.segmentText,
            },
            stageRuntime,
            { stageLabel, failurePrefix: 'Failed to segment text', parseApiError },
          );
          executionNotice = segmentDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          patchAioSnapshotStageForImage(activeId, stageIndex, segmentDone.value);
        }
      } else if (stageKey === 'cleanImage') {
        assertNotAborted();
        const cleanReadiness = ensureReady({
          stage: 'cleanImage',
          stageLabel: AIO_STAGE_LABELS.cleanImage,
          modelKey: selectedCleanKey,
          catalog: stageCatalogOption(
            aioStageOptions.cleanImage.find((item) => item.key === selectedCleanKey) ?? null,
          ),
          modelEntries,
          t,
        });
        if (!cleanReadiness) {
          return { refused: true };
        }

        const sourceRegions = resolveUpstreamRegions('cleanImage', stageRegionsFromSnapshot());

        // If the user manually painted brush areas, convert the canvas to a pixel-exact
        // binary mask blob and send it alongside the auto-detected regions. This ensures
        // inpainting only touches the exact painted pixels (not their bounding boxes).
        const manualEditState = getAioManualImageEditState(activeId);
        const cleanDone = await runCleanImageStage(
          {
            image: activeImageData,
            modelKey: selectedCleanKey,
            regions: sourceRegions,
            fallbackOcrModelKey: selectedOcrKey,
            fallbackSegmentModelKey: selectedSegmentKey,
            options: {
              maskDilation: aioMaskDilation,
              hdStrategy: aioHdStrategy,
              hdResizeLimit: aioHdResizeLimit,
              hdCropMargin: aioHdCropMargin,
              hdCropTriggerSize: aioHdCropTriggerSize,
              brushDataUrl: manualEditState.segmentBrushDataUrl,
            },
            useGpu: gpuStages?.cleanImage,
          },
          stageRuntime,
          { stageLabel, failurePrefix: 'Failed to clean the image', parseApiError },
        );
        executionNotice = cleanDone.notice;
        if (executionNotice) setRuntimeExecutionNotice(executionNotice);

        const cleanBlob = cleanDone.value;
        if (!cleanBlob.type.startsWith('image/')) {
          throw new Error(t('aioManual.invalidCleanResponse'));
        }

        const cleanEntry: AioDownloadEntry = {
          fileName: `koma-studio-aio-clean-${activeImageData.file.name.replace(/\s+/g, '-')}.png`,
          blob: cleanBlob,
          sourceImageId: activeId,
        };
        // Store the original source regions in the snapshot (NOT the virtual brush region)
        // so downstream stages don't show a giant full-image bounding box.
        patchAioSnapshotStageForImage(activeId, stageIndex, sourceRegions, cleanEntry);
      } else {
        const sourceRegions = resolveUpstreamRegions('render', stageRegionsFromSnapshot());
        const renderRegions = sourceRegions.map((region) => applyRenderDefaultsToRegion(region, renderDefaultStyle, applyDetectedGradientToStyle, undefined, aioTgtLang));
        patchAioSnapshotStageForImage(activeId, stageIndex, renderRegions);
      }

      if (!aioAutoProcessedImageById[activeId]) {
        recordProcessedPages(1);
      }

      completeManualStageForImage(activeId, stageIndex, 'done');
      setProgress(100);
      return { refused: false, notice: executionNotice };
    };

    try {
      const stageBodyResult = await runStageBody();
      if (stageBodyResult.refused) {
        return;
      }
      const executionNotice = stageBodyResult.notice;
      const doneMessage = t('aioManual.stageDone', { stageLabel, fileName: activeImageData.file.name });
      setStatusMessage(executionNotice ? `${doneMessage} ${executionNotice.detail}` : doneMessage);
      if (executionNotice) {
        if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = setTimeout(() => {
          setRuntimeExecutionNotice(null);
          noticeTimeoutRef.current = null;
        }, 4500);
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError')
        || (error instanceof Error && error.name === 'AbortError')
      ) {
        setStatusMessage(t('aioManual.executionAborted'));
      } else if (
        (error instanceof DOMException && error.name === 'TimeoutError')
        || (error instanceof Error && error.name === 'TimeoutError')
      ) {
        setStatusMessage(`Timed out during the "${stageLabel}" stage. The local backend took too long to respond.`);
      } else {
        setStatusMessage(error instanceof Error ? `${error.message}${stageTransportNoticeDetail(error)}` : t('aioManual.stageFailed', { stageLabel }));
      }
    } finally {
      setProcessing(false);
      setProgress(0);
      void syncDiscordForTab();
    }
  }, [
    activeId,
    aioAutoProcessedImageById,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    aioHdResizeLimit,
    aioHdStrategy,
    aioMaskDilation,
    aioSrcLang,
    aioStageOptions,
    aioStageSelection,
    aioTgtLang,
    applyDetectedGradientToStyle,
    completeManualStageForImage,
    getAbortSignal,
    getAioRegionsFromSnapshot,
    getAioStageOption,
    gpuStages,
    images,
    llmSettings,
    localApiUrl,
    minRegionSize,
    modelEntries,
    parseApiError,
    patchAioSnapshotStageForImage,
    processing,
    renderDefaultStyle,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    setRuntimeExecutionNotice,
    onStageStart,
    setProcessing,
    setProgress,
    setStatusMessage,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    openModelManagerForStage,
  ]);
}
