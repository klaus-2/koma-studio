type RawOutputFormat = "png" | "jpeg" | "webp";

interface OptimizationWorkerJob {
  id: string;
  sourceBuffer: ArrayBuffer;
  sourceMimeType: string;
  outputFormat: RawOutputFormat;
  quality: number;
  resizeEnabled: boolean;
  maxWidth: number;
  maxHeight: number;
  trimBorders: boolean;
  trimTolerance: number;
  sharpen: boolean;
  sharpenStrength: number;
  grayscale: boolean;
  autoLevels: boolean;
  brightness: number;
  contrast: number;
  noiseReduction: boolean;
  noiseReductionStrength: number;
  rotation: 0 | 90 | 180 | 270;
}

const getMimeType = (format: RawOutputFormat): "image/png" | "image/jpeg" | "image/webp" => {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
};

const readChannel = (
  data: Uint8ClampedArray,
  index: number,
  fallback = 0,
): number => data[index] ?? fallback;

const detectBorderCrop = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  tolerance: number,
): { x: number; y: number; width: number; height: number } => {
  const data = context.getImageData(0, 0, width, height).data;
  const isUniform = (offset: number): boolean => {
    const alpha = readChannel(data, offset + 3, 255);
    const r = readChannel(data, offset);
    const g = readChannel(data, offset + 1);
    const b = readChannel(data, offset + 2);
    if (alpha < 12) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (max <= tolerance && min <= tolerance) || (max >= 255 - tolerance && min >= 255 - tolerance);
  };

  const isUniformRow = (row: number): boolean => {
    for (let x = 0; x < width; x += 1) {
      if (!isUniform((row * width + x) * 4)) return false;
    }
    return true;
  };

  const isUniformColumn = (column: number): boolean => {
    for (let y = 0; y < height; y += 1) {
      if (!isUniform((y * width + column) * 4)) return false;
    }
    return true;
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  while (top < bottom && isUniformRow(top)) top += 1;
  while (bottom > top && isUniformRow(bottom)) bottom -= 1;
  while (left < right && isUniformColumn(left)) left += 1;
  while (right > left && isUniformColumn(right)) right -= 1;

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left + 1),
    height: Math.max(1, bottom - top + 1),
  };
};

/** Apply unsharp-mask sharpening via a 3×3 convolution kernel. */
const applySharpen = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void => {
  const imageData = context.getImageData(0, 0, width, height);
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;
  const s = Math.max(0.1, Math.min(2, strength));
  const center = 1 + 4 * s;
  const edge = -s;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const val =
          readChannel(src, idx + c) * center +
          readChannel(src, ((y - 1) * width + x) * 4 + c) * edge +
          readChannel(src, ((y + 1) * width + x) * 4 + c) * edge +
          readChannel(src, (y * width + (x - 1)) * 4 + c) * edge +
          readChannel(src, (y * width + (x + 1)) * 4 + c) * edge;
        dst[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
  context.putImageData(imageData, 0, 0);
};

/** Convert image data to grayscale using luminance weights. */
const applyGrayscale = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const imageData = context.getImageData(0, 0, width, height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum =
      0.299 * readChannel(d, i) +
      0.587 * readChannel(d, i + 1) +
      0.114 * readChannel(d, i + 2);
    d[i] = lum;
    d[i + 1] = lum;
    d[i + 2] = lum;
  }
  context.putImageData(imageData, 0, 0);
};

/** Adjust brightness: value from -100 to +100. */
const applyBrightness = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  value: number,
): void => {
  if (value === 0) return;
  const imageData = context.getImageData(0, 0, width, height);
  const d = imageData.data;
  const adj = (value / 100) * 255;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, Math.min(255, readChannel(d, i) + adj));
    d[i + 1] = Math.max(0, Math.min(255, readChannel(d, i + 1) + adj));
    d[i + 2] = Math.max(0, Math.min(255, readChannel(d, i + 2) + adj));
  }
  context.putImageData(imageData, 0, 0);
};

/** Adjust contrast: value from -100 to +100. */
const applyContrast = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  value: number,
): void => {
  if (value === 0) return;
  const imageData = context.getImageData(0, 0, width, height);
  const d = imageData.data;
  const factor = (259 * (value + 255)) / (255 * (259 - value));
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, Math.min(255, factor * (readChannel(d, i) - 128) + 128));
    d[i + 1] = Math.max(0, Math.min(255, factor * (readChannel(d, i + 1) - 128) + 128));
    d[i + 2] = Math.max(0, Math.min(255, factor * (readChannel(d, i + 2) - 128) + 128));
  }
  context.putImageData(imageData, 0, 0);
};

/** Simple box-blur noise reduction (3x3 kernel averaged). */
const applyNoiseReduction = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void => {
  const passes = Math.max(1, Math.min(3, Math.round(strength * 3)));
  for (let pass = 0; pass < passes; pass++) {
    const imageData = context.getImageData(0, 0, width, height);
    const src = new Uint8ClampedArray(imageData.data);
    const dst = imageData.data;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += readChannel(src, ((y + dy) * width + (x + dx)) * 4 + c);
            }
          }
          dst[idx + c] = Math.round(sum / 9);
        }
      }
    }
    context.putImageData(imageData, 0, 0);
  }
};

/** Rotate canvas by degrees (90, 180, 270). Returns new dimensions. */
const applyRotation = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  degrees: 0 | 90 | 180 | 270,
): { canvas: OffscreenCanvas; width: number; height: number } => {
  if (degrees === 0) {
    return { canvas: context.canvas as OffscreenCanvas, width, height };
  }
  const swapped = degrees === 90 || degrees === 270;
  const newW = swapped ? height : width;
  const newH = swapped ? width : height;
  const rotCanvas = new OffscreenCanvas(newW, newH);
  const rotCtx = rotCanvas.getContext("2d")!;
  rotCtx.translate(newW / 2, newH / 2);
  rotCtx.rotate((degrees * Math.PI) / 180);
  rotCtx.drawImage(context.canvas as OffscreenCanvas, -width / 2, -height / 2);
  return { canvas: rotCanvas, width: newW, height: newH };
};

/** Stretch histogram so that darkest pixel maps to 0 and brightest to 255. */
const applyAutoLevels = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const imageData = context.getImageData(0, 0, width, height);
  const d = imageData.data;
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const channel = readChannel(d, i + c);
      if (channel < minVal) minVal = channel;
      if (channel > maxVal) maxVal = channel;
    }
  }
  const range = maxVal - minVal;
  if (range < 2) return;
  const scale = 255 / range;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.max(0, Math.min(255, Math.round((readChannel(d, i + c) - minVal) * scale)));
    }
  }
  context.putImageData(imageData, 0, 0);
};

self.onmessage = async (event: MessageEvent<OptimizationWorkerJob>) => {
  const job = event.data;
  try {
    const blob = new Blob([job.sourceBuffer], { type: job.sourceMimeType || "image/png" });
    const bitmap = await createImageBitmap(blob);
    const stage = new OffscreenCanvas(bitmap.width, bitmap.height);
    const stageContext = stage.getContext("2d", { willReadFrequently: true });
    if (!stageContext) {
      throw new Error("Canvas 2D is unavailable in the optimizer.");
    }
    stageContext.drawImage(bitmap, 0, 0);

    const crop = job.trimBorders
      ? detectBorderCrop(stageContext, bitmap.width, bitmap.height, job.trimTolerance)
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };

    let targetWidth = crop.width;
    let targetHeight = crop.height;
    if (job.resizeEnabled) {
      const ratio = Math.min(1, job.maxWidth / Math.max(1, crop.width), job.maxHeight / Math.max(1, crop.height));
      targetWidth = Math.max(1, Math.round(crop.width * ratio));
      targetHeight = Math.max(1, Math.round(crop.height * ratio));
    }

    const outputCanvas = new OffscreenCanvas(targetWidth, targetHeight);
    const outputContext = outputCanvas.getContext("2d", { willReadFrequently: true });
    if (!outputContext) {
      throw new Error("Final canvas is unavailable in the optimizer.");
    }
    outputContext.drawImage(
      stage,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    // Apply post-processing filters
    if (job.autoLevels) {
      applyAutoLevels(outputContext, targetWidth, targetHeight);
    }
    if (job.brightness !== 0) {
      applyBrightness(outputContext, targetWidth, targetHeight, job.brightness);
    }
    if (job.contrast !== 0) {
      applyContrast(outputContext, targetWidth, targetHeight, job.contrast);
    }
    if (job.noiseReduction) {
      applyNoiseReduction(outputContext, targetWidth, targetHeight, job.noiseReductionStrength);
    }
    if (job.sharpen) {
      applySharpen(outputContext, targetWidth, targetHeight, job.sharpenStrength);
    }
    if (job.grayscale) {
      applyGrayscale(outputContext, targetWidth, targetHeight);
    }

    const rotated = applyRotation(outputContext, targetWidth, targetHeight, job.rotation);
    const finalWidth = rotated.width;
    const finalHeight = rotated.height;

    const outputBlob = await rotated.canvas.convertToBlob({
      type: getMimeType(job.outputFormat),
      quality: job.outputFormat === "png" ? undefined : job.quality,
    });

    self.postMessage({
      id: job.id,
      ok: true,
      blob: outputBlob,
      width: finalWidth,
      height: finalHeight,
    });
  } catch (error) {
    self.postMessage({
      id: job.id,
      ok: false,
      error: error instanceof Error ? error.message : "Optimizer worker failed.",
    });
  }
};
