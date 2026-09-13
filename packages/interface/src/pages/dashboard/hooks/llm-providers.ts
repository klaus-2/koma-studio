/**
 * LLM providers domain — entry point. Hosts the stage-profile options bridge
 * (custom-profile memos, stage option lists, cloud option/capability
 * resolution and the llm<->aio selection bridge) plus the settings
 * persistence mirror, and re-exports the per-concern sibling modules split
 * out in T10, so consumer imports from 'hooks/llm-providers' stay valid.
 */
import { useCallback, useEffect, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import {
  findCustomProfileForSelection,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  parseFreeProviderProfileId,
  persistLlmSettings,
  toCustomModelSelectionKey,
  type CustomLlmProfile,
  type CustomLlmStage,
} from '../../../utils/customLlm';
import { buildCustomStageOption, type AioStageOption } from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';

export { useCustomLlmProfilesSync, useCustomLlmDrafts } from './llm-providers.profiles';
export { useLlmProviderTest, useFreeProviderProfiles } from './llm-providers.free';

/**
 * SYNC-EXTERNAL: mirrors LLM request settings to localStorage on every change.
 * Same key and timing as the original page effect (no persist middleware —
 * the explicit sync stays the source of truth).
 */
export function useLlmSettingsPersistence() {
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);

  useEffect(() => {
    persistLlmSettings(llmSettings);
  }, [llmSettings]);
}

/* ── Stage profile options: custom-profile memos, stage option lists for the
   selects, cloud option/capability resolution and the llm<->aio selection bridge
   (llm-providers store + aio-pipeline store reads; the OCR filter list arrives
   from the aio domain by arg) ── */

export function useLlmStageProfileOptions({ filteredOcrStageOptions }: { filteredOcrStageOptions: AioStageOption[] }) {
  const { t } = useI18n();
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageOptions = useAioPipelineStore((s) => s.setAioStageOptions);
  const setAioStageSelection = useAioPipelineStore((s) => s.setAioStageSelection);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const customLlmProfiles = useLlmProvidersStore((s) => s.customLlmProfiles);
  const markPendingCustomSelection = useLlmProvidersStore(
    (s) => s.markPendingCustomSelection,
  );
  const translationCustomProfiles = useMemo(
    () =>
      customLlmProfiles.filter((profile) => profile.stage === 'translation'),
    [customLlmProfiles],
  );
  const ocrCustomProfiles = useMemo(
    () => customLlmProfiles.filter((profile) => profile.stage === 'ocr'),
    [customLlmProfiles],
  );
  const cleanCustomProfiles = useMemo(
    () => customLlmProfiles.filter((profile) => profile.stage === 'clean'),
    [customLlmProfiles],
  );
  const translationStandaloneCustomProfiles = useMemo(
    () =>
      translationCustomProfiles.filter(
        (profile) => !parseFreeProviderProfileId(profile.id),
      ),
    [translationCustomProfiles],
  );
  const ocrStandaloneCustomProfiles = useMemo(
    () =>
      ocrCustomProfiles.filter(
        (profile) => !parseFreeProviderProfileId(profile.id),
      ),
    [ocrCustomProfiles],
  );
  const cleanStandaloneCustomProfiles = useMemo(
    () =>
      cleanCustomProfiles.filter(
        (profile) => !parseFreeProviderProfileId(profile.id),
      ),
    [cleanCustomProfiles],
  );
  const customTranslationStageOptions = useMemo(
    () =>
      translationCustomProfiles.map((profile) =>
        buildCustomStageOption(profile),
      ),
    [buildCustomStageOption, translationCustomProfiles],
  );
  const customOcrStageOptions = useMemo(
    () => ocrCustomProfiles.map((profile) => buildCustomStageOption(profile)),
    [buildCustomStageOption, ocrCustomProfiles],
  );
  const selectedCustomTranslationProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        aioStageSelection.getTranslations,
        translationCustomProfiles,
      ),
    [aioStageSelection.getTranslations, translationCustomProfiles],
  );
  const selectedCustomOcrProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        aioStageSelection.recognizeText,
        ocrCustomProfiles,
      ),
    [aioStageSelection.recognizeText, ocrCustomProfiles],
  );
  const translationStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.getTranslations;
    const selectedOption = selectedCustomTranslationProfile
      ? buildCustomStageOption(selectedCustomTranslationProfile)
      : (customTranslationStageOptions.find(
          (option) => option.key === selectedKey,
        ) ?? null);
    if (!selectedOption) {
      return aioStageOptions.getTranslations;
    }
    if (
      aioStageOptions.getTranslations.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return aioStageOptions.getTranslations;
    }
    return [...aioStageOptions.getTranslations, selectedOption];
  }, [
    aioStageOptions.getTranslations,
    aioStageSelection.getTranslations,
    buildCustomStageOption,
    customTranslationStageOptions,
    selectedCustomTranslationProfile,
  ]);
  const ocrStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const selectedOption = selectedCustomOcrProfile
      ? buildCustomStageOption(selectedCustomOcrProfile)
      : (customOcrStageOptions.find((option) => option.key === selectedKey) ??
        null);
    if (!selectedOption) {
      return filteredOcrStageOptions;
    }
    if (
      filteredOcrStageOptions.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return filteredOcrStageOptions;
    }
    return [...filteredOcrStageOptions, selectedOption];
  }, [
    aioStageSelection.recognizeText,
    buildCustomStageOption,
    customOcrStageOptions,
    filteredOcrStageOptions,
    selectedCustomOcrProfile,
  ]);
  const selectedTranslationCloudOption = useMemo(
    () =>
      translationStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.getTranslations,
      ) ?? null,
    [aioStageSelection.getTranslations, translationStageOptionsForSelect],
  );
  const selectedOcrCloudOption = useMemo(
    () =>
      ocrStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ?? null,
    [aioStageSelection.recognizeText, ocrStageOptionsForSelect],
  );
  const selectedTranslationLlmCapabilities = useMemo(
    () =>
      selectedTranslationCloudOption?.llm_capabilities ??
      inferLlmCapabilitiesForModelSelection(
        'translation',
        aioStageSelection.getTranslations,
      ),
    [
      aioStageSelection.getTranslations,
      selectedTranslationCloudOption?.llm_capabilities,
    ],
  );
  const selectedOcrLlmCapabilities = useMemo(
    () =>
      selectedOcrCloudOption?.llm_capabilities ??
      inferLlmCapabilitiesForModelSelection(
        'ocr',
        aioStageSelection.recognizeText,
      ),
    [aioStageSelection.recognizeText, selectedOcrCloudOption?.llm_capabilities],
  );
  const translationSelectionUsesLlmSettings = useMemo(
    () =>
      Boolean(
        aioSteps.getTranslations &&
        hasAnyLlmCapability(selectedTranslationLlmCapabilities),
      ),
    [aioSteps.getTranslations, selectedTranslationLlmCapabilities],
  );
  const ocrSelectionUsesLlmSettings = useMemo(
    () =>
      Boolean(
        aioSteps.recognizeText &&
        hasAnyLlmCapability(selectedOcrLlmCapabilities),
      ),
    [aioSteps.recognizeText, selectedOcrLlmCapabilities],
  );
  const showLlmSettingsPanel =
    translationSelectionUsesLlmSettings || ocrSelectionUsesLlmSettings;
  const llmSettingsSupportSummary = useMemo(() => {
    const enabledStages: string[] = [];
    if (translationSelectionUsesLlmSettings) {
      enabledStages.push(t('dashboard.status.stageLabelTranslation'));
    }
    if (ocrSelectionUsesLlmSettings) {
      enabledStages.push('OCR');
    }
    return enabledStages.join(' + ');
  }, [ocrSelectionUsesLlmSettings, translationSelectionUsesLlmSettings, t]);
  const applyCustomProfileSelection = useCallback(
    (stage: CustomLlmStage, profile: CustomLlmProfile) => {
      const selectionKey = toCustomModelSelectionKey(profile);
      const customOption = buildCustomStageOption(profile);
      markPendingCustomSelection(stage, selectionKey);
      setAioStageOptions((prev) => {
        if (stage === 'translation') {
          const exists = prev.getTranslations.some(
            (item) => item.key === customOption.key,
          );
          return exists
            ? prev
            : {
                ...prev,
                getTranslations: [...prev.getTranslations, customOption],
              };
        }
        const exists = prev.recognizeText.some(
          (item) => item.key === customOption.key,
        );
        return exists
          ? prev
          : { ...prev, recognizeText: [...prev.recognizeText, customOption] };
      });
      setAioStageSelection((prev) =>
        stage === 'translation'
          ? { ...prev, getTranslations: selectionKey }
          : { ...prev, recognizeText: selectionKey },
      );
    },
    [
      buildCustomStageOption,
      markPendingCustomSelection,
      setAioStageOptions,
      setAioStageSelection,
    ],
  );
  return {
    translationCustomProfiles,
    ocrCustomProfiles,
    cleanCustomProfiles,
    translationStandaloneCustomProfiles,
    ocrStandaloneCustomProfiles,
    cleanStandaloneCustomProfiles,
    customTranslationStageOptions,
    customOcrStageOptions,
    selectedCustomTranslationProfile,
    selectedCustomOcrProfile,
    translationStageOptionsForSelect,
    ocrStageOptionsForSelect,
    selectedTranslationCloudOption,
    selectedOcrCloudOption,
    selectedTranslationLlmCapabilities,
    selectedOcrLlmCapabilities,
    translationSelectionUsesLlmSettings,
    ocrSelectionUsesLlmSettings,
    showLlmSettingsPanel,
    llmSettingsSupportSummary,
    applyCustomProfileSelection,
  };
}
