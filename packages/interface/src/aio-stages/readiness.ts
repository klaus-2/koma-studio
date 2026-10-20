/**
 * Stage readiness — one policy for “can this AIO stage model run?”
 *
 * `resolveStageModelReadiness` / `ensureStageModelReadiness` /
 * `requireStageModelReadiness`: selection keys in → ready plan or typed
 * refusal (always a non-empty `message`). Model-manager opens ride on
 * `openModelManager`.
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
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
} from '../utils/customLlm';

export type StageReadinessStage =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
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
  | 'incompatible_language';

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

/**
 * Catalog input — never a silent tri-state.
 * `skip` when the call site has no stage catalog; `lookup` with `null` when
 * the key was looked up and missing.
 */
export type StageCatalogInput =
  | { readonly kind: 'skip' }
  | { readonly kind: 'lookup'; readonly option: AioStageOption | null };

export const skipStageCatalog = (): StageCatalogInput => ({ kind: 'skip' });

export const stageCatalogOption = (
  option: AioStageOption | null,
): StageCatalogInput => ({ kind: 'lookup', option });

export interface ReadinessRefusalSink {
  setStatusMessage?: (message: string) => void;
  openModelManagerForStage?: (
    stage: StageReadinessStage,
    options?: Record<string, unknown>,
  ) => void;
}

const INVALID_SELECTION_KEYS: Record<StageReadinessStage, string> = {
  detectText: 'aioManual.selectValidDetectModel',
  recognizeText: 'aioExec.selectValidOcrModel',
  getTranslations: 'aioExec.selectValidTranslation',
  segmentText: 'aioManual.selectValidSegmentModel',
  cleanImage: 'aioManual.selectValidCleanModel',
};

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
  stage: StageReadinessStage,
  option: AioStageOption | null,
  t: Translate,
): StageReadinessRefusal | null {
  if (!option) {
    return {
      ok: false,
      kind: 'option_missing',
      message: t(INVALID_SELECTION_KEYS[stage]),
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
  stage: StageReadinessStage,
  modelKey: string,
  customProfile: ReadinessCustomProfile | null,
  t: Translate,
): StageReadinessRefusal | null {
  if (!isCustomModelSelectionKey(modelKey)) {
    return null;
  }
  const isTranslation = stage === 'getTranslations';
  if (!customProfile) {
    return {
      ok: false,
      kind: 'custom_profile_missing',
      message: t(
        isTranslation
          ? 'aioExec.selectCustomAiProfile'
          : 'aioExec.selectCustomOcrProfile',
      ),
    };
  }
  if (
    requiresCustomLlmApiKey(customProfile.apiBase)
    && !customProfile.apiKey.trim()
  ) {
    return {
      ok: false,
      kind: 'custom_api_key_missing',
      message: t(
        isTranslation
          ? 'aioExec.translationRequiresApiKey'
          : 'aioExec.ocrRequiresApiKey',
      ),
    };
  }
  if (isTranslation) {
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

export function resolveStageModelReadiness(args: {
  stage: StageReadinessStage;
  stageLabel: string;
  modelKey: string;
  catalog: StageCatalogInput;
  modelEntries: Readonly<Record<string, LocalModelEntry | null | undefined>>;
  customProfile?: ReadinessCustomProfile | null;
  languages?: { source: string; target: string };
  t: Translate;
}): StageReadiness {
  const {
    stage,
    stageLabel,
    modelKey,
    catalog,
    modelEntries,
    customProfile = null,
    t,
  } = args;

  const option = catalog.kind === 'lookup' ? catalog.option : undefined;
  if (catalog.kind === 'lookup' && option === null) {
    return {
      ok: false,
      kind: 'option_missing',
      message: t(INVALID_SELECTION_KEYS[stage]),
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

  const catalogRefusal = refuseCatalogOption(stage, option ?? null, t);
  if (catalogRefusal) return catalogRefusal;

  const customRefusal = refuseCustomProfile(stage, modelKey, customProfile, t);
  if (customRefusal) return customRefusal;

  return readyPlanFor(stage, modelKey, option ?? null, customProfile);
}

/** Surface a refusal as status message + optional model-manager open. */
export function applyStageReadinessRefusal(
  refusal: StageReadinessRefusal,
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

/** Resolve + surface refusal as UI. Returns the ready plan or `null`. */
export function ensureStageModelReadiness(
  args: Parameters<typeof resolveStageModelReadiness>[0],
  sink: ReadinessRefusalSink,
): StageReadinessReady | null {
  const readiness = resolveStageModelReadiness(args);
  if (readiness.ok) return readiness;
  applyStageReadinessRefusal(readiness, sink);
  return null;
}

/** Resolve + throw on refusal (manual / Translator resolvers). */
export function requireStageModelReadiness(
  args: Parameters<typeof resolveStageModelReadiness>[0],
  sink: ReadinessRefusalSink = {},
): StageReadinessReady {
  const readiness = resolveStageModelReadiness(args);
  if (readiness.ok) return readiness;
  applyStageReadinessRefusal(readiness, {
    openModelManagerForStage: sink.openModelManagerForStage,
  });
  throw new Error(readiness.message);
}
