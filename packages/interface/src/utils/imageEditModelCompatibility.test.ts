import { describe, expect, test } from 'vitest';

import {
  assessImageEditModelCompatibility,
  getRecommendedImageEditModels,
  isModelWarningTriggeredForTarget,
} from './imageEditModelCompatibility';

describe('assessImageEditModelCompatibility', () => {
  test('flags text-only LLMs as incompatible across both Clean and AIO AI', () => {
    for (const [model, apiBase] of [
      ['gemini-2.5-flash', 'https://generativelanguage.googleapis.com/v1beta/models'],
      ['gemini-2.5-pro', 'https://generativelanguage.googleapis.com/v1beta/models'],
      ['gpt-4o', 'https://api.openai.com/v1'],
      ['gpt-4o-mini', 'https://openrouter.ai/api/v1'],
      ['openai/gpt-4o', 'https://openrouter.ai/api/v1'],
      ['claude-3.7-sonnet', 'https://openrouter.ai/api/v1'],
      ['deepseek-chat', 'https://api.deepseek.com/v1'],
      ['Qwen/Qwen2.5-VL-72B-Instruct', 'https://openrouter.ai/api/v1'],
    ] as const) {
      const result = assessImageEditModelCompatibility({ model, apiBase, targetMode: 'clean' });
      expect(result.status).toBe('incompatible_text_only');
      expect(result.supportsClean).toBe(false);
      expect(result.supportsAioAi).toBe(false);
      expect(isModelWarningTriggeredForTarget(result, 'clean')).toBe(true);
      expect(isModelWarningTriggeredForTarget(result, 'aio_ai')).toBe(true);
    }
  });

  test('flags local Ollama endpoints immediately as unsupported for image editing', () => {
    const result = assessImageEditModelCompatibility({
      model: 'qwen2.5vl:7b',
      apiBase: 'http://127.0.0.1:11434/v1',
      targetMode: 'aio_ai',
    });

    expect(result.status).toBe('incompatible_text_only');
    expect(result.reasonKey).toBe('localOllama');
    expect(result.supportsClean).toBe(false);
    expect(result.supportsAioAi).toBe(false);
  });

  test('recognizes instruction-based image editors as compatible with both AI Clean and AIO AI', () => {
    for (const model of [
      'gemini-3.1-flash-image-preview',
      'google/gemini-3-pro-image-preview',
      'gemini-2.5-flash-image',
      'gpt-image-1.5',
      'gpt-image-1',
      'fal-ai/nano-banana/edit',
      'fal-ai/nano-banana-pro/edit',
      'google/nano-banana',
      'black-forest-labs/flux-kontext-pro',
      'fal-ai/flux-pro/kontext',
      'qwen/qwen-image-edit',
      'fal-ai/qwen-image-edit',
    ]) {
      const result = assessImageEditModelCompatibility({ model, targetMode: 'aio_ai' });
      expect(result.status).toBe('compatible_both');
      expect(result.supportsClean).toBe(true);
      expect(result.supportsAioAi).toBe(true);
      expect(isModelWarningTriggeredForTarget(result, 'clean')).toBe(false);
      expect(isModelWarningTriggeredForTarget(result, 'aio_ai')).toBe(false);
    }
  });

  test('classifies pure inpainting/removal models as clean_only (warns only for AIO AI)', () => {
    for (const model of [
      'dpakkk/image-object-removal',
      'adirik/inst-inpaint',
      'black-forest-labs/FLUX.1-Fill-dev',
      'stabilityai/stable-diffusion-2-inpainting',
      'search-and-replace',
      '@cf/black-forest-labs/flux-2-klein-9b',
    ]) {
      const result = assessImageEditModelCompatibility({ model, targetMode: 'aio_ai' });
      expect(result.status).toBe('clean_only');
      expect(result.supportsClean).toBe(true);
      expect(result.supportsAioAi).toBe(false);
      expect(isModelWarningTriggeredForTarget(result, 'clean')).toBe(false);
      expect(isModelWarningTriggeredForTarget(result, 'aio_ai')).toBe(true);
    }
  });

  test('provides host-specific image editor replacements', () => {
    expect(
      getRecommendedImageEditModels('https://generativelanguage.googleapis.com/v1beta/models'),
    ).toContain('gemini-3.1-flash-image-preview');
    expect(getRecommendedImageEditModels('https://openrouter.ai/api/v1')).toContain(
      'google/gemini-3.1-flash-image-preview',
    );
    expect(getRecommendedImageEditModels('https://api.openai.com/v1')).toContain('gpt-image-1.5');
  });

  test('classifies local HF light editors as clean_only and advanced editors as compatible_both', () => {
    for (const key of [
      'instruct_pix2pix',
      'local_image_edit:instruct_pix2pix',
      'sdxl_instruct_pix2pix',
      'local_image_edit:sdxl_instruct_pix2pix',
    ]) {
      const res = assessImageEditModelCompatibility({ model: key, targetMode: 'aio_ai' });
      expect(res.status).toBe('clean_only');
      expect(res.supportsClean).toBe(true);
      expect(res.supportsAioAi).toBe(false);
    }

    for (const key of [
      'local_image_edit:flux2_klein_4b_gguf_q4',
      'local_image_edit:flux2_klein_4b',
      'local_image_edit:longcat_image_edit_turbo',
      'local_image_edit:qwen_image_edit_2511_gguf_q4',
      'local_image_edit:qwen_image_edit_2511',
      'local_image_edit:firered_image_edit_1_1',
    ]) {
      const res = assessImageEditModelCompatibility({ model: key, targetMode: 'aio_ai' });
      expect(res.status).toBe('compatible_both');
      expect(res.supportsClean).toBe(true);
      expect(res.supportsAioAi).toBe(true);
    }
  });
});
