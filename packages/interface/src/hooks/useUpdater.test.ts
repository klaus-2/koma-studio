import { createElement, type ReactNode } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  UpdaterChannel,
  UpdaterEventPayload,
  UpdaterListener,
  UpdaterStatusPayload,
} from "@shared/desktop-events";

import { UpdaterProvider, compareVersions, useUpdater, useUpdaterProgress } from "./useUpdater";
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
  ok: boolean;
  json: () => Promise<unknown>;
};

const LATEST_RELEASE: GithubReleaseJson = {
  tag_name: "v1.1.0",
  name: "KOMA Studio 1.1.0",
  body: "notas",
  html_url: "https://github.com/klaus-2/koma-studio/releases/tag/v1.1.0",
  draft: false,
  prerelease: false,
};

const buildListedRelease = (tag: string): GithubReleaseJson => ({
  tag_name: tag,
  name: `KOMA Studio ${tag}`,
  body: "notas",
  html_url: `https://github.com/klaus-2/koma-studio/releases/tag/${tag}`,
  draft: false,
  prerelease: tag.includes("beta") || tag.startsWith("runtime-"),
});

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

const renderUpdater = () => renderHook(() => ({ api: useUpdater(), progress: useUpdaterProgress() }), { wrapper: UpdaterWrapper });

type UpdaterResult = ReturnType<typeof renderUpdater>["result"];

const checkForUpdate = async (): Promise<UpdaterResult> => {
  const view = renderUpdater();
  await act(async () => {
    await view.result.current.api.checkForUpdates();
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

    expect(view.result.current.api.channel).toBe("stable");
  });

  it("does not offer a stale stable release to a prerelease install on the default channel", async () => {
    getAppVersionMock.mockReturnValue("2.0.0-alpha.3");

    const result = await checkForUpdate();

    expect(result.current.api.channel).toBe("stable");
    expect(result.current.api.status).toBe("not-available");
    expect(result.current.api.newVersion).toBeNull();
  });

  it("refuses a semver-lower stable release even when stable is chosen explicitly on a prerelease install", async () => {
    getAppVersionMock.mockReturnValue("2.0.0-alpha.3");
    const view = renderUpdater();

    await act(async () => {
      await view.result.current.api.setChannel("stable");
    });

    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(view.result.current.api.channel).toBe("stable");
    expect(view.result.current.api.status).toBe("not-available");
    expect(view.result.current.api.newVersion).toBeNull();
  });

  it("performs no fetch and never reaches 'available' without a shell version", async () => {
    getAppVersionMock.mockReturnValue(null);
    const result = await checkForUpdate();

    expect(fetchReleaseMock).toHaveBeenCalledTimes(0);
    expect(result.current.api.status).toBe("idle");
    expect(result.current.api.currentVersion).toBeNull();
    expect(result.current.api.newVersion).toBeNull();
  });

  it("reports 'not-available' when the shell version equals the latest release", async () => {
    getAppVersionMock.mockReturnValue("1.1.0");
    const result = await checkForUpdate();

    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(result.current.api.currentVersion).toBe("1.1.0");
    expect(result.current.api.status).toBe("not-available");
    expect(result.current.api.newVersion).toBeNull();
  });

  it("reports 'available' when the latest release is newer than the shell version", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const result = await checkForUpdate();

    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(result.current.api.status).toBe("available");
    expect(result.current.api.newVersion).toBe("1.1.0");
  });

  it("opens the release page when no installer updater bridge exists", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    expect(view.result.current.api.autoInstallSupported).toBe(false);

    await act(async () => {
      await view.result.current.api.downloadUpdate();
    });

    expect(openExternalMock).toHaveBeenCalledWith(
      "https://github.com/klaus-2/koma-studio/releases/tag/v1.1.0",
    );
    expect(view.result.current.api.status).toBe("available");
  });

  it("downloads through the installer bridge and tracks progress events", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    expect(view.result.current.api.autoInstallSupported).toBe(true);

    await act(async () => {
      await view.result.current.api.downloadUpdate();
    });

    expect(bridge.download).toHaveBeenCalledWith({ channel: "stable" });
    expect(view.result.current.api.status).toBe("downloading");

    await act(async () => {
      bridge.emit({
        event: "progress",
        state: buildBridgeState({
          status: "downloading",
          progress: { percent: 42.4, transferred: 10, total: 100, speed: 5 },
        }),
      });
    });

    expect(view.result.current.api.status).toBe("downloading");
    expect(view.result.current.progress.percent).toBe(42.4);
    expect(view.result.current.progress.transferred).toBe(10);
  });

  it("stages downloaded updates without force-installing until explicit confirmation", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.api.downloadUpdate();
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

    expect(view.result.current.api.status).toBe("downloaded");
    expect(view.result.current.api.downloadedAt).toBe(123);
    expect(bridge.install).not.toHaveBeenCalled();

    await act(async () => {
      await view.result.current.api.installUpdate();
    });
    expect(bridge.install).toHaveBeenCalledTimes(1);
  });

  it("keeps manual checks informational during the download lifecycle", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.api.downloadUpdate();
    });

    const fetchCallsAfterDownload = fetchReleaseMock.mock.calls.length;
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });

    expect(fetchReleaseMock.mock.calls.length).toBeGreaterThan(fetchCallsAfterDownload);
    expect(view.result.current.api.status).toBe("downloading");
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
        await view.result.current.api.downloadUpdate();
      });

      const fetchCallsAfterDownload = fetchReleaseMock.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8 * 60_000);
      });

      expect(fetchReleaseMock.mock.calls.length).toBe(fetchCallsAfterDownload);
      expect(view.result.current.api.status).toBe("downloading");
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
      await view.result.current.api.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.api.downloadUpdate();
    });

    expect(view.result.current.api.status).toBe("error");
    expect(view.result.current.api.error).toBe("Failed to download the update: feed unavailable");
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

    expect(view.result.current.api.autoInstallSupported).toBe(true);
    expect(view.result.current.api.status).toBe("downloading");
    expect(view.result.current.progress.percent).toBe(12);
  });

  it("adopts a downloaded update on hydration without force-restarting", async () => {
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

    expect(view.result.current.api.status).toBe("downloaded");
    expect(bridge.install).not.toHaveBeenCalled();
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

    expect(view.result.current.api.autoInstallSupported).toBe(true);
    expect(view.result.current.api.status).toBe("idle");
    expect(view.result.current.api.newVersion).toBeNull();
  });

  it("surfaces a manual install rejection as an error state", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    bridge.install.mockRejectedValueOnce(new Error("no installer"));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.api.downloadUpdate();
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

    expect(view.result.current.api.status).toBe("downloaded");
    await act(async () => {
      await view.result.current.api.installUpdate();
    });

    expect(view.result.current.api.status).toBe("error");
    expect(view.result.current.api.error).toBe("Failed to install the update: no installer");
  });

  it("ignores stale installer errors outside the download lifecycle", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });

    await act(async () => {
      bridge.emit({
        event: "error",
        state: buildBridgeState({ status: "error", error: "stale" }),
      });
    });

    expect(view.result.current.api.status).toBe("available");
  });

  it("maps installer errors during a download to the error state", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const bridge = createTestUpdaterBridge();
    bridge.getState.mockResolvedValue(buildBridgeState({ status: "idle" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    await act(async () => {
      await view.result.current.api.downloadUpdate();
    });

    await act(async () => {
      bridge.emit({
        event: "error",
        state: buildBridgeState({ status: "error", error: "network down" }),
      });
    });

    expect(view.result.current.api.status).toBe("error");
    expect(view.result.current.api.error).toBe("network down");
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

  it("ranks beta.10 above beta.9 with numeric prerelease identifiers", () => {
    expect(compareVersions("1.3.2-beta.10", "1.3.2-beta.9")).toBeGreaterThan(0);
  });

  it("ranks beta.2 below beta.10 and a bare beta below beta.1", () => {
    expect(compareVersions("1.3.2-beta.2", "1.3.2-beta.10")).toBeLessThan(0);
    expect(compareVersions("1.3.2-beta", "1.3.2-beta.1")).toBeLessThan(0);
  });

  it("picks the beta tag from a mixed feed and offers it over an older stable", async () => {
    getAppVersionMock.mockReturnValue("1.3.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [
        buildListedRelease("v1.3.2-beta.1"),
        buildListedRelease("runtime-v1.3.1"),
        buildListedRelease("v1.3.1"),
      ],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.channel).toBe("beta");
    expect(view.result.current.api.status).toBe("available");
    expect(view.result.current.api.newVersion).toBe("1.3.2-beta.1");
  });

  it("ignores runtime releases listed ahead of the beta tag", async () => {
    getAppVersionMock.mockReturnValue("1.3.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [
        buildListedRelease("runtime-v1.3.1"),
        buildListedRelease("v1.3.2-beta.1"),
      ],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("available");
    expect(view.result.current.api.newVersion).toBe("1.3.2-beta.1");
  });

  it("does not offer an equal stable release on the beta channel", async () => {
    getAppVersionMock.mockReturnValue("1.3.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [
        buildListedRelease("runtime-v1.3.1"),
        buildListedRelease("v1.3.1"),
      ],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("not-available");
    expect(view.result.current.api.newVersion).toBeNull();
  });

  it("promotes a beta install to a stable published after it", async () => {
    getAppVersionMock.mockReturnValue("1.3.2-beta.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [
        buildListedRelease("v1.3.2"),
        buildListedRelease("v1.3.2-beta.1"),
        buildListedRelease("runtime-v1.3.2"),
      ],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("available");
    expect(view.result.current.api.newVersion).toBe("1.3.2");
  });

  it("resolves the newest published release when a stable ships during a beta line", async () => {
    getAppVersionMock.mockReturnValue("1.4.0-beta.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [
        buildListedRelease("v1.3.3"),
        buildListedRelease("v1.4.0-beta.1"),
      ],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("not-available");
    expect(view.result.current.api.newVersion).toBeNull();
  });

  it("offers the beta release to an older stable install", async () => {
    getAppVersionMock.mockReturnValue("1.3.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [buildListedRelease("v1.3.2-beta.1")],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("available");
    expect(view.result.current.api.newVersion).toBe("1.3.2-beta.1");
  });

  it("does not offer a same-base beta prerelease to a newer stable install", async () => {
    getAppVersionMock.mockReturnValue("1.3.2");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [buildListedRelease("v1.3.2-beta.1")],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("not-available");
    expect(view.result.current.api.newVersion).toBeNull();
  });

  it("offers the stable release to a beta install when it is semver-greater", async () => {
    getAppVersionMock.mockReturnValue("1.3.2-beta.1");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => buildListedRelease("v1.3.2"),
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("stable");
    });

    expect(view.result.current.api.status).toBe("available");
    expect(view.result.current.api.newVersion).toBe("1.3.2");
  });

  it("does not offer a lower beta on the beta channel", async () => {
    getAppVersionMock.mockReturnValue("1.3.2-beta.3");
    fetchReleaseMock.mockResolvedValue({
      ok: true,
      json: async () => [buildListedRelease("v1.3.2-beta.2")],
    });

    const view = renderUpdater();
    await act(async () => {
      await view.result.current.api.setChannel("beta");
    });

    expect(view.result.current.api.status).toBe("not-available");
    expect(view.result.current.api.newVersion).toBeNull();
  });

  it("parses static koma-release-manifest.json payloads without falling back to GitHub API", async () => {
    getAppVersionMock.mockReturnValue("1.4.0");
    fetchReleaseMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        version: "1.4.1",
        channel: "stable",
        releaseNotes: "Hot UI fix",
      }),
    });

    const result = await checkForUpdate();
    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
    expect(result.current.api.status).toBe("available");
    expect(result.current.api.newVersion).toBe("1.4.1");
    expect(result.current.api.releaseNotes).toBe("Hot UI fix");
  });

  it("prefers native bridge check and acks UI readiness without hitting GitHub API", async () => {
    getAppVersionMock.mockReturnValue("1.4.0");
    const bridge = createTestUpdaterBridge();
    const checkMock = vi.fn(async () =>
      buildBridgeState({
        status: "available",
        currentVersion: "1.4.0",
        newVersion: "1.4.2",
        releaseNotes: "Instant UI OTA",
      }),
    );
    const setAutoInstallMock = vi.fn(async ({ enabled }: { enabled: boolean }) =>
      buildBridgeState({ autoInstallOnQuit: enabled }),
    );
    const ackUiReadyMock = vi.fn(async () => true);
    Object.assign(bridge, {
      check: checkMock,
      setAutoInstall: setAutoInstallMock,
      ackUiReady: ackUiReadyMock,
    });
    bridge.getState.mockResolvedValue(buildBridgeState({ currentVersion: "1.4.0" }));
    updaterBridgeRef.current = bridge;

    const view = renderUpdater();
    await act(async () => {});
    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });

    expect(checkMock).toHaveBeenCalledWith({ channel: "stable" });
    expect(fetchReleaseMock).not.toHaveBeenCalled();
    expect(view.result.current.api.status).toBe("available");
    expect(view.result.current.api.newVersion).toBe("1.4.2");

    await act(async () => {
      await view.result.current.api.setAutoInstall(false);
    });
    expect(setAutoInstallMock).toHaveBeenCalledWith({ enabled: false });
    expect(view.result.current.api.autoInstallOnQuit).toBe(false);
  });

  it("enforces the 30-minute focus check cooldown", async () => {
    getAppVersionMock.mockReturnValue("1.0.9");
    const view = renderUpdater();

    await act(async () => {
      await view.result.current.api.checkForUpdates();
    });
    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchReleaseMock).toHaveBeenCalledTimes(1);
  });
});
