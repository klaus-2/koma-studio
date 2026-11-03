import { createElement, type ReactNode } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  UpdaterChannel,
  UpdaterEventPayload,
  UpdaterListener,
  UpdaterStatusPayload,
} from "@shared/desktop-events";

import { UpdaterProvider, useUpdater } from "./useUpdater";
import VersionBadgeNoir from "../components/noir/VersionBadgeNoir";
import VersionBadgeClassic from "../components/VersionBadgeClassic";

interface GithubReleaseJson {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

type ReleaseResponse = {
  ok: true;
  json: () => Promise<GithubReleaseJson>;
};

const LATEST_RELEASE: GithubReleaseJson = {
  tag_name: "v1.1.0",
  name: "KOMA Studio 1.1.0",
  body: "notas",
  html_url: "https://github.com/klaus-2/koma-studio/releases/tag/v1.1.0",
  draft: false,
  prerelease: false,
};

const storageMap = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string): string | null => storageMap.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storageMap.set(key, value);
    },
    removeItem: (key: string): void => {
      storageMap.delete(key);
    },
    clear: (): void => {
      storageMap.clear();
    },
  },
});

const getAppVersionMock = vi.fn<() => string | null>(() => null);
const fetchReleaseMock = vi.fn<() => Promise<ReleaseResponse>>();

type BridgeStateMock = ReturnType<
  typeof vi.fn<() => Promise<UpdaterStatusPayload | null>>
>;
type BridgeDownloadMock = ReturnType<
  typeof vi.fn<(payload: { channel: UpdaterChannel }) => Promise<void>>
>;
type BridgeInstallMock = ReturnType<typeof vi.fn<() => Promise<void>>>;
type BridgeOnMock = ReturnType<
  typeof vi.fn<(listener: UpdaterListener) => () => void>
>;

interface TestUpdaterBridge {
  getState: BridgeStateMock;
  download: BridgeDownloadMock;
  install: BridgeInstallMock;
  on: BridgeOnMock;
  emit: (payload: UpdaterEventPayload) => void;
}

const buildBridgeState = (patch: Partial<UpdaterStatusPayload>): UpdaterStatusPayload => ({
  status: "idle",
  currentVersion: "1.0.9",
  newVersion: null,
  mandatory: false,
  blocking: false,
  blockingReason: null,
  releaseNotes: null,
  channel: "stable",
  provider: "github",
  autoInstallOnQuit: true,
  allowPrerelease: false,
  progress: null,
  checkedAt: null,
  downloadedAt: null,
  error: null,
  ...patch,
});

const updaterBridgeRef = vi.hoisted(() => ({
  current: null as ReturnType<typeof createTestUpdaterBridge> | null,
}));

const openExternalMock = vi.hoisted(() =>
  vi.fn<(url: string) => Promise<void>>(async () => undefined),
);

function createTestUpdaterBridge(): TestUpdaterBridge {
  const listeners = new Set<UpdaterListener>();
  return {
    getState: vi.fn<() => Promise<UpdaterStatusPayload | null>>(async () => null),
    download: vi.fn<(payload: { channel: UpdaterChannel }) => Promise<void>>(
      async () => undefined,
    ),
    install: vi.fn<() => Promise<void>>(async () => undefined),
    on: vi.fn<(listener: UpdaterListener) => () => void>((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    emit: (payload: UpdaterEventPayload): void => {
      listeners.forEach((listener) => {
        listener(payload);
      });
    },
  };
}

vi.mock("../config/desktopClient", () => ({
  getDesktopAppVersion: () => getAppVersionMock(),
  getDesktopUpdatePolicyHeaders: () => ({}),
}));

vi.mock("../i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("../utils/http", () => ({
  fetchWithTimeoutAndRetry: () => fetchReleaseMock(),
}));

vi.mock("@/lib/desktop-bridge", () => ({
  desktopBridge: {
    isDesktopRuntime: () => true,
    desktop: {
      openExternal: openExternalMock,
    },
    get updater() {
      return updaterBridgeRef.current;
    },
  },
}));

const UpdaterWrapper = ({ children }: { children: ReactNode }) =>
  createElement(UpdaterProvider, null, children);

const renderUpdater = () => renderHook(() => useUpdater(), { wrapper: UpdaterWrapper });

type UpdaterResult = ReturnType<typeof renderUpdater>["result"];

const checkForUpdate = async (): Promise<UpdaterResult> => {
  const view = renderUpdater();
  await act(async () => {
    await view.result.current.checkForUpdates();
  });
  return view.result;
};

describe("useUpdater", () => {
  beforeEach(() => {
    getAppVersionMock.mockReset();
    fetchReleaseMock.mockReset();
    fetchReleaseMock.mockResolvedValue({ ok: true, json: async () => LATEST_RELEASE });
    updaterBridgeRef.current = null;
    openExternalMock.mockClear();
    window.localStorage.clear();
  });

  it("defaults to the stable channel for a prerelease shell version", () => {
    getAppVersionMock.mockReturnValue("2.0.0-alpha.3");

    const view = renderUpdater();

    expect(view.result.current.channel).toBe("stable");
  });

  it("does not offer a stale stable release to a prerelease install on the default channel", async () => {
    getAppVersionMock.mockReturnValue("2.0.0-alpha.3");

    const result = await checkForUpdate();

    expect(result.current.channel).toBe("stable");
    expect(result.current.status).toBe("not-available");
    expect(result.current.newVersion).toBeNull();
  });

  it("offers the stable release when stable is chosen explicitly on a prerelease install", async () => {
    getAppVersionMock.mockReturnValue("2.0.0-alpha.3");
    const view = renderUpdater();

    await act(async () => {
      await view.result.current.setChannel("stable");
    });

    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(view.result.current.channel).toBe("stable");
    expect(view.result.current.status).toBe("available");
    expect(view.result.current.newVersion).toBe("1.1.0");
  });

  it("performs no fetch and never reaches 'available' without a shell version", async () => {
    getAppVersionMock.mockReturnValue(null);
    const result = await checkForUpdate();

    expect(fetchReleaseMock).toHaveBeenCalledTimes(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.currentVersion).toBeNull();
    expect(result.current.newVersion).toBeNull();
  });

  it("reports 'not-available' when the shell version equals the latest release", async () => {
    getAppVersionMock.mockReturnValue("1.1.0");
    const result = await checkForUpdate();

    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(result.current.currentVersion).toBe("1.1.0");
    expect(result.current.status).toBe("not-available");
    expect(result.current.newVersion).toBeNull();
  });

  it("reports 'available' when the latest release is newer than the shell version", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const result = await checkForUpdate();

    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("available");
    expect(result.current.newVersion).toBe("1.1.0");
  });

  it("opens the release page when no installer updater bridge exists", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    expect(view.result.current.autoInstallSupported).toBe(false);

    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    expect(openExternalMock).toHaveBeenCalledWith(
      "https://github.com/klaus-2/koma-studio/releases/tag/v1.1.0",
    );
    expect(view.result.current.status).toBe("available");
  });

  it("downloads through the installer bridge and tracks progress events", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    expect(view.result.current.autoInstallSupported).toBe(true);

    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    expect(bridge.download).toHaveBeenCalledWith({ channel: "stable" });
    expect(view.result.current.status).toBe("downloading");

    await act(async () => {
      bridge.emit({
        event: "progress",
        state: buildBridgeState({
          status: "downloading",
          progress: { percent: 42.4, transferred: 10, total: 100, speed: 5 },
        }),
      });
    });

    expect(view.result.current.status).toBe("downloading");
    expect(view.result.current.progress.percent).toBe(42.4);
    expect(view.result.current.progress.transferred).toBe(10);
  });

  it("auto-installs when the download completes", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    await act(async () => {
      bridge.emit({
        event: "downloaded",
        state: buildBridgeState({
          status: "downloaded",
          downloadedAt: 123,
          progress: { percent: 100, transferred: 100, total: 100, speed: 0 },
        }),
      });
    });

    expect(view.result.current.status).toBe("downloaded");
    expect(view.result.current.downloadedAt).toBe(123);
    expect(bridge.install).toHaveBeenCalledTimes(1);
  });

  it("keeps manual checks informational during the download lifecycle", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    const fetchCallsAfterDownload = fetchReleaseMock.mock.calls.length;
    await act(async () => {
      await view.result.current.checkForUpdates();
    });

    expect(fetchReleaseMock.mock.calls.length).toBeGreaterThan(fetchCallsAfterDownload);
    expect(view.result.current.status).toBe("downloading");
  });

  it("skips background GitHub checks during the download lifecycle", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;
    vi.useFakeTimers();
    try {
      const view = renderUpdater();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });
      await act(async () => {
        await view.result.current.downloadUpdate();
      });

      const fetchCallsAfterDownload = fetchReleaseMock.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8 * 60_000);
      });

      expect(fetchReleaseMock.mock.calls.length).toBe(fetchCallsAfterDownload);
      expect(view.result.current.status).toBe("downloading");
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces a bridge download rejection as an error state", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    bridge.download.mockRejectedValueOnce(new Error("feed unavailable"));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    expect(view.result.current.status).toBe("error");
    expect(view.result.current.error).toBe("Failed to download the update: feed unavailable");
  });

  it("adopts the download lifecycle state from the bridge on hydration", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(
      buildBridgeState({
        status: "downloading",
        progress: { percent: 12, transferred: 1, total: 8, speed: 2 },
      }),
    );
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {});

    expect(view.result.current.autoInstallSupported).toBe(true);
    expect(view.result.current.status).toBe("downloading");
    expect(view.result.current.progress.percent).toBe(12);
  });

  it("resumes auto-install when hydration adopts a downloaded update", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(
      buildBridgeState({
        status: "downloaded",
        downloadedAt: 7,
        progress: { percent: 100, transferred: 9, total: 9, speed: 0 },
      }),
    );
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {});

    expect(view.result.current.status).toBe("downloaded");
    expect(bridge.install).toHaveBeenCalledTimes(1);
  });

  it("does not adopt availability state from the bridge on hydration", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(
      buildBridgeState({ status: "available", newVersion: "9.9.9" }),
    );
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {});

    expect(view.result.current.autoInstallSupported).toBe(true);
    expect(view.result.current.status).toBe("idle");
    expect(view.result.current.newVersion).toBeNull();
  });

  it("surfaces an auto-install rejection as an error state", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    bridge.install.mockRejectedValueOnce(new Error("no installer"));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    await act(async () => {
      bridge.emit({
        event: "downloaded",
        state: buildBridgeState({
          status: "downloaded",
          downloadedAt: 123,
        }),
      });
    });

    expect(view.result.current.status).toBe("error");
    expect(view.result.current.error).toBe("Failed to install the update: no installer");
  });

  it("ignores stale installer errors outside the download lifecycle", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });

    await act(async () => {
      bridge.emit({
        event: "error",
        state: buildBridgeState({ status: "error", error: "stale" }),
      });
    });

    expect(view.result.current.status).toBe("available");
  });

  it("maps installer errors during a download to the error state", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.downloadUpdate();
    });

    await act(async () => {
      bridge.emit({
        event: "error",
        state: buildBridgeState({ status: "error", error: "network down" }),
      });
    });

    expect(view.result.current.status).toBe("error");
    expect(view.result.current.error).toBe("network down");
  });

  it("renders no version badge without a shell version", () => {
    getAppVersionMock.mockReturnValue(null);
    const badges = render(
      createElement(UpdaterWrapper, null,
        createElement(VersionBadgeNoir),
        createElement(VersionBadgeClassic)),
    );

    expect(badges.container).toBeEmptyDOMElement();
  });

  it("renders the shell version in both badges", () => {
    getAppVersionMock.mockReturnValue("1.1.0");
    const badges = render(
      createElement(UpdaterWrapper, null,
        createElement(VersionBadgeNoir),
        createElement(VersionBadgeClassic)),
    );

    expect(badges.container.textContent).toBe("v1.1.0v1.1.0");
  });

  it("stops the periodic check chain after unmount", async () => {
    getAppVersionMock.mockReturnValue("1.0.0");
    vi.useFakeTimers();
    try {
      const inFlight: { resolve: ((value: ReleaseResponse) => void) | null } = {
        resolve: null,
      };
      fetchReleaseMock.mockReset();
      fetchReleaseMock.mockImplementation(
        () => new Promise<ReleaseResponse>((resolve) => { inFlight.resolve = resolve; }),
      );

      const view = renderUpdater();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });
      expect(fetchReleaseMock.mock.calls.length).toBe(1);

      view.unmount();
      const resolveInFlight = inFlight.resolve;
      if (!resolveInFlight) throw new Error("periodic check did not start");
      await act(async () => {
        resolveInFlight({ ok: true, json: async () => LATEST_RELEASE });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000);
      });
      expect(fetchReleaseMock.mock.calls.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
