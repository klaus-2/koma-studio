import { describe, expect, it } from 'vitest';

import type { AioTextRegion } from '../types/dashboard.types';
import {
  resolveUpstreamRegions,
  upstreamRegionChain,
  type GetStageRegions,
  type StageRegionKey,
} from './upstreamRegions';

function region(id: string): AioTextRegion {
  return {
    id,
    bbox: [0, 0, 1, 1],
    score: 1,
    source: 'model',
    modelKey: 'test',
  };
}

function sources(
  map: Partial<Record<StageRegionKey, AioTextRegion[]>>,
): GetStageRegions {
  return (stage) => map[stage] ?? [];
}

describe('resolveUpstreamRegions', () => {
  it('prefers the first non-empty stage on the chain', () => {
    const getRegions = sources({
      detectText: [region('d1')],
      recognizeText: [region('o1')],
      getTranslations: [region('t1')],
    });
    expect(resolveUpstreamRegions('segmentText', getRegions).map((r) => r.id)).toEqual([
      't1',
    ]);
    expect(resolveUpstreamRegions('cleanImage', getRegions).map((r) => r.id)).toEqual([
      't1',
    ]);
    expect(resolveUpstreamRegions('render', getRegions).map((r) => r.id)).toEqual([
      't1',
    ]);
  });

  it('falls back down the chain when preferred stages are empty', () => {
    const getRegions = sources({
      detectText: [region('d1')],
      recognizeText: [],
      getTranslations: [],
    });
    expect(resolveUpstreamRegions('segmentText', getRegions).map((r) => r.id)).toEqual([
      'd1',
    ]);
  });

  it('returns empty when every upstream stage is empty', () => {
    expect(resolveUpstreamRegions('segmentText', sources({}))).toEqual([]);
  });

  it('Get Translations only reads Recognize Text', () => {
    expect(upstreamRegionChain('getTranslations')).toEqual(['recognizeText']);
    const getRegions = sources({
      detectText: [region('d1')],
      recognizeText: [region('o1')],
    });
    expect(resolveUpstreamRegions('getTranslations', getRegions).map((r) => r.id)).toEqual([
      'o1',
    ]);
  });

  it('does not alias the source array', () => {
    const source = [region('d1')];
    const result = resolveUpstreamRegions('segmentText', sources({ detectText: source }));
    expect(result).not.toBe(source);
    expect(result[0]).toBe(source[0]);
  });
});
