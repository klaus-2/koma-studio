import type { RenderTextStyle } from "../typography/renderStyle";
import { getNativeTextEffectPreset } from "../typography/textEffects";
import type {
  NativeTextEffectPreset,
  TextEffectShadowLayerSpec,
  TextEffectStrokeLayer,
} from "../typography/textEffects.types";
import {
  applyOpacityToColor,
  buildCanvasFont,
  normalizeOpacity,
  resolveCanvasFillStyle,
} from "./renderText.core";
import {
  applyChalkSpeckleToCanvas,
  applyDryBrushToCanvas,
  applyFractureBreakToCanvas,
  applyInkDripsToCanvas,
  applySplinterCrackToCanvas,
  createSeededRng,
  hashEffectSeed,
  paintDryStreaksHighlight,
  paintGlossTopHighlight,
  paintHahHalftoneFill,
  paintHwaFloralFill,
} from "./renderText.effects.textures";
import type { RenderTextLayout } from "./renderText.types";
import { segmentText } from "./renderText.unicode";

export interface EffectLineRun {
  readonly text: string;
  readonly drawX: number;
  readonly lineY: number;
  readonly measuredWidth: number;
}

export interface TextEffectBleed {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const BITMAP_CACHE_LIMIT = 36;
const bitmapCache = new Map<string, HTMLCanvasElement>();

const releaseCanvasMemory = (canvas: HTMLCanvasElement): void => {
  canvas.width = 0;
  canvas.height = 0;
};

const rememberBitmap = (key: string, canvas: HTMLCanvasElement): void => {
  bitmapCache.delete(key);
  bitmapCache.set(key, canvas);
  if (bitmapCache.size > BITMAP_CACHE_LIMIT) {
    const oldestKey = bitmapCache.keys().next().value;
    if (oldestKey !== undefined) {
      const oldest = bitmapCache.get(oldestKey);
      bitmapCache.delete(oldestKey);
      if (oldest) releaseCanvasMemory(oldest);
    }
  }
};

export const clearTextEffectCaches = (): void => {
  for (const canvas of bitmapCache.values()) {
    releaseCanvasMemory(canvas);
  }
  bitmapCache.clear();
};

const createScratchCanvas = (
  width: number,
  height: number,
): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

const clampIntensity = (value: number | undefined): number => {
  const num = Number(value ?? 1);
  return Number.isFinite(num) ? Math.min(2, Math.max(0, num)) : 1;
};

export const clampTextEffectIntensity = clampIntensity;

const resolvePrimaryStrokeWidthPx = (
  stroke: TextEffectStrokeLayer,
  fontSize: number,
  style: RenderTextStyle,
  preset: NativeTextEffectPreset,
  isPrimary: boolean,
): number => {
  const baseWidth = Math.max(stroke.minPx ?? 0.5, fontSize * stroke.widthRatio);
  if (!isPrimary) return baseWidth;
  const recWidth = preset.recommendedPatch?.outlineWidth;
  if (typeof recWidth === "number" && recWidth > 0) {
    if (style.outlineWidth <= 0) return 0;
    const ratio = style.outlineWidth / recWidth;
    return Math.max(stroke.minPx ?? 0.5, baseWidth * ratio);
  }
  return baseWidth;
};

const resolveEffectFillBounds = (
  runs: readonly EffectLineRun[],
  fontSize: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline = "top",
): { x: number; y: number; width: number; height: number } => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const baselineOffset = baseline === "middle" ? -fontSize * 0.5 : 0;

  for (const run of runs) {
    const w = Math.max(1, run.measuredWidth);
    const left =
      align === "center"
        ? run.drawX - w / 2
        : align === "right"
          ? run.drawX - w
          : run.drawX;
    const topY = run.lineY + baselineOffset;
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, left + w);
    minY = Math.min(minY, topY + fontSize * 0.08);
    maxY = Math.max(maxY, topY + fontSize * 0.92);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: fontSize, height: fontSize };
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export const resolveEffectGlyphFillStyle = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  runs: readonly EffectLineRun[],
  fontSize: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline = "top",
): string | CanvasGradient => {
  const bounds = resolveEffectFillBounds(runs, fontSize, align, baseline);
  return resolveCanvasFillStyle(
    ctx,
    style,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  );
};

export const getTextEffectBleedPadding = (
  style: RenderTextStyle,
  fontSize: number,
): TextEffectBleed => {
  const preset = getNativeTextEffectPreset(style.textEffectPreset);
  const baseOutline = Math.max(0, style.outlineWidth || 0);
  const intensity = clampIntensity(style.textEffectIntensity);

  let top = baseOutline;
  let right = baseOutline;
  let bottom = baseOutline;
  let left = baseOutline;

  if (style.shadowEnabled) {
    const shadowBlur = Math.max(0, style.shadowBlur || 0) * 1.5;
    const ox = (style.shadowOffsetX || 0) * 1.35;
    const oy = (style.shadowOffsetY || 0) * 1.35;
    left = Math.max(left, shadowBlur + Math.max(0, -ox));
    right = Math.max(right, shadowBlur + Math.max(0, ox));
    top = Math.max(top, shadowBlur + Math.max(0, -oy));
    bottom = Math.max(bottom, shadowBlur + Math.max(0, oy));
  }

  if (preset.id === "none") {
    return {
      top: Math.ceil(top),
      right: Math.ceil(right),
      bottom: Math.ceil(bottom),
      left: Math.ceil(left),
    };
  }

  const spec = preset.renderSpec;
  const padScale = Math.max(0.5, intensity);

  for (const stroke of spec.strokes ?? []) {
    const w = fontSize * stroke.widthRatio * 1.15;
    top = Math.max(top, w);
    right = Math.max(right, w);
    bottom = Math.max(bottom, w);
    left = Math.max(left, w);
  }

  for (const glow of spec.outerGlows ?? []) {
    const radius = fontSize * glow.blurRatio * 1.6 * padScale;
    top = Math.max(top, radius);
    right = Math.max(right, radius);
    bottom = Math.max(bottom, radius);
    left = Math.max(left, radius);
  }

  for (const shadow of spec.shadows ?? []) {
    const ox = fontSize * shadow.offsetXRatio * padScale;
    const oy = fontSize * shadow.offsetYRatio * padScale;
    const expand = fontSize * (shadow.strokeExpandRatio ?? 0) + fontSize * shadow.blurRatio * 1.4;
    left = Math.max(left, expand + Math.max(0, -ox));
    right = Math.max(right, expand + Math.max(0, ox));
    top = Math.max(top, expand + Math.max(0, -oy));
    bottom = Math.max(bottom, expand + Math.max(0, oy));
  }

  switch (spec.surface.kind) {
    case "balloon_smear": {
      const drop = fontSize * spec.surface.dropRatio * padScale + fontSize * spec.surface.blurEndRatio * 1.5;
      const side = fontSize * (spec.surface.wobbleRatio + spec.surface.blurEndRatio * 1.5) * padScale;
      bottom = Math.max(bottom, drop);
      left = Math.max(left, side);
      right = Math.max(right, side);
      break;
    }
    case "ink_drips": {
      bottom = Math.max(bottom, fontSize * spec.surface.maxLengthRatio * padScale + 4);
      break;
    }
    case "splinter_crack": {
      const spike = fontSize * spec.surface.spikeLengthRatio * 1.3 * padScale;
      top = Math.max(top, spike);
      right = Math.max(right, spike);
      bottom = Math.max(bottom, spike);
      left = Math.max(left, spike);
      break;
    }
    case "fracture_break": {
      const shift = fontSize * spec.surface.shiftRatio * 1.3 * padScale;
      left = Math.max(left, shift);
      right = Math.max(right, shift);
      break;
    }
    case "shake_echo": {
      const sx = Math.abs(fontSize * spec.surface.offsetXRatio) * padScale + fontSize * 0.1;
      const sy = Math.abs(fontSize * spec.surface.offsetYRatio) * padScale + fontSize * 0.1;
      left = Math.max(left, sx);
      right = Math.max(right, sx);
      top = Math.max(top, sy);
      bottom = Math.max(bottom, sy);
      break;
    }
    case "glyph_bounce": {
      const amp = fontSize * spec.surface.verticalAmpRatio * 1.5 * padScale;
      top = Math.max(top, amp);
      bottom = Math.max(bottom, amp);
      break;
    }
    default:
      break;
  }

  return {
    top: Math.ceil(top + 2),
    right: Math.ceil(right + 2),
    bottom: Math.ceil(bottom + 2),
    left: Math.ceil(left + 2),
  };
};

const drawBalloonSmearBack = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  fontSize: number,
  intensity: number,
  smearColor: string,
  steps: number,
  dropRatio: number,
  wobbleRatio: number,
  blurEndRatio: number,
): void => {
  if (intensity <= 0) return;
  const activeSteps = Math.max(6, Math.round(steps * (0.6 + intensity * 0.4)));
  const totalDrop = fontSize * dropRatio * intensity;
  const wobbleAmp = fontSize * wobbleRatio * intensity;
  const maxBlur = fontSize * blurEndRatio * intensity;

  for (let anchor = 0; anchor < 2; anchor += 1) {
    const anchorDy = fontSize * (0.032 + anchor * 0.036) * intensity;
    const anchorAlpha = (0.28 - anchor * 0.09) * Math.min(1.25, intensity);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, anchorAlpha));
    ctx.fillStyle = smearColor;
    ctx.shadowColor = smearColor;
    ctx.shadowBlur = Math.max(0.5, fontSize * (0.015 + anchor * 0.015));
    for (const run of runs) {
      ctx.fillText(run.text, run.drawX + (anchor === 0 ? -0.4 : 0.4), run.lineY + anchorDy);
    }
    ctx.restore();
  }

  for (let i = 0; i < activeSteps; i += 1) {
    const t = (i + 1) / activeSteps;
    const easedDrop = Math.pow(t, 1.15) * totalDrop;
    const wobbleX = Math.sin(t * Math.PI * 2.35 + i * 0.45) * wobbleAmp;
    const alpha = 0.22 * Math.pow(1 - t * 0.88, 1.75) * Math.min(1.3, 0.45 + intensity * 0.55);
    const blur = fontSize * 0.014 + t * maxBlur;
    if (alpha < 0.01) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = smearColor;
    ctx.shadowColor = smearColor;
    ctx.shadowBlur = blur;
    if (typeof ctx.filter === "string" && blur > 0.4) {
      ctx.filter = `blur(${(blur * 0.55).toFixed(1)}px)`;
    }
    for (const run of runs) {
      ctx.fillText(run.text, run.drawX + wobbleX, run.lineY + easedDrop);
    }
    ctx.restore();
  }
};

const drawOuterGlowLayers = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  glows: readonly TextEffectShadowLayerSpec[],
  fontSize: number,
  intensity: number,
  textOpacity: number,
): void => {
  for (const glow of glows) {
    const blurPx = Math.max(0.8, fontSize * glow.blurRatio * (0.45 + intensity * 0.55));
    const ox = fontSize * glow.offsetXRatio;
    const oy = fontSize * glow.offsetYRatio;
    const alpha = Math.max(0, Math.min(1, glow.opacity * Math.min(1.3, 0.5 + intensity * 0.5) * textOpacity));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = glow.color;
    ctx.strokeStyle = glow.color;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, blurPx * 0.35);
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = blurPx;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    for (const run of runs) {
      ctx.strokeText(run.text, run.drawX + ox, run.lineY + oy);
      ctx.fillText(run.text, run.drawX + ox, run.lineY + oy);
    }
    ctx.restore();
  }
};

const drawShadowSpecs = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  shadows: readonly TextEffectShadowLayerSpec[],
  fontSize: number,
  intensity: number,
  textOpacity: number,
): void => {
  for (const shadow of shadows) {
    const steps = Math.max(1, shadow.extrudeSteps ?? 1);
    const dx = fontSize * shadow.offsetXRatio * (0.5 + intensity * 0.5);
    const dy = fontSize * shadow.offsetYRatio * (0.5 + intensity * 0.5);
    const blurPx = Math.max(0, fontSize * shadow.blurRatio);
    const expandStroke = shadow.includeOutline
      ? Math.max(0.5, fontSize * (shadow.strokeExpandRatio ?? 0.08) * 2)
      : 0;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, shadow.opacity * textOpacity));
    ctx.fillStyle = shadow.color;
    ctx.strokeStyle = shadow.color;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = expandStroke;
    ctx.shadowColor = blurPx > 0 ? shadow.color : "rgba(0,0,0,0)";
    ctx.shadowBlur = blurPx;

    for (let step = steps; step >= 1; step -= 1) {
      const t = step / steps;
      const ox = dx * t;
      const oy = dy * t;
      for (const run of runs) {
        if (expandStroke > 0) {
          ctx.strokeText(run.text, run.drawX + ox, run.lineY + oy);
        }
        ctx.fillText(run.text, run.drawX + ox, run.lineY + oy);
      }
    }
    ctx.restore();
  }
};

const drawStrokeLayers = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  strokes: readonly TextEffectStrokeLayer[],
  fontSize: number,
  style: RenderTextStyle,
  preset: NativeTextEffectPreset,
  textOpacity: number,
): void => {
  for (let index = 0; index < strokes.length; index += 1) {
    const stroke = strokes[index];
    if (!stroke) continue;
    const isPrimary = index === 0;
    const widthPx = resolvePrimaryStrokeWidthPx(stroke, fontSize, style, preset, isPrimary);
    if (widthPx <= 0) continue;

    const strokeColor =
      isPrimary && style.outlineColor ? style.outlineColor : stroke.color;
    const strokeAlpha =
      (stroke.opacity ?? 1)
      * (isPrimary ? normalizeOpacity(style.outlineOpacity ?? 1) : 1)
      * textOpacity;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, strokeAlpha));
    ctx.strokeStyle = applyOpacityToColor(strokeColor, 1);
    ctx.lineWidth = widthPx * 2;
    ctx.lineJoin = stroke.mode === "miter" ? "miter" : "round";
    ctx.miterLimit = 2;
    const ox = fontSize * (stroke.offsetXRatio ?? 0);
    const oy = fontSize * (stroke.offsetYRatio ?? 0);
    for (const run of runs) {
      ctx.strokeText(run.text, run.drawX + ox, run.lineY + oy);
    }
    ctx.restore();
  }
};

const drawEtchedScreachBody = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  fontSize: number,
  intensity: number,
  passes: number,
  strokeRatio: number,
  jitterRatio: number,
  fillStyle: string | CanvasGradient,
): void => {
  const scale = Math.max(0.25, intensity);
  const rng = createSeededRng(hashEffectSeed(runs.map((r) => r.text).join("|")) ^ 0x77);
  const strokeColor = typeof fillStyle === "string" ? fillStyle : "#0c0c0c";

  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.globalAlpha = 0.38;
  for (const run of runs) {
    ctx.fillText(run.text, run.drawX, run.lineY);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineJoin = "miter";
  ctx.lineCap = "round";

  ctx.lineWidth = Math.max(0.65, fontSize * strokeRatio * 0.85);
  ctx.globalAlpha = 0.92;
  for (const run of runs) {
    ctx.strokeText(run.text, run.drawX, run.lineY);
  }

  for (let p = 0; p < passes; p += 1) {
    const ox = (rng() - 0.5) * 2 * fontSize * jitterRatio * 0.7 * scale;
    const oy = (rng() - 0.5) * 2 * fontSize * jitterRatio * 1.15 * scale;
    ctx.lineWidth = Math.max(0.55, fontSize * strokeRatio * (0.45 + rng() * 0.4));
    ctx.globalAlpha = 0.55 + rng() * 0.38;
    for (const run of runs) {
      ctx.strokeText(run.text, run.drawX + ox, run.lineY + oy);
    }
  }
  ctx.restore();
};

const drawBounceBody = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  fontSize: number,
  intensity: number,
  verticalAmpRatio: number,
  maxTiltDeg: number,
  align: CanvasTextAlign,
  fillStyle: string | CanvasGradient,
): void => {
  const scale = Math.max(0.2, intensity);
  ctx.save();
  ctx.fillStyle = fillStyle;

  for (const run of runs) {
    const totalW = run.measuredWidth;
    let cursorX =
      align === "center"
        ? run.drawX - totalW / 2
        : align === "right"
          ? run.drawX - totalW
          : run.drawX;
    const rng = createSeededRng(hashEffectSeed(run.text) ^ 0x4121);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const grapheme of segmentText(run.text)) {
      const ch = grapheme.text;
      const w = ctx.measureText(ch).width;
      const dy = (rng() - 0.5) * 2 * fontSize * verticalAmpRatio * scale;
      const tilt = ((rng() - 0.5) * 2 * maxTiltDeg * scale * Math.PI) / 180;
      const cx = cursorX + w / 2;
      const cy = run.lineY + fontSize * 0.52 + dy;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();

      cursorX += w;
    }
  }
  ctx.restore();
};

const requiresSurfaceScratchPass = (
  preset: NativeTextEffectPreset,
  hasBitmapCacheEligibleFill: boolean,
): boolean => {
  const { fill, innerHighlight, surface } = preset.renderSpec;
  if (hasBitmapCacheEligibleFill && fill.kind !== "style") return true;
  if (innerHighlight !== undefined) return true;
  return (
    surface.kind === "dry_brush"
    || surface.kind === "chalk_speckle"
    || surface.kind === "splinter_crack"
    || surface.kind === "ink_drips"
    || surface.kind === "fracture_break"
  );
};

const paintTextBodyWithScratchSurface = (
  ctx: CanvasRenderingContext2D,
  runs: readonly EffectLineRun[],
  fontSize: number,
  style: RenderTextStyle,
  preset: NativeTextEffectPreset,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
  intensity: number,
): void => {
  const bounds = resolveEffectFillBounds(runs, fontSize, align, baseline);
  const pad = Math.ceil(fontSize * 0.65);
  const originX = bounds.x - pad;
  const originY = bounds.y - fontSize * 0.08 - pad;
  const canvasW = Math.max(4, Math.ceil(bounds.width + pad * 2));
  const canvasH = Math.max(4, Math.ceil(bounds.height + fontSize * 0.16 + pad * 2));
  const seedInput = runs.map((r) => r.text).join("\n");
  const seed = hashEffectSeed(`${preset.id}|${seedInput}`);

  const cacheKey = [
    preset.id,
    seedInput,
    Math.round(fontSize * 10),
    style.fontFamily,
    style.bold ? 1 : 0,
    style.italic ? 1 : 0,
    baseline,
    Math.round(intensity * 100),
    style.color,
    style.fillCssValue ?? "",
    style.gradientEnabled ? 1 : 0,
    style.gradientStartColor,
    style.gradientEndColor,
    Math.round(style.gradientAngle),
    canvasW,
    canvasH,
  ].join("|");

  const cached = bitmapCache.get(cacheKey);
  if (cached) {
    bitmapCache.delete(cacheKey);
    bitmapCache.set(cacheKey, cached);
    ctx.drawImage(cached, originX, originY);
    return;
  }

  const scratch = createScratchCanvas(canvasW, canvasH);
  if (!scratch) return;
  const sctx = scratch.getContext("2d");
  if (!sctx) {
    releaseCanvasMemory(scratch);
    return;
  }

  sctx.font = buildCanvasFont(style, fontSize);
  sctx.textAlign = align;
  sctx.textBaseline = baseline;
  sctx.fillStyle = "#000000";

  const localRuns: EffectLineRun[] = runs.map((run) => ({
    text: run.text,
    drawX: run.drawX - originX,
    lineY: run.lineY - originY,
    measuredWidth: run.measuredWidth,
  }));

  for (const run of localRuns) {
    sctx.fillText(run.text, run.drawX, run.lineY);
  }

  const spec = preset.renderSpec;
  const glyphTop = pad + fontSize * 0.08;
  const glyphBottom = glyphTop + bounds.height;

  if (spec.fill.kind === "pattern_hwa_floral") {
    paintHwaFloralFill(sctx, canvasW, canvasH, fontSize, spec.fill.baseColor, seed);
  } else if (spec.fill.kind === "pattern_hah_halftone") {
    paintHahHalftoneFill(
      sctx,
      canvasW,
      canvasH,
      fontSize,
      glyphTop,
      glyphBottom,
      spec.fill.baseColor,
      spec.fill.topDotColor,
      spec.fill.bottomDotColor,
      spec.fill.dotSpacingRatio,
      spec.fill.dotRadiusRatio,
    );
  } else {
    sctx.save();
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = resolveEffectGlyphFillStyle(sctx, style, localRuns, fontSize, align, baseline);
    sctx.fillRect(0, 0, canvasW, canvasH);
    sctx.restore();
  }

  if (spec.innerHighlight) {
    if (spec.innerHighlight.kind === "gloss_top") {
      paintGlossTopHighlight(
        sctx,
        canvasW,
        canvasH,
        glyphTop,
        fontSize,
        spec.innerHighlight.color,
        spec.innerHighlight.opacity,
        spec.innerHighlight.coverage,
      );
    } else if (spec.innerHighlight.kind === "dry_streaks") {
      paintDryStreaksHighlight(
        sctx,
        canvasW,
        canvasH,
        fontSize,
        spec.innerHighlight.color,
        spec.innerHighlight.opacity,
        seed,
      );
    } else if (spec.innerHighlight.kind === "inner_glow") {
      sctx.save();
      sctx.globalCompositeOperation = "source-atop";
      sctx.strokeStyle = spec.innerHighlight.color;
      sctx.lineWidth = Math.max(0.8, fontSize * spec.innerHighlight.blurRatio);
      sctx.globalAlpha = spec.innerHighlight.opacity;
      for (const run of localRuns) {
        sctx.strokeText(run.text, run.drawX, run.lineY);
      }
      sctx.restore();
    }
  }

  let finalCanvas = scratch;
  if (spec.surface.kind === "dry_brush") {
    const out = createScratchCanvas(canvasW, canvasH);
    if (out) {
      applyDryBrushToCanvas(scratch, out, fontSize, intensity, seed, spec.surface);
      releaseCanvasMemory(scratch);
      finalCanvas = out;
    }
  } else if (spec.surface.kind === "chalk_speckle") {
    applyChalkSpeckleToCanvas(scratch, fontSize, intensity, seed, spec.surface);
  } else if (spec.surface.kind === "splinter_crack") {
    applySplinterCrackToCanvas(
      scratch,
      fontSize,
      intensity,
      seed,
      spec.surface,
      style.color || "#080808",
    );
  } else if (spec.surface.kind === "ink_drips") {
    applyInkDripsToCanvas(
      scratch,
      fontSize,
      intensity,
      seed,
      spec.surface.dripColor,
      spec.surface.maxLengthRatio,
      spec.surface.density,
    );
  } else if (spec.surface.kind === "fracture_break") {
    const out = createScratchCanvas(canvasW, canvasH);
    if (out) {
      applyFractureBreakToCanvas(scratch, out, fontSize, intensity, seed, spec.surface);
      releaseCanvasMemory(scratch);
      finalCanvas = out;
    }
  }

  rememberBitmap(cacheKey, finalCanvas);
  ctx.drawImage(finalCanvas, originX, originY);
};

export interface DrawLinesWithEffectRequest {
  readonly ctx: CanvasRenderingContext2D;
  readonly style: RenderTextStyle;
  readonly fontSize: number;
  readonly runs: readonly EffectLineRun[];
  readonly align: CanvasTextAlign;
  readonly baseline: CanvasTextBaseline;
  readonly drawUnderline: boolean;
  readonly underlineThickness: number;
  readonly lineHeight: number;
}

export const drawLinesWithTextEffect = ({
  ctx,
  style,
  fontSize,
  runs,
  align,
  baseline,
  drawUnderline,
  underlineThickness,
  lineHeight,
}: DrawLinesWithEffectRequest): void => {
  if (runs.length === 0) return;
  const preset = getNativeTextEffectPreset(style.textEffectPreset);
  const spec = preset.renderSpec;
  const intensity = clampIntensity(style.textEffectIntensity);
  const textOpacity = normalizeOpacity(style.opacity);

  ctx.save();
  ctx.font = buildCanvasFont(style, fontSize);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  if (spec.surface.kind === "balloon_smear") {
    drawBalloonSmearBack(
      ctx,
      runs,
      fontSize,
      intensity,
      spec.surface.smearColor,
      spec.surface.steps,
      spec.surface.dropRatio,
      spec.surface.wobbleRatio,
      spec.surface.blurEndRatio,
    );
  } else if (spec.surface.kind === "shake_echo") {
    const ox = fontSize * spec.surface.offsetXRatio * Math.max(0.2, intensity);
    const oy = fontSize * spec.surface.offsetYRatio * Math.max(0.2, intensity);
    ctx.save();
    ctx.globalAlpha = spec.surface.opacity * textOpacity;
    ctx.strokeStyle = spec.surface.echoOutlineColor;
    ctx.lineWidth = Math.max(1, fontSize * 0.08 * 2);
    ctx.lineJoin = "round";
    ctx.fillStyle = spec.surface.echoColor;
    for (const run of runs) {
      ctx.strokeText(run.text, run.drawX + ox, run.lineY + oy);
      ctx.fillText(run.text, run.drawX + ox, run.lineY + oy);
      ctx.strokeText(run.text, run.drawX - ox * 0.6, run.lineY - oy * 0.6);
      ctx.fillText(run.text, run.drawX - ox * 0.6, run.lineY - oy * 0.6);
    }
    ctx.restore();
  }

  if (spec.outerGlows?.length && intensity > 0) {
    drawOuterGlowLayers(ctx, runs, spec.outerGlows, fontSize, intensity, textOpacity);
  }

  if (spec.shadows?.length) {
    drawShadowSpecs(ctx, runs, spec.shadows, fontSize, intensity, textOpacity);
  }

  if (style.shadowEnabled) {
    const manualLayers = style.shadowLayers?.length
      ? style.shadowLayers
      : [
          {
            fillCssValue: style.shadowFillCssValue || style.shadowColor || "#000000",
            opacity: normalizeOpacity(style.shadowOpacity ?? 1),
            blur: style.shadowBlur || 0,
            offsetX: style.shadowOffsetX || 0,
            offsetY: style.shadowOffsetY || 0,
          },
        ];
    for (const layer of manualLayers) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity * textOpacity));
      ctx.fillStyle = layer.fillCssValue;
      ctx.shadowColor = layer.blur > 0 ? layer.fillCssValue : "rgba(0,0,0,0)";
      ctx.shadowBlur = Math.max(0, layer.blur);
      for (const run of runs) {
        ctx.fillText(
          run.text,
          run.drawX + layer.offsetX * 1.35,
          run.lineY + layer.offsetY * 1.35,
        );
      }
      ctx.restore();
    }
  }

  if (spec.strokes?.length) {
    drawStrokeLayers(ctx, runs, spec.strokes, fontSize, style, preset, textOpacity);
  }

  ctx.globalAlpha = textOpacity;
  if (spec.surface.kind === "etched_screach") {
    const fill = resolveEffectGlyphFillStyle(ctx, style, runs, fontSize, align, baseline);
    drawEtchedScreachBody(
      ctx,
      runs,
      fontSize,
      intensity,
      spec.surface.passes,
      spec.surface.strokeRatio,
      spec.surface.jitterRatio,
      fill,
    );
  } else if (spec.surface.kind === "glyph_bounce") {
    const fill = resolveEffectGlyphFillStyle(ctx, style, runs, fontSize, align, baseline);
    drawBounceBody(
      ctx,
      runs,
      fontSize,
      intensity,
      spec.surface.verticalAmpRatio,
      spec.surface.maxTiltDeg,
      align,
      fill,
    );
  } else if (requiresSurfaceScratchPass(preset, true)) {
    paintTextBodyWithScratchSurface(
      ctx,
      runs,
      fontSize,
      style,
      preset,
      align,
      baseline,
      intensity,
    );
  } else {
    ctx.fillStyle = resolveEffectGlyphFillStyle(ctx, style, runs, fontSize, align, baseline);
    for (const run of runs) {
      ctx.fillText(run.text, run.drawX, run.lineY);
    }
  }

  if (drawUnderline && style.underline) {
    ctx.fillStyle = resolveEffectGlyphFillStyle(ctx, style, runs, fontSize, align, baseline);
    for (const run of runs) {
      if (!run.text.trim()) continue;
      let startX = run.drawX;
      if (align === "center") startX -= run.measuredWidth / 2;
      else if (align === "right") startX -= run.measuredWidth;
      const underlineY =
        run.lineY + lineHeight - Math.max(1, Math.round(fontSize * 0.16));
      ctx.fillRect(startX, underlineY, run.measuredWidth, underlineThickness);
    }
  }

  ctx.restore();
};

export const canBatchHorizontalLines = (
  layout: RenderTextLayout,
  style: RenderTextStyle,
): boolean => {
  const regionEffectId = getNativeTextEffectPreset(style.textEffectPreset).id;
  if (regionEffectId === "none") return false;
  for (const placement of layout.placements) {
    const segments = placement.segments;
    if (!segments || segments.length === 0) continue;
    for (const seg of segments) {
      if (seg.style.textEffectPreset !== style.textEffectPreset) return false;
      if (seg.style.textEffectIntensity !== style.textEffectIntensity) return false;
      if (seg.style.color !== style.color) return false;
      if (seg.style.fillCssValue !== style.fillCssValue) return false;
      if (seg.style.outlineColor !== style.outlineColor) return false;
      if (seg.style.outlineWidth !== style.outlineWidth) return false;
      if (seg.style.bold !== style.bold) return false;
      if (seg.style.italic !== style.italic) return false;
      if (seg.style.fontSize !== style.fontSize) return false;
      if (seg.style.fontFamily !== style.fontFamily) return false;
    }
  }
  return true;
};
