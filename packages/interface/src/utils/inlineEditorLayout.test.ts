import { test } from 'vitest';
import assert from 'node:assert/strict';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants.ts';
import type { RenderTextLayout } from './renderText.types.ts';
import {
  resolveInlineEditorLayoutFrame,
  resolveInlineEditorLineBoxes,
} from './inlineEditorLayout.ts';

const layout: RenderTextLayout = {
  wrappedText: 'two\nlines',
  lines: ['two', 'lines'],
  fontSize: 20,
  lineHeight: 24,
  textWidth: 80,
  textHeight: 100,
  placements: [],
  shapeKind: 'square',
};

test('frames a square region with centered text in displayed pixels', () => {
  const frame = resolveInlineEditorLayoutFrame({
    bbox: [10, 20, 210, 220],
    layout,
    style: {
      ...DEFAULT_RENDER_STYLE,
      alignment: 'center',
      outlineWidth: 2,
    },
    displayScale: 0.5,
  });

  assert.deepEqual(frame, {
    fontSize: 10,
    lineHeight: 12,
    paddingTop: 25,
    paddingLeft: 1,
    paddingRight: 1,
    textAlign: 'center',
  });
});

test('uses the canvas line width so DOM wrapping matches shaped text', () => {
  const frame = resolveInlineEditorLayoutFrame({
    bbox: [0, 0, 200, 200],
    layout: {
      ...layout,
      placements: [
        {
          text: 'narrow',
          x: 0,
          y: 0,
          measuredWidth: 80,
          availableWidth: 100,
        },
      ],
    },
    style: DEFAULT_RENDER_STYLE,
    displayScale: 0.5,
  });

  assert.equal(frame.paddingLeft, 25);
  assert.equal(frame.paddingRight, 25);
});

test('maps canvas lines back to logical offsets for selection geometry', () => {
  const text = 'ALPHA\nBRAVO\nCHARLIE';
  const boxes = resolveInlineEditorLineBoxes({
    text,
    bbox: [0, 0, 200, 200],
    layout: {
      ...layout,
      lines: ['ALPHA', 'BRAVO', 'CHARLIE'],
      textHeight: 72,
      placements: [
        {
          text: 'ALPHA',
          x: 10,
          y: 0,
          measuredWidth: 100,
          availableWidth: 180,
        },
        {
          text: 'BRAVO',
          x: 10,
          y: 24,
          measuredWidth: 100,
          availableWidth: 180,
        },
        {
          text: 'CHARLIE',
          x: 10,
          y: 48,
          measuredWidth: 100,
          availableWidth: 180,
        },
      ],
    },
    style: { ...DEFAULT_RENDER_STYLE, alignment: 'left' },
  });

  assert.deepEqual(
    boxes.map((box) => [box.start, box.end]),
    [[0, 5], [6, 11], [12, 19]],
  );
  assert.equal(boxes[0]?.left, 0.05);
  assert.equal(boxes[0]?.width, 0.5);
});

test('maps uppercase canvas lines to original text offsets', () => {
  const boxes = resolveInlineEditorLineBoxes({
    text: 'Nunca imaginei',
    bbox: [0, 0, 200, 100],
    layout: {
      ...layout,
      lines: ['NUNCA', 'IMAGINEI'],
      textHeight: 48,
      placements: [
        {
          text: 'NUNCA',
          x: 0,
          y: 0,
          measuredWidth: 80,
          availableWidth: 200,
        },
        {
          text: 'IMAGINEI',
          x: 0,
          y: 24,
          measuredWidth: 120,
          availableWidth: 200,
        },
      ],
    },
    style: { ...DEFAULT_RENDER_STYLE, uppercase: true },
  });

  assert.deepEqual(
    boxes.map((box) => [box.start, box.end]),
    [[0, 5], [6, 14]],
  );
});

test('frames a shaped region with its inner box and right alignment', () => {
  const frame = resolveInlineEditorLayoutFrame({
    bbox: [10, 20, 210, 220],
    layout,
    style: {
      ...DEFAULT_RENDER_STYLE,
      alignment: 'right',
      outlineWidth: 0,
    },
    shape: {
      kind: 'rounded',
      source: 'manual',
      cornerRadius: 8,
      innerBox: [10, 20, 180, 160],
      fitProfile: [],
    },
    displayScale: 2,
  });

  assert.deepEqual(frame, {
    fontSize: 40,
    lineHeight: 48,
    paddingTop: 76,
    paddingLeft: 20,
    paddingRight: 40,
    textAlign: 'right',
  });
});
