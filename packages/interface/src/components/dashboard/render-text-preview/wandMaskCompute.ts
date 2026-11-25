export interface WandMaskBuffers {
  readonly width: number;
  readonly height: number;
  readonly selected: Uint8Array;
  readonly frameAData: Uint8ClampedArray;
  readonly frameBData: Uint8ClampedArray;
}

const buildFrameData = (
  width: number,
  height: number,
  selected: Uint8Array,
  thickBorder: Uint8Array,
  phase: number,
): Uint8ClampedArray => {
  const totalPixels = width * height;
  const frameData = new Uint8ClampedArray(totalPixels * 4);
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
  return frameData;
};

export const computeWandMaskBuffers = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): WandMaskBuffers => {
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

  return {
    width,
    height,
    selected,
    frameAData: buildFrameData(width, height, selected, thickBorder, 0),
    frameBData: buildFrameData(width, height, selected, thickBorder, 6),
  };
};
