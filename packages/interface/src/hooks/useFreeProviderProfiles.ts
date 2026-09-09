import { useCallback, useState } from 'react';

import { useI18n } from '../i18n';
import {
  getDefaultFreeProviderDraft,
  getFreeProvidersForStage,
  resolveProviderApiBase,
  type FreeAiProviderCatalogEntry,
  type FreeProviderDraftValue,
  type FreeProviderStage,
} from '../models/freeAiProviderCatalog';
import {
  saveCustomLlmProfile,
  toFreeProviderProfileId,
  type CustomLlmProfile,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
} from '../utils/customLlm';
import { toFreeProviderDraftKey } from '../utils/dashboard.utils';
import type { FreeProviderDraftMap } from '../types/dashboard.types';

interface UseFreeProviderProfilesArgs {
  userId: string | null;
  customLlmProfiles: CustomLlmProfile[];
  setCustomLlmProfiles: React.Dispatch<React.SetStateAction<CustomLlmProfile[]>>;
  setCustomLlmProfilesMode: React.Dispatch<React.SetStateAction<LlmProfilesPersistenceMode>>;
  setCustomLlmProfilesError: React.Dispatch<React.SetStateAction<string | null>>;
  syncFreeProviderDraftsFromProfiles: (profiles: CustomLlmProfile[]) => void;
  applyCustomProfileSelection: (stage: CustomLlmStage, profile: CustomLlmProfile) => void;
  setStatusMessage: (message: string) => void;
}

export function useFreeProviderProfiles({
  userId,
  customLlmProfiles,
  setCustomLlmProfiles,
  setCustomLlmProfilesMode,
  setCustomLlmProfilesError,
  syncFreeProviderDraftsFromProfiles,
  applyCustomProfileSelection,
  setStatusMessage,
}: UseFreeProviderProfilesArgs) {
  const { t } = useI18n();

  const [freeProviderDrafts, setFreeProviderDrafts] = useState<FreeProviderDraftMap>(() => {
    const seed: FreeProviderDraftMap = {};
    const translationProviders = getFreeProvidersForStage('translation');
    const ocrProviders = getFreeProvidersForStage('ocr');
    const cleanProviders = getFreeProvidersForStage('clean');
    [...translationProviders, ...ocrProviders, ...cleanProviders].forEach((provider) => {
      if (provider.stages.translation) {
        seed[toFreeProviderDraftKey('translation', provider.id)] = getDefaultFreeProviderDraft(provider.id, 'translation');
      }
      if (provider.stages.ocr) {
        seed[toFreeProviderDraftKey('ocr', provider.id)] = getDefaultFreeProviderDraft(provider.id, 'ocr');
      }
      if (provider.stages.clean) {
        seed[toFreeProviderDraftKey('clean', provider.id)] = getDefaultFreeProviderDraft(provider.id, 'clean');
      }
    });
    return seed;
  });

  const getFreeProviderDraft = useCallback((stage: FreeProviderStage, providerId: string): FreeProviderDraftValue => {
    const key = toFreeProviderDraftKey(stage, providerId);
    return freeProviderDrafts[key] ?? getDefaultFreeProviderDraft(providerId, stage);
  }, [freeProviderDrafts]);

  const updateFreeProviderDraft = useCallback((
    stage: FreeProviderStage,
    providerId: string,
    patch: Partial<FreeProviderDraftValue>,
  ) => {
    const key = toFreeProviderDraftKey(stage, providerId);
    const definition = getFreeProvidersForStage(stage).find((item) => item.id === providerId)?.stages[stage];
    setFreeProviderDrafts((prev) => ({
      ...prev,
      [key]: (() => {
        const base = prev[key] ?? getDefaultFreeProviderDraft(providerId, stage);
        const mergedParams = {
          ...base.params,
          ...patch.params,
        };
        const apiBase = definition
          ? resolveProviderApiBase(definition.apiBaseTemplate, mergedParams)
          : (patch.apiBase ?? base.apiBase);
        return {
          ...base,
          ...patch,
          apiBase,
          params: mergedParams,
        };
      })(),
    }));
  }, []);

  const getSelectedFreeProviderProfileLabel = useCallback((
    stage: FreeProviderStage,
    providerId: string,
  ): string | null => {
    const profileId = toFreeProviderProfileId(providerId, stage);
    const profile = customLlmProfiles.find((item) => item.id === profileId && item.stage === stage);
    return profile ? profile.label : null;
  }, [customLlmProfiles]);

  const validateFreeProviderDraft = useCallback((
    stage: FreeProviderStage,
    provider: FreeAiProviderCatalogEntry,
    payloadDraft: FreeProviderDraftValue,
  ): string | null => {
    const definition = provider.stages[stage];
    if (!definition) {
      return t('freeProvider.stageNotSupported');
    }
    if (provider.status !== 'integrated') {
      return t('freeProvider.catalogOnly', { name: provider.name });
    }
    if (!payloadDraft.model.trim()) {
      return `Select a model for ${provider.name}.`;
    }
    const missingField = (definition.configFields ?? []).find(
      (field) => field.required && !String(payloadDraft.params?.[field.id] ?? '').trim(),
    );
    if (missingField) {
      return `Fill in "${missingField.label}" for ${provider.name}.`;
    }
    if (definition.requiresUserApiKey && !payloadDraft.apiKey.trim()) {
      return `An API key for ${provider.name} is required. See the instructions in the Info tooltip.`;
    }
    return null;
  }, [t]);

  const saveFreeProviderProfile = useCallback(async (
    stage: FreeProviderStage,
    provider: FreeAiProviderCatalogEntry,
  ): Promise<{
    profiles: CustomLlmProfile[];
    profile: CustomLlmProfile;
    mode: LlmProfilesPersistenceMode;
  } | null> => {
    const definition = provider.stages[stage];
    if (!definition) {
      setStatusMessage(t('freeProvider.stageNotSupported'));
      return null;
    }

    const payloadDraft = getFreeProviderDraft(stage, provider.id);
    const validationError = validateFreeProviderDraft(stage, provider, payloadDraft);
    if (validationError) {
      setStatusMessage(validationError);
      return null;
    }

    const resolvedApiBase = resolveProviderApiBase(
      definition.apiBaseTemplate,
      payloadDraft.params ?? {},
    );

    const customDraft = {
      id: toFreeProviderProfileId(provider.id, stage),
      label: `FREE ${provider.name} (${t(stage === 'translation' ? 'freeProvider.stageTranslation' : stage === 'clean' ? 'freeProvider.stageClean' : 'freeProvider.stageOcr')})`,
      apiBase: resolvedApiBase,
      apiKey: payloadDraft.apiKey,
      model: payloadDraft.model,
    };

    try {
      const payload = await saveCustomLlmProfile(userId, stage, customDraft);
      setCustomLlmProfiles(payload.profiles);
      setCustomLlmProfilesMode(payload.mode);
      setCustomLlmProfilesError(null);
      syncFreeProviderDraftsFromProfiles(payload.profiles);
      setStatusMessage(`Provider ${provider.name} salvo.`);
      return payload;
    } catch (error) {
      setCustomLlmProfilesError(error instanceof Error ? error.message : 'Failed to save the free provider.');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save the free provider.');
      return null;
    }
  }, [
    getFreeProviderDraft,
    setCustomLlmProfiles,
    setCustomLlmProfilesError,
    setCustomLlmProfilesMode,
    setStatusMessage,
    syncFreeProviderDraftsFromProfiles,
    t,
    userId,
    validateFreeProviderDraft,
  ]);

  const useFreeProviderProfile = useCallback(async (
    stage: FreeProviderStage,
    provider: FreeAiProviderCatalogEntry,
  ) => {
    const payload = await saveFreeProviderProfile(stage, provider);
    if (!payload) return;

    applyCustomProfileSelection(stage, payload.profile);
    setStatusMessage(t(stage === 'translation' ? 'freeProvider.activeForTranslation' : stage === 'clean' ? 'freeProvider.activeForClean' : 'freeProvider.activeForOcr', { name: provider.name }));
  }, [applyCustomProfileSelection, saveFreeProviderProfile, setStatusMessage, t]);

  return {
    freeProviderDrafts,
    setFreeProviderDrafts,
    getFreeProviderDraft,
    updateFreeProviderDraft,
    getSelectedFreeProviderProfileLabel,
    validateFreeProviderDraft,
    saveFreeProviderProfile,
    useFreeProviderProfile,
  };
}
