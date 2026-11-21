import { describe, expect, it } from 'vitest';

import { computeRequiredBytesWithSlack } from './model-storage';

const MIB = 1024 * 1024;

describe('computeRequiredBytesWithSlack', () => {
  it('returns zero for empty or invalid requirements', () => {
    expect(computeRequiredBytesWithSlack(0)).toBe(0);
    expect(computeRequiredBytesWithSlack(-1)).toBe(0);
  });

  it('applies the 64 MiB floor to small requirements', () => {
    expect(computeRequiredBytesWithSlack(MIB)).toBe(MIB + 64 * MIB);
    expect(computeRequiredBytesWithSlack(100 * MIB)).toBe(164 * MIB);
  });

  it('applies 10% once it exceeds the floor', () => {
    expect(computeRequiredBytesWithSlack(640 * MIB)).toBe(704 * MIB);
    const requiredBytes = 1024 * MIB;
    expect(computeRequiredBytesWithSlack(requiredBytes)).toBe(
      requiredBytes + Math.floor(requiredBytes * 0.1),
    );
  });

  it('floors the percentage like the backend int() cast', () => {
    const requiredBytes = 700 * MIB + 1;
    expect(computeRequiredBytesWithSlack(requiredBytes)).toBe(
      requiredBytes + Math.floor(requiredBytes * 0.1),
    );
  });
});
