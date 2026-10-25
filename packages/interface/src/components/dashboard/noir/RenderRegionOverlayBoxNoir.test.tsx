// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { DEFAULT_RENDER_STYLE } from '@/constants/dashboard.constants';
import RenderRegionOverlayBoxNoir from './RenderRegionOverlayBoxNoir';
import {
  buildInlineEditorHandle,
  buildInlineEditorState,
} from '../render-text-preview/inlineTextEditorTestFactory';

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

const buildEditor = () =>
  buildInlineEditorHandle({
    state: buildInlineEditorState({
      value: 'hello',
      originalValue: 'hello',
      sessionOriginalValue: 'hello',
      selectionStart: 0,
      selectionEnd: 5,
    }),
    canvasSelection: false,
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

describe('inline editor commit and composition', () => {
  const renderEditor = (editor: ReturnType<typeof buildEditor>) =>
    render(
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

  it('commits with ctrl+enter and cancels with escape', () => {
    const editor = buildEditor();
    const { getByRole } = renderEditor(editor);
    const textbox = getByRole('textbox');

    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(textbox, { key: 'Escape' });

    expect(editor.save).toHaveBeenCalledTimes(1);
    expect(editor.cancel).toHaveBeenCalledTimes(1);
  });

  it('hands composition to the hook and keeps the composed text', () => {
    const editor = buildEditor();
    const { getByRole } = renderEditor(editor);
    const textbox = getByRole('textbox');

    fireEvent.compositionStart(textbox);
    textbox.textContent = '日本語';
    fireEvent.compositionEnd(textbox);

    expect(editor.beginComposition).toHaveBeenCalledTimes(1);
    expect(editor.endComposition).toHaveBeenCalledTimes(1);
    expect(editor.onInput).toHaveBeenLastCalledWith('日本語');
  });

  it('commits dirty text on blur and closes a clean editor', () => {
    const dirtyEditor = buildEditor();
    dirtyEditor.state = { ...dirtyEditor.state, isDirty: true };
    const dirty = renderEditor(dirtyEditor);
    fireEvent.blur(dirty.getByRole('textbox'));
    expect(dirtyEditor.save).toHaveBeenCalledTimes(1);
    dirty.unmount();

    const cleanEditor = buildEditor();
    const clean = renderEditor(cleanEditor);
    fireEvent.blur(clean.getByRole('textbox'));
    expect(cleanEditor.setState).toHaveBeenCalledWith(null);
  });
});
