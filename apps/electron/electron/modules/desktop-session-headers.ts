/**
 * Desktop session HTTP headers (app version + update channel + client token).
 */
import {
  DESKTOP_APP_VERSION_HEADER,
  DESKTOP_CLIENT_TOKEN_HEADER,
  DESKTOP_DEVICE_ID_HEADER,
  DESKTOP_SESSION_ID_HEADER,
  DESKTOP_UPDATE_CHANNEL_HEADER,
} from "./desktop-auth-constants.ts";

// Source-only model: no native updater state — infer the channel from the app
// version (same heuristic as the renderer's inferChannelFromVersion).
const getDesktopUpdateChannel = (appVersion: string): "stable" | "beta" => {
  return appVersion.includes("-") ? "beta" : "stable";
};

interface DesktopSessionHeaderState {
  token: string;
  sessionId: string;
  deviceId: string;
}

const buildDesktopSessionHeaders = (
  headersInit: HeadersInit | undefined,
  accessToken: string | undefined,
  session: DesktopSessionHeaderState,
  appVersion: string,
): Headers => {
  const headers = new Headers(headersInit);
  headers.set(DESKTOP_APP_VERSION_HEADER, appVersion);
  headers.set(DESKTOP_UPDATE_CHANNEL_HEADER, getDesktopUpdateChannel(appVersion));
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (session.token) {
    headers.set(DESKTOP_CLIENT_TOKEN_HEADER, session.token);
    headers.set(DESKTOP_SESSION_ID_HEADER, session.sessionId);
    headers.set(DESKTOP_DEVICE_ID_HEADER, session.deviceId);
  }
  return headers;
};

export { buildDesktopSessionHeaders, getDesktopUpdateChannel };
