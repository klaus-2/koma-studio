import type { AioTextRegion } from "../types/dashboard.types";
import type { RenderTextStyle } from "./renderStyle";
import type { TypographyPresetStateV1, TypographyStylePreset } from "./types";
import { createTypographyStyleFromPreset, getTypographyPresetById } from "./presets";
import { isRegionFieldLocked } from "../utils/region-lock";
import { resolveRenderTextMode } from "../utils/renderModes";
import { applyRenderDefaultsToRegion } from "../utils/dashboard.region.utils";

export interface ApplyModePresetBindingsInput {
  readonly regions: ReadonlyArray<AioTextRegion>;
  readonly renderDefaultStyle: RenderTextStyle;
  readonly typographyPresetState: TypographyPresetStateV1;
  readonly applyDetectedGradientToStyle: (
    region: AioTextRegion,
    style: RenderTextStyle,
  ) => RenderTextStyle;
  readonly targetLanguage?: string | null;
}

export const hasRegionManualStyleEdits = (region: AioTextRegion): boolean =>
  region.renderStyle !== undefined ||
  region.stylePresetId != null ||
  region.renderTextStyleRanges !== undefined ||
  isRegionFieldLocked(region, "style");

export const resolveBoundTypographyPresetForMode = (
  mode: string,
  state: TypographyPresetStateV1,
): TypographyStylePreset | null => {
  const boundId = state.modeBindings[mode];
  return boundId ? getTypographyPresetById(boundId, state) : null;
};

export const applyModePresetBindingsToRegions = (
  input: ApplyModePresetBindingsInput,
): AioTextRegion[] =>
  input.regions.map((region) => {
    const preset = hasRegionManualStyleEdits(region)
      ? null
      : resolveBoundTypographyPresetForMode(
        resolveRenderTextMode(region),
        input.typographyPresetState,
      );
    const enriched = applyRenderDefaultsToRegion(
      region,
      input.renderDefaultStyle,
      input.applyDetectedGradientToStyle,
      preset,
      input.targetLanguage,
    );
    if (!preset) return enriched;
    const normalizedTargetLanguage = String(input.targetLanguage ?? "")
      .trim()
      .toLowerCase();
    return {
      ...enriched,
      renderStyle: input.applyDetectedGradientToStyle(region, {
        ...createTypographyStyleFromPreset(
          preset,
          enriched.renderStyle ?? input.renderDefaultStyle,
        ),
        hyphenationLanguage: normalizedTargetLanguage || undefined,
      }),
      stylePresetId: preset.id,
    };
  });
