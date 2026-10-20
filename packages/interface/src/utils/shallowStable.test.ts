import { describe, expect, it } from 'vitest';
import { shallowEqual, useShallowStableObject } from './shallowStable';
import { renderHook } from '@testing-library/react';

describe('shallowEqual', () => {
  it('matches Object.is and shallow records', () => {
    expect(shallowEqual({}, {})).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('useShallowStableObject', () => {
  it('keeps identity when values are shallow-equal', () => {
    const first = { a: 1, b: 'x' };
    const { result, rerender } = renderHook(
      ({ value }: { value: Record<string, unknown> }) => useShallowStableObject(value),
      { initialProps: { value: first } },
    );
    const id1 = result.current;
    rerender({ value: { a: 1, b: 'x' } });
    expect(result.current).toBe(id1);
    rerender({ value: { a: 2, b: 'x' } });
    expect(result.current).not.toBe(id1);
  });
});
