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

  it('skips OCR writes for text-locked regions but still normalizes renderText', () => {
    const next = mergeOcrIntoRegions(
      [
        region('a', {
          lockedFields: { text: true },
          renderText: '  ',
          recognizedText: 'kept',
          ocrScore: 0.5,
          ocrModelKey: 'kept-ocr',
        }),
        region('b', { recognizedText: 'kept' }),
      ],
      {
        regions: [
          { id: 'a', text: 'new', score: 0.9, ocr_model_key: 'new-ocr' },
          { id: 'b', text: 'new', score: 0.9, ocr_model_key: 'new-ocr' },
        ],
      } as never,
    );
    expect(next[0]?.renderText).toBeUndefined();
    expect(next[0]?.recognizedText).toBe('kept');
    expect(next[0]?.ocrScore).toBe(0.5);
    expect(next[0]?.ocrModelKey).toBe('kept-ocr');
    expect(next[0]?.detectedGradient).toBeUndefined();
    expect(next[1]?.recognizedText).toBe('new');
    expect(next[1]?.ocrModelKey).toBe('new-ocr');
  });

  it('treats a legacy locked region as text-locked for the OCR merge', () => {
    const next = mergeOcrIntoRegions(
      [region('a', { locked: true, recognizedText: 'kept' })],
      {
        regions: [{ id: 'a', text: 'new', score: 0.9, ocr_model_key: 'new-ocr' }],
      } as never,
    );
    expect(next[0]?.recognizedText).toBe('kept');
    expect(next[0]?.ocrScore).toBeUndefined();
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

  it('copies translation_source provenance onto the merged region', () => {
    const next = mergeTranslationIntoRegions(
      [region('a'), region('b', { translationSource: 'tm' })],
      {
        regions: [
          {
            id: 'a',
            source_text: 'olá',
            translated_text: 'hi',
            source: 'model',
            detector_model_key: 'd',
            ocr_model_key: 'o',
            translator_model_key: 't',
            translation_source: 'tm',
          },
          {
            id: 'b',
            source_text: 'olá',
            translated_text: 'hello',
            source: 'model',
            detector_model_key: 'd',
            ocr_model_key: 'o',
            translator_model_key: 't',
            translation_source: null,
          },
        ],
      },
    );
    expect(next[0]?.translationSource).toBe('tm');
    expect(next[1]?.translationSource).toBeNull();
  });

  it('skips all translation-derived writes for text-locked regions', () => {
    const next = mergeTranslationIntoRegions(
      [
        region('a', {
          lockedFields: { text: true },
          recognizedText: 'kept',
          translatorModelKey: 'kept-translator',
          translationSource: 'cache',
        }),
        region('b', { recognizedText: 'old' }),
      ],
      {
        regions: [
          {
            id: 'a',
            source_text: 'original',
            translated_text: 'new',
            translation_notes: ['note'],
            source: 'model',
            detector_model_key: 'detector',
            ocr_model_key: 'ocr',
            translator_model_key: 'new-translator',
            translation_source: 'engine',
          },
          {
            id: 'b',
            source_text: 'original',
            translated_text: 'new',
            translation_notes: ['note'],
            source: 'model',
            detector_model_key: 'detector',
            ocr_model_key: 'ocr',
            translator_model_key: 'new-translator',
            translation_source: 'engine',
          },
        ],
      },
    );
    expect(next[0]?.translatedText).toBeUndefined();
    expect(next[0]?.translationNotes).toBeUndefined();
    expect(next[0]?.translatorModelKey).toBe('kept-translator');
    expect(next[0]?.translationSource).toBe('cache');
    expect(next[0]?.translationNoteOverlay).toBeUndefined();
    expect(next[1]?.translatedText).toBe('new');
    expect(next[1]?.translatorModelKey).toBe('new-translator');
    expect(next[1]?.translationSource).toBe('engine');
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
