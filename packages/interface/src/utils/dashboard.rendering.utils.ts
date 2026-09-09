import {
  DEFAULT_RENDER_STYLE,
  MAGIC_WAND_MAX_PIXELS,
  TRANSLATION_NOTE_REGION_PREFIX,
} from "../constants/dashboard.constants";
import type {
  AioPresetEditorDraft,
  AioTextRegion,
  ImageFilters,
  TranslatorStructuredTextInput,
} from "../types/dashboard.types";
import type { AioStageSelection } from "../types/aioModelPresets";
import type { FreeProviderStage } from "../models/freeAiProviderCatalog";
import type { RenderTextStyle } from "./renderText";
import { cloneRenderTextStyleRanges } from "./renderTextStyleRanges";
import { normalizeTranslationNotes } from "./dashboard.region.utils";

const clampNumber = (num: number, min: number, max: number): number =>
  Math.min(Math.max(num, min), max);

const normalizeDetectedGradientAngleValue = (value: unknown): number => {
  if (!Number.isFinite(Number(value))) return 90;
  let normalized = Number(value) % 360;
  if (normalized < 0) normalized += 360;
  return Math.round(normalized * 10) / 10;
};

const rgbTripletToHexValue = (value: [number, number, number]): string =>
  `#${value
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`;

export const maskCanvasHasVisibleContent = (canvas: HTMLCanvasElement): boolean => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 0) return true;
  }
  return false;
};

export const buildMagicWandMaskDataUrl = (
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number,
): string | null => {
  const { width, height, data } = imageData;
  if (width <= 0 || height <= 0) return null;
  const totalPixels = width * height;
  if (totalPixels > MAGIC_WAND_MAX_PIXELS) {
    throw new Error(
      `Magic wand disabled for very large images (${width}x${height}).`,
    );
  }

  const seedX = clampNumber(Math.round(startX), 0, width - 1);
  const seedY = clampNumber(Math.round(startY), 0, height - 1);
  const seedIndex = (seedY * width) + seedX;
  const seedOffset = seedIndex * 4;
  const seedR = data[seedOffset] ?? 0;
  const seedG = data[seedOffset + 1] ?? 0;
  const seedB = data[seedOffset + 2] ?? 0;

  const threshold = clampNumber(Math.round(tolerance), 0, 255);
  const thresholdSq = threshold * threshold * 3;
  const visited = new Uint8Array(totalPixels);
  const mask = new Uint8Array(totalPixels);
  const stack: number[] = [seedIndex];
  visited[seedIndex] = 1;

  while (stack.length > 0) {
    const current = stack.pop()!;
    const offset = current * 4;
    const dr = (data[offset] ?? 0) - seedR;
    const dg = (data[offset + 1] ?? 0) - seedG;
    const db = (data[offset + 2] ?? 0) - seedB;
    const distanceSq = (dr * dr) + (dg * dg) + (db * db);
    if (distanceSq > thresholdSq) continue;

    mask[current] = 255;
    const x = current % width;
    const y = Math.floor(current / width);

    if (x > 0) {
      const next = current - 1;
      if (!visited[next]) {
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (x < width - 1) {
      const next = current + 1;
      if (!visited[next]) {
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (y > 0) {
      const next = current - width;
      if (!visited[next]) {
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (y < height - 1) {
      const next = current + width;
      if (!visited[next]) {
        visited[next] = 1;
        stack.push(next);
      }
    }
  }

  let selectedCount = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if ((mask[index] ?? 0) > 0) selectedCount += 1;
  }
  if (selectedCount === 0) return null;

  const border = new Uint8Array(totalPixels);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (
      x === 0
      || y === 0
      || x === width - 1
      || y === height - 1
      || mask[pixel - 1] === 0
      || mask[pixel + 1] === 0
      || mask[pixel - width] === 0
      || mask[pixel + width] === 0
    ) {
      border[pixel] = 1;
    }
  }

  const thickBorder = new Uint8Array(totalPixels);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (border[pixel] === 1) {
      thickBorder[pixel] = 1;
      continue;
    }
    if (
      (x > 0 && border[pixel - 1] === 1)
      || (x < width - 1 && border[pixel + 1] === 1)
      || (y > 0 && border[pixel - width] === 1)
      || (y < height - 1 && border[pixel + width] === 1)
    ) {
      thickBorder[pixel] = 1;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const out = ctx.createImageData(width, height);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 0) continue;
    const offset = pixel * 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);

    if (thickBorder[pixel] === 1) {
      const dashOn = ((x + y) % 10) < 5;
      out.data[offset] = dashOn ? 255 : 16;
      out.data[offset + 1] = dashOn ? 255 : 16;
      out.data[offset + 2] = dashOn ? 255 : 16;
      out.data[offset + 3] = 245;
      continue;
    }

    const stripe = ((x + (y * 2)) % 18) < 9;
    out.data[offset] = stripe ? 25 : 6;
    out.data[offset + 1] = stripe ? 177 : 132;
    out.data[offset + 2] = stripe ? 255 : 244;
    out.data[offset + 3] = stripe ? 138 : 116;
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL("image/png");
};

export const applyImageFilters = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filters: ImageFilters,
) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;
  const levelsLUT = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    let val = (i - filters.levels.black) / (filters.levels.white - filters.levels.black);
    val = Math.pow(Math.max(0, Math.min(1, val)), 1 / filters.levels.gamma);
    levelsLUT[i] = clampNumber(val * 255, 0, 255);
  }
  const contrastFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast));
  for (let i = 0; i < len; i += 4) {
    let r = data[i] ?? 0;
    let g = data[i + 1] ?? 0;
    let b = data[i + 2] ?? 0;
    r = levelsLUT[r] ?? 0;
    g = levelsLUT[g] ?? 0;
    b = levelsLUT[b] ?? 0;
    r = clampNumber(contrastFactor * (r - 128) + 128 + filters.brightness, 0, 255);
    g = clampNumber(contrastFactor * (g - 128) + 128 + filters.brightness, 0, 255);
    b = clampNumber(contrastFactor * (b - 128) + 128 + filters.brightness, 0, 255);
    const gray = (0.2989 * r) + (0.587 * g) + (0.114 * b);
    if (filters.grayscale) {
      r = g = b = gray;
    } else if (filters.saturation !== 0) {
      const satMult = 1 + (filters.saturation / 100);
      r = clampNumber(gray + (satMult * (r - gray)), 0, 255);
      g = clampNumber(gray + (satMult * (g - gray)), 0, 255);
      b = clampNumber(gray + (satMult * (b - gray)), 0, 255);
    }
    if (filters.inverted) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(imgData, 0, 0);
  if (filters.sharpen > 0) {
    applyConvolution(ctx, width, height, [
      0, -(filters.sharpen / 10), 0,
      -(filters.sharpen / 10), 1 + (4 * (filters.sharpen / 10)), -(filters.sharpen / 10),
      0, -(filters.sharpen / 10), 0,
    ]);
  }
};

export const applyConvolution = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kernel: number[],
) => {
  const srcData = ctx.getImageData(0, 0, w, h);
  const dstData = ctx.createImageData(w, h);
  const src = srcData.data;
  const dst = dstData.data;
  const side = Math.round(Math.sqrt(kernel.length));
  const halfSide = Math.floor(side / 2);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let cy = 0; cy < side; cy += 1) {
        for (let cx = 0; cx < side; cx += 1) {
          const scy = y + cy - halfSide;
          const scx = x + cx - halfSide;
          if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
            const srcOff = (scy * w + scx) * 4;
            const wt = kernel[(cy * side) + cx] ?? 0;
            r += (src[srcOff] ?? 0) * wt;
            g += (src[srcOff + 1] ?? 0) * wt;
            b += (src[srcOff + 2] ?? 0) * wt;
          }
        }
      }
      const dstOff = (y * w + x) * 4;
      dst[dstOff] = clampNumber(r, 0, 255);
      dst[dstOff + 1] = clampNumber(g, 0, 255);
      dst[dstOff + 2] = clampNumber(b, 0, 255);
      dst[dstOff + 3] = src[((y * w + x) * 4) + 3] ?? 255;
    }
  }
  ctx.putImageData(dstData, 0, 0);
};

export const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate the file."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

export const drawRotated = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
) => {
  ctx.save();
  ctx.translate(x + (w / 2), y + (h / 2));
  ctx.rotate((rotation * Math.PI) / 180);
  if (rotation === 90 || rotation === 270) {
    ctx.drawImage(img, -(h / 2), -(w / 2), h, w);
  } else {
    ctx.drawImage(img, -(w / 2), -(h / 2), w, h);
  }
  ctx.restore();
};

export const createEmptyAioPresetEditorDraft = (
  stageModels: AioStageSelection,
): AioPresetEditorDraft => ({
  presetId: null,
  name: "",
  description: "",
  stageModels: { ...stageModels },
  setAsActive: true,
});



export const normalizePresetLanguage = (value: string): string =>
  value.trim().toLowerCase();

export const toFreeProviderDraftKey = (
  stage: FreeProviderStage,
  providerId: string,
): string => `${stage}::${providerId}`;

export const cloneRenderStyle = (style?: RenderTextStyle): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  ...style,
  shadowLayers: style?.shadowLayers
    ? style.shadowLayers.map((layer) => ({ ...layer }))
    : undefined,
});

export const applyDetectedGradientToStyle = (
  region: AioTextRegion,
  style: RenderTextStyle,
): RenderTextStyle => {
  const nextStyle = cloneRenderStyle(style);
  if (nextStyle.gradientEnabled) {
    return {
      ...nextStyle,
      fillCssValue: nextStyle.fillCssValue
        || `linear-gradient(${Math.round(nextStyle.gradientAngle)}deg, ${nextStyle.gradientStartColor || nextStyle.color} 0%, ${nextStyle.gradientEndColor || nextStyle.color} 100%)`,
    };
  }
  if (!nextStyle.detectGradient) {
    return {
      ...nextStyle,
      fillCssValue: nextStyle.fillCssValue || nextStyle.color,
    };
  }
  if (!region.detectedGradient) {
    return {
      ...nextStyle,
      fillCssValue: nextStyle.fillCssValue || nextStyle.color,
    };
  }
  const gradientAngle = normalizeDetectedGradientAngleValue(region.detectedGradient.angle);
  const gradientFillCssValue = `linear-gradient(${Math.round(gradientAngle)}deg, ${rgbTripletToHexValue(region.detectedGradient.startRgb)} 0%, ${rgbTripletToHexValue(region.detectedGradient.endRgb)} 100%)`;
  return {
    ...nextStyle,
    fillCssValue: gradientFillCssValue,
    gradientEnabled: true,
    gradientStartColor: rgbTripletToHexValue(region.detectedGradient.startRgb),
    gradientEndColor: rgbTripletToHexValue(region.detectedGradient.endRgb),
    gradientAngle,
  };
};

export const parseTranslatorStructuredTextInput = (
  rawText: string,
): TranslatorStructuredTextInput | null => {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const values = parsed as string[];
      return {
        regions: values.map((value, index) => ({
          id: `item_${index}`,
          text: value,
          source: "manual",
          detector_model_key: "translator_text",
          ocr_model_key: "translator_text",
        })),
        reconstruct: (translatedById) => JSON.stringify(
          values.map((value, index) => translatedById.get(`item_${index}`) ?? value),
          null,
          2,
        ),
      };
    }

    if (
      parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
      && Object.values(parsed).every((value) => typeof value === "string")
    ) {
      const entries = Object.entries(parsed as Record<string, string>);
      return {
        regions: entries.map(([key, value]) => ({
          id: key,
          text: value,
          source: "manual",
          detector_model_key: "translator_text",
          ocr_model_key: "translator_text",
        })),
        reconstruct: (translatedById) => JSON.stringify(
          Object.fromEntries(
            entries.map(([key, value]) => [key, translatedById.get(key) ?? value]),
          ),
          null,
          2,
        ),
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const buildTranslationNoteOverlayRegions = (
  regions: AioTextRegion[],
  imageWidth: number,
  imageHeight: number,
  fallbackStyle: RenderTextStyle,
  notesEnabled: boolean,
): AioTextRegion[] => {
  if (!notesEnabled) return [];

  return regions.flatMap((region) => {
    const notes = normalizeTranslationNotes(region.translationNotes);
    if (!notes || notes.length === 0) return [];

    const [x1, y1, x2, y2] = region.bbox;
    const regionWidth = Math.max(1, x2 - x1);
    const estimatedLines = notes.reduce(
      (total, note) => total + Math.max(1, Math.ceil(note.length / 28)),
      0,
    );
    const overlayWidth = clampNumber(
      Math.round(Math.max(regionWidth, Math.min(imageWidth * 0.34, 220))),
      80,
      imageWidth,
    );
    const overlayHeight = clampNumber(
      (estimatedLines * 14) + 12,
      22,
      Math.max(22, Math.round(imageHeight * 0.28)),
    );
    const preferredLeft = clampNumber(x1, 0, Math.max(0, imageWidth - overlayWidth));
    const belowTop = y2 + 6;
    const top = belowTop + overlayHeight <= imageHeight
      ? belowTop
      : clampNumber(y1 - overlayHeight - 6, 0, Math.max(0, imageHeight - overlayHeight));
    const left = preferredLeft;
    const noteText = region.translationNoteOverlay?.renderText?.trim() || notes.join("\n");
    const noteStyle = {
      ...cloneRenderStyle(region.renderStyle ?? fallbackStyle),
      alignment: "left" as const,
      autoFontSize: false,
      fontSize: 10,
      minFontSize: 8,
      outlineWidth: 1,
      ...region.translationNoteOverlay?.renderStyle,
    };
    const noteBbox = region.translationNoteOverlay?.bbox
      ?? [left, top, left + overlayWidth, top + overlayHeight];

    return [{
      id: `${TRANSLATION_NOTE_REGION_PREFIX}${region.id}`,
      bbox: noteBbox,
      score: region.score,
      source: region.source,
      modelKey: region.modelKey,
      detectorModelKey: region.detectorModelKey,
      detectedForegroundRgb: region.detectedForegroundRgb,
      structuralType: region.structuralType,
      structuralConfidence: region.structuralConfidence,
      structuralSource: region.structuralSource,
      matchedReferenceImage: region.matchedReferenceImage,
      detectedRenderMode: region.detectedRenderMode,
      renderMode: "auto",
      recognizedText: "",
      ocrScore: region.ocrScore,
      ocrModelKey: region.ocrModelKey,
      translatedText: noteText,
      translationNotes: notes,
      translatorModelKey: region.translatorModelKey,
      segmentBoxes: undefined,
      mergedSegmentBoxes: undefined,
      segmentModelKey: region.segmentModelKey,
      renderText: noteText,
      renderStyle: noteStyle,
      renderTextStyleRanges: cloneRenderTextStyleRanges(
        region.translationNoteOverlay?.renderTextStyleRanges,
      ),
    }];
  });
};
