import { describe, expect, it } from 'vitest';

import { deriveOverflowCount } from '@/utils/overflowCounts';
import { EMPTY_REGION_LIST } from '@/utils/regionMapGating';
import type { RegionTextMeasure } from '@/utils/region-review';
import type { AioTextRegion } from '@/types/dashboard.types';

let regionSeq = 0;
const makeRegion = (text: string, width: number): AioTextRegion => {
  regionSeq += 1;
  return ({
    id: `region-${regionSeq}`,
    bbox: [0, 0, width, 20],
    renderText: text,
  }) as unknown as AioTextRegion;
};

/** Measure that "overflows" when the text is longer than the bbox width. */
const makeCountingMeasure = (): {
  measure: RegionTextMeasure;
  calls: number[];
} => {
  const calls: number[] = [];
  const measure: RegionTextMeasure = (region) => {
    calls.push(calls.length + 1);
    const text = (region.renderText ?? '').trim();
    if (!text) return null;
    return { textWidth: text.length, textHeight: 10, fontSize: 10 };
  };
  return { measure, calls };
};

describe('deriveOverflowCount', () => {
  it('counts overflowing regions only', () => {
    const regions = [
      makeRegion('tiny', 100),
      makeRegion('a-much-longer-text', 5),
    ];
    const { measure } = makeCountingMeasure();
    expect(deriveOverflowCount('img-a', regions, measure)).toBe(1);
  });

  it('reports 0 for the stable empty fallback', () => {
    const { measure } = makeCountingMeasure();
    expect(deriveOverflowCount('img-a', EMPTY_REGION_LIST, measure)).toBe(0);
  });

  it('hits the identity cache: the same regions array never re-measures', () => {
    const regions = [makeRegion('tiny', 100)];
    const { measure, calls } = makeCountingMeasure();
    deriveOverflowCount('img-a', regions, measure);
    const afterFirst = calls.length;
    expect(deriveOverflowCount('img-a', regions, measure)).toBe(0);
    expect(calls.length).toBe(afterFirst);
  });

  it('editing image B does not re-derive image A (identity isolation)', () => {
    const regionsA = [makeRegion('tiny-a', 100)];
    const regionsB = [makeRegion('tiny-b', 100)];
    const { measure, calls } = makeCountingMeasure();
    deriveOverflowCount('img-a', regionsA, measure);
    deriveOverflowCount('img-b', regionsB, measure);
    const baseline = calls.length;

    // CoW: editing B yields a NEW array identity; A keeps its identity.
    const regionsBEdited = [...regionsB, makeRegion('long-b-text', 3)];
    deriveOverflowCount('img-b', regionsBEdited, measure);
    const bMeasurements = calls.length - baseline;

    // A is re-read: cache hit, zero new measurements.
    deriveOverflowCount('img-a', regionsA, measure);
    expect(calls.length).toBe(baseline + bMeasurements);
    expect(deriveOverflowCount('img-b', regionsBEdited, measure)).toBe(1);
    expect(deriveOverflowCount('img-a', regionsA, measure)).toBe(0);
  });

  it('re-derives when the measure identity changes (style change)', () => {
    const regions = [makeRegion('tiny', 100)];
    const first = makeCountingMeasure();
    const second = makeCountingMeasure();
    deriveOverflowCount('img-a', regions, first.measure);
    expect(deriveOverflowCount('img-a', regions, first.measure)).toBe(0);
    expect(deriveOverflowCount('img-a', regions, second.measure)).toBe(0);
    expect(second.calls.length).toBeGreaterThan(0);
  });
});
