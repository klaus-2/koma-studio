import { describe, expect, it } from 'vitest';

import { mergeSnapshotRegionsForEdit } from '@/pages/dashboard/hooks/region-editor.snapshot';
import type { AioTextRegion } from '@/types/dashboard.types';

const region = (id: string, patch: Partial<AioTextRegion> = {}): AioTextRegion => ({
  id,
  bbox: [10, 10, 110, 60],
  score: 0.9,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
  ...patch,
});

describe('mergeSnapshotRegionsForEdit', () => {
  it('patches the snapshot when the edit removes every region', () => {
    const result = mergeSnapshotRegionsForEdit([region('a')], []);

    expect(result.changed).toBe(true);
    expect(result.regions).toEqual([]);
  });

  it('patches the snapshot when the edit removes one region from a list', () => {
    const first = region('a');
    const second = region('b');

    const result = mergeSnapshotRegionsForEdit([first, second], [first]);

    expect(result.changed).toBe(true);
    expect(result.regions.map((entry) => entry.id)).toEqual(['a']);
  });

  it('keeps region identities when the edit does not change the list', () => {
    const first = region('a');
    const second = region('b');

    const result = mergeSnapshotRegionsForEdit([first, second], [first, second]);

    expect(result.changed).toBe(false);
    expect(result.regions[0]).toBe(first);
    expect(result.regions[1]).toBe(second);
  });

  it('merges a new region and reports the list change', () => {
    const first = region('a');
    const added = region('b');

    const result = mergeSnapshotRegionsForEdit([first], [first, added]);

    expect(result.changed).toBe(true);
    expect(result.regions.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('reports a field edit on an existing region', () => {
    const original = region('a');
    const edited = region('a', { recognizedText: 'hello' });

    const result = mergeSnapshotRegionsForEdit([original], [edited]);

    expect(result.changed).toBe(true);
    expect(result.regions[0]?.recognizedText).toBe('hello');
  });
});
