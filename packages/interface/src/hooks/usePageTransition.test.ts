import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePageTransition } from "./usePageTransition";

interface FakeTransition {
  finished: Promise<void>;
}

type StartViewTransition = (callback: () => void | Promise<void>) => FakeTransition;

const setReducedMotion = (matches: boolean): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matches && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
};

const setStartViewTransition = (value: StartViewTransition | undefined): void => {
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value,
  });
};

describe("usePageTransition.runNavigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    setStartViewTransition(undefined);
  });

  it("invokes startViewTransition as a document method and never raises the overlay", () => {
    let calledOnDocument = false;
    const startViewTransition = vi.fn(function (
      this: unknown,
      callback: () => void | Promise<void>,
    ): FakeTransition {
      if (this !== document) {
        throw new TypeError("Illegal invocation");
      }
      calledOnDocument = true;
      void callback();
      return { finished: Promise.resolve() };
    });
    setStartViewTransition(startViewTransition);
    const update = vi.fn();

    const { result } = renderHook(() => usePageTransition({ minDuration: 150 }));
    act(() => {
      result.current.runNavigation(update, "Loading");
    });

    expect(calledOnDocument).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.current.isActive).toBe(false);
  });

  it("commits immediately without a transition when reduced motion is requested", () => {
    setReducedMotion(true);
    const startViewTransition = vi.fn();
    setStartViewTransition(startViewTransition);
    const update = vi.fn();

    const { result } = renderHook(() => usePageTransition({ minDuration: 150 }));
    act(() => {
      result.current.runNavigation(update, "Loading");
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });

  it("falls back to a short overlay when native transitions are unavailable", () => {
    setStartViewTransition(undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const update = vi.fn();

    const { result } = renderHook(() => usePageTransition({ minDuration: 150 }));
    act(() => {
      result.current.runNavigation(update, "Loading");
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(result.current.isActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.isActive).toBe(false);
  });
});
