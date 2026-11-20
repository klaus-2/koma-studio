import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWhenIdle } from './runWhenIdle';

// Omit + optional re-declaration makes `delete` legal even though lib.dom
// declares requestIdleCallback as required on Window.
type IdleWindow = Omit<Window, 'requestIdleCallback'> & {
  requestIdleCallback?: Window['requestIdleCallback'];
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('runWhenIdle', () => {
  it('uses requestIdleCallback with a 2s timeout when available', () => {
    const idle = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);

    const callback = vi.fn();
    runWhenIdle(callback);

    expect(idle).toHaveBeenCalledTimes(1);
    expect(idle).toHaveBeenCalledWith(callback, { timeout: 2_000 });
    expect(callback).not.toHaveBeenCalled();
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    delete (window as IdleWindow).requestIdleCallback;
    vi.useFakeTimers();

    const callback = vi.fn();
    runWhenIdle(callback);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('schedules a fresh slot per call (idempotent per call, no shared state)', () => {
    const idle = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);

    const first = vi.fn();
    const second = vi.fn();
    runWhenIdle(first);
    runWhenIdle(second);

    expect(idle).toHaveBeenCalledTimes(2);
    expect(idle).toHaveBeenNthCalledWith(1, first, { timeout: 2_000 });
    expect(idle).toHaveBeenNthCalledWith(2, second, { timeout: 2_000 });
  });
});
