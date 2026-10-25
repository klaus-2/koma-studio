// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  ensureCanvasFontLoaded,
  resetLoadedCanvasFontCache,
} from '../../../utils/dashboard.utils';
import {
  clearRegionLayoutCache,
  drawRegionsToCanvas,
  resolveRegionTextLayout,
} from './canvasDrawing';
import {
  resolveInlineEditorLineBoxes,
  resolveInlineEditorOffsetFromPoint,
} from '../../../utils/inlineEditorLayout';

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
    clearRect: (): void => {},
    fillText: (): void => {},
    strokeText: (): void => {},
    fillRect: (): void => {},
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

const STYLE: RenderTextStyle = {
  ...DEFAULT_RENDER_STYLE,
  alignment: 'left',
  fontSize: 64,
  minFontSize: 8,
};

// source: 'refined' short-circuits the shape rebuild in resolveRegionRenderShape.
const buildRegion = (
  renderText: string,
  renderTextStyleRanges?: AioTextRegion['renderTextStyleRanges'],
): AioTextRegion =>
  ({
    id: 'region-1',
    bbox: [0, 0, 320, 420],
    renderText,
    renderTextStyleRanges,
    shape: {
      kind: 'rounded',
      source: 'refined',
      cornerRadius: 160,
      innerBox: [24, 36, 296, 384],
      fitProfile: [0.55, 0.7, 0.85, 0.95, 1, 0.95, 0.85, 0.7, 0.55],
    },
  }) as unknown as AioTextRegion;

const PAINTED_TEXT = 'NUNCA IMAGINEI QUE A VERIA TRABALHANDO EM UM LUGAR COMO ESTE...';

describe('resolveRegionTextLayout (shared by painter and inline editor)', () => {
  beforeEach(() => {
    clearRegionLayoutCache();
  });

  it('keeps editor line boxes on the painted lines for drafts with trailing whitespace', () => {
    const region = buildRegion(`${PAINTED_TEXT}\n\n`);
    const { layout, shape } = resolveRegionTextLayout(createMockCtx(), {
      region,
      text: region.renderText ?? '',
      style: STYLE,
      styleRanges: region.renderTextStyleRanges,
      renderStageActive: true,
    });

    expect(layout.placements.length).toBeGreaterThan(1);

    // The editor maps selection geometry against the raw (untrimmed) draft.
    const boxes = resolveInlineEditorLineBoxes({
      text: region.renderText ?? '',
      bbox: region.bbox,
      layout,
      style: STYLE,
      shape,
    });
    expect(boxes).toHaveLength(layout.placements.length);

    const innerBox = shape?.innerBox ?? [0, 0, 320, 420];
    const innerHeight = innerBox[3] - innerBox[1];
    const drawTop = innerBox[1] + Math.max(0, (innerHeight - layout.textHeight) / 2);

    layout.placements.forEach((placement, index) => {
      const glyphCenter =
        drawTop + placement.y + (placement.lineHeight ?? layout.lineHeight) / 2;
      const offset = resolveInlineEditorOffsetFromPoint(
        boxes,
        0.2,
        glyphCenter / 420,
        (region.renderText ?? '').length,
      );
      const box = boxes[index];
      expect(offset).not.toBeNull();
      expect(offset).toBeGreaterThanOrEqual(box?.start ?? -1);
      expect(offset).toBeLessThanOrEqual(box?.end ?? -1);
    });
  });

  it('serves the painter and the editor the same cached layout entry', () => {
    const draftRanges = [
      { start: 0, end: 5, style: { bold: true } },
    ];
    // The painter draws the region with the draft text+ranges applied.
    const region = buildRegion(`${PAINTED_TEXT}\n`, draftRanges);
    const drawCtx = createMockCtx();
    drawRegionsToCanvas(drawCtx, 320, 420, [region], STYLE, true);

    // The editor resolves the raw (untrimmed) draft text with the same draft
    // ranges: the trimmed signature matches, so the cache entry the painter
    // created is reused without measuring again.
    const editorCtx = createMockCtx();
    const measureSpy = vi.spyOn(editorCtx, 'measureText');
    const editorEntry = resolveRegionTextLayout(editorCtx, {
      region: buildRegion(PAINTED_TEXT),
      text: `${PAINTED_TEXT}\n`,
      style: STYLE,
      styleRanges: draftRanges,
      renderStageActive: true,
    });
    expect(measureSpy.mock.calls.length).toBe(0);
    expect(editorEntry.layout.placements.length).toBeGreaterThan(0);
  });

  it('re-measures after the layout cache is cleared', () => {
    const region = buildRegion(PAINTED_TEXT);
    const ctx = createMockCtx();
    const measureSpy = vi.spyOn(ctx, 'measureText');

    resolveRegionTextLayout(ctx, {
      region,
      text: PAINTED_TEXT,
      style: STYLE,
      styleRanges: undefined,
      renderStageActive: true,
    });
    const afterFirst = measureSpy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    resolveRegionTextLayout(ctx, {
      region,
      text: PAINTED_TEXT,
      style: STYLE,
      styleRanges: undefined,
      renderStageActive: true,
    });
    expect(measureSpy.mock.calls.length).toBe(afterFirst);

    clearRegionLayoutCache();
    resolveRegionTextLayout(ctx, {
      region,
      text: PAINTED_TEXT,
      style: STYLE,
      styleRanges: undefined,
      renderStageActive: true,
    });
    expect(measureSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });
});

const withFontSet = (fonts: {
  check: (request: string) => boolean;
  load: (request: string) => Promise<FontFace[]>;
}): void => {
  Object.defineProperty(document, 'fonts', {
    value: fonts,
    configurable: true,
  });
};

describe('ensureCanvasFontLoaded availability flag', () => {
  beforeEach(() => {
    resetLoadedCanvasFontCache();
  });

  it('flags fonts that became usable and stays quiet afterwards', async () => {
    let available = false;
    withFontSet({
      check: () => available,
      load: async () => [{}] as FontFace[],
    });

    // Font not loaded yet: load() resolves but check() is still false.
    await expect(
      ensureCanvasFontLoaded({ ...STYLE, fontFamily: 'Koma Test' }),
    ).resolves.toBe(false);

    available = true;
    await expect(
      ensureCanvasFontLoaded({ ...STYLE, fontFamily: 'Koma Test' }),
    ).resolves.toBe(true);

    // Already keyed and still available: no invalidation needed.
    await expect(
      ensureCanvasFontLoaded({ ...STYLE, fontFamily: 'Koma Test' }),
    ).resolves.toBe(false);

    // Catalog reset re-keys the family: metrics may have changed.
    resetLoadedCanvasFontCache();
    await expect(
      ensureCanvasFontLoaded({ ...STYLE, fontFamily: 'Koma Test' }),
    ).resolves.toBe(true);
  });
});
