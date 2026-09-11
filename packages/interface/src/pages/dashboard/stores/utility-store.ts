import type { SetStateAction } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  StitchAlignMode,
  StitchBatchStrategy,
  StitchLayoutMode,
} from '../../../components/dashboard/stitch/types';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';

/**
 * Utility workspaces domain: stitcher planning config plus the splitter,
 * watermark and optimizer workspace states (drafts/results) consumed by
 * the special-mode stage and the workflow sidebar panels.
 */
interface UtilityWorkspacesStore {
  /* ── Stitcher config ── */
  stitchLayoutMode: StitchLayoutMode;
  stitchBatchStrategy: StitchBatchStrategy;
  stitchBatchSize: number;
  stitchTargetPrimaryAxis: number;
  stitchGap: number;
  stitchAlignMode: StitchAlignMode;
  stitchBackground: string;
  stitchSingleExportFormat: 'png' | 'jpeg' | 'webp';
  stitchFileBaseName: string;
  stitchSelectedBatchIndex: number;
  stitchBatchIndexes: number[][];

  /* ── Special-mode workspace states ── */
  splitterWorkspaceState: SplitterWorkspaceState | null;
  watermarkWorkspaceState: WatermarkWorkspaceState | null;
  optimizerWorkspaceState: ChapterOptimizerWorkspaceState | null;

  setStitchLayoutMode: (value: StitchLayoutMode) => void;
  setStitchBatchStrategy: (value: StitchBatchStrategy) => void;
  setStitchBatchSize: (value: number) => void;
  setStitchTargetPrimaryAxis: (value: number) => void;
  setStitchGap: (value: number) => void;
  setStitchAlignMode: (value: StitchAlignMode) => void;
  setStitchBackground: (value: string) => void;
  setStitchSingleExportFormat: (value: 'png' | 'jpeg' | 'webp') => void;
  setStitchFileBaseName: (value: string) => void;
  /** Value-or-updater: the sidebar move/pull arrows use functional updaters. */
  setStitchBatchIndexes: (value: SetStateAction<number[][]>) => void;
  /** Value-or-updater: the batch clamp effect uses a functional updater. */
  setStitchSelectedBatchIndex: (value: SetStateAction<number>) => void;
  setSplitterWorkspaceState: (value: SplitterWorkspaceState | null) => void;
  setWatermarkWorkspaceState: (value: WatermarkWorkspaceState | null) => void;
  setOptimizerWorkspaceState: (value: ChapterOptimizerWorkspaceState | null) => void;
}

export const useUtilityStore = create<UtilityWorkspacesStore>()(
  devtools(
    (set) => ({
      // Same initial values the page's useState had.
      stitchLayoutMode: 'webtoon',
      stitchBatchStrategy: 'fixed-count',
      stitchBatchSize: 3,
      stitchTargetPrimaryAxis: 12000,
      stitchGap: 0,
      stitchAlignMode: 'center',
      stitchBackground: '#ffffff',
      stitchSingleExportFormat: 'png',
      stitchFileBaseName: 'koma-stitch',
      stitchSelectedBatchIndex: 0,
      stitchBatchIndexes: [],
      splitterWorkspaceState: null,
      watermarkWorkspaceState: null,
      optimizerWorkspaceState: null,

      setStitchLayoutMode: (stitchLayoutMode) => set({ stitchLayoutMode }),
      setStitchBatchStrategy: (stitchBatchStrategy) =>
        set({ stitchBatchStrategy }),
      setStitchBatchSize: (stitchBatchSize) => set({ stitchBatchSize }),
      setStitchTargetPrimaryAxis: (stitchTargetPrimaryAxis) =>
        set({ stitchTargetPrimaryAxis }),
      setStitchGap: (stitchGap) => set({ stitchGap }),
      setStitchAlignMode: (stitchAlignMode) => set({ stitchAlignMode }),
      setStitchBackground: (stitchBackground) => set({ stitchBackground }),
      setStitchSingleExportFormat: (stitchSingleExportFormat) =>
        set({ stitchSingleExportFormat }),
      setStitchFileBaseName: (stitchFileBaseName) =>
        set({ stitchFileBaseName }),
      // Value-or-updater: keeps the functional updaters of the sidebar
      // move/pull arrows and the batch clamp effect working.
      setStitchBatchIndexes: (value) =>
        set((state) => ({
          stitchBatchIndexes:
            typeof value === 'function' ? value(state.stitchBatchIndexes) : value,
        })),
      setStitchSelectedBatchIndex: (value) =>
        set((state) => ({
          stitchSelectedBatchIndex:
            typeof value === 'function'
              ? value(state.stitchSelectedBatchIndex)
              : value,
        })),
      setSplitterWorkspaceState: (splitterWorkspaceState) =>
        set({ splitterWorkspaceState }),
      setWatermarkWorkspaceState: (watermarkWorkspaceState) =>
        set({ watermarkWorkspaceState }),
      setOptimizerWorkspaceState: (optimizerWorkspaceState) =>
        set({ optimizerWorkspaceState }),
    }),
    { name: 'utility-store' },
  ),
);
