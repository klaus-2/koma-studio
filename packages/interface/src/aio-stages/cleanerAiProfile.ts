/**
 * Cleaner AI Custom profile — API Base + Model + API key policy for
 * Automatic AI Clean / AI SFX.
 */
import {
  normalizeKnownCustomLlmApiBase,
  requiresCustomLlmApiKey,
} from '../utils/customLlm';
import type { ReadinessCustomProfile } from './readiness';

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
