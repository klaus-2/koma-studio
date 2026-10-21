/**
 * Subscribes every domain store to one change callback. Owns its allocations
 * and returns a single unsubscribe-all cleanup (Doctor: the effect must own
 * every subscription it creates through one obvious cleanup path).
 */
export const subscribeWorkspaceDomainStores = (
  stores: ReadonlyArray<{ subscribe: (listener: () => void) => () => void }>,
  listener: () => void,
): (() => void) => {
  const unsubscribes = stores.map((store) => store.subscribe(listener));
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
};

/**
 * Workspace capture state — builds the DashboardWorkspaceCaptureState snapshot
 * from every domain store (the change-signal of the history/autosave
 * interlock), the object-URL release helper and the capture-state mirror
 * effect.
 *
 * The builder lives in workspace-persistence.registry.ts and reads every
 * domain store plus the auth user id. Restores apply the document first and
 * then re-capture through this same builder, so there is no second field
 * list to keep in sync.
 *
 * The capture deps are DELIBERATE (they are the change-signal of the
 * history/autosave interlock — see the entry file) even where the body reads
 * `getState()` instead.
 */
import { useCallback, useEffect } from 'react';
import type { AuthUser } from '../../../contexts/AuthContext';
import type { DashboardWorkspaceCaptureState } from '../../../workspace/dashboardWorkspace';
import {
  WORKSPACE_PERSISTENCE_STORES,
  buildWorkspaceCaptureState,
} from './workspace-persistence.registry';
import { resolveUtilityWorkspaceSnapshots } from './utility-workspaces';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useExportStore } from '../stores/export-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';

interface UseWorkspaceCaptureStateArgs {
  authUser: AuthUser | null;
}

export function useWorkspaceCaptureState({
  authUser,
}: UseWorkspaceCaptureStateArgs) {
  const releaseWorkspaceObjectUrls = useCallback(() => {
    useImageCollectionStore.getState().images.forEach((image) => {
      URL.revokeObjectURL(image.url);
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    useExportStore.getState().downloadItems.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    resolveUtilityWorkspaceSnapshots(
      useImageCollectionStore.getState().activeId,
    ).currentWatermarkWorkspaceState.results.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const buildCurrentWorkspaceCaptureState = useCallback(
    (): DashboardWorkspaceCaptureState =>
      buildWorkspaceCaptureState(authUser?.id ?? null),
    [authUser?.id],
  );

  const mirrorWorkspaceCaptureState = useCallback(() => {
    const { workspaceAutosaveSettings } = useWorkspacePersistenceStore.getState();
    if (!workspaceAutosaveSettings.enabled) {
      useWorkspacePersistenceStore.getState().latestWorkspaceCaptureState = null;
      return;
    }

    useWorkspacePersistenceStore.getState().latestWorkspaceCaptureState =
      buildCurrentWorkspaceCaptureState();
  }, [buildCurrentWorkspaceCaptureState]);

  useEffect(() => {
    const unsubscribesAll = subscribeWorkspaceDomainStores(
      WORKSPACE_PERSISTENCE_STORES,
      mirrorWorkspaceCaptureState,
    );
    mirrorWorkspaceCaptureState();
    return unsubscribesAll;
  }, [mirrorWorkspaceCaptureState]);

  return {
    releaseWorkspaceObjectUrls,
    buildCurrentWorkspaceCaptureState,
  };
}
