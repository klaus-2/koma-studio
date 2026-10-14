import { describe, expect, it } from 'vitest';

import {
  aioModelPresetStateV2Schema,
  createAioPresetInputSchema,
} from '@/types/aioModelPresets';

const stageModels = {
  detectText: 'detector',
  recognizeText: 'ocr',
  getTranslations: 'translator',
  segmentText: 'segmenter',
  cleanImage: 'cleaner',
};

const preset = {
  id: 'preset-1',
  name: 'Japanese',
  description: '',
  sourceLanguage: 'ja',
  stageModels,
  createdAt: 1,
  updatedAt: 1,
};

describe('AIO preset schemas', () => {
  it('validates a consistent persisted state', () => {
    expect(
      aioModelPresetStateV2Schema.safeParse({
        version: 2,
        presets: [preset],
        activePresetBySourceLanguage: { ja: preset.id },
      }).success,
    ).toBe(true);
  });

  it('rejects duplicate preset IDs', () => {
    expect(
      aioModelPresetStateV2Schema.safeParse({
        version: 2,
        presets: [preset, { ...preset }],
        activePresetBySourceLanguage: {},
      }).success,
    ).toBe(false);
  });

  it('rejects an active preset from another language', () => {
    expect(
      aioModelPresetStateV2Schema.safeParse({
        version: 2,
        presets: [preset],
        activePresetBySourceLanguage: { en: preset.id },
      }).success,
    ).toBe(false);
  });

  it('rejects an active preset that does not exist', () => {
    expect(
      aioModelPresetStateV2Schema.safeParse({
        version: 2,
        presets: [],
        activePresetBySourceLanguage: { ja: 'missing' },
      }).success,
    ).toBe(false);
  });

  it('trims a valid preset name', () => {
    const result = createAioPresetInputSchema.parse({
      name: '  My preset  ',
      sourceLanguage: 'ja',
      stageModels,
    });

    expect(result.name).toBe('My preset');
  });

  it('rejects blank names and empty model selections', () => {
    expect(
      createAioPresetInputSchema.safeParse({
        name: ' ',
        sourceLanguage: 'ja',
        stageModels: { ...stageModels, recognizeText: '' },
      }).success,
    ).toBe(false);
  });
});
