import { NATIVE_TEXT_EFFECT_PRESETS } from "./textEffectPresetData";
import type { RenderTextStyle } from "./renderStyle";

export type NativeTextEffectPresetId =
  | "none"
  | "balloon_smear"
  | "smiles_outline"
  | "ahnnn_peach"
  | "silence_ink"
  | "hwa_pastel"
  | "hah_pop"
  | "smooch_jelly"
  | "tremble_brush"
  | "eheheh_whisper"
  | "hoho_ink"
  | "blam_impact"
  | "badump_soft"
  | "thump_heavy"
  | "neon_woah"
  | "slash_speed"
  | "ah_teal"
  | "drip_blue"
  | "question_pop"
  | "laugh_curve"
  | "shake_blur"
  | "beep_outline"
  | "boom_comic"
  | "bang_chunk"
  | "break_glitch"
  | "flinch_outline"
  | "growl_moss"
  | "yawn_soft"
  | "scratch_noise"
  | "crack_ink"
  | "slap_scratch"
  | "dash_edge"
  | "scream_scratch";

export interface NativeTextEffectPreset {
  id: NativeTextEffectPresetId;
  label: string;
  description: string;
  supportsIntensity?: boolean;
  ghostLayers: number;
  offsetYStep: number;
  offsetXAmplitude: number;
  blurStart: number;
  blurStep: number;
  opacityStart: number;
  opacityFalloff: number;
  fill: string;
  shadowLayers?: Array<{
    fillCssValue: string;
    opacity: number;
    blur: number;
    offsetX: number;
    offsetY: number;
  }>;
  recommendedPatch?: Partial<RenderTextStyle>;
}

export { NATIVE_TEXT_EFFECT_PRESETS } from "./textEffectPresetData";

export const DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID: NativeTextEffectPresetId = "none";

export const isNativeTextEffectPresetId = (value: unknown): value is NativeTextEffectPresetId =>
  typeof value === "string" && NATIVE_TEXT_EFFECT_PRESETS.some((preset) => preset.id === value);

export const getNativeTextEffectPreset = (presetId: string | undefined | null): NativeTextEffectPreset =>
  NATIVE_TEXT_EFFECT_PRESETS.find((preset) => preset.id === presetId) ?? NATIVE_TEXT_EFFECT_PRESETS[0]!;

export const applyNativeTextEffectPreset = (
  style: RenderTextStyle,
  presetId: NativeTextEffectPresetId,
): RenderTextStyle => {
  const preset = getNativeTextEffectPreset(presetId);
  return {
    ...style,
    ...preset.recommendedPatch,
    shadowLayers: preset.shadowLayers?.map((layer) => ({ ...layer })),
    textEffectPreset: preset.id,
    textEffectIntensity: preset.id === "none" ? style.textEffectIntensity ?? 1 : 1,
  };
};
