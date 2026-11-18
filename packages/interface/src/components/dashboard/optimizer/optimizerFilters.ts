const readChannel = (
  data: Uint8ClampedArray,
  index: number,
  fallback = 0,
): number => data[index] ?? fallback;

export const detectBorderCrop = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
): { x: number; y: number; width: number; height: number } => {
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

/** Apply unsharp-mask sharpening via a 3×3 convolution kernel.
 *  `src` is a reusable scratch buffer: it is overwritten with a snapshot of
 *  `data` (the pre-filter pixels) before any read, so pooled reuse is safe. */
export const sharpenPixels = (
  data: Uint8ClampedArray,
  src: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): void => {
  src.set(data);
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
        data[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
};

/** Convert image data to grayscale using luminance weights. */
export const grayscalePixels = (data: Uint8ClampedArray): void => {
  for (let i = 0; i < data.length; i += 4) {
    const lum =
      0.299 * readChannel(data, i) +
      0.587 * readChannel(data, i + 1) +
      0.114 * readChannel(data, i + 2);
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
};

/** Adjust brightness: value from -100 to +100. */
export const brightnessPixels = (data: Uint8ClampedArray, value: number): void => {
  if (value === 0) return;
  const adj = (value / 100) * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, readChannel(data, i) + adj));
    data[i + 1] = Math.max(0, Math.min(255, readChannel(data, i + 1) + adj));
    data[i + 2] = Math.max(0, Math.min(255, readChannel(data, i + 2) + adj));
  }
};

/** Adjust contrast: value from -100 to +100. */
export const contrastPixels = (data: Uint8ClampedArray, value: number): void => {
  if (value === 0) return;
  const factor = (259 * (value + 255)) / (255 * (259 - value));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (readChannel(data, i) - 128) + 128));
    data[i + 1] = Math.max(0, Math.min(255, factor * (readChannel(data, i + 1) - 128) + 128));
    data[i + 2] = Math.max(0, Math.min(255, factor * (readChannel(data, i + 2) - 128) + 128));
  }
};

/** Simple box-blur noise reduction (3x3 kernel averaged).
 *  `src` is a reusable scratch buffer re-snapshotted from `data` at the start
 *  of every pass, so pooled reuse is safe. */
export const noiseReducePixels = (
  data: Uint8ClampedArray,
  src: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): void => {
  const passes = Math.max(1, Math.min(3, Math.round(strength * 3)));
  for (let pass = 0; pass < passes; pass++) {
    src.set(data);
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
          data[idx + c] = Math.round(sum / 9);
        }
      }
    }
  }
};

/** Stretch histogram so that darkest pixel maps to 0 and brightest to 255. */
export const autoLevelsPixels = (data: Uint8ClampedArray): boolean => {
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const channel = readChannel(data, i + c);
      if (channel < minVal) minVal = channel;
      if (channel > maxVal) maxVal = channel;
    }
  }
  const range = maxVal - minVal;
  if (range < 2) return false;
  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(0, Math.min(255, Math.round((readChannel(data, i + c) - minVal) * scale)));
    }
  }
  return true;
};

export interface OptimizerPixelContext {
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
}

export interface OptimizerFilterChainOptions {
  readonly autoLevels: boolean;
  readonly brightness: number;
  readonly contrast: number;
  readonly noiseReduction: boolean;
  readonly noiseReductionStrength: number;
  readonly sharpen: boolean;
  readonly sharpenStrength: number;
  readonly grayscale: boolean;
}

export const applyOptimizerFilterChain = (
  context: OptimizerPixelContext,
  width: number,
  height: number,
  options: OptimizerFilterChainOptions,
): void => {
  let imageData: ImageData | null = null;
  let scratchSrc: Uint8ClampedArray | null = null;
  let dirty = false;

  const ensureSynced = (): ImageData => {
    if (!imageData) {
      imageData = context.getImageData(0, 0, width, height);
    }
    return imageData;
  };
  const ensureScratchSrc = (length: number): Uint8ClampedArray => {
    if (!scratchSrc) {
      scratchSrc = new Uint8ClampedArray(length);
    }
    return scratchSrc;
  };

  if (options.autoLevels) {
    if (autoLevelsPixels(ensureSynced().data)) {
      dirty = true;
    }
  }
  if (options.brightness !== 0) {
    brightnessPixels(ensureSynced().data, options.brightness);
    dirty = true;
  }
  if (options.contrast !== 0) {
    contrastPixels(ensureSynced().data, options.contrast);
    dirty = true;
  }
  if (options.noiseReduction) {
    const data = ensureSynced().data;
    noiseReducePixels(
      data,
      ensureScratchSrc(data.length),
      width,
      height,
      options.noiseReductionStrength,
    );
    dirty = true;
  }
  if (options.sharpen) {
    const data = ensureSynced().data;
    sharpenPixels(
      data,
      ensureScratchSrc(data.length),
      width,
      height,
      options.sharpenStrength,
    );
    dirty = true;
  }
  if (options.grayscale) {
    grayscalePixels(ensureSynced().data);
    dirty = true;
  }

  if (dirty && imageData) {
    context.putImageData(imageData, 0, 0);
  }
};
