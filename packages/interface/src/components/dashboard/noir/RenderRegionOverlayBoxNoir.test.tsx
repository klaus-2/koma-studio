// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { DEFAULT_RENDER_STYLE } from '@/constants/dashboard.constants';
import RenderRegionOverlayBoxNoir from './RenderRegionOverlayBoxNoir';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = {
  id: 'r1',
  bbox: [10, 10, 200, 120] as [number, number, number, number],
  score: 1,
  source: 'auto' as const,
  modelKey: 'm',
  detectorModelKey: 'm',
  detectedRenderMode: 'text_bubble' as const,
  renderMode: 'auto' as const,
  renderText: 'hello',
  renderStyle: { ...DEFAULT_RENDER_STYLE },
  shape: undefined,
  queueIndex: null,
  hidden: false,
  locked: false,
};

const buildEditor = () => ({
  state: {
    regionId: 'r1',
    value: 'hello',
    originalValue: 'hello',
    isDirty: false,
    selectionStart: 0,
    selectionEnd: 5,
  },
  contentEditableRef: { current: null },
  contentEditableStyle: {},
  onInput: vi.fn(),
  syncSelection: vi.fn(),
  cancel: vi.fn(),
  save: vi.fn(),
  toggleFormat: vi.fn(),
  setState: vi.fn(),
  dockPointerDownRef: { current: false },
  dockRef: { current: null },
});

describe('inline editor formatting shortcuts', () => {
  it('routes ctrl+b, ctrl+i and ctrl+u to the region style toggle', () => {
    const editor = buildEditor();
    const { getByRole } = render(
      <I18nProvider>
        <RenderRegionOverlayBoxNoir
          region={region as never}
          imageWidth={800}
          imageHeight={1200}
          isNoteOverlay={false}
          selected
          isMultiSelected={false}
          multiSelectIndex={-1}
          renderStageActive
          fallbackStyle={DEFAULT_RENDER_STYLE}
          showHandles={false}
          editor={editor}
        />
      </I18nProvider>,
    );

    const textbox = getByRole('textbox');
    fireEvent.keyDown(textbox, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(textbox, { key: 'i', ctrlKey: true });
    fireEvent.keyDown(textbox, { key: 'u', ctrlKey: true });

    expect(editor.toggleFormat.mock.calls).toEqual([
      ['bold'],
      ['italic'],
      ['underline'],
    ]);
    // The native rich-text toggle would be dropped when the value is read back.
    expect(editor.onInput).not.toHaveBeenCalled();
  });
});
