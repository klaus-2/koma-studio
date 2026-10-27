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

interface BuildAioStageCatalogOptions {
  readonly sourceLanguage: string;
  readonly localModelEntries?: Readonly<Record<string, ModelInstallState>>;
  readonly customProfiles?: readonly CustomLlmProfile[];
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
): AioStageOption {
  const cloned = cloneStageOption(option);

  if (MANAGED_CLOUD_OPTION_KEYS.has(option.key)) {
    cloned.available = option.implemented;
    return cloned;
  }

  if (isLocalModelOptionKey(option.key) || entries[option.key]) {
    cloned.available =
      option.implemented && isInstalledLocalModel(option.key, entries);
  } else {
    cloned.available = option.implemented && option.available;
  }

  return cloned;
}

function createBaseCatalog(entries: LocalModelEntries): AioStageOptionMap {
  return {
    detectText: BASE_AIO_STAGE_OPTIONS.detectText.map((option) =>
      decorateOption(option, entries),
    ),
    recognizeText: mergeStageOptions(
      BASE_AIO_STAGE_OPTIONS.recognizeText,
      OFFICIAL_CLOUD_STAGE_OPTIONS.recognizeText,
    ).map((option) => decorateOption(option, entries)),
    getTranslations: mergeStageOptions(
      BASE_AIO_STAGE_OPTIONS.getTranslations,
      [],
    ).map((option) => decorateOption(option, entries)),
    segmentText: BASE_AIO_STAGE_OPTIONS.segmentText.map((option) =>
      decorateOption(option, entries),
    ),
    cleanImage: BASE_AIO_STAGE_OPTIONS.cleanImage.map((option) =>
      decorateOption(option, entries),
    ),
  };
}

export const DEFAULT_AIO_STAGE_OPTIONS: AioStageOptionMap =
  createBaseCatalog({});

export function buildAioStageCatalog({
  sourceLanguage,
  localModelEntries = {},
  customProfiles = [],
}: BuildAioStageCatalogOptions): AioStageOptionMap {
  const catalog = createBaseCatalog(localModelEntries);
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
