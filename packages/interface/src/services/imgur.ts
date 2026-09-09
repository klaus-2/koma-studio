import {
  DEFAULT_IMGUR_CONFIG,
  normalizeImgurConfig,
  type ImgurConfig,
  type ImgurRateLimitStatus,
  type ImgurUploadItemInput,
  type ImgurUploadPayload,
  type ImgurUploadResult,
} from "../../../../packages/types/src/imgur";

import { desktopBridge } from "@/lib/desktop-bridge";
const IMGUR_STORAGE_KEY = "koma-studio.imgur-config.v1";

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

const readBrowserConfig = (): ImgurConfig => {
  if (!isBrowser() || !window.localStorage) {
    return { ...DEFAULT_IMGUR_CONFIG };
  }

  try {
    const raw = window.localStorage.getItem(IMGUR_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_IMGUR_CONFIG };
    }
    return normalizeImgurConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_IMGUR_CONFIG };
  }
};

const writeBrowserConfig = (config: ImgurConfig): ImgurConfig => {
  const normalized = normalizeImgurConfig(config);
  if (isBrowser() && window.localStorage) {
    window.localStorage.setItem(IMGUR_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
};

export const loadImgurConfig = async (): Promise<{
  config: ImgurConfig;
  secureStorage: boolean;
  rateLimit: ImgurRateLimitStatus;
}> => {
  const bridge = desktopBridge.desktop?.api?.imgur;
  if (bridge) {
    return bridge.loadConfig();
  }

  return {
    config: readBrowserConfig(),
    secureStorage: false,
    rateLimit: {
      limitPerHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
      usedThisHour: 0,
      remainingThisHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
      resetsAt: null,
    },
  };
};

export const saveImgurConfig = async (
  config: ImgurConfig,
): Promise<{
  config: ImgurConfig;
  secureStorage: boolean;
  rateLimit: ImgurRateLimitStatus;
}> => {
  const normalized = normalizeImgurConfig(config);
  const bridge = desktopBridge.desktop?.api?.imgur;
  if (bridge) {
    return bridge.saveConfig(normalized);
  }

  return {
    config: writeBrowserConfig(normalized),
    secureStorage: false,
    rateLimit: {
      limitPerHour: normalized.rateLimitPerHour,
      usedThisHour: 0,
      remainingThisHour: normalized.rateLimitPerHour,
      resetsAt: null,
    },
  };
};

export const preprocessImgurImageFile = async (file: File): Promise<ImgurUploadItemInput> => {
  const base64 = await toBase64Payload(file);
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    mimeType: file.type || "image/png",
    contentBase64: base64,
    altText: file.name.replace(/\.[^.]+$/u, ""),
    byteLength: file.size,
  };
};

export const uploadImgurImages = async (
  payload: ImgurUploadPayload,
): Promise<{
  items: ImgurUploadResult[];
  rateLimit: ImgurRateLimitStatus;
}> => {
  const bridge = desktopBridge.desktop?.api?.imgur;
  if (!bridge) {
    throw new Error("Imgur upload is available only in the desktop app.");
  }

  return bridge.uploadImages(payload);
};

export const buildImgurBulkOutput = (
  results: ImgurUploadResult[],
  asImageTag: boolean,
): string =>
  results
    .map((item) =>
      asImageTag
        ? `<img src="${item.directUrl}" alt="${item.altText.replace(/"/g, "&quot;")}" />`
        : item.directUrl,
    )
    .join("\n");
