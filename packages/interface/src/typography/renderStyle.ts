import type { NativeTextEffectPresetId } from "./textEffects";

export type RenderTextAlign = "left" | "center" | "right";
export type RenderTextOrientation = "horizontal" | "vertical";
export type RenderTextPathMode = "normal" | "circular";

export interface RenderTextShadowLayer {
  fillCssValue: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface RenderTextStyle {
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  autoFontSize: boolean;
  lineSpacing: number;
  textOrientation: RenderTextOrientation;
  textPathMode: RenderTextPathMode;
  circularRadiusScale: number;
  circularStartAngle: number;
  circularLetterSpacing: number;
  rotation: number;
  skewX: number;
  skewY: number;
  alignment: RenderTextAlign;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  underline: boolean;
  opacity: number;
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
  shadowLayers?: RenderTextShadowLayer[];
  color: string;
  fillCssValue?: string;
  gradientEnabled: boolean;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
  detectGradient: boolean;
  hyphenationEnabled: boolean;
  hyphenationLanguage?: string;
  outlineColor: string;
  outlineOpacity: number;
  outlineWidth: number;
  textEffectPreset: NativeTextEffectPresetId;
  textEffectIntensity: number;
}

export interface RenderTextStyleRange {
  start: number;
  end: number;
  style: Partial<RenderTextStyle>;
}
