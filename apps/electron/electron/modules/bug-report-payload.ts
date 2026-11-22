/**
 * Pure bug-report payload assembly for the C1 endpoint contract
 * (plan: .devflow/plans/bug-report-pipeline.md). No electron imports —
 * unit-testable under node:test.
 */

export const BUG_REPORT_ENDPOINT_HOST = "koma-studio.site";
export const BUG_REPORT_WIRE_BUDGET_BYTES = 20 * 1024 * 1024;
export const BUG_REPORT_LOG_ITEM_MAX_BYTES = 512 * 1024;
export const BUG_REPORT_LOGS_TOTAL_MAX_BYTES = 3 * 1024 * 1024;
export const BUG_REPORT_LOGS_MAX_ITEMS = 24;
export const BUG_REPORT_LOG_NAME_MAX_LENGTH = 120;
export const BUG_REPORT_ATTACHMENT_NAME_MAX_LENGTH = 200;
export const BUG_REPORT_TITLE_MAX_LENGTH = 180;
export const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 3_500;

const BUG_REPORT_LOG_BUDGET_LADDER_BYTES = [
  256 * 1024,
  128 * 1024,
  64 * 1024,
  32 * 1024,
  16 * 1024,
  8 * 1024,
  4 * 1024,
  2 * 1024,
  1 * 1024,
] as const;

export interface BugReportClientMetadata {
  appVersion: string;
  shell: "tauri" | "electron";
  platform: string;
  arch: string;
  channel: string;
  sessionId: string;
}

export interface BugReportLogEntry {
  name: string;
  content: string;
}

export interface BugReportAttachmentEntry {
  name: string;
  mime: string;
  data: string;
}

export interface BugReportPayloadInput {
  title: string;
  description: string;
  includeLogs: boolean;
  logs: BugReportLogEntry[];
  diagnostics: Record<string, unknown>;
  screenshot: string | null;
  attachments: BugReportAttachmentEntry[];
  client: BugReportClientMetadata;
}

export interface BugReportPayload {
  schema: 1;
  title: string;
  description: string;
  includeLogs: boolean;
  client: BugReportClientMetadata;
  diagnostics: Record<string, unknown>;
  screenshot: string | null;
  logs?: BugReportLogEntry[];
  attachments: BugReportAttachmentEntry[];
  droppedAttachments: number;
}

export type BugReportWireBudgetResult =
  | { ok: true; payload: BugReportPayload }
  | { ok: false; error: string };

const isSubdomainHost = (hostname: string): boolean =>
  hostname === BUG_REPORT_ENDPOINT_HOST ||
  hostname.endsWith(`.${BUG_REPORT_ENDPOINT_HOST}`);

/**
 * C2 endpoint allowlist: https scheme AND host equal to koma-studio.site
 * or a *.koma-studio.site subdomain. Returns the normalized URL or null.
 */
const validateBugReportEndpointUrl = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !isSubdomainHost(url.hostname)) {
    return null;
  }

  return url.toString();
};

/**
 * Keeps the END of the content within maxBytes (the tail holds the failure).
 * The re-encoded tail is re-measured: lossy replacement of invalid bytes can
 * expand past the cap, so the slice is shaved geometrically until it fits.
 */
const tailTruncateBugReportText = (content: string, maxBytes: number): string => {
  if (maxBytes <= 0) {
    return "";
  }
  let slice = Buffer.from(content, "utf8").subarray(-maxBytes).toString("utf8");
  let shaveChars = 1;
  while (slice.length > 0 && Buffer.byteLength(slice, "utf8") > maxBytes) {
    slice = slice.slice(shaveChars);
    shaveChars *= 2;
  }
  return slice;
};

const selectBugReportLogs = (logs: BugReportLogEntry[]): BugReportLogEntry[] => {
  const selected: BugReportLogEntry[] = [];
  let totalBytes = 0;
  for (const entry of logs) {
    if (selected.length >= BUG_REPORT_LOGS_MAX_ITEMS) {
      break;
    }
    const name = typeof entry.name === "string" ? entry.name.slice(0, BUG_REPORT_LOG_NAME_MAX_LENGTH) : "";
    const content = typeof entry.content === "string" ? entry.content : "";
    if (!content) {
      continue;
    }
    const truncated = tailTruncateBugReportText(content, BUG_REPORT_LOG_ITEM_MAX_BYTES);
    const truncatedBytes = Buffer.byteLength(truncated, "utf8");
    if (totalBytes + truncatedBytes > BUG_REPORT_LOGS_TOTAL_MAX_BYTES) {
      break;
    }
    selected.push({ name, content: truncated });
    totalBytes += truncatedBytes;
  }
  return selected;
};

const buildBugReportPayload = (input: BugReportPayloadInput): BugReportPayload => {
  const payload: BugReportPayload = {
    schema: 1,
    title: input.title,
    description: input.description,
    includeLogs: input.includeLogs,
    client: input.client,
    diagnostics: input.diagnostics,
    screenshot: input.screenshot,
    attachments: input.attachments.map((attachment) => ({
      name: attachment.name.slice(0, BUG_REPORT_ATTACHMENT_NAME_MAX_LENGTH),
      mime: attachment.mime,
      data: attachment.data,
    })),
    droppedAttachments: 0,
  };

  if (input.includeLogs) {
    payload.logs = selectBugReportLogs(input.logs);
  }

  return payload;
};

const serializeBugReportPayload = (payload: BugReportPayload): string => JSON.stringify(payload);

const fitsWireBudget = (payload: BugReportPayload, budgetBytes: number): boolean =>
  Buffer.byteLength(serializeBugReportPayload(payload), "utf8") <= budgetBytes;

const withLogs = (payload: BugReportPayload, logs: BugReportLogEntry[]): BugReportPayload =>
  payload.logs === undefined ? payload : { ...payload, logs };

const attachmentWireBytes = (attachment: BugReportAttachmentEntry): number =>
  Buffer.byteLength(attachment.data, "utf8");

/**
 * Deterministic wire-budget enforcement: tail-truncate every log to 512 KB,
 * then drop attachments largest-first (screenshot is never dropped, each drop
 * bumps droppedAttachments), then shrink logs down a fixed byte ladder, then
 * drop logs oldest-first (the array is newest-first, so the tail is removed).
 */
const enforceBugReportWireBudget = (
  payload: BugReportPayload,
  budgetBytes: number = BUG_REPORT_WIRE_BUDGET_BYTES,
): BugReportWireBudgetResult => {
  let current = payload;

  if (!fitsWireBudget(current, budgetBytes)) {
    current = withLogs(
      current,
      (current.logs ?? []).map((entry) => ({
        name: entry.name,
        content: tailTruncateBugReportText(entry.content, BUG_REPORT_LOG_ITEM_MAX_BYTES),
      })),
    );
  }

  if (!fitsWireBudget(current, budgetBytes)) {
    let attachments = [...current.attachments];
    let dropped = 0;
    while (attachments.length > 0) {
      let largestIndex = 0;
      for (let index = 1; index < attachments.length; index += 1) {
        if (attachmentWireBytes(attachments[index]) > attachmentWireBytes(attachments[largestIndex])) {
          largestIndex = index;
        }
      }
      attachments = attachments.filter((_, index) => index !== largestIndex);
      dropped += 1;
      current = { ...current, attachments, droppedAttachments: dropped };
      if (fitsWireBudget(current, budgetBytes)) {
        return { ok: true, payload: current };
      }
    }
  }

  for (const cap of BUG_REPORT_LOG_BUDGET_LADDER_BYTES) {
    current = withLogs(
      current,
      (current.logs ?? []).map((entry) => ({
        name: entry.name,
        content: tailTruncateBugReportText(entry.content, cap),
      })),
    );
    if (fitsWireBudget(current, budgetBytes)) {
      return { ok: true, payload: current };
    }
  }

  let logs = [...(current.logs ?? [])];
  while (logs.length > 0) {
    logs = logs.slice(0, -1);
    current = withLogs(current, logs);
    if (fitsWireBudget(current, budgetBytes)) {
      return { ok: true, payload: current };
    }
  }

  return {
    ok: false,
    error: "The bug report is too large to send even after truncating logs and attachments.",
  };
};

export {
  buildBugReportPayload,
  enforceBugReportWireBudget,
  serializeBugReportPayload,
  tailTruncateBugReportText,
  validateBugReportEndpointUrl,
};
