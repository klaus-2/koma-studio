/**
 * Desktop debug / DevTools flags from env + argv.
 */
import { app } from "electron";

export interface DesktopAppFlags {
  isDev: boolean;
  isProdDebugEnabled: boolean;
  isExplicitDebugLoggingEnabled: boolean;
  areDevToolsEnabled: boolean;
  debugLogsEnabled: boolean;
}

const resolveAppFlags = (): DesktopAppFlags => {
  const isDev = !app.isPackaged;
  const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS;
  const normalizedShouldOpenDevTools = (shouldOpenDevTools ?? "").trim().toLowerCase();
  const rawEnableDebugLogs = process.env.ELECTRON_ENABLE_DEBUG_LOGS;
  const normalizedEnableDebugLogs = (rawEnableDebugLogs ?? "").trim().toLowerCase();
  const isProdDebugEnabled =
    normalizedShouldOpenDevTools === "1" ||
    normalizedShouldOpenDevTools === "true" ||
    process.argv.includes("--open-devtools");
  const isExplicitDebugLoggingEnabled =
    normalizedEnableDebugLogs === "1" ||
    normalizedEnableDebugLogs === "true" ||
    process.argv.includes("--enable-debug-logs");
  const areDevToolsEnabled = isDev || isProdDebugEnabled;
  const debugLogsEnabled = isDev || isProdDebugEnabled || isExplicitDebugLoggingEnabled;

  return {
    isDev,
    isProdDebugEnabled,
    isExplicitDebugLoggingEnabled,
    areDevToolsEnabled,
    debugLogsEnabled,
  };
};

export { resolveAppFlags };
