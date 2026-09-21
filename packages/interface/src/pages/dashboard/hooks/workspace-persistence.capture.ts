/**
 * Workspace capture state — builds the DashboardWorkspaceCaptureState snapshot
 * from every domain store (the change-signal of the history/autosave
 * interlock), the object-URL release helper, the capture-state mirror effect
 * and the capture-state rebuilt from a restored document. Split out of
 * workspace-persistence.ts (T10); the entry file keeps the orchestration.
 *
 * The capture deps are DELIBERATE (they are the change-signal of the
 * history/autosave interlock — see the entry file) even where the body reads
 * `getState()` instead.
 */
import { useCallback, useEffect } from 'react';
import type { AuthUser } from '../../../contexts/AuthContext';
import {
  type DashboardWorkspaceCaptureState,
  type DashboardWorkspaceRestoreState,
} from '../../../workspace/dashboardWorkspace';
import type { CleanerRunMeta, FreeProviderDraftMap } from '../../../types/dashboard.types';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
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

interface UseWorkspaceCaptureStateArgs {
  authUser: AuthUser | null;
  currentSplitterWorkspaceState: SplitterWorkspaceState;
  currentWatermarkWorkspaceState: WatermarkWorkspaceState;
  currentOptimizerWorkspaceState: ChapterOptimizerWorkspaceState;
  freeProviderDrafts: FreeProviderDraftMap;
}

export function useWorkspaceCaptureState({
  authUser,
  currentSplitterWorkspaceState,
  currentWatermarkWorkspaceState,
  currentOptimizerWorkspaceState,
  freeProviderDrafts,
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
    currentWatermarkWorkspaceState.results.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }, [currentWatermarkWorkspaceState.results]);

  const buildCurrentWorkspaceCaptureState =
    useCallback((): DashboardWorkspaceCaptureState => ({
      autosaveScope: authUser?.id ? 'user' : 'guest',
      autosaveUserId: authUser?.id ?? null,
      mode: useUiShellStore.getState().mode,
      subMode: useUiShellStore.getState().subMode,
      activeImageId: useImageCollectionStore.getState().activeId,
      viewMode: useUiShellStore.getState().viewMode,
      translatorWorkspaceMode:
        useTranslatorStore.getState().translatorWorkspaceMode,
      translatorVisualProcessingMode:
        useTranslatorStore.getState().translatorVisualProcessingMode,
      statusMessage: useStatusStore.getState().statusMessage,
      lastActionScope: useExportStore.getState().lastActionScope,
      images: useImageCollectionStore.getState().images,
      downloadItems: useExportStore.getState().downloadItems,
      batchThreadsEnabled: useAioPipelineStore.getState().batchThreadsEnabled,
      batchThreads: useAioPipelineStore.getState().batchThreads,
      aio: {
        steps: useAioPipelineStore.getState().aioSteps,
        stageSelection: useAioPipelineStore.getState().aioStageSelection,
        presetState: useAioPipelineStore.getState().aioPresetState,
        maskDilation: useAioPipelineStore.getState().aioMaskDilation,
        hdStrategy: useAioPipelineStore.getState().aioHdStrategy,
        hdResizeLimit: useAioPipelineStore.getState().aioHdResizeLimit,
        hdCropMargin: useAioPipelineStore.getState().aioHdCropMargin,
        hdCropTriggerSize: useAioPipelineStore.getState().aioHdCropTriggerSize,
        detectionsByImage:
          useRegionEditorStore.getState().aioDetectionsByImage,
        selectedRegionByImage:
          useRegionEditorStore.getState().aioSelectedRegionByImage,
        pipelineSnapshots:
          useAioPipelineStore.getState().aioPipelineSnapshots as unknown as DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'],
        pipelineSnapshotIndex:
          useAioPipelineStore.getState().aioPipelineSnapshotIndex,
        imageSnapshotIndexById:
          useAioPipelineStore.getState().aioImageSnapshotIndexById,
        autoHistoryAvailable:
          useAioPipelineStore.getState().aioAutoHistoryAvailable,
        autoProcessedImageById:
          useAioPipelineStore.getState().aioAutoProcessedImageById,
        // v2 does not charge manual quota (unified-contract field used by v1)
        manualQuotaChargedByImage: {},
        manualProgressByImage:
          useAioPipelineStore.getState().aioManualProgressByImage,
        manualImageEditsByImage:
          useManualToolsStore.getState().aioManualImageEditsByImage as unknown as DashboardWorkspaceCaptureState['aio']['manualImageEditsByImage'],
      },
      cleaner: {
        detectionsByImage:
          useCleanerStore.getState().cleanerDetectionsByImage,
        selectedRegionByImage:
          useCleanerStore.getState().cleanerSelectedRegionByImage,
        processedBaseByImage:
          useCleanerStore.getState().cleanerProcessedBaseByImage,
        runMetaByImage: useCleanerStore.getState().cleanerRunMetaByImage,
        manualImageEditsByImage:
          useCleanerStore.getState().cleanerManualImageEditsByImage,
      },
      translator: {
        srcLang: useTranslatorStore.getState().srcLang,
        tgtLang: useTranslatorStore.getState().tgtLang,
        aioSrcLang: useAioPipelineStore.getState().aioSrcLang,
        aioTgtLang: useAioPipelineStore.getState().aioTgtLang,
        translatorDraftText: useTranslatorStore.getState().translatorDraftText,
        translatorTranslatedText:
          useTranslatorStore.getState().translatorTranslatedText,
        translatorLastTextModelUsed:
          useTranslatorStore.getState().translatorLastTextModelUsed,
        translatorTextDirty: useTranslatorStore.getState().translatorTextDirty,
        translatorDetectionsByImage:
          useTranslatorStore.getState().translatorDetectionsByImage,
        translatorSelectedRegionByImage:
          useTranslatorStore.getState().translatorSelectedRegionByImage,
        translatorRunMetaByImage:
          useTranslatorStore.getState().translatorRunMetaByImage,
        translatorProcessedBaseByImage:
          useTranslatorStore.getState().translatorProcessedBaseByImage,
      },
      typesetter: {
        selectionTool: useTypographerStore.getState().typographerSelectionTool,
        queueSelectedId: useTypographerStore.getState().typographerQueueSelectedId,
        snapshotName: useTypographerStore.getState().typographerSnapshotName,
        selectedSnapshotId:
          useTypographerStore.getState().typographerSelectedSnapshotId,
        sessionsByImage:
          useTypographerStore.getState().typographerSessionsByImage,
      },
      enhance: {
        scale: useEnhanceStore.getState().enhanceScale,
        profile: useEnhanceStore.getState().enhanceProfile,
        modelId: useEnhanceStore.getState().enhanceModelId,
        outputFormat: useEnhanceStore.getState().enhanceOutputFormat,
      },
      utility: {
        stitch: {
          stitchLayoutMode: useUtilityStore.getState().stitchLayoutMode,
          stitchBatchStrategy: useUtilityStore.getState().stitchBatchStrategy,
          stitchBatchSize: useUtilityStore.getState().stitchBatchSize,
          stitchTargetPrimaryAxis:
            useUtilityStore.getState().stitchTargetPrimaryAxis,
          stitchGap: useUtilityStore.getState().stitchGap,
          stitchAlignMode: useUtilityStore.getState().stitchAlignMode,
          stitchBackground: useUtilityStore.getState().stitchBackground,
          stitchSingleExportFormat:
            useUtilityStore.getState().stitchSingleExportFormat,
          stitchFileBaseName: useUtilityStore.getState().stitchFileBaseName,
          stitchSelectedBatchIndex:
            useUtilityStore.getState().stitchSelectedBatchIndex,
          stitchBatchIndexes: useUtilityStore.getState().stitchBatchIndexes,
        },
        splitter: currentSplitterWorkspaceState,
        watermark: currentWatermarkWorkspaceState,
        optimizer: currentOptimizerWorkspaceState,
      },
      llm: {
        llmSettings: useLlmProvidersStore.getState().llmSettings,
        customLlmProfiles: useLlmProvidersStore.getState().customLlmProfiles,
        customLlmProfilesMode:
          useLlmProvidersStore.getState().customLlmProfilesMode,
        pendingCustomSelections:
          useLlmProvidersStore.getState().pendingCustomSelections,
        customLlmDrafts: useLlmProvidersStore.getState().customLlmDrafts,
        freeProviderDrafts,
      },
    }), [
      authUser?.id,
      currentOptimizerWorkspaceState,
      currentSplitterWorkspaceState,
      currentWatermarkWorkspaceState,
      freeProviderDrafts,
    ]);

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
    const stores = [
      useUiShellStore,
      useImageCollectionStore,
      useStatusStore,
      useExportStore,
      useAioPipelineStore,
      useRegionEditorStore,
      useManualToolsStore,
      useCleanerStore,
      useTranslatorStore,
      useTypographerStore,
      useEnhanceStore,
      useUtilityStore,
      useLlmProvidersStore,
      useWorkspacePersistenceStore,
    ];
    const unsubscribes = stores.map((store) =>
      store.subscribe(() => {
        mirrorWorkspaceCaptureState();
      }),
    );
    mirrorWorkspaceCaptureState();
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [mirrorWorkspaceCaptureState]);

  const buildCaptureStateFromRestored = useCallback(
    (restored: DashboardWorkspaceRestoreState): DashboardWorkspaceCaptureState => ({
      autosaveScope: restored.document.autosaveScope,
      autosaveUserId: restored.document.autosaveUserId,
      mode: restored.document.view.mode,
      subMode: restored.document.view.subMode,
      activeImageId: restored.document.view.activeImageId,
      viewMode: restored.document.view.viewMode,
      translatorWorkspaceMode: restored.document.view.translatorWorkspaceMode,
      translatorVisualProcessingMode:
        (restored.document.view.translatorVisualProcessingMode ??
          'sequential') as DashboardWorkspaceCaptureState['translatorVisualProcessingMode'],
      statusMessage: restored.document.footer.statusMessage,
      lastActionScope: restored.document.footer.lastActionScope,
      images: restored.images,
      downloadItems: restored.downloadItems,
      batchThreadsEnabled: restored.document.batchThreadsEnabled,
      batchThreads: restored.document.batchThreads,
      aio: restored.aio,
      cleaner: {
        detectionsByImage: restored.cleaner.detectionsByImage,
        selectedRegionByImage: restored.cleaner.selectedRegionByImage,
        processedBaseByImage: restored.cleaner.processedBaseByImage,
        runMetaByImage: restored.document.cleaner.runMetaByImage as Record<string, CleanerRunMeta>,
        manualImageEditsByImage: restored.cleaner.manualImageEditsByImage,
      },
      translator: {
        ...restored.document.translator,
        translatorProcessedBaseByImage:
          (restored.document.translator as unknown as {
            translatorProcessedBaseByImage?: Record<string, string>;
            translatorProcessedBaseAssetByImage?: Record<string, string>;
          }).translatorProcessedBaseByImage ??
          (restored.document.translator as unknown as {
            translatorProcessedBaseAssetByImage?: Record<string, string>;
          }).translatorProcessedBaseAssetByImage ??
          {},
      },
      typesetter: restored.typesetter,
      enhance: restored.document.enhance,
      utility: {
        stitch: restored.document.utility.stitch,
        splitter: restored.utility.splitter,
        watermark: restored.utility.watermark,
        optimizer: restored.utility.optimizer,
      },
      llm: restored.document.llm,
    }),
    [],
  );

  return {
    releaseWorkspaceObjectUrls,
    buildCurrentWorkspaceCaptureState,
    buildCaptureStateFromRestored,
  };
}
