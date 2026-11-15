import {
  useAioBatchPauseStore,
  type AioBatchPauseStore,
} from '@/pages/dashboard/stores/aio-batch-pause-store';

export interface BatchPauseGate {
  waitAtBoundary: () => Promise<void>;
  notifyBoundaryReached: () => void;
}

export function createBatchPauseGate(signal?: AbortSignal): BatchPauseGate {
  const notifyBoundaryReached = (): void => {
    useAioBatchPauseStore.getState().markPaused();
  };

  const waitAtBoundary = async (): Promise<void> => {
    const initial = useAioBatchPauseStore.getState();
    if (signal?.aborted) {
      return;
    }
    if (!initial.pauseRequested && !initial.isPaused) {
      return;
    }
    notifyBoundaryReached();

    const store = useAioBatchPauseStore;
    if (!store.getState().isPaused) {
      return;
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        unsubscribeStore();
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const onState = (state: AioBatchPauseStore): void => {
        if (!state.isPaused) {
          finish();
        }
      };
      const unsubscribeStore = store.subscribe(onState);
      signal?.addEventListener('abort', finish, { once: true });
      if (!store.getState().isPaused) {
        finish();
      }
    });
  };

  return { waitAtBoundary, notifyBoundaryReached };
}
