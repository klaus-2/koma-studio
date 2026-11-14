import { describe, expect, it } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type { RenderTextStyle } from '../../../utils/renderText';
import { projectRenderStyle } from './render-style-projection';

const source = (): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  fontFamily: 'Source Font',
  fontSize: 42,
  minFontSize: 8,
  color: '#ff0000',
  gradientStartColor: '#ff0000',
  fillCssValue: 'linear-gradient(90deg, #ff0000 0%, #ff0000 100%)',
  outlineColor: '#00ff00',
  outlineOpacity: 0.5,
  outlineWidth: 3,
  alignment: 'center',
});

const target = (): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  fontFamily: 'Target Font',
  fontSize: 20,
  minFontSize: 6,
  color: '#123456',
  gradientStartColor: '#123456',
  fillCssValue: '#123456',
  outlineColor: '#654321',
  outlineOpacity: 0.9,
  outlineWidth: 1,
  alignment: 'left',
});

describe('projectRenderStyle', () => {
  it('projects the font family attribute only', () => {
    const next = projectRenderStyle(source(), target(), ['fontFamily']);
    expect(next.fontFamily).toBe('Source Font');
    expect(next.fontSize).toBe(20);
    expect(next.color).toBe('#123456');
    expect(next.outlineColor).toBe('#654321');
    expect(next.alignment).toBe('left');
  });

  it('projects the font size without touching the size bounds', () => {
    const next = projectRenderStyle(source(), target(), ['fontSize']);
    expect(next.fontSize).toBe(42);
    expect(next.minFontSize).toBe(6);
    expect(next.fontFamily).toBe('Target Font');
  });

  it('projects the flat color only — no gradient fields, no fillCssValue', () => {
    const next = projectRenderStyle(source(), target(), ['color']);
    expect(next.color).toBe('#ff0000');
    expect(next.gradientStartColor).toBe('#123456');
    expect(next.fillCssValue).toBe('#123456');
  });

  it('projects the whole outline group', () => {
    const next = projectRenderStyle(source(), target(), ['outline']);
    expect(next.outlineColor).toBe('#00ff00');
    expect(next.outlineOpacity).toBe(0.5);
    expect(next.outlineWidth).toBe(3);
    expect(next.fontFamily).toBe('Target Font');
  });

  it('projects the alignment', () => {
    const next = projectRenderStyle(source(), target(), ['alignment']);
    expect(next.alignment).toBe('center');
    expect(next.fontFamily).toBe('Target Font');
  });

  it('leaves the target untouched when no attributes are checked', () => {
    const targetStyle = target();
    const next = projectRenderStyle(source(), targetStyle, []);
    expect(next).toEqual(targetStyle);
  });

  it('does not mutate the target style object', () => {
    const targetStyle = target();
    projectRenderStyle(source(), targetStyle, ['fontFamily', 'color']);
    expect(targetStyle.fontFamily).toBe('Target Font');
    expect(targetStyle.color).toBe('#123456');
  });
});
