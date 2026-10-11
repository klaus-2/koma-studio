import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createInitialUpdaterSyncState,
  parseUpdaterSyncState,
  type UpdaterSyncState,
} from "@shared/updaterSync";

import { desktopBridge } from "@/lib/desktop-bridge";

export interface UseUpdaterSyncApi {
  supported: boolean;
  state: UpdaterSyncState;
  running: boolean;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  rebuildAndRestart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const asSyncState = (value: unknown): UpdaterSyncState =>
  parseUpdaterSyncState(value) ?? createInitialUpdaterSyncState();

export const useUpdaterSync = (): UseUpdaterSyncApi => {
  const bridge = useMemo(() => desktopBridge.updaterSync ?? null, []);
  const [state, setState] = useState<UpdaterSyncState>(createInitialUpdaterSyncState);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    const unsubscribe = bridge.on((payload) => {
      const rawState: unknown =
        payload && typeof payload === "object" ? payload.state : null;
      setState(parseUpdaterSyncState(rawState) ?? createInitialUpdaterSyncState());
    });

    let cancelled = false;
    void bridge
      .getStatus()
      .then((raw) => {
        if (!cancelled) {
          setState(asSyncState(raw));
        }
      })
      .catch(() => {
        // Status fetch failure keeps the idle state; events will re-sync.
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge]);

  const start = useCallback(async () => {
    if (!bridge) {
      return;
    }
    setState(asSyncState(await bridge.start()));
  }, [bridge]);

  const cancel = useCallback(async () => {
    if (!bridge) {
      return;
    }
    setState(asSyncState(await bridge.cancel()));
  }, [bridge]);

  const rebuildAndRestart = useCallback(async () => {
    if (!bridge) {
      return;
    }
    setState(asSyncState(await bridge.rebuildAndRestart()));
  }, [bridge]);

  const refresh = useCallback(async () => {
    if (!bridge) {
      return;
    }
    setState(asSyncState(await bridge.getStatus()));
  }, [bridge]);

  const running = state.phase === "running" || state.phase === "rebuilding" || state.phase === "precheck";

  return {
    supported: bridge !== null,
    state,
    running,
    start,
    cancel,
    rebuildAndRestart,
    refresh,
  };
};
