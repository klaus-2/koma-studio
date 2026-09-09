import type { RenderTextStyle } from "./renderText";
import {
  loadRenderModePresetState,
  type RenderModePresetMode,
  type RenderModeStylePreset,
} from "./renderModePresets";

export type DetectedRenderTextMode = RenderModePresetMode;

export type RenderTextMode = "auto" | DetectedRenderTextMode;

export interface RenderModeRegionLike {
  renderMode?: RenderTextMode;
  detectedRenderMode?: DetectedRenderTextMode;
}

export const RENDER_TEXT_MODE_LABELS: Record<RenderTextMode, string> = {
  auto: "AUTO",
  text_bubble: "Bubble Text",
  text_free: "Free Text",
  text_sfx: "Sound Effect",
  text_narration: "Narration",
  text_inside_black_bubble: "Inside Black Bubble",
};

const applyPatch = (
  baseStyle: RenderTextStyle,
  patch: Partial<RenderTextStyle>,
): RenderTextStyle => ({
  ...baseStyle,
  ...patch,
});

const buildDefaultModePatch = (
  resolvedMode: DetectedRenderTextMode,
  baseStyle: RenderTextStyle,
): Partial<RenderTextStyle> => {
  switch (resolvedMode) {
    case "text_free":
      return {
        color: "#0f172a",
        outlineColor: "#ffffff",
        outlineWidth: 1.5,
        uppercase: false,
      };
    case "text_sfx":
      return {
        fontSize: Math.max(baseStyle.fontSize, 52),
        minFontSize: Math.max(baseStyle.minFontSize, 12),
        bold: true,
        outlineWidth: Math.max(baseStyle.outlineWidth, 3.5),
        uppercase: false,
      };
    case "text_narration":
      return {
        fontFamily: "Times New Roman",
        alignment: "left",
        italic: true,
        outlineWidth: Math.max(1, baseStyle.outlineWidth * 0.75),
        uppercase: false,
      };
    case "text_inside_black_bubble":
      return {
        color: "#ffffff",
        outlineColor: "#111111",
        outlineWidth: Math.max(baseStyle.outlineWidth, 2.5),
        uppercase: false,
      };
    case "text_bubble":
    default:
      return {
        color: "#111111",
        outlineColor: "#ffffff",
        outlineWidth: Math.max(baseStyle.outlineWidth, 2),
        alignment: "center",
        bold: false,
        italic: false,
        uppercase: false,
      };
  }
};

export const normalizeDetectedRenderMode = (
  value: string | null | undefined,
): DetectedRenderTextMode | undefined => {
  if (!value) return undefined;

  switch (value.trim().toLowerCase()) {
    case "text_bubble":
    case "bubble":
      return "text_bubble";
    case "text_free":
    case "free":
      return "text_free";
    case "text_sfx":
    case "sound_effect":
    case "sound-effect":
    case "sfx":
      return "text_sfx";
    case "text_narration":
    case "narration":
      return "text_narration";
    case "text_inside_black_bubble":
    case "inside_black_bubble":
    case "inside-black-bubble":
      return "text_inside_black_bubble";
    default:
      return undefined;
  }
};

export const resolveRenderTextMode = (
  region: RenderModeRegionLike,
): DetectedRenderTextMode => {
  if (region.renderMode && region.renderMode !== "auto") {
    return region.renderMode;
  }
  return region.detectedRenderMode ?? "text_bubble";
};

export const getRenderModePresetStyle = (
  renderMode: RenderTextMode,
  baseStyle: RenderTextStyle,
  detectedRenderMode?: DetectedRenderTextMode,
  modePresetOverrides?: Partial<Record<DetectedRenderTextMode, RenderModeStylePreset>>,
): RenderTextStyle => {
  const resolvedMode =
    renderMode === "auto" ? (detectedRenderMode ?? "text_bubble") : renderMode;
  const styleWithDefaults = applyPatch(baseStyle, buildDefaultModePatch(resolvedMode, baseStyle));

  const overrides = modePresetOverrides ?? loadRenderModePresetState().presets;
  const modeOverride = overrides[resolvedMode];
  if (!modeOverride) {
    return styleWithDefaults;
  }

  const { outlineEnabled, ...styleOverride } = modeOverride;
  const styleWithOverride = applyPatch(styleWithDefaults, styleOverride);
  if (outlineEnabled === false) {
    return {
      ...styleWithOverride,
      outlineWidth: 0,
    };
  }

  return styleWithOverride;
};
