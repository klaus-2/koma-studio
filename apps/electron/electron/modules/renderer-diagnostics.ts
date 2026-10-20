/**
 * Renderer webContents diagnostics (console + load lifecycle).
 */
import type { BrowserWindow } from "electron";
import {
  isDesktopDebugLogsEnabled,
  recordSessionLog,
} from "./session-log.ts";

const attachRendererDiagnostics = (window: BrowserWindow): void => {
  if (!isDesktopDebugLogsEnabled()) {
    return;
  }

  window.webContents.on("dom-ready", () => {
    console.info(`[renderer] dom-ready ${window.webContents.getURL()}`);
  });

  window.webContents.on("did-finish-load", () => {
    console.info(`[renderer] did-finish-load ${window.webContents.getURL()}`);
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(
        `[renderer] did-fail-load code=${errorCode} mainFrame=${isMainFrame} url=${validatedURL} error=${errorDescription}`,
      );
    },
  );

  window.webContents.on("console-message", (details) => {
    const mappedLevel =
      details.level === "warning"
        ? "warn"
        : details.level === "error" || details.level === "info" || details.level === "debug"
          ? details.level
          : "log";
    const location = details.sourceId ? `${details.sourceId}:${details.lineNumber}` : `line:${details.lineNumber}`;
    recordSessionLog(mappedLevel, "renderer", [`[console:${mappedLevel}] ${details.message} (${location})`]);
  });

  window.on("unresponsive", () => {
    console.warn(`[renderer] window became unresponsive at ${window.webContents.getURL()}`);
  });

  window.on("responsive", () => {
    console.info(`[renderer] window responsive again at ${window.webContents.getURL()}`);
  });
};

export { attachRendererDiagnostics };
