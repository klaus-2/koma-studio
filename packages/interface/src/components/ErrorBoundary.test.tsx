// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeStore } from "@koma/ui/stores/theme-store";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

import { I18nProvider } from "../i18n";
import { ErrorBoundary } from "./ErrorBoundary";

const TITLE = "This panel crashed.";
const NOIR_GLYPH = "クラッシュ";

let failRender = true;

const Flaky = () => {
  if (failRender) throw new Error("boom in the panel");
  return <p>panel restored</p>;
};

const renderShell = () =>
  render(
    <I18nProvider>
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    </I18nProvider>,
  );

const renderCompact = (label = "Tools") =>
  render(
    <I18nProvider>
      <ErrorBoundary compact label={label}>
        <Flaky />
      </ErrorBoundary>
    </I18nProvider>,
  );

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

describe("ErrorBoundary fallback", () => {
  it("shows the classic skin for the classic family", () => {
    useThemeStore.setState({ family: "classic" });
    const { container } = renderShell();

    expect(screen.getByRole("alert").textContent).toContain(TITLE);
    expect(container.querySelector(".koma-error-boundary__card")).toBeTruthy();
    expect(screen.queryByText(NOIR_GLYPH)).toBeNull();
  });

  it("shows the noir skin for the noir family", () => {
    useThemeStore.setState({ family: "noir" });
    const { container } = renderShell();

    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(container.querySelector(".panel-cut")).toBeTruthy();
    expect(screen.getByText(NOIR_GLYPH)).toBeTruthy();
  });

  it("mounts the children again after Try again", () => {
    useThemeStore.setState({ family: "classic" });
    renderShell();

    expect(screen.queryByText("panel restored")).toBeNull();

    failRender = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("panel restored")).toBeTruthy();
  });

  it("reveals the captured error text behind the details toggle", () => {
    useThemeStore.setState({ family: "classic" });
    renderShell();

    const toggle = screen.getByRole("button", { name: "Technical details" });
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Hide details" })).toBeTruthy();
    expect(screen.getByText(/boom in the panel/)).toBeTruthy();
  });

  it("labels the compact alert with the panel name", () => {
    useThemeStore.setState({ family: "classic" });
    renderCompact("Tools");

    expect(screen.getByRole("alert").getAttribute("aria-label")).toBe("Tools");
  });

  it("omits the app reload in the compact variant and still recovers", () => {
    useThemeStore.setState({ family: "classic" });
    renderCompact();

    expect(screen.queryByRole("button", { name: "Reload the app" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

    failRender = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("panel restored")).toBeTruthy();
  });

  it("applies the compact class in the compact variant", () => {
    useThemeStore.setState({ family: "classic" });
    const { container } = renderCompact();

    expect(container.querySelector(".koma-error-boundary--compact")).toBeTruthy();
  });

  it("does not attach an aria-label when no panel name is given", () => {
    useThemeStore.setState({ family: "classic" });
    render(
      <I18nProvider>
        <ErrorBoundary compact>
          <Flaky />
        </ErrorBoundary>
      </I18nProvider>,
    );

    expect(screen.getByRole("alert").hasAttribute("aria-label")).toBe(false);
  });
});
