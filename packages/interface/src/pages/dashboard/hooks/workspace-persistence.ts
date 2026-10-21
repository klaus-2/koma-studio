import { useCallback, useEffect } from 'react';

import {
  subscribeWorkspaceDomainStores,
  useWorkspaceCaptureState,
} from './workspace-persistence.capture';
import { useWorkspaceRestoreState } from './workspace-persistence.restore';
import { WORKSPACE_PERSISTENCE_STORES } from './workspace-persistence.registry';
import type { AuthUser } from '../../../contexts/AuthContext';
import { useI18n } from '../../../i18n';
import { desktopBridge } from '../../../lib/desktop-bridge';
import { useWorkspaceHistory } from '../../../hooks/useWorkspaceHistory';
import {
  buildWorkspaceAutosaveSignature,
  buildWorkspaceExportPayload,
  buildWorkspaceHistorySignature,
  captureWorkspaceDocument,
  captureWorkspaceHistorySnapshot,
  releaseWorkspaceHistorySnapshot,
  restoreWorkspaceDocument,
  restoreWorkspaceHistorySnapshot,
  type DashboardWorkspaceCaptureState,
  type DashboardWorkspaceHistorySnapshot,
} from '../../../workspace/dashboardWorkspace';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';

interface UseWorkspacePersistenceArgs {
  authUser: AuthUser | null;
}

/**
 * Workspace persistence: capture/restore of the full workspace document,
 * undo/redo history, local autosave, export/import/close and the footer
 * workspace status. The history/autosave change-signal moved from a
 * render-driven effect (the hook subscribed the page to every domain store)
 * to a single store.subscribe over the domain stores — same observed change
 * set, zero page re-renders from persistence bookkeeping.
 */
export function useWorkspacePersistence({
  authUser,
}: UseWorkspacePersistenceArgs) {
  const { t } = useI18n();
  const workspaceAutosaveSettings = useWorkspacePersistenceStore(
    (s) => s.workspaceAutosaveSettings,
  );
  const setWorkspaceStatus = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceStatus,
  );
  const setWorkspaceStatusDetail = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceStatusDetail,
  );
  const setWorkspaceLastSavedAt = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceLastSavedAt,
  );
  const setWorkspaceHydrated = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceHydrated,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const images = useImageCollectionStore((s) => s.images);
  const setImages = useImageCollectionStore((s) => s.setImages);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const setMode = useUiShellStore((s) => s.setMode);
  const processing = useUiShellStore((s) => s.processing);
  const {
    releaseWorkspaceObjectUrls,
    buildCurrentWorkspaceCaptureState,
  } = useWorkspaceCaptureState({
    authUser,
  });

  const { applyRestoredWorkspaceState } = useWorkspaceRestoreState({
    releaseWorkspaceObjectUrls,
  });

  const handleHistoryRestore = useCallback(
    async (snapshot: DashboardWorkspaceHistorySnapshot) => {
      useWorkspacePersistenceStore.getState().workspaceHistoryReady = false;
      const restored = await restoreWorkspaceHistorySnapshot(snapshot);
      await applyRestoredWorkspaceState(restored, {
        statusDetail: t('dashboard.status.historyRestored'),
      });
      const restoredCaptureState = buildCurrentWorkspaceCaptureState();
      useWorkspacePersistenceStore.getState().workspaceHistorySignature =
        buildWorkspaceHistorySignature(restoredCaptureState);
      useWorkspacePersistenceStore.getState().workspaceAutosaveSignature =
        buildWorkspaceAutosaveSignature(restoredCaptureState);
    },
    [
      applyRestoredWorkspaceState,
      buildCurrentWorkspaceCaptureState,
      t,
    ],
  );

  const workspaceHistory = useWorkspaceHistory<DashboardWorkspaceHistorySnapshot>(
    {
      disposeSnapshot: releaseWorkspaceHistorySnapshot,
      onRestore: handleHistoryRestore,
    },
  );


  const seedWorkspaceHistory = useCallback(() => {
    useWorkspacePersistenceStore.getState().workspaceHistoryReady = false;
    useWorkspacePersistenceStore.getState().workspaceAutosaveDirty = false;
    const captureState = buildCurrentWorkspaceCaptureState();
    useWorkspacePersistenceStore.getState().workspaceHistorySignature =
      buildWorkspaceHistorySignature(captureState);
    useWorkspacePersistenceStore.getState().workspaceAutosaveSignature =
      buildWorkspaceAutosaveSignature(captureState);
    workspaceHistory.setBaseline(
      captureWorkspaceHistorySnapshot(captureState),
    );
  }, [buildCurrentWorkspaceCaptureState, workspaceHistory.setBaseline]);

  const commitWorkspaceHistory = useCallback(
    (delayMs?: number) => {
      if (delayMs && delayMs > 0) {
        workspaceHistory.queueCommit(
          () =>
            captureWorkspaceHistorySnapshot(
              buildCurrentWorkspaceCaptureState(),
            ),
          delayMs,
        );
        return;
      }

      workspaceHistory.commit(
        captureWorkspaceHistorySnapshot(buildCurrentWorkspaceCaptureState()),
      );
    },
    [buildCurrentWorkspaceCaptureState, workspaceHistory.commit, workspaceHistory.queueCommit],
  );

  const saveWorkspaceAutosave = useCallback(async (
    captureStateOverride?: DashboardWorkspaceCaptureState | null,
  ): Promise<boolean> => {
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) return false;
    if (workspaceHistory.isRestoringRef.current) return false;
    if (useWorkspacePersistenceStore.getState().workspaceAutosaveSaving) return false;
    useWorkspacePersistenceStore.getState().workspaceAutosaveSaving = true;
    try {
      const captureState =
        captureStateOverride ??
        useWorkspacePersistenceStore.getState().latestWorkspaceCaptureState ??
        buildCurrentWorkspaceCaptureState();
      setWorkspaceStatus('saving');
      setWorkspaceStatusDetail(t('dashboard.footer.workspace.saving'));
      const payload = await captureWorkspaceDocument(captureState);
      await desktopWorkspace.saveAutosave({
        userId: authUser?.id ?? null,
        payload,
      });
      useWorkspacePersistenceStore.getState().workspaceAutosaveSignature =
        buildWorkspaceAutosaveSignature(captureState);
      setWorkspaceStatus('saved');
      setWorkspaceStatusDetail(t('dashboard.status.saved'));
      setWorkspaceLastSavedAt(
        Date.parse(payload.manifest.document.savedAt) || Date.now(),
      );
      return true;
    } catch (error) {
      setWorkspaceStatus('error');
      setWorkspaceStatusDetail(
        error instanceof Error
          ? error.message
          : t('dashboard.status.autosaveSaveFailed'),
      );
      return false;
    } finally {
      useWorkspacePersistenceStore.getState().workspaceAutosaveSaving = false;
    }
  }, [authUser?.id, buildCurrentWorkspaceCaptureState, setWorkspaceLastSavedAt, setWorkspaceStatus, setWorkspaceStatusDetail, t, workspaceHistory.isRestoringRef]);

  useEffect(() => {
    useWorkspacePersistenceStore.getState().saveWorkspaceAutosaveImpl =
      saveWorkspaceAutosave;
  }, [saveWorkspaceAutosave]);

  useEffect(() => {
    return () => {
      const persistence = useWorkspacePersistenceStore.getState();
      if (
        desktopBridge.desktop?.workspace &&
        workspaceAutosaveSettings.enabled &&
        persistence.workspaceAutosaveDirty &&
        !persistence.workspaceAutosaveSaving &&
        persistence.latestWorkspaceCaptureState
      ) {
        void persistence.saveWorkspaceAutosaveImpl(
          persistence.latestWorkspaceCaptureState,
        );
      }
    };
  }, [workspaceAutosaveSettings.enabled]);

  // Fire-and-forget save on app close / tab hide — async saveAutosave can be
  // torn down mid-flight during flushSync navigation.
  useEffect(() => {
    if (!desktopBridge.desktop?.workspace || !workspaceAutosaveSettings.enabled) {
      return;
    }
    const sendDirtyAutosave = () => {
      const persistence = useWorkspacePersistenceStore.getState();
      const desktopWorkspace = desktopBridge.desktop?.workspace;
      if (
        !desktopWorkspace ||
        !persistence.workspaceAutosaveDirty ||
        persistence.workspaceAutosaveSaving ||
        !persistence.latestWorkspaceCaptureState
      ) {
        return;
      }
      void captureWorkspaceDocument(persistence.latestWorkspaceCaptureState)
        .then((payload) => {
          desktopWorkspace.sendAutosave({
            userId: authUser?.id ?? null,
            payload,
          });
        })
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendDirtyAutosave();
      }
    };
    window.addEventListener('beforeunload', sendDirtyAutosave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', sendDirtyAutosave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authUser?.id, captureWorkspaceDocument, workspaceAutosaveSettings.enabled]);

  const exportCurrentWorkspace = useCallback(async () => {
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) return;
    try {
      const payload = await buildWorkspaceExportPayload(
        buildCurrentWorkspaceCaptureState(),
      );
      const result = await desktopWorkspace.exportCurrent(payload);
      if (result.cancelled) {
        setTonedStatus(t('dashboard.status.exportCancelled'), 'warning');
        return;
      }
      setTonedStatus(t('dashboard.status.exportSuccess'), 'success');
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.workspaceExportFailed'),
        'error',
      );
    }
  }, [buildCurrentWorkspaceCaptureState, setTonedStatus, t]);

  const importWorkspaceFile = useCallback(async () => {
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) return;
    if (images.length > 0) {
      const confirmed = window.confirm(
        t('dashboard.alert.importWorkspaceConfirm'),
      );
      if (!confirmed) return;
    }
    try {
      const result = await desktopWorkspace.importFile();
      if (result.cancelled || !result.payload) {
        setTonedStatus(t('dashboard.status.importCancelled'), 'warning');
        return;
      }
      const restored = await restoreWorkspaceDocument(result.payload);
      await applyRestoredWorkspaceState(restored, {
        statusDetail: t('dashboard.status.importSuccess'),
      });
      seedWorkspaceHistory();
      setTonedStatus(t('dashboard.status.importSuccess'), 'success');
      if (workspaceAutosaveSettings.enabled) {
        await desktopWorkspace.saveAutosave({
          userId: authUser?.id ?? null,
          payload: result.payload,
        });
        setWorkspaceLastSavedAt(
          Date.parse(result.payload.manifest.document.savedAt) || Date.now(),
        );
        setWorkspaceStatus('saved');
        setWorkspaceStatusDetail(t('dashboard.status.importSaved'));
      } else {
        setWorkspaceLastSavedAt(null);
        setWorkspaceStatus('idle');
        setWorkspaceStatusDetail(
          t('dashboard.status.importNoAutosave'),
        );
      }
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.workspaceImportFailed'),
        'error',
      );
    }
  }, [
    applyRestoredWorkspaceState,
    authUser?.id,
    images.length,
    seedWorkspaceHistory,
    setTonedStatus,
    setWorkspaceLastSavedAt,
    setWorkspaceStatus,
    setWorkspaceStatusDetail,
    t,
    workspaceAutosaveSettings.enabled,
  ]);

  const closeWorkspace = useCallback(async () => {
    const confirmed = window.confirm(
      t('dashboard.alert.closeWorkspaceConfirm'),
    );
    if (!confirmed) return;
    try {
      const desktopWorkspace = desktopBridge.desktop?.workspace;
      if (desktopWorkspace) {
        await desktopWorkspace.clearAutosave({
          userId: authUser?.id ?? null,
        });
      }
      setImages([]);
      setActiveId('');
      setMode('aio');
      setWorkspaceStatus('idle');
      setWorkspaceStatusDetail('');
      setWorkspaceLastSavedAt(null);
      seedWorkspaceHistory();
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.autosaveClearFailed'),
        'error',
      );
    }
  }, [authUser?.id, seedWorkspaceHistory, setActiveId, setImages, setMode, setTonedStatus, setWorkspaceLastSavedAt, setWorkspaceStatus, setWorkspaceStatusDetail, t]);

  useEffect(() => {
    setWorkspaceHydrated(false);
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) {
      seedWorkspaceHistory();
      setWorkspaceLastSavedAt(null);
      setWorkspaceHydrated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const result = await desktopWorkspace.loadAutosave(
          authUser?.id ?? null,
        );
        if (cancelled) return;
        if (!result.found || !result.payload) {
          seedWorkspaceHistory();
          setWorkspaceLastSavedAt(null);
          setWorkspaceHydrated(true);
          return;
        }
        const restored = await restoreWorkspaceDocument(result.payload);
        if (cancelled) return;
        await applyRestoredWorkspaceState(restored, {
          statusDetail: t('dashboard.status.workspaceRestoredFromAutosave'),
        });
        seedWorkspaceHistory();
        setWorkspaceLastSavedAt(
          Date.parse(result.payload.manifest.document.savedAt) || Date.now(),
        );
        setWorkspaceHydrated(true);
      } catch {
        seedWorkspaceHistory();
        setWorkspaceLastSavedAt(null);
        setWorkspaceHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, setWorkspaceHydrated, setWorkspaceLastSavedAt]);

  const workspaceChangeSignal = useCallback(() => {
    const persistence = useWorkspacePersistenceStore.getState();
    if (!persistence.workspaceHydrated) return;
    if (workspaceHistory.isRestoringRef.current) return;
    const captureState =
      persistence.latestWorkspaceCaptureState ??
      buildCurrentWorkspaceCaptureState();
    const historySignature = buildWorkspaceHistorySignature(captureState);
    const processing = useUiShellStore.getState().processing;

    if (!persistence.workspaceHistoryReady) {
      persistence.workspaceHistoryReady = true;
      persistence.workspaceHistorySignature = historySignature;
      persistence.workspaceAutosaveSignature = processing
        ? null
        : buildWorkspaceAutosaveSignature(captureState);
      return;
    }

    if (historySignature !== persistence.workspaceHistorySignature) {
      persistence.workspaceHistorySignature = historySignature;
      commitWorkspaceHistory(250);
    }

    if (!desktopBridge.desktop?.workspace) {
      return;
    }

    if (!workspaceAutosaveSettings.enabled) {
      persistence.workspaceAutosaveSignature = null;
      persistence.workspaceAutosaveDirty = false;
      return;
    }

    if (processing) {
      persistence.workspaceAutosaveDirty = true;
      return;
    }

    const autosaveSignature = buildWorkspaceAutosaveSignature(captureState);
    if (autosaveSignature !== persistence.workspaceAutosaveSignature) {
      persistence.workspaceAutosaveSignature = autosaveSignature;
      persistence.workspaceAutosaveDirty = true;
      setWorkspaceStatus('idle');
      setWorkspaceStatusDetail(t('dashboard.status.workspacePendingChanges'));
    }
  }, [
    buildCurrentWorkspaceCaptureState,
    commitWorkspaceHistory,
    setWorkspaceStatus,
    setWorkspaceStatusDetail,
    t,
    workspaceAutosaveSettings.enabled,
    workspaceHistory.isRestoringRef,
  ]);

  useEffect(() => {
    const unsubscribesAll = subscribeWorkspaceDomainStores(
      WORKSPACE_PERSISTENCE_STORES,
      workspaceChangeSignal,
    );
    workspaceChangeSignal();
    return unsubscribesAll;
  }, [workspaceChangeSignal]);

  useEffect(() => {
    if (!useWorkspacePersistenceStore.getState().workspaceHydrated) return;
    if (!desktopBridge.desktop?.workspace) return;
    if (!workspaceAutosaveSettings.enabled) return;

    const persistence = useWorkspacePersistenceStore.getState();
    if (persistence.workspaceAutosaveInterval !== null) {
      window.clearInterval(persistence.workspaceAutosaveInterval);
    }

    persistence.workspaceAutosaveInterval = window.setInterval(() => {
      const tick = useWorkspacePersistenceStore.getState();
      if (!tick.workspaceAutosaveDirty) return;
      if (useUiShellStore.getState().processing) return;
      if (workspaceHistory.isRestoringRef.current) return;
      if (tick.workspaceAutosaveSaving) return;

      void tick.saveWorkspaceAutosaveImpl().then((saved) => {
        if (saved) {
          useWorkspacePersistenceStore.getState().workspaceAutosaveDirty = false;
        }
      });
    }, workspaceAutosaveSettings.intervalSeconds * 1000);

    return () => {
      const persistence = useWorkspacePersistenceStore.getState();
      if (persistence.workspaceAutosaveInterval !== null) {
        window.clearInterval(persistence.workspaceAutosaveInterval);
        persistence.workspaceAutosaveInterval = null;
      }
    };
  }, [
    processing,
    workspaceAutosaveSettings.enabled,
    workspaceAutosaveSettings.intervalSeconds,
    workspaceHistory.isRestoringRef,
  ]);

  const handleWorkspaceUndo = useCallback(async () => {
    const handled = await workspaceHistory.undo();
    if (!handled) {
      setTonedStatus(t('dashboard.status.nothingToUndo'), 'warning');
      return false;
    }
    setStatusMessage(t('dashboard.status.undo'));
    return true;
  }, [setStatusMessage, setTonedStatus, workspaceHistory.undo, t]);

  const handleWorkspaceRedo = useCallback(async () => {
    const handled = await workspaceHistory.redo();
    if (!handled) {
      setTonedStatus(t('dashboard.status.nothingToRedo'), 'warning');
      return false;
    }
    setStatusMessage(t('dashboard.status.redo'));
    return true;
  }, [setStatusMessage, setTonedStatus, workspaceHistory.redo, t]);

  const handleWorkspaceManualSave = useCallback(async () => {
    const saved = await saveWorkspaceAutosave();
    if (saved) {
      useWorkspacePersistenceStore.getState().workspaceAutosaveDirty = false;
      setTonedStatus(t('dashboard.status.saved'), 'success');
      return true;
    }
    return false;
  }, [saveWorkspaceAutosave, setTonedStatus, t]);

  return {
    workspaceHistory,
    exportCurrentWorkspace,
    importWorkspaceFile,
    closeWorkspace,
    handleWorkspaceUndo,
    handleWorkspaceRedo,
    handleWorkspaceManualSave,
  };
}