import { describe, expect, it } from 'vitest';

import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it('formats bytes below one kibibyte without a suffix change', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('crosses the 1024 boundary exactly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('rounds to one decimal and drops trailing zeros', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(153 * 1024)).toBe('153 KB');
    expect(formatBytes(1024 * 1024 + 512 * 1024)).toBe('1.5 MB');
  });

  it('formats gigabyte-scale values', () => {
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB');
  });

  it('caps at the largest unit', () => {
    expect(formatBytes(1024 ** 5)).toBe('1024 TB');
    expect(formatBytes(1024 ** 6)).toBe('1048576 TB');
  });

  it('reads non-finite and negative counters as zero', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });
});
