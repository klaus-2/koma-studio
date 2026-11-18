import {
  applyOptimizerFilterChain,
  detectBorderCrop,
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
  let activeStage = "decode";
  try {
    const blob = new Blob([job.sourceBuffer], { type: job.sourceMimeType || "image/png" });
    const bitmap = await createImageBitmap(blob);
    const stage = new OffscreenCanvas(bitmap.width, bitmap.height);
    const stageContext = stage.getContext("2d", { willReadFrequently: true });
    if (!stageContext) {
      throw new Error("Canvas 2D is unavailable in the optimizer.");
    }
    stageContext.drawImage(bitmap, 0, 0);

    activeStage = "trimBorders";
    const crop = job.trimBorders
      ? detectBorderCrop(
          stageContext.getImageData(0, 0, bitmap.width, bitmap.height).data,
          bitmap.width,
          bitmap.height,
          job.trimTolerance,
        )
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };

    activeStage = "resize";
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

    activeStage = "filters";
    applyOptimizerFilterChain(outputContext, targetWidth, targetHeight, job);

    activeStage = "rotation";
    const rotated = applyRotation(outputContext, targetWidth, targetHeight, job.rotation);
    const finalWidth = rotated.width;
    const finalHeight = rotated.height;

    activeStage = "encode";
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
    const detail = error instanceof Error ? error.message : "Optimizer worker failed.";
    self.postMessage({
      id: job.id,
      ok: false,
      error: `[${activeStage}] ${detail}`,
    });
  }
};
