import { describe, expect, it } from 'vitest';

import {
  AIO_LOCAL_MODELS_BY_STAGE,
  LOCAL_AIO_MODELS_BY_ID,
  listRegistryLanguages,
} from '../../models/translation-models-registry';
import { buildInstallState, createMockModel } from '../../models/model-install-fixtures';
import type { AioLocalModelStage, InstallAllSummary, ModelInstallState } from '../../models/types';
import {
  buildScopedInstallSummary,
  getRecommendedModelIdsForStage,
} from './recommendedInstall';

const makeEntry = (id: string, stage: AioLocalModelStage): ModelInstallState =>
  buildInstallState({ ...createMockModel(id), stage }, 'not_installed');

const estimateBytes = (model: { id: string }): number =>
  model.id === 'manga_ocr' ? 300 : 500;

describe('getRecommendedModelIdsForStage', () => {
  it('recommends the stage-wide model for any language', () => {
    expect(getRecommendedModelIdsForStage('detectText', 'ru')).toEqual(['font_rtdetr_v2']);
    expect(getRecommendedModelIdsForStage('segmentText', 'zh-tw')).toEqual(['baka_content_cc']);
    expect(getRecommendedModelIdsForStage('cleanImage', 'fi')).toEqual(['aot']);
  });

  it('curates recognizeText per language', () => {
    expect(getRecommendedModelIdsForStage('recognizeText', 'ja')).toEqual(['manga_ocr']);
    expect(getRecommendedModelIdsForStage('recognizeText', 'ko')).toEqual(['pororo']);
    expect(getRecommendedModelIdsForStage('recognizeText', 'en')).toEqual(['paddleocr_en_v5']);
    expect(getRecommendedModelIdsForStage('recognizeText', 'zh-cn')).toEqual(['paddleocr_ch_v5']);
    expect(getRecommendedModelIdsForStage('recognizeText', 'ru')).toEqual(['paddleocr']);
    expect(getRecommendedModelIdsForStage('recognizeText', 'pt-BR')).toEqual([
      'paddleocr_latin_v5',
    ]);
    expect(getRecommendedModelIdsForStage('recognizeText', 'fr')).toEqual(['paddleocr_latin_v5']);
  });

  it('keeps recognizeText disabled without a known language', () => {
    expect(getRecommendedModelIdsForStage('recognizeText', 'all')).toEqual([]);
    expect(getRecommendedModelIdsForStage('recognizeText', 'xx')).toEqual([]);
  });

  it('picks the japanese translation model by target language', () => {
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'zh')).toEqual([
      'sakura_1_5b_qwen2_5_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'en')).toEqual([
      'sugoi_v4_ja_en_ct2',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'pt-br')).toEqual([
      'hunyuan_7b_mt_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'fi')).toEqual([
      'm2m100_1_2b_ct2',
    ]);
  });

  it('falls through when hunyuan does not cover the target', () => {
    expect(getRecommendedModelIdsForStage('translation', 'ko', 'en')).toEqual([
      'hunyuan_7b_mt_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ko', 'fi')).toEqual([
      'm2m100_1_2b_ct2',
    ]);
  });

  it('keeps the target-agnostic translation picks', () => {
    expect(getRecommendedModelIdsForStage('translation', 'en', 'ja')).toEqual([
      'm2m100_1_2b_ct2',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'de', 'ru')).toEqual([
      'm2m100_1_2b_ct2',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'es', 'en')).toEqual([
      'nllb-200-600m-int8',
    ]);
  });

  it('recommends hunyuan or m2m100 for the remaining registry languages', () => {
    expect(getRecommendedModelIdsForStage('translation', 'ru', 'en')).toEqual([
      'hunyuan_7b_mt_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'zh', 'fr')).toEqual([
      'hunyuan_7b_mt_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'fr', 'fi')).toEqual([
      'm2m100_1_2b_ct2',
    ]);
  });

  it('keeps translation disabled without a known language', () => {
    expect(getRecommendedModelIdsForStage('translation', 'all', 'en')).toEqual([]);
    expect(getRecommendedModelIdsForStage('translation', 'xx', 'en')).toEqual([]);
  });

  it('keeps the legacy pick when the caller does not know the target', () => {
    expect(getRecommendedModelIdsForStage('translation', 'ja')).toEqual([
      'sakura_1_5b_qwen2_5_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ko')).toEqual(['hunyuan_7b_mt_v1_0']);
    expect(getRecommendedModelIdsForStage('translation', 'es')).toEqual(['nllb-200-600m-int8']);
  });

  it('curates recognizeText for every language its models accept', () => {
    const ocrLanguages = new Set(
      AIO_LOCAL_MODELS_BY_STAGE.recognizeText.flatMap((model) => model.sourceLanguages).filter(
        (language) => language !== '*' && language !== 'multi',
      ),
    );

    const uncovered = [...ocrLanguages].filter((language) => {
      const recommended = getRecommendedModelIdsForStage('recognizeText', language) ?? [];
      return recommended.length === 0;
    });
    expect(uncovered).toEqual([]);
  });

  it('pins the picks for the selectable chinese target languages', () => {
    // TARGET_LANGUAGE_OPTIONS offers zh-cn/zh-tw only; plain "zh" never appears
    // as a selectable target. Sakura covers zh/zh-cn upstream, zh-tw routes to
    // Hunyuan which declares it in its target list.
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'zh-cn')).toEqual([
      'sakura_1_5b_qwen2_5_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'zh-tw')).toEqual([
      'hunyuan_7b_mt_v1_0',
    ]);
  });

  it('normalizes mixed-case target languages', () => {
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'pt-BR')).toEqual([
      'hunyuan_7b_mt_v1_0',
    ]);
    expect(getRecommendedModelIdsForStage('translation', 'ja', 'EN')).toEqual([
      'sugoi_v4_ja_en_ct2',
    ]);
  });

  it('only recommends model ids that exist in the registry', () => {
    const ocrLanguages = AIO_LOCAL_MODELS_BY_STAGE.recognizeText
      .flatMap((model) => model.sourceLanguages)
      .filter((language) => language !== '*' && language !== 'multi');
    const translationTargets = ['en', 'zh', 'zh-cn', 'zh-tw', 'pt-br', 'hu', 'fi'];

    const recommendedIds = new Set<string>();
    for (const language of ocrLanguages) {
      for (const id of getRecommendedModelIdsForStage('recognizeText', language) ?? []) {
        recommendedIds.add(id);
      }
    }
    for (const language of listRegistryLanguages()) {
      for (const target of translationTargets) {
        for (const id of getRecommendedModelIdsForStage('translation', language, target) ?? []) {
          recommendedIds.add(id);
        }
      }
    }

    const unknownIds = [...recommendedIds].filter((id) => !(id in LOCAL_AIO_MODELS_BY_ID));
    expect(unknownIds).toEqual([]);
  });

  it('recommends a model for every covered language and target pair', () => {
    const ocrLanguages = AIO_LOCAL_MODELS_BY_STAGE.recognizeText
      .flatMap((model) => model.sourceLanguages)
      .filter((language) => language !== '*' && language !== 'multi');
    const translationTargets = ['en', 'zh', 'zh-cn', 'zh-tw', 'pt-br', 'hu', 'fi'];

    const emptyResults: string[] = [];
    for (const language of ocrLanguages) {
      const recommended = getRecommendedModelIdsForStage('recognizeText', language) ?? [];
      if (recommended.length === 0) {
        emptyResults.push(`recognizeText ${language}`);
      }
    }
    for (const language of listRegistryLanguages()) {
      for (const target of translationTargets) {
        const recommended = getRecommendedModelIdsForStage('translation', language, target) ?? [];
        if (recommended.length === 0) {
          emptyResults.push(`translation ${language}->${target}`);
        }
      }
    }

    expect(emptyResults).toEqual([]);
  });

  it('returns null for stages without curation', () => {
    expect(getRecommendedModelIdsForStage('enhanceImage', 'ja', 'en')).toBeNull();
  });
});

describe('buildScopedInstallSummary', () => {
  const fallback: InstallAllSummary = {
    totalBytes: 999,
    requiredBytes: 999,
    eligibleModelIds: ['font_rtdetr_v2'],
  };

  it('scopes the summary to the recommended ids of the stage and language', () => {
    const entries = {
      manga_ocr: makeEntry('manga_ocr', 'recognizeText'),
      paddleocr_en_v5: makeEntry('paddleocr_en_v5', 'recognizeText'),
      font_rtdetr_v2: makeEntry('font_rtdetr_v2', 'detectText'),
    };

    const summary = buildScopedInstallSummary(
      entries,
      'recognizeText',
      'ja',
      'en',
      fallback,
      estimateBytes,
    );

    expect(summary.eligibleModelIds).toEqual(['manga_ocr']);
    expect(summary.totalBytes).toBe(300);
    expect(summary.requiredBytes).toBe(300);
  });

  it('uses the target language for the translation stage', () => {
    const entries = {
      sakura_1_5b_qwen2_5_v1_0: makeEntry('sakura_1_5b_qwen2_5_v1_0', 'translation'),
      sugoi_v4_ja_en_ct2: makeEntry('sugoi_v4_ja_en_ct2', 'translation'),
    };

    const zhSummary = buildScopedInstallSummary(
      entries,
      'translation',
      'ja',
      'zh',
      fallback,
      estimateBytes,
    );
    expect(zhSummary.eligibleModelIds).toEqual(['sakura_1_5b_qwen2_5_v1_0']);

    const enSummary = buildScopedInstallSummary(
      entries,
      'translation',
      'ja',
      'en',
      fallback,
      estimateBytes,
    );
    expect(enSummary.eligibleModelIds).toEqual(['sugoi_v4_ja_en_ct2']);
  });

  it('excludes models outside the eligible install statuses', () => {
    const entries = {
      manga_ocr: makeEntry('manga_ocr', 'recognizeText'),
      paddleocr_en_v5: buildInstallState(
        { ...createMockModel('paddleocr_en_v5'), stage: 'recognizeText' },
        'installed',
      ),
    };

    const summary = buildScopedInstallSummary(
      entries,
      'recognizeText',
      'ja',
      'en',
      fallback,
      estimateBytes,
    );
    expect(summary.eligibleModelIds).toEqual(['manga_ocr']);
  });

  it('keeps the summary empty for the all language filter', () => {
    const entries = {
      sakura_1_5b_qwen2_5_v1_0: makeEntry('sakura_1_5b_qwen2_5_v1_0', 'translation'),
    };

    const summary = buildScopedInstallSummary(
      entries,
      'translation',
      'all',
      'en',
      fallback,
      estimateBytes,
    );
    expect(summary.eligibleModelIds).toEqual([]);
  });

  it('returns the fallback summary when no stage filter is set', () => {
    const summary = buildScopedInstallSummary({}, null, 'ja', 'en', fallback, estimateBytes);
    expect(summary).toEqual(fallback);
  });

  it('recomputes from every eligible entry for a stage without curation', () => {
    const entries = { waifu2x_mock: makeEntry('waifu2x_mock', 'enhanceImage') };

    const summary = buildScopedInstallSummary(
      entries,
      'enhanceImage',
      'ja',
      'en',
      fallback,
      estimateBytes,
    );
    expect(summary.eligibleModelIds).toEqual(['waifu2x_mock']);
    expect(summary.totalBytes).toBe(500);
  });
});
