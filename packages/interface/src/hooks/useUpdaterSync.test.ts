import { describe, expect, it } from 'vitest';

import {
  createInitialUpdaterSyncState,
  type UpdaterSyncState,
} from '@shared/updaterSync';
import { updaterSyncStateEquivalent } from './useUpdaterSync';

const stateWith = (overrides: Partial<UpdaterSyncState>): UpdaterSyncState => ({
  ...createInitialUpdaterSyncState(),
  ...overrides,
});

describe('updaterSyncStateEquivalent', () => {
  it('dedupes an identical re-emission', () => {
    const state = stateWith({
      phase: 'running',
      logLines: ['a', 'b', 'c'],
      steps: [{ id: 'build', state: 'running' }],
    });
    expect(updaterSyncStateEquivalent(state, { ...state })).toBe(true);
  });

  it('does not dedupe an append within the cap (length changes)', () => {
    const left = stateWith({ logLines: ['a', 'b'] });
    const right = stateWith({ logLines: ['a', 'b', 'c'] });
    expect(updaterSyncStateEquivalent(left, right)).toBe(false);
  });

  it('does not dedupe a rolling append at saturation (first line rotates out)', () => {
    const left = stateWith({ logLines: ['a', 'b', 'c'] });
    const right = stateWith({ logLines: ['b', 'c', 'd'] });
    expect(updaterSyncStateEquivalent(left, right)).toBe(false);
  });

  it('does not dedupe when dirty files swap at constant length', () => {
    const left = stateWith({ dirtyFiles: ['a.ts', 'b.ts'] });
    const right = stateWith({ dirtyFiles: ['a.ts', 'c.ts'] });
    expect(updaterSyncStateEquivalent(left, right)).toBe(false);
  });

  it('does not dedupe when a step transitions', () => {
    const left = stateWith({ steps: [{ id: 'build', state: 'running' }] });
    const right = stateWith({ steps: [{ id: 'build', state: 'ok' }] });
    expect(updaterSyncStateEquivalent(left, right)).toBe(false);
  });
});
