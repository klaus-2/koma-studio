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

interface UseWorkspaceCaptureStateArgs {
  authUser: AuthUser | null;
  typographerWorkspace: ReturnType<typeof useTypographerWorkspace>;
  currentSplitterWorkspaceState: SplitterWorkspaceState;
  currentWatermarkWorkspaceState: WatermarkWorkspaceState;
  currentOptimizerWorkspaceState: ChapterOptimizerWorkspaceState;
  freeProviderDrafts: FreeProviderDraftMap;
}

export function useWorkspaceCaptureState({
  authUser,
  typographerWorkspace,
  currentSplitterWorkspaceState,
  currentWatermarkWorkspaceState,
  currentOptimizerWorkspaceState,
  freeProviderDrafts,
}: UseWorkspaceCaptureStateArgs) {
  // Shell / collection / status
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const viewMode = useUiShellStore((s) => s.viewMode);
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const statusMessage = useStatusStore((s) => s.statusMessage);

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
  const translatorVisualProcessingMode = useTranslatorStore(
    (s) => s.translatorVisualProcessingMode,
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
  const translatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.translatorProcessedBaseByImage,
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
  const workspaceAutosaveSettings = useWorkspacePersistenceStore(
    (s) => s.workspaceAutosaveSettings,
  );

  const releaseWorkspaceObjectUrls = useCallback(() => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url);
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    downloadItems.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    currentWatermarkWorkspaceState.results.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }, [currentWatermarkWorkspaceState.results, downloadItems, images]);

  const buildCurrentWorkspaceCaptureState =
    useCallback((): DashboardWorkspaceCaptureState => ({
      autosaveScope: authUser?.id ? 'user' : 'guest',
      autosaveUserId: authUser?.id ?? null,
      mode: useUiShellStore.getState().mode,
      subMode: useUiShellStore.getState().subMode,
      activeImageId: useImageCollectionStore.getState().activeId,
      viewMode: useUiShellStore.getState().viewMode,
      translatorWorkspaceMode,
      translatorVisualProcessingMode,
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
        sessionsByImage: typographerWorkspace.sessionsByImage,
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
      authUser?.id,
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
      statusMessage,
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
      subMode,
      tgtLang,
      translatorDetectionsByImage,
      translatorDraftText,
      translatorLastTextModelUsed,
      translatorProcessedBaseByImage,
      translatorRunMetaByImage,
      translatorSelectedRegionByImage,
      translatorTextDirty,
      translatorTranslatedText,
      translatorVisualProcessingMode,
      translatorWorkspaceMode,
      typographerQueueSelectedId,
      typographerSelectedSnapshotId,
      typographerSelectionTool,
      typographerSnapshotName,
      typographerWorkspace.sessionsByImage,
      viewMode,
    ]);

  useEffect(() => {
    if (!workspaceAutosaveSettings.enabled) {
      useWorkspacePersistenceStore.getState().latestWorkspaceCaptureState = null;
      return;
    }

    useWorkspacePersistenceStore.getState().latestWorkspaceCaptureState =
      buildCurrentWorkspaceCaptureState();
  }, [buildCurrentWorkspaceCaptureState, workspaceAutosaveSettings.enabled]);

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
