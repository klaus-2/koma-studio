import { useCallback, useEffect, useState } from 'react';

import type { useI18n } from '../../../i18n';
import { useModelManager } from '../../../hooks/useModelManager';
import { SOURCE_LANGUAGE_OPTIONS } from '../../../models/aioStageCatalog';
import type {
  AioLanguageModelPreset,
  AioModelPresetStateV2,
} from '../../../types/aioModelPresets';
import {
  createPreset as createAioPreset,
  deletePreset as deleteAioPreset,
  loadPresetState,
  setActivePresetForLanguage,
  updatePreset as updateAioPreset,
} from '../../../utils/aioModelPresets';
import {
  loadCustomLlmProfiles,
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import { useAioPresetGroups } from './use-aio-preset-groups';
import { useAioStageCatalog } from './use-aio-stage-catalog';
import {
  AIO_STAGE_KEYS,
  createPresetForm,
  getFallbackStageSelection,
  normalizeLanguageCode,
  sanitizeStageSelection,
} from '../settings.constants';
import type { PresetFormData } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseAioPresetsArgs {
  t: TranslationFn;
  userId: string | null;
}

export const useAioPresets = ({ t, userId }: UseAioPresetsArgs) => {
  const { state: modelManagerState } = useModelManager({
    sourceLanguage: SOURCE_LANGUAGE_OPTIONS[0]?.value ?? "ja",
    targetLanguage: "pt-br",
  });

  const [presetState, setPresetState] = useState<AioModelPresetStateV2>(() => loadPresetState());
  const [presetForm, setPresetForm] = useState<PresetFormData | null>(null);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [customLlmProfiles, setCustomLlmProfiles] = useState<CustomLlmProfile[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      try {
        const payload = await loadCustomLlmProfiles(userId);
        if (!cancelled) {
          setCustomLlmProfiles(payload.profiles);
        }
      } catch {
        if (!cancelled) {
          setCustomLlmProfiles([]);
        }
      }
    };

    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const {
    presetCatalogLoading,
    presetLanguageOptions,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    filterSelectableStageCatalog,
    mergePresetCatalogWithCustomOptions,
  } = useAioStageCatalog({
    t,
    customLlmProfiles,
    modelEntries: modelManagerState.entries,
    setPresetError,
  });

  const { languageLabelByCode, groupedPresets } = useAioPresetGroups({
    t,
    presetState,
    presetLanguageOptions,
  });

  const closePresetForm = useCallback(() => {
    setPresetForm(null);
  }, []);

  const openCreatePresetForm = useCallback(() => {
    const sourceLanguage = normalizeLanguageCode(presetLanguageOptions[0]?.value ?? SOURCE_LANGUAGE_OPTIONS[0]?.value ?? "ja");
    const stageCatalog = getSelectableStageCatalog(sourceLanguage);
    setPresetError(null);
    setPresetFeedback(null);
    setPresetForm(createPresetForm(sourceLanguage, getFallbackStageSelection(stageCatalog)));
    void loadPresetCatalogForLanguage(sourceLanguage).then((catalog) => {
      setPresetForm((prev) => {
        if (!prev || prev.sourceLanguage !== sourceLanguage || prev.presetId) return prev;
        return {
          ...prev,
          stageModels: sanitizeStageSelection(
            prev.stageModels,
            filterSelectableStageCatalog(mergePresetCatalogWithCustomOptions(catalog)),
          ),
        };
      });
    });
  }, [
    filterSelectableStageCatalog,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    mergePresetCatalogWithCustomOptions,
    presetLanguageOptions,
  ]);

  const openEditPresetForm = useCallback((preset: AioLanguageModelPreset) => {
    const sourceLanguage = normalizeLanguageCode(preset.sourceLanguage);
    const stageCatalog = getSelectableStageCatalog(sourceLanguage);
    setPresetError(null);
    setPresetFeedback(null);
    setPresetForm({
      presetId: preset.id,
      sourceLanguage,
      name: preset.name,
      description: preset.description,
      stageModels: sanitizeStageSelection(preset.stageModels, stageCatalog),
      setAsActive: (presetState.activePresetBySourceLanguage[sourceLanguage] ?? null) === preset.id,
    });
    void loadPresetCatalogForLanguage(sourceLanguage).then((catalog) => {
      setPresetForm((prev) => {
        if (!prev || prev.presetId !== preset.id) return prev;
        return {
          ...prev,
          stageModels: sanitizeStageSelection(
            prev.stageModels,
            filterSelectableStageCatalog(mergePresetCatalogWithCustomOptions(catalog)),
          ),
        };
      });
    });
  }, [
    filterSelectableStageCatalog,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    mergePresetCatalogWithCustomOptions,
    presetState.activePresetBySourceLanguage,
  ]);

  const handlePresetSourceLanguageChange = useCallback((sourceLanguage: string) => {
    const normalizedLanguage = normalizeLanguageCode(sourceLanguage);
    const stageCatalog = getSelectableStageCatalog(normalizedLanguage);
    setPresetForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sourceLanguage: normalizedLanguage,
        stageModels: sanitizeStageSelection(prev.stageModels, stageCatalog),
      };
    });
    void loadPresetCatalogForLanguage(normalizedLanguage).then((catalog) => {
      setPresetForm((prev) => {
        if (!prev || prev.sourceLanguage !== normalizedLanguage) return prev;
        return {
          ...prev,
          stageModels: sanitizeStageSelection(
            prev.stageModels,
            filterSelectableStageCatalog(mergePresetCatalogWithCustomOptions(catalog)),
          ),
        };
      });
    });
  }, [
    filterSelectableStageCatalog,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    mergePresetCatalogWithCustomOptions,
  ]);

  const handleSavePreset = useCallback(() => {
    if (!presetForm) return;
    const trimmedName = presetForm.name.trim();
    if (!trimmedName) {
      setPresetError(t("settings.presets.aio.error"));
      return;
    }

    const normalizedLanguage = normalizeLanguageCode(presetForm.sourceLanguage);
    const stageCatalog = getSelectableStageCatalog(normalizedLanguage);
    const normalizedSelection = sanitizeStageSelection(presetForm.stageModels, stageCatalog);
    const missingStage = AIO_STAGE_KEYS.find((stageKey) => !normalizedSelection[stageKey]);
    if (missingStage) {
      setPresetError(t("settings.presets.aio.error"));
      return;
    }
    let nextState = presetState;
    let presetId: string | null = null;

    if (presetForm.presetId) {
      const updated = updateAioPreset(
        presetForm.presetId,
        {
          name: trimmedName,
          description: presetForm.description,
          sourceLanguage: normalizedLanguage,
          stageModels: normalizedSelection,
        },
        presetState,
      );
      if (!updated.preset) {
        setPresetError(t("settings.presets.aio.error"));
        return;
      }
      nextState = updated.state;
      presetId = updated.preset.id;
    } else {
      const created = createAioPreset(
        {
          name: trimmedName,
          description: presetForm.description,
          sourceLanguage: normalizedLanguage,
          stageModels: normalizedSelection,
        },
        presetState,
      );
      nextState = created.state;
      presetId = created.preset.id;
    }

    if (presetForm.setAsActive && presetId) {
      nextState = setActivePresetForLanguage(normalizedLanguage, presetId, nextState);
    }

    setPresetState(nextState);
    setPresetError(null);
    setPresetFeedback(t("settings.presets.aio.success"));
    setPresetForm(null);
  }, [getSelectableStageCatalog, presetForm, presetState, t]);

  const handleDeletePreset = useCallback((presetId: string, presetName: string) => {
    const confirmed = window.confirm(t("settings.presets.aio.delete") + ` "${presetName}"?`);
    if (!confirmed) return;
    const nextState = deleteAioPreset(presetId, presetState);
    setPresetState(nextState);
    setPresetFeedback(t("settings.presets.aio.success"));
    setPresetError(null);
    setPresetForm((prev) => (prev?.presetId === presetId ? null : prev));
  }, [presetState, t]);

  const handleSetActivePreset = useCallback((sourceLanguage: string, presetId: string | null) => {
    const nextState = setActivePresetForLanguage(sourceLanguage, presetId, presetState);
    setPresetState(nextState);
    setPresetFeedback(t("settings.presets.aio.success"));
    setPresetError(null);
  }, [presetState, t]);

  return {
    openCreatePresetForm,
    presetCatalogLoading,
    presetFeedback,
    presetError,
    presetForm,
    setPresetForm,
    presetLanguageOptions,
    handlePresetSourceLanguageChange,
    languageLabelByCode,
    closePresetForm,
    handleSavePreset,
    groupedPresets,
    handleSetActivePreset,
    openEditPresetForm,
    handleDeletePreset,
    getSelectableStageCatalog,
  };
};
