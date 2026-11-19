import type { AioTextRegion } from '../../../types/dashboard.types';
import type { RenderTextStyleRange } from '../../../typography/renderStyle';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  areRenderTextFontsReady,
  clamp,
  cloneRenderStyle,
  ensureCanvasFontLoaded,
  type CanvasFontSet,
} from '../../../utils/dashboard.utils';
import { applyRenderDefaultsToRegion, resolveRegionRenderShape } from '../../../utils/dashboard.region.utils';
import { applyDetectedGradientToStyle } from '../../../utils/dashboard.rendering.utils';
import type { RegionTextMeasure } from '../../../utils/region-review';
import type { TypographyShape } from '../../../typography/types';
import {
  computeRenderTextLayout,
  drawRenderedTextInRegion,
} from '../../../utils/renderText';
import {
  RenderTextLayoutError,
  wrapAndMeasureStyled,
} from '../../../utils/renderText.measure';
import { resolveGlyphStyle } from '../../../utils/renderText.core';
import { clearGlyphMetricsCache } from '../../../utils/renderText.metrics-cache';
import { styleValuesEqual } from '../../../utils/renderTextStyleRanges';

export const drawManualStroke = (
  canvas: HTMLCanvasElement | null,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  options: {
    size: number;
    color: string;
    erase: boolean;
    opacity: number;
    blur: number;
  },
) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, options.size);
  ctx.globalAlpha = clamp(options.opacity, 0.01, 1);
  ctx.filter =
    options.blur > 0
      ? `blur(${Math.max(0, options.blur).toFixed(1)}px)`
      : 'none';
  if (options.erase) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = options.color;
    ctx.fillStyle = options.color;
  }
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(toX, toY, Math.max(0.5, options.size / 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export interface WandMaskFrames {
  selected: Uint8Array;
  frameA: ImageData;
  frameB: ImageData;
}

/**
 * Computes the marching-ants selection mask + two animation frames for the
 * magic-wand overlay. Returns null when a 2D context cannot be allocated.
 */
export const computeWandMaskFrames = (
  overlayCanvas: HTMLCanvasElement,
  overlayCtx: CanvasRenderingContext2D,
  maskImage: HTMLImageElement,
): WandMaskFrames | null => {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = overlayCanvas.width;
  maskCanvas.height = overlayCanvas.height;
  const maskCtx = maskCanvas.getContext('2d', {
    willReadFrequently: true,
  });
  if (!maskCtx) return null;
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);

  const maskImageData = maskCtx.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height,
  );
  // Free GPU texture memory immediately after extracting pixel data.
  maskCanvas.width = 0;
  maskCanvas.height = 0;

  const { width, height, data } = maskImageData;
  const totalPixels = width * height;
  const selected = new Uint8Array(totalPixels);
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * 4;
    const alpha = data[offset + 3] ?? 0;
    const rgbSum =
      (data[offset] ?? 0) +
      (data[offset + 1] ?? 0) +
      (data[offset + 2] ?? 0);
    if (alpha > 18 || rgbSum > 18) {
      selected[pixel] = 1;
    }
  }

  const border = new Uint8Array(totalPixels);
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    if (selected[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1 ||
      selected[pixel - 1] === 0 ||
      selected[pixel + 1] === 0 ||
      selected[pixel - width] === 0 ||
      selected[pixel + width] === 0
    ) {
      border[pixel] = 1;
    }
  }

  const thickBorder = new Uint8Array(totalPixels);
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    if (selected[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (border[pixel] === 1) {
      thickBorder[pixel] = 1;
      continue;
    }
    if (
      (x > 0 && border[pixel - 1] === 1) ||
      (x < width - 1 && border[pixel + 1] === 1) ||
      (y > 0 && border[pixel - width] === 1) ||
      (y < height - 1 && border[pixel + width] === 1)
    ) {
      thickBorder[pixel] = 1;
    }
  }

  const buildFrame = (phase: number): ImageData => {
    const frame = overlayCtx.createImageData(width, height);
    const frameData = frame.data;
    for (let pixel = 0; pixel < totalPixels; pixel += 1) {
      if (selected[pixel] === 0) continue;
      const offset = pixel * 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);

      if (thickBorder[pixel] === 1) {
        const dashOn = (x + y + phase) % 12 < 6;
        const dashColor = dashOn ? 255 : 12;
        frameData[offset] = dashColor;
        frameData[offset + 1] = dashColor;
        frameData[offset + 2] = dashColor;
        frameData[offset + 3] = 255;
        continue;
      }

      const stripe = (x + y * 2 + phase * 2) % 20 < 10;
      frameData[offset] = stripe ? 18 : 8;
      frameData[offset + 1] = stripe ? 176 : 146;
      frameData[offset + 2] = stripe ? 255 : 248;
      frameData[offset + 3] = stripe ? 150 : 124;
    }
    return frame;
  };

  return {
    selected,
    frameA: buildFrame(0),
    frameB: buildFrame(6),
  };
};

/**
 * Materializes one ants frame as an offscreen canvas (GPU texture) so the
 * animation can swap frames with drawImage (GPU copy) instead of
 * putImageData (CPU pixel upload of a full-res buffer every tick).
 */
export const createWandFrameCanvas = (
  frame: ImageData,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  canvas.getContext('2d')?.putImageData(frame, 0, 0);
  return canvas;
};

/**
 * Store style objects (and the caller's fallback style) are immutable, so the
 * resolved clone is cached per source object: per-frame redraws skip the
 * spread for every region whose style did not change. The draw path only
 * reads the style, so sharing the clone across regions and frames is safe.
 */
const renderStyleCloneCache = new WeakMap<object, RenderTextStyle>();
const cloneRenderStyleCached = (style: RenderTextStyle): RenderTextStyle => {
  const cached = renderStyleCloneCache.get(style);
  if (cached) return cached;
  const cloned = cloneRenderStyle(style);
  renderStyleCloneCache.set(style, cloned);
  return cloned;
};

/** Preloads the fonts referenced by every region style before painting. */
const preloadRegionCanvasFonts = (
  regions: readonly AioTextRegion[],
  fallbackStyle: RenderTextStyle,
  fontSet?: CanvasFontSet,
): Promise<boolean> =>
  Promise.all(
    regions.map(async (region) => {
      const style = cloneRenderStyleCached(region.renderStyle ?? fallbackStyle);
      return ensureCanvasFontLoaded(style, region.renderTextStyleRanges, fontSet);
    }),
  ).then((fontsLoaded) => fontsLoaded.some(Boolean));

/** Paints the rendered text of every region onto the preview canvas. */
type RegionCanvasLayout = ReturnType<typeof computeRenderTextLayout>;
type CachedRegionLayout = {
  signature: string;
  layout: RegionCanvasLayout;
  shape: TypographyShape | undefined;
  baseStyle: RenderTextStyle;
};

const assignChangedStyleField = <K extends keyof RenderTextStyle>(
  patch: Partial<RenderTextStyle>,
  base: RenderTextStyle,
  frozen: RenderTextStyle,
  key: K,
): void => {
  if (!styleValuesEqual(base[key], frozen[key])) {
    patch[key] = frozen[key];
  }
};

const refreshPlacementStyles = (
  entry: CachedRegionLayout,
  style: RenderTextStyle,
): CachedRegionLayout => {
  const base = entry.baseStyle;
  for (const placement of entry.layout.placements) {
    const segments = placement.segments;
    if (!segments) continue;
    for (const segment of segments) {
      const frozen = segment.style;
      const patch: Partial<RenderTextStyle> = {};
      for (const key of Object.keys(frozen) as (keyof RenderTextStyle)[]) {
        assignChangedStyleField(patch, base, frozen, key);
      }
      segment.style = resolveGlyphStyle(style, frozen.fontSize, patch);
    }
  }
  return {
    signature: entry.signature,
    layout: entry.layout,
    shape: entry.shape,
    baseStyle: cloneRenderStyle(style),
  };
};

export interface RegionTextLayoutResult {
  readonly layout: RegionCanvasLayout;
  readonly shape: TypographyShape | undefined;
}

/**
 * Keys whose value changes glyph metrics. Color, fill, outline, shadow and the
 * text effect change how the text looks but not how it wraps, so re-measuring
 * on those made a style click pay for a full layout search.
 */
const LAYOUT_METRIC_KEYS = [
  "fontFamily",
  "fontSize",
  "minFontSize",
  "autoFontSize",
  "lineSpacing",
  "textOrientation",
  "textPathMode",
  "circularRadiusScale",
  "circularStartAngle",
  "circularLetterSpacing",
  "alignment",
  "hyphenationEnabled",
  "hyphenationLanguage",
  "bold",
  "italic",
  "uppercase",
] as const satisfies readonly (keyof RenderTextStyle)[];

// The resolved shape derives from region.shape (refined) or from
// detectedRenderMode + bbox (auto); both inputs must key the cache so a shape
// change invalidates layouts measured for the previous geometry.
// Region objects are immutable store instances (drag builds a spread clone),
// so the serialized shape is memoized per region identity and drag redraws
// skip the JSON.stringify for every region that did not move.
const shapeSignatureCache = new WeakMap<object, string>();
const buildShapeSignature = (region: AioTextRegion): string => {
  const cached = shapeSignatureCache.get(region);
  if (cached !== undefined) return cached;
  const signature = `${region.detectedRenderMode ?? ""}|${JSON.stringify(region.shape ?? null)}`;
  shapeSignatureCache.set(region, signature);
  return signature;
};

const buildLayoutSignature = (
  regionId: string,
  text: string,
  width: number,
  height: number,
  style: RenderTextStyle,
  renderStageActive: boolean,
  ranges: readonly RenderTextStyleRange[] | null | undefined,
  shapeSignature: string,
): string => {
  const metrics = LAYOUT_METRIC_KEYS.map(
    (key) => `${key}:${String(style[key])}`,
  ).join("|");
  const rangeKey =
    ranges
      ?.map((range) => `${range.start}:${range.end}:${JSON.stringify(range.style)}`)
      .join(";") ?? "";
  const fontsReady = areRenderTextFontsReady(style, ranges);
  return `${regionId}|${renderStageActive ? 1 : 0}|${width}x${height}|${text}|${metrics}|${rangeKey}|${shapeSignature}|${fontsReady ? 1 : 0}`;
};

let regionLayoutCache = new Map<string, CachedRegionLayout>();
const REGION_LAYOUT_CACHE_LIMIT = 64;

/**
 * Discards cached region layouts: entries measured before a font finished
 * loading hold fallback-font metrics, which no longer match what the loaded
 * font produces.
 */
export const clearRegionLayoutCache = (): void => {
  regionLayoutCache = new Map();
  clearGlyphMetricsCache();
};

const rememberRegionLayout = (
  regionId: string,
  entry: CachedRegionLayout,
): void => {
  // Re-insert on every write so the map order doubles as LRU order.
  regionLayoutCache.delete(regionId);
  regionLayoutCache.set(regionId, entry);
  if (regionLayoutCache.size > REGION_LAYOUT_CACHE_LIMIT) {
    const oldest = regionLayoutCache.keys().next().value;
    if (oldest !== undefined) regionLayoutCache.delete(oldest);
  }
};

export interface RegionTextLayoutRequest {
  readonly region: AioTextRegion;
  /** Raw region text; measured as the renderer paints it (trimmed). */
  readonly text: string;
  readonly style: RenderTextStyle;
  readonly styleRanges: readonly RenderTextStyleRange[] | null | undefined;
  readonly renderStageActive: boolean;
}

/**
 * Single source of truth for a region's text layout. The canvas painter and
 * the inline editor must consume the same (cached) layout, otherwise the
 * editor's selection line boxes drift away from the painted glyphs.
 */
export const resolveRegionTextLayout = (
  ctx: CanvasRenderingContext2D,
  {
    region,
    text: rawText,
    style,
    styleRanges,
    renderStageActive,
  }: RegionTextLayoutRequest,
): RegionTextLayoutResult => {
  const [x1, y1, x2, y2] = region.bbox;
  const width = Math.max(1, x2 - x1);
  const height = Math.max(1, y2 - y1);
  const text = renderStageActive ? rawText.trim() : "";
  if (!text) throw new RenderTextLayoutError();
  const signature = buildLayoutSignature(
    region.id,
    text,
    width,
    height,
    style,
    renderStageActive,
    styleRanges,
    buildShapeSignature(region),
  );
  const cached = regionLayoutCache.get(region.id);
  if (cached && cached.signature === signature) {
    if (!styleValuesEqual(cached.baseStyle, style)) {
      const refreshed = refreshPlacementStyles(cached, style);
      rememberRegionLayout(region.id, refreshed);
      return refreshed;
    }
    rememberRegionLayout(region.id, cached);
    return cached;
  }

  const shape = resolveRegionRenderShape(region);
  let layout: RegionCanvasLayout;
  try {
    layout = computeRenderTextLayout(
      ctx,
      text,
      width,
      height,
      style,
      shape,
      styleRanges ?? [],
    );
  } catch {
    const fallback = wrapAndMeasureStyled(
      ctx,
      text,
      width,
      height,
      style,
      style.autoFontSize === false ? style.fontSize : style.minFontSize,
      shape,
      styleRanges ?? [],
      false,
    );
    if (!fallback) throw new RenderTextLayoutError();
    layout = fallback;
  }
  const entry: CachedRegionLayout = {
    signature,
    layout,
    shape,
    baseStyle: cloneRenderStyle(style),
  };
  rememberRegionLayout(region.id, entry);
  return entry;
};

// Measurement-only canvas for the overflow reviewer (same pattern as the
// inline editor's scratch context in useRenderTextPreviewSelection): layout
// measurement ignores copy transforms and canvas dimensions, and
// resolveRegionTextLayout saves/restores the context around every measure.
let overflowMeasureCanvas: HTMLCanvasElement | null = null;
let overflowMeasureContext: CanvasRenderingContext2D | null = null;
// Warn-once flag: the null-measure degradation is the correct contract, but
// the capability loss (2D context unallocatable) must be diagnosable.
let overflowMeasureContextWarned = false;
const getOverflowMeasureContext = (): CanvasRenderingContext2D | null => {
  if (typeof document === 'undefined') return null;
  if (!overflowMeasureCanvas) {
    overflowMeasureCanvas = document.createElement('canvas');
    overflowMeasureContext = overflowMeasureCanvas.getContext('2d');
    if (!overflowMeasureContext && !overflowMeasureContextWarned) {
      overflowMeasureContextWarned = true;
      console.warn(
        'region overflow reviewer: no 2D canvas context available — overflow measurement is disabled (every region reads as non-overflowing)',
      );
    }
  }
  return overflowMeasureContext;
};

/**
 * Measurement bridge for the overflow reviewer: resolves exactly what the
 * preview painter would lay out for the region (render defaults filled,
 * render text built) through `resolveRegionTextLayout` — the single source
 * of truth — so overflow flags always describe the real painted text box.
 * Layouts are LRU-cached by text+style signature, so repeated derivation
 * hits the shared cache instead of re-measuring. Returns a measure that
 * always yields null when no 2D context can be allocated (nothing can be
 * painted, so nothing can overflow).
 */
export const createRegionTextMeasurer = (
  fallbackStyle: RenderTextStyle,
): RegionTextMeasure => {
  const ctx = getOverflowMeasureContext();
  if (!ctx) return () => null;
  return (region, fontSizeOverride) => {
    const effectiveRegion = applyRenderDefaultsToRegion(
      region,
      fallbackStyle,
      applyDetectedGradientToStyle,
    );
    const text = (effectiveRegion.renderText ?? "").trim();
    if (!text) return null;
    const baseStyle = effectiveRegion.renderStyle ?? fallbackStyle;
    const style =
      fontSizeOverride === undefined
        ? baseStyle
        : { ...baseStyle, fontSize: fontSizeOverride };
    try {
      const { layout } = resolveRegionTextLayout(ctx, {
        region: effectiveRegion,
        text,
        style,
        styleRanges: effectiveRegion.renderTextStyleRanges,
        renderStageActive: true,
      });
      return {
        textWidth: layout.textWidth,
        textHeight: layout.textHeight,
        fontSize: layout.fontSize,
      };
    } catch (error) {
      if (error instanceof RenderTextLayoutError) return null;
      throw error;
    }
  };
};

export interface ViewportBand {
  readonly top: number;
  readonly bottom: number;
}

export interface CullableRegion {
  readonly id: string;
  readonly bbox: readonly [number, number, number, number];
}

export const visibleRegionIds = (
  regions: readonly CullableRegion[],
  band: ViewportBand | null,
): Set<string> => {
  const ids = new Set<string>();
  if (!band) {
    for (const region of regions) ids.add(region.id);
    return ids;
  }
  for (const region of regions) {
    const [_x1, y1, _x2, y2] = region.bbox;
    if (y2 < band.top || y1 > band.bottom) continue;
    ids.add(region.id);
  }
  return ids;
};

export const drawRegionsToCanvas = (
  ctx: CanvasRenderingContext2D,
  imageWidth: number,
  imageHeight: number,
  regions: readonly AioTextRegion[],
  fallbackStyle: RenderTextStyle,
  renderStageActive: boolean,
  skipRegionId?: string | null,
  visibleIds?: ReadonlySet<string>,
): void => {
  const canvas = ctx.canvas;
  // Reassigning width/height reallocates the backing store — during a drag
  // redraw this runs per animation frame, so only touch it when the size
  // actually changes (clearRect already wipes the content).
  if (canvas.width !== imageWidth) canvas.width = imageWidth;
  if (canvas.height !== imageHeight) canvas.height = imageHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const region of regions) {
    if (skipRegionId && region.id === skipRegionId) continue;
    if (visibleIds && !visibleIds.has(region.id)) continue;
    const text = renderStageActive ? (region.renderText ?? "") : "";
    if (!text.trim()) continue;
    const style = cloneRenderStyleCached(region.renderStyle ?? fallbackStyle);
    const { layout, shape } = resolveRegionTextLayout(ctx, {
      region,
      text,
      style,
      styleRanges: region.renderTextStyleRanges,
      renderStageActive,
    });
    drawRenderedTextInRegion(ctx, region.bbox, layout, style, shape);
  }
};

export interface RegionCanvasRenderRequest {
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly regions: readonly AioTextRegion[];
  readonly fallbackStyle: RenderTextStyle;
  readonly renderStageActive: boolean;
  readonly skipRegionId?: string | null;
  readonly isCancelled?: () => boolean;
  readonly fontSet?: CanvasFontSet;
  readonly viewportBand?: ViewportBand | null;
}

/**
 * Full paint step: preload fonts, discard layouts that were measured with
 * fallback-font metrics when a font just became available, then paint.
 * Owning the invalidation here keeps every caller on the same protocol
 * instead of re-implementing (and eventually forgetting) the cache reset.
 */
export const renderRegionsToCanvas = async (
  ctx: CanvasRenderingContext2D,
  {
    imageWidth,
    imageHeight,
    regions,
    fallbackStyle,
    renderStageActive,
    skipRegionId,
    isCancelled,
    fontSet,
    viewportBand,
  }: RegionCanvasRenderRequest,
): Promise<void> => {
  const visibleIds = visibleRegionIds(regions, viewportBand ?? null);
  const bandRegions = viewportBand
    ? regions.filter((region) => visibleIds.has(region.id))
    : regions;
  const fontsLoaded = await preloadRegionCanvasFonts(bandRegions, fallbackStyle, fontSet);
  if (isCancelled?.()) return;
  if (fontsLoaded) clearRegionLayoutCache();
  drawRegionsToCanvas(
    ctx,
    imageWidth,
    imageHeight,
    regions,
    fallbackStyle,
    renderStageActive,
    skipRegionId,
    viewportBand ? visibleIds : undefined,
  );
};
