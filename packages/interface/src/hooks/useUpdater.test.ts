import { createElement, type ReactNode } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      openExternal: vi.fn<(url: string) => Promise<void>>(async () => undefined),
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
      let releaseFetch: ((value: ReleaseResponse) => void) | null = null;
      fetchReleaseMock.mockReset();
      fetchReleaseMock.mockImplementation(
        () => new Promise<ReleaseResponse>((resolve) => { releaseFetch = resolve; }),
      );

      const view = renderUpdater();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });
      expect(fetchReleaseMock.mock.calls.length).toBe(1);

      // Unmount while the check is in flight: resolving it must not re-arm
      // the periodic chain after cleanup already ran.
      view.unmount();
      if (!releaseFetch) throw new Error("periodic check did not start");
      await act(async () => {
        releaseFetch({ ok: true, json: async () => LATEST_RELEASE });
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
