// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../../constants/dashboard.constants';
import type { RenderTextStyle } from '../../typography/renderStyle';

const drawSpy = vi.hoisted(() => vi.fn());
const layoutSpy = vi.hoisted(() => vi.fn((..._args: unknown[]) => ({ lines: [] })));

vi.mock('../../utils/renderText', () => ({
  computeRenderTextLayout: layoutSpy,
  drawRenderedTextInRegion: drawSpy,
}));

import { RenderModePresetPreview } from './RenderModePresetPreview';
import {
  drawPresetPreview,
  presetPreviewTextBox,
  toFontLoadDescriptor,
} from './renderModePresetPreview.draw';

const t = (key: string): string => (key === 'settings.modePresets.sampleTextDefault' ? 'Sample!' : key);

const fakeContext = () => {
  const fills: string[] = [];
  const ctx = {
    canvas: { width: 560, height: 240 },
    set fillStyle(value: unknown) {
      fills.push(String(value));
    },
    get fillStyle() {
      return fills.at(-1) ?? '';
    },
    lineWidth: 0,
    strokeStyle: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn(), toString: () => 'linear' })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn(), toString: () => 'radial' })),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
};

const style = (overrides: Partial<RenderTextStyle> = {}): RenderTextStyle => ({ ...DEFAULT_RENDER_STYLE, ...overrides });

beforeEach(() => {
  drawSpy.mockClear();
  layoutSpy.mockClear();
});

describe('drawPresetPreview (same renderer as the dashboard)', () => {
  it('paints the mode backdrop and hands the full style to the real text renderer', () => {
    const { ctx, fills } = fakeContext();
    const input = style({ alignment: 'left', lineSpacing: 1.4 });
    drawPresetPreview(ctx, { mode: 'text_inside_black_bubble', style: input, text: 'Hi', shapeKind: 'rounded' });
    expect(fills).toContain('#111111');
    expect(layoutSpy).toHaveBeenCalledWith(ctx, 'Hi', 368, 152, input, expect.objectContaining({ kind: 'rounded' }));
    expect(drawSpy).toHaveBeenCalledWith(ctx, presetPreviewTextBox('text_inside_black_bubble'), expect.anything(), input, expect.objectContaining({ kind: 'rounded' }));
  });

  it('uses a distinct backdrop per mode', () => {
    const backdrops = (['text_bubble', 'text_narration', 'text_free', 'text_sfx'] as const).map((mode) => {
      const { ctx, fills } = fakeContext();
      drawPresetPreview(ctx, { mode, style: style(), text: 'x', shapeKind: 'square' });
      return fills.slice(0, 2).join('|');
    });
    expect(new Set(backdrops).size).toBe(backdrops.length);
  });

  it('still lays out an empty sample text', () => {
    const { ctx } = fakeContext();
    drawPresetPreview(ctx, { mode: 'text_bubble', style: style(), text: '   ', shapeKind: 'rounded' });
    expect(layoutSpy.mock.calls[0]?.[1]).toBe(' ');
  });

  it('builds a font descriptor the browser font loader accepts', () => {
    expect(toFontLoadDescriptor(style({ fontFamily: 'Comic Neue', bold: true, italic: true, fontSize: 32 })))
      .toBe('italic bold 32px "Comic Neue"');
    expect(toFontLoadDescriptor(style({ fontFamily: '"Arial Black", Impact', bold: false, italic: false, fontSize: 20.4 })))
      .toBe('20px "Arial Black", Impact');
  });
});

describe('RenderModePresetPreview (live canvas)', () => {
  let loadResolvers: Array<() => void>;

  beforeEach(() => {
    loadResolvers = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => fakeContext().ctx,
    );
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: vi.fn(() => new Promise<void>((resolve) => loadResolvers.push(resolve))) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redraws when the style or the sample text change', () => {
    const { rerender } = render(
      <RenderModePresetPreview t={t} mode="text_bubble" style={style()} shapeKind="rounded" />,
    );
    expect(drawSpy).toHaveBeenCalledTimes(1);
    expect(layoutSpy.mock.calls[0]?.[1]).toBe('Sample!');

    rerender(<RenderModePresetPreview t={t} mode="text_bubble" style={style({ alignment: 'right' })} shapeKind="rounded" />);
    expect(drawSpy).toHaveBeenCalledTimes(2);
    expect(drawSpy.mock.calls[1]?.[3]).toMatchObject({ alignment: 'right' });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'BOOM' } });
    expect(layoutSpy.mock.calls.at(-1)?.[1]).toBe('BOOM');
  });

  it('repaints once the font finishes loading, but not after a newer change', async () => {
    const { rerender } = render(
      <RenderModePresetPreview t={t} mode="text_bubble" style={style({ fontFamily: 'Bangers' })} shapeKind="rounded" />,
    );
    rerender(<RenderModePresetPreview t={t} mode="text_bubble" style={style({ fontFamily: 'Teko' })} shapeKind="rounded" />);
    const callsBeforeLoad = drawSpy.mock.calls.length;

    await act(async () => {
      loadResolvers[0]?.();
      await Promise.resolve();
    });
    expect(drawSpy.mock.calls.length).toBe(callsBeforeLoad);

    await act(async () => {
      loadResolvers[1]?.();
      await Promise.resolve();
    });
    expect(drawSpy.mock.calls.length).toBe(callsBeforeLoad + 1);
    expect(drawSpy.mock.calls.at(-1)?.[3]).toMatchObject({ fontFamily: 'Teko' });
  });
});
