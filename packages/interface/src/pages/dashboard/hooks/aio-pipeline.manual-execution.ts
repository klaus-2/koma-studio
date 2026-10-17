import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  AIO_MANUAL_STAGE_ORDER,
  MIN_REGION_SIZE,
} from '@/constants/dashboard.constants';
import { useAioManualProgressControls } from '@/hooks/useAioManualProgressControls';
import { useAioManualStageExecutor } from '@/hooks/useAioManualStageExecutor';
import { useAioManualStageSkip } from '@/hooks/useAioManualStageSkip';
import { useI18n } from '@/i18n';
import { parseApiError } from '@/pages/dashboard/helpers';
import { useAioManualSnapshotSync } from '@/pages/dashboard/hooks/use-aio-manual-snapshot-sync';
import { useCommittedAsyncAction } from '@/pages/dashboard/hooks/use-committed-async-action';
import {
  reportAioEvent,
  runAioNotification,
} from '@/pages/dashboard/lib/aio-observability';
import { createAioAbortError } from '@/pages/dashboard/lib/run-aio-batch';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { AioStageKey } from '@/types/aioModelPresets';
import type {
  AioManualImageProgress,
  AioPipelineSnapshotKey,
  LoadedImage,
} from '@/types/dashboard.types';
import { applyDetectedGradientToStyle } from '@/utils/dashboard.utils';
import {
  isAbortError,
  type AioExecutionScope,
} from '@/utils/dashboardRenderUtils';

type ExecutorArgs = Parameters<typeof useAioManualStageExecutor>[0];

interface UseAioManualExecutionArgs
  extends Pick<
    ExecutorArgs,
    | 'renderDefaultStyle'
    | 'getAioManualImageEditState'
    | 'getAioStageOption'
    | 'recordProcessedPages'
    | 'syncDiscordForTab'
    | 'localApiUrl'
    | 'modelEntries'
    | 'compatibleTranslationModelIds'
    | 'selectedCustomOcrProfile'
    | 'selectedCustomTranslationProfile'
  > {
  readonly activeManualProgress: AioManualImageProgress | null;
  readonly resolvedActiveId: string | null;

  readonly validateManualLocalStageModel: (
    stage: Exclude<AioStageKey, 'getTranslations'>,
    stageLabel: string,
    selectedKey: string,
  ) => boolean;

  readonly beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
  ) => void;

  readonly updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
  ) => void;
}

function isLocalStage(
  stage: string,
): stage is Exclude<AioStageKey, 'getTranslations'> {
  return (
    stage === 'detectText' ||
    stage === 'recognizeText' ||
    stage === 'segmentText' ||
    stage === 'cleanImage'
  );
}

export function useAioManualExecution(args: UseAioManualExecutionArgs) {
  const { t } = useI18n();
  const activeId = useImageCollectionStore((state) => state.activeId);
  const images = useImageCollectionStore((state) => state.images);
  const mode = useUiShellStore((state) => state.mode);
  const subMode = useUiShellStore((state) => state.subMode);
  const processing = useUiShellStore((state) => state.processing);
  const llmSettings = useLlmProvidersStore((state) => state.llmSettings);

  const autoProcessed = useAioPipelineStore(
    (state) => state.aioAutoProcessedImageById,
  );
  const stageOptions = useAioPipelineStore((state) => state.aioStageOptions);
  const stageSelection = useAioPipelineStore(
    (state) => state.aioStageSelection,
  );
  const sourceLanguage = useAioPipelineStore((state) => state.aioSrcLang);
  const targetLanguage = useAioPipelineStore((state) => state.aioTgtLang);
  const maskDilation = useAioPipelineStore((state) => state.aioMaskDilation);
  const hdStrategy = useAioPipelineStore((state) => state.aioHdStrategy);
  const hdResizeLimit = useAioPipelineStore(
    (state) => state.aioHdResizeLimit,
  );
  const hdCropMargin = useAioPipelineStore((state) => state.aioHdCropMargin);
  const hdCropTriggerSize = useAioPipelineStore(
    (state) => state.aioHdCropTriggerSize,
  );
  const gpuStages = useAioPipelineStore((state) => state.aioGpuStages);

  const runningRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort(createAioAbortError());
    };
  }, []);

  const onStageStart = useCallback(
    (
      stageKey: AioPipelineSnapshotKey,
      image: LoadedImage,
      index: number,
    ): void => {
      const controller = controllerRef.current;

      if (
        controller &&
        !controller.signal.aborted &&
        useAioPipelineStore.getState().aioAbortController === controller
      ) {
        args.updateAioExecutionStage('manual', stageKey, image, index, 1);
      }
    },
    [args.updateAioExecutionStage],
  );

  const validateStageModel = useCallback(
    (stageKey: string, stageLabel: string, modelKey: string): boolean =>
      isLocalStage(stageKey) &&
      args.validateManualLocalStageModel(stageKey, stageLabel, modelKey),
    [args.validateManualLocalStageModel],
  );

  const executorStageOptions = useMemo(
    () => ({
      detectText: stageOptions.detectText,
      recognizeText: stageOptions.recognizeText,
      segmentText: stageOptions.segmentText,
      cleanImage: stageOptions.cleanImage,
    }),
    [
      stageOptions.cleanImage,
      stageOptions.detectText,
      stageOptions.recognizeText,
      stageOptions.segmentText,
    ],
  );

  const progressControls = useAioManualProgressControls({
    activeId,
  });

  useAioManualSnapshotSync({
    enabled: mode === 'aio' && subMode === 'manual',
    activeId,
    synchronize: progressControls.syncActiveManualStageSnapshot,
  });

  const executeStage = useAioManualStageExecutor({
    activeId,
    processing,
    images,
    aioAutoProcessedImageById: autoProcessed,
    aioStageOptions: executorStageOptions,
    aioStageSelection: stageSelection,
    aioSrcLang: sourceLanguage,
    aioTgtLang: targetLanguage,
    aioMaskDilation: maskDilation,
    aioHdStrategy: hdStrategy,
    aioHdResizeLimit: hdResizeLimit,
    aioHdCropMargin: hdCropMargin,
    aioHdCropTriggerSize: hdCropTriggerSize,
    gpuStages,
    minRegionSize: MIN_REGION_SIZE,
    llmSettings,
    renderDefaultStyle: args.renderDefaultStyle,
    localApiUrl: args.localApiUrl,
    modelEntries: args.modelEntries,
    compatibleTranslationModelIds: args.compatibleTranslationModelIds,
    selectedCustomOcrProfile: args.selectedCustomOcrProfile,
    selectedCustomTranslationProfile: args.selectedCustomTranslationProfile,
    validateManualLocalStageModel: validateStageModel,
    getAioStageOption: args.getAioStageOption,
    parseApiError,
    getAioRegionsFromSnapshot: progressControls.getAioRegionsFromSnapshot,
    getAioManualImageEditState: args.getAioManualImageEditState,
    completeManualStageForImage: progressControls.completeManualStageForImage,
    recordProcessedPages: args.recordProcessedPages,
    syncDiscordForTab: () => runAioNotification(args.syncDiscordForTab),
    setProcessing: useUiShellStore.getState().setProcessing,
    setProgress: useUiShellStore.getState().setProgress,
    setStatusMessage: useStatusStore.getState().setStatusMessage,
    applyDetectedGradientToStyle,
    getAbortSignal: () => controllerRef.current?.signal ?? null,
    onStageStart,
    setRuntimeExecutionNotice:
      useStatusStore.getState().setRuntimeExecutionNotice,
  });

  const skipStage = useAioManualStageSkip({
    activeId,
    completeManualStageForImage: progressControls.completeManualStageForImage,
    setStatusMessage: useStatusStore.getState().setStatusMessage,
  });

  const executeManualStageForActiveImage = useCommittedAsyncAction(
    async (): Promise<void> => {
      const pipeline = useAioPipelineStore.getState();
      const currentActiveId = useImageCollectionStore.getState().activeId;

      if (
        runningRef.current ||
        processing ||
        useUiShellStore.getState().processing ||
        pipeline.aioAbortController ||
        pipeline.aioBackendRestarting ||
        !activeId ||
        currentActiveId !== activeId ||
        args.resolvedActiveId !== activeId ||
        !args.activeManualProgress
      ) {
        return;
      }

      const currentProgress =
        pipeline.aioManualProgressByImage[activeId] ??
        args.activeManualProgress;

      const index = currentProgress.currentIndex;
      const stage = Number.isInteger(index)
        ? AIO_MANUAL_STAGE_ORDER[index]
        : undefined;

      if (!stage) {
        return;
      }

      runningRef.current = true;

      try {
        useStatusStore.getState().setRuntimeExecutionNotice(null);
        args.beginAioExecution('manual', 1, [stage]);

        const controller =
          useAioPipelineStore.getState().aioAbortController;

        if (!controller) {
          throw new Error(
            'Manual AIO execution did not acquire a controller.',
          );
        }

        controllerRef.current = controller;

        await executeStage();
      } catch (error: unknown) {
        if (mountedRef.current) {
          const aborted = isAbortError(error);

          if (!aborted) {
            reportAioEvent('execution-failed', { scope: 'manual', pages: 1 });
          }

          useStatusStore.getState().setTonedStatus(
            t(
              aborted
                ? 'dashboard.status.aioAborted'
                : 'dashboard.status.aioExecutionFailed',
            ),
            aborted ? 'warning' : 'error',
          );
        }
      } finally {
        const controller = controllerRef.current;

        if (
          controller &&
          useAioPipelineStore.getState().aioAbortController === controller
        ) {
          useAioPipelineStore.getState().clearAioExecutionState(controller);
          useUiShellStore.getState().setProcessing(false);
          useUiShellStore.getState().setProgress(0);
          useStatusStore.getState().setRuntimeExecutionNotice(null);
        }

        controllerRef.current = null;
        runningRef.current = false;
      }
    },
  );

  const skipManualStageForActiveImage = useCallback(() => {
    if (
      runningRef.current ||
      useUiShellStore.getState().processing ||
      useAioPipelineStore.getState().aioAbortController ||
      useImageCollectionStore.getState().activeId !== activeId
    ) {
      return;
    }

    return skipStage();
  }, [activeId, skipStage]);

  return {
    setManualStageForActiveImage:
      progressControls.setManualStageForActiveImage,
    executeManualStageForActiveImage,
    skipManualStageForActiveImage,
    handleExecuteManualAioStage: executeManualStageForActiveImage,
  };
}
