// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createFamilyComponent } from "@koma/ui/themes/family-skins";
import { useThemeStore } from "@koma/ui/stores/theme-store";

import type { FunctionComponent } from "react";

// jsdom lacks window.matchMedia; the real theme store calls it once at module
// load (detectInitialTheme). Stub it before the module body runs, then load
// the actual store so the seam is tested against the genuine implementation.
vi.mock("@koma/ui/stores/theme-store", async (importOriginal) => {
  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
  return importOriginal();
});

const ClassicTwin: FunctionComponent<{ tag: string }> = ({ tag }) => (
  <div>classic-skin:{tag}</div>
);

const NoirTwin: FunctionComponent<{ tag: string }> = ({ tag }) => (
  <div>noir-skin:{tag}</div>
);

const Facade = createFamilyComponent(ClassicTwin, NoirTwin);

beforeEach(() => {
  useThemeStore.setState({ family: "classic" });
});

afterEach(cleanup);

describe("createFamilyComponent", () => {
  it("renders the classic twin for the classic family", () => {
    render(<Facade tag="a" />);

    expect(screen.getByText("classic-skin:a")).toBeTruthy();
  });

  it("re-renders to the noir twin when the store family switches", () => {
    render(<Facade tag="a" />);

    expect(screen.getByText("classic-skin:a")).toBeTruthy();

    // The useThemeStore subscription lives INSIDE the returned component, so
    // the facade re-renders on a family change without an outer rerender().
    act(() => {
      useThemeStore.setState({ family: "noir" });
    });

    expect(screen.getByText("noir-skin:a")).toBeTruthy();
    expect(screen.queryByText("classic-skin:a")).toBeNull();
  });

  it("passes props through untouched to whichever twin is active", () => {
    render(<Facade tag="b" />);

    expect(screen.getByText("classic-skin:b")).toBeTruthy();

    act(() => {
      useThemeStore.setState({ family: "noir" });
    });

    expect(screen.getByText("noir-skin:b")).toBeTruthy();
  });
});
