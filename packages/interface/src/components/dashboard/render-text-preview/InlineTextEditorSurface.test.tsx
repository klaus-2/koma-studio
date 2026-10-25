// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import InlineTextEditorSurface, {
  type InlineTextEditorHandle,
} from './InlineTextEditorSurface';
import { buildInlineEditorHandle } from './inlineTextEditorTestFactory';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const buildEditor = () => buildInlineEditorHandle();

const renderSurface = (editor: InlineTextEditorHandle) =>
  render(
    <I18nProvider>
      <InlineTextEditorSurface editor={editor} />
    </I18nProvider>,
  );

const setCaretAtEnd = (node: HTMLElement): void => {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe('InlineTextEditorSurface canvas selection', () => {
  it('inserts a literal newline and a trailing br sentinel on Enter', () => {
    const editor = buildEditor();
    const { getByRole } = renderSurface(editor);
    const textbox = getByRole('textbox');
    textbox.textContent = 'abc';
    setCaretAtEnd(textbox);

    fireEvent.keyDown(textbox, { key: 'Enter' });

    expect(editor.onInput).toHaveBeenLastCalledWith('abc\n');
    expect(textbox.textContent).toBe('abc\n');
    expect(textbox.lastChild?.nodeName).toBe('BR');
  });

  it('reads the draft from textContent so a trailing newline survives input', () => {
    const editor = buildEditor();
    const { getByRole } = renderSurface(editor);
    const textbox = getByRole('textbox');
    textbox.textContent = 'a\n';

    fireEvent.input(textbox);

    expect(editor.onInput).toHaveBeenLastCalledWith('a\n');
    expect(textbox.lastChild?.nodeName).toBe('BR');
  });

  it('inserts pasted plain text as flat text', () => {
    const editor = buildEditor();
    const { getByRole } = renderSurface(editor);
    const textbox = getByRole('textbox');
    textbox.textContent = 'abc';
    setCaretAtEnd(textbox);

    fireEvent.paste(textbox, {
      clipboardData: { getData: () => 'A\nB' },
    });

    expect(editor.onInput).toHaveBeenLastCalledWith('abcA\nB');
    expect(textbox.textContent).toBe('abcA\nB');
  });
});
