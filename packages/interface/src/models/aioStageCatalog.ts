import type { AioStageKey } from "../types/aioModelPresets";
import {
  FULL_LLM_CAPABILITIES,
  parseFreeProviderProfileId,
  toCustomModelSelectionKey,
  type CustomLlmProfile,
  type LlmCapabilities,
} from "../utils/customLlm";
import { TRANSLATION_MODELS_REGISTRY } from "./translation-models-registry";
import { FREE_AI_PROVIDER_CATALOG_ENTRIES } from "./freeAiProviderCatalog";
import { OFFICIAL_CLOUD_STAGE_OPTIONS } from "./officialModelCatalog";
import type { ModelInstallState } from "./types";

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

export interface AioLanguageOption {
  value: string;
  label: string;
}

export interface AioDeviceInfo {
  name: string;
  has_gpu: boolean;
  provider: string;
  vram_gb: number | null;
  profile?: string;
  fallback_reason?: string | null;
  available_providers?: string[];
  nvidia_cuda_available?: boolean;
  nvidia_tensorrt_available?: boolean;
  intel_openvino_available?: boolean;
  amd_rocm_available?: boolean;
}

export type AioStageOptionMap = Record<AioStageKey, AioStageOption[]>;

interface BuildAioStageCatalogOptions {
  sourceLanguage: string;
  localModelEntries?: Record<string, ModelInstallState>;
  customProfiles?: CustomLlmProfile[];
}

const LOCAL_MODEL_OPTION_KEYS = new Set([
  "opus-mt-ja-en",
  "nllb-200-600m-int8",
  "opus-mt-zh-en",
  "nllb-200-1.3b",
  "nllb-200-1.3b-int8-ct2",
  "nllb-200-3.3b",
  "sugoi_v4_ja_en_ct2",
  "m2m100_1_2b_ct2",
  "vntl_llama3_8b_v2",
  "lfm2_350m_enjp_mt",
  "sakura_galtransl_7b_v3_7",
  "sakura_1_5b_qwen2_5_v1_0",
  "hunyuan_7b_mt_v1_0",
  "font_rtdetr_v2",
  "comic_text_detector",
  "pp_doclayout_v3",
  "manga_ocr",
  "meiki_ocr",
  "paddleocr",
  "paddleocr_latin_v5",
  "paddleocr_ch_v5",
  "paddleocr_en_v5",
  "easyocr",
  "pororo",
  "paddleocr_vl_manga",
  "paddleocr_vl_1_5",
  "got_ocr2",
  "qwen2_5_vl_3b",
  "mangalmm",
  "rolmocr",
  "glm_ocr_onnx",
  "baka_content_cc",
  "aot",
  "lama_manga",
  "opencv_lama",
  "lama_fp32",
]);

const MANAGED_TRANSLATION_OPTION_KEYS = new Set(
  OFFICIAL_CLOUD_STAGE_OPTIONS.getTranslations.map((option) => option.key),
);

export const SOURCE_LANGUAGE_OPTIONS: AioLanguageOption[] = [
  { value: "ko", label: "aioStage.lang.ko" },
  { value: "ja", label: "aioStage.lang.ja" },
  { value: "fr", label: "aioStage.lang.fr" },
  { value: "zh", label: "aioStage.lang.zh" },
  { value: "en", label: "aioStage.lang.en" },
  { value: "ru", label: "aioStage.lang.ru" },
  { value: "de", label: "aioStage.lang.de" },
  { value: "nl", label: "aioStage.lang.nl" },
  { value: "es", label: "aioStage.lang.es" },
  { value: "it", label: "aioStage.lang.it" },
];

export const TARGET_LANGUAGE_OPTIONS: AioLanguageOption[] = [
  { value: "en", label: "aioStage.lang.en" },
  { value: "ko", label: "aioStage.lang.ko" },
  { value: "ja", label: "aioStage.lang.ja" },
  { value: "fr", label: "aioStage.lang.fr" },
  { value: "zh-cn", label: "aioStage.lang.zh-CN" },
  { value: "zh-tw", label: "aioStage.lang.zh-TW" },
  { value: "ru", label: "aioStage.lang.ru" },
  { value: "de", label: "aioStage.lang.de" },
  { value: "nl", label: "aioStage.lang.nl" },
  { value: "es", label: "aioStage.lang.es" },
  { value: "it", label: "aioStage.lang.it" },
  { value: "tr", label: "aioStage.lang.tr" },
  { value: "pl", label: "aioStage.lang.pl" },
  { value: "pt", label: "aioStage.lang.pt" },
  { value: "pt-br", label: "aioStage.lang.pt-BR" },
  { value: "th", label: "aioStage.lang.th" },
  { value: "vi", label: "aioStage.lang.vi" },
  { value: "hu", label: "aioStage.lang.hu" },
  { value: "id", label: "aioStage.lang.id" },
  { value: "fi", label: "aioStage.lang.fi" },
  { value: "ar", label: "aioStage.lang.ar" },
];

const BASE_AIO_STAGE_OPTIONS: AioStageOptionMap = {
  detectText: [
    {
      key: "font_rtdetr_v2",
      name: "RT-DETR v2 (ONNX)",
      device: "cpu_gpu",
      use_case: "Text detection for AIO (CPU/GPU)",
      available: true,
      implemented: true,
    },
    {
      key: "comic_text_detector",
      name: "Comic Text Detector (ONNX)",
      device: "cpu_gpu",
      use_case: "Detector de caixas de texto estilo manga-image-translator",
      available: true,
      implemented: true,
    },
    {
      key: "pp_doclayout_v3",
      name: "PP-DocLayout V3",
      device: "cpu_gpu",
      use_case: "Layout and text detection via PP-DocLayout V3 (page analysis)",
      available: false,
      implemented: true,
    },
  ],
  recognizeText: [
    {
      key: "manga_ocr",
      name: "Manga OCR (ONNX)",
      device: "cpu_gpu",
      use_case: "OCR japones (mesma base do Baka)",
      languages: ["ja"],
      available: true,
      implemented: true,
    },
    {
      key: "meiki_ocr",
      name: "Meiki OCR",
      device: "cpu_gpu",
      use_case: "Specialized Japanese OCR with horizontal/vertical ONNX models",
      languages: ["ja"],
      available: false,
      implemented: true,
    },
    {
      key: "paddleocr",
      name: "PaddleOCR v5 East Slavic (ONNX)",
      device: "cpu_gpu",
      use_case: "OCR russo/eslavo",
      languages: ["ru"],
      available: true,
      implemented: true,
    },
    {
      key: "paddleocr_latin_v5",
      name: "PaddleOCR v5 Latin (ONNX)",
      device: "cpu_gpu",
      use_case: "OCR para idiomas latinos (inclui Dutch)",
      languages: ["fr", "de", "nl", "es", "it", "pt", "pt-br", "tr", "pl", "vi", "id", "hu", "fi"],
      available: true,
      implemented: true,
    },
    {
      key: "paddleocr_ch_v5",
      name: "PaddleOCR v5 Chinese (ONNX)",
      device: "cpu_gpu",
      use_case: "Chinese OCR",
      languages: ["zh", "zh-cn", "zh-tw"],
      available: true,
      implemented: true,
    },
    {
      key: "paddleocr_en_v5",
      name: "PaddleOCR v5 English (ONNX)",
      device: "cpu_gpu",
      use_case: "English OCR with the updated PP-OCRv5 model",
      languages: ["en"],
      available: true,
      implemented: true,
    },
    {
      key: "easyocr",
      name: "EasyOCR",
      device: "cpu_gpu",
      use_case: "Local multi-language OCR (requires the weights installed locally)",
      languages: ["en", "ko", "ja", "zh", "zh-cn", "zh-tw", "ru"],
      available: true,
      implemented: true,
    },
    {
      key: "pororo",
      name: "Pororo OCR",
      device: "cpu_gpu",
      use_case: "OCR coreano",
      languages: ["ko"],
      available: true,
      implemented: true,
    },
    {
      key: "paddleocr_vl_manga",
      name: "PaddleOCRVLManga",
      device: "gpu",
      use_case: "OCR VLM especializado em manga japonesa",
      languages: ["ja"],
      available: false,
      implemented: true,
    },
    {
      key: "got_ocr2",
      name: "GOT-OCR 2.0",
      device: "gpu",
      use_case: "OCR multimodal geral via GOT-OCR 2.0",
      languages: ["multi"],
      available: false,
      implemented: true,
    },
    {
      key: "qwen2_5_vl_3b",
      name: "Qwen2.5-VL 3B",
      device: "gpu_8gb+",
      use_case: "OCR multimodal local via Qwen2.5-VL-3B-Instruct",
      languages: ["multi"],
      available: false,
      implemented: true,
    },
    {
      key: "mangalmm",
      name: "MangaLMM",
      device: "gpu_8gb+",
      use_case: "OCR multimodal especializado em manga",
      languages: ["ja"],
      available: false,
      implemented: true,
    },
    {
      key: "rolmocr",
      name: "RolmOCR",
      device: "gpu_8gb+",
      use_case: "OCR multimodal robusto baseado em Qwen2.5-VL",
      languages: ["multi"],
      available: false,
      implemented: true,
    },
    {
      key: "glm_ocr_onnx",
      name: "GLM-OCR",
      device: "gpu_8gb+",
      use_case: "OCR multimodal GLM com foco em layouts complexos",
      languages: ["zh", "en", "fr", "es", "ru", "de", "ja", "ko"],
      available: false,
      implemented: true,
    },
    {
      key: "paddleocr_vl_1_5",
      name: "PaddleOCR-VL 1.5",
      device: "gpu",
      use_case: "High-quality multilingual VLM OCR (PaddleOCR-VL 1.5)",
      languages: ["multi"],
      available: false,
      implemented: true,
    },
  ],
  getTranslations: [
    {
      key: "google_translate",
      name: "Google Translate",
      device: "cpu",
      use_case: "Free automatic translation (no API key)",
      available: true,
      implemented: true,
    },
    {
      key: "microsoft_translator",
      name: "Microsoft Translator",
      device: "cpu",
      use_case: "Translation via Azure Translator (requires a key/API endpoint)",
      available: false,
      implemented: true,
    },
    {
      key: "deepl_translate",
      name: "DeepL Translate",
      device: "cpu",
      use_case: "Translation via the DeepL API (requires your own key)",
      available: false,
      implemented: true,
    },
    {
      key: "libretranslate",
      name: "LibreTranslate",
      device: "cpu",
      use_case: "Self-hosted translation via LibreTranslate",
      available: false,
      implemented: true,
    },
    ...TRANSLATION_MODELS_REGISTRY.map((model) => ({
      key: model.id,
      name: model.name,
      device: model.requirements.gpu ? "gpu" : "cpu_gpu",
      use_case: model.description,
      languages: model.sourceLanguages,
      available: true,
      implemented: true,
    })),
    ...OFFICIAL_CLOUD_STAGE_OPTIONS.getTranslations,
  ],
  segmentText: [
    {
      key: "baka_content_cc",
      name: "Baka Content CC",
      device: "cpu_gpu",
      use_case: "Baka-style segmentation (Otsu + connected components)",
      available: true,
      implemented: true,
    },
    {
      key: "sam2_text",
      name: "SAM2 Text",
      device: "gpu",
      use_case: "Advanced semantic segmentation (roadmap)",
      available: false,
      implemented: false,
    },
  ],
  cleanImage: [
    {
      key: "aot",
      name: "AOT (ONNX)",
      device: "cpu_gpu",
      use_case: "Inpainting estilo Baka",
      available: true,
      implemented: true,
    },
    {
      key: "lama_manga",
      name: "LaMa Manga Dynamic (ONNX)",
      device: "cpu_gpu",
      use_case: "Advanced contextual inpainting for balloons/text",
      available: true,
      implemented: true,
    },
    {
      key: "opencv_lama",
      name: "OpenCV LaMa (ONNX)",
      device: "cpu_gpu",
      use_case: "Lightweight LaMa for CPU and fast batches",
      available: true,
      implemented: true,
    },
    {
      key: "lama_fp32",
      name: "LaMa FP32 512 (ONNX)",
      device: "cpu_gpu",
      use_case: "Port ONNX recomendado do big-lama em 512px",
      available: true,
      implemented: true,
    },
  ],
};

const normalizeLanguageCode = (value: string): string => value.trim().toLowerCase();

export const mergeStageOptions = (
  base: AioStageOption[],
  incoming: AioStageOption[],
): AioStageOption[] => {
  const byKey = new Map<string, AioStageOption>();
  for (const option of base) {
    byKey.set(option.key, option);
  }
  for (const option of incoming) {
    const previous = byKey.get(option.key);
    byKey.set(option.key, previous ? { ...previous, ...option } : option);
  }
  return Array.from(byKey.values());
};

export const ocrStageOptionSupportsLanguage = (
  option: AioStageOption,
  sourceLanguage: string,
): boolean => {
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const languages = (option.languages ?? [])
    .map((item) => normalizeLanguageCode(item))
    .filter(Boolean);
  if (languages.length === 0 || languages.includes("multi")) {
    return true;
  }
  if (languages.includes(normalizedSource)) {
    return true;
  }
  if (normalizedSource === "zh" && (languages.includes("zh-cn") || languages.includes("zh-tw"))) {
    return true;
  }
  if ((normalizedSource === "zh-cn" || normalizedSource === "zh-tw") && languages.includes("zh")) {
    return true;
  }
  if (normalizedSource === "pt-br" && languages.includes("pt")) {
    return true;
  }
  return false;
};

const isInstalledLocalModel = (
  modelKey: string,
  entries: Record<string, ModelInstallState> | undefined,
): boolean => {
  const entry = entries?.[modelKey];
  if (!entry) {
    return false;
  }
  return entry.status === "installed" || entry.status === "update_available";
};

export const buildCustomStageOption = (profile: CustomLlmProfile): AioStageOption => ({
  ...((): Partial<AioStageOption> => {
    const freeMetadata = parseFreeProviderProfileId(profile.id);
    if (!freeMetadata) {
      return {};
    }

    const provider = FREE_AI_PROVIDER_CATALOG_ENTRIES.find((item) => item.id === freeMetadata.providerId);
    const stageDefinition = provider?.stages[freeMetadata.stage];
    if (!provider || !stageDefinition) {
      return {};
    }

    return {
      provider_id: provider.id,
      provider_name: provider.name,
      provider_status: provider.status,
      requires_user_api_key: stageDefinition.requiresUserApiKey,
      default_api_base: stageDefinition.defaultApiBase,
      default_model: stageDefinition.defaultModel,
      docs_url: provider.docsUrl,
      limits_summary: provider.limitsSummary,
      rate_limit_summary: provider.rateLimitSummary,
      setup_summary: provider.setupSummary,
    };
  })(),
  key: toCustomModelSelectionKey(profile),
  name: profile.label,
  device: "cloud",
  use_case: `Custom AI salvo (${profile.model})`,
  languages: ["multi"],
  available: true,
  implemented: true,
  llm_capabilities: FULL_LLM_CAPABILITIES,
});

const decorateLocalOption = (
  option: AioStageOption,
  localModelEntries: Record<string, ModelInstallState> | undefined,
): AioStageOption => {
  if (option.key === "google_translate") {
    return { ...option, available: true };
  }

  if (LOCAL_MODEL_OPTION_KEYS.has(option.key)) {
    return {
      ...option,
      available: isInstalledLocalModel(option.key, localModelEntries),
    };
  }

  return option;
};

const decorateManagedOption = (option: AioStageOption): AioStageOption => ({
  ...option,
  available: option.implemented,
});

const filterOcrOptionsForLanguage = (
  options: AioStageOption[],
  sourceLanguage: string,
): AioStageOption[] => options.filter((option) => ocrStageOptionSupportsLanguage(option, sourceLanguage));

export const DEFAULT_AIO_STAGE_OPTIONS: AioStageOptionMap = {
  detectText: BASE_AIO_STAGE_OPTIONS.detectText.map((option) => ({ ...option })),
  recognizeText: mergeStageOptions(
    BASE_AIO_STAGE_OPTIONS.recognizeText.map((option) => ({ ...option })),
    OFFICIAL_CLOUD_STAGE_OPTIONS.recognizeText.map((option) => ({ ...option })),
  ),
  getTranslations: BASE_AIO_STAGE_OPTIONS.getTranslations.map((option) => ({ ...option })),
  segmentText: BASE_AIO_STAGE_OPTIONS.segmentText.map((option) => ({ ...option })),
  cleanImage: BASE_AIO_STAGE_OPTIONS.cleanImage.map((option) => ({ ...option })),
};

export const buildAioStageCatalog = ({
  sourceLanguage,
  localModelEntries,
  customProfiles = [],
}: BuildAioStageCatalogOptions): AioStageOptionMap => {
  const customTranslationOptions = customProfiles
    .filter((profile) => profile.stage === "translation")
    .map((profile) => buildCustomStageOption(profile));
  const customOcrOptions = customProfiles
    .filter((profile) => profile.stage === "ocr")
    .map((profile) => buildCustomStageOption(profile));

  const detectText = BASE_AIO_STAGE_OPTIONS.detectText.map((option) =>
    decorateLocalOption(option, localModelEntries),
  );
  const recognizeText = mergeStageOptions(
    filterOcrOptionsForLanguage(
      BASE_AIO_STAGE_OPTIONS.recognizeText.map((option) =>
        decorateLocalOption(option, localModelEntries),
      ),
      sourceLanguage,
    ),
    filterOcrOptionsForLanguage(
      OFFICIAL_CLOUD_STAGE_OPTIONS.recognizeText.map((option) =>
        decorateManagedOption(option),
      ),
      sourceLanguage,
    ),
  );
  const getTranslations = mergeStageOptions(
    BASE_AIO_STAGE_OPTIONS.getTranslations.map((option) => {
      if (MANAGED_TRANSLATION_OPTION_KEYS.has(option.key)) {
        return decorateManagedOption(option);
      }
      return decorateLocalOption(option, localModelEntries);
    }),
    customTranslationOptions,
  );
  const segmentText = BASE_AIO_STAGE_OPTIONS.segmentText.map((option) =>
    decorateLocalOption(option, localModelEntries),
  );
  const cleanImage = BASE_AIO_STAGE_OPTIONS.cleanImage.map((option) =>
    decorateLocalOption(option, localModelEntries),
  );

  return {
    detectText,
    recognizeText: mergeStageOptions(recognizeText, customOcrOptions),
    getTranslations,
    segmentText,
    cleanImage,
  };
};
