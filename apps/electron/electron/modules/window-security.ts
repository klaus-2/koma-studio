/**
 * Desktop webRequest header injection + navigation hardening.
 */
import { app, shell, type BrowserWindow } from "electron";
import {
  DESKTOP_APP_VERSION_HEADER,
  DESKTOP_CLIENT_TOKEN_HEADER,
  DESKTOP_DEVICE_ID_HEADER,
  DESKTOP_SESSION_ID_HEADER,
  DESKTOP_UPDATE_CHANNEL_HEADER,
  LOCAL_API_SESSION_HEADER,
} from "./desktop-auth-constants.ts";
import { INTERNAL_APP_HOST, INTERNAL_APP_PROTOCOL } from "./app-protocols.ts";
import { resolveRendererCorsOrigin } from "./app-protocols.ts";
import type { DesktopAuthSession } from "./desktop-auth-session.ts";
import { getDesktopUpdateChannel } from "./desktop-session-headers.ts";
import { shouldAttachLocalSessionHeader } from "./window-security-headers.ts";

interface WindowSecurityDeps {
  authApiUrl: string;
  // Resolved per request: the URL can be rewritten after this module is constructed.
  getLocalApiUrl: () => string;
  getLocalApiSessionSecret: () => string;
  desktopAuth: DesktopAuthSession;
  desktopClientTokenRefreshSkewSec: number;
  isAllowedExternalUrl: (url: string) => boolean;
  isInternalAppUrl: (url: string) => boolean;
  getDevServerOrigin: () => string | null;
}

const createWindowSecurity = (deps: WindowSecurityDeps) => {
  const {
    authApiUrl,
    getLocalApiUrl,
    getLocalApiSessionSecret,
    desktopAuth,
    desktopClientTokenRefreshSkewSec,
  } = deps;

  const setupDesktopClientHeaderInjection = (window: BrowserWindow): void => {
    let authOrigin = "";
    try {
      authOrigin = new URL(authApiUrl).origin;
    } catch {
      return;
    }

    // Intercept outgoing requests to inject desktop client headers and strip Origin.
    // Removing Origin prevents servers that don't have "app://local" in ALLOWED_ORIGINS
    // from rejecting the preflight or request with a CORS error.
    window.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ["*://*/*"] },
      (details, callback) => {
        try {
          const targetUrl = new URL(details.url);
          const targetsDesktopSession = targetUrl.origin === authOrigin;
          const isPreflightRequest = details.method.toUpperCase() === "OPTIONS";

          if (targetsDesktopSession) {
            // Strip Origin on both the actual request and the Authorization preflight.
            // Packaged renderer requests come from app://local and can otherwise trip
            // server-side origin allowlists before our response-header patch runs.
            delete details.requestHeaders["Origin"];
            delete details.requestHeaders["origin"];
          }

          if (!isPreflightRequest && targetsDesktopSession) {
            const nowMs = Date.now();
            if (
              desktopAuth.getState().token &&
              desktopAuth.getState().expiresAtMs - nowMs <= desktopClientTokenRefreshSkewSec * 1_000
            ) {
              void desktopAuth.refreshToken("on-demand");
            }

            if (desktopAuth.getState().token) {
              details.requestHeaders[DESKTOP_CLIENT_TOKEN_HEADER] = desktopAuth.getState().token;
              details.requestHeaders[DESKTOP_SESSION_ID_HEADER] = desktopAuth.getState().sessionId;
              details.requestHeaders[DESKTOP_DEVICE_ID_HEADER] = desktopAuth.getState().deviceId;
            }
            details.requestHeaders[DESKTOP_APP_VERSION_HEADER] = app.getVersion();
            details.requestHeaders[DESKTOP_UPDATE_CHANNEL_HEADER] = getDesktopUpdateChannel(app.getVersion());

          }

          const localApiSessionSecret = getLocalApiSessionSecret();
          if (
            !isPreflightRequest &&
            localApiSessionSecret &&
            shouldAttachLocalSessionHeader(details.url, getLocalApiUrl())
          ) {
            details.requestHeaders[LOCAL_API_SESSION_HEADER] = localApiSessionSecret;
          }
        } catch {
          // ignore malformed URL
        } finally {
          // Always call callback – if the obfuscated control flow ever skips the
          // normal exit path, the finally block guarantees the request proceeds.
          callback({ requestHeaders: details.requestHeaders });
        }
      },
    );

    // Inject CORS response headers for auth API responses so the renderer
    // accepts them. Since we strip Origin from the request, the server won't add
    // Access-Control-Allow-Origin itself, so we add it here.
    const fallbackDesktopOrigin = `${INTERNAL_APP_PROTOCOL}://${INTERNAL_APP_HOST}`;
    const desktopSessionUrls = [
      `${authOrigin}/*`,
    ].filter((u) => u !== "/*");

    if (desktopSessionUrls.length > 0) {
      window.webContents.session.webRequest.onHeadersReceived(
        { urls: desktopSessionUrls },
        (details, callback) => {
          const headers = { ...details.responseHeaders };
          try {
            // Determine the actual origin. In DEV, this may be http://localhost:5173
            // while in PROD it is app://local. It must exactly match the renderer's origin
            // because we use Access-Control-Allow-Credentials: true.
            let currentOrigin = fallbackDesktopOrigin;
            try {
              const currentUrl = window.webContents.getURL();
              if (currentUrl) {
                currentOrigin = resolveRendererCorsOrigin(currentUrl, fallbackDesktopOrigin);
              }
            } catch {
              // keep fallback
            }

            // Inject CORS headers so the renderer accepts responses from the auth server.
            delete headers["access-control-allow-origin"];
            delete headers["Access-Control-Allow-Origin"];
            delete headers["access-control-allow-credentials"];
            delete headers["Access-Control-Allow-Credentials"];
            delete headers["access-control-allow-headers"];
            delete headers["Access-Control-Allow-Headers"];
            delete headers["access-control-allow-methods"];
            delete headers["Access-Control-Allow-Methods"];

            headers["access-control-allow-origin"] = [currentOrigin];
            headers["access-control-allow-credentials"] = ["true"];
            headers["access-control-allow-headers"] = ["*"];
            headers["access-control-allow-methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];

            // Rewrite Set-Cookie headers to use SameSite=None; Secure so session
            // cookies are sent on cross-origin requests from app://local.
            // Without this, SameSite=Lax cookies are blocked on subsequent requests.
            const rawCookies =
              headers["set-cookie"] ?? headers["Set-Cookie"] ?? [];
            if (rawCookies.length > 0) {
              const patched = rawCookies.map((cookie: string) => {
                // Replace any existing SameSite value with None
                let c = cookie.replace(/;\s*SameSite=\w+/gi, "");
                c += "; SameSite=None";
                // SameSite=None requires Secure
                if (!/;\s*Secure/i.test(c)) {
                  c += "; Secure";
                }
                return c;
              });
              headers["set-cookie"] = patched;
              delete headers["Set-Cookie"];
            }
          } catch {
            // ignore errors — callback must always be called
          } finally {
            callback({ responseHeaders: headers });
          }
        },
      );
    }
  };

  const setupNavigationHardening = (window: BrowserWindow): void => {
    const internalOrigin = deps.getDevServerOrigin();

    const isInternalUrl = (targetUrl: string): boolean => {
      if (!internalOrigin) {
        return deps.isInternalAppUrl(targetUrl);
      }

      try {
        return new URL(targetUrl).origin === internalOrigin;
      } catch {
        return false;
      }
    };

    window.webContents.on("will-navigate", (event, targetUrl) => {
      if (isInternalUrl(targetUrl)) {
        return;
      }

      event.preventDefault();
      if (deps.isAllowedExternalUrl(targetUrl)) {
        void shell.openExternal(targetUrl);
      }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (deps.isAllowedExternalUrl(url)) {
        void shell.openExternal(url);
      }

      return { action: "deny" };
    });

    window.webContents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  };

  return {
    setupDesktopClientHeaderInjection,
    setupNavigationHardening,
  };
};

export { createWindowSecurity };
