import { useCallback } from 'react';

import { useI18n } from '../i18n';
import {
  finishStageRun,
  runCleanImageStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
  runSegmentTextStage,
  type StageRunNotice,
} from '../aio-stages';
import {
  applyRenderDefaultsToRegion,
  cloneAioRegions,
  cloneRenderStyle,
} from '../utils/dashboard.utils';
import { type CustomLlmProfile, type LlmRequestSettings } from '../utils/customLlm';
import type { RenderTextStyle } from '../utils/renderText';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioPipelineSnapshotKey,
  LoadedImage,
  RuntimeExecutionNotice,
} from '../types/dashboard.types';

interface UseAioSingleImageProcessorArgs {
  localApiUrl: string;
  minRegionSize: number;
  renderDefaultStyle: RenderTextStyle;
  applyDetectedGradientToStyle: (...args: any[]) => any;
  isDesktopRuntime: boolean;
  refreshSession: () => Promise<string | null>;
  parseApiError: (response: Response) => Promise<string>;
  getAbortSignal: () => AbortSignal | null;
  onStageStart: (stageKey: AioPipelineSnapshotKey, image: LoadedImage, index: number) => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
}

export interface GpuStagePreferences {
  detectText: boolean;
  recognizeText: boolean;
  segmentText: boolean;
  cleanImage: boolean;
}

interface SingleImageRunConfig {
  sourceLanguage: string;
  targetLanguage: string;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  translationSelectionKey: string;
  segmentSelectionKey: string;
  cleanSelectionKey: string;
  aioSteps: {
    recognizeText: boolean;
    getTranslations: boolean;
    segmentText: boolean;
    cleanImage: boolean;
    render: boolean;
  };
  useCloudOcr: boolean;
  useLlmSettingsForOcr: boolean;
  useLlmSettingsForTranslation: boolean;
  llmSettings: LlmRequestSettings;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  maskDilation: number;
  hdStrategy: string;
  hdResizeLimit: number;
  hdCropMargin: number;
  hdCropTriggerSize: number;
  gpuStages?: GpuStagePreferences;
}

export function useAioSingleImageProcessor({
  localApiUrl,
  minRegionSize,
  renderDefaultStyle,
  applyDetectedGradientToStyle,
  isDesktopRuntime,
  refreshSession,
  parseApiError,
  getAbortSignal,
  onStageStart,
  setRuntimeExecutionNotice,
}: UseAioSingleImageProcessorArgs) {
  const { t } = useI18n();

  return useCallback(async (
    imgData: LoadedImage,
    index: number,
    {
      sourceLanguage,
      targetLanguage,
      detectSelectionKey,
      ocrSelectionKey,
      translationSelectionKey,
      segmentSelectionKey,
      cleanSelectionKey,
      aioSteps,
      useCloudOcr,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
      llmSettings,
      selectedCustomOcrProfile,
      selectedCustomTranslationProfile,
      maskDilation,
      hdStrategy,
      hdResizeLimit,
      hdCropMargin,
      hdCropTriggerSize,
      gpuStages,
    }: SingleImageRunConfig,
  ): Promise<AioBatchImageResult> => {
    const executionNotices: string[] = [];
    const signal = getAbortSignal();

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

    const stageRuntime = { localApiUrl, signal };
    const pushNotice = (notice: StageRunNotice | null): void => {
      if (notice) {
        executionNotices.push(notice.detail);
        setRuntimeExecutionNotice(notice as RuntimeExecutionNotice);
      }
    };

    assertNotAborted();
    onStageStart('detectText', imgData, index);
    const detectRun = await runDetectTextStage(
      {
        image: imgData,
        modelKey: detectSelectionKey,
        sourceLanguage,
        gpu: gpuStages,
        minRegionSize,
        maxAreaRatio: 0.75,
      },
      stageRuntime,
      `Failed to detect text in "${imgData.file.name}"`,
    );
    const detectDone = await finishStageRun(detectRun, {
      stageLabel: 'Detectar Texto',
      failurePrefix: `Failed to detect text in "${imgData.file.name}"`,
      parseApiError,
    });
    pushNotice(detectDone.notice);
    const normalizedDetections = detectDone.value;

    const detectDetections = cloneAioRegions(normalizedDetections, cloneRenderStyle);
    let enrichedDetections = cloneAioRegions(normalizedDetections, cloneRenderStyle);

    if (aioSteps.recognizeText && normalizedDetections.length > 0) {
      assertNotAborted();
      onStageStart('recognizeText', imgData, index);
      const ocrRun = await runRecognizeTextStage(
        {
          image: imgData,
          modelKey: ocrSelectionKey,
          sourceLanguage,
          regions: normalizedDetections,
          gpu: gpuStages,
          useCloudOcr,
          llmSettings: useLlmSettingsForOcr ? llmSettings : null,
          customProfile: useLlmSettingsForOcr ? selectedCustomOcrProfile : null,
        },
        stageRuntime,
        `Failed to recognize text in "${imgData.file.name}"`,
      );
      const ocrDone = await finishStageRun(ocrRun, {
        stageLabel: 'Reconhecer Texto',
        failurePrefix: `Failed to recognize text in "${imgData.file.name}"`,
        parseApiError,
      });
      pushNotice(ocrDone.notice);
      enrichedDetections = ocrDone.value;
    }

    const ocrDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);
    const hasTextForTranslation = enrichedDetections.some((region) => (region.recognizedText ?? '').trim().length > 0);

    if (aioSteps.getTranslations && hasTextForTranslation) {
      assertNotAborted();
      onStageStart('getTranslations', imgData, index);
      const translateRun = await runGetTranslationsStage(
        {
          image: imgData,
          modelKey: translationSelectionKey,
          sourceLanguage,
          targetLanguage,
          regions: enrichedDetections,
          fallbackOcrModelKey: ocrSelectionKey,
          llmSettings: useLlmSettingsForTranslation ? llmSettings : null,
          customProfile: useLlmSettingsForTranslation ? selectedCustomTranslationProfile : null,
          includeImagePayload: useLlmSettingsForTranslation,
        },
        stageRuntime,
        `Failed to translate text in "${imgData.file.name}"`,
      );
      const translateDone = await finishStageRun(translateRun, {
        stageLabel: 'Obter Traduções',
        failurePrefix: `Failed to translate text in "${imgData.file.name}"`,
        parseApiError,
      });
      pushNotice(translateDone.notice);
      enrichedDetections = translateDone.value;
    }

    const translationDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);

    if (aioSteps.segmentText && enrichedDetections.length > 0) {
      assertNotAborted();
      onStageStart('segmentText', imgData, index);
      const segmentRun = await runSegmentTextStage(
        {
          image: imgData,
          modelKey: segmentSelectionKey,
          regions: enrichedDetections,
          fallbackOcrModelKey: ocrSelectionKey,
          fallbackTranslatorModelKey: translationSelectionKey,
          gpu: gpuStages,
        },
        stageRuntime,
        `Failed to segment text in "${imgData.file.name}"`,
      );
      const segmentDone = await finishStageRun(segmentRun, {
        stageLabel: 'Segmentar Texto',
        failurePrefix: `Failed to segment text in "${imgData.file.name}"`,
        parseApiError,
      });
      pushNotice(segmentDone.notice);
      enrichedDetections = segmentDone.value;
    }

    const segmentDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);
    let cleanedDownload: AioDownloadEntry | null = null;

    if (aioSteps.cleanImage) {
      assertNotAborted();
      onStageStart('cleanImage', imgData, index);
      const cleanRun = await runCleanImageStage(
        {
          image: imgData,
          modelKey: cleanSelectionKey,
          regions: enrichedDetections,
          fallbackOcrModelKey: ocrSelectionKey,
          fallbackSegmentModelKey: segmentSelectionKey,
          options: {
            maskDilation,
            hdStrategy,
            hdResizeLimit,
            hdCropMargin,
            hdCropTriggerSize,
          },
          gpu: gpuStages,
        },
        stageRuntime,
        `Failed to clean the image "${imgData.file.name}"`,
      );
      const cleanDone = await finishStageRun(cleanRun, {
        stageLabel: 'Clean Image',
        failurePrefix: `Failed to clean the image "${imgData.file.name}"`,
        parseApiError,
      });
      pushNotice(cleanDone.notice);

      const inpaintBlob = cleanDone.value;
      if (!inpaintBlob.type.startsWith('image/')) {
        throw new Error(t('aioSingleProcessor.invalidCleanResponse', { fileName: imgData.file.name }));
      }

      cleanedDownload = {
        fileName: `koma-studio-aio-clean-${imgData.file.name.replace(/\s+/g, '-')}.png`,
        blob: inpaintBlob,
        sourceImageId: imgData.id,
      };
    }

    const cleanDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);

    if (aioSteps.render) {
      assertNotAborted();
      onStageStart('render', imgData, index);
      enrichedDetections = enrichedDetections.map((region) =>
        applyRenderDefaultsToRegion(region, renderDefaultStyle, applyDetectedGradientToStyle, undefined, targetLanguage));
    }

    return {
      imageId: imgData.id,
      detectDetections,
      ocrDetections,
      translationDetections,
      segmentDetections,
      cleanDetections,
      renderDetections: cloneAioRegions(enrichedDetections, cloneRenderStyle),
      cleanedDownload,
      countAsProcessed: true,
      executionNotices,
    };
  }, [
    applyDetectedGradientToStyle,
    isDesktopRuntime,
    localApiUrl,
    minRegionSize,
    getAbortSignal,
    onStageStart,
    parseApiError,
    refreshSession,
    renderDefaultStyle,
    setRuntimeExecutionNotice,
    t,
  ]);
}
