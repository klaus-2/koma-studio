/**
 * Desktop auth session API fetch with recovery.
 */
import { app, type Session } from "electron";
import {
  resolveDesktopSessionRecoveryAction,
  type DesktopSessionRecoveryAction,
} from "../../../../packages/types/src/desktopSessionRecovery.ts";
import type {
  DesktopApiEnvelope,
  JsonRecord,
} from "../../../../packages/types/src/desktop-api.ts";
import {
  DESKTOP_FETCH_RETRY_COUNT,
  DESKTOP_FETCH_TIMEOUT_MS,
  fetchWithTimeoutAndRetry,
  isDesktopStructuredError,
  normalizeHttpMethod,
  parseResponsePayload,
  summarizeDesktopApiPayload,
  toDesktopAuthErrorEnvelope,
} from "./shared.ts";
import {
  debugDesktopError,
  debugDesktopInfo,
  debugDesktopWarn,
} from "./session-log.ts";
import type { DesktopAuthSession } from "./desktop-auth-session.ts";
import { buildDesktopSessionHeaders } from "./desktop-session-headers.ts";

interface DesktopSessionApiDeps {
  desktopAuth: DesktopAuthSession;
  authApiUrl: string;
  getDesktopHttpSession: () => Session;
}

const createDesktopSessionApi = (deps: DesktopSessionApiDeps) => {
  const { desktopAuth, authApiUrl, getDesktopHttpSession } = deps;

  const recoverDesktopSession = async (
    action: DesktopSessionRecoveryAction,
  ): Promise<boolean> => {
    if (!action) {
      return false;
    }

    const attemptRecovery = async (clearDeviceKey: boolean): Promise<boolean> => {
      desktopAuth.clearSessionState(clearDeviceKey);
      return desktopAuth.refreshToken("on-demand");
    };

    const initialRecovery = await attemptRecovery(action === "refresh-device");
    if (initialRecovery) {
      return true;
    }

    if (action === "refresh-session") {
      return attemptRecovery(true);
    }

    return false;
  };


  const desktopSessionApiFetch = async (
    endpointPath: string,
    init: RequestInit = {},
    options: { requireDesktopSession?: boolean } = {},
  ): Promise<DesktopApiEnvelope> => {
    const requireDesktopSession = options.requireDesktopSession === true;
    const method = normalizeHttpMethod(init.method);
    const targetUrl = new URL(endpointPath, authApiUrl).toString();
    const sessionClient = getDesktopHttpSession();

    try {
      if (requireDesktopSession) {
        await desktopAuth.ensureToken("on-demand");
      }

      debugDesktopInfo(
        `[desktop-auth] request start method=${method} endpoint=${endpointPath} desktopSession=${requireDesktopSession ? "required" : "optional"} token=${desktopAuth.getState().token ? "yes" : "no"}`,
      );
      const sendRequest = async (): Promise<{ response: globalThis.Response; payload: JsonRecord | null }> => {
        const requestInit: RequestInit = {
          ...init,
          headers: buildDesktopSessionHeaders(init.headers, undefined, desktopAuth.getState(), app.getVersion()),
        };

        const response = await fetchWithTimeoutAndRetry(
          (signal) =>
            sessionClient.fetch(targetUrl, {
              ...requestInit,
              signal,
            }),
          requestInit,
          {
            timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
            retryCount: DESKTOP_FETCH_RETRY_COUNT,
          },
        );
        const payload = await parseResponsePayload(response);
        return { response, payload };
      };

      let result = await sendRequest();
      if (!result.response.ok) {
        const recoveryAction = resolveDesktopSessionRecoveryAction(
          result.response.status,
          result.payload,
        );
        debugDesktopWarn(
          `[desktop-auth] request failed method=${method} endpoint=${endpointPath} status=${result.response.status} recovery=${recoveryAction ?? "none"} ${summarizeDesktopApiPayload(
            result.payload,
          )}`,
        );
        if (await recoverDesktopSession(recoveryAction)) {
          debugDesktopInfo(
            `[desktop-auth] request retry after recovery method=${method} endpoint=${endpointPath} recovery=${recoveryAction}`,
          );
          result = await sendRequest();
        }
      }

      debugDesktopInfo(
        `[desktop-auth] request done method=${method} endpoint=${endpointPath} status=${result.response.status} ok=${result.response.ok}`,
      );

      return {
        ok: result.response.ok,
        status: result.response.status,
        payload: result.payload,
      };
    } catch (error) {
      if (isDesktopStructuredError(error)) {
        debugDesktopWarn(
          `[desktop-auth] request structured-failed method=${method} endpoint=${endpointPath} status=${error.status} ${summarizeDesktopApiPayload(
            error.payload,
          )}`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Desktop session failure.",
          error.code ?? "DESKTOP_BOOTSTRAP_FAILED",
        );
      }

      debugDesktopError(
        `[desktop-auth] request network-failed method=${method} endpoint=${endpointPath} url=${targetUrl} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        ok: false,
        status: 503,
        payload: {
          error: error instanceof Error ? error.message : "Failed to connect to auth-server.",
          code: "DESKTOP_API_UNAVAILABLE",
        },
      };
    }
  };

  const fetchDesktopCookieSessionEnvelope = async (): Promise<DesktopApiEnvelope> =>
    desktopSessionApiFetch(
      "/api/auth/session",
      { method: "GET" },
      { requireDesktopSession: false },
    );

  return { desktopSessionApiFetch, fetchDesktopCookieSessionEnvelope, recoverDesktopSession };
};

export type { DesktopApiEnvelope, DesktopSessionApiDeps };
export { createDesktopSessionApi };
