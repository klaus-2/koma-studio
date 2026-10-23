import { test } from 'vitest';
import assert from 'node:assert/strict';

import type { RenderTextStyle } from './renderText.ts';
import {
  buildInlineSelectionStylePatch,
  normalizeInlineEditorPlainText,
  readInlineEditorPlainText,
  buildInlineEditorRuns,
  resolveInlineEditorTextAppearance,
} from './inlineEditor.ts';

const baseStyle: RenderTextStyle = {
  fontFamily: 'Arial',
  fontSize: 24,
  minFontSize: 12,
  lineSpacing: 1.2,
  color: '#ffffff',
  alignment: 'center',
  outlineColor: '#000000',
  outlineWidth: 0,
  outlineOpacity: 1,
  bold: false,
  italic: false,
  underline: false,
  uppercase: false,
  shadowColor: '#000000',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  opacity: 1,
  autoFontSize: true,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  textOrientation: 'horizontal',
  textPathMode: 'normal',
  circularRadiusScale: 1,
  circularStartAngle: 0,
  circularLetterSpacing: 0,
  gradientEnabled: false,
  gradientStartColor: '#ffffff',
  gradientEndColor: '#ffffff',
  gradientAngle: 0,
  detectGradient: false,
  hyphenationEnabled: false,
  textEffectPreset: 'none' as const,
  textEffectIntensity: 1,
  shadowEnabled: false,
  shadowOpacity: 1,
  shadowFillCssValue: '#000000',
  shadowGradientEnabled: false,
  shadowGradientStartColor: '#000000',
  shadowGradientEndColor: '#000000',
  shadowGradientAngle: 0,
  fillCssValue: '#ffffff',
};

test('buildInlineSelectionStylePatch removes underline when selection is already underlined', () => {
  const patch = buildInlineSelectionStylePatch(
    { ...baseStyle, underline: true },
    (style) => ({
      ...style,
      underline: !style.underline,
    }),
  );

  assert.deepEqual(patch, { underline: false });
});

test('buildInlineSelectionStylePatch enables bold when selection is not bold', () => {
  const patch = buildInlineSelectionStylePatch(baseStyle, (style) => ({
    ...style,
    bold: !style.bold,
  }));

  assert.deepEqual(patch, { bold: true });
});

test('readInlineEditorPlainText preserves line breaks from innerText', () => {
  const value = readInlineEditorPlainText({
    innerText: 'linha 1\r\nlinha 2\r\nlinha 3',
    textContent: 'linha 1linha 2linha 3',
  });

  assert.equal(value, 'linha 1\nlinha 2\nlinha 3');
});

test('normalizeInlineEditorPlainText keeps existing unix line breaks intact', () => {
  assert.equal(
    normalizeInlineEditorPlainText('a\nb\nc'),
    'a\nb\nc',
  );
});

test('resolveInlineEditorTextAppearance reads the fill the canvas would paint', () => {
  const appearance = resolveInlineEditorTextAppearance({
    ...baseStyle,
    color: '#101010',
    fillCssValue: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
    gradientEnabled: true,
  });

  assert.equal(appearance.color, '#4ade80');
  assert.match(appearance.textShadow, /rgba\(0, 0, 0/);
});

test('resolveInlineEditorTextAppearance haloes a dark fill for the dark panel', () => {
  const appearance = resolveInlineEditorTextAppearance({
    ...baseStyle,
    color: '#171717',
    fillCssValue: '#171717',
  });

  assert.equal(appearance.color, '#171717');
  assert.match(appearance.textShadow, /rgba\(255, 255, 255/);
});

test('resolveInlineEditorTextAppearance falls back to a drop shadow it cannot read', () => {
  const appearance = resolveInlineEditorTextAppearance({
    ...baseStyle,
    color: 'var(--unknown-fill)',
    fillCssValue: 'var(--unknown-fill)',
  });

  assert.equal(appearance.color, 'var(--unknown-fill)');
  assert.equal(appearance.textShadow, '0 1px 2px rgba(0, 0, 0, 0.65)');
});

test('buildInlineEditorRuns mirrors per-range formatting inside the editor', () => {
  const runs = buildInlineEditorRuns(
    'plain bold u',
    [
      { start: 6, end: 10, style: { bold: true } },
      { start: 11, end: 12, style: { italic: true, underline: true } },
    ],
    baseStyle,
  );

  assert.deepEqual(runs.map((run) => run.text), ['plain ', 'bold', ' ', 'u']);
  assert.equal(runs[1]?.fontWeight, '700');
  assert.deepEqual(
    {
      fontWeight: runs[3]?.fontWeight,
      fontStyle: runs[3]?.fontStyle,
      textDecoration: runs[3]?.textDecoration,
    },
    { fontWeight: '400', fontStyle: 'italic', textDecoration: 'underline' },
  );
});
