/**
 * Stage readiness — one policy for “can this AIO stage model run?”
 *
 * Selection keys in → ready plan or typed refusal. Local-model manager
 * opens stay behind `ensureLocalModelReady` (the side-effecting adapter).
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
} from '../utils/customLlm';

export type LocalStageName =
  | 'detectText'
  | 'recognizeText'
  | 'segmentText'
  | 'cleanImage';

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

/** Side-effecting local-model gate (install prompt + model manager). */
export type EnsureLocalModelReady = (
  stage: LocalStageName,
  stageLabel: string,
  modelKey: string,
) => boolean;

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

export interface StageReadinessRefusal {
  ok: false;
  kind: StageReadinessRefusalKind;
  /** Empty when `ensureLocalModelReady` already surfaced the refusal. */
  message: string;
  name?: string;
  detail?: string;
}

export type StageReadiness = StageReadinessReady | StageReadinessRefusal;

export interface StageReadinessMessages {
  invalidSelection: string;
  selectCustomProfile: string;
  requiresApiKey: string;
  installTranslationModel?: string;
  incompatibleLanguage?: string;
}

export interface CleanerAiProfileReadinessReady {
  ok: true;
  customPayload: {
    api_base: string;
    model: string;
    api_key?: string;
  } | null;
}

export type CleanerAiProfileReadiness =
  | CleanerAiProfileReadinessReady
  | StageReadinessRefusal;

const isLocalModelInstalled = (entry: LocalModelEntry): boolean =>
  entry.status === 'installed' || entry.status === 'update_available';

const localReadyPlan = (modelKey: string): StageReadinessReady => ({
  ok: true,
  modelKey,
  useCloud: false,
  useLlmSettings: false,
  customProfile: null,
});

const optionMissing = (message: string): StageReadinessRefusal => ({
  ok: false,
  kind: 'option_missing',
  message,
});

const findOption = (
  options: readonly AioStageOption[],
  modelKey: string,
): AioStageOption | null =>
  options.find((option) => option.key === modelKey) ?? null;

function refuseCatalogOption(
  option: AioStageOption | null,
  messages: Pick<StageReadinessMessages, 'invalidSelection'>,
  t: Translate,
): StageReadinessRefusal | null {
  if (!option) {
    return optionMissing(messages.invalidSelection);
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
  messages: Pick<StageReadinessMessages, 'selectCustomProfile' | 'requiresApiKey'>,
  options: {
    enforceRuntimeRestriction?: boolean;
  } = {},
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
        detail: runtimeRestriction,
      };
    }
  }
  return null;
}

function ocrReadyPlan(
  modelKey: string,
  option: AioStageOption | null,
  customProfile: ReadinessCustomProfile | null,
): StageReadinessReady {
  const useCloud = isCloudOcrModelKey(modelKey);
  const useLlmSettings =
    useCloud
    && hasAnyLlmCapability(
      option?.llm_capabilities ?? inferLlmCapabilitiesForModelSelection('ocr', modelKey),
    );
  return {
    ok: true,
    modelKey,
    useCloud,
    useLlmSettings,
    customProfile: useLlmSettings ? customProfile : null,
  };
}

function translationReadyPlan(
  modelKey: string,
  option: AioStageOption | null,
  customProfile: ReadinessCustomProfile | null,
): StageReadinessReady {
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

/**
 * Detect Text / Segment Text / Clean Image — catalog key + local install gate.
 * Pass `options` when the call site owns a stage catalog list.
 */
export function resolveLocalStageModelReadiness(args: {
  stage: LocalStageName;
  stageLabel: string;
  modelKey: string;
  options?: readonly AioStageOption[];
  ensureLocalModelReady: EnsureLocalModelReady;
  invalidSelection: string;
}): StageReadiness {
  if (args.options && !findOption(args.options, args.modelKey)) {
    return optionMissing(args.invalidSelection);
  }
  if (!args.ensureLocalModelReady(args.stage, args.stageLabel, args.modelKey)) {
    return { ok: false, kind: 'local_not_ready', message: '' };
  }
  return localReadyPlan(args.modelKey);
}

/**
 * Recognize Text — local install gate, or catalog + Custom AI cascade.
 * Capability plan (useCloud / useLlmSettings) rides on the ready arm.
 */
export function resolveRecognizeTextReadiness(args: {
  modelKey: string;
  stageLabel: string;
  options: readonly AioStageOption[];
  modelEntries: Readonly<Record<string, LocalModelEntry | null | undefined>>;
  customProfile: ReadinessCustomProfile | null;
  ensureLocalModelReady: EnsureLocalModelReady;
  messages: StageReadinessMessages;
  t: Translate;
  /** Translator also requires a catalog option on the local path. */
  requireOptionWithLocal?: boolean;
}): StageReadiness {
  const option = findOption(args.options, args.modelKey);
  const localEntry = args.modelEntries[args.modelKey];

  if (localEntry) {
    if (args.requireOptionWithLocal && !option) {
      return optionMissing(args.messages.invalidSelection);
    }
    if (
      !args.ensureLocalModelReady(
        'recognizeText',
        args.stageLabel,
        args.modelKey,
      )
    ) {
      return { ok: false, kind: 'local_not_ready', message: '' };
    }
    return localReadyPlan(args.modelKey);
  }

  const catalogRefusal = refuseCatalogOption(option, args.messages, args.t);
  if (catalogRefusal) return catalogRefusal;

  const customRefusal = refuseCustomProfile(
    args.modelKey,
    args.customProfile,
    args.messages,
  );
  if (customRefusal) return customRefusal;

  return ocrReadyPlan(args.modelKey, option, args.customProfile);
}

/**
 * Get Translations — local install + language pair, or catalog + Custom AI
 * cascade with runtime restriction. Capability plan rides on the ready arm.
 */
export function resolveGetTranslationsReadiness(args: {
  modelKey: string;
  options: readonly AioStageOption[];
  modelEntries: Readonly<Record<string, LocalModelEntry | null | undefined>>;
  customProfile: ReadinessCustomProfile | null;
  sourceLanguage: string;
  targetLanguage: string;
  messages: StageReadinessMessages;
  t: Translate;
}): StageReadiness {
  const option = findOption(args.options, args.modelKey);
  const localEntry = args.modelEntries[args.modelKey];

  if (localEntry) {
    if (!isLocalModelInstalled(localEntry)) {
      return {
        ok: false,
        kind: 'install_translation_model',
        message: args.messages.installTranslationModel ?? '',
        name: localEntry.model.name,
      };
    }
    const modelDefinition =
      TRANSLATION_MODELS_BY_ID[localEntry.model.id] ?? null;
    if (
      modelDefinition
      && !modelSupportsLanguage(
        modelDefinition,
        args.sourceLanguage,
        args.targetLanguage,
      )
    ) {
      return {
        ok: false,
        kind: 'incompatible_language',
        message: args.messages.incompatibleLanguage ?? '',
        name: localEntry.model.name,
      };
    }
    return localReadyPlan(args.modelKey);
  }

  const catalogRefusal = refuseCatalogOption(option, args.messages, args.t);
  if (catalogRefusal) return catalogRefusal;

  const customRefusal = refuseCustomProfile(
    args.modelKey,
    args.customProfile,
    args.messages,
    { enforceRuntimeRestriction: true },
  );
  if (customRefusal) return customRefusal;

  return translationReadyPlan(args.modelKey, option, args.customProfile);
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
      api_base: normalizedApiBase,
      model: normalizedModel,
      ...(normalizedApiKey ? { api_key: normalizedApiKey } : {}),
    },
  };
}
