// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  DockToolAnimatedPreview,
  type DockToolPreviewKind,
} from "./DockToolAnimatedPreview";

let mockReducedMotion = false;

vi.mock("framer-motion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

const ALL_KINDS: readonly DockToolPreviewKind[] = [
  "config",
  "area-select",
  "clear-page",
  "segment-brush",
  "segment-eraser",
  "paint",
  "paint-eraser",
  "magic-wand",
  "healing",
  "clear-paint",
  "reset-edits",
];

afterEach(() => {
  mockReducedMotion = false;
  cleanup();
});

describe("DockToolAnimatedPreview", () => {
  it("renders a dedicated manga-panel SVG for every dock tool in noir and classic variants", () => {
    for (const kind of ALL_KINDS) {
      for (const variant of ["noir", "classic"] as const) {
        const { container, unmount } = render(
          <DockToolAnimatedPreview kind={kind} variant={variant} label={kind} />,
        );
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute("viewBox")).toBe("0 0 220 116");
        expect(container.querySelector(`[data-preview-kind="${kind}"]`)).not.toBeNull();
        unmount();
      }
    }
  });

  it("pauses animations when prefers-reduced-motion is enabled", () => {
    mockReducedMotion = true;
    const { container } = render(
      <DockToolAnimatedPreview kind="healing" variant="noir" />,
    );
    const wrapper = container.querySelector('[data-preview-kind="healing"]');
    expect(wrapper?.getAttribute("data-reduced-motion")).toBe("true");
    expect(wrapper?.className).toContain("koma-dock-svg--paused");
  });
});
