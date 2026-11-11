import { describe, expect, it } from 'vitest';

import {
  isGradientFillValue,
  parseCssGradientValue,
} from './textFillPicker';

describe('parseCssGradientValue cache', () => {
  it('returns the same parsed reference for the same gradient string', () => {
    const first = parseCssGradientValue('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
    const second = parseCssGradientValue('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(second?.mode).toBe('linear');
    expect(second?.stops).toHaveLength(2);
  });

  it('caches non-gradient strings as null hits too', () => {
    const first = parseCssGradientValue('not-a-gradient');
    const second = parseCssGradientValue('not-a-gradient');

    expect(first).toBeNull();
    expect(second).toBe(first);
  });

  it('treats distinct strings as distinct parses', () => {
    const red = parseCssGradientValue('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
    const green = parseCssGradientValue('linear-gradient(90deg, #00ff00 0%, #0000ff 100%)');

    expect(red).not.toBe(green);
    expect(red?.stops[0]?.color).not.toBe(green?.stops[0]?.color);
  });

  it('evicts the least recently used entry past the 64-entry limit', () => {
    const key = (index: number): string =>
      `linear-gradient(90deg, #ff0000 ${index}%, #0000ff 100%)`;

    const evicted = parseCssGradientValue(key(0));
    for (let index = 1; index <= 64; index += 1) {
      parseCssGradientValue(key(index));
    }

    // 65 distinct keys: key(0) was evicted, so it re-parses into a new object.
    expect(parseCssGradientValue(key(0))).not.toBe(evicted);

    // The cache stays bounded: the most recent key keeps its reference.
    const recent = parseCssGradientValue(key(64));
    expect(parseCssGradientValue(key(64))).toBe(recent);
  });

  it('keeps parsing semantics for radial gradients', () => {
    const parsed = parseCssGradientValue('radial-gradient(circle at center, #ffffff 0%, #000000 100%)');

    expect(parsed?.mode).toBe('radial');
    expect(isGradientFillValue('radial-gradient(circle at center, #fff, #000)')).toBe(true);
  });
});
