// Tauri provider registration for @koma/interface — Tauri-shell side.
// Import this module BEFORE the first render (side-effect).
//
//   import "@koma/interface/lib/tauri/register";
//
// Everything here runs inside the package: the api.ts (@tauri-apps adapter)
// and the auth adapter are internal; electron will register its own and will
// never import this file.

import { setDesktopBridgeProvider } from "../desktop-bridge";
import { setUiI18n } from "@koma/ui/i18n-port";
import { tauriApi } from "./api";
import { setRuntimeAdapter } from "@koma/auth/runtime-adapter";
import { desktopBridge } from "../desktop-bridge";
import { buildUrl } from "../../config/api";
import { getDesktopUpdatePolicyHeaders } from "../../config/desktopClient";
import { useUpdaterBlocking } from "../../hooks/useUpdater";
import { useI18n } from "../../i18n";

// Bridge provider: the tauriApi object already matches DesktopBridgeProvider.
setDesktopBridgeProvider(tauriApi);

// i18n port: the interface consumes useUiI18n (the actual hook lives in the
// interface itself, registered by the shell before render).
setUiI18n(useI18n);

// Auth adapter for the Tauri (v2) runtime. The VITE_AUTH_DISABLED bypass
// exists only for development / automated tests (same lever as the electron
// shell); in production the variable does not exist and auth is always on.
setRuntimeAdapter({
  isDesktopRuntime: () => desktopBridge.isDesktopRuntime(),
  getDesktopAuthApi: () => desktopBridge.desktop?.api?.auth ?? null,
  isAuthDisabled: () => import.meta.env.VITE_AUTH_DISABLED === "true",
  buildUrl,
  getDesktopUpdatePolicyHeaders,
  useUpdaterBlocking,
});
