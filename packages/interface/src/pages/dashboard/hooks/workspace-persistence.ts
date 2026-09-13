import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { useWorkspaceCaptureState } from './workspace-persistence.capture';
import { useWorkspaceRestoreState } from './workspace-persistence.restore';
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
import type { FreeProviderDraftMap } from '../../../types/dashboard.types';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
import type { useTypographerWorkspace } from './typographer';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useExportStore } from '../stores/export-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useEnhanceStore } from '../stores/enhance-store';
import { useUtilityStore } from '../stores/utility-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';

interface UseWorkspacePersistenceArgs {
  authUser: AuthUser | null;
  typographerWorkspace: ReturnType<typeof useTypographerWorkspace>;
  currentSplitterWorkspaceState: SplitterWorkspaceState;
  currentWatermarkWorkspaceState: WatermarkWorkspaceState;
  currentOptimizerWorkspaceState: ChapterOptimizerWorkspaceState;
  freeProviderDrafts: FreeProviderDraftMap;
  setFreeProviderDrafts: Dispatch<SetStateAction<FreeProviderDraftMap>>;
}

/**
 * Workspace persistence: capture/restore of the full workspace document,
 * undo/redo history, local autosave, export/import/close and the footer
 * workspace status. The capture deps are DELIBERATE (they are the
 * change-signal of the history/autosave interlock — effects below and the
 * queue rule) even where the body reads `getState()` instead.
 */
export function useWorkspacePersistence({
  authUser,
  typographerWorkspace,
  currentSplitterWorkspaceState,
  currentWatermarkWorkspaceState,
  currentOptimizerWorkspaceState,
  freeProviderDrafts,
  setFreeProviderDrafts,
}: UseWorkspacePersistenceArgs) {
  const { t } = useI18n();

  // Shell / collection / status
  const mode = useUiShellStore((s) => s.mode);
  const setMode = useUiShellStore((s) => s.setMode);
  const subMode = useUiShellStore((s) => s.subMode);
  const viewMode = useUiShellStore((s) => s.viewMode);
  const processing = useUiShellStore((s) => s.processing);
  const images = useImageCollectionStore((s) => s.images);
  const setImages = useImageCollectionStore((s) => s.setImages);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);

  // Downloads
  const downloadItems = useExportStore((s) => s.downloadItems);
  const lastActionScope = useExportStore((s) => s.lastActionScope);

  // AIO pipeline
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioPresetState = useAioPipelineStore((s) => s.aioPresetState);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const aioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.aioPipelineSnapshotIndex,
  );
  const aioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.aioImageSnapshotIndexById,
  );
  const aioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.aioAutoHistoryAvailable,
  );
  const aioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.aioAutoProcessedImageById,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const batchThreadsEnabled = useAioPipelineStore(
    (s) => s.batchThreadsEnabled,
  );

  // Region editor
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );

  // Manual tools
  const aioManualImageEditsByImage = useManualToolsStore(
    (s) => s.aioManualImageEditsByImage,
  );

  // Cleaner
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => s.cleanerDetectionsByImage,
  );
  const cleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.cleanerSelectedRegionByImage,
  );
  const cleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.cleanerProcessedBaseByImage,
  );
  const cleanerRunMetaByImage = useCleanerStore(
    (s) => s.cleanerRunMetaByImage,
  );
  const cleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.cleanerManualImageEditsByImage,
  );

  // Translator
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const translatorDraftText = useTranslatorStore((s) => s.translatorDraftText);
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const translatorLastTextModelUsed = useTranslatorStore(
    (s) => s.translatorLastTextModelUsed,
  );
  const translatorTextDirty = useTranslatorStore((s) => s.translatorTextDirty);
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const translatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.translatorSelectedRegionByImage,
  );
  const translatorRunMetaByImage = useTranslatorStore(
    (s) => s.translatorRunMetaByImage,
  );

  // Typographer
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const typographerQueueSelectedId = useTypographerStore(
    (s) => s.typographerQueueSelectedId,
  );
  const typographerSnapshotName = useTypographerStore(
    (s) => s.typographerSnapshotName,
  );
  const typographerSelectedSnapshotId = useTypographerStore(
    (s) => s.typographerSelectedSnapshotId,
  );

  // Enhance
  const enhanceScale = useEnhanceStore((s) => s.enhanceScale);
  const enhanceProfile = useEnhanceStore((s) => s.enhanceProfile);
  const enhanceModelId = useEnhanceStore((s) => s.enhanceModelId);
  const enhanceOutputFormat = useEnhanceStore((s) => s.enhanceOutputFormat);

  // Utility (stitch + workspace states)
  const stitchLayoutMode = useUtilityStore((s) => s.stitchLayoutMode);
  const stitchBatchStrategy = useUtilityStore((s) => s.stitchBatchStrategy);
  const stitchBatchSize = useUtilityStore((s) => s.stitchBatchSize);
  const stitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.stitchTargetPrimaryAxis,
  );
  const stitchGap = useUtilityStore((s) => s.stitchGap);
  const stitchAlignMode = useUtilityStore((s) => s.stitchAlignMode);
  const stitchBackground = useUtilityStore((s) => s.stitchBackground);
  const stitchSingleExportFormat = useUtilityStore(
    (s) => s.stitchSingleExportFormat,
  );
  const stitchFileBaseName = useUtilityStore((s) => s.stitchFileBaseName);
  const stitchSelectedBatchIndex = useUtilityStore(
    (s) => s.stitchSelectedBatchIndex,
  );
  const stitchBatchIndexes = useUtilityStore((s) => s.stitchBatchIndexes);

  // LLM providers
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const customLlmProfiles = useLlmProvidersStore((s) => s.customLlmProfiles);
  const customLlmProfilesMode = useLlmProvidersStore(
    (s) => s.customLlmProfilesMode,
  );
  const pendingCustomSelections = useLlmProvidersStore(
    (s) => s.pendingCustomSelections,
  );
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);

  // Workspace persistence (own domain)
  const workspaceHydrated = useWorkspacePersistenceStore(
    (s) => s.workspaceHydrated,
  );
  const setWorkspaceHydrated = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceHydrated,
  );
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

  const {
    releaseWorkspaceObjectUrls,
    buildCurrentWorkspaceCaptureState,
    buildCaptureStateFromRestored,
  } = useWorkspaceCaptureState({
    authUser,
    typographerWorkspace,
    currentSplitterWorkspaceState,
    currentWatermarkWorkspaceState,
    currentOptimizerWorkspaceState,
    freeProviderDrafts,
  });

  const { applyRestoredWorkspaceState } = useWorkspaceRestoreState({
    releaseWorkspaceObjectUrls,
    typographerWorkspace,
    setFreeProviderDrafts,
  });


  const workspaceHistory = useWorkspaceHistory<DashboardWorkspaceHistorySnapshot>(
    {
      disposeSnapshot: releaseWorkspaceHistorySnapshot,
      onRestore: async (snapshot) => {
        useWorkspacePersistenceStore.getState().workspaceHistoryReady = false;
        const restored = await restoreWorkspaceHistorySnapshot(snapshot);
        const restoredCaptureState = buildCaptureStateFromRestored(restored);
        useWorkspacePersistenceStore.getState().workspaceHistorySignature =
          buildWorkspaceHistorySignature(restoredCaptureState);
        useWorkspacePersistenceStore.getState().workspaceAutosaveSignature =
          buildWorkspaceAutosaveSignature(restoredCaptureState);
        await applyRestoredWorkspaceState(restored, {
          statusDetail: t('dashboard.status.historyRestored'),
        });
      },
    },
  );


  const seedWorkspaceHistory = useCallback((
    snapshot?: DashboardWorkspaceHistorySnapshot,
    captureStateOverride?: DashboardWorkspaceCaptureState,
  ) => {
    useWorkspacePersistenceStore.getState().workspaceHistoryReady = false;
    useWorkspacePersistenceStore.getState().workspaceAutosaveDirty = false;
    const captureState = captureStateOverride ?? buildCurrentWorkspaceCaptureState();
    useWorkspacePersistenceStore.getState().workspaceHistorySignature =
      buildWorkspaceHistorySignature(captureState);
    useWorkspacePersistenceStore.getState().workspaceAutosaveSignature =
      buildWorkspaceAutosaveSignature(captureState);
    workspaceHistory.setBaseline(
      snapshot ??
        captureWorkspaceHistorySnapshot(captureState),
    );
  }, [buildCurrentWorkspaceCaptureState, workspaceHistory]);

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
    [buildCurrentWorkspaceCaptureState, workspaceHistory],
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
      setWorkspaceStatusDetail('Saving local workspace...');
      const payload = await captureWorkspaceDocument(captureState);
      await desktopWorkspace.saveAutosave({
        userId: authUser?.id ?? null,
        payload,
      });
      useWorkspacePersistenceStore.getState().workspaceAutosaveSignature =
        buildWorkspaceAutosaveSignature(captureState);
      setWorkspaceStatus('saved');
      setWorkspaceStatusDetail('Workspace saved locally.');
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
  }, [authUser?.id, buildCurrentWorkspaceCaptureState, setWorkspaceLastSavedAt, setWorkspaceStatus, setWorkspaceStatusDetail, workspaceHistory]);

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
      setTonedStatus('Workspace exported successfully.', 'success');
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.workspaceExportFailed'),
        'error',
      );
    }
  }, [buildCurrentWorkspaceCaptureState, setTonedStatus]);

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
      const restoredCaptureState = buildCaptureStateFromRestored(restored);
      await applyRestoredWorkspaceState(restored, {
        statusDetail: 'Workspace importado.',
      });
      seedWorkspaceHistory(
        captureWorkspaceHistorySnapshot(
          restoredCaptureState,
        ),
        restoredCaptureState,
      );
      setTonedStatus('Workspace imported successfully.', 'success');
      if (workspaceAutosaveSettings.enabled) {
        await desktopWorkspace.saveAutosave({
          userId: authUser?.id ?? null,
          payload: result.payload,
        });
        setWorkspaceLastSavedAt(
          Date.parse(result.payload.manifest.document.savedAt) || Date.now(),
        );
        setWorkspaceStatus('saved');
        setWorkspaceStatusDetail('Workspace imported and saved locally.');
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
    buildCaptureStateFromRestored,
    images.length,
    seedWorkspaceHistory,
    setTonedStatus,
    setWorkspaceLastSavedAt,
    setWorkspaceStatus,
    setWorkspaceStatusDetail,
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
      setMode('organize');
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
        const restoredCaptureState = buildCaptureStateFromRestored(restored);
        await applyRestoredWorkspaceState(restored, {
          statusDetail: t('dashboard.status.workspaceRestoredFromAutosave'),
        });
        seedWorkspaceHistory(
          captureWorkspaceHistorySnapshot(
            restoredCaptureState,
          ),
          restoredCaptureState,
        );
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

  useEffect(() => {
    if (!workspaceHydrated) return;
    if (workspaceHistory.isRestoringRef.current) return;
    const persistence = useWorkspacePersistenceStore.getState();
    const captureState =
      persistence.latestWorkspaceCaptureState ??
      buildCurrentWorkspaceCaptureState();
    const historySignature = buildWorkspaceHistorySignature(captureState);

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
    activeId,
    aioAutoHistoryAvailable,
    aioAutoProcessedImageById,
    aioDetectionsByImage,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    aioHdResizeLimit,
    aioHdStrategy,
    aioImageSnapshotIndexById,
    aioManualImageEditsByImage,
    aioManualProgressByImage,
    aioMaskDilation,
    aioPipelineSnapshotIndex,
    aioPipelineSnapshots,
    aioPresetState,
    aioSelectedRegionByImage,
    aioSrcLang,
    aioStageSelection,
    aioSteps,
    aioTgtLang,
    batchThreads,
    batchThreadsEnabled,
    cleanerDetectionsByImage,
    cleanerManualImageEditsByImage,
    cleanerProcessedBaseByImage,
    cleanerRunMetaByImage,
    cleanerSelectedRegionByImage,
    currentOptimizerWorkspaceState,
    currentSplitterWorkspaceState,
    currentWatermarkWorkspaceState,
    customLlmDrafts,
    customLlmProfiles,
    customLlmProfilesMode,
    downloadItems,
    enhanceModelId,
    enhanceOutputFormat,
    enhanceProfile,
    enhanceScale,
    freeProviderDrafts,
    images,
    lastActionScope,
    llmSettings,
    mode,
    pendingCustomSelections,
    srcLang,
    stitchAlignMode,
    stitchBackground,
    stitchBatchIndexes,
    stitchBatchSize,
    stitchBatchStrategy,
    stitchFileBaseName,
    stitchGap,
    stitchLayoutMode,
    stitchSelectedBatchIndex,
    stitchSingleExportFormat,
    stitchTargetPrimaryAxis,
    setWorkspaceStatus,
    setWorkspaceStatusDetail,
    subMode,
    tgtLang,
    translatorDetectionsByImage,
    translatorDraftText,
    translatorLastTextModelUsed,
    translatorRunMetaByImage,
    translatorSelectedRegionByImage,
    translatorTextDirty,
    translatorTranslatedText,
    translatorWorkspaceMode,
    typographerQueueSelectedId,
    typographerSelectedSnapshotId,
    typographerSelectionTool,
    typographerSnapshotName,
    typographerWorkspace.sessionsByImage,
    viewMode,
    workspaceHydrated,
    workspaceAutosaveSettings.enabled,
    buildCurrentWorkspaceCaptureState,
    commitWorkspaceHistory,
    workspaceHistory,
  ]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    if (!desktopBridge.desktop?.workspace) return;
    if (!workspaceAutosaveSettings.enabled) return;

    const persistence = useWorkspacePersistenceStore.getState();
    if (persistence.workspaceAutosaveInterval !== null) {
      window.clearInterval(persistence.workspaceAutosaveInterval);
    }

    persistence.workspaceAutosaveInterval = window.setInterval(() => {
      const tick = useWorkspacePersistenceStore.getState();
      if (!tick.workspaceAutosaveDirty) return;
      if (processing) return;
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
    workspaceHydrated,
  ]);

  const handleWorkspaceUndo = useCallback(async () => {
    const handled = await workspaceHistory.undo();
    if (!handled) {
      setTonedStatus(t('dashboard.status.nothingToUndo'), 'warning');
      return false;
    }
    setStatusMessage(t('dashboard.status.undo'));
    return true;
  }, [setStatusMessage, setTonedStatus, workspaceHistory, t]);

  const handleWorkspaceRedo = useCallback(async () => {
    const handled = await workspaceHistory.redo();
    if (!handled) {
      setTonedStatus(t('dashboard.status.nothingToRedo'), 'warning');
      return false;
    }
    setStatusMessage(t('dashboard.status.redo'));
    return true;
  }, [setStatusMessage, setTonedStatus, workspaceHistory, t]);

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
