import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { createDefaultSplitterRecipe } from '../../../components/dashboard/splitter/splitterUtils';
import type {
  SplitterImageState,
  SplitterRecipe,
} from '../../../components/dashboard/splitter/types';

/**
 * Splitter domain: the global recipe (sidebar editing target) and the
 * per-image analysis states. The controller hook reads these with granular
 * selectors and its callbacks read the latest values via `getState()`, which
 * replaced the render-time ref mirroring (React Doctor `no-ref-current-in-render`).
 */
interface SplitterStore {
  /** Global splitter recipe shared by every image without an override. */
  recipe: SplitterRecipe;
  /** Per-image state: analysis, status, error and recipe override. */
  imageStates: Record<string, SplitterImageState>;

  setRecipe: (
    value: SplitterRecipe | ((prev: SplitterRecipe) => SplitterRecipe),
  ) => void;
  setImageStates: (
    value:
      | Record<string, SplitterImageState>
      | ((
          prev: Record<string, SplitterImageState>,
        ) => Record<string, SplitterImageState>),
  ) => void;
  /** Merge-updater for a single image's state (base state created on demand). */
  updateImageState: (
    imageId: string,
    updater: (current: SplitterImageState) => SplitterImageState,
  ) => void;
}

export const useSplitterStore = create<SplitterStore>()(
  devtools(
    (set) => ({
      // Same lazy initializations the controller's useState had. The persisted
      // workspace state reaches the store only through the restoreToken effect
      // in the controller (the persistence restore always runs after mount,
      // exactly like before).
      recipe: createDefaultSplitterRecipe(),
      imageStates: {},

      // Value-or-updater: the sidebar toolbox and setPreset use functional
      // updaters on the recipe, the restore effect passes plain values.
      setRecipe: (value) =>
        set((state) => ({
          recipe: typeof value === 'function' ? value(state.recipe) : value,
        })),
      setImageStates: (value) =>
        set((state) => ({
          imageStates:
            typeof value === 'function' ? value(state.imageStates) : value,
        })),
      updateImageState: (imageId, updater) =>
        set((state) => {
          const base =
            state.imageStates[imageId] ??
            { imageId, status: 'idle', error: null, analysis: null };
          const next = updater(base);
          if (next === base) return state; // No change
          return { imageStates: { ...state.imageStates, [imageId]: next } };
        }),
    }),
    { name: 'splitter-store' },
  ),
);
