import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FontFamilySelect, type FontFamilySelectProps } from './FontFamilySelect';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars && 'count' in vars ? `${key}:${vars.count}` : key,
  }),
}));

const ARIA_LABEL = 'renderPreview.textFont';

type FontFamilySelectTestProps = Omit<FontFamilySelectProps, 'ariaLabel'>;

const changeHandler = (calls: string[]) => (family: string): void => {
  calls.push(family);
};

const renderPicker = (props: FontFamilySelectTestProps): HTMLElement => {
  const { container } = render(
    <FontFamilySelect ariaLabel={ARIA_LABEL} {...props} />,
  );
  return container;
};

const openPicker = (props: FontFamilySelectTestProps): void => {
  renderPicker(props);
  fireEvent.click(screen.getByRole('button', { name: ARIA_LABEL }));
};

const listbox = (): HTMLElement => screen.getByRole('listbox');

const optionRows = (): HTMLElement[] => within(listbox()).getAllByRole('option');

const searchField = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: 'fontPicker.searchAria' });

const familiesWithCount = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `Font ${String(index).padStart(4, '0')}`);

const moreResultsRow = (): HTMLElement => {
  const row = Array.from(listbox().children).find((child) =>
    (child.textContent ?? '').startsWith('fontPicker.moreResults'),
  );
  if (!row) {
    throw new Error('no fontPicker.moreResults row rendered');
  }
  return row as HTMLElement;
};

describe('FontFamilySelect', () => {
  it('owns its trigger class when the caller passes none', () => {
    renderPicker({
      value: 'Arial',
      families: ['Arial'],
      onChange: changeHandler([]),
    });

    expect(screen.getByRole('button', { name: ARIA_LABEL })).toHaveClass('koma-font-select__trigger');
  });

  it('composes the caller class with the trigger class it owns', () => {
    renderPicker({
      value: 'Arial',
      families: ['Arial'],
      onChange: changeHandler([]),
      className: 'koma-type-dock__select koma-type-dock__select--font',
    });

    const trigger = screen.getByRole('button', { name: ARIA_LABEL });
    expect(trigger).toHaveClass('koma-font-select__trigger');
    expect(trigger).toHaveClass('koma-type-dock__select');
    expect(trigger).toHaveClass('koma-type-dock__select--font');
  });

  it('narrows the listbox to the families matching the typed query', () => {
    openPicker({
      value: 'Arial',
      families: ['Arial', 'Cabin', 'Ubuntu Mono'],
      onChange: changeHandler([]),
    });

    expect(optionRows()).toHaveLength(3);

    fireEvent.change(searchField(), { target: { value: 'ubunt' } });

    const rows = optionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toBe('Ubuntu Mono');
    expect(screen.queryByText('fontPicker.noMatches')).toBeNull();
  });

  it('reports the empty state when no family matches the query', () => {
    openPicker({
      value: 'Arial',
      families: ['Arial', 'Cabin'],
      onChange: changeHandler([]),
    });

    fireEvent.change(searchField(), { target: { value: 'zzzz' } });

    expect(screen.getByText('fontPicker.noMatches')).toBeInTheDocument();
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0);
  });

  it('commits the highlighted family with arrow keys and Enter', () => {
    const picked: string[] = [];
    openPicker({
      value: 'Arial',
      families: ['Arial', 'Cabin', 'Ubuntu Mono'],
      onChange: changeHandler(picked),
    });

    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    expect(optionRows()[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(searchField(), { key: 'Enter' });

    expect(picked).toEqual(['Cabin']);
  });

  it('commits the family of a clicked option and closes the panel', () => {
    const picked: string[] = [];
    openPicker({
      value: 'Arial',
      families: ['Arial', 'Cabin', 'Ubuntu Mono'],
      onChange: changeHandler(picked),
    });

    const target = optionRows().find((row) => row.textContent === 'Ubuntu Mono');
    if (!target) {
      throw new Error('Ubuntu Mono option row is missing');
    }
    fireEvent.click(target);

    expect(picked).toEqual(['Ubuntu Mono']);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('exposes the listbox and option roles with a single selected row', () => {
    openPicker({
      value: 'Cabin',
      families: ['Arial', 'Cabin', 'Ubuntu Mono'],
      onChange: changeHandler([]),
    });

    const rows = optionRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('displays a stored family that is absent from the list and never writes state on mount', () => {
    const onChange = vi.fn<(family: string) => void>();
    renderPicker({
      value: 'Arial Bold',
      families: ['Arial', 'Cabin'],
      onChange,
    });

    expect(screen.getByRole('button', { name: ARIA_LABEL })).toHaveTextContent('Arial Bold');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: ARIA_LABEL }));

    const rows = optionRows();
    const pinned = rows.filter((row) => (row.textContent ?? '').startsWith('Arial Bold'));
    expect(pinned).toHaveLength(1);
    expect(screen.getByText('fontPicker.freeValue')).toBeInTheDocument();
    expect(rows.filter((row) => row.textContent === 'Arial')).toHaveLength(1);
  });

  it('renders the default label as the first option and commits an empty family when picked', () => {
    const picked: string[] = [];
    openPicker({
      value: '',
      families: ['Cabin', 'Ubuntu Mono'],
      onChange: changeHandler(picked),
      defaultOptionLabel: 'Default',
    });

    expect(screen.getByRole('button', { name: ARIA_LABEL })).toHaveTextContent('Default');

    const rows = optionRows();
    expect(rows[0]?.textContent).toBe('Default');

    fireEvent.click(rows[0] as HTMLElement);

    expect(picked).toEqual(['']);
  });

  it('bounds the rendered rows to the cap and reports the hidden families', () => {
    const families = familiesWithCount(2000);
    openPicker({
      value: families[0] as string,
      families,
      onChange: changeHandler([]),
    });

    const rows = optionRows();
    expect(rows).toHaveLength(100);
    expect(listbox().children).toHaveLength(101);
    expect(moreResultsRow().textContent).toBe('fontPicker.moreResults:1900');

    const hidden = Number((moreResultsRow().textContent ?? '').split(':')[1]);
    expect(rows.length + hidden).toBe(families.length);
  });

  it('filters a 2,000-family catalog in under 300 ms', () => {
    openPicker({
      value: 'Font 0000',
      families: familiesWithCount(2000),
      onChange: changeHandler([]),
    });

    const startedAt = performance.now();
    fireEvent.change(searchField(), { target: { value: 'Font 19' } });
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeLessThan(300);
    expect(optionRows().length).toBeGreaterThan(0);
  });

  it('never rewrites a stored family when the panel is opened and dismissed', () => {
    const onChange = vi.fn<(family: string) => void>();
    renderPicker({
      value: 'Georgia',
      families: ['Cabin', 'Manrope'],
      onChange,
    });

    fireEvent.click(screen.getByRole('button', { name: ARIA_LABEL }));
    fireEvent.change(searchField(), { target: { value: 'no-such-family' } });
    fireEvent.click(screen.getByRole('button', { name: ARIA_LABEL }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: ARIA_LABEL })).toHaveTextContent('Georgia');
  });
});
