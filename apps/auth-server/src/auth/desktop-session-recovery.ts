export type DesktopSessionRecoveryAction = "refresh-session" | "refresh-device" | null;

const DESKTOP_SESSION_RECOVERY_CODES = new Set([
  "DESKTOP_CLIENT_REQUIRED",
  "DESKTOP_CLIENT_SESSION_INVALID",
]);

const DESKTOP_DEVICE_RECOVERY_CODES = new Set([
  "DESKTOP_DEVICE_KEY_INVALID",
  "DESKTOP_DEVICE_NOT_REGISTERED",
]);

const DESKTOP_SESSION_RECOVERY_PATTERNS = [
  /desktop session invalid or expired/i,
  /access is only allowed through the desktop app/i,
];

const DESKTOP_DEVICE_RECOVERY_PATTERNS = [
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

