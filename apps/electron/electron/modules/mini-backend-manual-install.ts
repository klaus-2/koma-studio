/**
 * Manual runtime install orchestration (recommended / specific profile).
 */
import { app } from "electron";
import path from "node:path";
import { writeMiniBackendRuntimeSelection } from "../mini-backend-runtime-selection.ts";
import {
  buildManualInstallBlockedState,
  type MiniBackendAccelerationProfile,
} from "../mini-backend-runtime.ts";
import { normalizeAccelerationProfileOverride } from "./mini-backend-profile.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";

interface ManualInstallResult {
  ok: boolean;
  profile: string;
  reason: string | null;
}

const createManualRuntimeInstaller = (deps: {
  isDev: boolean;
  runtimeStore: MiniBackendRuntimeStore;
  resolveAccelerationProfile: () => Promise<MiniBackendAccelerationProfile>;
  ensureDownloadedRuntime: (
    profile: MiniBackendAccelerationProfile,
    options?: { allowCpuDownload?: boolean },
  ) => Promise<{
    binaryPath: string;
    installDir: string;
    version: string;
    archiveUrl: string;
  } | null>;
  restartBackend: () => Promise<void>;
}) => {
  let miniBackendRuntimeInstallPromise: Promise<ManualInstallResult> | null = null;

  const installRecommendedMiniBackendRuntime = async (): Promise<ManualInstallResult> => {
    if (miniBackendRuntimeInstallPromise) {
      return miniBackendRuntimeInstallPromise;
    }

    miniBackendRuntimeInstallPromise = (async () => {
      const profile = await deps.resolveAccelerationProfile();
      if (deps.isDev) {
        deps.runtimeStore.patch(buildManualInstallBlockedState({
          reason: "dev-only-unavailable",
          requestedProfile: profile,
          activeProfile: deps.runtimeStore.getState().activeProfile,
          source: deps.runtimeStore.getState().source,
        }));
        return { ok: false, profile, reason: "runtime_manual_install_dev_only_unavailable" };
      }
      if (profile === "cpu") {
        deps.runtimeStore.patch(buildManualInstallBlockedState({
          reason: "cpu-not-required",
          requestedProfile: profile,
          activeProfile: deps.runtimeStore.getState().activeProfile,
          source: deps.runtimeStore.getState().source,
        }));
        return { ok: false, profile, reason: "runtime_manual_install_cpu_not_required" };
      }

      const installedRuntime = await deps.ensureDownloadedRuntime(profile);
      if (!installedRuntime) {
        return {
          ok: false,
          profile,
          reason: deps.runtimeStore.getState().lastError ?? "runtime_manual_install_failed",
        };
      }

      writeMiniBackendRuntimeSelection(app.getPath("userData"), {
        profile,
        version: installedRuntime.version,
        entry: path.basename(installedRuntime.binaryPath),
      });
      await deps.restartBackend();
      return { ok: true, profile, reason: null };
    })();

    try {
      return await miniBackendRuntimeInstallPromise;
    } finally {
      miniBackendRuntimeInstallPromise = null;
    }
  };

  const installMiniBackendRuntimeProfile = async (
    profileInput: string,
  ): Promise<ManualInstallResult> => {
    if (miniBackendRuntimeInstallPromise) {
      return miniBackendRuntimeInstallPromise;
    }

    miniBackendRuntimeInstallPromise = (async () => {
      const normalizedProfile = normalizeAccelerationProfileOverride(profileInput);
      if (normalizedProfile === "auto") {
        return { ok: false, profile: profileInput, reason: "runtime_manual_install_invalid_profile" };
      }

      if (deps.isDev) {
        deps.runtimeStore.patch(buildManualInstallBlockedState({
          reason: "dev-only-unavailable",
          requestedProfile: normalizedProfile,
          activeProfile: deps.runtimeStore.getState().activeProfile,
          source: deps.runtimeStore.getState().source,
        }));
        return { ok: false, profile: normalizedProfile, reason: "runtime_manual_install_dev_only_unavailable" };
      }

      const installedRuntime = await deps.ensureDownloadedRuntime(normalizedProfile, {
        allowCpuDownload: true,
      });
      if (!installedRuntime) {
        return {
          ok: false,
          profile: normalizedProfile,
          reason: deps.runtimeStore.getState().lastError ?? "runtime_manual_install_failed",
        };
      }

      writeMiniBackendRuntimeSelection(app.getPath("userData"), {
        profile: normalizedProfile,
        version: installedRuntime.version,
        entry: path.basename(installedRuntime.binaryPath),
      });
      await deps.restartBackend();
      return { ok: true, profile: normalizedProfile, reason: null };
    })();

    try {
      return await miniBackendRuntimeInstallPromise;
    } finally {
      miniBackendRuntimeInstallPromise = null;
    }
  };

  return {
    installMiniBackendRuntimeProfile,
    installRecommendedMiniBackendRuntime,
  };
};

export type { ManualInstallResult };
export { createManualRuntimeInstaller };
