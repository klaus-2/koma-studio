import { app, net as electronNet } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import {
  registerSecureIpcHandler,
  fetchWithTimeoutAndRetry,
  parseDesktopApiError,
} from "./shared.ts";
import {
  BUG_REPORT_DESCRIPTION_MAX_LENGTH,
  BUG_REPORT_TITLE_MAX_LENGTH,
  buildBugReportPayload,
  enforceBugReportWireBudget,
  serializeBugReportPayload,
  validateBugReportEndpointUrl,
  type BugReportAttachmentEntry,
  type BugReportClientMetadata,
  type BugReportLogEntry,
} from "./bug-report-payload.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BugReportLogSource = "app" | "user" | "runtime";

interface BugReportAutoLogEntry {
  id: string;
  name: string;
  size: number;
  source: BugReportLogSource;
}

interface BugReportResolvedLogEntry extends BugReportAutoLogEntry {
  path: string | null;
  modifiedAtMs: number;
  runtimeContent?: string;
}

interface BugReportAttachmentBuffer {
  fileName: string;
  mimeType: string;
  source: "auto-log" | "manual";
  data: Buffer;
}

interface BugReportPrepareResponse {
  screenshotDataUrl: string | null;
  autoLogs: BugReportAutoLogEntry[];
  diagnostics: Record<string, unknown>;
  ready: boolean;
}

interface BugReportSubmitResponse {
  ok: boolean;
  status: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUG_REPORT_ALLOWED_LOG_EXTENSIONS = new Set([".log", ".txt", ".json", ".ndjson", ".jsonl"]);
const BUG_REPORT_MAX_AUTO_LOG_FILES = 24;
const BUG_REPORT_MAX_AUTO_LOG_FILE_BYTES = 1_500_000;
const BUG_REPORT_MAX_MANUAL_ATTACHMENTS = 4;
const BUG_REPORT_MAX_MANUAL_FILE_BYTES = 5 * 1024 * 1024;
const BUG_REPORT_MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024;
const BUG_REPORT_SUBMIT_TIMEOUT_MS = 60_000;
const MINI_BACKEND_RUNTIME_LOG_LIMIT = 600;
const APP_SESSION_LOG_FILE_NAME = "desktop-session.log";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let cachedBugReportLogEntries: BugReportResolvedLogEntry[] = [];
const BUG_REPORT_SESSION_ID = randomUUID();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createBugReportLogId = (source: BugReportLogSource, key: string): string =>
  createHash("sha1").update(`${source}:${key}`).digest("hex").slice(0, 16);

const toPosixPath = (value: string): string => value.replace(/\\/g, "/");

const sanitizeBugReportText = (value: unknown, maxLength: number): string => {
  const raw = typeof value === "string" ? value : String(value ?? "");
  // oxlint-disable-next-line no-control-regex -- strip NUL bytes from the report before truncating
  return raw.replace(/\u0000/g, "").trim().slice(0, maxLength);
};

const sanitizeBugReportMultilineText = (value: unknown, maxLength: number): string => {
  const raw = typeof value === "string" ? value : String(value ?? "");
  // oxlint-disable-next-line no-control-regex -- strip NUL bytes and CR line breaks from the report
  return raw.replace(/\r/g, "").replace(/\u0000/g, "").trim().slice(0, maxLength);
};

const isBugReportLogFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  if (BUG_REPORT_ALLOWED_LOG_EXTENSIONS.has(ext)) {
    return true;
  }

  return /log/i.test(path.basename(filePath));
};

// ---------------------------------------------------------------------------
// Log collection
// ---------------------------------------------------------------------------

const collectLogFilesFromDirectory = (
  rootDir: string,
  source: BugReportLogSource,
  label: string,
): BugReportResolvedLogEntry[] => {
  const entries: BugReportResolvedLogEntry[] = [];
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return entries;
  }

  let children: fs.Dirent[];
  try {
    children = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return entries;
  }

  for (const child of children) {
    const childPath = path.join(rootDir, child.name);
    try {
      if (!child.isFile() || !isBugReportLogFile(childPath)) {
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(childPath);
      } catch {
        continue;
      }

      if (!Number.isFinite(stat.size) || stat.size <= 0) {
        continue;
      }

      const relative = toPosixPath(path.relative(rootDir, childPath) || child.name);
      entries.push({
        id: createBugReportLogId(source, `${label}:${childPath}`),
        name: `${label}/${relative}`,
        size: stat.size,
        source,
        path: childPath,
        modifiedAtMs: stat.mtimeMs,
      });
    } catch {
      console.warn(`[bug-report] Failed to process log entry: ${childPath}`);
    }
  }

  return entries;
};

interface MiniBackendRuntimeLogEntry {
  timestamp: string;
  stream: string;
  message: string;
}

interface BugReportDeps {
  getMainWindow: () => import("electron").BrowserWindow | null;
  getDesktopUpdateChannel: () => "stable" | "beta";
  miniBackendRuntimeLogBuffer: MiniBackendRuntimeLogEntry[];
  miniBackendProcessRef: () => import("node:child_process").ChildProcess | null;
  authApiUrl: string;
  localApiUrl: string;
}

const buildMiniBackendRuntimeLogEntry = (
  miniBackendRuntimeLogBuffer: MiniBackendRuntimeLogEntry[],
): BugReportResolvedLogEntry | null => {
  if (miniBackendRuntimeLogBuffer.length === 0) {
    return null;
  }

  const runtimeText = miniBackendRuntimeLogBuffer
    .slice(-400)
    .map((entry) => `[${entry.timestamp}] [${entry.stream}] ${entry.message}`)
    .join("\n");

  const size = Buffer.byteLength(runtimeText, "utf8");
  return {
    id: createBugReportLogId("runtime", "mini-backend-runtime"),
    name: "runtime/mini-backend.log",
    size,
    source: "runtime",
    path: null,
    modifiedAtMs: Date.now(),
    runtimeContent: runtimeText,
  };
};

const collectResolvedBugReportLogs = (
  miniBackendRuntimeLogBuffer: MiniBackendRuntimeLogEntry[],
): BugReportResolvedLogEntry[] => {
  const candidateDirs: Array<{ dir: string; source: BugReportLogSource; label: string }> = [
    { dir: app.getPath("logs"), source: "app", label: "app" },
    { dir: path.join(app.getPath("userData"), "logs"), source: "user", label: "user" },
    { dir: path.resolve(process.cwd(), "logs"), source: "app", label: "cwd" },
  ];

  const merged: BugReportResolvedLogEntry[] = [];
  for (const candidate of candidateDirs) {
    merged.push(...collectLogFilesFromDirectory(candidate.dir, candidate.source, candidate.label));
  }

  const runtimeEntry = buildMiniBackendRuntimeLogEntry(miniBackendRuntimeLogBuffer);
  if (runtimeEntry) {
    merged.push(runtimeEntry);
  }

  const dedupedById = new Map<string, BugReportResolvedLogEntry>();
  merged.forEach((entry) => {
    const previous = dedupedById.get(entry.id);
    if (!previous || entry.modifiedAtMs > previous.modifiedAtMs) {
      dedupedById.set(entry.id, entry);
    }
  });

  return Array.from(dedupedById.values())
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs)
    .slice(0, BUG_REPORT_MAX_AUTO_LOG_FILES);
};

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

const buildBugReportDiagnostics = async (deps: BugReportDeps): Promise<Record<string, unknown>> => {
  return {
    timestamp: new Date().toISOString(),
    appVersion: app.getVersion(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    appPackaged: app.isPackaged,
    envMode: process.env.NODE_ENV ?? "unknown",
    updateChannel: deps.getDesktopUpdateChannel(),
    miniBackendRunning: Boolean(deps.miniBackendProcessRef()),
    miniBackendRuntimeLineCount: deps.miniBackendRuntimeLogBuffer.length,
    authApiUrl: deps.authApiUrl,
    localApiUrl: deps.localApiUrl,
  };
};

// ---------------------------------------------------------------------------
// Screenshot
// ---------------------------------------------------------------------------

const captureBugReportScreenshotDataUrl = async (
  getMainWindow: () => import("electron").BrowserWindow | null,
): Promise<string | null> => {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  try {
    const screenshot = await mainWindow.webContents.capturePage();
    const screenshotPng = screenshot.toPNG();
    if (screenshotPng.length <= 0 || screenshotPng.length > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
      return null;
    }

    return `data:image/png;base64,${screenshotPng.toString("base64")}`;
  } catch {
    console.warn("[bug-report] Failed to capture screenshot");
    return null;
  }
};

const decodeBugReportDataUrlImage = (
  rawDataUrl: unknown,
): { mimeType: string; data: Buffer } | null => {
  if (typeof rawDataUrl !== "string") {
    return null;
  }

  const match = rawDataUrl.match(/^data:(image\/(?:png|jpeg));base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64, "base64");
  } catch {
    return null;
  }

  if (decoded.length <= 0 || decoded.length > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
    return null;
  }

  return { mimeType, data: decoded };
};

const resolveBugReportScreenshotPayload = (
  rawDataUrl: unknown,
): { ok: true; dataUrl: string | null } | { ok: false; error: string } => {
  if (typeof rawDataUrl !== "string" || !rawDataUrl) {
    return { ok: true, dataUrl: null };
  }

  if (!decodeBugReportDataUrlImage(rawDataUrl)) {
    return { ok: false, error: "Screenshot is invalid. Capture it again before sending." };
  }

  return { ok: true, dataUrl: rawDataUrl };
};

// ---------------------------------------------------------------------------
// File utilities
// ---------------------------------------------------------------------------

const toSafeBugReportFileName = (value: string, fallback: string): string => {
  const normalized = value
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const candidate = normalized || fallback;
  return candidate.slice(0, 120);
};

const truncateUtf8BufferWithPrefix = (input: Buffer, maxBytes: number): Buffer => {
  if (input.length <= maxBytes) {
    return input;
  }

  const prefix = Buffer.from(
    `[truncated ${input.length - Math.max(0, maxBytes - 64)} bytes]\n`,
    "utf8",
  );
  const remaining = Math.max(0, maxBytes - prefix.length);
  const suffix = input.subarray(input.length - remaining);
  return Buffer.concat([prefix, suffix]);
};

const readAutoLogBuffer = (entry: BugReportResolvedLogEntry): Buffer => {
  if (entry.source === "runtime") {
    const runtimeText = entry.runtimeContent ?? "";
    return truncateUtf8BufferWithPrefix(Buffer.from(runtimeText, "utf8"), BUG_REPORT_MAX_AUTO_LOG_FILE_BYTES);
  }

  if (!entry.path || !fs.existsSync(entry.path)) {
    return Buffer.alloc(0);
  }

  try {
    const raw = fs.readFileSync(entry.path);
    return truncateUtf8BufferWithPrefix(raw, BUG_REPORT_MAX_AUTO_LOG_FILE_BYTES);
  } catch {
    console.warn(`[bug-report] Failed to read log file: ${entry.path}`);
    return Buffer.alloc(0);
  }
};

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

const parseBugReportManualAttachments = (
  rawAttachments: unknown,
): { ok: true; attachments: BugReportAttachmentBuffer[] } | { ok: false; error: string } => {
  if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) {
    return { ok: true, attachments: [] };
  }

  if (rawAttachments.length > BUG_REPORT_MAX_MANUAL_ATTACHMENTS) {
    return {
      ok: false,
      error: `Maximum of ${BUG_REPORT_MAX_MANUAL_ATTACHMENTS} manual attachments per report.`,
    };
  }

  const parsed: BugReportAttachmentBuffer[] = [];
  for (const rawItem of rawAttachments) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return { ok: false, error: "Invalid manual attachment." };
    }

    const item = rawItem as Record<string, unknown>;
    const fileName = toSafeBugReportFileName(
      sanitizeBugReportText(item.name ?? "", 140),
      `attachment-${parsed.length + 1}.txt`,
    );
    const mimeType = sanitizeBugReportText(item.mimeType ?? "", 80).toLowerCase();
    if (!/^(image|text)\//.test(mimeType)) {
      return {
        ok: false,
        error: `Attachment ${fileName} must be an image or text file.`,
      };
    }
    const contentBase64 = typeof item.contentBase64 === "string" ? item.contentBase64.replace(/\s+/g, "") : "";
    if (!contentBase64) {
      return { ok: false, error: `Attachment ${fileName} has no content.` };
    }

    let content: Buffer;
    try {
      content = Buffer.from(contentBase64, "base64");
    } catch {
      return { ok: false, error: `Failed to decode attachment ${fileName}.` };
    }

    if (content.length <= 0 || content.length > BUG_REPORT_MAX_MANUAL_FILE_BYTES) {
      return {
        ok: false,
        error: `Attachment ${fileName} exceeds the ${Math.round(BUG_REPORT_MAX_MANUAL_FILE_BYTES / (1024 * 1024))}MB limit.`,
      };
    }

    parsed.push({
      fileName,
      mimeType,
      source: "manual",
      data: content,
    });
  }

  return { ok: true, attachments: parsed };
};

const isEssentialBugReportLogEntry = (entry: BugReportResolvedLogEntry): boolean =>
  path.basename(entry.name).toLowerCase() === APP_SESSION_LOG_FILE_NAME.toLowerCase();

const resolveSelectedAutoLogEntries = (
  rawIds: unknown,
  miniBackendRuntimeLogBuffer: MiniBackendRuntimeLogEntry[],
): BugReportResolvedLogEntry[] => {
  const sourceLogs = cachedBugReportLogEntries.length > 0
    ? cachedBugReportLogEntries
    : collectResolvedBugReportLogs(miniBackendRuntimeLogBuffer);
  const essentialLogs = sourceLogs.filter((entry) => isEssentialBugReportLogEntry(entry));

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return Array.from(new Map([...sourceLogs, ...essentialLogs].map((entry) => [entry.id, entry])).values());
  }

  const selectedIds = new Set(
    rawIds
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

  if (selectedIds.size === 0) {
    return Array.from(new Map([...sourceLogs, ...essentialLogs].map((entry) => [entry.id, entry])).values());
  }

  return Array.from(
    new Map(
      sourceLogs
        .filter((entry) => selectedIds.has(entry.id) || isEssentialBugReportLogEntry(entry))
        .map((entry) => [entry.id, entry]),
    ).values(),
  );
};

// ---------------------------------------------------------------------------
// Context sanitization
// ---------------------------------------------------------------------------

const sanitizeBugReportContext = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const context = value as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  const allowedKeys = ["mode", "userEmail", "statusMessage", "route"];
  for (const key of allowedKeys) {
    const rawItem = context[key];
    if (typeof rawItem === "string") {
      cleaned[key] = sanitizeBugReportText(rawItem, 200);
    }
  }

  return cleaned;
};

const BUG_REPORT_NARRATIVE_FIELD_MAX_CHARS = 1_024;

const assembleBugReportDescription = (
  base: string,
  context: Record<string, unknown>,
  payload: Record<string, unknown>,
): string => {
  const route = typeof context.route === "string" ? context.route : "";
  const narrative: Array<[string, string]> = [
    ["Route", route],
    ["Steps", sanitizeBugReportMultilineText(payload.stepsToReproduce ?? "", BUG_REPORT_NARRATIVE_FIELD_MAX_CHARS)],
    ["Expected", sanitizeBugReportMultilineText(payload.expectedResult ?? "", BUG_REPORT_NARRATIVE_FIELD_MAX_CHARS)],
    ["Actual", sanitizeBugReportMultilineText(payload.actualResult ?? "", BUG_REPORT_NARRATIVE_FIELD_MAX_CHARS)],
    ["Contact", sanitizeBugReportText(payload.contact ?? "", BUG_REPORT_NARRATIVE_FIELD_MAX_CHARS)],
  ];

  let assembled = base;
  for (const [name, value] of narrative) {
    if (!value) {
      continue;
    }
    assembled += `\n\n${name}:\n${value}`;
  }
  return assembled.slice(0, BUG_REPORT_DESCRIPTION_MAX_LENGTH);
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const buildBugReportClientMetadata = (deps: BugReportDeps): BugReportClientMetadata => ({
  appVersion: app.getVersion().slice(0, 64),
  shell: "electron",
  platform: os.platform().slice(0, 64),
  arch: os.arch().slice(0, 32),
  channel: deps.getDesktopUpdateChannel().slice(0, 64),
  sessionId: BUG_REPORT_SESSION_ID,
});

// ---------------------------------------------------------------------------
// Prepare response
// ---------------------------------------------------------------------------

const buildBugReportPrepareResponse = async (deps: BugReportDeps): Promise<BugReportPrepareResponse> => {
  const screenshotDataUrl = await captureBugReportScreenshotDataUrl(deps.getMainWindow);
  const resolvedLogs = collectResolvedBugReportLogs(deps.miniBackendRuntimeLogBuffer);
  cachedBugReportLogEntries = resolvedLogs;

  const autoLogs = resolvedLogs.map((entry) => ({
    id: entry.id,
    name: entry.name,
    size: entry.size,
    source: entry.source,
  }));

  const diagnostics = await buildBugReportDiagnostics(deps);

  return {
    screenshotDataUrl,
    autoLogs,
    diagnostics,
    ready: true,
  };
};

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

const buildBugReportLogs = (
  includeLogs: boolean,
  rawIds: unknown,
  deps: BugReportDeps,
): BugReportLogEntry[] => {
  if (!includeLogs) {
    return [];
  }

  return resolveSelectedAutoLogEntries(rawIds, deps.miniBackendRuntimeLogBuffer)
    .map((entry) => {
      const buffer = readAutoLogBuffer(entry);
      if (buffer.length <= 0) {
        return null;
      }
      return {
        name: toSafeBugReportFileName(path.basename(entry.name), `${entry.id}.log`),
        content: buffer.toString("utf8"),
      };
    })
    .filter((entry): entry is BugReportLogEntry => entry !== null);
};

const buildBugReportAttachments = (
  manualAttachments: BugReportAttachmentBuffer[],
): BugReportAttachmentEntry[] =>
  manualAttachments.map((attachment) => ({
    name: attachment.fileName,
    mime: attachment.mimeType,
    data: attachment.data.toString("base64"),
  }));

const setupDesktopBugReportIpcHandlers = (deps: BugReportDeps): void => {
  registerSecureIpcHandler<BugReportPrepareResponse>("desktop-api:bug-report:prepare", async () => {
    return buildBugReportPrepareResponse(deps);
  });

  registerSecureIpcHandler<BugReportSubmitResponse>("desktop-api:bug-report:submit", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;

    const endpointUrl = validateBugReportEndpointUrl(payload.endpointUrl);
    if (!endpointUrl) {
      return {
        ok: false,
        status: 400,
        error: "The bug report endpoint is missing or not an allowed https://koma-studio.site address.",
      };
    }

    const title = sanitizeBugReportText(payload.title ?? "", BUG_REPORT_TITLE_MAX_LENGTH);
    if (title.length < 5) {
      return {
        ok: false,
        status: 400,
        error: "Provide a title of at least 5 characters to send the report.",
      };
    }

    const screenshot = resolveBugReportScreenshotPayload(payload.screenshotDataUrl);
    if (!screenshot.ok) {
      return {
        ok: false,
        status: 400,
        error: screenshot.error,
      };
    }

    const manualAttachmentsResult = parseBugReportManualAttachments(payload.attachments);
    if (!manualAttachmentsResult.ok) {
      return {
        ok: false,
        status: 400,
        error: manualAttachmentsResult.error,
      };
    }

    const includeLogs = payload.includeLogs !== false;
    const logs = buildBugReportLogs(includeLogs, payload.autoLogIds, deps);
    const context = sanitizeBugReportContext(payload.context);
    const description = assembleBugReportDescription(
      sanitizeBugReportMultilineText(payload.description ?? "", BUG_REPORT_DESCRIPTION_MAX_LENGTH),
      context,
      payload,
    );
    const diagnosticsPayload = await buildBugReportDiagnostics(deps);
    const diagnostics = { ...diagnosticsPayload, context };

    const candidatePayload = buildBugReportPayload({
      title,
      description,
      includeLogs,
      logs,
      diagnostics,
      screenshot: screenshot.dataUrl,
      attachments: buildBugReportAttachments(manualAttachmentsResult.attachments),
      client: buildBugReportClientMetadata(deps),
    });

    const budgetResult = enforceBugReportWireBudget(candidatePayload);
    if (!budgetResult.ok) {
      return {
        ok: false,
        status: 413,
        error: budgetResult.error,
      };
    }

    const serializedBody = serializeBugReportPayload(budgetResult.payload);

    let response: globalThis.Response;
    try {
      response = await fetchWithTimeoutAndRetry(
        (signal) =>
          electronNet.fetch(endpointUrl, {
            method: "POST",
            redirect: "error",
            headers: {
              "content-type": "application/json",
            },
            body: serializedBody,
            signal,
          }),
        { method: "POST" },
        { timeoutMs: BUG_REPORT_SUBMIT_TIMEOUT_MS, retryCount: 0 },
      );
    } catch (error) {
      console.warn("[bug-report] Failed to reach the bug report service:", error);
      return {
        ok: false,
        status: 0,
        error: "Could not reach the bug report service. Check your internet connection and try again.",
      };
    }

    if (response.redirected || !validateBugReportEndpointUrl(response.url)) {
      console.warn("[bug-report] Endpoint answered with a redirect; report not sent.");
      return {
        ok: false,
        status: 502,
        error: "The bug report endpoint attempted a redirect; the report was not sent.",
      };
    }

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
      };
    }

    if (response.status >= 400 && response.status < 500) {
      const detail = await parseDesktopApiError(response);
      return {
        ok: false,
        status: response.status,
        error: sanitizeBugReportText(detail, 300),
      };
    }

    return {
      ok: false,
      status: response.status,
      error: `The bug report service returned HTTP ${response.status}. Try again later.`,
    };
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  type BugReportLogSource,
  type BugReportAutoLogEntry,
  type BugReportResolvedLogEntry,
  type BugReportAttachmentBuffer,
  type BugReportPrepareResponse,
  type BugReportSubmitResponse,
  type BugReportDeps,
  type MiniBackendRuntimeLogEntry,
  BUG_REPORT_ALLOWED_LOG_EXTENSIONS,
  BUG_REPORT_MAX_AUTO_LOG_FILES,
  BUG_REPORT_MAX_AUTO_LOG_FILE_BYTES,
  BUG_REPORT_MAX_MANUAL_ATTACHMENTS,
  BUG_REPORT_MAX_MANUAL_FILE_BYTES,
  BUG_REPORT_MAX_SCREENSHOT_BYTES,
  BUG_REPORT_SUBMIT_TIMEOUT_MS,
  MINI_BACKEND_RUNTIME_LOG_LIMIT,
  APP_SESSION_LOG_FILE_NAME,
  createBugReportLogId,
  toPosixPath,
  sanitizeBugReportText,
  sanitizeBugReportMultilineText,
  isBugReportLogFile,
  collectLogFilesFromDirectory,
  buildMiniBackendRuntimeLogEntry,
  collectResolvedBugReportLogs,
  buildBugReportDiagnostics,
  captureBugReportScreenshotDataUrl,
  decodeBugReportDataUrlImage,
  resolveBugReportScreenshotPayload,
  toSafeBugReportFileName,
  truncateUtf8BufferWithPrefix,
  readAutoLogBuffer,
  parseBugReportManualAttachments,
  resolveSelectedAutoLogEntries,
  sanitizeBugReportContext,
  assembleBugReportDescription,
  buildBugReportClientMetadata,
  buildBugReportPrepareResponse,
  buildBugReportLogs,
  buildBugReportAttachments,
  setupDesktopBugReportIpcHandlers,
};
