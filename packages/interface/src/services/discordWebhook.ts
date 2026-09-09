import { desktopBridge } from "@/lib/desktop-bridge";
export type DiscordWebhookEventKey =
  | "processStart"
  | "processComplete"
  | "processError"
  | "updateAvailable"
  | "updateDownloaded"
  | "updateError";

export interface DiscordWebhookEventsConfig {
  processStart: boolean;
  processComplete: boolean;
  processError: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  updateError: boolean;
}

export interface DiscordWebhookConfig {
  url: string;
  enabled: boolean;
  botName: string;
  events: DiscordWebhookEventsConfig;
}

export interface DiscordWebhookValidationResult {
  valid: boolean;
  normalizedUrl: string;
  error: string | null;
}

export interface DiscordWebhookSendResult {
  ok: boolean;
  status: number;
  via: "desktop-bridge" | "web-fetch";
  error?: string;
}

interface DiscordWebhookEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordWebhookEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  fields?: DiscordWebhookEmbedField[];
  footer?: { text: string };
}

interface DiscordWebhookPayload {
  username: string;
  embeds: DiscordWebhookEmbed[];
}

export interface DiscordWebhookEventContext {
  mode?: string;
  pages?: number;
  version?: string | null;
  error?: string;
  dedupeKey?: string;
  timestamp?: string;
  metrics?: Record<string, string | number | boolean | null | undefined>;
}

interface DiscordWebhookEventMeta {
  title: string;
  description: string;
  color: number;
}

const WEBHOOK_STORAGE_KEY = "koma-webhook";
const DEDUPE_STORAGE_KEY = "koma-webhook-dedupe-v1";
const MAX_DEDUPE_ENTRIES = 300;
const MAX_ERROR_LENGTH = 300;
const MAX_FIELD_VALUE_LENGTH = 500;

const WEBHOOK_EVENT_META: Record<DiscordWebhookEventKey, DiscordWebhookEventMeta> = {
  processStart: {
    title: "Processamento iniciado",
    description: "A run has started in KOMA Studio.",
    color: 0x06b6d4,
  },
  processComplete: {
    title: "Processing finished",
    description: "The run finished successfully.",
    color: 0x10b981,
  },
  processError: {
    title: "Processing error",
    description: "The run finished with an error.",
    color: 0xf43f5e,
  },
  updateAvailable: {
    title: "Update available",
    description: "A new version is available to download.",
    color: 0xa855f7,
  },
  updateDownloaded: {
    title: "Update downloaded",
    description: "The update has been downloaded and is ready to install.",
    color: 0x22c55e,
  },
  updateError: {
    title: "Update error",
    description: "The application update failed.",
    color: 0xf43f5e,
  },
};

export const WEBHOOK_EVENT_OPTIONS: Array<{
  key: DiscordWebhookEventKey;
  label: string;
  desc: string;
}> = [
  { key: "processStart", label: "webhook.event.processStart.label", desc: "webhook.event.processStart.desc" },
  { key: "processComplete", label: "webhook.event.processComplete.label", desc: "webhook.event.processComplete.desc" },
  { key: "processError", label: "webhook.event.processError.label", desc: "webhook.event.processError.desc" },
  { key: "updateAvailable", label: "webhook.event.updateAvailable.label", desc: "webhook.event.updateAvailable.desc" },
  { key: "updateDownloaded", label: "webhook.event.updateDownloaded.label", desc: "webhook.event.updateDownloaded.desc" },
  { key: "updateError", label: "webhook.event.updateError.label", desc: "webhook.event.updateError.desc" },
];

export const DEFAULT_WEBHOOK_CONFIG: DiscordWebhookConfig = {
  url: "",
  enabled: false,
  botName: "",
  events: {
    processStart: false,
    processComplete: true,
    processError: true,
    updateAvailable: true,
    updateDownloaded: false,
    updateError: true,
  },
};

const sanitizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
};

const sanitizeError = (value: unknown): string => sanitizeText(String(value ?? ""), MAX_ERROR_LENGTH);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const validateDiscordWebhookUrl = (rawUrl: string): DiscordWebhookValidationResult => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: "",
      error: "webhook.validation.urlRequired",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: "",
      error: "webhook.validation.urlInvalid",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      normalizedUrl: "",
      error: "webhook.validation.urlHttpsRequired",
    };
  }

  const host = parsed.hostname.trim().toLowerCase();
  const allowedHost =
    host === "discord.com" ||
    host === "discordapp.com" ||
    host.endsWith(".discord.com") ||
    host.endsWith(".discordapp.com");
  if (!allowedHost) {
    return {
      valid: false,
      normalizedUrl: "",
      error: "webhook.validation.urlNotDiscord",
    };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  const webhookPathPattern = /^\/api(?:\/v\d+)?\/webhooks\/\d{16,22}\/[A-Za-z0-9._-]+$/;
  if (!webhookPathPattern.test(normalizedPath)) {
    return {
      valid: false,
      normalizedUrl: "",
      error: "webhook.validation.urlInvalidPath",
    };
  }

  parsed.pathname = normalizedPath;
  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    error: null,
  };
};

export const normalizeWebhookConfig = (value: unknown): DiscordWebhookConfig => {
  if (!isObject(value)) {
    return { ...DEFAULT_WEBHOOK_CONFIG, events: { ...DEFAULT_WEBHOOK_CONFIG.events } };
  }

  const rawEvents = isObject(value.events) ? value.events : {};
  const events: DiscordWebhookEventsConfig = {
    processStart:
      typeof rawEvents.processStart === "boolean"
        ? rawEvents.processStart
        : DEFAULT_WEBHOOK_CONFIG.events.processStart,
    processComplete:
      typeof rawEvents.processComplete === "boolean"
        ? rawEvents.processComplete
        : DEFAULT_WEBHOOK_CONFIG.events.processComplete,
    processError:
      typeof rawEvents.processError === "boolean"
        ? rawEvents.processError
        : DEFAULT_WEBHOOK_CONFIG.events.processError,
    updateAvailable:
      typeof rawEvents.updateAvailable === "boolean"
        ? rawEvents.updateAvailable
        : DEFAULT_WEBHOOK_CONFIG.events.updateAvailable,
    updateDownloaded:
      typeof rawEvents.updateDownloaded === "boolean"
        ? rawEvents.updateDownloaded
        : DEFAULT_WEBHOOK_CONFIG.events.updateDownloaded,
    updateError:
      typeof rawEvents.updateError === "boolean"
        ? rawEvents.updateError
        : DEFAULT_WEBHOOK_CONFIG.events.updateError,
  };

  return {
    url: sanitizeText(value.url, 600),
    enabled: value.enabled === true,
    botName: sanitizeText(value.botName, 80),
    events,
  };
};

export const loadWebhookConfig = (): DiscordWebhookConfig => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_WEBHOOK_CONFIG, events: { ...DEFAULT_WEBHOOK_CONFIG.events } };
  }

  try {
    const raw = window.localStorage.getItem(WEBHOOK_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_WEBHOOK_CONFIG, events: { ...DEFAULT_WEBHOOK_CONFIG.events } };
    }
    return normalizeWebhookConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WEBHOOK_CONFIG, events: { ...DEFAULT_WEBHOOK_CONFIG.events } };
  }
};

export const saveWebhookConfig = (config: DiscordWebhookConfig): DiscordWebhookConfig => {
  const normalized = normalizeWebhookConfig(config);
  if (typeof window === "undefined" || !window.localStorage) {
    return normalized;
  }
  window.localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

const readDedupeCache = (): Record<string, number> => {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DEDUPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return {};
    const now = Date.now();
    const normalized: Record<string, number> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      if (value <= now + 45 * 24 * 60 * 60 * 1000) {
        normalized[key] = value;
      }
    });
    return normalized;
  } catch {
    return {};
  }
};

const writeDedupeCache = (cache: Record<string, number>): void => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(cache));
};

const cleanupDedupeCache = (cache: Record<string, number>): Record<string, number> => {
  const now = Date.now();
  const entries = Object.entries(cache).filter(([, expiresAt]) => expiresAt > now);
  entries.sort((left, right) => right[1] - left[1]);
  return Object.fromEntries(entries.slice(0, MAX_DEDUPE_ENTRIES));
};

const buildDedupeRule = (
  eventKey: DiscordWebhookEventKey,
  context: DiscordWebhookEventContext,
): { key: string; ttlMs: number } | null => {
  if (context.dedupeKey && context.dedupeKey.trim()) {
    return { key: context.dedupeKey.trim(), ttlMs: 24 * 60 * 60 * 1000 };
  }

  switch (eventKey) {
    case "updateAvailable":
    case "updateDownloaded":
    case "updateError": {
      const version = sanitizeText(context.version ?? "desconhecida", 80).toLowerCase();
      return {
        key: `${eventKey}:${version}`,
        ttlMs: 14 * 24 * 60 * 60 * 1000,
      };
    }
    default:
      return null;
  }
};

const shouldSkipByDedupe = (eventKey: DiscordWebhookEventKey, context: DiscordWebhookEventContext): boolean => {
  const dedupeRule = buildDedupeRule(eventKey, context);
  if (!dedupeRule) {
    return false;
  }

  const cache = cleanupDedupeCache(readDedupeCache());
  const now = Date.now();
  const previousExpiry = cache[dedupeRule.key];
  if (typeof previousExpiry === "number" && previousExpiry > now) {
    writeDedupeCache(cache);
    return true;
  }

  cache[dedupeRule.key] = now + dedupeRule.ttlMs;
  writeDedupeCache(cleanupDedupeCache(cache));
  return false;
};

const formatMetricValue = (value: string | number | boolean | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  const text = sanitizeText(String(value), MAX_FIELD_VALUE_LENGTH);
  return text || null;
};

const buildEventFields = (
  eventKey: DiscordWebhookEventKey,
  context: DiscordWebhookEventContext,
): DiscordWebhookEmbedField[] => {
  const fields: DiscordWebhookEmbedField[] = [];

  if (context.mode) {
    fields.push({ name: "Modo", value: sanitizeText(context.mode, 80), inline: true });
  }
  if (typeof context.pages === "number" && Number.isFinite(context.pages)) {
    fields.push({ name: "Pages", value: String(Math.max(0, Math.trunc(context.pages))), inline: true });
  }
  if (context.version) {
    fields.push({ name: "Version", value: sanitizeText(context.version, 80), inline: true });
  }
  if (context.metrics) {
    Object.entries(context.metrics).forEach(([name, value]) => {
      const rendered = formatMetricValue(value);
      if (!rendered) return;
      fields.push({
        name: sanitizeText(name, 80),
        value: rendered,
        inline: true,
      });
    });
  }
  if (eventKey === "processError" || eventKey === "updateError") {
    const message = sanitizeError(context.error);
    if (message) {
      fields.push({
        name: "Error",
        value: message,
      });
    }
  }

  return fields.slice(0, 12);
};

const buildEventPayload = (
  config: DiscordWebhookConfig,
  eventKey: DiscordWebhookEventKey,
  context: DiscordWebhookEventContext,
): DiscordWebhookPayload => {
  const meta = WEBHOOK_EVENT_META[eventKey];
  const fields = buildEventFields(eventKey, context);
  return {
    username: config.botName || "KŌMA Studio",
    embeds: [
      {
        title: `KŌMA Studio • ${meta.title}`,
        description: meta.description,
        color: meta.color,
        timestamp: context.timestamp ?? new Date().toISOString(),
        fields: fields.length > 0 ? fields : undefined,
        footer: { text: `Evento: ${eventKey}` },
      },
    ],
  };
};

const parseResponseError = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `HTTP error ${response.status}`;
  }

  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const message = sanitizeText(String(json.message ?? json.error ?? ""), MAX_ERROR_LENGTH);
    if (message) return message;
  } catch {
    // Continue with raw text.
  }

  return sanitizeText(text, MAX_ERROR_LENGTH) || `HTTP error ${response.status}`;
};

const sendWebhookPayload = async (
  validatedUrl: string,
  payload: DiscordWebhookPayload,
): Promise<DiscordWebhookSendResult> => {
  const desktopSender = desktopBridge.desktop?.api?.discordWebhook?.send;
  if (desktopSender) {
    try {
      const bridgeResult = await desktopSender({ url: validatedUrl, body: payload });
      return {
        ok: bridgeResult.ok === true,
        status: Number(bridgeResult.status ?? 0),
        via: "desktop-bridge",
        error: typeof bridgeResult.error === "string" ? bridgeResult.error : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        via: "desktop-bridge",
        error: sanitizeError(error instanceof Error ? error.message : "Desktop bridge failed."),
      };
    }
  }

  try {
    const response = await fetch(validatedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const ok = response.ok || response.status === 204;
    return {
      ok,
      status: response.status,
      via: "web-fetch",
      error: ok ? undefined : await parseResponseError(response),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      via: "web-fetch",
      error: sanitizeError(error instanceof Error ? error.message : "Failed to send the webhook."),
    };
  }
};

export const sendDiscordWebhookTest = async (
  config: DiscordWebhookConfig,
): Promise<DiscordWebhookSendResult> => {
  const normalized = normalizeWebhookConfig(config);
  const validation = validateDiscordWebhookUrl(normalized.url);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      via: "web-fetch",
      error: validation.error ?? "Invalid webhook.",
    };
  }

  const payload: DiscordWebhookPayload = {
    username: normalized.botName || "KŌMA Studio",
    embeds: [
      {
        title: "KOMA Studio - Webhook Test",
        description: "Webhook configured and working.",
        color: 0xa855f7,
        timestamp: new Date().toISOString(),
        footer: { text: "Integrations - Settings" },
      },
    ],
  };

  return sendWebhookPayload(validation.normalizedUrl, payload);
};

export const sendDiscordWebhookEvent = async (
  eventKey: DiscordWebhookEventKey,
  context: DiscordWebhookEventContext = {},
): Promise<{ sent: boolean; reason?: string; result?: DiscordWebhookSendResult }> => {
  const config = loadWebhookConfig();
  if (!config.enabled) {
    return { sent: false, reason: "disabled" };
  }
  if (!config.events[eventKey]) {
    return { sent: false, reason: "event-disabled" };
  }

  const validation = validateDiscordWebhookUrl(config.url);
  if (!validation.valid) {
    return { sent: false, reason: "invalid-url" };
  }

  if (shouldSkipByDedupe(eventKey, context)) {
    return { sent: false, reason: "deduped" };
  }

  const payload = buildEventPayload(config, eventKey, context);
  const result = await sendWebhookPayload(validation.normalizedUrl, payload);
  if (!result.ok) {
    return { sent: false, reason: result.error ?? "send-failed", result };
  }
  return { sent: true, result };
};
