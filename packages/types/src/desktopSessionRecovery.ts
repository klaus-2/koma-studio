export type DesktopSessionRecoveryAction = "refresh-session" | "refresh-device" | null;

const DESKTOP_SESSION_RECOVERY_CODES = new Set([
  "DESKTOP_CLIENT_REQUIRED",
  "DESKTOP_CLIENT_SESSION_INVALID",
]);

const DESKTOP_DEVICE_RECOVERY_CODES = new Set([
  "DESKTOP_DEVICE_KEY_INVALID",
  "DESKTOP_DEVICE_NOT_REGISTERED",
]);

// Patterns are bilingual (covering legacy v1 PT + v2 EN server messages) — the
// primary match is by `code`; the auth-server messages are i18n, so we cover
// both languages until the server always returns a code.
const DESKTOP_SESSION_RECOVERY_PATTERNS = [
  /sess[aã]o desktop inv[aá]lida ou expirada/i,
  /acesso permitido apenas pelo aplicativo desktop/i,
  /desktop session invalid or expired/i,
  /access is only allowed through the desktop app/i,
];

const DESKTOP_DEVICE_RECOVERY_PATTERNS = [
  /credencial de dispositivo desktop inv[aá]lida/i,
  /dispositivo desktop n[aã]o registrado/i,
  /invalid desktop device credential/i,
  /desktop device not registered/i,
];

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const matchesAnyPattern = (value: string | null, patterns: RegExp[]): boolean => {
  if (!value) {
    return false;
  }

  return patterns.some((pattern) => pattern.test(value));
};

export const extractDesktopSessionRecoveryCode = (payload: unknown): string | null => {
  const record = asRecord(payload);
  return normalizeString(record?.code);
};

export const extractDesktopSessionRecoveryMessage = (payload: unknown): string | null => {
  const record = asRecord(payload);
  return (
    normalizeString(record?.error) ??
    normalizeString(record?.detail) ??
    normalizeString(record?.message)
  );
};

export const resolveDesktopSessionRecoveryAction = (
  status: number,
  payload: unknown,
): DesktopSessionRecoveryAction => {
  const code = extractDesktopSessionRecoveryCode(payload);
  if (code && DESKTOP_SESSION_RECOVERY_CODES.has(code)) {
    return "refresh-session";
  }
  if (code && DESKTOP_DEVICE_RECOVERY_CODES.has(code)) {
    return "refresh-device";
  }

  const message = extractDesktopSessionRecoveryMessage(payload);
  if (status === 403 && matchesAnyPattern(message, DESKTOP_SESSION_RECOVERY_PATTERNS)) {
    return "refresh-session";
  }
  if ((status === 401 || status === 403) && matchesAnyPattern(message, DESKTOP_DEVICE_RECOVERY_PATTERNS)) {
    return "refresh-device";
  }

  return null;
};
