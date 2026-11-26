import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerMode,
  CleanerRunMeta,
} from '../../../types/dashboard.types';
import {
  DEFAULT_IMAGE_EDIT_MODEL_CONFIG,
  sanitizeImageEditModelConfig,
  type ImageEditModelConfig,
} from '../../../utils/imageEditModelConfig';

export type ImageEditModelManagerTarget = 'cleaner' | 'aio_clean' | 'aio_ai';

const CLEANER_AI_MODEL_CONFIG_STORAGE_KEY = 'koma-cleaner-ai-model-config';

const loadCleanerAiModelConfig = (): ImageEditModelConfig => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG };
  }
  try {
    const raw = window.localStorage.getItem(CLEANER_AI_MODEL_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG };
    return sanitizeImageEditModelConfig(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG };
  }
};

const saveCleanerAiModelConfig = (config: ImageEditModelConfig): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLEANER_AI_MODEL_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
  }
};

interface CleanerStore {
  cleanerMode: CleanerMode;
  cleanerDetectionsByImage: Record<string, AioTextRegion[]>;
  cleanerSelectedRegionByImage: Record<string, string | null>;
  cleanerProcessedBaseByImage: Record<string, string>;
  cleanerRunMetaByImage: Record<string, CleanerRunMeta>;
  cleanerManualImageEditsByImage: Record<string, AioManualImageEditState>;
  cleanerHealingBusyByImage: Record<string, boolean>;
  cleanerShowOverlays: boolean;
  cleanerAiModelKey: string;
  cleanerAiModelManagerOpen: boolean;
  imageEditModelManagerTarget: ImageEditModelManagerTarget;
  cleanerAiAdditionalInstructions: string;
  cleanerAiModelConfig: ImageEditModelConfig;
  cleanerSrcLang: string;

  setCleanerMode: (value: CleanerMode) => void;
  setCleanerDetectionsByImage: (
    value:
      | Record<string, AioTextRegion[]>
      | ((prev: Record<string, AioTextRegion[]>) => Record<string, AioTextRegion[]>),
  ) => void;
  setCleanerSelectedRegionByImage: (
    value:
      | Record<string, string | null>
      | ((prev: Record<string, string | null>) => Record<string, string | null>),
  ) => void;
  setCleanerProcessedBaseByImage: (
    value:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  setCleanerRunMetaByImage: (
    value:
      | Record<string, CleanerRunMeta>
      | ((prev: Record<string, CleanerRunMeta>) => Record<string, CleanerRunMeta>),
  ) => void;
  setCleanerManualImageEditsByImage: (
    value:
      | Record<string, AioManualImageEditState>
      | ((prev: Record<string, AioManualImageEditState>) => Record<string, AioManualImageEditState>),
  ) => void;
  setCleanerHealingBusyByImage: (
    value:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  clearCleanerPerImageMaps: () => void;
  setCleanerShowOverlays: (value: boolean) => void;
  setCleanerAiModelKey: (value: string) => void;
  setCleanerAiModelManagerOpen: (value: boolean) => void;
  setImageEditModelManagerTarget: (value: ImageEditModelManagerTarget) => void;
  openImageEditModelManager: (target: ImageEditModelManagerTarget) => void;
  setCleanerAiAdditionalInstructions: (value: string) => void;
  setCleanerAiModelConfig: (
    value:
      | ImageEditModelConfig
      | ((prev: ImageEditModelConfig) => ImageEditModelConfig),
  ) => void;
  setCleanerSrcLang: (value: string) => void;
}

export const useCleanerStore = create<CleanerStore>()(
  devtools(
    (set) => ({
      cleanerMode: 'assisted',
      cleanerDetectionsByImage: {},
      cleanerSelectedRegionByImage: {},
      cleanerProcessedBaseByImage: {},
      cleanerRunMetaByImage: {},
      cleanerManualImageEditsByImage: {},
      cleanerHealingBusyByImage: {},
      cleanerShowOverlays: true,
      cleanerAiModelKey: 'gemini_2_0_flash_ocr',
      cleanerAiModelManagerOpen: false,
      imageEditModelManagerTarget: 'cleaner',
      cleanerAiAdditionalInstructions: '',
      cleanerAiModelConfig: loadCleanerAiModelConfig(),
      cleanerSrcLang: 'ja',

      setCleanerMode: (cleanerMode) => set({ cleanerMode }),
      setCleanerDetectionsByImage: (value) =>
        set((state) => ({
          cleanerDetectionsByImage:
            typeof value === 'function'
              ? value(state.cleanerDetectionsByImage)
              : value,
        })),
      setCleanerSelectedRegionByImage: (value) =>
        set((state) => ({
          cleanerSelectedRegionByImage:
            typeof value === 'function'
              ? value(state.cleanerSelectedRegionByImage)
              : value,
        })),
      setCleanerProcessedBaseByImage: (value) =>
        set((state) => ({
          cleanerProcessedBaseByImage:
            typeof value === 'function'
              ? value(state.cleanerProcessedBaseByImage)
              : value,
        })),
      setCleanerRunMetaByImage: (value) =>
        set((state) => ({
          cleanerRunMetaByImage:
            typeof value === 'function'
              ? value(state.cleanerRunMetaByImage)
              : value,
        })),
      setCleanerManualImageEditsByImage: (value) =>
        set((state) => ({
          cleanerManualImageEditsByImage:
            typeof value === 'function'
              ? value(state.cleanerManualImageEditsByImage)
              : value,
        })),
      setCleanerHealingBusyByImage: (value) =>
        set((state) => ({
          cleanerHealingBusyByImage:
            typeof value === 'function'
              ? value(state.cleanerHealingBusyByImage)
              : value,
        })),
      clearCleanerPerImageMaps: () =>
        set({
          cleanerDetectionsByImage: {},
          cleanerSelectedRegionByImage: {},
          cleanerProcessedBaseByImage: {},
          cleanerRunMetaByImage: {},
          cleanerManualImageEditsByImage: {},
          cleanerHealingBusyByImage: {},
        }),
      setCleanerShowOverlays: (cleanerShowOverlays) =>
        set({ cleanerShowOverlays }),
      setCleanerAiModelKey: (cleanerAiModelKey) => set({ cleanerAiModelKey }),
      setCleanerAiModelManagerOpen: (cleanerAiModelManagerOpen) =>
        set({ cleanerAiModelManagerOpen }),
      setImageEditModelManagerTarget: (imageEditModelManagerTarget) =>
        set({ imageEditModelManagerTarget }),
      openImageEditModelManager: (imageEditModelManagerTarget) =>
        set({ imageEditModelManagerTarget, cleanerAiModelManagerOpen: true }),
      setCleanerAiAdditionalInstructions: (cleanerAiAdditionalInstructions) =>
        set({ cleanerAiAdditionalInstructions }),
      setCleanerAiModelConfig: (value) =>
        set((state) => {
          const rawNext =
            typeof value === 'function' ? value(state.cleanerAiModelConfig) : value;
          const next = sanitizeImageEditModelConfig(rawNext);
          saveCleanerAiModelConfig(next);
          return { cleanerAiModelConfig: next };
        }),
      setCleanerSrcLang: (cleanerSrcLang) => set({ cleanerSrcLang }),
    }),
    { name: 'cleaner-store', enabled: import.meta.env.DEV },
  ),
);
