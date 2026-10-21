import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installRendererConsoleCapture,
  type SessionLogEntry,
} from './install-renderer-console-capture';

describe('installRendererConsoleCapture', () => {
  let entries: SessionLogEntry[];

  const capture = () =>
    installRendererConsoleCapture({
      source: 'test-renderer',
      sink: (entry) => {
        entries.push(entry);
      },
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z'));
    entries = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('forwards warn and error with level, source and message', () => {
    const session = capture();

    console.warn('careful');
    console.error('boom', 42);

    expect(entries).toEqual([
      { level: 'warn', source: 'test-renderer', message: 'careful' },
      { level: 'error', source: 'test-renderer', message: 'boom 42' },
    ]);

    session.dispose();
  });

  it('never captures log or info', () => {
    const session = capture();

    console.log('no');
    console.info('also no');

    expect(entries).toEqual([]);

    session.dispose();
  });

  it('does not recurse when the sink itself writes to the console', () => {
    const session = installRendererConsoleCapture({
      source: 'test-renderer',
      sink: (entry) => {
        entries.push(entry);
        // A sink that echoes into the webview console must not loop.
        console.warn('echo from sink');
      },
    });

    console.error('origin');

    expect(entries).toEqual([
      { level: 'error', source: 'test-renderer', message: 'origin' },
    ]);

    session.dispose();
  });

  it('suppresses past the rate ceiling and aggregates the dropped count', () => {
    const session = capture();

    for (let index = 0; index < 6; index += 1) {
      console.warn(`w${index}`);
    }
    // Five delivered, the sixth suppressed within the same window.
    expect(entries).toHaveLength(5);

    // Quiet period: the next message rolls the window, flushes ONE aggregate
    // summary for the dropped message, then delivers normally again.
    vi.advanceTimersByTime(1_100);
    console.warn('after quiet');

    expect(entries).toHaveLength(7);
    expect(entries[5]).toEqual({
      level: 'warn',
      source: 'test-renderer',
      message: '1 console message(s) suppressed by the session-log rate limiter',
    });
    expect(entries[6]?.message).toBe('after quiet');

    session.dispose();
  });

  it('dispose stops capturing', () => {
    const session = capture();
    session.dispose();

    console.error('after dispose');

    expect(entries).toEqual([]);
  });
});
