import { desktopBridge } from '@/lib/desktop-bridge';
import type {
  DesktopBatchStatePayload,
} from '@shared/desktop-api';
import { useAioBatchPauseStore } from '@/pages/dashboard/stores/aio-batch-pause-store';

export type DesktopBatchBusClock = () => number;

export interface PublishBatchStateOptions {
  readonly now?: DesktopBatchBusClock;
}

interface BatchTrayActionPayload {
  readonly action: 'pause' | 'resume';
}

const PROGRESS_PUBLISH_INTERVAL_MS = 1000;

let lastProgressPublishedAt = Number.NEGATIVE_INFINITY;
let lastSeenDone = 0;
let lastSeenTotal = 0;
let currentPhase: DesktopBatchStatePayload['phase'] = 'idle';
let lastPublishedDirty: boolean | null = null;
let pauseMirrorInstalled = false;
let traySubscriptionInstalled = false;

const logPublishFailure = (message: string, error: unknown): void => {
  const bridge = desktopBridge.desktop;
  bridge
    ?.sessionLog({
      level: 'warn',
      source: 'renderer',
      message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
    })
    ?.catch(() => undefined);
};

const sendBatchState = (state: DesktopBatchStatePayload): void => {
  const bridge = desktopBridge.desktop;
  const setState = bridge?.batch?.setState;
  if (!setState) {
    return;
  }
  try {
    void setState(state).catch((error: unknown) => {
      logPublishFailure('batch state publish failed', error);
    });
  } catch (error: unknown) {
    logPublishFailure('batch state publish failed', error);
  }
};

export const publishBatchState = (
  state: DesktopBatchStatePayload,
  options?: PublishBatchStateOptions,
): void => {
  if (state.phase !== currentPhase) {
    currentPhase = state.phase;
    if (state.phase === 'running') {
      lastSeenDone = state.done;
      lastSeenTotal = state.total;
    }
    sendBatchState(state);
    return;
  }
  if (state.phase !== 'running') {
    sendBatchState(state);
    return;
  }
  lastSeenDone = state.done;
  lastSeenTotal = state.total;
  const now = options?.now?.() ?? Date.now();
  if (now - lastProgressPublishedAt < PROGRESS_PUBLISH_INTERVAL_MS) {
    return;
  }
  lastProgressPublishedAt = now;
  sendBatchState(state);
};

export const setWindowDirty = (dirty: boolean): void => {
  if (lastPublishedDirty === dirty) {
    return;
  }
  lastPublishedDirty = dirty;
  const bridge = desktopBridge.desktop;
  const setDirty = bridge?.windowState?.setDirty;
  if (!setDirty) {
    return;
  }
  try {
    void setDirty({ dirty }).catch((error: unknown) => {
      logPublishFailure('window dirty publish failed', error);
    });
  } catch (error: unknown) {
    logPublishFailure('window dirty publish failed', error);
  }
};

export const publishBatchRunning = (done: number, total: number): void => {
  publishBatchState({ phase: 'running', done, total });
};

export const publishBatchIdle = (done: number, total: number): void => {
  publishBatchState({ phase: 'idle', done, total });
};

export const publishBatchError = (total: number): void => {
  publishBatchState({ phase: 'error', done: 0, total });
};

const installBatchPauseMirror = (): void => {
  if (pauseMirrorInstalled) {
    return;
  }
  pauseMirrorInstalled = true;
  useAioBatchPauseStore.subscribe((state, prev) => {
    if (state.pausePhase === prev.pausePhase) {
      return;
    }
    if (state.pausePhase === 'paused') {
      publishBatchState({
        phase: 'paused',
        done: lastSeenDone,
        total: lastSeenTotal,
      });
      return;
    }
    if (
      prev.pausePhase === 'paused' &&
      state.pausePhase === 'idle' &&
      currentPhase === 'paused'
    ) {
      publishBatchState({
        phase: 'running',
        done: lastSeenDone,
        total: lastSeenTotal,
      });
    }
  });
};

const installBatchTrayActionSubscription = (): void => {
  if (traySubscriptionInstalled) {
    return;
  }
  const bridge = desktopBridge.desktop;
  if (!bridge?.onBatchTrayAction) {
    return;
  }
  traySubscriptionInstalled = true;
  bridge.onBatchTrayAction((payload: BatchTrayActionPayload) => {
    const pause = useAioBatchPauseStore.getState();
    if (payload.action === 'pause') {
      pause.requestPause();
      return;
    }
    pause.resume();
  });
};

export const installDesktopBatchBus = (): void => {
  installBatchPauseMirror();
  installBatchTrayActionSubscription();
};
