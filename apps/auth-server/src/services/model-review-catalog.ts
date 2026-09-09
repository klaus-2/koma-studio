export type ModelReviewStage =
  | "translation"
  | "detectText"
  | "recognizeText"
  | "segmentText"
  | "cleanImage";

export type ModelReviewSourceType = "local" | "cloud";


export interface ModelReviewCatalogEntry {
  modelId: string;
  name: string;
  stage: ModelReviewStage;
  sourceType: ModelReviewSourceType;  sourceLanguages: string[];
  targetLanguages: string[];
  searchText: string;
}

export interface ModelReviewCatalogFilters {
  stage?: "all" | ModelReviewStage;
  source?: "all" | ModelReviewSourceType;  language?: string;
  search?: string;
}

interface BaseCatalogEntry {
  modelId: string;
  name: string;
  stage: ModelReviewStage;
  sourceType: ModelReviewSourceType;  sourceLanguages: string[];
  targetLanguages: string[];
}

const createCatalogEntry = (entry: BaseCatalogEntry): ModelReviewCatalogEntry => ({
  ...entry,
  searchText: `${entry.name} ${entry.modelId} ${entry.stage} ${entry.sourceType}`.toLowerCase(),
});

const normalizeLanguage = (value: string): string => value.trim().toLowerCase();

const normalizeSearch = (value: string): string => value.trim().toLowerCase();

const LOCAL_MODEL_REVIEW_CATALOG: ModelReviewCatalogEntry[] = [
  createCatalogEntry({
    modelId: "opus-mt-ja-en",
    name: "OPUS-MT JA→EN/PT",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["ja"],
    targetLanguages: ["en", "pt", "pt-br"],
  }),
  createCatalogEntry({
    modelId: "nllb-200-600m-int8",
    name: "NLLB-200 600M int8",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["ko"],
    targetLanguages: ["en", "pt", "pt-br"],
  }),
  createCatalogEntry({
    modelId: "opus-mt-zh-en",
    name: "OPUS-MT ZH→EN/PT",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["zh", "zh-cn", "zh-tw"],
    targetLanguages: ["en", "pt", "pt-br"],
  }),
  createCatalogEntry({
    modelId: "nllb-200-1.3b",
    name: "NLLB-200 1.3B",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "nllb-200-1.3b-int8-ct2",
    name: "NLLB-200 1.3B int8 CT2",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "nllb-200-3.3b",
    name: "NLLB-200 3.3B",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "sugoi_v4_ja_en_ct2",
    name: "Sugoi v4 JA→EN (CT2)",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["ja"],
    targetLanguages: ["en"],
  }),
  createCatalogEntry({
    modelId: "m2m100_1_2b_ct2",
    name: "M2M100 1.2B (CT2)",
    stage: "translation",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "font_rtdetr_v2",
    name: "RT-DETR v2 (Detector)",
    stage: "detectText",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "comic_text_detector",
    name: "Comic Text Detector (ONNX)",
    stage: "detectText",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "manga_ocr",
    name: "Manga OCR (ONNX)",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["ja"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "meiki_ocr",
    name: "Meiki OCR",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["ja"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "paddleocr_vl_manga",
    name: "PaddleOCRVLManga",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["ja"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "got_ocr2",
    name: "GOT-OCR 2.0",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "qwen2_5_vl_3b",
    name: "Qwen2.5-VL 3B",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "mangalmm",
    name: "MangaLMM",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["ja"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "rolmocr",
    name: "RolmOCR",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "glm_ocr_onnx",
    name: "GLM-OCR",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["zh", "en", "fr", "es", "ru", "de", "ja", "ko"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "paddleocr",
    name: "PaddleOCR v5 East Slavic (ONNX)",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["ru"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "paddleocr_latin_v5",
    name: "PaddleOCR v5 Latin (ONNX)",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["fr", "de", "nl", "es", "it", "pt", "pt-br", "tr", "pl", "vi", "id", "hu", "fi"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "paddleocr_ch_v5",
    name: "PaddleOCR v5 Chinese (ONNX)",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["zh", "zh-cn", "zh-tw"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "paddleocr_en_v5",
    name: "PaddleOCR v5 English (ONNX)",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["en"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "easyocr",
    name: "EasyOCR",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["en", "ko", "ja", "zh", "zh-cn", "zh-tw", "ru"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "pororo",
    name: "Pororo OCR",
    stage: "recognizeText",
    sourceType: "local",
    sourceLanguages: ["ko"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "baka_content_cc",
    name: "Baka Content CC",
    stage: "segmentText",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "aot",
    name: "AOT (Inpainting)",
    stage: "cleanImage",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "lama_manga",
    name: "LaMa Manga Dynamic",
    stage: "cleanImage",
    sourceType: "local",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
];

const CLOUD_MODEL_REVIEW_CATALOG: ModelReviewCatalogEntry[] = [
  createCatalogEntry({
    modelId: "gpt_4_1_mini_ocr",
    name: "GPT-4.1-mini OCR",
    stage: "recognizeText",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "gemini_2_0_flash_ocr",
    name: "Gemini-2.5-Flash OCR",
    stage: "recognizeText",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "google_cloud_vision",
    name: "Google OCR",
    stage: "recognizeText",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "microsoft_vision",
    name: "Microsoft OCR",
    stage: "recognizeText",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "grok_2_vision_ocr",
    name: "Grok 4 OCR",
    stage: "recognizeText",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "z_ai_glm_4_5v_ocr",
    name: "Z.AI GLM-4.5V OCR",
    stage: "recognizeText",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "gpt_4_1_mini",
    name: "GPT-4.1-mini",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "gpt_4_1",
    name: "GPT-4.1",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "gemini_2_5_flash",
    name: "Gemini 2.5 Flash",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "gemini_2_5_pro",
    name: "Gemini 2.5 Pro",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "claude_3_5_haiku",
    name: "Claude Haiku 4.5",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "claude_3_7_sonnet",
    name: "Claude Sonnet 4.6",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "deepseek_v3",
    name: "Deepseek-v3",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "grok_2_vision",
    name: "Grok 4",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
  createCatalogEntry({
    modelId: "z_ai_glm_4_5v",
    name: "Z.AI GLM-4.5V",
    stage: "translation",
    sourceType: "cloud",
    sourceLanguages: ["*"],
    targetLanguages: ["*"],
  }),
];

interface FreeProviderReviewDefinition {
  providerId: string;
  providerName: string;
}

const FREE_PROVIDER_REVIEW_DEFINITIONS: FreeProviderReviewDefinition[] = [
  { providerId: "openrouter", providerName: "OpenRouter" },
  { providerId: "groq", providerName: "Groq" },
  { providerId: "huggingface_router", providerName: "Hugging Face Router" },
  { providerId: "cerebras", providerName: "Cerebras" },
  { providerId: "google_ai_studio", providerName: "Google AI Studio" },
  { providerId: "nvidia_nim", providerName: "NVIDIA NIM" },
  { providerId: "mistral_plateforme", providerName: "Mistral (La Plateforme)" },
  { providerId: "mistral_codestral", providerName: "Mistral (Codestral)" },
  { providerId: "vercel_ai_gateway", providerName: "Vercel AI Gateway" },
  { providerId: "cohere", providerName: "Cohere" },
  { providerId: "github_models", providerName: "GitHub Models" },
  { providerId: "cloudflare_workers_ai", providerName: "Cloudflare Workers AI" },
  { providerId: "zhipu_ai", providerName: "Zhipu AI" },
  { providerId: "llm7_io", providerName: "LLM7.io" },
  { providerId: "kluster_ai", providerName: "Kluster AI" },
  { providerId: "siliconflow", providerName: "SiliconFlow" },
  { providerId: "ollama_cloud", providerName: "Ollama Cloud" },
  { providerId: "google_cloud_vertex_ai", providerName: "Google Cloud Vertex AI" },
  { providerId: "fireworks", providerName: "Fireworks" },
  { providerId: "baseten", providerName: "Baseten" },
  { providerId: "nebius", providerName: "Nebius" },
  { providerId: "novita", providerName: "Novita" },
  { providerId: "ai21", providerName: "AI21" },
  { providerId: "upstage", providerName: "Upstage" },
  { providerId: "nlp_cloud", providerName: "NLP Cloud" },
  { providerId: "alibaba_model_studio", providerName: "Alibaba Cloud Model Studio" },
  { providerId: "modal", providerName: "Modal" },
  { providerId: "inference_net", providerName: "Inference.net" },
  { providerId: "hyperbolic", providerName: "Hyperbolic" },
  { providerId: "sambanova_cloud", providerName: "SambaNova Cloud" },
  { providerId: "scaleway_generative_apis", providerName: "Scaleway Generative APIs" },
];

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

const toFreeProviderReviewModelId = (
  providerId: string,
  stage: "translation" | "ocr",
): string => (
  stage === "translation"
    ? `custom:free::${providerId}::translation`
    : `custom_ocr:free::${providerId}::ocr`
);

const FREE_PROVIDER_MODEL_REVIEW_CATALOG: ModelReviewCatalogEntry[] = FREE_PROVIDER_REVIEW_DEFINITIONS.flatMap(
  ({ providerId, providerName }) => {
    const entries: ModelReviewCatalogEntry[] = [
      createCatalogEntry({
        modelId: toFreeProviderReviewModelId(providerId, "translation"),
        name: `${providerName} (FREE - Translation)`,
        stage: "translation",
        sourceType: "cloud",
        sourceLanguages: ["*"],
        targetLanguages: ["*"],
      }),
    ];

    if (FREE_PROVIDER_OCR_IDS.has(providerId)) {
      entries.push(
        createCatalogEntry({
          modelId: toFreeProviderReviewModelId(providerId, "ocr"),
          name: `${providerName} (FREE - OCR)`,
          stage: "recognizeText",
          sourceType: "cloud",
          sourceLanguages: ["*"],
          targetLanguages: ["*"],
        }),
      );
    }

    return entries;
  },
);

export const MODEL_REVIEW_CATALOG: ModelReviewCatalogEntry[] = [
  ...LOCAL_MODEL_REVIEW_CATALOG,
  ...CLOUD_MODEL_REVIEW_CATALOG,
  ...FREE_PROVIDER_MODEL_REVIEW_CATALOG,
];

export const MODEL_REVIEW_CATALOG_BY_ID: Record<string, ModelReviewCatalogEntry> =
  Object.fromEntries(MODEL_REVIEW_CATALOG.map((entry) => [entry.modelId, entry]));

export const getModelReviewCatalogEntry = (
  modelId: string,
): ModelReviewCatalogEntry | null => MODEL_REVIEW_CATALOG_BY_ID[modelId] ?? null;

export const modelReviewCatalogSupportsLanguage = (
  entry: ModelReviewCatalogEntry,
  language: string,
): boolean => {
  const normalized = normalizeLanguage(language);
  if (!normalized || normalized === "all") {
    return true;
  }

  const sourceLanguages = entry.sourceLanguages.map(normalizeLanguage);
  const targetLanguages = entry.targetLanguages.map(normalizeLanguage);

  return (
    sourceLanguages.includes("*") ||
    targetLanguages.includes("*") ||
    sourceLanguages.includes(normalized) ||
    targetLanguages.includes(normalized)
  );
};

export const filterModelReviewCatalog = (
  filters: ModelReviewCatalogFilters,
): ModelReviewCatalogEntry[] => {
  const normalizedSearch = normalizeSearch(filters.search ?? "");
  const normalizedLanguage = normalizeLanguage(filters.language ?? "");

  return MODEL_REVIEW_CATALOG.filter((entry) => {
    if (filters.stage && filters.stage !== "all" && entry.stage !== filters.stage) {
      return false;
    }

    if (filters.source && filters.source !== "all" && entry.sourceType !== filters.source) {
      return false;
    }

    if (normalizedLanguage && normalizedLanguage !== "all" && !modelReviewCatalogSupportsLanguage(entry, normalizedLanguage)) {
      return false;
    }

    if (normalizedSearch && !entry.searchText.includes(normalizedSearch)) {
      return false;
    }

    return true;
  });
};
