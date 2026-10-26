import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type {
  SubMode,
  ToolMode,
  ViewMode,
} from '../../../types/dashboard.types';

/**
 * Focus Mode (Zen) shell domain.
 *
 * `displayMode` is a layout preference orthogonal to the tool mode and to
 * the theme family: Focus swaps the dashboard layout for a single linear
 * AIO flow (pages → run → fix → export) without touching any pipeline,
 * region or workspace state. It is persisted so a Focus-first user boots
 * straight into Focus; the Studio shell stash and the per-page review
 * checklist live here because they belong to the Focus session, not to
 * the workspace document.
 */

export type KomaDisplayMode = 'studio' | 'focus';

export const isDisplayMode = (value: unknown): value is KomaDisplayMode =>
  value === 'studio' || value === 'focus';

/** Studio shell values captured on Focus entry, restored on exit. */
export interface FocusShellStash {
  mode: ToolMode;
  subMode: SubMode;
  viewMode: ViewMode;
}

interface FocusModeStore {
  /* ── Display mode (persisted) ── */
  displayMode: KomaDisplayMode;

  /* ── Review checklist (persisted; keyed by image id) ── */
  reviewedImageIds: string[];

  /* ── Studio shell stash (session only, never persisted) ── */
  shellStash: FocusShellStash | null;

  setDisplayMode: (displayMode: KomaDisplayMode) => void;
  setShellStash: (stash: FocusShellStash | null) => void;
  /** Marks/unmarks a page as reviewed. Toggle when `reviewed` is omitted. */
  setImageReviewed: (imageId: string, reviewed?: boolean) => void;
  /** Drops review marks for images that no longer exist. */
  pruneReviewedImages: (validImageIds: readonly string[]) => void;
}

const FOCUS_MODE_STORAGE_KEY = 'koma_focus_mode';
const FOCUS_MODE_STORAGE_VERSION = 1;

interface PersistedFocusMode {
  displayMode?: unknown;
  reviewedImageIds?: unknown;
}

/** Validates persisted state so a corrupt/foreign payload can never wedge the shell. */
const normalizePersisted = (
  persisted: PersistedFocusMode,
): Pick<FocusModeStore, 'displayMode' | 'reviewedImageIds'> => ({
  displayMode: isDisplayMode(persisted.displayMode)
    ? persisted.displayMode
    : 'studio',
  reviewedImageIds: Array.isArray(persisted.reviewedImageIds)
    ? [
        ...new Set(
          persisted.reviewedImageIds.filter(
            (value): value is string => typeof value === 'string',
          ),
        ),
      ]
    : [],
});

export const useFocusModeStore = create<FocusModeStore>()(
  devtools(
    persist(
      (set) => ({
        displayMode: 'studio',
        reviewedImageIds: [],
        shellStash: null,

        setDisplayMode: (displayMode) =>
          set((state) =>
            state.displayMode === displayMode ? state : { displayMode },
          ),
        setShellStash: (shellStash) => set({ shellStash }),
        setImageReviewed: (imageId, reviewed) =>
          set((state) => {
            const isReviewed = state.reviewedImageIds.includes(imageId);
            const nextReviewed = reviewed ?? !isReviewed;
            if (nextReviewed === isReviewed) return state;
            return {
              reviewedImageIds: nextReviewed
                ? [...state.reviewedImageIds, imageId]
                : state.reviewedImageIds.filter((id) => id !== imageId),
            };
          }),
        pruneReviewedImages: (validImageIds) =>
          set((state) => {
            if (state.reviewedImageIds.length === 0) return state;
            const valid = new Set(validImageIds);
            const next = state.reviewedImageIds.filter((id) => valid.has(id));
            return next.length === state.reviewedImageIds.length
              ? state
              : { reviewedImageIds: next };
          }),
      }),
      {
        name: FOCUS_MODE_STORAGE_KEY,
        version: FOCUS_MODE_STORAGE_VERSION,
        // The shell stash is a session artefact: after a restart there is
        // no Studio session to restore, so Focus exit falls back to the
        // Studio defaults instead of a stale stash.
        partialize: (state) => ({
          displayMode: state.displayMode,
          reviewedImageIds: state.reviewedImageIds,
        }),
        merge: (persisted, current) => ({
          ...current,
          ...normalizePersisted(persisted as PersistedFocusMode),
        }),
      },
    ),
    { name: 'focus-mode-store' },
  ),
);

/** Non-React read for event-time call sites (keyboard dispatch, guards). */
export const isFocusModeActive = (): boolean =>
  useFocusModeStore.getState().displayMode === 'focus';
