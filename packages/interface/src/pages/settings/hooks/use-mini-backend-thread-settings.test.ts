import { act, renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { createDesktopBridgeStub } from "@/testing/desktop-bridge-stub";
import type { IDesktopBridge } from "@shared/desktop-api";
import {
  MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
} from "../../../utils/miniBackendThreadSettings";
import { useMiniBackendThreadSettings } from "./use-mini-backend-thread-settings";

type ThreadOverridePayload = Parameters<
  IDesktopBridge["setMiniBackendThreadOverride"]
>[0];

const capturedOverrides: ThreadOverridePayload[] = [];

const buildBridge = (
  overrides: Partial<ThreadOverridePayload>[],
  mode: "resolve" | "reject" = "resolve",
): IDesktopBridge => {
  const stub = createDesktopBridgeStub({
    listInstalled: async () => [],
    getDiskSpace: async () => ({
      freeBytes: 1024 ** 3,
      totalBytes: 1024 ** 3 * 10,
      path: "mock",
    }),
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
  });
  return {
    ...stub,
    setMiniBackendThreadOverride: async (payload: ThreadOverridePayload) => {
      if (mode === "reject") {
        throw new Error("bridge delivery failed");
      }
      overrides.push(payload);
      return {};
    },
  };
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: buildBridge(capturedOverrides) });
});

describe("useMiniBackendThreadSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    capturedOverrides.length = 0;
  });

  it("loads the stored value on mount with tunable defaults for old shapes", () => {
    // Old stored shape: only the legacy thread field, no tunables.
    const stored = { intraOpThreads: 6 };
    window.localStorage.setItem(
      MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
      JSON.stringify(stored),
    );
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    expect(result.current.settings).toEqual({
      intraOpThreads: 6,
      engineIdleTimeoutSeconds: 600,
      workingResolutionMegapixels: 24,
      workingResolutionOcrClean: false,
    });
    expect(result.current.miniBackendTunables).toEqual({
      engineIdleTimeoutSeconds: 600,
      workingResolutionMegapixels: 24,
      workingResolutionOcrClean: false,
    });
  });

  it("saves to localStorage and calls the bridge on change", () => {
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => result.current.setIntraOpThreads(4));
    expect(result.current.settings).toEqual({
      intraOpThreads: 4,
      engineIdleTimeoutSeconds: 600,
      workingResolutionMegapixels: 24,
      workingResolutionOcrClean: false,
    });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(
      JSON.stringify({
        intraOpThreads: 4,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      }),
    );
    expect(capturedOverrides).toEqual([
      {
        intraOpThreads: 4,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      },
    ]);
  });

  it("clearing the value persists null and notifies the bridge", () => {
    window.localStorage.setItem(
      MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
      JSON.stringify({ intraOpThreads: 8 }),
    );
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => result.current.setIntraOpThreads(null));
    expect(result.current.settings).toEqual({
      intraOpThreads: null,
      engineIdleTimeoutSeconds: 600,
      workingResolutionMegapixels: 24,
      workingResolutionOcrClean: false,
    });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(
      JSON.stringify({
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      }),
    );
    expect(capturedOverrides).toEqual([
      {
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      },
    ]);
  });

  it("saving the tunables persists them and notifies the bridge", () => {
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => {
      result.current.setMiniBackendTunables({
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 32,
        workingResolutionOcrClean: true,
      });
    });
    act(() => result.current.handleSaveMiniBackendTunables());
    expect(result.current.settings).toEqual({
      intraOpThreads: null,
      engineIdleTimeoutSeconds: 300,
      workingResolutionMegapixels: 32,
      workingResolutionOcrClean: true,
    });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(
      JSON.stringify({
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 32,
        workingResolutionOcrClean: true,
      }),
    );
    expect(capturedOverrides).toEqual([
      {
        intraOpThreads: null,
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 32,
        workingResolutionOcrClean: true,
      },
    ]);
  });

  it("changing the threads preserves the saved tunables", () => {
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => {
      result.current.setMiniBackendTunables({
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 32,
        workingResolutionOcrClean: true,
      });
    });
    act(() => result.current.handleSaveMiniBackendTunables());
    act(() => result.current.setIntraOpThreads(2));
    expect(result.current.settings).toEqual({
      intraOpThreads: 2,
      engineIdleTimeoutSeconds: 300,
      workingResolutionMegapixels: 32,
      workingResolutionOcrClean: true,
    });
    expect(capturedOverrides[1]).toEqual({
      intraOpThreads: 2,
      engineIdleTimeoutSeconds: 300,
      workingResolutionMegapixels: 32,
      workingResolutionOcrClean: true,
    });
  });

  it("does not throw when the desktop bridge is absent", () => {
    setDesktopBridgeProvider({ desktop: null });
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    expect(() =>
      act(() => result.current.setIntraOpThreads(2)),
    ).not.toThrow();
    expect(result.current.settings).toEqual({
      intraOpThreads: 2,
      engineIdleTimeoutSeconds: 600,
      workingResolutionMegapixels: 24,
      workingResolutionOcrClean: false,
    });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(
      JSON.stringify({
        intraOpThreads: 2,
        engineIdleTimeoutSeconds: 600,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      }),
    );
  });

  it("reports the tunables save as saved when the bridge delivers", async () => {
    setDesktopBridgeProvider({ desktop: buildBridge([]) });
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    expect(result.current.tunablesSaveStatus).toBe("idle");
    act(() => result.current.handleSaveMiniBackendTunables());
    expect(result.current.tunablesSaveStatus).toBe("saving");
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.tunablesSaveStatus).toBe("saved");
  });

  it("reports the tunables save as failed when the bridge rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      setDesktopBridgeProvider({ desktop: buildBridge([], "reject") });
      const { result } = renderHook(() => useMiniBackendThreadSettings());
      act(() => result.current.handleSaveMiniBackendTunables());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.tunablesSaveStatus).toBe("failed");
      expect(errorSpy).toHaveBeenCalledWith(
        "mini-backend thread override not delivered",
        expect.any(Error),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("reports the tunables save as saved immediately without a desktop bridge", () => {
    setDesktopBridgeProvider({ desktop: null });
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => result.current.handleSaveMiniBackendTunables());
    expect(result.current.tunablesSaveStatus).toBe("saved");
  });

  it("two live instances never clobber each other's saved tunables", () => {
    // The hook is state-per-instance: each save spreads only the fields that
    // instance edited over the freshly loaded record.
    const a = renderHook(() => useMiniBackendThreadSettings());
    act(() => {
      a.result.current.setMiniBackendTunables({
        engineIdleTimeoutSeconds: 300,
        workingResolutionMegapixels: 24,
        workingResolutionOcrClean: false,
      });
    });
    act(() => a.result.current.handleSaveMiniBackendTunables());

    // Instance B mounts AFTER A's save and applies the calibration
    // recommendation (its updater spreads prev, so only one field differs).
    const b = renderHook(() => useMiniBackendThreadSettings());
    expect(b.result.current.miniBackendTunables.engineIdleTimeoutSeconds).toBe(300);
    act(() => {
      b.result.current.setMiniBackendTunables((prev) => ({
        ...prev,
        workingResolutionMegapixels: 48,
      }));
    });
    act(() => b.result.current.handleSaveMiniBackendTunables());
    expect(JSON.parse(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY) ?? "{}",
    )).toEqual({
      intraOpThreads: null,
      engineIdleTimeoutSeconds: 300,
      workingResolutionMegapixels: 48,
      workingResolutionOcrClean: false,
    });

    // The inverse direction: A saves again from its stale B-field draft —
    // B's resolution survives.
    act(() => {
      a.result.current.setMiniBackendTunables((prev) => ({
        ...prev,
        engineIdleTimeoutSeconds: 480,
      }));
    });
    act(() => a.result.current.handleSaveMiniBackendTunables());
    expect(JSON.parse(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY) ?? "{}",
    )).toEqual({
      intraOpThreads: null,
      engineIdleTimeoutSeconds: 480,
      workingResolutionMegapixels: 48,
      workingResolutionOcrClean: false,
    });
  });
});
