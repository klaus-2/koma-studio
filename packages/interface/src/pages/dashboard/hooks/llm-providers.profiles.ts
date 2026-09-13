/**
 * LLM custom profile persistence & drafts — loads/saves custom LLM profiles
 * against the persistence backend and manages the per-stage custom profile
 * drafts (save/apply/remove/ollama preset). Split out of llm-providers.ts
 * (T10); the entry file keeps the options bridge and re-exports this module.
 */
import { useCallback, useEffect, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { extractProviderParamsFromApiBase, FREE_AI_PROVIDER_CATALOG_ENTRIES, resolveProviderApiBase } from '../../../models/freeAiProviderCatalog';
import {
  createEmptyCustomLlmDraft,
  getCustomLlmNormalizationNotice,
  getCustomLlmProviderNotice,
  getCustomLlmRuntimeRestriction,
  loadCustomLlmProfiles,
  parseFreeProviderProfileId,
  removeCustomLlmProfile,
  saveCustomLlmProfile,
  toCustomModelSelectionKey,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
} from '../../../utils/customLlm';
import { resolveCurrentFreeProviderModel } from '../../../utils/dashboardRenderUtils';
import type { AioStageSelection } from '../../../types/aioModelPresets';
import { useLlmProvidersStore } from '../stores/llm-providers-store';

interface UseCustomLlmProfilesSyncArgs {
  userId: string | null;
  syncFreeProviderDraftsFromProfiles: (profiles: CustomLlmProfile[]) => void;
}

/**
 * SYNC-EXTERNAL: loads the custom LLM profiles from the persistence backend
 * (browser localStorage or desktop secure storage) whenever the user changes.
 */
export function useCustomLlmProfilesSync({
  userId,
  syncFreeProviderDraftsFromProfiles,
}: UseCustomLlmProfilesSyncArgs) {
  const { t } = useI18n();
  const setCustomLlmProfiles = useLlmProvidersStore(
    (s) => s.setCustomLlmProfiles,
  );
  const setCustomLlmProfilesMode = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesMode,
  );
  const setCustomLlmProfilesError = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesError,
  );
  const setCustomLlmProfilesLoading = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesLoading,
  );
  const setCustomLlmProfilesHydrated = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesHydrated,
  );

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      setCustomLlmProfilesLoading(true);
      setCustomLlmProfilesHydrated(false);
      setCustomLlmProfilesError(null);
      try {
        const payload = await loadCustomLlmProfiles(userId);
        if (cancelled) {
          return;
        }
        const normalizedProfiles = payload.profiles.map((profile) => {
          const freeMetadata = parseFreeProviderProfileId(profile.id);
          if (!freeMetadata || freeMetadata.stage !== profile.stage) {
            return profile;
          }
          const provider = FREE_AI_PROVIDER_CATALOG_ENTRIES.find(
            (item) => item.id === freeMetadata.providerId,
          );
          const stageDefinition = provider?.stages[freeMetadata.stage];
          if (!stageDefinition) {
            return profile;
          }
          const allowedModels = stageDefinition.models.map((model) => model.apiModel);
          const params = extractProviderParamsFromApiBase(
            stageDefinition,
            profile.apiBase,
          );
          return {
            ...profile,
            model: resolveCurrentFreeProviderModel(
              profile.model,
              allowedModels,
              stageDefinition.defaultModel,
            ),
            apiBase: resolveProviderApiBase(
              stageDefinition.apiBaseTemplate,
              params,
            ),
          };
        });
        setCustomLlmProfiles(normalizedProfiles);
        setCustomLlmProfilesMode(payload.mode);
        syncFreeProviderDraftsFromProfiles(normalizedProfiles);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCustomLlmProfiles([]);
        syncFreeProviderDraftsFromProfiles([]);
        setCustomLlmProfilesError(
          error instanceof Error
            ? error.message
            : t('dashboard.llm.customProfilesLoadFailed'),
        );
      } finally {
        if (!cancelled) {
          setCustomLlmProfilesLoading(false);
          setCustomLlmProfilesHydrated(true);
        }
      }
    };

    void loadProfiles();
    return () => {
      cancelled = true;
    };
    // `t` is deliberately omitted (same as the original page effect): reloading
    // profiles on locale change would be a behavior change.
  }, [
    userId,
    syncFreeProviderDraftsFromProfiles,
    setCustomLlmProfiles,
    setCustomLlmProfilesMode,
    setCustomLlmProfilesError,
    setCustomLlmProfilesLoading,
    setCustomLlmProfilesHydrated,
  ]);
}

interface UseCustomLlmDraftsArgs {
  userId: string | null;
  aioStageSelection: AioStageSelection;
  setAioStageSelection: React.Dispatch<React.SetStateAction<AioStageSelection>>;
  applyCustomProfileSelection: (stage: CustomLlmStage, profile: CustomLlmProfile) => void;
  syncFreeProviderDraftsFromProfiles: (profiles: CustomLlmProfile[]) => void;
  setStatusMessage: (message: string) => void;
  ollamaLocalApiBase: string;
}

export function useCustomLlmDrafts({
  userId,
  aioStageSelection,
  setAioStageSelection,
  applyCustomProfileSelection,
  syncFreeProviderDraftsFromProfiles,
  setStatusMessage,
  ollamaLocalApiBase,
}: UseCustomLlmDraftsArgs) {
  const { t } = useI18n();

  const customLlmProfiles = useLlmProvidersStore((s) => s.customLlmProfiles);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const setCustomLlmProfiles = useLlmProvidersStore((s) => s.setCustomLlmProfiles);
  const setCustomLlmProfilesMode = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesMode,
  );
  const setCustomLlmProfilesError = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesError,
  );
  const setCustomLlmDrafts = useLlmProvidersStore((s) => s.setCustomLlmDrafts);
  const markPendingCustomSelection = useLlmProvidersStore(
    (s) => s.markPendingCustomSelection,
  );

  const updateCustomLlmDraft = useCallback((stage: CustomLlmStage, patch: Partial<CustomLlmProfileDraft>) => {
    setCustomLlmDrafts((prev) => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        ...patch,
      },
    }));
  }, [setCustomLlmDrafts]);

  const applyOllamaPresetToTranslationDraft = useCallback(() => {
    setCustomLlmDrafts((prev) => ({
      ...prev,
      translation: {
        ...prev.translation,
        label: prev.translation.label.trim() || 'Ollama Local',
        apiBase: ollamaLocalApiBase,
        apiKey: '',
      },
    }));
    setStatusMessage('Local Ollama preset applied. Enter the model name manually.');
  }, [ollamaLocalApiBase, setCustomLlmDrafts, setStatusMessage]);

  const loadCustomLlmDraftFromProfile = useCallback((stage: CustomLlmStage, profileId: string) => {
    const source = customLlmProfiles.find((profile) => profile.stage === stage && profile.id === profileId);
    if (!source) {
      setCustomLlmDrafts((prev) => ({ ...prev, [stage]: createEmptyCustomLlmDraft() }));
      return;
    }

    setCustomLlmDrafts((prev) => ({
      ...prev,
      [stage]: {
        id: source.id,
        label: source.label,
        apiBase: source.apiBase,
        apiKey: source.apiKey,
        model: source.model,
      },
    }));
  }, [customLlmProfiles, setCustomLlmDrafts]);

  const useExistingCustomProfile = useCallback((stage: CustomLlmStage) => {
    const profileId = customLlmDrafts[stage].id;
    if (!profileId) {
      setStatusMessage(t(stage === 'translation' ? 'customLlm.selectTranslationProfile' : 'customLlm.selectOcrProfile'));
      return;
    }
    const profile = customLlmProfiles.find((item) => item.stage === stage && item.id === profileId);
    if (!profile) {
      setStatusMessage(t('customLlm.profileNotFound'));
      return;
    }
    const runtimeRestriction = getCustomLlmRuntimeRestriction(profile.apiBase);
    if (runtimeRestriction) {
      setStatusMessage(runtimeRestriction);
      return;
    }
    applyCustomProfileSelection(stage, profile);
    setStatusMessage(t(stage === 'translation' ? 'customLlm.translationProfileActive' : 'customLlm.ocrProfileActive', { label: profile.label }));
  }, [applyCustomProfileSelection, customLlmDrafts, customLlmProfiles, setStatusMessage, t]);

  const useCustomProfileById = useCallback((stage: CustomLlmStage, profileId: string) => {
    const profile = customLlmProfiles.find((item) => item.stage === stage && item.id === profileId);
    if (!profile) {
      setStatusMessage(t('customLlm.profileNotFound'));
      return;
    }
    const runtimeRestriction = getCustomLlmRuntimeRestriction(profile.apiBase);
    if (runtimeRestriction) {
      setStatusMessage(runtimeRestriction);
      return;
    }
    applyCustomProfileSelection(stage, profile);
    setCustomLlmDrafts((prev) => ({
      ...prev,
      [stage]: {
        id: profile.id,
        label: profile.label,
        apiBase: profile.apiBase,
        apiKey: profile.apiKey,
        model: profile.model,
      },
    }));
    setStatusMessage(t(stage === 'translation' ? 'customLlm.translationProfileActive' : 'customLlm.ocrProfileActive', { label: profile.label }));
  }, [applyCustomProfileSelection, customLlmProfiles, setCustomLlmDrafts, setStatusMessage, t]);

  const saveCustomProfileInline = useCallback(async (
    stage: CustomLlmStage,
    draft: CustomLlmProfileDraft,
  ): Promise<CustomLlmProfile> => {
    try {
      const payload = await saveCustomLlmProfile(userId, stage, draft);
      setCustomLlmProfiles(payload.profiles);
      setCustomLlmProfilesMode(payload.mode);
      setCustomLlmProfilesError(null);
      syncFreeProviderDraftsFromProfiles(payload.profiles);
      setCustomLlmDrafts((prev) => {
        if (prev[stage].id !== payload.profile.id) {
          return prev;
        }
        return {
          ...prev,
          [stage]: {
            id: payload.profile.id,
            label: payload.profile.label,
            apiBase: payload.profile.apiBase,
            apiKey: payload.profile.apiKey,
            model: payload.profile.model,
          },
        };
      });
      if (toCustomModelSelectionKey(payload.profile) === (stage === 'translation'
        ? aioStageSelection.getTranslations
        : aioStageSelection.recognizeText)) {
        applyCustomProfileSelection(stage, payload.profile);
      }
      setStatusMessage(`Custom profile updated: ${payload.profile.label}.`);
      return payload.profile;
    } catch (error) {
      setCustomLlmProfilesError(error instanceof Error ? error.message : 'Failed to save the custom profile.');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save the custom profile.');
      throw error;
    }
  }, [
    aioStageSelection.getTranslations,
    aioStageSelection.recognizeText,
    applyCustomProfileSelection,
    setCustomLlmProfiles,
    setCustomLlmProfilesError,
    setCustomLlmProfilesMode,
    setCustomLlmDrafts,
    setStatusMessage,
    syncFreeProviderDraftsFromProfiles,
    userId,
  ]);

  const resetCustomLlmDraft = useCallback((stage: CustomLlmStage) => {
    setCustomLlmDrafts((prev) => ({ ...prev, [stage]: createEmptyCustomLlmDraft() }));
  }, [setCustomLlmDrafts]);

  const translationCustomProviderNotice = useMemo(
    () => getCustomLlmProviderNotice(customLlmDrafts.translation.apiBase),
    [customLlmDrafts.translation.apiBase],
  );
  const ocrCustomProviderNotice = useMemo(
    () => getCustomLlmProviderNotice(customLlmDrafts.ocr.apiBase),
    [customLlmDrafts.ocr.apiBase],
  );

  const saveCustomLlmDraftProfile = useCallback(async (stage: CustomLlmStage) => {
    try {
      const inputApiBase = customLlmDrafts[stage].apiBase;
      const payload = await saveCustomLlmProfile(userId, stage, customLlmDrafts[stage]);
      setCustomLlmProfiles(payload.profiles);
      setCustomLlmProfilesMode(payload.mode);
      setCustomLlmProfilesError(null);
      syncFreeProviderDraftsFromProfiles(payload.profiles);
      setCustomLlmDrafts((prev) => ({
        ...prev,
        [stage]: {
          id: payload.profile.id,
          label: payload.profile.label,
          apiBase: payload.profile.apiBase,
          apiKey: payload.profile.apiKey,
          model: payload.profile.model,
        },
      }));

      applyCustomProfileSelection(stage, payload.profile);
      const statusParts = [`Custom profile saved: ${payload.profile.label}.`];
      const normalizationNotice = getCustomLlmNormalizationNotice(inputApiBase, payload.profile.apiBase);
      const providerNotice = getCustomLlmProviderNotice(payload.profile.apiBase);
      if (normalizationNotice) {
        statusParts.push(normalizationNotice);
      }
      if (providerNotice && providerNotice.includes('catalogo do provider')) {
        statusParts.push(providerNotice);
      }
      setStatusMessage(statusParts.join(' '));
    } catch (error) {
      setCustomLlmProfilesError(error instanceof Error ? error.message : 'Failed to save the custom profile.');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save the custom profile.');
    }
  }, [
    applyCustomProfileSelection,
    customLlmDrafts,
    setCustomLlmProfiles,
    setCustomLlmProfilesError,
    setCustomLlmProfilesMode,
    setCustomLlmDrafts,
    setStatusMessage,
    syncFreeProviderDraftsFromProfiles,
    userId,
  ]);

  const removeCustomLlmProfileById = useCallback(async (stage: CustomLlmStage, profileId: string) => {
    try {
      const payload = await removeCustomLlmProfile(userId, profileId);
      setCustomLlmProfiles(payload.profiles);
      setCustomLlmProfilesMode(payload.mode);
      setCustomLlmProfilesError(null);
      syncFreeProviderDraftsFromProfiles(payload.profiles);
      setCustomLlmDrafts((prev) => {
        if (prev[stage].id !== profileId) {
          return prev;
        }
        return { ...prev, [stage]: createEmptyCustomLlmDraft() };
      });

      setAioStageSelection((prev) => {
        const selectedKey = stage === 'translation' ? prev.getTranslations : prev.recognizeText;
        const isRemovedSelection =
          selectedKey === (stage === 'translation' ? `custom:${profileId}` : `custom_ocr:${profileId}`);
        if (!isRemovedSelection) {
          return prev;
        }

        return stage === 'translation'
          ? { ...prev, getTranslations: '' }
          : { ...prev, recognizeText: '' };
      });
      markPendingCustomSelection(stage, null);

      setStatusMessage('Custom profile removed.');
    } catch (error) {
      setCustomLlmProfilesError(error instanceof Error ? error.message : 'Failed to remove the custom profile.');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to remove the custom profile.');
    }
  }, [
    markPendingCustomSelection,
    setAioStageSelection,
    setCustomLlmProfiles,
    setCustomLlmProfilesError,
    setCustomLlmProfilesMode,
    setCustomLlmDrafts,
    setStatusMessage,
    syncFreeProviderDraftsFromProfiles,
    userId,
  ]);

  const removeCustomLlmDraftProfile = useCallback(async (stage: CustomLlmStage) => {
    const profileId = customLlmDrafts[stage].id;
    if (!profileId) {
      setStatusMessage('Select a saved custom profile to remove.');
      return;
    }
    await removeCustomLlmProfileById(stage, profileId);
  }, [customLlmDrafts, removeCustomLlmProfileById, setStatusMessage]);

  return {
    updateCustomLlmDraft,
    applyOllamaPresetToTranslationDraft,
    loadCustomLlmDraftFromProfile,
    useExistingCustomProfile,
    useCustomProfileById,
    saveCustomProfileInline,
    resetCustomLlmDraft,
    translationCustomProviderNotice,
    ocrCustomProviderNotice,
    saveCustomLlmDraftProfile,
    removeCustomLlmProfileById,
    removeCustomLlmDraftProfile,
  };
}
