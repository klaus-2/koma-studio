/**
 * Mini-backend acceleration profile resolution.
 */
import { app } from "electron";
import type {
  MiniBackendAccelerationProfile,
} from "../mini-backend-runtime.ts";
import {
  resolveAccelerationProfile,
} from "../mini-backend-runtime.ts";
import {
  readMiniBackendRuntimeSelection,
  resolveRequestedRuntimeProfile,
} from "../mini-backend-runtime-selection.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";

const normalizeAccelerationProfileOverride = (
  value: string | null | undefined,
): MiniBackendAccelerationProfile | "auto" => {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "cpu":
    case "nvidia-cuda":
    case "nvidia-cuda-legacy":
    case "nvidia-tensorrt":
    case "apple-mps":
    case "amd-rocm":
    case "intel-openvino":
      return normalized;
    default:
      return "auto";
  }
};

const createMiniBackendProfileResolver = (deps: {
  resolveDesktopEnvValue: (key: string) => string | null;
  runtimeStore: MiniBackendRuntimeStore;
  collectGpuVendors: () => Promise<string[]>;
}) => {
  const resolveMiniBackendAccelerationProfile = async (
    { silent = false, ignoreManualSelection = false }: { silent?: boolean; ignoreManualSelection?: boolean } = {},
  ): Promise<MiniBackendAccelerationProfile> => {
    const envOverrideProfile = normalizeAccelerationProfileOverride(
      deps.resolveDesktopEnvValue("MINI_BACKEND_ACCELERATION_PROFILE")
      ?? process.env.MINI_BACKEND_ACCELERATION_PROFILE,
    );
    const selectedRuntime = readMiniBackendRuntimeSelection(app.getPath("userData"));
    const overrideProfile = resolveRequestedRuntimeProfile({
      envOverrideProfile,
      selectedProfile: selectedRuntime?.profile ?? null,
      ignoreManualSelection,
    });
    const gpuVendors = await deps.collectGpuVendors();
    const profile = resolveAccelerationProfile({
      platform: process.platform,
      arch: process.arch,
      overrideProfile,
      gpuVendors,
    });
    if (!silent) {
      deps.runtimeStore.patch({
        status: "resolving",
        statusMessage: "Detecting the best local runtime profile.",
        requestedProfile: profile,
        attempt: 0,
        maxAttempts: 0,
        progress: null,
      });
    }
    return profile;
  };

  return { resolveMiniBackendAccelerationProfile };
};

export {
  createMiniBackendProfileResolver,
  normalizeAccelerationProfileOverride,
};
