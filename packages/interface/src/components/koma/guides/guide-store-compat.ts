'use client';

import { useInfoNavStore } from '@/stores/info-nav-store';
import type { GuideCategoryId } from '@/data/guides-types';

export type StoredGuideProgress =
  | number
  | {
    sectionIdx?: number;
    stepIdx?: number;
    section?: number;
    step?: number;
  };

interface GuideStoreCompat {
  navigateGuidesHome: () => void;
  navigateToGuideCategory: (
    category: GuideCategoryId,
  ) => void;
  navigateToGuideEntry: (
    category: GuideCategoryId,
    entryId: string,
  ) => void;

  activeSectionIdx?: number;
  activeStepIdx?: number;
  setActiveSection?: (index: number) => void;
  setActiveStep?: (index: number) => void;

  guidesActiveStep?: number;
  setGuidesActiveStep?: (index: number) => void;

  saveStepProgress?: (
    ...args:
      | [
        guideId: string,
        flatStep: number,
      ]
      | [
        guideId: string,
        sectionIdx: number,
        stepIdx: number,
      ]
  ) => void;

  markGuideRead: (guideId: string) => void;

  readGuides?: Record<string, boolean>;
  stepProgress?: Record<
    string,
    StoredGuideProgress
  >;

  bookmarkedGuides?: string[];
  bookmarks?: string[];
  toggleBookmark: (guideId: string) => void;

  recentlyViewed?: string[];
  recentGuides?: string[];

  checklistState?: Record<string, boolean>;
  toggleChecklistItem?: (
    itemId: string,
  ) => void;
}

const EMPTY_IDS: string[] = [];
const EMPTY_READ: Record<string, boolean> = {};
const EMPTY_PROGRESS: Record<
  string,
  StoredGuideProgress
> = {};
const EMPTY_CHECKLIST: Record<
  string,
  boolean
> = {};

function useCompatValue<Value>(
  selector: (
    state: GuideStoreCompat,
  ) => Value,
): Value {
  return useInfoNavStore((state) =>
    selector(
      state as unknown as GuideStoreCompat,
    ),
  );
}

export function useGuideStoreCompat() {
  const navigateGuidesHome =
    useCompatValue(
      (state) =>
        state.navigateGuidesHome,
    );

  const navigateToGuideCategory =
    useCompatValue(
      (state) =>
        state.navigateToGuideCategory,
    );

  const navigateToGuideEntry =
    useCompatValue(
      (state) =>
        state.navigateToGuideEntry,
    );

  const activeSectionIdx =
    useCompatValue(
      (state) =>
        state.activeSectionIdx ?? 0,
    );

  const activeStepIdx = useCompatValue(
    (state) =>
      state.activeStepIdx ?? 0,
  );

  const legacyActiveStep =
    useCompatValue(
      (state) =>
        state.guidesActiveStep ?? 0,
    );

  const setActiveSection =
    useCompatValue(
      (state) =>
        state.setActiveSection,
    );

  const setActiveStep = useCompatValue(
    (state) => state.setActiveStep,
  );

  const setLegacyActiveStep =
    useCompatValue(
      (state) =>
        state.setGuidesActiveStep,
    );

  const saveStepProgress =
    useCompatValue(
      (state) =>
        state.saveStepProgress,
    );

  const markGuideRead =
    useCompatValue(
      (state) =>
        state.markGuideRead,
    );

  const readGuides = useCompatValue(
    (state) =>
      state.readGuides ?? EMPTY_READ,
  );

  const stepProgress =
    useCompatValue(
      (state) =>
        state.stepProgress ??
        EMPTY_PROGRESS,
    );

  const bookmarks = useCompatValue(
    (state) =>
      state.bookmarkedGuides ??
      state.bookmarks ??
      EMPTY_IDS,
  );

  const toggleBookmark =
    useCompatValue(
      (state) =>
        state.toggleBookmark,
    );

  const recentlyViewed =
    useCompatValue(
      (state) =>
        state.recentlyViewed ??
        state.recentGuides ??
        EMPTY_IDS,
    );

  const checklistState =
    useCompatValue(
      (state) =>
        state.checklistState ??
        EMPTY_CHECKLIST,
    );

  const toggleChecklistItem =
    useCompatValue(
      (state) =>
        state.toggleChecklistItem,
    );

  const usesSectionPosition =
    typeof setActiveSection ===
    'function' &&
    typeof setActiveStep === 'function';

  return {
    navigateGuidesHome,
    navigateToGuideCategory,
    navigateToGuideEntry,

    activeSectionIdx,
    activeStepIdx,
    legacyActiveStep,

    setActiveSection,
    setActiveStep,
    setLegacyActiveStep,
    usesSectionPosition,

    saveStepProgress,
    markGuideRead,
    readGuides,
    stepProgress,

    bookmarks,
    toggleBookmark,
    recentlyViewed,

    checklistState,
    toggleChecklistItem,
  };
}
