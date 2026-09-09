import type { EmailLocale } from "../services/locale.js";
import { tServer } from "../services/server-i18n.js";

const PROJECT_AUTH_ERROR_MESSAGES = {
  AUTH_INVALID_CREDENTIALS: "auth.error.invalidCredentials",
  AUTH_USER_ALREADY_EXISTS: "auth.error.userAlreadyExists",
  AUTH_PASSWORD_COMPROMISED: "auth.error.passwordCompromised",
  AUTH_INVALID_TOKEN: "auth.error.invalidToken",
  AUTH_CAPTCHA_REQUIRED: "auth.error.captchaRequired",
  AUTH_ACCOUNT_LOCKED: "auth.error.accountLocked",
  AUTH_EMAIL_DELIVERY_UNAVAILABLE: "auth.error.emailDeliveryUnavailable",
  AUTH_SESSION_REQUIRED: "auth.error.sessionRequired",
  AUTH_DESKTOP_IDENTITY_REQUIRED: "auth.error.desktopIdentityRequired",
  AUTH_DESKTOP_IDENTITY_INVALID: "auth.error.desktopIdentityInvalid",
  AUTH_MULTI_ACCOUNT_BLOCKED: "auth.error.multiAccountBlocked",
  DESKTOP_CLIENT_REQUIRED: "auth.error.desktopClientRequired",
  DESKTOP_CLIENT_SESSION_INVALID: "auth.error.desktopClientSessionInvalid",
  DESKTOP_TRAVEL_TOKEN_REQUIRED: "auth.error.desktopTravelTokenRequired",
  DESKTOP_TRAVEL_TOKEN_INVALID: "auth.error.desktopTravelTokenInvalid",
} as const;

export type ProjectAuthErrorCode = keyof typeof PROJECT_AUTH_ERROR_MESSAGES;

export interface NormalizeAuthErrorOptions {
  fallbackError: string;
  fallbackCode?: string;
  locale?: EmailLocale;
}

type ErrorPayloadSource = {
  code?: unknown;
  error?: unknown;
  detail?: unknown;
  message?: unknown;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const toComparableText = (value: string | null): string =>
  value?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";

const resolveRawCode = (payload: unknown): string | null => {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const code = (payload as ErrorPayloadSource).code;
  return typeof code === "string" && code.trim().length > 0 ? code.trim() : null;
};

const resolveRawMessage = (payload: unknown): string | null => {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  if (payload instanceof Error && payload.message.trim().length > 0) {
    return payload.message.trim();
  }

  if (!isObjectRecord(payload)) {
    return null;
  }

  const objectPayload = payload as ErrorPayloadSource;
  const candidates = [objectPayload.error, objectPayload.detail, objectPayload.message];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const isKnownProjectErrorCode = (code: string): code is ProjectAuthErrorCode =>
  code in PROJECT_AUTH_ERROR_MESSAGES;

const resolveNormalizedCode = (
  rawCode: string | null,
  rawMessage: string | null,
): string | undefined => {
  const comparableCode = toComparableText(rawCode);
  const comparableMessage = toComparableText(rawMessage);

  if (isKnownProjectErrorCode(comparableCode)) {
    return comparableCode;
  }

  if (
    comparableCode === "USER_ALREADY_EXISTS" ||
    comparableCode === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    comparableMessage.includes("ALREADY_EXISTS")
  ) {
    return "AUTH_USER_ALREADY_EXISTS";
  }

  if (comparableCode === "PASSWORD_COMPROMISED" || comparableMessage.includes("COMPROMISED")) {
    return "AUTH_PASSWORD_COMPROMISED";
  }

  if (
    comparableCode === "INVALID_TOKEN" ||
    comparableCode === "INVALID_SESSION_TOKEN" ||
    comparableMessage.includes("INVALID_TOKEN")
  ) {
    return "AUTH_INVALID_TOKEN";
  }

  if (
    comparableCode === "INVALID_EMAIL_OR_PASSWORD" ||
    comparableCode === "INVALID_USERNAME_OR_PASSWORD" ||
    comparableMessage.includes("INVALID_EMAIL_OR_PASSWORD") ||
    comparableMessage.includes("INVALID_CREDENTIALS") ||
    comparableMessage.includes("CREDENCIAIS_INVALIDAS")
  ) {
    return "AUTH_INVALID_CREDENTIALS";
  }

  if (
    comparableCode === "CAPTCHA_REQUIRED" ||
    comparableCode === "VERIFICATION_FAILED" ||
    comparableMessage.includes("CAPTCHA")
  ) {
    return "AUTH_CAPTCHA_REQUIRED";
  }

  if (
    comparableCode === "TOO_MANY_ATTEMPTS" ||
    comparableMessage.includes("TOO_MANY_ATTEMPTS") ||
    comparableMessage.includes("BLOQUEADA") ||
    comparableMessage.includes("BLOCKED")
  ) {
    return "AUTH_ACCOUNT_LOCKED";
  }

  if (
    comparableMessage.includes("FAILED_TO_SEND") ||
    comparableMessage.includes("EMAIL_INDISPONIVEL") ||
    comparableMessage.includes("EMAIL_DELIVERY")
  ) {
    return "AUTH_EMAIL_DELIVERY_UNAVAILABLE";
  }

  if (
    comparableMessage.includes("SESSION") &&
    (comparableMessage.includes("INVALID") || comparableMessage.includes("EXPIRED"))
  ) {
    return "AUTH_SESSION_REQUIRED";
  }

  if (rawCode && /^DESKTOP_[A-Z0-9_]+$/.test(comparableCode)) {
    return comparableCode;
  }

  return undefined;
};

export const normalizeAuthErrorPayload = (
  payload: unknown,
  options: NormalizeAuthErrorOptions,
): { error: string; code?: string } => {
  const rawCode = resolveRawCode(payload);
  const rawMessage = resolveRawMessage(payload);
  const code = resolveNormalizedCode(rawCode, rawMessage) ?? options.fallbackCode;

  if (code && isKnownProjectErrorCode(code)) {
    return {
      error: tServer(
        options.locale ?? "en",
        PROJECT_AUTH_ERROR_MESSAGES[code],
      ),
      code,
    };
  }

  return {
    error: rawMessage ?? options.fallbackError,
    ...(code ? { code } : {}),
  };
};
