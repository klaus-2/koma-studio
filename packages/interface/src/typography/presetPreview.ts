import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from "../utils/dashboard.utils";
import {
  buildShapeFromPreset,
  createTypographyStyleFromPreset,
} from "./presets";
import type { TypographyStylePreset } from "./types";
import type { RenderTextStyle } from "./renderStyle";
import type { AioTextRegion } from "../types/dashboard.types";
import { usePresetPreviewSignal } from "./presetPreviewSignal";

export const applyTypographyPresetToRegionBody = (
  region: AioTextRegion,
  preset: TypographyStylePreset,
  renderDefaultStyle: RenderTextStyle,
): AioTextRegion => {
  const [x1, y1, x2, y2] = region.bbox;
  return {
    ...region,
    stylePresetId: preset.id,
    renderStyle: applyDetectedGradientToStyle(region, createTypographyStyleFromPreset(preset, cloneRenderStyle(region.renderStyle ?? renderDefaultStyle))),
    shape: buildShapeFromPreset(preset, Math.max(1, x2 - x1), Math.max(1, y2 - y1)),
  };
};

export interface PresetPreviewOverride {
  readonly regionId: string;
  readonly region: AioTextRegion;
}

export const usePresetPreviewOverride = (
  targetRegionId: string | null | undefined,
  regions: readonly AioTextRegion[],
  fallbackStyle: RenderTextStyle,
  presets: readonly TypographyStylePreset[] | undefined,
): PresetPreviewOverride | null => {
  const previewPresetId = usePresetPreviewSignal();
  const preset = previewPresetId && presets
    ? presets.find((entry) => entry.id === previewPresetId) ?? null
    : null;
  if (!preset) return null;
  const region = regions.find((entry) => entry.id === targetRegionId) ?? null;
  if (!region) return null;
  return {
    regionId: region.id,
    region: applyTypographyPresetToRegionBody(region, preset, fallbackStyle),
  };
};
