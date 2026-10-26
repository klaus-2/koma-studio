// Tauri provider registration for @koma/interface — Tauri-shell side.
// Import this module BEFORE the first render (side-effect).
//
//   import "@koma/interface/lib/tauri/register";
//
// Everything here runs inside the package: the api.ts (@tauri-apps adapter)
// and the auth adapter are internal; electron will register its own and will
// never import this file.

import { desktopBridge, setDesktopBridgeProvider } from "../desktop-bridge";
import { setUiI18n } from "@koma/ui/i18n-port";
import { invokeCommand, tauriApi } from "./api";
import { setRuntimeAdapter } from "@koma/auth/runtime-adapter";
import { isAuthDisabledFlag } from "@shared/auth-disabled";
import { desktopCommandChannels, localApiSessionHeader } from "@shared/desktop-api";
import { installRendererConsoleCapture, type SessionLogSink } from "../install-renderer-console-capture";
import { buildUrl } from "../../config/api";
import { getDesktopUpdatePolicyHeaders } from "../../config/desktopClient";
import { useUpdaterBlocking } from "../../hooks/useUpdater";
import { useI18n } from "../../i18n";

// Bridge provider: the tauriApi object already matches DesktopBridgeProvider.
setDesktopBridgeProvider(tauriApi);

// The Tauri shell provisions a per-launch secret for the mini-backend (in
// release builds); the renderer talks to the sidecar directly, so the header
// is attached here once, before the first request.
//
// Unlike the Electron shell — which keeps the secret in its main process and
// injects it via webRequest.onBeforeSendHeaders — Tauri has no such hook, so
// the renderer reads the secret over IPC. That widens its exposure to
// anything running in the renderer; it is a conscious trade-off for keeping
// large image payloads out of the IPC bus.
// No secret caching: a manual backend restart rotates it, and the renderer
// must pick up the current one on the next request.
const loadSessionSecret = async (): Promise<string | null> => {
  try {
    const value = await invokeCommand<string | null>(
      desktopCommandChannels.localBackend.getSessionSecret,
    );
    return typeof value === "string" && value.trim() ? value : null;
  } catch (error) {
    // Distinguish a broken shell command from "no secret provisioned"
    // (debug builds): shipping the request without the header would only
    // surface later as an opaque 403 from the local-API gate.
    console.error("[local-api] failed to load the session secret:", error);
    return null;
  }
};

const installLocalApiSessionHeader = (): void => {
  const originalFetch = window.fetch.bind(window);

  // The base URL never rotates; only the secret does, so resolve it once.
  let cachedLocalApiBase: string | null | undefined;
  const localApiBase = (): string | null => {
    if (cachedLocalApiBase === undefined) {
      try {
        cachedLocalApiBase = buildUrl("localUrl", "").replace(/\/+$/, "");
      } catch {
        cachedLocalApiBase = null;
      }
    }
    return cachedLocalApiBase;
  };

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const base = localApiBase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (base && (url === base || url.startsWith(`${base}/`))) {
      const secret = await loadSessionSecret();
      if (secret) {
        // Per the fetch spec, init headers replace a Request's own headers;
        // the session header is then added on top.
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        headers.set(localApiSessionHeader, secret);
        return originalFetch(input, { ...init, headers });
      }
    }
    return originalFetch(input, init);
  };
};

installLocalApiSessionHeader();

// i18n port: the interface consumes useUiI18n (the actual hook lives in the
// interface itself, registered by the shell before render).
setUiI18n(useI18n);

// Renderer console capture: forward console.error/warn into the Tauri
// session-log command.
const forwardToSessionLog: SessionLogSink = (payload) => {
  void desktopBridge.desktop?.sessionLog(payload);
};
installRendererConsoleCapture({
  source: "tauri-renderer",
  sink: forwardToSessionLog,
});

// console.error hooks miss uncaught errors and rejections that bypass the
// console; route them through the same session-log sink.
window.addEventListener("error", (event) => {
  forwardToSessionLog({
    source: "tauri-renderer",
    level: "error",
    message: `uncaught error: ${event.message} (${event.filename}:${event.lineno}:${event.colno})`,
  });
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error
    ? `${event.reason.name}: ${event.reason.message}`
    : String(event.reason);
  forwardToSessionLog({
    source: "tauri-renderer",
    level: "error",
    message: `unhandled rejection: ${reason}`,
  });
});

// Same lever as the electron shell: an explicit VITE_AUTH_DISABLED wins either
// way, and an unset one enables the bypass only on a dev server.
setRuntimeAdapter({
  isDesktopRuntime: () => desktopBridge.isDesktopRuntime(),
  getDesktopAuthApi: () => desktopBridge.desktop?.api?.auth ?? null,
  isAuthDisabled: () =>
    isAuthDisabledFlag(import.meta.env.VITE_AUTH_DISABLED, import.meta.env.DEV),
  buildUrl,
  getDesktopUpdatePolicyHeaders,
  useUpdaterBlocking,
});
