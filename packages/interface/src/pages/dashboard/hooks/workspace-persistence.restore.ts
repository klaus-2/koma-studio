/**
 * Workspace restore — applies a DashboardWorkspaceRestoreState back onto every
 * domain store (mode/collection/downloads, AIO, cleaner, translator,
 * typesetter, enhance, utility, LLM profiles & drafts). Split out of
 * workspace-persistence.ts; the entry file keeps the orchestration.
 *
 * The ordered apply itself lives in the per-slice registry
 * (workspace-persistence.registry.ts): one getState()-driven plan replaces the
 * hand-written setter sequence and its baseline deps array, so the callback
 * deps shrink to the hook-level collaborators (zustand setters are stable
 * identities — the previous hook-captured setters were identical values).
 */
import { useCallback } from 'react';
import { useI18n } from '../../../i18n';
import type { FreeProviderDraftMap } from '../../../types/dashboard.types';
import type { DashboardWorkspaceRestoreState } from '../../../workspace/dashboardWorkspace';
import { applyRestoredWorkspaceToStores } from './workspace-persistence.registry';

interface UseWorkspaceRestoreStateArgs {
  /* Cross-domain (capture module + typographer workspace handle) */
  releaseWorkspaceObjectUrls: () => void;
  typographerWorkspace: ReturnType<typeof import('./typographer').useTypographerWorkspace>;
  setFreeProviderDrafts: (value: FreeProviderDraftMap) => void;
}

/**
 * Applies a restored workspace document to every store through the registry
 * plan. The callback deps are the hook-level collaborators only — the registry
 * owns every store write.
 */
export function useWorkspaceRestoreState({
  releaseWorkspaceObjectUrls,
  typographerWorkspace,
  setFreeProviderDrafts,
}: UseWorkspaceRestoreStateArgs) {
  const { t } = useI18n();

  const applyRestoredWorkspaceState = useCallback(
    async (
      restored: DashboardWorkspaceRestoreState,
      options?: { statusDetail?: string },
    ) => {
      applyRestoredWorkspaceToStores(restored, {
        releaseWorkspaceObjectUrls,
        typographerWorkspace,
        setFreeProviderDrafts,
        statusMessageFallback: t('dashboard.status.workspaceRestored'),
        statusDetail: options?.statusDetail,
      });
    },
    [
      releaseWorkspaceObjectUrls,
      setFreeProviderDrafts,
      t,
      typographerWorkspace,
    ],
  );

  return { applyRestoredWorkspaceState };
}
