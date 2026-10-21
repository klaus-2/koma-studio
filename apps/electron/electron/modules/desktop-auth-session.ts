/**
 * Desktop auth session token + device-key lifecycle.
 */
import { type Session } from "electron";
import { randomBytes, randomUUID } from "node:crypto";
import {
  DESKTOP_BOOTSTRAP_PATH,
  DESKTOP_BOOTSTRAP_SECRET_HEADER,
  DESKTOP_DEVICE_KEY_HEADER,
  DESKTOP_DEVICE_REGISTER_PATH,
  DESKTOP_TRAVEL_TOKEN_HEADER,
} from "./desktop-auth-constants.ts";
import { resolveDesktopDeviceId } from "./desktop-device-id.ts";
import {
  fetchWithTimeoutAndRetry,
  parseResponsePayload,
  summarizeDesktopApiPayload,
  toDesktopStructuredError,
  DESKTOP_FETCH_TIMEOUT_MS,
} from "./shared.ts";
import {
  debugDesktopInfo,
  debugDesktopLog,
  debugDesktopWarn,
} from "./session-log.ts";

type DesktopSessionState = {
  sessionId: string;
  deviceId: string;
  token: string;
  expiresAtMs: number;
  refreshTimeout: NodeJS.Timeout | null;
  refreshInFlight: Promise<void> | null;
};

interface DesktopAuthSessionDeps {
  authApiUrl: string;
  bootstrapSecret: string;
  tokenTtlSec: number;
  refreshSkewSec: number;
  enforceDesktopClient: boolean;
  getDesktopHttpSession: () => Session;
  resolveDesktopEnvValue: (key: string) => string | null;
}

interface DesktopAuthSession {
  getState: () => DesktopSessionState;
  getPendingTravelToken: () => string | null;
  setPendingTravelToken: (token: string | null) => void;
  clearSessionState: (clearDeviceKey: boolean) => void;
  clearTokenRefreshTimeout: () => void;
  registerDeviceKey: (
    reason: "register" | "login" | "startup" | "session-refresh",
    options?: { travelToken?: string | null },
  ) => Promise<void>;
  registerSessionToken: () => Promise<void>;
  refreshToken: (reason: "startup" | "scheduled" | "on-demand") => Promise<boolean>;
  ensureToken: (reason?: "startup" | "on-demand") => Promise<void>;
}

const generateDesktopSessionToken = (): string => randomBytes(32).toString("base64url");

const createDesktopAuthSession = (deps: DesktopAuthSessionDeps): DesktopAuthSession => {
  const {
    authApiUrl,
    bootstrapSecret,
    tokenTtlSec,
    refreshSkewSec,
    enforceDesktopClient,
    getDesktopHttpSession,
    resolveDesktopEnvValue,
  } = deps;

  const desktopSessionState: DesktopSessionState = {
    sessionId: `desktop-${randomUUID()}`,
    deviceId: resolveDesktopDeviceId(),
    token: "",
    expiresAtMs: 0,
    refreshTimeout: null,
    refreshInFlight: null,
  };
  let desktopDeviceKey = "";
  let desktopDeviceKeyRefreshInFlight: Promise<void> | null = null;
  let desktopPendingTravelToken =
    (resolveDesktopEnvValue("DESKTOP_TRAVEL_TOKEN") ?? "").trim() || null;

  const clearDesktopTokenRefreshTimeout = (): void => {
    if (!desktopSessionState.refreshTimeout) {
      return;
    }

    clearTimeout(desktopSessionState.refreshTimeout);
    desktopSessionState.refreshTimeout = null;
  };

  const clearDesktopSessionState = (clearDeviceKey: boolean): void => {
    clearDesktopTokenRefreshTimeout();
    desktopSessionState.token = "";
    desktopSessionState.expiresAtMs = 0;
    desktopPendingTravelToken = null;
    if (clearDeviceKey) {
      desktopDeviceKey = "";
    }
  };

  const scheduleDesktopSessionTokenRefresh = (expiresAtMs: number): void => {
    clearDesktopTokenRefreshTimeout();

    const refreshSkewMs = refreshSkewSec * 1_000;
    const refreshInMs = Math.max(15_000, expiresAtMs - Date.now() - refreshSkewMs);
    desktopSessionState.refreshTimeout = setTimeout(() => {
      void refreshDesktopSessionToken("scheduled");
    }, refreshInMs);
  };

  const registerDesktopDeviceKey = async (
    reason: "register" | "login" | "startup" | "session-refresh",
    options: { travelToken?: string | null } = {},
  ): Promise<void> => {
    if (desktopDeviceKey.length > 0) {
      return;
    }

    if (desktopDeviceKeyRefreshInFlight) {
      await desktopDeviceKeyRefreshInFlight;
      return;
    }

    desktopDeviceKeyRefreshInFlight = (async () => {
      const endpoint = new URL(DESKTOP_DEVICE_REGISTER_PATH, authApiUrl).toString();
      const sessionClient = getDesktopHttpSession();
      const normalizedTravelToken =
        options.travelToken?.trim() ||
        desktopPendingTravelToken?.trim() ||
        "";
      const requestHeaders: Record<string, string> = {
        "content-type": "application/json",
      };
      if (normalizedTravelToken) {
        requestHeaders[DESKTOP_TRAVEL_TOKEN_HEADER] = normalizedTravelToken;
      }
      const requestInit: RequestInit = {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          deviceId: desktopSessionState.deviceId,
          syncReason: reason,
          ...(normalizedTravelToken
            ? {
                travelToken: normalizedTravelToken,
              }
            : {}),
        }),
      };

      debugDesktopInfo(
        `[desktop-auth] device-register start reason=${reason} endpoint=${DESKTOP_DEVICE_REGISTER_PATH} travelToken=${normalizedTravelToken ? "yes" : "no"}`,
      );

      const response = await fetchWithTimeoutAndRetry(
        (signal) =>
          sessionClient.fetch(endpoint, {
            ...requestInit,
            signal,
          }),
        requestInit,
        {
          timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
          retryCount: 0,
        },
      );

      if (!response.ok) {
        const failurePayload = await parseResponsePayload(response);
        debugDesktopWarn(
          `[desktop-auth] device-register failed status=${response.status} endpoint=${DESKTOP_DEVICE_REGISTER_PATH} ${summarizeDesktopApiPayload(
            failurePayload,
          )}`,
        );
        throw toDesktopStructuredError(response.status, failurePayload);
      }

      const payload = (await response.json()) as { deviceKey?: string };
      const key = typeof payload.deviceKey === "string" ? payload.deviceKey.trim() : "";
      if (!key || key.length < 43) {
        throw new Error("Desktop device registration returned an invalid key.");
      }

      desktopDeviceKey = key;
      desktopPendingTravelToken = null;
      debugDesktopInfo(
        `[desktop-auth] device-register ok reason=${reason} endpoint=${DESKTOP_DEVICE_REGISTER_PATH}`,
      );
      if (reason === "login" || reason === "register") {
        debugDesktopLog("[desktop-auth] Desktop device key registered for current session.");
      }
    })();

    try {
      await desktopDeviceKeyRefreshInFlight;
    } finally {
      desktopDeviceKeyRefreshInFlight = null;
    }
  };

  const registerDesktopSessionToken = async (): Promise<void> => {
    if (enforceDesktopClient) {
      await registerDesktopDeviceKey("session-refresh");
    }

    const token = generateDesktopSessionToken();
    const endpoint = new URL(DESKTOP_BOOTSTRAP_PATH, authApiUrl).toString();

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    // Send BOTH when available: with ENFORCE_DESKTOP_CLIENT=true the server
    // validates the device key; with false it requires the secret. Sending only
    // the key (legacy flow) left the bootstrap at 401 when the server was not
    // enforcing.
    if (desktopDeviceKey) {
      headers[DESKTOP_DEVICE_KEY_HEADER] = desktopDeviceKey;
    }
    if (bootstrapSecret) {
      headers[DESKTOP_BOOTSTRAP_SECRET_HEADER] = bootstrapSecret;
    }

    const bootstrapInit: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionId: desktopSessionState.sessionId,
        deviceId: desktopSessionState.deviceId,
        token,
        ttlSeconds: tokenTtlSec,
      }),
    };
    debugDesktopInfo(
      `[desktop-auth] bootstrap start endpoint=${DESKTOP_BOOTSTRAP_PATH} deviceKey=${desktopDeviceKey ? "yes" : "no"} secret=${bootstrapSecret ? "yes" : "no"}`,
    );
    const response = await fetchWithTimeoutAndRetry(
      (signal) =>
        fetch(endpoint, {
          ...bootstrapInit,
          signal,
        }),
      bootstrapInit,
      {
        timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
        retryCount: 0,
      },
    );

    if (!response.ok) {
      const failurePayload = await parseResponsePayload(response);
      debugDesktopWarn(
        `[desktop-auth] bootstrap failed status=${response.status} endpoint=${DESKTOP_BOOTSTRAP_PATH} ${summarizeDesktopApiPayload(
          failurePayload,
        )}`,
      );
      const hint = response.status === 401 && enforceDesktopClient
        ? " (desktop device is not registered/authenticated)"
        : response.status === 401 && bootstrapSecret
          ? " (verify DESKTOP_BOOTSTRAP_SECRET in both koma-studio/.env.* and auth-server/.env.*)"
          : "";
      throw new Error(`Desktop bootstrap failed with status ${response.status}${hint}`);
    }

    const payload = (await response.json()) as { expiresAt?: string; ttlSeconds?: number };
    const ttlSeconds =
      typeof payload.ttlSeconds === "number" && Number.isFinite(payload.ttlSeconds)
        ? payload.ttlSeconds
        : tokenTtlSec;
    const parsedExpiresAt =
      typeof payload.expiresAt === "string" ? Date.parse(payload.expiresAt) : Number.NaN;
    const expiresAtMs = Number.isFinite(parsedExpiresAt)
      ? parsedExpiresAt
      : Date.now() + ttlSeconds * 1_000;

    desktopSessionState.token = token;
    desktopSessionState.expiresAtMs = expiresAtMs;
    scheduleDesktopSessionTokenRefresh(expiresAtMs);
    debugDesktopInfo(
      `[desktop-auth] bootstrap ok endpoint=${DESKTOP_BOOTSTRAP_PATH} ttlSeconds=${ttlSeconds}`,
    );
  };

  const refreshDesktopSessionToken = async (
    reason: "startup" | "scheduled" | "on-demand",
  ): Promise<boolean> => {
    if (desktopSessionState.refreshInFlight) {
      try {
        await desktopSessionState.refreshInFlight;
        return true;
      } catch {
        return false;
      }
    }

    let succeeded = true;
    const hadTokenBeforeRefresh = desktopSessionState.token.length > 0;
    desktopSessionState.refreshInFlight = (async () => {
      try {
        await registerDesktopSessionToken();
      } catch (error) {
        succeeded = false;
        debugDesktopWarn(
          `[desktop-auth] failed to refresh session token: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (reason === "scheduled" || hadTokenBeforeRefresh) {
          scheduleDesktopSessionTokenRefresh(Date.now() + 30_000);
        }
      }
    })();

    try {
      await desktopSessionState.refreshInFlight;
      return succeeded;
    } finally {
      desktopSessionState.refreshInFlight = null;
    }
  };

  const ensureDesktopSessionToken = async (
    reason: "startup" | "on-demand" = "on-demand",
  ): Promise<void> => {
    const hasValidToken =
      desktopSessionState.token.length > 0 &&
      desktopSessionState.expiresAtMs - Date.now() > refreshSkewSec * 1_000;
    if (hasValidToken) {
      return;
    }

    const refreshed = await refreshDesktopSessionToken(reason);
    if (!refreshed) {
      if (enforceDesktopClient) {
        throw new Error("Desktop session token bootstrap failed");
      }

      // In non-enforced mode, continue without desktop session token headers.
      clearDesktopSessionState(false);
    }
  };

  return {
    getState: () => desktopSessionState,
    getPendingTravelToken: () => desktopPendingTravelToken,
    setPendingTravelToken: (token: string | null) => {
      desktopPendingTravelToken = token;
    },
    clearSessionState: clearDesktopSessionState,
    clearTokenRefreshTimeout: clearDesktopTokenRefreshTimeout,
    registerDeviceKey: registerDesktopDeviceKey,
    registerSessionToken: registerDesktopSessionToken,
    refreshToken: refreshDesktopSessionToken,
    ensureToken: ensureDesktopSessionToken,
  };
};

export type { DesktopAuthSession, DesktopSessionState };
export { createDesktopAuthSession };
