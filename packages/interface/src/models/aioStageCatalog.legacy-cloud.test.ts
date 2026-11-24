import { describe, expect, it } from 'vitest';

import { DEFAULT_AIO_STAGE_OPTIONS, LEGACY_CLOUD_STAGE_OPTION_KEYS } from './aioStageCatalog';
import { dropLegacyCloudStageSelection, useAioPipelineStore } from '../pages/dashboard/stores/aio-pipeline-store';

const selection = {
  detectText: 'font_rtdetr_v2',
  recognizeText: 'manga_ocr',
  getTranslations: 'google_translate',
  segmentText: 'baka_content_cc',
  cleanImage: 'aot',
};

describe('legacy cloud stage options', () => {
  it('keeps the legacy cloud models out of the OCR and translation selects', () => {
    expect(LEGACY_CLOUD_STAGE_OPTION_KEYS.has('gpt_4_1_mini')).toBe(true);
    expect(LEGACY_CLOUD_STAGE_OPTION_KEYS.has('gpt_4_1_mini_ocr')).toBe(true);
    const listed = [
      ...DEFAULT_AIO_STAGE_OPTIONS.recognizeText,
      ...DEFAULT_AIO_STAGE_OPTIONS.getTranslations,
    ].map((option) => option.key);
    expect(listed.filter((key) => LEGACY_CLOUD_STAGE_OPTION_KEYS.has(key))).toEqual([]);
  });

  it('resets a saved legacy OCR or translation selection to the defaults', () => {
    expect(
      dropLegacyCloudStageSelection({
        ...selection,
        recognizeText: 'gpt_4_1_mini_ocr',
        getTranslations: 'gpt_4_1_mini',
      }),
    ).toEqual(selection);
  });

  it('keeps a selection without legacy keys untouched', () => {
    const custom = { ...selection, getTranslations: 'custom:profile-1' };
    expect(dropLegacyCloudStageSelection(custom)).toBe(custom);
  });

  it('applies the reset through the store setter', () => {
    useAioPipelineStore.getState().setAioStageSelection((previous) => ({
      ...previous,
      getTranslations: 'claude_3_5_haiku',
    }));
    expect(useAioPipelineStore.getState().aioStageSelection.getTranslations).toBe('google_translate');
  });
});
