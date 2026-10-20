import { describe, expect, it } from 'vitest';

import { evaluatePasswordStrength } from './passwordStrengthModel';

describe('evaluatePasswordStrength', () => {
  it('returns level -1 when empty', () => {
    expect(evaluatePasswordStrength('').level).toBe(-1);
  });

  it('scores weak passwords low', () => {
    const result = evaluatePasswordStrength('abc');
    expect(result.passed).toBe(1);
    expect(result.level).toBe(1);
  });

  it('scores a strong password high', () => {
    const result = evaluatePasswordStrength('Abcdef1!');
    expect(result.passed).toBe(5);
    expect(result.level).toBe(4);
  });

  it('caps level at the last band', () => {
    const result = evaluatePasswordStrength('Abcdef1!xyzXYZ999###');
    expect(result.level).toBe(4);
  });
});
