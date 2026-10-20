import { useCallback, useRef } from 'react';

/** True when both values are Object.is-equal or shallow-equal as records. */
export function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Retain object identity across renders while values are shallow-equal.
 * Uses ref retention (not setState-during-render) so it is Concurrent-safe
 * and does not force parent re-renders.
 */
export function useShallowStableObject<T extends Record<string, unknown>>(
  next: T,
): T {
  const ref = useRef<T>(next);
  if (!shallowEqual(ref.current, next)) {
    ref.current = next;
  }
  return ref.current;
}

/** Always-current ref — prefer over `ref.current = value` in effects. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Stable callback identity that always invokes the latest implementation. */
export function useLatestCallback<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const fnRef = useLatestRef(fn);
  return useCallback((...args: A) => fnRef.current(...args), [fnRef]);
}
