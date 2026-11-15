import {
  BASE_AIO_STAGE_OPTIONS,
  isLocalModelOptionKey,
} from '@/models/aioStageCatalog.data';
import type {
  AioDeviceInfo,
  AioStageOption,
  AioStageOptionMap,
} from '@/models/aioStageCatalog.types';
import { FREE_AI_PROVIDER_CATALOG_ENTRIES } from '@/models/freeAiProviderCatalog';
import { OFFICIAL_CLOUD_STAGE_OPTIONS } from '@/models/officialModelCatalog';
import type { ModelInstallState } from '@/models/types';
import {
  FULL_LLM_CAPABILITIES,
  parseFreeProviderProfileId,
  toCustomModelSelectionKey,
} from '@/utils/customLlm';
import type { CustomLlmProfile } from '@/utils/customLlm';

export {
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
} from '@/models/aioStageCatalog.data';
export { AIO_STAGE_KEYS } from '@/models/aioStageCatalog.types';
export type { AioDeviceInfo } from '@/models/aioStageCatalog.types';
export type {
  AioLanguageOption,
  AioStageOption,
  AioStageOptionMap,
} from '@/models/aioStageCatalog.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || typeof value === 'boolean';

/**
 * Matches the `/device/info` payload (mini-backend `build_device_payload`).
 * Unknown backend fields are stripped; `vram_gb`/`profile`/`fallback_reason`
 * may be null on CPU-only machines.
 */
const parseAioDeviceInfo = (value: unknown): AioDeviceInfo => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.has_gpu !== 'boolean' ||
    typeof value.provider !== 'string' ||
    !(value.vram_gb === null || typeof value.vram_gb === 'number') ||
    !(
      value.profile === undefined ||
      value.profile === null ||
      typeof value.profile === 'string'
    ) ||
    !(
      value.fallback_reason === undefined ||
      value.fallback_reason === null ||
      typeof value.fallback_reason === 'string'
    ) ||
    !(
      value.available_providers === undefined ||
      (Array.isArray(value.available_providers) &&
        value.available_providers.every((entry) => typeof entry === 'string'))
    ) ||
    !isOptionalBoolean(value.nvidia_cuda_available) ||
    !isOptionalBoolean(value.nvidia_tensorrt_available) ||
    !isOptionalBoolean(value.intel_openvino_available) ||
    !isOptionalBoolean(value.amd_rocm_available)
  ) {
    throw new Error('Invalid AIO device info payload.');
  }

  const info: AioDeviceInfo = {
    name: value.name,
    has_gpu: value.has_gpu,
    provider: value.provider,
    vram_gb: value.vram_gb,
  };

  if (typeof value.profile === 'string' || value.profile === null) {
    info.profile = value.profile;
  }
  if (typeof value.fallback_reason === 'string' || value.fallback_reason === null) {
    info.fallback_reason = value.fallback_reason;
  }
  if (Array.isArray(value.available_providers)) {
    info.available_providers = value.available_providers;
  }
  if (value.nvidia_cuda_available !== undefined) {
    info.nvidia_cuda_available = value.nvidia_cuda_available;
  }
  if (value.nvidia_tensorrt_available !== undefined) {
    info.nvidia_tensorrt_available = value.nvidia_tensorrt_available;
  }
  if (value.intel_openvino_available !== undefined) {
    info.intel_openvino_available = value.intel_openvino_available;
  }
  if (value.amd_rocm_available !== undefined) {
    info.amd_rocm_available = value.amd_rocm_available;
  }

  return info;
};

export const aioDeviceInfoSchema = { parse: parseAioDeviceInfo };

export type LocalModelEntry = Readonly<{
  status: ModelInstallState['status'];
  model: Readonly<Pick<ModelInstallState['model'], 'id' | 'name'>>;
}>;

export type LocalModelEntries = Readonly<Record<string, LocalModelEntry>>;

/**
 * UI option key -> backend `/translate/models` key for the service engines
 * whose availability depends on the user's configured key/URL. Registry
 * models are deliberately absent: their availability follows the install
 * state, not this endpoint.
 */
export const TRANSLATION_SERVICE_BACKEND_KEYS: Readonly<
  Record<string, string>
> = {
  deepl_translate: 'deepl',
  libretranslate: 'libretranslate',
};

export type TranslationServiceAvailability = Readonly<Record<string, boolean>>;

/**
 * Defensive read of the `/translate/models` payload
 * (`{models: [{key, implemented, available, ...}]}`); maps backend keys onto
 * the UI service options and returns null for any other shape so callers
 * keep the static catalog defaults.
 */
export function parseTranslationServiceAvailability(
  payload: unknown,
): TranslationServiceAvailability | null {
  if (!isRecord(payload) || !Array.isArray(payload.models)) {
    return null;
  }

  const uiKeyByBackendKey = new Map(
    Object.entries(TRANSLATION_SERVICE_BACKEND_KEYS).map(
      ([uiKey, backendKey]) => [backendKey, uiKey],
    ),
  );
  const availability: Record<string, boolean> = {};

  for (const entry of payload.models) {
    if (
      !isRecord(entry) ||
      typeof entry.key !== 'string' ||
      typeof entry.available !== 'boolean'
    ) {
      continue;
    }
    const uiKey = uiKeyByBackendKey.get(entry.key);
    if (uiKey !== undefined) {
      availability[uiKey] = entry.available;
    }
  }

  return availability;
}

interface BuildAioStageCatalogOptions {
  readonly sourceLanguage: string;
  readonly localModelEntries?: Readonly<Record<string, ModelInstallState>>;
  readonly customProfiles?: readonly CustomLlmProfile[];
  readonly translationServiceAvailability?: TranslationServiceAvailability;
}

export function isInstalledLocalModel(
  modelKey: string,
  entries: LocalModelEntries,
): boolean {
  const status = entries[modelKey]?.status;
  return status === 'installed' || status === 'update_available';
}

export function isStageOptionSelectable(
  option: AioStageOption | null | undefined,
  entries: LocalModelEntries,
): boolean {
  if (
    !option ||
    !option.implemented ||
    option.key === 'custom' ||
    option.key === 'custom_ocr'
  ) {
    return false;
  }

  if (isLocalModelOptionKey(option.key) || entries[option.key]) {
    return isInstalledLocalModel(option.key, entries);
  }

  return option.available;
}

function cloneStageOption(option: AioStageOption): AioStageOption {
  return {
    ...option,
    ...(option.languages ? { languages: [...option.languages] } : {}),
    ...(option.llm_capabilities
      ? { llm_capabilities: { ...option.llm_capabilities } }
      : {}),
  };
}

export function mergeStageOptions(
  base: readonly AioStageOption[],
  incoming: readonly AioStageOption[],
): AioStageOption[] {
  const byKey = new Map<string, AioStageOption>();

  for (const option of base) {
    byKey.set(option.key, cloneStageOption(option));
  }

  for (const option of incoming) {
    const previous = byKey.get(option.key);
    byKey.set(
      option.key,
      cloneStageOption(previous ? { ...previous, ...option } : option),
    );
  }

  return [...byKey.values()];
}

function normalizeLanguageCode(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', '-');
}

export function ocrStageOptionSupportsLanguage(
  option: AioStageOption,
  sourceLanguage: string,
): boolean {
  const source = normalizeLanguageCode(sourceLanguage);
  const languages = (option.languages ?? [])
    .map(normalizeLanguageCode)
    .filter(Boolean);

  if (languages.length === 0 || languages.includes('multi')) {
    return true;
  }

  if (languages.includes(source)) {
    return true;
  }

  if (source === 'zh') {
    return languages.includes('zh-cn') || languages.includes('zh-tw');
  }

  if (source === 'zh-cn' || source === 'zh-tw') {
    return languages.includes('zh');
  }

  return source === 'pt-br' && languages.includes('pt');
}

export function buildCustomStageOption(
  profile: CustomLlmProfile,
): AioStageOption {
  const option: AioStageOption = {
    key: toCustomModelSelectionKey(profile),
    name: profile.label,
    device: 'cloud',
    use_case: `Custom AI salvo (${profile.model})`,
    languages: ['multi'],
    available: true,
    implemented: true,
    llm_capabilities: { ...FULL_LLM_CAPABILITIES },
  };

  const metadata = parseFreeProviderProfileId(profile.id);
  if (!metadata) return option;

  const provider = FREE_AI_PROVIDER_CATALOG_ENTRIES.find(
    (candidate) => candidate.id === metadata.providerId,
  );
  const stage = provider?.stages[metadata.stage];
  if (!provider || !stage) return option;

  option.provider_id = provider.id;
  option.provider_name = provider.name;
  option.provider_status = provider.status;

  if (stage.requiresUserApiKey !== undefined) {
    option.requires_user_api_key = stage.requiresUserApiKey;
  }
  if (stage.defaultApiBase !== undefined) {
    option.default_api_base = stage.defaultApiBase;
  }
  if (stage.defaultModel !== undefined) {
    option.default_model = stage.defaultModel;
  }
  if (provider.docsUrl !== undefined) {
    option.docs_url = provider.docsUrl;
  }
  if (provider.limitsSummary !== undefined) {
    option.limits_summary = provider.limitsSummary;
  }
  if (provider.rateLimitSummary !== undefined) {
    option.rate_limit_summary = provider.rateLimitSummary;
  }
  if (provider.setupSummary !== undefined) {
    option.setup_summary = provider.setupSummary;
  }

  return option;
}

// Official cloud options are "managed": the data ships available:false and the
// runtime availability comes from implemented (decorated below). Local model
// availability follows the install state instead.
const MANAGED_CLOUD_OPTION_KEYS: ReadonlySet<string> = new Set([
  ...OFFICIAL_CLOUD_STAGE_OPTIONS.recognizeText.map((option) => option.key),
  ...OFFICIAL_CLOUD_STAGE_OPTIONS.getTranslations.map((option) => option.key),
]);

function decorateOption(
  option: AioStageOption,
  entries: LocalModelEntries,
  translationServiceAvailability: TranslationServiceAvailability,
): AioStageOption {
  const cloned = cloneStageOption(option);

  if (MANAGED_CLOUD_OPTION_KEYS.has(option.key)) {
    cloned.available = option.implemented;
    return cloned;
  }

  if (isLocalModelOptionKey(option.key) || entries[option.key]) {
    cloned.available =
      option.implemented && isInstalledLocalModel(option.key, entries);
  } else if (option.key in TRANSLATION_SERVICE_BACKEND_KEYS) {
    const available = translationServiceAvailability[option.key];
    cloned.available =
      option.implemented && (available ?? option.available);
  } else {
    cloned.available = option.implemented && option.available;
  }

  return cloned;
}

function createBaseCatalog(
  entries: LocalModelEntries,
  translationServiceAvailability: TranslationServiceAvailability = {},
): AioStageOptionMap {
  const decorate = (option: AioStageOption): AioStageOption =>
    decorateOption(option, entries, translationServiceAvailability);

  return {
    detectText: BASE_AIO_STAGE_OPTIONS.detectText.map(decorate),
    recognizeText: mergeStageOptions(
      BASE_AIO_STAGE_OPTIONS.recognizeText,
      OFFICIAL_CLOUD_STAGE_OPTIONS.recognizeText,
    ).map(decorate),
    getTranslations: mergeStageOptions(
      BASE_AIO_STAGE_OPTIONS.getTranslations,
      [],
    ).map(decorate),
    segmentText: BASE_AIO_STAGE_OPTIONS.segmentText.map(decorate),
    cleanImage: BASE_AIO_STAGE_OPTIONS.cleanImage.map(decorate),
  };
}

export const DEFAULT_AIO_STAGE_OPTIONS: AioStageOptionMap =
  createBaseCatalog({});

export function buildAioStageCatalog({
  sourceLanguage,
  localModelEntries = {},
  customProfiles = [],
  translationServiceAvailability = {},
}: BuildAioStageCatalogOptions): AioStageOptionMap {
  const catalog = createBaseCatalog(
    localModelEntries,
    translationServiceAvailability,
  );
  const customTranslationOptions: AioStageOption[] = [];
  const customOcrOptions: AioStageOption[] = [];

  for (const profile of customProfiles) {
    if (profile.stage === 'translation') {
      customTranslationOptions.push(buildCustomStageOption(profile));
    } else if (profile.stage === 'ocr') {
      customOcrOptions.push(buildCustomStageOption(profile));
    }
  }

  return {
    ...catalog,
    recognizeText: mergeStageOptions(
      catalog.recognizeText,
      customOcrOptions,
    ).filter((option) =>
      ocrStageOptionSupportsLanguage(option, sourceLanguage),
    ),
    getTranslations: mergeStageOptions(
      catalog.getTranslations,
      customTranslationOptions,
    ),
  };
}
