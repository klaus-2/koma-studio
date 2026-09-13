import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  createDefaultWatermarkDraft,
  deserializeWatermarkPresets,
} from '../../../components/dashboard/watermark/watermark-core.js';
import type {
  WatermarkDraft,
  WatermarkPresetV1,
  WatermarkResultEntry,
  WatermarkTextAvoidanceZone,
} from '../../../components/dashboard/watermark/watermarkTypes';

/** localStorage key for the user-defined presets (shared with the workspace's
    persist effect; also consumed by the lazy initializer below). */
export const USER_PRESETS_STORAGE_KEY = 'koma-studio.watermark.user-presets.v1';

/**
 * Watermark domain: the edited draft, preset bookkeeping, the watermark logo
 * file, the batch results and the per-image text-avoidance zone cache. The
 * workspace component reads these with granular selectors and its callbacks
 * read the latest values via `getState()`, which replaced the render-time ref
 * mirroring (React Doctor `no-ref-current-in-render`).
 */
interface WatermarkStore {
  /** Watermark settings being edited (toolbox target, render input). */
  draft: WatermarkDraft;
  /** Image the preview/results panels focus. */
  activeImageId: string | null;
  compareMode: 'split' | 'preview';
  compareValue: number;
  selectedPresetId: string;
  autoSuggestion: string;
  /** User-saved presets (persisted to localStorage on change). */
  userPresets: WatermarkPresetV1[];
  /** Logo image applied by the image layer. */
  watermarkImageFile: File | null;
  /** Latest batch results (preview URLs are revoked when replaced). */
  results: WatermarkResultEntry[];
  /** Detected text-avoidance zones per image id. */
  textZoneCache: Record<string, WatermarkTextAvoidanceZone[]>;

  /** Value-or-updater: the toolbox panels patch the draft functionally. */
  setDraft: (
    value: WatermarkDraft | ((prev: WatermarkDraft) => WatermarkDraft),
  ) => void;
  /** Value-or-updater: keeps the panels' Dispatch<SetStateAction<…>> types. */
  setActiveImageId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void;
  setCompareMode: (
    value:
      | 'split'
      | 'preview'
      | ((prev: 'split' | 'preview') => 'split' | 'preview'),
  ) => void;
  setCompareValue: (
    value: number | ((prev: number) => number),
  ) => void;
  setSelectedPresetId: (value: string) => void;
  setAutoSuggestion: (value: string) => void;
  /** Value-or-updater: preset save/duplicate/rename/delete use updaters. */
  setUserPresets: (
    value:
      | WatermarkPresetV1[]
      | ((prev: WatermarkPresetV1[]) => WatermarkPresetV1[]),
  ) => void;
  /** Value-or-updater: keeps the toolbox's Dispatch<SetStateAction<…>> type. */
  setWatermarkImageFile: (
    value: File | null | ((prev: File | null) => File | null),
  ) => void;
  /** Value-or-updater: the batch clears results with a revoking updater. */
  setResults: (
    value:
      | WatermarkResultEntry[]
      | ((prev: WatermarkResultEntry[]) => WatermarkResultEntry[]),
  ) => void;
  /** Value-or-updater: detection merges zones per image functionally. */
  setTextZoneCache: (
    value:
      | Record<string, WatermarkTextAvoidanceZone[]>
      | ((
          prev: Record<string, WatermarkTextAvoidanceZone[]>,
        ) => Record<string, WatermarkTextAvoidanceZone[]>),
  ) => void;
}

export const useWatermarkStore = create<WatermarkStore>()(
  devtools(
    (set) => ({
      // Same initial values the workspace's useState initializers used without
      // a persisted workspace state; the persisted snapshot reaches the store
      // only through the mount seed / restoreToken effect in the component
      // (the persistence restore always runs after mount, exactly like
      // before).
      draft: createDefaultWatermarkDraft(),
      activeImageId: null,
      compareMode: 'split',
      compareValue: 58,
      selectedPresetId: '',
      autoSuggestion: '',
      userPresets:
        typeof window === 'undefined'
          ? []
          : deserializeWatermarkPresets(
              window.localStorage.getItem(USER_PRESETS_STORAGE_KEY),
            ),
      watermarkImageFile: null,
      results: [],
      textZoneCache: {},

      // Value-or-updater everywhere the callers pass functional updaters or
      // Dispatch<SetStateAction<…>> props; plain setters where they don't.
      setDraft: (value) =>
        set((state) => ({
          draft: typeof value === 'function' ? value(state.draft) : value,
        })),
      setActiveImageId: (value) =>
        set((state) => ({
          activeImageId:
            typeof value === 'function' ? value(state.activeImageId) : value,
        })),
      setCompareMode: (value) =>
        set((state) => ({
          compareMode:
            typeof value === 'function' ? value(state.compareMode) : value,
        })),
      setCompareValue: (value) =>
        set((state) => ({
          compareValue:
            typeof value === 'function' ? value(state.compareValue) : value,
        })),
      setSelectedPresetId: (selectedPresetId) => set({ selectedPresetId }),
      setAutoSuggestion: (autoSuggestion) => set({ autoSuggestion }),
      setUserPresets: (value) =>
        set((state) => ({
          userPresets:
            typeof value === 'function' ? value(state.userPresets) : value,
        })),
      setWatermarkImageFile: (value) =>
        set((state) => ({
          watermarkImageFile:
            typeof value === 'function'
              ? value(state.watermarkImageFile)
              : value,
        })),
      setResults: (value) =>
        set((state) => ({
          results: typeof value === 'function' ? value(state.results) : value,
        })),
      setTextZoneCache: (value) =>
        set((state) => ({
          textZoneCache:
            typeof value === 'function' ? value(state.textZoneCache) : value,
        })),
    }),
    { name: 'watermark-store' },
  ),
);
