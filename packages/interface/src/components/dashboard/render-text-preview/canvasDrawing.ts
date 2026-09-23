// Canvas drawing / pixel-processing helpers for the render text preview.
// Moved verbatim from RenderTextPreview.tsx (T07 split). No React imports.

import type { AioTextRegion } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  clamp,
  cloneRenderStyle,
  ensureCanvasFontLoaded,
} from '../../../utils/dashboard.utils';
import {
  computeRenderTextLayout,
  drawRenderedTextInRegion,
} from '../../../utils/renderText';

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

/** Preloads the fonts referenced by every region style before painting. */
export const preloadRegionCanvasFonts = (
  regions: AioTextRegion[],
  fallbackStyle: RenderTextStyle,
): Promise<void> =>
  Promise.all(
    regions.map(async (region) => {
      const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
      await ensureCanvasFontLoaded(style, region.renderTextStyleRanges);
    }),
  ).then(() => undefined);

/** Paints the rendered text of every region onto the preview canvas. */
type RegionCanvasLayout = ReturnType<typeof computeRenderTextLayout>;
type CachedRegionLayout = { renderStageActive: boolean; layout: RegionCanvasLayout };
let regionLayoutCache = new WeakMap<object, CachedRegionLayout>();
let regionLayoutCacheStyle: RenderTextStyle | null = null;

export const drawRegionsToCanvas = (
  ctx: CanvasRenderingContext2D,
  imageWidth: number,
  imageHeight: number,
  regions: AioTextRegion[],
  fallbackStyle: RenderTextStyle,
  renderStageActive: boolean,
): void => {
  const canvas = ctx.canvas;
  // Reassigning width/height reallocates the backing store — during a drag
  // redraw this runs per animation frame, so only touch it when the size
  // actually changes (clearRect already wipes the content).
  if (canvas.width !== imageWidth) canvas.width = imageWidth;
  if (canvas.height !== imageHeight) canvas.height = imageHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (regionLayoutCacheStyle !== fallbackStyle) {
    regionLayoutCacheStyle = fallbackStyle;
    regionLayoutCache = new WeakMap();
  }

  for (const region of regions) {
    const [x1, y1, x2, y2] = region.bbox;
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, y2 - y1);
    const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
    const text = renderStageActive ? (region.renderText ?? '').trim() : '';
    if (!text.trim()) continue;
    let layout: RegionCanvasLayout;
    const cached = regionLayoutCache.get(region);
    if (cached && cached.renderStageActive === renderStageActive) {
      layout = cached.layout;
    } else {
      layout = computeRenderTextLayout(
        ctx,
        text,
        width,
        height,
        style,
        region.shape,
        region.renderTextStyleRanges,
      );
      regionLayoutCache.set(region, { renderStageActive, layout });
    }
    drawRenderedTextInRegion(ctx, region.bbox, layout, style, region.shape);
  }
};
