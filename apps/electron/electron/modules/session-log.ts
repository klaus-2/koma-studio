/**
 * Main-process session log (file + console mirror).
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { sanitizeSessionLogText } from "./shared.ts";

const APP_SESSION_LOG_FILE_NAME = "desktop-session.log";
const APP_SESSION_LOG_MAX_BYTES = 1_500_000;
const APP_SESSION_LOG_BUFFER_LIMIT = 500;

let appSessionLogPath: string | null = null;
let appSessionLogInitialized = false;
let appSessionLogTruncated = false;
let pendingAppSessionLogLines: string[] = [];
let desktopDebugLogsEnabled = false;

const setDesktopDebugLogsEnabled = (enabled: boolean): void => {
  desktopDebugLogsEnabled = enabled;
};

const isDesktopDebugLogsEnabled = (): boolean => desktopDebugLogsEnabled;

const stringifySessionLogArg = (value: unknown): string => {
  if (value instanceof Error) {
    return value.stack || value.message || value.name;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? "");
};

const resolveAppSessionLogPath = (): string | null => {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    return path.join(logsDir, APP_SESSION_LOG_FILE_NAME);
  } catch {
    return null;
  }
};

const writeSessionLogLine = (line: string): void => {
  if (!appSessionLogPath) {
    return;
  }

  const payload = `${line}\n`;
  const byteLength = Buffer.byteLength(payload, "utf8");
  let currentSize = 0;
  try {
    currentSize = fs.existsSync(appSessionLogPath) ? fs.statSync(appSessionLogPath).size : 0;
  } catch {
    currentSize = 0;
  }

  if (currentSize + byteLength > APP_SESSION_LOG_MAX_BYTES) {
    if (appSessionLogTruncated) {
      return;
    }
    appSessionLogTruncated = true;
    try {
      fs.appendFileSync(
        appSessionLogPath,
        `[${new Date().toISOString()}] [warn] [main] Session log limit reached; additional lines were omitted.\n`,
        "utf8",
      );
    } catch {
      // no-op
    }
    return;
  }

  try {
    fs.appendFileSync(appSessionLogPath, payload, "utf8");
  } catch {
    // no-op
  }
};

const appendSessionLogLine = (line: string): void => {
  if (!appSessionLogInitialized || !appSessionLogPath) {
    pendingAppSessionLogLines.push(line);
    if (pendingAppSessionLogLines.length > APP_SESSION_LOG_BUFFER_LIMIT) {
      pendingAppSessionLogLines = pendingAppSessionLogLines.slice(-APP_SESSION_LOG_BUFFER_LIMIT);
    }
    return;
  }
  writeSessionLogLine(line);
};

const recordSessionLog = (
  level: "log" | "info" | "warn" | "error" | "debug",
  source: "main" | "renderer",
  args: unknown[],
): void => {
  if (!desktopDebugLogsEnabled) {
    return;
  }
  const message = sanitizeSessionLogText(args.map((item) => stringifySessionLogArg(item)).join(" "));
  if (!message) {
    return;
  }
  appendSessionLogLine(`[${new Date().toISOString()}] [${level}] [${source}] ${message}`);
};

const initializeAppSessionLog = (): void => {
  appSessionLogPath = resolveAppSessionLogPath();
  if (!appSessionLogPath) {
    return;
  }

  appSessionLogTruncated = false;
  try {
    fs.writeFileSync(
      appSessionLogPath,
      `[${new Date().toISOString()}] [info] [main] Session log started for KŌMA Studio ${app.getVersion()}\n`,
      "utf8",
    );
    appSessionLogInitialized = true;
    const bufferedLines = pendingAppSessionLogLines;
    pendingAppSessionLogLines = [];
    bufferedLines.forEach((line) => writeSessionLogLine(line));
  } catch {
    appSessionLogInitialized = false;
  }
};

const installMainProcessConsoleSessionLogging = (): void => {
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    recordSessionLog("log", "main", args);
  };
  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    recordSessionLog("info", "main", args);
  };
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    recordSessionLog("warn", "main", args);
  };
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    recordSessionLog("error", "main", args);
  };
  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    recordSessionLog("debug", "main", args);
  };
};

const debugDesktopLog = (...args: unknown[]): void => {
  if (desktopDebugLogsEnabled) {
    console.log(...args);
  }
};

const debugDesktopInfo = (...args: unknown[]): void => {
  if (desktopDebugLogsEnabled) {
    console.info(...args);
  }
};

const debugDesktopWarn = (...args: unknown[]): void => {
  if (desktopDebugLogsEnabled) {
    console.warn(...args);
  }
};

const debugDesktopError = (...args: unknown[]): void => {
  if (desktopDebugLogsEnabled) {
    console.error(...args);
  }
};

export {
  debugDesktopError,
  debugDesktopInfo,
  debugDesktopLog,
  debugDesktopWarn,
  initializeAppSessionLog,
  installMainProcessConsoleSessionLogging,
  isDesktopDebugLogsEnabled,
  recordSessionLog,
  setDesktopDebugLogsEnabled,
};
