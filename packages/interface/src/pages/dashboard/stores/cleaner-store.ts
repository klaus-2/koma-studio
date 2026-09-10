import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerMode,
  CleanerRunMeta,
} from '../../../types/dashboard.types';

/**
 * Cleaner tools domain: the cleaner mode, per-image cleaner maps (regions,
 * selection, processed bases, run metadata, manual edit layers, healing
 * busy flags) and the Automatic AI Clean model/instructions slots.
 */
interface CleanerStore {
  /** Cleaner mode: assisted, automatic AI or AI SFX. */
  cleanerMode: CleanerMode;
  /** Cleaner text regions per image. */
  cleanerDetectionsByImage: Record<string, AioTextRegion[]>;
  /** Selected region id per image. */
  cleanerSelectedRegionByImage: Record<string, string | null>;
  /** Inpainted base data URLs per image. */
  cleanerProcessedBaseByImage: Record<string, string>;
  /** Cleaner run metadata per image. */
  cleanerRunMetaByImage: Record<string, CleanerRunMeta>;
  /** Cleaner manual edit layers (paint/base/wand) per image. */
  cleanerManualImageEditsByImage: Record<string, AioManualImageEditState>;
  /** Healing busy flags per image (stage item spinners). */
  cleanerHealingBusyByImage: Record<string, boolean>;
  /** Overlay visibility toggle (stage item). */
  cleanerShowOverlays: boolean;
  /** Automatic AI Clean model selection key. */
  cleanerAiModelKey: string;
  /** Automatic AI Clean model manager modal flag. */
  cleanerAiModelManagerOpen: boolean;
  /** Extra instructions for the Automatic AI Clean prompt. */
  cleanerAiAdditionalInstructions: string;
  /** Cleaner OCR source language. */
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
  setCleanerShowOverlays: (value: boolean) => void;
  setCleanerAiModelKey: (value: string) => void;
  setCleanerAiModelManagerOpen: (value: boolean) => void;
  setCleanerAiAdditionalInstructions: (value: string) => void;
  setCleanerSrcLang: (value: string) => void;
}

export const useCleanerStore = create<CleanerStore>()(
  devtools(
    (set) => ({
      // Same initial values the page's useState had.
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
      cleanerAiAdditionalInstructions: '',
      cleanerSrcLang: 'ja',

      setCleanerMode: (cleanerMode) => set({ cleanerMode }),
      // Value-or-updater: the page, the cleaner hooks and the image
      // collection (removeImage) all update these maps through functional
      // updaters.
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
      setCleanerShowOverlays: (cleanerShowOverlays) =>
        set({ cleanerShowOverlays }),
      setCleanerAiModelKey: (cleanerAiModelKey) => set({ cleanerAiModelKey }),
      setCleanerAiModelManagerOpen: (cleanerAiModelManagerOpen) =>
        set({ cleanerAiModelManagerOpen }),
      setCleanerAiAdditionalInstructions: (cleanerAiAdditionalInstructions) =>
        set({ cleanerAiAdditionalInstructions }),
      setCleanerSrcLang: (cleanerSrcLang) => set({ cleanerSrcLang }),
    }),
    { name: 'cleaner-store' },
  ),
);
