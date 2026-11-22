import { describe, expect, it } from 'vitest';

import {
  buildSingleBatchProgress,
  estimateRemainingSeconds,
  formatEta,
} from '@/pages/dashboard/lib/aio-batch-progress';

describe('estimateRemainingSeconds', () => {
  it('projects the remaining time from the observed image rate', () => {
    expect(
      estimateRemainingSeconds({
        elapsedMs: 60_000,
        completedImages: 1,
        totalImages: 4,
      }),
    ).toBe(180);
  });

  it('returns null before any image completes', () => {
    expect(
      estimateRemainingSeconds({
        elapsedMs: 5_000,
        completedImages: 0,
        totalImages: 4,
      }),
    ).toBeNull();
  });

  it('returns null once the run is complete', () => {
    expect(
      estimateRemainingSeconds({
        elapsedMs: 60_000,
        completedImages: 4,
        totalImages: 4,
      }),
    ).toBeNull();
  });

  it('returns null for a non-positive elapsed time', () => {
    expect(
      estimateRemainingSeconds({
        elapsedMs: 0,
        completedImages: 1,
        totalImages: 4,
      }),
    ).toBeNull();
  });

  it('never projects less than one second', () => {
    expect(
      estimateRemainingSeconds({
        elapsedMs: 1,
        completedImages: 1000,
        totalImages: 1001,
      }),
    ).toBe(1);
  });
});

describe('buildSingleBatchProgress', () => {
  const baseInput = {
    runStartedAt: 0,
    totalUnits: 12,
    totalImages: 4,
    stageLabel: 'Translating text' as string | null,
  };

  it('keeps the ETA null on the early samples before any unit moved', () => {
    expect(
      buildSingleBatchProgress({ ...baseInput, nowMs: 500, startedUnits: 0 }),
    ).toEqual({
      chapterIndex: 1,
      chapterCount: 1,
      chapterLabel: '',
      stageLabel: 'Translating text',
      etaSeconds: null,
    });
    expect(
      buildSingleBatchProgress({ ...baseInput, nowMs: 0, startedUnits: 3 })
        .etaSeconds,
    ).toBeNull();
  });

  it('projects a non-null ETA that shrinks as done counts increase', () => {
    const first = buildSingleBatchProgress({
      ...baseInput,
      nowMs: 30_000,
      startedUnits: 3,
    });
    expect(first.etaSeconds).toBe(90);
    const second = buildSingleBatchProgress({
      ...baseInput,
      nowMs: 60_000,
      startedUnits: 6,
    });
    expect(second.etaSeconds).toBe(60);
    const third = buildSingleBatchProgress({
      ...baseInput,
      nowMs: 90_000,
      startedUnits: 9,
    });
    expect(third.etaSeconds).toBe(30);
    expect(second.etaSeconds ?? 0).toBeLessThan(first.etaSeconds ?? 0);
    expect(third.etaSeconds ?? 0).toBeLessThan(second.etaSeconds ?? 0);
  });

  it('drops the ETA once the run has no remaining images', () => {
    expect(
      buildSingleBatchProgress({ ...baseInput, nowMs: 120_000, startedUnits: 12 })
        .etaSeconds,
    ).toBeNull();
  });

  it('never reports a negative or zero-unit rate', () => {
    expect(
      buildSingleBatchProgress({
        ...baseInput,
        nowMs: 10_000,
        startedUnits: -4,
      }).etaSeconds,
    ).toBeNull();
    expect(
      buildSingleBatchProgress({
        ...baseInput,
        totalUnits: 0,
        nowMs: 10_000,
        startedUnits: 0,
      }).etaSeconds,
    ).toBeNull();
  });
});

describe('formatEta', () => {
  const units = { second: 's', minute: 'm' };

  it('formats seconds and minutes', () => {
    expect(formatEta(45, units)).toBe('45s');
    expect(formatEta(120, units)).toBe('2m');
    expect(formatEta(200, units)).toBe('3m 20s');
  });

  it('uses the supplied unit labels', () => {
    expect(formatEta(45, { second: 'seg', minute: 'min' })).toBe('45seg');
    expect(formatEta(200, { second: 'seg', minute: 'min' })).toBe('3min 20seg');
  });

  it('returns null when there is no estimate', () => {
    expect(formatEta(null, units)).toBeNull();
    expect(formatEta(Number.NaN, units)).toBeNull();
  });

  it('rounds sub-second remainders up to one second', () => {
    expect(formatEta(0.2, units)).toBe('1s');
  });
});
