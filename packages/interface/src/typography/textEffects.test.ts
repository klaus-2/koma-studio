import { describe, expect, test } from "vitest";

import { DEFAULT_RENDER_STYLE } from "../constants/dashboard.constants";
import type { RenderTextStyle } from "./renderStyle";
import {
  applyNativeTextEffectPreset,
  DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID,
  getNativeTextEffectPreset,
  isNativeTextEffectPresetId,
  LEGACY_TEXT_EFFECT_PRESET_ALIASES,
  NATIVE_TEXT_EFFECT_PRESETS,
  normalizeNativeTextEffectPresetId,
} from "./textEffects";
import { getTextEffectBleedPadding } from "../utils/renderText.effects";
import { buildInlineSelectionStylePatch } from "../utils/inlineEditor";
import { applyInlineRenderTextStylePatch, resolveRenderTextSelectionStyle } from "../utils/renderTextStyleRanges";

const makeCustomPlainStyle = (): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  fontFamily: "Comic Sans MS",
  fontSize: 48,
  color: "#0f766e",
  fillCssValue: "#0f766e",
  outlineColor: "#fde047",
  outlineOpacity: 0.85,
  outlineWidth: 3,
  bold: true,
  italic: true,
  uppercase: false,
  lineSpacing: 1.35,
  shadowEnabled: true,
  shadowColor: "#1e293b",
  shadowFillCssValue: "#1e293b",
  shadowOpacity: 0.5,
  shadowBlur: 6,
  shadowOffsetX: 2,
  shadowOffsetY: 3,
  skewX: 4,
  skewY: -2,
});

describe("text effects presets", () => {
  test("keeps all 34 rebuilt presets registered with unique ids and valid specs", () => {
    expect(NATIVE_TEXT_EFFECT_PRESETS.length).toBe(34);
    expect(NATIVE_TEXT_EFFECT_PRESETS[0]?.id).toBe(DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID);
    const ids = NATIVE_TEXT_EFFECT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of NATIVE_TEXT_EFFECT_PRESETS) {
      expect(preset.sampleText.trim().length).toBeGreaterThan(0);
      expect(preset.renderSpec).toBeDefined();
    }
    expect(isNativeTextEffectPresetId("balloon_smear")).toBe(true);
    expect(isNativeTextEffectPresetId("missing-preset")).toBe(false);
  });

  test("resolves legacy preset aliases and unknown ids cleanly", () => {
    for (const [legacyId, targetId] of Object.entries(LEGACY_TEXT_EFFECT_PRESET_ALIASES)) {
      expect(normalizeNativeTextEffectPresetId(legacyId)).toBe(targetId);
      expect(getNativeTextEffectPreset(legacyId).id).toBe(targetId);
    }
    expect(getNativeTextEffectPreset("missing-preset").id).toBe(DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID);
  });

  test("restores pre-effect style exactly when returning to No effect", () => {
    const custom = makeCustomPlainStyle();
    const withBlam = applyNativeTextEffectPreset(custom, "blam_impact");
    expect(withBlam.textEffectPreset).toBe("blam_impact");
    expect(withBlam.color).not.toBe(custom.color);
    expect(withBlam.textEffectBaseSnapshot).toBeDefined();

    const restored = applyNativeTextEffectPreset(withBlam, "none");
    expect(restored.textEffectPreset).toBe("none");
    expect(restored.textEffectBaseSnapshot).toBeUndefined();
    expect(restored).toEqual(custom);
  });

  test("prevents cross-preset field leaks across multi-hop switches before No effect", () => {
    const custom = makeCustomPlainStyle();
    const step1 = applyNativeTextEffectPreset(custom, "balloon_smear");
    const step2 = applyNativeTextEffectPreset(step1, "hwa_pastel");
    const step3 = applyNativeTextEffectPreset(step2, "dash_edge");
    const step4 = applyNativeTextEffectPreset(step3, "flinch_outline");
    const step5 = applyNativeTextEffectPreset(step4, "click_ink");

    expect(step5.textEffectBaseSnapshot).toEqual(step1.textEffectBaseSnapshot);
    expect(step5.lineSpacing).toBe(custom.lineSpacing);
    expect(step3.skewX).toBe(-10);
    expect(step4.skewX).toBe(-5);
    expect(step5.skewX).toBe(0);

    const restored = applyNativeTextEffectPreset(step5, "none");
    expect(restored.skewX).toBe(custom.skewX);
    expect(restored).toEqual(custom);
  });

  test("resets legacy regions without textEffectBaseSnapshot cleanly on No effect", () => {
    const legacyRegionStyle: RenderTextStyle = {
      ...DEFAULT_RENDER_STYLE,
      color: "#ffb404",
      fillCssValue: "linear-gradient(180deg, #ffc808 0%, #ffa000 100%)",
      gradientEnabled: true,
      bold: true,
      italic: true,
      uppercase: true,
      skewX: -6,
      textEffectPreset: "blam_impact",
      textEffectIntensity: 1.5,
      textEffectBaseSnapshot: undefined,
    };

    const reset = applyNativeTextEffectPreset(legacyRegionStyle, "none");
    expect(reset.textEffectPreset).toBe("none");
    expect(reset.textEffectIntensity).toBe(1);
    expect(reset.gradientEnabled).toBe(false);
    expect(reset.color).toBe("#111111");
    expect(reset.bold).toBe(false);
    expect(reset.italic).toBe(false);
    expect(reset.uppercase).toBe(false);
    expect(reset.skewX).toBe(0);
  });

  test("supports inline text selection effect apply and clear roundtrip", () => {
    const base = makeCustomPlainStyle();
    const text = "hello world";
    const applyPatch = buildInlineSelectionStylePatch(base, (s) =>
      applyNativeTextEffectPreset(s, "blam_impact"),
    );
    expect(applyPatch).not.toBeNull();

    const rangesAfterApply = applyInlineRenderTextStylePatch(
      text,
      base,
      undefined,
      6,
      11,
      applyPatch!,
    );
    expect(rangesAfterApply).toHaveLength(1);

    const selectedWordStyle = resolveRenderTextSelectionStyle(
      text,
      base,
      rangesAfterApply,
      6,
      11,
    );
    expect(selectedWordStyle.textEffectPreset).toBe("blam_impact");

    const clearPatch = buildInlineSelectionStylePatch(selectedWordStyle, (s) =>
      applyNativeTextEffectPreset(s, "none"),
    );
    expect(clearPatch).not.toBeNull();

    const rangesAfterClear = applyInlineRenderTextStylePatch(
      text,
      base,
      rangesAfterApply,
      6,
      11,
      clearPatch!,
    );
    expect(rangesAfterClear).toBeUndefined();
  });

  test("computes positive font-proportional bleed padding for heavy smear, drip, and shadow presets", () => {
    for (const id of ["balloon_smear", "hoho_ink", "blam_impact", "eheheh_whisper", "flinch_outline"] as const) {
      const styled = applyNativeTextEffectPreset(DEFAULT_RENDER_STYLE, id);
      const bleedSmall = getTextEffectBleedPadding(styled, 24);
      const bleedLarge = getTextEffectBleedPadding(styled, 120);
      expect(Math.max(bleedSmall.top, bleedSmall.right, bleedSmall.bottom, bleedSmall.left)).toBeGreaterThan(2);
      expect(
        bleedLarge.top + bleedLarge.right + bleedLarge.bottom + bleedLarge.left,
      ).toBeGreaterThan(
        bleedSmall.top + bleedSmall.right + bleedSmall.bottom + bleedSmall.left,
      );
    }
  });
});
