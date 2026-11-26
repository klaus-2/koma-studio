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
}

export const useInstallerUpdaterBridge = (
  options: UseInstallerUpdaterBridgeOptions,
): InstallerUpdaterBridgeHandle => {
  const { patchState, statusRef } = options;
  const [autoInstallSupported, setAutoInstallSupported] = useState(false);
  const updaterBridgeRef = useRef<IUpdaterBridge | null>(null);

  useEffect(() => {
    const bridge = desktopBridge.updater;
    if (!bridge) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let ackRafId = 0;

    const handleUpdaterEvent = (payload: UpdaterEventPayload): void => {
      if (payload.event === "checking") {
        patchState({
          status: "checking",
          error: null,
          progress: null,
          checkedAt: payload.state.checkedAt,
        });
        return;
      }
      if (payload.event === "available") {
        patchState({
          status: "available",
          newVersion: payload.state.newVersion,
          mandatory: payload.state.mandatory,
          blocking: payload.state.blocking,
          blockingReason: payload.state.blockingReason,
          releaseNotes: payload.state.releaseNotes,
          checkedAt: payload.state.checkedAt,
          error: null,
        });
        return;
      }
      if (payload.event === "not-available") {
        patchState({
          status: "not-available",
          currentVersion: payload.state.currentVersion,
          newVersion: null,
          mandatory: false,
          blocking: false,
          blockingReason: null,
          releaseNotes: null,
          progress: null,
          downloadedAt: null,
          checkedAt: payload.state.checkedAt,
          error: null,
        });
        return;
      }
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
          error: null,
        });
        return;
      }
      if (
        payload.event === "error" &&
        (statusRef.current === "downloading" ||
          statusRef.current === "downloaded" ||
          statusRef.current === "checking")
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
      patchState({
        autoInstallOnQuit: bridgeState.autoInstallOnQuit,
        ...(bridgeState.currentVersion ? { currentVersion: bridgeState.currentVersion } : {}),
      });
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
      unsubscribe = bridge.on(handleUpdaterEvent);
      if (bridge.ackUiReady) {
        ackRafId = requestAnimationFrame(() => {
          void bridge.ackUiReady?.().catch(() => {});
        });
      }
    }).catch((error: unknown) => {
      console.warn("[updater] installer bridge getState failed:", error);
    });

    return () => {
      cancelled = true;
      if (ackRafId !== 0) {
        cancelAnimationFrame(ackRafId);
      }
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { autoInstallSupported, updaterBridgeRef };
};
