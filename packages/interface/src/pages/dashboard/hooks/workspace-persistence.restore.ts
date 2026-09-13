/**
 * Workspace restore — applies a DashboardWorkspaceRestoreState back onto every
 * domain store (mode/collection/downloads, AIO, cleaner, translator,
 * typesetter, enhance, utility, LLM profiles & drafts). Split out of
 * workspace-persistence.ts (T10); the entry file keeps the orchestration.
 */
import { useCallback } from 'react';
import { useI18n } from '../../../i18n';
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
import type { DashboardWorkspaceRestoreState } from '../../../workspace/dashboardWorkspace';
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

interface UseWorkspaceRestoreStateArgs {
  /* Cross-domain (capture module + typographer workspace handle) */
  releaseWorkspaceObjectUrls: () => void;
  typographerWorkspace: ReturnType<typeof import('./typographer').useTypographerWorkspace>;
  setFreeProviderDrafts: (value: FreeProviderDraftMap) => void;
}

/**
 * Applies a restored workspace document to every store. The deps array is the
 * baseline one from the pre-split hook, preserved verbatim.
 */
export function useWorkspaceRestoreState({
  releaseWorkspaceObjectUrls,
  typographerWorkspace,
  setFreeProviderDrafts,
}: UseWorkspaceRestoreStateArgs) {
  const { t } = useI18n();
  const setMode = useUiShellStore((s) => s.setMode);
  const setSubMode = useUiShellStore((s) => s.setSubMode);
  const setViewMode = useUiShellStore((s) => s.setViewMode);
  const setImages = useImageCollectionStore((s) => s.setImages);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setDownloadItems = useExportStore((s) => s.setDownloadItems);
  const setLastActionScope = useExportStore((s) => s.setLastActionScope);
  const setAioSteps = useAioPipelineStore((s) => s.setAioSteps);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const setAioPresetState = useAioPipelineStore((s) => s.setAioPresetState);
  const setAioMaskDilation = useAioPipelineStore((s) => s.setAioMaskDilation);
  const setAioHdStrategy = useAioPipelineStore((s) => s.setAioHdStrategy);
  const setAioHdResizeLimit = useAioPipelineStore((s) => s.setAioHdResizeLimit);
  const setAioHdCropMargin = useAioPipelineStore((s) => s.setAioHdCropMargin);
  const setAioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.setAioHdCropTriggerSize,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const setAioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshotIndex,
  );
  const setAioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.setAioImageSnapshotIndexById,
  );
  const setAioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.setAioAutoHistoryAvailable,
  );
  const setAioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.setAioAutoProcessedImageById,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const setBatchThreads = useAioPipelineStore((s) => s.setBatchThreads);
  const setBatchThreadsEnabled = useAioPipelineStore(
    (s) => s.setBatchThreadsEnabled,
  );
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const setAioManualImageEditsByImage = useManualToolsStore(
    (s) => s.setAioManualImageEditsByImage,
  );
  const setAioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.setAioManualHealingBusyByImage,
  );
  const setCleanerDetectionsByImage = useCleanerStore(
    (s) => s.setCleanerDetectionsByImage,
  );
  const setCleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.setCleanerSelectedRegionByImage,
  );
  const setCleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.setCleanerProcessedBaseByImage,
  );
  const setCleanerRunMetaByImage = useCleanerStore(
    (s) => s.setCleanerRunMetaByImage,
  );
  const setCleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.setCleanerManualImageEditsByImage,
  );
  const setCleanerHealingBusyByImage = useCleanerStore(
    (s) => s.setCleanerHealingBusyByImage,
  );
  const setSrcLang = useTranslatorStore((s) => s.setSrcLang);
  const setTgtLang = useTranslatorStore((s) => s.setTgtLang);
  const setTranslatorWorkspaceMode = useTranslatorStore(
    (s) => s.setTranslatorWorkspaceMode,
  );
  const setTranslatorVisualProcessingMode = useTranslatorStore(
    (s) => s.setTranslatorVisualProcessingMode,
  );
  const setTranslatorDraftText = useTranslatorStore(
    (s) => s.setTranslatorDraftText,
  );
  const setTranslatorTranslatedText = useTranslatorStore(
    (s) => s.setTranslatorTranslatedText,
  );
  const setTranslatorLastTextModelUsed = useTranslatorStore(
    (s) => s.setTranslatorLastTextModelUsed,
  );
  const setTranslatorTextDirty = useTranslatorStore(
    (s) => s.setTranslatorTextDirty,
  );
  const setTranslatorVisualRunning = useTranslatorStore(
    (s) => s.setTranslatorVisualRunning,
  );
  const setTranslatorTextRunning = useTranslatorStore(
    (s) => s.setTranslatorTextRunning,
  );
  const setTranslatorDetectionsByImage = useTranslatorStore(
    (s) => s.setTranslatorDetectionsByImage,
  );
  const setTranslatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.setTranslatorSelectedRegionByImage,
  );
  const setTranslatorRunMetaByImage = useTranslatorStore(
    (s) => s.setTranslatorRunMetaByImage,
  );
  const setTranslatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.setTranslatorProcessedBaseByImage,
  );
  const setTypographerSelectionTool = useTypographerStore(
    (s) => s.setTypographerSelectionTool,
  );
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const setTypographerQueueSelectedId = useTypographerStore(
    (s) => s.setTypographerQueueSelectedId,
  );
  const setTypographerSnapshotName = useTypographerStore(
    (s) => s.setTypographerSnapshotName,
  );
  const setTypographerSelectedSnapshotId = useTypographerStore(
    (s) => s.setTypographerSelectedSnapshotId,
  );
  const setEnhanceScale = useEnhanceStore((s) => s.setEnhanceScale);
  const setEnhanceProfile = useEnhanceStore((s) => s.setEnhanceProfile);
  const setEnhanceModelId = useEnhanceStore((s) => s.setEnhanceModelId);
  const setEnhanceOutputFormat = useEnhanceStore(
    (s) => s.setEnhanceOutputFormat,
  );
  const setStitchLayoutMode = useUtilityStore((s) => s.setStitchLayoutMode);
  const setStitchBatchStrategy = useUtilityStore(
    (s) => s.setStitchBatchStrategy,
  );
  const setStitchBatchSize = useUtilityStore((s) => s.setStitchBatchSize);
  const setStitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.setStitchTargetPrimaryAxis,
  );
  const setStitchGap = useUtilityStore((s) => s.setStitchGap);
  const setStitchAlignMode = useUtilityStore((s) => s.setStitchAlignMode);
  const setStitchBackground = useUtilityStore((s) => s.setStitchBackground);
  const setStitchSingleExportFormat = useUtilityStore(
    (s) => s.setStitchSingleExportFormat,
  );
  const setStitchFileBaseName = useUtilityStore((s) => s.setStitchFileBaseName);
  const setStitchSelectedBatchIndex = useUtilityStore(
    (s) => s.setStitchSelectedBatchIndex,
  );
  const setStitchBatchIndexes = useUtilityStore(
    (s) => s.setStitchBatchIndexes,
  );
  const setSplitterWorkspaceState = useUtilityStore(
    (s) => s.setSplitterWorkspaceState,
  );
  const setWatermarkWorkspaceState = useUtilityStore(
    (s) => s.setWatermarkWorkspaceState,
  );
  const setOptimizerWorkspaceState = useUtilityStore(
    (s) => s.setOptimizerWorkspaceState,
  );
  const setLlmSettings = useLlmProvidersStore((s) => s.setLlmSettings);
  const setCustomLlmProfiles = useLlmProvidersStore(
    (s) => s.setCustomLlmProfiles,
  );
  const setCustomLlmProfilesMode = useLlmProvidersStore(
    (s) => s.setCustomLlmProfilesMode,
  );
  const setPendingCustomSelections = useLlmProvidersStore(
    (s) => s.setPendingCustomSelections,
  );
  const setCustomLlmDrafts = useLlmProvidersStore(
    (s) => s.setCustomLlmDrafts,
  );
  const setWorkspaceRestoreToken = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceRestoreToken,
  );
  const setWorkspaceStatus = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceStatus,
  );
  const setWorkspaceStatusDetail = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceStatusDetail,
  );
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);

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

  return { applyRestoredWorkspaceState };
}
