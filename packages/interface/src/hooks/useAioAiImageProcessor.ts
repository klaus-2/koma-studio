import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { AIO_STAGE_LABEL_KEYS } from '../constants/dashboard.constants';
import {
  runAioAiStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
  type AioAiGlossaryPayload,
  type AioAiRegionGuidancePayload,
  type StageRegions,
} from '../aio-stages';
import { createAioStageRunSession } from '../pages/dashboard/hooks/aio-stage-runner';
import { resolveWorkGlossarySettings } from '../pages/dashboard/hooks/translator.execution';
import { resolveRegionRenderShape } from '../utils/dashboard.region.utils';
import { materializePageForProcessing, releasePage } from '../utils/page-source';
import type {
  CustomLlmProfile,
  CustomLlmRequestProfile,
  LlmRequestSettings,
} from '../utils/customLlm';
import type {
  AioAiOptions,
  ImageEditModelConfig,
} from '../utils/imageEditModelConfig';
import type {
  AioDownloadEntry,
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  RuntimeExecutionNotice,
} from '../types/dashboard.types';

export interface UseAioAiImageProcessorArgs {
  localApiUrl: string;
  minRegionSize: number;
  parseApiError: (response: Response) => Promise<string>;
  getAbortSignal: () => AbortSignal | null;
  onStageStart: (
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
  ) => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
}

export interface SingleAioAiRunConfig {
  sourceLanguage: string;
  targetLanguage: string;
  modelKey: string;
  customProfile: CustomLlmRequestProfile | null;
  options: AioAiOptions;
  modelConfig: ImageEditModelConfig;
  additionalInstructions: string;
  llmSettings: LlmRequestSettings;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  translationSelectionKey: string;
  useCloudOcr: boolean;
  useLlmSettingsForOcr: boolean;
  useLlmSettingsForTranslation: boolean;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  gpuStages?: {
    detectText: boolean;
    recognizeText: boolean;
  };
  previousPageContext?: string;
}

export interface AioAiImageResult {
  imageId: string;
  download: AioDownloadEntry;
  modelUsed: string | null;
  segments: number;
  skipped: boolean;
  nextPageContext: string;
  executionNotices: string[];
}

const buildRegionGuidance = (
  regions: ReadonlyArray<AioTextRegion>,
): AioAiRegionGuidancePayload[] =>
  regions.map((region) => {
    const refined = resolveRegionRenderShape(region);
    return {
      id: region.id,
      bbox: [region.bbox[0], region.bbox[1], region.bbox[2], region.bbox[3]],
      shape_kind: refined?.kind ?? region.shape?.kind ?? null,
      inner_box: refined?.innerBox ?? region.shape?.innerBox ?? null,
      detected_render_mode: region.detectedRenderMode ?? region.renderMode ?? null,
      structural_type: region.structuralType ?? null,
      source_text: region.recognizedText ?? null,
      translated_text: region.translatedText ?? null,
      foreground_rgb: region.detectedForegroundRgb
        ? [
            region.detectedForegroundRgb[0],
            region.detectedForegroundRgb[1],
            region.detectedForegroundRgb[2],
          ]
        : null,
    };
  });

const buildPageContextSnippet = (
  regions: ReadonlyArray<AioTextRegion>,
  fallbackContext: string,
): string => {
  const snippets = regions
    .map((region) => (region.translatedText ?? region.recognizedText ?? '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);
  if (snippets.length === 0) {
    return fallbackContext;
  }
  return snippets.join(' | ').slice(0, 320);
};

export function useAioAiImageProcessor({
  localApiUrl,
  minRegionSize,
  parseApiError,
  getAbortSignal,
  onStageStart,
  setRuntimeExecutionNotice,
}: UseAioAiImageProcessorArgs) {
  const { t } = useI18n();

  return useCallback(
    async (
      imgData: LoadedImage,
      index: number,
      config: SingleAioAiRunConfig,
    ): Promise<AioAiImageResult> => {
      const signal = getAbortSignal();
      const session = createAioStageRunSession({
        localApiUrl,
        signal,
        collectNotices: true,
        onRuntimeNotice: setRuntimeExecutionNotice,
      });
      const { stageRuntime, executionNotices } = session;

      const imageLlmSettings = resolveWorkGlossarySettings(
        imgData,
        config.llmSettings,
      );
      const glossary: AioAiGlossaryPayload[] = (imageLlmSettings.glossary ?? []).map(
        (term) => ({
          source: term.source,
          target: term.target,
          never_translate: term.never_translate === true,
        }),
      );

      try {
        const stageImage = await materializePageForProcessing(imgData);
        let guidanceRegions: AioTextRegion[] = [];

        if (config.options.executionMode !== 'direct') {
          session.assertNotAborted();
          onStageStart('detectText', imgData, index);
          const detectDone = await runDetectTextStage(
            {
              image: stageImage,
              modelKey: config.detectSelectionKey,
              sourceLanguage: config.sourceLanguage,
              useGpu: config.gpuStages?.detectText,
              minRegionSize,
              maxAreaRatio: 0.75,
            },
            stageRuntime,
            {
              stageLabel: t(AIO_STAGE_LABEL_KEYS.detectText),
              failurePrefix: `Failed to detect text in "${imgData.file.name}"`,
              parseApiError,
              formatError: (message) =>
                t('aio.singleImage.detectFailed', {
                  fileName: imgData.file.name,
                  message,
                }),
            },
          );
          session.pushNotice(detectDone.notice);
          guidanceRegions = [...detectDone.value];

          if (guidanceRegions.length === 0 && config.options.skipEmptyPages) {
            return {
              imageId: imgData.id,
              download: {
                fileName: session.buildCleanDownloadName(
                  'koma-studio-aio-ai',
                  imgData.file.name,
                ),
                blob: stageImage.file,
                sourceImageId: imgData.id,
              },
              modelUsed: config.customProfile?.model ?? config.modelKey,
              segments: 1,
              skipped: true,
              nextPageContext: config.previousPageContext ?? '',
              executionNotices,
            };
          }

          if (config.options.executionMode === 'script_guided') {
            let stageRegions: StageRegions = {
              detectText: guidanceRegions,
            };

            session.assertNotAborted();
            onStageStart('recognizeText', imgData, index);
            const ocrDone = await runRecognizeTextStage(
              {
                image: stageImage,
                modelKey: config.ocrSelectionKey,
                sourceLanguage: config.sourceLanguage,
                regions: guidanceRegions,
                useGpu: config.gpuStages?.recognizeText,
                useCloudOcr: config.useCloudOcr,
                llmSettings: config.useLlmSettingsForOcr
                  ? imageLlmSettings
                  : null,
                customProfile: config.useLlmSettingsForOcr
                  ? config.selectedCustomOcrProfile
                  : null,
              },
              stageRuntime,
              {
                stageLabel: t(AIO_STAGE_LABEL_KEYS.recognizeText),
                failurePrefix: `Failed to recognize text in "${imgData.file.name}"`,
                parseApiError,
                formatError: (message) =>
                  t('aio.singleImage.recognizeFailed', {
                    fileName: imgData.file.name,
                    message,
                  }),
              },
            );
            session.pushNotice(ocrDone.notice);
            guidanceRegions = ocrDone.value;
            stageRegions = { ...stageRegions, recognizeText: guidanceRegions };

            session.assertNotAborted();
            onStageStart('getTranslations', imgData, index);
            const translateDone = await runGetTranslationsStage(
              {
                image: stageImage,
                modelKey: config.translationSelectionKey,
                sourceLanguage: config.sourceLanguage,
                targetLanguage: config.targetLanguage,
                regions: guidanceRegions,
                fallbackOcrModelKey: config.ocrSelectionKey,
                llmSettings: config.useLlmSettingsForTranslation
                  ? imageLlmSettings
                  : null,
                customProfile: config.useLlmSettingsForTranslation
                  ? config.selectedCustomTranslationProfile
                  : null,
              },
              stageRuntime,
              {
                stageLabel: t(AIO_STAGE_LABEL_KEYS.getTranslations),
                failurePrefix: `Failed to translate text in "${imgData.file.name}"`,
                parseApiError,
                formatError: (message) =>
                  t('aio.singleImage.translateFailed', {
                    fileName: imgData.file.name,
                    message,
                  }),
              },
            );
            session.pushNotice(translateDone.notice);
            guidanceRegions = translateDone.value;
            void stageRegions;
          }
        }

        session.assertNotAborted();
        onStageStart('render', imgData, index);
        const aioAiDone = await runAioAiStage(
          {
            image: stageImage,
            modelKey: config.modelKey,
            sourceLanguage: config.sourceLanguage,
            targetLanguage: config.targetLanguage,
            options: config.options,
            modelConfig: config.modelConfig,
            regions: buildRegionGuidance(guidanceRegions),
            additionalInstructions: config.additionalInstructions.trim(),
            customProfile: config.customProfile,
            glossary,
            previousPageContext: config.previousPageContext,
          },
          stageRuntime,
          {
            stageLabel: 'AIO AI',
            failurePrefix: `AIO AI failed for "${imgData.file.name}"`,
            parseApiError,
          },
        );
        session.pushNotice(aioAiDone.notice);

        const validatedBlob = session.ensureStageImageBlob(
          aioAiDone.value.blob,
          t('aioSingleProcessor.invalidCleanResponse', {
            fileName: imgData.file.name,
          }),
        );

        return {
          imageId: imgData.id,
          download: {
            fileName: session.buildCleanDownloadName(
              'koma-studio-aio-ai',
              imgData.file.name,
            ),
            blob: validatedBlob,
            sourceImageId: imgData.id,
          },
          modelUsed: aioAiDone.value.modelUsed,
          segments: aioAiDone.value.segments,
          skipped: aioAiDone.value.skipped,
          nextPageContext: buildPageContextSnippet(
            guidanceRegions,
            config.previousPageContext ?? '',
          ),
          executionNotices,
        };
      } finally {
        releasePage(imgData);
      }
    },
    [
      getAbortSignal,
      localApiUrl,
      minRegionSize,
      onStageStart,
      parseApiError,
      setRuntimeExecutionNotice,
      t,
    ],
  );
}
