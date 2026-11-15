import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { AioBatchProgress } from '@/pages/dashboard/lib/aio-batch-progress';

interface EconomicUiStore {
  hidden: boolean;
  pendingStatusMessage: string | null;
  pendingBatchProgress: AioBatchProgress | null;
  markHidden: () => void;
  markVisible: () => void;
  stageStatusMessage: (message: string) => boolean;
  stageBatchProgress: (progress: AioBatchProgress) => boolean;
  clearPending: () => void;
}

export const useEconomicUiStore = create<EconomicUiStore>()(
  devtools(
    (set, get) => ({
      hidden: false,
      pendingStatusMessage: null,
      pendingBatchProgress: null,
      markHidden: () => set({ hidden: true }),
      markVisible: () => set({ hidden: false }),
      stageStatusMessage: (message) => {
        if (!get().hidden) {
          return false;
        }
        set({ pendingStatusMessage: message });
        return true;
      },
      stageBatchProgress: (progress) => {
        if (!get().hidden) {
          return false;
        }
        set({ pendingBatchProgress: progress });
        return true;
      },
      clearPending: () =>
        set({ pendingStatusMessage: null, pendingBatchProgress: null }),
    }),
    { name: 'economic-ui-store' },
  ),
);
