// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import type { AioTextRegion } from '../../../types/dashboard.types';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type { RenderTextPreviewInlineEditorState } from './useRenderTextPreviewInlineEditor';
import { clearRegionLayoutCache } from './canvasDrawing';
import { useRenderTextPreviewSelection } from './useRenderTextPreviewSelection';

const measureContexts: CanvasRenderingContext2D[] = [];

const createMeasureContext = (): CanvasRenderingContext2D => {
  const ctx = {
    font: '16px "Arial", sans-serif',
    canvas: { width: 0, height: 0 },
    save: (): void => {},
    restore: (): void => {},
    clearRect: (): void => {},
    fillText: (): void => {},
    strokeText: (): void => {},
    fillRect: (): void => {},
    measureText: (text: string): TextMetrics => {
      const match = /(\d+(?:\.\d+)?)px/u.exec(ctx.font);
      const size = match ? Number(match[1]) : 16;
      return {
        width: text.length * size * 0.6,
        actualBoundingBoxAscent: size * 0.8,
        actualBoundingBoxDescent: size * 0.2,
      } as TextMetrics;
    },
  };
  const cast = ctx as unknown as CanvasRenderingContext2D;
  measureContexts.push(cast);
  return cast;
};

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => createMeasureContext(),
  );
});

const MEASURE_STYLE = {
  ...DEFAULT_RENDER_STYLE,
  fontSize: 42,
  minFontSize: 8,
};

const buildRegion = (renderText: string, id = 'region-1'): AioTextRegion =>
  ({
    id,
    bbox: [0, 0, 320, 120],
    renderText,
    shape: {
      kind: 'rounded',
      source: 'refined',
      cornerRadius: 60,
      innerBox: [24, 18, 296, 102],
      fitProfile: [0.55, 0.7, 0.85, 0.95, 1, 0.95, 0.85, 0.7, 0.55],
    },
  }) as unknown as AioTextRegion;

const buildInlineEditor = (
  overrides: Partial<RenderTextPreviewInlineEditorState>,
): RenderTextPreviewInlineEditorState => ({
  regionId: 'region-1',
  value: 'Hello world',
  originalValue: 'Hello world',
  sessionOriginalValue: 'Hello world',
  isDirty: false,
  selectionStart: 0,
  selectionEnd: 0,
  ...overrides,
});

const REGION = buildRegion('Hello world');
const REGION_MAP = new Map([['region-1', REGION]]);
const REGION_LIST = [REGION];

const renderSelectionHook = (
  inlineEditor: RenderTextPreviewInlineEditorState | null,
  fontRefreshToken = 0,
) =>
  renderHook(
    ({
      editor,
      token,
    }: {
      editor: RenderTextPreviewInlineEditorState | null;
      token: number;
    }) =>
      useRenderTextPreviewSelection({
        selectedRegionId: 'region-1',
        hoveredRegionId: null,
        contextMenu: null,
        inlineEditor: editor,
        displayRegionById: REGION_MAP,
        displayRegionsWithDefaults: REGION_LIST,
        fallbackStyle: MEASURE_STYLE,
        availableTypographyPresets: [],
        availableTypographyFolders: [],
        presetSearch: '',
        presetFolderFilter: null,
        renderStageActive: true,
        active: true,
        editable: true,
        areaSelectionEnabled: false,
        inlineEditorRequestKey: null,
        inlineEditorDisplayScale: 1,
        fontRefreshToken: token,
        openInlineEditorForRegion: () => undefined,
      }),
    { initialProps: { editor: inlineEditor, token: fontRefreshToken } },
  );

describe('useRenderTextPreviewSelection empty draft', () => {
  it('clearing the draft to empty must not throw during render', () => {
    const { result } = renderSelectionHook(
      buildInlineEditor({ value: '', isDirty: true }),
    );

    expect(result.current.inlineEditorLineBoxes).toHaveLength(0);
    expect(result.current.inlineEditorUsesCanvasSelection).toBe(false);
  });

  it('a whitespace-only draft does not throw either', () => {
    const { result } = renderSelectionHook(
      buildInlineEditor({ value: '   ', isDirty: true }),
    );

    expect(result.current.inlineEditorLineBoxes).toHaveLength(0);
  });

  it('a cleared draft keeps the region font metrics in the editor frame', () => {
    const { result } = renderSelectionHook(
      buildInlineEditor({ value: '', isDirty: true }),
    );

    expect(result.current.inlineEditorContentEditableStyle.fontSize).not.toBe(
      '12px',
    );
  });

  it('both draft and stored text empty fall back to the default frame', () => {
    const { result } = renderSelectionHook(
      buildInlineEditor({ value: '', originalValue: '', isDirty: true }),
    );

    expect(result.current.inlineEditorLineBoxes).toHaveLength(0);
    expect(result.current.inlineEditorContentEditableStyle.fontSize).toBe('12px');
  });

  it('a non-empty draft still produces line boxes on the painted layout', () => {
    const { result } = renderSelectionHook(
      buildInlineEditor({ value: 'Hello world' }),
    );

    expect(result.current.inlineEditorLineBoxes.length).toBeGreaterThan(0);
    expect(result.current.inlineEditorUsesCanvasSelection).toBe(true);
  });

  it('a fontRefreshToken bump re-measures with the loaded font metrics', () => {
    let fontsAvailable = false;
    Object.defineProperty(document, 'fonts', {
      value: { check: (): boolean => fontsAvailable },
      configurable: true,
    });
    const tokenRegion = buildRegion('Hello world', 'region-token');
    const tokenMap = new Map([['region-token', tokenRegion]]);
    const tokenList = [tokenRegion];
    const renderTokenHook = (token: number) =>
      renderHook(
        ({ editor, token: value }: { editor: RenderTextPreviewInlineEditorState | null; token: number }) =>
          useRenderTextPreviewSelection({
            selectedRegionId: 'region-token',
            hoveredRegionId: null,
            contextMenu: null,
            inlineEditor: editor,
            displayRegionById: tokenMap,
            displayRegionsWithDefaults: tokenList,
            fallbackStyle: MEASURE_STYLE,
            availableTypographyPresets: [],
            availableTypographyFolders: [],
            presetSearch: '',
            presetFolderFilter: null,
            renderStageActive: true,
            active: true,
            editable: true,
            areaSelectionEnabled: false,
            inlineEditorRequestKey: null,
            inlineEditorDisplayScale: 1,
            fontRefreshToken: value,
            openInlineEditorForRegion: () => undefined,
          }),
        { initialProps: { editor: buildInlineEditor({ value: 'Hello world', regionId: 'region-token' }), token } },
      );

    try {
      clearRegionLayoutCache();
      const measureSpy = vi.spyOn(measureContexts[0]!, 'measureText');
      const { rerender } = renderTokenHook(0);
      const measuredOnce = measureSpy.mock.calls.length;
      expect(measuredOnce).toBeGreaterThan(0);

      rerender({
        editor: buildInlineEditor({ value: 'Hello world', regionId: 'region-token' }),
        token: 0,
      });
      expect(measureSpy.mock.calls.length).toBe(measuredOnce);

      fontsAvailable = true;
      rerender({
        editor: buildInlineEditor({ value: 'Hello world', regionId: 'region-token' }),
        token: 1,
      });
      expect(measureSpy.mock.calls.length).toBeGreaterThan(measuredOnce);
    } finally {
      Reflect.deleteProperty(document, 'fonts');
      clearRegionLayoutCache();
    }
  });

  it('an unchanged fontRefreshToken keeps the memoized layout', () => {
    const editor = buildInlineEditor({ value: 'Hello world' });
    const { result, rerender } = renderSelectionHook(editor);
    const frameBefore = result.current.inlineEditorContentEditableStyle;

    rerender({ editor, token: 0 });

    expect(result.current.inlineEditorContentEditableStyle).toBe(frameBefore);
  });
});
