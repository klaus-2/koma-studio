import type {
  DesktopBatchPhase,
  DesktopBatchStatePayload,
} from "../../../../packages/types/src/desktop-api.ts";

export interface BatchShellState {
  phase: DesktopBatchPhase;
  done: number;
  total: number;
  label: string | null;
  dirty: boolean;
  forceClose: boolean;
  blockerId: number | null;
}

export type PowerSaveBlockerType = "prevent-app-suspension";

export interface Blocker {
  start(type: PowerSaveBlockerType): number;
  stop(id: number): void;
}

export type BatchTrayAction = "pause" | "resume";

export type BatchShellStateListener = (state: BatchShellState) => void;

export const BATCH_TRAY_ACTION_EVENT_CHANNEL = "desktop:batch:tray-action";
export const CLOSE_REQUESTED_EVENT_CHANNEL = "desktop:window:close-requested";

const BATCH_TRAY_APP_NAME = "KŌMA";

const isBatchPhase = (value: string): value is DesktopBatchPhase =>
  value === "idle" || value === "running" || value === "paused" || value === "error";

export const createBatchShellState = (): BatchShellState => ({
  phase: "idle",
  done: 0,
  total: 0,
  label: null,
  dirty: false,
  forceClose: false,
  blockerId: null,
});

export const parseBatchStatePayload = (value: unknown): DesktopBatchStatePayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.phase !== "string" || !isBatchPhase(payload.phase)) {
    return null;
  }
  if (typeof payload.done !== "number" || !Number.isFinite(payload.done)) {
    return null;
  }
  if (typeof payload.total !== "number" || !Number.isFinite(payload.total)) {
    return null;
  }
  return {
    phase: payload.phase,
    done: payload.done,
    total: payload.total,
    label: typeof payload.label === "string" ? payload.label : null,
  };
};

const sanitizeBatchCount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

export const applyBatchState = (
  state: BatchShellState,
  payload: DesktopBatchStatePayload,
): BatchShellState => ({
  ...state,
  phase: payload.phase,
  done: sanitizeBatchCount(payload.done),
  total: sanitizeBatchCount(payload.total),
  label:
    typeof payload.label === "string" && payload.label.trim().length > 0
      ? payload.label.trim()
      : null,
});

export const applyDirtyFlag = (state: BatchShellState, dirty: boolean): BatchShellState => ({
  ...state,
  dirty,
});

export const setForceClose = (state: BatchShellState, forceClose: boolean): BatchShellState => ({
  ...state,
  forceClose,
});

export const consumeForceClose = (state: BatchShellState): BatchShellState =>
  setForceClose(state, false);

export const shouldPreventClose = (state: BatchShellState, forceClose: boolean): boolean =>
  !forceClose && (state.phase !== "idle" || state.dirty);

export const keepAwakeDesired = (state: BatchShellState): boolean => state.phase === "running";

export const syncKeepAwakeWithState = (
  state: BatchShellState,
  blocker: Blocker,
): BatchShellState => {
  const desired = keepAwakeDesired(state);
  if (desired) {
    if (state.blockerId !== null) {
      return state;
    }
    return { ...state, blockerId: blocker.start("prevent-app-suspension") };
  }
  if (state.blockerId !== null) {
    blocker.stop(state.blockerId);
    return { ...state, blockerId: null };
  }
  return state;
};

export const formatBatchTrayTooltip = (state: BatchShellState): string => {
  if ((state.phase === "running" || state.phase === "paused") && state.total > 0) {
    const ratio = Math.min(Math.max(state.done / state.total, 0), 1);
    const percent = Math.round(ratio * 100);
    return `${BATCH_TRAY_APP_NAME} — ${state.done}/${state.total} (${percent}%)`;
  }
  return BATCH_TRAY_APP_NAME;
};

export const formatBatchTrayPauseLabel = (state: BatchShellState): string =>
  state.phase === "paused" ? "Resume batch" : "Pause batch";

export const resolveBatchTrayAction = (state: BatchShellState): BatchTrayAction =>
  state.phase === "paused" ? "resume" : "pause";

let batchShellState = createBatchShellState();

const batchShellStateListeners = new Set<BatchShellStateListener>();

export const getBatchShellState = (): BatchShellState => batchShellState;

export const commitBatchShellState = (nextState: BatchShellState): BatchShellState => {
  batchShellState = nextState;
  batchShellStateListeners.forEach((listener) => {
    try {
      listener(nextState);
    } catch (error) {
      console.warn("[batch-state] state listener failed:", error);
    }
  });
  return nextState;
};

export const subscribeToBatchShellState = (listener: BatchShellStateListener): (() => void) => {
  batchShellStateListeners.add(listener);
  return () => {
    batchShellStateListeners.delete(listener);
  };
};

export interface CloseGuardWindow {
  isDestroyed(): boolean;
  webContents: { send(channel: string, payload: unknown): void };
  on(event: "close", listener: (event: { preventDefault(): void }) => void): unknown;
}

export const registerMainWindowCloseGuard = (
  window: CloseGuardWindow,
  deps: { isAppExiting(): boolean },
): void => {
  window.on("close", (event) => {
    const state = getBatchShellState();
    if (shouldPreventClose(state, state.forceClose) && !deps.isAppExiting()) {
      event.preventDefault();
      if (!window.isDestroyed()) {
        window.webContents.send(CLOSE_REQUESTED_EVENT_CHANNEL, {
          hasUnsavedWork: state.dirty,
          batchRunning: state.phase === "running" || state.phase === "paused",
        });
      }
      return;
    }
    commitBatchShellState(consumeForceClose(state));
  });
};
