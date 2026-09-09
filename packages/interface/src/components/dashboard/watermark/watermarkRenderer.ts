import {
  suggestSmartPlacement,
} from './watermark-core.js';
import type {
  WatermarkAnchor,
  WatermarkDraft,
  WatermarkImageFilters,
  WatermarkRenderAsset,
  WatermarkRenderResult,
  WatermarkSmartSuggestion,
  WatermarkTextAvoidanceZone,
} from './watermarkTypes';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const createCanvas = (width: number, height: number): AnyCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const getCanvasContext = (canvas: AnyCanvas): AnyCanvasContext => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get a 2D context for the watermark renderer.');
  }
  return ctx;
};

const canvasToBlob = async (canvas: AnyCanvas, type: string, quality: number): Promise<Blob> => {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to convert the canvas into a file.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
};

const getRotatedDims = (width: number, height: number, rotation: number): { width: number; height: number } => {
  const normalized = ((rotation % 360) + 360) % 360;
  const isSideways = normalized === 90 || normalized === 270;
  return {
    width: isSideways ? height : width,
    height: isSideways ? width : height,
  };
};

const drawRotated = (
  ctx: AnyCanvasContext,
  image: CanvasImageSource,
  width: number,
  height: number,
  rotation: number,
) => {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (rotation === 90 || rotation === 270 || rotation === -90) {
    ctx.drawImage(image, -height / 2, -width / 2, height, width);
  } else {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  }
  ctx.restore();
};

const applyConvolution = (ctx: AnyCanvasContext, width: number, height: number, kernel: number[]) => {
  const source = ctx.getImageData(0, 0, width, height);
  const result = ctx.createImageData(width, height);
  const side = Math.round(Math.sqrt(kernel.length));
  const halfSide = Math.floor(side / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let cy = 0; cy < side; cy += 1) {
        for (let cx = 0; cx < side; cx += 1) {
          const sampleY = y + cy - halfSide;
          const sampleX = x + cx - halfSide;
          if (sampleY < 0 || sampleY >= height || sampleX < 0 || sampleX >= width) {
            continue;
          }
          const sampleOffset = ((sampleY * width) + sampleX) * 4;
          const weight = kernel[(cy * side) + cx] ?? 0;
          red += (source.data[sampleOffset] ?? 0) * weight;
          green += (source.data[sampleOffset + 1] ?? 0) * weight;
          blue += (source.data[sampleOffset + 2] ?? 0) * weight;
        }
      }
      const outputOffset = ((y * width) + x) * 4;
      result.data[outputOffset] = clamp(red, 0, 255);
      result.data[outputOffset + 1] = clamp(green, 0, 255);
      result.data[outputOffset + 2] = clamp(blue, 0, 255);
      result.data[outputOffset + 3] = source.data[outputOffset + 3] ?? 255;
    }
  }
  ctx.putImageData(result, 0, 0);
};

const applyImageFilters = (
  ctx: AnyCanvasContext,
  width: number,
  height: number,
  filters: WatermarkImageFilters,
) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const levelsLut = new Uint8Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = (index - filters.levels.black) / (filters.levels.white - filters.levels.black);
    value = Math.pow(Math.max(0, Math.min(1, value)), 1 / filters.levels.gamma);
    levelsLut[index] = clamp(value * 255, 0, 255);
  }
  const contrastFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast));

  for (let offset = 0; offset < data.length; offset += 4) {
    let red = levelsLut[data[offset] ?? 0] ?? 0;
    let green = levelsLut[data[offset + 1] ?? 0] ?? 0;
    let blue = levelsLut[data[offset + 2] ?? 0] ?? 0;
    red = clamp((contrastFactor * (red - 128)) + 128 + filters.brightness, 0, 255);
    green = clamp((contrastFactor * (green - 128)) + 128 + filters.brightness, 0, 255);
    blue = clamp((contrastFactor * (blue - 128)) + 128 + filters.brightness, 0, 255);
    const gray = (0.2989 * red) + (0.587 * green) + (0.114 * blue);
    if (filters.grayscale) {
      red = gray;
      green = gray;
      blue = gray;
    } else if (filters.saturation !== 0) {
      const saturationMultiplier = 1 + (filters.saturation / 100);
      red = clamp(gray + (saturationMultiplier * (red - gray)), 0, 255);
      green = clamp(gray + (saturationMultiplier * (green - gray)), 0, 255);
      blue = clamp(gray + (saturationMultiplier * (blue - gray)), 0, 255);
    }
    if (filters.inverted) {
      red = 255 - red;
      green = 255 - green;
      blue = 255 - blue;
    }
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
  }

  ctx.putImageData(imageData, 0, 0);
  if (filters.sharpen > 0) {
    const sharpen = filters.sharpen / 10;
    applyConvolution(ctx, width, height, [
      0, -sharpen, 0,
      -sharpen, 1 + (4 * sharpen), -sharpen,
      0, -sharpen, 0,
    ]);
  }
};

const createMeasurementContext = (): AnyCanvasContext => getCanvasContext(createCanvas(32, 32));

const resolveAnchorPoint = (
  anchor: WatermarkAnchor,
  canvasWidth: number,
  canvasHeight: number,
  layerWidth: number,
  layerHeight: number,
  padding: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } => {
  const xMap: Record<'left' | 'center' | 'right', number> = {
    left: padding + (layerWidth / 2),
    center: canvasWidth / 2,
    right: canvasWidth - padding - (layerWidth / 2),
  };
  const yMap: Record<'top' | 'center' | 'bottom', number> = {
    top: padding + (layerHeight / 2),
    center: canvasHeight / 2,
    bottom: canvasHeight - padding - (layerHeight / 2),
  };

  if (anchor === 'center') {
    return { x: (canvasWidth / 2) + offsetX, y: (canvasHeight / 2) + offsetY };
  }

  const [vertical, horizontal] = anchor.split('-') as ['top' | 'center' | 'bottom', 'left' | 'center' | 'right'];

  if (anchor === 'top-center' || anchor === 'bottom-center') {
    return { x: xMap.center + offsetX, y: yMap[vertical] + offsetY };
  }

  if (anchor === 'center-left' || anchor === 'center-right') {
    return { x: xMap[horizontal] + offsetX, y: yMap.center + offsetY };
  }

  return { x: xMap[horizontal] + offsetX, y: yMap[vertical] + offsetY };
};

const filterAvoidanceZones = (
  points: Array<{ x: number; y: number }>,
  zones: WatermarkTextAvoidanceZone[],
  layerWidth: number,
  layerHeight: number,
  marginFactor = 0.3,
): Array<{ x: number; y: number }> => {
  if (!zones.length) return points;
  const halfW = (layerWidth / 2) * (1 + marginFactor);
  const halfH = (layerHeight / 2) * (1 + marginFactor);
  return points.filter((point) => {
    const pLeft = point.x - halfW;
    const pRight = point.x + halfW;
    const pTop = point.y - halfH;
    const pBottom = point.y + halfH;
    for (const zone of zones) {
      const [zx1, zy1, zx2, zy2] = zone.bbox;
      if (pRight > zx1 && pLeft < zx2 && pBottom > zy1 && pTop < zy2) {
        return false;
      }
    }
    return true;
  });
};

const buildRepeatedPoints = (
  settings: WatermarkDraft,
  canvasWidth: number,
  canvasHeight: number,
  layerWidth: number,
  layerHeight: number,
  resolvedAnchor: WatermarkAnchor,
): Array<{ x: number; y: number }> => {
  if (settings.placementMode === 'single' || settings.placementMode === 'smart') {
    return [resolveAnchorPoint(
      resolvedAnchor,
      canvasWidth,
      canvasHeight,
      layerWidth,
      layerHeight,
      settings.padding,
      settings.offsetX,
      settings.offsetY,
    )];
  }

  if (settings.placementMode === 'multi') {
    const anchors = settings.multiAnchors?.length ? settings.multiAnchors : [resolvedAnchor];
    return anchors.map((anchor) =>
      resolveAnchorPoint(anchor, canvasWidth, canvasHeight, layerWidth, layerHeight, settings.padding, settings.offsetX, settings.offsetY),
    );
  }

  const points: Array<{ x: number; y: number }> = [];
  const gapX = Math.max(layerWidth + 30, settings.gapX);
  const gapY = Math.max(layerHeight + 24, settings.gapY);
  const density = clamp(settings.density, 2, 8);
  const xCount = settings.placementMode === 'grid'
    ? density
    : Math.max(2, Math.ceil(canvasWidth / gapX) + 1);
  const yCount = settings.placementMode === 'grid'
    ? density
    : Math.max(2, Math.ceil(canvasHeight / gapY) + 1);
  const startX = settings.placementMode === 'grid'
    ? ((canvasWidth - ((xCount - 1) * gapX)) / 2)
    : (layerWidth / 2);
  const startY = settings.placementMode === 'grid'
    ? ((canvasHeight - ((yCount - 1) * gapY)) / 2)
    : (layerHeight / 2);

  for (let row = 0; row < yCount; row += 1) {
    for (let column = 0; column < xCount; column += 1) {
      const stagger = settings.placementMode === 'tile' && row % 2 === 1 ? gapX / 2 : 0;
      points.push({
        x: startX + (column * gapX) + stagger + settings.offsetX,
        y: startY + (row * gapY) + settings.offsetY,
      });
    }
  }

  return points.filter((point) => (
    point.x > -(layerWidth / 2)
    && point.x < canvasWidth + (layerWidth / 2)
    && point.y > -(layerHeight / 2)
    && point.y < canvasHeight + (layerHeight / 2)
  ));
};

const resolveSmartSuggestion = async (
  sourceBitmap: ImageBitmap,
): Promise<WatermarkSmartSuggestion> => {
  const analysisWidth = Math.max(32, Math.min(160, sourceBitmap.width));
  const analysisHeight = Math.max(32, Math.round((analysisWidth / sourceBitmap.width) * sourceBitmap.height));
  const canvas = createCanvas(analysisWidth, analysisHeight);
  const ctx = getCanvasContext(canvas);
  ctx.drawImage(sourceBitmap, 0, 0, analysisWidth, analysisHeight);
  const pixels = ctx.getImageData(0, 0, analysisWidth, analysisHeight).data;
  const suggestion = suggestSmartPlacement({ width: analysisWidth, height: analysisHeight, pixels });
  return {
    anchor: suggestion.position as WatermarkAnchor,
    textColor: suggestion.textColor,
    reason: suggestion.reason,
  };
};

const drawTextLayer = (
  ctx: AnyCanvasContext,
  settings: WatermarkDraft,
  points: Array<{ x: number; y: number }>,
) => {
  const { textLayer } = settings;
  if (!textLayer.enabled || !textLayer.text.trim()) return;

  const measureCtx = createMeasurementContext();
  measureCtx.font = `700 ${textLayer.fontSize}px ${textLayer.fontFamily}`;
  const metrics = measureCtx.measureText(textLayer.text);
  const width = Math.max(metrics.width, textLayer.fontSize * 3);
  const height = textLayer.fontSize * 1.6;

  ctx.save();
  ctx.globalCompositeOperation = settings.blendMode;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${textLayer.fontSize}px ${textLayer.fontFamily}`;

  for (const point of points) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.globalAlpha = clamp(textLayer.opacity, 0.05, 1);
    ctx.shadowBlur = textLayer.shadowBlur;
    ctx.shadowOffsetX = textLayer.shadowOffsetX;
    ctx.shadowOffsetY = textLayer.shadowOffsetY;
    ctx.shadowColor = textLayer.shadowColor;

    if (textLayer.outlineWidth > 0) {
      ctx.lineWidth = textLayer.outlineWidth;
      ctx.strokeStyle = textLayer.outlineColor;
      ctx.strokeText(textLayer.text, 0, 0);
    }
    ctx.fillStyle = textLayer.color;
    ctx.fillText(textLayer.text, 0, 0);
    ctx.restore();
  }
  void width;
  void height;
  ctx.restore();
};

const drawImageLayer = async (
  ctx: AnyCanvasContext,
  watermarkBitmap: ImageBitmap | null,
  settings: WatermarkDraft,
  points: Array<{ x: number; y: number }>,
  canvasShortSide: number,
) => {
  if (!settings.imageLayer.enabled || !watermarkBitmap) return;

  const targetWidth = Math.max(32, (canvasShortSide * settings.imageLayer.scalePercent) / 100);
  const ratio = watermarkBitmap.width / Math.max(1, watermarkBitmap.height);
  const targetHeight = targetWidth / Math.max(ratio, 0.001);

  ctx.save();
  ctx.globalCompositeOperation = settings.blendMode;
  ctx.filter = [
    `brightness(${settings.imageLayer.brightness}%)`,
    `contrast(${settings.imageLayer.contrast}%)`,
    `saturate(${settings.imageLayer.saturation}%)`,
    `blur(${settings.imageLayer.blur}px)`,
  ].join(' ');

  for (const point of points) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.globalAlpha = clamp(settings.imageLayer.opacity, 0.05, 1);
    ctx.drawImage(watermarkBitmap, -(targetWidth / 2), -(targetHeight / 2), targetWidth, targetHeight);
    ctx.restore();
  }

  ctx.restore();
  ctx.filter = 'none';
};

const drawShadowLayer = (
  ctx: AnyCanvasContext,
  settings: WatermarkDraft,
  points: Array<{ x: number; y: number }>,
  layerWidth: number,
  layerHeight: number,
) => {
  if (!settings.shadowLayer?.enabled) return;
  const { shadowLayer } = settings;
  ctx.save();
  ctx.globalAlpha = clamp(shadowLayer.opacity, 0.05, 1);
  ctx.fillStyle = shadowLayer.color;
  ctx.shadowBlur = shadowLayer.blur;
  ctx.shadowColor = shadowLayer.color;
  ctx.shadowOffsetX = shadowLayer.offsetX;
  ctx.shadowOffsetY = shadowLayer.offsetY;
  for (const point of points) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.beginPath();
    const r = Math.min(layerWidth, layerHeight) * 0.12;
    const hw = layerWidth / 2;
    const hh = layerHeight / 2;
    ctx.moveTo(-hw + r, -hh);
    ctx.lineTo(hw - r, -hh);
    ctx.quadraticCurveTo(hw, -hh, hw, -hh + r);
    ctx.lineTo(hw, hh - r);
    ctx.quadraticCurveTo(hw, hh, hw - r, hh);
    ctx.lineTo(-hw + r, hh);
    ctx.quadraticCurveTo(-hw, hh, -hw, hh - r);
    ctx.lineTo(-hw, -hh + r);
    ctx.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

const buildLayerSize = (
  settings: WatermarkDraft,
  watermarkBitmap: ImageBitmap | null,
): { width: number; height: number } => {
  const textWidth = settings.textLayer.enabled && settings.textLayer.text.trim()
    ? Math.max(settings.textLayer.fontSize * 2.8, settings.textLayer.text.length * settings.textLayer.fontSize * 0.56)
    : 0;
  const textHeight = settings.textLayer.enabled ? settings.textLayer.fontSize * 1.6 : 0;
  const imageWidth = settings.imageLayer.enabled && watermarkBitmap
    ? Math.max(48, watermarkBitmap.width * (settings.imageLayer.scalePercent / 100))
    : 0;
  const imageHeight = settings.imageLayer.enabled && watermarkBitmap
    ? Math.max(48, watermarkBitmap.height * (settings.imageLayer.scalePercent / 100))
    : 0;
  return {
    width: Math.max(textWidth, imageWidth, 48),
    height: Math.max(textHeight, imageHeight, 48),
  };
};

export const renderWatermarkAsset = async (
  asset: WatermarkRenderAsset,
): Promise<WatermarkRenderResult> => {
  const sourceBitmap = await createImageBitmap(asset.sourceFile);
  const watermarkBitmap = asset.watermarkFile ? await createImageBitmap(asset.watermarkFile) : null;
  const rotated = getRotatedDims(asset.image.width, asset.image.height, asset.image.rotation);
  const canvas = createCanvas(rotated.width, rotated.height);
  const ctx = getCanvasContext(canvas);
  drawRotated(ctx, sourceBitmap, asset.image.width, asset.image.height, asset.image.rotation);
  applyImageFilters(ctx, rotated.width, rotated.height, asset.image.filters);

  let resolvedAnchor = asset.settings.anchor;
  let nextSettings = asset.settings;
  if (asset.settings.placementMode === 'smart') {
    const suggestion = await resolveSmartSuggestion(sourceBitmap);
    resolvedAnchor = suggestion.anchor;
    nextSettings = {
      ...asset.settings,
      anchor: suggestion.anchor,
      textLayer: {
        ...asset.settings.textLayer,
        color: asset.settings.textLayer.enabled ? suggestion.textColor : asset.settings.textLayer.color,
      },
    };
  }

  const layerSize = buildLayerSize(nextSettings, watermarkBitmap);
  let points = buildRepeatedPoints(
    nextSettings,
    rotated.width,
    rotated.height,
    layerSize.width,
    layerSize.height,
    resolvedAnchor,
  );

  // Apply text avoidance filtering
  if (nextSettings.avoidTextRegions && asset.textAvoidanceZones?.length) {
    points = filterAvoidanceZones(points, asset.textAvoidanceZones, layerSize.width, layerSize.height);
  }

  drawShadowLayer(ctx, nextSettings, points, layerSize.width, layerSize.height);
  await drawImageLayer(ctx, watermarkBitmap, nextSettings, points, Math.min(rotated.width, rotated.height));
  drawTextLayer(ctx, nextSettings, points);

  const blob = await canvasToBlob(canvas, asset.outputType, asset.outputQuality);
  sourceBitmap.close();
  watermarkBitmap?.close();

  return {
    blob,
    width: rotated.width,
    height: rotated.height,
    resolvedAnchor,
  };
};
