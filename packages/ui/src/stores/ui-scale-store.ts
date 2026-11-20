/* ============================================================
   KŌMA STUDIO — UI Scale Store
   Interface scale (0.9 | 1 | 1.25 | 1.5) × compact density,
   localStorage persistence
   ============================================================ */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const UI_SCALE_OPTIONS = [0.9, 1, 1.25, 1.5] as const;

export type UiScale = (typeof UI_SCALE_OPTIONS)[number];

const UI_SCALE_STORAGE_KEY = 'koma_ui_scale.v1';
const UI_SCALE_STORAGE_VERSION = 1;

const DEFAULT_UI_SCALE: UiScale = 1;
const DEFAULT_COMPACT_DENSITY = false;

const isUiScale = (value: unknown): value is UiScale =>
  UI_SCALE_OPTIONS.some((option) => option === value);

interface UiScaleStore {
  uiScale: UiScale;
  compactDensity: boolean;
  setUiScale: (uiScale: UiScale) => void;
  setCompactDensity: (compactDensity: boolean) => void;
}

interface UiScalePersisted {
  uiScale: UiScale;
  compactDensity: boolean;
}

// Values read from storage are unvalidated external input: anything outside
// the closed union (or a non-boolean density) normalizes back to the defaults,
// both on version migration and on every rehydration.
const sanitizeUiScaleState = (value: unknown): UiScalePersisted => {
  if (typeof value !== 'object' || value === null) {
    return { uiScale: DEFAULT_UI_SCALE, compactDensity: DEFAULT_COMPACT_DENSITY };
  }
  const record = value as Record<string, unknown>;
  return {
    uiScale: isUiScale(record.uiScale) ? record.uiScale : DEFAULT_UI_SCALE,
    compactDensity:
      typeof record.compactDensity === 'boolean'
        ? record.compactDensity
        : DEFAULT_COMPACT_DENSITY,
  };
};

export const useUiScaleStore = create<UiScaleStore>()(
  devtools(
    persist(
      (set) => ({
        uiScale: DEFAULT_UI_SCALE,
        compactDensity: DEFAULT_COMPACT_DENSITY,
        setUiScale: (uiScale) => set({ uiScale }),
        setCompactDensity: (compactDensity) => set({ compactDensity }),
      }),
      {
        name: UI_SCALE_STORAGE_KEY,
        version: UI_SCALE_STORAGE_VERSION,
        migrate: (persisted) => sanitizeUiScaleState(persisted),
        merge: (persisted, current) => ({
          ...current,
          ...sanitizeUiScaleState(persisted),
        }),
      },
    ),
    { name: 'ui-scale-store' },
  ),
);
