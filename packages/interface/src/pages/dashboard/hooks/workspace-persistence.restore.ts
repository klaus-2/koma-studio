/**
 * Workspace restore — applies a DashboardWorkspaceRestoreState back onto every
 * domain store (mode/collection/downloads, AIO, cleaner, translator,
 * typesetter, enhance, utility, LLM profiles & drafts). Split out of
 * workspace-persistence.ts; the entry file keeps the orchestration.
 *
 * The ordered apply lives in workspace-persistence.registry.ts: one
 * getState()-driven plan replaces the hand-written setter sequence and its
 * baseline deps array, so the callback deps shrink to the object-URL release
 * helper.
 */
import { useCallback } from 'react';
import { useI18n } from '../../../i18n';
import type { DashboardWorkspaceRestoreState } from '../../../workspace/dashboardWorkspace';
import { applyRestoredWorkspaceToStores } from './workspace-persistence.registry';

interface UseWorkspaceRestoreStateArgs {
  releaseWorkspaceObjectUrls: () => void;
}

/**
 * Applies a restored workspace document to every store through the registry
 * plan. The registry owns every store write.
 */
export function useWorkspaceRestoreState({
  releaseWorkspaceObjectUrls,
}: UseWorkspaceRestoreStateArgs) {
  const { t } = useI18n();

  const applyRestoredWorkspaceState = useCallback(
    async (
      restored: DashboardWorkspaceRestoreState,
      options?: { statusDetail?: string },
    ) => {
      applyRestoredWorkspaceToStores(restored, {
        releaseWorkspaceObjectUrls,
        statusMessageFallback: t('dashboard.status.workspaceRestored'),
        statusDetail:
          options?.statusDetail ?? t('dashboard.status.workspaceRestored'),
      });
    },
    [releaseWorkspaceObjectUrls, t],
  );

  return { applyRestoredWorkspaceState };
}
