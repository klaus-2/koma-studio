import type { LlmCapabilities } from "../../utils/customLlm";

export interface AioStageModelOption {
  key: string;
  name: string;
  device: string;
  use_case: string;
  languages?: string[];
  available: boolean;
  implemented: boolean;
  provider_id?: string;
  provider_name?: string;
  provider_status?: "integrated" | "catalog_only";
  requires_user_api_key?: boolean;
  default_api_base?: string;
  default_model?: string;
  docs_url?: string;
  limits_summary?: string;
  rate_limit_summary?: string;
  setup_summary?: string;
  llm_capabilities?: LlmCapabilities;
}

export interface LegacyTranslationOption {
  key: string;
  name: string;
  languages?: string[];
  available: boolean;
  implemented: boolean;
  provider_id?: string;
  provider_name?: string;
  provider_status?: "integrated" | "catalog_only";
  requires_user_api_key?: boolean;
  default_api_base?: string;
  default_model?: string;
  docs_url?: string;
  limits_summary?: string;
  rate_limit_summary?: string;
  setup_summary?: string;
  llm_capabilities?: LlmCapabilities;
}
