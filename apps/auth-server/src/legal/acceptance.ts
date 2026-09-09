import type { EmailLocale } from "../services/locale.js";
import { tServer } from "../services/server-i18n.js";

export interface LegalAcceptanceInput {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  cookiesVersion?: string;
  contentVersion?: string;
}

export interface NormalizedLegalAcceptance {
  termsVersion: string;
  privacyVersion: string;
  cookiesVersion: string | null;
  contentVersion: string | null;
}

type ValidationResult =
  | { ok: true; value: NormalizedLegalAcceptance }
  | { ok: false; error: string };

const sanitizeVersion = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 64) {
    return null;
  }

  return /^[a-zA-Z0-9._-]+$/.test(normalized) ? normalized : null;
};

export const parseLegalAcceptancePayload = (
  value: unknown,
  locale: EmailLocale = "en",
): ValidationResult => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: tServer(locale, "auth.error.legalAcceptanceRequired"),
    };
  }

  const payload = value as Record<string, unknown>;
  if (payload.termsAccepted !== true || payload.privacyAccepted !== true) {
    return {
      ok: false,
      error: tServer(locale, "auth.error.legalAcceptanceRequired"),
    };
  }

  const termsVersion = sanitizeVersion(payload.termsVersion);
  const privacyVersion = sanitizeVersion(payload.privacyVersion);
  const cookiesVersion = sanitizeVersion(payload.cookiesVersion) ?? null;
  const contentVersion = sanitizeVersion(payload.contentVersion) ?? null;

  if (!termsVersion || !privacyVersion) {
    return {
      ok: false,
      error: tServer(locale, "auth.error.legalVersionInvalid"),
    };
  }

  return {
    ok: true,
    value: {
      termsVersion,
      privacyVersion,
      cookiesVersion,
      contentVersion,
    },
  };
};
