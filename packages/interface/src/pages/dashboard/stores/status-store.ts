import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { DEFAULT_APP_LOCALE } from '../../../i18n/config';
import { translateMessage } from '../../../i18n/messages';
import type {
  RuntimeExecutionNotice,
  StatusMessageTone,
} from '../../../types/dashboard.types';

interface StatusStore {
  /* ── Footer status ── */
  statusMessage: string;
  statusMessageTone: StatusMessageTone;
  /** True while the last message was written with an explicit tone (setTonedStatus). */
  statusToneExplicit: boolean;

  /* ── Backend runtime banner ── */
  runtimeExecutionNotice: RuntimeExecutionNotice | null;

  setStatusMessage: (message: string) => void;
  setStatusMessageTone: (tone: StatusMessageTone) => void;
  setTonedStatus: (message: string, tone: StatusMessageTone) => void;
  clearStatusToneExplicit: () => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
}

export const useStatusStore = create<StatusStore>()(
  devtools(
    (set) => ({
      // Same lookup the page's first render performed for every locale: only the
      // default (en) catalog is available synchronously, so the chain resolves to it.
      statusMessage: translateMessage(
        DEFAULT_APP_LOCALE,
        'dashboard.status.ready',
      ),
      statusMessageTone: 'info',
      statusToneExplicit: false,
      runtimeExecutionNotice: null,

      setStatusMessage: (message) => set({ statusMessage: message }),
      setStatusMessageTone: (tone) => set({ statusMessageTone: tone }),
      setTonedStatus: (message, tone) =>
        set({
          statusMessage: message,
          statusMessageTone: tone,
          statusToneExplicit: true,
        }),
      clearStatusToneExplicit: () => set({ statusToneExplicit: false }),
      setRuntimeExecutionNotice: (notice) =>
        set({ runtimeExecutionNotice: notice }),
    }),
    { name: 'status-store' },
  ),
);
