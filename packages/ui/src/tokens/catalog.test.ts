import { describe, expect, it } from 'vitest';
import {
  motion,
  radius,
  shadows,
  spacing,
  tokens,
  typography,
} from './catalog';

describe('design token catalog', () => {
  it('exposes a closed typed scale for spacing', () => {
    expect(spacing['4']).toBe('1rem');
    expect(Object.keys(spacing)).toContain('8');
  });

  it('keeps typography families and sizes stable', () => {
    expect(typography.fontFamily.body).toContain('Manrope');
    expect(typography.fontSize.base).toBe('1rem');
    expect(typography.fontWeight.semibold).toBe('600');
  });

  it('defines motion presets without layout-property animation helpers', () => {
    expect(motion.duration.fast).toBe('140ms');
    expect(motion.ease.standard).toMatch(/cubic-bezier/);
  });

  it('bundles shadows and radius tokens', () => {
    expect(shadows.none).toBe('none');
    expect(radius.pill).toBe('999px');
  });

  it('aggregates all scales under tokens', () => {
    expect(tokens).toEqual({ spacing, typography, shadows, motion, radius });
  });
});
