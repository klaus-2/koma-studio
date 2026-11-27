import type { GpuStagePreferences } from '@/hooks/useAioSingleImageProcessor';
import type {
  AioDeviceInfo,
  AioLanguageOption,
  AioStageOptionMap,
  TranslationServiceAvailability,
} from '@/models/aioStageCatalog';
import type { DesktopMiniBackendRuntimeState } from '@/types';
import type {
  AioModelPresetStateV2,
  AioStageKey,
  AioStageSelection,
} from '@/types/aioModelPresets';
import type { StageModelRefusalDetail } from '@/aio-stages/transport';
import type { AioBatchProgress } from '@/pages/dashboard/lib/aio-batch-progress';
import type {
  AioAiOptions,
  ImageEditModelConfig,
} from '@/utils/imageEditModelConfig';
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
  aioHdStrategy: 'auto' | 'original' | 'resize' | 'crop';
  aioHdResizeLimit: number;
  aioHdCropMargin: number;
  aioHdCropTriggerSize: number;
  aioCleanViaAi: boolean;
  aioCleanAiModelKey: string;
  aioCleanAiInstructions: string;
  aioCleanAiModelConfig: ImageEditModelConfig;
  aioAiEnabled: boolean;
  aioAiModelKey: string;
  aioAiInstructions: string;
  aioAiOptions: AioAiOptions;
  aioAiModelConfig: ImageEditModelConfig;
  aioAiBakedImageIds: Record<string, boolean>;
  aioDeviceInfo: AioDeviceInfo | null;
  aioTranslationServiceAvailability: TranslationServiceAvailability;
  aioMiniBackendRuntimeState: DesktopMiniBackendRuntimeState | null;
  aioExecutionStatus: AioExecutionStatus | null;
  batchThreadsEnabled: boolean;
  batchThreads: number;
  batchModeEnabled: boolean;
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

  recordAioStageStarted: (
    image: LoadedImage,
    stageKey: AioPipelineSnapshotKey,
  ) => void;

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

  aioStageModelRefusals: Readonly<Partial<Record<AioStageKey, StageModelRefusalDetail>>>;
  setAioStageModelRefusal: (
    stage: AioStageKey,
    refusal: StageModelRefusalDetail | null,
  ) => void;

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
