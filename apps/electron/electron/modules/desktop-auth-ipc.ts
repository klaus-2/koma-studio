/**
 * Desktop auth + shell-contract IPC handler registration.
 * The handler registration ORDER (login / register / travel-token set+create /
 * verify / confirm / forgot / reset / sign-out / refresh / identity /
 * cookie-fallback ordering) is the sequencing policy — do not reorder.
 */
import type { Session } from "electron";
import fs from "node:fs";
import path from "node:path";

import {
  clearDesktopAuthCookies,
  hasDesktopAuthCookie,
} from "./desktop-auth-cookies.ts";
import {
  DESKTOP_TRAVEL_TOKEN_INVALID,
  DESKTOP_TRAVEL_TOKEN_PATH,
  DESKTOP_TRAVEL_TOKEN_REQUIRED,
} from "./desktop-auth-constants.ts";
import type { DesktopAuthSession } from "./desktop-auth-session.ts";
import {
  createDesktopSessionApi,
  type DesktopApiEnvelope,
} from "./desktop-session-api.ts";
import { resolveDesktopDeviceId } from "./desktop-device-id.ts";
import { getCertificatePinsByHost } from "./certificate-pinning.ts";
import {
  debugDesktopInfo,
  debugDesktopWarn,
} from "./session-log.ts";
import {
  normalizeAccessToken,
  sanitizeSessionLogText,
  registerSecureIpcHandler,
  resolveDesktopErrorCode,
  isDesktopStructuredError,
  extractDesktopApiErrorMessage,
  summarizeDesktopApiPayload,
  toDesktopAuthErrorEnvelope,
} from "./shared.ts";
import {
  extractDeepLinkFromArgv,
  deepLinkToHashRoute,
  formatDeepLinkForLog,
} from "./deep-link.ts";
import { discordRPC } from "../discord-rpc.ts";

type DesktopSessionApi = ReturnType<typeof createDesktopSessionApi>;

interface DesktopAuthIpcDeps {
  desktopAuth: DesktopAuthSession;
  authApiUrl: string;
  getDesktopHttpSession: () => Session;
  desktopSessionApiFetch: DesktopSessionApi["desktopSessionApiFetch"];
  fetchDesktopCookieSessionEnvelope: DesktopSessionApi["fetchDesktopCookieSessionEnvelope"];
  navigateMainWindowFromDeepLink: (url: string) => void;
}

const setupDesktopAuthIpcHandlers = (deps: DesktopAuthIpcDeps): void => {
  const {
    desktopAuth,
    authApiUrl,
    getDesktopHttpSession,
    desktopSessionApiFetch,
    fetchDesktopCookieSessionEnvelope,
    navigateMainWindowFromDeepLink,
  } = deps;

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:config", async () => {
    return desktopSessionApiFetch(
      "/api/auth/config",
      { method: "GET" },
      { requireDesktopSession: false },
    );
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:session", async () => {
    if (!(await hasDesktopAuthCookie(authApiUrl, getDesktopHttpSession()))) {
      debugDesktopInfo("[desktop-auth] session request skipped because no auth cookie is present.");
      return {
        ok: true,
        status: 200,
        payload: null,
      };
    }

    const sessionEnvelope = await desktopSessionApiFetch(
      "/api/auth/session",
      { method: "GET" },
      { requireDesktopSession: true },
    );

    if (sessionEnvelope.ok) {
      debugDesktopInfo("[desktop-auth] session request resolved through desktop bootstrap session.");
      return sessionEnvelope;
    }

    const sessionErrorCode = resolveDesktopErrorCode(sessionEnvelope.payload);
    if (
      sessionErrorCode === DESKTOP_TRAVEL_TOKEN_REQUIRED ||
      sessionErrorCode === DESKTOP_TRAVEL_TOKEN_INVALID
    ) {
      debugDesktopWarn(
        `[desktop-auth] session request requires desktop travel token; cookie fallback disabled (${sessionErrorCode}).`,
      );
      return sessionEnvelope;
    }

    debugDesktopWarn(
      `[desktop-auth] session bootstrap failed, falling back to auth cookie session: ${extractDesktopApiErrorMessage(
        sessionEnvelope.payload,
        "Desktop auth session unavailable.",
      )}`,
    );

    const fallbackEnvelope = await fetchDesktopCookieSessionEnvelope();
    debugDesktopInfo(
      `[desktop-auth] session cookie fallback completed ok=${fallbackEnvelope.ok} status=${fallbackEnvelope.status}`,
    );
    return fallbackEnvelope;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:login", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
    const rememberMe = payload.rememberMe === true;
    const travelToken = typeof payload.travelToken === "string" ? payload.travelToken.trim() : "";

    if (!email || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Credenciais invalidas." },
      };
    }

    desktopAuth.clearSessionState(true);
    await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
    if (travelToken) {
      desktopAuth.setPendingTravelToken(travelToken);
    }

    debugDesktopInfo(
      `[desktop-auth] login start email=${sanitizeSessionLogText(email, 120)} rememberMe=${rememberMe ? "yes" : "no"} travelToken=${travelToken ? "yes" : "no"}`,
    );

    const response = await desktopSessionApiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        captchaToken,
        rememberMe,
        desktopDeviceId: desktopAuth.getState().deviceId,
      }),
    }, { requireDesktopSession: false });

    debugDesktopInfo(
      `[desktop-auth] login response status=${response.status} ok=${response.ok} ${summarizeDesktopApiPayload(
        response.payload,
      )}`,
    );

    if (!response.ok) {
      await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
      desktopAuth.clearSessionState(true);
      return response;
    }

    try {
      await desktopAuth.registerDeviceKey("login", { travelToken });
      await desktopAuth.refreshToken("on-demand");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === DESKTOP_TRAVEL_TOKEN_REQUIRED ||
          error.code === DESKTOP_TRAVEL_TOKEN_INVALID)
      ) {
        await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
        desktopAuth.clearSessionState(true);
        debugDesktopWarn(
          `[desktop-auth] post-login bootstrap requires travel token; returning auth error (${error.code}).`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Este dispositivo precisa de um token de viagem para entrar nesta conta.",
          error.code,
        );
      }

      debugDesktopWarn(
        `[desktop-auth] post-login bootstrap failed; continuing with cookie session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    debugDesktopInfo("[desktop-auth] login completed; renderer can refresh session snapshot.");

    return response;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:register", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const name = typeof payload.name === "string" ? payload.name : "";
    const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
    const travelToken = typeof payload.travelToken === "string" ? payload.travelToken.trim() : "";
    const legalAcceptance =
      payload.legalAcceptance && typeof payload.legalAcceptance === "object" && !Array.isArray(payload.legalAcceptance)
        ? payload.legalAcceptance
        : undefined;

    if (!email || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Dados de registro invalidos." },
      };
    }

    const response = await desktopSessionApiFetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        name,
        captchaToken,
        legalAcceptance,
        desktopDeviceId: desktopAuth.getState().deviceId,
      }),
    }, { requireDesktopSession: false });

    debugDesktopInfo(
      `[desktop-auth] register response status=${response.status} ok=${response.ok} ${summarizeDesktopApiPayload(
        response.payload,
      )}`,
    );

    if (!response.ok) {
      return response;
    }

    try {
      if (travelToken) {
        desktopAuth.setPendingTravelToken(travelToken);
      }
      await desktopAuth.registerDeviceKey("register", { travelToken });
      await desktopAuth.refreshToken("on-demand");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === DESKTOP_TRAVEL_TOKEN_REQUIRED ||
          error.code === DESKTOP_TRAVEL_TOKEN_INVALID)
      ) {
        await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
        desktopAuth.clearSessionState(true);
        debugDesktopWarn(
          `[desktop-auth] post-register bootstrap requires travel token; returning auth error (${error.code}).`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Este dispositivo precisa de um token de viagem para entrar nesta conta.",
          error.code,
        );
      }

      debugDesktopWarn(
        `[desktop-auth] post-register bootstrap failed; continuing with cookie session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return response;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:travel-token:set", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const rawToken = typeof payload.token === "string" ? payload.token.trim() : "";
    desktopAuth.setPendingTravelToken(rawToken.length > 0 ? rawToken : null);
    return {
      ok: true,
      status: 200,
      payload: {
        success: true,
      },
    };
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:travel-token:create", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const ttlMinutesRaw = Number(payload.ttlMinutes);
    const travelDaysRaw = Number(payload.travelDays);
    const requestBody: Record<string, unknown> = {};
    const deliveryMode =
      payload.deliveryMode === "email"
        ? "email"
        : payload.deliveryMode === "copy"
          ? "copy"
          : null;
    if (Number.isFinite(ttlMinutesRaw) && ttlMinutesRaw > 0) {
      requestBody.ttlMinutes = Math.trunc(ttlMinutesRaw);
    }
    if (Number.isFinite(travelDaysRaw) && travelDaysRaw > 0) {
      requestBody.travelDays = Math.trunc(travelDaysRaw);
    }
    if (deliveryMode) {
      requestBody.deliveryMode = deliveryMode;
    }

    return desktopSessionApiFetch(
      DESKTOP_TRAVEL_TOKEN_PATH,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      { requireDesktopSession: true },
    );
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:verify-email", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const accessToken = normalizeAccessToken(payload.accessToken);
    if (!accessToken) {
      return {
        ok: false,
        status: 401,
        payload: { error: "Sessao expirada. Faca login novamente." },
      };
    }

    return desktopSessionApiFetch("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:confirm-email", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!token) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid token.", code: "AUTH_INVALID_TOKEN" },
      };
    }

    return desktopSessionApiFetch("/api/auth/confirm-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:forgot-password", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    if (!email) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid email." },
      };
    }

    return desktopSessionApiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:reset-password", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!token || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid token or password." },
      };
    }

    return desktopSessionApiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
      }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:sign-out", async () => {
    const response = await desktopSessionApiFetch("/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }, { requireDesktopSession: false });

    await clearDesktopAuthCookies(authApiUrl, getDesktopHttpSession());
    desktopAuth.clearSessionState(true);
    return response;
  });

  // ─── v2 desktop shell contract: handlers that the Rust app exposes and the
  // ─── Electron shell did not previously register. They mirror the behaviour
  // ─── of the corresponding src-tauri commands.

  // auth:refresh-session — same flow as registerDesktopSessionToken
  // (POST to bootstrap with the device key or secret) to renew the session.
  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:refresh-session", async () => {
    await desktopAuth.registerSessionToken();
    return {
      ok: true,
      status: 200,
      payload: { refreshed: true, sessionId: desktopAuth.getState().sessionId },
    };
  });

  // identity: stable per-install id + HMAC fingerprint (the same data the
  // auth-server's desktop routes already consume).
  registerSecureIpcHandler("desktop-api:identity:hardware-id", async () => {
    return { hardwareId: resolveDesktopDeviceId() };
  });
  registerSecureIpcHandler("desktop-api:identity:machine-fingerprint", async () => {
    const deviceId = resolveDesktopDeviceId();
    // v1 does no hardware fingerprinting — the stable per-install id IS the fingerprint.
    return { fingerprint: deviceId };
  });

  // security: snapshot of the SHA-256 pins configured per host.
  registerSecureIpcHandler("desktop-api:security:cert-pinning:snapshot", async () => {
    const hosts: Record<string, string[]> = {};
    getCertificatePinsByHost(authApiUrl).forEach((pins, host) => {
      hosts[host] = Array.from(pins);
    });
    return { configured: Object.keys(hosts).length > 0, hosts };
  });

  // integrations: deep link (komastudio://) — same functions as the main
  // process's protocol flow.
  registerSecureIpcHandler("desktop-api:integrations:deep-link:extract", async (value) => {
    const payload = (value ?? {}) as { argv?: unknown };
    const argv = Array.isArray(payload.argv) ? payload.argv.map(String) : [];
    return { url: extractDeepLinkFromArgv(argv) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:route", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { hashRoute: deepLinkToHashRoute(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:format", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { formatted: formatDeepLinkForLog(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:navigate", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    navigateMainWindowFromDeepLink(url);
    return { navigated: true };
  });

  // images: folder listing (the v2 contract uses it in the model manager).
  registerSecureIpcHandler("desktop-api:images:list-folder", async (value) => {
    const payload = (value ?? {}) as { folderPath?: unknown };
    const folderPath = typeof payload.folderPath === "string" ? payload.folderPath : "";
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { files: [] };
    }
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const full = path.join(folderPath, entry.name);
        return {
          name: entry.name,
          sizeBytes: fs.statSync(full).size,
          modifiedAt: fs.statSync(full).mtimeMs,
        };
      });
    return { folderPath, files };
  });

  // discord-rpc: clear activity (the class already supports it; the channel was missing).
  registerSecureIpcHandler("discord-rpc:clear-activity", async () => {
    return discordRPC.clearActivity();
  });

  // fonts: install/uninstall are not yet implemented in the electron shell —
  // return a typed error so the UI can degrade gracefully (parity with the
  // contract).
  registerSecureIpcHandler("desktop-api:fonts:install", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font install is not supported by this shell yet." },
    };
  });
  registerSecureIpcHandler("desktop-api:fonts:uninstall", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font uninstall is not supported by this shell yet." },
    };
  });
};

export { setupDesktopAuthIpcHandlers };
export type { DesktopAuthIpcDeps };
