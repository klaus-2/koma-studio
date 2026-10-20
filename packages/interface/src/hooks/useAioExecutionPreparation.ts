import { useCallback } from 'react';

import { useI18n } from '../i18n';
import {
  resolveGetTranslationsReadiness,
  resolveLocalStageModelReadiness,
  resolveRecognizeTextReadiness,
  type EnsureLocalModelReady,
  type StageReadiness,
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
  resolveLocalModelFocusForStage: (stage: Exclude<AioStageKey, 'getTranslations'>, key: string) => string | null;
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
  resolveLocalModelFocusForStage,
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

    const ensureLocalModelReady: EnsureLocalModelReady = (
      stage,
      stageLabel,
      selectedKey,
    ) => {
      const localEntry = modelEntries[selectedKey];
      if (!localEntry) {
        setStatusMessage(t('aioExec.selectAndInstallStage', { stageLabel }));
        const focusedModelId = resolveLocalModelFocusForStage(
          stage,
          selectedKey,
        );
        openModelManagerForStage(stage, { focusedModelId });
        return false;
      }
      const installed =
        localEntry.status === 'installed'
        || localEntry.status === 'update_available';
      if (!installed) {
        setStatusMessage(
          t('aioExec.installBeforeStage', {
            name: localEntry.model.name,
            stageLabel,
          }),
        );
        openModelManagerForStage(stage, {
          focusedModelId: localEntry.model.id,
        });
        return false;
      }
      return true;
    };

    const applyReadinessRefusal = (
      readiness: Extract<StageReadiness, { ok: false }>,
    ): void => {
      if (readiness.kind === 'local_not_ready') {
        return;
      }
      setStatusMessage(readiness.message);
    };

    const detectReadiness = resolveLocalStageModelReadiness({
      stage: 'detectText',
      stageLabel: 'Detectar Texto',
      modelKey: selectedDetectorKey,
      ensureLocalModelReady,
      invalidSelection: t('aioManual.selectValidDetectModel'),
    });
    if (!detectReadiness.ok) {
      applyReadinessRefusal(detectReadiness);
      return null;
    }

    let useCloudOcr = false;
    let useLlmSettingsForOcr = false;
    if (aioSteps.recognizeText) {
      const ocrReadiness = resolveRecognizeTextReadiness({
        modelKey: selectedOcrKey,
        stageLabel: 'Reconhecer Texto',
        options: [selectedOcrOption].filter(
          (option): option is AioStageOption => option !== null,
        ),
        modelEntries,
        customProfile: selectedCustomOcrProfile,
        ensureLocalModelReady,
        messages: {
          invalidSelection: t('aioExec.selectValidOcrModel'),
          selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
          requiresApiKey: t('aioExec.ocrRequiresApiKey'),
        },
        t,
      });
      if (!ocrReadiness.ok) {
        applyReadinessRefusal(ocrReadiness);
        return null;
      }
      useCloudOcr = ocrReadiness.useCloud;
      useLlmSettingsForOcr = ocrReadiness.useLlmSettings;
    }

    if (aioSteps.segmentText) {
      const segmentReadiness = resolveLocalStageModelReadiness({
        stage: 'segmentText',
        stageLabel: 'Segmentar Texto',
        modelKey: selectedSegmentKey,
        ensureLocalModelReady,
        invalidSelection: t('aioManual.selectValidSegmentModel'),
      });
      if (!segmentReadiness.ok) {
        applyReadinessRefusal(segmentReadiness);
        return null;
      }
    }
    if (aioSteps.cleanImage) {
      const cleanReadiness = resolveLocalStageModelReadiness({
        stage: 'cleanImage',
        stageLabel: 'Clean Image',
        modelKey: selectedCleanKey,
        ensureLocalModelReady,
        invalidSelection: t('aioManual.selectValidCleanModel'),
      });
      if (!cleanReadiness.ok) {
        applyReadinessRefusal(cleanReadiness);
        return null;
      }
    }

    let useCloudTranslation = false;
    let useLlmSettingsForTranslation = false;
    if (aioSteps.getTranslations) {
      const translationReadiness = resolveGetTranslationsReadiness({
        modelKey: selectedTranslationKey,
        options: [selectedTranslationOption].filter(
          (option): option is AioStageOption => option !== null,
        ),
        modelEntries,
        customProfile: selectedCustomTranslationProfile,
        sourceLanguage: aioSrcLang,
        targetLanguage: aioTgtLang,
        messages: {
          invalidSelection: t('aioExec.selectValidTranslation'),
          selectCustomProfile: t('aioExec.selectCustomAiProfile'),
          requiresApiKey: t('aioExec.translationRequiresApiKey'),
          installTranslationModel: t('aioExec.installTranslationModel'),
          incompatibleLanguage: t('aioExec.translationModelIncompatible', {
            modelName: modelEntries[selectedTranslationKey]?.model.name
              ?? selectedTranslationKey,
          }),
        },
        t,
      });
      if (!translationReadiness.ok) {
        if (translationReadiness.kind === 'install_translation_model') {
          setStatusMessage(t('aioExec.installTranslationModel'));
          openModelManagerForStage('getTranslations', {
            language: aioSrcLang,
            focusedModelId: selectedTranslationKey || null,
          });
          return null;
        }
        if (translationReadiness.kind === 'incompatible_language') {
          setStatusMessage(
            t('aioExec.translationModelIncompatible', {
              modelName:
                translationReadiness.name
                ?? modelEntries[selectedTranslationKey]?.model.name
                ?? selectedTranslationKey,
            }),
          );
          return null;
        }
        applyReadinessRefusal(translationReadiness);
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
    resolveLocalModelFocusForStage,
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
