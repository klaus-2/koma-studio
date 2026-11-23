import type { TranslationKey } from "../i18n/messages";

export type TextEffectCategory =
  | "all"
  | "impact"
  | "soft"
  | "brush"
  | "comic"
  | "smear";

export type NativeTextEffectPresetId =
  | "none"
  | "balloon_smear"
  | "smiles_outline"
  | "ahnnn_peach"
  | "hwa_pastel"
  | "aah_blush"
  | "silence_ink"
  | "hah_pop"
  | "kkk_crimson"
  | "smooch_jelly"
  | "tremble_brush"
  | "eheheh_whisper"
  | "hoho_ink"
  | "blam_impact"
  | "thump_heavy"
  | "badump_soft"
  | "glossy_pop"
  | "haha_bounce"
  | "crack_ink"
  | "screach_sketch"
  | "growl_moss"
  | "scratch_noise"
  | "beep_outline"
  | "boom_comic"
  | "bang_chunk"
  | "shake_blur"
  | "rattle_jagged"
  | "flinch_outline"
  | "break_glitch"
  | "snap_rough"
  | "yawn_soft"
  | "click_ink"
  | "dash_edge"
  | "scream_scratch";

export interface RenderTextShadowLayerSpec {
  fillCssValue: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface RenderTextEffectBaseSnapshot {
  color: string;
  fillCssValue?: string;
  gradientEnabled: boolean;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
  detectGradient: boolean;
  outlineColor: string;
  outlineOpacity: number;
  outlineWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowFillCssValue?: string;
  shadowGradientEnabled: boolean;
  shadowGradientStartColor: string;
  shadowGradientEndColor: string;
  shadowGradientAngle: number;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowLayers?: RenderTextShadowLayerSpec[];
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  lineSpacing: number;
  skewX: number;
  skewY: number;
  opacity: number;
}

export interface TextEffectStrokeLayer {
  color: string;
  widthRatio: number;
  minPx?: number;
  opacity?: number;
  offsetXRatio?: number;
  offsetYRatio?: number;
  mode?: "round" | "miter" | "jagged";
}

export interface TextEffectShadowLayerSpec {
  color: string;
  offsetXRatio: number;
  offsetYRatio: number;
  blurRatio: number;
  opacity: number;
  extrudeSteps?: number;
  includeOutline?: boolean;
  strokeExpandRatio?: number;
}

export type TextEffectFillMode =
  | { kind: "style" }
  | { kind: "pattern_hwa_floral"; baseColor: string }
  | {
      kind: "pattern_hah_halftone";
      baseColor: string;
      topDotColor: string;
      bottomDotColor: string;
      dotSpacingRatio: number;
      dotRadiusRatio: number;
    };

export type TextEffectInnerHighlightSpec =
  | { kind: "gloss_top"; color: string; opacity: number; coverage: number }
  | { kind: "inner_glow"; color: string; blurRatio: number; opacity: number }
  | { kind: "dry_streaks"; color: string; opacity: number };

export type TextEffectSurfaceSpec =
  | { kind: "none" }
  | {
      kind: "balloon_smear";
      smearColor: string;
      steps: number;
      dropRatio: number;
      wobbleRatio: number;
      blurEndRatio: number;
    }
  | {
      kind: "dry_brush";
      roughnessRatio: number;
      bristleDensity: number;
      edgeErode: number;
    }
  | {
      kind: "chalk_speckle";
      density: number;
      edgeErode: number;
      fleckCount: number;
    }
  | {
      kind: "splinter_crack";
      spikeLengthRatio: number;
      jaggedness: number;
      chipped: boolean;
    }
  | {
      kind: "etched_screach";
      passes: number;
      strokeRatio: number;
      jitterRatio: number;
    }
  | {
      kind: "ink_drips";
      dripColor: string;
      maxLengthRatio: number;
      density: number;
    }
  | {
      kind: "fracture_break";
      bands: number;
      crackWidthRatio: number;
      shiftRatio: number;
    }
  | {
      kind: "glyph_bounce";
      verticalAmpRatio: number;
      maxTiltDeg: number;
    }
  | {
      kind: "shake_echo";
      echoColor: string;
      echoOutlineColor: string;
      offsetXRatio: number;
      offsetYRatio: number;
      opacity: number;
    };

export interface TextEffectRenderSpec {
  fill: TextEffectFillMode;
  outerGlows?: TextEffectShadowLayerSpec[];
  shadows?: TextEffectShadowLayerSpec[];
  strokes?: TextEffectStrokeLayer[];
  innerHighlight?: TextEffectInnerHighlightSpec;
  surface: TextEffectSurfaceSpec;
  archRatio?: number;
}

export interface NativeTextEffectPreset {
  id: NativeTextEffectPresetId;
  label: TranslationKey;
  description: TranslationKey;
  sampleText: string;
  category: Exclude<TextEffectCategory, "all">;
  supportsIntensity: boolean;
  renderSpec: TextEffectRenderSpec;
  recommendedPatch?: {
    color?: string;
    fillCssValue?: string;
    gradientEnabled?: boolean;
    gradientStartColor?: string;
    gradientEndColor?: string;
    gradientAngle?: number;
    detectGradient?: boolean;
    outlineColor?: string;
    outlineOpacity?: number;
    outlineWidth?: number;
    shadowEnabled?: boolean;
    shadowColor?: string;
    shadowFillCssValue?: string;
    shadowGradientEnabled?: boolean;
    shadowGradientStartColor?: string;
    shadowGradientEndColor?: string;
    shadowGradientAngle?: number;
    shadowOpacity?: number;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    bold?: boolean;
    italic?: boolean;
    uppercase?: boolean;
    lineSpacing?: number;
    skewX?: number;
    skewY?: number;
    alignment?: "left" | "center" | "right";
  };
  shadowLayers?: RenderTextShadowLayerSpec[];
}
