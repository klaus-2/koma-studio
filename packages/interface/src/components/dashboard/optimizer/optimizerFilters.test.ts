import { describe, expect, it, vi } from 'vitest';

import {
  applyOptimizerFilterChain,
  autoLevelsPixels,
  brightnessPixels,
  contrastPixels,
  detectBorderCrop,
  grayscalePixels,
  noiseReducePixels,
  sharpenPixels,
} from './optimizerFilters';
import type {
  OptimizerFilterChainOptions,
  OptimizerPixelContext,
} from './optimizerFilters';

const byteAt = (data: Uint8ClampedArray, index: number): number => data[index] ?? 0;

const FIXTURE_WIDTH = 9;
const FIXTURE_HEIGHT = 7;
const FIXTURE_SEED = 0x9e3779b9;

type CropBox = { x: number; y: number; width: number; height: number };

type FilterCase = {
  readonly name: string;
  readonly apply: (data: Uint8ClampedArray, src: Uint8ClampedArray) => void;
};

const createNoiseSequence = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const makeGradientFixture = (
  width: number,
  height: number,
  seed: number,
): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  const noise = createNoiseSequence(seed);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const jitter = noise();
      data[idx] = Math.round((x / Math.max(1, width - 1)) * 255);
      data[idx + 1] = Math.round((y / Math.max(1, height - 1)) * 255);
      data[idx + 2] = Math.round(((x + y) / Math.max(1, width + height - 2)) * 255);
      data[idx + 3] = 255;
      if (jitter > 0.75) {
        data[idx] = (byteAt(data, idx) + Math.round(jitter * 90)) % 256;
        data[idx + 1] = (byteAt(data, idx + 1) + Math.round(jitter * 60)) % 256;
      }
      if (jitter < 0.06) {
        data[idx + 3] = Math.round(jitter * 2000);
      }
    }
  }
  return data;
};

const makeFixture = (width: number, height: number): Uint8ClampedArray =>
  makeGradientFixture(width, height, FIXTURE_SEED);

const makeBorderedFixture = (
  width: number,
  height: number,
  borderWidth: number,
  borderValue: number,
): Uint8ClampedArray => {
  const data = makeGradientFixture(width, height, FIXTURE_SEED);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder =
        x < borderWidth ||
        x >= width - borderWidth ||
        y < borderWidth ||
        y >= height - borderWidth;
      if (!isBorder) continue;
      const idx = (y * width + x) * 4;
      data[idx] = borderValue;
      data[idx + 1] = borderValue;
      data[idx + 2] = borderValue;
      data[idx + 3] = 255;
    }
  }
  return data;
};

const makeUniformFixture = (width: number, height: number, value: number): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  return data;
};

const refSharpen = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  clampedStrength: number,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data);
  const snapshot = new Uint8ClampedArray(data);
  const center = 1 + 4 * clampedStrength;
  const edge = -clampedStrength;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        // Same term order as the kernel: float addition is not associative,
        // and the reference must round identically at half-step boundaries.
        const at = (px: number, py: number): number =>
          byteAt(snapshot, (py * width + px) * 4 + c);
        const val =
          center * at(x, y) +
          edge * at(x, y - 1) +
          edge * at(x, y + 1) +
          edge * at(x - 1, y) +
          edge * at(x + 1, y);
        out[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
  return out;
};

const refGrayscale = (data: Uint8ClampedArray): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    const lum =
      0.299 * byteAt(out, i) + 0.587 * byteAt(out, i + 1) + 0.114 * byteAt(out, i + 2);
    out[i] = lum;
    out[i + 1] = lum;
    out[i + 2] = lum;
  }
  return out;
};

const refBrightness = (data: Uint8ClampedArray, value: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data);
  const adj = (value / 100) * 255;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.min(255, Math.max(0, byteAt(out, i) + adj));
    out[i + 1] = Math.min(255, Math.max(0, byteAt(out, i + 1) + adj));
    out[i + 2] = Math.min(255, Math.max(0, byteAt(out, i + 2) + adj));
  }
  return out;
};

const refContrast = (data: Uint8ClampedArray, value: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data);
  const factor = (259 * (value + 255)) / (255 * (259 - value));
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.min(255, Math.max(0, factor * (byteAt(out, i) - 128) + 128));
    out[i + 1] = Math.min(255, Math.max(0, factor * (byteAt(out, i + 1) - 128) + 128));
    out[i + 2] = Math.min(255, Math.max(0, factor * (byteAt(out, i + 2) - 128) + 128));
  }
  return out;
};

const refNoiseReduce = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  passes: number,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data);
  const snapshot = new Uint8ClampedArray(data.length);
  for (let pass = 0; pass < passes; pass += 1) {
    snapshot.set(out);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        for (let c = 0; c < 3; c += 1) {
          let total = 0;
          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              total += byteAt(snapshot, ((y + oy) * width + (x + ox)) * 4 + c);
            }
          }
          out[(y * width + x) * 4 + c] = Math.round(total / 9);
        }
      }
    }
  }
  return out;
};

const refAutoLevels = (data: Uint8ClampedArray): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data);
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < out.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      minVal = Math.min(minVal, byteAt(out, i + c));
      maxVal = Math.max(maxVal, byteAt(out, i + c));
    }
  }
  const range = maxVal - minVal;
  if (range < 2) return out;
  const scale = 255 / range;
  for (let i = 0; i < out.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      out[i + c] = Math.min(
        255,
        Math.max(0, Math.round((byteAt(out, i + c) - minVal) * scale)),
      );
    }
  }
  return out;
};

const refDetectBorderCrop = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
): CropBox => {
  const isUniformPixel = (offset: number): boolean => {
    if (byteAt(data, offset + 3) < 12) return true;
    const r = byteAt(data, offset);
    const g = byteAt(data, offset + 1);
    const b = byteAt(data, offset + 2);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (
      (max <= tolerance && min <= tolerance) ||
      (max >= 255 - tolerance && min >= 255 - tolerance)
    );
  };
  const rowHasContent = (row: number): boolean => {
    for (let x = 0; x < width; x += 1) {
      if (!isUniformPixel((row * width + x) * 4)) return true;
    }
    return false;
  };
  const columnHasContent = (column: number): boolean => {
    for (let y = 0; y < height; y += 1) {
      if (!isUniformPixel((y * width + column) * 4)) return true;
    }
    return false;
  };
  let top = -1;
  let bottom = -1;
  let left = -1;
  let right = -1;
  for (let row = 0; row < height; row += 1) {
    if (rowHasContent(row)) {
      top = row;
      break;
    }
  }
  for (let row = height - 1; row >= 0; row -= 1) {
    if (rowHasContent(row)) {
      bottom = row;
      break;
    }
  }
  for (let column = 0; column < width; column += 1) {
    if (columnHasContent(column)) {
      left = column;
      break;
    }
  }
  for (let column = width - 1; column >= 0; column -= 1) {
    if (columnHasContent(column)) {
      right = column;
      break;
    }
  }
  if (top === -1 || left === -1) {
    return { x: width - 1, y: height - 1, width: 1, height: 1 };
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

const alphaBytes = (data: Uint8ClampedArray): number[] => {
  const bytes: number[] = [];
  for (let i = 3; i < data.length; i += 4) bytes.push(byteAt(data, i));
  return bytes;
};

const filterCases: readonly FilterCase[] = [
  {
    name: 'autoLevelsPixels',
    apply: (data) => {
      autoLevelsPixels(data);
    },
  },
  {
    name: 'brightnessPixels(+33)',
    apply: (data) => {
      brightnessPixels(data, 33);
    },
  },
  {
    name: 'contrastPixels(-30)',
    apply: (data) => {
      contrastPixels(data, -30);
    },
  },
  {
    name: 'grayscalePixels',
    apply: (data) => {
      grayscalePixels(data);
    },
  },
  {
    name: 'sharpenPixels(0.8)',
    apply: (data, src) => {
      sharpenPixels(data, src, FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.8);
    },
  },
  {
    name: 'noiseReducePixels(0.5)',
    apply: (data, src) => {
      noiseReducePixels(data, src, FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.5);
    },
  },
];

describe('sharpenPixels', () => {
  it('matches the naive convolution reference on the gradient + noise fixture', () => {
    const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    sharpenPixels(
      kernelOut,
      new Uint8ClampedArray(kernelOut.length),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      0.8,
    );
    expect(kernelOut).toEqual(refSharpen(input, FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.8));
  });

  it('matches the naive reference on a differently shaped fixture', () => {
    const input = makeFixture(8, 6);
    const kernelOut = makeFixture(8, 6);
    sharpenPixels(kernelOut, new Uint8ClampedArray(kernelOut.length), 8, 6, 1.3);
    expect(kernelOut).toEqual(refSharpen(input, 8, 6, 1.3));
  });

  it('clamps strength into [0.1, 2]', () => {
    const rawStrengths = [0, 0.05, 0.1, 2, 5] as const;
    for (const rawStrength of rawStrengths) {
      const clamped = Math.max(0.1, Math.min(2, rawStrength));
      const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      sharpenPixels(
        kernelOut,
        new Uint8ClampedArray(kernelOut.length),
        FIXTURE_WIDTH,
        FIXTURE_HEIGHT,
        rawStrength,
      );
      expect(kernelOut).toEqual(refSharpen(input, FIXTURE_WIDTH, FIXTURE_HEIGHT, clamped));
    }
  });

  it('leaves border pixels untouched', () => {
    const data = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const input = new Uint8ClampedArray(data);
    sharpenPixels(data, new Uint8ClampedArray(data.length), FIXTURE_WIDTH, FIXTURE_HEIGHT, 2);
    for (let y = 0; y < FIXTURE_HEIGHT; y += 1) {
      for (let x = 0; x < FIXTURE_WIDTH; x += 1) {
        const isBorder =
          x === 0 || x === FIXTURE_WIDTH - 1 || y === 0 || y === FIXTURE_HEIGHT - 1;
        if (!isBorder) continue;
        const idx = (y * FIXTURE_WIDTH + x) * 4;
        expect([
          byteAt(data, idx),
          byteAt(data, idx + 1),
          byteAt(data, idx + 2),
          byteAt(data, idx + 3),
        ]).toEqual([
          byteAt(input, idx),
          byteAt(input, idx + 1),
          byteAt(input, idx + 2),
          byteAt(input, idx + 3),
        ]);
      }
    }
  });

  it('leaves a 2×2 buffer unchanged (no interior pixels)', () => {
    const data = makeFixture(2, 2);
    const expected = new Uint8ClampedArray(data);
    sharpenPixels(data, new Uint8ClampedArray(data.length), 2, 2, 2);
    expect(data).toEqual(expected);
  });
});

describe('noiseReducePixels', () => {
  const passCases: readonly { strength: number; passes: number }[] = [
    { strength: 0.2, passes: 1 },
    { strength: 0.5, passes: 2 },
    { strength: 0.84, passes: 3 },
  ];

  for (const passCase of passCases) {
    it(`runs ${passCase.passes} pass(es) for strength ${passCase.strength} and matches the reference`, () => {
      const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      noiseReducePixels(
        kernelOut,
        new Uint8ClampedArray(kernelOut.length),
        FIXTURE_WIDTH,
        FIXTURE_HEIGHT,
        passCase.strength,
      );
      expect(kernelOut).toEqual(
        refNoiseReduce(input, FIXTURE_WIDTH, FIXTURE_HEIGHT, passCase.passes),
      );
    });
  }

  it('clamps strength into one to three passes', () => {
    const zeroStrength = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const onePassRef = refNoiseReduce(
      makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      1,
    );
    noiseReducePixels(
      zeroStrength,
      new Uint8ClampedArray(zeroStrength.length),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      0,
    );
    expect(zeroStrength).toEqual(onePassRef);

    const hugeStrength = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const threePassRef = refNoiseReduce(
      makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      3,
    );
    noiseReducePixels(
      hugeStrength,
      new Uint8ClampedArray(hugeStrength.length),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      5,
    );
    expect(hugeStrength).toEqual(threePassRef);
  });

  it('composes: three single-pass applications equal one three-pass application', () => {
    const composed = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const scratch = new Uint8ClampedArray(composed.length);
    noiseReducePixels(composed, scratch, FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.2);
    noiseReducePixels(composed, scratch, FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.2);
    noiseReducePixels(composed, scratch, FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.2);

    const single = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    noiseReducePixels(single, new Uint8ClampedArray(single.length), FIXTURE_WIDTH, FIXTURE_HEIGHT, 1);
    expect(composed).toEqual(single);
  });

  it('matches the naive reference on a differently shaped fixture', () => {
    const input = makeFixture(8, 6);
    const kernelOut = makeFixture(8, 6);
    noiseReducePixels(kernelOut, new Uint8ClampedArray(kernelOut.length), 8, 6, 0.84);
    expect(kernelOut).toEqual(refNoiseReduce(input, 8, 6, 3));
  });

  it('leaves a 2×2 buffer unchanged (no interior pixels)', () => {
    const data = makeFixture(2, 2);
    const expected = new Uint8ClampedArray(data);
    noiseReducePixels(data, new Uint8ClampedArray(data.length), 2, 2, 1);
    expect(data).toEqual(expected);
  });
});

describe('grayscalePixels', () => {
  it('matches the luminance reference', () => {
    const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    grayscalePixels(kernelOut);
    expect(kernelOut).toEqual(refGrayscale(input));
  });
});

describe('brightnessPixels', () => {
  it('matches the additive reference for positive and negative values', () => {
    for (const value of [33, -47, 100, -100] as const) {
      const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      brightnessPixels(kernelOut, value);
      expect(kernelOut).toEqual(refBrightness(input, value));
    }
  });

  it('returns the buffer unchanged for value 0', () => {
    const data = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const expected = new Uint8ClampedArray(data);
    brightnessPixels(data, 0);
    expect(data).toEqual(expected);
  });
});

describe('contrastPixels', () => {
  it('matches the contrast-factor reference for positive and negative values', () => {
    for (const value of [30, -50, 100, -100] as const) {
      const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      contrastPixels(kernelOut, value);
      expect(kernelOut).toEqual(refContrast(input, value));
    }
  });

  it('returns the buffer unchanged for value 0', () => {
    const data = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const expected = new Uint8ClampedArray(data);
    contrastPixels(data, 0);
    expect(data).toEqual(expected);
  });
});

describe('autoLevelsPixels', () => {
  it('matches the histogram-stretch reference', () => {
    const input = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const kernelOut = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    autoLevelsPixels(kernelOut);
    expect(kernelOut).toEqual(refAutoLevels(input));
  });

  it('returns the buffer unchanged when the channel range is below 2', () => {
    const data = makeUniformFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT, 100);
    data[12] = 101;
    data[40] = 101;
    const expected = new Uint8ClampedArray(data);
    autoLevelsPixels(data);
    expect(data).toEqual(expected);
  });

  it('returns a fully uniform buffer unchanged', () => {
    const data = makeUniformFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT, 137);
    const expected = new Uint8ClampedArray(data);
    autoLevelsPixels(data);
    expect(data).toEqual(expected);
  });
});

describe('detectBorderCrop', () => {
  const borderCases: readonly {
    name: string;
    width: number;
    height: number;
    borderWidth: number;
    borderValue: number;
    tolerance: number;
  }[] = [
    { name: 'near-white ring', width: 10, height: 8, borderWidth: 2, borderValue: 252, tolerance: 8 },
    { name: 'near-black ring', width: 9, height: 9, borderWidth: 1, borderValue: 3, tolerance: 8 },
    { name: 'wide near-white ring', width: 12, height: 10, borderWidth: 3, borderValue: 250, tolerance: 10 },
  ];

  for (const borderCase of borderCases) {
    it(`trims the ${borderCase.name} and matches the bounding-box reference`, () => {
      const data = makeBorderedFixture(
        borderCase.width,
        borderCase.height,
        borderCase.borderWidth,
        borderCase.borderValue,
      );
      const crop = detectBorderCrop(data, borderCase.width, borderCase.height, borderCase.tolerance);
      expect(crop).toEqual({
        x: borderCase.borderWidth,
        y: borderCase.borderWidth,
        width: borderCase.width - borderCase.borderWidth * 2,
        height: borderCase.height - borderCase.borderWidth * 2,
      });
      expect(crop).toEqual(
        refDetectBorderCrop(data, borderCase.width, borderCase.height, borderCase.tolerance),
      );
    });
  }

  it('trims a fully transparent border ring (alpha below 12 reads as uniform)', () => {
    const width = 10;
    const height = 8;
    const data = makeGradientFixture(width, height, FIXTURE_SEED);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const isRing = x === 0 || x === width - 1 || y === 0 || y === height - 1;
        if (!isRing) continue;
        const idx = (y * width + x) * 4;
        data[idx] = 40;
        data[idx + 1] = 90;
        data[idx + 2] = 130;
        data[idx + 3] = 0;
      }
    }
    expect(detectBorderCrop(data, width, height, 8)).toEqual({ x: 1, y: 1, width: 8, height: 6 });
  });

  it('keeps a border whose value falls outside the tolerance', () => {
    const data = makeBorderedFixture(10, 8, 2, 240);
    expect(detectBorderCrop(data, 10, 8, 8)).toEqual({ x: 0, y: 0, width: 10, height: 8 });
    expect(detectBorderCrop(data, 10, 8, 16)).toEqual({ x: 2, y: 2, width: 6, height: 4 });
  });

  it('collapses an entirely trimmable buffer to the bottom-right pixel', () => {
    const width = 6;
    const height = 5;
    const data = makeUniformFixture(width, height, 252);
    const crop = detectBorderCrop(data, width, height, 8);
    expect(crop).toEqual({ x: width - 1, y: height - 1, width: 1, height: 1 });
    expect(crop).toEqual(refDetectBorderCrop(data, width, height, 8));
  });

  it('returns the full rect for a fixture without any uniform border', () => {
    const data = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const crop = detectBorderCrop(data, FIXTURE_WIDTH, FIXTURE_HEIGHT, 8);
    expect(crop).toEqual({ x: 0, y: 0, width: FIXTURE_WIDTH, height: FIXTURE_HEIGHT });
    expect(crop).toEqual(refDetectBorderCrop(data, FIXTURE_WIDTH, FIXTURE_HEIGHT, 8));
  });
});

describe('alpha channel pass-through', () => {
  for (const filterCase of filterCases) {
    it(`${filterCase.name} never modifies alpha bytes`, () => {
      const data = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const before = alphaBytes(data);
      expect(before.some((byte) => byte < 255)).toBe(true);
      filterCase.apply(data, new Uint8ClampedArray(data.length));
      expect(alphaBytes(data)).toEqual(before);
    });
  }
});

describe('pooled scratch protocol', () => {
  for (const filterCase of filterCases) {
    it(`${filterCase.name}: output with a reused poisoned scratch matches output with a fresh scratch`, () => {
      const freshData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      filterCase.apply(freshData, new Uint8ClampedArray(freshData.length));

      const pooledData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const pooledScratch = new Uint8ClampedArray(pooledData.length);
      pooledScratch.fill(203);
      filterCase.apply(pooledData, pooledScratch);

      expect(pooledData).toEqual(freshData);
    });
  }

  it('full worker filter chain: pooled scratch output matches fresh-allocation output', () => {
    const runWorkerFilterChain = (
      data: Uint8ClampedArray,
      createScratchSrc: () => Uint8ClampedArray,
    ): void => {
      autoLevelsPixels(data);
      brightnessPixels(data, 40);
      contrastPixels(data, -30);
      noiseReducePixels(data, createScratchSrc(), FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.5);
      sharpenPixels(data, createScratchSrc(), FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.8);
      grayscalePixels(data);
    };

    const freshData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    runWorkerFilterChain(freshData, () => new Uint8ClampedArray(freshData.length));

    const pooledData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const pooledScratch = new Uint8ClampedArray(pooledData.length);
    pooledScratch.fill(17);
    runWorkerFilterChain(pooledData, () => pooledScratch);

    expect(pooledData).toEqual(freshData);
  });

  it('neighbor kernels run back-to-back on one shared scratch without cross-contamination', () => {
    const runNeighborPair = (
      data: Uint8ClampedArray,
      createScratchSrc: () => Uint8ClampedArray,
    ): void => {
      noiseReducePixels(data, createScratchSrc(), FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.5);
      sharpenPixels(data, createScratchSrc(), FIXTURE_WIDTH, FIXTURE_HEIGHT, 1.2);
    };

    const freshData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    runNeighborPair(freshData, () => new Uint8ClampedArray(freshData.length));

    const pooledData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const pooledScratch = new Uint8ClampedArray(pooledData.length);
    pooledScratch.fill(99);
    runNeighborPair(pooledData, () => pooledScratch);

    expect(pooledData).toEqual(freshData);
  });

  it('a subset chain with guards (brightness → sharpen → grayscale) matches fresh allocation', () => {
    const runSubsetChain = (
      data: Uint8ClampedArray,
      createScratchSrc: () => Uint8ClampedArray,
    ): void => {
      brightnessPixels(data, 40);
      sharpenPixels(data, createScratchSrc(), FIXTURE_WIDTH, FIXTURE_HEIGHT, 0.3);
      grayscalePixels(data);
    };

    const freshData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    runSubsetChain(freshData, () => new Uint8ClampedArray(freshData.length));

    const pooledData = makeFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT);
    const pooledScratch = new Uint8ClampedArray(pooledData.length);
    pooledScratch.fill(64);
    runSubsetChain(pooledData, () => pooledScratch);

    expect(pooledData).toEqual(freshData);
  });
});

const makeSpyContext = (
  pixels: Uint8ClampedArray,
): {
  context: OptimizerPixelContext;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
  written: Uint8ClampedArray[];
} => {
  const written: Uint8ClampedArray[] = [];
  const getImageData = vi.fn(
    (_sx: number, _sy: number, sw: number, sh: number): ImageData => ({
      data: new Uint8ClampedArray(pixels),
      width: sw,
      height: sh,
      colorSpace: 'srgb',
    }),
  );
  const putImageData = vi.fn((imageData: ImageData, _dx: number, _dy: number): void => {
    written.push(new Uint8ClampedArray(imageData.data));
  });
  return {
    context: {
      getImageData: (sx, sy, sw, sh) => getImageData(sx, sy, sw, sh),
      putImageData: (imageData, dx, dy) => putImageData(imageData, dx, dy),
    },
    getImageData,
    putImageData,
    written,
  };
};

describe('applyOptimizerFilterChain dirty-flag orchestration', () => {
  const baseOptions: OptimizerFilterChainOptions = {
    autoLevels: false,
    brightness: 0,
    contrast: 0,
    noiseReduction: false,
    noiseReductionStrength: 0.5,
    sharpen: false,
    sharpenStrength: 0.5,
    grayscale: false,
  };

  it('neither reads nor writes when every filter is disabled or zero', () => {
    const pixels = makeGradientFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT, FIXTURE_SEED);
    const spy = makeSpyContext(pixels);
    applyOptimizerFilterChain(spy.context, FIXTURE_WIDTH, FIXTURE_HEIGHT, baseOptions);
    expect(spy.getImageData).not.toHaveBeenCalled();
    expect(spy.putImageData).not.toHaveBeenCalled();
  });

  it('skips putImageData when autoLevels early-returns on low-range semi-transparent pixels', () => {
    const uniformSemiTransparent = new Uint8ClampedArray(4 * 4 * 4);
    for (let idx = 0; idx < uniformSemiTransparent.length; idx += 4) {
      uniformSemiTransparent[idx] = 128;
      uniformSemiTransparent[idx + 1] = 128;
      uniformSemiTransparent[idx + 2] = 128;
      uniformSemiTransparent[idx + 3] = 137;
    }
    const spy = makeSpyContext(uniformSemiTransparent);
    applyOptimizerFilterChain(spy.context, 4, 4, {
      ...baseOptions,
      autoLevels: true,
    });
    expect(spy.getImageData).toHaveBeenCalledTimes(1);
    expect(spy.putImageData).not.toHaveBeenCalled();
  });

  it('fetches ImageData once and flushes putImageData once across the full filter chain', () => {
    const source = makeGradientFixture(FIXTURE_WIDTH, FIXTURE_HEIGHT, FIXTURE_SEED);
    const expected = new Uint8ClampedArray(source);
    autoLevelsPixels(expected);
    brightnessPixels(expected, 15);
    contrastPixels(expected, 20);
    noiseReducePixels(
      expected,
      new Uint8ClampedArray(expected.length),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      0.6,
    );
    sharpenPixels(
      expected,
      new Uint8ClampedArray(expected.length),
      FIXTURE_WIDTH,
      FIXTURE_HEIGHT,
      0.8,
    );
    grayscalePixels(expected);

    const spy = makeSpyContext(source);
    applyOptimizerFilterChain(spy.context, FIXTURE_WIDTH, FIXTURE_HEIGHT, {
      autoLevels: true,
      brightness: 15,
      contrast: 20,
      noiseReduction: true,
      noiseReductionStrength: 0.6,
      sharpen: true,
      sharpenStrength: 0.8,
      grayscale: true,
    });

    expect(spy.getImageData).toHaveBeenCalledTimes(1);
    expect(spy.putImageData).toHaveBeenCalledTimes(1);
    expect(spy.written[0]).toEqual(expected);
  });
});
