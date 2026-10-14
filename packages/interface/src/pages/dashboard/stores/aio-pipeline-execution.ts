import { desktopBridge } from '@/lib/desktop-bridge';
import { reportAioEvent } from '@/pages/dashboard/lib/aio-observability';
import { createAioAbortError } from '@/pages/dashboard/lib/run-aio-batch';
import type {
  AioExecutionActions,
  AioPipelineStore,
  SetAioPipelineState,
} from '@/pages/dashboard/stores/aio-pipeline-store.types';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

export function createAioExecutionActions(
  set: SetAioPipelineState,
  get: () => AioPipelineStore,
): AioExecutionActions {
  return {
    clearAioExecutionState: (expectedController) => {
      const current = get().aioAbortController;

      if (expectedController && current !== expectedController) {
        return;
      }

      if (current && !current.signal.aborted) {
        current.abort(createAioAbortError());
      }

      set({
        aioAbortController: null,
        aioExecutionStatus: null,
        aioExecutionProgress: {
          totalUnits: 1,
          completedUnits: new Set<string>(),
        },
      });
    },

    getActiveAioAbortSignal: () => get().aioAbortController?.signal ?? null,

    beginAioExecution: (scope, totalImages, stageKeys, label) => {
      const state = get();

      if (state.aioAbortController || state.aioBackendRestarting) {
        throw new Error(
          'An AIO execution or backend restart is already active.',
        );
      }

      if (
        !Number.isSafeInteger(totalImages) ||
        totalImages < 1 ||
        stageKeys.length === 0
      ) {
        throw new RangeError('An AIO execution requires images and stages.');
      }

      const controller = new AbortController();
      const stageCount = new Set(stageKeys).size;

      set({
        aioAbortController: controller,
        aioExecutionId: state.aioExecutionId + 1,
        aioExecutionProgress: {
          totalUnits: totalImages * stageCount,
          completedUnits: new Set<string>(),
        },
        aioExecutionStatus: {
          scope,
          stageKey: null,
          imageName: null,
          imageIndex: null,
          totalImages,
          label,
        },
      });

      return controller;
    },

    updateAioExecutionStage: (
      scope,
      stageKey,
      image,
      index,
      totalImages,
      stageProgressLabel,
    ) => {
      const state = get();

      if (
        !state.aioAbortController ||
        state.aioAbortController.signal.aborted ||
        state.aioExecutionStatus?.scope !== scope
      ) {
        return;
      }

      const imageOrdinal = Math.max(1, index + 1);
      const unitKey = `${image.id}:${stageKey}`;
      const tracker = state.aioExecutionProgress;

      if (scope === 'auto' && !tracker.completedUnits.has(unitKey)) {
        tracker.completedUnits.add(unitKey);

        // onStageStart representa início, não conclusão; 100% é exclusivo do lote.
        const startedBeforeCurrent = Math.max(
          0,
          tracker.completedUnits.size - 1,
        );

        useUiShellStore
          .getState()
          .setProgress(
            Math.min(99, (startedBeforeCurrent / tracker.totalUnits) * 100),
          );
      }

      const suffix =
        totalImages > 1
          ? ` ${imageOrdinal}/${totalImages} · ${image.file.name}`
          : ` · ${image.file.name}`;

      set({
        aioExecutionStatus: {
          scope,
          stageKey,
          imageName: image.file.name,
          imageIndex: imageOrdinal,
          totalImages,
          label: `${stageProgressLabel}${suffix}`,
        },
      });
    },

    stopAioExecution: ({
      stopping,
      abortedByUser,
      restartSucceeded,
      restartFailed,
      totalImages,
      isDesktopRuntime,
    }) => {
      const state = get();
      const controller = state.aioAbortController;

      if (!controller || controller.signal.aborted) {
        return;
      }

      const executionId = state.aioExecutionId;

      set({
        aioExecutionStatus: state.aioExecutionStatus
          ? { ...state.aioExecutionStatus, label: stopping }
          : {
              scope: 'auto',
              stageKey: null,
              imageName: null,
              imageIndex: null,
              totalImages,
              label: stopping,
            },
      });

      useStatusStore.getState().setTonedStatus(stopping, 'warning');
      controller.abort(new DOMException(abortedByUser, 'AbortError'));

      const desktop = desktopBridge.desktop;

      if (!isDesktopRuntime || !desktop?.restartLocalBackend) {
        return;
      }

      set({ aioBackendRestarting: true });

      void (async (): Promise<void> => {
        let restarted = false;

        try {
          restarted = Boolean(await desktop.restartLocalBackend?.());
        } catch {
          reportAioEvent('backend-restart-failed');
        } finally {
          set({ aioBackendRestarting: false });
        }

        if (get().aioExecutionId === executionId) {
          useStatusStore.getState().setTonedStatus(
            restarted ? restartSucceeded : restartFailed,
            'warning',
          );
        }
      })();
    },
  };
}
