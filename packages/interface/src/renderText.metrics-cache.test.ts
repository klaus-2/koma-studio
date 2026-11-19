import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RENDER_STYLE } from './constants/dashboard.constants';
import type { RenderTextStyle } from './utils/renderText';
import {
  GLYPH_METRICS_CACHE_LIMIT,
  clearGlyphMetricsCache,
  measureStyledGlyphCached,
  measureStyledLineHeightCached,
} from './utils/renderText.metrics-cache';
import { measureStyledGlyph } from './utils/renderText.core';

interface MockMetrics {
  width: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

const createMockCtx = (): CanvasRenderingContext2D => {
  const ctx = {
    font: '16px "Arial", sans-serif',
    canvas: { width: 0, height: 0 },
    save: (): void => {},
    restore: (): void => {},
    measureText: (text: string): MockMetrics => {
      const match = /(\d+(?:\.\d+)?)px/u.exec(ctx.font);
      const size = match ? Number(match[1]) : 16;
      return {
        width: text.length * size * 0.6,
        actualBoundingBoxAscent: size * 0.8,
        actualBoundingBoxDescent: size * 0.2,
      };
    },
  };
  return ctx as unknown as CanvasRenderingContext2D;
};

const buildStyle = (patch: Partial<RenderTextStyle> = {}): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  alignment: 'left',
  fontSize: 64,
  ...patch,
});

describe('glyph metrics cache', () => {
  beforeEach(() => {
    clearGlyphMetricsCache();
    Object.defineProperty(document, 'fonts', {
      value: undefined,
      configurable: true,
    });
  });

  it('measures once and serves subsequent calls from the cache without touching the canvas', () => {
    const ctx = createMockCtx();
    const style = buildStyle();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    const first = measureStyledGlyphCached(ctx, 'あ', style);
    const afterFirst = measureSpy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    const second = measureStyledGlyphCached(ctx, 'あ', style);
    expect(measureSpy.mock.calls.length).toBe(afterFirst);
    expect(second.text).toBe(first.text);
    expect(second.measuredWidth).toBe(first.measuredWidth);
    expect(second.lineHeight).toBe(first.lineHeight);
    expect(second.style).toBe(style);
  });

  it('re-measures after clearGlyphMetricsCache', () => {
    const ctx = createMockCtx();
    const style = buildStyle();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    measureStyledGlyphCached(ctx, 'あ', style);
    const afterFirst = measureSpy.mock.calls.length;

    clearGlyphMetricsCache();
    measureStyledGlyphCached(ctx, 'あ', style);
    expect(measureSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('evicts the oldest entry beyond the cache limit and re-measures it', () => {
    const ctx = createMockCtx();
    const style = buildStyle();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    for (let index = 0; index < GLYPH_METRICS_CACHE_LIMIT + 1; index += 1) {
      measureStyledGlyphCached(ctx, `g${index}`, style);
    }
    const filled = measureSpy.mock.calls.length;

    measureStyledGlyphCached(ctx, 'g0', style);
    expect(measureSpy.mock.calls.length).toBeGreaterThan(filled);
  });

  it('treats different fonts as distinct keys', () => {
    const ctx = createMockCtx();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    measureStyledGlyphCached(ctx, 'あ', buildStyle({ fontFamily: 'Arial' }));
    const afterFirst = measureSpy.mock.calls.length;

    measureStyledGlyphCached(ctx, 'あ', buildStyle({ fontFamily: 'Koma Serif' }));
    expect(measureSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('treats different effective line spacing as distinct keys under the same font', () => {
    const ctx = createMockCtx();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    measureStyledGlyphCached(ctx, 'あ', buildStyle({ lineSpacing: 1 }));
    const afterFirst = measureSpy.mock.calls.length;

    measureStyledGlyphCached(ctx, 'あ', buildStyle({ lineSpacing: 1.5 }));
    expect(measureSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('re-measures when a font becomes usable without an explicit cache clear', () => {
    let available = false;
    Object.defineProperty(document, 'fonts', {
      value: {
        check: (): boolean => available,
      },
      configurable: true,
    });
    const ctx = createMockCtx();
    const style = buildStyle({ fontFamily: 'Koma Test' });
    const measureSpy = vi.spyOn(ctx, 'measureText');

    measureStyledGlyphCached(ctx, 'あ', style);
    const firstMeasure = measureSpy.mock.calls.length;
    expect(firstMeasure).toBeGreaterThan(0);

    measureStyledGlyphCached(ctx, 'あ', style);
    expect(measureSpy.mock.calls.length).toBe(firstMeasure);

    available = true;
    measureStyledGlyphCached(ctx, 'あ', style);
    expect(measureSpy.mock.calls.length).toBeGreaterThan(firstMeasure);
  });

  it('caches the line-height probe so repeated estimateLineHeight calls measure once', () => {
    const ctx = createMockCtx();
    const style = buildStyle();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    const first = measureStyledLineHeightCached(ctx, style, 64);
    const afterFirst = measureSpy.mock.calls.length;

    const second = measureStyledLineHeightCached(ctx, style, 64);
    expect(measureSpy.mock.calls.length).toBe(afterFirst);
    expect(second).toBe(first);
  });

  it('keeps the public measureStyledGlyph contract identical to a direct measure', () => {
    const ctx = createMockCtx();
    const style = buildStyle();

    clearGlyphMetricsCache();
    const direct = measureStyledGlyph(ctx, 'あ', style);
    const cached = measureStyledGlyphCached(ctx, 'あ', style);
    expect(cached.measuredWidth).toBe(direct.measuredWidth);
    expect(cached.lineHeight).toBe(direct.lineHeight);
    expect(cached.text).toBe(direct.text);
  });
});

describe('auto-font-size measurement flow (micro-benchmark)', () => {
  it('reports measureText call counts across one auto-font-size pass', () => {
    const ctx = createMockCtx();
    const measureSpy = vi.spyOn(ctx, 'measureText');
    const glyphs = Array.from({ length: 32 }, (_, index) => `g${index}`);

    const measurePass = (): void => {
      for (const glyph of glyphs) {
        measureStyledGlyph(ctx, glyph, buildStyle());
      }
      measureStyledGlyph(ctx, 'Mg', buildStyle());
    };

    clearGlyphMetricsCache();
    measurePass();
    measureSpy.mockClear();
    clearGlyphMetricsCache();
    measurePass();
    measureSpy.mockClear();
    clearGlyphMetricsCache();
    measurePass();
    const coldCalls = measureSpy.mock.calls.length;

    measureSpy.mockClear();
    measurePass();
    const warmCalls = measureSpy.mock.calls.length;

    expect(warmCalls).toBe(0);
    expect(coldCalls).toBe(glyphs.length + 1);
  });
});
