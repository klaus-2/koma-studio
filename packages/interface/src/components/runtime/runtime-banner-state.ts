import type { DesktopMiniBackendRuntimeState } from "../../types";

export interface RuntimeBannerToast {
  title: string;
  description: string;
}

export const buildRuntimeBannerToast = (
  runtimeState: DesktopMiniBackendRuntimeState | null,
  showReadyNotice: boolean,
): RuntimeBannerToast | null => {
  if (!runtimeState) {
    return null;
  }

  if (runtimeState.status === "fallback") {
    return null;
  }

  if (runtimeState.status === "error") {
    return {
      title: "Runtime startup failed",
      description: runtimeState.statusMessage ?? runtimeState.lastError ?? "Mini backend startup failed.",
    };
  }

  if (showReadyNotice && runtimeState.source === "downloaded-runtime") {
    return {
      title: "Runtime ready",
      description: `${runtimeState.activeProfile} runtime installed and ready to use.`,
    };
  }

  return null;
};
