import { describe, expect, it } from 'vitest';

import { resolveCloudPreviewPosition } from './aio-cloud-preview-position';

const anchor = { left: 1300, top: 820, bottom: 870, width: 340 };

describe('resolveCloudPreviewPosition', () => {
  it('places the popover outside the tools panel, on its left edge', () => {
    const panel = { left: 1280, top: 0, bottom: 900, width: 380 };
    expect(resolveCloudPreviewPosition(anchor, panel, 1660, 900)).toEqual({
      placement: 'side',
      right: 392,
      width: 420,
      bottom: 30,
    });
  });

  it('shrinks to the room left of the panel', () => {
    const panel = { left: 350, top: 0, bottom: 900, width: 380 };
    const position = resolveCloudPreviewPosition(anchor, panel, 730, 900);
    expect(position.placement).toBe('side');
    expect(position.width).toBe(326);
  });

  it('falls back to above the anchor when there is no room beside the panel', () => {
    const panel = { left: 200, top: 0, bottom: 900, width: 380 };
    expect(resolveCloudPreviewPosition(anchor, panel, 580, 900)).toEqual({
      placement: 'above',
      left: 1300,
      width: 340,
      bottom: 90,
    });
  });

  it('falls back to above the anchor without a tools panel', () => {
    expect(resolveCloudPreviewPosition(anchor, null, 1660, 900).placement).toBe('above');
  });
});
