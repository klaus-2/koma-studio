// @vitest-environment jsdom

import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  TypographerQueueRowClassic,
  TypographerQueueRowNoir,
  type TypographerQueueRowProps,
} from './TypographerTextQueueRows';
import { I18nProvider } from '../../i18n';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import type { TextQueueItem } from '../../typography/types';

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const item = (overrides: Partial<TextQueueItem> = {}): TextQueueItem => ({
  id: 'q-1',
  text: 'First line',
  status: 'pending',
  appliedRegionId: null,
  createdAt: 0,
  ...overrides,
});

const baseRow = item();
const noopSelect = () => undefined;

const Harness = ({
  row,
  initialItem = baseRow,
  initialSelected = false,
}: {
  row: (props: TypographerQueueRowProps) => React.ReactElement;
  initialItem?: TextQueueItem;
  initialSelected?: boolean;
}) => {
  const [itemState, setItem] = useState(initialItem);
  const [selected, setSelected] = useState(initialSelected);
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  return (
    <div>
      <button type="button" aria-label="tick" onClick={() => setTick((value) => value + 1)}>
        {tick}
      </button>
      <button
        type="button"
        aria-label="change-item"
        onClick={() => setItem({ ...itemState, status: 'applied' })}
      >
        change-item
      </button>
      <button type="button" aria-label="select" onClick={() => setSelected(true)}>
        select
      </button>
      <button type="button" aria-label="move" onClick={() => setIndex(3)}>
        move
      </button>
      <I18nProvider>
        {row({ item: itemState, index, selected, onSelect: noopSelect })}
      </I18nProvider>
    </div>
  );
};

type MemoRuntime = { type: (...args: never[]) => unknown };
const memoRuntime = (component: object): MemoRuntime => component as MemoRuntime;

const mountHarness = (
  row: (props: TypographerQueueRowProps) => React.ReactElement,
  type: MemoRuntime,
  initialItem?: TextQueueItem,
  initialSelected?: boolean,
) => {
  const bodySpy = vi.spyOn(type, 'type');
  const view = render(
    <Harness row={row} initialItem={initialItem} initialSelected={initialSelected} />,
  );
  return {
    view,
    renders: () => bodySpy.mock.calls.length,
    click: async (name: string) => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name }));
      });
    },
  };
};

describe('TypographerQueueRowClassic', () => {
  it('skips the render when the parent re-renders with unchanged row data', async () => {
    const harness = mountHarness(
      (props) => <TypographerQueueRowClassic {...props} />,
      memoRuntime(TypographerQueueRowClassic),
    );
    expect(harness.renders()).toBe(1);
    await harness.click('tick');
    expect(harness.renders()).toBe(1);
    await harness.click('tick');
    expect(harness.renders()).toBe(1);
  });

  it('re-renders only when the item data, selection or index changes', async () => {
    const harness = mountHarness(
      (props) => <TypographerQueueRowClassic {...props} />,
      memoRuntime(TypographerQueueRowClassic),
    );
    expect(harness.renders()).toBe(1);
    await harness.click('change-item');
    expect(harness.renders()).toBe(2);
    await harness.click('select');
    expect(harness.renders()).toBe(3);
    await harness.click('move');
    expect(harness.renders()).toBe(4);
    await harness.click('tick');
    expect(harness.renders()).toBe(4);
  });

  it('keeps the row DOM contract and reports the clicked item id', async () => {
    let capturedId: string | null = null;
    const { view } = mountHarness(
      (props) => (
        <TypographerQueueRowClassic {...props} onSelect={(id) => { capturedId = id; }} />
      ),
      memoRuntime(TypographerQueueRowClassic),
      item({ status: 'skipped', text: 'Second line' }),
      true,
    );
    const row = view.getByRole('listitem');
    expect(row.className).toBe('koma-text-queue__item koma-text-queue__item--active');
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('Second line')).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
    await act(async () => {
      fireEvent.click(row);
    });
    expect(capturedId).toBe('q-1');
  });
});

describe('TypographerQueueRowNoir', () => {
  it('skips the render when the parent re-renders with unchanged row data', async () => {
    const harness = mountHarness(
      (props) => <TypographerQueueRowNoir {...props} />,
      memoRuntime(TypographerQueueRowNoir),
    );
    expect(harness.renders()).toBe(1);
    await harness.click('tick');
    expect(harness.renders()).toBe(1);
    await harness.click('tick');
    expect(harness.renders()).toBe(1);
  });

  it('re-renders only when the item data, selection or index changes', async () => {
    const harness = mountHarness(
      (props) => <TypographerQueueRowNoir {...props} />,
      memoRuntime(TypographerQueueRowNoir),
    );
    expect(harness.renders()).toBe(1);
    await harness.click('change-item');
    expect(harness.renders()).toBe(2);
    await harness.click('select');
    expect(harness.renders()).toBe(3);
    await harness.click('move');
    expect(harness.renders()).toBe(4);
    await harness.click('tick');
    expect(harness.renders()).toBe(4);
  });

  it('keeps the row DOM contract and reports the clicked item id', async () => {
    let capturedId: string | null = null;
    const { view } = mountHarness(
      (props) => (
        <TypographerQueueRowNoir {...props} onSelect={(id) => { capturedId = id; }} />
      ),
      memoRuntime(TypographerQueueRowNoir),
      item({ status: 'skipped', text: 'Second line' }),
      true,
    );
    const row = view.getByRole('listitem');
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Second line')).toBeTruthy();
    await act(async () => {
      fireEvent.click(row);
    });
    expect(capturedId).toBe('q-1');
  });
});
