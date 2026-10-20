import { describe, expect, it } from 'vitest';

import {
  toCleanRegionsJson,
  toOcrRegionsJson,
  toStructuralRegionsJson,
  toTranslateRegionsJson,
} from './payloads';
import type { AioTextRegion } from '../types/dashboard.types';

const image = { file: new File([], 'p.png'), width: 100, height: 50 };
const region = (id: string, overrides: Partial<AioTextRegion> = {}): AioTextRegion =>
  ({
    id,
    bbox: [1.4, 2.6, 20.2, 30.8],
    score: 0.5,
    source: 'detect',
    modelKey: 'det',
    ...overrides,
  }) as AioTextRegion;

describe('toOcrRegionsJson', () => {
  it('clamps bbox and maps detector key', () => {
    const parsed = JSON.parse(toOcrRegionsJson([region('a')], image));
    expect(parsed[0].bbox).toEqual([1, 2, 21, 31]);
    expect(parsed[0].detector_model_key).toBe('det');
  });
});

describe('toTranslateRegionsJson', () => {
  it('includes SFX context fields with defaults', () => {
    const parsed = JSON.parse(toTranslateRegionsJson([region('a')], 'ocr-fb'));
    expect(parsed[0].ocr_model_key).toBe('ocr-fb');
    expect(parsed[0].detected_render_mode).toBe('');
    expect(parsed[0].structural_type).toBe('');
    expect(parsed[0].sfx_requires_redraw).toBe(false);
  });
});

describe('toStructuralRegionsJson', () => {
  it('owns score + structural fields for /clean/ai and /sfx', () => {
    const parsed = JSON.parse(
      toStructuralRegionsJson(
        [region('a', { structuralType: 'scream', detectedRenderMode: 'text_sfx' })],
        image,
      ),
    );
    expect(parsed[0].score).toBe(0.5);
    expect(parsed[0].structural_type).toBe('scream');
    expect(parsed[0].detected_render_mode).toBe('text_sfx');
    expect(parsed[0].matched_reference_image).toBeNull();
  });
});

describe('toCleanRegionsJson', () => {
  it('includes segment and mask fields for inpaint', () => {
    const parsed = JSON.parse(
      toCleanRegionsJson(
        [region('a', { segmentBoxes: [[0, 0, 1, 1]], maskBase64: 'm' })],
        image,
        'ocr-fb',
        'seg-fb',
      ),
    );
    expect(parsed[0].segment_boxes).toEqual([[0, 0, 1, 1]]);
    expect(parsed[0].mask_base64).toBe('m');
    expect(parsed[0].segment_model_key).toBe('seg-fb');
  });
});
