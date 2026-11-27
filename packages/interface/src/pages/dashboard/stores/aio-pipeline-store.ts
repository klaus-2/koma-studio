import { create } from 'zustand';

import {
  DEFAULT_AIO_STAGE_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  LEGACY_CLOUD_STAGE_OPTION_KEYS,
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
  BATCH_CHAPTER_PRESETS_STORAGE_KEY,
  BATCH_MODE_ENABLED_STORAGE_KEY,
  BATCH_THREADS_COUNT_STORAGE_KEY,
  BATCH_THREADS_ENABLED_STORAGE_KEY,
  parseStoredBatchModeEnabled,
  parseStoredBatchThreads,
  parseStoredBatchThreadsEnabled,
} from '@/utils/concurrentBatch';
import { createEmptyAioPresetEditorDraft } from '@/utils/dashboard.utils';
import {
  sanitizeAioAiOptions,
  sanitizeImageEditModelConfig,
  type AioAiOptions,
  type ImageEditModelConfig,
} from '@/utils/imageEditModelConfig';

export type { AioStepToggles } from '@/pages/dashboard/stores/aio-pipeline-store.types';

const AIO_CLEAN_VIA_AI_STORAGE_KEY = 'koma-aio-clean-via-ai';
const AIO_CLEAN_AI_MODEL_STORAGE_KEY = 'koma-aio-clean-ai-model';
const AIO_CLEAN_AI_INSTRUCTIONS_STORAGE_KEY = 'koma-aio-clean-ai-instructions';
const AIO_CLEAN_AI_MODEL_CONFIG_STORAGE_KEY = 'koma-aio-clean-ai-model-config';
const AIO_AI_ENABLED_STORAGE_KEY = 'koma-aio-ai-enabled';
const AIO_AI_MODEL_STORAGE_KEY = 'koma-aio-ai-model';
const AIO_AI_INSTRUCTIONS_STORAGE_KEY = 'koma-aio-ai-instructions';
const AIO_AI_OPTIONS_STORAGE_KEY = 'koma-aio-ai-options';
const AIO_AI_MODEL_CONFIG_STORAGE_KEY = 'koma-aio-ai-model-config';

const parseStoredAioBoolean = (value: string | null): boolean => value === 'true';

const parseStoredAioString = (value: string | null): string => value ?? '';

const parseStoredJson = (value: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function loadChapterPresetAssignments(): Record<string, string> {
  const raw = readAioStorage(BATCH_CHAPTER_PRESETS_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return {};
    }

    const assignments: Record<string, string> = {};

    for (const [chapterId, presetId] of Object.entries(parsed)) {
      if (
        chapterId.trim().length > 0 &&
        typeof presetId === 'string' &&
        presetId.trim().length > 0
      ) {
        assignments[chapterId] = presetId;
      }
    }

    return assignments;
  } catch {
    return {};
  }
}

const INITIAL_AIO_STAGE_SELECTION = {
  detectText: 'font_rtdetr_v2',
  recognizeText: 'manga_ocr',
  getTranslations: 'google_translate',
  segmentText: 'ctd_text_seg',
  cleanImage: 'lama_manga',
} as const;

export function dropLegacyCloudStageSelection<T extends AioEditableState['aioStageSelection']>(
  selection: T,
): T {
  const legacyOcr = LEGACY_CLOUD_STAGE_OPTION_KEYS.has(selection.recognizeText);
  const legacyTranslation = LEGACY_CLOUD_STAGE_OPTION_KEYS.has(selection.getTranslations);
  if (!legacyOcr && !legacyTranslation) return selection;
  return {
    ...selection,
    recognizeText: legacyOcr ? INITIAL_AIO_STAGE_SELECTION.recognizeText : selection.recognizeText,
    getTranslations: legacyTranslation
      ? INITIAL_AIO_STAGE_SELECTION.getTranslations
      : selection.getTranslations,
  };
}

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

    aioStageSelection: { ...INITIAL_AIO_STAGE_SELECTION },

    aioStageModelRefusals: {},
    setAioStageModelRefusal: (stage, refusal) => {
      set((state) => {
        const previous = state.aioStageModelRefusals;
        if (refusal === null) {
          if (previous[stage] === undefined) {
            return state;
          }
          const next = { ...previous };
          delete next[stage];
          return { ...state, aioStageModelRefusals: next };
        }
        return { ...state, aioStageModelRefusals: { ...previous, [stage]: refusal } };
      });
    },

    aioLanguageOptions: {
      source: [...SOURCE_LANGUAGE_OPTIONS],
      target: [...TARGET_LANGUAGE_OPTIONS],
    },

    aioSrcLang: 'ja',
    aioTgtLang: 'pt-br',
    aioOptionsLoading: false,
    aioPresetState: loadValidatedPresetState(),
    aioPresetEditorDraft: createEmptyAioPresetEditorDraft({
      ...INITIAL_AIO_STAGE_SELECTION,
    }),

    aioMaskDilation: 5,
    aioHdStrategy: 'crop',
    aioHdResizeLimit: 960,
    aioHdCropMargin: 192,
    aioHdCropTriggerSize: 512,

    aioCleanViaAi: parseStoredAioBoolean(
      readAioStorage(AIO_CLEAN_VIA_AI_STORAGE_KEY),
    ),
    aioCleanAiModelKey: parseStoredAioString(
      readAioStorage(AIO_CLEAN_AI_MODEL_STORAGE_KEY),
    ),
    aioCleanAiInstructions: parseStoredAioString(
      readAioStorage(AIO_CLEAN_AI_INSTRUCTIONS_STORAGE_KEY),
    ),
    aioCleanAiModelConfig: sanitizeImageEditModelConfig(
      parseStoredJson(readAioStorage(AIO_CLEAN_AI_MODEL_CONFIG_STORAGE_KEY)),
    ),
    aioAiEnabled: parseStoredAioBoolean(
      readAioStorage(AIO_AI_ENABLED_STORAGE_KEY),
    ),
    aioAiModelKey: parseStoredAioString(
      readAioStorage(AIO_AI_MODEL_STORAGE_KEY),
    ),
    aioAiInstructions: parseStoredAioString(
      readAioStorage(AIO_AI_INSTRUCTIONS_STORAGE_KEY),
    ),
    aioAiOptions: sanitizeAioAiOptions(
      parseStoredJson(readAioStorage(AIO_AI_OPTIONS_STORAGE_KEY)),
    ),
    aioAiModelConfig: sanitizeImageEditModelConfig(
      parseStoredJson(readAioStorage(AIO_AI_MODEL_CONFIG_STORAGE_KEY)),
    ),
    aioAiBakedImageIds: {},

    aioDeviceInfo: null,
    aioTranslationServiceAvailability: {},
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
    batchModeEnabled: parseStoredBatchModeEnabled(
      readAioStorage(BATCH_MODE_ENABLED_STORAGE_KEY),
    ),
    batchChapterPresetByChapterId: loadChapterPresetAssignments(),
    aioBatchProgress: null,

    aioPipelineSnapshots: [],
    aioPipelineSnapshotIndex: -1,
    aioImageSnapshotIndexById: {},
    aioAutoHistoryAvailable: false,
    aioAutoProcessedImageById: {},
    aioManualProgressByImage: {},

    setAioSteps: setter('aioSteps'),
    setAioStageOptions: setter('aioStageOptions'),
    setAioStageSelection: (update) => {
      setter('aioStageSelection')((previous) =>
        dropLegacyCloudStageSelection(isStateUpdater(update) ? update(previous) : update),
      );
    },
    setAioLanguageOptions: setter('aioLanguageOptions'),
    setAioSrcLang: setter('aioSrcLang'),
    setAioTgtLang: setter('aioTgtLang'),
    setAioOptionsLoading: setter('aioOptionsLoading'),
    setAioPresetState: setter('aioPresetState'),
    setAioPresetEditorDraft: setter('aioPresetEditorDraft'),

    setAioMaskDilation: setter('aioMaskDilation'),
    setAioHdStrategy: setter('aioHdStrategy'),
    setAioHdResizeLimit: setter('aioHdResizeLimit'),
    setAioHdCropMargin: setter('aioHdCropMargin'),
    setAioHdCropTriggerSize: setter('aioHdCropTriggerSize'),

    setAioCleanViaAi: (update) => {
      const previous = get().aioCleanViaAi;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ aioCleanViaAi: next });
      writeAioStorage(AIO_CLEAN_VIA_AI_STORAGE_KEY, String(next));
    },

    setAioCleanAiModelKey: (update) => {
      const previous = get().aioCleanAiModelKey;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ aioCleanAiModelKey: next });
      writeAioStorage(AIO_CLEAN_AI_MODEL_STORAGE_KEY, next);
    },

    setAioCleanAiInstructions: (update) => {
      const previous = get().aioCleanAiInstructions;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ aioCleanAiInstructions: next });
      writeAioStorage(AIO_CLEAN_AI_INSTRUCTIONS_STORAGE_KEY, next);
    },

    setAioCleanAiModelConfig: (update) => {
      const previous = get().aioCleanAiModelConfig;
      const rawNext: ImageEditModelConfig = isStateUpdater(update)
        ? update(previous)
        : update;
      const next = sanitizeImageEditModelConfig(rawNext);
      set({ aioCleanAiModelConfig: next });
      writeAioStorage(
        AIO_CLEAN_AI_MODEL_CONFIG_STORAGE_KEY,
        JSON.stringify(next),
      );
    },

    setAioAiEnabled: (update) => {
      const previous = get().aioAiEnabled;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ aioAiEnabled: next });
      writeAioStorage(AIO_AI_ENABLED_STORAGE_KEY, String(next));
    },

    setAioAiModelKey: (update) => {
      const previous = get().aioAiModelKey;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ aioAiModelKey: next });
      writeAioStorage(AIO_AI_MODEL_STORAGE_KEY, next);
    },

    setAioAiInstructions: (update) => {
      const previous = get().aioAiInstructions;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ aioAiInstructions: next });
      writeAioStorage(AIO_AI_INSTRUCTIONS_STORAGE_KEY, next);
    },

    setAioAiOptions: (update) => {
      const previous = get().aioAiOptions;
      const rawNext: AioAiOptions = isStateUpdater(update)
        ? update(previous)
        : update;
      const next = sanitizeAioAiOptions(rawNext);
      set({ aioAiOptions: next });
      writeAioStorage(AIO_AI_OPTIONS_STORAGE_KEY, JSON.stringify(next));
    },

    setAioAiModelConfig: (update) => {
      const previous = get().aioAiModelConfig;
      const rawNext: ImageEditModelConfig = isStateUpdater(update)
        ? update(previous)
        : update;
      const next = sanitizeImageEditModelConfig(rawNext);
      set({ aioAiModelConfig: next });
      writeAioStorage(AIO_AI_MODEL_CONFIG_STORAGE_KEY, JSON.stringify(next));
    },

    setAioAiBakedImageIds: setter('aioAiBakedImageIds'),

    setAioDeviceInfo: setter('aioDeviceInfo'),
    setAioTranslationServiceAvailability: setter(
      'aioTranslationServiceAvailability',
    ),
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

    setBatchModeEnabled: (update) => {
      const previous = get().batchModeEnabled;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ batchModeEnabled: next });
      writeAioStorage(BATCH_MODE_ENABLED_STORAGE_KEY, String(next));
    },

    setBatchChapterPresetByChapterId: (update) => {
      const previous = get().batchChapterPresetByChapterId;
      const next = isStateUpdater(update) ? update(previous) : update;

      if (next === previous) {
        return;
      }

      set({ batchChapterPresetByChapterId: next });
      writeAioStorage(
        BATCH_CHAPTER_PRESETS_STORAGE_KEY,
        JSON.stringify(next),
      );
    },
    setAioBatchProgress: setter('aioBatchProgress'),

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
        Object.keys(state.aioAiBakedImageIds).length === 0 &&
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
        aioAiBakedImageIds: {},
      });
    },

    ...createAioExecutionActions(set, get),
  };
});
