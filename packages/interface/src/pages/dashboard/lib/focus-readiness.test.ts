import { describe, expect, it } from 'vitest';

import type { LocalModelEntry } from '../../../aio-stages/readiness';
import type { AioStageOption } from '../../../models/aioStageCatalog.types';
import {
  deriveFocusReadiness,
  type FocusReadinessInputs,
} from './focus-readiness';
import { FULL_FOCUS_STAGE_TOGGLES } from './focus-flow';

const installed = (id: string): LocalModelEntry => ({
  status: 'installed',
  model: { id, name: id },
});

/** Minimal catalog hit — the real `getAioStageOption` resolves local keys. */
const catalogOption = (key: string): AioStageOption => ({
  key,
  name: key,
  device: 'cpu',
  use_case: 'local',
  available: true,
  implemented: true,
});

const SELECTION = {
  detectText: 'font_rtdetr_v2',
  recognizeText: 'manga_ocr',
  getTranslations: 'local_translator',
  segmentText: 'baka_content_cc',
  cleanImage: 'aot',
};

const baseInputs = (
  overrides: Partial<FocusReadinessInputs> = {},
): FocusReadinessInputs => ({
  steps: FULL_FOCUS_STAGE_TOGGLES,
  selection: SELECTION,
  getStageOption: (_stage, modelKey) => catalogOption(modelKey),
  modelEntries: {
    font_rtdetr_v2: installed('font_rtdetr_v2'),
    manga_ocr: installed('manga_ocr'),
    baka_content_cc: installed('baka_content_cc'),
    aot: installed('aot'),
    local_translator: installed('local_translator'),
  },
  customOcrProfile: null,
  customTranslationProfile: null,
  sourceLanguage: 'ja',
  targetLanguage: 'pt-br',
  stageLabels: {
    detectText: 'Detect',
    recognizeText: 'OCR',
    getTranslations: 'Translate',
    segmentText: 'Segment',
    cleanImage: 'Clean',
  },
  t: (key) => key,
  ...overrides,
});

describe('deriveFocusReadiness', () => {
  it('is ready when every local stage model is installed', () => {
    expect(deriveFocusReadiness(baseInputs())).toEqual({ ready: true });
  });

  it('surfaces the first blocked stage in pipeline order with a manager intent', () => {
    const result = deriveFocusReadiness(baseInputs({ modelEntries: {} }));
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.stage).toBe('detectText');
      expect(result.refusal.kind).toBe('local_not_ready');
      expect(result.refusal.openModelManager?.stage).toBe('detectText');
      expect(result.refusal.message.length).toBeGreaterThan(0);
    }
  });

  it('skips stages disabled in the toggles, like the execution preparation', () => {
    const result = deriveFocusReadiness(
      baseInputs({
        steps: { ...FULL_FOCUS_STAGE_TOGGLES, recognizeText: false },
        modelEntries: {
          font_rtdetr_v2: installed('font_rtdetr_v2'),
          baka_content_cc: installed('baka_content_cc'),
          aot: installed('aot'),
          local_translator: installed('local_translator'),
        },
      }),
    );
    expect(result).toEqual({ ready: true });
  });

  it('flags a not-installed local model before later stages', () => {
    const result = deriveFocusReadiness(
      baseInputs({
        modelEntries: {
          font_rtdetr_v2: installed('font_rtdetr_v2'),
          manga_ocr: { status: 'not_installed', model: { id: 'manga_ocr', name: 'Manga OCR' } },
        },
      }),
    );
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.stage).toBe('recognizeText');
      expect(result.refusal.openModelManager?.focusedModelId).toBe('manga_ocr');
    }
  });
});
