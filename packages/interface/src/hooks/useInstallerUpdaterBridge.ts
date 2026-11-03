import { useEffect, useRef, useState } from "react";

import { desktopBridge } from "@/lib/desktop-bridge";

import type { IUpdaterBridge } from "@shared/desktop-api";
import type {
  UpdaterEventPayload,
  UpdaterState,
  UpdaterStatus,
} from "../types";

export interface InstallerUpdaterBridgeHandle {
  autoInstallSupported: boolean;
  updaterBridgeRef: React.RefObject<IUpdaterBridge | null>;
}

interface UseInstallerUpdaterBridgeOptions {
  patchState: (patch: Partial<UpdaterState>) => void;
  statusRef: React.RefObject<UpdaterStatus>;
  installStagedUpdate: (bridge: IUpdaterBridge) => void;
}

export const useInstallerUpdaterBridge = (
  options: UseInstallerUpdaterBridgeOptions,
): InstallerUpdaterBridgeHandle => {
  const { patchState, statusRef, installStagedUpdate } = options;
  const [autoInstallSupported, setAutoInstallSupported] = useState(false);
  const updaterBridgeRef = useRef<IUpdaterBridge | null>(null);

  useEffect(() => {
    const bridge = desktopBridge.updater;
    if (!bridge) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const handleUpdaterEvent = (payload: UpdaterEventPayload): void => {
      if (payload.event === "progress") {
        patchState({
          status: "downloading",
          progress: payload.state.progress,
          error: null,
        });
        return;
      }
      if (payload.event === "downloaded") {
        patchState({
          status: "downloaded",
          progress: payload.state.progress,
          downloadedAt: payload.state.downloadedAt,
        });
        installStagedUpdate(bridge);
        return;
      }
      if (
        payload.event === "error" &&
        (statusRef.current === "downloading" || statusRef.current === "downloaded")
      ) {
        patchState({
          status: "error",
          error: payload.state.error,
        });
      }
    };

    void bridge.getState().then((bridgeState) => {
      if (cancelled || !bridgeState) {
        return;
      }
      updaterBridgeRef.current = bridge;
      setAutoInstallSupported(true);
      if (
        bridgeState.status === "downloading" ||
        bridgeState.status === "downloaded" ||
        bridgeState.status === "error"
      ) {
        patchState({
          status: bridgeState.status,
          progress: bridgeState.progress,
          downloadedAt: bridgeState.downloadedAt,
          error: bridgeState.error,
        });
      }
      if (bridgeState.status === "downloaded") {
        installStagedUpdate(bridge);
      }
      unsubscribe = bridge.on(handleUpdaterEvent);
    }).catch((error: unknown) => {
      console.warn("[updater] installer bridge getState failed:", error);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { autoInstallSupported, updaterBridgeRef };
};
