import { describe, expect, it } from 'vitest';

import {
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
