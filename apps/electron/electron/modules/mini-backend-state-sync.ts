/**
 * Sync mini-backend runtime profile state from /device/info.
 */
import {
  formatRuntimeFallbackReason,
  resolveEffectiveAccelerationProfile,
  type MiniBackendAccelerationProfile,
} from "../mini-backend-runtime.ts";
import { normalizeAccelerationProfileOverride } from "./mini-backend-profile.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";
import { LOCAL_API_SESSION_HEADER } from "./desktop-auth-constants.ts";

interface MiniBackendDeviceInfoPayload {
  profile?: string;
  active_profile?: string;
  provider?: string;
  fallback_reason?: string | null;
  name?: string;
  vram_gb?: number;
}

const createMiniBackendStateSync = (deps: {
  getLocalApiUrl: () => string;
  getLocalApiSessionSecret: () => string;
  runtimeStore: MiniBackendRuntimeStore;
}) => {
  const syncMiniBackendRuntimeStateFromApi = async (): Promise<void> => {
    const localApiUrl = deps.getLocalApiUrl();
    const localApiSessionSecret = deps.getLocalApiSessionSecret();
    if (!localApiUrl || !localApiSessionSecret) {
      return;
    }

    try {
      const response = await fetch(`${localApiUrl}/device/info`, {
        method: "GET",
        headers: {
          [LOCAL_API_SESSION_HEADER]: localApiSessionSecret,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as MiniBackendDeviceInfoPayload;
      const requestedProfileOverride = normalizeAccelerationProfileOverride(payload.profile);
      const requestedProfile = requestedProfileOverride === "auto"
        ? deps.runtimeStore.getState().requestedProfile
        : (requestedProfileOverride as MiniBackendAccelerationProfile);
      const activeProfileOverride = normalizeAccelerationProfileOverride(payload.active_profile);
      const activeProfile = activeProfileOverride !== "auto"
        ? (activeProfileOverride as MiniBackendAccelerationProfile)
        : resolveEffectiveAccelerationProfile({
          requestedProfile,
          provider: payload.provider,
        });
      const fallbackReason = formatRuntimeFallbackReason(payload.fallback_reason);

      deps.runtimeStore.patch({
        requestedProfile,
        activeProfile,
        lastError: fallbackReason,
        gpuName: typeof payload.name === "string" && payload.name.trim().length > 0 ? payload.name : null,
        vramGb: typeof payload.vram_gb === "number" && payload.vram_gb > 0 ? payload.vram_gb : null,
        status: fallbackReason ? "fallback" : "ready",
        statusMessage: fallbackReason,
      });
    } catch {
      // Best-effort sync only.
    }
  };

  return { syncMiniBackendRuntimeStateFromApi };
};

export { createMiniBackendStateSync };
