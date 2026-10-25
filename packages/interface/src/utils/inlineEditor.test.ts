import { test } from 'vitest';
import assert from 'node:assert/strict';

import type { RenderTextStyle } from './renderText.ts';
import {
  applyInlineEditorTextDraft,
  buildInlineSelectionStylePatch,
  normalizeInlineEditorPlainText,
  readInlineEditorPlainText,
  buildInlineEditorRuns,
  resolveInlineEditorFillColor,
  resolveInlineEditorTextPaint,
  resolveInlineEditorWordRange,
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

test('resolveInlineEditorFillColor reads the fill the canvas would paint', () => {
  assert.equal(
    resolveInlineEditorFillColor({
      ...baseStyle,
      color: '#101010',
      fillCssValue: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
      gradientEnabled: true,
    }),
    '#4ade80',
  );
});

test('resolveInlineEditorFillColor falls back to the flat color without a fill', () => {
  assert.equal(
    resolveInlineEditorFillColor({
      ...baseStyle,
      color: '#171717',
      fillCssValue: '',
    }),
    '#171717',
  );
});

test('resolveInlineEditorTextPaint mirrors outline and shadow layers', () => {
  const paint = resolveInlineEditorTextPaint({
    ...baseStyle,
    outlineWidth: 2,
    outlineColor: '#ffffff',
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowFillCssValue: '#000000',
    shadowOpacity: 0.5,
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 3,
  }, 0.5);

  assert.equal(paint.textStroke, '2px #ffffff');
  assert.match(paint.textShadow ?? '', /^1\.35px 2\.03px 2px /);
  assert.match(paint.textShadow ?? '', /color-mix/);
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

test('applyInlineEditorTextDraft replaces text and ranges for the edited region', () => {
  const regions = [
    { id: 'a', renderText: 'first', renderTextStyleRanges: undefined },
    { id: 'b', renderText: 'second', renderTextStyleRanges: undefined },
  ];
  const ranges = [{ start: 0, end: 5, style: { bold: true } }];
  const draft = applyInlineEditorTextDraft(regions, {
    regionId: 'b',
    value: 'draft',
    styleRanges: ranges,
  });

  assert.equal(draft[0], regions[0]);
  assert.equal(draft[1]?.renderText, 'draft');
  assert.equal(draft[1]?.renderTextStyleRanges, ranges);
});

test('resolveInlineEditorWordRange expands around a double-click offset', () => {
  const text = 'Por favor, segredo...';

  assert.deepEqual(resolveInlineEditorWordRange(text, 14), {
    start: 11,
    end: 18,
  });
  assert.deepEqual(resolveInlineEditorWordRange(text, 18), {
    start: 11,
    end: 18,
  });
  assert.deepEqual(resolveInlineEditorWordRange(text, 9), {
    start: 4,
    end: 9,
  });
});

test('buildInlineEditorRuns keeps an absolute range font size', () => {
  const runs = buildInlineEditorRuns(
    'big',
    [{ start: 0, end: 3, style: { fontSize: 48 } }],
    baseStyle,
  );

  assert.equal(runs[0]?.fontSize, 48);
  assert.equal(
    buildInlineEditorRuns('small', null, baseStyle)[0]?.fontSize,
    undefined,
  );
});
