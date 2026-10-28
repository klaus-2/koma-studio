import { useEffect } from 'react';

import {
  BATCH_THREADS_COUNT_STORAGE_KEY,
  BATCH_THREADS_ENABLED_STORAGE_KEY,
  clampBatchThreads,
} from '../../../utils/concurrentBatch';
import { loadWorkspaceAutosaveSettings } from '../../../utils/workspaceAutosaveSettings';
import type { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';

type WorkspacePersistenceState = ReturnType<
  typeof useWorkspacePersistenceStore.getState
>;

export interface UseDashboardPersistedSettingsArgs {
  readonly batchThreadsEnabled: boolean;
  readonly batchThreads: number;
  readonly setWorkspaceAutosaveSettings: WorkspacePersistenceState['setWorkspaceAutosaveSettings'];
}

/**
 * Mirrors the batch-thread settings into local storage and keeps the workspace
 * autosave settings in sync with the settings screen.
 */
export function useDashboardPersistedSettings({
  batchThreadsEnabled,
  batchThreads,
  setWorkspaceAutosaveSettings,
}: UseDashboardPersistedSettingsArgs): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      BATCH_THREADS_ENABLED_STORAGE_KEY,
      String(batchThreadsEnabled),
    );
  }, [batchThreadsEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      BATCH_THREADS_COUNT_STORAGE_KEY,
      String(clampBatchThreads(batchThreads)),
    );
  }, [batchThreads]);

  useEffect(() => {
    const syncWorkspaceAutosaveSettings = () => {
      setWorkspaceAutosaveSettings(loadWorkspaceAutosaveSettings());
    };

    window.addEventListener(
      'koma:workspace-autosave-settings-changed',
      syncWorkspaceAutosaveSettings,
    );
    window.addEventListener('focus', syncWorkspaceAutosaveSettings);
    return () => {
      window.removeEventListener(
        'koma:workspace-autosave-settings-changed',
        syncWorkspaceAutosaveSettings,
      );
      window.removeEventListener('focus', syncWorkspaceAutosaveSettings);
    };
  }, [setWorkspaceAutosaveSettings]);
}
