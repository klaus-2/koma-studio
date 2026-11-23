import { describe, expect, it } from 'vitest';

import { isPreviousManualStageFinished } from './manual-stage-gate';

describe('isPreviousManualStageFinished', () => {
  it('is true once Detect Text finished, even with zero regions', () => {
    expect(isPreviousManualStageFinished(1, { detectText: 'done' })).toBe(true);
  });

  it('is true when the previous stage was skipped', () => {
    expect(isPreviousManualStageFinished(2, { recognizeText: 'skipped' })).toBe(true);
  });

  it('is false while the previous stage has not run', () => {
    expect(isPreviousManualStageFinished(1, { detectText: 'pending' })).toBe(false);
    expect(isPreviousManualStageFinished(1, {})).toBe(false);
  });

  it('is false for the first stage', () => {
    expect(isPreviousManualStageFinished(0, { detectText: 'done' })).toBe(false);
  });
});
