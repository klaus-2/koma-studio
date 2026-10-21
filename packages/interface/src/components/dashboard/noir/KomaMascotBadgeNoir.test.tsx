// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KOMA_CAT_FRAMES } from '@/assets/koma-cat';
import { KomaMascotBadgeNoir } from '@/components/dashboard/noir/KomaMascotBadgeNoir';

afterEach(cleanup);

function renderBadge() {
  const utils = render(<KomaMascotBadgeNoir />);
  const image = utils.container.querySelector("img");
  if (!image) {
    throw new Error("badge image not rendered");
  }
  return { ...utils, image, source: () => utils.container.querySelector("img")?.getAttribute("src") };
}

describe("KOMA mascot badge", () => {
  it("shows one of the mascot frames", () => {
    const { source } = renderBadge();

    expect(KOMA_CAT_FRAMES).toContain(source());
    expect(source()).toBe(KOMA_CAT_FRAMES[0]);
  });

  it("picks a different pose on every mouse pass", async () => {
    const user = userEvent.setup();
    const { image, source } = renderBadge();
    const before = source();

    await user.hover(image);

    expect(source()).not.toBe(before);
    expect(KOMA_CAT_FRAMES).toContain(source());
  });

  it("picks a random pose once a minute", () => {
    vi.useFakeTimers();
    try {
      const { source } = renderBadge();
      const before = source();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(source()).not.toBe(before);
      expect(KOMA_CAT_FRAMES).toContain(source());
    } finally {
      vi.useRealTimers();
    }
  });
});
