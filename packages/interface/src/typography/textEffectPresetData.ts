import { TEXT_EFFECT_PRESETS_BASE_AND_SHEET1 } from "./textEffectPresetData.sheet1";
import { TEXT_EFFECT_PRESETS_SHEET3 } from "./textEffectPresetData.sheet3";
import type { NativeTextEffectPreset } from "./textEffects.types";

export const NATIVE_TEXT_EFFECT_PRESETS: NativeTextEffectPreset[] = [
  ...TEXT_EFFECT_PRESETS_BASE_AND_SHEET1,
  ...TEXT_EFFECT_PRESETS_SHEET3,
];
