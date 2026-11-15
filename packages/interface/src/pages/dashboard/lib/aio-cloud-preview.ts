import type { CustomLlmProfile } from '@/utils/customLlm';
import {
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  isCustomModelSelectionKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
} from '@/utils/customLlm';

export interface CloudPreviewStageInput {
  readonly aioSteps: Readonly<{
    recognizeText: boolean;
    getTranslations: boolean;
  }>;
  readonly ocrModelKey: string | null;
  readonly translationModelKey: string | null;
  readonly customTranslationProfile: CustomLlmProfile | null;
  readonly customOcrProfile: CustomLlmProfile | null;
}

export interface RemoteStageDestination {
  readonly stage: 'ocr' | 'translation';
  readonly provider: string;
  readonly providerLabel: string;
  readonly apiBase: string | null;
  readonly source: 'builtin' | 'custom';
  readonly modelKey: string;
}

export interface CloudPreviewGate {
  readonly required: boolean;
  readonly ocr: RemoteStageDestination | null;
  readonly translation: RemoteStageDestination | null;
}

const DIALOG_ASK_STORAGE_KEY = 'koma.aio.cloudPreview.ask';
const DIALOG_SKIP_STORAGE_PREFIX = 'koma.aio.cloudPreview.skip.';

export function shouldAskCloudPreview(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return localStorage.getItem(DIALOG_ASK_STORAGE_KEY) !== 'false';
}

export function setAskCloudPreview(ask: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(DIALOG_ASK_STORAGE_KEY, String(ask));
}

export function loadSkipCloudPreviewProviders(): ReadonlySet<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  const skipped = new Set<string>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key !== null && key.startsWith(DIALOG_SKIP_STORAGE_PREFIX)) {
      skipped.add(key.slice(DIALOG_SKIP_STORAGE_PREFIX.length));
    }
  }
  return skipped;
}

export function skipCloudPreviewForProvider(provider: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(
    `${DIALOG_SKIP_STORAGE_PREFIX}${provider}`,
    'true',
  );
}

export function isCloudPreviewSuppressed(providers: readonly string[]): boolean {
  if (!shouldAskCloudPreview()) {
    return true;
  }
  const skipped = loadSkipCloudPreviewProviders();
  return providers.every((provider) => skipped.has(provider));
}

const buildOcrDestination = (
  modelKey: string,
  profile: CustomLlmProfile | null,
): RemoteStageDestination | null => {
  if (modelKey.startsWith('custom_ocr:')) {
    if (profile !== null) {
      if (shouldUseLocalDesktopTranslationForCustomProfile(profile)) {
        return null;
      }
      return {
        stage: 'ocr',
        provider: profile.id,
        providerLabel: profile.label,
        apiBase: profile.apiBase,
        source: 'custom',
        modelKey,
      };
    }
    return {
      stage: 'ocr',
      provider: modelKey.slice('custom_ocr:'.length),
      providerLabel: '',
      apiBase: null,
      source: 'custom',
      modelKey,
    };
  }
  return {
    stage: 'ocr',
    provider: modelKey,
    providerLabel: modelKey,
    apiBase: null,
    source: 'builtin',
    modelKey,
  };
};

export function resolveCloudPreviewGate(
  input: CloudPreviewStageInput,
): CloudPreviewGate {
  const ocr =
    input.aioSteps.recognizeText &&
    input.ocrModelKey !== null &&
    isCloudOcrModelKey(input.ocrModelKey)
      ? buildOcrDestination(input.ocrModelKey, input.customOcrProfile)
      : null;

  let translation: RemoteStageDestination | null = null;
  if (input.aioSteps.getTranslations && input.translationModelKey !== null) {
    if (isCustomModelSelectionKey(input.translationModelKey)) {
      const profile = input.customTranslationProfile;
      if (
        profile !== null &&
        !shouldUseLocalDesktopTranslationForCustomProfile(profile)
      ) {
        translation = {
          stage: 'translation',
          provider: profile.id,
          providerLabel: profile.label,
          apiBase: profile.apiBase,
          source: 'custom',
          modelKey: input.translationModelKey,
        };
      }
    } else if (isCloudTranslationModelKey(input.translationModelKey)) {
      translation = {
        stage: 'translation',
        provider: input.translationModelKey,
        providerLabel: input.translationModelKey,
        apiBase: null,
        source: 'builtin',
        modelKey: input.translationModelKey,
      };
    }
  }

  return {
    required: ocr !== null || translation !== null,
    ocr,
    translation,
  };
}
