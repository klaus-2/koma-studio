import { isTauri } from "@tauri-apps/api/core";
import { desktopBridge, setDesktopBridgeProvider } from "../desktop-bridge";
import { setUiI18n } from "@koma/ui/i18n-port";
import { setUiScaleNativeZoomHandler } from "@koma/ui/utils/applyUiScale";
import { invokeCommand, tauriApi } from "./api";
import { setRuntimeAdapter } from "@koma/auth/runtime-adapter";
import { isAuthDisabledFlag } from "@shared/auth-disabled";
import { desktopCommandChannels, localApiSessionHeader } from "@shared/desktop-api";
import { installRendererConsoleCapture, type SessionLogSink } from "../install-renderer-console-capture";
import { buildUrl } from "../../config/api";
import { getDesktopUpdatePolicyHeaders } from "../../config/desktopClient";
import { useUpdaterBlocking } from "../../hooks/useUpdater";
import { useI18n } from "../../i18n";

setDesktopBridgeProvider(tauriApi);

setUiScaleNativeZoomHandler(async (scale) => {
  if (!isTauri()) {
    return false;
  }
  try {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    await getCurrentWebview().setZoom(scale);
    return true;
  } catch {
    return false;
  }
});

const loadSessionSecret = async (): Promise<string | null> => {
  try {
    const value = await invokeCommand<string | null>(
      desktopCommandChannels.localBackend.getSessionSecret,
    );
    return typeof value === "string" && value.trim() ? value : null;
  } catch (error) {
    console.error("[local-api] failed to load the session secret:", error);
    return null;
  }
};

const installLocalApiSessionHeader = (): void => {
  const originalFetch = window.fetch.bind(window);

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

setUiI18n(useI18n);

const forwardToSessionLog: SessionLogSink = (payload) => {
  void desktopBridge.desktop?.sessionLog(payload);
};
installRendererConsoleCapture({
  source: "tauri-renderer",
  sink: forwardToSessionLog,
});

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

setRuntimeAdapter({
  isDesktopRuntime: () => desktopBridge.isDesktopRuntime(),
  getDesktopAuthApi: () => desktopBridge.desktop?.api?.auth ?? null,
  isAuthDisabled: () =>
    isAuthDisabledFlag(import.meta.env.VITE_AUTH_DISABLED, import.meta.env.DEV),
  buildUrl,
  getDesktopUpdatePolicyHeaders,
  useUpdaterBlocking,
});
