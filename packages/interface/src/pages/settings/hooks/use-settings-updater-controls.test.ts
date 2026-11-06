import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UseUpdaterApi } from "../../../hooks/useUpdater";
import { useSettingsUpdaterControls } from "./use-settings-updater-controls";

const buildUpdater = (overrides: Partial<UseUpdaterApi>): UseUpdaterApi => ({
  status: "idle",
  currentVersion: "1.3.1",
  newVersion: null,
  mandatory: false,
  blocking: false,
  blockingReason: null,
  progress: { percent: 0, transferred: 0, total: 0, speed: 0 },
  releaseNotes: null,
  checkedAt: null,
  downloadedAt: null,
  channel: "stable",
  provider: "github",
  autoInstallOnQuit: false,
  autoInstallSupported: true,
  error: null,
  checkForUpdates: async () => undefined,
  downloadUpdate: async () => undefined,
  openReleasePage: async () => undefined,
  installUpdate: async () => undefined,
  rollbackUpdate: async () => undefined,
  postpone: async () => undefined,
  setChannel: async () => undefined,
  setAutoInstall: async () => undefined,
  ...overrides,
});

const t = (key: string): string => key;

describe("useSettingsUpdaterControls", () => {
  it("disables the beta channel when in-app auto-install is unsupported", () => {
    const { result } = renderHook(() =>
      useSettingsUpdaterControls({
        updater: buildUpdater({ autoInstallSupported: false }),
        t,
      }),
    );

    expect(result.current.betaChannelDisabled).toBe(true);
  });

  it("keeps the beta channel enabled when in-app auto-install is supported", () => {
    const { result } = renderHook(() =>
      useSettingsUpdaterControls({
        updater: buildUpdater({ autoInstallSupported: true }),
        t,
      }),
    );

    expect(result.current.betaChannelDisabled).toBe(false);
  });
});
