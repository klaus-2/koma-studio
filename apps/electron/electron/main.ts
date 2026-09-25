import {
  app,
  BrowserWindow,
  net as electronNet,
  ipcMain,
  protocol,
  session as electronSession,
  shell,
  type Cookie,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Session,
} from "electron";
import path from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

// Monorepo: the package was renamed to @koma/electron, but Electron's userData
// directory is derived from the package name — pin it to "koma-studio" to
// preserve the existing user profile (models, device-id, settings) under
// %APPDATA%.
app.setName("koma-studio");

import { createHash, createDecipheriv, randomBytes, randomUUID, X509Certificate } from "node:crypto";
import fs from "node:fs";
import nodeNet from "node:net";
import { pathToFileURL } from "node:url";
import {
  resolveDesktopSessionRecoveryAction,
  type DesktopSessionRecoveryAction,
} from "../../../packages/types/src/desktopSessionRecovery.ts";
import { discordRPC } from "./discord-rpc.ts";
import { UpdaterService } from "./updater/UpdaterService";
import { resolveDesktopShortcutAction } from "./app-shortcuts.ts";
import {
  listMiniBackendRuntimeArtifactOptions,
  sanitizeMiniBackendProfile,
  type MiniBackendRuntimeArtifactOption,
  type MiniBackendRuntimeArtifactManifest,
  type MiniBackendRuntimeArtifactRecord,
} from "./mini-backend-artifacts.ts";
import { buildDevPythonRuntimePathCandidates } from "./dev-python-runtime.ts";
import {
  downloadUrlToFileWithResume,
  estimateRuntimeInstallRequiredBytes,
  resolveExistingPathForStatfs,
  resolveRuntimeTransferTimeoutMs,
  runWithRetry,
  RUNTIME_DOWNLOAD_RETRY_COUNT,
} from "./mini-backend-runtime-download.ts";
import {
  readMiniBackendRuntimeSelection,
  resolveRequestedRuntimeProfile,
  resolveSelectedRuntimeBinaryPath,
  writeMiniBackendRuntimeSelection,
} from "./mini-backend-runtime-selection.ts";
import { resolveMiniBackendStartupPolicy } from "./mini-backend-runtime-startup.ts";
import {
  buildManualInstallBlockedState,
  extractGpuVendors,
  extractGpuVendorsFromWindowsVideoControllers,
  formatRuntimeFallbackReason,
  resolveEffectiveAccelerationProfile,
  resolveAccelerationProfile,
  resolveManifestEntry,
  type MiniBackendAccelerationProfile,
  type MiniBackendLaunchManifest,
  type MiniBackendRuntimeSource,
} from "./mini-backend-runtime.ts";

import {
  // Shared utilities
  sleep,
  normalizeHttpMethod,
  normalizeAccessToken,
  normalizeHost,
  sanitizeSessionLogText,
  registerSecureIpcHandler,
  fetchWithTimeoutAndRetry,
  parseResponsePayload,
  resolveDesktopErrorCode,
  toDesktopStructuredError,
  isDesktopStructuredError,
  extractDesktopApiErrorMessage,
  summarizeDesktopApiPayload,
  toDesktopAuthErrorEnvelope,
  DESKTOP_FETCH_TIMEOUT_MS,
  DESKTOP_FETCH_RETRY_COUNT,
} from "./modules/shared.ts";
import { setupDesktopFontIpcHandlers } from "./modules/fonts.ts";
import { setupDesktopLlmProfilesIpcHandlers } from "./modules/llm-profiles.ts";
import {
  setupDiscordIpcHandlers,
  setupDesktopBloggerIpcHandlers,
  setupDesktopImgurIpcHandlers,
} from "./modules/integrations.ts";
import {
  resetDesktopLocalSettings,
  setupDesktopWorkspaceIpcHandlers,
} from "./modules/workspace.ts";
import { setupDesktopModelIpcHandlers } from "./modules/models.ts";
import { setupDesktopSessionLogIpcHandler } from "./modules/logging.ts";
import {
  extractDeepLinkFromArgv,
  deepLinkToHashRoute,
  formatDeepLinkForLog,
  navigateFromDeepLink,
} from "./modules/deep-link.ts";
import {
  setupDesktopBugReportIpcHandlers,
  setupDesktopDiscordWebhookIpcHandlers,
} from "./modules/bug-report.ts";

// Prevent external Chromium extensions/scripts from injecting renderer code.
app.commandLine.appendSwitch("disable-extensions");

let mainWindow: BrowserWindow | null = null;
let miniBackendProcess: ChildProcess | null = null;
let miniBackendShutdownPromise: Promise<void> | null = null;
let miniBackendExitPromise: Promise<void> | null = null;
// Stable reference for the synchronous process.once("exit") handler.
// stopMiniBackend() nulls miniBackendProcess before kill completes, so the
// exit handler needs its own copy to guarantee the child is killed.
let miniBackendProcessForExitCleanup: ChildProcess | null = null;
let updaterService: UpdaterService | null = null;
let localApiSessionSecret = randomBytes(32).toString("hex");
let preparedMiniBackendPort: number | null = null;
let miniBackendRuntimeInstallPromise: Promise<{
  ok: boolean;
  profile: string;
  reason: string | null;
}> | null = null;

type MiniBackendRuntimeStatus =
  | "idle"
  | "resolving"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "ready"
  | "fallback"
  | "error";

interface MiniBackendRuntimeProgressState {
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
}

interface MiniBackendRuntimeState {
  status: MiniBackendRuntimeStatus;
  statusMessage: string | null;
  requestedProfile: MiniBackendAccelerationProfile;
  activeProfile: MiniBackendAccelerationProfile;
  source: MiniBackendRuntimeSource;
  runtimeArtifactsUrl: string | null;
  runtimeManifestUrl: string | null;
  runtimeArchiveUrl: string | null;
  installDir: string | null;
  downloadCacheDir: string | null;
  version: string | null;
  lastError: string | null;
  attempt: number;
  maxAttempts: number;
  progress: MiniBackendRuntimeProgressState | null;
  updatedAt: number | null;
  gpuName: string | null;
  vramGb: number | null;
}

interface MiniBackendDeviceInfoPayload {
  profile?: string;
  active_profile?: string;
  provider?: string;
  fallback_reason?: string | null;
  name?: string;
  vram_gb?: number | null;
}

const MINI_BACKEND_RUNTIME_EVENT_CHANNEL = "mini-backend-runtime:event";
const RUNTIME_ARCHIVE_EXTRACT_TIMEOUT_MS = 60 * 60_000;
const RUNTIME_RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const MINI_BACKEND_RUNTIME_LOG_LIMIT = 600;
const APP_SESSION_LOG_FILE_NAME = "desktop-session.log";
const APP_SESSION_LOG_MAX_BYTES = 1_500_000;
const APP_SESSION_LOG_BUFFER_LIMIT = 500;
const DESKTOP_SHORTCUT_ACTION_CHANNEL = "desktop:shortcut-action";

let miniBackendRuntimeLogBuffer: Array<{
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
}> = [];

let appSessionLogPath: string | null = null;
let appSessionLogInitialized = false;
let appSessionLogTruncated = false;
let pendingAppSessionLogLines: string[] = [];
let desktopDebugLogsEnabled = false;

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

installMainProcessConsoleSessionLogging();

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
desktopDebugLogsEnabled = isDev || isProdDebugEnabled || isExplicitDebugLoggingEnabled;
const APP_PROTOCOL = "komastudio";
const INTERNAL_APP_PROTOCOL = "app";
const INTERNAL_APP_HOST = "local";
const INTERNAL_APP_ORIGIN = `${INTERNAL_APP_PROTOCOL}://${INTERNAL_APP_HOST}`;
const INTERNAL_APP_ENTRY_URL = `${INTERNAL_APP_ORIGIN}/index.html`;

const attachRendererDiagnostics = (window: BrowserWindow): void => {
  if (!desktopDebugLogsEnabled) {
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

const resolveRendererCorsOrigin = (currentUrl: string, fallbackOrigin: string): string => {
  try {
    const parsed = new URL(currentUrl);
    if (parsed.protocol === `${INTERNAL_APP_PROTOCOL}:` && parsed.hostname === INTERNAL_APP_HOST) {
      return fallbackOrigin;
    }

    if (parsed.origin && parsed.origin !== "null") {
      return parsed.origin;
    }
  } catch {
    // fall through to the fallback origin
  }

  return fallbackOrigin;
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
let pendingDeepLink: string | null = null;

const navigateMainWindowFromDeepLink = (urlValue: string): void => {
  navigateFromDeepLink(urlValue, { getMainWindow: () => mainWindow });
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: INTERNAL_APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

// Harden renderer debugging surface in production runtime.
if (!isDev) {
  app.commandLine.appendSwitch("remote-debugging-port", "0");
}

const enforcePackagedRuntimeIntegrity = (): void => {
  if (isDev) {
    return;
  }

  const appPath = app.getAppPath();
  const expectedAsarPath = path.resolve(process.resourcesPath, "app.asar");
  const normalizedAppPath = appPath.toLowerCase();
  if (!normalizedAppPath.includes("app.asar") || !fs.existsSync(expectedAsarPath)) {
    console.error("[desktop-security] Packaged runtime integrity check failed (asar path mismatch).");
    app.exit(1);
    return;
  }

  const hasInspectArg = process.execArgv.some((arg) =>
    /^--inspect(?:-brk)?(?:=|$)/i.test(arg.trim()),
  );
  if (hasInspectArg) {
    console.error("[desktop-security] Debugger argument blocked in production runtime.");
    app.exit(1);
    return;
  }

  const remoteDebuggingPort = app.commandLine.getSwitchValue("remote-debugging-port");
  if (remoteDebuggingPort && remoteDebuggingPort !== "0") {
    console.error("[desktop-security] remote-debugging-port must remain disabled in production.");
    app.exit(1);
  }
};

const readValueFromEnvFile = (filePath: string, key: string): string | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const delimiterIndex = line.indexOf("=");
      if (delimiterIndex <= 0) {
        continue;
      }

      const parsedKey = line.slice(0, delimiterIndex).trim();
      if (parsedKey !== key) {
        continue;
      }

      const rawValue = line.slice(delimiterIndex + 1).trim();
      const normalized = rawValue.replace(/^['"]|['"]$/g, "").trim();
      return normalized.length > 0 ? normalized : "";
    }
  } catch {
    return null;
  }

  return null;
};

// AES-256 key fragments for runtime-config decryption (recombined at runtime, obfuscated at build time)
// Fragments stored in scrambled order — reassembled via _rco index map
const _rck: string[] = [
  "8fbd7712", // fragment index 4
  "331225c7", // fragment index 0
  "9b5684f4", // fragment index 7
  "868ff43e", // fragment index 1
  "d55fe1ba", // fragment index 5
  "9783e807", // fragment index 2
  "7126d4d6", // fragment index 6
  "37c1fc2a", // fragment index 3
];
const _rco = [1, 3, 5, 7, 0, 4, 6, 2]; // reassembly order

const decodeProtectedRuntimeConfig = (
  parsed: Record<string, unknown>,
): Record<string, string> => {
  const version = parsed._v as number | undefined;
  const key = Buffer.from(_rco.map((i) => _rck[i]).join(""), "hex");

  if (version === 2) {
    const cfg = parsed as { _d: string; _iv: string; _tag: string };
    const iv = Buffer.from(cfg._iv, "hex");
    const encrypted = Buffer.from(cfg._d, "base64");
    const authTag = Buffer.from(cfg._tag, "hex");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString("utf-8"));
  }

  // v1 XOR fallback (legacy configs)
  const cfg = parsed as { _d: string; _k: number };
  const xored = Buffer.from(cfg._d, "base64");
  for (let i = 0; i < xored.length; i++) {
    xored[i] ^= cfg._k;
  }
  const json = Buffer.from(xored.toString("utf-8"), "base64").toString("utf-8");
  return JSON.parse(json);
};

const readRuntimeConfigFile = (filePath: string): Record<string, string> | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const maybeProtected = parsed as Record<string, unknown>;
    if (maybeProtected._protected === true && typeof maybeProtected._d === "string") {
      return decodeProtectedRuntimeConfig(maybeProtected);
    }

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        continue;
      }
      normalized[key] = value;
    }

    return normalized;
  } catch {
    return null;
  }
};

let cachedDesktopRuntimeConfig: Record<string, string> | null | undefined;
const FORBIDDEN_RUNTIME_CONFIG_KEYS = new Set([
  "DESKTOP_BOOTSTRAP_SECRET",
  "JWT_SECRET",
  "BETTER_AUTH_SECRET",
]);

const sanitizeRuntimeConfig = (runtimeConfig: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(runtimeConfig)) {
    if (FORBIDDEN_RUNTIME_CONFIG_KEYS.has(key)) {
      console.warn(`[desktop-security] Ignoring forbidden runtime-config key: ${key}`);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

const resolveRuntimeConfigValue = (key: string): string | null => {
  if (FORBIDDEN_RUNTIME_CONFIG_KEYS.has(key)) {
    return null;
  }

  if (cachedDesktopRuntimeConfig === undefined) {
    const runtimeConfigCandidates = [
      path.resolve(process.cwd(), "dist-electron", "runtime-config.json"),
      path.resolve(process.cwd(), "runtime-config.json"),
      path.resolve(process.resourcesPath, "app.asar", "dist-electron", "runtime-config.json"),
      path.resolve(process.resourcesPath, "dist-electron", "runtime-config.json"),
    ];

    let loadedConfig: Record<string, string> | null = null;
    for (const candidatePath of runtimeConfigCandidates) {
      const parsed = readRuntimeConfigFile(candidatePath);
      if (parsed) {
        loadedConfig = sanitizeRuntimeConfig(parsed);
        break;
      }
    }

    cachedDesktopRuntimeConfig = loadedConfig;
  }

  const value = cachedDesktopRuntimeConfig?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "";
};

const getDesktopEnvFileName = (): ".env.production" | ".env.development" => {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv === "production") {
    return ".env.production";
  }

  if (nodeEnv === "development") {
    return ".env.development";
  }

  return app.isPackaged ? ".env.production" : ".env.development";
};

const collectAncestorDirs = (startDir: string, maxDepth: number): string[] => {
  const ancestors: string[] = [];
  let current = path.resolve(startDir);
  for (let depth = 0; depth < maxDepth; depth += 1) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return ancestors;
};

const resolveDesktopEnvFileValue = (key: string): string | null => {
  const envFile = getDesktopEnvFileName();
  const rootCandidates = Array.from(
    new Set<string>([
      process.cwd(),
      path.dirname(process.execPath),
      process.resourcesPath,
      ...collectAncestorDirs(process.cwd(), 6),
      ...collectAncestorDirs(path.dirname(process.execPath), 8),
      ...collectAncestorDirs(process.resourcesPath, 6),
    ]),
  );

  const lookupOrder: string[] = [];
  for (const rootCandidate of rootCandidates) {
    const rootEnvPaths = [
      path.resolve(rootCandidate, `${envFile}.local`),
      path.resolve(rootCandidate, ".env.local"),
      path.resolve(rootCandidate, envFile),
      path.resolve(rootCandidate, ".env"),
    ];
    const authServerEnvPaths = [
      path.resolve(rootCandidate, "auth-server", `${envFile}.local`),
      path.resolve(rootCandidate, "auth-server", ".env.local"),
      path.resolve(rootCandidate, "auth-server", envFile),
      path.resolve(rootCandidate, "auth-server", ".env"),
    ];
    lookupOrder.push(...rootEnvPaths, ...authServerEnvPaths);
  }

  for (const candidatePath of lookupOrder) {
    const value = readValueFromEnvFile(candidatePath, key);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const resolveDesktopEnvValue = (key: string): string | null => {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess && fromProcess.length > 0) {
    return fromProcess;
  }

  if (isDev) {
    const fromEnvFile = resolveDesktopEnvFileValue(key);
    if (fromEnvFile !== null) {
      return fromEnvFile;
    }
  }

  const fromRuntimeConfig = resolveRuntimeConfigValue(key);
  if (fromRuntimeConfig !== null) {
    return fromRuntimeConfig;
  }

  return resolveDesktopEnvFileValue(key);
};

const rawAuthApiUrl = resolveDesktopEnvValue("VITE_AUTH_API_URL") ?? "http://127.0.0.1:3001";
const authApiUrl = (() => {
  if (isDev && rawAuthApiUrl.includes("auth.koma-studio.site")) {
    return "http://127.0.0.1:3001";
  }
  return rawAuthApiUrl;
})();
const isAuthDisabled = ["true", "1", "yes"].includes(
  (resolveDesktopEnvValue("VITE_AUTH_DISABLED") ?? "").trim().toLowerCase(),
);
const normalizeLoopbackUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.trim().toLowerCase() !== "localhost") {
      return rawUrl;
    }

    parsed.hostname = "127.0.0.1";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
};

let localApiUrl = normalizeLoopbackUrl(
  resolveDesktopEnvValue("VITE_LOCAL_API_URL") ?? "http://127.0.0.1:8001",
);
const miniBackendArtifactsUrl =
  resolveDesktopEnvValue("MINI_BACKEND_ARTIFACTS_URL")
  ?? resolveDesktopEnvValue("UPDATE_SERVER_URL");
const parseConfiguredPort = (rawUrl: string | null): number | null => {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }
    return port;
  } catch {
    return null;
  }
};
const desktopBootstrapSecret = resolveDesktopEnvValue("DESKTOP_BOOTSTRAP_SECRET") ?? "";

let miniBackendRuntimeState: MiniBackendRuntimeState = {
  status: "idle",
  statusMessage: null,
  requestedProfile: "cpu",
  activeProfile: "cpu",
  source: "bundled-core",
  runtimeArtifactsUrl: miniBackendArtifactsUrl,
  runtimeManifestUrl: null,
  runtimeArchiveUrl: null,
  installDir: null,
  downloadCacheDir: path.join(app.getPath("temp"), "koma-runtime-downloads"),
  version: null,
  lastError: null,
  attempt: 0,
  maxAttempts: 0,
  progress: null,
  updatedAt: Date.now(),
  gpuName: null,
  vramGb: null,
};

const DESKTOP_CLIENT_TOKEN_HEADER = "x-desktop-client-token";
const DESKTOP_SESSION_ID_HEADER = "x-desktop-session-id";
const DESKTOP_DEVICE_ID_HEADER = "x-desktop-device-id";
const DESKTOP_APP_VERSION_HEADER = "x-desktop-app-version";
const DESKTOP_UPDATE_CHANNEL_HEADER = "x-desktop-update-channel";
const DESKTOP_BOOTSTRAP_SECRET_HEADER = "x-desktop-bootstrap-secret";
const DESKTOP_DEVICE_KEY_HEADER = "x-desktop-device-key";
const DESKTOP_TRAVEL_TOKEN_HEADER = "x-desktop-travel-token";
const LOCAL_API_SESSION_HEADER = "x-koma-local-session";
const DESKTOP_BOOTSTRAP_PATH = "/api/internal/desktop-client/bootstrap";
const DESKTOP_DEVICE_REGISTER_PATH = "/api/internal/desktop-client/register";
const DESKTOP_TRAVEL_TOKEN_PATH = "/api/internal/desktop-client/travel-token";
const EXTERNAL_ALLOWED_HOST_SUFFIXES = [
  "stripe.com",
  "mercadopago.com",
  "mercadopago.com.br",
  "github.com",
  "githubusercontent.com",
  "discord.com",
  "discord.gg",
  "komikkulab.com",
  "cloudflare.com",
  "huggingface.co",
  "openmodeldb.info",
];
const externalAllowedHosts = new Set<string>();
const CERT_PIN_ERROR = -2;
const CERT_PIN_USE_CHROMIUM_VALIDATION = -3;
let certificatePinningConfigured = false;
let cachedCertificatePinsByHost: Map<string, Set<string>> | null = null;
let permissionHardeningConfigured = false;

const parseDesktopTokenTtlSec = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(900, Math.max(300, Math.trunc(parsed)));
};

const parseDesktopRefreshSkewSec = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(300, Math.max(30, Math.trunc(parsed)));
};

const getDevServerOrigin = (): string | null => {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return null;
  }

  try {
    return new URL(process.env.VITE_DEV_SERVER_URL).origin;
  } catch {
    return null;
  }
};

const isInternalAppUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === `${INTERNAL_APP_PROTOCOL}:` && parsed.hostname === INTERNAL_APP_HOST;
  } catch {
    return false;
  }
};

const isTrustedRendererUrl = (rawUrl: string): boolean => {
  if (!rawUrl) {
    return false;
  }

  const devOrigin = getDevServerOrigin();
  if (devOrigin) {
    try {
      return new URL(rawUrl).origin === devOrigin;
    } catch {
      return false;
    }
  }

  return isInternalAppUrl(rawUrl);
};

const assertTrustedIpcSender = (
  event: IpcMainInvokeEvent | IpcMainEvent,
  channel: string,
): void => {
  const senderFrameUrl = event.senderFrame?.url ?? "";
  const senderWebContentsUrl = event.sender.getURL();
  const candidateUrl = senderFrameUrl || senderWebContentsUrl;
  if (isTrustedRendererUrl(candidateUrl)) {
    return;
  }

  throw new Error(
    `Blocked IPC on "${channel}" from untrusted sender (${candidateUrl || "unknown-url"}).`,
  );
};

const isAllowedPermission = (permission: string): boolean => {
  // Keep scope minimal. Add permissions here only when renderer features require them.
  return permission === "clipboard-sanitized-write";
};

const setupPermissionHardening = (targetSession: Session): void => {
  if (permissionHardeningConfigured) {
    return;
  }

  targetSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const originToCheck = requestingOrigin || webContents?.getURL() || "";
    if (!isTrustedRendererUrl(originToCheck)) {
      return false;
    }

    return isAllowedPermission(permission);
  });

  targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const originToCheck = details.requestingUrl || webContents?.getURL() || "";
    const allowed = isTrustedRendererUrl(originToCheck) && isAllowedPermission(permission);
    callback(allowed);
  });

  permissionHardeningConfigured = true;
};

const resolveAppProtocolAssetPath = (requestPathname: string): string | null => {
  const distRoot = path.resolve(__dirname, "../dist");
  const decodedPathname = (() => {
    try {
      return decodeURIComponent(requestPathname);
    } catch {
      return requestPathname;
    }
  })();
  const sanitizedPathname = decodedPathname.replace(/\\/g, "/");
  const requestedRelativePath =
    sanitizedPathname === "/" ? "index.html" : sanitizedPathname.replace(/^\/+/, "");
  const candidatePath = path.normalize(path.join(distRoot, requestedRelativePath));

  if (!candidatePath.startsWith(distRoot)) {
    return null;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  // SPA fallback for app://local/<route> links.
  if (!path.extname(requestedRelativePath)) {
    const indexPath = path.join(distRoot, "index.html");
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
};

const setupInternalAppProtocol = (): void => {
  if (isDev) {
    return;
  }

  protocol.handle(INTERNAL_APP_PROTOCOL, async (request) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const parsed = new URL(request.url);
      if (parsed.hostname !== INTERNAL_APP_HOST) {
        return new Response("Not Found", { status: 404 });
      }

      const assetPath = resolveAppProtocolAssetPath(parsed.pathname);
      if (!assetPath) {
        return new Response("Not Found", { status: 404 });
      }

      const response = await electronNet.fetch(pathToFileURL(assetPath).toString());

      // Inject CSP headers for HTML responses so Turnstile and other
      // external resources work correctly in the packaged app.
      if (assetPath.endsWith(".html")) {
        const headers = new Headers(response.headers);
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob: https://challenges.cloudflare.com; connect-src 'self' https: wss: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; form-action 'self' https://*.stripe.com https://*.mercadopago.com https://*.mercadopago.com.br;",
        );
        headers.set("X-Frame-Options", "DENY");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
  });
};

const parseBooleanEnv = (value: string | null, fallback: boolean): boolean => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
};
const registerAllowedExternalHostFromUrl = (rawUrl: string | null): void => {
  if (!rawUrl) {
    return;
  }
  try {
    const parsed = new URL(rawUrl);
    externalAllowedHosts.add(normalizeHost(parsed.hostname));
  } catch {
    // Ignore malformed URLs from env/runtime overrides.
  }
};

const hydrateAllowedExternalHosts = (): void => {
  if (externalAllowedHosts.size > 0) {
    return;
  }

  registerAllowedExternalHostFromUrl(authApiUrl);
  registerAllowedExternalHostFromUrl(localApiUrl);
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("UPDATE_SERVER_URL"));
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("VITE_PROJECT_WEBSITE_URL"));
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("VITE_PROJECT_DISCORD_URL"));
  registerAllowedExternalHostFromUrl(resolveDesktopEnvValue("VITE_PROJECT_BUG_URL"));
};

const normalizeSha256Fingerprint = (value: string): string =>
  value.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();

const parseSha256Pins = (rawValue: string | null): Set<string> => {
  if (!rawValue) {
    return new Set<string>();
  }

  return new Set(
    rawValue
      .split(",")
      .map((value) => normalizeSha256Fingerprint(value))
      .filter((value) => value.length === 64),
  );
};

const parseHostFromUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) {
    return null;
  }
  try {
    return normalizeHost(new URL(rawUrl).hostname);
  } catch {
    return null;
  }
};

const getCertificatePinsByHost = (): Map<string, Set<string>> => {
  if (cachedCertificatePinsByHost) {
    return cachedCertificatePinsByHost;
  }

  const byHost = new Map<string, Set<string>>();
  const rules: Array<{ targetUrl: string; envKey: string }> = [
    { targetUrl: authApiUrl, envKey: "AUTH_API_CERT_PINS_SHA256" },
    { targetUrl: resolveDesktopEnvValue("UPDATE_SERVER_URL") ?? "", envKey: "UPDATE_SERVER_CERT_PINS_SHA256" },
  ];

  for (const rule of rules) {
    const host = parseHostFromUrl(rule.targetUrl);
    if (!host) {
      continue;
    }
    const pins = parseSha256Pins(resolveDesktopEnvValue(rule.envKey));
    if (pins.size === 0) {
      continue;
    }

    const existing = byHost.get(host);
    if (!existing) {
      byHost.set(host, pins);
      continue;
    }

    pins.forEach((pin) => {
      existing.add(pin);
    });
  }

  cachedCertificatePinsByHost = byHost;
  return byHost;
};

const extractCertificatePinSha256 = (certificateData: string | undefined): string => {
  if (!certificateData) {
    return "";
  }

  try {
    const certificate = new X509Certificate(certificateData);
    return normalizeSha256Fingerprint(certificate.fingerprint256);
  } catch {
    return "";
  }
};

const extractCertificatePublicKeyPinSha256 = (certificateData: string | undefined): string => {
  if (!certificateData) {
    return "";
  }

  try {
    const certificate = new X509Certificate(certificateData);
    const spki = certificate.publicKey.export({ type: "spki", format: "der" });
    return createHash("sha256").update(spki).digest("hex").toUpperCase();
  } catch {
    return "";
  }
};

const setupCertificatePinning = (targetSession: Session): void => {
  if (isDev || certificatePinningConfigured) {
    return;
  }

  const pinsByHost = getCertificatePinsByHost();
  if (pinsByHost.size === 0) {
    return;
  }

  targetSession.setCertificateVerifyProc((request, callback) => {
    const host = normalizeHost(request.hostname ?? "");
    const allowedPins = pinsByHost.get(host);
    if (!allowedPins || allowedPins.size === 0) {
      callback(CERT_PIN_USE_CHROMIUM_VALIDATION);
      return;
    }

    const presentedFingerprint = extractCertificatePinSha256(request.certificate?.data);
    const presentedPublicKeyPin = extractCertificatePublicKeyPinSha256(request.certificate?.data);
    const hasAnyPresentedPin =
      presentedFingerprint.length === 64 || presentedPublicKeyPin.length === 64;

    if (!hasAnyPresentedPin) {
      console.error(
        `[desktop-security] certificate pin verification failed for ${host}: unable to extract certificate fingerprint/SPKI pin.`,
      );
      callback(CERT_PIN_ERROR);
      return;
    }

    const fingerprintMatch = presentedFingerprint.length === 64 && allowedPins.has(presentedFingerprint);
    const publicKeyMatch = presentedPublicKeyPin.length === 64 && allowedPins.has(presentedPublicKeyPin);
    const matched = fingerprintMatch || publicKeyMatch;
    if (!matched) {
      console.error(
        `[desktop-security] certificate pin mismatch for ${host}: fingerprint=${presentedFingerprint || "unavailable"} spki=${presentedPublicKeyPin || "unavailable"}`,
      );
    }

    callback(matched ? 0 : CERT_PIN_ERROR);
  });

  certificatePinningConfigured = true;
};

const desktopClientTokenTtlSec = parseDesktopTokenTtlSec(
  resolveDesktopEnvValue("DESKTOP_CLIENT_TOKEN_TTL_SECONDS") ?? undefined,
  600,
);
const desktopClientTokenRefreshSkewSec = parseDesktopRefreshSkewSec(
  resolveDesktopEnvValue("DESKTOP_CLIENT_TOKEN_REFRESH_SKEW_SECONDS") ?? undefined,
  90,
);
const enforceDesktopClient = parseBooleanEnv(
  resolveDesktopEnvValue("ENFORCE_DESKTOP_CLIENT"),
  app.isPackaged,
);

if (!desktopBootstrapSecret) {
  if (!enforceDesktopClient) {
    debugDesktopWarn(
      "[desktop-auth] DESKTOP_BOOTSTRAP_SECRET not found; legacy bootstrap secret fallback is disabled.",
    );
  }
}

type DesktopSessionState = {
  sessionId: string;
  deviceId: string;
  token: string;
  expiresAtMs: number;
  refreshTimeout: NodeJS.Timeout | null;
  refreshInFlight: Promise<void> | null;
};

// Stable per-install device id (random, persisted in userData — no hardware fingerprinting).
// Cleared by resetDesktopLocalSettings alongside the other local state files.
const resolveDesktopDeviceId = (): string => {
  const filePath = path.join(app.getPath("userData"), "desktop-device-id.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { deviceId?: unknown };
    if (typeof parsed.deviceId === "string" && parsed.deviceId.trim().length > 0) {
      return parsed.deviceId.trim();
    }
  } catch {
    // Missing or malformed file — generate a new id below.
  }
  const deviceId = `desktop-${randomUUID()}`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({ deviceId }, null, 2)}\n`, "utf8");
  } catch {
    // Best effort persistence; the id still works for this session.
  }
  return deviceId;
};

const desktopSessionState: DesktopSessionState = {
  sessionId: `desktop-${randomUUID()}`,
  deviceId: resolveDesktopDeviceId(),
  token: "",
  expiresAtMs: 0,
  refreshTimeout: null,
  refreshInFlight: null,
};
let desktopDeviceKey = "";
let desktopDeviceKeyRefreshInFlight: Promise<void> | null = null;
let desktopPendingTravelToken = (resolveDesktopEnvValue("DESKTOP_TRAVEL_TOKEN") ?? "").trim() || null;

const shouldDisableGpuInDev = ["1", "true", "yes"].includes(
  (process.env.ELECTRON_DISABLE_GPU ?? "").trim().toLowerCase(),
);

if (isDev && shouldDisableGpuInDev) {
  // Optional fallback for environments with GPU/driver instability in dev.
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}

const generateDesktopSessionToken = (): string => randomBytes(32).toString("base64url");

const clearDesktopTokenRefreshTimeout = (): void => {
  if (!desktopSessionState.refreshTimeout) {
    return;
  }

  clearTimeout(desktopSessionState.refreshTimeout);
  desktopSessionState.refreshTimeout = null;
};

const clearDesktopSessionState = (clearDeviceKey: boolean): void => {
  clearDesktopTokenRefreshTimeout();
  desktopSessionState.token = "";
  desktopSessionState.expiresAtMs = 0;
  desktopPendingTravelToken = null;
  if (clearDeviceKey) {
    desktopDeviceKey = "";
  }
};

const scheduleDesktopSessionTokenRefresh = (expiresAtMs: number): void => {
  clearDesktopTokenRefreshTimeout();

  const refreshSkewMs = desktopClientTokenRefreshSkewSec * 1_000;
  const refreshInMs = Math.max(15_000, expiresAtMs - Date.now() - refreshSkewMs);
  desktopSessionState.refreshTimeout = setTimeout(() => {
    void refreshDesktopSessionToken("scheduled");
  }, refreshInMs);
};

const registerDesktopDeviceKey = async (
  reason: "register" | "login" | "startup" | "session-refresh",
  options: { travelToken?: string | null } = {},
): Promise<void> => {
  if (desktopDeviceKey.length > 0) {
    return;
  }

  if (desktopDeviceKeyRefreshInFlight) {
    await desktopDeviceKeyRefreshInFlight;
    return;
  }

  desktopDeviceKeyRefreshInFlight = (async () => {
    const endpoint = new URL(DESKTOP_DEVICE_REGISTER_PATH, authApiUrl).toString();
    const sessionClient = getDesktopHttpSession();
    const normalizedTravelToken =
      options.travelToken?.trim() ||
      desktopPendingTravelToken?.trim() ||
      "";
    const requestHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    if (normalizedTravelToken) {
      requestHeaders[DESKTOP_TRAVEL_TOKEN_HEADER] = normalizedTravelToken;
    }
    const requestInit: RequestInit = {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        deviceId: desktopSessionState.deviceId,
        syncReason: reason,
        ...(normalizedTravelToken
          ? {
              travelToken: normalizedTravelToken,
            }
          : {}),
      }),
    };

    debugDesktopInfo(
      `[desktop-auth] device-register start reason=${reason} endpoint=${DESKTOP_DEVICE_REGISTER_PATH} travelToken=${normalizedTravelToken ? "yes" : "no"}`,
    );

    const response = await fetchWithTimeoutAndRetry(
      (signal) =>
        sessionClient.fetch(endpoint, {
          ...requestInit,
          signal,
        }),
      requestInit,
      {
        timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
        retryCount: 0,
      },
    );

    if (!response.ok) {
      const failurePayload = await parseResponsePayload(response);
      debugDesktopWarn(
        `[desktop-auth] device-register failed status=${response.status} endpoint=${DESKTOP_DEVICE_REGISTER_PATH} ${summarizeDesktopApiPayload(
          failurePayload,
        )}`,
      );
      throw toDesktopStructuredError(response.status, failurePayload);
    }

    const payload = (await response.json()) as { deviceKey?: string };
    const key = typeof payload.deviceKey === "string" ? payload.deviceKey.trim() : "";
    if (!key || key.length < 43) {
      throw new Error("Desktop device registration returned an invalid key.");
    }

    desktopDeviceKey = key;
    desktopPendingTravelToken = null;
    debugDesktopInfo(
      `[desktop-auth] device-register ok reason=${reason} endpoint=${DESKTOP_DEVICE_REGISTER_PATH}`,
    );
    if (reason === "login" || reason === "register") {
      debugDesktopLog("[desktop-auth] Desktop device key registered for current session.");
    }
  })();

  try {
    await desktopDeviceKeyRefreshInFlight;
  } finally {
    desktopDeviceKeyRefreshInFlight = null;
  }
};

const registerDesktopSessionToken = async (): Promise<void> => {
  if (enforceDesktopClient) {
    await registerDesktopDeviceKey("session-refresh");
  }

  const token = generateDesktopSessionToken();
  const endpoint = new URL(DESKTOP_BOOTSTRAP_PATH, authApiUrl).toString();

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  // Send BOTH when available: with ENFORCE_DESKTOP_CLIENT=true the server
  // validates the device key; with false it requires the secret. Sending only
  // the key (legacy flow) left the bootstrap at 401 when the server was not
  // enforcing.
  if (desktopDeviceKey) {
    headers[DESKTOP_DEVICE_KEY_HEADER] = desktopDeviceKey;
  }
  if (desktopBootstrapSecret) {
    headers[DESKTOP_BOOTSTRAP_SECRET_HEADER] = desktopBootstrapSecret;
  }

  const bootstrapInit: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId: desktopSessionState.sessionId,
      deviceId: desktopSessionState.deviceId,
      token,
      ttlSeconds: desktopClientTokenTtlSec,
    }),
  };
  debugDesktopInfo(
    `[desktop-auth] bootstrap start endpoint=${DESKTOP_BOOTSTRAP_PATH} deviceKey=${desktopDeviceKey ? "yes" : "no"} secret=${desktopBootstrapSecret ? "yes" : "no"}`,
  );
  const response = await fetchWithTimeoutAndRetry(
    (signal) =>
      fetch(endpoint, {
        ...bootstrapInit,
        signal,
      }),
    bootstrapInit,
    {
      timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
      retryCount: 0,
    },
  );

  if (!response.ok) {
    const failurePayload = await parseResponsePayload(response);
    debugDesktopWarn(
      `[desktop-auth] bootstrap failed status=${response.status} endpoint=${DESKTOP_BOOTSTRAP_PATH} ${summarizeDesktopApiPayload(
        failurePayload,
      )}`,
    );
    const hint = response.status === 401 && enforceDesktopClient
      ? " (desktop device is not registered/authenticated)"
      : response.status === 401 && desktopBootstrapSecret
        ? " (verify DESKTOP_BOOTSTRAP_SECRET in both koma-studio/.env.* and auth-server/.env.*)"
        : "";
    throw new Error(`Desktop bootstrap failed with status ${response.status}${hint}`);
  }

  const payload = (await response.json()) as { expiresAt?: string; ttlSeconds?: number };
  const ttlSeconds =
    typeof payload.ttlSeconds === "number" && Number.isFinite(payload.ttlSeconds)
      ? payload.ttlSeconds
      : desktopClientTokenTtlSec;
  const parsedExpiresAt =
    typeof payload.expiresAt === "string" ? Date.parse(payload.expiresAt) : Number.NaN;
  const expiresAtMs = Number.isFinite(parsedExpiresAt)
    ? parsedExpiresAt
    : Date.now() + ttlSeconds * 1_000;

  desktopSessionState.token = token;
  desktopSessionState.expiresAtMs = expiresAtMs;
  scheduleDesktopSessionTokenRefresh(expiresAtMs);
  debugDesktopInfo(
    `[desktop-auth] bootstrap ok endpoint=${DESKTOP_BOOTSTRAP_PATH} ttlSeconds=${ttlSeconds}`,
  );
};

const refreshDesktopSessionToken = async (
  reason: "startup" | "scheduled" | "on-demand",
): Promise<boolean> => {
  if (desktopSessionState.refreshInFlight) {
    try {
      await desktopSessionState.refreshInFlight;
      return true;
    } catch {
      return false;
    }
  }

  let succeeded = true;
  const hadTokenBeforeRefresh = desktopSessionState.token.length > 0;
  desktopSessionState.refreshInFlight = (async () => {
    try {
      await registerDesktopSessionToken();
    } catch (error) {
      succeeded = false;
      debugDesktopWarn(
        `[desktop-auth] failed to refresh session token: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (reason === "scheduled" || hadTokenBeforeRefresh) {
        scheduleDesktopSessionTokenRefresh(Date.now() + 30_000);
      }
    }
  })();

  try {
    await desktopSessionState.refreshInFlight;
    return succeeded;
  } finally {
    desktopSessionState.refreshInFlight = null;
  }
};

const ensureDesktopSessionToken = async (
  reason: "startup" | "on-demand" = "on-demand",
): Promise<void> => {
  const hasValidToken =
    desktopSessionState.token.length > 0 &&
    desktopSessionState.expiresAtMs - Date.now() > desktopClientTokenRefreshSkewSec * 1_000;
  if (hasValidToken) {
    return;
  }

  const refreshed = await refreshDesktopSessionToken(reason);
  if (!refreshed) {
    if (enforceDesktopClient) {
      throw new Error("Desktop session token bootstrap failed");
    }

    // In non-enforced mode, continue without desktop session token headers.
    clearDesktopSessionState(false);
  }
};

const getDesktopRuntimeConfig = (): {
  authApiUrl: string;
  localApiUrl: string;
  runtimeArtifactsUrl?: string;
  appPackaged: boolean;
  authDisabled: boolean;
} => ({
  authApiUrl,
  localApiUrl,
  runtimeArtifactsUrl: miniBackendArtifactsUrl ?? undefined,
  appPackaged: app.isPackaged,
  authDisabled: isAuthDisabled,
});

const installRecommendedMiniBackendRuntime = async (): Promise<{
  ok: boolean;
  profile: string;
  reason: string | null;
}> => {
  if (miniBackendRuntimeInstallPromise) {
    return miniBackendRuntimeInstallPromise;
  }

  miniBackendRuntimeInstallPromise = (async () => {
    const profile = await resolveMiniBackendAccelerationProfile();
    if (isDev) {
      patchMiniBackendRuntimeState(buildManualInstallBlockedState({
        reason: "dev-only-unavailable",
        requestedProfile: profile,
        activeProfile: miniBackendRuntimeState.activeProfile,
        source: miniBackendRuntimeState.source,
      }));
      return { ok: false, profile, reason: "runtime_manual_install_dev_only_unavailable" };
    }
    if (profile === "cpu") {
      patchMiniBackendRuntimeState(buildManualInstallBlockedState({
        reason: "cpu-not-required",
        requestedProfile: profile,
        activeProfile: miniBackendRuntimeState.activeProfile,
        source: miniBackendRuntimeState.source,
      }));
      return { ok: false, profile, reason: "runtime_manual_install_cpu_not_required" };
    }

    const installedRuntime = await ensureMiniBackendDownloadedRuntime(profile);
    if (!installedRuntime) {
      return {
        ok: false,
        profile,
        reason: miniBackendRuntimeState.lastError ?? "runtime_manual_install_failed",
      };
    }

    writeMiniBackendRuntimeSelection(app.getPath("userData"), {
      profile,
      version: installedRuntime.version,
      entry: path.basename(installedRuntime.binaryPath),
    });
    await stopMiniBackend();
    await startMiniBackend();
    return { ok: true, profile, reason: null };
  })();

  try {
    return await miniBackendRuntimeInstallPromise;
  } finally {
    miniBackendRuntimeInstallPromise = null;
  }
};

const installMiniBackendRuntimeProfile = async (
  profileInput: string,
): Promise<{
  ok: boolean;
  profile: string;
  reason: string | null;
}> => {
  if (miniBackendRuntimeInstallPromise) {
    return miniBackendRuntimeInstallPromise;
  }

  miniBackendRuntimeInstallPromise = (async () => {
    const normalizedProfile = normalizeAccelerationProfileOverride(profileInput);
    if (normalizedProfile === "auto") {
      return { ok: false, profile: profileInput, reason: "runtime_manual_install_invalid_profile" };
    }

    if (isDev) {
      patchMiniBackendRuntimeState(buildManualInstallBlockedState({
        reason: "dev-only-unavailable",
        requestedProfile: normalizedProfile,
        activeProfile: miniBackendRuntimeState.activeProfile,
        source: miniBackendRuntimeState.source,
      }));
      return { ok: false, profile: normalizedProfile, reason: "runtime_manual_install_dev_only_unavailable" };
    }

    const installedRuntime = await ensureMiniBackendDownloadedRuntime(normalizedProfile, {
      allowCpuDownload: true,
    });
    if (!installedRuntime) {
      return {
        ok: false,
        profile: normalizedProfile,
        reason: miniBackendRuntimeState.lastError ?? "runtime_manual_install_failed",
      };
    }

    writeMiniBackendRuntimeSelection(app.getPath("userData"), {
      profile: normalizedProfile,
      version: installedRuntime.version,
      entry: path.basename(installedRuntime.binaryPath),
    });
    await stopMiniBackend();
    await startMiniBackend();
    return { ok: true, profile: normalizedProfile, reason: null };
  })();

  try {
    return await miniBackendRuntimeInstallPromise;
  } finally {
    miniBackendRuntimeInstallPromise = null;
  }
};

const emitMiniBackendRuntimeState = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(MINI_BACKEND_RUNTIME_EVENT_CHANNEL, getMiniBackendRuntimeStateSnapshot());
};

const commitMiniBackendRuntimeState = (nextState: MiniBackendRuntimeState): MiniBackendRuntimeState => {
  miniBackendRuntimeState = {
    ...nextState,
    progress: nextState.progress ? { ...nextState.progress } : null,
    updatedAt: Date.now(),
  };
  emitMiniBackendRuntimeState();
  return miniBackendRuntimeState;
};

const patchMiniBackendRuntimeState = (
  patch: Partial<MiniBackendRuntimeState>,
): MiniBackendRuntimeState =>
  commitMiniBackendRuntimeState({
    ...miniBackendRuntimeState,
    ...patch,
  });

const getMiniBackendRuntimeStateSnapshot = (): MiniBackendRuntimeState => ({
  ...miniBackendRuntimeState,
  progress: miniBackendRuntimeState.progress ? { ...miniBackendRuntimeState.progress } : null,
});

const formatRuntimeBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const prepareMiniBackendLaunchContext = async (): Promise<void> => {
  const configuredPort = isDev ? null : parseConfiguredPort(resolveDesktopEnvValue("VITE_LOCAL_API_URL"));
  if (configuredPort) {
    preparedMiniBackendPort = configuredPort;
  } else if (!preparedMiniBackendPort) {
    preparedMiniBackendPort = await getRandomLocalPort();
  }

  localApiSessionSecret = randomBytes(32).toString("hex");
  localApiUrl = `http://127.0.0.1:${preparedMiniBackendPort}`;
  registerAllowedExternalHostFromUrl(localApiUrl);
};

const getAvailableDiskBytes = (targetPath: string): number => {
  const statfsPath = resolveExistingPathForStatfs(targetPath);
  if (!statfsPath) {
    return 0;
  }
  try {
    const stats = fs.statfsSync(statfsPath);
    const statsWithOptionalFrsize = stats as typeof stats & { frsize?: number };
    const blockSize = Number(stats.bsize || statsWithOptionalFrsize.frsize || 0);
    const availableBlocks = Number(stats.bavail ?? stats.blocks ?? 0);
    if (!Number.isFinite(blockSize) || !Number.isFinite(availableBlocks)) {
      return 0;
    }
    return Math.max(0, Math.trunc(blockSize * availableBlocks));
  } catch {
    return 0;
  }
};

const ensureMiniBackendRuntimeDiskSpace = (
  archivePath: string,
  installDir: string,
  archiveBytes: number,
): void => {
  const requiredBytes = estimateRuntimeInstallRequiredBytes(archiveBytes);
  for (const targetPath of [archivePath, installDir]) {
    const availableBytes = getAvailableDiskBytes(targetPath);
    if (availableBytes > 0 && availableBytes < requiredBytes) {
      throw new Error(
        `Insufficient disk space for runtime artifact. Need ${formatRuntimeBytes(requiredBytes)} free, found ${formatRuntimeBytes(availableBytes)}.`,
      );
    }
  }
};

const isRetryableRuntimeDownloadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim();
  if (!message) {
    return true;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  const httpMatch = message.match(/HTTP\s+(\d{3})/i);
  if (httpMatch) {
    return RUNTIME_RETRYABLE_HTTP_STATUSES.has(Number(httpMatch[1]));
  }

  return /fetch failed|network|socket|timed out|timeout|temporar/i.test(message);
};

const getDesktopHttpSession = (): Session => {
  return mainWindow?.webContents.session ?? electronSession.defaultSession;
};

const normalizeCookieDomain = (value: string): string => value.replace(/^\./, "").trim().toLowerCase();

const cookieMatchesHost = (cookieDomain: string, host: string): boolean => {
  const normalizedCookieDomain = normalizeCookieDomain(cookieDomain);
  if (!normalizedCookieDomain || !host) {
    return false;
  }

  return normalizedCookieDomain === host || host.endsWith(`.${normalizedCookieDomain}`);
};

const buildCookieRemovalUrl = (cookie: Cookie): string | null => {
  const cookieHost = normalizeCookieDomain(cookie.domain ?? "");
  if (!cookieHost) {
    return null;
  }

  const protocol = cookie.secure ? "https" : "http";
  const cookiePath = cookie.path && cookie.path.startsWith("/") ? cookie.path : "/";
  return `${protocol}://${cookieHost}${cookiePath}`;
};

const clearDesktopAuthCookies = async (): Promise<void> => {
  let authHost = "";
  try {
    authHost = normalizeHost(new URL(authApiUrl).hostname);
  } catch {
    return;
  }

  if (!authHost) {
    return;
  }

  const sessionClient = getDesktopHttpSession();
  const cookies = await sessionClient.cookies.get({});
  const authCookies = cookies.filter((cookie) => cookieMatchesHost(cookie.domain ?? "", authHost));
  await Promise.all(
    authCookies.map(async (cookie) => {
      const removalUrl = buildCookieRemovalUrl(cookie);
      if (!removalUrl) {
        return;
      }

      try {
        await sessionClient.cookies.remove(removalUrl, cookie.name);
      } catch {
        console.warn("[desktop] Failed to remove auth cookie:", cookie.name);
      }
    }),
  );
};

const hasDesktopAuthCookie = async (): Promise<boolean> => {
  let authHost = "";
  try {
    authHost = normalizeHost(new URL(authApiUrl).hostname);
  } catch {
    return false;
  }

  if (!authHost) {
    return false;
  }

  const sessionClient = getDesktopHttpSession();
  const cookies = await sessionClient.cookies.get({});
  return cookies.some((cookie) => cookieMatchesHost(cookie.domain ?? "", authHost));
};

const getDesktopUpdateChannel = (): "stable" | "beta" => {
  const channel = updaterService?.getStatusSnapshot().channel;
  return channel === "beta" ? "beta" : "stable";
};

const buildDesktopSessionHeaders = (
  headersInit: HeadersInit | undefined,
  accessToken?: string,
): Headers => {
  const headers = new Headers(headersInit);
  headers.set(DESKTOP_APP_VERSION_HEADER, app.getVersion());
  headers.set(DESKTOP_UPDATE_CHANNEL_HEADER, getDesktopUpdateChannel());
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (desktopSessionState.token) {
    headers.set(DESKTOP_CLIENT_TOKEN_HEADER, desktopSessionState.token);
    headers.set(DESKTOP_SESSION_ID_HEADER, desktopSessionState.sessionId);
    headers.set(DESKTOP_DEVICE_ID_HEADER, desktopSessionState.deviceId);
  }
  return headers;
};

const recoverDesktopSession = async (
  action: DesktopSessionRecoveryAction,
): Promise<boolean> => {
  if (!action) {
    return false;
  }

  const attemptRecovery = async (clearDeviceKey: boolean): Promise<boolean> => {
    clearDesktopSessionState(clearDeviceKey);
    return refreshDesktopSessionToken("on-demand");
  };

  const initialRecovery = await attemptRecovery(action === "refresh-device");
  if (initialRecovery) {
    return true;
  }

  if (action === "refresh-session") {
    return attemptRecovery(true);
  }

  return false;
};

interface DesktopApiEnvelope<T = unknown> {
  ok: boolean;
  status: number;
  payload: T | null;
}

const desktopSessionApiFetch = async (
  endpointPath: string,
  init: RequestInit = {},
  options: { requireDesktopSession?: boolean } = {},
): Promise<DesktopApiEnvelope> => {
  const requireDesktopSession = options.requireDesktopSession === true;
  const method = normalizeHttpMethod(init.method);
  const targetUrl = new URL(endpointPath, authApiUrl).toString();
  const sessionClient = getDesktopHttpSession();

  try {
    if (requireDesktopSession) {
      await ensureDesktopSessionToken("on-demand");
    }

    debugDesktopInfo(
      `[desktop-auth] request start method=${method} endpoint=${endpointPath} desktopSession=${requireDesktopSession ? "required" : "optional"} token=${desktopSessionState.token ? "yes" : "no"}`,
    );
    const sendRequest = async (): Promise<{ response: globalThis.Response; payload: unknown }> => {
      const requestInit: RequestInit = {
        ...init,
        headers: buildDesktopSessionHeaders(init.headers),
      };

      const response = await fetchWithTimeoutAndRetry(
        (signal) =>
          sessionClient.fetch(targetUrl, {
            ...requestInit,
            signal,
          }),
        requestInit,
        {
          timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
          retryCount: DESKTOP_FETCH_RETRY_COUNT,
        },
      );
      const payload = await parseResponsePayload(response);
      return { response, payload };
    };

    let result = await sendRequest();
    if (!result.response.ok) {
      const recoveryAction = resolveDesktopSessionRecoveryAction(
        result.response.status,
        result.payload,
      );
      debugDesktopWarn(
        `[desktop-auth] request failed method=${method} endpoint=${endpointPath} status=${result.response.status} recovery=${recoveryAction ?? "none"} ${summarizeDesktopApiPayload(
          result.payload,
        )}`,
      );
      if (await recoverDesktopSession(recoveryAction)) {
        debugDesktopInfo(
          `[desktop-auth] request retry after recovery method=${method} endpoint=${endpointPath} recovery=${recoveryAction}`,
        );
        result = await sendRequest();
      }
    }

    debugDesktopInfo(
      `[desktop-auth] request done method=${method} endpoint=${endpointPath} status=${result.response.status} ok=${result.response.ok}`,
    );

    return {
      ok: result.response.ok,
      status: result.response.status,
      payload: result.payload,
    };
  } catch (error) {
    if (isDesktopStructuredError(error)) {
      debugDesktopWarn(
        `[desktop-auth] request structured-failed method=${method} endpoint=${endpointPath} status=${error.status} ${summarizeDesktopApiPayload(
          error.payload,
        )}`,
      );
      return toDesktopAuthErrorEnvelope(
        error,
        "Desktop session failure.",
        error.code ?? "DESKTOP_BOOTSTRAP_FAILED",
      );
    }

    debugDesktopError(
      `[desktop-auth] request network-failed method=${method} endpoint=${endpointPath} url=${targetUrl} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      ok: false,
      status: 503,
      payload: {
        error: error instanceof Error ? error.message : "Failed to connect to auth-server.",
        code: "DESKTOP_API_UNAVAILABLE",
      },
    };
  }
};

const fetchDesktopCookieSessionEnvelope = async (): Promise<DesktopApiEnvelope> =>
  desktopSessionApiFetch(
    "/api/auth/session",
    { method: "GET" },
    { requireDesktopSession: false },
  );

const setupDesktopAuthIpcHandlers = (): void => {
  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:config", async () => {
    return desktopSessionApiFetch(
      "/api/auth/config",
      { method: "GET" },
      { requireDesktopSession: false },
    );
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:session", async () => {
    if (!(await hasDesktopAuthCookie())) {
      debugDesktopInfo("[desktop-auth] session request skipped because no auth cookie is present.");
      return {
        ok: true,
        status: 200,
        payload: null,
      };
    }

    const sessionEnvelope = await desktopSessionApiFetch(
      "/api/auth/session",
      { method: "GET" },
      { requireDesktopSession: true },
    );

    if (sessionEnvelope.ok) {
      debugDesktopInfo("[desktop-auth] session request resolved through desktop bootstrap session.");
      return sessionEnvelope;
    }

    const sessionErrorCode = resolveDesktopErrorCode(sessionEnvelope.payload);
    if (
      sessionErrorCode === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
      sessionErrorCode === "DESKTOP_TRAVEL_TOKEN_INVALID"
    ) {
      debugDesktopWarn(
        `[desktop-auth] session request requires desktop travel token; cookie fallback disabled (${sessionErrorCode}).`,
      );
      return sessionEnvelope;
    }

    debugDesktopWarn(
      `[desktop-auth] session bootstrap failed, falling back to auth cookie session: ${extractDesktopApiErrorMessage(
        sessionEnvelope.payload,
        "Desktop auth session unavailable.",
      )}`,
    );

    const fallbackEnvelope = await fetchDesktopCookieSessionEnvelope();
    debugDesktopInfo(
      `[desktop-auth] session cookie fallback completed ok=${fallbackEnvelope.ok} status=${fallbackEnvelope.status}`,
    );
    return fallbackEnvelope;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:login", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
    const rememberMe = payload.rememberMe === true;
    const travelToken = typeof payload.travelToken === "string" ? payload.travelToken.trim() : "";

    if (!email || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Credenciais invalidas." },
      };
    }

    clearDesktopSessionState(true);
    await clearDesktopAuthCookies();
    if (travelToken) {
      desktopPendingTravelToken = travelToken;
    }

    debugDesktopInfo(
      `[desktop-auth] login start email=${sanitizeSessionLogText(email, 120)} rememberMe=${rememberMe ? "yes" : "no"} travelToken=${travelToken ? "yes" : "no"}`,
    );

    const response = await desktopSessionApiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        captchaToken,
        rememberMe,
        desktopDeviceId: desktopSessionState.deviceId,
      }),
    }, { requireDesktopSession: false });

    debugDesktopInfo(
      `[desktop-auth] login response status=${response.status} ok=${response.ok} ${summarizeDesktopApiPayload(
        response.payload,
      )}`,
    );

    if (!response.ok) {
      await clearDesktopAuthCookies();
      clearDesktopSessionState(true);
      return response;
    }

    try {
      await registerDesktopDeviceKey("login", { travelToken });
      await refreshDesktopSessionToken("on-demand");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
          error.code === "DESKTOP_TRAVEL_TOKEN_INVALID")
      ) {
        await clearDesktopAuthCookies();
        clearDesktopSessionState(true);
        debugDesktopWarn(
          `[desktop-auth] post-login bootstrap requires travel token; returning auth error (${error.code}).`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Este dispositivo precisa de um token de viagem para entrar nesta conta.",
          error.code,
        );
      }

      debugDesktopWarn(
        `[desktop-auth] post-login bootstrap failed; continuing with cookie session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    debugDesktopInfo("[desktop-auth] login completed; renderer can refresh session snapshot.");

    return response;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:register", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const name = typeof payload.name === "string" ? payload.name : "";
    const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
    const travelToken = typeof payload.travelToken === "string" ? payload.travelToken.trim() : "";
    const legalAcceptance =
      payload.legalAcceptance && typeof payload.legalAcceptance === "object" && !Array.isArray(payload.legalAcceptance)
        ? payload.legalAcceptance
        : undefined;

    if (!email || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Dados de registro invalidos." },
      };
    }

    const response = await desktopSessionApiFetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        name,
        captchaToken,
        legalAcceptance,
        desktopDeviceId: desktopSessionState.deviceId,
      }),
    }, { requireDesktopSession: false });

    debugDesktopInfo(
      `[desktop-auth] register response status=${response.status} ok=${response.ok} ${summarizeDesktopApiPayload(
        response.payload,
      )}`,
    );

    if (!response.ok) {
      return response;
    }

    try {
      if (travelToken) {
        desktopPendingTravelToken = travelToken;
      }
      await registerDesktopDeviceKey("register", { travelToken });
      await refreshDesktopSessionToken("on-demand");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
          error.code === "DESKTOP_TRAVEL_TOKEN_INVALID")
      ) {
        await clearDesktopAuthCookies();
        clearDesktopSessionState(true);
        debugDesktopWarn(
          `[desktop-auth] post-register bootstrap requires travel token; returning auth error (${error.code}).`,
        );
        return toDesktopAuthErrorEnvelope(
          error,
          "Este dispositivo precisa de um token de viagem para entrar nesta conta.",
          error.code,
        );
      }

      debugDesktopWarn(
        `[desktop-auth] post-register bootstrap failed; continuing with cookie session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return response;
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:travel-token:set", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const rawToken = typeof payload.token === "string" ? payload.token.trim() : "";
    desktopPendingTravelToken = rawToken.length > 0 ? rawToken : null;
    return {
      ok: true,
      status: 200,
      payload: {
        success: true,
      },
    };
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:travel-token:create", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const ttlMinutesRaw = Number(payload.ttlMinutes);
    const travelDaysRaw = Number(payload.travelDays);
    const requestBody: Record<string, unknown> = {};
    const deliveryMode =
      payload.deliveryMode === "email"
        ? "email"
        : payload.deliveryMode === "copy"
          ? "copy"
          : null;
    if (Number.isFinite(ttlMinutesRaw) && ttlMinutesRaw > 0) {
      requestBody.ttlMinutes = Math.trunc(ttlMinutesRaw);
    }
    if (Number.isFinite(travelDaysRaw) && travelDaysRaw > 0) {
      requestBody.travelDays = Math.trunc(travelDaysRaw);
    }
    if (deliveryMode) {
      requestBody.deliveryMode = deliveryMode;
    }

    return desktopSessionApiFetch(
      DESKTOP_TRAVEL_TOKEN_PATH,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      { requireDesktopSession: true },
    );
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:verify-email", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const accessToken = normalizeAccessToken(payload.accessToken);
    if (!accessToken) {
      return {
        ok: false,
        status: 401,
        payload: { error: "Sessao expirada. Faca login novamente." },
      };
    }

    return desktopSessionApiFetch("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:confirm-email", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!token) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid token.", code: "AUTH_INVALID_TOKEN" },
      };
    }

    return desktopSessionApiFetch("/api/auth/confirm-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:forgot-password", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    if (!email) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid email." },
      };
    }

    return desktopSessionApiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:reset-password", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!token || !password) {
      return {
        ok: false,
        status: 400,
        payload: { error: "Invalid token or password." },
      };
    }

    return desktopSessionApiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
      }),
    }, { requireDesktopSession: false });
  });

  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:sign-out", async () => {
    const response = await desktopSessionApiFetch("/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }, { requireDesktopSession: false });

    await clearDesktopAuthCookies();
    clearDesktopSessionState(true);
    return response;
  });

  // ─── v2 desktop shell contract: handlers that the Rust app exposes and the
  // ─── Electron shell did not previously register. They mirror the behaviour
  // ─── of the corresponding src-tauri commands.

  // auth:refresh-session — same flow as registerDesktopSessionToken
  // (POST to bootstrap with the device key or secret) to renew the session.
  registerSecureIpcHandler<DesktopApiEnvelope>("desktop-api:auth:refresh-session", async () => {
    await registerDesktopSessionToken();
    return {
      ok: true,
      status: 200,
      payload: { refreshed: true, sessionId: desktopSessionState.sessionId },
    };
  });

  // identity: stable per-install id + HMAC fingerprint (the same data the
  // auth-server's desktop routes already consume).
  registerSecureIpcHandler("desktop-api:identity:hardware-id", async () => {
    return { hardwareId: resolveDesktopDeviceId() };
  });
  registerSecureIpcHandler("desktop-api:identity:machine-fingerprint", async () => {
    const deviceId = resolveDesktopDeviceId();
    // v1 does no hardware fingerprinting — the stable per-install id IS the fingerprint.
    return { fingerprint: deviceId };
  });

  // security: snapshot of the SHA-256 pins configured per host.
  registerSecureIpcHandler("desktop-api:security:cert-pinning:snapshot", async () => {
    const hosts: Record<string, string[]> = {};
    getCertificatePinsByHost().forEach((pins, host) => {
      hosts[host] = Array.from(pins);
    });
    return { configured: Object.keys(hosts).length > 0, hosts };
  });

  // integrations: deep link (komastudio://) — same functions as the main
  // process's protocol flow.
  registerSecureIpcHandler("desktop-api:integrations:deep-link:extract", async (value) => {
    const payload = (value ?? {}) as { argv?: unknown };
    const argv = Array.isArray(payload.argv) ? payload.argv.map(String) : [];
    return { url: extractDeepLinkFromArgv(argv) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:route", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { hashRoute: deepLinkToHashRoute(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:format", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { formatted: formatDeepLinkForLog(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:navigate", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    navigateMainWindowFromDeepLink(url);
    return { navigated: true };
  });

  // images: folder listing (the v2 contract uses it in the model manager).
  registerSecureIpcHandler("desktop-api:images:list-folder", async (value) => {
    const payload = (value ?? {}) as { folderPath?: unknown };
    const folderPath = typeof payload.folderPath === "string" ? payload.folderPath : "";
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { files: [] };
    }
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const full = path.join(folderPath, entry.name);
        return {
          name: entry.name,
          sizeBytes: fs.statSync(full).size,
          modifiedAt: fs.statSync(full).mtimeMs,
        };
      });
    return { folderPath, files };
  });

  // discord-rpc: clear activity (the class already supports it; the channel was missing).
  registerSecureIpcHandler("discord-rpc:clear-activity", async () => {
    return discordRPC.clearActivity();
  });

  // fonts: install/uninstall are not yet implemented in the electron shell —
  // return a typed error so the UI can degrade gracefully (parity with the
  // contract).
  registerSecureIpcHandler("desktop-api:fonts:install", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font install is not supported by this shell yet." },
    };
  });
  registerSecureIpcHandler("desktop-api:fonts:uninstall", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font uninstall is not supported by this shell yet." },
    };
  });
};

const resolvePackagedMiniBackendBinary = (entryFileName?: string): string => {
  const miniBackendDir = path.join(process.resourcesPath, "mini-backend");
  if (entryFileName) {
    const explicitPath = path.join(miniBackendDir, entryFileName);
    if (fs.existsSync(explicitPath)) {
      return explicitPath;
    }
  }
  const candidateNames =
    process.platform === "win32"
      ? ["mini-backend.exe", "mini-backend"]
      : ["mini-backend", "mini-backend.exe"];

  for (const fileName of candidateNames) {
    const candidatePath = path.join(miniBackendDir, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `Mini backend binary not found in packaged resources. Looked for: ${candidateNames.join(", ")}`,
  );
};

const readPackagedMiniBackendManifest = (): MiniBackendLaunchManifest | null => {
  const manifestPath = path.join(process.resourcesPath, "mini-backend", "launch-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as MiniBackendLaunchManifest;
    return parsed;
  } catch {
    return null;
  }
};

interface CommandSpec {
  command: string;
  args: string[];
  cwd: string;
}

interface MiniBackendCommandSpec extends CommandSpec {
  dependencyCheck?: CommandSpec;
  dependencyInstall?: CommandSpec;
  env?: Record<string, string>;
  runtimeSource?: MiniBackendRuntimeSource;
  installDir?: string | null;
  version?: string | null;
}

const canRunCommand = (command: string, args: string[], cwd: string): boolean => {
  try {
    execFileSync(command, args, {
      cwd,
      stdio: "ignore",
      windowsHide: true,
      timeout: 8_000,
    });
    return true;
  } catch {
    return false;
  }
};

const runCommand = (spec: CommandSpec): boolean =>
  canRunCommand(spec.command, spec.args, spec.cwd);

const resolveDevPythonRuntime = (
  profile: MiniBackendAccelerationProfile,
): { command: string; args: string[] } => {
  const override = (process.env.MINI_BACKEND_PYTHON ?? "").trim();
  if (override) {
    return { command: override, args: [] };
  }

  const localCandidatePaths = buildDevPythonRuntimePathCandidates(
    profile,
    process.cwd(),
    process.platform,
  );
  for (const candidatePath of localCandidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return { command: candidatePath, args: [] };
    }
  }

  const candidates =
    process.platform === "win32"
      ? [
          { command: "py", args: ["-3.12"] },
          { command: "python", args: [] },
        ]
      : [
          { command: "python3.12", args: [] },
          { command: "python3", args: [] },
          { command: "python", args: [] },
        ];

  const rootDir = process.cwd();
  for (const candidate of candidates) {
    if (canRunCommand(candidate.command, [...candidate.args, "-c", "import sys"], rootDir)) {
      return candidate;
    }
  }

  return candidates[0];
};

const normalizeAccelerationProfileOverride = (
  value: string | null | undefined,
): MiniBackendAccelerationProfile | "auto" => {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "cpu":
    case "nvidia-cuda":
    case "nvidia-cuda-legacy":
    case "nvidia-tensorrt":
    case "apple-mps":
    case "amd-rocm":
    case "intel-openvino":
      return normalized;
    default:
      return "auto";
  }
};

const readWindowsVideoControllerDescriptors = (): string[] => {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const rawOutput = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,PNPDeviceID,VideoProcessor | ConvertTo-Json -Depth 3 -Compress",
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000,
      },
    );
    if (typeof rawOutput !== "string" || rawOutput.trim().length === 0) {
      return [];
    }

    return extractGpuVendorsFromWindowsVideoControllers(JSON.parse(rawOutput));
  } catch {
    return [];
  }
};

const collectMiniBackendGpuVendors = async (): Promise<string[]> => {
  const gpuInfo = await app.getGPUInfo("complete").catch(() => null);
  const electronDescriptors = extractGpuVendors(gpuInfo);
  const windowsDescriptors = readWindowsVideoControllerDescriptors();
  return Array.from(new Set([...electronDescriptors, ...windowsDescriptors]));
};

const resolveMiniBackendAccelerationProfile = async (
  { silent = false, ignoreManualSelection = false }: { silent?: boolean; ignoreManualSelection?: boolean } = {},
): Promise<MiniBackendAccelerationProfile> => {
  const envOverrideProfile = normalizeAccelerationProfileOverride(
    resolveDesktopEnvValue("MINI_BACKEND_ACCELERATION_PROFILE")
    ?? process.env.MINI_BACKEND_ACCELERATION_PROFILE,
  );
  const selectedRuntime = readMiniBackendRuntimeSelection(app.getPath("userData"));
  const overrideProfile = resolveRequestedRuntimeProfile({
    envOverrideProfile,
    selectedProfile: selectedRuntime?.profile ?? null,
    ignoreManualSelection,
  });
  const gpuVendors = await collectMiniBackendGpuVendors();
  const profile = resolveAccelerationProfile({
    platform: process.platform,
    arch: process.arch,
    overrideProfile,
    gpuVendors,
  });
  if (!silent) {
    patchMiniBackendRuntimeState({
      status: "resolving",
      statusMessage: "Detecting the best local runtime profile.",
      requestedProfile: profile,
      attempt: 0,
      maxAttempts: 0,
      progress: null,
    });
  }
  return profile;
};

const ensureMiniBackendDevDependencies = (spec: MiniBackendCommandSpec): void => {
  if (!isDev || !spec.dependencyCheck || !spec.dependencyInstall) {
    return;
  }

  if (runCommand(spec.dependencyCheck)) {
    return;
  }

  console.warn(
    "[mini-backend] Dependencias de exportacao PSD ausentes. Instalando psd-tools e photoshop-python-api no runtime ativo...",
  );
  const installOk = runCommand(spec.dependencyInstall);
  if (!installOk) {
    console.error(
      `[mini-backend] Failed to install PSD dependencies automatically. Run manually: ${spec.dependencyInstall.command} ${spec.dependencyInstall.args.join(" ")}`,
    );
    return;
  }

  if (!runCommand(spec.dependencyCheck)) {
    console.error("[mini-backend] Dependencias PSD continuam indisponiveis apos instalacao automatica.");
  }
};

const getMiniBackendCommand = async (): Promise<MiniBackendCommandSpec> => {
  const profile = await resolveMiniBackendAccelerationProfile();
  if (isDev) {
    const runtime = resolveDevPythonRuntime(profile);
    // monorepo: the mini-backend source lives in packages/mini-backend
    const miniBackendDir = path.join(process.cwd(), "..", "..", "packages", "mini-backend");
    const appPath = path.join(miniBackendDir, "app.py");
    patchMiniBackendRuntimeState({
      requestedProfile: profile,
      activeProfile: profile,
      source: "bundled-core",
      installDir: miniBackendDir,
      version: app.getVersion(),
      lastError: null,
      status: "checking",
      statusMessage: "Starting local development runtime.",
      attempt: 0,
      maxAttempts: 0,
      progress: null,
    });
    const dependencyCheck: CommandSpec = {
      command: runtime.command,
      args: [...runtime.args, "-c", "import psd_tools, photoshop"],
      cwd: miniBackendDir,
    };
    const dependencyInstall: CommandSpec = {
      command: runtime.command,
      args: [
        ...runtime.args,
        "-m",
        "pip",
        "install",
        "psd-tools>=1.12.0",
        "photoshop-python-api>=0.24.1",
        "pywin32>=306",
      ],
      cwd: miniBackendDir,
    };

    return {
      command: runtime.command,
      args: [...runtime.args, appPath],
      cwd: process.cwd(),
      dependencyCheck,
      dependencyInstall,
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: profile,
        // DEV: same env contract as the production spawn — without it the
        // backend runs blind (no models/reference images) and the profile
        // warmup fails.
        KOMA_MODELS_ROOT: path.join(app.getPath("userData"), "models"),
        KOMA_APP_RESOURCES_DIR: path.join(process.cwd(), "resources"),
        KOMA_REFERENCE_IMAGES_DIR: path.join(process.cwd(), "resources", "reference_images"),
      },
      runtimeSource: "bundled-core",
      installDir: miniBackendDir,
      version: app.getVersion(),
    };
  }

  const manifest = readPackagedMiniBackendManifest();
  const selectedRuntime = readMiniBackendRuntimeSelection(app.getPath("userData"));
  const selectedRuntimeBinaryPath = resolveSelectedRuntimeBinaryPath(app.getPath("userData"));
  if (selectedRuntime && selectedRuntime.profile === profile && selectedRuntimeBinaryPath) {
    return {
      command: selectedRuntimeBinaryPath,
      args: [],
      cwd: path.dirname(selectedRuntimeBinaryPath),
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: profile,
      },
      runtimeSource: "downloaded-runtime",
      installDir: path.dirname(selectedRuntimeBinaryPath),
      version: selectedRuntime.version,
    };
  }

  const manifestEntry = manifest ? resolveManifestEntry(manifest, profile) : null;
  const binaryPath = resolvePackagedMiniBackendBinary(manifestEntry?.entry);
  patchMiniBackendRuntimeState({
    requestedProfile: profile,
    activeProfile: manifestEntry?.profile ?? "cpu",
    source: "bundled-core",
    runtimeManifestUrl: resolveMiniBackendRuntimeManifestUrl(),
    runtimeArchiveUrl: null,
    installDir: path.dirname(binaryPath),
    version: app.getVersion(),
    lastError: miniBackendRuntimeState.lastError,
    status:
      miniBackendRuntimeState.lastError || (manifestEntry?.profile ?? "cpu") !== profile
        ? "fallback"
        : "ready",
    statusMessage:
      miniBackendRuntimeState.lastError || (manifestEntry?.profile ?? "cpu") !== profile
        ? "Running with embedded fallback runtime."
        : "Embedded runtime ready.",
    attempt: 0,
    maxAttempts: 0,
    progress: null,
  });
    return {
      command: binaryPath,
      args: [],
      cwd: path.dirname(binaryPath),
      env: {
        MINI_BACKEND_ACCELERATION_PROFILE: manifestEntry?.env.MINI_BACKEND_ACCELERATION_PROFILE ?? profile,
        ...manifestEntry?.env,
      },
      runtimeSource: "bundled-core",
      installDir: path.dirname(binaryPath),
      version: app.getVersion(),
    };
  };

const getRandomLocalPort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = nodeNet.createServer();
    server.once("error", (error) => {
      reject(error);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate random local port")));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });

const waitForMiniBackend = async (
  baseUrl: string,
  {
    attempts = 20,
    delayMs = 500,
  }: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // backend still booting
    }

    await sleep(delayMs);
  }

  return false;
};

const syncMiniBackendRuntimeStateFromApi = async (): Promise<void> => {
  if (!localApiUrl || !localApiSessionSecret) {
    return;
  }

  try {
    const response = await fetch(`${localApiUrl}/device/info`, {
      method: "GET",
      headers: {
        [LOCAL_API_SESSION_HEADER]: localApiSessionSecret,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as MiniBackendDeviceInfoPayload;
    const requestedProfileOverride = normalizeAccelerationProfileOverride(payload.profile);
    const requestedProfile = requestedProfileOverride === "auto"
      ? miniBackendRuntimeState.requestedProfile
      : (requestedProfileOverride as MiniBackendAccelerationProfile);
    const activeProfileOverride = normalizeAccelerationProfileOverride(payload.active_profile);
    const activeProfile = activeProfileOverride !== "auto"
      ? (activeProfileOverride as MiniBackendAccelerationProfile)
      : resolveEffectiveAccelerationProfile({
        requestedProfile,
        provider: payload.provider,
      });
    const fallbackReason = formatRuntimeFallbackReason(payload.fallback_reason);

    patchMiniBackendRuntimeState({
      requestedProfile,
      activeProfile,
      lastError: fallbackReason,
      gpuName: typeof payload.name === "string" && payload.name.trim().length > 0 ? payload.name : null,
      vramGb: typeof payload.vram_gb === "number" && payload.vram_gb > 0 ? payload.vram_gb : null,
      status: fallbackReason ? "fallback" : "ready",
      statusMessage: fallbackReason,
    });
  } catch {
    // Best-effort sync only.
  }
};

const waitForMiniBackendProcessExit = async (
  exitPromise: Promise<void> | null,
  timeoutMs: number,
): Promise<boolean> => {
  if (!exitPromise) {
    return true;
  }

  try {
    return await Promise.race([
      exitPromise.then(() => true),
      sleep(timeoutMs).then(() => false),
    ]);
  } catch {
    return false;
  }
};

const normalizeRuntimeArtifactsBaseUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const resolveMiniBackendRuntimeManifestUrl = (): string | null => {
  const configuredUrl = normalizeRuntimeArtifactsBaseUrl(miniBackendArtifactsUrl);
  if (!configuredUrl) {
    return null;
  }

  if (configuredUrl.toLowerCase().endsWith(".json")) {
    return configuredUrl;
  }

  if (configuredUrl.toLowerCase().includes("/mini-backend-artifacts/")) {
    return `${configuredUrl}latest.json`;
  }

  return `${configuredUrl}mini-backend-artifacts/latest.json`;
};

const resolveMiniBackendRuntimeUrl = (manifestUrl: string, relativeUrl: string): string => {
  return new URL(relativeUrl, manifestUrl).toString();
};

const computeSha512Base64ForFile = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const readMiniBackendRuntimeManifest = async (
  { silent = false }: { silent?: boolean } = {},
): Promise<MiniBackendRuntimeArtifactManifest | null> => {
  const manifestUrl = resolveMiniBackendRuntimeManifestUrl();
  if (!manifestUrl) {
    return null;
  }

  try {
    if (!silent) {
      patchMiniBackendRuntimeState({
        status: "checking",
        statusMessage: "Checking runtime artifact manifest.",
        runtimeManifestUrl: manifestUrl,
      });
    }
    const response = await runWithRetry({
      retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
      isRetryable: isRetryableRuntimeDownloadError,
      onRetry: ({ attempt, delayMs, error }) => {
        if (!silent) {
          patchMiniBackendRuntimeState({
            status: "checking",
            statusMessage: `Retrying runtime manifest request (${attempt + 1}/${RUNTIME_DOWNLOAD_RETRY_COUNT + 1}) in ${Math.max(1, Math.ceil(delayMs / 1000))}s.`,
            lastError: error instanceof Error ? error.message : String(error),
            attempt: Math.min(RUNTIME_DOWNLOAD_RETRY_COUNT + 1, attempt + 1),
            maxAttempts: RUNTIME_DOWNLOAD_RETRY_COUNT + 1,
          });
        }
      },
      operation: () => fetch(manifestUrl, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid runtime manifest payload");
    }

    return payload as MiniBackendRuntimeArtifactManifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!silent) {
      patchMiniBackendRuntimeState({
        status: "checking",
        statusMessage: "Checking runtime artifact manifest.",
        runtimeManifestUrl: manifestUrl,
        lastError: `Failed to read runtime manifest: ${message}`,
      });
    }
    return null;
  }
};

const getMiniBackendRuntimeInstallDir = (
  version: string,
  profile: MiniBackendAccelerationProfile,
): string =>
  path.join(
    app.getPath("userData"),
    "mini-backend-runtimes",
    version,
    sanitizeMiniBackendProfile(profile),
  );

const isMiniBackendRuntimeInstalled = (
  version: string,
  profile: MiniBackendAccelerationProfile,
  entry: string,
): boolean => fs.existsSync(path.join(getMiniBackendRuntimeInstallDir(version, profile), entry));

const listMiniBackendRuntimeArtifacts = async (): Promise<MiniBackendRuntimeArtifactOption[]> => {
  const manifest = await readMiniBackendRuntimeManifest({ silent: true });
  if (!manifest) {
    return [];
  }

  const recommendedProfile = await resolveMiniBackendAccelerationProfile({ silent: true, ignoreManualSelection: true });
  const installedProfiles = Object.values(manifest.profiles)
    .filter((entry): entry is MiniBackendRuntimeArtifactRecord => Boolean(entry))
    .flatMap((entry) => (
      isMiniBackendRuntimeInstalled(manifest.version, entry.profile, entry.entry)
        ? [entry.profile]
        : []
    ));

  return listMiniBackendRuntimeArtifactOptions({
    manifest,
    recommendedProfile,
    installedProfiles,
  });
};

const downloadRuntimeArtifactToDisk = async (
  profile: MiniBackendAccelerationProfile,
  record: MiniBackendRuntimeArtifactRecord,
  downloadUrl: string,
  outputPath: string,
): Promise<void> => {
  const maxAttempts = RUNTIME_DOWNLOAD_RETRY_COUNT + 1;
  let currentAttempt = 0;

  await runWithRetry({
    retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
    isRetryable: isRetryableRuntimeDownloadError,
    onRetry: ({ attempt, delayMs, error }) => {
      const nextAttempt = Math.min(maxAttempts, attempt + 1);
      patchMiniBackendRuntimeState({
        status: "downloading",
        statusMessage: `Retrying ${profile} runtime download (${nextAttempt}/${maxAttempts}) in ${Math.max(1, Math.ceil(delayMs / 1000))}s.`,
        lastError: error instanceof Error ? error.message : String(error),
        attempt: nextAttempt,
        maxAttempts,
      });
    },
    operation: async () => {
      currentAttempt += 1;
      patchMiniBackendRuntimeState({
        status: "downloading",
        statusMessage:
          (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0)
            ? `Resuming ${profile} runtime download (${currentAttempt}/${maxAttempts}).`
            : `Downloading ${profile} runtime (${currentAttempt}/${maxAttempts}).`,
        lastError: null,
        attempt: currentAttempt,
        maxAttempts,
        progress: {
          transferredBytes: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
          totalBytes: Math.max(0, record.size),
          percent: record.size > 0 && fs.existsSync(outputPath)
            ? Math.max(0, Math.min(100, (fs.statSync(outputPath).size / record.size) * 100))
            : 0,
          speedBytesPerSecond: 0,
        },
      });

      await downloadUrlToFileWithResume(downloadUrl, outputPath, {
        expectedTotalBytes: record.size,
        fetchImpl: (url, init) => fetch(url, {
          ...init,
          signal: AbortSignal.timeout(resolveRuntimeTransferTimeoutMs(record.size)),
        }),
        onProgress: (progress) => {
          patchMiniBackendRuntimeState({
            status: "downloading",
            progress,
            attempt: currentAttempt,
            maxAttempts,
            lastError: null,
          });
        },
      });
    },
  });
};

const extractRuntimeArchive = async (archivePath: string, destinationDir: string): Promise<void> => {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(destinationDir, { recursive: true });

  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Expand-Archive",
        "-LiteralPath",
        archivePath,
        "-DestinationPath",
        destinationDir,
        "-Force",
      ],
      {
        stdio: "ignore",
        windowsHide: true,
        timeout: RUNTIME_ARCHIVE_EXTRACT_TIMEOUT_MS,
      },
    );
    return;
  }

  throw new Error("Runtime archive extraction is currently supported only on Windows builds.");
};

const ensureMiniBackendDownloadedRuntime = async (
  profile: MiniBackendAccelerationProfile,
  { allowCpuDownload = false }: { allowCpuDownload?: boolean } = {},
): Promise<{
  binaryPath: string;
  installDir: string;
  version: string;
  archiveUrl: string;
} | null> => {
  if (isDev || (profile === "cpu" && !allowCpuDownload)) {
    return null;
  }

  const manifest = await readMiniBackendRuntimeManifest();
  const manifestUrl = resolveMiniBackendRuntimeManifestUrl();
  if (!manifest || !manifestUrl) {
    return null;
  }

  const record = manifest.profiles?.[profile] as MiniBackendRuntimeArtifactRecord | undefined;
  if (!record) {
    patchMiniBackendRuntimeState({
      status: "fallback",
      statusMessage: `Runtime profile not available in manifest: ${profile}`,
      runtimeManifestUrl: manifestUrl,
      lastError: `Runtime profile not available in manifest: ${profile}`,
    });
    return null;
  }

  const installDir = getMiniBackendRuntimeInstallDir(manifest.version, profile);
  const binaryPath = path.join(installDir, record.entry);
  const archiveUrl = resolveMiniBackendRuntimeUrl(manifestUrl, record.url);
  if (fs.existsSync(binaryPath)) {
    patchMiniBackendRuntimeState({
      requestedProfile: profile,
      activeProfile: profile,
      source: "downloaded-runtime",
      runtimeManifestUrl: manifestUrl,
      runtimeArchiveUrl: archiveUrl,
      installDir,
      version: manifest.version,
      lastError: null,
      status: "ready",
      statusMessage: `${profile} runtime ready.`,
      attempt: 0,
      maxAttempts: 0,
      progress: null,
    });
    return {
      binaryPath,
      installDir,
      version: manifest.version,
      archiveUrl,
    };
  }

  const tempDir = path.join(app.getPath("temp"), "koma-runtime-downloads");
  const tempZipPath = path.join(tempDir, record.fileName);
  const tempExtractDir = `${installDir}.tmp`;

  try {
    ensureMiniBackendRuntimeDiskSpace(tempZipPath, installDir, record.size);
    await downloadRuntimeArtifactToDisk(profile, record, archiveUrl, tempZipPath);
    patchMiniBackendRuntimeState({
      status: "verifying",
      statusMessage: `Verifying ${profile} runtime archive.`,
    });
    const currentSha512 = await computeSha512Base64ForFile(tempZipPath);
    if (currentSha512 !== record.sha512) {
      throw new Error("Runtime archive sha512 mismatch.");
    }

    patchMiniBackendRuntimeState({
      status: "extracting",
      statusMessage: `Installing ${profile} runtime.`,
    });
    await extractRuntimeArchive(tempZipPath, tempExtractDir);
    fs.rmSync(installDir, { recursive: true, force: true });
    fs.renameSync(tempExtractDir, installDir);

    patchMiniBackendRuntimeState({
      requestedProfile: profile,
      activeProfile: profile,
      source: "downloaded-runtime",
      runtimeManifestUrl: manifestUrl,
      runtimeArchiveUrl: archiveUrl,
      installDir,
      version: manifest.version,
      lastError: null,
      status: "ready",
      statusMessage: `${profile} runtime installed successfully.`,
      progress: null,
      attempt: 0,
      maxAttempts: 0,
    });
    return {
      binaryPath,
      installDir,
      version: manifest.version,
      archiveUrl,
    };
  } catch (error) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    patchMiniBackendRuntimeState({
      requestedProfile: profile,
      activeProfile: "cpu",
      source: "bundled-core",
      runtimeManifestUrl: manifestUrl,
      runtimeArchiveUrl: archiveUrl,
      installDir: null,
      version: manifest.version,
      lastError: message,
      status: "fallback",
      statusMessage: `Failed to install ${profile} runtime. Falling back to the embedded runtime.`,
      progress: null,
    });
    console.warn(`[mini-backend-runtime] ${message}`);
    return null;
  } finally {
    if (fs.existsSync(binaryPath)) {
      fs.rmSync(tempZipPath, { force: true });
    }
  }
};

const forceStopMiniBackendProcess = (processRef: ChildProcess | null): void => {
  if (!processRef || processRef.killed) {
    return;
  }

  const pid = processRef.pid;
  if (process.platform === "win32" && typeof pid === "number" && Number.isInteger(pid) && pid > 0) {
    try {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        timeout: 3_000,
      });
      return;
    } catch {
      // Fall back to generic kill below.
    }
  }

  try {
    processRef.kill("SIGKILL");
  } catch {
    // Ignore process termination race conditions.
  }
};

const startMiniBackend = async (): Promise<void> => {
  await prepareMiniBackendLaunchContext();
  const commandSpec = await getMiniBackendCommand();
  const { command, args, cwd } = commandSpec;
  ensureMiniBackendDevDependencies(commandSpec);
  const miniBackendPort = preparedMiniBackendPort ?? (await getRandomLocalPort());
  const desktopModelsRootDir = path.join(app.getPath("userData"), "models");
  const appResourcesDir = path.join(process.resourcesPath, "resources");
  const referenceImagesDir = path.join(appResourcesDir, "reference_images");
  fs.mkdirSync(desktopModelsRootDir, { recursive: true });

  patchMiniBackendRuntimeState({
    requestedProfile: commandSpec.env?.MINI_BACKEND_ACCELERATION_PROFILE
      ? (commandSpec.env.MINI_BACKEND_ACCELERATION_PROFILE as MiniBackendAccelerationProfile)
      : miniBackendRuntimeState.requestedProfile,
    activeProfile: commandSpec.env?.MINI_BACKEND_ACCELERATION_PROFILE
      ? (commandSpec.env.MINI_BACKEND_ACCELERATION_PROFILE as MiniBackendAccelerationProfile)
      : miniBackendRuntimeState.activeProfile,
    source: commandSpec.runtimeSource ?? miniBackendRuntimeState.source,
    installDir: commandSpec.installDir ?? miniBackendRuntimeState.installDir,
    version: commandSpec.version ?? miniBackendRuntimeState.version,
    downloadCacheDir: path.join(app.getPath("temp"), "koma-runtime-downloads"),
    status: "checking",
    statusMessage: commandSpec.runtimeSource === "downloaded-runtime"
      ? "Starting downloaded runtime."
      : "Starting local runtime.",
    lastError: null,
    progress: null,
  });

  miniBackendProcess = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...commandSpec.env,
      NODE_ENV: isDev ? "development" : "production",
      PORT: String(miniBackendPort),
      KOMA_MODELS_ROOT: desktopModelsRootDir,
      KOMA_LOCAL_API_SESSION_SECRET: localApiSessionSecret,
      KOMA_APP_RESOURCES_DIR: appResourcesDir,
      KOMA_REFERENCE_IMAGES_DIR: referenceImagesDir,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });
  miniBackendProcessForExitCleanup = miniBackendProcess;

  const shouldIgnoreMiniBackendProgressNoise = (rawText: string): boolean => {
    const text = rawText.trim();
    if (!text) {
      return true;
    }
    return (
      /Progress:\s*\|/i.test(text) ||
      /onnxruntime is not built with CUDA 12\.x support/i.test(text)
    );
  };

  const decodeMiniBackendChunk = (chunk: Buffer): string => {
    const utf8 = chunk.toString("utf8");
    if (!utf8.includes("\uFFFD")) {
      return utf8;
    }

    // Some Windows-native provider stacks emit non-UTF8 bytes on stderr.
    // Prefer a permissive decode so diagnostics keep flowing instead of
    // polluting the app with unreadable chunks.
    return chunk.toString("latin1");
  };

  const syncMiniBackendRuntimeStateFromLog = (rawText: string): void => {
    const text = rawText.trim();
    if (!text) {
      return;
    }

    const warmupFallbackReason = formatRuntimeFallbackReason("runtime_warmup_fallback_to_cpu");

    // These must stay in sync with the English log markers emitted by
    // packages/mini-backend/app.py (guarded by
    // ../tests/mini-backend-fallback-markers.test.ts).
    if (text.includes("Falling back to CPU automatically")) {
      patchMiniBackendRuntimeState({
        activeProfile: "cpu",
        lastError: warmupFallbackReason,
        status: "fallback",
        statusMessage: warmupFallbackReason,
      });
      return;
    }

    if (text.includes("Detector warmup successfully redone on CPU")) {
      patchMiniBackendRuntimeState({
        activeProfile: "cpu",
        lastError: warmupFallbackReason,
        status: "fallback",
        statusMessage: warmupFallbackReason,
      });
    }
  };

  miniBackendProcess.stdout?.on("data", (chunk: Buffer) => {
    const text = decodeMiniBackendChunk(chunk);
    if (shouldIgnoreMiniBackendProgressNoise(text)) {
      return;
    }
    pushMiniBackendRuntimeLog("stdout", text);
    syncMiniBackendRuntimeStateFromLog(text);
    console.log(`[mini-backend] ${text.trim()}`);
  });

  miniBackendProcess.stderr?.on("data", (chunk: Buffer) => {
    const text = decodeMiniBackendChunk(chunk);
    if (shouldIgnoreMiniBackendProgressNoise(text)) {
      return;
    }
    pushMiniBackendRuntimeLog("stderr", text);
    syncMiniBackendRuntimeStateFromLog(text);
    console.error(`[mini-backend:err] ${text.trim()}`);
  });

  const currentProcess = miniBackendProcess;
  const currentExitPromise = new Promise<void>((resolve) => {
    currentProcess.once("exit", () => {
      resolve();
    });
  });
  miniBackendExitPromise = currentExitPromise;
  miniBackendProcess.on("exit", (code) => {
    console.log(`[mini-backend] exited with code ${code ?? "unknown"}`);
    if (miniBackendProcess === currentProcess) {
      miniBackendProcess = null;
    }
    if (miniBackendProcessForExitCleanup === currentProcess) {
      miniBackendProcessForExitCleanup = null;
    }
    if (miniBackendExitPromise === currentExitPromise) {
      miniBackendExitPromise = null;
    }
  });

  const startupPolicy = resolveMiniBackendStartupPolicy({
    isDev,
    source: commandSpec.runtimeSource ?? "bundled-core",
  });
  const healthy = await waitForMiniBackend(localApiUrl, startupPolicy.initial);
  if (!healthy) {
    patchMiniBackendRuntimeState({
      status: "error",
      statusMessage: "Mini backend did not become healthy in time.",
      lastError: "mini_backend_health_timeout",
    });
    console.warn("Mini backend did not report healthy state in time");
    return;
  }
  await syncMiniBackendRuntimeStateFromApi();
};

const setupDesktopExternalIpcHandlers = (): void => {
  registerSecureIpcHandler<{
    appLocale: string;
    systemLocales: string[];
  }>("desktop:locale:get-preferences", async () => {
    const appLocale = typeof app.getLocale === "function" ? app.getLocale() : "pt-BR";
    const systemLocales =
      typeof app.getPreferredSystemLanguages === "function"
        ? app.getPreferredSystemLanguages()
        : [appLocale];

    return {
      appLocale,
      systemLocales,
    };
  });

  registerSecureIpcHandler<void>("desktop:open-external", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const targetUrl = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!targetUrl) {
      throw new Error("URL externa ausente.");
    }
    if (!isAllowedExternalUrl(targetUrl)) {
      throw new Error("External URL not allowed.");
    }

    await shell.openExternal(targetUrl);
  });

  registerSecureIpcHandler<void>("desktop:open-community-link", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const targetUrl = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!targetUrl) {
      throw new Error("URL comunitaria ausente.");
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new Error("URL comunitaria invalida.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("Apenas links HTTPS sao permitidos.");
    }

    await shell.openExternal(parsed.toString());
  });
};
registerSecureIpcHandler<{
  cleared: true;
  userDataPath: string;
  clearedPaths: string[];
}>("desktop:reset-local-settings", async () => resetDesktopLocalSettings());

registerSecureIpcHandler<{ restarting: true }>("desktop:restart-app", async () => {
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 0);

  return { restarting: true };
});

const setupDesktopClientHeaderInjection = (window: BrowserWindow): void => {
  let authOrigin = "";
  let localOrigin = "";
  try {
    authOrigin = new URL(authApiUrl).origin;
    localOrigin = new URL(localApiUrl).origin;
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
        const targetsLocalBackend = targetUrl.origin === localOrigin;
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
            desktopSessionState.token &&
            desktopSessionState.expiresAtMs - nowMs <= desktopClientTokenRefreshSkewSec * 1_000
          ) {
            void refreshDesktopSessionToken("on-demand");
          }

          if (desktopSessionState.token) {
            details.requestHeaders[DESKTOP_CLIENT_TOKEN_HEADER] = desktopSessionState.token;
            details.requestHeaders[DESKTOP_SESSION_ID_HEADER] = desktopSessionState.sessionId;
            details.requestHeaders[DESKTOP_DEVICE_ID_HEADER] = desktopSessionState.deviceId;
          }
          details.requestHeaders[DESKTOP_APP_VERSION_HEADER] = app.getVersion();
          details.requestHeaders[DESKTOP_UPDATE_CHANNEL_HEADER] = getDesktopUpdateChannel();

        }

        if (!isPreflightRequest && localApiSessionSecret && targetsLocalBackend) {
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

const isAllowedExternalUrl = (rawUrl: string): boolean => {
  try {
    hydrateAllowedExternalHosts();
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (externalAllowedHosts.has(host)) {
      return true;
    }

    return EXTERNAL_ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
};
const pushMiniBackendRuntimeLog = (stream: "stdout" | "stderr", chunkText: string): void => {
  const lines = chunkText
    .replace(/\r/g, "\n")
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 120);

  if (lines.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  for (const line of lines) {
    miniBackendRuntimeLogBuffer.push({
      timestamp,
      stream,
      message: line.slice(0, 2_000),
    });
  }

  if (miniBackendRuntimeLogBuffer.length > MINI_BACKEND_RUNTIME_LOG_LIMIT) {
    miniBackendRuntimeLogBuffer = miniBackendRuntimeLogBuffer.slice(
      miniBackendRuntimeLogBuffer.length - MINI_BACKEND_RUNTIME_LOG_LIMIT,
    );
  }
};

const setupNavigationHardening = (window: BrowserWindow): void => {
  const internalOrigin = getDevServerOrigin();

  const isInternalUrl = (targetUrl: string): boolean => {
    if (!internalOrigin) {
      return isInternalAppUrl(targetUrl);
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
    if (isAllowedExternalUrl(targetUrl)) {
      void shell.openExternal(targetUrl);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
};

const createWindow = async (): Promise<void> => {
  await prepareMiniBackendLaunchContext();
  if (!isAuthDisabled && (await hasDesktopAuthCookie())) {
    try {
      await registerDesktopDeviceKey("startup");
      await ensureDesktopSessionToken("startup");
    } catch (error) {
      if (
        isDesktopStructuredError(error) &&
        (error.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" || error.code === "DESKTOP_TRAVEL_TOKEN_INVALID")
      ) {
        await clearDesktopAuthCookies();
        clearDesktopSessionState(true);
      }
      debugDesktopWarn(
        `[desktop-auth] initial bootstrap failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: "KŌMA Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: areDevToolsEnabled,
    },
  });

  attachRendererDiagnostics(mainWindow);

  // Recover from renderer crashes (often a follow-on from a GPU crash).
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    console.error(`[Renderer] process gone (${details.reason}, exit ${details.exitCode}) – reloading`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const target = process.env.VITE_DEV_SERVER_URL ?? INTERNAL_APP_ENTRY_URL;
        void mainWindow.loadURL(target);
      }
    }, 500);
  });

  setupDesktopClientHeaderInjection(mainWindow);
  setupNavigationHardening(mainWindow);
  updaterService = UpdaterService.getInstance(resolveDesktopEnvValue);
  try {
    updaterService.initialize(mainWindow);
  } catch (error) {
    console.warn(
      `[updater] initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (areDevToolsEnabled) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    await mainWindow.loadURL(INTERNAL_APP_ENTRY_URL);
    mainWindow.setMenu(null);
    if (isProdDebugEnabled) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  }

  void startMiniBackend().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    patchMiniBackendRuntimeState({
      status: "error",
      statusMessage: "Mini backend failed to start.",
      lastError: message,
      progress: null,
    });
    console.error(`[mini-backend] startup failed: ${message}`);
  });

  if (!isDev && !isProdDebugEnabled) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      const shortcutAction = resolveDesktopShortcutAction(input);
      if (shortcutAction) {
        event.preventDefault();
        mainWindow?.webContents.send(DESKTOP_SHORTCUT_ACTION_CHANNEL, { actionId: shortcutAction });
        return;
      }

      const isF12 = input.key.toLowerCase() === "f12";
      const isCtrlShiftInspector =
        input.control &&
        input.shift &&
        (input.key.toLowerCase() === "i" || input.key.toLowerCase() === "j" || input.key.toLowerCase() === "c");
      if (isF12 || isCtrlShiftInspector) {
        event.preventDefault();
      }
    });
  }

  if (pendingDeepLink) {
    navigateMainWindowFromDeepLink(pendingDeepLink);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (!pendingDeepLink) {
      return;
    }
    navigateMainWindowFromDeepLink(pendingDeepLink);
    pendingDeepLink = null;
  });

  setTimeout(() => {
    void discordRPC.connectWithRetry();
  }, 2_000);
};

const stopMiniBackend = async (): Promise<void> => {
  if (miniBackendShutdownPromise) {
    await miniBackendShutdownPromise;
    return;
  }

  const processRef = miniBackendProcess;
  const exitPromise = miniBackendExitPromise;
  miniBackendProcess = null;
  miniBackendExitPromise = null;

  if (!processRef || processRef.killed) {
    return;
  }

  miniBackendShutdownPromise = (async () => {
    try {
      processRef.kill("SIGTERM");
    } catch {
      // Ignore process termination race conditions.
    }

    const exitedGracefully = await waitForMiniBackendProcessExit(exitPromise, 2_500);
    if (exitedGracefully) {
      return;
    }

    forceStopMiniBackendProcess(processRef);
    await waitForMiniBackendProcessExit(exitPromise, 2_000);
  })();

  try {
    await miniBackendShutdownPromise;
  } finally {
    miniBackendShutdownPromise = null;
  }
};

const gotTheLock = app.requestSingleInstanceLock();

// Module-based IPC handler registration
setupDiscordIpcHandlers();
setupDesktopExternalIpcHandlers();
setupDesktopWorkspaceIpcHandlers({ getMainWindow: () => mainWindow });
setupDesktopModelIpcHandlers({
  getMainWindow: () => mainWindow,
  getLocalApiUrl: () => localApiUrl,
  getLocalApiSessionSecret: () => localApiSessionSecret,
});
setupDesktopFontIpcHandlers();
setupDesktopLlmProfilesIpcHandlers();
setupDesktopBloggerIpcHandlers();
setupDesktopImgurIpcHandlers();
setupDesktopDiscordWebhookIpcHandlers();
setupDesktopBugReportIpcHandlers({
  getMainWindow: () => mainWindow,
  resolveDesktopEnvValue,
  getDesktopUpdateChannel,
  miniBackendRuntimeLogBuffer: miniBackendRuntimeLogBuffer,
  miniBackendProcessRef: () => miniBackendProcess,
  authApiUrl,
  localApiUrl,
});
setupDesktopAuthIpcHandlers();
setupDesktopSessionLogIpcHandler({ recordSessionLog });
ipcMain.on("desktop:get-runtime-config", (event) => {
  assertTrustedIpcSender(event, "desktop:get-runtime-config");
  event.returnValue = getDesktopRuntimeConfig();
});
ipcMain.handle("desktop:get-mini-backend-runtime-state", async (event) => {
  assertTrustedIpcSender(event, "desktop:get-mini-backend-runtime-state");
  return getMiniBackendRuntimeStateSnapshot();
});
ipcMain.handle("desktop:list-mini-backend-runtime-artifacts", async (event) => {
  assertTrustedIpcSender(event, "desktop:list-mini-backend-runtime-artifacts");
  return listMiniBackendRuntimeArtifacts();
});
ipcMain.handle("desktop:install-recommended-mini-backend-runtime", async (event) => {
  assertTrustedIpcSender(event, "desktop:install-recommended-mini-backend-runtime");
  return installRecommendedMiniBackendRuntime();
});
ipcMain.handle("desktop:install-mini-backend-runtime-profile", async (event, payload) => {
  assertTrustedIpcSender(event, "desktop:install-mini-backend-runtime-profile");
  const profile = payload && typeof payload === "object" && typeof (payload as { profile?: unknown }).profile === "string"
    ? (payload as { profile: string }).profile
    : "";
  return installMiniBackendRuntimeProfile(profile);
});
ipcMain.handle("desktop:check-local-backend", async (event) => {
  assertTrustedIpcSender(event, "desktop:check-local-backend");
  try {
    const response = await fetchWithTimeoutAndRetry(
      (signal) =>
        fetch(`${localApiUrl}/health`, {
          method: "GET",
          signal,
        }),
      { method: "GET" },
      {
        timeoutMs: DESKTOP_FETCH_TIMEOUT_MS,
        retryCount: DESKTOP_FETCH_RETRY_COUNT,
      },
    );
    return response.ok;
  } catch {
    return false;
  }
});
ipcMain.handle("desktop:restart-local-backend", async (event) => {
  assertTrustedIpcSender(event, "desktop:restart-local-backend");
  try {
    await stopMiniBackend();
    await startMiniBackend();
    return true;
  } catch (error) {
    console.error(
      `[mini-backend] restart failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
});

process.once("exit", () => {
  forceStopMiniBackendProcess(miniBackendProcessForExitCleanup);
  miniBackendProcessForExitCleanup = null;
  miniBackendProcess = null;
  miniBackendExitPromise = null;
});

if (process.platform === "win32") {
  // Dev/portable registration so browser links can reopen/focus the app.
  if (isDev) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? "")]);
  } else {
    app.setAsDefaultProtocolClient(APP_PROTOCOL);
  }
}

const initialDeepLink = extractDeepLinkFromArgv(process.argv);
if (initialDeepLink) {
  pendingDeepLink = initialDeepLink;
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = extractDeepLinkFromArgv(argv);
    if (deepLink) {
      pendingDeepLink = deepLink;
    }

    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();

    if (pendingDeepLink) {
      navigateMainWindowFromDeepLink(pendingDeepLink);
    }
  });

  app.on("open-url", (event, urlValue) => {
    event.preventDefault();
    pendingDeepLink = urlValue;
    if (mainWindow) {
      navigateMainWindowFromDeepLink(urlValue);
      pendingDeepLink = null;
    }
  });

  app.whenReady().then(async () => {
    // Strip Electron and App specific strings from user agent to bypass Turnstile bot detection
    app.userAgentFallback = app.userAgentFallback.replace(/Electron\/\S+\s?/, "").replace(/koma-studio\/\S+\s?/, "").replace(/ScanlatorPro\/\S+\s?/, "").trim();

    if (desktopDebugLogsEnabled) {
      initializeAppSessionLog();
    }
    enforcePackagedRuntimeIntegrity();
    setupInternalAppProtocol();
    setupPermissionHardening(electronSession.defaultSession);
    setupCertificatePinning(electronSession.defaultSession);
    await createWindow();
  });
}

// When the GPU process crashes (Skia OOM, driver fault, etc.) Chromium automatically
// restarts it.  Give it 1.5 s to recover then reload the window so the user sees
// a working UI instead of a frozen white/black frame.
let gpuCrashReloadScheduled = false;
// @ts-ignore – gpu-process-crashed is valid at runtime but absent from Electron's strict TS overloads
app.on("gpu-process-crashed", (_event, killed) => {
  console.error(`[GPU] process ${killed ? "killed" : "crashed"} – scheduling window reload`);
  if (gpuCrashReloadScheduled) return;
  gpuCrashReloadScheduled = true;
  setTimeout(() => {
    gpuCrashReloadScheduled = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  }, 1500);
});

app.on("window-all-closed", () => {
  void discordRPC.disconnect();
  clearDesktopTokenRefreshTimeout();
  void stopMiniBackend().finally(() => {
    app.quit();
  });
});

app.on("before-quit", (event) => {
  void discordRPC.disconnect();
  clearDesktopTokenRefreshTimeout();
  if (miniBackendProcess && !miniBackendProcess.killed) {
    event.preventDefault();
    void stopMiniBackend().finally(() => {
      app.quit();
    });
  }
});

app.on("will-quit", () => {
  updaterService?.cleanup();
});
