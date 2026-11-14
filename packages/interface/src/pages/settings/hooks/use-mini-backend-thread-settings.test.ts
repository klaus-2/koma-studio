import { act, renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { createDesktopBridgeStub } from "@/testing/desktop-bridge-stub";
import type { IDesktopBridge } from "@shared/desktop-api";
import {
  MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
  type MiniBackendThreadSettings,
} from "../../../utils/miniBackendThreadSettings";
import { useMiniBackendThreadSettings } from "./use-mini-backend-thread-settings";

type ThreadOverridePayload = Parameters<
  IDesktopBridge["setMiniBackendThreadOverride"]
>[0];

const capturedOverrides: ThreadOverridePayload[] = [];

const buildBridge = (
  overrides: Partial<ThreadOverridePayload>[],
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

  it("loads the stored value on mount", () => {
    const stored: MiniBackendThreadSettings = { intraOpThreads: 6 };
    window.localStorage.setItem(
      MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
      JSON.stringify(stored),
    );
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    expect(result.current.settings).toEqual({ intraOpThreads: 6 });
  });

  it("saves to localStorage and calls the bridge on change", () => {
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => result.current.setIntraOpThreads(4));
    expect(result.current.settings).toEqual({ intraOpThreads: 4 });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(JSON.stringify({ intraOpThreads: 4 }));
    expect(capturedOverrides).toEqual([{ intraOpThreads: 4 }]);
  });

  it("clearing the value persists null and notifies the bridge", () => {
    window.localStorage.setItem(
      MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY,
      JSON.stringify({ intraOpThreads: 8 }),
    );
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    act(() => result.current.setIntraOpThreads(null));
    expect(result.current.settings).toEqual({ intraOpThreads: null });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(JSON.stringify({ intraOpThreads: null }));
    expect(capturedOverrides).toEqual([{ intraOpThreads: null }]);
  });

  it("does not throw when the desktop bridge is absent", () => {
    setDesktopBridgeProvider({ desktop: null });
    const { result } = renderHook(() => useMiniBackendThreadSettings());
    expect(() =>
      act(() => result.current.setIntraOpThreads(2)),
    ).not.toThrow();
    expect(result.current.settings).toEqual({ intraOpThreads: 2 });
    expect(
      window.localStorage.getItem(MINI_BACKEND_THREAD_SETTINGS_STORAGE_KEY),
    ).toBe(JSON.stringify({ intraOpThreads: 2 }));
  });
});
