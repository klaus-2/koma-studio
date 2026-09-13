/**
 * AIO manual stage execution — wiring for the manual progress controls, the
 * manual stage executor, the stage skip, and the manual run entry point.
 * Split out of aio-pipeline.ts (T10); the entry file keeps orchestration and
 * re-exports this module.
 */
import { useCallback, useEffect } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
  MIN_REGION_SIZE,
} from '../../../constants/dashboard.constants';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { ModelInstallState } from '../../../models/types';
import type { AioStageKey } from '../../../types/aioModelPresets';
import { parseApiError } from '../helpers';
import {
  applyDetectedGradientToStyle,
  clamp,
} from '../../../utils/dashboard.utils';
import type { RenderTextStyle } from '../../../utils/renderText';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import type { AioExecutionScope } from '../../../utils/dashboardRenderUtils';
import type {
  AioDownloadEntry,
  AioManualImageEditState,
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
} from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useAioManualProgressControls } from '../../../hooks/useAioManualProgressControls';
import { useAioManualStageExecutor } from '../../../hooks/useAioManualStageExecutor';
import { useAioManualStageSkip } from '../../../hooks/useAioManualStageSkip';

/* ── Manual stage execution (progress controls, stage executor, skip, run entry) ── */

interface UseAioManualExecutionArgs {
  /* Cross-domain state not yet in stores (region-editor T07, manual-tools T08) */
  aioDetectionsByImage: Record<string, AioTextRegion[]>;
  aioSelectedRegionByImage: Record<string, string | null>;
  renderDefaultStyle: RenderTextStyle;
  getAioManualImageEditState: (imageId: string) => AioManualImageEditState;
  /* Page callbacks (snapshot/manual-history family still on the page) */
  applyAioPipelineSnapshotToImage: (
    imageId: string,
    index: number,
  ) => AioPipelineSnapshot | null;
  syncManualStagePreviewToNextStage: (
    imageId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  patchAioSnapshotStageForImage: (
    imageId: string,
    stageIndex: number,
    nextRegions: AioTextRegion[],
    downloadEntry?: AioDownloadEntry | null,
  ) => void;
  validateManualLocalStageModel: (
    stage: Exclude<AioStageKey, 'getTranslations'>,
    stageLabel: string,
    selectedKey: string,
  ) => boolean;
  getAioStageOption: (
    stageKey: 'recognizeText' | 'getTranslations',
    key: string,
  ) => AioStageOption | null;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void> | void;
  /* Page bindings that compute the execution i18n labels (kept at the call
     site per the T05b review decision — do not move into the store) */
  beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
  ) => void;
  updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
  ) => void;
  /* Page-derived values (memos / hook returns) */
  localApiUrl: string;
  modelEntries: Record<string, ModelInstallState>;
  compatibleTranslationModelIds: Set<string>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  activeManualProgress: AioManualImageProgress | null;
  resolvedActiveId: string | null;
}

export function useAioManualExecution({
  aioDetectionsByImage,
  aioSelectedRegionByImage,
  renderDefaultStyle,
  getAioManualImageEditState,
  applyAioPipelineSnapshotToImage,
  syncManualStagePreviewToNextStage,
  patchAioSnapshotStageForImage,
  validateManualLocalStageModel,
  getAioStageOption,
  recordProcessedPages,
  syncDiscordForTab,
  beginAioExecution,
  updateAioExecutionStage,
  localApiUrl,
  modelEntries,
  compatibleTranslationModelIds,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  activeManualProgress,
  resolvedActiveId,
}: UseAioManualExecutionArgs) {
  const activeId = useImageCollectionStore((s) => s.activeId);
  const images = useImageCollectionStore((s) => s.images);
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setRuntimeExecutionNotice = useStatusStore(
    (s) => s.setRuntimeExecutionNotice,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const aioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.aioImageSnapshotIndexById,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const aioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.aioAutoProcessedImageById,
  );
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );
  const aioGpuStages = useAioPipelineStore((s) => s.aioGpuStages);
  const clearAioExecutionState = useAioPipelineStore(
    (s) => s.clearAioExecutionState,
  );
  const getActiveAioAbortSignal = useAioPipelineStore(
    (s) => s.getActiveAioAbortSignal,
  );

  const {
    getAioRegionsFromSnapshot,
    setManualStageForActiveImage,
    completeManualStageForImage,
    syncActiveManualStageSnapshot,
  } = useAioManualProgressControls({
    activeId,
    aioPipelineSnapshots,
    aioManualProgressByImage,
    aioImageSnapshotIndexById,
    aioDetectionsByImage,
    aioSelectedRegionByImage,
    applyAioPipelineSnapshotToImage,
    syncManualStagePreviewToNextStage,
    setAioManualProgressByImage,
    setStatusMessage,
  });

  useEffect(() => {
    if (mode !== 'aio' || subMode !== 'manual') return;
    syncActiveManualStageSnapshot();
  }, [mode, subMode, syncActiveManualStageSnapshot]);

  const executeManualStageForActiveImage = useAioManualStageExecutor({
    activeId,
    processing,
    images,
    aioManualProgressByImage,
    aioAutoProcessedImageById,
    aioDetectionsByImage,
    aioStageOptions: {
      detectText: aioStageOptions.detectText,
      recognizeText: aioStageOptions.recognizeText,
      segmentText: aioStageOptions.segmentText,
      cleanImage: aioStageOptions.cleanImage,
    },
    aioStageSelection: {
      detectText: aioStageSelection.detectText,
      recognizeText: aioStageSelection.recognizeText,
      getTranslations: aioStageSelection.getTranslations,
      segmentText: aioStageSelection.segmentText,
      cleanImage: aioStageSelection.cleanImage,
    },
    aioSrcLang,
    aioTgtLang,
    aioMaskDilation,
    aioHdStrategy,
    aioHdResizeLimit,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    gpuStages: aioGpuStages,
    minRegionSize: MIN_REGION_SIZE,
    llmSettings,
    renderDefaultStyle,
    localApiUrl,
    modelEntries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
    getAioStageOption,
    parseApiError,
    getAioRegionsFromSnapshot,
    getAioManualImageEditState,
    patchAioSnapshotStageForImage,
    completeManualStageForImage,
    recordProcessedPages,
    syncDiscordForTab,
    setProcessing,
    setProgress,
    setStatusMessage,
    applyDetectedGradientToStyle,
    getAbortSignal: getActiveAioAbortSignal,
    onStageStart: (stageKey, image, index) =>
      updateAioExecutionStage('manual', stageKey, image, index, 1),
    setRuntimeExecutionNotice,
  });

  const skipManualStageForActiveImage = useAioManualStageSkip({
    activeId,
    aioManualProgressByImage,
    completeManualStageForImage,
    setStatusMessage,
  });

  const handleExecuteManualAioStage = useCallback(async () => {
    if (processing) {
      return;
    }
    setRuntimeExecutionNotice(null);

    if (resolvedActiveId && activeManualProgress) {
      const currentStageIndex = clamp(
        activeManualProgress.currentIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      beginAioExecution('manual', 1, [
        AIO_MANUAL_STAGE_ORDER[currentStageIndex]!,
      ]);
    }

    await executeManualStageForActiveImage();
    setTimeout(() => {
      // Read the processing mirror through the store at the same point the
      // baseline read `processingRef.current` (latest value at timeout-fire
      // time; the mirror ref itself had no other consumer and was removed).
      if (!useUiShellStore.getState().processing) {
        clearAioExecutionState();
      }
    }, 0);
  }, [
    activeManualProgress,
    beginAioExecution,
    clearAioExecutionState,
    executeManualStageForActiveImage,
    processing,
    resolvedActiveId,
    setRuntimeExecutionNotice,
  ]);

  return {
    setManualStageForActiveImage,
    executeManualStageForActiveImage,
    skipManualStageForActiveImage,
    handleExecuteManualAioStage,
  };
}
