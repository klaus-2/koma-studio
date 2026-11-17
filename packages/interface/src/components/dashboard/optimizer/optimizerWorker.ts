import {
  autoLevelsPixels,
  brightnessPixels,
  contrastPixels,
  detectBorderCrop,
  grayscalePixels,
  noiseReducePixels,
  sharpenPixels,
} from "./optimizerFilters";

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

interface FilterScratch {
  imageData: ImageData | null;
  src: Uint8ClampedArray | null;
}

const getMimeType = (format: RawOutputFormat): "image/png" | "image/jpeg" | "image/webp" => {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
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
      ? detectBorderCrop(
          stageContext.getImageData(0, 0, bitmap.width, bitmap.height).data,
          bitmap.width,
          bitmap.height,
          job.trimTolerance,
        )
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

    const scratch: FilterScratch = { imageData: null, src: null };

    // Dirty-flag protocol: the pooled ImageData is allocated once by the first
    // filter's ensureSynced; after every putImageData canvas == buffer holds,
    // so the holder is the single synchronization point — a filter that writes
    // to the canvas outside the holder must reset scratch.imageData to re-sync.
    const ensureSynced = (
      context: OffscreenCanvasRenderingContext2D,
      width: number,
      height: number,
    ): ImageData => {
      if (!scratch.imageData) {
        scratch.imageData = context.getImageData(0, 0, width, height);
      }
      return scratch.imageData;
    };
    const ensureScratchSrc = (length: number): Uint8ClampedArray => {
      if (!scratch.src) {
        scratch.src = new Uint8ClampedArray(length);
      }
      return scratch.src;
    };

    if (job.autoLevels) {
      const imageData = ensureSynced(outputContext, targetWidth, targetHeight);
      autoLevelsPixels(imageData.data);
      outputContext.putImageData(imageData, 0, 0);
    }
    if (job.brightness !== 0) {
      const imageData = ensureSynced(outputContext, targetWidth, targetHeight);
      brightnessPixels(imageData.data, job.brightness);
      outputContext.putImageData(imageData, 0, 0);
    }
    if (job.contrast !== 0) {
      const imageData = ensureSynced(outputContext, targetWidth, targetHeight);
      contrastPixels(imageData.data, job.contrast);
      outputContext.putImageData(imageData, 0, 0);
    }
    if (job.noiseReduction) {
      const imageData = ensureSynced(outputContext, targetWidth, targetHeight);
      noiseReducePixels(
        imageData.data,
        ensureScratchSrc(imageData.data.length),
        targetWidth,
        targetHeight,
        job.noiseReductionStrength,
      );
      outputContext.putImageData(imageData, 0, 0);
    }
    if (job.sharpen) {
      const imageData = ensureSynced(outputContext, targetWidth, targetHeight);
      sharpenPixels(
        imageData.data,
        ensureScratchSrc(imageData.data.length),
        targetWidth,
        targetHeight,
        job.sharpenStrength,
      );
      outputContext.putImageData(imageData, 0, 0);
    }
    if (job.grayscale) {
      const imageData = ensureSynced(outputContext, targetWidth, targetHeight);
      grayscalePixels(imageData.data);
      outputContext.putImageData(imageData, 0, 0);
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
