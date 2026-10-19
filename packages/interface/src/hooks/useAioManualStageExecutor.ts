import { useCallback, useEffect, useRef } from 'react';

import { useI18n } from '../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_LABELS,
  AIO_STAGE_LABELS,
} from '../constants/dashboard.constants';
import {
  finishStageRun,
  runCleanImageStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
  runSegmentTextStage,
} from '../aio-stages';
import {
  applyRenderDefaultsToRegion,
  clamp,
  toApiIntegerBbox,
} from '../utils/dashboard.utils';
import {
  type CustomLlmProfile,
  type LlmRequestSettings,
  getCustomLlmRuntimeRestriction,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
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
  compatibleTranslationModelIds: Set<string>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  validateManualLocalStageModel: (stageKey: string, stageLabel: string, modelKey: string) => boolean;
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
  compatibleTranslationModelIds,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  validateManualLocalStageModel,
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
    const selectedOcrOption = getAioStageOption('recognizeText', selectedOcrKey);
    const selectedTranslationOption = getAioStageOption('getTranslations', selectedTranslationKey);

    const useCloudOcr = isCloudOcrModelKey(selectedOcrKey);
    const useCloudTranslation = isCustomModelSelectionKey(selectedTranslationKey)
      ? !shouldUseLocalDesktopTranslationForCustomProfile(selectedCustomTranslationProfile)
      : isCloudTranslationModelKey(selectedTranslationKey);
    const useLlmSettingsForOcr = useCloudOcr && hasAnyLlmCapability(
      selectedOcrOption?.llm_capabilities ?? inferLlmCapabilitiesForModelSelection('ocr', selectedOcrKey),
    );
    const useLlmSettingsForTranslation = (useCloudTranslation || isCustomModelSelectionKey(selectedTranslationKey)) && hasAnyLlmCapability(
      selectedTranslationOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('translation', selectedTranslationKey),
    );

    setProcessing(true);
    setProgress(0);
    onStageStart(stageKey, activeImageData, 0);
    setStatusMessage(`Modo manual: executando "${stageLabel}" em "${activeImageData.file.name}"...`);

    try {
      let executionNotice: RuntimeExecutionNotice | null = null;
      if (stageKey === 'detectText') {
        assertNotAborted();
        const currentDetectRegions =
          useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
        const normalizedSelectedRegions = currentDetectRegions
          .map((region): AioTextRegion | null => {
            const normalizedBbox = toApiIntegerBbox(
              region.bbox,
              activeImageData.width,
              activeImageData.height,
            );
            const [x1, y1, x2, y2] = normalizedBbox;
            const width = x2 - x1;
            const height = y2 - y1;
            if (width < minRegionSize || height < minRegionSize) {
              return null;
            }
            const resolvedModelKey = region.modelKey || 'manual';
            return {
              ...region,
              bbox: normalizedBbox,
              source: region.source ?? 'manual',
              score: Number.isFinite(region.score) ? region.score : 1,
              modelKey: resolvedModelKey,
              detectorModelKey: region.detectorModelKey || resolvedModelKey,
            };
          })
          .filter((region): region is AioTextRegion => region !== null);

        if (normalizedSelectedRegions.length > 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, normalizedSelectedRegions);
        } else {
          if (!aioStageOptions.detectText.some((option) => option.key === selectedDetectorKey)) {
            throw new Error(t('aioManual.selectValidDetectModel'));
          }
          if (!validateManualLocalStageModel('detectText', AIO_STAGE_LABELS.detectText, selectedDetectorKey)) {
            return;
          }

          const detectRun = await runDetectTextStage(
            {
              image: activeImageData,
              modelKey: selectedDetectorKey,
              sourceLanguage: aioSrcLang,
              gpu: gpuStages,
              minRegionSize,
            },
            stageRuntime,
            'Failed to detect text',
          );
          const detectDone = await finishStageRun(detectRun, {
            stageLabel,
            failurePrefix: 'Failed to detect text',
            parseApiError,
          });
          executionNotice = detectDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);

          patchAioSnapshotStageForImage(activeId, stageIndex, detectDone.value);
        }
      } else if (stageKey === 'recognizeText') {
        assertNotAborted();
        if (!aioStageOptions.recognizeText.some((option) => option.key === selectedOcrKey)) {
          throw new Error(t('aioExec.selectValidOcrModel'));
        }

        if (modelEntries[selectedOcrKey]) {
          if (!validateManualLocalStageModel('recognizeText', AIO_STAGE_LABELS.recognizeText, selectedOcrKey)) {
            return;
          }
        } else {
          if (!selectedOcrOption) throw new Error(t('aioExec.selectValidOcrModel'));
          if (!selectedOcrOption.implemented) {
            throw new Error(t('aioModel.status.inRoadmap', { name: selectedOcrOption.name }));
          }
          if (!selectedOcrOption.available) {
            throw new Error(t('aioModel.status.requiresConfig', { name: selectedOcrOption.name }));
          }
          if (isCustomModelSelectionKey(selectedOcrKey) && !selectedCustomOcrProfile) {
            throw new Error(t('aioExec.selectCustomOcrProfile'));
          }
          if (
            isCustomModelSelectionKey(selectedOcrKey)
            && selectedCustomOcrProfile
            && requiresCustomLlmApiKey(selectedCustomOcrProfile.apiBase)
            && !selectedCustomOcrProfile.apiKey.trim()
          ) {
            throw new Error(t('aioExec.ocrRequiresApiKey'));
          }
        }

        const detectRegions = getAioRegionsFromSnapshot('detectText', activeId);
        if (detectRegions.length === 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, []);
        } else {
          const ocrRun = await runRecognizeTextStage(
            {
              image: activeImageData,
              modelKey: selectedOcrKey,
              sourceLanguage: aioSrcLang,
              regions: detectRegions,
              gpu: gpuStages,
              useCloudOcr,
              llmSettings: useLlmSettingsForOcr ? llmSettings : null,
              customProfile: useLlmSettingsForOcr ? selectedCustomOcrProfile : null,
            },
            stageRuntime,
            'Failed to recognize text',
          );
          const ocrDone = await finishStageRun(ocrRun, {
            stageLabel,
            failurePrefix: 'Failed to recognize text',
            parseApiError,
          });
          executionNotice = ocrDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          patchAioSnapshotStageForImage(activeId, stageIndex, ocrDone.value);
        }
      } else if (stageKey === 'getTranslations') {
        assertNotAborted();
        const selectedLocalModelState = modelEntries[selectedTranslationKey];
        if (selectedLocalModelState) {
          const selectedModelInstalled =
            selectedLocalModelState.status === 'installed'
            || selectedLocalModelState.status === 'update_available';
          if (!selectedModelInstalled) {
            throw new Error(t('aioExec.installTranslationModel'));
          }
          if (!compatibleTranslationModelIds.has(selectedLocalModelState.model.id)) {
            throw new Error(t('aioExec.incompatibleLanguage'));
          }
        } else {
          if (!selectedTranslationOption) throw new Error(t('aioExec.selectValidTranslation'));
          if (!selectedTranslationOption.implemented) {
            throw new Error(t('aioModel.status.inRoadmap', { name: selectedTranslationOption.name }));
          }
          if (!selectedTranslationOption.available) {
            throw new Error(t('aioModel.status.requiresConfig', { name: selectedTranslationOption.name }));
          }
          if (isCustomModelSelectionKey(selectedTranslationKey) && !selectedCustomTranslationProfile) {
            throw new Error(t('aioExec.selectCustomAiProfile'));
          }
          if (
            isCustomModelSelectionKey(selectedTranslationKey)
            && selectedCustomTranslationProfile
            && requiresCustomLlmApiKey(selectedCustomTranslationProfile.apiBase)
            && !selectedCustomTranslationProfile.apiKey.trim()
          ) {
            throw new Error(t('aioExec.translationRequiresApiKey'));
          }
          if (isCustomModelSelectionKey(selectedTranslationKey) && selectedCustomTranslationProfile) {
            const runtimeRestriction = getCustomLlmRuntimeRestriction(selectedCustomTranslationProfile.apiBase);
            if (runtimeRestriction) {
              throw new Error(runtimeRestriction);
            }
          }
        }

        const ocrRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        const hasTextForTranslation = ocrRegions.some((region) => (region.recognizedText ?? '').trim().length > 0);
        if (!hasTextForTranslation) {
          patchAioSnapshotStageForImage(activeId, stageIndex, ocrRegions);
        } else {
          const translateRun = await runGetTranslationsStage(
            {
              image: activeImageData,
              modelKey: selectedTranslationKey,
              sourceLanguage: aioSrcLang,
              targetLanguage: aioTgtLang,
              regions: ocrRegions,
              fallbackOcrModelKey: selectedOcrKey,
              llmSettings: useLlmSettingsForTranslation ? llmSettings : null,
              customProfile: useLlmSettingsForTranslation ? selectedCustomTranslationProfile : null,
              includeImagePayload: useLlmSettingsForTranslation,
            },
            stageRuntime,
            'Failed to translate text',
          );
          const translateDone = await finishStageRun(translateRun, {
            stageLabel,
            failurePrefix: 'Failed to translate text',
            parseApiError,
          });
          executionNotice = translateDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          patchAioSnapshotStageForImage(activeId, stageIndex, translateDone.value);
        }
      } else if (stageKey === 'segmentText') {
        assertNotAborted();
        if (!aioStageOptions.segmentText.some((option) => option.key === selectedSegmentKey)) {
          throw new Error(t('aioManual.selectValidSegmentModel'));
        }
        if (!validateManualLocalStageModel('segmentText', AIO_STAGE_LABELS.segmentText, selectedSegmentKey)) {
          return;
        }

        let sourceRegions = getAioRegionsFromSnapshot('getTranslations', activeId);
        if (sourceRegions.length === 0) {
          sourceRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        }
        if (sourceRegions.length === 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, []);
        } else {
          const segmentRun = await runSegmentTextStage(
            {
              image: activeImageData,
              modelKey: selectedSegmentKey,
              regions: sourceRegions,
              fallbackOcrModelKey: selectedOcrKey,
              fallbackTranslatorModelKey: selectedTranslationKey,
              gpu: gpuStages,
            },
            stageRuntime,
            'Failed to segment text',
          );
          const segmentDone = await finishStageRun(segmentRun, {
            stageLabel,
            failurePrefix: 'Failed to segment text',
            parseApiError,
          });
          executionNotice = segmentDone.notice;
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          patchAioSnapshotStageForImage(activeId, stageIndex, segmentDone.value);
        }
      } else if (stageKey === 'cleanImage') {
        assertNotAborted();
        if (!aioStageOptions.cleanImage.some((option) => option.key === selectedCleanKey)) {
          throw new Error(t('aioManual.selectValidCleanModel'));
        }
        if (!validateManualLocalStageModel('cleanImage', AIO_STAGE_LABELS.cleanImage, selectedCleanKey)) {
          return;
        }

        let sourceRegions = getAioRegionsFromSnapshot('segmentText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('detectText', activeId);

        // If the user manually painted brush areas, convert the canvas to a pixel-exact
        // binary mask blob and send it alongside the auto-detected regions. This ensures
        // inpainting only touches the exact painted pixels (not their bounding boxes).
        const manualEditState = getAioManualImageEditState(activeId);
        const cleanRun = await runCleanImageStage(
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
            gpu: gpuStages,
          },
          stageRuntime,
          'Failed to clean the image',
        );
        const cleanDone = await finishStageRun(cleanRun, {
          stageLabel,
          failurePrefix: 'Failed to clean the image',
          parseApiError,
        });
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
        let sourceRegions = getAioRegionsFromSnapshot('cleanImage', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('segmentText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('getTranslations', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('detectText', activeId);
        const renderRegions = sourceRegions.map((region) => applyRenderDefaultsToRegion(region, renderDefaultStyle, applyDetectedGradientToStyle, undefined, aioTgtLang));
        patchAioSnapshotStageForImage(activeId, stageIndex, renderRegions);
      }

      if (!aioAutoProcessedImageById[activeId]) {
        recordProcessedPages(1);
      }

      completeManualStageForImage(activeId, stageIndex, 'done');
      setProgress(100);
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
        setStatusMessage(error instanceof Error ? error.message : t('aioManual.stageFailed', { stageLabel }));
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
    compatibleTranslationModelIds,
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
    validateManualLocalStageModel,
  ]);
}
