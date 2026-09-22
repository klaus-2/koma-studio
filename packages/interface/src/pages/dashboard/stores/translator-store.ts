import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  AioTextRegion,
  TranslatorVisualProcessingMode,
  TranslatorVisualRunMeta,
  TranslatorWorkspaceMode,
} from '../../../types/dashboard.types';

/**
 * Translator tools domain: the free-text/visual workspace mode, the text tab
 * draft/output slots, the per-image visual maps (regions, selection, run
 * metadata, processed bases) and the AI SFX clean model/instructions slots.
 */
interface TranslatorStore {
  /** Translator OCR source language. */
  srcLang: string;
  /** Translator target language. */
  tgtLang: string;
  /** Translator workspace tab (text/visual). */
  translatorWorkspaceMode: TranslatorWorkspaceMode;
  /** Visual translator processing mode (standard/ai_sfx). */
  translatorVisualProcessingMode: TranslatorVisualProcessingMode;
  /** Text tab input. */
  translatorDraftText: string;
  /** 
   * Text tab stage has an uncommitted non-empty draft pending (set on
   * input, cleared on flush). Boolean slice: the tools panel keeps the
   * Translate button enabled while typing without re-rendering per keystroke.
   */
  translatorTextPending: boolean;
  /** Text tab output. */
  translatorTranslatedText: string;
  /** Model label used by the last text run. */
  translatorLastTextModelUsed: string | null;
  /** Text tab dirty flag (imported/edited without translating). */
  translatorTextDirty: boolean;
  /** Text run in progress. */
  translatorTextRunning: boolean;
  /** Visual regions per image. */
  translatorDetectionsByImage: Record<string, AioTextRegion[]>;
  /** Selected region id per image. */
  translatorSelectedRegionByImage: Record<string, string | null>;
  /** Visual run metadata per image. */
  translatorRunMetaByImage: Record<string, TranslatorVisualRunMeta>;
  /** Processed base data URLs per image (ai_sfx cleans). */
  translatorProcessedBaseByImage: Record<string, string>;
  /** Visual run in progress (value never read in the page; reset only). */
  translatorVisualRunning: boolean;
  /** AI SFX clean/classify model selection key. */
  translatorSfxCleanModelKey: string;
  /** Extra instructions for the AI SFX prompts. */
  translatorSfxAdditionalInstructions: string;

  setSrcLang: (value: string) => void;
  setTgtLang: (value: string) => void;
  setTranslatorWorkspaceMode: (value: TranslatorWorkspaceMode) => void;
  setTranslatorVisualProcessingMode: (value: TranslatorVisualProcessingMode) => void;
  setTranslatorDraftText: (value: string) => void;
  setTranslatorTextPending: (value: boolean) => void;
  setTranslatorTranslatedText: (value: string) => void;
  setTranslatorLastTextModelUsed: (value: string | null) => void;
  setTranslatorTextDirty: (value: boolean) => void;
  setTranslatorTextRunning: (value: boolean) => void;
  setTranslatorDetectionsByImage: (
    value:
      | Record<string, AioTextRegion[]>
      | ((prev: Record<string, AioTextRegion[]>) => Record<string, AioTextRegion[]>),
  ) => void;
  setTranslatorSelectedRegionByImage: (
    value:
      | Record<string, string | null>
      | ((prev: Record<string, string | null>) => Record<string, string | null>),
  ) => void;
  setTranslatorRunMetaByImage: (
    value:
      | Record<string, TranslatorVisualRunMeta>
      | ((prev: Record<string, TranslatorVisualRunMeta>) => Record<string, TranslatorVisualRunMeta>),
  ) => void;
  setTranslatorProcessedBaseByImage: (
    value:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  clearTranslatorPerImageMaps: () => void;
  setTranslatorVisualRunning: (value: boolean) => void;
  setTranslatorSfxCleanModelKey: (value: string) => void;
  setTranslatorSfxAdditionalInstructions: (value: string) => void;
}

export const useTranslatorStore = create<TranslatorStore>()(
  devtools(
    (set) => ({
      // Same initial values the page's useState had.
      srcLang: 'ja',
      tgtLang: 'pt-br',
      translatorWorkspaceMode: 'text',
      translatorVisualProcessingMode: 'standard',
      translatorDraftText: '',
      translatorTextPending: false,
      translatorTranslatedText: '',
      translatorLastTextModelUsed: null,
      translatorTextDirty: false,
      translatorTextRunning: false,
      translatorDetectionsByImage: {},
      translatorSelectedRegionByImage: {},
      translatorRunMetaByImage: {},
      translatorProcessedBaseByImage: {},
      translatorVisualRunning: false,
      translatorSfxCleanModelKey: 'gemini_2_0_flash_ocr',
      translatorSfxAdditionalInstructions: '',

      setSrcLang: (srcLang) => set({ srcLang }),
      setTgtLang: (tgtLang) => set({ tgtLang }),
      setTranslatorWorkspaceMode: (translatorWorkspaceMode) =>
        set({ translatorWorkspaceMode }),
      setTranslatorVisualProcessingMode: (translatorVisualProcessingMode) =>
        set({ translatorVisualProcessingMode }),
      setTranslatorDraftText: (translatorDraftText) =>
        set({ translatorDraftText }),
      setTranslatorTextPending: (translatorTextPending) =>
        set({ translatorTextPending }),
      setTranslatorTranslatedText: (translatorTranslatedText) =>
        set({ translatorTranslatedText }),
      setTranslatorLastTextModelUsed: (translatorLastTextModelUsed) =>
        set({ translatorLastTextModelUsed }),
      setTranslatorTextDirty: (translatorTextDirty) =>
        set({ translatorTextDirty }),
      setTranslatorTextRunning: (translatorTextRunning) =>
        set({ translatorTextRunning }),
      // Value-or-updater: the region callbacks and the image collection
      // prune (removeImage) update this map through functional updaters.
      setTranslatorDetectionsByImage: (value) =>
        set((state) => ({
          translatorDetectionsByImage:
            typeof value === 'function'
              ? value(state.translatorDetectionsByImage)
              : value,
        })),
      // Value-or-updater: the region callbacks and the image collection
      // prune update this map through functional updaters.
      setTranslatorSelectedRegionByImage: (value) =>
        set((state) => ({
          translatorSelectedRegionByImage:
            typeof value === 'function'
              ? value(state.translatorSelectedRegionByImage)
              : value,
        })),
      // Value-or-updater: the retranslate callback and the image collection
      // prune update this map through functional updaters.
      setTranslatorRunMetaByImage: (value) =>
        set((state) => ({
          translatorRunMetaByImage:
            typeof value === 'function'
              ? value(state.translatorRunMetaByImage)
              : value,
        })),
      // Value-or-updater: the image collection prune updates this map
      // through a functional updater.
      setTranslatorProcessedBaseByImage: (value) =>
        set((state) => ({
          translatorProcessedBaseByImage:
            typeof value === 'function'
              ? value(state.translatorProcessedBaseByImage)
              : value,
        })),
      clearTranslatorPerImageMaps: () =>
        set({
          translatorDetectionsByImage: {},
          translatorSelectedRegionByImage: {},
          translatorRunMetaByImage: {},
          translatorProcessedBaseByImage: {},
        }),
      setTranslatorVisualRunning: (translatorVisualRunning) =>
        set({ translatorVisualRunning }),
      setTranslatorSfxCleanModelKey: (translatorSfxCleanModelKey) =>
        set({ translatorSfxCleanModelKey }),
      setTranslatorSfxAdditionalInstructions: (translatorSfxAdditionalInstructions) =>
        set({ translatorSfxAdditionalInstructions }),
    }),
    { name: 'translator-store' },
  ),
);
