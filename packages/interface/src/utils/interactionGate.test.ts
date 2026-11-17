import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isInteractionActive, resetForTests } from './interactionGate';

const GRACE_MS = 1000;

describe('interactionGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetForTests();
  });

  it('is active from pointerdown and stays active within the grace after release', () => {
    expect(isInteractionActive()).toBe(false);

    document.dispatchEvent(new Event('pointerdown'));
    expect(isInteractionActive()).toBe(true);

    document.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(GRACE_MS - 1);
    expect(isInteractionActive()).toBe(true);
  });

  it('goes inactive once the grace window after pointerup elapses', () => {
    document.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new Event('pointerup'));

    vi.advanceTimersByTime(GRACE_MS);
    expect(isInteractionActive()).toBe(false);
  });

  it('releases a held pointer on pointercancel', () => {
    document.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new Event('pointercancel'));

    expect(isInteractionActive()).toBe(true);
    vi.advanceTimersByTime(GRACE_MS);
    expect(isInteractionActive()).toBe(false);
  });

  it('releases a held pointer on window blur', () => {
    document.dispatchEvent(new Event('pointerdown'));
    expect(isInteractionActive()).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(isInteractionActive()).toBe(true);
    vi.advanceTimersByTime(GRACE_MS);
    expect(isInteractionActive()).toBe(false);
  });

  it('is active while IME composition runs and releases after the compositionend grace', () => {
    document.dispatchEvent(new Event('compositionstart'));
    expect(isInteractionActive()).toBe(true);

    document.dispatchEvent(new Event('compositionend'));
    expect(isInteractionActive()).toBe(true);
    vi.advanceTimersByTime(GRACE_MS);
    expect(isInteractionActive()).toBe(false);
  });

  it('honors a custom grace window', () => {
    document.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new Event('pointerup'));

    expect(isInteractionActive(0)).toBe(false);
    expect(isInteractionActive(GRACE_MS)).toBe(true);
  });
});
