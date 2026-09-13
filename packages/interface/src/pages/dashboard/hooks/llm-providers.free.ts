/**
 * LLM free provider profiles — the local backend provider-config test probes
 * and the free-provider draft state with save/validate/use-profile flows.
 * Split out of llm-providers.ts (T10); the entry file keeps the options
 * bridge and re-exports this module.
 */
import { useCallback, useState } from 'react';

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
  saveCustomLlmProfile,
  toFreeProviderProfileId,
  type CustomLlmProfile,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
} from '../../../utils/customLlm';
import { toFreeProviderDraftKey } from '../../../utils/dashboard.utils';
import { resolveCurrentFreeProviderModel } from '../../../utils/dashboardRenderUtils';
import type { FreeProviderDraftMap } from '../../../types/dashboard.types';
import { useLlmProvidersStore } from '../stores/llm-providers-store';

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
