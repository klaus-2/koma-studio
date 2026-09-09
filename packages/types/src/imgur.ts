export interface ImgurClientKey {
  id: string;
  label: string;
  clientId: string;
  enabled: boolean;
}

export interface ImgurConfig {
  keys: ImgurClientKey[];
  rateLimitPerHour: number;
  batchDelayMs: number;
}

export interface ImgurUploadItemInput {
  id: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  altText?: string;
  byteLength?: number;
}

export interface ImgurUploadResult {
  id: string;
  fileName: string;
  mimeType: string;
  altText: string;
  directUrl: string;
  deleteHash?: string | null;
  width?: number;
  height?: number;
  byteLength?: number;
  keyLabel: string;
}

export interface ImgurRateLimitStatus {
  limitPerHour: number;
  usedThisHour: number;
  remainingThisHour: number;
  resetsAt: string | null;
}

export interface ImgurUploadPayload {
  items: ImgurUploadItemInput[];
}

const sanitizeText = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const generateImgurKeyId = (): string =>
  `imgur-key-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const DEFAULT_IMGUR_CONFIG: ImgurConfig = {
  keys: [],
  rateLimitPerHour: 50,
  batchDelayMs: 1200,
};

export const normalizeImgurConfig = (value: unknown): ImgurConfig => {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawKeys = Array.isArray(payload.keys) ? payload.keys : [];

  return {
    keys: rawKeys
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const entry = item as Record<string, unknown>;
        const clientId = sanitizeText(entry.clientId, 128);
        if (!clientId) {
          return null;
        }
        return {
          id: sanitizeText(entry.id, 80) || generateImgurKeyId(),
          label: sanitizeText(entry.label, 80) || "Imgur key",
          clientId,
          enabled: entry.enabled !== false,
        } satisfies ImgurClientKey;
      })
      .filter((item): item is ImgurClientKey => Boolean(item)),
    rateLimitPerHour: Math.max(1, Math.min(500, Math.round(Number(payload.rateLimitPerHour ?? 50)))),
    batchDelayMs: Math.max(0, Math.min(30_000, Math.round(Number(payload.batchDelayMs ?? 1200)))),
  };
};

export const calculateImgurRateLimitStatus = (
  timestamps: number[],
  limitPerHour: number,
  nowMs: number = Date.now(),
): ImgurRateLimitStatus => {
  const oneHourMs = 60 * 60 * 1000;
  const recent = timestamps
    .filter((value) => Number.isFinite(value) && value > nowMs - oneHourMs)
    .sort((left, right) => left - right);
  const usedThisHour = recent.length;
  const remainingThisHour = Math.max(0, limitPerHour - usedThisHour);
  const oldest = recent[0];

  return {
    limitPerHour,
    usedThisHour,
    remainingThisHour,
    resetsAt: oldest ? new Date(oldest + oneHourMs).toISOString() : null,
  };
};
