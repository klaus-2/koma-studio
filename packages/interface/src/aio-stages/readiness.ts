/**
 * Stage readiness — one policy for “can this AIO stage model run?”
 *
 * `resolveStageModelReadiness`: selection keys in → ready plan or typed
 * refusal (always a non-empty `message`). Local-model manager opens ride
 * on `openModelManager`; `applyStageReadinessRefusal` / `raiseStageReadinessRefusal`
 * are the only place that turns a refusal into UI / throw.
 */
import type { AioStageOption } from '../models/aioStageCatalog.types';
import {
  TRANSLATION_MODELS_BY_ID,
  modelSupportsLanguage,
} from '../models/translation-models-registry';
import {
  getCustomLlmRuntimeRestriction,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  isCustomModelSelectionKey,
  normalizeKnownCustomLlmApiBase,
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
  type LlmRequestSettings,
} from '../utils/customLlm';

export type StageReadinessStage =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage';

export type LocalStageName = Exclude<StageReadinessStage, 'getTranslations'>;

export interface LocalModelEntry {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

/** Lean profile shape accepted by readiness and request payload builders. */
export interface ReadinessCustomProfile {
  apiBase: string;
  apiKey: string;
  model?: string | null;
}

export type Translate = (
  key: string,
  params?: Record<string, string | number | null | undefined>,
) => string;

export type StageReadinessRefusalKind =
  | 'local_not_ready'
  | 'option_missing'
  | 'in_roadmap'
  | 'requires_config'
  | 'custom_profile_missing'
  | 'custom_api_key_missing'
  | 'runtime_restriction'
  | 'install_translation_model'
  | 'incompatible_language'
  | 'custom_cleaner_incomplete'
  | 'custom_cleaner_requires_api_key';

export interface StageReadinessReady {
  ok: true;
  modelKey: string;
  useCloud: boolean;
  useLlmSettings: boolean;
  customProfile: ReadinessCustomProfile | null;
}

export interface OpenModelManagerIntent {
  stage: StageReadinessStage;
  focusedModelId?: string | null;
  language?: string;
}

export interface StageReadinessRefusal {
  ok: false;
  kind: StageReadinessRefusalKind;
  message: string;
  name?: string;
  openModelManager?: OpenModelManagerIntent;
}

export type StageReadiness = StageReadinessReady | StageReadinessRefusal;

/** Call-site copy for the three strings that already diverge per tool. */
export interface StageReadinessMessages {
  invalidSelection: string;
  selectCustomProfile: string;
  requiresApiKey: string;
}

export interface CleanerAiProfileReadinessReady {
  ok: true;
  customPayload: ReadinessCustomProfile | null;
}

export type CleanerAiProfileReadiness =
  | CleanerAiProfileReadinessReady
  | StageReadinessRefusal;

export interface ReadinessRefusalSink {
  setStatusMessage?: (message: string) => void;
  openModelManagerForStage?: (
    stage: StageReadinessStage,
    options?: Record<string, unknown>,
  ) => void;
}

const isLocalModelInstalled = (entry: LocalModelEntry): boolean =>
  entry.status === 'installed' || entry.status === 'update_available';

const localReadyPlan = (modelKey: string): StageReadinessReady => ({
  ok: true,
  modelKey,
  useCloud: false,
  useLlmSettings: false,
  customProfile: null,
});

function refuseCatalogOption(
  option: AioStageOption | null,
  messages: StageReadinessMessages,
  t: Translate,
): StageReadinessRefusal | null {
  if (!option) {
    return {
      ok: false,
      kind: 'option_missing',
      message: messages.invalidSelection,
    };
  }
  if (!option.implemented) {
    return {
      ok: false,
      kind: 'in_roadmap',
      message: t('aioModel.status.inRoadmap', { name: option.name }),
      name: option.name,
    };
  }
  if (!option.available) {
    return {
      ok: false,
      kind: 'requires_config',
      message: t('aioModel.status.requiresConfig', { name: option.name }),
      name: option.name,
    };
  }
  return null;
}

function refuseCustomProfile(
  modelKey: string,
  customProfile: ReadinessCustomProfile | null,
  messages: StageReadinessMessages,
  options: { enforceRuntimeRestriction?: boolean } = {},
): StageReadinessRefusal | null {
  if (!isCustomModelSelectionKey(modelKey)) {
    return null;
  }
  if (!customProfile) {
    return {
      ok: false,
      kind: 'custom_profile_missing',
      message: messages.selectCustomProfile,
    };
  }
  if (
    requiresCustomLlmApiKey(customProfile.apiBase)
    && !customProfile.apiKey.trim()
  ) {
    return {
      ok: false,
      kind: 'custom_api_key_missing',
      message: messages.requiresApiKey,
    };
  }
  if (options.enforceRuntimeRestriction) {
    const runtimeRestriction = getCustomLlmRuntimeRestriction(customProfile.apiBase);
    if (runtimeRestriction) {
      return {
        ok: false,
        kind: 'runtime_restriction',
        message: runtimeRestriction,
      };
    }
  }
  return null;
}

function readyPlanFor(
  stage: StageReadinessStage,
  modelKey: string,
  option: AioStageOption | null,
  customProfile: ReadinessCustomProfile | null,
): StageReadinessReady {
  if (stage === 'recognizeText') {
    const useCloud = isCloudOcrModelKey(modelKey);
    const useLlmSettings =
      useCloud
      && hasAnyLlmCapability(
        option?.llm_capabilities
        ?? inferLlmCapabilitiesForModelSelection('ocr', modelKey),
      );
    return {
      ok: true,
      modelKey,
      useCloud,
      useLlmSettings,
      customProfile: useLlmSettings ? customProfile : null,
    };
  }
  if (stage === 'getTranslations') {
    const useCloud = isCustomModelSelectionKey(modelKey)
      ? !shouldUseLocalDesktopTranslationForCustomProfile(customProfile)
      : isCloudTranslationModelKey(modelKey);
    const useLlmSettings =
      (useCloud || isCustomModelSelectionKey(modelKey))
      && hasAnyLlmCapability(
        option?.llm_capabilities
        ?? inferLlmCapabilitiesForModelSelection('translation', modelKey),
      );
    return {
      ok: true,
      modelKey,
      useCloud,
      useLlmSettings,
      customProfile: useLlmSettings ? customProfile : null,
    };
  }
  return localReadyPlan(modelKey);
}

const LOCAL_ONLY_STAGES: ReadonlySet<StageReadinessStage> = new Set([
  'detectText',
  'segmentText',
  'cleanImage',
]);

/**
 * One readiness policy for every AIO stage.
 *
 * `option`: `undefined` skips the catalog check; `null` means looked-up and
 * missing; a value runs the catalog cascade on the cloud/custom path.
 */
export function resolveStageModelReadiness(args: {
  stage: StageReadinessStage;
  stageLabel: string;
  modelKey: string;
  option?: AioStageOption | null;
  modelEntries: Readonly<Record<string, LocalModelEntry | null | undefined>>;
  customProfile?: ReadinessCustomProfile | null;
  languages?: { source: string; target: string };
  messages: StageReadinessMessages;
  t: Translate;
}): StageReadiness {
  const {
    stage,
    stageLabel,
    modelKey,
    option,
    modelEntries,
    customProfile = null,
    messages,
    t,
  } = args;

  if (option === null) {
    return {
      ok: false,
      kind: 'option_missing',
      message: messages.invalidSelection,
    };
  }

  const localEntry = modelEntries[modelKey];
  const requiresLocal = LOCAL_ONLY_STAGES.has(stage) || localEntry != null;

  if (requiresLocal) {
    if (stage === 'getTranslations' && localEntry) {
      if (!isLocalModelInstalled(localEntry)) {
        return {
          ok: false,
          kind: 'install_translation_model',
          message: t('aioExec.installTranslationModel'),
          name: localEntry.model.name,
          openModelManager: {
            stage: 'getTranslations',
            focusedModelId: modelKey,
            language: args.languages?.source,
          },
        };
      }
      const modelDefinition = TRANSLATION_MODELS_BY_ID[localEntry.model.id] ?? null;
      if (
        modelDefinition
        && args.languages
        && !modelSupportsLanguage(
          modelDefinition,
          args.languages.source,
          args.languages.target,
        )
      ) {
        return {
          ok: false,
          kind: 'incompatible_language',
          message: t('aioExec.translationModelIncompatible', {
            modelName: localEntry.model.name,
          }),
          name: localEntry.model.name,
        };
      }
      return localReadyPlan(modelKey);
    }

    if (!localEntry) {
      return {
        ok: false,
        kind: 'local_not_ready',
        message: t('aioExec.selectAndInstallStage', { stageLabel }),
        openModelManager: { stage, focusedModelId: modelKey },
      };
    }
    if (!isLocalModelInstalled(localEntry)) {
      return {
        ok: false,
        kind: 'local_not_ready',
        message: t('aioExec.installBeforeStage', {
          name: localEntry.model.name,
          stageLabel,
        }),
        openModelManager: {
          stage,
          focusedModelId: localEntry.model.id,
        },
      };
    }
    return localReadyPlan(modelKey);
  }

  const catalogRefusal = refuseCatalogOption(option ?? null, messages, t);
  if (catalogRefusal) return catalogRefusal;

  const customRefusal = refuseCustomProfile(
    modelKey,
    customProfile,
    messages,
    { enforceRuntimeRestriction: stage === 'getTranslations' },
  );
  if (customRefusal) return customRefusal;

  return readyPlanFor(stage, modelKey, option ?? null, customProfile);
}

/** Surface a refusal as status message + optional model-manager open. */
export function applyStageReadinessRefusal(
  refusal: Extract<StageReadiness, { ok: false }>,
  sink: ReadinessRefusalSink,
): void {
  sink.setStatusMessage?.(refusal.message);
  if (refusal.openModelManager) {
    sink.openModelManagerForStage?.(refusal.openModelManager.stage, {
      focusedModelId: refusal.openModelManager.focusedModelId ?? null,
      ...(refusal.openModelManager.language != null
        ? { language: refusal.openModelManager.language }
        : {}),
    });
  }
}

/** Surface a refusal and throw (manual / Translator resolvers). */
export function raiseStageReadinessRefusal(
  refusal: Extract<StageReadiness, { ok: false }>,
  sink: ReadinessRefusalSink = {},
): never {
  applyStageReadinessRefusal(refusal, {
    openModelManagerForStage: sink.openModelManagerForStage,
  });
  throw new Error(refusal.message);
}

/** SFX translation rewrites extra_context and disables notes. */
export function withSfxTranslationSettings(
  base: LlmRequestSettings,
  extraContext: string,
): LlmRequestSettings {
  return {
    ...base,
    extra_context: extraContext,
    translation_notes_enabled: false,
  };
}

/**
 * Cleaner AI Custom profile — API Base + Model + API key policy for
 * Automatic AI Clean / AI SFX.
 */
export function resolveCleanerAiProfileReadiness(args: {
  isCustomCleanerAi: boolean;
  profile: {
    apiBase: string;
    model?: string;
    apiKey: string;
  } | null;
  messages: {
    incomplete: string;
    requiresApiKey: string;
  };
}): CleanerAiProfileReadiness {
  if (!args.isCustomCleanerAi) {
    return { ok: true, customPayload: null };
  }

  const normalizedApiBase = normalizeKnownCustomLlmApiBase(
    args.profile?.apiBase ?? '',
  );
  const normalizedModel = args.profile?.model?.trim() ?? '';
  const normalizedApiKey = args.profile?.apiKey.trim() ?? '';

  if (!normalizedApiBase || !normalizedModel) {
    return {
      ok: false,
      kind: 'custom_cleaner_incomplete',
      message: args.messages.incomplete,
    };
  }
  if (requiresCustomLlmApiKey(normalizedApiBase) && !normalizedApiKey) {
    return {
      ok: false,
      kind: 'custom_cleaner_requires_api_key',
      message: args.messages.requiresApiKey,
    };
  }

  return {
    ok: true,
    customPayload: {
      apiBase: normalizedApiBase,
      model: normalizedModel,
      apiKey: normalizedApiKey,
    },
  };
}
