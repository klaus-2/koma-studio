import { describe, expect, it } from 'vitest';

import {
  mergeOcrIntoRegions,
  mergeSegmentIntoRegions,
  mergeTranslationIntoRegions,
} from './merge';
import type { AioTextRegion } from '../types/dashboard.types';

const region = (id: string, overrides: Partial<AioTextRegion> = {}): AioTextRegion =>
  ({
    id,
    bbox: [0, 0, 10, 10],
    score: 1,
    source: 'detect',
    modelKey: 'm',
    ...overrides,
  }) as AioTextRegion;

describe('mergeOcrIntoRegions', () => {
  it('matches by id and fills OCR fields', () => {
    const regions = [region('a', { renderText: '   ' }), region('b')];
    const next = mergeOcrIntoRegions(regions, {
      regions: [
        {
          id: 'a',
          text: 'hi',
          score: 0.9,
          ocr_model_key: 'ocr',
          foreground_gradient: {
            angle_degrees: 45,
            start_rgb: [10, 20, 30],
            end_rgb: [40, 50, 60],
          },
        },
        { id: 'b', text: 'yo', score: 0.8, ocr_model_key: 'ocr' },
      ],
    } as never);
    expect(next[0]?.renderText).toBeUndefined();
    expect(next[0]?.recognizedText).toBe('hi');
    expect(next[0]?.detectedGradient?.angle).toBe(45);
    expect(next[1]?.recognizedText).toBe('yo');
  });

  it('falls back to index when id is missing', () => {
    const next = mergeOcrIntoRegions([region('a')], {
      regions: [{ id: 'zz', text: 'x', score: 1, ocr_model_key: 'ocr' }],
    } as never);
    expect(next[0]?.recognizedText).toBe('x');
  });
});

describe('mergeTranslationIntoRegions', () => {
  it('writes translation fields and clears note overlay', () => {
    const next = mergeTranslationIntoRegions(
      [region('a', { translationNoteOverlay: undefined })],
      {
        regions: [
          {
            id: 'a',
            translated_text: 'olá',
            translation_notes: 'n',
            translator_model_key: 't',
          },
        ],
      } as never,
    );
    expect(next[0]?.translatedText).toBe('olá');
    expect(next[0]?.translationNoteOverlay).toBeUndefined();
    expect(next[0]?.translatorModelKey).toBe('t');
  });
});

describe('mergeSegmentIntoRegions', () => {
  it('writes segment boxes and mask', () => {
    const next = mergeSegmentIntoRegions([region('a')], {
      regions: [
        {
          id: 'a',
          segment_boxes: [[0, 0, 1, 1]],
          merged_boxes: [[0, 0, 2, 2]],
          segment_model_key: 's',
          mask_base64: 'm',
        },
      ],
    } as never);
    expect(next[0]?.segmentBoxes).toEqual([[0, 0, 1, 1]]);
    expect(next[0]?.maskBase64).toBe('m');
  });
});
