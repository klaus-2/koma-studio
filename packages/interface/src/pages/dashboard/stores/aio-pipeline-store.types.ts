import type { GpuStagePreferences } from '@/hooks/useAioSingleImageProcessor';
import type {
  AioDeviceInfo,
  AioLanguageOption,
  AioStageOptionMap,
} from '@/models/aioStageCatalog';
import type { DesktopMiniBackendRuntimeState } from '@/types';
import type {
  AioModelPresetStateV2,
  AioStageSelection,
} from '@/types/aioModelPresets';
import type { AioBatchProgress } from '@/pages/dashboard/lib/aio-batch-progress';
import type {
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioPresetEditorDraft,
  LoadedImage,
} from '@/types/dashboard.types';
import type {
  AioExecutionScope,
  AioExecutionStatus,
} from '@/utils/dashboardRenderUtils';

export type AioStepToggles = {
  detectText: boolean;
  recognizeText: boolean;
  getTranslations: boolean;
  segmentText: boolean;
  cleanImage: boolean;
  render: boolean;
};

export type StateUpdate<T> = T | ((previous: T) => T);

export interface AioEditableState {
  aioSteps: AioStepToggles;
  aioStageOptions: AioStageOptionMap;
  aioStageSelection: AioStageSelection;
  aioLanguageOptions: {
    source: AioLanguageOption[];
    target: AioLanguageOption[];
  };
  aioSrcLang: string;
  aioTgtLang: string;
  aioOptionsLoading: boolean;
  aioPresetState: AioModelPresetStateV2;
  aioPresetEditorDraft: AioPresetEditorDraft;
  aioMaskDilation: number;
  aioHdStrategy: 'original' | 'resize' | 'crop';
  aioHdResizeLimit: number;
  aioHdCropMargin: number;
  aioHdCropTriggerSize: number;
  aioDeviceInfo: AioDeviceInfo | null;
  aioMiniBackendRuntimeState: DesktopMiniBackendRuntimeState | null;
  aioExecutionStatus: AioExecutionStatus | null;
  batchThreadsEnabled: boolean;
  batchThreads: number;
  batchModeEnabled: boolean;
  /** chapterId -> preset id; an empty value follows the AIO setup. */
  batchChapterPresetByChapterId: Record<string, string>;
  aioBatchProgress: AioBatchProgress | null;
  aioPipelineSnapshots: AioPipelineSnapshot[];
  aioPipelineSnapshotIndex: number;
  aioImageSnapshotIndexById: Record<string, number>;
  aioAutoHistoryAvailable: boolean;
  aioAutoProcessedImageById: Record<string, boolean>;
  aioManualProgressByImage: Record<string, AioManualImageProgress>;
}

type AioStateSetters = {
  [K in keyof AioEditableState as `set${Capitalize<K>}`]: (
    update: StateUpdate<AioEditableState[K]>,
  ) => void;
};

export interface AioExecutionActions {
  clearAioExecutionState: (expectedController?: AbortController) => void;

  getActiveAioAbortSignal: () => AbortSignal | null;

  beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
    label: string,
  ) => AbortController;

  updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
    stageProgressLabel: string,
  ) => void;

  /** Counts one stage start of the concurrent path and moves the bar. */
  recordAioStageStarted: (
    image: LoadedImage,
    stageKey: AioPipelineSnapshotKey,
  ) => void;

  /** Moves the bar from the batch sidecar's started-stage count. */
  setAioExecutionUnitsStarted: (
    startedUnits: number,
    totalUnits: number,
  ) => void;

  stopAioExecution: (payload: {
    stopping: string;
    abortedByUser: string;
    restartSucceeded: string;
    restartFailed: string;
    totalImages: number;
    isDesktopRuntime: boolean;
  }) => void;
}

export interface AioPipelineStore
  extends AioEditableState,
  AioStateSetters,
  AioExecutionActions {
  aioGpuStages: GpuStagePreferences;
  aioAbortController: AbortController | null;
  aioExecutionId: number;
  aioBackendRestarting: boolean;

  aioExecutionProgress: {
    totalUnits: number;
    completedUnits: Set<string>;
  };

  updateAioGpuStage: (
    stage: keyof GpuStagePreferences,
    value: boolean,
  ) => void;

  invalidateAioPipelineHistory: () => void;
}

export type SetAioPipelineState = (
  update:
    | Partial<AioPipelineStore>
    | ((
      state: AioPipelineStore,
    ) => Partial<AioPipelineStore> | AioPipelineStore),
) => void;
