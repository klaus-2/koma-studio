// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AioGlossaryEditor } from './AioGlossaryEditor';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import type { GlossaryTerm } from '../../../utils/glossary';

const asInput = (element: Element | null): HTMLInputElement => {
  expect(element).toBeInstanceOf(HTMLInputElement);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error('expected an input element');
  }
  return element;
};

const expectInput = (element: Element | null): HTMLInputElement => {
  const input = asInput(element);
  expect(input.type).not.toBe('checkbox');
  return input;
};

const renderEditor = (glossary: GlossaryTerm[], onChange: (next: GlossaryTerm[]) => void) =>
  render(
    <I18nProvider>
      <AioGlossaryEditor glossary={glossary} onChange={onChange} />
    </I18nProvider>,
  );

afterEach(cleanup);

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

describe('AioGlossaryEditor', () => {
  it('keeps row identity when a middle row is deleted', async () => {
    const glossary: GlossaryTerm[] = [
      { source: 'a', target: 'a1', never_translate: false },
      { source: 'b', target: 'b1', never_translate: false },
      { source: 'c', target: 'c1', never_translate: false },
    ];
    const onChange = vi.fn<(next: GlossaryTerm[]) => void>();
    renderEditor(glossary, onChange);

    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes).toHaveLength(6);
    const rowCSource = expectInput(textboxes.at(-2) ?? null);
    await userEvent.click(rowCSource);
    expect(document.activeElement).toBe(rowCSource);

    const buttons = screen.getAllByRole('button');
    // Rows render first; the last button is the add button.
    const removeButtons = buttons.slice(0, buttons.length - 1);
    expect(removeButtons).toHaveLength(3);
    const middleRemove = removeButtons[1];
    expect(middleRemove).toBeDefined();
    if (!middleRemove) {
      throw new Error('expected the middle remove button');
    }

    fireEvent.click(middleRemove);

    // The focused input survived as the same DOM node — index keys would have unmounted it.
    expect(document.activeElement).toBe(rowCSource);
    const survivingInputs = screen.getAllByRole('textbox').map((element) => {
      const input = expectInput(element);
      return input.value;
    });
    expect(survivingInputs).toEqual(['a', 'a1', 'c', 'c1']);
  });

  it('reloads the draft when the glossary prop changes (preset)', () => {
    const initial: GlossaryTerm[] = [
      { source: 'old', target: 'pair', never_translate: false },
    ];
    const onChange = vi.fn<(next: GlossaryTerm[]) => void>();
    const { rerender } = renderEditor(initial, onChange);

    const firstInputs = screen.getAllByRole('textbox').map((element) => expectInput(element).value);
    expect(firstInputs).toEqual(['old', 'pair']);

    const preset: GlossaryTerm[] = [
      { source: 'new-source', target: 'new-target', never_translate: true },
    ];
    rerender(
      <I18nProvider>
        <AioGlossaryEditor glossary={preset} onChange={onChange} />
      </I18nProvider>,
    );

    const reloaded = screen.getAllByRole('textbox').map((element) => expectInput(element).value);
    expect(reloaded).toEqual(['new-source', 'new-target']);
    // The resync replaces the draft without committing back to the store.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores the echo of its own commit so draft-only rows survive', async () => {
    const initial: GlossaryTerm[] = [
      { source: 'a', target: 'b', never_translate: false },
    ];
    const onChange = vi.fn<(next: GlossaryTerm[]) => void>();
    const { rerender } = renderEditor(initial, onChange);

    const buttons = screen.getAllByRole('button');
    const addButton = buttons.at(-1);
    expect(addButton).toBeDefined();
    if (!addButton) {
      throw new Error('expected the add button');
    }
    await userEvent.click(addButton);

    const src0 = expectInput(screen.getAllByRole('textbox').at(0) ?? null);
    await userEvent.type(src0, 'x');

    // The store now holds the clamped commit; the parent echoes it back.
    expect(onChange).toHaveBeenCalledWith([{ source: 'ax', target: 'b', never_translate: false }]);
    rerender(
      <I18nProvider>
        <AioGlossaryEditor glossary={[{ source: 'ax', target: 'b', never_translate: false }]} onChange={onChange} />
      </I18nProvider>,
    );

    // Echo ignored: the draft-only empty row survives and the typed value stays.
    const inputs = screen.getAllByRole('textbox').map((element) => expectInput(element).value);
    expect(inputs).toEqual(['ax', 'b', '', '']);
    expect(document.activeElement).toBe(src0);
  });
});
