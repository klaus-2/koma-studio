import { describe, expect, it } from 'vitest';

import { normalizeManualRegions, regionsFromDetectPayload } from './detectTextRegions';
import type { AioTextRegion, DetectApiResponse } from '../types/dashboard.types';

const payload = (
  detections: DetectApiResponse['detections'],
  imageWidth = 100,
  imageHeight = 100,
): DetectApiResponse => ({
  device: 'cpu',
  model_used: 'test',
  image_width: imageWidth,
  image_height: imageHeight,
  detections,
});

const detection = (
  bbox: [number, number, number, number],
  overrides: Partial<DetectApiResponse['detections'][number]> = {},
): DetectApiResponse['detections'][number] => ({
  id: 'r1',
  bbox,
  score: 0.9,
  label: 'text_bubble',
  source: 'model',
  model_key: 'det',
  ...overrides,
});

describe('regionsFromDetectPayload', () => {
  it('scales boxes into target coordinates and attaches a default shape', () => {
    const regions = regionsFromDetectPayload(
      payload([detection([10, 10, 50, 40])], 100, 100),
      { width: 200, height: 200 },
      { minRegionSize: 4 },
    );

    expect(regions).toHaveLength(1);
    expect(regions[0]?.bbox).toEqual([20, 20, 100, 80]);
    expect(regions[0]?.detectedRenderMode).toBe('text_bubble');
    expect(regions[0]?.shape?.kind).toBe('rounded');
    expect(regions[0]?.shape?.source).toBe('detected');
  });

  it('drops boxes below minRegionSize', () => {
    const regions = regionsFromDetectPayload(
      payload([detection([0, 0, 3, 20]), detection([0, 0, 20, 20])]),
      { width: 100, height: 100 },
      { minRegionSize: 4 },
    );
    expect(regions.map((region) => region.id)).toEqual(['r1']);
  });

  it('applies the large low-confidence area filter only when asked', () => {
    const wideLow = detection([0, 0, 95, 95], { score: 0.5, id: 'wide' });
    const wideHigh = detection([0, 0, 95, 95], { score: 0.95, id: 'confident' });

    const filtered = regionsFromDetectPayload(payload([wideLow, wideHigh]), { width: 100, height: 100 }, {
      minRegionSize: 4,
      maxAreaRatio: 0.75,
    });
    expect(filtered.map((region) => region.id)).toEqual(['confident']);

    const unfiltered = regionsFromDetectPayload(payload([wideLow]), { width: 100, height: 100 }, {
      minRegionSize: 4,
    });
    expect(unfiltered).toHaveLength(1);
  });
});

describe('normalizeManualRegions', () => {
  const manual = (overrides: Partial<AioTextRegion> = {}): AioTextRegion =>
    ({
      id: 'm1',
      bbox: [1.2, 2.8, 40.1, 50.9],
      score: Number.NaN,
      source: undefined,
      modelKey: '',
      ...overrides,
    }) as AioTextRegion;

  it('clamps bbox and fills manual defaults', () => {
    const next = normalizeManualRegions([manual()], { width: 100, height: 100 }, {
      minRegionSize: 4,
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.bbox).toEqual([1, 2, 41, 51]);
    expect(next[0]?.source).toBe('manual');
    expect(next[0]?.score).toBe(1);
    expect(next[0]?.modelKey).toBe('manual');
    expect(next[0]?.detectorModelKey).toBe('manual');
  });

  it('drops boxes below minRegionSize', () => {
    const next = normalizeManualRegions(
      [manual({ id: 'tiny', bbox: [0, 0, 2, 20] }), manual({ id: 'ok' })],
      { width: 100, height: 100 },
      { minRegionSize: 4 },
    );
    expect(next.map((region) => region.id)).toEqual(['ok']);
  });
});
