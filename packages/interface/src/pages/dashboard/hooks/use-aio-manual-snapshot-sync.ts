import { useEffect } from 'react';

import { reportAioEvent } from '@/pages/dashboard/lib/aio-observability';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';

interface UseAioManualSnapshotSyncArgs {
  readonly enabled: boolean;
  readonly activeId: string | null;
  readonly synchronize: () => void;
}

export function useAioManualSnapshotSync({
  enabled,
  activeId,
  synchronize,
}: UseAioManualSnapshotSyncArgs): void {
  useEffect(() => {
    if (!enabled || !activeId) {
      return;
    }

    let disposed = false;
    let scheduled = false;
    let synchronizing = false;

    const synchronizeSafely = (): void => {
      if (disposed || synchronizing) {
        return;
      }

      synchronizing = true;

      try {
        synchronize();
      } catch {
        reportAioEvent('manual-snapshot-sync-failed', { scope: 'manual' });
      } finally {
        synchronizing = false;
      }
    };

    const schedule = (): void => {
      if (disposed || scheduled || synchronizing) {
        return;
      }

      scheduled = true;

      queueMicrotask(() => {
        scheduled = false;
        synchronizeSafely();
      });
    };

    const unsubscribePipeline = useAioPipelineStore.subscribe(
      (state, previous) => {
        if (
          state.aioPipelineSnapshots !== previous.aioPipelineSnapshots ||
          state.aioPipelineSnapshotIndex !==
            previous.aioPipelineSnapshotIndex ||
          state.aioImageSnapshotIndexById !==
            previous.aioImageSnapshotIndexById ||
          state.aioManualProgressByImage !==
            previous.aioManualProgressByImage ||
          state.aioAutoProcessedImageById !==
            previous.aioAutoProcessedImageById
        ) {
          schedule();
        }
      },
    );

    const unsubscribeRegions = useRegionEditorStore.subscribe(schedule);

    synchronizeSafely();

    return () => {
      disposed = true;
      unsubscribePipeline();
      unsubscribeRegions();
    };
  }, [activeId, enabled, synchronize]);
}
