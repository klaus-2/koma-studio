/**
 * Desktop-session wire contract — the single home for the names, paths,
 * payloads and error codes shared by the auth-server desktop-client surface,
 * the electron main bridge and the tauri commands.
 *
 * Runtime enforcement: the auth-server consumes the header/path constants,
 * `DesktopBootstrapResponse`, `DesktopDeviceRegisterResponse`,
 * `DesktopSessionSnapshot` and `DESKTOP_SESSION_ERROR_CODES`. The request
 * interfaces document the client payloads; the route tests scan the emitted
 * error codes against the contract.
 *
 * Server surface: apps/auth-server/src/routes/desktop.ts (register /
 * bootstrap / travel-token) plus the desktop-client enforcement middleware in
 * routes/_shared.ts. The electron bridge and the tauri commands keep their own
 * runtime copies (separate bundles, and the tauri side is Rust).
 *
 * Client-side behaviors documented here on purpose:
 * - Cookie fallback is CLIENT-ONLY: the electron/tauri bridges may fall back
 *   to better-auth session cookies for non-desktop-client endpoints; the
 *   server never requires it on the desktop-client surface.
 * - Desktop-client enforcement is HEADER-ONLY (routes/desktop.ts enforcement
 *   middleware): the server reads x-desktop-session-id / x-desktop-device-id /
 *   x-desktop-client-token from request headers exclusively — never from the
 *   body or cookies.
 */

/* ── Header names (server: routes/_shared.ts:658-665) ── */

export const DESKTOP_CLIENT_TOKEN_HEADER = "x-desktop-client-token";
export const DESKTOP_SESSION_ID_HEADER = "x-desktop-session-id";
export const DESKTOP_DEVICE_ID_HEADER = "x-desktop-device-id";
export const DESKTOP_APP_VERSION_HEADER = "x-desktop-app-version";
export const DESKTOP_UPDATE_CHANNEL_HEADER = "x-desktop-update-channel";
export const DESKTOP_BOOTSTRAP_SECRET_HEADER = "x-desktop-bootstrap-secret";
export const DESKTOP_DEVICE_KEY_HEADER = "x-desktop-device-key";
export const DESKTOP_TRAVEL_TOKEN_HEADER = "x-desktop-travel-token";

/* ── Endpoint paths (server: routes/desktop.ts) ── */

export const DESKTOP_DEVICE_REGISTER_PATH = "/api/internal/desktop-client/register";
export const DESKTOP_BOOTSTRAP_PATH = "/api/internal/desktop-client/bootstrap";
export const DESKTOP_TRAVEL_TOKEN_PATH = "/api/internal/desktop-client/travel-token";

/* ── Device slots ── */

export type DesktopDeviceSlot = "primary" | "travel";

/* ── Device register (POST /api/internal/desktop-client/register) ── */

/**
 * Request body. The server reads `deviceId` (required, safe identifier),
 * `syncReason` (optional) and `travelToken` (optional; the
 * x-desktop-travel-token header takes precedence). `machineProfile` is
 * IGNORED by the server by design (dead field — tauri stopped sending it).
 */
export interface DesktopDeviceRegisterRequest {
  deviceId: string;
  syncReason?: string;
  travelToken?: string;
}

/** Success response (200). deviceKey is a 43-char base64url secret (randomBytes(32)). */
export interface DesktopDeviceRegisterResponse {
  success: true;
  deviceId: string;
  deviceKey: string;
  slot: DesktopDeviceSlot;
  travelExpiresAt: string | null;
}

/* ── Bootstrap (POST /api/internal/desktop-client/bootstrap) ── */

/**
 * Request body: the client-proposed session token plus identity. `token` is
 * required; `ttlSeconds` is optional (the server clamps it against its own
 * configured TTL bounds). Authentication travels in the x-desktop-device-key
 * and/or x-desktop-bootstrap-secret headers (BOTH are sent when available).
 */
export interface DesktopBootstrapRequest {
  sessionId: string;
  deviceId: string;
  token: string;
  ttlSeconds?: number;
}

/**
 * Success response (200). Typed EXACTLY as the server emits it — every field
 * below is always present on success.
 */
export interface DesktopBootstrapResponse {
  success: true;
  sessionId: string;
  deviceId: string;
  ttlSeconds: number;
  refreshAfterSeconds: number;
  expiresAt: string;
}

/* ── Session snapshot (auth session/user payloads) ── */

/**
 * The desktop session user snapshot — mirrors the server's
 * AuthUserResponsePayload (routes/_shared.ts:163) exactly, including
 * `activeBan: null` (active bans are reported out-of-band via the AUTH_BANNED
 * error envelope instead).
 */
export type AppRole = "user" | "moderator" | "admin" | "owner";

export interface DesktopSessionSnapshot {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  locale: string;
  appRole: AppRole;
  feedProfileStatus: string;
  authorNotificationWebhookConfigured: boolean;
  activeBan: null;
}

/* ── Error codes (frozen — do NOT rename or invent) ── */

/**
 * Every `code` the auth-server routes emit. The contract test scans
 * `apps/auth-server/src/routes/*.ts` and fails when a code is missing here, so
 * the set cannot drift silently. Frozen: the renderer and the recovery
 * classifier branch on these strings.
 */
export const DESKTOP_SESSION_ERROR_CODES = [
  "DESKTOP_REGISTER_INVALID_PAYLOAD",
  "AUTH_SESSION_REQUIRED",
  "DESKTOP_TRAVEL_TOKEN_REQUIRED",
  "DESKTOP_TRAVEL_TOKEN_INVALID",
  "DESKTOP_REGISTER_FAILED",
  "DESKTOP_BOOTSTRAP_INVALID_PAYLOAD",
  "DESKTOP_DEVICE_NOT_REGISTERED",
  "DESKTOP_DEVICE_KEY_INVALID",
  "DESKTOP_BOOTSTRAP_UNAUTHORIZED",
  "DESKTOP_CLIENT_REQUIRED",
  "DESKTOP_CLIENT_SESSION_INVALID",
  "DESKTOP_TRAVEL_TOKEN_INVALID_DEVICE",
  "DESKTOP_PRIMARY_DEVICE_REQUIRED",
  "DESKTOP_TRAVEL_TOKEN_PRIMARY_ONLY",
  "AUTH_EMAIL_DELIVERY_UNAVAILABLE",
  "DESKTOP_TRAVEL_TOKEN_FAILED",
  "AUTH_BANNED",
  "AUTH_INVALID_TOKEN",
  "EMAIL_NOT_VERIFIED",
  "AUTH_FORBIDDEN",
  "AUTH_ACCOUNT_LOCKED",
  "AUTH_INVALID_LOCALE",
  "AUTH_MULTI_ACCOUNT_BLOCKED",
  "WEB_DASHBOARD_DISABLED",
] as const;

export type DesktopSessionErrorCode = (typeof DESKTOP_SESSION_ERROR_CODES)[number];

/** Payload shape of a desktop-client error envelope (server error emission). */
export interface DesktopSessionErrorPayload {
  error: string;
  code: DesktopSessionErrorCode;
  [key: string]: unknown;
}
