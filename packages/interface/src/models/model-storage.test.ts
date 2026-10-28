import { describe, expect, it } from 'vitest';

import { buildModelInstallStates } from './model-storage';
import type { InstalledModelRecord, ModelInstallState, TranslationModel } from './types';

const requireEntry = (
  state: Record<string, ModelInstallState>,
  modelId: string,
): ModelInstallState => {
  const entry = state[modelId];
  if (!entry) {
    throw new Error(`missing install state for ${modelId}`);
  }
  return entry;
};

const model = (id: string): TranslationModel => ({
  id,
  name: id,
  description: '',
  version: '1.0.0',
  stage: 'recognizeText',
  sourceLanguages: ['en'],
  targetLanguages: ['en'],
  requirements: { gpu: false, vramMin: '', ramMin: '', diskSpace: '1 GB' },
  speed: 'fast',
  downloadUrl: '',
  checksumSHA256: '',
  fileSize: '1 MB',
});

const installed = (
  modelId: string,
  overrides: Partial<InstalledModelRecord> = {},
): InstalledModelRecord => ({
  modelId,
  version: '1.0.0',
  installedAt: '2026-10-01T00:00:00.000Z',
  checksumSHA256: '',
  status: 'installed',
  modelDir: '',
  manifestPath: '',
  sizeBytes: 0,
  ...overrides,
});

describe('buildModelInstallStates easyocr language gate', () => {
  it('keeps easyocr installed when its installed languages include the source language', () => {
    const state = buildModelInstallStates(
      [model('easyocr')],
      [installed('easyocr', { installedLanguages: [' EN '] })],
      'en',
    );

    expect(requireEntry(state, 'easyocr').status).toBe('installed');
    expect(requireEntry(state, 'easyocr').incomplete).toBe(false);
  });

  it('marks easyocr incomplete when the source language is missing from its languages', () => {
    const state = buildModelInstallStates(
      [model('easyocr')],
      [installed('easyocr', { installedLanguages: ['en'] })],
      'pt',
    );

    expect(requireEntry(state, 'easyocr').status).toBe('incomplete');
    expect(requireEntry(state, 'easyocr').incomplete).toBe(true);
  });

  it('keeps easyocr installed when no source language is requested', () => {
    const state = buildModelInstallStates(
      [model('easyocr')],
      [installed('easyocr', { installedLanguages: ['en'] })],
    );

    expect(requireEntry(state, 'easyocr').status).toBe('installed');
  });

  it('ignores the source language for models other than easyocr', () => {
    const state = buildModelInstallStates(
      [model('manga_ocr')],
      [installed('manga_ocr', { installedLanguages: [] })],
      'pt',
    );

    expect(requireEntry(state, 'manga_ocr').status).toBe('installed');
  });
});
