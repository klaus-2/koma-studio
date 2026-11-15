import { describe, expect, it } from 'vitest';

import { parseBatchProgress } from './batch-wire';

const VALID_PAYLOAD = {
  batchId: 'batch-1',
  total: 3,
  completed: 1,
  failed: 0,
  stageUnitsStarted: 4,
  currentIndex: 1,
  currentName: 'page-2.png',
  currentStage: 'ocr',
  cancelled: false,
  finished: false,
  updatedAt: '2026-11-14T00:00:00.000Z',
  stageSeconds: { detect: 1.5, ocr: 2.25, translation: 0, segment: 0, clean: 0.5 },
  lastStageMs: 2250,
};

describe('parseBatchProgress timing fields (Fase D F5)', () => {
  it('parses stageSeconds and lastStageMs on current payloads', () => {
    const parsed = parseBatchProgress(VALID_PAYLOAD, 200);

    expect(parsed.stageSeconds).toEqual({
      detect: 1.5,
      ocr: 2.25,
      translation: 0,
      segment: 0,
      clean: 0.5,
    });
    expect(parsed.lastStageMs).toBe(2250);
  });

  it('returns null fields for legacy sidecar payloads without them', () => {
    const {
      stageSeconds: _omittedSeconds,
      lastStageMs: _omittedMs,
      ...legacy
    } = VALID_PAYLOAD;

    const parsed = parseBatchProgress(legacy, 200);

    expect(parsed.stageSeconds).toBeNull();
    expect(parsed.lastStageMs).toBeNull();
    expect(parsed.batchId).toBe('batch-1');
  });

  it('drops non-finite and negative stage seconds instead of failing', () => {
    const payload = {
      ...VALID_PAYLOAD,
      stageSeconds: {
        detect: Number.POSITIVE_INFINITY,
        ocr: Number.NaN,
        translation: -1,
        segment: 'not-a-number',
        clean: 0.5,
      },
    };

    const parsed = parseBatchProgress(payload, 200);

    expect(parsed.stageSeconds).toEqual({ clean: 0.5 });
  });

  it('keeps null for a non-record stageSeconds value', () => {
    const parsed = parseBatchProgress(
      { ...VALID_PAYLOAD, stageSeconds: 'bogus' },
      200,
    );

    expect(parsed.stageSeconds).toBeNull();
  });

  it('rounds a fractional lastStageMs to an integer', () => {
    const parsed = parseBatchProgress(
      { ...VALID_PAYLOAD, lastStageMs: 123.7 },
      200,
    );

    expect(parsed.lastStageMs).toBe(124);
  });
});
