import { describe, expect, it, vi } from 'vitest';

import { createBatchLiveStageTracker } from './aio-live-stage-advance';

type Page = { id: string };

const page = (id: string): Page => ({ id });

describe('createBatchLiveStageTracker', () => {
  it('advances the canvas once per stage change, not on every progress poll', () => {
    const advance = vi.fn();
    const track = createBatchLiveStageTracker(advance);
    const image = page('img-1');

    track('detectText', image);
    track('detectText', image);
    track('recognizeText', image);
    track('recognizeText', image);
    track('getTranslations', image);

    expect(advance.mock.calls.map(([stage]) => stage)).toEqual([
      'detectText',
      'recognizeText',
      'getTranslations',
    ]);
  });

  it('tracks each page on its own', () => {
    const advance = vi.fn();
    const track = createBatchLiveStageTracker(advance);

    track('detectText', page('img-1'));
    track('detectText', page('img-2'));
    track('detectText', page('img-1'));

    expect(advance).toHaveBeenCalledTimes(2);
    expect(advance.mock.calls.map(([, image]) => image.id)).toEqual(['img-1', 'img-2']);
  });
});
