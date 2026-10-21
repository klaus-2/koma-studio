import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { AIO_STAGE_LABEL_KEYS } from '../constants/dashboard.constants';
import {
  getAioStageReadiness,
  resolveUpstreamRegions,
  runCleanImageStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
  runSegmentTextStage,
  type StageRegions,
} from '../aio-stages';
import { createAioStageRunSession } from '../pages/dashboard/hooks/aio-stage-runner';
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
    const signal = getAbortSignal();
    // Shared per-image stage mechanics: abort checks, notice plumbing,
    // blob validation, download filename template.
    const session = createAioStageRunSession({
      localApiUrl,
      signal,
      collectNotices: true,
      onRuntimeNotice: setRuntimeExecutionNotice,
    });
    const { stageRuntime, executionNotices } = session;

    session.assertNotAborted();
    onStageStart('detectText', imgData, index);
    const detectDone = await runDetectTextStage(
      {
        image: imgData,
        modelKey: detectSelectionKey,
        sourceLanguage,
        useGpu: gpuStages?.detectText,
        minRegionSize,
        maxAreaRatio: 0.75,
      },
      stageRuntime,
      {
        stageLabel: t(AIO_STAGE_LABEL_KEYS.detectText),
        failurePrefix: `Failed to detect text in "${imgData.file.name}"`,
        parseApiError,
        formatError: (message) =>
          t('aio.singleImage.detectFailed', { fileName: imgData.file.name, message }),
      },
    );
    session.pushNotice(detectDone.notice);
    const normalizedDetections = detectDone.value;
    let stageRegions: StageRegions = {
      detectText: normalizedDetections,
    };

    const detectDetections = cloneAioRegions(normalizedDetections, cloneRenderStyle);
    let enrichedDetections = cloneAioRegions(normalizedDetections, cloneRenderStyle);

    // Provenance verdict gates the stage instead of an inline length check.
    if (aioSteps.recognizeText && getAioStageReadiness('recognizeText', stageRegions).runnable) {
      session.assertNotAborted();
      onStageStart('recognizeText', imgData, index);
      const ocrDone = await runRecognizeTextStage(
        {
          image: imgData,
          modelKey: ocrSelectionKey,
          sourceLanguage,
          regions: normalizedDetections,
          useGpu: gpuStages?.recognizeText,
          useCloudOcr,
          llmSettings: useLlmSettingsForOcr ? llmSettings : null,
          customProfile: useLlmSettingsForOcr ? selectedCustomOcrProfile : null,
        },
        stageRuntime,
        {
          stageLabel: t(AIO_STAGE_LABEL_KEYS.recognizeText),
          failurePrefix: `Failed to recognize text in "${imgData.file.name}"`,
          parseApiError,
          formatError: (message) =>
            t('aio.singleImage.recognizeFailed', { fileName: imgData.file.name, message }),
        },
      );
      session.pushNotice(ocrDone.notice);
      enrichedDetections = ocrDone.value;
      stageRegions = { ...stageRegions, recognizeText: enrichedDetections };
    }

    const ocrDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);

    if (aioSteps.getTranslations && getAioStageReadiness('getTranslations', stageRegions).runnable) {
      session.assertNotAborted();
      onStageStart('getTranslations', imgData, index);
      const translationSourceRegions = resolveUpstreamRegions(
        'getTranslations',
        stageRegions,
      );
      const translateDone = await runGetTranslationsStage(
        {
          image: imgData,
          modelKey: translationSelectionKey,
          sourceLanguage,
          targetLanguage,
          regions: translationSourceRegions,
          fallbackOcrModelKey: ocrSelectionKey,
          llmSettings: useLlmSettingsForTranslation ? llmSettings : null,
          customProfile: useLlmSettingsForTranslation ? selectedCustomTranslationProfile : null,
        },
        stageRuntime,
        {
          stageLabel: t(AIO_STAGE_LABEL_KEYS.getTranslations),
          failurePrefix: `Failed to translate text in "${imgData.file.name}"`,
          parseApiError,
          formatError: (message) =>
            t('aio.singleImage.translateFailed', { fileName: imgData.file.name, message }),
        },
      );
      session.pushNotice(translateDone.notice);
      enrichedDetections = translateDone.value;
      stageRegions = { ...stageRegions, getTranslations: enrichedDetections };
    }

    const translationDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);

    if (aioSteps.segmentText && getAioStageReadiness('segmentText', stageRegions).runnable) {
      session.assertNotAborted();
      onStageStart('segmentText', imgData, index);
      const segmentSourceRegions = resolveUpstreamRegions(
        'segmentText',
        stageRegions,
      );
      const segmentDone = await runSegmentTextStage(
        {
          image: imgData,
          modelKey: segmentSelectionKey,
          regions: segmentSourceRegions,
          fallbackOcrModelKey: ocrSelectionKey,
          fallbackTranslatorModelKey: translationSelectionKey,
          useGpu: gpuStages?.segmentText,
        },
        stageRuntime,
        {
          stageLabel: t(AIO_STAGE_LABEL_KEYS.segmentText),
          failurePrefix: `Failed to segment text in "${imgData.file.name}"`,
          parseApiError,
          formatError: (message) =>
            t('aio.singleImage.segmentFailed', { fileName: imgData.file.name, message }),
        },
      );
      session.pushNotice(segmentDone.notice);
      enrichedDetections = segmentDone.value;
      stageRegions = { ...stageRegions, segmentText: enrichedDetections };
    }

    const segmentDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);
    let cleanedDownload: AioDownloadEntry | null = null;

    if (aioSteps.cleanImage) {
      session.assertNotAborted();
      onStageStart('cleanImage', imgData, index);
      const cleanSourceRegions = resolveUpstreamRegions(
        'cleanImage',
        stageRegions,
      );
      const cleanDone = await runCleanImageStage(
        {
          image: imgData,
          modelKey: cleanSelectionKey,
          regions: cleanSourceRegions,
          fallbackOcrModelKey: ocrSelectionKey,
          fallbackSegmentModelKey: segmentSelectionKey,
          options: {
            maskDilation,
            hdStrategy,
            hdResizeLimit,
            hdCropMargin,
            hdCropTriggerSize,
          },
          useGpu: gpuStages?.cleanImage,
        },
        stageRuntime,
        {
          stageLabel: t(AIO_STAGE_LABEL_KEYS.cleanImage),
          failurePrefix: `Failed to clean the image "${imgData.file.name}"`,
          parseApiError,
          formatError: (message) =>
            t('aio.singleImage.cleanFailed', { fileName: imgData.file.name, message }),
        },
      );
      session.pushNotice(cleanDone.notice);

      const inpaintBlob = session.ensureStageImageBlob(
        cleanDone.value,
        t('aioSingleProcessor.invalidCleanResponse', { fileName: imgData.file.name }),
      );

      cleanedDownload = {
        fileName: session.buildCleanDownloadName('koma-studio-aio-clean', imgData.file.name),
        blob: inpaintBlob,
        sourceImageId: imgData.id,
      };
      stageRegions = { ...stageRegions, cleanImage: cleanSourceRegions };
    }

    const cleanDetections = cloneAioRegions(
      resolveUpstreamRegions('cleanImage', stageRegions),
      cloneRenderStyle,
    );

    if (aioSteps.render) {
      session.assertNotAborted();
      onStageStart('render', imgData, index);
      const renderSourceRegions = resolveUpstreamRegions(
        'render',
        stageRegions,
      );
      enrichedDetections = renderSourceRegions.map((region) =>
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
