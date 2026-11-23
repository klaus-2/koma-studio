import type { RenderTextStyle } from "../typography/renderStyle";
import { NATIVE_TEXT_EFFECT_PRESETS } from "../typography/textEffectPresetData";
import type { NativeTextEffectPresetId } from "../typography/textEffects.types";
import { buildCanvasFont } from "./renderText.core";
import {
  clampTextEffectIntensity,
  drawLinesWithTextEffect,
} from "./renderText.effects";

export interface EffectPreviewOptions {
  readonly width?: number;
  readonly height?: number;
  readonly intensity?: number;
  readonly sampleText?: string;
  readonly fontFamily?: string;
}

const PREVIEW_CACHE_LIMIT = 96;
const previewDataUrlCache = new Map<string, string>();

const DEFAULT_PREVIEW_FONT =
  '"Trebuchet MS", "Arial Black", "Segoe UI", Arial, sans-serif';

const releasePreviewCanvasMemory = (canvas: HTMLCanvasElement): void => {
  canvas.width = 0;
  canvas.height = 0;
};

export const clearTextEffectPreviewCache = (): void => {
  previewDataUrlCache.clear();
};

export const renderTextEffectPreviewDataUrl = (
  presetId: NativeTextEffectPresetId,
  baseStyle: RenderTextStyle,
  options?: EffectPreviewOptions,
): string | null => {
  if (typeof document === "undefined") return null;
  const preset = NATIVE_TEXT_EFFECT_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return null;

  const width = Math.max(48, Math.round(options?.width ?? 168));
  const height = Math.max(24, Math.round(options?.height ?? 54));
  const intensity = clampTextEffectIntensity(options?.intensity ?? 1);
  const sampleText = options?.sampleText ?? preset.sampleText;
  const fontFamily = options?.fontFamily ?? DEFAULT_PREVIEW_FONT;
  const key = `${preset.id}|${width}x${height}|${intensity.toFixed(2)}|${sampleText}|${fontFamily}`;

  const cached = previewDataUrlCache.get(key);
  if (cached !== undefined) {
    previewDataUrlCache.delete(key);
    previewDataUrlCache.set(key, cached);
    return cached;
  }

  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(dpr, dpr);
  const patch = preset.recommendedPatch ?? {};
  const previewStyle: RenderTextStyle = {
    ...baseStyle,
    fontFamily,
    bold: true,
    italic: false,
    uppercase: false,
    skewX: 0,
    skewY: 0,
    rotation: 0,
    gradientEnabled: false,
    shadowEnabled: false,
    outlineWidth: preset.id === "none" ? 0 : 2,
    outlineColor: "#ffffff",
    color: preset.id === "none" ? "#1f2430" : baseStyle.color,
    fillCssValue: preset.id === "none" ? "#1f2430" : baseStyle.fillCssValue,
    ...patch,
    shadowLayers: preset.shadowLayers?.map((l) => ({ ...l })),
    textEffectPreset: preset.id,
    textEffectIntensity: intensity,
  };

  let fontSize = Math.round(height * 0.5);
  const maxContentW = width * 0.8;
  ctx.font = buildCanvasFont(previewStyle, fontSize);
  const rawDisplayText = previewStyle.uppercase
    ? sampleText.toUpperCase()
    : sampleText;
  let metrics = ctx.measureText(rawDisplayText);
  let measuredW = metrics.width;
  while (measuredW > maxContentW && fontSize > 11) {
    fontSize -= 1;
    ctx.font = buildCanvasFont(previewStyle, fontSize);
    metrics = ctx.measureText(rawDisplayText);
    measuredW = metrics.width;
  }

  ctx.textBaseline = "top";
  metrics = ctx.measureText(rawDisplayText);
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const centerX = width / 2;
  const drawY =
    Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0
      ? height / 2 - (descent - ascent) / 2
      : Math.max(2, (height - fontSize * 1.05) / 2);

  ctx.save();
  if (Math.abs(previewStyle.skewX) > 0.01) {
    ctx.translate(centerX, height / 2);
    ctx.transform(1, 0, Math.tan((previewStyle.skewX * Math.PI) / 180), 1, 0, 0);
    ctx.translate(-centerX, -height / 2);
  }

  if (preset.id === "none") {
    ctx.font = buildCanvasFont(previewStyle, fontSize);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#1f2430";
    ctx.fillText(rawDisplayText, centerX, drawY);
  } else {
    drawLinesWithTextEffect({
      ctx,
      style: previewStyle,
      fontSize,
      runs: [
        {
          text: rawDisplayText,
          drawX: centerX,
          lineY: drawY,
          measuredWidth: measuredW,
        },
      ],
      align: "center",
      baseline: "top",
      drawUnderline: false,
      underlineThickness: 1,
      lineHeight: fontSize * 1.15,
    });
  }
  ctx.restore();

  try {
    const url = canvas.toDataURL("image/png");
    releasePreviewCanvasMemory(canvas);
    if (!url || url === "data:,") return null;
    previewDataUrlCache.delete(key);
    previewDataUrlCache.set(key, url);
    if (previewDataUrlCache.size > PREVIEW_CACHE_LIMIT) {
      const oldest = previewDataUrlCache.keys().next().value;
      if (oldest !== undefined) previewDataUrlCache.delete(oldest);
    }
    return url;
  } catch {
    releasePreviewCanvasMemory(canvas);
    return null;
  }
};
