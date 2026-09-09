import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  CONTAINER_UPLOAD_EXTENSIONS,
  DIRECT_IMAGE_UPLOAD_EXTENSIONS,
} from "../constants/dashboard.constants";
import type { LoadedImage } from "../types/dashboard.types";
import type { TypographyDetectedGradient } from "../typography/types";
import type { RenderTextStyle } from "./renderText";
import { canvasToBlob } from "./dashboard.rendering.utils";
import { collectInlineRenderTextFontFamilies } from "./renderTextStyleRanges";
import { parseFillPickerValue } from "./textFillPicker";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(num, min), max);

export const normalizeRgbTriplet = (
  value: unknown,
): [number, number, number] | undefined => {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const [r, g, b] = value;
  if (![r, g, b].every((channel) => Number.isFinite(Number(channel)))) {
    return undefined;
  }
  return [
    Math.round(Number(r)),
    Math.round(Number(g)),
    Math.round(Number(b)),
  ];
};

export const normalizeDetectedGradientAngle = (value: unknown): number => {
  if (!Number.isFinite(Number(value))) return 90;
  let normalized = Number(value) % 360;
  if (normalized < 0) normalized += 360;
  return Math.round(normalized * 10) / 10;
};

export const normalizeDetectedGradient = (
  value: unknown,
): TypographyDetectedGradient | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const source = value as {
    start_rgb?: unknown;
    end_rgb?: unknown;
    angle_degrees?: unknown;
  };
  const startRgb = normalizeRgbTriplet(source.start_rgb);
  const endRgb = normalizeRgbTriplet(source.end_rgb);
  if (!startRgb || !endRgb) return undefined;
  return {
    startRgb,
    endRgb,
    angle: normalizeDetectedGradientAngle(source.angle_degrees),
  };
};



export const getFileExtension = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return normalized.slice(lastDotIndex);
};

export const inferMimeTypeFromFileName = (fileName: string): string => {
  const ext = getFileExtension(fileName);
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
};

export const isDirectImageUploadFile = (file: File): boolean => {
  const ext = getFileExtension(file.name);
  return DIRECT_IMAGE_UPLOAD_EXTENSIONS.has(ext);
};

export const isContainerUploadFile = (file: File): boolean => {
  const ext = getFileExtension(file.name);
  return CONTAINER_UPLOAD_EXTENSIONS.has(ext);
};

export const getImageExtensionFromMime = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  return "png";
};

export const removeFileExtension = (fileName: string): string =>
  fileName.replace(/\.[^/.]+$/, "");

export const sanitizeArchivePathToken = (value: string): string =>
  value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "item";

export const normalizeRenderRotation = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  let normalized = value % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return Math.round(normalized * 10) / 10;
};

export const normalizeRenderSkew = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, -45, 45) * 10) / 10;
};

export const buildShadowFillPickerValue = (style: RenderTextStyle): string => (
  style.shadowGradientEnabled
    ? (
      style.shadowFillCssValue
      || `linear-gradient(${Math.round(style.shadowGradientAngle || 90)}deg, ${style.shadowGradientStartColor || style.shadowColor} 0%, ${style.shadowGradientEndColor || style.shadowColor} 100%)`
    )
    : (style.shadowFillCssValue || style.shadowColor || "#000000")
);

export const applyShadowFillPickerValueToStyle = (
  style: RenderTextStyle,
  nextValue: string,
): RenderTextStyle => {
  const nextFill = parseFillPickerValue(nextValue, style.shadowColor || "#000000");
  return {
    ...style,
    shadowColor: nextFill.color,
    shadowFillCssValue: nextFill.fillCssValue,
    shadowGradientEnabled: nextFill.gradientEnabled,
    shadowGradientStartColor: nextFill.gradientStartColor,
    shadowGradientEndColor: nextFill.gradientEndColor,
    shadowGradientAngle: nextFill.gradientAngle,
  };
};

export const createDefaultShadowLayer = (): NonNullable<RenderTextStyle["shadowLayers"]>[number] => ({
  fillCssValue: "#000000",
  opacity: 0.6,
  blur: 8,
  offsetX: 0,
  offsetY: 0,
});

export const getRotatedDims = (img: LoadedImage) => {
  const isSideways = img.rotation === 90 || img.rotation === 270;
  return {
    width: isSideways ? img.height : img.width,
    height: isSideways ? img.width : img.height,
  };
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const loadImageFromSource = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to convert the blob to a Data URL."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read the blob."));
    reader.readAsDataURL(blob);
  });





export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("Invalid data URL for blob conversion.");
  }
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex <= 4) {
    throw new Error("Invalid data URL for blob conversion.");
  }

  const meta = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const metaParts = meta.split(";").map((part) => part.trim()).filter(Boolean);
  const mimeType = metaParts.find((part) => part.includes("/")) || "application/octet-stream";
  const isBase64 = metaParts.includes("base64");

  if (!isBase64) {
    const decoded = decodeURIComponent(payload);
    return new Blob([decoded], { type: mimeType });
  }

  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

export const parseResponseErrorMessage = async (response: Response): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; user_message?: string; detail?: string | { error?: string; detail?: string; user_message?: string } }
    | null;
  if (typeof payload?.user_message === "string" && payload.user_message.trim().length > 0) {
    return payload.user_message;
  }
  if (typeof payload?.detail === "string" && payload.detail.trim().length > 0) {
    return payload.detail;
  }
  if (
    payload?.detail
    && typeof payload.detail === "object"
    && !Array.isArray(payload.detail)
  ) {
    const nested = payload.detail as { error?: string; detail?: string; user_message?: string };
    if (typeof nested.user_message === "string" && nested.user_message.trim().length > 0) {
      return nested.user_message;
    }
    if (typeof nested.error === "string" && nested.error.trim().length > 0) {
      return nested.error;
    }
    if (typeof nested.detail === "string" && nested.detail.trim().length > 0) {
      return nested.detail;
    }
  }
  return payload?.error ?? `HTTP ${response.status}`;
};

export const readExecutionFallbackNotice = (
  response: Response,
  stageLabel: string,
): string | null => {
  const fallbackCode = response.headers.get("X-Koma-Execution-Fallback");
  if (fallbackCode !== "gpu_oom_to_cpu") {
    return null;
  }
  const modelKey = response.headers.get("X-Koma-Execution-Model") || "auto";
  return `Model "${modelKey}" fell back to CPU due to insufficient VRAM during the "${stageLabel}" stage. Processing continued on CPU and may be slower.`;
};

export const readExecutionRuntimeNotice = async (
  response: Response,
  stageLabel: string,
): Promise<{ title: string; detail: string; tone: "fallback" } | { title: string; detail: string; tone: "fallback" | "legacy" } | null> => {
  const fallbackNotice = readExecutionFallbackNotice(response, stageLabel);
  if (fallbackNotice) {
    return {
      title: "Fallback para CPU",
      detail: fallbackNotice,
      tone: "fallback",
    };
  }

  const payload = (await response.clone().json().catch(() => null)) as
    | {
      detail?: {
        error?: string;
        code?: string;
        stage_label?: string;
        model_key?: string;
        cpu_fallback_attempted?: boolean;
      } | string;
    }
    | null;

  if (!payload?.detail || typeof payload.detail === "string") {
    return null;
  }

  const detail = payload.detail;
  if (detail.code !== "INSUFFICIENT_VRAM" || typeof detail.error !== "string") {
    return null;
  }

  return {
    title: "Fallback failed",
    detail: detail.error.trim().length > 0
      ? detail.error
      : `Could not finish the "${detail.stage_label ?? stageLabel}" stage after falling back to CPU.`,
    tone: "legacy",
  };
};

export const sanitizeWebhookErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "Unknown error.");
  return rawMessage.replace(/\s+/g, " ").trim().slice(0, 300);
};

export const resolveDownloadFileName = (
  contentDisposition: string | null,
  fallback: string,
): string => {
  if (!contentDisposition) return fallback;

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) return basicMatch[1].trim();

  return fallback;
};

export const normalizeBlobForPdf = async (blob: Blob): Promise<Blob> => {
  if (blob.type === "image/png" || blob.type === "image/jpeg") return blob;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageFromSource(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to convert the image to PDF.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas, "image/png", 1);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const normalizeFontFamilyForCanvas = (value: string): string => {
  const firstFamily = value.split(",")[0]?.trim() ?? "";
  const unquoted = firstFamily.replace(/^["']+|["']+$/g, "").trim();
  return unquoted;
};

const loadedCanvasFontKeys = new Set<string>();

export const resetLoadedCanvasFontCache = (): void => {
  loadedCanvasFontKeys.clear();
};

export const ensureCanvasFontLoaded = async (
  style: RenderTextStyle,
  ranges?: { style: Partial<RenderTextStyle> }[],
): Promise<void> => {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const families = new Set<string>([
    normalizeFontFamilyForCanvas(style.fontFamily),
    ...collectInlineRenderTextFontFamilies(ranges).map((family) =>
      normalizeFontFamilyForCanvas(family),
    ),
  ]);

  await Promise.all(
    [...families]
      .filter(Boolean)
      .map(async (family) => {
        const escapedFamily = family.replace(/["\\]/g, "\\$&");
        const key = `${family.toLowerCase()}|${style.bold ? "700" : "400"}|${style.italic ? "italic" : "normal"}`;
        const fontRequest = `${style.italic ? "italic " : ""}${style.bold ? "700 " : "400 "}16px "${escapedFamily}"`;

        if (loadedCanvasFontKeys.has(key) && document.fonts.check(fontRequest)) return;
        if (document.fonts.check(fontRequest)) {
          loadedCanvasFontKeys.add(key);
          return;
        }

        try {
          const loadedFaces = await Promise.race([
            document.fonts.load(fontRequest),
            new Promise<FontFace[]>((resolve) => {
              window.setTimeout(() => resolve([]), 1200);
            }),
          ]);
          if ((loadedFaces?.length ?? 0) > 0 && document.fonts.check(fontRequest)) {
            loadedCanvasFontKeys.add(key);
            return;
          }
        } catch {
          // Ignore load errors; canvas will fallback if font is unavailable.
        }
        loadedCanvasFontKeys.delete(key);
      }),
  );
};

export const copyTextToClipboardSafe = async (text: string): Promise<void> => {
  const normalized = text.trim();
  if (!normalized) return;
  try {
    await navigator.clipboard.writeText(normalized);
    return;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = normalized;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
};

export * from "./dashboard.region.utils";
export * from "./dashboard.rendering.utils";
