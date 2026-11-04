/**
 * Form-shape pin: the exact multipart field set each AIO stage-run posts.
 *
 * Written against the pre-refactor per-module FormData builds and kept green
 * through the shared form-prep seam as the equivalence proof. Asserts the
 * FIELD MAP (name → value) and presence/absence semantics — never the append
 * order, which is multipart-insensitive on the FastAPI side.
 *
 * The transport seam is stubbed (the error/busy/notice contract lives in
 * transport.test.ts), so stage promises never settle here; only the captured
 * spec (path + form) is asserted and the parse step is never invoked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AioTextRegion } from '../types/dashboard.types';
import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
  type LlmRequestSettings,
} from '../utils/customLlm';
import { isRecord } from '../utils/guards';
import { runCleanImageAiStage, runSfxClassifyStage } from './cleanImageAi';
import { runCleanImageStage } from './cleanImage';
import { runDetectTextStage } from './detectText';
import { runGetTranslationsStage } from './getTranslations';
import { runRecognizeTextStage } from './recognizeText';
import { runSegmentTextStage } from './segmentText';
import type { StageRunOptions } from './transport';
import type { FinishedStageRun, StageRuntime } from './types';

interface CapturedStageFormSpec {
  readonly path: string;
  readonly form: FormData;
  readonly timeoutMs: number;
}

const { capturedSpecs, runStageFormStub } = vi.hoisted(() => {
  const captured: CapturedStageFormSpec[] = [];
  const stub = async <T>(
    _runtime: StageRuntime,
    _options: StageRunOptions,
    spec: {
      readonly path: string;
      readonly form: FormData;
      readonly timeoutMs: number;
      readonly parse: (response: Response) => Promise<T>;
    },
  ): Promise<FinishedStageRun<T>> => {
    captured.push({ path: spec.path, form: spec.form, timeoutMs: spec.timeoutMs });
    // Stage values are irrelevant to form-shape assertions; the returned
    // promise intentionally never settles and parse is never invoked.
    return new Promise<FinishedStageRun<T>>(() => undefined);
  };
  return { capturedSpecs: captured, runStageFormStub: stub };
});

vi.mock('./transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transport')>();
  return {
    ...actual,
    runStageForm: runStageFormStub,
  };
});

const runtime: StageRuntime = { localApiUrl: 'http://127.0.0.1:8765' };

const stageOptions: StageRunOptions = {
  stageLabel: 'Form shape pin',
  failurePrefix: 'Form shape pin failure',
  parseApiError: async () => 'unused',
};

const pageFile = new File(['png-bytes'], 'page.png', { type: 'image/png' });
const image = { file: pageFile, width: 100, height: 50 };

const region = (id: string, overrides: Partial<AioTextRegion> = {}): AioTextRegion => ({
  id,
  bbox: [1.4, 2.6, 20.2, 30.8],
  score: 0.5,
  source: 'manual',
  modelKey: 'det-model',
  ...overrides,
});

const llmSettings: LlmRequestSettings = {
  extra_context: '',
  image_input_enabled: true,
  temperature: 0.2,
  top_p: 0.95,
  max_tokens: 4096,
  translation_notes_enabled: true,
  neighbor_image_context_enabled: false,
  translation_memory_enabled: false,
  glossary: [],
};

const customProfile: CustomLlmRequestProfile = {
  apiBase: 'https://llm.example/v1',
  apiKey: 'key',
  model: 'test-model',
};

const capturedSpec = (): CapturedStageFormSpec => {
  const spec = capturedSpecs.at(-1);
  if (!spec) {
    throw new Error('runStageForm was not called');
  }
  return spec;
};

const fieldMap = (form: FormData): Map<string, string | File> => {
  const map = new Map<string, string | File>();
  for (const [name, value] of form.entries()) {
    map.set(name, value);
  }
  return map;
};

const expectFieldSet = (form: FormData, expected: readonly string[]): void => {
  expect(new Set(fieldMap(form).keys())).toEqual(new Set(expected));
};

const fieldString = (form: FormData, name: string): string => {
  const value = fieldMap(form).get(name);
  if (typeof value !== 'string') {
    throw new Error(`Field "${name}" is missing or not a string value`);
  }
  return value;
};

const expectFileField = (form: FormData, name: string, file: File): void => {
  expect(fieldMap(form).get(name)).toBe(file);
};

const expectJsonField = (form: FormData, name: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(fieldString(form, name));
  if (!isRecord(parsed)) {
    throw new Error(`Field "${name}" is not a JSON object`);
  }
  return parsed;
};

/** Regions fields are single-element JSON arrays in these fixtures. */
const expectFirstRegionJson = (form: FormData): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(fieldString(form, 'regions'));
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error('Field "regions" is not a single-element JSON array');
  }
  const first: unknown = parsed[0];
  if (!isRecord(first)) {
    throw new Error('regions[0] is not a JSON object');
  }
  return first;
};

beforeEach(() => {
  capturedSpecs.length = 0;
});

describe('runDetectTextStage form shape', () => {
  it('posts file, model_key, language, source_language and use_gpu to /detect', () => {
    void runDetectTextStage(
      { image, modelKey: 'det-model', sourceLanguage: 'ja', useGpu: true, minRegionSize: 8 },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/detect');
    const form = capturedSpec().form;
    expectFieldSet(form, ['file', 'model_key', 'language', 'source_language', 'use_gpu']);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'model_key')).toBe('det-model');
    expect(fieldString(form, 'language')).toBe('ja');
    expect(fieldString(form, 'source_language')).toBe('ja');
    expect(fieldString(form, 'use_gpu')).toBe('true');
  });

  it('omits use_gpu when undefined and sends it as "false" when defined-false', () => {
    void runDetectTextStage(
      { image, modelKey: 'det-model', sourceLanguage: 'ja', minRegionSize: 8 },
      runtime,
      stageOptions,
    );
    expectFieldSet(capturedSpec().form, ['file', 'model_key', 'language', 'source_language']);

    void runDetectTextStage(
      { image, modelKey: 'det-model', sourceLanguage: 'ja', useGpu: false, minRegionSize: 8 },
      runtime,
      stageOptions,
    );
    expectFieldSet(capturedSpec().form, [
      'file',
      'model_key',
      'language',
      'source_language',
      'use_gpu',
    ]);
    expect(fieldString(capturedSpec().form, 'use_gpu')).toBe('false');
  });
});

describe('runRecognizeTextStage form shape', () => {
  it('posts the full field set with llm_settings, custom_llm and use_gpu to /ocr', () => {
    void runRecognizeTextStage(
      {
        image,
        modelKey: 'ocr-model',
        sourceLanguage: 'ja',
        regions: [region('r1')],
        useGpu: true,
        useCloudOcr: false,
        llmSettings,
        customProfile,
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/ocr');
    const form = capturedSpec().form;
    expectFieldSet(form, [
      'file',
      'model_key',
      'language',
      'regions',
      'llm_settings',
      'custom_llm',
      'use_gpu',
    ]);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'model_key')).toBe('ocr-model');
    expect(fieldString(form, 'use_gpu')).toBe('true');
    expect(expectJsonField(form, 'llm_settings')).toEqual(llmSettings);
    expect(expectJsonField(form, 'custom_llm')).toEqual(
      toCustomLlmRequestPayload(customProfile),
    );
    const regions = expectFirstRegionJson(form);
    expect(regions.id).toBe('r1');
    expect(regions.detector_model_key).toBe('det-model');
  });

  it('drops use_gpu for cloud OCR and custom_llm without a custom profile', () => {
    void runRecognizeTextStage(
      {
        image,
        modelKey: 'gpt_4o',
        sourceLanguage: 'ja',
        regions: [region('r1')],
        useGpu: true,
        useCloudOcr: true,
      },
      runtime,
      stageOptions,
    );
    expectFieldSet(capturedSpec().form, ['file', 'model_key', 'language', 'regions']);

    void runRecognizeTextStage(
      {
        image,
        modelKey: 'ocr-model',
        sourceLanguage: 'ja',
        regions: [region('r1')],
        llmSettings,
        customProfile: null,
      },
      runtime,
      stageOptions,
    );
    expectFieldSet(capturedSpec().form, [
      'file',
      'model_key',
      'language',
      'regions',
      'llm_settings',
    ]);
  });
});

describe('runGetTranslationsStage form shape', () => {
  it('posts the sfx + LLM field set including file to /translate', () => {
    void runGetTranslationsStage(
      {
        image,
        modelKey: 'tr-model',
        sourceLanguage: 'ja',
        targetLanguage: 'en',
        regions: [region('r1')],
        fallbackOcrModelKey: 'ocr-fb',
        llmSettings,
        customProfile,
        sfx: { extraContext: 'ctx' },
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/translate');
    const form = capturedSpec().form;
    expectFieldSet(form, [
      'model_key',
      'source_language',
      'target_language',
      'translation_mode',
      'extra_context',
      'file',
      'llm_settings',
      'custom_llm',
      'regions',
    ]);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'translation_mode')).toBe('sfx');
    expect(fieldString(form, 'extra_context')).toBe('ctx');
    expect(expectJsonField(form, 'llm_settings')).toEqual(llmSettings);
    expect(expectJsonField(form, 'custom_llm')).toEqual(
      toCustomLlmRequestPayload(customProfile),
    );
  });

  it('never sends use_gpu, and sends file only in LLM mode', () => {
    void runGetTranslationsStage(
      {
        image,
        modelKey: 'tr-model',
        sourceLanguage: 'ja',
        targetLanguage: 'en',
        regions: [region('r1')],
        fallbackOcrModelKey: 'ocr-fb',
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    const form = capturedSpec().form;
    expectFieldSet(form, ['model_key', 'source_language', 'target_language', 'regions']);
    expect(fieldString(form, 'model_key')).toBe('tr-model');
    const regions = expectFirstRegionJson(form);
    expect(regions.ocr_model_key).toBe('ocr-fb');
  });
});

describe('runSegmentTextStage form shape', () => {
  it('posts file, model_key, use_gpu and regions to /segment', () => {
    void runSegmentTextStage(
      {
        image,
        modelKey: 'seg-model',
        regions: [region('r1')],
        fallbackOcrModelKey: 'ocr-fb',
        fallbackTranslatorModelKey: 'tr-fb',
        useGpu: true,
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/segment');
    const form = capturedSpec().form;
    expectFieldSet(form, ['file', 'model_key', 'use_gpu', 'regions']);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'use_gpu')).toBe('true');
    const regions = expectFirstRegionJson(form);
    expect(regions.ocr_model_key).toBe('ocr-fb');
    expect(regions.translator_model_key).toBe('tr-fb');
  });

  it('omits use_gpu when undefined', () => {
    void runSegmentTextStage(
      {
        image,
        modelKey: 'seg-model',
        regions: [region('r1')],
        fallbackOcrModelKey: 'ocr-fb',
        fallbackTranslatorModelKey: 'tr-fb',
      },
      runtime,
      stageOptions,
    );
    expectFieldSet(capturedSpec().form, ['file', 'model_key', 'regions']);
  });
});

describe('runCleanImageStage form shape', () => {
  it('posts the inpaint field set with hd_strategy options to /inpaint', () => {
    void runCleanImageStage(
      {
        image,
        modelKey: 'cl-model',
        regions: [region('r1', { maskBase64: 'mask-bytes' })],
        fallbackOcrModelKey: 'ocr-fb',
        fallbackSegmentModelKey: 'seg-fb',
        options: {
          maskDilation: 3,
          hdStrategy: 'resize',
          hdResizeLimit: 2048,
          hdCropMargin: 16,
          hdCropTriggerSize: 1024,
        },
        useGpu: false,
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/inpaint');
    const form = capturedSpec().form;
    expectFieldSet(form, [
      'file',
      'model_key',
      'use_gpu',
      'mask_dilation',
      'hd_strategy',
      'hd_strategy_resize_limit',
      'hd_strategy_crop_margin',
      'hd_strategy_crop_trigger_size',
      'regions',
    ]);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'use_gpu')).toBe('false');
    expect(fieldString(form, 'mask_dilation')).toBe('3');
    expect(fieldString(form, 'hd_strategy')).toBe('resize');
    expect(fieldString(form, 'hd_strategy_resize_limit')).toBe('2048');
    expect(fieldString(form, 'hd_strategy_crop_margin')).toBe('16');
    expect(fieldString(form, 'hd_strategy_crop_trigger_size')).toBe('1024');
    const regions = expectFirstRegionJson(form);
    expect(regions.mask_base64).toBe('mask-bytes');
    expect(regions.segment_model_key).toBe('seg-fb');
  });

  it('omits brush_mask when no brush data URL is given', () => {
    void runCleanImageStage(
      {
        image,
        modelKey: 'cl-model',
        regions: [region('r1')],
        fallbackOcrModelKey: 'ocr-fb',
        fallbackSegmentModelKey: 'seg-fb',
        options: {
          maskDilation: 0,
          hdStrategy: 'original',
          hdResizeLimit: 4096,
          hdCropMargin: 0,
          hdCropTriggerSize: 0,
        },
      },
      runtime,
      stageOptions,
    );
    expectFieldSet(capturedSpec().form, [
      'file',
      'model_key',
      'mask_dilation',
      'hd_strategy',
      'hd_strategy_resize_limit',
      'hd_strategy_crop_margin',
      'hd_strategy_crop_trigger_size',
      'regions',
    ]);
    // The brush_mask presence branch (brushDataUrl → decoded blob appended as
    // 'brush_mask.png') requires a canvas decode and is covered by the
    // brushDataUrlToMaskBlob contract, not by this environment-bound pin.
  });
});

describe('runCleanImageAiStage form shape', () => {
  it('posts the structural field set with custom_llm to /clean/ai', () => {
    void runCleanImageAiStage(
      {
        image,
        modelKey: 'ai-model',
        regions: [region('r1')],
        additionalInstructions: 'keep style',
        customProfile,
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/clean/ai');
    const form = capturedSpec().form;
    expectFieldSet(form, ['file', 'model_key', 'regions', 'additional_instructions', 'custom_llm']);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'additional_instructions')).toBe('keep style');
    expect(expectJsonField(form, 'custom_llm')).toEqual(
      toCustomLlmRequestPayload(customProfile),
    );
  });
});

describe('runSfxClassifyStage form shape', () => {
  it('posts the structural field set to /sfx/classify and omits custom_llm without a profile', () => {
    void runSfxClassifyStage(
      {
        image,
        modelKey: 'sfx-model',
        regions: [region('r1')],
        additionalInstructions: 'classify sfx',
      },
      runtime,
      stageOptions,
    );

    expect(capturedSpecs).toHaveLength(1);
    expect(capturedSpec().path).toBe('/sfx/classify');
    const form = capturedSpec().form;
    expectFieldSet(form, ['file', 'model_key', 'regions', 'additional_instructions']);
    expectFileField(form, 'file', pageFile);
    expect(fieldString(form, 'additional_instructions')).toBe('classify sfx');
  });
});
