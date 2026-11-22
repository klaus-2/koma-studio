import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3101;
const DEFAULT_REPORTS_DIR = "/var/lib/koma-bug-reports";
const DEFAULT_RETENTION_DAYS = 180;
const DEFAULT_MAX_TOTAL_MB = 512;
const DEFAULT_RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMITER_PRUNE_THRESHOLD = 10000;
const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SHUTDOWN_GRACE_MS = 5000;
const DISCORD_NOTIFY_TIMEOUT_MS = 5000;
const DISCORD_NOTIFY_UPLOAD_TIMEOUT_MS = 20000;
const DISCORD_MAX_FILES = 10;
const DISCORD_ATTACH_BUDGET_BYTES = 7 * 1024 * 1024;
const DISCORD_SAFE_FILENAME_PATTERN = /[^A-Za-z0-9._-]/g;
const VALID_SCHEMA_VERSION = 1;
const MIN_TITLE_CHARS = 5;
const MAX_TITLE_CHARS = 180;
const MAX_DESCRIPTION_CHARS = 3500;
const CLIENT_FIELD_LIMITS = { appVersion: 64, platform: 64, arch: 32, channel: 64, sessionId: 64 };
const MAX_DIAGNOSTICS_BYTES = 65536;
const MAX_SCREENSHOT_DECODED_BYTES = 6 * 1024 * 1024;
const MAX_LOG_ITEMS = 24;
const MAX_LOG_NAME_CHARS = 120;
const MAX_LOG_ITEM_BYTES = 512 * 1024;
const MAX_LOG_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_ATTACHMENT_ITEMS = 4;
const MAX_ATTACHMENT_NAME_CHARS = 200;
const MAX_ATTACHMENT_DECODED_BYTES = 5 * 1024 * 1024;
const SHELL_VALUES = new Set(["tauri", "electron"]);
const DATA_URI_PREFIXES = ["data:image/png;base64,", "data:image/jpeg;base64,"];
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const ATTACHMENT_MIME_PATTERN = /^(image|text)\/[A-Za-z0-9._+-]+$/;
const TRUSTED_PROXY_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const BODY_TOO_LARGE = "KOMA_BUG_BODY_TOO_LARGE";
const REQUEST_ABORTED = "KOMA_BUG_REQUEST_ABORTED";

function loadConfigFromEnv(env) {
  const port = parsePositiveIntegerEnv(env.PORT, "PORT");
  const retentionDays = parsePositiveIntegerEnv(env.KOMA_BUG_REPORTS_RETENTION_DAYS, "KOMA_BUG_REPORTS_RETENTION_DAYS");
  const rateLimitPerHour = parsePositiveIntegerEnv(env.KOMA_BUG_RATE_LIMIT_PER_HOUR, "KOMA_BUG_RATE_LIMIT_PER_HOUR");
  const maxTotalMb = parsePositiveIntegerEnv(env.KOMA_BUG_REPORTS_MAX_TOTAL_MB, "KOMA_BUG_REPORTS_MAX_TOTAL_MB");
  return {
    host: DEFAULT_HOST,
    port: port ?? DEFAULT_PORT,
    reportsDir: env.KOMA_BUG_REPORTS_DIR || DEFAULT_REPORTS_DIR,
    retentionDays: retentionDays ?? DEFAULT_RETENTION_DAYS,
    rateLimitPerHour: rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR,
    maxTotalBytes: (maxTotalMb ?? DEFAULT_MAX_TOTAL_MB) * 1024 * 1024,
    notifyWebhookUrl: env.KOMA_BUG_NOTIFY_DISCORD_WEBHOOK_URL || null,
  };
}

function parsePositiveIntegerEnv(raw, name) {
  if (raw === undefined) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`bug-report-server ignoring invalid ${name}=${raw}`);
    return null;
  }
  return parsed;
}

function normalizeConfig(config) {
  return {
    host: config.host ?? DEFAULT_HOST,
    port: config.port ?? DEFAULT_PORT,
    reportsDir: config.reportsDir ?? DEFAULT_REPORTS_DIR,
    retentionDays: config.retentionDays ?? DEFAULT_RETENTION_DAYS,
    rateLimitPerHour: config.rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR,
    maxTotalBytes: (config.maxTotalMb ?? DEFAULT_MAX_TOTAL_MB) * 1024 * 1024,
    notifyWebhookUrl: config.notifyWebhookUrl ?? null,
  };
}

class FixedWindowRateLimiter {
  #limit;
  #windowMs;
  #buckets;

  constructor(limit, windowMs) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#buckets = new Map();
  }

  tryAcquire(key, now = Date.now()) {
    const windowId = Math.floor(now / this.#windowMs);
    if (this.#buckets.size > RATE_LIMITER_PRUNE_THRESHOLD) this.#prune(windowId);
    const bucket = this.#buckets.get(key);
    if (bucket === undefined || bucket.windowId !== windowId) {
      this.#buckets.set(key, { windowId, count: 1 });
      return true;
    }
    if (bucket.count >= this.#limit) return false;
    bucket.count += 1;
    return true;
  }

  msUntilWindowEnd(now = Date.now()) {
    return this.#windowMs - (now % this.#windowMs);
  }

  #prune(windowId) {
    for (const [key, bucket] of this.#buckets) {
      if (bucket.windowId !== windowId) this.#buckets.delete(key);
    }
  }
}

function invalid(field, message) {
  return { ok: false, field, message };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringViolation(value, field, maxChars, minChars = 0) {
  if (typeof value !== "string") return invalid(field, `${field} must be a string`);
  if (value.length < minChars || value.length > maxChars) {
    const range = minChars > 0 ? `${minChars}..${maxChars}` : `at most ${maxChars}`;
    return invalid(field, `${field} must be a string of ${range} characters`);
  }
  return null;
}

function decodedBase64ByteLength(value) {
  if (typeof value !== "string" || value.length === 0 || !BASE64_PATTERN.test(value)) return null;
  return Buffer.from(value, "base64").length;
}

function validateBugReport(body) {
  if (!isPlainObject(body)) return invalid("body", "body must be a JSON object");
  if (!Object.hasOwn(body, "schema")) return invalid("schema", "schema is required");
  if (!Number.isInteger(body.schema) || body.schema !== VALID_SCHEMA_VERSION) {
    return invalid("schema", `schema must be the integer ${VALID_SCHEMA_VERSION}`);
  }
  let violation = stringViolation(body.title, "title", MAX_TITLE_CHARS, MIN_TITLE_CHARS);
  if (violation) return violation;
  violation = stringViolation(body.description, "description", MAX_DESCRIPTION_CHARS);
  if (violation) return violation;
  if (typeof body.includeLogs !== "boolean") return invalid("includeLogs", "includeLogs must be a boolean");
  if (!isPlainObject(body.client)) return invalid("client", "client must be an object");
  if (!Object.hasOwn(body.client, "shell")) return invalid("client.shell", "client.shell is required");
  if (typeof body.client.shell !== "string" || !SHELL_VALUES.has(body.client.shell)) {
    return invalid("client.shell", "client.shell must be either tauri or electron");
  }
  for (const [key, maxChars] of Object.entries(CLIENT_FIELD_LIMITS)) {
    if (!Object.hasOwn(body.client, key)) return invalid(`client.${key}`, `client.${key} is required`);
    violation = stringViolation(body.client[key], `client.${key}`, maxChars);
    if (violation) return violation;
  }
  if (body.diagnostics !== undefined) {
    if (!isPlainObject(body.diagnostics)) return invalid("diagnostics", "diagnostics must be an object");
    if (Buffer.byteLength(JSON.stringify(body.diagnostics), "utf8") > MAX_DIAGNOSTICS_BYTES) {
      return invalid("diagnostics", `diagnostics must serialize to at most ${MAX_DIAGNOSTICS_BYTES} bytes`);
    }
  }
  if (body.screenshot !== undefined && body.screenshot !== null) {
    violation = validateScreenshot(body.screenshot);
    if (violation) return violation;
  }
  if (body.logs !== undefined) {
    violation = validateLogs(body.logs);
    if (violation) return violation;
  }
  if (body.attachments !== undefined) {
    violation = validateAttachments(body.attachments);
    if (violation) return violation;
  }
  if (body.droppedAttachments !== undefined && (!Number.isInteger(body.droppedAttachments) || body.droppedAttachments < 0)) {
    return invalid("droppedAttachments", "droppedAttachments must be an integer >= 0");
  }
  return { ok: true };
}

function validateScreenshot(value) {
  if (typeof value !== "string") {
    return invalid("screenshot", "screenshot must be null or a data URI string");
  }
  const prefix = DATA_URI_PREFIXES.find((candidate) => value.startsWith(candidate));
  if (prefix === undefined) {
    return invalid("screenshot", 'screenshot must be null or a "data:image/png;base64," / "data:image/jpeg;base64," data URI');
  }
  const decodedBytes = decodedBase64ByteLength(value.slice(prefix.length));
  if (decodedBytes === null) return invalid("screenshot", "screenshot must carry valid base64 data");
  if (decodedBytes > MAX_SCREENSHOT_DECODED_BYTES) {
    return invalid("screenshot", `screenshot must decode to at most ${MAX_SCREENSHOT_DECODED_BYTES} bytes`);
  }
  return null;
}

function validateLogs(value) {
  if (!Array.isArray(value)) return invalid("logs", "logs must be an array");
  if (value.length > MAX_LOG_ITEMS) return invalid("logs", `logs must contain at most ${MAX_LOG_ITEMS} items`);
  let totalBytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isPlainObject(item)) return invalid(`logs[${index}]`, `logs[${index}] must be an object`);
    let violation = stringViolation(item.name, `logs[${index}].name`, MAX_LOG_NAME_CHARS);
    if (violation) return violation;
    if (typeof item.content !== "string") return invalid(`logs[${index}].content`, `logs[${index}].content must be a string`);
    const contentBytes = Buffer.byteLength(item.content, "utf8");
    if (contentBytes > MAX_LOG_ITEM_BYTES) {
      return invalid(`logs[${index}].content`, `logs[${index}].content must be at most ${MAX_LOG_ITEM_BYTES} bytes`);
    }
    totalBytes += contentBytes;
    if (totalBytes > MAX_LOG_TOTAL_BYTES) {
      return invalid("logs", `logs total content must be at most ${MAX_LOG_TOTAL_BYTES} bytes`);
    }
  }
  return null;
}

function validateAttachments(value) {
  if (!Array.isArray(value)) return invalid("attachments", "attachments must be an array");
  if (value.length > MAX_ATTACHMENT_ITEMS) {
    return invalid("attachments", `attachments must contain at most ${MAX_ATTACHMENT_ITEMS} items`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isPlainObject(item)) return invalid(`attachments[${index}]`, `attachments[${index}] must be an object`);
    const violation = stringViolation(item.name, `attachments[${index}].name`, MAX_ATTACHMENT_NAME_CHARS);
    if (violation) return violation;
    if (typeof item.mime !== "string" || !ATTACHMENT_MIME_PATTERN.test(item.mime)) {
      return invalid(`attachments[${index}].mime`, `attachments[${index}].mime must be an image/* or text/* type`);
    }
    const decodedBytes = decodedBase64ByteLength(item.data);
    if (decodedBytes === null) return invalid(`attachments[${index}].data`, `attachments[${index}].data must be valid base64`);
    if (decodedBytes > MAX_ATTACHMENT_DECODED_BYTES) {
      return invalid(
        `attachments[${index}].data`,
        `attachments[${index}].data must decode to at most ${MAX_ATTACHMENT_DECODED_BYTES} bytes`,
      );
    }
  }
  return null;
}

function readRequestBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let discarding = false;
    let settled = false;
    request.on("data", (chunk) => {
      if (discarding) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        discarding = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      if (discarding) {
        const error = new Error("request body exceeds the maximum allowed size");
        error.code = BODY_TOO_LARGE;
        reject(error);
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.on("close", () => {
      if (settled) return;
      settled = true;
      const error = new Error("request connection closed before the body completed");
      error.code = REQUEST_ABORTED;
      reject(error);
    });
  });
}

function respondJson(response, status, payload, extraHeaders = {}) {
  if (response.writableEnded || response.destroyed) return;
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(body);
}

function respondTooLarge(request, response) {
  request.resume();
  const send413 = () => {
    respondJson(response, 413, { error: "payload too large" }, { Connection: "close" });
  };
  if (request.readableEnded || request.destroyed) {
    send413();
    return;
  }
  request.on("end", send413);
  request.on("close", send413);
}

function resolveClientKey(request) {
  const remoteAddress = request.socket.remoteAddress ?? "unknown";
  if (TRUSTED_PROXY_ADDRESSES.has(remoteAddress)) {
    const forwardedFor = request.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string") {
      const entries = forwardedFor
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      if (entries.length > 0) return entries[entries.length - 1];
    }
  }
  return remoteAddress;
}

function parseRequestPath(request) {
  try {
    return new URL(request.url ?? "/", "http://localhost").pathname;
  } catch {
    return null;
  }
}

async function storeReport(reportsDir, id, received, report) {
  const monthDirectory = path.join(reportsDir, received.slice(0, 7));
  await fs.mkdir(monthDirectory, { recursive: true });
  const filePath = path.join(monthDirectory, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify({ id, received, report }), { encoding: "utf8" });
  return filePath;
}

function discordSafeFilename(name) {
  const base = String(name).replace(/\\/g, "/").split("/").pop() || "attachment";
  const cleaned = base.replace(DISCORD_SAFE_FILENAME_PATTERN, "_").slice(0, 120);
  return cleaned.includes(".") ? cleaned : `${cleaned}.txt`;
}

function decodeDataUrlPayload(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return bytes.length ? { mime: match[1], bytes } : null;
}

export function selectDiscordFiles(report) {
  const candidates = [];
  const screenshot = decodeDataUrlPayload(report.screenshot);
  if (screenshot) {
    candidates.push({
      filename: screenshot.mime === "image/jpeg" ? "screenshot.jpg" : "screenshot.png",
      contentType: screenshot.mime,
      bytes: screenshot.bytes,
    });
  }
  for (const item of Array.isArray(report.attachments) ? report.attachments : []) {
    if (!item || typeof item.data !== "string") continue;
    const bytes = Buffer.from(item.data, "base64");
    if (!bytes.length) continue;
    candidates.push({
      filename: discordSafeFilename(item.name),
      contentType: typeof item.mime === "string" ? item.mime : "application/octet-stream",
      bytes,
    });
  }
  for (const entry of Array.isArray(report.logs) ? report.logs : []) {
    if (!entry || typeof entry.content !== "string" || !entry.content) continue;
    candidates.push({
      filename: discordSafeFilename(entry.name),
      contentType: "text/plain; charset=utf-8",
      bytes: Buffer.from(entry.content, "utf8"),
    });
  }
  const selected = [];
  let totalBytes = 0;
  let omittedCount = 0;
  for (const candidate of candidates.slice(0, DISCORD_MAX_FILES)) {
    if (totalBytes + candidate.bytes.length > DISCORD_ATTACH_BUDGET_BYTES) {
      omittedCount += 1;
      continue;
    }
    selected.push(candidate);
    totalBytes += candidate.bytes.length;
  }
  omittedCount += Math.max(0, candidates.length - DISCORD_MAX_FILES);
  return { selected, omittedCount, totalBytes };
}

function buildDiscordMultipart(payload, files) {
  const boundary = `----komaBugReport${crypto.randomBytes(16).toString("hex")}`;
  const chunks = [];
  const pushText = (text) => chunks.push(Buffer.from(text, "utf8"));
  pushText(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n`);
  files.forEach((file, index) => {
    pushText(`--${boundary}\r\nContent-Disposition: form-data; name="files[${index}]"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`);
    chunks.push(file.bytes);
    pushText("\r\n");
  });
  pushText(`--${boundary}--\r\n`);
  return { contentType: `multipart/form-data; boundary=${boundary}`, body: Buffer.concat(chunks) };
}

async function postToDiscord(webhookUrl, contentType, body, timeoutMs) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return response.status;
}

async function notifyDiscord(webhookUrl, id, received, report) {
  if (!webhookUrl) return;
  try {
    const { selected, omittedCount } = selectDiscordFiles(report);
    const payload = {
      content: `New bug report \`${id}\` received ${received}`,
      embeds: [
        {
          title: report.title.slice(0, 256),
          description: report.description.slice(0, 1024) || "no description",
          fields: [
            { name: "shell", value: report.client.shell, inline: true },
            { name: "appVersion", value: report.client.appVersion || "unknown", inline: true },
            { name: "platform", value: `${report.client.platform}/${report.client.arch}`, inline: true },
            { name: "channel", value: report.client.channel || "unknown", inline: true },
            {
              name: "files",
              value: report.includeLogs === false && selected.length === 0
                ? "not included"
                : omittedCount
                  ? `${selected.length} attached, ${omittedCount} omitted by size`
                  : `${selected.length} attached`,
              inline: true,
            },
          ],
        },
      ],
      ...(selected.length
        ? { attachments: selected.map((file, index) => ({ id: index, filename: file.filename })) }
        : {}),
    };
    let status = 0;
    if (selected.length) {
      const multipart = buildDiscordMultipart(payload, selected);
      status = await postToDiscord(webhookUrl, multipart.contentType, multipart.body, DISCORD_NOTIFY_UPLOAD_TIMEOUT_MS);
    }
    if (!selected.length || status === 400 || status === 413) {
      status = await postToDiscord(webhookUrl, "application/json", JSON.stringify(payload), DISCORD_NOTIFY_TIMEOUT_MS);
    }
    if (status >= 400) {
      console.error(`bug-report discord notify rejected id=${id}: HTTP ${status}`);
    }
  } catch (error) {
    console.error(`bug-report discord notify failed id=${id}:`, error?.message ?? error);
  }
}

async function prepareStorage(settings) {
  await fs.mkdir(settings.reportsDir, { recursive: true });
  await runRetentionSweep(settings.reportsDir, settings.retentionDays, Date.now(), settings.maxTotalBytes);
}

export async function runRetentionSweep(reportsDir, retentionDays, now = Date.now(), maxTotalBytes = Number.POSITIVE_INFINITY) {
  const cutoffMs = now - retentionDays * MS_PER_DAY;
  let rootEntries;
  try {
    rootEntries = await fs.readdir(reportsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return { deletedFiles: 0, deletedDirectories: 0 };
    throw error;
  }
  let deletedFiles = 0;
  let deletedDirectories = 0;
  const fileEntries = [];
  for (const entry of rootEntries) {
    const entryPath = path.join(reportsDir, entry.name);
    if (entry.isDirectory()) {
      const childEntries = await fs.readdir(entryPath, { withFileTypes: true });
      for (const child of childEntries) {
        if (!child.isFile()) continue;
        const childPath = path.join(entryPath, child.name);
        if (await removeExpiredFile(childPath, cutoffMs)) {
          deletedFiles += 1;
          continue;
        }
        fileEntries.push(childPath);
      }
      if (await removeDirectoryIfEmpty(entryPath)) deletedDirectories += 1;
    } else if (entry.isFile()) {
      if (await removeExpiredFile(entryPath, cutoffMs)) {
        deletedFiles += 1;
        continue;
      }
      fileEntries.push(entryPath);
    }
  }
  deletedFiles += await enforceTotalBytesBudget(fileEntries, maxTotalBytes);
  return { deletedFiles, deletedDirectories };
}

async function enforceTotalBytesBudget(filePaths, maxTotalBytes) {
  if (!Number.isFinite(maxTotalBytes) || maxTotalBytes <= 0) return 0;
  const sized = [];
  for (const filePath of filePaths) {
    try {
      const stats = await fs.stat(filePath);
      sized.push({ filePath, size: stats.size, mtimeMs: stats.mtimeMs });
    } catch (error) {
      console.error(`bug-report retention sweep could not stat ${filePath}:`, error);
    }
  }
  let totalBytes = sized.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes <= maxTotalBytes) return 0;
  sized.sort((a, b) => a.mtimeMs - b.mtimeMs);
  let deleted = 0;
  for (const file of sized) {
    if (totalBytes <= maxTotalBytes) break;
    try {
      await fs.unlink(file.filePath);
      totalBytes -= file.size;
      deleted += 1;
    } catch (error) {
      console.error(`bug-report retention sweep could not remove ${file.filePath}:`, error);
    }
  }
  return deleted;
}

async function removeExpiredFile(filePath, cutoffMs) {
  try {
    const stats = await fs.stat(filePath);
    if (stats.mtimeMs >= cutoffMs) return false;
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`bug-report retention sweep could not remove ${filePath}:`, error);
    return false;
  }
}

async function removeDirectoryIfEmpty(directoryPath) {
  try {
    const remaining = await fs.readdir(directoryPath);
    if (remaining.length > 0) return false;
    await fs.rmdir(directoryPath);
    return true;
  } catch (error) {
    console.error(`bug-report retention sweep could not remove ${directoryPath}:`, error);
    return false;
  }
}

function routeRequest(request, response, settings, rateLimiter) {
  const pathname = parseRequestPath(request);
  if (pathname === null) {
    respondJson(response, 400, { error: "malformed request target" });
    return;
  }
  if (pathname === "/api/bug-reports") {
    if (request.method !== "POST") {
      respondJson(response, 405, { error: "method not allowed" }, { Allow: "POST" });
      return;
    }
    handleBugReportPost(request, response, settings, rateLimiter);
    return;
  }
  if (pathname === "/api/bug-reports/healthz" || pathname === "/healthz") {
    if (request.method !== "GET") {
      respondJson(response, 405, { error: "method not allowed" }, { Allow: "GET" });
      return;
    }
    respondJson(response, 200, { ok: true });
    return;
  }
  respondJson(response, 404, { error: "not found" });
}

async function handleBugReportPost(request, response, settings, rateLimiter) {
  try {
    const clientKey = resolveClientKey(request);
    if (!rateLimiter.tryAcquire(clientKey)) {
      return respondJson(
        response,
        429,
        { error: "rate limit exceeded" },
        { "Retry-After": String(Math.ceil(rateLimiter.msUntilWindowEnd() / 1000)) },
      );
    }
    const contentLengthHeader = request.headers["content-length"];
    if (contentLengthHeader !== undefined) {
      const declaredLength = Number(contentLengthHeader);
      if (Number.isInteger(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return respondTooLarge(request, response);
      }
    }
    let requestBody;
    try {
      requestBody = await readRequestBody(request, MAX_BODY_BYTES);
    } catch (error) {
      if (error.code === BODY_TOO_LARGE) return respondTooLarge(request, response);
      if (error.code === REQUEST_ABORTED) return;
      throw error;
    }
    let parsedBody;
    try {
      parsedBody = JSON.parse(requestBody.toString("utf8"));
    } catch {
      return respondJson(response, 400, { error: "body must be valid JSON", field: "body" });
    }
    const verdict = validateBugReport(parsedBody);
    if (!verdict.ok) {
      return respondJson(response, 400, { error: verdict.message, field: verdict.field });
    }
    const id = crypto.randomUUID();
    const received = new Date().toISOString();
    await storeReport(settings.reportsDir, id, received, parsedBody);
    respondJson(response, 201, { id, received });
    console.log(`bug-report stored id=${id} bytes=${requestBody.length} ip=${clientKey}`);
    void notifyDiscord(settings.notifyWebhookUrl, id, received, parsedBody);
  } catch (error) {
    console.error("bug-report request failed:", error);
    respondJson(response, 500, { error: "internal server error" });
  }
}

export function createBugReportServer(config = {}) {
  const settings = normalizeConfig(config);
  const rateLimiter = new FixedWindowRateLimiter(settings.rateLimitPerHour, RATE_LIMIT_WINDOW_MS);
  const server = http.createServer((request, response) => {
    try {
      routeRequest(request, response, settings, rateLimiter);
    } catch (error) {
      console.error("bug-report request routing failed:", error);
      respondJson(response, 500, { error: "internal server error" });
    }
  });
  server.on("clientError", (error, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  server.ready = prepareStorage(settings);
  server.ready.catch(() => {});
  return server;
}

async function main() {
  const config = loadConfigFromEnv(process.env);
  const server = createBugReportServer(config);
  try {
    await server.ready;
  } catch (error) {
    console.error(`bug-report-server cannot use reports dir ${config.reportsDir}:`, error);
    process.exitCode = 1;
    return;
  }
  const retentionTimer = setInterval(() => {
    runRetentionSweep(config.reportsDir, config.retentionDays, Date.now(), config.maxTotalBytes).catch((error) => {
      console.error("bug-report retention sweep failed:", error);
    });
  }, RETENTION_SWEEP_INTERVAL_MS);
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(retentionTimer);
    server.closeIdleConnections();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  server.listen(config.port, config.host, () => {
    console.log(
      `bug-report-server listening on ${config.host}:${config.port} reportsDir=${config.reportsDir} ` +
        `retentionDays=${config.retentionDays} rateLimitPerHour=${config.rateLimitPerHour} ` +
        `discordNotify=${config.notifyWebhookUrl ? "enabled" : "disabled"}`,
    );
  });
}

const invokedAsMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) {
  main();
}
