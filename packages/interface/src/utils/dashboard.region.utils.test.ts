import { describe, expect, it } from 'vitest';

import type { AioTextRegion } from '../types/dashboard.types';
import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import { cloneAioRegionsCoW } from './dashboard.region.utils';
import type { RenderTextStyle } from './renderText';

const cloneStyle = (style?: RenderTextStyle): RenderTextStyle =>
  structuredClone(style ?? { ...DEFAULT_RENDER_STYLE });

const buildRegion = (lockedFields?: AioTextRegion['lockedFields']): AioTextRegion =>
  ({
    id: 'region-1',
    bbox: [0, 0, 100, 50],
    renderText: 'a',
    lockedFields,
  }) as unknown as AioTextRegion;

describe('cloneAioRegionsCoW lock fields', () => {
  it('keeps the previous identity when nothing changed', () => {
    const current = [buildRegion()];
    const result = cloneAioRegionsCoW(current, current, cloneStyle);
    expect(result.changed).toBe(false);
    expect(result.regions[0]).toBe(current[0]);
  });

  it('emits a new object when only the lock fields changed', () => {
    const current = [buildRegion()];
    const next = [buildRegion({ text: true })];
    const result = cloneAioRegionsCoW(next, current, cloneStyle);
    expect(result.changed).toBe(true);
    expect(result.regions[0]).not.toBe(current[0]);
    expect(result.regions[0]?.lockedFields).toEqual({ text: true });
  });
});
