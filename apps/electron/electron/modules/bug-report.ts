/**
 * Bug reporting pipeline module.
 * Extracted from the large legacy electron/main.ts during its decomposition.
 */
import { app, net as electronNet } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import {
  registerSecureIpcHandler,
  fetchWithTimeoutAndRetry,
  normalizeDiscordWebhookUrl,
  sanitizeDiscordWebhookText,
  parseDiscordWebhookErrorMessage,
} from "./shared.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BugReportLogSource = "app" | "user" | "runtime";
type BugReportSeverity = "low" | "medium" | "high" | "critical";

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
  error?: string;
}

interface BugReportSubmitResponse {
  ok: boolean;
  status: number;
  error?: string;
  screenshotUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUG_REPORT_ALLOWED_LOG_EXTENSIONS = new Set([".log", ".txt", ".json", ".ndjson", ".jsonl"]);
const BUG_REPORT_MAX_AUTO_LOG_FILES = 12;
const BUG_REPORT_MAX_AUTO_LOG_FILE_BYTES = 1_500_000;
const BUG_REPORT_MAX_MANUAL_ATTACHMENTS = 5;
const BUG_REPORT_MAX_MANUAL_FILE_BYTES = 8 * 1024 * 1024;
const BUG_REPORT_MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const BUG_REPORT_MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const MINI_BACKEND_RUNTIME_LOG_LIMIT = 600;
const APP_SESSION_LOG_FILE_NAME = "desktop-session.log";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let cachedBugReportLogEntries: BugReportResolvedLogEntry[] = [];

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
  resolveDesktopEnvValue: (key: string) => string | null;
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
    { dir: path.resolve(process.cwd(), "auth-server", "logs"), source: "app", label: "auth-server" },
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

  const match = rawDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i);
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
// Severity
// ---------------------------------------------------------------------------

const parseBugReportSeverity = (value: unknown): BugReportSeverity | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "critical") {
    return normalized;
  }

  return null;
};

const severityToDiscordColor = (severity: BugReportSeverity): number => {
  switch (severity) {
    case "critical":
      return 0xb91c1c;
    case "high":
      return 0xdc2626;
    case "medium":
      return 0xf59e0b;
    case "low":
    default:
      return 0x2563eb;
  }
};

// ---------------------------------------------------------------------------
// Imgur upload
// ---------------------------------------------------------------------------

const uploadBugReportScreenshotToImgur = async (
  imgurClientId: string,
  screenshot: { mimeType: string; data: Buffer },
): Promise<{ ok: boolean; status: number; link?: string; error?: string }> => {
  const formData = new FormData();
  formData.append(
    "image",
    new Blob([Uint8Array.from(screenshot.data)], { type: screenshot.mimeType }),
    "bug-report-screenshot.png",
  );

  try {
    const response = await fetchWithTimeoutAndRetry(
      (signal) =>
        electronNet.fetch("https://api.imgur.com/3/image", {
          method: "POST",
          headers: {
            Authorization: `Client-ID ${imgurClientId}`,
          },
          body: formData,
          signal,
        }),
      { method: "POST" },
      { timeoutMs: 20_000, retryCount: 0 },
    );

    const rawText = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: sanitizeBugReportText(rawText || `Imgur returned HTTP ${response.status}.`, 300),
      };
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const success = parsed.success === true;
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    const link = typeof data.link === "string" ? data.link.trim() : "";
    if (!success || !link) {
      return {
        ok: false,
        status: response.status,
        error: "Failed to receive the URL of the image uploaded to Imgur.",
      };
    }

    return {
      ok: true,
      status: response.status,
      link,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: sanitizeBugReportText(
        error instanceof Error ? error.message : "Failed to upload screenshot to Imgur.",
        300,
      ),
    };
  }
};

// ---------------------------------------------------------------------------
// Webhook payload
// ---------------------------------------------------------------------------

const buildBugReportWebhookPayload = (
  title: string,
  description: string,
  severity: BugReportSeverity,
  screenshotUrl: string,
  details: {
    stepsToReproduce?: string;
    expectedResult?: string;
    actualResult?: string;
    contact?: string;
    context?: Record<string, unknown>;
  },
): Record<string, unknown> => {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    {
      name: "Severity",
      value: severity.toUpperCase(),
      inline: true,
    },
    {
      name: "Version",
      value: app.getVersion(),
      inline: true,
    },
    {
      name: "Platform",
      value: `${os.platform()} ${os.release()} (${os.arch()})`,
      inline: true,
    },
  ];

  if (details.stepsToReproduce) {
    fields.push({ name: "Steps to reproduce", value: details.stepsToReproduce.slice(0, 1024) });
  }
  if (details.expectedResult) {
    fields.push({ name: "Expected result", value: details.expectedResult.slice(0, 1024) });
  }
  if (details.actualResult) {
    fields.push({ name: "Actual result", value: details.actualResult.slice(0, 1024) });
  }
  if (details.contact) {
    fields.push({ name: "Contact", value: details.contact.slice(0, 256), inline: false });
  }

  const context = details.context && typeof details.context === "object" ? details.context : null;
  const mode = sanitizeBugReportText((context as Record<string, unknown> | null)?.mode ?? "", 120);
  const userEmail = sanitizeBugReportText((context as Record<string, unknown> | null)?.userEmail ?? "", 160);
  if (mode) {
    fields.push({ name: "Current mode", value: mode, inline: true });
  }
  if (userEmail) {
    fields.push({ name: "User", value: userEmail, inline: true });
  }

  return {
    username: "KŌMA Bug Reporter",
    embeds: [
      {
        title: `\u{1F41E} ${title.slice(0, 180)}`,
        description: `${description.slice(0, 3500)}\n\n[Screenshot on Imgur](${screenshotUrl})`,
        color: severityToDiscordColor(severity),
        timestamp: new Date().toISOString(),
        fields,
        image: {
          url: screenshotUrl,
        },
        footer: {
          text: "KŌMA Studio • Automatic bug report",
        },
      },
    ],
  };
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
    const mimeType = sanitizeBugReportText(item.mimeType ?? "application/octet-stream", 80) || "application/octet-stream";
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
// Discord webhook send
// ---------------------------------------------------------------------------

const sendBugReportToDiscord = async (
  webhookUrl: string,
  payloadJson: Record<string, unknown>,
  attachments: BugReportAttachmentBuffer[],
): Promise<BugReportSubmitResponse> => {
  const formData = new FormData();
  formData.append("payload_json", JSON.stringify(payloadJson));

  attachments.forEach((attachment, index) => {
    formData.append(
      `files[${index}]`,
      new Blob([Uint8Array.from(attachment.data)], { type: attachment.mimeType }),
      attachment.fileName,
    );
  });

  try {
    const response = await fetchWithTimeoutAndRetry(
      (signal) =>
        electronNet.fetch(webhookUrl, {
          method: "POST",
          body: formData,
          signal,
        }),
      { method: "POST" },
      { timeoutMs: 20_000, retryCount: 0 },
    );

    if (response.ok || response.status === 204) {
      return {
        ok: true,
        status: response.status,
      };
    }

    const rawError = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      error: parseDiscordWebhookErrorMessage(rawError, response.status),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: sanitizeBugReportText(
        error instanceof Error ? error.message : "Failed to send the report to Discord.",
        300,
      ),
    };
  }
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
  const bugWebhookUrl = normalizeDiscordWebhookUrl(deps.resolveDesktopEnvValue("BUG_REPORT_DISCORD_WEBHOOK_URL") ?? "");
  const imgurClientId = (deps.resolveDesktopEnvValue("IMGUR_CLIENT_ID") ?? "").trim();
  const ready = Boolean(bugWebhookUrl && imgurClientId);

  return {
    screenshotDataUrl,
    autoLogs,
    diagnostics,
    ready,
    error: ready
      ? undefined
      : "Set BUG_REPORT_DISCORD_WEBHOOK_URL and IMGUR_CLIENT_ID in the environment to send reports.",
  };
};

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

const setupDesktopBugReportIpcHandlers = (deps: BugReportDeps): void => {
  registerSecureIpcHandler<BugReportPrepareResponse>("desktop-api:bug-report:prepare", async () => {
    return buildBugReportPrepareResponse(deps);
  });

  registerSecureIpcHandler<BugReportSubmitResponse>("desktop-api:bug-report:submit", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;

    const bugWebhookUrl = normalizeDiscordWebhookUrl(deps.resolveDesktopEnvValue("BUG_REPORT_DISCORD_WEBHOOK_URL") ?? "");
    const imgurClientId = (deps.resolveDesktopEnvValue("IMGUR_CLIENT_ID") ?? "").trim();
    if (!bugWebhookUrl || !imgurClientId) {
      return {
        ok: false,
        status: 412,
        error: "BUG_REPORT_DISCORD_WEBHOOK_URL and IMGUR_CLIENT_ID must be configured.",
      };
    }

    const title = sanitizeBugReportText(payload.title ?? "", 180);
    const description = sanitizeBugReportMultilineText(payload.description ?? "", 3_500);
    const severity = parseBugReportSeverity(payload.severity);
    if (!title || !description || !severity) {
      return {
        ok: false,
        status: 400,
        error: "Provide a valid title, description, and severity to send the report.",
      };
    }

    const screenshot = decodeBugReportDataUrlImage(payload.screenshotDataUrl ?? "");
    if (!screenshot) {
      return {
        ok: false,
        status: 400,
        error: "Screenshot is invalid or missing. Capture it again before sending.",
      };
    }

    const screenshotUpload = await uploadBugReportScreenshotToImgur(imgurClientId, screenshot);
    if (!screenshotUpload.ok || !screenshotUpload.link) {
      return {
        ok: false,
        status: screenshotUpload.status || 502,
        error: screenshotUpload.error ?? "Failed to upload the screenshot to Imgur.",
      };
    }

    const manualAttachmentsResult = parseBugReportManualAttachments(payload.attachments);
    if ("error" in manualAttachmentsResult) {
      return {
        ok: false,
        status: 400,
        error: manualAttachmentsResult.error,
      };
    }

    const manualAttachments = manualAttachmentsResult.attachments;
    const context = sanitizeBugReportContext(payload.context);
    const diagnosticsPayload = await buildBugReportDiagnostics(deps);
    const diagnosticsAttachment: BugReportAttachmentBuffer = {
      fileName: "diagnostics.json",
      mimeType: "application/json",
      source: "auto-log",
      data: truncateUtf8BufferWithPrefix(
        Buffer.from(JSON.stringify({ ...diagnosticsPayload, context }, null, 2), "utf8"),
        BUG_REPORT_MAX_AUTO_LOG_FILE_BYTES,
      ),
    };

    const autoLogEntries = resolveSelectedAutoLogEntries(payload.autoLogIds, deps.miniBackendRuntimeLogBuffer);
    const autoLogAttachments: BugReportAttachmentBuffer[] = autoLogEntries
      .map((entry) => {
        const buffer = readAutoLogBuffer(entry);
        const safeName = toSafeBugReportFileName(path.basename(entry.name), `${entry.id}.log`);
        return {
          fileName: safeName,
          mimeType: "text/plain",
          source: "auto-log" as const,
          data: buffer,
        };
      })
      .filter((item) => item.data.length > 0);

    const allAttachments = [diagnosticsAttachment, ...autoLogAttachments, ...manualAttachments];
    const totalAttachmentBytes = allAttachments.reduce((sum, item) => sum + item.data.length, 0);
    if (totalAttachmentBytes > BUG_REPORT_MAX_TOTAL_ATTACHMENT_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `Attachments exceed the total limit of ${Math.round(BUG_REPORT_MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024))}MB.`,
      };
    }

    const stepsToReproduce = sanitizeBugReportMultilineText(payload.stepsToReproduce ?? "", 1_024);
    const expectedResult = sanitizeBugReportMultilineText(payload.expectedResult ?? "", 1_024);
    const actualResult = sanitizeBugReportMultilineText(payload.actualResult ?? "", 1_024);
    const contact = sanitizeBugReportText(payload.contact ?? "", 256);

    const webhookPayload = buildBugReportWebhookPayload(
      title,
      description,
      severity,
      screenshotUpload.link,
      {
        stepsToReproduce: stepsToReproduce || undefined,
        expectedResult: expectedResult || undefined,
        actualResult: actualResult || undefined,
        contact: contact || undefined,
        context,
      },
    );

    const webhookResult = await sendBugReportToDiscord(bugWebhookUrl, webhookPayload, allAttachments);
    if (!webhookResult.ok) {
      return webhookResult;
    }

    return {
      ok: true,
      status: webhookResult.status,
      screenshotUrl: screenshotUpload.link,
    };
  });
};

// ---------------------------------------------------------------------------
// Discord webhook IPC handlers
// ---------------------------------------------------------------------------

const setupDesktopDiscordWebhookIpcHandlers = (): void => {
  registerSecureIpcHandler<{
    ok: boolean;
    status: number;
    error?: string;
  }>("desktop-api:discord-webhook:send", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const normalizedUrl = normalizeDiscordWebhookUrl(payload.url);
    if (!normalizedUrl) {
      return {
        ok: false,
        status: 400,
        error: "Invalid Discord webhook URL.",
      };
    }

    const bodyCandidate = payload.body;
    if (!bodyCandidate || typeof bodyCandidate !== "object" || Array.isArray(bodyCandidate)) {
      return {
        ok: false,
        status: 400,
        error: "Invalid webhook payload.",
      };
    }

    let serializedBody = "";
    try {
      serializedBody = JSON.stringify(bodyCandidate);
    } catch {
      console.warn("[bug-report] Failed to serialize webhook body");
      return {
        ok: false,
        status: 400,
        error: "Webhook payload is not serializable.",
      };
    }

    if (!serializedBody || serializedBody.length > 50_000) {
      return {
        ok: false,
        status: 413,
        error: "Webhook payload exceeds the allowed limit.",
      };
    }

    try {
      const response = await fetchWithTimeoutAndRetry(
        (signal) =>
          electronNet.fetch(normalizedUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: serializedBody,
            signal,
          }),
        { method: "POST" },
        { timeoutMs: 15_000, retryCount: 0 },
      );

      if (response.ok || response.status === 204) {
        return {
          ok: true,
          status: response.status,
        };
      }

      const rawError = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: parseDiscordWebhookErrorMessage(rawError, response.status),
      };
    } catch (error) {
      console.warn("[bug-report] Discord webhook send failed:", error);
      return {
        ok: false,
        status: 0,
        error: sanitizeDiscordWebhookText(
          error instanceof Error ? error.message : "Failed to send webhook to Discord.",
          300,
        ),
      };
    }
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  type BugReportLogSource,
  type BugReportSeverity,
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
  BUG_REPORT_MAX_TOTAL_ATTACHMENT_BYTES,
  BUG_REPORT_MAX_SCREENSHOT_BYTES,
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
  toSafeBugReportFileName,
  truncateUtf8BufferWithPrefix,
  readAutoLogBuffer,
  parseBugReportSeverity,
  severityToDiscordColor,
  uploadBugReportScreenshotToImgur,
  buildBugReportPrepareResponse,
  buildBugReportWebhookPayload,
  parseBugReportManualAttachments,
  resolveSelectedAutoLogEntries,
  sendBugReportToDiscord,
  sanitizeBugReportContext,
  setupDesktopBugReportIpcHandlers,
  setupDesktopDiscordWebhookIpcHandlers,
};
