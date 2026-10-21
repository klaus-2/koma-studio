import { create } from 'zustand';

import {
  DEFAULT_AIO_STAGE_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
} from '@/models/aioStageCatalog';
import { createAioExecutionActions } from '@/pages/dashboard/stores/aio-pipeline-execution';
import {
  GPU_STAGES_STORAGE_KEY,
  loadGpuStagePreferences,
  loadValidatedPresetState,
  readAioStorage,
  writeAioStorage,
} from '@/pages/dashboard/stores/aio-pipeline-storage';
import type {
  AioEditableState,
  AioPipelineStore,
  StateUpdate,
} from '@/pages/dashboard/stores/aio-pipeline-store.types';
import {
  BATCH_THREADS_COUNT_STORAGE_KEY,
  BATCH_THREADS_ENABLED_STORAGE_KEY,
  parseStoredBatchThreads,
  parseStoredBatchThreadsEnabled,
} from '@/utils/concurrentBatch';

export type { AioStepToggles } from '@/pages/dashboard/stores/aio-pipeline-store.types';

function isStateUpdater<T>(
  update: StateUpdate<T>,
): update is (previous: T) => T {
  return typeof update === 'function';
}

export const useAioPipelineStore = create<AioPipelineStore>()((set, get) => {
  function setter<K extends keyof AioEditableState>(
    key: K,
  ): (update: StateUpdate<AioEditableState[K]>) => void {
    return (update): void => {
      set((state) => {
        const previous = state[key];
        const next = isStateUpdater(update) ? update(previous) : update;

        return Object.is(previous, next)
          ? state
          : { ...state, [key]: next };
      });
    };
  }

  return {
    aioSteps: {
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: true,
      cleanImage: true,
      render: true,
    },

    aioStageOptions: {
      detectText: [...DEFAULT_AIO_STAGE_OPTIONS.detectText],
      recognizeText: [...DEFAULT_AIO_STAGE_OPTIONS.recognizeText],
      getTranslations: [...DEFAULT_AIO_STAGE_OPTIONS.getTranslations],
      segmentText: [...DEFAULT_AIO_STAGE_OPTIONS.segmentText],
      cleanImage: [...DEFAULT_AIO_STAGE_OPTIONS.cleanImage],
    },

    aioStageSelection: {
      detectText: 'font_rtdetr_v2',
      recognizeText: 'manga_ocr',
      getTranslations: 'google_translate',
      segmentText: 'baka_content_cc',
      cleanImage: 'aot',
    },

    aioLanguageOptions: {
      source: [...SOURCE_LANGUAGE_OPTIONS],
      target: [...TARGET_LANGUAGE_OPTIONS],
    },

    aioSrcLang: 'ja',
    aioTgtLang: 'pt-br',
    aioOptionsLoading: false,
    aioPresetState: loadValidatedPresetState(),

    aioMaskDilation: 10,
    aioHdStrategy: 'original',
    aioHdResizeLimit: 960,
    aioHdCropMargin: 512,
    aioHdCropTriggerSize: 512,

    aioDeviceInfo: null,
    aioGpuStages: loadGpuStagePreferences(),
    aioMiniBackendRuntimeState: null,

    aioExecutionStatus: null,
    aioAbortController: null,
    aioExecutionId: 0,
    aioBackendRestarting: false,
    aioExecutionProgress: {
      totalUnits: 1,
      completedUnits: new Set<string>(),
    },

    batchThreadsEnabled: parseStoredBatchThreadsEnabled(
      readAioStorage(BATCH_THREADS_ENABLED_STORAGE_KEY),
    ),
    batchThreads: parseStoredBatchThreads(
      readAioStorage(BATCH_THREADS_COUNT_STORAGE_KEY),
    ),

    aioPipelineSnapshots: [],
    aioPipelineSnapshotIndex: -1,
    aioImageSnapshotIndexById: {},
    aioAutoHistoryAvailable: false,
    aioAutoProcessedImageById: {},
    aioManualProgressByImage: {},

    setAioSteps: setter('aioSteps'),
    setAioStageOptions: setter('aioStageOptions'),
    setAioStageSelection: setter('aioStageSelection'),
    setAioLanguageOptions: setter('aioLanguageOptions'),
    setAioSrcLang: setter('aioSrcLang'),
    setAioTgtLang: setter('aioTgtLang'),
    setAioOptionsLoading: setter('aioOptionsLoading'),
    setAioPresetState: setter('aioPresetState'),

    setAioMaskDilation: setter('aioMaskDilation'),
    setAioHdStrategy: setter('aioHdStrategy'),
    setAioHdResizeLimit: setter('aioHdResizeLimit'),
    setAioHdCropMargin: setter('aioHdCropMargin'),
    setAioHdCropTriggerSize: setter('aioHdCropTriggerSize'),

    setAioDeviceInfo: setter('aioDeviceInfo'),
    setAioMiniBackendRuntimeState: setter('aioMiniBackendRuntimeState'),
    setAioExecutionStatus: setter('aioExecutionStatus'),

    setBatchThreadsEnabled: (update) => {
      const previous = get().batchThreadsEnabled;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ batchThreadsEnabled: next });
      writeAioStorage(BATCH_THREADS_ENABLED_STORAGE_KEY, String(next));
    },

    setBatchThreads: (update) => {
      const previous = get().batchThreads;
      const requested = isStateUpdater(update) ? update(previous) : update;
      const next = parseStoredBatchThreads(String(requested));

      if (next === previous) {
        return;
      }

      set({ batchThreads: next });
      writeAioStorage(BATCH_THREADS_COUNT_STORAGE_KEY, String(next));
    },

    setAioPipelineSnapshots: setter('aioPipelineSnapshots'),
    setAioPipelineSnapshotIndex: setter('aioPipelineSnapshotIndex'),
    setAioImageSnapshotIndexById: setter('aioImageSnapshotIndexById'),
    setAioAutoHistoryAvailable: setter('aioAutoHistoryAvailable'),
    setAioAutoProcessedImageById: setter('aioAutoProcessedImageById'),
    setAioManualProgressByImage: setter('aioManualProgressByImage'),

    updateAioGpuStage: (stage, value) => {
      const previous = get().aioGpuStages;

      if (previous[stage] === value) {
        return;
      }

      const next = { ...previous, [stage]: value };

      set({ aioGpuStages: next });
      writeAioStorage(GPU_STAGES_STORAGE_KEY, JSON.stringify(next));
    },

    invalidateAioPipelineHistory: () => {
      const state = get();

      if (
        state.aioPipelineSnapshots.length === 0 &&
        state.aioPipelineSnapshotIndex === -1 &&
        Object.keys(state.aioImageSnapshotIndexById).length === 0 &&
        Object.keys(state.aioAutoProcessedImageById).length === 0 &&
        Object.keys(state.aioManualProgressByImage).length === 0 &&
        !state.aioAutoHistoryAvailable
      ) {
        return;
      }

      set({
        aioPipelineSnapshots: [],
        aioPipelineSnapshotIndex: -1,
        aioImageSnapshotIndexById: {},
        aioAutoHistoryAvailable: false,
        aioAutoProcessedImageById: {},
        aioManualProgressByImage: {},
      });
    },

    ...createAioExecutionActions(set, get),
  };
});
