export type FreeProviderStatus = "integrated" | "catalog_only";
export type FreeProviderStage = "translation" | "ocr" | "clean";
export type FreeProviderAccessType =
  | "free"
  | "trial"
  | "credit"
  | "copilot"
  | "paid"
  | "mixed"
  | "unknown";
export type FreeProviderTransport =
  | "openai_compatible"
  | "gemini_native"
  | "nlp_cloud_chatbot"
  | "ollama_native"
  | "replicate"
  | "fal"
  | "stability"
  | "cloudflare_native"
  | "unsupported";

export type ImageEditCapability = "clean_and_aio_ai" | "clean_only";

export interface FreeProviderModelDefinition {
  id: string;
  label: string;
  apiModel: string;
  notes?: string;
  accessType?: FreeProviderAccessType;
  accessBadgeLabel?: string;
  rateLimitSummary?: string;
  sourceUrl?: string;
  imageEditCapability?: ImageEditCapability;
  recommendedFor?: ReadonlyArray<"clean" | "aio_ai">;
}

export interface FreeProviderConfigField {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
}

export interface FreeProviderStageDefinition {
  stage: FreeProviderStage;
  requiresUserApiKey: boolean;
  transport: FreeProviderTransport;
  apiBaseTemplate: string;
  defaultApiBase: string;
  defaultModel: string;
  configFields: FreeProviderConfigField[];
  models: FreeProviderModelDefinition[];
  allowCustomModelInput?: boolean;
  modelInputPlaceholder?: string;
}

export interface FreeAiProviderCatalogEntry {
  id: string;
  name: string;
  status: FreeProviderStatus;
  lastVerifiedAt: string;
  docsUrl: string;
  setupUrl: string;
  limitsUrl: string;
  rateLimitsUrl: string;
  setupSummary: string;
  limitsSummary: string;
  rateLimitSummary: string;
  accessType?: FreeProviderAccessType;
  accessBadgeLabel?: string;
  accessSummary?: string;
  dataPolicyNotice?: string;
  verificationNotice?: string;
  sourceUrl?: string;
  stages: Partial<Record<FreeProviderStage, FreeProviderStageDefinition>>;
}
