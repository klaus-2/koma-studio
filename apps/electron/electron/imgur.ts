import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_IMGUR_CONFIG,
  calculateImgurRateLimitStatus,
  normalizeImgurConfig,
  type ImgurClientKey,
  type ImgurConfig,
  type ImgurRateLimitStatus,
  type ImgurUploadPayload,
  type ImgurUploadResult,
} from "../../../packages/types/src/imgur.ts";

interface ImgurConfigEnvelope {
  encrypted: boolean;
  payload: string;
}

interface ImgurRateState {
  uploadTimestamps: number[];
}

const IMGUR_API_URL = "https://api.imgur.com/3/image";
const IMGUR_CONFIG_HINT =
  "Register at least one valid Imgur Client ID, enable it, and make sure it belongs to the correct app in the Imgur developers dashboard.";
const IMGUR_RATE_LIMIT_HINT =
  "The app uses a conservative limit of 50 uploads per hour to avoid Imgur blocks, following the documentation/help center.";

const ensureDesktopSecretsDir = (): string => {
  const secretsDir = path.join(app.getPath("userData"), "secure-store");
  fs.mkdirSync(secretsDir, { recursive: true });
  return secretsDir;
};

const getDesktopImgurConfigPath = (): string =>
  path.join(ensureDesktopSecretsDir(), "imgur-config.json");

const getDesktopImgurRateStatePath = (): string =>
  path.join(ensureDesktopSecretsDir(), "imgur-rate-state.json");

const serializeImgurConfig = (config: ImgurConfig): ImgurConfigEnvelope => {
  const payload = JSON.stringify(config);
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      payload: safeStorage.encryptString(payload).toString("base64"),
    };
  }

  return {
    encrypted: false,
    payload,
  };
};

const parseImgurConfig = (raw: string): ImgurConfig => {
  if (!raw.trim()) {
    return { ...DEFAULT_IMGUR_CONFIG };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_IMGUR_CONFIG };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "payload" in parsed) {
    const envelope = parsed as Partial<ImgurConfigEnvelope>;
    if (typeof envelope.payload !== "string") {
      return { ...DEFAULT_IMGUR_CONFIG };
    }

    let payload = envelope.payload;
    if (envelope.encrypted) {
      if (!safeStorage.isEncryptionAvailable()) {
        return { ...DEFAULT_IMGUR_CONFIG };
      }

      try {
        payload = safeStorage.decryptString(Buffer.from(envelope.payload, "base64"));
      } catch {
        return { ...DEFAULT_IMGUR_CONFIG };
      }
    }

    return normalizeImgurConfig(JSON.parse(payload));
  }

  return normalizeImgurConfig(parsed);
};

const readDesktopImgurConfig = (): ImgurConfig => {
  const filePath = getDesktopImgurConfigPath();
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_IMGUR_CONFIG };
  }

  try {
    return parseImgurConfig(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { ...DEFAULT_IMGUR_CONFIG };
  }
};

const writeDesktopImgurConfig = (config: ImgurConfig): boolean => {
  const filePath = getDesktopImgurConfigPath();
  const envelope = serializeImgurConfig(config);
  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf8");
  return envelope.encrypted;
};

const readImgurRateState = (): ImgurRateState => {
  const filePath = getDesktopImgurRateStatePath();
  if (!fs.existsSync(filePath)) {
    return { uploadTimestamps: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { uploadTimestamps: [] };
    }
    const payload = parsed as { uploadTimestamps?: unknown };
    return {
      uploadTimestamps: Array.isArray(payload.uploadTimestamps)
        ? payload.uploadTimestamps.filter((value): value is number => Number.isFinite(value))
        : [],
    };
  } catch {
    return { uploadTimestamps: [] };
  }
};

const writeImgurRateState = (state: ImgurRateState): void => {
  fs.writeFileSync(getDesktopImgurRateStatePath(), JSON.stringify(state, null, 2), "utf8");
};

const getActiveImgurKeys = (config: ImgurConfig): ImgurClientKey[] => {
  const activeKeys = config.keys.filter((item) => item.enabled && item.clientId.trim().length > 0);
  if (activeKeys.length === 0) {
    throw new Error(`No active Imgur Client ID has been configured. ${IMGUR_CONFIG_HINT}`);
  }
  return activeKeys;
};

const shuffleKeys = (items: ImgurClientKey[]): ImgurClientKey[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const buildImgurRateStatus = (config: ImgurConfig, nowMs: number = Date.now()): ImgurRateLimitStatus =>
  calculateImgurRateLimitStatus(readImgurRateState().uploadTimestamps, config.rateLimitPerHour, nowMs);

const assertImgurRateCapacity = (config: ImgurConfig, incomingCount: number): ImgurRateLimitStatus => {
  const nowMs = Date.now();
  const status = buildImgurRateStatus(config, nowMs);
  if (incomingCount > status.remainingThisHour) {
    const retryHint = status.resetsAt
      ? `The first slot frees up at ${new Date(status.resetsAt).toLocaleString("pt-BR")}.`
      : "";
    throw new Error(
      `Conservative Imgur limit reached: ${status.remainingThisHour} upload(s) left this hour for a batch of ${incomingCount}. ${retryHint} ${IMGUR_RATE_LIMIT_HINT}`.trim(),
    );
  }
  return status;
};

const registerSuccessfulImgurUpload = (): ImgurRateLimitStatus => {
  const config = readDesktopImgurConfig();
  const nowMs = Date.now();
  const state = readImgurRateState();
  state.uploadTimestamps = [...state.uploadTimestamps, nowMs].filter(
    (value) => value > nowMs - 60 * 60 * 1000,
  );
  writeImgurRateState(state);
  return calculateImgurRateLimitStatus(state.uploadTimestamps, config.rateLimitPerHour, nowMs);
};

const uploadSingleImageToImgur = async (
  keys: ImgurClientKey[],
  item: ImgurUploadPayload["items"][number],
): Promise<ImgurUploadResult> => {
  const attempts = shuffleKeys(keys);
  const errors: string[] = [];

  for (const key of attempts) {
    const body = new URLSearchParams();
    body.set("image", item.contentBase64.trim());
    body.set("type", "base64");
    body.set("name", item.fileName);
    if ((item.altText ?? "").trim()) {
      body.set("title", item.altText!.trim());
      body.set("description", item.altText!.trim());
    }

    const response = await fetch(IMGUR_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${key.clientId.trim()}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          status?: number;
          data?: {
            link?: string;
            deletehash?: string;
            width?: number;
            height?: number;
            error?: unknown;
          };
        }
      | null;

    if (response.ok && payload && payload.success && payload.data && typeof payload.data === "object") {
      const data = payload.data as {
        link?: string;
        deletehash?: string;
        width?: number;
        height?: number;
      };
      const directUrl = typeof data.link === "string" ? data.link.trim() : "";
      if (!directUrl) {
        throw new Error(`Imgur did not return a link for ${item.fileName}.`);
      }
      return {
        id: item.id,
        fileName: item.fileName,
        mimeType: item.mimeType,
        altText: (item.altText ?? "").trim(),
        directUrl,
        deleteHash: data.deletehash ?? null,
        width: Number.isFinite(data.width) ? Number(data.width) : undefined,
        height: Number.isFinite(data.height) ? Number(data.height) : undefined,
        byteLength: item.byteLength,
        keyLabel: key.label,
      };
    }

    const errorMessage =
      payload && typeof payload.data === "object" && payload.data && "error" in payload.data
        ? String((payload.data as { error?: unknown }).error ?? "")
        : response.statusText;

    if (response.status === 429) {
      throw new Error(`Imgur returned rate limit/429 while using key "${key.label}". Wait before trying again.`);
    }

    errors.push(`${key.label}: ${response.status} ${errorMessage}`.trim());
  }

  throw new Error(`Imgur upload failed. Attempts: ${errors.join(" | ")}`);
};

export const loadDesktopImgurConfig = (): {
  config: ImgurConfig;
  secureStorage: boolean;
  rateLimit: ImgurRateLimitStatus;
} => {
  const config = readDesktopImgurConfig();
  return {
    config,
    secureStorage: safeStorage.isEncryptionAvailable(),
    rateLimit: buildImgurRateStatus(config),
  };
};

export const saveDesktopImgurConfig = (
  value: unknown,
): {
  config: ImgurConfig;
  secureStorage: boolean;
  rateLimit: ImgurRateLimitStatus;
} => {
  const config = normalizeImgurConfig(value);
  const secureStorage = writeDesktopImgurConfig(config);
  return {
    config,
    secureStorage,
    rateLimit: buildImgurRateStatus(config),
  };
};

export const uploadDesktopImgurImages = async (
  payload: ImgurUploadPayload,
): Promise<{
  items: ImgurUploadResult[];
  rateLimit: ImgurRateLimitStatus;
}> => {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("No images received for Imgur upload.");
  }

  const config = readDesktopImgurConfig();
  const keys = getActiveImgurKeys(config);
  assertImgurRateCapacity(config, payload.items.length);

  const items: ImgurUploadResult[] = [];
  let lastRateStatus = buildImgurRateStatus(config);

  for (let index = 0; index < payload.items.length; index += 1) {
    const item = payload.items[index];
    if ((item.byteLength ?? 0) > 10 * 1024 * 1024) {
      throw new Error(`Image ${item.fileName} exceeds 10 MB, the conservative limit adopted for uploads via the Imgur API.`);
    }

    const uploaded = await uploadSingleImageToImgur(keys, item);
    items.push(uploaded);
    lastRateStatus = registerSuccessfulImgurUpload();

    if (index < payload.items.length - 1 && config.batchDelayMs > 0) {
      await wait(config.batchDelayMs);
    }
  }

  return {
    items,
    rateLimit: lastRateStatus,
  };
};
