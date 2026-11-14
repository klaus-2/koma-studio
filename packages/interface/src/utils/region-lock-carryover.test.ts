import { describe, expect, it } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import type { AioTextRegion } from '../types/dashboard.types';
import { carryOverLockedRegions } from './region-lock-carryover';

const region = (
  id: string,
  bbox: [number, number, number, number],
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox,
  score: 0.9,
  source: 'model',
  modelKey: 'fresh-detector',
  ...overrides,
});

describe('carryOverLockedRegions', () => {
  it('returns fresh regions unchanged when nothing is locked', () => {
    const fresh = [
      region('f1', [0, 0, 10, 10]),
      region('f2', [20, 0, 10, 10]),
    ];
    const prev = [region('p1', [0, 0, 10, 10])];

    const result = carryOverLockedRegions(prev, fresh);

    expect(result).toEqual(fresh);
    expect(result).not.toBe(fresh);
  });

  it('carries a geometry-locked region onto the spatially matched fresh region', () => {
    const lockedPrev = region('p1', [0, 0, 10, 10], {
      lockedFields: { geometry: true },
      renderText: 'kept text',
      renderStyle: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Kept', fontSize: 42 },
      shape: {
        kind: 'rounded',
        source: 'manual',
        cornerRadius: 4,
        innerBox: [1, 1, 8, 8],
        fitProfile: [1],
      },
      locked: false,
    });
    const fresh = [
      region('fresh-1', [0, 0, 10, 10], { score: 0.42 }),
      region('fresh-2', [50, 50, 10, 10], { score: 0.7 }),
    ];

    const result = carryOverLockedRegions([lockedPrev], fresh);

    expect(result).toHaveLength(2);
    const carried = result[0];
    expect(carried?.id).toBe('fresh-1');
    expect(carried?.bbox).toEqual([0, 0, 10, 10]);
    expect(carried?.renderText).toBe('kept text');
    expect(carried?.renderStyle?.fontFamily).toBe('Kept');
    expect(carried?.shape?.kind).toBe('rounded');
    expect(carried?.lockedFields).toEqual({ geometry: true });
    expect(carried?.score).toBe(0.42);
    expect(carried?.modelKey).toBe('fresh-detector');
    expect(result[1]?.id).toBe('fresh-2');
  });

  it('keeps the fresh id when the previous region was legacy locked', () => {
    const lockedPrev = region('p1', [0, 0, 10, 10], {
      locked: true,
      renderText: 'legacy',
    });
    const fresh = [region('fresh-1', [1, 1, 10, 10], { score: 0.3 })];

    const result = carryOverLockedRegions([lockedPrev], fresh);

    expect(result[0]?.id).toBe('fresh-1');
    expect(result[0]?.renderText).toBe('legacy');
    expect(result[0]?.locked).toBe(true);
    expect(result[0]?.score).toBe(0.3);
  });

  it('drops fresh boxes overlapping a carried locked region without being its match', () => {
    const lockedPrev = region('p1', [0, 0, 10, 10], {
      lockedFields: { geometry: true },
    });
    const fresh = [
      // Best match: perfect overlap with the locked region.
      region('fresh-best', [0, 0, 10, 10], { score: 0.5 }),
      // Half-overlaps the locked region (intersection 50 / min area 100 ->
      // ratio 0.5), dropped as a duplicate detection of the same balloon.
      region('fresh-loser', [5, 0, 15, 10], { score: 0.4 }),
      // No overlap: passes through.
      region('fresh-far', [100, 100, 200, 200], { score: 0.9 }),
    ];

    const result = carryOverLockedRegions([lockedPrev], fresh);

    expect(result.map((item) => item.id)).toEqual(['fresh-best', 'fresh-far']);
    const carried = result[0];
    expect(carried?.id).toBe('fresh-best');
    expect(carried?.lockedFields).toEqual({ geometry: true });
  });

  it('passes fresh regions through when no locked region matches spatially', () => {
    const lockedPrev = region('p1', [0, 0, 10, 10], {
      lockedFields: { geometry: true },
    });
    const fresh = [region('fresh-far', [500, 500, 600, 600], { score: 0.8 })];

    const result = carryOverLockedRegions([lockedPrev], fresh);

    expect(result).toEqual(fresh);
  });

  it('matches overlap relative to the smaller box', () => {
    const lockedPrev = region('p1', [0, 0, 20, 20], {
      lockedFields: { geometry: true },
    });
    // 10x10 box fully inside the locked 20x20 box: intersection 100, smaller
    // area 100 -> ratio 1.
    const fresh = [region('fresh-small', [5, 5, 10, 10], { score: 0.6 })];

    const result = carryOverLockedRegions([lockedPrev], fresh);

    expect(result[0]?.id).toBe('fresh-small');
    expect(result[0]?.bbox).toEqual([0, 0, 20, 20]);
  });

  it('assigns one contested fresh box to the best-ratio locked region', () => {
    const weakOverlap = region('p-weak', [-40, 0, 60, 100], {
      lockedFields: { geometry: true },
      renderText: 'weak',
    });
    const strongOverlap = region('p-strong', [0, 0, 100, 100], {
      lockedFields: { geometry: true },
      renderText: 'strong',
    });
    // One fresh box overlapping p-weak at ratio 0.6 (6000/10000) and
    // p-strong at ratio 1.
    const fresh = [region('fresh-contested', [0, 0, 100, 100], { score: 0.5 })];

    const result = carryOverLockedRegions([weakOverlap, strongOverlap], fresh);

    // Exactly one fresh output: the contested box carries the best-ratio
    // locked region; the losing locked region has no fresh box to carry onto.
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('fresh-contested');
    expect(result[0]?.renderText).toBe('strong');
    expect(result[0]?.lockedFields).toEqual({ geometry: true });
    expect(result[0]?.bbox).toEqual([0, 0, 100, 100]);
    expect(result[0]?.score).toBe(0.5);
  });
});
