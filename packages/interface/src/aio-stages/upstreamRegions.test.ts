import { describe, expect, it } from 'vitest';

import type { AioTextRegion } from '../types/dashboard.types';
import {
  getAioStageReadiness,
  resolveUpstreamRegions,
  type StageRegionKey,
  type StageRegions,
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
): StageRegions {
  return map;
}

describe('resolveUpstreamRegions', () => {
  it('prefers the first non-empty stage on the chain', () => {
    const stageRegions = sources({
      detectText: [region('d1')],
      recognizeText: [region('o1')],
      getTranslations: [region('t1')],
    });
    expect(resolveUpstreamRegions('segmentText', stageRegions).map((r) => r.id)).toEqual([
      't1',
    ]);
    expect(resolveUpstreamRegions('cleanImage', stageRegions).map((r) => r.id)).toEqual([
      't1',
    ]);
    expect(resolveUpstreamRegions('render', stageRegions).map((r) => r.id)).toEqual([
      't1',
    ]);
  });

  it('falls back down the chain when preferred stages are empty', () => {
    const stageRegions = sources({
      detectText: [region('d1')],
      recognizeText: [],
      getTranslations: [],
    });
    expect(resolveUpstreamRegions('segmentText', stageRegions).map((r) => r.id)).toEqual([
      'd1',
    ]);
  });

  it('returns empty when every upstream stage is empty', () => {
    expect(resolveUpstreamRegions('segmentText', sources({}))).toEqual([]);
  });

  it('Get Translations only reads Recognize Text', () => {
    const stageRegions = sources({
      detectText: [region('d1')],
      recognizeText: [region('o1')],
    });
    expect(
      resolveUpstreamRegions('getTranslations', stageRegions).map((r) => r.id),
    ).toEqual(['o1']);
  });

  it('does not alias the source array', () => {
    const source = [region('d1')];
    const result = resolveUpstreamRegions('segmentText', sources({ detectText: source }));
    expect(result).not.toBe(source);
    expect(result[0]).toBe(source[0]);
  });
});

function recognized(id: string): AioTextRegion {
  return { ...region(id), recognizedText: 'hello' };
}

describe('getAioStageReadiness', () => {
  it('detectText is always runnable', () => {
    expect(getAioStageReadiness('detectText', sources({}))).toEqual({
      runnable: true,
      reason: null,
    });
  });

  it('recognizeText requires detected regions', () => {
    expect(getAioStageReadiness('recognizeText', sources({}))).toEqual({
      runnable: false,
      reason: 'no_regions',
    });
    expect(
      getAioStageReadiness('recognizeText', sources({ detectText: [region('d1')] })),
    ).toEqual({ runnable: true, reason: null });
  });

  it('getTranslations requires recognized text', () => {
    expect(
      getAioStageReadiness('getTranslations', sources({ recognizeText: [region('o1')] })),
    ).toEqual({ runnable: false, reason: 'no_recognized_text' });
    expect(
      getAioStageReadiness('getTranslations', sources({ recognizeText: [recognized('o1')] })),
    ).toEqual({ runnable: true, reason: null });
  });

  it('segmentText accepts the detect-text fallback chain', () => {
    // The manual executor used to refuse this case (no translations/OCR
    // output) — the chain allows it.
    expect(
      getAioStageReadiness('segmentText', sources({ detectText: [region('d1')] })),
    ).toEqual({ runnable: true, reason: null });
  });

  it('cleanImage accepts the getTranslations fallback chain', () => {
    // Regions sourced from translations when segmentation is absent — the
    // manual executor used to refuse this case.
    expect(
      getAioStageReadiness('cleanImage', sources({ getTranslations: [recognized('t1')] })),
    ).toEqual({ runnable: true, reason: null });
  });

  it('downstream stages are not runnable when every chain source is empty', () => {
    expect(getAioStageReadiness('segmentText', sources({}))).toEqual({
      runnable: false,
      reason: 'no_regions',
    });
    expect(getAioStageReadiness('cleanImage', sources({}))).toEqual({
      runnable: false,
      reason: 'no_regions',
    });
    expect(getAioStageReadiness('render', sources({}))).toEqual({
      runnable: false,
      reason: 'no_regions',
    });
  });
});
