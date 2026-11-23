import type {
  TextEffectSurfaceSpec,
} from "../typography/textEffects.types";

export const hashEffectSeed = (input: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createSeededRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const safeGetImageData = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ImageData | null => {
  if (width <= 0 || height <= 0) return null;
  try {
    return ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
};

const safePutImageData = (
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
): void => {
  try {
    ctx.putImageData(imageData, 0, 0);
  } catch {
  }
};

const parseHexRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = Number.parseInt((clean[0] ?? "0") + (clean[0] ?? "0"), 16);
    const g = Number.parseInt((clean[1] ?? "0") + (clean[1] ?? "0"), 16);
    const b = Number.parseInt((clean[2] ?? "0") + (clean[2] ?? "0"), 16);
    return [r, g, b];
  }
  const r = Number.parseInt(clean.slice(0, 2) || "00", 16);
  const g = Number.parseInt(clean.slice(2, 4) || "00", 16);
  const b = Number.parseInt(clean.slice(4, 6) || "00", 16);
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ];
};

const drawDaisyFlower = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  petalColor: string,
  centerColor: string,
  rotation: number,
): void => {
  const petals = 5;
  ctx.fillStyle = petalColor;
  for (let i = 0; i < petals; i += 1) {
    const angle = rotation + (i * Math.PI * 2) / petals;
    const px = cx + Math.cos(angle) * radius * 0.56;
    const py = cy + Math.sin(angle) * radius * 0.56;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = centerColor;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
};

export const paintHwaFloralFill = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fontSize: number,
  baseColor: string,
  seed: number,
): void => {
  ctx.save();
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "source-atop";
  const rng = createSeededRng(seed ^ 0x9e3779b9);
  const cell = Math.max(8, fontSize * 0.25);
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(height / cell) + 1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cx = col * cell + (rng() - 0.5) * cell * 0.55;
      const cy = row * cell + (rng() - 0.5) * cell * 0.55;
      const kind = (row * 3 + col + Math.floor(rng() * 4)) % 5;
      const radius = Math.max(2.2, fontSize * (0.068 + rng() * 0.048));

      if (kind === 0 || kind === 1) {
        drawDaisyFlower(
          ctx,
          cx,
          cy,
          radius,
          "#ffe246",
          "#f59e0b",
          rng() * Math.PI,
        );
      } else if (kind === 2) {
        ctx.fillStyle = "#bde866";
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e5f6a8";
        ctx.beginPath();
        ctx.arc(cx - radius * 0.18, cy - radius * 0.18, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 3) {
        drawDaisyFlower(
          ctx,
          cx,
          cy,
          radius * 0.82,
          "#f9b4d8",
          "#ffe878",
          rng() * Math.PI,
        );
      } else {
        ctx.fillStyle = "#a5dd52";
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          radius * 0.72,
          radius * 0.36,
          rng() * Math.PI,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  ctx.restore();
};

export const paintHahHalftoneFill = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fontSize: number,
  glyphTop: number,
  glyphBottom: number,
  baseColor: string,
  topDotColor: string,
  bottomDotColor: string,
  dotSpacingRatio: number,
  dotRadiusRatio: number,
): void => {
  ctx.save();
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "source-atop";
  const topRgb = parseHexRgb(topDotColor);
  const botRgb = parseHexRgb(bottomDotColor);
  const spacing = Math.max(2.6, fontSize * dotSpacingRatio);
  const radius = Math.max(1.0, fontSize * dotRadiusRatio);
  const span = Math.max(1, glyphBottom - glyphTop);
  const rowStep = spacing * 0.82;
  const rows = Math.ceil(height / rowStep) + 2;
  const cols = Math.ceil(width / spacing) + 2;

  for (let row = -1; row < rows; row += 1) {
    const cy = row * rowStep;
    const t = Math.max(0, Math.min(1, (cy - glyphTop) / span));
    const r = Math.round(topRgb[0] + (botRgb[0] - topRgb[0]) * t);
    const g = Math.round(topRgb[1] + (botRgb[1] - topRgb[1]) * t);
    const b = Math.round(topRgb[2] + (botRgb[2] - topRgb[2]) * t);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    const xShift = row % 2 === 0 ? 0 : spacing * 0.5;
    for (let col = -1; col < cols; col += 1) {
      const cx = col * spacing + xShift;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

export const paintGlossTopHighlight = (
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  glyphTop: number,
  fontSize: number,
  color: string,
  opacity: number,
  coverage: number,
): void => {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const highlightH = Math.max(2, fontSize * coverage);
  const grad = ctx.createLinearGradient(0, glyphTop, 0, glyphTop + highlightH);
  grad.addColorStop(0, color);
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, glyphTop + highlightH);
  ctx.restore();
};

export const paintDryStreaksHighlight = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fontSize: number,
  color: string,
  opacity: number,
  seed: number,
): void => {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const rng = createSeededRng(seed ^ 0x517cc1b7);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  const count = Math.max(18, Math.round(width / Math.max(4, fontSize * 0.11)));
  for (let i = 0; i < count; i += 1) {
    const sx = rng() * width;
    const sy = rng() * height;
    const len = fontSize * (0.14 + rng() * 0.32);
    const angle = (rng() - 0.5) * 0.42;
    const ex = sx + Math.cos(angle) * len;
    const ey = sy + Math.sin(angle) * len;
    const cx = (sx + ex) * 0.5 + (rng() - 0.5) * len * 0.22;
    const cy = (sy + ey) * 0.5 + (rng() - 0.5) * len * 0.22;
    ctx.globalAlpha = opacity * (0.38 + rng() * 0.62);
    ctx.lineWidth = Math.max(0.8, fontSize * (0.015 + rng() * 0.02));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
};

export const applyDryBrushToCanvas = (
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  fontSize: number,
  intensity: number,
  seed: number,
  spec: Extract<TextEffectSurfaceSpec, { kind: "dry_brush" }>,
): void => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetCtx = targetCanvas.getContext("2d");
  if (!targetCtx) return;

  const rng = createSeededRng(seed ^ 0xa5a5a5a5);
  const scale = Math.max(0.15, intensity);
  const sampleStep = Math.max(4, Math.round(fontSize * 0.14));
  const maxShift = fontSize * spec.roughnessRatio * 0.45 * scale;
  const anchorCount = Math.ceil(height / sampleStep) + 2;
  const anchors = new Float32Array(anchorCount);
  for (let i = 0; i < anchorCount; i += 1) {
    anchors[i] = (rng() - 0.5) * 2 * maxShift;
  }

  for (let y = 0; y < height; y += 2) {
    const bandH = Math.min(2, height - y);
    const fIdx = y / sampleStep;
    const idx0 = Math.min(anchorCount - 1, Math.floor(fIdx));
    const idx1 = Math.min(anchorCount - 1, idx0 + 1);
    const t = fIdx - idx0;
    const smoothT = t * t * (3 - 2 * t);
    const rawShift = (anchors[idx0] ?? 0) * (1 - smoothT) + (anchors[idx1] ?? 0) * smoothT;
    const shift = Math.max(-maxShift, Math.min(maxShift, rawShift));
    targetCtx.drawImage(sourceCanvas, 0, y, width, bandH, shift, y, width, bandH);
  }

  const imageData = safeGetImageData(targetCtx, width, height);
  if (!imageData) return;

  const { data } = imageData;
  const erodeStrength = spec.edgeErode * 0.65 * Math.min(1.5, scale);
  const alphaCopy = new Uint8Array(width * height);
  for (let i = 0; i < alphaCopy.length; i += 1) {
    alphaCopy[i] = data[i * 4 + 3] ?? 0;
  }

  for (let y = 1; y < height - 2; y += 2) {
    for (let x = 1; x < width - 2; x += 2) {
      const idx = y * width + x;
      const a = alphaCopy[idx] ?? 0;
      if (a < 24) continue;
      const leftA = alphaCopy[idx - 1] ?? 0;
      const rightA = alphaCopy[idx + 1] ?? 0;
      const upA = alphaCopy[idx - width] ?? 0;
      const downA = alphaCopy[idx + width] ?? 0;
      const isEdge = leftA < 180 || rightA < 180 || upA < 180 || downA < 180;
      if (!isEdge) continue;

      const noise = rng();
      if (noise < erodeStrength) {
        const factor = 0.2 + noise * 0.35;
        for (let dy = 0; dy < 2; dy += 1) {
          for (let dx = 0; dx < 2; dx += 1) {
            const p = ((y + dy) * width + (x + dx)) * 4 + 3;
            const prev = data[p] ?? 0;
            data[p] = Math.round(prev * factor);
          }
        }
      }
    }
  }
  safePutImageData(targetCtx, imageData);

  const edgePoints: Array<{ readonly x: number; readonly y: number; readonly fromTop: boolean }> = [];
  const sampleStride = Math.max(2, Math.round(fontSize * 0.08));
  for (let y = 2; y < height - 2; y += sampleStride) {
    for (let x = 2; x < width - 2; x += sampleStride) {
      const idx = y * width + x;
      if ((alphaCopy[idx] ?? 0) < 160) continue;
      const upA = alphaCopy[idx - width * 2] ?? 0;
      const downA = alphaCopy[idx + width * 2] ?? 0;
      if (upA < 60 || downA < 60) {
        edgePoints.push({ x, y, fromTop: upA < downA });
      }
    }
  }

  if (edgePoints.length > 0) {
    targetCtx.save();
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.lineCap = "round";
    const notchCount = Math.min(
      edgePoints.length,
      Math.max(10, Math.round((width / Math.max(4, fontSize * 0.14)) * spec.bristleDensity * scale)),
    );
    const maxTiltRad = (18 * Math.PI) / 180;
    for (let i = 0; i < notchCount; i += 1) {
      const pt = edgePoints[Math.floor(rng() * edgePoints.length)];
      if (!pt) continue;
      const len = fontSize * (0.045 + rng() * 0.085);
      const tilt = (rng() - 0.5) * 2 * maxTiltRad;
      const dirY = pt.fromTop ? 1 : -1;
      const startY = pt.y - dirY * fontSize * 0.015;
      targetCtx.lineWidth = Math.max(0.65, fontSize * 0.011);
      targetCtx.globalAlpha = 0.72 + rng() * 0.28;
      targetCtx.beginPath();
      targetCtx.moveTo(pt.x, startY);
      targetCtx.lineTo(pt.x + Math.sin(tilt) * len, startY + dirY * Math.cos(tilt) * len);
      targetCtx.stroke();
    }
    targetCtx.restore();
  }
};

export const applyChalkSpeckleToCanvas = (
  canvas: HTMLCanvasElement,
  fontSize: number,
  intensity: number,
  seed: number,
  spec: Extract<TextEffectSurfaceSpec, { kind: "chalk_speckle" }>,
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = safeGetImageData(ctx, canvas.width, canvas.height);
  if (!imageData) return;

  const rng = createSeededRng(seed ^ 0x3c6ef372);
  const { width, height, data } = imageData;
  const scale = Math.max(0.2, Math.min(1.6, intensity));
  const alphaCopy = new Uint8Array(width * height);
  for (let i = 0; i < alphaCopy.length; i += 1) {
    alphaCopy[i] = data[i * 4 + 3] ?? 0;
  }

  const block = Math.max(1, Math.round(fontSize * 0.022));
  for (let y = 1; y < height - 1; y += block) {
    for (let x = 1; x < width - 1; x += block) {
      const idx = y * width + x;
      const a = alphaCopy[idx] ?? 0;
      if (a < 15) continue;
      const nearEdge =
        (alphaCopy[idx - 1] ?? 0) < 200
        || (alphaCopy[idx + 1] ?? 0) < 200
        || (alphaCopy[idx - width] ?? 0) < 200
        || (alphaCopy[idx + width] ?? 0) < 200;

      const erodeProb = nearEdge
        ? spec.edgeErode * scale
        : spec.density * 0.34 * scale;
      if (rng() < erodeProb) {
        const holeAlpha = rng() < 0.65 ? 0 : Math.round(a * 0.3);
        for (let dy = 0; dy < block && y + dy < height; dy += 1) {
          for (let dx = 0; dx < block && x + dx < width; dx += 1) {
            const p = ((y + dy) * width + (x + dx)) * 4 + 3;
            data[p] = holeAlpha;
          }
        }
      }
    }
  }
  safePutImageData(ctx, imageData);

  ctx.save();
  ctx.fillStyle = "#0b0b0b";
  const fleckTotal = Math.round(width * 0.45 * spec.fleckCount * scale);
  for (let i = 0; i < fleckTotal; i += 1) {
    const fx = Math.floor(rng() * width);
    const fy = Math.floor(rng() * height);
    const idx = fy * width + fx;
    if ((alphaCopy[idx] ?? 0) > 40) continue;
    const neighborOpaque =
      (alphaCopy[Math.max(0, idx - 2)] ?? 0) > 120
      || (alphaCopy[Math.min(alphaCopy.length - 1, idx + 2)] ?? 0) > 120
      || (alphaCopy[Math.max(0, idx - width * 2)] ?? 0) > 120
      || (alphaCopy[Math.min(alphaCopy.length - 1, idx + width * 2)] ?? 0) > 120;
    if (!neighborOpaque) continue;
    ctx.globalAlpha = 0.5 + rng() * 0.5;
    const sz = Math.max(0.8, fontSize * (0.012 + rng() * 0.016));
    ctx.fillRect(fx, fy, sz, sz);
  }
  ctx.restore();
};

export const applySplinterCrackToCanvas = (
  canvas: HTMLCanvasElement,
  fontSize: number,
  intensity: number,
  seed: number,
  spec: Extract<TextEffectSurfaceSpec, { kind: "splinter_crack" }>,
  fillColor: string,
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = safeGetImageData(ctx, canvas.width, canvas.height);
  if (!imageData) return;

  const { width, height, data } = imageData;
  const rng = createSeededRng(seed ^ 0xbb67ae85);
  const scale = Math.max(0.2, Math.min(1.8, intensity));
  const step = Math.max(2, Math.round(fontSize * 0.055));
  const maxJitterRad = (35 * Math.PI) / 180;

  ctx.save();
  for (let y = 2; y < height - 2; y += step) {
    for (let x = 2; x < width - 2; x += step) {
      const idx = y * width + x;
      const a = data[idx * 4 + 3] ?? 0;
      if (a < 130) continue;

      const leftA = data[(idx - 1) * 4 + 3] ?? 0;
      const rightA = data[(idx + 1) * 4 + 3] ?? 0;
      const upA = data[(idx - width) * 4 + 3] ?? 0;
      const downA = data[(idx + width) * 4 + 3] ?? 0;
      if (leftA >= 160 && rightA >= 160 && upA >= 160 && downA >= 160) continue;
      if (rng() > spec.jaggedness * 0.62) continue;

      const outX = leftA - rightA;
      const outY = upA - downA;
      if (Math.hypot(outX, outY) < 25) continue;

      const outwardAngle = Math.atan2(outY, outX) + (rng() - 0.5) * 2 * maxJitterRad;
      const isChip = spec.chipped && rng() < 0.34;
      const spikeAngle = isChip ? outwardAngle + Math.PI : outwardAngle;
      const len = fontSize * spec.spikeLengthRatio * scale * (0.55 + rng() * 0.9);
      const halfBase = Math.max(0.9, fontSize * (isChip ? 0.028 : 0.022));
      const perp = spikeAngle + Math.PI / 2;
      const anchorOffset = isChip ? -1.5 : -2;
      const bx = x + Math.cos(spikeAngle) * anchorOffset;
      const by = y + Math.sin(spikeAngle) * anchorOffset;

      ctx.globalCompositeOperation = isChip ? "destination-out" : "source-over";
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(perp) * halfBase, by + Math.sin(perp) * halfBase);
      ctx.lineTo(bx + Math.cos(spikeAngle) * len, by + Math.sin(spikeAngle) * len);
      ctx.lineTo(bx - Math.cos(perp) * halfBase, by - Math.sin(perp) * halfBase);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
};

export const applyInkDripsToCanvas = (
  canvas: HTMLCanvasElement,
  fontSize: number,
  intensity: number,
  seed: number,
  dripColor: string,
  maxLengthRatio: number,
  density: number,
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = safeGetImageData(ctx, canvas.width, canvas.height);
  if (!imageData) return;

  const { width, height, data } = imageData;
  const rng = createSeededRng(seed ^ 0x6a09e667);
  const scale = Math.max(0.2, Math.min(1.8, intensity));

  const bottomYByCol = new Int32Array(width).fill(-1);
  for (let x = 0; x < width; x += 1) {
    for (let y = height - 1; y >= 0; y -= 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 150) {
        bottomYByCol[x] = y;
        break;
      }
    }
  }

  const spacing = Math.max(2, Math.round(fontSize * (0.095 / Math.max(0.3, density))));
  ctx.save();
  ctx.fillStyle = dripColor;

  for (let x = 4; x < width - 4; x += spacing) {
    const startY = bottomYByCol[x] ?? -1;
    if (startY < 0 || startY > height - 4) continue;
    if (rng() > density * 0.78) continue;

    const dripLen = Math.min(
      height - startY - 2,
      fontSize * maxLengthRatio * scale * (0.35 + rng() * 0.75),
    );
    if (dripLen < 3) continue;

    const topWidth = Math.max(0.85, fontSize * (0.013 + rng() * 0.014));
    const tipY = startY + dripLen;

    ctx.globalAlpha = 0.82 + rng() * 0.18;
    ctx.beginPath();
    ctx.moveTo(x - topWidth, startY - 2);
    ctx.quadraticCurveTo(x - topWidth * 0.25, startY + dripLen * 0.45, x, tipY);
    ctx.quadraticCurveTo(x + topWidth * 0.25, startY + dripLen * 0.45, x + topWidth, startY - 2);
    ctx.closePath();
    ctx.fill();

    if (rng() < 0.35 && dripLen > fontSize * 0.22 && tipY + 4 < height) {
      const dropY = tipY + 2 + rng() * 2;
      const dropR = Math.max(0.7, topWidth * 0.36);
      ctx.beginPath();
      ctx.ellipse(x, dropY, dropR * 0.8, dropR * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

export const applyFractureBreakToCanvas = (
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  fontSize: number,
  intensity: number,
  seed: number,
  spec: Extract<TextEffectSurfaceSpec, { kind: "fracture_break" }>,
): void => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetCtx = targetCanvas.getContext("2d");
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!targetCtx || !sourceCtx) return;

  const srcData = safeGetImageData(sourceCtx, width, height);
  let minGlyphY = 0;
  let maxGlyphY = height - 1;
  if (srcData) {
    let foundTop = height;
    let foundBottom = -1;
    const { data } = srcData;
    for (let y = 0; y < height; y += 1) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x += 1) {
        if ((data[(rowOffset + x) * 4 + 3] ?? 0) > 40) {
          if (y < foundTop) foundTop = y;
          if (y > foundBottom) foundBottom = y;
        }
      }
    }
    if (foundBottom > foundTop) {
      minGlyphY = foundTop;
      maxGlyphY = foundBottom;
    }
  }

  const rng = createSeededRng(seed ^ 0x243f6a88);
  const scale = Math.max(0.2, Math.min(1.8, intensity));
  const glyphSpan = Math.max(4, maxGlyphY - minGlyphY + 1);
  const bands = Math.max(3, spec.bands);
  const bandH = Math.max(2, Math.floor(glyphSpan / bands));
  const maxShift = fontSize * spec.shiftRatio * scale;

  const seamYs: number[] = [];
  let cursorY = minGlyphY;
  for (let b = 0; b < bands && cursorY <= maxGlyphY; b += 1) {
    const remaining = maxGlyphY + 1 - cursorY;
    const h = b === bands - 1 ? remaining : Math.max(2, Math.round(bandH * (0.78 + rng() * 0.44)));
    const clampedH = Math.min(h, remaining);
    const direction = b % 2 === 0 ? 1 : -1;
    const shiftX = direction * maxShift * (0.45 + rng() * 0.65);
    targetCtx.drawImage(sourceCanvas, 0, cursorY, width, clampedH, shiftX, cursorY, width, clampedH);
    cursorY += clampedH;
    if (cursorY <= maxGlyphY - 1) seamYs.push(cursorY);
  }

  targetCtx.save();
  targetCtx.globalCompositeOperation = "destination-out";
  targetCtx.strokeStyle = "#000000";
  targetCtx.lineWidth = Math.max(0.9, fontSize * spec.crackWidthRatio * scale);
  targetCtx.lineJoin = "miter";
  for (const seamY of seamYs) {
    targetCtx.beginPath();
    targetCtx.moveTo(0, seamY);
    const stepX = Math.max(4, fontSize * 0.13);
    for (let x = stepX; x <= width + stepX; x += stepX) {
      const jy = seamY + (rng() - 0.5) * fontSize * 0.065;
      targetCtx.lineTo(x, jy);
    }
    targetCtx.stroke();

    const branchCount = Math.max(2, Math.round(width / Math.max(12, fontSize * 1.4)));
    for (let i = 0; i < branchCount; i += 1) {
      const bx = rng() * width;
      const bLen = fontSize * (0.06 + rng() * 0.08);
      const bDir = rng() < 0.5 ? -1 : 1;
      targetCtx.lineWidth = Math.max(0.7, fontSize * spec.crackWidthRatio * 0.6 * scale);
      targetCtx.beginPath();
      targetCtx.moveTo(bx, seamY);
      targetCtx.lineTo(bx + (rng() - 0.5) * bLen, seamY + bDir * bLen);
      targetCtx.stroke();
    }
    targetCtx.lineWidth = Math.max(0.9, fontSize * spec.crackWidthRatio * scale);
  }
  targetCtx.restore();
};
