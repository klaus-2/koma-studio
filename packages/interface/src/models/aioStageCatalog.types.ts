import type { AioStageKey } from '@/types/aioModelPresets';
import type { LlmCapabilities } from '@/utils/customLlm';

export interface AioStageOption {
  key: string;
  name: string;
  device: string;
  use_case: string;
  languages?: string[];
  available: boolean;
  implemented: boolean;
  provider_id?: string;
  provider_name?: string;
  provider_status?: 'integrated' | 'catalog_only';
  requires_user_api_key?: boolean;
  default_api_base?: string;
  default_model?: string;
  docs_url?: string;
  limits_summary?: string;
  rate_limit_summary?: string;
  setup_summary?: string;
  llm_capabilities?: LlmCapabilities;
}

export interface AioLanguageOption {
  value: string;
  label: string;
}

export interface AioDeviceInfo {
  name: string;
  has_gpu: boolean;
  provider: string;
  vram_gb: number | null;
  profile?: string | null;
  fallback_reason?: string | null;
  available_providers?: string[];
  nvidia_cuda_available?: boolean;
  nvidia_tensorrt_available?: boolean;
  intel_openvino_available?: boolean;
  amd_rocm_available?: boolean;
}

export type AioStageOptionMap = Record<AioStageKey, AioStageOption[]>;

export const AIO_STAGE_KEYS: readonly AioStageKey[] = [
  'detectText',
  'recognizeText',
  'getTranslations',
  'segmentText',
  'cleanImage',
];
