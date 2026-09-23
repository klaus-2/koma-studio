import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { StageTabKey } from '../../AioStageTabBar';
import type { DashboardTourForcedDropdown } from '../../../hooks/useDashboardTour';
import {
  loadKeyboardShortcutConfig,
  type KeyboardShortcutConfigV2,
} from '../../../shortcuts/keyboardShortcuts';
import type {
  SubMode,
  ToolMode,
  ViewMode,
} from '../../../types/dashboard.types';

interface ModeTabsScrollState {
  left: boolean;
  right: boolean;
  hasOverflow: boolean;
}

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
  modeTabsScroll: ModeTabsScrollState;

  /* ── Keyboard shortcuts ── */
  keyboardShortcutConfig: KeyboardShortcutConfigV2;

  /* ── Misc shell state ── */
  emptyPreviewTipIndex: number;
  inlineEditorShortcutRequestKey: string | null;

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
  setModeTabsScroll: (modeTabsScroll: ModeTabsScrollState) => void;
  setKeyboardShortcutConfig: (config: KeyboardShortcutConfigV2) => void;
  setEmptyPreviewTipIndex: (
    index: number | ((prev: number) => number),
  ) => void;
  setInlineEditorShortcutRequestKey: (key: string | null) => void;
}

export const useUiShellStore = create<UiShellStore>()(
  devtools(
    (set) => ({
      mode: 'organize',
      subMode: 'auto',
      processing: false,
      progress: 0,
      zoom: 1,
      viewMode: 'long_strip',
      activeStageTab: 'detectText',
      forcedTourDropdown: null,
      modeTabsScroll: { left: false, right: false, hasOverflow: false },
      keyboardShortcutConfig: loadKeyboardShortcutConfig(),
      emptyPreviewTipIndex: 0,
      inlineEditorShortcutRequestKey: null,

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
      setModeTabsScroll: (modeTabsScroll) => set({ modeTabsScroll }),
      setKeyboardShortcutConfig: (keyboardShortcutConfig) =>
        set({ keyboardShortcutConfig }),
      setEmptyPreviewTipIndex: (emptyPreviewTipIndex) =>
        set((state) => ({
          emptyPreviewTipIndex:
            typeof emptyPreviewTipIndex === 'function'
              ? emptyPreviewTipIndex(state.emptyPreviewTipIndex)
              : emptyPreviewTipIndex,
        })),
      setInlineEditorShortcutRequestKey: (inlineEditorShortcutRequestKey) =>
        set({ inlineEditorShortcutRequestKey }),
    }),
    { name: 'ui-shell-store' },
  ),
);
