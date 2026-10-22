import { describe, expect, it } from 'vitest';

import type { AioStageOption } from '@/models/aioStageCatalog';
import type { AioLanguageModelPreset } from '@/types/aioModelPresets';

import {
  DEFAULT_TRANSLATION_STAGE_MODEL_KEY,
  repairDownloadOnlyPresetTranslation,
} from './aio-preset-selection';

function createTranslationOption(
  key: string,
  name: string,
  implemented: boolean,
): AioStageOption {
  return {
    key,
    name,
    device: 'cpu',
    use_case: implemented ? name : 'Download only — no local runtime yet',
    available: implemented,
    implemented,
  };
}

function createPreset(translationKey: string): AioLanguageModelPreset {
  return {
    id: 'preset-1',
    name: 'Manga JA',
    description: '',
    sourceLanguage: 'ja',
    stageModels: {
      detectText: 'font_rtdetr_v2',
      recognizeText: 'manga_ocr',
      getTranslations: translationKey,
      segmentText: 'baka_content_cc',
      cleanImage: 'aot',
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

const TRANSLATION_OPTIONS: readonly AioStageOption[] = [
  createTranslationOption('google_translate', 'Google Translate', true),
  createTranslationOption('nllb-200-600m-int8', 'NLLB-200 600M int8', false),
  createTranslationOption('opus-mt-ja-en', 'OPUS-MT JA→EN', true),
];

describe('repairDownloadOnlyPresetTranslation', () => {
  it('swaps a download-only key for the default translation model', () => {
    const preset = createPreset('nllb-200-600m-int8');

    const repaired = repairDownloadOnlyPresetTranslation(
      preset,
      TRANSLATION_OPTIONS,
    );

    expect(repaired.replacedKey).toBe('nllb-200-600m-int8');
    expect(repaired.replacementName).toBe('Google Translate');
    expect(repaired.preset.stageModels.getTranslations).toBe(
      DEFAULT_TRANSLATION_STAGE_MODEL_KEY,
    );
    expect(repaired.preset.stageModels.detectText).toBe('font_rtdetr_v2');
    expect(repaired.preset.stageModels.recognizeText).toBe('manga_ocr');
    expect(preset.stageModels.getTranslations).toBe('nllb-200-600m-int8');
  });

  it('leaves a runnable key untouched', () => {
    const preset = createPreset('opus-mt-ja-en');

    const repaired = repairDownloadOnlyPresetTranslation(
      preset,
      TRANSLATION_OPTIONS,
    );

    expect(repaired.replacedKey).toBeNull();
    expect(repaired.preset).toBe(preset);
  });

  it('leaves a key that left the catalog to the existing partial-apply path', () => {
    const preset = createPreset('retired-model');

    const repaired = repairDownloadOnlyPresetTranslation(
      preset,
      TRANSLATION_OPTIONS,
    );

    expect(repaired.replacedKey).toBeNull();
    expect(repaired.preset).toBe(preset);
  });

  it('keeps the default stage model when the preset has no translation key', () => {
    const base = createPreset('google_translate');
    const preset: AioLanguageModelPreset = {
      ...base,
      stageModels: { ...base.stageModels, getTranslations: '' },
    };

    const repaired = repairDownloadOnlyPresetTranslation(
      preset,
      TRANSLATION_OPTIONS,
    );

    expect(repaired.replacedKey).toBeNull();
    expect(repaired.preset).toBe(preset);
  });
});
