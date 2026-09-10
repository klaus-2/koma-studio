import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/** Canvas tool of the typesetter stage (same union the page's useState had). */
type TypographerSelectionTool = 'select' | 'draw-square' | 'draw-rounded';

/**
 * Typographer/typesetter domain: the tool, queue and snapshot selection slots.
 * The typography preset catalog is NOT here — it lives in the region editor
 * store (`typographyPresetState`, shared slot) and the per-image sessions live
 * in `useTypographerWorkspace` (hooks/typographer.ts).
 */
interface TypographerStore {
  /** Active canvas tool of the typesetter stage. */
  typographerSelectionTool: TypographerSelectionTool;
  /** Selected queue item id (panel list). */
  typographerQueueSelectedId: string | null;
  /** Multi-bubble selected region ids per image. */
  typographerMultiSelectedByImage: Record<string, string[]>;
  /** Snapshot name input value (panel). */
  typographerSnapshotName: string;
  /** Selected snapshot id (panel). */
  typographerSelectedSnapshotId: string | null;

  setTypographerSelectionTool: (value: TypographerSelectionTool) => void;
  setTypographerQueueSelectedId: (value: string | null) => void;
  setTypographerMultiSelectedByImage: (
    value:
      | Record<string, string[]>
      | ((prev: Record<string, string[]>) => Record<string, string[]>),
  ) => void;
  setTypographerSnapshotName: (value: string) => void;
  setTypographerSelectedSnapshotId: (value: string | null) => void;
}

export const useTypographerStore = create<TypographerStore>()(
  devtools(
    (set) => ({
      // Same initial values the page's useState had.
      typographerSelectionTool: 'select',
      typographerQueueSelectedId: null,
      typographerMultiSelectedByImage: {},
      typographerSnapshotName: '',
      typographerSelectedSnapshotId: null,

      setTypographerSelectionTool: (typographerSelectionTool) =>
        set({ typographerSelectionTool }),
      setTypographerQueueSelectedId: (typographerQueueSelectedId) =>
        set({ typographerQueueSelectedId }),
      // Value-or-updater: the page only ever updates this map through
      // functional updaters (reorder, clear-per-image, toggle).
      setTypographerMultiSelectedByImage: (value) =>
        set((state) => ({
          typographerMultiSelectedByImage:
            typeof value === 'function'
              ? value(state.typographerMultiSelectedByImage)
              : value,
        })),
      setTypographerSnapshotName: (typographerSnapshotName) =>
        set({ typographerSnapshotName }),
      setTypographerSelectedSnapshotId: (typographerSelectedSnapshotId) =>
        set({ typographerSelectedSnapshotId }),
    }),
    { name: 'typographer-store' },
  ),
);
