import {
  LOCAL_AIO_MODELS_REGISTRY,
  modelStageLabel,
} from "./translation-models-registry";
import {
  FREE_AI_PROVIDER_CATALOG_ENTRIES,
  type FreeProviderStage,
} from "./freeAiProviderCatalog";
import { FULL_LLM_CAPABILITIES, type LlmCapabilities } from "../utils/customLlm";
import type {
  AioLocalModelStage,
  ModelSpeedRating,
  TranslationModelRequirements,
} from "./types";

export type OfficialModelSourceType = "local" | "cloud";

export interface DashboardStageOptionDefinition {
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

export interface OfficialModelCatalogEntry {
  id: string;
  name: string;
  description: string;
  stage: AioLocalModelStage;
  stageLabel: string;
  sourceType: OfficialModelSourceType;
  sourceLanguages: string[];
  targetLanguages: string[];
  speed: ModelSpeedRating | "variable";
  runtimeLabel: string;
  requirements: TranslationModelRequirements | null;
  recommended: boolean;
  notes?: string;
}

interface OfficialCloudModelDefinition {
  id: string;
  name: string;
  stage: AioLocalModelStage;
  description: string;
  runtimeLabel: string;
  notes?: string;
  dashboardStage: "recognizeText" | "getTranslations";
  dashboardOption: DashboardStageOptionDefinition;
}

const OFFICIAL_CLOUD_MODEL_DEFINITIONS: OfficialCloudModelDefinition[] = [
  {
    id: "gpt_4_1_mini_ocr",
    name: "GPT-4.1-mini OCR",
    stage: "recognizeText",
    description: "Cloud multimodal OCR via OpenAI, suited to complex pages and visual noise.",
    runtimeLabel: "Cloud API",
    dashboardStage: "recognizeText",
    dashboardOption: {
      key: "gpt_4_1_mini_ocr",
      name: "GPT-4.1-mini OCR",
      device: "cloud",
      use_case: "Cloud multimodal OCR via OpenAI.",
      languages: ["multi"],
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "gemini_2_0_flash_ocr",
    name: "Gemini-2.5-Flash OCR",
    stage: "recognizeText",
    description: "Cloud multimodal OCR via Gemini 2.5 Flash, avoiding the 2.0 line already marked as deprecated.",
    runtimeLabel: "Cloud API",
    dashboardStage: "recognizeText",
    dashboardOption: {
      key: "gemini_2_0_flash_ocr",
      name: "Gemini-2.5-Flash OCR",
      device: "cloud",
      use_case: "Cloud multimodal OCR via Gemini.",
      languages: ["multi"],
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "google_cloud_vision",
    name: "Google OCR",
    stage: "recognizeText",
    description: "Cloud OCR via Google Cloud Vision, for pipelines that rely on the Google stack.",
    runtimeLabel: "Cloud API",
    dashboardStage: "recognizeText",
    dashboardOption: {
      key: "google_cloud_vision",
      name: "Google OCR",
      device: "cloud",
      use_case: "Cloud OCR via Google Cloud Vision.",
      languages: ["multi"],
      available: false,
      implemented: true,
    },
  },
  {
    id: "microsoft_vision",
    name: "Microsoft OCR",
    stage: "recognizeText",
    description: "Cloud OCR via Azure AI Vision, suited to enterprise workflows on the Microsoft stack.",
    runtimeLabel: "Cloud API",
    dashboardStage: "recognizeText",
    dashboardOption: {
      key: "microsoft_vision",
      name: "Microsoft OCR",
      device: "cloud",
      use_case: "Cloud OCR via Azure AI Vision.",
      languages: ["multi"],
      available: false,
      implemented: true,
    },
  },
  {
    id: "grok_2_vision_ocr",
    name: "Grok 4 OCR",
    stage: "recognizeText",
    description: "Cloud multimodal OCR via Grok 4, replacing the older Grok 2 Vision.",
    runtimeLabel: "Cloud API",
    dashboardStage: "recognizeText",
    dashboardOption: {
      key: "grok_2_vision_ocr",
      name: "Grok 4 OCR",
      device: "cloud",
      use_case: "Cloud multimodal OCR via Grok.",
      languages: ["multi"],
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "z_ai_glm_4_5v_ocr",
    name: "Z.AI GLM-4.5V OCR",
    stage: "recognizeText",
    description: "Cloud multimodal OCR via Z.AI for scenarios needing broader visual interpretation.",
    runtimeLabel: "Cloud API",
    dashboardStage: "recognizeText",
    dashboardOption: {
      key: "z_ai_glm_4_5v_ocr",
      name: "Z.AI GLM-4.5V OCR",
      device: "cloud",
      use_case: "Cloud multimodal OCR via Z.AI.",
      languages: ["multi"],
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "gpt_4_1_mini",
    name: "GPT-4.1-mini",
    stage: "translation",
    description: "Cloud translation via OpenAI, focused on cost and low latency.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "gpt_4_1_mini",
      name: "GPT-4.1-mini",
      device: "cpu_gpu",
      use_case: "Cloud translation AI",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "gpt_4_1",
    name: "GPT-4.1",
    stage: "translation",
    description: "Cloud translation via OpenAI with a larger context window and greater consistency.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "gpt_4_1",
      name: "GPT-4.1",
      device: "cpu_gpu",
      use_case: "Cloud translation AI with more context",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "gemini_2_5_flash",
    name: "Gemini 2.5 Flash",
    stage: "translation",
    description: "Cloud translation via Gemini, with a fast multimodal profile.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "gemini_2_5_flash",
      name: "Gemini 2.5 Flash",
      device: "cpu_gpu",
      use_case: "Cloud multimodal AI (Google Gemini)",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "gemini_2_5_pro",
    name: "Gemini 2.5 Pro",
    stage: "translation",
    description: "Cloud translation via Gemini with deeper context.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "gemini_2_5_pro",
      name: "Gemini 2.5 Pro",
      device: "cpu_gpu",
      use_case: "Cloud AI with an extended context window (Google Gemini)",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "claude_3_5_haiku",
    name: "Claude Haiku 4.5",
    stage: "translation",
    description: "Cloud translation via Claude Haiku 4.5, Anthropic's current fast line.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "claude_3_5_haiku",
      name: "Claude Haiku 4.5",
      device: "cpu_gpu",
      use_case: "Fast cloud AI (Anthropic Claude)",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "claude_3_7_sonnet",
    name: "Claude Sonnet 4.6",
    stage: "translation",
    description: "Cloud translation via Claude Sonnet 4.6, the current generation recommended by Anthropic.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "claude_3_7_sonnet",
      name: "Claude Sonnet 4.6",
      device: "cpu_gpu",
      use_case: "Cloud AI with a better context window (Anthropic Claude 4.6)",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "deepseek_v3",
    name: "Deepseek-v3",
    stage: "translation",
    description: "Cloud translation via DeepSeek for cost-sensitive workflows.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "deepseek_v3",
      name: "Deepseek-v3",
      device: "cpu_gpu",
      use_case: "Cloud translation AI via Deepseek.",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "grok_2_vision",
    name: "Grok 4",
    stage: "translation",
    description: "Cloud multimodal translation via Grok 4, replacing the older Grok 2 Vision.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "grok_2_vision",
      name: "Grok 4",
      device: "cpu_gpu",
      use_case: "Cloud multimodal AI via Grok.",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
  {
    id: "z_ai_glm_4_5v",
    name: "Z.AI GLM-4.5V",
    stage: "translation",
    description: "Cloud multimodal translation via Z.AI for image-heavy, wide-context tasks.",
    runtimeLabel: "Cloud API",
    dashboardStage: "getTranslations",
    dashboardOption: {
      key: "z_ai_glm_4_5v",
      name: "Z.AI GLM-4.5V",
      device: "cpu_gpu",
      use_case: "Cloud multimodal AI via Z.AI.",
      available: false,
      implemented: true,
      llm_capabilities: FULL_LLM_CAPABILITIES,
    },
  },
];

export const OFFICIAL_CLOUD_STAGE_OPTIONS: Record<
  "recognizeText" | "getTranslations",
  DashboardStageOptionDefinition[]
> = {
  recognizeText: OFFICIAL_CLOUD_MODEL_DEFINITIONS
    .filter((entry) => entry.dashboardStage === "recognizeText")
    .map((entry) => entry.dashboardOption),
  getTranslations: OFFICIAL_CLOUD_MODEL_DEFINITIONS
    .filter((entry) => entry.dashboardStage === "getTranslations")
    .map((entry) => entry.dashboardOption),
};

const localCatalogEntries: OfficialModelCatalogEntry[] = LOCAL_AIO_MODELS_REGISTRY.map((model) => ({
  id: model.id,
  name: model.name,
  description: model.description,
  stage: model.stage,
  stageLabel: modelStageLabel(model.stage),
  sourceType: "local",
  sourceLanguages: model.sourceLanguages,
  targetLanguages: model.targetLanguages,
  speed: model.speed,
  runtimeLabel: model.requirements.gpu ? "Local install (CPU/GPU)" : "Local install (CPU)",
  requirements: model.requirements,
  recommended: Boolean(model.recommended),
  notes: model.notes,
}));

const cloudCatalogEntries: OfficialModelCatalogEntry[] = OFFICIAL_CLOUD_MODEL_DEFINITIONS.map((model) => ({
  id: model.id,
  name: model.name,
  description: model.description,
  stage: model.stage,
  stageLabel: modelStageLabel(model.stage),
  sourceType: "cloud",
  sourceLanguages: ["*"],
  targetLanguages: ["*"],
  speed: "variable",
  runtimeLabel: model.runtimeLabel,
  requirements: null,
  recommended: false,
  notes: model.notes,
}));

const FREE_PROVIDER_TRANSLATION_IDS = [
  "openrouter",
  "groq",
  "huggingface_router",
  "cerebras",
  "google_ai_studio",
  "nvidia_nim",
  "mistral_plateforme",
  "mistral_codestral",
  "vercel_ai_gateway",
  "cohere",
  "github_models",
  "cloudflare_workers_ai",
  "zhipu_ai",
  "llm7_io",
  "kluster_ai",
  "siliconflow",
  "ollama_cloud",
  "google_cloud_vertex_ai",
  "fireworks",
  "baseten",
  "nebius",
  "novita",
  "ai21",
  "upstage",
  "nlp_cloud",
  "alibaba_model_studio",
  "modal",
  "inference_net",
  "hyperbolic",
  "sambanova_cloud",
  "scaleway_generative_apis",
] as const;

const FREE_PROVIDER_CLEAN_IDS = new Set([
  "openrouter",
  "huggingface_router",
  "google_ai_studio",
  "replicate",
]);

const FREE_PROVIDER_OCR_IDS = new Set([
  "openrouter",
  "groq",
  "huggingface_router",
  "google_ai_studio",
  "cohere",
  "github_models",
  "cloudflare_workers_ai",
  "zhipu_ai",
  "siliconflow",
  "google_cloud_vertex_ai",
  "hyperbolic",
  "scaleway_generative_apis",
]);

const toFreeProviderRankingModelId = (
  providerId: string,
  stage: FreeProviderStage,
): string => (
  stage === "translation"
    ? `custom:free::${providerId}::translation`
    : stage === "clean"
      ? `custom_clean:free::${providerId}::clean`
      : `custom_ocr:free::${providerId}::ocr`
);

const buildFreeProviderCatalogEntry = (
  providerId: string,
  providerName: string,
  stage: FreeProviderStage,
  definition: { defaultModel: string; models: Array<unknown> },
): OfficialModelCatalogEntry => {
  const catalogStage: AioLocalModelStage = stage === "translation" ? "translation" : stage === "clean" ? "cleanImage" : "recognizeText";
  const stageName = stage === "translation" ? "Translation" : stage === "clean" ? "Cleaning" : "OCR";
  return {
    id: toFreeProviderRankingModelId(providerId, stage),
    name: `${providerName} (FREE - ${stageName})`,
    description: `${providerName} FREE custom (${stageName}). Default model: ${definition.defaultModel}. Catalog: ${definition.models.length} models.`,
    stage: catalogStage,
    stageLabel: modelStageLabel(catalogStage),
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
    speed: "variable",
    runtimeLabel: "Cloud API (FREE provider custom)",
    requirements: null,
    recommended: false,
  };
};

const freeProviderCatalogEntries: OfficialModelCatalogEntry[] = FREE_PROVIDER_TRANSLATION_IDS.flatMap((providerId) => {
  const provider = FREE_AI_PROVIDER_CATALOG_ENTRIES.find((entry) => entry.id === providerId);
  if (!provider || provider.status !== "integrated") {
    return [];
  }

  const entries: OfficialModelCatalogEntry[] = [];
  const translationDefinition = provider.stages.translation;
  if (translationDefinition) {
    entries.push(
      buildFreeProviderCatalogEntry(
        provider.id,
        provider.name,
        "translation",
        translationDefinition,
      ),
    );
  }

  if (FREE_PROVIDER_OCR_IDS.has(provider.id)) {
    const ocrDefinition = provider.stages.ocr;
    if (ocrDefinition) {
      entries.push(
        buildFreeProviderCatalogEntry(
          provider.id,
          provider.name,
          "ocr",
          ocrDefinition,
        ),
      );
    }
  }

  if (FREE_PROVIDER_CLEAN_IDS.has(provider.id)) {
    const cleanDefinition = provider.stages.clean;
    if (cleanDefinition) {
      entries.push(
        buildFreeProviderCatalogEntry(
          provider.id,
          provider.name,
          "clean",
          cleanDefinition,
        ),
      );
    }
  }

  return entries;
});

export const OFFICIAL_MODEL_CATALOG: OfficialModelCatalogEntry[] = [
  ...localCatalogEntries,
  ...cloudCatalogEntries,
  ...freeProviderCatalogEntries,
];

export const OFFICIAL_MODEL_CATALOG_BY_ID: Record<string, OfficialModelCatalogEntry> =
  Object.fromEntries(OFFICIAL_MODEL_CATALOG.map((model) => [model.id, model]));

export const findOfficialModelCatalogEntry = (
  modelId: string,
): OfficialModelCatalogEntry | null => OFFICIAL_MODEL_CATALOG_BY_ID[modelId] ?? null;

const normalizeLanguage = (value: string): string => value.trim().toLowerCase();

export const officialModelMatchesLanguage = (
  model: OfficialModelCatalogEntry,
  language: string,
): boolean => {
  const normalized = normalizeLanguage(language);
  if (!normalized || normalized === "all") {
    return true;
  }

  const sourceLanguages = model.sourceLanguages.map(normalizeLanguage);
  const targetLanguages = model.targetLanguages.map(normalizeLanguage);

  return (
    sourceLanguages.includes("*") ||
    targetLanguages.includes("*") ||
    sourceLanguages.includes(normalized) ||
    targetLanguages.includes(normalized)
  );
};

export const listOfficialCatalogLanguages = (): string[] => {
  const bucket = new Set<string>();

  OFFICIAL_MODEL_CATALOG.forEach((model) => {
    [...model.sourceLanguages, ...model.targetLanguages].forEach((language) => {
      const normalized = normalizeLanguage(language);
      if (normalized && normalized !== "*" && normalized !== "multi") {
        bucket.add(normalized);
      }
    });
  });

  return Array.from(bucket).sort((left, right) => left.localeCompare(right));
};
