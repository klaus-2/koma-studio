import {
  DEFAULT_BLOGGER_CONFIG,
  normalizeBloggerConfig,
  resolveBloggerOptimizedUrl,
  type BloggerConfig,
  type BloggerConnectionResult,
  type BloggerPreprocessConfig,
  type BloggerPublishPayload,
  type BloggerPublishResult,
  type BloggerUploadItemInput,
  type BloggerUploadPayload,
  type BloggerUploadResult,
} from "../../../../packages/types/src/blogger";
import {
  buildBloggerImageTag,
  parseBloggerLabels,
} from "./blogger-shared";

import { desktopBridge } from "@/lib/desktop-bridge";
const BLOGGER_STORAGE_KEY = "koma-studio.blogger-config.v1";

const isBrowser = (): boolean => typeof window !== "undefined";

const toBase64Payload = async (blob: Blob): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to convert the blob to base64."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read the blob."));
    reader.readAsDataURL(blob);
  });

  const [, base64 = ""] = dataUrl.split(",", 2);
  return base64;
};

const loadImageElement = async (file: File): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not open ${file.name}.`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const replaceFileExtension = (fileName: string, extension: string): string => {
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return fileName.replace(/\.[^.]+$/u, "") + safeExtension;
};

const resolveCanvasMimeType = (
  file: File,
  preprocess: BloggerPreprocessConfig,
): { mimeType: string; fileName: string } => {
  switch (preprocess.outputFormat) {
    case "jpeg":
      return { mimeType: "image/jpeg", fileName: replaceFileExtension(file.name, ".jpg") };
    case "png":
      return { mimeType: "image/png", fileName: replaceFileExtension(file.name, ".png") };
    case "webp":
      return { mimeType: "image/webp", fileName: replaceFileExtension(file.name, ".webp") };
    default:
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        return {
          mimeType: file.type,
          fileName: file.name,
        };
      }
      return { mimeType: "image/png", fileName: replaceFileExtension(file.name, ".png") };
  }
};

const readBrowserConfig = (): BloggerConfig => {
  if (!isBrowser() || !window.localStorage) {
    return { ...DEFAULT_BLOGGER_CONFIG };
  }

  try {
    const raw = window.localStorage.getItem(BLOGGER_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_BLOGGER_CONFIG };
    }
    return normalizeBloggerConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BLOGGER_CONFIG };
  }
};

const writeBrowserConfig = (config: BloggerConfig): BloggerConfig => {
  const normalized = normalizeBloggerConfig(config);
  if (isBrowser() && window.localStorage) {
    window.localStorage.setItem(BLOGGER_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
};

export const serializeBloggerLabels = (labels: string[]): string => labels.join(", ");

export const deserializeBloggerLabels = (value: string): string[] => parseBloggerLabels(value);

export const loadBloggerConfig = async (): Promise<{
  config: BloggerConfig;
  secureStorage: boolean;
}> => {
  const bridge = desktopBridge.desktop?.api?.blogger;
  if (bridge) {
    return bridge.loadConfig();
  }

  return {
    config: readBrowserConfig(),
    secureStorage: false,
  };
};

export const saveBloggerConfig = async (
  config: BloggerConfig,
): Promise<{
  config: BloggerConfig;
  secureStorage: boolean;
}> => {
  const normalized = normalizeBloggerConfig(config);
  const bridge = desktopBridge.desktop?.api?.blogger;
  if (bridge) {
    return bridge.saveConfig(normalized);
  }

  return {
    config: writeBrowserConfig(normalized),
    secureStorage: false,
  };
};

export const testBloggerConnection = async (config?: BloggerConfig): Promise<BloggerConnectionResult> => {
  const bridge = desktopBridge.desktop?.api?.blogger;
  if (!bridge) {
    throw new Error("The Blogger connection test is available only in the desktop app.");
  }

  return bridge.testConnection(config ? normalizeBloggerConfig(config) : undefined);
};

export const uploadBloggerImages = async (
  payload: BloggerUploadPayload,
): Promise<{
  items: BloggerUploadResult[];
  optimizerApplied: boolean;
}> => {
  const bridge = desktopBridge.desktop?.api?.blogger;
  if (!bridge) {
    throw new Error("Blogger upload is available only in the desktop app.");
  }

  return bridge.uploadImages(payload);
};

export const publishBloggerPost = async (
  payload: BloggerPublishPayload,
): Promise<BloggerPublishResult> => {
  const bridge = desktopBridge.desktop?.api?.blogger;
  if (!bridge) {
    throw new Error("Publishing to Blogger is available only in the desktop app.");
  }

  return bridge.publishPost(payload);
};

export const preprocessBloggerImageFile = async (
  file: File,
  preprocess: BloggerPreprocessConfig,
): Promise<BloggerUploadItemInput> => {
  const normalized = normalizeBloggerConfig({
    ...DEFAULT_BLOGGER_CONFIG,
    preprocess,
  }).preprocess;

  if (!normalized.enabled) {
    const base64 = await toBase64Payload(file);
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      mimeType: file.type,
      contentBase64: base64,
      width: undefined,
      height: undefined,
      byteLength: file.size,
    };
  }

  const image = await loadImageElement(file);
  const scale = Math.min(
    1,
    normalized.maxWidth / Math.max(image.naturalWidth, 1),
    normalized.maxHeight / Math.max(image.naturalHeight, 1),
  );
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const { mimeType, fileName } = resolveCanvasMimeType(file, normalized);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable for preprocessing.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error(`Failed to re-encode ${file.name}.`));
      },
      mimeType,
      normalized.quality,
    );
  });

  const contentBase64 = await toBase64Payload(blob);
  return {
    id: crypto.randomUUID(),
    fileName,
    mimeType,
    contentBase64,
    width: targetWidth,
    height: targetHeight,
    byteLength: blob.size,
  };
};

export interface BloggerBulkOutputOptions {
  preferOptimizedUrl: boolean;
  asImageTag: boolean;
}

export const buildBloggerBulkOutput = (
  results: BloggerUploadResult[],
  options: BloggerBulkOutputOptions,
): string =>
  results
    .map((item) => {
      const selectedUrl =
        options.preferOptimizedUrl && item.optimizedUrl
          ? item.optimizedUrl
          : item.canonicalUrl;
      return options.asImageTag
        ? buildBloggerImageTag(selectedUrl, item.altText)
        : selectedUrl;
    })
    .join("\n");

export const previewOptimizerUrl = (config: BloggerConfig, canonicalUrl: string): string | null =>
  resolveBloggerOptimizedUrl(config.optimizer, canonicalUrl);
