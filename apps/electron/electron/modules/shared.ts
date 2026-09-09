/**
 * Shared utilities for IPC handler registration, HTTP, error handling, and common patterns.
 * Extracted from the large legacy electron/main.ts during its decomposition.
 */
import {
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERNAL_APP_PROTOCOL = "app";
const INTERNAL_APP_HOST = "local";

const SECURE_IPC_META_KEY = "__ipcMeta";
const SECURE_IPC_MAX_SKEW_MS = 60_000;

const DESKTOP_FETCH_TIMEOUT_MS = 12_000;
const DESKTOP_FETCH_RETRY_COUNT = 1;
const RETRYABLE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecureIpcMeta {
  nonce: string;
  timestampMs: number;
}

interface DesktopApiEnvelope<T = unknown> {
  ok: boolean;
  status: number;
  payload: T | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const seenSecureIpcNonces = new Map<string, number>();

// ---------------------------------------------------------------------------
// Basic utilities
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeHttpMethod = (method: string | undefined): string =>
  (method ?? "GET").trim().toUpperCase() || "GET";

const toStringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const toNumberValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
};

const normalizeAccessToken = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const normalizeHost = (value: string): string => value.trim().toLowerCase();

// ---------------------------------------------------------------------------
// Session log sanitization
// ---------------------------------------------------------------------------

const sanitizeSessionLogText = (value: unknown, maxLength = 4_000): string => {
  const raw = typeof value === "string" ? value : String(value ?? "");
  const sanitized = raw
    .replace(/\r/g, "")
    // oxlint-disable-next-line no-control-regex -- strip NUL bytes from the session log
    .replace(/\u0000/g, "")
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=\s]+/gi, "[REDACTED_DATA_URL]")
    .replace(/\bBearer\s+[A-Za-z0-9._=-]+\b/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(
      /\b(access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization|cookie|set-cookie|x-koma-local-session|desktop_bootstrap_secret)\b\s*[:=]\s*([^\s,;]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
  return sanitized.trim().slice(0, maxLength);
};

// ---------------------------------------------------------------------------
// External command utility
// ---------------------------------------------------------------------------

const readCommandOutput = (
  command: string,
  args: string[],
  timeoutMs: number = 2_500,
): string | null => {
  try {
    const output = execFileSync(command, args, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      windowsHide: true,
      timeout: timeoutMs,
    });
    const normalized = output.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Renderer URL validation
// ---------------------------------------------------------------------------

const getDevServerOrigin = (): string | null => {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return null;
  }

  try {
    return new URL(process.env.VITE_DEV_SERVER_URL).origin;
  } catch {
    return null;
  }
};

const isInternalAppUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === `${INTERNAL_APP_PROTOCOL}:` && parsed.hostname === INTERNAL_APP_HOST;
  } catch {
    return false;
  }
};

const isTrustedRendererUrl = (rawUrl: string): boolean => {
  if (!rawUrl) {
    return false;
  }

  const devOrigin = getDevServerOrigin();
  if (devOrigin) {
    try {
      return new URL(rawUrl).origin === devOrigin;
    } catch {
      return false;
    }
  }

  return isInternalAppUrl(rawUrl);
};

const assertTrustedIpcSender = (
  event: IpcMainInvokeEvent | IpcMainEvent,
  channel: string,
): void => {
  const senderFrameUrl = event.senderFrame?.url ?? "";
  const senderWebContentsUrl = event.sender.getURL();
  const candidateUrl = senderFrameUrl || senderWebContentsUrl;
  if (isTrustedRendererUrl(candidateUrl)) {
    return;
  }

  throw new Error(
    `Blocked IPC on "${channel}" from untrusted sender (${candidateUrl || "unknown-url"}).`,
  );
};

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

const registerIpcHandler = <T>(
  channel: string,
  handler: (value: unknown, event: IpcMainInvokeEvent) => Promise<T> | T,
): void => {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, value) => {
    assertTrustedIpcSender(event, channel);
    return handler(value, event);
  });
};

const cleanupSeenSecureIpcNonces = (nowMs: number): void => {
  seenSecureIpcNonces.forEach((expiresAtMs, nonce) => {
    if (expiresAtMs <= nowMs) {
      seenSecureIpcNonces.delete(nonce);
    }
  });
};

const parseSecureIpcMeta = (value: unknown): SecureIpcMeta | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const rawMeta = payload[SECURE_IPC_META_KEY];
  if (!rawMeta || typeof rawMeta !== "object") {
    return null;
  }

  const meta = rawMeta as Record<string, unknown>;
  const nonce = typeof meta.nonce === "string" ? meta.nonce.trim() : "";
  const timestampMs = typeof meta.timestampMs === "number" ? meta.timestampMs : Number.NaN;
  if (!nonce || !Number.isFinite(timestampMs)) {
    return null;
  }

  return { nonce, timestampMs };
};

const stripSecureIpcMeta = (value: unknown): unknown => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const payload = value as Record<string, unknown>;
  const { [SECURE_IPC_META_KEY]: _meta, ...safePayload } = payload;
  return safePayload;
};

const registerSecureIpcHandler = <T>(
  channel: string,
  handler: (value: unknown) => Promise<T> | T,
): void => {
  registerIpcHandler(channel, async (value) => {
    const meta = parseSecureIpcMeta(value);
    if (!meta) {
      throw new Error("Secure IPC metadata missing.");
    }

    const nowMs = Date.now();
    if (Math.abs(nowMs - meta.timestampMs) > SECURE_IPC_MAX_SKEW_MS) {
      throw new Error("Secure IPC timestamp outside allowed window.");
    }

    const existingExpiresAtMs = seenSecureIpcNonces.get(meta.nonce);
    if (typeof existingExpiresAtMs === "number" && existingExpiresAtMs > nowMs) {
      throw new Error("Secure IPC nonce replay detected.");
    }

    seenSecureIpcNonces.set(meta.nonce, nowMs + SECURE_IPC_MAX_SKEW_MS);
    if (seenSecureIpcNonces.size > 5_000) {
      cleanupSeenSecureIpcNonces(nowMs);
    }

    return handler(stripSecureIpcMeta(value));
  });
};

// ---------------------------------------------------------------------------
// HTTP utilities
// ---------------------------------------------------------------------------

const fetchWithTimeoutAndRetry = async (
  request: (signal: AbortSignal) => Promise<globalThis.Response>,
  init: RequestInit,
  options: {
    timeoutMs?: number;
    retryCount?: number;
  } = {},
): Promise<globalThis.Response> => {
  const method = normalizeHttpMethod(init.method);
  const timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? DESKTOP_FETCH_TIMEOUT_MS));
  const requestedRetryCount = Math.max(0, Math.trunc(options.retryCount ?? DESKTOP_FETCH_RETRY_COUNT));
  const retryCount = RETRYABLE_HTTP_METHODS.has(method) ? requestedRetryCount : 0;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await request(controller.signal);
      const shouldRetry =
        attempt < retryCount &&
        RETRYABLE_HTTP_METHODS.has(method) &&
        RETRYABLE_HTTP_STATUSES.has(response.status);
      if (shouldRetry) {
        await sleep(300 * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < retryCount && RETRYABLE_HTTP_METHODS.has(method);
      if (shouldRetry) {
        await sleep(300 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("HTTP request failed.");
};

// ---------------------------------------------------------------------------
// API error handling
// ---------------------------------------------------------------------------

const parseDesktopApiError = async (response: globalThis.Response): Promise<string> => {
  const statusLabel = `HTTP ${response.status}`;

  try {
    const payload = (await response.json()) as { error?: string; detail?: string; code?: string };
    return payload.detail ?? payload.error ?? payload.code ?? statusLabel;
  } catch {
    try {
      const text = (await response.text()).trim();
      if (!text) {
        return statusLabel;
      }

      const collapsed = text.replace(/\s+/g, " ");
      const plain = collapsed.replace(/<[^>]+>/g, "").trim();
      if (plain.length > 0) {
        return `${statusLabel}: ${plain.slice(0, 240)}`;
      }

      return statusLabel;
    } catch {
      return statusLabel;
    }
  }
};

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  let rawPayload = "";
  try {
    rawPayload = await response.text();
  } catch {
    return null;
  }

  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as unknown;
  } catch {
    return { error: rawPayload };
  }
};

const asDesktopErrorPayload = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const resolveDesktopErrorCode = (payload: unknown): string | undefined => {
  const record = asDesktopErrorPayload(payload);
  const code = record?.code;
  return typeof code === "string" && code.trim().length > 0 ? code.trim() : undefined;
};

const resolveDesktopErrorMessage = (status: number, payload: unknown): string => {
  const record = asDesktopErrorPayload(payload);
  const messageCandidates = [record?.detail, record?.error, record?.message];
  for (const candidate of messageCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return `HTTP ${status}`;
};

class DesktopStructuredError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload: Record<string, unknown> | null;

  constructor(
    status: number,
    message: string,
    code?: string,
    payload: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "DesktopStructuredError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

const toDesktopStructuredError = (
  status: number,
  payload: unknown,
): DesktopStructuredError => {
  const record = asDesktopErrorPayload(payload);
  return new DesktopStructuredError(
    status,
    resolveDesktopErrorMessage(status, payload),
    resolveDesktopErrorCode(payload),
    record,
  );
};

const isDesktopStructuredError = (error: unknown): error is DesktopStructuredError =>
  error instanceof DesktopStructuredError;

const extractDesktopApiErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const directError = typeof record.error === "string" ? record.error.trim() : "";
  if (directError) {
    return directError;
  }

  const directMessage = typeof record.message === "string" ? record.message.trim() : "";
  if (directMessage) {
    return directMessage;
  }

  const detail = record.details;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  return fallback;
};

const summarizeDesktopApiPayload = (payload: unknown): string => {
  const record = asDesktopErrorPayload(payload);
  if (!record) {
    return "payload=null";
  }

  const parts: string[] = [];
  if (typeof record.code === "string" && record.code.trim()) {
    parts.push(`code=${record.code.trim()}`);
  }
  if (typeof record.error === "string" && record.error.trim()) {
    parts.push(`error=${sanitizeSessionLogText(record.error, 180)}`);
  }
  if (typeof record.detail === "string" && record.detail.trim()) {
    parts.push(`detail=${sanitizeSessionLogText(record.detail, 180)}`);
  }
  if (typeof record.message === "string" && record.message.trim()) {
    parts.push(`message=${sanitizeSessionLogText(record.message, 180)}`);
  }

  return parts.join(" ") || "payload=object";
};

const toDesktopAuthErrorEnvelope = (
  error: unknown,
  fallbackMessage: string,
  fallbackCode = "DESKTOP_BOOTSTRAP_FAILED",
): DesktopApiEnvelope => {
  if (isDesktopStructuredError(error)) {
    return {
      ok: false,
      status: error.status,
      payload: {
        ...error.payload,
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      },
    };
  }

  return {
    ok: false,
    status: 503,
    payload: {
      error: error instanceof Error ? error.message : fallbackMessage,
      code: fallbackCode,
    },
  };
};

// ---------------------------------------------------------------------------
// Discord webhook validation
// ---------------------------------------------------------------------------

const normalizeDiscordWebhookUrl = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const rawUrl = value.trim();
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      return null;
    }

    const host = normalizeHost(parsed.hostname);
    const allowedHost =
      host === "discord.com" ||
      host === "discordapp.com" ||
      host.endsWith(".discord.com") ||
      host.endsWith(".discordapp.com");
    if (!allowedHost) {
      return null;
    }

    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    if (!/^\/api(?:\/v\d+)?\/webhooks\/\d{16,22}\/[A-Za-z0-9._-]+$/.test(normalizedPath)) {
      return null;
    }

    parsed.pathname = normalizedPath;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
};

const sanitizeDiscordWebhookText = (value: string, maxLength: number): string =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

const parseDiscordWebhookErrorMessage = (rawText: string, status: number): string => {
  const text = sanitizeDiscordWebhookText(rawText, 300);
  if (!text) {
    return `Discord returned HTTP ${status}.`;
  }

  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const message = sanitizeDiscordWebhookText(
      String(payload.message ?? payload.error ?? payload.detail ?? ""),
      300,
    );
    if (message) {
      return message;
    }
  } catch {
    // Fall through to the raw-text fallback.
  }

  return text;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  // Constants
  SECURE_IPC_META_KEY,
  SECURE_IPC_MAX_SKEW_MS,
  DESKTOP_FETCH_TIMEOUT_MS,
  DESKTOP_FETCH_RETRY_COUNT,
  RETRYABLE_HTTP_METHODS,
  RETRYABLE_HTTP_STATUSES,
  // Types
  type SecureIpcMeta,
  type DesktopApiEnvelope,
  // State
  seenSecureIpcNonces,
  // Basic utilities
  sleep,
  normalizeHttpMethod,
  toStringValue,
  toNumberValue,
  normalizeAccessToken,
  normalizeHost,
  sanitizeSessionLogText,
  readCommandOutput,
  // Renderer URL validation
  getDevServerOrigin,
  isInternalAppUrl,
  isTrustedRendererUrl,
  assertTrustedIpcSender,
  // IPC registration
  registerIpcHandler,
  registerSecureIpcHandler,
  // HTTP utilities
  fetchWithTimeoutAndRetry,
  // Error handling
  parseDesktopApiError,
  parseResponsePayload,
  asDesktopErrorPayload,
  resolveDesktopErrorCode,
  resolveDesktopErrorMessage,
  DesktopStructuredError,
  toDesktopStructuredError,
  isDesktopStructuredError,
  extractDesktopApiErrorMessage,
  summarizeDesktopApiPayload,
  toDesktopAuthErrorEnvelope,
  // Discord webhook
  normalizeDiscordWebhookUrl,
  sanitizeDiscordWebhookText,
  parseDiscordWebhookErrorMessage,
};
