import { useCallback } from 'react';

import { useI18n } from '../i18n';
import {
  applyStageReadinessRefusal,
  resolveStageModelReadiness,
} from '../aio-stages';
import type { AioStageKey } from '../types/aioModelPresets';
import type { AioStageOption } from '../models/aioStageCatalog';
import type { CustomLlmProfile } from '../utils/customLlm';

interface ModelEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseAioExecutionPreparationArgs {
  imagesCount: number;
  aioSteps: Record<string, boolean>;
  aioSrcLang: string;
  aioTgtLang: string;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  translationSelectionKey: string;
  segmentSelectionKey: string;
  cleanSelectionKey: string;
  effectiveBatchConcurrency: number;
  modelEntries: Record<string, ModelEntryLike | undefined>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  getAioStageOption: (stageKey: 'recognizeText' | 'getTranslations', key: string) => AioStageOption | null;
  openModelManagerForStage: (stage: AioStageKey, options?: Record<string, unknown>) => void;
  refreshSession: () => Promise<string | null>;
  getAuthToken: () => string | null;
  invalidateAioPipelineHistory: () => void;
  setAioManualImageEditsByImage: (value: Record<string, never>) => void;
  setAioManualHealingBusyByImage: (value: Record<string, never>) => void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (value: string) => void;
  emitProcessStartWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
}

export function useAioExecutionPreparation({
  imagesCount,
  aioSteps,
  aioSrcLang,
  aioTgtLang,
  detectSelectionKey,
  ocrSelectionKey,
  translationSelectionKey,
  segmentSelectionKey,
  cleanSelectionKey,
  effectiveBatchConcurrency,
  modelEntries,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  getAioStageOption,
  openModelManagerForStage,
  refreshSession,
  getAuthToken,
  invalidateAioPipelineHistory,
  setAioManualImageEditsByImage,
  setAioManualHealingBusyByImage,
  setProcessing,
  setProgress,
  setStatusMessage,
  emitProcessStartWebhook,
}: UseAioExecutionPreparationArgs) {
  const { t } = useI18n();

  return useCallback(async () => {
    if (imagesCount === 0) return null;
    if (!aioSteps.detectText) {
      setStatusMessage('Enable the "Detect Text" stage to run the AIO pipeline.');
      return null;
    }

    const selectedDetectorKey = detectSelectionKey;
    const selectedOcrKey = ocrSelectionKey;
    const selectedTranslationKey = translationSelectionKey;
    const selectedSegmentKey = segmentSelectionKey;
    const selectedCleanKey = cleanSelectionKey;

    const selectedOcrOption = getAioStageOption('recognizeText', selectedOcrKey);
    const selectedTranslationOption = getAioStageOption('getTranslations', selectedTranslationKey);

    const readinessSink = { setStatusMessage, openModelManagerForStage };

    const detectReadiness = resolveStageModelReadiness({
      stage: 'detectText',
      stageLabel: 'Detectar Texto',
      modelKey: selectedDetectorKey,
      modelEntries,
      messages: {
        invalidSelection: t('aioManual.selectValidDetectModel'),
        selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
        requiresApiKey: t('aioExec.ocrRequiresApiKey'),
      },
      t,
    });
    if (!detectReadiness.ok) {
      applyStageReadinessRefusal(detectReadiness, readinessSink);
      return null;
    }

    let useCloudOcr = false;
    let useLlmSettingsForOcr = false;
    if (aioSteps.recognizeText) {
      const ocrReadiness = resolveStageModelReadiness({
        stage: 'recognizeText',
        stageLabel: 'Reconhecer Texto',
        modelKey: selectedOcrKey,
        option: selectedOcrOption,
        modelEntries,
        customProfile: selectedCustomOcrProfile,
        messages: {
          invalidSelection: t('aioExec.selectValidOcrModel'),
          selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
          requiresApiKey: t('aioExec.ocrRequiresApiKey'),
        },
        t,
      });
      if (!ocrReadiness.ok) {
        applyStageReadinessRefusal(ocrReadiness, readinessSink);
        return null;
      }
      useCloudOcr = ocrReadiness.useCloud;
      useLlmSettingsForOcr = ocrReadiness.useLlmSettings;
    }

    if (aioSteps.segmentText) {
      const segmentReadiness = resolveStageModelReadiness({
        stage: 'segmentText',
        stageLabel: 'Segmentar Texto',
        modelKey: selectedSegmentKey,
        modelEntries,
        messages: {
          invalidSelection: t('aioManual.selectValidSegmentModel'),
          selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
          requiresApiKey: t('aioExec.ocrRequiresApiKey'),
        },
        t,
      });
      if (!segmentReadiness.ok) {
        applyStageReadinessRefusal(segmentReadiness, readinessSink);
        return null;
      }
    }
    if (aioSteps.cleanImage) {
      const cleanReadiness = resolveStageModelReadiness({
        stage: 'cleanImage',
        stageLabel: 'Clean Image',
        modelKey: selectedCleanKey,
        modelEntries,
        messages: {
          invalidSelection: t('aioManual.selectValidCleanModel'),
          selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
          requiresApiKey: t('aioExec.ocrRequiresApiKey'),
        },
        t,
      });
      if (!cleanReadiness.ok) {
        applyStageReadinessRefusal(cleanReadiness, readinessSink);
        return null;
      }
    }

    let useCloudTranslation = false;
    let useLlmSettingsForTranslation = false;
    if (aioSteps.getTranslations) {
      const translationReadiness = resolveStageModelReadiness({
        stage: 'getTranslations',
        stageLabel: 'Obter Traduções',
        modelKey: selectedTranslationKey,
        option: selectedTranslationOption,
        modelEntries,
        customProfile: selectedCustomTranslationProfile,
        languages: { source: aioSrcLang, target: aioTgtLang },
        messages: {
          invalidSelection: t('aioExec.selectValidTranslation'),
          selectCustomProfile: t('aioExec.selectCustomAiProfile'),
          requiresApiKey: t('aioExec.translationRequiresApiKey'),
        },
        t,
      });
      if (!translationReadiness.ok) {
        applyStageReadinessRefusal(translationReadiness, readinessSink);
        return null;
      }
      useCloudTranslation = translationReadiness.useCloud;
      useLlmSettingsForTranslation = translationReadiness.useLlmSettings;
    }

    const useLocalBatchPipeline = !(useCloudOcr || useCloudTranslation);

    if (useCloudOcr || useCloudTranslation) {
      const sessionToken = (await refreshSession()) ?? getAuthToken();
      if (!sessionToken) {
        setStatusMessage(t('aioExec.sessionUnavailable'));
        return null;
      }
    }

    invalidateAioPipelineHistory();
    setAioManualImageEditsByImage({});
    setAioManualHealingBusyByImage({});
    setProcessing(true);
    setProgress(0);
    const runningStages = ['detecting text'];
    if (aioSteps.recognizeText) runningStages.push('recognizing text');
    if (aioSteps.getTranslations) runningStages.push('translating text');
    if (aioSteps.segmentText) runningStages.push('segmenting text');
    if (aioSteps.cleanImage) runningStages.push('cleaning image');
    if (aioSteps.render) runningStages.push('preparing render');
    setStatusMessage(
      effectiveBatchConcurrency > 1
        ? `AIO: ${runningStages.join(', ')} on the images with ${effectiveBatchConcurrency} threads...`
        : `AIO: ${runningStages.join(', ')} on the images...`,
    );
    emitProcessStartWebhook('AIO', imagesCount, {
      etapas: runningStages.join(', '),
      threads: effectiveBatchConcurrency,
      estrategia: useLocalBatchPipeline ? 'local-batch' : 'cloud-fallback',
    });

    return {
      selectedDetectorKey,
      selectedOcrKey,
      selectedTranslationKey,
      selectedSegmentKey,
      selectedCleanKey,
      selectedOcrOption,
      selectedTranslationOption,
      useCloudOcr,
      useCloudTranslation,
      useLocalBatchPipeline,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
      runningStages,
    };
  }, [
    aioSrcLang,
    aioTgtLang,
    aioSteps,
    cleanSelectionKey,
    detectSelectionKey,
    effectiveBatchConcurrency,
    emitProcessStartWebhook,
    getAioStageOption,
    getAuthToken,
    imagesCount,
    invalidateAioPipelineHistory,
    modelEntries,
    ocrSelectionKey,
    openModelManagerForStage,
    refreshSession,
    segmentSelectionKey,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    setAioManualHealingBusyByImage,
    setAioManualImageEditsByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    t,
    translationSelectionKey,
  ]);
}
