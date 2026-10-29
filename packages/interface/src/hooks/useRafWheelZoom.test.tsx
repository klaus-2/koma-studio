import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRafWheelZoom } from "./useRafWheelZoom";

describe("useRafWheelZoom", () => {
  let rafQueue: Array<(time: number) => void>;

  beforeEach(() => {
    rafQueue = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mountHook = (flushDeltas: (deltas: readonly number[]) => void) => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    renderHook(() => useRafWheelZoom(() => target, flushDeltas, null));
    return target;
  };

  it("coalesces a wheel burst into one flush per frame", () => {
    const flush = vi.fn();
    const target = mountHook(flush);

    for (const deltaY of [-120, -100, 80]) {
      target.dispatchEvent(
        new WheelEvent("wheel", { deltaY, ctrlKey: true, cancelable: true }),
      );
    }

    expect(flush).not.toHaveBeenCalled();
    expect(rafQueue).toHaveLength(1);

    act(() => {
      rafQueue.splice(0).forEach((callback) => callback(0));
    });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([-120, -100, 80]);
  });

  it("ignores plain wheel scrolling", () => {
    const flush = vi.fn();
    const target = mountHook(flush);

    target.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 120, cancelable: true }),
    );

    expect(rafQueue).toHaveLength(0);
    expect(flush).not.toHaveBeenCalled();
  });

  it("preventDefaults the zoom gesture", () => {
    const flush = vi.fn();
    const target = mountHook(flush);

    const event = new WheelEvent("wheel", {
      deltaY: -120,
      ctrlKey: true,
      cancelable: true,
    });
    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
