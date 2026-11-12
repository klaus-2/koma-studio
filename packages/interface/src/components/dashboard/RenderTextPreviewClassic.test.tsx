// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type React from 'react';

import { I18nProvider } from '../../i18n';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import { DEFAULT_RENDER_STYLE } from '../../constants/dashboard.constants';
import { buildRenderTextPreviewProps } from './renderTextPreviewTestProps';
import { installJsdomBrowserStubs } from './renderTextPreviewTestSetup';

vi.mock('./render-text-preview/useRenderTextPreviewSelection', () => ({
  useRenderTextPreviewSelection: vi.fn(),
}));

import RenderTextPreviewClassic from './RenderTextPreviewClassic';
import { useRenderTextPreviewSelection } from './render-text-preview/useRenderTextPreviewSelection';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

beforeEach(() => {
  installJsdomBrowserStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const selectionHookMock = vi.mocked(useRenderTextPreviewSelection);

type SelectionHookReturn = ReturnType<typeof useRenderTextPreviewSelection>;

const selectionStub: SelectionHookReturn = {
  selectedRegion: null,
  selectedRegionTextStyleRanges: undefined,
  segmentOverlayBoxes: [],
  hoveredRegion: null,
  contextMenuTargetRegion: null,
  typographyFolderNameById: new Map<string, string>(),
  filteredTypographyPresets: [],
  groupedTypographyPresets: [],
  inlineEditorContentEditableStyle: {},
  inlineEditorLineBoxes: [],
  inlineEditorPaint: { color: '#ffffff', opacity: 1 },
  inlineEditorUsesCanvasSelection: false,
  selectedInlineSelectionActive: false,
  selectedRegionStyle: { ...DEFAULT_RENDER_STYLE },
  selectedRegionIsNoteOverlay: false,
  selectedRegionHasText: false,
  inlineEditorIsActiveForSelected: false,
  showRenderDock: false,
};

const renderSkin = (fontRefreshToken: number): React.ReactElement => {
  const props = buildRenderTextPreviewProps({ fontRefreshToken });
  return (
    <I18nProvider>
      <RenderTextPreviewClassic {...props} />
    </I18nProvider>
  );
};

describe('RenderTextPreviewClassic font wiring', () => {
  beforeEach(() => {
    selectionHookMock.mockReset();
    selectionHookMock.mockImplementation(() => selectionStub);
  });

  it('passes fontRefreshToken through to the selection hook', () => {
    const { rerender } = render(renderSkin(7));

    expect(selectionHookMock.mock.calls[0]?.[0]?.fontRefreshToken).toBe(7);

    rerender(renderSkin(9));
    expect(
      selectionHookMock.mock.calls.at(-1)?.[0]?.fontRefreshToken,
    ).toBe(9);
  });
});
