/**
 * Session logging IPC module.
 * Extracted from electron/main.ts during God File decomposition.
 */
import { ipcMain } from "electron";
import { assertTrustedIpcSender } from "./shared.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RENDERER_SESSION_LOG_CHANNEL = "desktop:session-log";

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

interface LoggingDeps {
  recordSessionLog: (
    level: "log" | "info" | "warn" | "error" | "debug",
    source: "main" | "renderer",
    args: unknown[],
  ) => void;
}

const setupDesktopSessionLogIpcHandler = (deps: LoggingDeps): void => {
  ipcMain.on(RENDERER_SESSION_LOG_CHANNEL, (event, rawPayload: unknown) => {
    assertTrustedIpcSender(event, RENDERER_SESSION_LOG_CHANNEL);
    if (!rawPayload || typeof rawPayload !== "object") {
      return;
    }

    const payload = rawPayload as Record<string, unknown>;
    const level =
      payload.level === "error" ||
      payload.level === "warn" ||
      payload.level === "info" ||
      payload.level === "debug"
        ? payload.level
        : "log";
    const source = typeof payload.source === "string" ? payload.source.trim().toLowerCase() : "renderer";
    const message = typeof payload.message === "string" ? payload.message : "";
    if (!message.trim()) {
      return;
    }

    deps.recordSessionLog(level, source === "renderer" ? "renderer" : "main", [message]);
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  RENDERER_SESSION_LOG_CHANNEL,
  type LoggingDeps,
  setupDesktopSessionLogIpcHandler,
};
