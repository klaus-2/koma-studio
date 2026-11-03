import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event, UnlistenFn } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  desktopCommandChannels,
} from "@shared/desktop-api";
import type {
  DesktopModelDownloadPayload,
  IDesktopBridge,
} from "@shared/desktop-api";
import type {
  MiniBackendRuntimeStatePayload,
  UpdaterEventPayload,
  UpdaterStatusPayload,
} from "@shared/desktop-events";
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
  exitCode: null,
  lastStderr: null,
  crashLogPath: null,
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

  it("invokes desktop commands without args", async () => {
    mockedInvoke.mockResolvedValueOnce({ ok: true });

    await invokeCommand(desktopCommandChannels.discordRPC.setIdle);

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });

  it("rejects a bridge failure with an Error carrying the command's cause", async () => {
    mockedInvoke.mockRejectedValueOnce(
      "error sending request for url (http://127.0.0.1:3001/api/auth/login): connection refused",
    );

    const failing = invokeCommand<{ ok: boolean }>(
      desktopCommandChannels.api.auth.login,
      { payload: {} },
    );

    await expect(failing).rejects.toBeInstanceOf(Error);
    await expect(failing).rejects.toThrow(
      "error sending request for url (http://127.0.0.1:3001/api/auth/login): connection refused",
    );
  });

  it("keeps the code of a tagged enum rejection", async () => {
    mockedInvoke.mockRejectedValueOnce({ code: "invalid_url" });

    const failing = invokeCommand(desktopCommandChannels.links.openExternal, {
      url: "http://insecure.example",
    });

    await expect(failing).rejects.toThrow('{"code":"invalid_url"}');
  });

  it("keeps production Vite URLs when Tauri runtime config returns local defaults", async () => {
    vi.stubEnv("VITE_AUTH_API_URL", "https://auth.koma-studio.site");
    vi.stubEnv("VITE_MINI_BACKEND_ARTIFACTS_URL", "https://api.koma-studio.site/updates/");
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
      expect(tauriApi.desktop).not.toBeNull();
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

  it("exposes the updater bridge only inside the Tauri runtime", () => {
    mockedIsTauri.mockReturnValue(false);
    expect(tauriApi.updater).toBeNull();

    mockedIsTauri.mockReturnValue(true);
    expect(tauriApi.updater).not.toBeNull();
    expect(tauriApi.updater?.getState).toBeTypeOf("function");
    expect(tauriApi.updater?.on).toBeTypeOf("function");
  });

  it("maps a null updater shell state to a null bridge state", async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockResolvedValueOnce(null);

    const state = await tauriApi.updater?.getState();

    expect(mockedInvoke).toHaveBeenCalledWith("desktop:updater:get-state");
    expect(state).toBeNull();
  });

  it("validates updater state payloads before they reach the hook", async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockResolvedValueOnce(updaterStatePayload);

    const state = await tauriApi.updater?.getState();

    expect(state).toEqual(updaterStatePayload);
  });

  it("routes download/install through the shared updater channels", async () => {
    mockedIsTauri.mockReturnValue(true);
    mockedInvoke.mockResolvedValue(updaterStatePayload);

    await tauriApi.updater?.download({ channel: "stable" });
    await tauriApi.updater?.install();

    expect(mockedInvoke).toHaveBeenCalledWith("desktop:updater:download", {
      channel: "stable",
    });
    expect(mockedInvoke).toHaveBeenCalledWith("desktop:updater:install");
  });

  it("dispatches only validated updater events and honors unlisten", async () => {
    mockedIsTauri.mockReturnValue(true);
    const received: UpdaterEventPayload[] = [];
    const handlers: Array<(event: Event<unknown>) => void> = [];

    mockedListen.mockImplementationOnce(async (eventName, handler) => {
      handlers.push(handler);
      expect(eventName).toBe("updater:event");
      const unlisten: UnlistenFn = vi.fn();
      return unlisten;
    });

    const unsubscribe = tauriApi.updater?.on((payload) => {
      received.push(payload);
    });
    expect(unsubscribe).toBeTypeOf("function");
    await vi.waitFor(() => expect(handlers).toHaveLength(1));

    const emit = (payload: unknown): void => {
      for (const handler of handlers) {
        handler({ event: "updater:event", id: 1, payload });
      }
    };

    emit({ event: "progress", state: updaterStatePayload });
    emit({ event: "cancelled", state: updaterStatePayload });
    expect(received).toHaveLength(1);
    expect(received[0]?.event).toBe("progress");

    unsubscribe?.();
    emit({ event: "progress", state: updaterStatePayload });
    expect(received).toHaveLength(1);
  });
});

const updaterStatePayload: UpdaterStatusPayload = {
  status: "downloading",
  currentVersion: "1.3.1",
  newVersion: "1.4.0",
  mandatory: false,
  blocking: false,
  blockingReason: null,
  releaseNotes: null,
  channel: "stable",
  provider: "github",
  autoInstallOnQuit: true,
  allowPrerelease: false,
  progress: { percent: 42.5, transferred: 10, total: 24, speed: 3 },
  checkedAt: 100,
  downloadedAt: null,
  error: null,
};
