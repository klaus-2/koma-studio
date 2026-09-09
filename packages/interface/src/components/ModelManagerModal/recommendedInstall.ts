import type {
  AioLocalModelStage,
  InstallAllSummary,
  ModelInstallState,
  TranslationModel,
} from '../../models/types';

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

const LANGUAGE_RECOMMENDED_MODEL_IDS: Partial<
  Record<AioLocalModelStage, Record<string, string[]>>
> = {
  recognizeText: {
    de: ['paddleocr_latin_v5'],
    en: ['paddleocr_en_v5'],
    es: ['paddleocr_latin_v5'],
    ja: ['manga_ocr'],
    ko: ['pororo'],
  },
  translation: {
    de: ['m2m100_1_2b_ct2'],
    en: ['m2m100_1_2b_ct2'],
    es: ['nllb-200-600m-int8'],
    ja: ['sakura_1_5b_qwen2_5_v1_0'],
    ko: ['hunyuan_7b_mt_v1_0'],
  },
};

export const getRecommendedModelIdsForStage = (
  stage: AioLocalModelStage,
  language: string,
): string[] | null => {
  const stageWideIds = STAGE_RECOMMENDED_MODEL_IDS[stage];
  if (stageWideIds) {
    return stageWideIds;
  }

  const byLanguage = LANGUAGE_RECOMMENDED_MODEL_IDS[stage];
  if (!byLanguage) {
    return null;
  }

  return byLanguage[language.trim().toLowerCase()] ?? [];
};

export const buildScopedInstallSummary = (
  entries: Record<string, ModelInstallState>,
  localStageFilter: AioLocalModelStage | null,
  languageFilter: string,
  fallbackSummary: InstallAllSummary,
  estimateBytes: (model: TranslationModel) => number,
): InstallAllSummary => {
  if (!localStageFilter) {
    return fallbackSummary;
  }

  const recommendedModelIds = getRecommendedModelIdsForStage(
    localStageFilter,
    languageFilter,
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
