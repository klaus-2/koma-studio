import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import type { AioTextRegion } from '../types/dashboard.types';
import type { RenderTextStyle } from '../typography/renderStyle';
import { applyRenderDefaultsToRegion } from './dashboard.region.utils';
import {
  isRegionFieldLocked,
  normalizeRegionLockFields,
  withRegionLockField,
} from './region-lock';

const region = (id: string, overrides: Partial<AioTextRegion> = {}): AioTextRegion => ({
  id,
  bbox: [0, 0, 10, 10],
  score: 1,
  source: 'model',
  modelKey: 'detector',
  ...overrides,
});

describe('isRegionFieldLocked', () => {
  it('treats a legacy locked region as locked on every field', () => {
    const locked = region('a', { locked: true });
    expect(isRegionFieldLocked(locked, 'geometry')).toBe(true);
    expect(isRegionFieldLocked(locked, 'text')).toBe(true);
    expect(isRegionFieldLocked(locked, 'style')).toBe(true);
  });

  it('treats an unlocked region without flags as unlocked on every field', () => {
    const unlocked = region('a');
    expect(isRegionFieldLocked(unlocked, 'geometry')).toBe(false);
    expect(isRegionFieldLocked(unlocked, 'text')).toBe(false);
    expect(isRegionFieldLocked(unlocked, 'style')).toBe(false);
  });

  it('reads per-field flags when present', () => {
    const partial = region('a', { locked: false, lockedFields: { text: true } });
    expect(isRegionFieldLocked(partial, 'geometry')).toBe(false);
    expect(isRegionFieldLocked(partial, 'text')).toBe(true);
    expect(isRegionFieldLocked(partial, 'style')).toBe(false);
  });
});

describe('normalizeRegionLockFields', () => {
  it('materializes legacy locked=true as all three fields', () => {
    expect(normalizeRegionLockFields(region('a', { locked: true }))).toEqual({
      geometry: true,
      text: true,
      style: true,
    });
  });

  it('normalizes to undefined when nothing is locked', () => {
    expect(normalizeRegionLockFields(region('a'))).toBeUndefined();
    expect(
      normalizeRegionLockFields(region('a', { locked: false, lockedFields: {} })),
    ).toBeUndefined();
  });

  it('keeps only the locked fields', () => {
    expect(
      normalizeRegionLockFields(
        region('a', { lockedFields: { text: true, style: false } }),
      ),
    ).toEqual({ text: true });
  });
});

describe('withRegionLockField', () => {
  it('locks one field of an unlocked region and keeps locked=false', () => {
    const next = withRegionLockField(region('a'), 'geometry', true);
    expect(next.lockedFields).toEqual({ geometry: true });
    expect(next.locked).toBe(false);
  });

  it('syncs locked=true only when all three fields are locked', () => {
    let next = withRegionLockField(region('a'), 'geometry', true);
    next = withRegionLockField(next, 'text', true);
    expect(next.locked).toBe(false);
    next = withRegionLockField(next, 'style', true);
    expect(next.lockedFields).toEqual({ geometry: true, text: true, style: true });
    expect(next.locked).toBe(true);
  });

  it('expands a legacy locked region before unlocking one field', () => {
    const next = withRegionLockField(region('a', { locked: true }), 'text', false);
    expect(next.lockedFields).toEqual({ geometry: true, style: true });
    expect(next.locked).toBe(false);
    expect(isRegionFieldLocked(next, 'geometry')).toBe(true);
    expect(isRegionFieldLocked(next, 'text')).toBe(false);
    expect(isRegionFieldLocked(next, 'style')).toBe(true);
  });

  it('clears the flags when the last field is unlocked', () => {
    let next = withRegionLockField(region('a', { lockedFields: { style: true } }), 'style', false);
    expect(next.lockedFields).toBeUndefined();
    expect(next.locked).toBe(false);
  });
});

describe('applyRenderDefaultsToRegion lock gating', () => {
  const applyDetectedGradient = vi.fn(
    (_region: AioTextRegion, style: RenderTextStyle): RenderTextStyle => ({
      ...style,
      fillCssValue: 'linear-gradient(45deg, #000000 0%, #ffffff 100%)',
    }),
  );

  it('keeps the style-locked renderStyle and skips the gradient recompute', () => {
    const lockedRegion = region('a', {
      lockedFields: { style: true },
      renderStyle: {
        ...DEFAULT_RENDER_STYLE,
        fontFamily: 'Custom Font',
        color: '#123456',
        detectGradient: true,
      },
      detectedGradient: {
        angle: 90,
        startRgb: [0, 0, 0],
        endRgb: [255, 255, 255],
      },
    });

    const next = applyRenderDefaultsToRegion(
      lockedRegion,
      DEFAULT_RENDER_STYLE,
      applyDetectedGradient,
    );

    expect(applyDetectedGradient).not.toHaveBeenCalled();
    expect(next.renderStyle?.fontFamily).toBe('Custom Font');
    expect(next.renderStyle?.color).toBe('#123456');
    expect(next.renderStyle?.fillCssValue).toBe('#111111');
    expect(next.renderStyle?.hyphenationEnabled).toBe(false);
    expect(next.locked).toBe(false);
    expect(next.lockedFields).toEqual({ style: true });
    applyDetectedGradient.mockClear();
  });

  it('recomputes the detected gradient for an unlocked region', () => {
    const unlockedRegion = region('a', {
      renderStyle: { ...DEFAULT_RENDER_STYLE, detectGradient: true },
      detectedGradient: {
        angle: 90,
        startRgb: [0, 0, 0],
        endRgb: [255, 255, 255],
      },
    });

    const next = applyRenderDefaultsToRegion(
      unlockedRegion,
      DEFAULT_RENDER_STYLE,
      applyDetectedGradient,
    );

    expect(applyDetectedGradient).toHaveBeenCalledTimes(1);
    expect(next.renderStyle?.fillCssValue).toContain('linear-gradient');
    applyDetectedGradient.mockClear();
  });

  it('keeps the existing renderText of a text-locked region', () => {
    const lockedRegion = region('a', {
      lockedFields: { text: true },
      renderText: 'kept',
      recognizedText: 'recognized',
    });

    const next = applyRenderDefaultsToRegion(
      lockedRegion,
      DEFAULT_RENDER_STYLE,
      applyDetectedGradient,
    );

    expect(next.renderText).toBe('kept');
    applyDetectedGradient.mockClear();
  });

  it('falls back to the default render text when a text-locked region has none', () => {
    const lockedRegion = region('a', {
      lockedFields: { text: true },
      recognizedText: 'recognized',
    });

    const next = applyRenderDefaultsToRegion(
      lockedRegion,
      DEFAULT_RENDER_STYLE,
      applyDetectedGradient,
    );

    expect(next.renderText).toBe('recognized');
    applyDetectedGradient.mockClear();
  });

  it('normalizes the lock flags of an unlocked legacy region', () => {
    const next = applyRenderDefaultsToRegion(
      region('a', { locked: true }),
      DEFAULT_RENDER_STYLE,
      applyDetectedGradient,
    );

    expect(next.locked).toBe(true);
    expect(next.lockedFields).toEqual({ geometry: true, text: true, style: true });
    applyDetectedGradient.mockClear();
  });
});
