import { useCallback, useEffect, useMemo, useState } from 'react';

import { getApiConfig } from '../../../config/api';
import { useI18n } from '../../../i18n';
import {
  extractProviderParamsFromApiBase,
  FREE_AI_PROVIDER_CATALOG_ENTRIES,
  getDefaultFreeProviderDraft,
  getFreeProvidersForStage,
  resolveProviderApiBase,
  type FreeAiProviderCatalogEntry,
  type FreeProviderDraftValue,
  type FreeProviderStage,
} from '../../../models/freeAiProviderCatalog';
import {
  inferCustomLlmTransport,
  loadCustomLlmProfiles,
  parseFreeProviderProfileId,
  persistLlmSettings,
  removeCustomLlmProfile,
  saveCustomLlmProfile,
  toCustomModelSelectionKey,
  toFreeProviderProfileId,
  createEmptyCustomLlmDraft,
  getCustomLlmNormalizationNotice,
  getCustomLlmProviderNotice,
  getCustomLlmRuntimeRestriction,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  findCustomProfileForSelection,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
} from '../../../utils/customLlm';
import {
  buildCustomStageOption,
  type AioStageOption,
} from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { toFreeProviderDraftKey } from '../../../utils/dashboard.utils';
import { resolveCurrentFreeProviderModel } from '../../../utils/dashboardRenderUtils';
import type { FreeProviderDraftMap } from '../../../types/dashboard.types';
import type { AioStageSelection } from '../../../types/aioModelPresets';
import { useLlmProvidersStore } from '../stores/llm-providers-store';

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

interface UseLlmProviderTestResult {
  testFreeProviderConfig: (
    stage: FreeProviderStage,
    provider: FreeAiProviderCatalogEntry,
    draft: FreeProviderDraftValue,
  ) => Promise<{ ok: boolean; message: string }>;
  testCustomProfileConfig: (
    stage: FreeProviderStage,
    profile: CustomLlmProfile,
  ) => Promise<{ ok: boolean; message: string }>;
}

/** SYNC-EXTERNAL: probes the local backend (`/provider/test`) with draft or saved provider configs. */
export function useLlmProviderTest(): UseLlmProviderTestResult {
  const apiConfig = getApiConfig();

  const testFreeProviderConfig = useCallback(
    async (
      stage: FreeProviderStage,
      provider: FreeAiProviderCatalogEntry,
      draft: FreeProviderDraftValue,
    ): Promise<{ ok: boolean; message: string }> => {
      const definition = provider.stages[stage];
      if (!definition) {
        return { ok: false, message: 'Provider/stage configuration not found.' };
      }

      const response = await fetch(
        `${apiConfig.localUrl.replace(/\/+$/, '')}/provider/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transport: definition.transport,
            stage,
            apiBase: draft.apiBase,
            apiKey: draft.apiKey,
            model: draft.model,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        detail?: string;
      } | null;

      if (!response.ok) {
        return {
          ok: false,
          message:
            payload?.detail ||
            payload?.message ||
            `Backend returned ${response.status}`,
        };
      }

      return {
        ok: Boolean(payload?.ok),
        message:
          payload?.message ||
          (payload?.ok ? 'Provider test succeeded.' : 'Provider test failed.'),
      };
    },
    [apiConfig.localUrl],
  );

  const testCustomProfileConfig = useCallback(
    async (
      stage: FreeProviderStage,
      profile: CustomLlmProfile,
    ): Promise<{ ok: boolean; message: string }> =>
      testFreeProviderConfig(
        stage,
        {
          id: `custom-${profile.id}`,
          name: profile.label,
          status: 'integrated',
          lastVerifiedAt: '',
          docsUrl: '',
          setupUrl: '',
          limitsUrl: '',
          rateLimitsUrl: '',
          setupSummary: '',
          limitsSummary: '',
          rateLimitSummary: '',
          stages: {
            [stage]: {
              stage,
              requiresUserApiKey: true,
              transport: inferCustomLlmTransport(profile.apiBase, stage),
              apiBaseTemplate: profile.apiBase,
              defaultApiBase: profile.apiBase,
              defaultModel: profile.model,
              configFields: [],
              models: [],
              allowCustomModelInput: true,
              modelInputPlaceholder: profile.model,
            },
          },
        },
        {
          apiBase: profile.apiBase,
          apiKey: profile.apiKey,
          model: profile.model,
          params: {},
        },
      ),
    [testFreeProviderConfig],
  );

  return { testFreeProviderConfig, testCustomProfileConfig };
}

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

interface UseFreeProviderProfilesArgs {
  userId: string | null;
  applyCustomProfileSelection: (stage: CustomLlmStage, profile: CustomLlmProfile) => void;
  setStatusMessage: (message: string) => void;
}

export function useFreeProviderProfiles({
  userId,
  applyCustomProfileSelection,
  setStatusMessage,
}: UseFreeProviderProfilesArgs) {
  const { t } = useI18n();

  const customLlmProfiles = useLlmProvidersStore((s) => s.customLlmProfiles);
  const setCustomLlmProfiles = useLlmProvidersStore((s) => s.setCustomLlmProfiles);
  const setCustomLlmProfilesMode = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesMode,
  );
  const setCustomLlmProfilesError = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesError,
  );

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

  const syncFreeProviderDraftsFromProfiles = useCallback(
    (profiles: CustomLlmProfile[]) => {
      setFreeProviderDrafts(() => {
        const next: FreeProviderDraftMap = {};
        FREE_AI_PROVIDER_CATALOG_ENTRIES.forEach((provider) => {
          (['translation', 'ocr', 'clean'] as const).forEach((stage) => {
            const definition = provider.stages[stage];
            if (!definition) {
              return;
            }
            const profileId = toFreeProviderProfileId(provider.id, stage);
            const profile = profiles.find((item) => item.id === profileId);
            const params = profile
              ? extractProviderParamsFromApiBase(definition, profile.apiBase)
              : getDefaultFreeProviderDraft(provider.id, stage).params;
            const allowedModels = definition.models.map((model) => model.apiModel);
            const resolvedApiBase = resolveProviderApiBase(
              definition.apiBaseTemplate,
              params,
            );
            next[toFreeProviderDraftKey(stage, provider.id)] = {
              model: resolveCurrentFreeProviderModel(
                profile?.model ?? definition.defaultModel,
                allowedModels,
                definition.defaultModel,
              ),
              apiBase: resolvedApiBase,
              apiKey: profile?.apiKey ?? '',
              params,
            };
          });
        });
        return next;
      });
    },
    [],
  );

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
    syncFreeProviderDraftsFromProfiles,
  };
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
  }, [ocrSelectionUsesLlmSettings, translationSelectionUsesLlmSettings]);
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
