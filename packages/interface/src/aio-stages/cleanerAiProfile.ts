import {
  findCustomProfileForSelection,
  normalizeKnownCustomLlmApiBase,
  requiresCustomLlmApiKey,
  resolveCleanProtocolForApiBase,
  type CleanProtocol,
  type CustomLlmProfile,
  type CustomLlmRequestProfile,
} from '../utils/customLlm';
import {
  getLocalImageEditSpec,
  isLocalImageEditModelKey,
  type LocalImageEditModelId,
} from '../utils/imageEditLocalModels';
import type { ReadinessCustomProfile, Translate } from './readiness';

export interface CleanerAiProfileReadinessReady {
  ok: true;
  customPayload: ReadinessCustomProfile | null;
}

export interface CleanerAiProfileReadinessRefusal {
  ok: false;
  kind: 'custom_cleaner_incomplete' | 'custom_cleaner_requires_api_key';
  message: string;
}

export type CleanerAiProfileReadiness =
  | CleanerAiProfileReadinessReady
  | CleanerAiProfileReadinessRefusal;

export function resolveCleanerAiProfileReadiness(args: {
  isCustomCleanerAi: boolean;
  profile: {
    apiBase: string;
    model?: string;
    apiKey: string;
  } | null;
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
      message:
        'Fill in API Base and Model before running Automatic AI Clean with AI Custom.',
    };
  }
  if (requiresCustomLlmApiKey(normalizedApiBase) && !normalizedApiKey) {
    return {
      ok: false,
      kind: 'custom_cleaner_requires_api_key',
      message:
        'This AI Custom provider requires an API key for Automatic AI Clean.',
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

export type AioCleanAiReadinessRefusalKind =
  | 'aio_clean_ai_model_missing'
  | 'aio_clean_ai_profile_missing'
  | 'aio_clean_ai_api_key_missing'
  | 'aio_clean_ai_local_not_installed';

export interface AioCleanAiReadinessReady {
  ok: true;
  modelKey: string;
  customProfile: CustomLlmRequestProfile | null;
  localModelId?: LocalImageEditModelId;
}

export interface AioCleanAiReadinessRefusal {
  ok: false;
  kind: AioCleanAiReadinessRefusalKind;
  message: string;
}

export type AioCleanAiReadiness =
  | AioCleanAiReadinessReady
  | AioCleanAiReadinessRefusal;

const AIO_CLEAN_AI_SELECTION_PREFIX = 'custom_clean:';

const isAioCleanAiSelectionKey = (value: string): boolean =>
  (value.startsWith(AIO_CLEAN_AI_SELECTION_PREFIX)
    && value.slice(AIO_CLEAN_AI_SELECTION_PREFIX.length).trim().length > 0)
  || isLocalImageEditModelKey(value);

export function resolveAioCleanAiReadiness(args: {
  modelKey: string;
  profiles: CustomLlmProfile[];
  modelEntries?: Record<string, { status: string } | undefined>;
  t: Translate;
}): AioCleanAiReadiness {
  const modelKey = args.modelKey.trim();

  if (!isAioCleanAiSelectionKey(modelKey)) {
    return {
      ok: false,
      kind: 'aio_clean_ai_model_missing',
      message: args.t('dashboard.aio.clean.aiClean.readiness.selectModel'),
    };
  }

  if (isLocalImageEditModelKey(modelKey)) {
    const spec = getLocalImageEditSpec(modelKey);
    if (!spec) {
      return {
        ok: false,
        kind: 'aio_clean_ai_model_missing',
        message: args.t('dashboard.aio.clean.aiClean.readiness.selectModel'),
      };
    }
    if (args.modelEntries && args.modelEntries[spec.id]?.status !== 'installed') {
      return {
        ok: false,
        kind: 'aio_clean_ai_local_not_installed',
        message: args.t('dashboard.aio.clean.aiClean.readiness.localNotInstalled', {
          model: spec.name,
        }),
      };
    }
    return {
      ok: true,
      modelKey,
      customProfile: null,
      localModelId: spec.id,
    };
  }

  const profile = findCustomProfileForSelection(modelKey, args.profiles);
  if (!profile || !profile.apiBase.trim() || !profile.model.trim()) {
    return {
      ok: false,
      kind: 'aio_clean_ai_profile_missing',
      message: args.t('dashboard.aio.clean.aiClean.readiness.profileMissing'),
    };
  }

  const apiBase = normalizeKnownCustomLlmApiBase(profile.apiBase);
  if (requiresCustomLlmApiKey(apiBase) && !profile.apiKey.trim()) {
    return {
      ok: false,
      kind: 'aio_clean_ai_api_key_missing',
      message: args.t('dashboard.aio.clean.aiClean.readiness.apiKeyMissing'),
    };
  }

  const protocol: CleanProtocol =
    profile.protocol ?? resolveCleanProtocolForApiBase(apiBase);

  return {
    ok: true,
    modelKey,
    customProfile: {
      apiBase,
      apiKey: profile.apiKey.trim(),
      model: profile.model.trim(),
      protocol,
    },
  };
}
