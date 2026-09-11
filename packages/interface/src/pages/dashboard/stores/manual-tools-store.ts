import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  AioManualImageEditState,
  AreaSelectionCreateMode,
  ManualImageEditTool,
  SegmentEditTool,
} from '../../../types/dashboard.types';

/**
 * Manual tools domain: the segment/area/manual-image tool selection, the
 * dock config drawer, the manual brush/wand parameters and the per-image
 * AIO manual edit layers + healing busy flags (+ healing hint counter).
 */
interface ManualToolsStore {
  /** Segment edit tool (select/brush/eraser). */
  segmentEditTool: SegmentEditTool;
  /** Area selection creation mode (auto/square/rounded). */
  areaSelectionCreateMode: AreaSelectionCreateMode;
  /** Segment brush size. */
  segmentBrushSize: number;
  /** Manual image tool (paint/eraser/wand/healing/none). */
  manualImageTool: ManualImageEditTool;
  /** Manual tools dock config drawer visibility. */
  manualToolsConfigOpen: boolean;
  /** Manual image brush size. */
  manualImageBrushSize: number;
  /** Manual image paint color. */
  manualImagePaintColor: string;
  /** Manual image brush opacity. */
  manualImageBrushOpacity: number;
  /** Manual image brush blur. */
  manualImageBrushBlur: number;
  /** Magic wand tolerance. */
  manualImageWandTolerance: number;
  /** AIO manual edit layers (paint/base/wand/segment brush) per image. */
  aioManualImageEditsByImage: Record<string, AioManualImageEditState>;
  /** AIO healing busy flags per image. */
  aioManualHealingBusyByImage: Record<string, boolean>;
  /** Healing tool hint trigger (increment to attempt showing). */
  healingHintTrigger: number;

  setSegmentEditTool: (value: SegmentEditTool) => void;
  setAreaSelectionCreateMode: (value: AreaSelectionCreateMode) => void;
  setSegmentBrushSize: (value: number) => void;
  setManualImageTool: (value: ManualImageEditTool) => void;
  setManualToolsConfigOpen: (
    value:
      | boolean
      | ((prev: boolean) => boolean),
  ) => void;
  setManualImageBrushSize: (value: number) => void;
  setManualImagePaintColor: (value: string) => void;
  setManualImageBrushOpacity: (value: number) => void;
  setManualImageBrushBlur: (value: number) => void;
  setManualImageWandTolerance: (value: number) => void;
  setAioManualImageEditsByImage: (
    value:
      | Record<string, AioManualImageEditState>
      | ((prev: Record<string, AioManualImageEditState>) => Record<string, AioManualImageEditState>),
  ) => void;
  setAioManualHealingBusyByImage: (
    value:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  setHealingHintTrigger: (
    value:
      | number
      | ((prev: number) => number),
  ) => void;
}

export const useManualToolsStore = create<ManualToolsStore>()(
  devtools(
    (set) => ({
      // Same initial values the page's useState had.
      segmentEditTool: 'select',
      areaSelectionCreateMode: 'auto',
      segmentBrushSize: 28,
      manualImageTool: 'none',
      manualToolsConfigOpen: true,
      manualImageBrushSize: 26,
      manualImagePaintColor: '#ffffff',
      manualImageBrushOpacity: 1,
      manualImageBrushBlur: 0,
      manualImageWandTolerance: 34,
      aioManualImageEditsByImage: {},
      aioManualHealingBusyByImage: {},
      healingHintTrigger: 0,

      setSegmentEditTool: (segmentEditTool) => set({ segmentEditTool }),
      setAreaSelectionCreateMode: (areaSelectionCreateMode) =>
        set({ areaSelectionCreateMode }),
      setSegmentBrushSize: (segmentBrushSize) => set({ segmentBrushSize }),
      setManualImageTool: (manualImageTool) => set({ manualImageTool }),
      // Value-or-updater: the config toggle flips the current value.
      setManualToolsConfigOpen: (value) =>
        set((state) => ({
          manualToolsConfigOpen:
            typeof value === 'function' ? value(state.manualToolsConfigOpen) : value,
        })),
      setManualImageBrushSize: (manualImageBrushSize) =>
        set({ manualImageBrushSize }),
      setManualImagePaintColor: (manualImagePaintColor) =>
        set({ manualImagePaintColor }),
      setManualImageBrushOpacity: (manualImageBrushOpacity) =>
        set({ manualImageBrushOpacity }),
      setManualImageBrushBlur: (manualImageBrushBlur) =>
        set({ manualImageBrushBlur }),
      setManualImageWandTolerance: (manualImageWandTolerance) =>
        set({ manualImageWandTolerance }),
      // Value-or-updater: the shared prune effect and the patch helper
      // update this map through functional updaters.
      setAioManualImageEditsByImage: (value) =>
        set((state) => ({
          aioManualImageEditsByImage:
            typeof value === 'function'
              ? value(state.aioManualImageEditsByImage)
              : value,
        })),
      // Value-or-updater: the prune effect and the healing busy
      // set/clear use functional updaters.
      setAioManualHealingBusyByImage: (value) =>
        set((state) => ({
          aioManualHealingBusyByImage:
            typeof value === 'function'
              ? value(state.aioManualHealingBusyByImage)
              : value,
        })),
      // Value-or-updater: the hint trigger increments the current count.
      setHealingHintTrigger: (value) =>
        set((state) => ({
          healingHintTrigger:
            typeof value === 'function' ? value(state.healingHintTrigger) : value,
        })),
    }),
    { name: 'manual-tools-store' },
  ),
);
