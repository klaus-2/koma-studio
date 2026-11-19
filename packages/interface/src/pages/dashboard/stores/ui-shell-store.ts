import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { StageTabKey } from '../../AioStageTabBar.types';
import type { DashboardTourForcedDropdown } from '../../../hooks/useDashboardTour';
import {
  loadKeyboardShortcutConfig,
  type KeyboardShortcutConfigV2,
} from '../../../shortcuts/keyboardShortcuts';
import type {
  ComparePanOffset,
  CompareReviewView,
  SubMode,
  ToolMode,
  ViewMode,
} from '../../../types/dashboard.types';

interface UiShellStore {
  /* ── Tool mode ── */
  mode: ToolMode;
  subMode: SubMode;

  /* ── Global processing ── */
  processing: boolean;
  progress: number;

  /* ── Stage view ── */
  zoom: number;
  viewMode: ViewMode;
  activeStageTab: StageTabKey;

  /* ── Tour / mobile ── */
  forcedTourDropdown: DashboardTourForcedDropdown;

  /* ── Keyboard shortcuts ── */
  keyboardShortcutConfig: KeyboardShortcutConfigV2;

  /* ── Command palette ── */
  commandPaletteOpen: boolean;

  /* ── Compare review overlay (render stage) ── */
  compareReviewOpen: boolean;
  compareReviewView: CompareReviewView;
  comparePanOffset: ComparePanOffset;

  /* ── Misc shell state ── */
  emptyPreviewTipIndex: number;
  inlineEditorShortcutRequestKey: string | null;

  holdOriginalActive: boolean;

  setMode: (mode: ToolMode) => void;
  setSubMode: (subMode: SubMode) => void;
  setProcessing: (
    processing: boolean | ((prev: boolean) => boolean),
  ) => void;
  setProgress: (progress: number | ((prev: number) => number)) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setActiveStageTab: (activeStageTab: StageTabKey) => void;
  setForcedTourDropdown: (
    forcedTourDropdown: DashboardTourForcedDropdown,
  ) => void;
  setKeyboardShortcutConfig: (config: KeyboardShortcutConfigV2) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setCompareReviewOpen: (open: boolean) => void;
  setCompareReviewView: (view: CompareReviewView) => void;
  setComparePanOffset: (
    pan: ComparePanOffset | ((prev: ComparePanOffset) => ComparePanOffset),
  ) => void;
  setEmptyPreviewTipIndex: (
    index: number | ((prev: number) => number),
  ) => void;
  setInlineEditorShortcutRequestKey: (key: string | null) => void;
  setHoldOriginalActive: (active: boolean) => void;
}

export const useUiShellStore = create<UiShellStore>()(
  devtools(
    (set) => ({
      mode: 'aio',
      subMode: 'auto',
      processing: false,
      progress: 0,
      zoom: 1,
      viewMode: 'long_strip',
      activeStageTab: 'detectText',
      forcedTourDropdown: null,
      keyboardShortcutConfig: loadKeyboardShortcutConfig(),
      commandPaletteOpen: false,
      compareReviewOpen: false,
      compareReviewView: 'original',
      comparePanOffset: { x: 0, y: 0 },
      emptyPreviewTipIndex: 0,
      inlineEditorShortcutRequestKey: null,
      holdOriginalActive: false,

      setMode: (mode) => set({ mode }),
      setSubMode: (subMode) => set({ subMode }),
      setProcessing: (processing) =>
        set((state) => ({
          processing:
            typeof processing === 'function'
              ? processing(state.processing)
              : processing,
        })),
      setProgress: (progress) =>
        set((state) => ({
          progress:
            typeof progress === 'function' ? progress(state.progress) : progress,
        })),
      setZoom: (zoom) =>
        set((state) => ({
          zoom: typeof zoom === 'function' ? zoom(state.zoom) : zoom,
        })),
      setViewMode: (viewMode) => set({ viewMode }),
      setActiveStageTab: (activeStageTab) =>
        set((state) =>
          state.activeStageTab === activeStageTab
            ? state
            : { activeStageTab },
        ),
      setForcedTourDropdown: (forcedTourDropdown) =>
        set({ forcedTourDropdown }),
      setKeyboardShortcutConfig: (keyboardShortcutConfig) =>
        set({ keyboardShortcutConfig }),
      setCommandPaletteOpen: (commandPaletteOpen) =>
        set({ commandPaletteOpen }),
      setCompareReviewOpen: (compareReviewOpen) => set({ compareReviewOpen }),
      setCompareReviewView: (compareReviewView) => set({ compareReviewView }),
      setComparePanOffset: (pan) =>
        set((state) => ({
          comparePanOffset:
            typeof pan === 'function' ? pan(state.comparePanOffset) : pan,
        })),
      setEmptyPreviewTipIndex: (emptyPreviewTipIndex) =>
        set((state) => ({
          emptyPreviewTipIndex:
            typeof emptyPreviewTipIndex === 'function'
              ? emptyPreviewTipIndex(state.emptyPreviewTipIndex)
              : emptyPreviewTipIndex,
        })),
      setInlineEditorShortcutRequestKey: (inlineEditorShortcutRequestKey) =>
        set({ inlineEditorShortcutRequestKey }),
      setHoldOriginalActive: (holdOriginalActive) => set({ holdOriginalActive }),
    }),
    { name: 'ui-shell-store' },
  ),
);
