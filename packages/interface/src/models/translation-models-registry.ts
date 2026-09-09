import type { AioLocalModelStage, TranslationModel } from "./types";

import {
  BASE_TRANSLATION_MODELS_REGISTRY,
  DETECT_TEXT_MODELS_REGISTRY,
  RECOGNIZE_TEXT_MODELS_REGISTRY,
} from "./translation-text-model-registry-data";
import {
  CLEAN_IMAGE_MODELS_REGISTRY,
  ENHANCE_IMAGE_MODELS_REGISTRY,
  SEGMENT_TEXT_MODELS_REGISTRY,
} from "./translation-image-model-registry-data";

export { ENHANCE_IMAGE_MODELS_REGISTRY } from "./translation-image-model-registry-data";

export const TRANSLATION_MODELS_REGISTRY: TranslationModel[] = BASE_TRANSLATION_MODELS_REGISTRY;

export const LOCAL_AIO_MODELS_REGISTRY: TranslationModel[] = [
  ...BASE_TRANSLATION_MODELS_REGISTRY,
  ...DETECT_TEXT_MODELS_REGISTRY,
  ...RECOGNIZE_TEXT_MODELS_REGISTRY,
  ...SEGMENT_TEXT_MODELS_REGISTRY,
  ...CLEAN_IMAGE_MODELS_REGISTRY,
  ...ENHANCE_IMAGE_MODELS_REGISTRY,
];

export const LOCAL_AIO_MODELS_BY_ID: Record<string, TranslationModel> =
  Object.fromEntries(LOCAL_AIO_MODELS_REGISTRY.map((model) => [model.id, model]));

export const AIO_LOCAL_MODELS_BY_STAGE: Record<AioLocalModelStage, TranslationModel[]> = {
  translation: BASE_TRANSLATION_MODELS_REGISTRY,
  detectText: DETECT_TEXT_MODELS_REGISTRY,
  recognizeText: RECOGNIZE_TEXT_MODELS_REGISTRY,
  segmentText: SEGMENT_TEXT_MODELS_REGISTRY,
  cleanImage: CLEAN_IMAGE_MODELS_REGISTRY,
  enhanceImage: ENHANCE_IMAGE_MODELS_REGISTRY,
};

export const TRANSLATION_MODELS_BY_ID: Record<string, TranslationModel> =
  Object.fromEntries(TRANSLATION_MODELS_REGISTRY.map((model) => [model.id, model]));

export const getTranslationModelById = (modelId: string): TranslationModel | null =>
  TRANSLATION_MODELS_BY_ID[modelId] ?? null;

export const getLocalAioModelById = (modelId: string): TranslationModel | null =>
  LOCAL_AIO_MODELS_BY_ID[modelId] ?? null;

export const modelStageLabel = (stage: AioLocalModelStage): string => {
  if (stage === "translation") return "Translation";
  if (stage === "detectText") return "Detect Text";
  if (stage === "recognizeText") return "Recognize Text";
  if (stage === "segmentText") return "Segment Text";
  if (stage === "cleanImage") return "Clean Image";
  return "Enhance Image";
};

const normalizeLanguage = (value: string): string => value.trim().toLowerCase();

export const modelSupportsLanguage = (
  model: TranslationModel,
  sourceLanguage: string,
  targetLanguage: string,
): boolean => {
  const source = normalizeLanguage(sourceLanguage);
  const target = normalizeLanguage(targetLanguage);

  const sourceSet = new Set(model.sourceLanguages.map(normalizeLanguage));
  const targetSet = new Set(model.targetLanguages.map(normalizeLanguage));

  const sourceMatches = sourceSet.has("*") || sourceSet.has(source);
  const targetMatches = targetSet.has("*") || targetSet.has(target);
  return sourceMatches && targetMatches;
};

export const listRegistryLanguages = (): string[] => {
  const bucket = new Set<string>();
  LOCAL_AIO_MODELS_REGISTRY.forEach((model) => {
    model.sourceLanguages.forEach((language) => {
      const normalized = normalizeLanguage(language);
      if (normalized !== "*" && normalized !== "multi") {
        bucket.add(normalized);
      }
    });
  });
  return Array.from(bucket).sort((a, b) => a.localeCompare(b));
};
