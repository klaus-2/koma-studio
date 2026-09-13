/**
 * Translator SFX/OCR options — stage option lists for the visual translator,
 * SFX clean model selection and translation-model compatibility
 * (translator + aio store reads; llm profile data, the cleaner option list and
 * the aio selectable callback arrive by args). Split out of translator.ts
 * (T10); the entry file keeps the visual batch run and re-exports this module.
 */
import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import {
  buildCustomStageOption,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
  type AioStageOption,
} from '../../../models/aioStageCatalog';
import type { ModelInstallState } from '../../../models/types';
import {
  TRANSLATION_MODELS_BY_ID,
  modelSupportsLanguage,
} from '../../../models/translation-models-registry';
import {
  findCustomProfileForSelection,
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';

/* ── Translator SFX/OCR options: stage option lists for the visual translator,
   SFX clean model selection and translation-model compatibility
   (translator + aio store reads; llm profile data, the cleaner option list and
   the aio selectable callback arrive by args) ── */

export function useTranslatorSfxOptions({
  modelManagerState,
  selectedCustomOcrProfile,
  customOcrStageOptions,
  ocrCustomProfiles,
  cleanerAiOptionsForSelect,
  isStageOptionSelectable,
}: {
  modelManagerState: { entries: Record<string, ModelInstallState> };
  selectedCustomOcrProfile: CustomLlmProfile | null;
  customOcrStageOptions: AioStageOption[];
  ocrCustomProfiles: CustomLlmProfile[];
  cleanerAiOptionsForSelect: AioStageOption[];
  isStageOptionSelectable: (option: AioStageOption | null | undefined) => boolean;
}) {
  const t = useI18n().t;
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const translatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.translatorSfxCleanModelKey,
  );
  const setTranslatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.setTranslatorSfxCleanModelKey,
  );
  const selectedTranslationModelState = useMemo(
    () => modelManagerState.entries[aioStageSelection.getTranslations] ?? null,
    [aioStageSelection.getTranslations, modelManagerState.entries],
  );
  const translatorSelectedLocalTranslationCompatible = useMemo(() => {
    if (!selectedTranslationModelState) return true;
    const modelDefinition =
      TRANSLATION_MODELS_BY_ID[selectedTranslationModelState.model.id] ?? null;
    if (!modelDefinition) return true;
    return modelSupportsLanguage(modelDefinition, srcLang, tgtLang);
  }, [selectedTranslationModelState, srcLang, tgtLang]);
  const filteredTranslatorOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, srcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [aioStageOptions.recognizeText, srcLang]);
  const translatorOcrStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const selectedOption = selectedCustomOcrProfile
      ? buildCustomStageOption(selectedCustomOcrProfile)
      : (customOcrStageOptions.find((option) => option.key === selectedKey) ??
        null);
    if (!selectedOption) {
      return filteredTranslatorOcrStageOptions;
    }
    if (
      filteredTranslatorOcrStageOptions.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return filteredTranslatorOcrStageOptions;
    }
    return [...filteredTranslatorOcrStageOptions, selectedOption];
  }, [
    aioStageSelection.recognizeText,
    buildCustomStageOption,
    customOcrStageOptions,
    filteredTranslatorOcrStageOptions,
    selectedCustomOcrProfile,
  ]);
  const selectedTranslatorOcrCloudOption = useMemo(
    () =>
      translatorOcrStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ?? null,
    [aioStageSelection.recognizeText, translatorOcrStageOptionsForSelect],
  );
  const selectedTranslatorSfxCleanCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        translatorSfxCleanModelKey,
        ocrCustomProfiles,
      ),
    [ocrCustomProfiles, translatorSfxCleanModelKey],
  );
  const selectedTranslatorSfxCleanDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find(
        (option) => option.key === translatorSfxCleanModelKey,
      ) ?? null
    );
  }, [cleanerAiOptionsForSelect, translatorSfxCleanModelKey]);
  const translatorAvailableOcrStageOptions = useMemo(
    () =>
      translatorOcrStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, translatorOcrStageOptionsForSelect],
  );
  const selectTranslatorSfxCleanModel = useCallback(
    (modelKey: string) => {
      const option = cleanerAiOptionsForSelect.find(
        (item) => item.key === modelKey,
      );
      if (!option) {
        setTonedStatus(t('dashboard.status.translatorSfxSelectValidModel'), 'error');
        return;
      }
      if (!option.implemented) {
        setTonedStatus(t('dashboard.status.modelInRoadmap', { name: option.name }), 'error');
        return;
      }
      if (!option.available) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setTranslatorSfxCleanModelKey(modelKey);
    },
    [cleanerAiOptionsForSelect, setStatusMessage, setTonedStatus, setTranslatorSfxCleanModelKey],
  );
  return {
    selectedTranslationModelState,
    translatorSelectedLocalTranslationCompatible,
    filteredTranslatorOcrStageOptions,
    translatorOcrStageOptionsForSelect,
    selectedTranslatorOcrCloudOption,
    selectedTranslatorSfxCleanCustomProfile,
    selectedTranslatorSfxCleanDisplayOption,
    translatorAvailableOcrStageOptions,
    selectTranslatorSfxCleanModel,
  };
}
