/**
 * Workspace persistence: one live capture builder and one ordered restore
 * plan.
 *
 * Capture reads every domain store plus the auth user id and produces the
 * state the signature builders stringify. Key insertion order is part of the
 * signature contract and is pinned by workspace-persistence.registry.test.ts.
 *
 * Restore applies a restored document through an ordered plan. Call order:
 * release object URLs FIRST, setActiveId before setImages, healing/running
 * resets in place, restore-token increment LAST among field writes,
 * processing/progress terminal. Document and asset codecs stay in
 * dashboardWorkspace.serialization.ts.
 */
import type {
  DashboardWorkspaceCaptureState,
  DashboardWorkspaceRestoreState,
} from '../../../workspace/dashboardWorkspace';
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
import { clampLlmRequestSettings } from '../../../utils/customLlm';
import type { CustomLlmStage } from '../../../utils/customLlm';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import type {
  StitchAlignMode,
  StitchBatchStrategy,
  StitchLayoutMode,
} from '../../../components/dashboard/stitch/types';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
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
import { resolveUtilityWorkspaceSnapshots } from './utility-workspaces';
import {
  buildRestoredCustomLlmDrafts,
  mergeRestoredCustomLlmProfiles,
  resolveRestoredCustomLlmProfilesMode,
} from './llm-providers.restore';

/* ── Store state type aliases (type-level queries, no casts) ── */

type AioPipelineStoreState = ReturnType<typeof useAioPipelineStore.getState>;
type TypographerStoreState = ReturnType<typeof useTypographerStore.getState>;

/* ── Unified domain-store subscription list ── */

/**
 * The domain stores whose changes drive both the capture mirror and the
 * history/autosave change signal. Order is part of the pre-existing
 * subscription order.
 */
export const WORKSPACE_PERSISTENCE_STORES: ReadonlyArray<{
  subscribe: (listener: () => void) => () => void;
}> = [
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
  // Hydration completion must fire the signal too: setWorkspaceHydrated(true)
  // re-seeds history through this subscription.
  useWorkspacePersistenceStore,
];

/* ── Capture ── */

export const buildWorkspaceCaptureState = (
  authUserId: string | null,
): DashboardWorkspaceCaptureState => {
  const uiShellStore = useUiShellStore.getState();
  const imageCollectionStore = useImageCollectionStore.getState();
  const statusStore = useStatusStore.getState();
  const exportStore = useExportStore.getState();
  const aioStore = useAioPipelineStore.getState();
  const regionEditorStore = useRegionEditorStore.getState();
  const manualToolsStore = useManualToolsStore.getState();
  const cleanerStore = useCleanerStore.getState();
  const translatorStore = useTranslatorStore.getState();
  const typographerStore = useTypographerStore.getState();
  const enhanceStore = useEnhanceStore.getState();
  const utilityStore = useUtilityStore.getState();
  const llmStore = useLlmProvidersStore.getState();
  const utilitySnapshots = resolveUtilityWorkspaceSnapshots(
    imageCollectionStore.activeId,
  );

  return {
    autosaveScope: authUserId ? 'user' : 'guest',
    autosaveUserId: authUserId ?? null,
    mode: uiShellStore.mode,
    subMode: uiShellStore.subMode,
    activeImageId: imageCollectionStore.activeId,
    viewMode: uiShellStore.viewMode,
    translatorWorkspaceMode: translatorStore.translatorWorkspaceMode,
    translatorVisualProcessingMode: translatorStore.translatorVisualProcessingMode,
    statusMessage: statusStore.statusMessage,
    lastActionScope: exportStore.lastActionScope,
    images: imageCollectionStore.images,
    downloadItems: exportStore.downloadItems,
    batchThreadsEnabled: aioStore.batchThreadsEnabled,
    batchThreads: aioStore.batchThreads,
    aio: {
      steps: aioStore.aioSteps,
      stageSelection: aioStore.aioStageSelection,
      presetState: aioStore.aioPresetState,
      maskDilation: aioStore.aioMaskDilation,
      hdStrategy: aioStore.aioHdStrategy,
      hdResizeLimit: aioStore.aioHdResizeLimit,
      hdCropMargin: aioStore.aioHdCropMargin,
      hdCropTriggerSize: aioStore.aioHdCropTriggerSize,
      detectionsByImage: regionEditorStore.aioDetectionsByImage,
      selectedRegionByImage: regionEditorStore.aioSelectedRegionByImage,
      pipelineSnapshots:
        aioStore.aioPipelineSnapshots as unknown as DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'],
      pipelineSnapshotIndex: aioStore.aioPipelineSnapshotIndex,
      imageSnapshotIndexById: aioStore.aioImageSnapshotIndexById,
      autoHistoryAvailable: aioStore.aioAutoHistoryAvailable,
      autoProcessedImageById: aioStore.aioAutoProcessedImageById,
      // v2 does not charge manual quota (unified-contract field used by v1)
      manualQuotaChargedByImage: {},
      manualProgressByImage: aioStore.aioManualProgressByImage,
      manualImageEditsByImage:
        manualToolsStore.aioManualImageEditsByImage as unknown as DashboardWorkspaceCaptureState['aio']['manualImageEditsByImage'],
    },
    cleaner: {
      detectionsByImage: cleanerStore.cleanerDetectionsByImage,
      selectedRegionByImage: cleanerStore.cleanerSelectedRegionByImage,
      processedBaseByImage: cleanerStore.cleanerProcessedBaseByImage,
      runMetaByImage: cleanerStore.cleanerRunMetaByImage,
      manualImageEditsByImage: cleanerStore.cleanerManualImageEditsByImage,
    },
    translator: {
      srcLang: translatorStore.srcLang,
      tgtLang: translatorStore.tgtLang,
      aioSrcLang: aioStore.aioSrcLang,
      aioTgtLang: aioStore.aioTgtLang,
      translatorDraftText: translatorStore.translatorDraftText,
      translatorTranslatedText: translatorStore.translatorTranslatedText,
      translatorLastTextModelUsed: translatorStore.translatorLastTextModelUsed,
      translatorTextDirty: translatorStore.translatorTextDirty,
      translatorDetectionsByImage: translatorStore.translatorDetectionsByImage,
      translatorSelectedRegionByImage: translatorStore.translatorSelectedRegionByImage,
      translatorRunMetaByImage: translatorStore.translatorRunMetaByImage,
      translatorProcessedBaseByImage: translatorStore.translatorProcessedBaseByImage,
    },
    typesetter: {
      selectionTool: typographerStore.typographerSelectionTool,
      queueSelectedId: typographerStore.typographerQueueSelectedId,
      snapshotName: typographerStore.typographerSnapshotName,
      selectedSnapshotId: typographerStore.typographerSelectedSnapshotId,
      sessionsByImage: typographerStore.typographerSessionsByImage,
    },
    enhance: {
      scale: enhanceStore.enhanceScale,
      profile: enhanceStore.enhanceProfile,
      modelId: enhanceStore.enhanceModelId,
      outputFormat: enhanceStore.enhanceOutputFormat,
    },
    utility: {
      stitch: {
        stitchLayoutMode: utilityStore.stitchLayoutMode,
        stitchBatchStrategy: utilityStore.stitchBatchStrategy,
        stitchBatchSize: utilityStore.stitchBatchSize,
        stitchTargetPrimaryAxis: utilityStore.stitchTargetPrimaryAxis,
        stitchGap: utilityStore.stitchGap,
        stitchAlignMode: utilityStore.stitchAlignMode,
        stitchBackground: utilityStore.stitchBackground,
        stitchSingleExportFormat: utilityStore.stitchSingleExportFormat,
        stitchFileBaseName: utilityStore.stitchFileBaseName,
        stitchSelectedBatchIndex: utilityStore.stitchSelectedBatchIndex,
        stitchBatchIndexes: utilityStore.stitchBatchIndexes,
      },
      splitter: utilitySnapshots.currentSplitterWorkspaceState,
      watermark: utilitySnapshots.currentWatermarkWorkspaceState,
      optimizer: utilitySnapshots.currentOptimizerWorkspaceState,
    },
    llm: {
      llmSettings: llmStore.llmSettings,
      customLlmProfiles: llmStore.customLlmProfiles,
      customLlmProfilesMode: llmStore.customLlmProfilesMode,
      pendingCustomSelections: llmStore.pendingCustomSelections,
      customLlmDrafts: llmStore.customLlmDrafts,
      freeProviderDrafts: llmStore.freeProviderDrafts,
    },
  };
};

/**
 * Rebuilds restored pipeline snapshots into the runtime shape/order the
 * stores declare (AioDownloadEntry: fileName, blob, sourceImageId). Restore
 * emits document order (fileName, sourceImageId, blob), and whole-object key
 * order is signature-visible. The terminal cast mirrors the restored-aio cast
 * in serialization.ts (the restore-state type declares asset refs where the
 * runtime value is a resolved Blob).
 */
const toRuntimeOrderedRestoredSnapshots = (
  restored: DashboardWorkspaceRestoreState,
): DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'] =>
  restored.aio.pipelineSnapshots.map((snapshot) => ({
    key: snapshot.key,
    label: snapshot.label,
    detectionsByImage: snapshot.detectionsByImage,
    selectedRegionByImage: snapshot.selectedRegionByImage,
    aioDownloads: snapshot.aioDownloads.map((download) => ({
      fileName: download.fileName,
      blob: download.blob,
      sourceImageId: download.sourceImageId,
    })),
  })) as DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'];

/* ── Restore apply ── */

export interface WorkspaceRestoreContext {
  /** MUST run first — releases the object URLs the restore is about to replace. */
  readonly releaseWorkspaceObjectUrls: () => void;
  /** Localized fallback when the document statusMessage is empty. */
  readonly statusMessageFallback: string;
  /** Localized footer workspace status detail for this restore. */
  readonly statusDetail: string;
}

export interface WorkspaceRestoreStep {
  readonly id: string;
  readonly run: (
    restored: DashboardWorkspaceRestoreState,
    ctx: WorkspaceRestoreContext,
  ) => void;
}

/**
 * Ordered restore plan. All `as` casts below are forced by the frozen document
 * types in packages/types/src/workspace.ts (for example view.mode: string).
 */
export const WORKSPACE_RESTORE_STEPS: ReadonlyArray<WorkspaceRestoreStep> = [
  {
    id: 'release-object-urls',
    run: (_restored, ctx) => {
      ctx.releaseWorkspaceObjectUrls();
    },
  },
  {
    id: 'view-and-active-image',
    run: (restored) => {
      // Organize no longer has a tab; legacy documents land on AIO.
      const restoredMode =
        restored.document.view.mode === 'organize'
          ? 'aio'
          : (restored.document.view.mode as ToolMode);
      useUiShellStore.getState().setMode(restoredMode);
      useUiShellStore.getState().setSubMode(restored.document.view.subMode as SubMode);
      // Legacy quirk preserved as-is: setActiveId runs before setViewMode and
      // before setImages.
      useImageCollectionStore.getState().setActiveId(restored.document.view.activeImageId);
      useUiShellStore.getState().setViewMode(restored.document.view.viewMode as ViewMode);
      useTranslatorStore.getState().setTranslatorWorkspaceMode(
        restored.document.view.translatorWorkspaceMode as TranslatorWorkspaceMode,
      );
      useTranslatorStore.getState().setTranslatorVisualProcessingMode(
        (restored.document.view.translatorVisualProcessingMode as TranslatorVisualProcessingMode | undefined) ?? 'standard',
      );
    },
  },
  {
    id: 'footer',
    run: (restored, ctx) => {
      useStatusStore.getState().setStatusMessage(
        restored.document.footer.statusMessage || ctx.statusMessageFallback,
      );
      useExportStore.getState().setLastActionScope(
        restored.document.footer.lastActionScope as ProcessableMode | null,
      );
    },
  },
  {
    id: 'collection-and-downloads',
    run: (restored) => {
      useImageCollectionStore.getState().setImages(restored.images);
      useExportStore.getState().setDownloadItems(restored.downloadItems);
    },
  },
  {
    id: 'batch-threads',
    run: (restored) => {
      useAioPipelineStore.getState().setBatchThreadsEnabled(restored.document.batchThreadsEnabled);
      useAioPipelineStore.getState().setBatchThreads(restored.document.batchThreads);
    },
  },
  {
    id: 'aio-fields',
    run: (restored) => {
      const aio = useAioPipelineStore.getState();
      const regionEditor = useRegionEditorStore.getState();
      const manualTools = useManualToolsStore.getState();
      aio.setAioSteps(restored.document.aio.steps as AioPipelineStoreState['aioSteps']);
      aio.setAioStageSelection(
        restored.document.aio.stageSelection as AioStageSelection,
      );
      aio.setAioPresetState(
        restored.document.aio.presetState as AioModelPresetStateV2,
      );
      aio.setAioMaskDilation(restored.document.aio.maskDilation);
      aio.setAioHdStrategy(
        restored.document.aio.hdStrategy as AioPipelineStoreState['aioHdStrategy'],
      );
      aio.setAioHdResizeLimit(restored.document.aio.hdResizeLimit);
      aio.setAioHdCropMargin(restored.document.aio.hdCropMargin);
      aio.setAioHdCropTriggerSize(restored.document.aio.hdCropTriggerSize);
      regionEditor.setAioDetectionsByImage(
        restored.document.aio.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      regionEditor.setAioSelectedRegionByImage(
        restored.document.aio.selectedRegionByImage,
      );
      aio.setAioPipelineSnapshots(
        toRuntimeOrderedRestoredSnapshots(restored) as unknown as AioPipelineSnapshot[],
      );
      aio.setAioPipelineSnapshotIndex(restored.document.aio.pipelineSnapshotIndex);
      aio.setAioImageSnapshotIndexById(
        restored.document.aio.imageSnapshotIndexById,
      );
      aio.setAioAutoHistoryAvailable(restored.document.aio.autoHistoryAvailable);
      aio.setAioAutoProcessedImageById(
        restored.document.aio.autoProcessedImageById,
      );
      aio.setAioManualProgressByImage(
        restored.document.aio.manualProgressByImage as Record<
          string,
          AioManualImageProgress
        >,
      );
      manualTools.setAioManualImageEditsByImage(
        restored.aio.manualImageEditsByImage as Record<
          string,
          AioManualImageEditState
        >,
      );
      manualTools.setAioManualHealingBusyByImage({});
    },
  },
  {
    id: 'cleaner-fields',
    run: (restored) => {
      const cleaner = useCleanerStore.getState();
      cleaner.setCleanerDetectionsByImage(
        restored.cleaner.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      cleaner.setCleanerSelectedRegionByImage(
        restored.cleaner.selectedRegionByImage,
      );
      cleaner.setCleanerProcessedBaseByImage(restored.cleaner.processedBaseByImage);
      cleaner.setCleanerRunMetaByImage(
        restored.document.cleaner.runMetaByImage as Record<
          string,
          CleanerRunMeta
        >,
      );
      cleaner.setCleanerManualImageEditsByImage(
        restored.cleaner.manualImageEditsByImage,
      );
      cleaner.setCleanerHealingBusyByImage({});
    },
  },
  {
    id: 'translator-fields',
    run: (restored) => {
      const translator = useTranslatorStore.getState();
      translator.setSrcLang(restored.document.translator.srcLang);
      translator.setTgtLang(restored.document.translator.tgtLang);
      const aio = useAioPipelineStore.getState();
      aio.setAioSrcLang(restored.document.translator.aioSrcLang);
      aio.setAioTgtLang(restored.document.translator.aioTgtLang);
      translator.setTranslatorDraftText(restored.document.translator.translatorDraftText);
      translator.setTranslatorTranslatedText(
        restored.document.translator.translatorTranslatedText,
      );
      translator.setTranslatorLastTextModelUsed(
        restored.document.translator.translatorLastTextModelUsed,
      );
      translator.setTranslatorTextDirty(restored.document.translator.translatorTextDirty);
      translator.setTranslatorDetectionsByImage(
        restored.document.translator
          .translatorDetectionsByImage as Record<string, AioTextRegion[]>,
      );
      translator.setTranslatorSelectedRegionByImage(
        restored.document.translator.translatorSelectedRegionByImage,
      );
      translator.setTranslatorRunMetaByImage(
        restored.document.translator
          .translatorRunMetaByImage as Record<string, TranslatorVisualRunMeta>,
      );
      translator.setTranslatorProcessedBaseByImage(
        restored.translator.translatorProcessedBaseByImage,
      );
      translator.setTranslatorVisualRunning(false);
      translator.setTranslatorTextRunning(false);
    },
  },
  {
    id: 'typographer-fields',
    run: (restored) => {
      const typographer = useTypographerStore.getState();
      typographer.setTypographerSelectionTool(
        restored.typesetter.selectionTool as TypographerStoreState['typographerSelectionTool'],
      );
      typographer.setTypographerQueueSelectedId(restored.typesetter.queueSelectedId);
      typographer.setTypographerSnapshotName(restored.typesetter.snapshotName);
      typographer.setTypographerSelectedSnapshotId(restored.typesetter.selectedSnapshotId);
      typographer.setTypographerSessionsByImage(restored.typesetter.sessionsByImage);
    },
  },
  {
    id: 'enhance-fields',
    run: (restored) => {
      const enhance = useEnhanceStore.getState();
      enhance.setEnhanceScale(restored.document.enhance.scale as EnhanceScale);
      enhance.setEnhanceProfile(
        restored.document.enhance.profile as EnhanceProfile,
      );
      enhance.setEnhanceModelId(restored.document.enhance.modelId);
      enhance.setEnhanceOutputFormat(
        restored.document.enhance.outputFormat as 'png' | 'webp',
      );
    },
  },
  {
    id: 'utility-fields',
    run: (restored) => {
      const utility = useUtilityStore.getState();
      utility.setStitchLayoutMode(
        restored.document.utility.stitch
          .stitchLayoutMode as StitchLayoutMode,
      );
      utility.setStitchBatchStrategy(
        restored.document.utility.stitch
          .stitchBatchStrategy as StitchBatchStrategy,
      );
      utility.setStitchBatchSize(restored.document.utility.stitch.stitchBatchSize);
      utility.setStitchTargetPrimaryAxis(
        restored.document.utility.stitch.stitchTargetPrimaryAxis,
      );
      utility.setStitchGap(restored.document.utility.stitch.stitchGap);
      utility.setStitchAlignMode(
        restored.document.utility.stitch.stitchAlignMode as StitchAlignMode,
      );
      utility.setStitchBackground(restored.document.utility.stitch.stitchBackground);
      utility.setStitchSingleExportFormat(
        restored.document.utility.stitch
          .stitchSingleExportFormat as 'png' | 'jpeg' | 'webp',
      );
      utility.setStitchFileBaseName(restored.document.utility.stitch.stitchFileBaseName);
      utility.setStitchSelectedBatchIndex(
        restored.document.utility.stitch.stitchSelectedBatchIndex,
      );
      utility.setStitchBatchIndexes(
        restored.document.utility.stitch.stitchBatchIndexes,
      );
      utility.setSplitterWorkspaceState(
        restored.utility.splitter as SplitterWorkspaceState | null,
      );
      utility.setWatermarkWorkspaceState(
        restored.utility.watermark as WatermarkWorkspaceState | null,
      );
      utility.setOptimizerWorkspaceState(
        restored.utility.optimizer as ChapterOptimizerWorkspaceState | null,
      );
    },
  },
  {
    id: 'llm-fields',
    run: (restored) => {
      const llm = useLlmProvidersStore.getState();
      llm.setLlmSettings(
        clampLlmRequestSettings(restored.document.llm.llmSettings),
      );
      llm.setCustomLlmProfiles(mergeRestoredCustomLlmProfiles(restored));
      llm.setCustomLlmProfilesMode(resolveRestoredCustomLlmProfilesMode(restored));
      llm.setPendingCustomSelections(
        restored.document.llm.pendingCustomSelections as Record<
          CustomLlmStage,
          string | null
        >,
      );
      llm.setCustomLlmDrafts(buildRestoredCustomLlmDrafts(restored));
      llm.setFreeProviderDrafts(
        restored.document.llm.freeProviderDrafts as FreeProviderDraftMap,
      );
    },
  },
  {
    id: 'terminal-status',
    run: (_restored, ctx) => {
      // Restore-token increment stays LAST among the field writes.
      useWorkspacePersistenceStore.getState().setWorkspaceRestoreToken((prev) => prev + 1);
      useWorkspacePersistenceStore.getState().setWorkspaceStatus('idle');
      useWorkspacePersistenceStore.getState().setWorkspaceStatusDetail(
        ctx.statusDetail,
      );
      useUiShellStore.getState().setProcessing(false);
      useUiShellStore.getState().setProgress(0);
    },
  },
];

/**
 * Applies a restored workspace document to every store through the ordered
 * registry plan. Uses getState() accessor writes (zustand setters are stable
 * identities), so the hook-level collaborators are the only context.
 */
export const applyRestoredWorkspaceToStores = (
  restored: DashboardWorkspaceRestoreState,
  ctx: WorkspaceRestoreContext,
): void => {
  for (const step of WORKSPACE_RESTORE_STEPS) {
    step.run(restored, ctx);
  }
};
