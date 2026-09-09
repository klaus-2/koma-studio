import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { AIO_STAGE_LABELS } from '../constants/dashboard.constants';
import type { AioStageOption } from '../models/aioStageCatalog';
import {
  TRANSLATION_MODELS_BY_ID,
  modelSupportsLanguage,
} from '../models/translation-models-registry';
import {
  type CustomLlmProfile,
  getCustomLlmRuntimeRestriction,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
} from '../utils/customLlm';

interface ModelManagerEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseTranslatorExecutionResolversArgs {
  translationSelectionKey: string;
  ocrSelectionKey: string;
  srcLang: string;
  tgtLang: string;
  modelEntries: Record<string, ModelManagerEntryLike | undefined>;
  translationStageOptionsForSelect: AioStageOption[];
  translatorOcrStageOptionsForSelect: AioStageOption[];
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  validateManualLocalStageModel: (stageKey: string, stageLabel: string, modelKey: string) => boolean;
}

export function useTranslatorExecutionResolvers({
  translationSelectionKey,
  ocrSelectionKey,
  srcLang,
  tgtLang,
  modelEntries,
  translationStageOptionsForSelect,
  translatorOcrStageOptionsForSelect,
  selectedCustomTranslationProfile,
  selectedCustomOcrProfile,
  validateManualLocalStageModel,
}: UseTranslatorExecutionResolversArgs) {
  const { t } = useI18n();

  const resolveTranslatorTranslationExecution = useCallback(async () => {
    let selectedTranslationKey = translationSelectionKey;

    const selectedLocalModelState = modelEntries[selectedTranslationKey] ?? null;
    const selectedTranslationOption = translationStageOptionsForSelect.find(
      (option) => option.key === selectedTranslationKey,
    ) ?? null;

    if (selectedLocalModelState) {
      const selectedModelInstalled =
        selectedLocalModelState.status === 'installed'
        || selectedLocalModelState.status === 'update_available';
      if (!selectedModelInstalled) {
        throw new Error(t('aioExec.installTranslationModel'));
      }
      const modelDefinition = TRANSLATION_MODELS_BY_ID[selectedLocalModelState.model.id] ?? null;
      if (modelDefinition && !modelSupportsLanguage(modelDefinition, srcLang, tgtLang)) {
        throw new Error(t('translator.localModelIncompatible'));
      }
    } else {
      if (!selectedTranslationOption) {
        throw new Error(t('translator.selectValidTranslationModel'));
      }
      if (!selectedTranslationOption.implemented) {
        throw new Error(t('aioModel.status.inRoadmap', { name: selectedTranslationOption.name }));
      }
      if (!selectedTranslationOption.available) {
        throw new Error(t('aioModel.status.requiresConfig', { name: selectedTranslationOption.name }));
      }
      if (isCustomModelSelectionKey(selectedTranslationKey) && !selectedCustomTranslationProfile) {
        throw new Error(t('translator.selectCustomAiTranslationProfile'));
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

    const useCloudTranslation = isCustomModelSelectionKey(selectedTranslationKey)
      ? !shouldUseLocalDesktopTranslationForCustomProfile(selectedCustomTranslationProfile)
      : isCloudTranslationModelKey(selectedTranslationKey);
    const useLlmSettingsForTranslation = (useCloudTranslation || isCustomModelSelectionKey(selectedTranslationKey)) && hasAnyLlmCapability(
      selectedTranslationOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('translation', selectedTranslationKey),
    );

    return {
      selectedTranslationKey,
      selectedTranslationOption,
      useCloudTranslation,
      useLlmSettingsForTranslation,
    };
  }, [
    modelEntries,
    selectedCustomTranslationProfile,
    srcLang,
    t,
    tgtLang,
    translationSelectionKey,
    translationStageOptionsForSelect,
  ]);

  const resolveTranslatorOcrExecution = useCallback(async () => {
    let selectedOcrKey = ocrSelectionKey;

    const selectedOcrOption = translatorOcrStageOptionsForSelect.find(
      (option) => option.key === selectedOcrKey,
    ) ?? null;

    if (modelEntries[selectedOcrKey]) {
      if (!selectedOcrOption) {
        throw new Error(t('translator.localOcrModelIncompatible'));
      }
      if (!validateManualLocalStageModel('recognizeText', AIO_STAGE_LABELS.recognizeText, selectedOcrKey)) {
        throw new Error(t('translator.installCompatibleOcrModel'));
      }
    } else {
      if (!selectedOcrOption) {
        throw new Error(t('translator.selectValidOcrModel'));
      }
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

    const useCloudOcr = isCloudOcrModelKey(selectedOcrKey);
    const useLlmSettingsForOcr = useCloudOcr && hasAnyLlmCapability(
      selectedOcrOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('ocr', selectedOcrKey),
    );

    return {
      selectedOcrKey,
      selectedOcrOption,
      useCloudOcr,
      useLlmSettingsForOcr,
    };
  }, [
    modelEntries,
    ocrSelectionKey,
    selectedCustomOcrProfile,
    t,
    translatorOcrStageOptionsForSelect,
    validateManualLocalStageModel,
  ]);

  return {
    resolveTranslatorTranslationExecution,
    resolveTranslatorOcrExecution,
  };
}
