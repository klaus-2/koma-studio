import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event, UnlistenFn } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  desktopCommandChannels,
  updaterCommandChannels,
} from "@shared/desktop-api";
import type {
  DesktopModelDownloadPayload,
  IDesktopBridge,
} from "@shared/desktop-api";
import type { MiniBackendRuntimeStatePayload } from "@shared/desktop-events";
import {
  getCachedTauriRuntimeConfig,
  hydrateTauriRuntimeConfig,
  invokeCommand,
  listenToDesktopEvent,
  isTauriRuntime,
  tauriApi,
} from "./api";

const mockedInvoke = vi.mocked(invoke);
const mockedIsTauri = vi.mocked(isTauri);
const mockedListen = vi.mocked(listen);

const runtimeStatePayload: MiniBackendRuntimeStatePayload = {
  status: "ready",
  statusMessage: null,
  requestedProfile: "windows-nvidia",
  activeProfile: "windows-nvidia",
  source: "downloaded-runtime",
  runtimeArtifactsUrl: null,
  runtimeManifestUrl: null,
  runtimeArchiveUrl: null,
  installDir: "C:/Koma/runtime",
  downloadCacheDir: "C:/Koma/cache",
  version: "1.0.0",
  lastError: null,
  attempt: 1,
  maxAttempts: 3,
  progress: null,
  updatedAt: 1_779_235_701,
  gpuName: "RTX",
  vramGb: 12,
};

describe("tauri api wrapper", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockedInvoke.mockReset();
    mockedIsTauri.mockReturnValue(false);
    mockedListen.mockReset();
  });

  it("passes typed command names and args to invoke", async () => {
    mockedInvoke.mockResolvedValueOnce({ ok: true });

    const result = await invokeCommand<{ ok: boolean }>(
      desktopCommandChannels.links.openExternal,
      { url: "https://example.com" },
    );

    expect(result).toEqual({ ok: true });
    expect(mockedInvoke).toHaveBeenCalledWith("desktop:open-external", {
      url: "https://example.com",
    });
  });

  it("invokes updater commands without args", async () => {
    mockedInvoke.mockResolvedValueOnce(runtimeStatePayload);

    await invokeCommand(updaterCommandChannels.getStatus);

    expect(mockedInvoke).toHaveBeenCalledWith("updater:get-status");
  });

  it("invokes updater check with a manifest url when provided", async () => {
    mockedInvoke.mockResolvedValueOnce(runtimeStatePayload);

    await invokeCommand(updaterCommandChannels.check, {
      manifestUrl: "https://api.koma-studio.site/updates/beta/manifest.json",
    });

    expect(mockedInvoke).toHaveBeenCalledWith("updater_check", {
      manifestUrl: "https://api.koma-studio.site/updates/beta/manifest.json",
    });
  });

  it("keeps production Vite URLs when Tauri runtime config returns local defaults", async () => {
    vi.stubEnv("VITE_AUTH_API_URL", "https://auth.koma-studio.site");
    vi.stubEnv("VITE_UPDATE_SERVER_URL", "https://api.koma-studio.site/updates/");
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockResolvedValueOnce({
      authApiUrl: "http://127.0.0.1:3001",
      localApiUrl: "http://127.0.0.1:8001",
      appPackaged: true,
    });

    const result = await hydrateTauriRuntimeConfig();

    expect(result).toEqual({
      authApiUrl: "https://auth.koma-studio.site",
      localApiUrl: "http://127.0.0.1:8001",
      runtimeArtifactsUrl: "https://api.koma-studio.site/updates/",
      appPackaged: true,
    });
    expect(getCachedTauriRuntimeConfig()).toEqual(result);
  });

  it("detects Tauri runtime from the internal bridge object", () => {
    const internals = Reflect.get(globalThis as Record<string, unknown>, "__TAURI_INTERNALS__");
    Reflect.set(globalThis as Record<string, unknown>, "__TAURI_INTERNALS__", {});
    mockedIsTauri.mockReturnValue(false);

    try {
      expect(isTauriRuntime()).toBe(true);
      expect(tauriApi.updater).not.toBeNull();
    } finally {
      if (internals === undefined) {
        Reflect.deleteProperty(globalThis as Record<string, unknown>, "__TAURI_INTERNALS__");
      } else {
        Reflect.set(globalThis as Record<string, unknown>, "__TAURI_INTERNALS__", internals);
      }
    }
  });

  it("forwards typed desktop event payloads and returns unlisten", async () => {
    const unlisten: UnlistenFn = vi.fn();
    const received: MiniBackendRuntimeStatePayload[] = [];

    mockedListen.mockImplementationOnce(async (eventName, handler) => {
      handler({
        event: eventName,
        id: 1,
        payload: runtimeStatePayload,
      } as Event<MiniBackendRuntimeStatePayload>);

      return unlisten;
    });

    const result = await listenToDesktopEvent(
      "mini-backend-runtime:event",
      (payload) => {
        received.push(payload);
      },
    );

    expect(result).toBe(unlisten);
    expect(received).toEqual([runtimeStatePayload]);
    expect(mockedListen).toHaveBeenCalledWith(
      "mini-backend-runtime:event",
      expect.any(Function),
    );
  });

  it("keeps extracted bridge method payloads typed", () => {
    expectTypeOf(desktopCommandChannels.models.download).toEqualTypeOf<
      "desktop-models:download"
    >();
    expectTypeOf<Parameters<IDesktopBridge["models"]["download"]>[0]>()
      .toEqualTypeOf<DesktopModelDownloadPayload>();
  });
});
