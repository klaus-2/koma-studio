import { Suspense, lazy } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeStore } from "@koma/ui/stores/theme-store";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import { I18nProvider } from "../../i18n";
import { PanelBoundary } from "./PanelBoundary";

let failRender = true;

const FlakyPanel = () => {
  if (failRender) throw new Error("boom in the tools panel");
  return <p>tools restored</p>;
};

const renderPanel = (label: string) =>
  render(
    <I18nProvider>
      <PanelBoundary label={label}>
        <FlakyPanel />
      </PanelBoundary>
    </I18nProvider>,
  );

const ModePanel = ({ mode }: { mode: string }) => {
  if (mode === "AIO") throw new Error("boom in AIO");
  return <p>{mode} healthy</p>;
};

const modeTree = (mode: string) => (
  <I18nProvider>
    <PanelBoundary label={mode}>
      <ModePanel mode={mode} />
    </PanelBoundary>
  </I18nProvider>
);

const resetKeyTree = (content: string) => (
  <I18nProvider>
    <PanelBoundary label="Workspace and visual preview" resetKey={content}>
      <ModePanel mode={content} />
    </PanelBoundary>
  </I18nProvider>
);

const unavailableChunk = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

const renderLazyPanel = () => {
  const Gone = lazy(unavailableChunk);
  return render(
    <I18nProvider>
      <PanelBoundary label="Tools">
        <Suspense fallback={<p>loading</p>}>
          <Gone />
        </Suspense>
      </PanelBoundary>
    </I18nProvider>,
  );
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  failRender = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PanelBoundary", () => {
  it("renders its children while they are healthy", () => {
    useThemeStore.setState({ family: "classic" });
    failRender = false;
    renderPanel("Tools");

    expect(screen.getByText("tools restored")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("isolates a panel crash behind a labelled alert in the classic skin", () => {
    useThemeStore.setState({ family: "classic" });
    const { container } = renderPanel("Tools");

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-label")).toBe("Tools");
    expect(container.querySelector(".koma-error-boundary--compact")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload the app" })).toBeNull();
  });

  it("isolates a panel crash behind a labelled alert in the noir skin", () => {
    useThemeStore.setState({ family: "noir" });
    renderPanel("Tools");

    expect(screen.getByRole("alert").getAttribute("aria-label")).toBe("Tools");
    expect(screen.queryByRole("button", { name: "Reload the app" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("remounts only the panel after Try again", () => {
    useThemeStore.setState({ family: "classic" });
    const siblingMounts: string[] = [];
    const Sibling = () => {
      siblingMounts.push("mounted");
      return <p>sibling</p>;
    };
    render(
      <I18nProvider>
        <Sibling />
        <PanelBoundary label="Tools">
          <FlakyPanel />
        </PanelBoundary>
      </I18nProvider>,
    );
    const mountsAfterCrash = siblingMounts.length;
    expect(mountsAfterCrash).toBeGreaterThan(0);

    failRender = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("tools restored")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(siblingMounts).toHaveLength(mountsAfterCrash);
  });

  it("offers a way out when a lazily loaded chunk fails to load", async () => {
    useThemeStore.setState({ family: "classic" });
    renderLazyPanel();

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Reload the app" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload the app" })).toBeTruthy();
  });

  it("shows the new mode when the user switches away from a crashed panel", () => {
    useThemeStore.setState({ family: "classic" });
    const view = render(modeTree("AIO"));
    expect(screen.getByRole("alert").getAttribute("aria-label")).toBe("AIO");

    view.rerender(modeTree("Cleaner"));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Cleaner healthy")).toBeTruthy();
  });

  it("resets on resetKey when the label alone does not change", () => {
    useThemeStore.setState({ family: "classic" });
    const view = render(resetKeyTree("AIO"));
    expect(screen.getByRole("alert")).toBeTruthy();

    view.rerender(resetKeyTree("Cleaner"));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Cleaner healthy")).toBeTruthy();
  });
});
