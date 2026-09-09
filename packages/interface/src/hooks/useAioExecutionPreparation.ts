import { useCallback } from 'react';

import { useI18n } from '../i18n';
import type { AioStageKey } from '../types/aioModelPresets';
import type { AioStageOption } from '../models/aioStageCatalog';
import {
  type CustomLlmProfile,
  inferLlmCapabilitiesForModelSelection,
  hasAnyLlmCapability,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
  getCustomLlmRuntimeRestriction,
} from '../utils/customLlm';

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
  detectSelectionKey: string;
  ocrSelectionKey: string;
  translationSelectionKey: string;
  segmentSelectionKey: string;
  cleanSelectionKey: string;
  effectiveBatchConcurrency: number;
  modelEntries: Record<string, ModelEntryLike | undefined>;
  compatibleTranslationModelIds: Set<string>;
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
  detectSelectionKey,
  ocrSelectionKey,
  translationSelectionKey,
  segmentSelectionKey,
  cleanSelectionKey,
  effectiveBatchConcurrency,
  modelEntries,
  compatibleTranslationModelIds,
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

    let selectedDetectorKey = detectSelectionKey;
    let selectedOcrKey = ocrSelectionKey;
    let selectedTranslationKey = translationSelectionKey;
    const selectedSegmentKey = segmentSelectionKey;
    const selectedCleanKey = cleanSelectionKey;

    const selectedOcrOption = getAioStageOption('recognizeText', selectedOcrKey);
    const selectedTranslationOption = getAioStageOption('getTranslations', selectedTranslationKey);
    const useCloudOcr = aioSteps.recognizeText && isCloudOcrModelKey(selectedOcrKey);
    const useCloudTranslation = aioSteps.getTranslations && (
      isCustomModelSelectionKey(selectedTranslationKey)
        ? !shouldUseLocalDesktopTranslationForCustomProfile(selectedCustomTranslationProfile)
        : isCloudTranslationModelKey(selectedTranslationKey)
    );
    const useLocalBatchPipeline = !(useCloudOcr || useCloudTranslation);
    const useLlmSettingsForOcr = useCloudOcr && hasAnyLlmCapability(
      selectedOcrOption?.llm_capabilities ?? inferLlmCapabilitiesForModelSelection('ocr', selectedOcrKey),
    );
    const useLlmSettingsForTranslation = (useCloudTranslation || isCustomModelSelectionKey(selectedTranslationKey)) && hasAnyLlmCapability(
      selectedTranslationOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('translation', selectedTranslationKey),
    );

    const validateLocalStageModel = (
      stage: AioStageKey,
      stageLabel: string,
      selectedKey: string,
      enabled: boolean,
    ): boolean => {
      if (!enabled) return true;
      const localEntry = modelEntries[selectedKey];
      if (!localEntry) {
        setStatusMessage(t('aioExec.selectAndInstallStage', { stageLabel }));
        const focusedModelId = resolveLocalModelFocusForStage(stage as Exclude<AioStageKey, 'getTranslations'>, selectedKey);
        openModelManagerForStage(stage, { focusedModelId });
        return false;
      }
      const installed = localEntry.status === 'installed' || localEntry.status === 'update_available';
      if (!installed) {
        setStatusMessage(t('aioExec.installBeforeStage', { name: localEntry.model.name, stageLabel }));
        openModelManagerForStage(stage, { focusedModelId: localEntry.model.id });
        return false;
      }
      return true;
    };

    if (!validateLocalStageModel('detectText', 'Detectar Texto', selectedDetectorKey, true)) {
      return null;
    }

    if (aioSteps.recognizeText) {
      if (modelEntries[selectedOcrKey]) {
        if (!validateLocalStageModel('recognizeText', 'Reconhecer Texto', selectedOcrKey, true)) {
          return null;
        }
      } else {
        if (!selectedOcrOption) {
          setStatusMessage(t('aioExec.selectValidOcrModel'));
          return null;
        }
        if (!selectedOcrOption.implemented) {
          setStatusMessage(t('aioModel.status.inRoadmap', { name: selectedOcrOption.name }));
          return null;
        }
        if (!selectedOcrOption.available) {
          setStatusMessage(t('aioModel.status.requiresConfig', { name: selectedOcrOption.name }));
          return null;
        }
        if (isCustomModelSelectionKey(selectedOcrKey) && !selectedCustomOcrProfile) {
          setStatusMessage(t('aioExec.selectCustomOcrProfile'));
          return null;
        }
        if (
          isCustomModelSelectionKey(selectedOcrKey)
          && selectedCustomOcrProfile
          && requiresCustomLlmApiKey(selectedCustomOcrProfile.apiBase)
          && !selectedCustomOcrProfile.apiKey.trim()
        ) {
          setStatusMessage(t('aioExec.ocrRequiresApiKey'));
          return null;
        }
      }
    }

    if (!validateLocalStageModel('segmentText', 'Segmentar Texto', selectedSegmentKey, Boolean(aioSteps.segmentText))) {
      return null;
    }
    if (!validateLocalStageModel('cleanImage', 'Clean Image', selectedCleanKey, Boolean(aioSteps.cleanImage))) {
      return null;
    }

    if (aioSteps.getTranslations) {
      const selectedLocalModelState = modelEntries[selectedTranslationKey];
      if (selectedLocalModelState) {
        const selectedModelInstalled =
          selectedLocalModelState.status === 'installed'
          || selectedLocalModelState.status === 'update_available';
        if (!selectedModelInstalled) {
          setStatusMessage(t('aioExec.installTranslationModel'));
          openModelManagerForStage('getTranslations', { language: aioSrcLang, focusedModelId: selectedTranslationKey || null });
          return null;
        }
        if (!compatibleTranslationModelIds.has(selectedLocalModelState.model.id)) {
          setStatusMessage(t('aioExec.translationModelIncompatible', { modelName: selectedLocalModelState.model.name }));
          return null;
        }
      } else {
        if (!selectedTranslationOption) {
          setStatusMessage(t('aioExec.selectValidTranslation'));
          return null;
        }
        if (!selectedTranslationOption.implemented) {
          setStatusMessage(t('aioModel.status.inRoadmap', { name: selectedTranslationOption.name }));
          return null;
        }
        if (!selectedTranslationOption.available) {
          setStatusMessage(t('aioModel.status.requiresConfig', { name: selectedTranslationOption.name }));
          return null;
        }
        if (isCustomModelSelectionKey(selectedTranslationKey) && !selectedCustomTranslationProfile) {
          setStatusMessage(t('aioExec.selectCustomAiProfile'));
          return null;
        }
        if (
          isCustomModelSelectionKey(selectedTranslationKey)
          && selectedCustomTranslationProfile
          && requiresCustomLlmApiKey(selectedCustomTranslationProfile.apiBase)
          && !selectedCustomTranslationProfile.apiKey.trim()
        ) {
          setStatusMessage(t('aioExec.translationRequiresApiKey'));
          return null;
        }
        if (isCustomModelSelectionKey(selectedTranslationKey) && selectedCustomTranslationProfile) {
          const runtimeRestriction = getCustomLlmRuntimeRestriction(selectedCustomTranslationProfile.apiBase);
          if (runtimeRestriction) {
            setStatusMessage(runtimeRestriction);
            return null;
          }
        }
      }
    }

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
    aioSteps,
    cleanSelectionKey,
    compatibleTranslationModelIds,
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
