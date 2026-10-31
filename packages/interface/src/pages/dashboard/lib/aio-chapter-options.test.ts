import { describe, expect, it } from 'vitest';

import {
  findChapterPreset,
  isChapterPresetRunnable,
  resolveChapterBatchOptions,
} from '@/pages/dashboard/lib/aio-chapter-options';
import type {
  AioLanguageModelPreset,
  AioStageSelection,
} from '@/types/aioModelPresets';
import type { AioStageOption, AioStageOptionMap } from '@/models/aioStageCatalog';
import type { LocalAioBatchOptions } from '@/pages/dashboard/lib/local-aio-batch';
import { cloneRenderStyle } from '@/utils/dashboard.utils';

const option = (
  key: string,
  overrides: Partial<AioStageOption> = {},
): AioStageOption => ({
  key,
  name: key,
  device: 'cpu',
  use_case: '',
  available: true,
  implemented: true,
  ...overrides,
});

const makeStageOptions = (
  overrides: Partial<AioStageOptionMap> = {},
): AioStageOptionMap => ({
  detectText: [option('detector'), option('detector-alt')],
  recognizeText: [option('ocr'), option('ocr-alt')],
  getTranslations: [option('translation'), option('translation-alt')],
  segmentText: [option('segment')],
  cleanImage: [option('clean')],
  ...overrides,
});

const SELECTION: AioStageSelection = {
  detectText: 'detector-alt',
  recognizeText: 'ocr-alt',
  getTranslations: 'translation-alt',
  segmentText: 'segment',
  cleanImage: 'clean',
};

const makePreset = (
  overrides: Partial<AioLanguageModelPreset> = {},
): AioLanguageModelPreset => ({
  id: 'preset-1',
  name: 'Preset',
  description: '',
  sourceLanguage: 'ja',
  stageModels: SELECTION,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const makeBase = (): LocalAioBatchOptions => ({
  sourceLanguage: 'ja',
  targetLanguage: 'en',
  detectModelKey: 'detector',
  ocrModelKey: 'ocr',
  translationModelKey: 'translation',
  segmentModelKey: 'segment',
  cleanModelKey: 'clean',
  aioSteps: {
    recognizeText: true,
    getTranslations: true,
    segmentText: false,
    cleanImage: false,
    render: true,
  },
  llmSettings: {
    extra_context: '',
    image_input_enabled: false,
    temperature: 0,
    top_p: 1,
    max_tokens: 1024,
    translation_notes_enabled: false,
    neighbor_image_context_enabled: false,
    glossary: [],
  },
  maskDilation: 10,
  hdStrategy: 'original',
  hdResizeLimit: 960,
  hdCropMargin: 512,
  hdCropTriggerSize: 512,
  renderDefaultStyle: cloneRenderStyle(),
  applyDetectedGradientToStyle: (_region, style) => style,
  minRegionSize: 4,
  parseApiError: async () => '',
});

describe('isChapterPresetRunnable', () => {
  it('accepts a preset whose models are installed, implemented and local', () => {
    expect(isChapterPresetRunnable(makePreset(), makeStageOptions())).toBe(true);
  });

  it('rejects a preset naming a model that left the catalog', () => {
    expect(
      isChapterPresetRunnable(
        makePreset({ stageModels: { ...SELECTION, recognizeText: 'gone' } }),
        makeStageOptions(),
      ),
    ).toBe(false);
  });

  it('rejects a preset naming a download-only model', () => {
    const stageOptions = makeStageOptions({
      getTranslations: [
        option('translation'),
        option('translation-alt', { implemented: false }),
      ],
    });

    expect(isChapterPresetRunnable(makePreset(), stageOptions)).toBe(false);
  });

  it('rejects a preset naming a model that is not installed', () => {
    const stageOptions = makeStageOptions({
      recognizeText: [
        option('ocr'),
        option('ocr-alt', { available: false }),
      ],
    });

    expect(isChapterPresetRunnable(makePreset(), stageOptions)).toBe(false);
  });

  it('rejects cloud OCR and cloud translation models', () => {
    const cloudOcr = makeStageOptions({
      recognizeText: [option('ocr'), option('gpt_4o')],
    });
    const cloudTranslation = makeStageOptions({
      getTranslations: [option('translation'), option('gpt_4o_mini')],
    });

    expect(
      isChapterPresetRunnable(
        makePreset({ stageModels: { ...SELECTION, recognizeText: 'gpt_4o' } }),
        cloudOcr,
      ),
    ).toBe(false);
    expect(
      isChapterPresetRunnable(
        makePreset({
          stageModels: { ...SELECTION, getTranslations: 'gpt_4o_mini' },
        }),
        cloudTranslation,
      ),
    ).toBe(false);
  });
});

describe('resolveChapterBatchOptions', () => {
  it('returns the run options unchanged when the chapter has no preset', () => {
    const base = makeBase();

    expect(resolveChapterBatchOptions(base, null, makeStageOptions())).toBe(
      base,
    );
  });

  it('overrides every stage of a runnable preset', () => {
    const resolved = resolveChapterBatchOptions(
      makeBase(),
      makePreset(),
      makeStageOptions(),
    );

    expect(resolved).toMatchObject({
      detectModelKey: 'detector-alt',
      ocrModelKey: 'ocr-alt',
      translationModelKey: 'translation-alt',
      segmentModelKey: 'segment',
      cleanModelKey: 'clean',
    });
  });

  it('keeps every run model when one preset stage is not runnable', () => {
    const base = makeBase();
    const stageOptions = makeStageOptions({
      getTranslations: [
        option('translation'),
        option('translation-alt', { available: false }),
      ],
    });

    expect(resolveChapterBatchOptions(base, makePreset(), stageOptions)).toBe(
      base,
    );
  });
});

describe('findChapterPreset', () => {
  const presets = [
    makePreset({ id: 'p-ja' }),
    makePreset({ id: 'p-pt', sourceLanguage: 'pt-br' }),
  ];

  it('finds the assigned preset for the current source language', () => {
    expect(findChapterPreset(presets, 'p-ja', 'ja')?.id).toBe('p-ja');
  });

  it('ignores an assignment that does not exist', () => {
    expect(findChapterPreset(presets, 'missing', 'ja')).toBeNull();
    expect(findChapterPreset(presets, undefined, 'ja')).toBeNull();
  });

  it('ignores a preset saved for another source language', () => {
    expect(findChapterPreset(presets, 'p-pt', 'ja')).toBeNull();
  });

  it('normalizes casing and surrounding whitespace on both sides', () => {
    expect(findChapterPreset(presets, 'p-pt', ' PT-BR ')?.id).toBe('p-pt');
  });
});
