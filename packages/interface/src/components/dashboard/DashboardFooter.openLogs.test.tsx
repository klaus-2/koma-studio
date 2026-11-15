// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { installJsdomBrowserStubs } from "@/components/dashboard/renderTextPreviewTestSetup";
import type { DesktopModelsApi } from "@shared/desktop-api";
import { createDesktopBridgeStub } from "@/testing/desktop-bridge-stub";

import { I18nProvider } from "../../i18n";
import type { DesktopMiniBackendRuntimeState } from "../../types";
import type { RuntimeExecutionNotice } from "../../types/dashboard.types";
import DashboardFooterClassic from "./DashboardFooterClassic";

const NOTICE: RuntimeExecutionNotice = {
  title: "Fallback failed",
  detail: 'Could not finish the "OCR" stage.\n\nRuntime log: C:/logs/mini-backend-runtime.log',
  tone: "legacy",
};

const RUNTIME_STATE: DesktopMiniBackendRuntimeState = {
  status: "ready",
  statusMessage: null,
  requestedProfile: "cpu",
  activeProfile: "cpu",
  source: "bundled-core",
  runtimeArtifactsUrl: null,
  runtimeManifestUrl: null,
  runtimeArchiveUrl: null,
  installDir: null,
  downloadCacheDir: null,
  version: null,
  lastError: null,
  attempt: 1,
  maxAttempts: 1,
  exitCode: null,
  lastStderr: null,
  crashLogPath: null,
  progress: null,
  updatedAt: null,
  gpuName: null,
  vramGb: null,
};

const modelsStub: DesktopModelsApi = {
  listInstalled: async () => [],
  getDiskSpace: async () => ({ freeBytes: 1024**3, totalBytes: 1024**3, path: "mock" }),
  checkUpdates: async () => [],
  download: async () => ({ queued: true, queueLength: 1 }),
  importOnnx: async () => {
    throw new Error("not used in this suite");
  },
  cancel: async () => undefined,
  cancelAll: async () => undefined,
  uninstall: async () => undefined,
  listActive: async () => ({ known: false }),
  on: () => Promise.resolve(true),
  off: () => undefined,
};

const baseProps = {
  openBugReportModal: (): void => undefined,
  openProjectExternalLink: (): void => undefined,
  projectDiscordUrl: "https://discord.example",
  projectWebsiteUrl: "https://example.com",
  miniBackendRuntimeState: RUNTIME_STATE,
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  installJsdomBrowserStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFooter(notice: RuntimeExecutionNotice | null): void {
  render(
    <I18nProvider>
      <DashboardFooterClassic {...baseProps} runtimeExecutionNotice={notice} />
    </I18nProvider>,
  );
}

describe("open-logs-folder action on the runtime notice", () => {
  it("hides the action in web-only state (no shell diagnostics)", () => {
    renderFooter(NOTICE);

    expect(screen.queryByText("Open logs folder")).toBeNull();
  });

  it("reveals the action and calls the shell command when diagnostics exist", async () => {
    const openLogsFolder = vi.fn(async () => ({ opened: true, path: "C:/logs" }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { diagnostics: { openLogsFolder } }),
      isDesktopRuntime: () => true,
    });
    renderFooter(NOTICE);

    const button = screen.getByText("Open logs folder");
    expect(button).toBeDefined();
    fireEvent.click(button);

    await waitFor(() => {
      expect(openLogsFolder).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces an error status when the shell command rejects", async () => {
    const openLogsFolder = vi.fn(async () => {
      throw new Error("shell unavailable");
    });
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { diagnostics: { openLogsFolder } }),
      isDesktopRuntime: () => true,
    });
    renderFooter(NOTICE);

    fireEvent.click(screen.getByText("Open logs folder"));

    await waitFor(() => {
      expect(screen.getByText("Could not open the logs folder.")).toBeDefined();
    });
  });

  it("surfaces an error status when the shell reports a failed reveal", async () => {
    const openLogsFolder = vi.fn(async () => ({ opened: false, path: "C:/logs" }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { diagnostics: { openLogsFolder } }),
      isDesktopRuntime: () => true,
    });
    renderFooter(NOTICE);

    fireEvent.click(screen.getByText("Open logs folder"));

    await waitFor(() => {
      expect(screen.getByText("Could not open the logs folder.")).toBeDefined();
    });
  });
});
