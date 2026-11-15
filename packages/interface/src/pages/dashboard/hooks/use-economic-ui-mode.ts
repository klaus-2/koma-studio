import { useEffect } from 'react';

import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useEconomicUiStore } from '@/pages/dashboard/stores/economic-ui-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';

export function useEconomicUiMode(): void {
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        useEconomicUiStore.getState().markHidden();
        return;
      }
      const economic = useEconomicUiStore.getState();
      economic.markVisible();
      const staged = useEconomicUiStore.getState();
      if (staged.pendingStatusMessage !== null) {
        useStatusStore.getState().setStatusMessage(staged.pendingStatusMessage);
      }
      if (staged.pendingBatchProgress !== null) {
        useAioPipelineStore
          .getState()
          .setAioBatchProgress(staged.pendingBatchProgress);
      }
      staged.clearPending();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
