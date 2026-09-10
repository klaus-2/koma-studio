import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
  type DashboardWorkspaceRestoreState,
} from '../../../workspace/dashboardWorkspace';
import {
  createEmptyCustomLlmDraft,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
  type LlmRequestSettings,
} from '../../../utils/customLlm';
import type {
  AioManualImageEditState,
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioTextRegion,
  CleanerRunMeta,
  EnhanceProfile,
  EnhanceScale,
  FreeProviderDraftMap,
  ProcessableMode,
  SubMode,
  ToolMode,
  TranslatorVisualProcessingMode,
  TranslatorVisualRunMeta,
  TranslatorWorkspaceMode,
  ViewMode,
} from '../../../types/dashboard.types';
import type {
  AioModelPresetStateV2,
  AioStageSelection,
} from '../../../types/aioModelPresets';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
import type {
  StitchAlignMode,
  StitchBatchStrategy,
  StitchLayoutMode,
} from '../../../components/dashboard/stitch/types';
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
  const setSubMode = useUiShellStore((s) => s.setSubMode);
  const viewMode = useUiShellStore((s) => s.viewMode);
  const setViewMode = useUiShellStore((s) => s.setViewMode);
  const processing = useUiShellStore((s) => s.processing);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const images = useImageCollectionStore((s) => s.images);
  const setImages = useImageCollectionStore((s) => s.setImages);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const statusMessage = useStatusStore((s) => s.statusMessage);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);

  // Downloads
  const downloadItems = useExportStore((s) => s.downloadItems);
  const setDownloadItems = useExportStore((s) => s.setDownloadItems);
  const lastActionScope = useExportStore((s) => s.lastActionScope);
  const setLastActionScope = useExportStore((s) => s.setLastActionScope);

  // AIO pipeline
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const setAioSteps = useAioPipelineStore((s) => s.setAioSteps);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const aioPresetState = useAioPipelineStore((s) => s.aioPresetState);
  const setAioPresetState = useAioPipelineStore((s) => s.setAioPresetState);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const setAioMaskDilation = useAioPipelineStore((s) => s.setAioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const setAioHdStrategy = useAioPipelineStore((s) => s.setAioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const setAioHdResizeLimit = useAioPipelineStore(
    (s) => s.setAioHdResizeLimit,
  );
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const setAioHdCropMargin = useAioPipelineStore((s) => s.setAioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );
  const setAioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.setAioHdCropTriggerSize,
  );
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const aioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.aioPipelineSnapshotIndex,
  );
  const setAioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshotIndex,
  );
  const aioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.aioImageSnapshotIndexById,
  );
  const setAioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.setAioImageSnapshotIndexById,
  );
  const aioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.aioAutoHistoryAvailable,
  );
  const setAioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.setAioAutoHistoryAvailable,
  );
  const aioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.aioAutoProcessedImageById,
  );
  const setAioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.setAioAutoProcessedImageById,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const setBatchThreads = useAioPipelineStore((s) => s.setBatchThreads);
  const batchThreadsEnabled = useAioPipelineStore(
    (s) => s.batchThreadsEnabled,
  );
  const setBatchThreadsEnabled = useAioPipelineStore(
    (s) => s.setBatchThreadsEnabled,
  );

  // Region editor
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );

  // Manual tools
  const aioManualImageEditsByImage = useManualToolsStore(
    (s) => s.aioManualImageEditsByImage,
  );
  const setAioManualImageEditsByImage = useManualToolsStore(
    (s) => s.setAioManualImageEditsByImage,
  );
  const setAioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.setAioManualHealingBusyByImage,
  );

  // Cleaner
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => s.cleanerDetectionsByImage,
  );
  const setCleanerDetectionsByImage = useCleanerStore(
    (s) => s.setCleanerDetectionsByImage,
  );
  const cleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.cleanerSelectedRegionByImage,
  );
  const setCleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.setCleanerSelectedRegionByImage,
  );
  const cleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.cleanerProcessedBaseByImage,
  );
  const setCleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.setCleanerProcessedBaseByImage,
  );
  const cleanerRunMetaByImage = useCleanerStore(
    (s) => s.cleanerRunMetaByImage,
  );
  const setCleanerRunMetaByImage = useCleanerStore(
    (s) => s.setCleanerRunMetaByImage,
  );
  const cleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.cleanerManualImageEditsByImage,
  );
  const setCleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.setCleanerManualImageEditsByImage,
  );
  const setCleanerHealingBusyByImage = useCleanerStore(
    (s) => s.setCleanerHealingBusyByImage,
  );

  // Translator
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const setSrcLang = useTranslatorStore((s) => s.setSrcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const setTgtLang = useTranslatorStore((s) => s.setTgtLang);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const setTranslatorWorkspaceMode = useTranslatorStore(
    (s) => s.setTranslatorWorkspaceMode,
  );
  const translatorVisualProcessingMode = useTranslatorStore(
    (s) => s.translatorVisualProcessingMode,
  );
  const setTranslatorVisualProcessingMode = useTranslatorStore(
    (s) => s.setTranslatorVisualProcessingMode,
  );
  const translatorDraftText = useTranslatorStore((s) => s.translatorDraftText);
  const setTranslatorDraftText = useTranslatorStore(
    (s) => s.setTranslatorDraftText,
  );
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const setTranslatorTranslatedText = useTranslatorStore(
    (s) => s.setTranslatorTranslatedText,
  );
  const translatorLastTextModelUsed = useTranslatorStore(
    (s) => s.translatorLastTextModelUsed,
  );
  const setTranslatorLastTextModelUsed = useTranslatorStore(
    (s) => s.setTranslatorLastTextModelUsed,
  );
  const translatorTextDirty = useTranslatorStore((s) => s.translatorTextDirty);
  const setTranslatorTextDirty = useTranslatorStore(
    (s) => s.setTranslatorTextDirty,
  );
  const setTranslatorVisualRunning = useTranslatorStore(
    (s) => s.setTranslatorVisualRunning,
  );
  const setTranslatorTextRunning = useTranslatorStore(
    (s) => s.setTranslatorTextRunning,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const setTranslatorDetectionsByImage = useTranslatorStore(
    (s) => s.setTranslatorDetectionsByImage,
  );
  const translatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.translatorSelectedRegionByImage,
  );
  const setTranslatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.setTranslatorSelectedRegionByImage,
  );
  const translatorRunMetaByImage = useTranslatorStore(
    (s) => s.translatorRunMetaByImage,
  );
  const setTranslatorRunMetaByImage = useTranslatorStore(
    (s) => s.setTranslatorRunMetaByImage,
  );
  const translatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.translatorProcessedBaseByImage,
  );
  const setTranslatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.setTranslatorProcessedBaseByImage,
  );

  // Typographer
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const setTypographerSelectionTool = useTypographerStore(
    (s) => s.setTypographerSelectionTool,
  );
  const typographerQueueSelectedId = useTypographerStore(
    (s) => s.typographerQueueSelectedId,
  );
  const setTypographerQueueSelectedId = useTypographerStore(
    (s) => s.setTypographerQueueSelectedId,
  );
  const typographerSnapshotName = useTypographerStore(
    (s) => s.typographerSnapshotName,
  );
  const setTypographerSnapshotName = useTypographerStore(
    (s) => s.setTypographerSnapshotName,
  );
  const typographerSelectedSnapshotId = useTypographerStore(
    (s) => s.typographerSelectedSnapshotId,
  );
  const setTypographerSelectedSnapshotId = useTypographerStore(
    (s) => s.setTypographerSelectedSnapshotId,
  );

  // Enhance
  const enhanceScale = useEnhanceStore((s) => s.enhanceScale);
  const setEnhanceScale = useEnhanceStore((s) => s.setEnhanceScale);
  const enhanceProfile = useEnhanceStore((s) => s.enhanceProfile);
  const setEnhanceProfile = useEnhanceStore((s) => s.setEnhanceProfile);
  const enhanceModelId = useEnhanceStore((s) => s.enhanceModelId);
  const setEnhanceModelId = useEnhanceStore((s) => s.setEnhanceModelId);
  const enhanceOutputFormat = useEnhanceStore((s) => s.enhanceOutputFormat);
  const setEnhanceOutputFormat = useEnhanceStore(
    (s) => s.setEnhanceOutputFormat,
  );

  // Utility (stitch + workspace states)
  const stitchLayoutMode = useUtilityStore((s) => s.stitchLayoutMode);
  const setStitchLayoutMode = useUtilityStore((s) => s.setStitchLayoutMode);
  const stitchBatchStrategy = useUtilityStore((s) => s.stitchBatchStrategy);
  const setStitchBatchStrategy = useUtilityStore(
    (s) => s.setStitchBatchStrategy,
  );
  const stitchBatchSize = useUtilityStore((s) => s.stitchBatchSize);
  const setStitchBatchSize = useUtilityStore((s) => s.setStitchBatchSize);
  const stitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.stitchTargetPrimaryAxis,
  );
  const setStitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.setStitchTargetPrimaryAxis,
  );
  const stitchGap = useUtilityStore((s) => s.stitchGap);
  const setStitchGap = useUtilityStore((s) => s.setStitchGap);
  const stitchAlignMode = useUtilityStore((s) => s.stitchAlignMode);
  const setStitchAlignMode = useUtilityStore((s) => s.setStitchAlignMode);
  const stitchBackground = useUtilityStore((s) => s.stitchBackground);
  const setStitchBackground = useUtilityStore((s) => s.setStitchBackground);
  const stitchSingleExportFormat = useUtilityStore(
    (s) => s.stitchSingleExportFormat,
  );
  const setStitchSingleExportFormat = useUtilityStore(
    (s) => s.setStitchSingleExportFormat,
  );
  const stitchFileBaseName = useUtilityStore((s) => s.stitchFileBaseName);
  const setStitchFileBaseName = useUtilityStore(
    (s) => s.setStitchFileBaseName,
  );
  const stitchSelectedBatchIndex = useUtilityStore(
    (s) => s.stitchSelectedBatchIndex,
  );
  const setStitchSelectedBatchIndex = useUtilityStore(
    (s) => s.setStitchSelectedBatchIndex,
  );
  const stitchBatchIndexes = useUtilityStore((s) => s.stitchBatchIndexes);
  const setStitchBatchIndexes = useUtilityStore((s) => s.setStitchBatchIndexes);
  const setSplitterWorkspaceState = useUtilityStore(
    (s) => s.setSplitterWorkspaceState,
  );
  const setWatermarkWorkspaceState = useUtilityStore(
    (s) => s.setWatermarkWorkspaceState,
  );
  const setOptimizerWorkspaceState = useUtilityStore(
    (s) => s.setOptimizerWorkspaceState,
  );

  // LLM providers
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const setLlmSettings = useLlmProvidersStore((s) => s.setLlmSettings);
  const customLlmProfiles = useLlmProvidersStore((s) => s.customLlmProfiles);
  const setCustomLlmProfiles = useLlmProvidersStore(
    (s) => s.setCustomLlmProfiles,
  );
  const customLlmProfilesMode = useLlmProvidersStore(
    (s) => s.customLlmProfilesMode,
  );
  const setCustomLlmProfilesMode = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesMode,
  );
  const pendingCustomSelections = useLlmProvidersStore(
    (s) => s.pendingCustomSelections,
  );
  const setPendingCustomSelections = useLlmProvidersStore(
    (s) => s.setPendingCustomSelections,
  );
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const setCustomLlmDrafts = useLlmProvidersStore(
    (s) => s.setCustomLlmDrafts,
  );

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
  const setWorkspaceRestoreToken = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceRestoreToken,
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

  const applyRestoredWorkspaceState = useCallback(
    async (
      restored: DashboardWorkspaceRestoreState,
      options?: { statusDetail?: string },
    ) => {
      releaseWorkspaceObjectUrls();
      setMode(restored.document.view.mode as ToolMode);
      setSubMode(restored.document.view.subMode as SubMode);
      setActiveId(restored.document.view.activeImageId);
      setViewMode(restored.document.view.viewMode as ViewMode);
      setTranslatorWorkspaceMode(
        restored.document.view.translatorWorkspaceMode as TranslatorWorkspaceMode,
      );
      setTranslatorVisualProcessingMode(
        (restored.document.view.translatorVisualProcessingMode as TranslatorVisualProcessingMode | undefined) ?? 'standard',
      );
      setStatusMessage(
        restored.document.footer.statusMessage || t('dashboard.status.workspaceRestored'),
      );
      setLastActionScope(
        restored.document.footer.lastActionScope as ProcessableMode | null,
      );
      setImages(restored.images);
      setDownloadItems(restored.downloadItems);
      setBatchThreadsEnabled(restored.document.batchThreadsEnabled);
      setBatchThreads(restored.document.batchThreads);

      setAioSteps(restored.document.aio.steps as typeof aioSteps);
      setAioStageSelection(
        restored.document.aio.stageSelection as AioStageSelection,
      );
      setAioPresetState(
        restored.document.aio.presetState as AioModelPresetStateV2,
      );
      setAioMaskDilation(restored.document.aio.maskDilation);
      setAioHdStrategy(
        restored.document.aio.hdStrategy as typeof aioHdStrategy,
      );
      setAioHdResizeLimit(restored.document.aio.hdResizeLimit);
      setAioHdCropMargin(restored.document.aio.hdCropMargin);
      setAioHdCropTriggerSize(restored.document.aio.hdCropTriggerSize);
      setAioDetectionsByImage(
        restored.document.aio.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      setAioSelectedRegionByImage(
        restored.document.aio.selectedRegionByImage,
      );
      setAioPipelineSnapshots(
        restored.aio.pipelineSnapshots as unknown as AioPipelineSnapshot[],
      );
      setAioPipelineSnapshotIndex(restored.document.aio.pipelineSnapshotIndex);
      setAioImageSnapshotIndexById(
        restored.document.aio.imageSnapshotIndexById,
      );
      setAioAutoHistoryAvailable(restored.document.aio.autoHistoryAvailable);
      setAioAutoProcessedImageById(
        restored.document.aio.autoProcessedImageById,
      );
      setAioManualProgressByImage(
        restored.document.aio.manualProgressByImage as Record<
          string,
          AioManualImageProgress
        >,
      );
      setAioManualImageEditsByImage(
        restored.aio.manualImageEditsByImage as Record<
          string,
          AioManualImageEditState
        >,
      );
      setAioManualHealingBusyByImage({});

      setCleanerDetectionsByImage(
        restored.cleaner.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      setCleanerSelectedRegionByImage(
        restored.cleaner.selectedRegionByImage,
      );
      setCleanerProcessedBaseByImage(restored.cleaner.processedBaseByImage);
      setCleanerRunMetaByImage(
        restored.document.cleaner.runMetaByImage as Record<
          string,
          CleanerRunMeta
        >,
      );
      setCleanerManualImageEditsByImage(
        restored.cleaner.manualImageEditsByImage,
      );
      setCleanerHealingBusyByImage({});

      setSrcLang(restored.document.translator.srcLang);
      setTgtLang(restored.document.translator.tgtLang);
      setAioSrcLang(restored.document.translator.aioSrcLang);
      setAioTgtLang(restored.document.translator.aioTgtLang);
      setTranslatorDraftText(restored.document.translator.translatorDraftText);
      setTranslatorTranslatedText(
        restored.document.translator.translatorTranslatedText,
      );
      setTranslatorLastTextModelUsed(
        restored.document.translator.translatorLastTextModelUsed,
      );
      setTranslatorTextDirty(restored.document.translator.translatorTextDirty);
      setTranslatorDetectionsByImage(
        restored.document.translator
          .translatorDetectionsByImage as Record<string, AioTextRegion[]>,
      );
      setTranslatorSelectedRegionByImage(
        restored.document.translator.translatorSelectedRegionByImage,
      );
      setTranslatorRunMetaByImage(
        restored.document.translator
          .translatorRunMetaByImage as Record<string, TranslatorVisualRunMeta>,
      );
      setTranslatorProcessedBaseByImage(
        restored.translator.translatorProcessedBaseByImage,
      );
      setTranslatorVisualRunning(false);
      setTranslatorTextRunning(false);

      setTypographerSelectionTool(
        restored.typesetter.selectionTool as typeof typographerSelectionTool,
      );
      setTypographerQueueSelectedId(restored.typesetter.queueSelectedId);
      setTypographerSnapshotName(restored.typesetter.snapshotName);
      setTypographerSelectedSnapshotId(restored.typesetter.selectedSnapshotId);
      typographerWorkspace.replaceSessionsByImage(
        restored.typesetter.sessionsByImage,
      );

      setEnhanceScale(restored.document.enhance.scale as EnhanceScale);
      setEnhanceProfile(
        restored.document.enhance.profile as EnhanceProfile,
      );
      setEnhanceModelId(restored.document.enhance.modelId);
      setEnhanceOutputFormat(
        restored.document.enhance.outputFormat as 'png' | 'webp',
      );

      setStitchLayoutMode(
        restored.document.utility.stitch
          .stitchLayoutMode as StitchLayoutMode,
      );
      setStitchBatchStrategy(
        restored.document.utility.stitch
          .stitchBatchStrategy as StitchBatchStrategy,
      );
      setStitchBatchSize(restored.document.utility.stitch.stitchBatchSize);
      setStitchTargetPrimaryAxis(
        restored.document.utility.stitch.stitchTargetPrimaryAxis,
      );
      setStitchGap(restored.document.utility.stitch.stitchGap);
      setStitchAlignMode(
        restored.document.utility.stitch.stitchAlignMode as StitchAlignMode,
      );
      setStitchBackground(restored.document.utility.stitch.stitchBackground);
      setStitchSingleExportFormat(
        restored.document.utility.stitch
          .stitchSingleExportFormat as 'png' | 'jpeg' | 'webp',
      );
      setStitchFileBaseName(restored.document.utility.stitch.stitchFileBaseName);
      setStitchSelectedBatchIndex(
        restored.document.utility.stitch.stitchSelectedBatchIndex,
      );
      setStitchBatchIndexes(
        restored.document.utility.stitch.stitchBatchIndexes,
      );
      setSplitterWorkspaceState(
        restored.utility.splitter as SplitterWorkspaceState | null,
      );
      setWatermarkWorkspaceState(
        restored.utility.watermark as WatermarkWorkspaceState | null,
      );
      setOptimizerWorkspaceState(
        restored.utility.optimizer as ChapterOptimizerWorkspaceState | null,
      );

      setLlmSettings(
        restored.document.llm.llmSettings as LlmRequestSettings,
      );
      setCustomLlmProfiles((prev) => {
        const restoredProfiles =
          (restored.document.llm.customLlmProfiles as CustomLlmProfile[]) ?? [];
        const byId = new Map<string, CustomLlmProfile>();
        for (const profile of [...prev, ...restoredProfiles]) {
          if (!profile?.id) {
            continue;
          }
          const current = byId.get(profile.id);
          if (!current) {
            byId.set(profile.id, profile);
            continue;
          }
          const currentTime = Date.parse(current.updatedAt || current.createdAt || '');
          const nextTime = Date.parse(profile.updatedAt || profile.createdAt || '');
          if (Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime)) {
            byId.set(profile.id, profile);
          }
        }
        return Array.from(byId.values()).sort((left, right) =>
          left.label.localeCompare(right.label, 'pt-BR'),
        );
      });
      setCustomLlmProfilesMode((prev) => {
        if (prev === 'desktop_secure' || prev === 'desktop_local') {
          return prev;
        }
        return restored.document.llm.customLlmProfilesMode as LlmProfilesPersistenceMode;
      });
      setPendingCustomSelections(
        restored.document.llm.pendingCustomSelections as Record<
          CustomLlmStage,
          string | null
        >,
      );
      setCustomLlmDrafts(
        (() => {
          const restoredDrafts = restored.document.llm.customLlmDrafts as Record<CustomLlmStage, CustomLlmProfileDraft> | undefined;
          return {
            translation: restoredDrafts?.translation ?? createEmptyCustomLlmDraft(),
            ocr: restoredDrafts?.ocr ?? createEmptyCustomLlmDraft(),
            clean: restoredDrafts?.clean ?? createEmptyCustomLlmDraft(),
          };
        })(),
      );
      setFreeProviderDrafts(
        restored.document.llm.freeProviderDrafts as FreeProviderDraftMap,
      );
      setWorkspaceRestoreToken((prev) => prev + 1);
      setWorkspaceStatus('idle');
      setWorkspaceStatusDetail(
        options?.statusDetail ?? 'Workspace local restaurado.',
      );
      setProcessing(false);
      setProgress(0);
    },
    [
      aioHdStrategy,
      aioSteps,
      releaseWorkspaceObjectUrls,
      setActiveId,
      setAioAutoHistoryAvailable,
      setAioAutoProcessedImageById,
      setAioDetectionsByImage,
      setAioHdCropMargin,
      setAioHdCropTriggerSize,
      setAioHdResizeLimit,
      setAioHdStrategy,
      setAioImageSnapshotIndexById,
      setAioManualHealingBusyByImage,
      setAioManualImageEditsByImage,
      setAioManualProgressByImage,
      setAioMaskDilation,
      setAioPipelineSnapshotIndex,
      setAioPipelineSnapshots,
      setAioPresetState,
      setAioSelectedRegionByImage,
      setAioSrcLang,
      setAioStageSelection,
      setAioSteps,
      setAioTgtLang,
      setBatchThreads,
      setBatchThreadsEnabled,
      setCleanerDetectionsByImage,
      setCleanerHealingBusyByImage,
      setCleanerManualImageEditsByImage,
      setCleanerProcessedBaseByImage,
      setCleanerRunMetaByImage,
      setCleanerSelectedRegionByImage,
      setCustomLlmDrafts,
      setCustomLlmProfiles,
      setCustomLlmProfilesMode,
      setDownloadItems,
      setEnhanceModelId,
      setEnhanceOutputFormat,
      setEnhanceProfile,
      setEnhanceScale,
      setFreeProviderDrafts,
      setImages,
      setLastActionScope,
      setLlmSettings,
      setMode,
      setOptimizerWorkspaceState,
      setPendingCustomSelections,
      setProcessing,
      setProgress,
      setSrcLang,
      setSplitterWorkspaceState,
      setTgtLang,
      setStatusMessage,
      setStitchAlignMode,
      setStitchBackground,
      setStitchBatchIndexes,
      setStitchBatchSize,
      setStitchBatchStrategy,
      setStitchFileBaseName,
      setStitchGap,
      setStitchLayoutMode,
      setStitchSelectedBatchIndex,
      setStitchSingleExportFormat,
      setStitchTargetPrimaryAxis,
      setSubMode,
      setTonedStatus,
      setTranslatorDetectionsByImage,
      setTranslatorDraftText,
      setTranslatorLastTextModelUsed,
      setTranslatorProcessedBaseByImage,
      setTranslatorRunMetaByImage,
      setTranslatorSelectedRegionByImage,
      setTranslatorTextDirty,
      setTranslatorTextRunning,
      setTranslatorTranslatedText,
      setTranslatorVisualProcessingMode,
      setTranslatorVisualRunning,
      setTranslatorWorkspaceMode,
      setTypographerQueueSelectedId,
      setTypographerSelectedSnapshotId,
      setTypographerSelectionTool,
      setTypographerSnapshotName,
      setViewMode,
      setWatermarkWorkspaceState,
      setWorkspaceRestoreToken,
      setWorkspaceStatus,
      setWorkspaceStatusDetail,
      typographerSelectionTool,
      typographerWorkspace,
    ],
  );

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
