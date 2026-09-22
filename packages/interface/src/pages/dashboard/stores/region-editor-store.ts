import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import { cloneRenderStyle } from '../../../utils/dashboard.utils';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  loadRenderModePresetState,
  type RenderModePresetStateV1,
} from '../../../utils/renderModePresets';
import { loadTextFillSwatchState } from '../../../utils/textFillPicker';
import { loadTypographyPresetState } from '../../../typography/presets';
import type { TypographyPresetStateV1 } from '../../../typography/types';
import type { AioTextRegion } from '../../../types/dashboard.types';

/**
 * Region editor domain: the AIO region maps, the immutable render defaults
 * and the preset catalogs (render-mode presets, text-fill swatches and the
 * typography presets — the latter is shared with the typographer domain,
 * which reads it from this store).
 */
interface RegionEditorStore {
  /** AIO text regions per image. */
  aioDetectionsByImage: Record<string, AioTextRegion[]>;
  /** Selected region id per image. */
  aioSelectedRegionByImage: Record<string, string | null>;
  /** Immutable default render style (never reassigned, always cloned). */
  renderDefaultStyle: RenderTextStyle;
  /** Render-mode presets (read-only catalog). */
  renderModePresetState: RenderModePresetStateV1;
  /** Text-fill swatch catalog (read-only). */
  textFillSwatchState: ReturnType<typeof loadTextFillSwatchState>;
  /** Typography presets/folders (shared with the typographer domain). */
  typographyPresetState: TypographyPresetStateV1;

  setAioDetectionsByImage: (
    value:
      | Record<string, AioTextRegion[]>
      | ((prev: Record<string, AioTextRegion[]>) => Record<string, AioTextRegion[]>),
  ) => void;
  setAioSelectedRegionByImage: (
    value:
      | Record<string, string | null>
      | ((prev: Record<string, string | null>) => Record<string, string | null>),
  ) => void;
  clearAioRegionMaps: () => void;
  setTypographyPresetState: (state: TypographyPresetStateV1) => void;
}

export const useRegionEditorStore = create<RegionEditorStore>()(
  devtools(
    (set) => ({
      // Same lazy initializations the page's useState had.
      aioDetectionsByImage: {},
      aioSelectedRegionByImage: {},
      renderDefaultStyle: cloneRenderStyle(DEFAULT_RENDER_STYLE),
      renderModePresetState: loadRenderModePresetState(),
      textFillSwatchState: loadTextFillSwatchState(),
      typographyPresetState: loadTypographyPresetState(),

      // Value-or-updater: the page, the executor hooks and the rewind/forward
      // family all use functional updaters on both region maps.
      setAioDetectionsByImage: (value) =>
        set((state) => ({
          aioDetectionsByImage:
            typeof value === 'function' ? value(state.aioDetectionsByImage) : value,
        })),
      setAioSelectedRegionByImage: (value) =>
        set((state) => ({
          aioSelectedRegionByImage:
            typeof value === 'function'
              ? value(state.aioSelectedRegionByImage)
              : value,
        })),
      clearAioRegionMaps: () =>
        set({ aioDetectionsByImage: {}, aioSelectedRegionByImage: {} }),
      setTypographyPresetState: (typographyPresetState) =>
        set({ typographyPresetState }),
    }),
    { name: 'region-editor-store' },
  ),
);
