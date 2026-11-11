import { useCallback, useEffect, useMemo, useState } from "react";
import { desktopBridge } from "@/lib/desktop-bridge";
import { type UpdaterSyncState, parseUpdaterSyncState, createInitialUpdaterSyncState } from "@shared/updaterSync";

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

// UpdaterSyncState has no percent field: observable activity is the phase,
// each step's state, the list lengths and the timestamps. Bridge events that
// only re-emit the same snapshot (log lines unchanged, steps unchanged) then
// reuse the previous state reference and skip the re-render entirely. The
// log is a capped rolling buffer — once saturated, appends drop the oldest
// line and the length stops changing — so the comparison adds its first and
// last lines as content sentinels; dirtyFiles is small enough to join.
export const updaterSyncStateEquivalent = (
  left: UpdaterSyncState,
  right: UpdaterSyncState,
): boolean =>
  left === right ||
  (left.phase === right.phase &&
    left.error === right.error &&
    left.startedAt === right.startedAt &&
    left.finishedAt === right.finishedAt &&
    left.dirtyFiles.length === right.dirtyFiles.length &&
    left.logLines.length === right.logLines.length &&
    left.steps.length === right.steps.length &&
    left.steps.every(
      (step, index) =>
        step.id === right.steps[index]?.id && step.state === right.steps[index]?.state,
    ) &&
    left.logLines[0] === right.logLines[0] &&
    left.logLines[left.logLines.length - 1] === right.logLines[right.logLines.length - 1] &&
    left.dirtyFiles.join("\n") === right.dirtyFiles.join("\n"));

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
      const next = parseUpdaterSyncState(rawState) ?? createInitialUpdaterSyncState();
      setState((previous) => (updaterSyncStateEquivalent(previous, next) ? previous : next));
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
