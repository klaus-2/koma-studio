import type {
  AioLocalModelStage,
  InstallAllSummary,
  ModelInstallState,
  TranslationModel,
} from '../../models/types';
import {
  TRANSLATION_MODELS_BY_ID,
  listRegistryLanguages,
} from '../../models/translation-models-registry';

export const ELIGIBLE_INSTALL_STATUSES = new Set<ModelInstallState['status']>([
  'not_installed',
  'update_available',
  'failed',
  'cancelled',
  'incomplete',
]);

const STAGE_RECOMMENDED_MODEL_IDS: Partial<Record<AioLocalModelStage, string[]>> = {
  detectText: ['font_rtdetr_v2'],
  segmentText: ['baka_content_cc'],
  cleanImage: ['aot'],
};

const RECOGNIZE_TEXT_RECOMMENDED_BY_LANGUAGE: Record<string, string[]> = {
  ja: ['manga_ocr'],
  ko: ['pororo'],
  en: ['paddleocr_en_v5'],
  zh: ['paddleocr_ch_v5'],
  'zh-cn': ['paddleocr_ch_v5'],
  'zh-tw': ['paddleocr_ch_v5'],
  ru: ['paddleocr'],
  fr: ['paddleocr_latin_v5'],
  de: ['paddleocr_latin_v5'],
  nl: ['paddleocr_latin_v5'],
  es: ['paddleocr_latin_v5'],
  it: ['paddleocr_latin_v5'],
  pt: ['paddleocr_latin_v5'],
  'pt-br': ['paddleocr_latin_v5'],
  tr: ['paddleocr_latin_v5'],
  pl: ['paddleocr_latin_v5'],
  vi: ['paddleocr_latin_v5'],
  id: ['paddleocr_latin_v5'],
  hu: ['paddleocr_latin_v5'],
  fi: ['paddleocr_latin_v5'],
};

const TRANSLATION_RECOMMENDED_BY_LANGUAGE: Record<string, string[]> = {
  en: ['m2m100_1_2b_ct2'],
  de: ['m2m100_1_2b_ct2'],
  es: ['nllb-200-600m-int8'],
};

const JAPANESE_TRANSLATION_RECOMMENDED_BY_TARGET: Record<string, string[]> = {
  zh: ['sakura_1_5b_qwen2_5_v1_0'],
  'zh-cn': ['sakura_1_5b_qwen2_5_v1_0'],
  en: ['sugoi_v4_ja_en_ct2'],
};

// Derived from the registry instead of copied: when the upstream target list
// changes, the recommendation follows without a second edit.
const HUNYUAN_TARGET_LANGUAGES = new Set(
  TRANSLATION_MODELS_BY_ID['hunyuan_7b_mt_v1_0']?.targetLanguages ?? [],
);

// M2M100 covers "*" on both sides (100 languages): the floor that keeps a
// recommendation available for every registry language pair.
const UNIVERSAL_TRANSLATION_FALLBACK = 'm2m100_1_2b_ct2';

const KNOWN_LANGUAGE_SET = new Set(listRegistryLanguages());

const normalizeLanguage = (language: string | undefined): string =>
  (language ?? '').trim().toLowerCase();

const getRecognizeTextRecommendation = (language: string): string[] => {
  const source = normalizeLanguage(language);
  if (!source) return [];
  return RECOGNIZE_TEXT_RECOMMENDED_BY_LANGUAGE[source] ?? [];
};

const getTranslationRecommendation = (
  language: string,
  targetLanguage: string | undefined,
): string[] => {
  const source = normalizeLanguage(language);
  if (!source || !KNOWN_LANGUAGE_SET.has(source)) return [];

  const target = normalizeLanguage(targetLanguage);
  if (!target) {
    // Target-agnostic callers keep the pre-target-aware picks.
    if (source === 'ja') return ['sakura_1_5b_qwen2_5_v1_0'];
    if (source === 'ko') return ['hunyuan_7b_mt_v1_0'];
    return TRANSLATION_RECOMMENDED_BY_LANGUAGE[source] ?? [];
  }

  if (source === 'ja') {
    return (
      JAPANESE_TRANSLATION_RECOMMENDED_BY_TARGET[target] ??
      (HUNYUAN_TARGET_LANGUAGES.has(target)
        ? ['hunyuan_7b_mt_v1_0']
        : [UNIVERSAL_TRANSLATION_FALLBACK])
    );
  }

  // Hunyuan's own target list is narrower than the filter languages, so an
  // uncovered pair (ko->fi, ko->hu) falls through to the universal model.
  if (source === 'ko' && !HUNYUAN_TARGET_LANGUAGES.has(target)) {
    return [UNIVERSAL_TRANSLATION_FALLBACK];
  }

  const staticPick = TRANSLATION_RECOMMENDED_BY_LANGUAGE[source];
  if (staticPick) return staticPick;

  if (HUNYUAN_TARGET_LANGUAGES.has(target)) return ['hunyuan_7b_mt_v1_0'];
  return [UNIVERSAL_TRANSLATION_FALLBACK];
};

export const getRecommendedModelIdsForStage = (
  stage: AioLocalModelStage,
  language: string,
  targetLanguage?: string,
): string[] | null => {
  const stageWideIds = STAGE_RECOMMENDED_MODEL_IDS[stage];
  if (stageWideIds) {
    return stageWideIds;
  }

  if (stage === 'recognizeText') {
    return getRecognizeTextRecommendation(language);
  }

  if (stage === 'translation') {
    return getTranslationRecommendation(language, targetLanguage);
  }

  return null;
};

export const buildScopedInstallSummary = (
  entries: Record<string, ModelInstallState>,
  localStageFilter: AioLocalModelStage | null,
  languageFilter: string,
  targetLanguage: string | undefined,
  fallbackSummary: InstallAllSummary,
  estimateBytes: (model: TranslationModel) => number,
): InstallAllSummary => {
  if (!localStageFilter) {
    return fallbackSummary;
  }

  const recommendedModelIds = getRecommendedModelIdsForStage(
    localStageFilter,
    languageFilter,
    targetLanguage,
  );
  const recommendedIdSet =
    recommendedModelIds === null ? null : new Set(recommendedModelIds);

  const eligible = Object.values(entries).filter((entry) => {
    if (entry.model.stage !== localStageFilter) {
      return false;
    }
    if (!ELIGIBLE_INSTALL_STATUSES.has(entry.status)) {
      return false;
    }
    if (recommendedIdSet === null) {
      return true;
    }
    return recommendedIdSet.has(entry.model.id);
  });

  const totalBytes = eligible.reduce(
    (accumulator, entry) => accumulator + estimateBytes(entry.model),
    0,
  );

  return {
    totalBytes,
    requiredBytes: totalBytes,
    eligibleModelIds: eligible.map((entry) => entry.model.id),
  };
};
