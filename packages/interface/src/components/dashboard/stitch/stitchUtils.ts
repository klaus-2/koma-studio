import type {
  StitchAlignMode,
  StitchBatchPlan,
  StitchBatchStrategy,
  StitchImageFilters,
  StitchImageInput,
  StitchLayoutMode,
  StitchRenderImageInput,
} from './types';

type Canvas2DLike = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const STITCH_MAX_SAFE_AXIS = 16384;
export const STITCH_MAX_WARN_AXIS = 30000;
export const STITCH_MAX_WARN_MEGAPIXELS = 120;

export const buildStitchBatchId = (batchIndex: number): string =>
  `stitch-batch-${batchIndex + 1}`;

export const getRotatedDimensions = (
  image: Pick<StitchImageInput | StitchRenderImageInput, 'width' | 'height' | 'rotation'>,
): { width: number; height: number } => {
  const normalizedRotation = ((image.rotation % 360) + 360) % 360;
  const isSideways = normalizedRotation === 90 || normalizedRotation === 270;
  return {
    width: isSideways ? image.height : image.width,
    height: isSideways ? image.width : image.height,
  };
};

export const resolveStitchOutputMetrics = (
  images: Array<Pick<StitchImageInput | StitchRenderImageInput, 'width' | 'height' | 'rotation'>>,
  layoutMode: StitchLayoutMode,
  gap: number,
): { width: number; height: number } => {
  const dims = images.map(getRotatedDimensions);
  if (dims.length === 0) {
    return { width: 0, height: 0 };
  }
  if (layoutMode === 'webtoon') {
    return {
      width: Math.max(...dims.map((entry) => entry.width)),
      height: dims.reduce((sum, entry) => sum + entry.height, 0) + Math.max(0, dims.length - 1) * gap,
    };
  }
  return {
    width: dims.reduce((sum, entry) => sum + entry.width, 0) + Math.max(0, dims.length - 1) * gap,
    height: Math.max(...dims.map((entry) => entry.height)),
  };
};

const estimateBytesForPlan = (width: number, height: number): number => {
  const pixels = width * height;
  return Math.round(pixels * 2.4);
};

const buildPlanWarnings = (width: number, height: number, count: number): string[] => {
  const warnings: string[] = [];
  if (width >= STITCH_MAX_SAFE_AXIS || height >= STITCH_MAX_SAFE_AXIS) {
    warnings.push('stitch.warning.canvasLimit');
  }
  if (width >= STITCH_MAX_WARN_AXIS || height >= STITCH_MAX_WARN_AXIS) {
    warnings.push('stitch.warning.dimensionTooHigh');
  }
  const megapixels = (width * height) / 1_000_000;
  if (megapixels >= STITCH_MAX_WARN_MEGAPIXELS) {
    warnings.push('stitch.warning.outputTooHeavy');
  }
  if (count >= 8) {
    warnings.push('stitch.warning.largeBatch');
  }
  return warnings;
};

export const buildBatchPlanFromIndexes = (
  batchIndexes: number[][],
  images: StitchImageInput[],
  layoutMode: StitchLayoutMode,
  gap: number,
): StitchBatchPlan[] =>
  batchIndexes
    .filter((batch) => batch.length > 0)
    .map((batch, batchIndex) => {
      const batchImages = batch
        .map((imageIndex) => images[imageIndex])
        .filter((image): image is StitchImageInput => Boolean(image));
      const { width, height } = resolveStitchOutputMetrics(batchImages, layoutMode, gap);
      const megapixels = (width * height) / 1_000_000;
      return {
        id: buildStitchBatchId(batchIndex),
        imageIndexes: batch,
        count: batch.length,
        outputWidth: width,
        outputHeight: height,
        megapixels,
        estimatedBytes: estimateBytesForPlan(width, height),
        warnings: buildPlanWarnings(width, height, batch.length),
      };
    });

export const buildAutoBatchIndexes = (
  images: StitchImageInput[],
  strategy: StitchBatchStrategy,
  batchSize: number,
  targetPrimaryAxis: number,
  layoutMode: StitchLayoutMode,
  gap: number,
): number[][] => {
  if (images.length === 0) return [];
  if (strategy === 'single') {
    return [images.map((_, index) => index)];
  }

  if (strategy === 'fixed-count') {
    const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
    const batches: number[][] = [];
    for (let start = 0; start < images.length; start += normalizedBatchSize) {
      batches.push(
        images
          .slice(start, start + normalizedBatchSize)
          .map((_, offset) => start + offset),
      );
    }
    return batches;
  }

  const batches: number[][] = [];
  let currentBatch: number[] = [];
  let currentPrimaryAxis = 0;
  const normalizedTarget = Math.max(1, Math.floor(targetPrimaryAxis));

  images.forEach((image, index) => {
    const dims = getRotatedDimensions(image);
    const primaryAxis = layoutMode === 'webtoon' ? dims.height : dims.width;
    const gapCost = currentBatch.length > 0 ? gap : 0;
    const nextAxis = currentPrimaryAxis + gapCost + primaryAxis;
    if (currentBatch.length > 0 && nextAxis > normalizedTarget) {
      batches.push(currentBatch);
      currentBatch = [index];
      currentPrimaryAxis = primaryAxis;
      return;
    }
    currentBatch.push(index);
    currentPrimaryAxis = nextAxis;
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

export const moveLastImageToNextBatch = (batchIndexes: number[][], batchIndex: number): number[][] => {
  const current = batchIndexes[batchIndex];
  if (!current || current.length <= 1) return batchIndexes;
  const movedImage = current[current.length - 1];
  const next = batchIndexes[batchIndex + 1];
  const updated = batchIndexes.map((batch) => [...batch]);
  const updatedCurrent = updated[batchIndex];
  if (!updatedCurrent || movedImage === undefined) return batchIndexes;
  updated[batchIndex] = updatedCurrent.slice(0, -1);
  if (next) {
    const updatedNext = updated[batchIndex + 1] ?? [];
    updated[batchIndex + 1] = [movedImage, ...updatedNext];
  } else {
    updated.push([movedImage]);
  }
  return updated.filter((batch) => batch.length > 0);
};

export const pullFirstImageFromNextBatch = (batchIndexes: number[][], batchIndex: number): number[][] => {
  const next = batchIndexes[batchIndex + 1];
  if (!next || next.length === 0) return batchIndexes;
  const updated = batchIndexes.map((batch) => [...batch]);
  const updatedCurrent = updated[batchIndex];
  const updatedNext = updated[batchIndex + 1];
  const movedImage = updatedNext?.[0];
  if (!updatedCurrent || !updatedNext || movedImage === undefined) return batchIndexes;
  updatedCurrent.push(movedImage);
  updated[batchIndex + 1] = updatedNext.slice(1);
  return updated.filter((batch) => batch.length > 0);
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const getMimeTypeFromExportFormat = (
  format: 'png' | 'jpeg' | 'webp',
): 'image/png' | 'image/jpeg' | 'image/webp' => {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
};

export const getExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
};

export const sanitizeFileStem = (value: string): string => {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  return cleaned || 'koma-stitch';
};

export const calculateAxisOffset = (
  container: number,
  content: number,
  alignMode: StitchAlignMode,
): number => {
  if (alignMode === 'start') return 0;
  if (alignMode === 'end') return Math.max(0, container - content);
  return Math.max(0, Math.round((container - content) / 2));
};

export const applyImageFiltersToContext = (
  ctx: Canvas2DLike,
  width: number,
  height: number,
  filters: StitchImageFilters,
): void => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const levelsLut = new Uint8Array(256);
  const whiteDelta = Math.max(1, filters.levels.white - filters.levels.black);
  for (let index = 0; index < 256; index += 1) {
    let value = (index - filters.levels.black) / whiteDelta;
    value = Math.pow(Math.max(0, Math.min(1, value)), 1 / Math.max(0.01, filters.levels.gamma));
    levelsLut[index] = clamp(value * 255, 0, 255);
  }

  const contrastFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast || 1));
  for (let offset = 0; offset < data.length; offset += 4) {
    let red = levelsLut[data[offset] ?? 0] ?? 0;
    let green = levelsLut[data[offset + 1] ?? 0] ?? 0;
    let blue = levelsLut[data[offset + 2] ?? 0] ?? 0;

    red = clamp(contrastFactor * (red - 128) + 128 + filters.brightness, 0, 255);
    green = clamp(contrastFactor * (green - 128) + 128 + filters.brightness, 0, 255);
    blue = clamp(contrastFactor * (blue - 128) + 128 + filters.brightness, 0, 255);

    const gray = 0.2989 * red + 0.587 * green + 0.114 * blue;
    if (filters.grayscale) {
      red = gray;
      green = gray;
      blue = gray;
    } else if (filters.saturation !== 0) {
      const saturationMultiplier = 1 + filters.saturation / 100;
      red = clamp(gray + saturationMultiplier * (red - gray), 0, 255);
      green = clamp(gray + saturationMultiplier * (green - gray), 0, 255);
      blue = clamp(gray + saturationMultiplier * (blue - gray), 0, 255);
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
    applyConvolution(ctx, width, height, [
      0, -filters.sharpen / 10, 0,
      -filters.sharpen / 10, 1 + 4 * (filters.sharpen / 10), -filters.sharpen / 10,
      0, -filters.sharpen / 10, 0,
    ]);
  }
};

const applyConvolution = (ctx: Canvas2DLike, width: number, height: number, kernel: number[]): void => {
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const srcData = src.data;
  const dstData = dst.data;
  const side = Math.round(Math.sqrt(kernel.length));
  const halfSide = Math.floor(side / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let ky = 0; ky < side; ky += 1) {
        for (let kx = 0; kx < side; kx += 1) {
          const sampleX = clamp(x + kx - halfSide, 0, width - 1);
          const sampleY = clamp(y + ky - halfSide, 0, height - 1);
          const srcOffset = (sampleY * width + sampleX) * 4;
          const weight = kernel[ky * side + kx] ?? 0;
          red += (srcData[srcOffset] ?? 0) * weight;
          green += (srcData[srcOffset + 1] ?? 0) * weight;
          blue += (srcData[srcOffset + 2] ?? 0) * weight;
          alpha += (srcData[srcOffset + 3] ?? 0) * weight;
        }
      }
      const dstOffset = (y * width + x) * 4;
      dstData[dstOffset] = clamp(Math.round(red), 0, 255);
      dstData[dstOffset + 1] = clamp(Math.round(green), 0, 255);
      dstData[dstOffset + 2] = clamp(Math.round(blue), 0, 255);
      dstData[dstOffset + 3] = clamp(Math.round(alpha), 0, 255);
    }
  }

  ctx.putImageData(dst, 0, 0);
};
