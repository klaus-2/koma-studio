import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { DEFAULT_APP_LOCALE } from '../../../i18n/config';
import { translateMessage, type TranslationKey } from '../../../i18n/messages';
import {
  DEFAULT_AIO_STAGE_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  type AioDeviceInfo,
  type AioLanguageOption,
  type AioStageOptionMap,
} from '../../../models/aioStageCatalog';
import type { DesktopMiniBackendRuntimeState } from '../../../types';
import type {
  AioModelPresetStateV2,
  AioStageSelection,
} from '../../../types/aioModelPresets';
import type {
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  LoadedImage,
} from '../../../types/dashboard.types';
import type {
  AioExecutionScope,
  AioExecutionStatus,
} from '../../../utils/dashboardRenderUtils';
import {
  BATCH_THREADS_COUNT_STORAGE_KEY,
  BATCH_THREADS_ENABLED_STORAGE_KEY,
  DEFAULT_BATCH_THREADS,
  parseStoredBatchThreads,
  parseStoredBatchThreadsEnabled,
} from '../../../utils/concurrentBatch';
import { desktopBridge } from '../../../lib/desktop-bridge';
import { useStatusStore } from './status-store';
import { useUiShellStore } from './ui-shell-store';
import { loadPresetState } from '../../../utils/aioModelPresets';
import type { GpuStagePreferences } from '../../../hooks/useAioSingleImageProcessor';

/** The 6 pipeline step toggles of the AIO panel. */
// Type alias (not interface): the baseline useState inferred an anonymous object
// type, which carries an implicit string index signature — several consumers
// (capture/restore typing, `Record<string, boolean>` assignments) rely on it.
export type AioStepToggles = {
  detectText: boolean;
  recognizeText: boolean;
  getTranslations: boolean;
  segmentText: boolean;
  cleanImage: boolean;
  render: boolean;
};

const GPU_STAGES_STORAGE_KEY = 'koma-aio-gpu-stages';
const DEFAULT_GPU_STAGE_PREFERENCES: GpuStagePreferences = {
  detectText: true,
  recognizeText: true,
  segmentText: true,
  cleanImage: true,
};

const isBrowser = (): boolean => typeof window !== 'undefined';

// Same lazy initialization the page's useState had: reads (and validates) the
// persisted per-stage GPU preferences on first use.
const loadGpuStagePreferences = (): GpuStagePreferences => {
  if (!isBrowser()) {
    return DEFAULT_GPU_STAGE_PREFERENCES;
  }
  try {
    const saved = window.localStorage.getItem(GPU_STAGES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<GpuStagePreferences>;
      return {
        detectText: parsed.detectText !== false,
        recognizeText: parsed.recognizeText !== false,
        segmentText: parsed.segmentText !== false,
        cleanImage: parsed.cleanImage !== false,
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_GPU_STAGE_PREFERENCES;
};

// The language option labels are i18n keys (e.g. "aioStage.lang.en"). The
// page's useState initial value translated them through `t`, and on first
// render only the default (en) catalog is available synchronously — so
// translating with DEFAULT_APP_LOCALE here reproduces the exact same strings.
const initialAioLanguageOptions = (): {
  source: AioLanguageOption[];
  target: AioLanguageOption[];
} => ({
  source: SOURCE_LANGUAGE_OPTIONS.map((option) => ({
    ...option,
    label: translateMessage(
      DEFAULT_APP_LOCALE,
      option.label as TranslationKey,
    ),
  })),
  target: TARGET_LANGUAGE_OPTIONS.map((option) => ({
    ...option,
    label: translateMessage(
      DEFAULT_APP_LOCALE,
      option.label as TranslationKey,
    ),
  })),
});

interface AioPipelineStore {
  /* ── Pipeline step toggles ── */
  aioSteps: AioStepToggles;

  /* ── Stage catalogs & selection ── */
  aioStageOptions: AioStageOptionMap;
  aioStageSelection: AioStageSelection;
  aioLanguageOptions: { source: AioLanguageOption[]; target: AioLanguageOption[] };
  aioSrcLang: string;
  aioTgtLang: string;
  aioOptionsLoading: boolean;

  /* ── Per-language model presets ── */
  aioPresetState: AioModelPresetStateV2;

  /* ── Inpaint / HD config ── */
  aioMaskDilation: number;
  aioHdStrategy: 'original' | 'resize' | 'crop';
  aioHdResizeLimit: number;
  aioHdCropMargin: number;
  aioHdCropTriggerSize: number;

  /* ── Hardware / backend runtime ── */
  aioDeviceInfo: AioDeviceInfo | null;
  aioGpuStages: GpuStagePreferences;
  aioMiniBackendRuntimeState: DesktopMiniBackendRuntimeState | null;

  /* ── Execution run-state ── */
  aioExecutionStatus: AioExecutionStatus | null;
  batchThreadsEnabled: boolean;
  batchThreads: number;

  /* ── Snapshot / manual history ── */
  aioPipelineSnapshots: AioPipelineSnapshot[];
  aioPipelineSnapshotIndex: number;
  aioImageSnapshotIndexById: Record<string, number>;
  aioAutoHistoryAvailable: boolean;
  aioAutoProcessedImageById: Record<string, boolean>;
  aioManualProgressByImage: Record<string, AioManualImageProgress>;

  /* Internal execution machinery (non-reactive; mirrors the old page refs). */
  aioAbortController: AbortController | null;
  aioExecutionProgress: {
    totalUnits: number;
    completedUnits: Set<string>;
  };

  setAioSteps: (
    steps: AioStepToggles | ((prev: AioStepToggles) => AioStepToggles),
  ) => void;
  setAioStageOptions: (
    options:
      | AioStageOptionMap
      | ((prev: AioStageOptionMap) => AioStageOptionMap),
  ) => void;
  setAioStageSelection: (
    selection:
      | AioStageSelection
      | ((prev: AioStageSelection) => AioStageSelection),
  ) => void;
  setAioLanguageOptions: (
    options:
      | {
          source: AioLanguageOption[];
          target: AioLanguageOption[];
        }
      | ((prev: {
          source: AioLanguageOption[];
          target: AioLanguageOption[];
        }) => {
          source: AioLanguageOption[];
          target: AioLanguageOption[];
        }),
  ) => void;
  setAioSrcLang: (lang: string | ((prev: string) => string)) => void;
  setAioTgtLang: (lang: string | ((prev: string) => string)) => void;
  setAioOptionsLoading: (loading: boolean) => void;
  setAioPresetState: (
    state:
      | AioModelPresetStateV2
      | ((prev: AioModelPresetStateV2) => AioModelPresetStateV2),
  ) => void;
  setAioMaskDilation: (value: number) => void;
  setAioHdStrategy: (strategy: 'original' | 'resize' | 'crop') => void;
  setAioHdResizeLimit: (value: number) => void;
  setAioHdCropMargin: (value: number) => void;
  setAioHdCropTriggerSize: (value: number) => void;
  setAioDeviceInfo: (deviceInfo: AioDeviceInfo | null) => void;
  setAioMiniBackendRuntimeState: (
    runtimeState: DesktopMiniBackendRuntimeState | null,
  ) => void;
  /** Toggles one stage's GPU preference and persists it (same key/format as before). */
  updateAioGpuStage: (stage: keyof GpuStagePreferences, value: boolean) => void;

  /* ── Execution run-state actions ── */
  setAioExecutionStatus: (
    status:
      | AioExecutionStatus
      | null
      | ((prev: AioExecutionStatus | null) => AioExecutionStatus | null),
  ) => void;
  setBatchThreadsEnabled: (enabled: boolean) => void;
  setBatchThreads: (threads: number) => void;

  /* ── Snapshot / manual history actions (value-or-updater: executor hooks
     type these as React.Dispatch<React.SetStateAction<T>>) ── */
  setAioPipelineSnapshots: (
    value:
      | AioPipelineSnapshot[]
      | ((prev: AioPipelineSnapshot[]) => AioPipelineSnapshot[]),
  ) => void;
  setAioPipelineSnapshotIndex: (
    value: number | ((prev: number) => number),
  ) => void;
  setAioImageSnapshotIndexById: (
    value:
      | Record<string, number>
      | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  setAioAutoHistoryAvailable: (
    value: boolean | ((prev: boolean) => boolean),
  ) => void;
  setAioAutoProcessedImageById: (
    value:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  setAioManualProgressByImage: (
    value:
      | Record<string, AioManualImageProgress>
      | ((
          prev: Record<string, AioManualImageProgress>,
        ) => Record<string, AioManualImageProgress>),
  ) => void;
  /** Clears the whole pipeline history (5 members) in one atomic update. */
  invalidateAioPipelineHistory: () => void;

  /* ── Execution helpers (moved 1:1 from the page; the label strings are
     computed with the page's `t` to preserve its closure semantics) ── */
  clearAioExecutionState: () => void;
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
  stopAioExecution: (payload: {
    stopping: string;
    abortedByUser: string;
    restartSucceeded: string;
    restartFailed: string;
    totalImages: number;
    isDesktopRuntime: boolean;
  }) => void;
}

export const useAioPipelineStore = create<AioPipelineStore>()(
  devtools(
    (set, get) => ({
      aioSteps: {
        detectText: true,
        recognizeText: true,
        getTranslations: true,
        segmentText: true,
        cleanImage: true,
        render: true,
      },
      aioStageOptions: DEFAULT_AIO_STAGE_OPTIONS,
      aioStageSelection: {
        detectText: 'font_rtdetr_v2',
        recognizeText: 'manga_ocr',
        getTranslations: 'google_translate',
        segmentText: 'baka_content_cc',
        cleanImage: 'aot',
      },
      aioLanguageOptions: initialAioLanguageOptions(),
      aioSrcLang: 'ja',
      aioTgtLang: 'pt-br',
      aioOptionsLoading: false,
      // Same lazy initialization the page's useState had.
      aioPresetState: loadPresetState(),
      aioMaskDilation: 10,
      aioHdStrategy: 'original',
      aioHdResizeLimit: 960,
      aioHdCropMargin: 512,
      aioHdCropTriggerSize: 512,
      aioDeviceInfo: null,
      // Same lazy initialization the page's useState had.
      aioGpuStages: loadGpuStagePreferences(),
      aioMiniBackendRuntimeState: null,

      // Same lazy initialization the page's useState had.
      aioExecutionStatus: null,
      batchThreadsEnabled: isBrowser()
        ? parseStoredBatchThreadsEnabled(
            window.localStorage.getItem(BATCH_THREADS_ENABLED_STORAGE_KEY),
          )
        : true,
      batchThreads: isBrowser()
        ? parseStoredBatchThreads(
            window.localStorage.getItem(BATCH_THREADS_COUNT_STORAGE_KEY),
          )
        : DEFAULT_BATCH_THREADS,
      aioPipelineSnapshots: [],
      aioPipelineSnapshotIndex: -1,
      aioImageSnapshotIndexById: {},
      aioAutoHistoryAvailable: false,
      aioAutoProcessedImageById: {},
      aioManualProgressByImage: {},
      aioAbortController: null,
      aioExecutionProgress: {
        totalUnits: 1,
        completedUnits: new Set<string>(),
      },

      setAioSteps: (steps) =>
        set((state) => ({
          aioSteps:
            typeof steps === 'function' ? steps(state.aioSteps) : steps,
        })),
      setAioStageOptions: (options) =>
        set((state) => ({
          aioStageOptions:
            typeof options === 'function'
              ? options(state.aioStageOptions)
              : options,
        })),
      setAioStageSelection: (selection) =>
        set((state) => ({
          aioStageSelection:
            typeof selection === 'function'
              ? selection(state.aioStageSelection)
              : selection,
        })),
      setAioLanguageOptions: (aioLanguageOptions) =>
        set((state) => ({
          aioLanguageOptions:
            typeof aioLanguageOptions === 'function'
              ? aioLanguageOptions(state.aioLanguageOptions)
              : aioLanguageOptions,
        })),
      setAioSrcLang: (aioSrcLang) =>
        set((state) => ({
          aioSrcLang:
            typeof aioSrcLang === 'function'
              ? aioSrcLang(state.aioSrcLang)
              : aioSrcLang,
        })),
      setAioTgtLang: (aioTgtLang) =>
        set((state) => ({
          aioTgtLang:
            typeof aioTgtLang === 'function'
              ? aioTgtLang(state.aioTgtLang)
              : aioTgtLang,
        })),
      setAioOptionsLoading: (aioOptionsLoading) =>
        set({ aioOptionsLoading }),
      setAioPresetState: (aioPresetState) =>
        set((state) => ({
          aioPresetState:
            typeof aioPresetState === 'function'
              ? aioPresetState(state.aioPresetState)
              : aioPresetState,
        })),
      setAioMaskDilation: (aioMaskDilation) => set({ aioMaskDilation }),
      setAioHdStrategy: (aioHdStrategy) => set({ aioHdStrategy }),
      setAioHdResizeLimit: (aioHdResizeLimit) => set({ aioHdResizeLimit }),
      setAioHdCropMargin: (aioHdCropMargin) => set({ aioHdCropMargin }),
      setAioHdCropTriggerSize: (aioHdCropTriggerSize) =>
        set({ aioHdCropTriggerSize }),
      setAioDeviceInfo: (aioDeviceInfo) => set({ aioDeviceInfo }),
      setAioMiniBackendRuntimeState: (aioMiniBackendRuntimeState) =>
        set((state) =>
          state.aioMiniBackendRuntimeState === aioMiniBackendRuntimeState
            ? state
            : { aioMiniBackendRuntimeState },
        ),
      updateAioGpuStage: (stage, value) =>
        set((state) => {
          const next = { ...state.aioGpuStages, [stage]: value };
          try {
            window.localStorage.setItem(
              GPU_STAGES_STORAGE_KEY,
              JSON.stringify(next),
            );
          } catch { /* ignore */ }
          return { aioGpuStages: next };
        }),

      setAioExecutionStatus: (status) =>
        set((state) => ({
          aioExecutionStatus:
            typeof status === 'function'
              ? status(state.aioExecutionStatus)
              : status,
        })),
      setBatchThreadsEnabled: (batchThreadsEnabled) =>
        set({ batchThreadsEnabled }),
      setBatchThreads: (batchThreads) => set({ batchThreads }),

      setAioPipelineSnapshots: (value) =>
        set((state) => ({
          aioPipelineSnapshots:
            typeof value === 'function' ? value(state.aioPipelineSnapshots) : value,
        })),
      setAioPipelineSnapshotIndex: (value) =>
        set((state) => ({
          aioPipelineSnapshotIndex:
            typeof value === 'function'
              ? value(state.aioPipelineSnapshotIndex)
              : value,
        })),
      setAioImageSnapshotIndexById: (value) =>
        set((state) => ({
          aioImageSnapshotIndexById:
            typeof value === 'function'
              ? value(state.aioImageSnapshotIndexById)
              : value,
        })),
      setAioAutoHistoryAvailable: (value) =>
        set((state) => ({
          aioAutoHistoryAvailable:
            typeof value === 'function'
              ? value(state.aioAutoHistoryAvailable)
              : value,
        })),
      setAioAutoProcessedImageById: (value) =>
        set((state) => ({
          aioAutoProcessedImageById:
            typeof value === 'function'
              ? value(state.aioAutoProcessedImageById)
              : value,
        })),
      setAioManualProgressByImage: (value) =>
        set((state) => ({
          aioManualProgressByImage:
            typeof value === 'function'
              ? value(state.aioManualProgressByImage)
              : value,
        })),
      invalidateAioPipelineHistory: () =>
        set((state) => ({
          aioPipelineSnapshots:
            state.aioPipelineSnapshots.length > 0
              ? []
              : state.aioPipelineSnapshots,
          aioPipelineSnapshotIndex:
            state.aioPipelineSnapshotIndex !== -1
              ? -1
              : state.aioPipelineSnapshotIndex,
          aioImageSnapshotIndexById:
            Object.keys(state.aioImageSnapshotIndexById).length > 0
              ? {}
              : state.aioImageSnapshotIndexById,
          aioAutoHistoryAvailable: false,
          aioManualProgressByImage:
            Object.keys(state.aioManualProgressByImage).length > 0
              ? {}
              : state.aioManualProgressByImage,
        })),

      // 1:1 port of the page's execution helpers. The AbortController and the
      // progress tracker used to be refs — they keep the same non-reactive
      // semantics here (the tracker is mutated in place, without notifying).
      clearAioExecutionState: () =>
        set({
          aioAbortController: null,
          aioExecutionProgress: {
            totalUnits: 1,
            completedUnits: new Set<string>(),
          },
          aioExecutionStatus: null,
        }),
      getActiveAioAbortSignal: () => get().aioAbortController?.signal ?? null,
      beginAioExecution: (scope, totalImages, stageKeys, label) => {
        const controller = new AbortController();
        set({
          aioAbortController: controller,
          aioExecutionProgress: {
            totalUnits: Math.max(1, totalImages * Math.max(1, stageKeys.length)),
            completedUnits: new Set<string>(),
          },
          aioExecutionStatus: {
            scope,
            stageKey: null,
            imageName: null,
            imageIndex: null,
            totalImages,
            label,
          },
        });
        return controller;
      },
      updateAioExecutionStage: (
        scope,
        stageKey,
        image,
        index,
        totalImages,
        stageProgressLabel,
      ) => {
        const imageOrdinal = Math.max(1, index + 1);
        const unitKey = `${image.id}:${stageKey}`;
        const tracker = get().aioExecutionProgress;
        if (scope === 'auto' && !tracker.completedUnits.has(unitKey)) {
          tracker.completedUnits.add(unitKey);
          const percent = Math.min(
            99,
            (tracker.completedUnits.size / tracker.totalUnits) * 100,
          );
          useUiShellStore.getState().setProgress(percent);
        }

        const suffix =
          totalImages > 1
            ? ` ${imageOrdinal}/${totalImages} · ${image.file.name}`
            : ` · ${image.file.name}`;

        set({
          aioExecutionStatus: {
            scope,
            stageKey,
            imageName: image.file.name,
            imageIndex: imageOrdinal,
            totalImages,
            label: `${stageProgressLabel}${suffix}`,
          },
        });
      },
      stopAioExecution: ({
        stopping,
        abortedByUser,
        restartSucceeded,
        restartFailed,
        totalImages,
        isDesktopRuntime,
      }) => {
        const controller = get().aioAbortController;
        if (!controller || controller.signal.aborted) {
          return;
        }

        const current = get().aioExecutionStatus;
        set({
          aioExecutionStatus: current
            ? {
                ...current,
                label: stopping,
              }
            : {
                scope: 'auto',
                stageKey: null,
                imageName: null,
                imageIndex: null,
                totalImages,
                label: stopping,
              },
        });
        useStatusStore.getState().setTonedStatus(stopping, 'warning');
        controller.abort(new DOMException(abortedByUser, 'AbortError'));

        if (isDesktopRuntime && desktopBridge.desktop?.restartLocalBackend) {
          void desktopBridge.desktop.restartLocalBackend().then((restarted) => {
            useStatusStore.getState().setTonedStatus(
              restarted ? restartSucceeded : restartFailed,
              'warning',
            );
          });
        }
      },
    }),
    { name: 'aio-pipeline-store' },
  ),
);
