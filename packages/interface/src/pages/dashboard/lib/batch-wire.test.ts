import { describe, expect, it } from 'vitest';

import { parseBatchProgress, parsePipelineBatchReport } from './batch-wire';

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

const makeReportPayload = (
  resultOverrides: Record<string, unknown>,
): Record<string, unknown> => ({
  batch_id: 'batch-1',
  total_images: 2,
  succeeded: 2,
  partial: 0,
  failed: 0,
  stages: { detect: true, ocr: true, translation: true, segment: false, clean: false },
  results: [
    { index: 0, filename: 'page-1.png', status: 'success', ...resultOverrides },
    { index: 1, filename: 'page-2.png', status: 'success' },
  ],
});

describe('parsePipelineBatchReport stage_timings (Fase C C4)', () => {
  it('parses per-item stage timings on current payloads', () => {
    const payload = makeReportPayload({
      stage_timings: { detect: 1.2, ocr: 3.4, translation: 0 },
    });

    const parsed = parsePipelineBatchReport(payload);

    expect(parsed.results[0]?.stage_timings).toEqual({
      detect: 1.2,
      ocr: 3.4,
      translation: 0,
    });
    expect(parsed.results[1]?.stage_timings).toBeUndefined();
  });

  it('keeps stage_timings undefined on legacy payloads without the field', () => {
    const parsed = parsePipelineBatchReport(makeReportPayload({}));

    expect(parsed.results[0]?.stage_timings).toBeUndefined();
    expect(parsed.results[0]?.status).toBe('success');
  });

  it('drops non-finite and negative timings, and non-record values, instead of failing', () => {
    const malformed = parsePipelineBatchReport(
      makeReportPayload({
        stage_timings: {
          detect: Number.POSITIVE_INFINITY,
          ocr: Number.NaN,
          translation: -1,
          segment: 'not-a-number',
          clean: 0.5,
        },
      }),
    );
    expect(malformed.results[0]?.stage_timings).toEqual({ clean: 0.5 });

    const notRecord = parsePipelineBatchReport(
      makeReportPayload({ stage_timings: 'bogus' }),
    );
    expect(notRecord.results[0]?.stage_timings).toBeUndefined();

    const empty = parsePipelineBatchReport(
      makeReportPayload({ stage_timings: {} }),
    );
    expect(empty.results[0]?.stage_timings).toBeUndefined();
  });
});

describe('parsePipelineBatchReport completed_without_work', () => {
  it('keeps the stages that finished with nothing to do', () => {
    const parsed = parsePipelineBatchReport(
      makeReportPayload({ completed_without_work: ['translation', 'segment'] }),
    );

    expect(parsed.results[0]?.completed_without_work).toEqual([
      'translation',
      'segment',
    ]);
    expect(parsed.results[0]?.status).toBe('success');
  });

  it('keeps the field undefined on legacy payloads and on an empty list', () => {
    const legacy = parsePipelineBatchReport(makeReportPayload({}));
    expect(legacy.results[0]?.completed_without_work).toBeUndefined();

    const empty = parsePipelineBatchReport(
      makeReportPayload({ completed_without_work: [] }),
    );
    expect(empty.results[0]?.completed_without_work).toBeUndefined();
  });

  it('drops non-string entries and non-array values instead of failing', () => {
    const mixed = parsePipelineBatchReport(
      makeReportPayload({ completed_without_work: ['translation', 7, null] }),
    );
    expect(mixed.results[0]?.completed_without_work).toEqual(['translation']);

    const notArray = parsePipelineBatchReport(
      makeReportPayload({ completed_without_work: 'translation' }),
    );
    expect(notArray.results[0]?.completed_without_work).toBeUndefined();
  });
});
