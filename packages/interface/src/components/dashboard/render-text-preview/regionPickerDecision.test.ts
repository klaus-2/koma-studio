import { describe, expect, it } from 'vitest';

import { shouldOpenRegionPicker } from './regionPickerDecision';

describe('shouldOpenRegionPicker', () => {
  it('opens when several regions are hit and the topmost is not selected', () => {
    expect(shouldOpenRegionPicker(2, 'region-b', 'region-a', false)).toBe(true);
  });

  it('does not open when the topmost region is already selected', () => {
    expect(shouldOpenRegionPicker(2, 'region-b', 'region-b', false)).toBe(false);
  });

  it('never opens on a Ctrl/Cmd multi-select click', () => {
    expect(shouldOpenRegionPicker(3, 'region-b', 'region-a', true)).toBe(false);
  });

  it('does not open for a single hit', () => {
    expect(shouldOpenRegionPicker(1, 'region-a', null, false)).toBe(false);
    expect(shouldOpenRegionPicker(0, undefined, null, false)).toBe(false);
  });
});
