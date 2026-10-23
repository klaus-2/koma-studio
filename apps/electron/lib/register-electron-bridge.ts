// Registers the Electron provider for @koma/interface — the Electron-shell side.
// Import this module BEFORE the first render (side-effect):
//
//   import "./register-electron-bridge";
//
// Bridge: window.desktop (preload v1) — the contract payload is
// the format the v1 main process already reads (pass-through, no normalization).
import { setDesktopBridgeProvider } from "@koma/interface/lib/desktop-bridge";
import { setUiI18n } from "@koma/ui/i18n-port";
import { setRuntimeAdapter } from "@koma/auth/runtime-adapter";
import { isAuthDisabledFlag } from "@shared/auth-disabled";
import type { IDesktopBridge, IUpdaterSyncBridge } from "@shared/desktop-api";
import { desktopBridge } from "@koma/interface/lib/desktop-bridge";
import { installRendererConsoleCapture } from "@koma/interface/lib/install-renderer-console-capture";
import { buildUrl } from "@koma/interface/config/api";
import { getDesktopUpdatePolicyHeaders } from "@koma/interface/config/desktopClient";
import { useUpdaterBlocking } from "@koma/interface/hooks/useUpdater";
import { useI18n } from "@koma/interface/i18n";

declare global {
  interface Window {
    desktop?: IDesktopBridge;
    updaterSync?: IUpdaterSyncBridge;
  }
}

const electronDesktop = (): IDesktopBridge | null =>
  typeof window !== "undefined" && window.desktop ? window.desktop : null;

const electronUpdaterSync = (): IUpdaterSyncBridge | null =>
  typeof window !== "undefined" && window.updaterSync ? window.updaterSync : null;

// Local mode: an explicit VITE_AUTH_DISABLED always wins, and when nothing
// defines it a dev server runs offline while the packaged shell defers to the
// value the main process resolved.
const authDisabled = isAuthDisabledFlag(
  import.meta.env.VITE_AUTH_DISABLED,
  import.meta.env.DEV ||
    electronDesktop()?.getRuntimeConfig()?.authDisabled === true,
);

// Fallback for pure browser preview (no preload): keeps the Dashboard
// working — without this, getRuntimeConfig() throws and the page goes blank.
const FALLBACK_RUNTIME_CONFIG = {
  authApiUrl: import.meta.env.VITE_AUTH_API_URL ?? "",
  localApiUrl: import.meta.env.VITE_LOCAL_API_URL ?? "http://127.0.0.1:8001",
  authDisabled,
  appPackaged: false,
};

// Bridge provider: pass-through from preload v1.
setDesktopBridgeProvider({
  get desktop() {
    return electronDesktop();
  },
  get updaterSync() {
    return electronUpdaterSync();
  },
  isDesktopRuntime: () => electronDesktop() !== null,
  getRuntimeConfig: () => electronDesktop()?.getRuntimeConfig() ?? FALLBACK_RUNTIME_CONFIG,
  hydrateRuntimeConfig: async () =>
    electronDesktop()?.getRuntimeConfig() ?? FALLBACK_RUNTIME_CONFIG,
});

setRuntimeAdapter({
  isDesktopRuntime: () => electronDesktop() !== null,
  getDesktopAuthApi: () => electronDesktop()?.api?.auth ?? null,
  isAuthDisabled: () => authDisabled,
  buildUrl,
  getDesktopUpdatePolicyHeaders,
  useUpdaterBlocking,
});

setUiI18n(useI18n);

// Renderer console capture: forward console.error/warn into the desktop
// session log. Null-safe when the preload bridge is unavailable.
installRendererConsoleCapture({
  source: "electron-renderer",
  sink: (payload) => {
    void desktopBridge.desktop?.sessionLog(payload);
  },
});
