import { describe, expect, test } from 'vitest';

import {
  DEFAULT_AIO_AI_OPTIONS,
  DEFAULT_IMAGE_EDIT_MODEL_CONFIG,
  getProtocolSupportedModelParams,
  sanitizeAioAiOptions,
  sanitizeImageEditModelConfig,
  toBackendAioAiOptionsPayload,
  toBackendImageEditModelConfigPayload,
} from './imageEditModelConfig';

describe('imageEditModelConfig', () => {
  test('clamps numeric parameters and falls back safely on invalid enums', () => {
    const safe = sanitizeImageEditModelConfig({
      temperature: 4.5,
      topP: -0.2,
      maxTokens: 12,
      seed: 99_999_999_999,
      numInferenceSteps: 180,
      guidanceScale: 30,
      imageQuality: '8k',
      inputFidelity: 'low',
      aspectRatioStrategy: 'pad_unpad',
      slicingMode: 'custom',
      segmentHeight: 9999,
      segmentOverlap: 5,
      maxConcurrentSegments: 10,
      compositeMaskMargin: 120,
    });

    expect(safe).toEqual({
      temperature: 2,
      topP: 0,
      maxTokens: 128,
      seed: 2_147_483_647,
      numInferenceSteps: 100,
      guidanceScale: 20,
      imageQuality: DEFAULT_IMAGE_EDIT_MODEL_CONFIG.imageQuality,
      inputFidelity: 'low',
      aspectRatioStrategy: 'pad_unpad',
      slicingMode: 'custom',
      segmentHeight: 2800,
      segmentOverlap: 40,
      maxConcurrentSegments: 4,
      compositeMaskMargin: 48,
    });
  });

  test('serializes snake_case payloads expected by /clean/ai and /aio/ai', () => {
    const configPayload = toBackendImageEditModelConfigPayload({
      temperature: 0.25,
      topP: 0.9,
      maxTokens: 4096,
      seed: 42,
      numInferenceSteps: 24,
      guidanceScale: 4.5,
      imageQuality: '2k',
      inputFidelity: 'high',
      aspectRatioStrategy: 'pad_unpad',
      slicingMode: 'custom',
      segmentHeight: 1600,
      segmentOverlap: 200,
      maxConcurrentSegments: 3,
      compositeMaskMargin: 16,
    });
    expect(configPayload).toEqual({
      temperature: 0.25,
      top_p: 0.9,
      max_tokens: 4096,
      seed: 42,
      num_inference_steps: 24,
      guidance_scale: 4.5,
      image_quality: '2k',
      input_fidelity: 'high',
      aspect_ratio_strategy: 'pad_unpad',
      slicing_mode: 'custom',
      segment_height: 1600,
      segment_overlap: 200,
      max_concurrent_segments: 3,
      composite_mask_margin: 16,
    });

    const optionsPayload = toBackendAioAiOptionsPayload({
      ...DEFAULT_AIO_AI_OPTIONS,
      executionMode: 'hybrid_guided',
      preserveArtwork: true,
    });
    expect(optionsPayload).toEqual({
      execution_mode: 'hybrid_guided',
      sfx_mode: 'translate',
      style_mode: 'match_original',
      refine_alignment: true,
      preserve_artwork: true,
      skip_empty_pages: true,
    });
  });

  test('maps protocol capability matrix accurately for Gemini, OpenAI edits, and fal/replicate', () => {
    expect(
      getProtocolSupportedModelParams(
        'auto',
        'https://generativelanguage.googleapis.com/v1beta/models',
      ),
    ).toMatchObject({
      resolvedProtocol: 'gemini',
      temperature: 'supported',
      seed: 'supported',
      imageQuality: 'supported',
    });

    expect(
      getProtocolSupportedModelParams('openai_images_edits', 'https://api.openai.com/v1'),
    ).toMatchObject({
      resolvedProtocol: 'openai_images_edits',
      temperature: 'ignored',
      imageQuality: 'supported',
      inputFidelity: 'supported',
    });

    expect(getProtocolSupportedModelParams('fal', 'https://fal.run')).toMatchObject({
      resolvedProtocol: 'fal',
      temperature: 'ignored',
      seed: 'supported',
      numInferenceSteps: 'ignored',
      guidanceScale: 'ignored',
      slicingAndComposite: 'supported',
    });

    expect(getProtocolSupportedModelParams('auto', '', true)).toMatchObject({
      resolvedProtocol: 'local_diffusers',
      temperature: 'ignored',
      seed: 'supported',
      numInferenceSteps: 'supported',
      guidanceScale: 'supported',
      slicingAndComposite: 'supported',
    });

    expect(sanitizeAioAiOptions(undefined)).toEqual(DEFAULT_AIO_AI_OPTIONS);
  });
});
