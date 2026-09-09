import dotenv from "dotenv";
import fs from "node:fs";
import path from "path";

import { tServer } from "../services/server-i18n.js";

const nodeEnvFromProcess = process.env.NODE_ENV === "production" ? "production" : "development";
const loadEnvFileIfExists = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  dotenv.config({ path: filePath, override: false });
};

const cwd = process.cwd();
const parent = path.resolve(cwd, "..");
const envCandidates = [
  // Highest precedence local files first (without overriding already-defined process vars).
  `.env.${nodeEnvFromProcess}.local`,
  ".env.local",
  `.env.${nodeEnvFromProcess}`,
  ".env",
];

for (const fileName of envCandidates) {
  loadEnvFileIfExists(path.resolve(cwd, fileName));
}
for (const fileName of envCandidates) {
  loadEnvFileIfExists(path.resolve(parent, fileName));
}

type NodeEnv = "development" | "production" | "test";
type JwtAlgorithm = "HS256" | "RS256";

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
};

const parseJwtAlgorithm = (value: string | undefined): JwtAlgorithm => {
  const normalized = (value ?? "HS256").trim().toUpperCase();
  if (normalized === "HS256" || normalized === "RS256") {
    return normalized;
  }

  throw new Error(tServer("en", "auth.config.jwtAlgorithmInvalid"));
};

const parseCsvList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const normalizePem = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.replace(/\\n/g, "\n");
};

const parsePemJsonArray = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizePem(typeof entry === "string" ? entry : undefined))
      .filter((entry): entry is string => Boolean(entry));
  } catch {
    return [];
  }
};

const normalizeCookieDomain = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized === "localhost" || normalized.startsWith("127.") || normalized.startsWith("[")) {
    return undefined;
  }

  return normalized.startsWith(".") ? normalized : `.${normalized}`;
};

const normalizeOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4174",
      "http://127.0.0.1:4174",
      "app://local",
    ];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const getUrlProtocol = (rawUrl: string | undefined): string | null => {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).protocol.toLowerCase();
  } catch {
    return null;
  }
};

const isHttpsOrDesktopDeepLink = (rawUrl: string, desktopAppUrl: string | undefined): boolean => {
  const targetProtocol = getUrlProtocol(rawUrl);
  if (!targetProtocol) {
    return false;
  }

  if (targetProtocol === "https:") {
    return true;
  }

  const desktopProtocol = getUrlProtocol(desktopAppUrl);
  if (desktopProtocol && targetProtocol === desktopProtocol) {
    return true;
  }

  // Backward-compatible fallback for legacy desktop deep-link envs.
  return targetProtocol === "komastudio:";
};

const isLoopbackHttpOrigin = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname.startsWith("127.") || url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
};

const isDesktopCorsOrigin = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "app:" || (url.protocol === "tauri:" && url.hostname === "localhost");
  } catch {
    return false;
  }
};

export const isWebRequest = (
  req: { headers: Record<string, string | string[] | undefined> },
): boolean => {
  const origin = req.headers["origin"];
  if (typeof origin !== "string" || origin.length === 0) {
    return false;
  }
  return isLoopbackHttpOrigin(origin) || isDesktopCorsOrigin(origin);
};

export interface EnvConfig {
  port: number;
  nodeEnv: NodeEnv;
  betterAuthUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwtAlgorithm: JwtAlgorithm;
  jwtSecret: string;
  jwtPrivateKey?: string;
  jwtPublicKey?: string;
  jwtKeyId: string;
  jwtPreviousSecrets: string[];
  jwtPreviousPublicKeys: string[];
  betterAuthSecret: string;
  allowedOrigins: string[];
  crossSubDomainCookieDomain?: string;
  rateLimitWindow: number;
  rateLimitMax: number;
  turnstileSecretKey?: string;
  turnstileSiteKey?: string;
  appBaseUrl: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  resendReplyToEmail?: string;
  desktopAppUrl?: string;
  enforceDesktopClient: boolean;
  enforceDesktopRegistration: boolean;
  devWebLoginAllowed: boolean;
  desktopBootstrapSecret?: string;
  desktopClientTokenTtlSec: number;
  desktopClientTokenRefreshSkewSec: number;
  desktopTravelTokenTtlMinutes: number;
  desktopTravelDeviceDurationDays: number;
  disableTravelTokenEnforcement: boolean;
  updateServerUrl?: string;
  updateManifestCacheTtlMs: number;
  feedModerationDiscordWebhookUrl?: string;
  feedMaxLinksPerPost: number;
  feedMaxMediaItems: number;
  feedAutoFlagScoreThreshold: number;
}

const nodeEnv = (process.env.NODE_ENV ?? "development") as NodeEnv;

export const env: EnvConfig = {
  port: parseNumber(process.env.PORT, 3001),
  nodeEnv,
  betterAuthUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${parseNumber(process.env.PORT, 3001)}`,
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtAlgorithm: parseJwtAlgorithm(process.env.JWT_ALGORITHM),
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtPrivateKey: normalizePem(process.env.JWT_PRIVATE_KEY),
  jwtPublicKey: normalizePem(process.env.JWT_PUBLIC_KEY),
  jwtKeyId: (process.env.JWT_KEY_ID ?? "active").trim() || "active",
  jwtPreviousSecrets: parseCsvList(process.env.JWT_PREVIOUS_SECRETS),
  jwtPreviousPublicKeys: parsePemJsonArray(process.env.JWT_PREVIOUS_PUBLIC_KEYS_JSON),
  betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? "",
  allowedOrigins: normalizeOrigins(process.env.ALLOWED_ORIGINS),
  crossSubDomainCookieDomain: normalizeCookieDomain(
    process.env.CROSS_SUBDOMAIN_COOKIE_DOMAIN ?? process.env.AUTH_COOKIE_DOMAIN,
  ),
  rateLimitWindow: parseNumber(process.env.RATE_LIMIT_WINDOW, 60_000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 100),
  turnstileSecretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
  turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY,
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  resendReplyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  desktopAppUrl: process.env.DESKTOP_APP_URL,
  enforceDesktopClient: parseBoolean(process.env.ENFORCE_DESKTOP_CLIENT, nodeEnv === "production"),
  enforceDesktopRegistration: parseBoolean(
    process.env.ENFORCE_DESKTOP_REGISTRATION,
    nodeEnv === "production",
  ),
  devWebLoginAllowed:
    nodeEnv !== "production" && parseBoolean(process.env.DEV_WEB_LOGIN_ALLOWED, false),
  desktopBootstrapSecret: process.env.DESKTOP_BOOTSTRAP_SECRET,
  desktopClientTokenTtlSec: Math.min(
    900,
    Math.max(300, parseNumber(process.env.DESKTOP_CLIENT_TOKEN_TTL_SECONDS, 600)),
  ),
  desktopClientTokenRefreshSkewSec: Math.min(
    300,
    Math.max(30, parseNumber(process.env.DESKTOP_CLIENT_TOKEN_REFRESH_SKEW_SECONDS, 90)),
  ),
  desktopTravelTokenTtlMinutes: Math.min(
    180,
    Math.max(5, parseNumber(process.env.DESKTOP_TRAVEL_TOKEN_TTL_MINUTES, 30)),
  ),
  desktopTravelDeviceDurationDays: Math.min(
    60,
    Math.max(1, parseNumber(process.env.DESKTOP_TRAVEL_DEVICE_DURATION_DAYS, 14)),
  ),
  disableTravelTokenEnforcement: parseBoolean(
    process.env.DISABLE_TRAVEL_TOKEN_ENFORCEMENT,
    false,
  ),
  updateServerUrl: process.env.UPDATE_SERVER_URL?.trim() || undefined,
  updateManifestCacheTtlMs: Math.max(
    5_000,
    parseNumber(process.env.UPDATE_MANIFEST_CACHE_TTL_MS, 30_000),
  ),
  feedModerationDiscordWebhookUrl: process.env.FEED_MODERATION_DISCORD_WEBHOOK_URL?.trim() || undefined,
  feedMaxLinksPerPost: Math.max(1, Math.min(25, parseNumber(process.env.FEED_MAX_LINKS_PER_POST, 8))),
  feedMaxMediaItems: Math.max(0, Math.min(12, parseNumber(process.env.FEED_MAX_MEDIA_ITEMS, 6))),
  feedAutoFlagScoreThreshold: Math.max(
    20,
    Math.min(300, parseNumber(process.env.FEED_AUTO_FLAG_SCORE_THRESHOLD, 40)),
  ),
};

const ensure = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const validateEnv = (): void => {
  ensure(env.databaseUrl.length > 0, "DATABASE_URL is required");
  ensure(env.betterAuthSecret.length > 0, "BETTER_AUTH_SECRET is required");
  ensure(env.jwtKeyId.length > 0, "JWT_KEY_ID is required");
  if (env.jwtAlgorithm === "HS256") {
    ensure(env.jwtSecret.length > 0, "JWT_SECRET is required when JWT_ALGORITHM=HS256");
    ensure(
      env.jwtPreviousPublicKeys.length === 0,
      "JWT_PREVIOUS_PUBLIC_KEYS_JSON is only valid when JWT_ALGORITHM=RS256",
    );
  } else {
    ensure(
      Boolean(env.jwtPrivateKey && env.jwtPrivateKey.includes("BEGIN")),
      "JWT_PRIVATE_KEY is required when JWT_ALGORITHM=RS256",
    );
    ensure(
      Boolean(env.jwtPublicKey && env.jwtPublicKey.includes("BEGIN")),
      "JWT_PUBLIC_KEY is required when JWT_ALGORITHM=RS256",
    );
    ensure(
      env.jwtPreviousSecrets.length === 0,
      "JWT_PREVIOUS_SECRETS is only valid when JWT_ALGORITHM=RS256",
    );
    ensure(
      env.jwtPreviousPublicKeys.every((key) => key.includes("BEGIN")),
      "JWT_PREVIOUS_PUBLIC_KEYS_JSON must contain valid PEM public keys",
    );
  }

  if (env.nodeEnv === "production") {
    if (env.jwtAlgorithm === "HS256") {
      ensure(env.jwtSecret.length >= 32, "JWT_SECRET must have at least 32 chars in production");
      ensure(
        env.jwtPreviousSecrets.every((secret) => secret.length >= 32),
        "JWT_PREVIOUS_SECRETS entries must have at least 32 chars in production",
      );
    }
    ensure(
      env.betterAuthSecret.length >= 32,
      "BETTER_AUTH_SECRET must have at least 32 chars in production",
    );
    ensure(
      env.allowedOrigins.every(
        (origin) =>
          origin.startsWith("https://") || isDesktopCorsOrigin(origin) || isLoopbackHttpOrigin(origin),
      ),
      "ALLOWED_ORIGINS must use HTTPS, desktop app, or loopback HTTP origins in production",
    );
    ensure(
      env.betterAuthUrl.startsWith("https://"),
      "BETTER_AUTH_URL must use HTTPS in production",
    );
    if (env.crossSubDomainCookieDomain) {
      ensure(
        env.crossSubDomainCookieDomain.startsWith("."),
        "CROSS_SUBDOMAIN_COOKIE_DOMAIN must start with '.' when configured",
      );
      ensure(
        env.crossSubDomainCookieDomain.split(".").filter(Boolean).length >= 2,
        "CROSS_SUBDOMAIN_COOKIE_DOMAIN must target a registrable parent domain",
      );
    }
    if (env.resendApiKey || env.resendFromEmail) {
      ensure(Boolean(env.resendApiKey), "RESEND_API_KEY is required when email delivery is enabled");
      ensure(Boolean(env.resendFromEmail), "RESEND_FROM_EMAIL is required when email delivery is enabled");
    }

    if (env.desktopBootstrapSecret) {
      ensure(
        env.desktopBootstrapSecret.length >= 24,
        "DESKTOP_BOOTSTRAP_SECRET must have at least 24 chars when configured",
      );
    }
    if (env.feedModerationDiscordWebhookUrl) {
      ensure(
        env.feedModerationDiscordWebhookUrl.startsWith("https://"),
        "FEED_MODERATION_DISCORD_WEBHOOK_URL must use HTTPS in production",
      );
    }
  } else {
    if (env.feedModerationDiscordWebhookUrl) {
      ensure(
        env.feedModerationDiscordWebhookUrl.startsWith("https://"),
        "FEED_MODERATION_DISCORD_WEBHOOK_URL must use HTTPS when configured",
      );
    }
  }
};
