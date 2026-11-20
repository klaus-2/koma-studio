import { describe, expect, it } from 'vitest';

import { regionsIntersectingRect } from './marqueeSelection';
import type { RegionGeometry } from './regionGeometry';

type IdRegion = RegionGeometry & { readonly id: string };

const region = (id: string, bbox: readonly [number, number, number, number]): IdRegion => ({
  id,
  bbox,
});

describe('regionsIntersectingRect', () => {
  const regions = [
    region('a', [0, 0, 50, 50]),
    region('b', [60, 0, 110, 50]),
    region('c', [0, 60, 50, 110]),
    region('d', [70, 70, 120, 120]),
  ];

  it('returns the regions intersecting the rectangle in region array order', () => {
    const hits = regionsIntersectingRect(regions, { x1: 10, y1: 10, x2: 70, y2: 70 });
    expect(hits.map((hit) => hit.id)).toEqual(['a', 'b', 'c']);
  });

  it('normalizes a dragged-backwards rectangle (start corner below/right of end corner)', () => {
    const hits = regionsIntersectingRect(regions, { x1: 70, y1: 70, x2: 10, y2: 10 });
    expect(hits.map((hit) => hit.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns regions in array order even when the rect is drawn in reverse (order is deterministic, not spatial)', () => {
    // Rect covering 'c' and 'a': array order puts 'a' first even though 'c'
    // is spatially lower — the multi-bubble queue pairs by this order.
    const hits = regionsIntersectingRect(regions, { x1: 0, y1: 110, x2: 50, y2: 0 });
    expect(hits.map((hit) => hit.id)).toEqual(['a', 'c']);
  });

  it('selects the far region alone when the rect only reaches its corner area', () => {
    const hits = regionsIntersectingRect(regions, { x1: 65, y1: 65, x2: 200, y2: 200 });
    expect(hits.map((hit) => hit.id)).toEqual(['d']);
  });

  it('touches-only edges do not count as intersection (strict overlap)', () => {
    const hits = regionsIntersectingRect(regions, { x1: 50, y1: 0, x2: 60, y2: 50 });
    expect(hits).toEqual([]);
  });

  it('a degenerate rectangle (click without drag) intersects nothing', () => {
    expect(regionsIntersectingRect(regions, { x1: 25, y1: 25, x2: 25, y2: 25 })).toEqual([]);
    expect(regionsIntersectingRect(regions, { x1: 25, y1: 25, x2: 25, y2: 90 })).toEqual([]);
  });

  it('a rectangle covering everything selects every region in array order', () => {
    const hits = regionsIntersectingRect(regions, { x1: -10, y1: -10, x2: 200, y2: 200 });
    expect(hits.map((hit) => hit.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty array for an empty region list', () => {
    expect(regionsIntersectingRect([], { x1: 0, y1: 0, x2: 100, y2: 100 })).toEqual([]);
  });
});
