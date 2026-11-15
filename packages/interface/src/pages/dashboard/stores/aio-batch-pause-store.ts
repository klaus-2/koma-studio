import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

export type AioBatchPausePhase = 'idle' | 'draining' | 'paused';

export interface AioBatchPauseStore {
  pauseRequested: boolean;
  isPaused: boolean;
  pausePhase: AioBatchPausePhase;
  pauseConsolidatedImageIds: ReadonlySet<string>;
  requestPause: () => void;
  markPaused: () => void;
  recordPauseConsolidatedImageIds: (imageIds: readonly string[]) => void;
  resume: () => void;
  reset: () => void;
}

export const useAioBatchPauseStore = create<AioBatchPauseStore>()(
  devtools(
    (set) => ({
      pauseRequested: false,
      isPaused: false,
      pausePhase: 'idle',
      pauseConsolidatedImageIds: new Set<string>(),

      requestPause: () => {
        if (!useUiShellStore.getState().processing) {
          return;
        }
        set((state) =>
          state.pauseRequested || state.isPaused
            ? state
            : { pauseRequested: true, pausePhase: 'draining' },
        );
      },

      markPaused: () => {
        set((state) =>
          state.pauseRequested && state.pausePhase === 'draining'
            ? { pausePhase: 'paused', isPaused: true }
            : state,
        );
      },

      recordPauseConsolidatedImageIds: (imageIds) => {
        set((state) => ({
          pauseConsolidatedImageIds: new Set([
            ...state.pauseConsolidatedImageIds,
            ...imageIds,
          ]),
        }));
      },

      resume: () => {
        set((state) =>
          state.pauseRequested || state.isPaused
            ? {
                pauseRequested: false,
                isPaused: false,
                pausePhase: 'idle' as AioBatchPausePhase,
              }
            : state,
        );
      },

      reset: () =>
        set({
          pauseRequested: false,
          isPaused: false,
          pausePhase: 'idle' as AioBatchPausePhase,
          pauseConsolidatedImageIds: new Set<string>(),
        }),
    }),
    { name: 'aio-batch-pause-store' },
  ),
);
