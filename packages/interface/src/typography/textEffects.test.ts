import { describe, expect, test } from "vitest";

import {
  DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID,
  getNativeTextEffectPreset,
  isNativeTextEffectPresetId,
  NATIVE_TEXT_EFFECT_PRESETS,
} from "./textEffects";

describe("text effects presets", () => {
  test("keeps the native preset catalog available through textEffects", () => {
    expect(NATIVE_TEXT_EFFECT_PRESETS.length).toBeGreaterThan(20);
    expect(NATIVE_TEXT_EFFECT_PRESETS[0]?.id).toBe(DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID);
    expect(isNativeTextEffectPresetId("slash_speed")).toBe(true);
    expect(isNativeTextEffectPresetId("missing-preset")).toBe(false);
  });

  test("falls back to the default preset for unknown ids", () => {
    expect(getNativeTextEffectPreset("missing-preset").id).toBe(DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID);
  });
});
