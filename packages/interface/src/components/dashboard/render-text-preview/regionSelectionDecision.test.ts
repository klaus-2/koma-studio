import { describe, expect, it } from 'vitest';

import { decideRegionSelectionClick } from './regionSelectionDecision';

const baseArgs = {
  multiSelectToggleAvailable: true,
  areaSelectionEnabled: true,
  hitCount: 1,
  topmostRegionId: 'region-a',
  selectedRegionId: null,
};

describe('decideRegionSelectionClick', () => {
  it('toggles the multi-selection on a shift+click like Ctrl/Cmd already do', () => {
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        modifiers: { shift: true, ctrl: false, meta: false },
      }),
    ).toBe('multi-toggle');
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        modifiers: { shift: false, ctrl: true, meta: false },
      }),
    ).toBe('multi-toggle');
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        modifiers: { shift: false, ctrl: false, meta: true },
      }),
    ).toBe('multi-toggle');
  });

  it('never opens the region picker while shift is held (picker excludes all multi-select modifiers)', () => {
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        hitCount: 2,
        topmostRegionId: 'region-b',
        modifiers: { shift: true, ctrl: false, meta: false },
      }),
    ).toBe('multi-toggle');
  });

  it('keeps the picker behavior for plain clicks over several regions', () => {
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        hitCount: 2,
        topmostRegionId: 'region-b',
        modifiers: { shift: false, ctrl: false, meta: false },
      }),
    ).toBe('open-picker');
  });

  it('selects the topmost region for a plain single-hit click', () => {
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        modifiers: { shift: false, ctrl: false, meta: false },
      }),
    ).toBe('select');
  });

  it('falls through to a plain select when no multi-select toggle is wired', () => {
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        multiSelectToggleAvailable: false,
        modifiers: { shift: true, ctrl: false, meta: false },
      }),
    ).toBe('select');
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        multiSelectToggleAvailable: false,
        hitCount: 2,
        topmostRegionId: 'region-b',
        modifiers: { shift: true, ctrl: false, meta: false },
      }),
    ).toBe('select');
  });

  it('falls through to a plain select when area selection is disabled', () => {
    expect(
      decideRegionSelectionClick({
        ...baseArgs,
        areaSelectionEnabled: false,
        modifiers: { shift: false, ctrl: true, meta: false },
      }),
    ).toBe('select');
  });
});
