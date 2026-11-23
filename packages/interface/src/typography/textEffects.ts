import { NATIVE_TEXT_EFFECT_PRESETS } from "./textEffectPresetData";
import type { RenderTextStyle } from "./renderStyle";
import type {
  NativeTextEffectPreset,
  NativeTextEffectPresetId,
  RenderTextEffectBaseSnapshot,
  RenderTextShadowLayerSpec,
} from "./textEffects.types";

export type {
  NativeTextEffectPreset,
  NativeTextEffectPresetId,
  RenderTextEffectBaseSnapshot,
  RenderTextShadowLayerSpec,
  TextEffectCategory,
  TextEffectFillMode,
  TextEffectInnerHighlightSpec,
  TextEffectRenderSpec,
  TextEffectShadowLayerSpec,
  TextEffectStrokeLayer,
  TextEffectSurfaceSpec,
} from "./textEffects.types";

export { NATIVE_TEXT_EFFECT_PRESETS } from "./textEffectPresetData";

export const DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID: NativeTextEffectPresetId = "none";

export const LEGACY_TEXT_EFFECT_PRESET_ALIASES: Readonly<
  Record<string, NativeTextEffectPresetId>
> = {
  neon_woah: "aah_blush",
  slash_speed: "dash_edge",
  ah_teal: "yawn_soft",
  drip_blue: "hoho_ink",
  question_pop: "blam_impact",
  laugh_curve: "haha_bounce",
  slap_scratch: "screach_sketch",
};

export const NEUTRAL_NO_EFFECT_RESET_PATCH: RenderTextEffectBaseSnapshot = {
  color: "#111111",
  fillCssValue: "#111111",
  gradientEnabled: false,
  gradientStartColor: "#111111",
  gradientEndColor: "#111111",
  gradientAngle: 90,
  detectGradient: true,
  outlineColor: "#ffffff",
  outlineOpacity: 1,
  outlineWidth: 2,
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowFillCssValue: "#000000",
  shadowGradientEnabled: false,
  shadowGradientStartColor: "#000000",
  shadowGradientEndColor: "#000000",
  shadowGradientAngle: 90,
  shadowOpacity: 1,
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowLayers: undefined,
  bold: false,
  italic: false,
  uppercase: false,
  lineSpacing: 1,
  skewX: 0,
  skewY: 0,
  opacity: 1,
};

export const isNativeTextEffectPresetId = (
  value: unknown,
): value is NativeTextEffectPresetId =>
  typeof value === "string"
  && NATIVE_TEXT_EFFECT_PRESETS.some((preset) => preset.id === value);

export const normalizeNativeTextEffectPresetId = (
  value: unknown,
): NativeTextEffectPresetId => {
  if (typeof value !== "string") return DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID;
  if (isNativeTextEffectPresetId(value)) return value;
  return LEGACY_TEXT_EFFECT_PRESET_ALIASES[value] ?? DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID;
};

export const getNativeTextEffectPreset = (
  presetId: string | undefined | null,
): NativeTextEffectPreset => {
  const normalizedId = normalizeNativeTextEffectPresetId(presetId);
  return (
    NATIVE_TEXT_EFFECT_PRESETS.find((preset) => preset.id === normalizedId)
    ?? NATIVE_TEXT_EFFECT_PRESETS[0]!
  );
};

export const cloneShadowLayersList = (
  layers: readonly RenderTextShadowLayerSpec[] | undefined,
): RenderTextShadowLayerSpec[] | undefined =>
  layers ? layers.map((layer) => ({ ...layer })) : undefined;

export const extractEffectBaseSnapshot = (
  style: RenderTextStyle,
): RenderTextEffectBaseSnapshot => ({
  color: style.color,
  fillCssValue: style.fillCssValue,
  gradientEnabled: Boolean(style.gradientEnabled),
  gradientStartColor: style.gradientStartColor,
  gradientEndColor: style.gradientEndColor,
  gradientAngle: Number.isFinite(style.gradientAngle) ? style.gradientAngle : 90,
  detectGradient: style.detectGradient !== false,
  outlineColor: style.outlineColor,
  outlineOpacity: Number.isFinite(style.outlineOpacity) ? style.outlineOpacity : 1,
  outlineWidth: Number.isFinite(style.outlineWidth) ? style.outlineWidth : 0,
  shadowEnabled: Boolean(style.shadowEnabled),
  shadowColor: style.shadowColor,
  shadowFillCssValue: style.shadowFillCssValue,
  shadowGradientEnabled: Boolean(style.shadowGradientEnabled),
  shadowGradientStartColor: style.shadowGradientStartColor,
  shadowGradientEndColor: style.shadowGradientEndColor,
  shadowGradientAngle: Number.isFinite(style.shadowGradientAngle) ? style.shadowGradientAngle : 90,
  shadowOpacity: Number.isFinite(style.shadowOpacity) ? style.shadowOpacity : 1,
  shadowBlur: Number.isFinite(style.shadowBlur) ? style.shadowBlur : 0,
  shadowOffsetX: Number.isFinite(style.shadowOffsetX) ? style.shadowOffsetX : 0,
  shadowOffsetY: Number.isFinite(style.shadowOffsetY) ? style.shadowOffsetY : 0,
  shadowLayers: cloneShadowLayersList(style.shadowLayers),
  bold: Boolean(style.bold),
  italic: Boolean(style.italic),
  uppercase: Boolean(style.uppercase),
  lineSpacing: Number.isFinite(style.lineSpacing) ? style.lineSpacing : 1,
  skewX: Number.isFinite(style.skewX) ? style.skewX : 0,
  skewY: Number.isFinite(style.skewY) ? style.skewY : 0,
  opacity: Number.isFinite(style.opacity) ? style.opacity : 1,
});

export const cloneEffectBaseSnapshot = (
  snapshot: RenderTextEffectBaseSnapshot,
): RenderTextEffectBaseSnapshot => ({
  ...snapshot,
  shadowLayers: cloneShadowLayersList(snapshot.shadowLayers),
});

export const applyNativeTextEffectPreset = (
  style: RenderTextStyle,
  presetId: NativeTextEffectPresetId | string,
): RenderTextStyle => {
  const preset = getNativeTextEffectPreset(presetId);

  if (preset.id === "none") {
    if (style.textEffectBaseSnapshot) {
      const restored = cloneEffectBaseSnapshot(style.textEffectBaseSnapshot);
      return {
        ...style,
        ...restored,
        textEffectPreset: "none",
        textEffectIntensity: 1,
        textEffectBaseSnapshot: undefined,
      };
    }

    if (normalizeNativeTextEffectPresetId(style.textEffectPreset) !== "none") {
      return {
        ...style,
        ...cloneEffectBaseSnapshot(NEUTRAL_NO_EFFECT_RESET_PATCH),
        textEffectPreset: "none",
        textEffectIntensity: 1,
        textEffectBaseSnapshot: undefined,
      };
    }

    return {
      ...style,
      textEffectPreset: "none",
      textEffectIntensity: 1,
      textEffectBaseSnapshot: undefined,
    };
  }

  const currentId = normalizeNativeTextEffectPresetId(style.textEffectPreset);
  const baseSnapshot =
    currentId === "none"
      ? extractEffectBaseSnapshot(style)
      : style.textEffectBaseSnapshot
        ? cloneEffectBaseSnapshot(style.textEffectBaseSnapshot)
        : extractEffectBaseSnapshot(style);

  return {
    ...style,
    ...cloneEffectBaseSnapshot(baseSnapshot),
    gradientEnabled: false,
    shadowEnabled: false,
    shadowOpacity: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    outlineWidth: 0,
    outlineOpacity: 1,
    skewX: baseSnapshot.skewX,
    skewY: baseSnapshot.skewY,
    ...preset.recommendedPatch,
    shadowLayers: cloneShadowLayersList(preset.shadowLayers),
    textEffectPreset: preset.id,
    textEffectIntensity: 1,
    textEffectBaseSnapshot: baseSnapshot,
  };
};
