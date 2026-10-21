/**
 * Desktop auth HTTP header names and TTL parsing.
 */
const DESKTOP_CLIENT_TOKEN_HEADER = "x-desktop-client-token";
const DESKTOP_SESSION_ID_HEADER = "x-desktop-session-id";
const DESKTOP_DEVICE_ID_HEADER = "x-desktop-device-id";
const DESKTOP_APP_VERSION_HEADER = "x-desktop-app-version";
const DESKTOP_UPDATE_CHANNEL_HEADER = "x-desktop-update-channel";
const DESKTOP_BOOTSTRAP_SECRET_HEADER = "x-desktop-bootstrap-secret";
const DESKTOP_DEVICE_KEY_HEADER = "x-desktop-device-key";
const DESKTOP_TRAVEL_TOKEN_HEADER = "x-desktop-travel-token";
const LOCAL_API_SESSION_HEADER = "x-koma-local-session";
const DESKTOP_BOOTSTRAP_PATH = "/api/internal/desktop-client/bootstrap";
const DESKTOP_DEVICE_REGISTER_PATH = "/api/internal/desktop-client/register";
const DESKTOP_TRAVEL_TOKEN_PATH = "/api/internal/desktop-client/travel-token";
const DESKTOP_TRAVEL_TOKEN_REQUIRED = "DESKTOP_TRAVEL_TOKEN_REQUIRED";
const DESKTOP_TRAVEL_TOKEN_INVALID = "DESKTOP_TRAVEL_TOKEN_INVALID";

const parseDesktopTokenTtlSec = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(900, Math.max(300, Math.trunc(parsed)));
};

const parseDesktopRefreshSkewSec = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(300, Math.max(30, Math.trunc(parsed)));
};

export {
  DESKTOP_APP_VERSION_HEADER,
  DESKTOP_BOOTSTRAP_PATH,
  DESKTOP_BOOTSTRAP_SECRET_HEADER,
  DESKTOP_CLIENT_TOKEN_HEADER,
  DESKTOP_DEVICE_ID_HEADER,
  DESKTOP_DEVICE_KEY_HEADER,
  DESKTOP_DEVICE_REGISTER_PATH,
  DESKTOP_SESSION_ID_HEADER,
  DESKTOP_TRAVEL_TOKEN_HEADER,
  DESKTOP_TRAVEL_TOKEN_INVALID,
  DESKTOP_TRAVEL_TOKEN_PATH,
  DESKTOP_TRAVEL_TOKEN_REQUIRED,
  DESKTOP_UPDATE_CHANNEL_HEADER,
  LOCAL_API_SESSION_HEADER,
  parseDesktopRefreshSkewSec,
  parseDesktopTokenTtlSec,
};
