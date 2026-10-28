import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { useI18n } from '../../../i18n';
import {
  buildAioStageCatalog,
  buildCustomStageOption,
  DEFAULT_AIO_STAGE_OPTIONS,
  mergeStageOptions,
  ocrStageOptionSupportsLanguage as ocrOptionSupportsLanguage,
  SOURCE_LANGUAGE_OPTIONS,
  type AioLanguageOption,
  type AioStageOption,
  type AioStageOptionMap,
} from '../../../models/aioStageCatalog';
import { LOCAL_AIO_MODELS_BY_ID } from '../../../models/translation-models-registry';
import type { ModelInstallState } from '../../../models/types';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import { normalizeLanguageCode } from '../settings.constants';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseAioStageCatalogArgs {
  t: TranslationFn;
  customLlmProfiles: CustomLlmProfile[];
  modelEntries: Record<string, ModelInstallState>;
  setPresetError: Dispatch<SetStateAction<string | null>>;
}

export const useAioStageCatalog = ({
  t,
  customLlmProfiles,
  modelEntries,
  setPresetError,
}: UseAioStageCatalogArgs) => {
  const [presetCatalogByLanguage, setPresetCatalogByLanguage] = useState<Record<string, AioStageOptionMap>>({});
  const [presetLanguageOptions, setPresetLanguageOptions] = useState<AioLanguageOption[]>(SOURCE_LANGUAGE_OPTIONS);
  const [presetCatalogLoading, setPresetCatalogLoading] = useState(false);

  const customTranslationStageOptions = useMemo(
    () => {
      const options: AioStageOption[] = [];
      for (const profile of customLlmProfiles) {
        if (profile.stage === "translation") options.push(buildCustomStageOption(profile));
      }
      return options;
    },
    [buildCustomStageOption, customLlmProfiles],
  );

  const customOcrStageOptions = useMemo(
    () => {
      const options: AioStageOption[] = [];
      for (const profile of customLlmProfiles) {
        if (profile.stage === "ocr") options.push(buildCustomStageOption(profile));
      }
      return options;
    },
    [buildCustomStageOption, customLlmProfiles],
  );

  const isInstalledLocalAioEntry = useCallback((modelKey: string): boolean => {
    const entry = modelEntries[modelKey];
    if (!entry) {
      return false;
    }
    return entry.status === "installed" || entry.status === "update_available";
  }, [modelEntries]);

  const isPresetStageOptionSelectable = useCallback((option: AioStageOption): boolean => {
    if (option.key === "custom" || option.key === "custom_ocr") {
      return false;
    }
    if (!option.implemented || !option.available) {
      return false;
    }
    if (LOCAL_AIO_MODELS_BY_ID[option.key]) {
      return isInstalledLocalAioEntry(option.key);
    }
    return true;
  }, [isInstalledLocalAioEntry]);

  const mergePresetCatalogWithCustomOptions = useCallback((catalog: AioStageOptionMap): AioStageOptionMap => ({
    detectText: catalog.detectText,
    recognizeText: mergeStageOptions(
      catalog.recognizeText.filter((option) => option.key !== "custom_ocr"),
      customOcrStageOptions,
    ),
    getTranslations: mergeStageOptions(
      catalog.getTranslations.filter((option) => option.key !== "custom"),
      customTranslationStageOptions,
    ),
    segmentText: catalog.segmentText,
    cleanImage: catalog.cleanImage,
  }), [customOcrStageOptions, customTranslationStageOptions]);

  const filterSelectableStageCatalog = useCallback((catalog: AioStageOptionMap): AioStageOptionMap => ({
    detectText: catalog.detectText.filter((option) => isPresetStageOptionSelectable(option)),
    recognizeText: catalog.recognizeText.filter((option) => isPresetStageOptionSelectable(option)),
    getTranslations: catalog.getTranslations.filter((option) => isPresetStageOptionSelectable(option)),
    segmentText: catalog.segmentText.filter((option) => isPresetStageOptionSelectable(option)),
    cleanImage: catalog.cleanImage.filter((option) => isPresetStageOptionSelectable(option)),
  }), [isPresetStageOptionSelectable]);

  const getSelectableStageCatalog = useCallback((sourceLanguage: string): AioStageOptionMap => {
    const normalizedLanguage = normalizeLanguageCode(sourceLanguage);
    const catalog = presetCatalogByLanguage[normalizedLanguage] ?? DEFAULT_AIO_STAGE_OPTIONS;
    const mergedCatalog = mergePresetCatalogWithCustomOptions(catalog);
    return filterSelectableStageCatalog(mergedCatalog);
  }, [filterSelectableStageCatalog, mergePresetCatalogWithCustomOptions, presetCatalogByLanguage]);

  const loadPresetCatalogForLanguage = useCallback(async (
    sourceLanguage: string,
  ): Promise<AioStageOptionMap> => {
    const normalizedLanguage = normalizeLanguageCode(sourceLanguage) || "ja";

    setPresetCatalogLoading(true);
    try {
      const nextCatalog = buildAioStageCatalog({
        sourceLanguage: normalizedLanguage,
        localModelEntries: modelEntries,
        customProfiles: customLlmProfiles,
      });
      setPresetLanguageOptions(SOURCE_LANGUAGE_OPTIONS);
      setPresetCatalogByLanguage((prev) => ({ ...prev, [normalizedLanguage]: nextCatalog }));
      return nextCatalog;
    } catch {
      const fallback: AioStageOptionMap = {
        detectText: DEFAULT_AIO_STAGE_OPTIONS.detectText
          .filter((option) => option.implemented && option.available),
        recognizeText: DEFAULT_AIO_STAGE_OPTIONS.recognizeText
          .filter((option) => option.implemented && option.available && ocrOptionSupportsLanguage(option, normalizedLanguage)),
        getTranslations: DEFAULT_AIO_STAGE_OPTIONS.getTranslations
          .filter((option) => option.implemented && option.available),
        segmentText: DEFAULT_AIO_STAGE_OPTIONS.segmentText
          .filter((option) => option.implemented && option.available),
        cleanImage: DEFAULT_AIO_STAGE_OPTIONS.cleanImage
          .filter((option) => option.implemented && option.available),
      };
      setPresetError(t("settings.presets.aio.error"));
      setPresetCatalogByLanguage((prev) => ({ ...prev, [normalizedLanguage]: fallback }));
      return fallback;
    } finally {
      setPresetCatalogLoading(false);
    }
  }, [
    customLlmProfiles,
    modelEntries,
    setPresetError,
    t,
  ]);

  useEffect(() => {
    void loadPresetCatalogForLanguage(SOURCE_LANGUAGE_OPTIONS[0]?.value ?? "ja");
  }, [loadPresetCatalogForLanguage]);

  return {
    presetCatalogLoading,
    presetLanguageOptions,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    filterSelectableStageCatalog,
    mergePresetCatalogWithCustomOptions,
  };
};
