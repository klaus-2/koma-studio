import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { DEFAULT_APP_LOCALE } from '../../../i18n/config';
import { translateMessage } from '../../../i18n/messages';
import {
  loadWorkspaceAutosaveSettings,
  type WorkspaceAutosaveSettings,
} from '../../../utils/workspaceAutosaveSettings';
import type { DashboardWorkspaceCaptureState } from '../../../workspace/dashboardWorkspace';

export type WorkspaceStatus = 'idle' | 'saving' | 'saved' | 'error';

type SaveWorkspaceAutosaveFn = (
  captureStateOverride?: DashboardWorkspaceCaptureState | null,
) => Promise<boolean>;

interface WorkspacePersistenceStore {
  /* ── Footer workspace status ── */
  workspaceStatus: WorkspaceStatus;
  workspaceStatusDetail: string;
  workspaceLastSavedAt: number | null;

  /* ── Hydration / autosave settings / workspace re-init token ── */
  workspaceHydrated: boolean;
  workspaceAutosaveSettings: WorkspaceAutosaveSettings;
  workspaceRestoreToken: number;

  /* Internal persistence machinery (non-reactive; mirrors the old page refs).
     Mutated in place via getState() — same non-notifying semantics the refs
     had; nobody subscribes to these fields. */
  workspaceHistoryReady: boolean;
  workspaceHistorySignature: string | null;
  workspaceAutosaveSignature: string | null;
  workspaceAutosaveInterval: number | null;
  workspaceAutosaveDirty: boolean;
  workspaceAutosaveSaving: boolean;
  latestWorkspaceCaptureState: DashboardWorkspaceCaptureState | null;
  saveWorkspaceAutosaveImpl: SaveWorkspaceAutosaveFn;

  setWorkspaceStatus: (status: WorkspaceStatus) => void;
  setWorkspaceStatusDetail: (detail: string) => void;
  setWorkspaceLastSavedAt: (savedAt: number | null) => void;
  setWorkspaceHydrated: (hydrated: boolean) => void;
  setWorkspaceAutosaveSettings: (settings: WorkspaceAutosaveSettings) => void;
  setWorkspaceRestoreToken: (
    token: number | ((prev: number) => number),
  ) => void;
}

export const useWorkspacePersistenceStore =
  create<WorkspacePersistenceStore>()(
    devtools(
      (set) => ({
        // Same lookup the page's first render performed for every locale
        // (status-store precedent): only the default (en) catalog is
        // available synchronously, so the chain resolves to it.
        workspaceStatus: 'idle',
        workspaceStatusDetail: translateMessage(
          DEFAULT_APP_LOCALE,
          'dashboard.workspace.pendingChanges',
        ),
        workspaceLastSavedAt: null,
        workspaceHydrated: false,
        // Same load the page's lazy useState initializer performed — the util
        // is a synchronous localStorage read with an SSR guard.
        workspaceAutosaveSettings: loadWorkspaceAutosaveSettings(),
        workspaceRestoreToken: 0,

        workspaceHistoryReady: false,
        workspaceHistorySignature: null,
        workspaceAutosaveSignature: null,
        workspaceAutosaveInterval: null,
        workspaceAutosaveDirty: false,
        workspaceAutosaveSaving: false,
        latestWorkspaceCaptureState: null,
        // Same no-op the page ref started with until effect 44 mirrors the
        // latest saveWorkspaceAutosave implementation into it.
        saveWorkspaceAutosaveImpl: async () => false,

        setWorkspaceStatus: (workspaceStatus) =>
          set({ workspaceStatus }),
        setWorkspaceStatusDetail: (workspaceStatusDetail) =>
          set({ workspaceStatusDetail }),
        setWorkspaceLastSavedAt: (workspaceLastSavedAt) =>
          set({ workspaceLastSavedAt }),
        setWorkspaceHydrated: (workspaceHydrated) =>
          set({ workspaceHydrated }),
        setWorkspaceAutosaveSettings: (workspaceAutosaveSettings) =>
          set({ workspaceAutosaveSettings }),
        setWorkspaceRestoreToken: (token) =>
          set((state) => ({
            workspaceRestoreToken:
              typeof token === 'function'
                ? token(state.workspaceRestoreToken)
                : token,
          })),
      }),
      { name: 'workspace-persistence-store' },
    ),
  );
