// Registers the Electron provider for @koma/interface — the Electron-shell side.
// Import this module BEFORE the first render (side-effect):
//
//   import "./register-electron-bridge";
//
// Bridge: window.desktop/window.updater (preload v1) — the contract payload is
// the format the v1 main process already reads (pass-through, no normalization).
// Auth adapter v1: auth-disabled mode (VITE_AUTH_DISABLED / runtimeConfig.
// authDisabled) is exclusive to this shell.

import { setDesktopBridgeProvider } from "@koma/interface/lib/desktop-bridge";
import { setUiI18n } from "@koma/ui/i18n-port";
import { setRuntimeAdapter, type DesktopAuthApiPort } from "@koma/auth/runtime-adapter";
import { desktopBridge } from "@koma/interface/lib/desktop-bridge";
import { buildUrl } from "@koma/interface/config/api";
import { getDesktopUpdatePolicyHeaders } from "@koma/interface/config/desktopClient";
import { useUpdaterBlocking } from "@koma/interface/hooks/useUpdater";
import { useI18n } from "@koma/interface/i18n";

type ElectronDesktop = {
  getRuntimeConfig(): {
    authApiUrl: string;
    localApiUrl: string;
    authDisabled?: boolean;
    appPackaged?: boolean;
  };
  api?: {
    auth?: DesktopAuthApiPort;
  };
};

declare global {
  interface Window {
    desktop?: ElectronDesktop & Record<string, unknown>;
    updater?: Record<string, (...args: unknown[]) => Promise<unknown>>;
  }
}

const electronDesktop = (): ElectronDesktop | null =>
  typeof window !== "undefined" && window.desktop ? window.desktop : null;

// Fallback for pure browser preview (no preload): keeps the Dashboard
// working — without this, getRuntimeConfig() throws and the page goes blank.
const FALLBACK_RUNTIME_CONFIG = {
  authApiUrl: import.meta.env.VITE_AUTH_API_URL ?? "",
  localApiUrl: import.meta.env.VITE_LOCAL_API_URL ?? "http://127.0.0.1:8001",
  authDisabled: import.meta.env.VITE_AUTH_DISABLED === "true",
};

// Bridge provider: pass-through from preload v1.
setDesktopBridgeProvider({
  get desktop() {
    return electronDesktop();
  },
  get updater() {
    return (typeof window !== "undefined" ? window.updater : null) ?? null;
  },
  isDesktopRuntime: () => electronDesktop() !== null,
  getRuntimeConfig: () => electronDesktop()?.getRuntimeConfig() ?? FALLBACK_RUNTIME_CONFIG,
  hydrateRuntimeConfig: async () =>
    electronDesktop()?.getRuntimeConfig() ?? FALLBACK_RUNTIME_CONFIG,
});

// Auth adapter v1: auth-disabled mode (offline) is exclusive to this shell.
const authDisabled =
  import.meta.env.VITE_AUTH_DISABLED === "true" ||
  electronDesktop()?.getRuntimeConfig()?.authDisabled === true;

setRuntimeAdapter({
  isDesktopRuntime: () => electronDesktop() !== null,
  getDesktopAuthApi: () => electronDesktop()?.api?.auth ?? null,
  isAuthDisabled: () => authDisabled,
  buildUrl,
  getDesktopUpdatePolicyHeaders: () => ({}),
  useUpdaterBlocking,
});

setUiI18n(useI18n);
